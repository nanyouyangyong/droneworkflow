// ============================================================================
// SubMissionRunner — 单个子任务执行器
// 职责：执行一个工作流，操作一架无人机
// 不知道自己是单机还是多机场景，只通过 DroneChannel 与无人机交互
// ============================================================================

import type { ParsedWorkflow, WorkflowNode, SubMissionState } from "@/lib/types";
import { DroneChannel, type DroneState } from "@/lib/server/drone-channel";

// 节点类型到 MCP 工具的映射
interface ToolMapping {
  tool: string;
  paramsMapper: (params: Record<string, unknown>, droneState: DroneState) => Record<string, any>;
}

const NODE_TYPE_TO_MCP_TOOL: Record<string, ToolMapping> = {
  "起飞": {
    tool: "drone:takeoff",
    paramsMapper: (params) => ({ altitude: Number(params.altitude ?? 30) }),
  },
  "降落": {
    tool: "drone:land",
    paramsMapper: () => ({}),
  },
  "悬停": {
    tool: "drone:hover",
    paramsMapper: (params) => ({ duration: Number(params.duration ?? 5) }),
  },
  "飞行到点": {
    tool: "drone:fly_to",
    paramsMapper: (params, ds) => ({
      lat: Number(params.lat ?? ds.position.lat),
      lng: Number(params.lng ?? ds.position.lng),
      altitude: Number(params.altitude ?? ds.altitude),
    }),
  },
  "定时拍照": {
    tool: "drone:take_photo",
    paramsMapper: (params) => ({ count: Number(params.count ?? 1) }),
  },
  "录像": {
    tool: "drone:record_video",
    paramsMapper: (params) => ({ action: String(params.action ?? "start") }),
  },
  "电量检查": {
    tool: "drone:check_battery",
    paramsMapper: (params) => ({ threshold: Number(params.threshold ?? params.low ?? 30) }),
  },
  "返航": {
    tool: "drone:return_home",
    paramsMapper: () => ({}),
  },
  "地址解析": {
    tool: "amap:maps_geo",
    paramsMapper: (params) => ({ address: String(params.address ?? "") }),
  },
  "路径规划": {
    tool: "amap:maps_direction_driving",
    paramsMapper: (params) => ({
      origin: String(params.origin ?? ""),
      destination: String(params.destination ?? ""),
    }),
  },
  "POI搜索": {
    tool: "amap:maps_around",
    paramsMapper: (params) => ({
      location: String(params.location ?? ""),
      keywords: String(params.keywords ?? ""),
      radius: Number(params.radius ?? 1000),
    }),
  },
  "天气查询": {
    tool: "amap:maps_weather",
    paramsMapper: (params) => ({ city: String(params.city ?? "") }),
  },
};

export interface SubMissionResult {
  success: boolean;
  subMissionId: string;
  droneId: string;
  finalState: SubMissionState;
}

export class SubMissionRunner {
  private channel: DroneChannel;
  private workflow: ParsedWorkflow;
  private subMissionId: string;

  constructor(channel: DroneChannel, workflow: ParsedWorkflow, subMissionId: string) {
    this.channel = channel;
    this.workflow = workflow;
    this.subMissionId = subMissionId;
  }

  /** 执行工作流（BFS 图遍历） */
  async run(): Promise<SubMissionResult> {
    const wf = this.workflow;
    const nodeMap = new Map(wf.nodes.map((n) => [n.id, n]));

    const startNode = wf.nodes.find((n) => n.type === "start");
    if (!startNode) {
      this.channel.emitLog("error", "工作流缺少开始节点");
      this.channel.emitStatus("failed", "工作流缺少开始节点");
      return this.buildResult(false, "failed");
    }

    this.channel.emitStatus("running");
    this.channel.emitLog("info", `子任务开始 [${this.channel.droneId}]`);

    const visited = new Set<string>();
    const queue: string[] = [startNode.id];
    let executedCount = 0;
    const totalNodes = wf.nodes.length;

    while (queue.length > 0) {
      const currentId = queue.shift()!;
      if (visited.has(currentId)) continue;
      visited.add(currentId);

      const currentNode = nodeMap.get(currentId);
      if (!currentNode) continue;

      executedCount++;
      const progress = Math.floor((executedCount / totalNodes) * 100);
      this.channel.emitProgress(progress, currentId);
      this.channel.emitLog("info", `执行节点: ${currentNode.label}`, currentId);

      // 执行节点
      const result = await this.executeNode(currentNode);

      if (result.success) {
        const level = currentNode.type === "电量检查" && this.channel.state.battery < 30 ? "warning" : "success";
        this.channel.emitLog(level, result.message, currentId);
      } else {
        this.channel.emitLog("error", result.message, currentId);
        this.channel.emitStatus("failed", result.message);
        return this.buildResult(false, "failed");
      }

      // 找到下一个节点
      const outEdges = wf.edges.filter((e) => e.from === currentId);
      for (const edge of outEdges) {
        if (this.evaluateCondition(edge.condition)) {
          if (!visited.has(edge.to)) {
            queue.push(edge.to);
          }
          break;
        }
      }
    }

    this.channel.emitProgress(100);
    this.channel.emitLog("success", `子任务完成 [${this.channel.droneId}]，剩余电量: ${this.channel.state.battery}%`);
    this.channel.emitStatus("completed");
    return this.buildResult(true, "completed");
  }

  // ---- 节点执行 ----

