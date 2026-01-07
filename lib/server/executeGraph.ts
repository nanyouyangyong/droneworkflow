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

// 模拟无人机状态
interface DroneState {
  battery: number;
  altitude: number;
  position: { lat: number; lng: number };
  isFlying: boolean;
  isRecording: boolean;
}

function createInitialDroneState(): DroneState {
  return {
    battery: 100,
    altitude: 0,
    position: { lat: 39.9042, lng: 116.4074 }, // 默认北京
    isFlying: false,
    isRecording: false
  };
}

// 执行单个节点的逻辑
async function executeNode(
  node: WorkflowNode,
  droneState: DroneState,
  io: SocketIOServer | undefined,
  missionId: string
): Promise<{ success: boolean; message: string; droneState: DroneState }> {
  const params = node.params as Record<string, unknown> || {};

  switch (node.type) {
    case "start":
      return { success: true, message: "工作流开始", droneState };

    case "end":
      return { success: true, message: "工作流结束", droneState };

    case "起飞": {
      const altitude = Number(params.altitude ?? 30);
      await simulateDelay(800);
      droneState.altitude = altitude;
      droneState.isFlying = true;
      droneState.battery -= 2;
      return { success: true, message: `起飞到 ${altitude} 米高度`, droneState };
    }

    case "降落":
      await simulateDelay(600);
      droneState.altitude = 0;
      droneState.isFlying = false;
      droneState.battery -= 1;
      return { success: true, message: "无人机已安全降落", droneState };

    case "悬停": {
      const duration = Number(params.duration ?? 5);
      await simulateDelay(duration * 100); // 模拟时间压缩
      droneState.battery -= Math.ceil(duration / 10);
      return { success: true, message: `悬停 ${duration} 秒完成`, droneState };
    }

    case "飞行到点": {
      const lat = Number(params.lat ?? droneState.position.lat);
      const lng = Number(params.lng ?? droneState.position.lng);
      const alt = Number(params.altitude ?? droneState.altitude);
      await simulateDelay(1000);
      droneState.position = { lat, lng };
      droneState.altitude = alt;
      droneState.battery -= 5;
      return { success: true, message: `已飞行到坐标 (${lat.toFixed(4)}, ${lng.toFixed(4)})，高度 ${alt} 米`, droneState };
    }

    case "区域巡检": {
      const areaName = String(params.areaName ?? "未知区域");
      await simulateDelay(1500);
      droneState.battery -= 8;
      return { success: true, message: `${areaName} 巡检完成`, droneState };
    }

    case "定时拍照": {
      const intervalSec = Number(params.intervalSec ?? 10);
      await simulateDelay(500);
      droneState.battery -= 2;
      return { success: true, message: `已拍摄照片（间隔 ${intervalSec} 秒）`, droneState };
    }

    case "录像": {
      const action = String(params.action ?? "start");
      await simulateDelay(300);
      droneState.isRecording = action === "start";
      droneState.battery -= 1;
      return { success: true, message: action === "start" ? "开始录像" : "停止录像", droneState };
    }

    case "电量检查": {
      const threshold = Number(params.threshold ?? params.low ?? 30);
      await simulateDelay(200);
      const isLow = droneState.battery < threshold;
      return {
        success: true,
        message: isLow
          ? `电量 ${droneState.battery}% 低于阈值 ${threshold}%，需要返航`
          : `电量 ${droneState.battery}% 正常（阈值 ${threshold}%）`,
        droneState
      };
    }

    case "返航":
      await simulateDelay(1200);
      droneState.position = { lat: 39.9042, lng: 116.4074 }; // 返回起始点
      droneState.battery -= 5;
      return { success: true, message: "已返回起飞点", droneState };

    case "条件判断":
      await simulateDelay(100);
      return { success: true, message: "条件判断完成", droneState };

    default:
      await simulateDelay(300);
      return { success: true, message: `执行节点: ${node.label}`, droneState };
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

    // 执行节点
    const result = await executeNode(currentNode, droneState, io, missionId);
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
