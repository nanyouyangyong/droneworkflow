// ============================================================================
// FleetGraph — 多无人机编排图（OrchestratorGraph）
// 将多架无人机的子工作流嵌入统一的 LangGraph StateGraph
// 通过共享状态实现并行执行 + 跨无人机状态同步 + 协调决策
// ============================================================================

import { StateGraph, END, START } from "@langchain/langgraph";
import type { BaseCheckpointSaver } from "@langchain/langgraph-checkpoint";
import {
  FleetAnnotation,
  type FleetState,
  type DroneSnapshot,
  type CoordinationSignal,
  type FleetDroneEntry,
} from "./fleet-state";
import { buildWorkflowGraph, type BuildGraphOptions } from "./graph-builder";
import { createInitialState } from "./drone-state";
import { DroneChannel } from "@/lib/server/drone-channel";
import { appEventBus } from "@/lib/server/event-bus";
import type {
  CoordinationPolicy,
  ParsedWorkflow,
  CoordinationSignalType,
} from "@/lib/types";
import type { SubMissionResult } from "@/lib/server/sub-mission-runner";

// ---- 编排图构建选项 ----

export interface FleetGraphOptions {
  checkpointer?: BaseCheckpointSaver;
}

// ---- 编排图构建 ----

/**
 * 构建多无人机编排图（OrchestratorGraph）
 *
 * 节点流程：dispatch → execute → coordinate → (循环或) aggregate
 *
 * @param missionId - 父任务 ID
 * @param drones - 无人机列表及其工作流
 * @param coordinationPolicy - 协调策略（LLM 生成）
 * @param options - 编排图选项（checkpointer）
 */
