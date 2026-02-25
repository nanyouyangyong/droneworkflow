// ============================================================================
// Node Actions — 每种工作流节点类型对应的 LangGraph action 函数
// 签名：(state: DroneWorkflowState) => Partial<DroneWorkflowUpdate>
// DroneChannel 通过 LangGraphRunnableConfig 的 configurable 传入
// ============================================================================

import type { DroneWorkflowState, DroneWorkflowUpdate, ExecutionLog } from "./drone-state";
import type { DroneChannel } from "@/lib/server/drone-channel";

// 节点执行上下文（通过 configurable 传入）
export interface NodeActionConfig {
  channel: DroneChannel;
  nodeId: string;
  nodeLabel: string;
  nodeParams: Record<string, unknown>;
}

type ActionReturn = Partial<DroneWorkflowUpdate>;

function log(level: ExecutionLog["level"], message: string, nodeId?: string): ExecutionLog {
  return { level, message, nodeId, ts: Date.now() };
}

// ---- 基础流程节点 ----

export async function startAction(
  state: DroneWorkflowState,
  config: NodeActionConfig
): Promise<ActionReturn> {
  const { channel, nodeId } = config;
  try {
    const result = await channel.callTool("drone:connect_drone", {
      droneId: channel.droneId,
    });
    if (result?.success !== false) {
      channel.updateState({ connected: true });
      return {
        connected: true,
        currentNodeId: nodeId,
        executedNodes: [nodeId],
        nodeResults: [{ nodeId, success: true, message: `无人机 ${channel.droneId} 已连接`, ts: Date.now() }],
        logs: [log("info", `无人机 ${channel.droneId} 已连接`, nodeId)],
      };
    }
  } catch {
    // 连接失败，模拟模式
  }
  channel.updateState({ connected: true });
  return {
    connected: true,
    currentNodeId: nodeId,
    executedNodes: [nodeId],
    nodeResults: [{ nodeId, success: true, message: "工作流开始（模拟模式）", ts: Date.now() }],
    logs: [log("info", "工作流开始（模拟模式）", nodeId)],
  };
}

export async function endAction(
  _state: DroneWorkflowState,
  config: NodeActionConfig
): Promise<ActionReturn> {
  return {
    currentNodeId: config.nodeId,
    executedNodes: [config.nodeId],
    nodeResults: [{ nodeId: config.nodeId, success: true, message: "工作流结束", ts: Date.now() }],
    logs: [log("success", "工作流结束", config.nodeId)],
    progress: 100,
  };
}

export async function parallelForkAction(
  _state: DroneWorkflowState,
  config: NodeActionConfig
): Promise<ActionReturn> {
  return {
    currentNodeId: config.nodeId,
    executedNodes: [config.nodeId],
    nodeResults: [{ nodeId: config.nodeId, success: true, message: "并行分发", ts: Date.now() }],
    logs: [log("info", "并行分发", config.nodeId)],
  };
}

export async function parallelJoinAction(
  _state: DroneWorkflowState,
  config: NodeActionConfig
): Promise<ActionReturn> {
  return {
    currentNodeId: config.nodeId,
    executedNodes: [config.nodeId],
    nodeResults: [{ nodeId: config.nodeId, success: true, message: "等待全部完成", ts: Date.now() }],
    logs: [log("info", "等待全部完成", config.nodeId)],
  };
}

export async function conditionAction(
  _state: DroneWorkflowState,
  config: NodeActionConfig
): Promise<ActionReturn> {
  return {
    currentNodeId: config.nodeId,
    executedNodes: [config.nodeId],
    nodeResults: [{ nodeId: config.nodeId, success: true, message: "条件判断完成", ts: Date.now() }],
    logs: [log("info", "条件判断完成", config.nodeId)],
  };
}

// ---- 飞行控制节点 ----

