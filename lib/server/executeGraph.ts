import type { Server as SocketIOServer } from "socket.io";
import { Annotation, StateGraph, START, END } from "@langchain/langgraph";
import type { MissionState, ParsedWorkflow, WorkflowNode } from "@/lib/types";
import {
  appendMissionLog,
  getMission,
  setMissionProgress,
  setMissionStatus,
  type MissionRecord,
  upsertMission
} from "@/lib/server/missionStore";
import { Mission } from "@/lib/server/models";
import { connectDB } from "@/lib/server/db";
import { callMCPTool, initMCPClient } from "@/lib/server/mcp/mcp-client";

const ExecState = Annotation.Root({
  missionId: Annotation<string>({
    reducer: (_x: string, y: string) => y,
    default: () => ""
  }),
  workflow: Annotation<ParsedWorkflow>({
    reducer: (_x: ParsedWorkflow, y: ParsedWorkflow) => y,
    default: () => ({ workflow_name: "", nodes: [], edges: [] })
  }),
  index: Annotation<number>({
    reducer: (_x: number, y: number) => y,
    default: () => 0
  }),
  progress: Annotation<number>({
    reducer: (_x: number, y: number) => y,
    default: () => 0
  })
});

type ExecStateType = typeof ExecState.State;

function emitLog(io: SocketIOServer | undefined, missionId: string, level: any, message: string, nodeId?: string) {
  appendMissionLog(missionId, level, message, nodeId);
  io?.to(missionId).emit("mission:log", {
    missionId,
    log: { ts: Date.now(), level, message, nodeId }
  });
}

function emitState(io: SocketIOServer | undefined, state: MissionState) {
  io?.to(state.missionId).emit("mission:state", {
    missionId: state.missionId,
    state: { status: state.status, progress: state.progress, currentNode: state.currentNode }
  });
}

// 无人机状态（从MCP服务同步）
interface DroneState {
  connected: boolean;
  battery: number;
  altitude: number;
  position: { lat: number; lng: number };
  status: "idle" | "flying" | "hovering" | "returning";
  isRecording: boolean;
}

function createInitialDroneState(): DroneState {
  return {
    connected: false,
    battery: 100,
    altitude: 0,
    position: { lat: 39.9042, lng: 116.4074 },
    status: "idle",
    isRecording: false
  };
}

// 节点类型到MCP工具的映射
const NODE_TYPE_TO_MCP_TOOL: Record<string, { tool: string; paramsMapper: (params: Record<string, unknown>, droneState: DroneState) => Record<string, any> }> = {
  "起飞": {
    tool: "takeoff",
    paramsMapper: (params) => ({ altitude: Number(params.altitude ?? 30) })
  },
  "降落": {
    tool: "land",
    paramsMapper: () => ({})
  },
  "悬停": {
    tool: "hover",
    paramsMapper: (params) => ({ duration: Number(params.duration ?? 5) })
  },
  "飞行到点": {
    tool: "fly_to",
    paramsMapper: (params, droneState) => ({
      lat: Number(params.lat ?? droneState.position.lat),
      lng: Number(params.lng ?? droneState.position.lng),
      altitude: Number(params.altitude ?? droneState.altitude)
    })
  },
  "定时拍照": {
    tool: "take_photo",
    paramsMapper: (params) => ({ count: Number(params.count ?? 1) })
  },
  "录像": {
    tool: "record_video",
    paramsMapper: (params) => ({ action: String(params.action ?? "start") })
  },
  "电量检查": {
    tool: "check_battery",
    paramsMapper: (params) => ({ threshold: Number(params.threshold ?? params.low ?? 30) })
  },
  "返航": {
    tool: "return_home",
    paramsMapper: () => ({})
  }
};

