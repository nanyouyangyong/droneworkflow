// ============================================================================
// Device（设备）
// ============================================================================

export type DeviceStatus = "offline" | "idle" | "flying" | "hovering" | "returning" | "error";
export type AdapterType = "mock" | "dji" | "px4";

export interface Device {
  id: string;
  name: string;
  status: DeviceStatus;
  adapter: AdapterType;
  lastSeenAt: number;
  createdAt: number;
}

// ============================================================================
// Telemetry（遥测/状态缓存）
// ============================================================================

export interface Position {
  lat: number;
  lng: number;
}

export interface Telemetry {
  droneId: string;
  battery: number;
  altitude: number;
  position: Position;
  isRecording: boolean;
  updatedAt: number;
}

// ============================================================================
// Command（命令执行记录）
// ============================================================================

export type CommandStatus = "accepted" | "running" | "succeeded" | "failed";

export type CommandName =
  | "takeoff"
  | "land"
  | "fly_to"
  | "hover"
  | "take_photo"
  | "record_video"
  | "return_home"
  | "check_battery";

export interface Command {
  id: string;
  droneId: string;
  name: CommandName;
  args: Record<string, any>;
  status: CommandStatus;
  result?: Record<string, any>;
  idempotencyKey?: string;
  createdAt: number;
  finishedAt?: number;
  error?: { code: string; message: string };
}

// ============================================================================
// API Request / Response
// ============================================================================

export interface ConnectRequest {
  droneId: string;
  name?: string;
  adapter?: AdapterType;
}

export interface CommandRequest {
  name: CommandName;
  args?: Record<string, any>;
  idempotencyKey?: string;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: { code: string; message: string };
}