export function buildFleetGraph(
  missionId: string,
  drones: Array<{ droneId: string; workflow: ParsedWorkflow }>,
  coordinationPolicy: CoordinationPolicy = { stateSharing: "none" },
  options?: FleetGraphOptions,
) {
  const graph = new StateGraph(FleetAnnotation);

  // ================================================================
  // Node: dispatch — 初始化所有无人机状态快照和 DroneChannel
  // ================================================================
  graph.addNode("dispatch", async (state: FleetState) => {
    const droneSnapshots: Record<string, DroneSnapshot> = {};
    const entries: FleetDroneEntry[] = [];

    drones.forEach((d, idx) => {
      const subMissionId = `${missionId}_sub_${idx}`;
      droneSnapshots[d.droneId] = {
        droneId: d.droneId,
        battery: 100,
        altitude: 0,
        position: { lat: 39.9042, lng: 116.4074 },
        status: "idle",
        currentNodeId: "",
        progress: 0,
        lastUpdated: Date.now(),
      };
      entries.push({
        droneId: d.droneId,
        subMissionId,
        workflow: d.workflow,
        status: "running",
        progress: 0,
      });
    });

    appEventBus.publish({
      type: "mission:log",
      missionId,
      data: { level: "info", message: `编排图启动：${drones.length} 架无人机并行（带状态同步）` },
      timestamp: Date.now(),
    });

    return {
      droneSnapshots,
      droneEntries: entries,
      phase: "execute",
      round: 1,
    } as Partial<FleetState>;
  });

  // ================================================================
  // Node: execute — 并行执行所有未完成无人机的子工作流
  // 每架无人机各自构建独立的 StateGraph 并执行
  // 执行前将其他无人机的快照注入到 sharedFlags 中
  // ================================================================
  graph.addNode("execute", async (state: FleetState) => {
    const pendingEntries = state.droneEntries.filter(
      (e) => !state.completedDrones.includes(e.droneId)
    );

    // 并行执行所有未完成的子任务
    const execPromises = pendingEntries.map(async (entry) => {
      const channel = new DroneChannel(entry.droneId, entry.subMissionId);

      // 注入其他无人机的状态快照作为 sharedFlags
      const otherSnapshots: Record<string, DroneSnapshot> = {};
      for (const [id, snap] of Object.entries(state.droneSnapshots)) {
        if (id !== entry.droneId) {
          otherSnapshots[id] = snap;
        }
      }

      // 提取发给该无人机的未消费信号
      const mySignals = state.signals.filter(
        (s) => !s.consumed && (s.toDrone === entry.droneId || s.toDrone === "*")
      );

      // 构建子工作流 StateGraph
      const compiledSubGraph = buildWorkflowGraph(entry.workflow, channel);

      // 准备初始状态（注入 sharedFlags）
      const initialState = createInitialState(
        entry.droneId,
        entry.subMissionId,
        entry.workflow.nodes.length,
      );
      (initialState as any).sharedFlags = {
        otherDrones: otherSnapshots,
        signals: mySignals,
        coordinationPolicy: state.coordinationPolicy,
      };

      try {
        const finalState = await compiledSubGraph.invoke(initialState);
        const success = finalState.success && !finalState.error;

        // 构建快照更新
        const snapshot: DroneSnapshot = {
          droneId: entry.droneId,
          battery: finalState.battery,
          altitude: finalState.altitude,
          position: finalState.position,
          status: finalState.droneStatus,
          currentNodeId: finalState.currentNodeId,
          progress: finalState.progress,
          lastUpdated: Date.now(),
        };

        // 构建 SubMissionResult
        const result: SubMissionResult = {
          success,
          subMissionId: entry.subMissionId,
          droneId: entry.droneId,
          finalState: {
            subMissionId: entry.subMissionId,
            droneId: entry.droneId,
            workflow: entry.workflow,
            status: success ? "completed" : "failed",
            progress: finalState.progress,
            logs: finalState.logs.map((l: any) => ({
              ts: l.ts,
              level: l.level,
              message: l.message,
              nodeId: l.nodeId,
              droneId: entry.droneId,
            })),
            finishedAt: Date.now(),
            error: finalState.error || undefined,
          },
        };

        // 检查是否需要发出协调信号
        const newSignals = evaluateSignalRules(
          state.coordinationPolicy,
          entry.droneId,
          finalState,
        );

        return { snapshot, result, success, newSignals, droneId: entry.droneId };
      } catch (err: any) {
        const result: SubMissionResult = {
          success: false,
          subMissionId: entry.subMissionId,
          droneId: entry.droneId,
          finalState: {
            subMissionId: entry.subMissionId,
            droneId: entry.droneId,
            workflow: entry.workflow,
            status: "failed",
            progress: 0,
            logs: [],
            finishedAt: Date.now(),
            error: err.message,
          },
        };
        return {
          snapshot: state.droneSnapshots[entry.droneId],
          result,
          success: false,
          newSignals: [] as CoordinationSignal[],
          droneId: entry.droneId,
        };
      }
    });

    const outcomes = await Promise.allSettled(execPromises);

    // 聚合执行结果
    const snapshotUpdates: Record<string, DroneSnapshot> = {};
    const resultUpdates: Record<string, SubMissionResult> = {};
    const newCompleted: string[] = [];
    const allNewSignals: CoordinationSignal[] = [];
    const updatedEntries = [...state.droneEntries];

    for (const settled of outcomes) {
      if (settled.status === "fulfilled") {
        const { snapshot, result, success, newSignals, droneId } = settled.value;
        snapshotUpdates[droneId] = snapshot;
        resultUpdates[droneId] = result;
        if (success) newCompleted.push(droneId);
        allNewSignals.push(...newSignals);

        // 更新 entry 状态
        const entryIdx = updatedEntries.findIndex((e) => e.droneId === droneId);
        if (entryIdx >= 0) {
          updatedEntries[entryIdx] = {
            ...updatedEntries[entryIdx],
            status: success ? "completed" : "failed",
            progress: result.finalState.progress,
            error: result.finalState.error,
          };
        }
      }
    }

    // 发布进度聚合事件
    const totalProgress = updatedEntries.reduce((sum, e) => sum + e.progress, 0);
    const overallProgress = Math.floor(totalProgress / updatedEntries.length);
    appEventBus.publish({
      type: "mission:aggregate",
      missionId,
      data: {
        overallProgress,
        subStatuses: updatedEntries.map((e) => ({
          subMissionId: e.subMissionId,
          droneId: e.droneId,
          status: e.status,
          progress: e.progress,
        })),
      },
      timestamp: Date.now(),
    });

    return {
      droneSnapshots: snapshotUpdates,
      results: resultUpdates,
      completedDrones: newCompleted,
      signals: allNewSignals,
      droneEntries: updatedEntries,
      phase: "coordinate",
    } as Partial<FleetState>;
  });

  // ================================================================
  // Node: coordinate — 处理协调信号，决定下一步动作
  // 读取信号队列，标记已消费，必要时调整任务分配
  // ================================================================
  graph.addNode("coordinate", async (state: FleetState) => {
    const unconsumed = state.signals.filter((s) => !s.consumed);

    if (unconsumed.length === 0) {
      return { phase: "aggregate" } as Partial<FleetState>;
    }

    // 标记所有信号为已消费
    const updatedSignals = unconsumed.map((s) => ({
      ...s,
      consumed: true,
    }));

    // 记录协调日志
    for (const signal of unconsumed) {
      const targetDesc = signal.toDrone === "*" ? "所有无人机" : signal.toDrone;
      appEventBus.publish({
        type: "mission:log",
        missionId,
        data: {
          level: "info",
          message: `[协调] ${signal.fromDrone} → ${targetDesc}: ${signal.type}`,
          droneId: signal.fromDrone,
        },
        timestamp: Date.now(),
      });
    }

    // 检查同步屏障
    const updatedBarriers = { ...state.barriers };
    for (const [barrierId, barrier] of Object.entries(updatedBarriers)) {
      if (barrier.released) continue;
      // 检查所有需要的无人机是否都已完成或到达同步点
      const allReady = barrier.requiredDrones.every(
        (d) => state.completedDrones.includes(d) || barrier.readyDrones.includes(d)
      );
      if (allReady) {
        updatedBarriers[barrierId] = { ...barrier, released: true };
        appEventBus.publish({
          type: "mission:log",
          missionId,
          data: {
            level: "info",
            message: `[同步屏障] ${barrierId} 已释放，所有无人机已就绪`,
          },
          timestamp: Date.now(),
        });
      }
    }

    return {
      signals: updatedSignals,
      barriers: updatedBarriers,
      phase: "aggregate",
    } as Partial<FleetState>;
  });

  // ================================================================
  // Node: aggregate — 检查所有无人机是否完成，聚合最终结果
  // ================================================================
  graph.addNode("aggregate", async (state: FleetState) => {
    const allDroneIds = drones.map((d) => d.droneId);
    const allCompleted = allDroneIds.every((id) =>
      state.completedDrones.includes(id) ||
      state.droneEntries.find((e) => e.droneId === id)?.status === "completed" ||
      state.droneEntries.find((e) => e.droneId === id)?.status === "failed"
    );

    if (!allCompleted) {
      // 还有未完成的无人机，回到 execute 继续
      return {
        phase: "execute",
        round: state.round + 1,
      } as Partial<FleetState>;
    }

    // 所有无人机已完成，发布最终状态
    const results = state.results;
    const successCount = Object.values(results).filter((r) => r.success).length;
    const totalCount = allDroneIds.length;

    const overallStatus = successCount === totalCount
      ? "completed"
      : successCount === 0
        ? "failed"
        : "partial_completed";

    appEventBus.publish({
      type: "mission:aggregate",
      missionId,
      data: {
        overallProgress: 100,
        overallStatus,
        subStatuses: state.droneEntries.map((e) => ({
          subMissionId: e.subMissionId,
          droneId: e.droneId,
          status: e.status,
          progress: e.progress,
        })),
      },
      timestamp: Date.now(),
    });

    appEventBus.publish({
      type: "mission:log",
      missionId,
      data: {
        level: overallStatus === "completed" ? "success" : "warning",
        message: `编排完成: ${successCount}/${totalCount} 架无人机成功`,
      },
      timestamp: Date.now(),
    });

    return { phase: "done" } as Partial<FleetState>;
  });

  // ================================================================
  // 边定义
  // ================================================================

  graph.addEdge(START, "dispatch" as any);
  graph.addEdge("dispatch" as any, "execute" as any);
  graph.addEdge("execute" as any, "coordinate" as any);

  // coordinate → aggregate（无论是否有信号都去 aggregate 检查）
  graph.addEdge("coordinate" as any, "aggregate" as any);

  // aggregate → 条件路由：完成则 END，未完成则回到 execute
  graph.addConditionalEdges(
    "aggregate" as any,
    (state: FleetState) => {
      if (state.phase === "done") return "__end__";
      return "execute";
    },
    {
      "__end__": END,
      "execute": "execute" as any,
    } as any,
  );

  // ================================================================
  // 编译
  // ================================================================
  return graph.compile({
    checkpointer: options?.checkpointer,
  });
}

