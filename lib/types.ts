export type WorkflowNodeType =
  | "start"
  | "action"
  | "condition"
  | "end"
  | "区域定义"
  | "航线规划"
  | "航点设置"
  | "起飞"
  | "定时拍照"
  | "电量检查"
  | "返航"
  | "降落";

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
};

export type MissionStatus = "pending" | "running" | "paused" | "completed" | "failed";

export type MissionState = {
  missionId: string;
  name: string;
  description: string;
  status: MissionStatus;
  progress: number;
  currentNode?: string;
  logs: LogEvent[];
};
