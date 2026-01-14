import { z } from "zod";

// 工具定义接口
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

// 模拟无人机状态
let droneState = {
  connected: false,
  battery: 100,
  altitude: 0,
  position: { lat: 39.9042, lng: 116.4074 },
  status: "idle" as "idle" | "flying" | "hovering" | "returning",
  isRecording: false,
};

// 工具：连接无人机
const connectDroneTool: DroneTool = {
  name: "connect_drone",
  description: "连接到无人机设备",
  inputSchema: {
    type: "object",
    properties: {
      droneId: {
        type: "string",
        description: "无人机设备ID",
      },
    },
    required: ["droneId"],
  },
  execute: async (params) => {
    droneState.connected = true;
    return {
      success: true,
      message: `已连接到无人机 ${params.droneId}`,
      droneState: { ...droneState },
    };
  },
};

// 工具：起飞
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
    if (!droneState.connected) {
      return { success: false, error: "无人机未连接" };
    }
    droneState.altitude = params.altitude;
    droneState.status = "flying";
    droneState.battery -= 2;
    return {
      success: true,
      message: `无人机已起飞至 ${params.altitude} 米`,
      droneState: { ...droneState },
    };
  },
};

// 工具：降落
const landTool: DroneTool = {
  name: "land",
  description: "控制无人机降落",
  inputSchema: {
    type: "object",
    properties: {},
  },
  execute: async () => {
    if (!droneState.connected) {
      return { success: false, error: "无人机未连接" };
    }
    droneState.altitude = 0;
    droneState.status = "idle";
    droneState.battery -= 1;
    return {
      success: true,
      message: "无人机已安全降落",
      droneState: { ...droneState },
    };
  },
};

// 工具：飞行到指定位置
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
    if (!droneState.connected) {
      return { success: false, error: "无人机未连接" };
    }
    droneState.position = { lat: params.lat, lng: params.lng };
    if (params.altitude) {
      droneState.altitude = params.altitude;
    }
    droneState.status = "flying";
    droneState.battery -= 5;
    return {
      success: true,
      message: `无人机已飞行至 (${params.lat}, ${params.lng})`,
      droneState: { ...droneState },
    };
  },
};

// 工具：悬停
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
    if (!droneState.connected) {
      return { success: false, error: "无人机未连接" };
    }
    droneState.status = "hovering";
    droneState.battery -= Math.ceil(params.duration / 10);
    return {
      success: true,
      message: `无人机悬停 ${params.duration} 秒`,
      droneState: { ...droneState },
    };
  },
};

// 工具：拍照
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
    if (!droneState.connected) {
      return { success: false, error: "无人机未连接" };
    }
    const count = params.count || 1;
    return {
      success: true,
      message: `已拍摄 ${count} 张照片`,
      photos: Array.from({ length: count }, (_, i) => ({
        id: `photo_${Date.now()}_${i}`,
        timestamp: new Date().toISOString(),
        position: { ...droneState.position },
        altitude: droneState.altitude,
      })),
    };
  },
};

// 工具：开始/停止录像
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
    if (!droneState.connected) {
      return { success: false, error: "无人机未连接" };
    }
    droneState.isRecording = params.action === "start";
    return {
      success: true,
      message: params.action === "start" ? "开始录像" : "停止录像",
      isRecording: droneState.isRecording,
    };
  },
};

// 工具：获取无人机状态
const getDroneStatusTool: DroneTool = {
  name: "get_drone_status",
  description: "获取无人机当前状态信息",
  inputSchema: {
    type: "object",
    properties: {},
  },
  execute: async () => {
    return {
      success: true,
      droneState: { ...droneState },
    };
  },
};

// 工具：返航
const returnHomeTool: DroneTool = {
  name: "return_home",
  description: "控制无人机返回起飞点",
  inputSchema: {
    type: "object",
    properties: {},
  },
  execute: async () => {
    if (!droneState.connected) {
      return { success: false, error: "无人机未连接" };
    }
    droneState.status = "returning";
    droneState.position = { lat: 39.9042, lng: 116.4074 };
    droneState.battery -= 3;
    return {
      success: true,
      message: "无人机正在返航",
      droneState: { ...droneState },
    };
  },
};

// 工具：检查电量
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
    const threshold = params.threshold || 30;
    const isLow = droneState.battery < threshold;
    return {
      success: true,
      battery: droneState.battery,
      threshold,
      isLow,
      warning: isLow ? `电量低于 ${threshold}%，建议返航` : null,
    };
  },
};

// 导出所有工具
export const droneTools: DroneTool[] = [
  connectDroneTool,
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

// 根据名称执行工具
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
