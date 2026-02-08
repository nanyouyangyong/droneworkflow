import type { Device, Telemetry, Command } from "../domain/types.js";

// ============================================================================
// 内存存储（MVP）—— 后续可替换为 Redis / MongoDB
// ============================================================================

class MemoryStore {
  private devices = new Map<string, Device>();
  private telemetry = new Map<string, Telemetry>();
  private commands = new Map<string, Command>();
  private idempotencyIndex = new Map<string, string>(); // key -> commandId

  // ---- Device ----

  getDevice(id: string): Device | undefined {
    return this.devices.get(id);
  }

  getAllDevices(): Device[] {
    return Array.from(this.devices.values());
  }

  saveDevice(device: Device): void {
    this.devices.set(device.id, device);
  }

  deleteDevice(id: string): boolean {
    this.telemetry.delete(id);
    return this.devices.delete(id);
  }

  // ---- Telemetry ----

  getTelemetry(droneId: string): Telemetry | undefined {
    return this.telemetry.get(droneId);
  }

  saveTelemetry(t: Telemetry): void {
    this.telemetry.set(t.droneId, t);
  }

  // ---- Command ----

  getCommand(id: string): Command | undefined {
    return this.commands.get(id);
  }

  getCommandsByDrone(droneId: string): Command[] {
    return Array.from(this.commands.values()).filter((c) => c.droneId === droneId);
  }

  saveCommand(cmd: Command): void {
    this.commands.set(cmd.id, cmd);
    if (cmd.idempotencyKey) {
      this.idempotencyIndex.set(`${cmd.droneId}:${cmd.idempotencyKey}`, cmd.id);
    }
  }

  findCommandByIdempotencyKey(droneId: string, key: string): Command | undefined {
    const cmdId = this.idempotencyIndex.get(`${droneId}:${key}`);
    return cmdId ? this.commands.get(cmdId) : undefined;
  }
}

export const store = new MemoryStore();
