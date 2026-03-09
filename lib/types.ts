export type WorkflowNodeType =
  | "start"
  | "action"
  | "condition"
  | "end"
  | "区域定义"
  | "区域巡检"
  | "航线规划"
  | "航点设置"
  | "起飞"
  | "降落"
  | "悬停"
  | "飞行"
  | "飞行到点"
  | "拍照"
  | "录像"
  | "电量检查"
  | "避障"
  | "返航"
  | "条件判断"
  | "定时拍照"
  | "parallel_fork"
  | "parallel_join";

export type WorkflowNode = {
  id: string;
  type: WorkflowNodeType;
  label: string;
  params?: Record<string, unknown>;
};

export type WorkflowEdge = {
  id: string;
  from: string;
  to: string;
  condition?: string | null;
};

export type ParsedWorkflow = {
  workflow_name: string;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
};

export type LogLevel = "info" | "success" | "warning" | "error" | "debug";

export type LogEvent = {
  ts: number;
  level: LogLevel;
  message: string;
  nodeId?: string;
  droneId?: string;
};

export type MissionStatus = "pending" | "running" | "paused" | "completed" | "failed" | "partial_completed";

// 执行策略：并行 or 顺序
export type ExecutionStrategy = "parallel" | "sequential";

// 失败处理策略
export type FailurePolicy = "fail_fast" | "continue";

// 子任务状态（每架无人机一个）
export type SubMissionState = {
  subMissionId: string;
  droneId: string;
  workflow: ParsedWorkflow;
  status: MissionStatus;
  progress: number;
  currentNode?: string;
  logs: LogEvent[];
  startedAt?: number;
  finishedAt?: number;
  error?: string;
};

// ---- 多机协调策略（LLM 生成） ----

// 协调信号类型
export type CoordinationSignalType =
  | "obstacle_detected"
  | "area_cleared"
  | "low_battery"
  | "task_transfer"
  | "rendezvous_ready"
  | "custom";

// 同步点定义
export type SyncPointDef = {
  barrierId: string;
  drones: string[];          // 需要同步的无人机 ID 列表
  afterNode: string;         // 在哪个节点后设置屏障
  description?: string;
};

// 信号规则定义
export type SignalRuleDef = {
  trigger: string;           // 触发条件（例如 "battery < 20"）
  signalType: CoordinationSignalType;
  fromDrone: string;
  toDrone: string | "*";     // "*" = 广播给所有无人机
  payload?: Record<string, any>;
};

// 协调策略（由 LLM 生成，附在 TaskRequest 中）
export type CoordinationPolicy = {
  syncPoints?: SyncPointDef[];
  signalRules?: SignalRuleDef[];
  stateSharing?: "none" | "snapshot" | "realtime";
};

// 任务请求（统一入口，单机/多机兼容）
export type TaskRequest = {
  missionId: string;
  name: string;
  drones: Array<{
    droneId: string;
    workflow: ParsedWorkflow;
  }>;
  strategy?: ExecutionStrategy;
  failurePolicy?: FailurePolicy;
  coordinationPolicy?: CoordinationPolicy;
};

// 任务状态（兼容单机/多机）
export type MissionState = {
  missionId: string;
  name: string;
  description: string;
  status: MissionStatus;
  progress: number;
  currentNode?: string;
  logs: LogEvent[];

  // 多无人机编排（单机时 subMissions 长度为 1）
  subMissions?: SubMissionState[];
  strategy?: ExecutionStrategy;
  failurePolicy?: FailurePolicy;
};