// 通过MCP服务执行单个节点
async function executeNodeViaMCP(
  node: WorkflowNode,
  droneState: DroneState,
  io: SocketIOServer | undefined,
  missionId: string
): Promise<{ success: boolean; message: string; droneState: DroneState }> {
  const params = node.params as Record<string, unknown> || {};

  // 处理特殊节点类型
  switch (node.type) {
    case "start": {
      // 开始节点：连接无人机
      try {
        const result = await callMCPTool("connect_drone", { droneId: `drone-${missionId.slice(0, 8)}` });
        if (result.success && result.droneState) {
          return {
            success: true,
            message: result.message || "工作流开始，无人机已连接",
            droneState: { ...droneState, ...result.droneState, connected: true }
          };
        }
        return { success: true, message: "工作流开始", droneState: { ...droneState, connected: true } };
      } catch (error) {
        // 如果MCP连接失败，继续执行但标记为未连接
        console.warn("MCP connect_drone failed, continuing with simulation:", error);
        return { success: true, message: "工作流开始（模拟模式）", droneState: { ...droneState, connected: false } };
      }
    }

    case "end":
      return { success: true, message: "工作流结束", droneState };

    case "条件判断":
      return { success: true, message: "条件判断完成", droneState };

    case "区域巡检": {
      // 区域巡检：组合多个MCP工具调用
      const areaName = String(params.areaName ?? "未知区域");
      try {
        // 拍照记录巡检
        await callMCPTool("take_photo", { count: 3 });
        // 获取最新状态
        const statusResult = await callMCPTool("get_drone_status", {});
        if (statusResult.droneState) {
          droneState = { ...droneState, ...statusResult.droneState };
        }
        return { success: true, message: `${areaName} 巡检完成`, droneState };
      } catch (error) {
        return { success: true, message: `${areaName} 巡检完成（模拟）`, droneState: { ...droneState, battery: droneState.battery - 8 } };
      }
    }

    default:
      break;
  }

  // 查找对应的MCP工具映射
  const toolMapping = NODE_TYPE_TO_MCP_TOOL[node.type];
  
  if (toolMapping) {
    try {
      const mcpParams = toolMapping.paramsMapper(params, droneState);
      const result = await callMCPTool(toolMapping.tool, mcpParams);
      
      // 更新无人机状态
      if (result.droneState) {
        droneState = { ...droneState, ...result.droneState };
      }
      
      // 处理电量检查的特殊返回
      if (node.type === "电量检查" && result.battery !== undefined) {
        droneState.battery = result.battery;
        const isLow = result.isLow;
        return {
          success: true,
          message: isLow
            ? `电量 ${result.battery}% 低于阈值 ${result.threshold}%，需要返航`
            : `电量 ${result.battery}% 正常（阈值 ${result.threshold}%）`,
          droneState
        };
      }
      
      return {
        success: result.success !== false,
        message: result.message || result.error || `执行 ${node.label} 完成`,
        droneState
      };
    } catch (error: any) {
      console.error(`MCP tool call failed for ${node.type}:`, error);
      // 降级到模拟执行
      return executeNodeFallback(node, droneState);
    }
  }

  // 未映射的节点类型，使用模拟执行
  return executeNodeFallback(node, droneState);
}

// 降级模拟执行（当MCP不可用时）
async function executeNodeFallback(
  node: WorkflowNode,
  droneState: DroneState
): Promise<{ success: boolean; message: string; droneState: DroneState }> {
  const params = node.params as Record<string, unknown> || {};
  
  await simulateDelay(300);
  
  switch (node.type) {
    case "起飞": {
      const altitude = Number(params.altitude ?? 30);
      droneState.altitude = altitude;
      droneState.status = "flying";
      droneState.battery -= 2;
      return { success: true, message: `起飞到 ${altitude} 米高度（模拟）`, droneState };
    }
    case "降落":
      droneState.altitude = 0;
      droneState.status = "idle";
      droneState.battery -= 1;
      return { success: true, message: "无人机已安全降落（模拟）", droneState };
    case "悬停": {
      const duration = Number(params.duration ?? 5);
      droneState.status = "hovering";
      droneState.battery -= Math.ceil(duration / 10);
      return { success: true, message: `悬停 ${duration} 秒完成（模拟）`, droneState };
    }
    case "飞行到点": {
      const lat = Number(params.lat ?? droneState.position.lat);
      const lng = Number(params.lng ?? droneState.position.lng);
      droneState.position = { lat, lng };
      droneState.status = "flying";
      droneState.battery -= 5;
      return { success: true, message: `已飞行到坐标 (${lat.toFixed(4)}, ${lng.toFixed(4)})（模拟）`, droneState };
    }
    case "返航":
      droneState.position = { lat: 39.9042, lng: 116.4074 };
      droneState.status = "returning";
      droneState.battery -= 3;
      return { success: true, message: "已返回起飞点（模拟）", droneState };
    default:
      return { success: true, message: `执行节点: ${node.label}（模拟）`, droneState };
  }
}

function simulateDelay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// 根据边的条件判断下一个节点
function evaluateCondition(condition: string | null | undefined, droneState: DroneState): boolean {
  if (!condition) return true;

  // 简单的条件解析
  const condLower = condition.toLowerCase();

  // battery < 30% 或 battery < 30
  const batteryLtMatch = condLower.match(/battery\s*<\s*(\d+)/);
  if (batteryLtMatch) {
    return droneState.battery < parseInt(batteryLtMatch[1], 10);
  }

  // battery >= 30% 或 battery >= 30
  const batteryGteMatch = condLower.match(/battery\s*>=\s*(\d+)/);
  if (batteryGteMatch) {
    return droneState.battery >= parseInt(batteryGteMatch[1], 10);
  }

  // battery > 30
  const batteryGtMatch = condLower.match(/battery\s*>\s*(\d+)/);
  if (batteryGtMatch) {
    return droneState.battery > parseInt(batteryGtMatch[1], 10);
  }

  // 默认返回 true
  return true;
}

