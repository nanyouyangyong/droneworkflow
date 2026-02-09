// ============================================================================
// DroneChannel — 单架无人机的消息通道（高内聚）
// 封装与一架无人机的所有通信：命令下发、状态查询、事件发射
// SubMissionRunner 只通过 DroneChannel 与无人机交互
// ============================================================================

import type { LogLevel } from "@/lib/types";
import { mcpManager } from "@/lib/server/mcp";
import { appEventBus } from "@/lib/server/event-bus";

// 无人机实时状态（从 MCP/控制服务同步）
export interface DroneState {
  connected: boolean;
  battery: number;
  altitude: number;
  position: { lat: number; lng: number };
  status: "idle" | "flying" | "hovering" | "returning";
  isRecording: boolean;
}

export function createInitialDroneState(): DroneState {
  return {
    connected: false,
    battery: 100,
    altitude: 0,
    position: { lat: 39.9042, lng: 116.4074 },
    status: "idle",
    isRecording: false,
  };
}

export class DroneChannel {
  readonly droneId: string;
  readonly missionId: string;
  private _state: DroneState;

  constructor(droneId: string, missionId: string) {
    this.droneId = droneId;
    this.missionId = missionId;
    this._state = createInitialDroneState();
  }

  /** 获取当前无人机状态快照 */
  get state(): DroneState {
    return { ...this._state };
  }

  /** 更新本地无人机状态 */
  updateState(partial: Partial<DroneState>): void {
    this._state = { ...this._state, ...partial };
  }

  // ---- 命令下发 ----

  /**
   * 调用 MCP 工具（自动注入 droneId）
   * 所有工具调用都通过此方法，确保 droneId 隔离
   */
  async callTool(toolName: string, args: Record<string, any> = {}): Promise<any> {
    // 注入 droneId，确保 MCP 工具知道操作哪架无人机
    const argsWithDroneId = { ...args, droneId: this.droneId };
    try {
      const result = await mcpManager.callToolAuto(toolName, argsWithDroneId);
      // 如果返回了 droneState，同步更新本地状态
      if (result?.droneState) {
        this.updateState(result.droneState);
      }
      return result;
    } catch (error: any) {
      this.emitLog("error", `MCP 工具调用失败 [${toolName}]: ${error.message}`);
      throw error;
    }
  }

  // ---- 事件发射（通过全局 EventBus） ----

  /** 发射日志事件 */
  emitLog(level: LogLevel, message: string, nodeId?: string): void {
    appEventBus.publish({
      type: "mission:log",
      missionId: this.missionId,
      droneId: this.droneId,
      data: { level, message, nodeId, droneId: this.droneId },
      timestamp: Date.now(),
    });
  }

  /** 发射进度事件 */
  emitProgress(progress: number, currentNode?: string): void {
    appEventBus.publish({
      type: "mission:progress",
      missionId: this.missionId,
      droneId: this.droneId,
      data: { progress, currentNode, droneId: this.droneId },
      timestamp: Date.now(),
    });
  }

  /** 发射状态变更事件 */
  emitStatus(status: string, error?: string): void {
    appEventBus.publish({
      type: "mission:status",
      missionId: this.missionId,
      droneId: this.droneId,
      data: { status, droneId: this.droneId, error },
      timestamp: Date.now(),
    });
  }
}