export async function takeoffAction(
  state: DroneWorkflowState,
  config: NodeActionConfig
): Promise<ActionReturn> {
  const { channel, nodeId, nodeParams } = config;
  const altitude = Number(nodeParams.altitude ?? 30);

  try {
    const result = await channel.callTool("drone:takeoff", { altitude });
    if (result?.success !== false) {
      channel.updateState({ altitude, status: "flying" });
      return {
        altitude,
        droneStatus: "flying",
        battery: state.battery - 2,
        currentNodeId: nodeId,
        executedNodes: [nodeId],
        nodeResults: [{ nodeId, success: true, message: `起飞到 ${altitude} 米`, ts: Date.now() }],
        logs: [log("success", `起飞到 ${altitude} 米高度`, nodeId)],
      };
    }
  } catch {
    // fallback
  }
  channel.updateState({ altitude, status: "flying", battery: state.battery - 2 });
  return {
    altitude,
    droneStatus: "flying",
    battery: state.battery - 2,
    currentNodeId: nodeId,
    executedNodes: [nodeId],
    nodeResults: [{ nodeId, success: true, message: `起飞到 ${altitude} 米（模拟）`, ts: Date.now() }],
    logs: [log("success", `起飞到 ${altitude} 米高度（模拟）`, nodeId)],
  };
}

export async function landAction(
  state: DroneWorkflowState,
  config: NodeActionConfig
): Promise<ActionReturn> {
  const { channel, nodeId } = config;

  try {
    const result = await channel.callTool("drone:land", {});
    if (result?.success !== false) {
      channel.updateState({ altitude: 0, status: "idle" });
      return {
        altitude: 0,
        droneStatus: "idle",
        battery: state.battery - 1,
        currentNodeId: nodeId,
        executedNodes: [nodeId],
        nodeResults: [{ nodeId, success: true, message: "无人机已安全降落", ts: Date.now() }],
        logs: [log("success", "无人机已安全降落", nodeId)],
      };
    }
  } catch {
    // fallback
  }
  channel.updateState({ altitude: 0, status: "idle", battery: state.battery - 1 });
  return {
    altitude: 0,
    droneStatus: "idle",
    battery: state.battery - 1,
    currentNodeId: nodeId,
    executedNodes: [nodeId],
    nodeResults: [{ nodeId, success: true, message: "无人机已安全降落（模拟）", ts: Date.now() }],
    logs: [log("success", "无人机已安全降落（模拟）", nodeId)],
  };
}

export async function hoverAction(
  state: DroneWorkflowState,
  config: NodeActionConfig
): Promise<ActionReturn> {
  const { channel, nodeId, nodeParams } = config;
  const duration = Number(nodeParams.duration ?? 5);

  try {
    const result = await channel.callTool("drone:hover", { duration });
    if (result?.success !== false) {
      channel.updateState({ status: "hovering" });
      return {
        droneStatus: "hovering",
        battery: state.battery - Math.ceil(duration / 10),
        currentNodeId: nodeId,
        executedNodes: [nodeId],
        nodeResults: [{ nodeId, success: true, message: `悬停 ${duration} 秒完成`, ts: Date.now() }],
        logs: [log("success", `悬停 ${duration} 秒完成`, nodeId)],
      };
    }
  } catch {
    // fallback
  }
  channel.updateState({ status: "hovering", battery: state.battery - Math.ceil(duration / 10) });
  return {
    droneStatus: "hovering",
    battery: state.battery - Math.ceil(duration / 10),
    currentNodeId: nodeId,
    executedNodes: [nodeId],
    nodeResults: [{ nodeId, success: true, message: `悬停 ${duration} 秒完成（模拟）`, ts: Date.now() }],
    logs: [log("success", `悬停 ${duration} 秒完成（模拟）`, nodeId)],
  };
}