// ---- 辅助函数 ----

/**
 * 根据协调策略的信号规则，评估当前无人机状态是否触发信号
 */
function evaluateSignalRules(
  policy: CoordinationPolicy,
  droneId: string,
  finalState: any,
): CoordinationSignal[] {
  if (!policy.signalRules) return [];

  const signals: CoordinationSignal[] = [];

  for (const rule of policy.signalRules) {
    if (rule.fromDrone !== droneId && rule.fromDrone !== "*") continue;

    let triggered = false;

    // 简单条件评估
    const trigger = rule.trigger.toLowerCase();
    const batteryMatch = trigger.match(/battery\s*<\s*(\d+)/);
    if (batteryMatch) {
      triggered = finalState.battery < parseInt(batteryMatch[1], 10);
    }

    const altitudeMatch = trigger.match(/altitude\s*>\s*(\d+)/);
    if (altitudeMatch) {
      triggered = finalState.altitude > parseInt(altitudeMatch[1], 10);
    }

    if (trigger.includes("completed") || trigger.includes("done")) {
      triggered = finalState.success === true;
    }

    if (trigger.includes("failed") || trigger.includes("error")) {
      triggered = finalState.success === false || !!finalState.error;
    }

    if (triggered) {
      signals.push({
        type: rule.signalType,
        fromDrone: droneId,
        toDrone: rule.toDrone,
        payload: rule.payload || {},
        ts: Date.now(),
        consumed: false,
      });
    }
  }

  return signals;
}
