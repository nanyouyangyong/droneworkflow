import { v4 as uuidv4 } from "uuid";
import { store } from "../infra/store.js";
import { MockAdapter } from "../adapters/mockAdapter.js";
import type { DroneAdapter } from "../adapters/droneAdapter.js";
import type {
  Device,
  Telemetry,
  Command,
  ConnectRequest,
  CommandRequest,
  AdapterType,
  DeviceStatus,
} from "../domain/types.js";
import {
  ServiceError,
  ErrorCodes,
  ValidationError,
  NotFoundError,
} from "../domain/errors.js";

// ============================================================================
// Adapter 注册表 —— 后续新增 DJI/PX4 只需在这里注册
// ============================================================================

const adapters: Record<AdapterType, DroneAdapter> = {
  mock: new MockAdapter(),
  dji: new MockAdapter(),   // TODO: 替换为真实 DJI Adapter
  px4: new MockAdapter(),   // TODO: 替换为真实 PX4 Adapter
};

function getAdapter(type: AdapterType): DroneAdapter {
  return adapters[type] || adapters.mock;
}

// ============================================================================
// Service 方法
// ============================================================================

/** 连接无人机（注册设备） */
export async function connectDrone(req: ConnectRequest): Promise<{ device: Device; telemetry: Telemetry }> {
  if (!req.droneId || req.droneId.trim() === "") {
    throw new ValidationError("droneId is required");
  }

  const existing = store.getDevice(req.droneId);
  if (existing && existing.status !== "offline") {
    throw new ServiceError(
      ErrorCodes.DRONE_ALREADY_CONNECTED,
      `无人机 ${req.droneId} 已连接`,
      409
    );
  }

  const adapterType: AdapterType = req.adapter || "mock";
  const adapter = getAdapter(adapterType);
  const result = await adapter.connect(req.droneId);

  if (!result.success) {
    throw new ServiceError(ErrorCodes.COMMAND_REJECTED, result.message, 502);
  }

  const now = Date.now();
  const device: Device = {
    id: req.droneId,
    name: req.name || `Drone-${req.droneId}`,
    status: "idle",
    adapter: adapterType,
    lastSeenAt: now,
    createdAt: existing?.createdAt || now,
  };
  store.saveDevice(device);

  const telemetry = await adapter.getTelemetry(req.droneId);
  store.saveTelemetry(telemetry);

  return { device, telemetry };
}

/** 断开无人机 */
export async function disconnectDrone(droneId: string): Promise<Device> {
  const device = store.getDevice(droneId);
  if (!device) throw new NotFoundError("Device", droneId);

  const adapter = getAdapter(device.adapter);
  await adapter.disconnect(droneId);

  device.status = "offline";
  device.lastSeenAt = Date.now();
  store.saveDevice(device);
  return device;
}

/** 获取所有设备 */
export function listDevices(): Device[] {
  return store.getAllDevices();
}

/** 获取设备状态 + 遥测 */
export async function getDroneStatus(droneId: string): Promise<{ device: Device; telemetry: Telemetry }> {
  const device = store.getDevice(droneId);
  if (!device) throw new NotFoundError("Device", droneId);

  const adapter = getAdapter(device.adapter);
  const telemetry = await adapter.getTelemetry(droneId);
  store.saveTelemetry(telemetry);

  device.lastSeenAt = Date.now();
  store.saveDevice(device);

  return { device, telemetry };
}

/** 执行命令（核心） */
export async function executeCommand(
  droneId: string,
  req: CommandRequest
): Promise<Command> {
  const device = store.getDevice(droneId);
  if (!device) throw new NotFoundError("Device", droneId);
  if (device.status === "offline") {
    throw new ServiceError(ErrorCodes.DRONE_OFFLINE, "无人机不在线", 409);
  }

  // 幂等检查
  if (req.idempotencyKey) {
    const existing = store.findCommandByIdempotencyKey(droneId, req.idempotencyKey);
    if (existing) return existing;
  }

  // 创建 Command 记录
  const now = Date.now();
  const command: Command = {
    id: uuidv4(),
    droneId,
    name: req.name,
    args: req.args || {},
    status: "accepted",
    idempotencyKey: req.idempotencyKey,
    createdAt: now,
  };
  store.saveCommand(command);

  // 执行
  const adapter = getAdapter(device.adapter);
  try {
    command.status = "running";
    store.saveCommand(command);

    const result = await adapter.executeCommand(droneId, req.name, req.args || {});

    if (result.success) {
      command.status = "succeeded";
      command.result = { message: result.message, ...result.data };
    } else {
      command.status = "failed";
      command.error = { code: ErrorCodes.COMMAND_REJECTED, message: result.message };
    }
  } catch (err: any) {
    command.status = "failed";
    command.error = { code: ErrorCodes.INTERNAL_ERROR, message: err.message };
  }

  command.finishedAt = Date.now();
  store.saveCommand(command);

  // 更新设备状态
  const telemetry = await adapter.getTelemetry(droneId);
  store.saveTelemetry(telemetry);

  // 根据命令结果推断设备状态
  if (command.status === "succeeded") {
    const statusMap: Partial<Record<string, DeviceStatus>> = {
      takeoff: "flying",
      fly_to: "flying",
      hover: "hovering",
      return_home: "returning",
      land: "idle",
    };
    const newStatus = statusMap[req.name];
    if (newStatus) {
      device.status = newStatus;
      device.lastSeenAt = Date.now();
      store.saveDevice(device);
    }
  }

  return command;
}

/** 获取命令状态 */
export function getCommandById(commandId: string): Command {
  const cmd = store.getCommand(commandId);
  if (!cmd) throw new NotFoundError("Command", commandId);
  return cmd;
}

/** 获取设备的命令历史 */
export function getCommandHistory(droneId: string): Command[] {
  return store.getCommandsByDrone(droneId);
}
