// ============================================================================
// DroneWorkflowAnnotation — LangGraph 状态 Schema
// 定义工作流执行过程中的全局状态，每个节点读取并返回部分更新
// ============================================================================

import { Annotation } from "@langchain/langgraph";
import type { LogLevel } from "@/lib/types";

// 执行日志条目
export interface ExecutionLog {
  level: LogLevel;
  message: string;
  nodeId?: string;
  ts: number;
}

// 节点执行结果
export interface NodeExecutionResult {
  nodeId: string;
  success: boolean;
  message: string;
  ts: number;
}

// 无人机工作流状态 Annotation
export const DroneWorkflowAnnotation = Annotation.Root({
  // ---- 无人机标识 ----
  droneId: Annotation<string>,
  missionId: Annotation<string>,

  // ---- 无人机实时状态 ----
  connected: Annotation<boolean>,
  battery: Annotation<number>,
  altitude: Annotation<number>,
  position: Annotation<{ lat: number; lng: number }>,
  droneStatus: Annotation<string>,
  isRecording: Annotation<boolean>,

  // ---- 执行追踪 ----
  currentNodeId: Annotation<string>,
  executedNodes: Annotation<string[]>({
    reducer: (prev, next) => [...prev, ...next],
    default: () => [],
  }),
  nodeResults: Annotation<NodeExecutionResult[]>({
    reducer: (prev, next) => [...prev, ...next],
    default: () => [],
  }),
  progress: Annotation<number>,
  totalNodes: Annotation<number>,

  // ---- 日志 ----
  logs: Annotation<ExecutionLog[]>({
    reducer: (prev, next) => [...prev, ...next],
    default: () => [],
  }),

  // ---- 最终结果 ----
  success: Annotation<boolean>,
  error: Annotation<string | null>,
});

// 状态类型导出（方便 action 函数使用）
export type DroneWorkflowState = typeof DroneWorkflowAnnotation.State;
export type DroneWorkflowUpdate = typeof DroneWorkflowAnnotation.Update;

// 初始状态工厂
export function createInitialState(
  droneId: string,
  missionId: string,
  totalNodes: number
): DroneWorkflowState {
  return {
    droneId,
    missionId,
    connected: false,
    battery: 100,
    altitude: 0,
    position: { lat: 39.9042, lng: 116.4074 },
    droneStatus: "idle",
    isRecording: false,
    currentNodeId: "",
    executedNodes: [],
    nodeResults: [],
    progress: 0,
    totalNodes,
    logs: [],
    success: true,
    error: null,
  };
}