  private async executeNode(node: WorkflowNode): Promise<{ success: boolean; message: string }> {
    const params = (node.params as Record<string, unknown>) || {};

    switch (node.type) {
      case "start":
        return this.executeStartNode();
      case "end":
        return { success: true, message: "工作流结束" };
      case "parallel_fork":
        return { success: true, message: "并行分发" };
      case "parallel_join":
        return { success: true, message: "等待全部完成" };
      case "条件判断":
        return { success: true, message: "条件判断完成" };
      case "区域巡检":
        return this.executePatrolNode(params);
      default:
        return this.executeMappedNode(node, params);
    }
  }

  private async executeStartNode(): Promise<{ success: boolean; message: string }> {
    try {
      const result = await this.channel.callTool("drone:connect_drone", {
        droneId: this.channel.droneId,
      });
      if (result?.success !== false) {
        this.channel.updateState({ connected: true });
        return { success: true, message: `无人机 ${this.channel.droneId} 已连接` };
      }
      this.channel.updateState({ connected: true });
      return { success: true, message: "工作流开始" };
    } catch {
      this.channel.updateState({ connected: false });
      return { success: true, message: "工作流开始（模拟模式）" };
    }
  }

  private async executePatrolNode(params: Record<string, unknown>): Promise<{ success: boolean; message: string }> {
    const areaName = String(params.areaName ?? "未知区域");
    try {
      await this.channel.callTool("drone:take_photo", { count: 3 });
      const statusResult = await this.channel.callTool("drone:get_drone_status", {});
      if (statusResult?.droneState) {
        this.channel.updateState(statusResult.droneState);
      }
      return { success: true, message: `${areaName} 巡检完成` };
    } catch {
      this.channel.updateState({ battery: this.channel.state.battery - 8 });
      return { success: true, message: `${areaName} 巡检完成（模拟）` };
    }
  }

  private async executeMappedNode(node: WorkflowNode, params: Record<string, unknown>): Promise<{ success: boolean; message: string }> {
    const toolMapping = NODE_TYPE_TO_MCP_TOOL[node.type];

    if (toolMapping) {
      try {
        const mcpParams = toolMapping.paramsMapper(params, this.channel.state);
        const result = await this.channel.callTool(toolMapping.tool, mcpParams);

        // 处理电量检查的特殊返回
        if (node.type === "电量检查" && result?.battery !== undefined) {
          this.channel.updateState({ battery: result.battery });
          return {
            success: true,
            message: result.isLow
              ? `电量 ${result.battery}% 低于阈值 ${result.threshold}%，需要返航`
              : `电量 ${result.battery}% 正常（阈值 ${result.threshold}%）`,
          };
        }

        return {
          success: result?.success !== false,
          message: result?.message || result?.error || `执行 ${node.label} 完成`,
        };
      } catch {
        return this.executeFallback(node, params);
      }
    }

    return this.executeFallback(node, params);
  }

  // ---- 降级模拟执行 ----

  private async executeFallback(node: WorkflowNode, params: Record<string, unknown>): Promise<{ success: boolean; message: string }> {
    await delay(300);
    const ds = this.channel.state;

    switch (node.type) {
      case "起飞": {
        const altitude = Number(params.altitude ?? 30);
        this.channel.updateState({ altitude, status: "flying", battery: ds.battery - 2 });
        return { success: true, message: `起飞到 ${altitude} 米高度（模拟）` };
      }
      case "降落":
        this.channel.updateState({ altitude: 0, status: "idle", battery: ds.battery - 1 });
        return { success: true, message: "无人机已安全降落（模拟）" };
      case "悬停": {
        const duration = Number(params.duration ?? 5);
        this.channel.updateState({ status: "hovering", battery: ds.battery - Math.ceil(duration / 10) });
        return { success: true, message: `悬停 ${duration} 秒完成（模拟）` };
      }
      case "飞行到点": {
        const lat = Number(params.lat ?? ds.position.lat);
        const lng = Number(params.lng ?? ds.position.lng);
        this.channel.updateState({ position: { lat, lng }, status: "flying", battery: ds.battery - 5 });
        return { success: true, message: `已飞行到坐标 (${lat.toFixed(4)}, ${lng.toFixed(4)})（模拟）` };
      }
      case "返航":
        this.channel.updateState({ position: { lat: 39.9042, lng: 116.4074 }, status: "returning", battery: ds.battery - 3 });
        return { success: true, message: "已返回起飞点（模拟）" };
      default:
        return { success: true, message: `执行节点: ${node.label}（模拟）` };
    }
  }

  // ---- 条件评估 ----

  private evaluateCondition(condition: string | null | undefined): boolean {
    if (!condition) return true;
    const condLower = condition.toLowerCase();
    const ds = this.channel.state;

    const batteryLtMatch = condLower.match(/battery\s*<\s*(\d+)/);
    if (batteryLtMatch) return ds.battery < parseInt(batteryLtMatch[1], 10);

    const batteryGteMatch = condLower.match(/battery\s*>=\s*(\d+)/);
    if (batteryGteMatch) return ds.battery >= parseInt(batteryGteMatch[1], 10);

    const batteryGtMatch = condLower.match(/battery\s*>\s*(\d+)/);
    if (batteryGtMatch) return ds.battery > parseInt(batteryGtMatch[1], 10);

    return true;
  }

  // ---- 辅助 ----

  private buildResult(success: boolean, status: string): SubMissionResult {
    return {
      success,
      subMissionId: this.subMissionId,
      droneId: this.channel.droneId,
      finalState: {
        subMissionId: this.subMissionId,
        droneId: this.channel.droneId,
        workflow: this.workflow,
        status: status as any,
        progress: success ? 100 : 0,
        logs: [],
        finishedAt: Date.now(),
      },
    };
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
