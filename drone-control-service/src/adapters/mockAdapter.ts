import type { CommandName, Telemetry } from "../domain/types.js";
import type { DroneAdapter, CommandResult } from "./droneAdapter.js";

// ============================================================================
// MockAdapter —— 模拟无人机适配器（MVP / 开发调试用）
// ============================================================================

interface MockDroneState {
  connected: boolean;
  battery: number;
  altitude: number;
  position: { lat: number; lng: number };
  status: "idle" | "flying" | "hovering" | "returning";
  isRecording: boolean;
  homePosition: { lat: number; lng: number };
}

const defaultState = (): MockDroneState => ({
  connected: false,
  battery: 100,
  altitude: 0,
  position: { lat: 39.9042, lng: 116.4074 },
  status: "idle",
  isRecording: false,
  homePosition: { lat: 39.9042, lng: 116.4074 },
});

export class MockAdapter implements DroneAdapter {
  private states = new Map<string, MockDroneState>();

  private getState(droneId: string): MockDroneState {
    let s = this.states.get(droneId);
    if (!s) {
      s = defaultState();
      this.states.set(droneId, s);
    }
    return s;
  }

  async connect(droneId: string): Promise<CommandResult> {
    const s = this.getState(droneId);
    s.connected = true;
    return { success: true, message: `已连接到模拟无人机 ${droneId}` };
  }

  async disconnect(droneId: string): Promise<CommandResult> {
    const s = this.getState(droneId);
    s.connected = false;
    return { success: true, message: `已断开模拟无人机 ${droneId}` };
  }

  async executeCommand(
    droneId: string,
    name: CommandName,
    args: Record<string, any>
  ): Promise<CommandResult> {
    const s = this.getState(droneId);

    if (!s.connected) {
      return { success: false, message: "无人机未连接" };
    }

    switch (name) {
      case "takeoff": {
        const altitude = args.altitude ?? 10;
        s.altitude = altitude;
        s.status = "flying";
        s.battery -= 2;
        return { success: true, message: `已起飞至 ${altitude} 米` };
      }

      case "land": {
        s.altitude = 0;
        s.status = "idle";
        s.battery -= 1;
        return { success: true, message: "已安全降落" };
      }

      case "fly_to": {
        s.position = { lat: args.lat, lng: args.lng };
        if (args.altitude !== undefined) s.altitude = args.altitude;
        s.status = "flying";
        s.battery -= 5;
        return { success: true, message: `已飞行至 (${args.lat}, ${args.lng})` };
      }

      case "hover": {
        const duration = args.duration ?? 10;
        s.status = "hovering";
        s.battery -= Math.ceil(duration / 10);
        return { success: true, message: `悬停 ${duration} 秒` };
      }

      case "take_photo": {
        const count = args.count ?? 1;
        return {
          success: true,
          message: `已拍摄 ${count} 张照片`,
          data: {
            photos: Array.from({ length: count }, (_, i) => ({
              id: `photo_${Date.now()}_${i}`,
              timestamp: new Date().toISOString(),
              position: { ...s.position },
              altitude: s.altitude,
            })),
          },
        };
      }

      case "record_video": {
        s.isRecording = args.action === "start";
        return {
          success: true,
          message: args.action === "start" ? "开始录像" : "停止录像",
          data: { isRecording: s.isRecording },
        };
      }

      case "return_home": {
        s.status = "returning";
        s.position = { ...s.homePosition };
        s.battery -= 3;
        return { success: true, message: "正在返航" };
      }

      case "check_battery": {
        const threshold = args.threshold ?? 30;
        const isLow = s.battery < threshold;
        return {
          success: true,
          message: isLow ? `电量低于 ${threshold}%，建议返航` : `电量正常 (${s.battery}%)`,
          data: { battery: s.battery, threshold, isLow },
        };
      }

      default:
        return { success: false, message: `未知命令: ${name}` };
    }
  }

  async getTelemetry(droneId: string): Promise<Telemetry> {
    const s = this.getState(droneId);
    return {
      droneId,
      battery: s.battery,
      altitude: s.altitude,
      position: { ...s.position },
      isRecording: s.isRecording,
      updatedAt: Date.now(),
    };
  }
}
