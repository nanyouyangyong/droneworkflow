// ============================================================================
// GraphBuilder — 根据 ParsedWorkflow 动态构建 LangGraph StateGraph
// 运行时将用户/LLM 生成的工作流 JSON 转换为可执行的状态图
// ============================================================================

import { StateGraph, END, START } from "@langchain/langgraph";
import type { BaseCheckpointSaver } from "@langchain/langgraph-checkpoint";
import { DroneWorkflowAnnotation, type DroneWorkflowState } from "./drone-state";
import { resolveNodeAction, type NodeActionConfig } from "./node-actions";
import type { ParsedWorkflow } from "@/lib/types";
import type { DroneChannel } from "@/lib/server/drone-channel";

export interface BuildGraphOptions {
  checkpointer?: BaseCheckpointSaver;
  interruptBefore?: string[];
  interruptAfter?: string[];
}

// 条件评估：读取 state 中的值判断条件表达式
function evaluateCondition(condition: string | null | undefined, state: DroneWorkflowState): boolean {
  if (!condition) return true;
  const condLower = condition.toLowerCase();

  const batteryLtMatch = condLower.match(/battery\s*<\s*(\d+)/);
  if (batteryLtMatch) return state.battery < parseInt(batteryLtMatch[1], 10);

  const batteryGteMatch = condLower.match(/battery\s*>=\s*(\d+)/);
  if (batteryGteMatch) return state.battery >= parseInt(batteryGteMatch[1], 10);

  const batteryGtMatch = condLower.match(/battery\s*>\s*(\d+)/);
  if (batteryGtMatch) return state.battery > parseInt(batteryGtMatch[1], 10);

  const altitudeGtMatch = condLower.match(/altitude\s*>\s*(\d+)/);
  if (altitudeGtMatch) return state.altitude > parseInt(altitudeGtMatch[1], 10);

  if (condLower.includes("obstacle_detected") && condLower.includes("true")) return false;
  if (condLower.includes("obstacle_detected") && condLower.includes("false")) return true;

  return true;
}

/**
 * 根据 ParsedWorkflow 动态构建 LangGraph StateGraph 并编译
 *
 * @param workflow - LLM/用户生成的工作流 JSON
 * @param channel - 无人机通信通道（注入到每个 node action）
 * @param options - 可选配置（checkpointer、中断点）
 * @returns 编译后的可执行图
 */
export function buildWorkflowGraph(
  workflow: ParsedWorkflow,
  channel: DroneChannel,
  options?: BuildGraphOptions
) {
  const graph = new StateGraph(DroneWorkflowAnnotation);

  // 1. 为每个工作流节点添加 LangGraph node
  for (const node of workflow.nodes) {
    const actionFn = resolveNodeAction(node.type);
    const nodeParams = (node.params as Record<string, unknown>) || {};

    graph.addNode(node.id, async (state: DroneWorkflowState) => {
      const config: NodeActionConfig = {
        channel,
        nodeId: node.id,
        nodeLabel: node.label,
        nodeParams,
      };

      // 通过 EventBus 发射进度事件（保持与现有前端联动）
      const executedCount = state.executedNodes.length + 1;
      const progress = Math.floor((executedCount / state.totalNodes) * 100);
      channel.emitProgress(progress, node.id);
      channel.emitLog("info", `执行节点: ${node.label}`, node.id);

      const result = await actionFn(state, config);

      // 发射节点执行结果日志
      const nodeResult = (result as any).nodeResults?.[0];
      if (nodeResult) {
        const level = nodeResult.success ? "success" : "error";
        channel.emitLog(level, nodeResult.message, node.id);
      }

      return { ...result, progress };
    });
  }

  // 2. 添加边
  const startNode = workflow.nodes.find((n) => n.type === "start");
  if (!startNode) {
    throw new Error("工作流缺少 start 节点");
  }

  // START → start 节点
  graph.addEdge(START, startNode.id as any);

  // 为每个节点添加出边
  for (const node of workflow.nodes) {
    const outEdges = workflow.edges.filter((e) => e.from === node.id);

    if (outEdges.length === 0) {
      // 没有出边的节点 → END（通常是 end 节点）
      graph.addEdge(node.id as any, END);
    } else if (outEdges.length === 1 && !outEdges[0].condition) {
      // 单一无条件出边 → 直接连
      graph.addEdge(node.id as any, outEdges[0].to as any);
    } else {
      // 多条出边或有条件 → 条件路由
      const edgesCopy = [...outEdges];
      graph.addConditionalEdges(
        node.id as any,
        (state: DroneWorkflowState) => {
          for (const edge of edgesCopy) {
            if (evaluateCondition(edge.condition, state)) {
              return edge.to;
            }
          }
          // 所有条件都不满足，走第一条边（兜底）
          return edgesCopy[0].to;
        },
        // 路由映射：目标节点 ID → 节点 ID
        Object.fromEntries(edgesCopy.map((e) => [e.to, e.to])) as any
      );
    }
  }

  // 3. 编译（注入 checkpointer 和中断点配置）
  return graph.compile({
    checkpointer: options?.checkpointer,
    interruptBefore: options?.interruptBefore as any,
    interruptAfter: options?.interruptAfter as any,
  });
}

/**
 * 验证工作流是否可以构建为 StateGraph
 */
export function validateWorkflowForGraph(workflow: ParsedWorkflow): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  const startNodes = workflow.nodes.filter((n) => n.type === "start");
  if (startNodes.length === 0) errors.push("缺少 start 节点");
  if (startNodes.length > 1) errors.push("存在多个 start 节点");

  const endNodes = workflow.nodes.filter((n) => n.type === "end");
  if (endNodes.length === 0) errors.push("缺少 end 节点");

  const nodeIds = new Set(workflow.nodes.map((n) => n.id));
  for (const edge of workflow.edges) {
    if (!nodeIds.has(edge.from)) errors.push(`边 ${edge.id} 的源节点 ${edge.from} 不存在`);
    if (!nodeIds.has(edge.to)) errors.push(`边 ${edge.id} 的目标节点 ${edge.to} 不存在`);
  }

  return { valid: errors.length === 0, errors };
}