export async function flyToAction(
  state: DroneWorkflowState,
  config: NodeActionConfig
): Promise<ActionReturn> {
  const { channel, nodeId, nodeParams } = config;
  const lat = Number(nodeParams.lat ?? state.position.lat);
  const lng = Number(nodeParams.lng ?? state.position.lng);
  const altitude = Number(nodeParams.altitude ?? state.altitude);

  try {
    const result = await channel.callTool("drone:fly_to", { lat, lng, altitude });
    if (result?.success !== false) {
      channel.updateState({ position: { lat, lng }, altitude, status: "flying" });
      return {
        position: { lat, lng },
        altitude,
        droneStatus: "flying",
        battery: state.battery - 5,
        currentNodeId: nodeId,
        executedNodes: [nodeId],
        nodeResults: [{ nodeId, success: true, message: `已飞行到 (${lat.toFixed(4)}, ${lng.toFixed(4)})`, ts: Date.now() }],
        logs: [log("success", `已飞行到坐标 (${lat.toFixed(4)}, ${lng.toFixed(4)})`, nodeId)],
      };
    }
  } catch {
    // fallback
  }
  channel.updateState({ position: { lat, lng }, status: "flying", battery: state.battery - 5 });
  return {
    position: { lat, lng },
    altitude,
    droneStatus: "flying",
    battery: state.battery - 5,
    currentNodeId: nodeId,
    executedNodes: [nodeId],
    nodeResults: [{ nodeId, success: true, message: `已飞行到 (${lat.toFixed(4)}, ${lng.toFixed(4)})（模拟）`, ts: Date.now() }],
    logs: [log("success", `已飞行到坐标 (${lat.toFixed(4)}, ${lng.toFixed(4)})（模拟）`, nodeId)],
  };
}

export async function returnHomeAction(
  state: DroneWorkflowState,
  config: NodeActionConfig
): Promise<ActionReturn> {
  const { channel, nodeId } = config;

  try {
    const result = await channel.callTool("drone:return_home", {});
    if (result?.success !== false) {
      channel.updateState({ position: { lat: 39.9042, lng: 116.4074 }, status: "returning" });
      return {
        position: { lat: 39.9042, lng: 116.4074 },
        droneStatus: "returning",
        battery: state.battery - 3,
        currentNodeId: nodeId,
        executedNodes: [nodeId],
        nodeResults: [{ nodeId, success: true, message: "已返回起飞点", ts: Date.now() }],
        logs: [log("success", "已返回起飞点", nodeId)],
      };
    }
  } catch {
    // fallback
  }
  channel.updateState({ position: { lat: 39.9042, lng: 116.4074 }, status: "returning", battery: state.battery - 3 });
  return {
    position: { lat: 39.9042, lng: 116.4074 },
    droneStatus: "returning",
    battery: state.battery - 3,
    currentNodeId: nodeId,
    executedNodes: [nodeId],
    nodeResults: [{ nodeId, success: true, message: "已返回起飞点（模拟）", ts: Date.now() }],
    logs: [log("success", "已返回起飞点（模拟）", nodeId)],
  };
}

// ---- 数据采集节点 ----

export async function takePhotoAction(
  state: DroneWorkflowState,
  config: NodeActionConfig
): Promise<ActionReturn> {
  const { channel, nodeId, nodeParams } = config;
  const count = Number(nodeParams.count ?? nodeParams.intervalSec ? 1 : 1);

  try {
    const result = await channel.callTool("drone:take_photo", { count });
    if (result?.success !== false) {
      return {
        currentNodeId: nodeId,
        executedNodes: [nodeId],
        nodeResults: [{ nodeId, success: true, message: `拍照完成（${count}张）`, ts: Date.now() }],
        logs: [log("success", `拍照完成（${count}张）`, nodeId)],
      };
    }
  } catch {
    // fallback
  }
  return {
    currentNodeId: nodeId,
    executedNodes: [nodeId],
    nodeResults: [{ nodeId, success: true, message: `拍照完成（${count}张，模拟）`, ts: Date.now() }],
    logs: [log("success", `拍照完成（${count}张，模拟）`, nodeId)],
  };
}

