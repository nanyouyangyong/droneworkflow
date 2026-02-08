import type { CommandName, Telemetry, Position } from "../domain/types.js";

// ============================================================================
// DroneAdapter 抽象接口
// 所有真实/模拟无人机适配器都必须实现此接口
// ============================================================================

export interface CommandResult {
  success: boolean;
  message: string;
  data?: Record<string, any>;
}

export interface DroneAdapter {
  /** 连接到无人机 */
  connect(droneId: string): Promise<CommandResult>;

  /** 断开连接 */
  disconnect(droneId: string): Promise<CommandResult>;

  /** 执行命令 */
  executeCommand(
    droneId: string,
    name: CommandName,
    args: Record<string, any>
  ): Promise<CommandResult>;

  /** 获取当前遥测数据 */
  getTelemetry(droneId: string): Promise<Telemetry>;
}
