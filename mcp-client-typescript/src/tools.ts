import * as client from "./httpDroneClient.js";

// ============================================================================
// 工具定义接口
// ============================================================================

export interface DroneTool {
  name: string;
  description: string;
  inputSchema: {
    type: "object";
    properties: Record<string, any>;
    required?: string[];
  };
  execute: (params: any) => Promise<any>;
}

// ============================================================================
// activeDroneId —— 当前激活的无人机 ID（方案 A）
// connect_drone 成功后自动设置，后续工具默认对此 ID 操作
// ============================================================================

let activeDroneId: string | null = null;

function requireActiveDrone(): string {
  if (!activeDroneId) {
    throw new Error("没有激活的无人机，请先调用 connect_drone");
  }
  return activeDroneId;
}

function unwrap(res: any): any {
  if (!res.success) {
    throw new Error(res.error?.message || "drone-control-service 返回错误");
  }
  return res.data;
}

// ============================================================================
// 工具定义（全部通过 httpDroneClient 调用 drone-control-service）
// ============================================================================

const connectDroneTool: DroneTool = {
  name: "connect_drone",
  description: "连接到无人机设备（连接后自动设为当前激活无人机）",
  inputSchema: {
    type: "object",
    properties: {
      droneId: {
        type: "string",
        description: "无人机设备ID",
      },
      name: {
        type: "string",
        description: "无人机名称（可选）",
      },
    },
    required: ["droneId"],
  },
  execute: async (params) => {
    const res = await client.connectDrone(params.droneId, params.name);
    const data = unwrap(res);
    activeDroneId = params.droneId;
    return { ...data, activeDroneId };
  },
};

const disconnectDroneTool: DroneTool = {
  name: "disconnect_drone",
  description: "断开当前无人机连接",
  inputSchema: {
    type: "object",
    properties: {},
  },
  execute: async () => {
    const droneId = requireActiveDrone();
    const res = await client.disconnectDrone(droneId);
    const data = unwrap(res);
    activeDroneId = null;
    return data;
  },
};

const takeoffTool: DroneTool = {
  name: "takeoff",
  description: "控制无人机起飞到指定高度",
  inputSchema: {
    type: "object",
    properties: {
      altitude: {
        type: "number",
        description: "目标高度（米）",
        minimum: 1,
        maximum: 500,
      },
    },
    required: ["altitude"],
  },
  execute: async (params) => {
    const droneId = requireActiveDrone();
    const res = await client.sendCommand(droneId, "takeoff", { altitude: params.altitude });
    return unwrap(res);
  },
};

const landTool: DroneTool = {
  name: "land",
  description: "控制无人机降落",
  inputSchema: {
    type: "object",
    properties: {},
  },
  execute: async () => {
    const droneId = requireActiveDrone();
    const res = await client.sendCommand(droneId, "land", {});
    return unwrap(res);
  },
};

const flyToTool: DroneTool = {
  name: "fly_to",
  description: "控制无人机飞行到指定GPS坐标",
  inputSchema: {
    type: "object",
    properties: {
      lat: {
        type: "number",
        description: "目标纬度",
      },
      lng: {
        type: "number",
        description: "目标经度",
      },
      altitude: {
        type: "number",
        description: "飞行高度（米）",
      },
    },
    required: ["lat", "lng"],
  },
  execute: async (params) => {
    const droneId = requireActiveDrone();
    const res = await client.sendCommand(droneId, "fly_to", {
      lat: params.lat,
      lng: params.lng,
      altitude: params.altitude,
    });
    return unwrap(res);
  },
};

const hoverTool: DroneTool = {
  name: "hover",
  description: "控制无人机在当前位置悬停指定时间",
  inputSchema: {
    type: "object",
    properties: {
      duration: {
        type: "number",
        description: "悬停时间（秒）",
      },
    },
    required: ["duration"],
  },
  execute: async (params) => {
    const droneId = requireActiveDrone();
    const res = await client.sendCommand(droneId, "hover", { duration: params.duration });
    return unwrap(res);
  },
};

const takePhotoTool: DroneTool = {
  name: "take_photo",
  description: "控制无人机拍摄照片",
  inputSchema: {
    type: "object",
    properties: {
      count: {
        type: "number",
        description: "拍摄张数",
        default: 1,
      },
    },
  },
  execute: async (params) => {
    const droneId = requireActiveDrone();
    const res = await client.sendCommand(droneId, "take_photo", { count: params.count || 1 });
    return unwrap(res);
  },
};

const recordVideoTool: DroneTool = {
  name: "record_video",
  description: "控制无人机开始或停止录像",
  inputSchema: {
    type: "object",
    properties: {
      action: {
        type: "string",
        enum: ["start", "stop"],
        description: "录像操作：start 开始，stop 停止",
      },
    },
    required: ["action"],
  },
  execute: async (params) => {
    const droneId = requireActiveDrone();
    const res = await client.sendCommand(droneId, "record_video", { action: params.action });
    return unwrap(res);
  },
};

const getDroneStatusTool: DroneTool = {
  name: "get_drone_status",
  description: "获取无人机当前状态信息",
  inputSchema: {
    type: "object",
    properties: {},
  },
  execute: async () => {
    const droneId = requireActiveDrone();
    const res = await client.getDroneStatus(droneId);
    return unwrap(res);
  },
};

const returnHomeTool: DroneTool = {
  name: "return_home",
  description: "控制无人机返回起飞点",
  inputSchema: {
    type: "object",
    properties: {},
  },
  execute: async () => {
    const droneId = requireActiveDrone();
    const res = await client.sendCommand(droneId, "return_home", {});
    return unwrap(res);
  },
};

const checkBatteryTool: DroneTool = {
  name: "check_battery",
  description: "检查无人机电量状态",
  inputSchema: {
    type: "object",
    properties: {
      threshold: {
        type: "number",
        description: "电量阈值百分比，低于此值返回警告",
        default: 30,
      },
    },
  },
  execute: async (params) => {
    const droneId = requireActiveDrone();
    const res = await client.sendCommand(droneId, "check_battery", { threshold: params.threshold || 30 });
    return unwrap(res);
  },
};

// ============================================================================
// 导出
// ============================================================================

export const droneTools: DroneTool[] = [
  connectDroneTool,
  disconnectDroneTool,
  takeoffTool,
  landTool,
  flyToTool,
  hoverTool,
  takePhotoTool,
  recordVideoTool,
  getDroneStatusTool,
  returnHomeTool,
  checkBatteryTool,
];

export async function executeToolByName(
  name: string,
  params: any
): Promise<any> {
  const tool = droneTools.find((t) => t.name === name);
  if (!tool) {
    throw new Error(`Tool "${name}" not found`);
  }
  return tool.execute(params);
}