export async function recordVideoAction(
  state: DroneWorkflowState,
  config: NodeActionConfig
): Promise<ActionReturn> {
  const { channel, nodeId, nodeParams } = config;
  const action = String(nodeParams.action ?? "start");

  try {
    const result = await channel.callTool("drone:record_video", { action });
    if (result?.success !== false) {
      channel.updateState({ isRecording: action === "start" });
      return {
        isRecording: action === "start",
        currentNodeId: nodeId,
        executedNodes: [nodeId],
        nodeResults: [{ nodeId, success: true, message: `录像${action === "start" ? "开始" : "停止"}`, ts: Date.now() }],
        logs: [log("success", `录像${action === "start" ? "开始" : "停止"}`, nodeId)],
      };
    }
  } catch {
    // fallback
  }
  return {
    isRecording: action === "start",
    currentNodeId: nodeId,
    executedNodes: [nodeId],
    nodeResults: [{ nodeId, success: true, message: `录像${action === "start" ? "开始" : "停止"}（模拟）`, ts: Date.now() }],
    logs: [log("success", `录像${action === "start" ? "开始" : "停止"}（模拟）`, nodeId)],
  };
}

// ---- 安全检查节点 ----

export async function checkBatteryAction(
  state: DroneWorkflowState,
  config: NodeActionConfig
): Promise<ActionReturn> {
  const { channel, nodeId, nodeParams } = config;
  const threshold = Number(nodeParams.threshold ?? nodeParams.low ?? 30);

  try {
    const result = await channel.callTool("drone:check_battery", { threshold });
    if (result?.battery !== undefined) {
      channel.updateState({ battery: result.battery });
      const isLow = result.battery < threshold;
      const level = isLow ? "warning" : "success";
      const message = isLow
        ? `电量 ${result.battery}% 低于阈值 ${threshold}%，需要返航`
        : `电量 ${result.battery}% 正常（阈值 ${threshold}%）`;
      return {
        battery: result.battery,
        currentNodeId: nodeId,
        executedNodes: [nodeId],
        nodeResults: [{ nodeId, success: true, message, ts: Date.now() }],
        logs: [log(level, message, nodeId)],
      };
    }
  } catch {
    // fallback
  }
  const isLow = state.battery < threshold;
  const level = isLow ? "warning" : "success";
  const message = isLow
    ? `电量 ${state.battery}% 低于阈值 ${threshold}%，需要返航（模拟）`
    : `电量 ${state.battery}% 正常（阈值 ${threshold}%）（模拟）`;
  return {
    currentNodeId: nodeId,
    executedNodes: [nodeId],
    nodeResults: [{ nodeId, success: true, message, ts: Date.now() }],
    logs: [log(level, message, nodeId)],
  };
}

export async function queryWeatherAction(
  _state: DroneWorkflowState,
  config: NodeActionConfig
): Promise<ActionReturn> {
  const { channel, nodeId, nodeParams } = config;
  const city = String(nodeParams.city ?? "");

  try {
    const result = await channel.callTool("amap:maps_weather", { city });
    if (result?.success !== false) {
      return {
        currentNodeId: nodeId,
        executedNodes: [nodeId],
        nodeResults: [{ nodeId, success: true, message: `天气查询完成: ${city}`, ts: Date.now() }],
        logs: [log("success", `天气查询完成: ${city}`, nodeId)],
      };
    }
  } catch {
    // fallback
  }
  return {
    currentNodeId: nodeId,
    executedNodes: [nodeId],
    nodeResults: [{ nodeId, success: true, message: `天气查询完成: ${city}（模拟）`, ts: Date.now() }],
    logs: [log("success", `天气查询完成: ${city}（模拟）`, nodeId)],
  };
}

// ---- 任务节点 ----