// 执行工作流（基于图遍历）
async function runWorkflow(state: ExecStateType, io: SocketIOServer | undefined) {
  const missionId = state.missionId;
  const wf = state.workflow as ParsedWorkflow;
  let droneState = createInitialDroneState();

  // 构建节点映射
  const nodeMap = new Map(wf.nodes.map((n) => [n.id, n]));

  // 找到开始节点
  const startNode = wf.nodes.find((n) => n.type === "start");
  if (!startNode) {
    emitLog(io, missionId, "error", "工作流缺少开始节点");
    setMissionStatus(missionId, "failed");
    return { ...state, progress: 0 };
  }

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
    setMissionProgress(missionId, progress, currentId);
    emitState(io, getMissionStateOrThrow(missionId));

    emitLog(io, missionId, "info", `执行节点: ${currentNode.label}`, currentId);

    // 通过MCP服务执行节点
    const result = await executeNodeViaMCP(currentNode, droneState, io, missionId);
    droneState = result.droneState;

    if (result.success) {
      const level = currentNode.type === "电量检查" && droneState.battery < 30 ? "warning" : "success";
      emitLog(io, missionId, level, result.message, currentId);
    } else {
      emitLog(io, missionId, "error", result.message, currentId);
      setMissionStatus(missionId, "failed");
      return { ...state, progress };
    }

    // 找到下一个节点
    const outEdges = wf.edges.filter((e) => e.from === currentId);
    for (const edge of outEdges) {
      if (evaluateCondition(edge.condition, droneState)) {
        if (!visited.has(edge.to)) {
          queue.push(edge.to);
        }
        break; // 只走第一条满足条件的边
      }
    }
  }

  setMissionProgress(missionId, 100);
  setMissionStatus(missionId, "completed");

  const finalState = getMissionStateOrThrow(missionId);
  emitLog(io, missionId, "success", `工作流执行完成，剩余电量: ${droneState.battery}%`);
  emitState(io, finalState);

  // 保存到 MongoDB
  await saveMissionToDB(missionId, finalState, wf);

  return { ...state, progress: 100 };
}

async function saveMissionToDB(missionId: string, state: MissionState, workflow: ParsedWorkflow) {
  try {
    await connectDB();
    await Mission.findOneAndUpdate(
      { missionId },
      {
        missionId,
        workflowSnapshot: {
          name: workflow.workflow_name,
          nodes: workflow.nodes,
          edges: workflow.edges
        },
        status: state.status,
        progress: state.progress,
        currentNode: state.currentNode,
        logs: state.logs,
        completedAt: state.status === "completed" ? new Date() : undefined
      },
      { upsert: true, new: true }
    );
  } catch (error) {
    console.error("Failed to save mission to MongoDB:", error);
  }
}

function getMissionStateOrThrow(missionId: string): MissionState {
  const rec = getMission(missionId);
  if (!rec) throw new Error("mission not found");
  return rec.state;
}

export async function startExecution(missionId: string, workflow: ParsedWorkflow, io: SocketIOServer | undefined) {
  const init: MissionState = {
    missionId,
    name: workflow.workflow_name,
    description: workflow.workflow_name,
    status: "running",
    progress: 0,
    logs: []
  };

  const record: MissionRecord = { state: init, workflow };
  upsertMission(missionId, record);

  // 保存初始状态到 MongoDB
  try {
    await connectDB();
    await Mission.create({
      missionId,
      workflowSnapshot: {
        name: workflow.workflow_name,
        nodes: workflow.nodes,
        edges: workflow.edges
      },
      status: "running",
      progress: 0,
      logs: [],
      startedAt: new Date()
    });
  } catch (error) {
    console.error("Failed to create mission in MongoDB:", error);
  }

  emitLog(io, missionId, "info", "开始执行工作流");
  emitState(io, init);

  const graph = new StateGraph(ExecState)
    .addNode("run", async (s: ExecStateType) => runWorkflow(s, io))
    .addEdge(START, "run")
    .addEdge("run", END);

  const runnable = graph.compile();

  // run async in background
  void runnable.invoke({ missionId, workflow, index: 0, progress: 0 }).catch(async (err: any) => {
    setMissionStatus(missionId, "failed");
    emitLog(io, missionId, "error", `执行失败: ${err?.message ?? String(err)}`);
    emitState(io, getMissionStateOrThrow(missionId));

    // 更新 MongoDB
    try {
      await Mission.findOneAndUpdate(
        { missionId },
        { status: "failed", completedAt: new Date() }
      );
    } catch (dbErr) {
      console.error("Failed to update mission status in MongoDB:", dbErr);
    }
  });

  return init;
}
