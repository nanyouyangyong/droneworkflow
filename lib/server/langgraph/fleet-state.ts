// ============================================================================
// FleetAnnotation — 多无人机编排共享状态
// 在 OrchestratorGraph 中管理所有无人机的状态快照、协调信号和同步屏障
// ============================================================================

import { Annotation } from "@langchain/langgraph";
import type {
  CoordinationSignalType,
  CoordinationPolicy,
  ParsedWorkflow,
  MissionStatus,
} from "@/lib/types";
import type { SubMissionResult } from "@/lib/server/sub-mission-runner";

// ---- 共享类型 ----

// 无人机状态快照（轻量版，用于跨无人机共享）
export interface DroneSnapshot {
  droneId: string;
  battery: number;
  altitude: number;
  position: { lat: number; lng: number };
  status: string;
  currentNodeId: string;
  progress: number;
  lastUpdated: number;
}

// 协调信号（无人机间通信）
export interface CoordinationSignal {
  type: CoordinationSignalType;
  fromDrone: string;
  toDrone: string | "*";
  payload: Record<string, any>;
  ts: number;
  consumed: boolean;
}

// 同步屏障状态
export interface BarrierState {
  barrierId: string;
  requiredDrones: string[];
  readyDrones: string[];
  released: boolean;
}

// 子任务执行条目（编排图内部使用）
export interface FleetDroneEntry {
  droneId: string;
  subMissionId: string;
  workflow: ParsedWorkflow;
  status: MissionStatus;
  progress: number;
  error?: string;
}

// ---- FleetAnnotation ----

export const FleetAnnotation = Annotation.Root({
  // 任务标识
  missionId: Annotation<string>,

  // 各无人机的实时状态快照（每步更新，key = droneId）
  droneSnapshots: Annotation<Record<string, DroneSnapshot>>({
    reducer: (prev, next) => ({ ...prev, ...next }),
    default: () => ({}),
  }),

  // 协调信号队列（无人机间通信）
  signals: Annotation<CoordinationSignal[]>({
    reducer: (prev, next) => [...prev, ...next],
    default: () => [],
  }),

  // 同步屏障状态（key = barrierId）
  barriers: Annotation<Record<string, BarrierState>>({
    reducer: (prev, next) => ({ ...prev, ...next }),
    default: () => ({}),
  }),

  // 子任务条目列表
  droneEntries: Annotation<FleetDroneEntry[]>({
    reducer: (_prev, next) => next,
    default: () => [],
  }),

  // 已完成的无人机 ID 列表
  completedDrones: Annotation<string[]>({
    reducer: (prev, next) => [...new Set([...prev, ...next])],
    default: () => [],
  }),

  // 子任务结果（key = droneId）
  results: Annotation<Record<string, SubMissionResult>>({
    reducer: (prev, next) => ({ ...prev, ...next }),
    default: () => ({}),
  }),

  // 协调策略配置
  coordinationPolicy: Annotation<CoordinationPolicy>({
    reducer: (_prev, next) => next,
    default: () => ({ stateSharing: "none" }),
  }),

  // 当前阶段（dispatch → execute → coordinate → aggregate）
  phase: Annotation<string>,

  // 执行轮次（每轮 execute 后 +1，用于多轮协调）
  round: Annotation<number>,
});

// 状态类型导出
export type FleetState = typeof FleetAnnotation.State;
export type FleetUpdate = typeof FleetAnnotation.Update;

// 初始状态工厂
export function createInitialFleetState(
  missionId: string,
  drones: Array<{ droneId: string; workflow: ParsedWorkflow }>,
  coordinationPolicy: CoordinationPolicy = { stateSharing: "none" },
): FleetState {
  const droneSnapshots: Record<string, DroneSnapshot> = {};
  const droneEntries: FleetDroneEntry[] = [];

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
    droneEntries.push({
      droneId: d.droneId,
      subMissionId,
      workflow: d.workflow,
      status: "pending",
      progress: 0,
    });
  });

  // 初始化同步屏障
  const barriers: Record<string, BarrierState> = {};
  if (coordinationPolicy.syncPoints) {
    for (const sp of coordinationPolicy.syncPoints) {
      barriers[sp.barrierId] = {
        barrierId: sp.barrierId,
        requiredDrones: sp.drones,
        readyDrones: [],
        released: false,
      };
    }
  }

  return {
    missionId,
    droneSnapshots,
    signals: [],
    barriers,
    droneEntries,
    completedDrones: [],
    results: {},
    coordinationPolicy,
    phase: "dispatch",
    round: 0,
  };
}