export async function patrolAction(
  state: DroneWorkflowState,
  config: NodeActionConfig
): Promise<ActionReturn> {
  const { channel, nodeId, nodeParams } = config;
  const areaName = String(nodeParams.areaName ?? "未知区域");

  try {
    await channel.callTool("drone:take_photo", { count: 3 });
    const statusResult = await channel.callTool("drone:get_drone_status", {});
    if (statusResult?.droneState) {
      channel.updateState(statusResult.droneState);
    }
    return {
      battery: state.battery - 8,
      currentNodeId: nodeId,
      executedNodes: [nodeId],
      nodeResults: [{ nodeId, success: true, message: `${areaName} 巡检完成`, ts: Date.now() }],
      logs: [log("success", `${areaName} 巡检完成`, nodeId)],
    };
  } catch {
    // fallback
  }
  channel.updateState({ battery: state.battery - 8 });
  return {
    battery: state.battery - 8,
    currentNodeId: nodeId,
    executedNodes: [nodeId],
    nodeResults: [{ nodeId, success: true, message: `${areaName} 巡检完成（模拟）`, ts: Date.now() }],
    logs: [log("success", `${areaName} 巡检完成（模拟）`, nodeId)],
  };
}

// ---- 通用 MCP 映射节点 ----

const MCP_TOOL_MAP: Record<string, { tool: string; mapper: (p: Record<string, unknown>) => Record<string, any> }> = {
  "地址解析": { tool: "amap:maps_geo", mapper: (p) => ({ address: String(p.address ?? "") }) },
  "路径规划": { tool: "amap:maps_direction_driving", mapper: (p) => ({ origin: String(p.origin ?? ""), destination: String(p.destination ?? "") }) },
  "POI搜索": { tool: "amap:maps_around", mapper: (p) => ({ location: String(p.location ?? ""), keywords: String(p.keywords ?? ""), radius: Number(p.radius ?? 1000) }) },
};

export async function genericMcpAction(
  _state: DroneWorkflowState,
  config: NodeActionConfig
): Promise<ActionReturn> {
  const { channel, nodeId, nodeLabel, nodeParams } = config;
  const mapping = MCP_TOOL_MAP[config.nodeLabel];

  if (mapping) {
    try {
      const mcpParams = mapping.mapper(nodeParams);
      const result = await channel.callTool(mapping.tool, mcpParams);
      return {
        currentNodeId: nodeId,
        executedNodes: [nodeId],
        nodeResults: [{ nodeId, success: true, message: result?.message || `${nodeLabel} 完成`, ts: Date.now() }],
        logs: [log("success", result?.message || `${nodeLabel} 完成`, nodeId)],
      };
    } catch {
      // fallback
    }
  }

  // 通用降级
  return {
    currentNodeId: nodeId,
    executedNodes: [nodeId],
    nodeResults: [{ nodeId, success: true, message: `${nodeLabel} 完成（模拟）`, ts: Date.now() }],
    logs: [log("success", `${nodeLabel} 完成（模拟）`, nodeId)],
  };
}

// ---- Action 路由器 ----

type NodeActionFn = (state: DroneWorkflowState, config: NodeActionConfig) => Promise<ActionReturn>;

const NODE_TYPE_ACTIONS: Record<string, NodeActionFn> = {
  "start": startAction,
  "end": endAction,
  "parallel_fork": parallelForkAction,
  "parallel_join": parallelJoinAction,
  "条件判断": conditionAction,
  "起飞": takeoffAction,
  "降落": landAction,
  "悬停": hoverAction,
  "飞行到点": flyToAction,
  "返航": returnHomeAction,
  "定时拍照": takePhotoAction,
  "录像": recordVideoAction,
  "电量检查": checkBatteryAction,
  "查询天气": queryWeatherAction,
  "天气查询": queryWeatherAction,
  "区域巡检": patrolAction,
};

export function resolveNodeAction(nodeType: string): NodeActionFn {
  return NODE_TYPE_ACTIONS[nodeType] || genericMcpAction;
}
