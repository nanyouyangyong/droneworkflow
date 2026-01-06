import type { Server as SocketIOServer } from "socket.io";
import { Annotation, StateGraph, START, END } from "@langchain/langgraph";
import type { MissionState, ParsedWorkflow } from "@/lib/types";
import {
  appendMissionLog,
  getMission,
  setMissionProgress,
  setMissionStatus,
  type MissionRecord,
  upsertMission
} from "@/lib/server/missionStore";

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

async function runNodes(state: ExecStateType, io: SocketIOServer | undefined) {
  const missionId = state.missionId;
  const wf = state.workflow as ParsedWorkflow;

  for (let i = 0; i < wf.nodes.length; i += 1) {
    const n = wf.nodes[i];
    setMissionProgress(missionId, Math.floor((i / wf.nodes.length) * 100), n.id);
    emitState(io, getMissionStateOrThrow(missionId));

    emitLog(io, missionId, "info", `执行节点: ${n.label}`, n.id);

    // 模拟节点执行耗时
    await new Promise((r) => setTimeout(r, 400));

    if (n.type === "电量检查") {
      const low = Number((n.params as any)?.low ?? 30);
      const battery = 25; // mock
      if (battery < low) {
        emitLog(io, missionId, "warning", `电量 ${battery}% 低于阈值 ${low}%，触发返航流程`, n.id);
      } else {
        emitLog(io, missionId, "success", `电量 ${battery}% 正常，继续任务`, n.id);
      }
    } else {
      emitLog(io, missionId, "success", `节点完成: ${n.label}`, n.id);
    }
  }

  setMissionProgress(missionId, 100);
  setMissionStatus(missionId, "completed");

  const finalState = getMissionStateOrThrow(missionId);
  emitLog(io, missionId, "success", "工作流执行完成");
  emitState(io, finalState);

  return { ...state, progress: 100 };
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

  emitLog(io, missionId, "info", "开始执行工作流");
  emitState(io, init);

  const graph = new StateGraph(ExecState)
    .addNode("run", async (s: ExecStateType) => runNodes(s, io))
    .addEdge(START, "run")
    .addEdge("run", END);

  const runnable = graph.compile();

  // run async in background
  void runnable.invoke({ missionId, workflow, index: 0, progress: 0 }).catch((err: any) => {
    setMissionStatus(missionId, "failed");
    emitLog(io, missionId, "error", `执行失败: ${err?.message ?? String(err)}`);
    emitState(io, getMissionStateOrThrow(missionId));
  });

  return init;
}
