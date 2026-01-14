// MCP 资源定义

export interface DroneResource {
  uri: string;
  name: string;
  description: string;
  mimeType: string;
}

// 无人机能力资源
const droneCapabilitiesResource: DroneResource = {
  uri: "drone://capabilities",
  name: "无人机能力列表",
  description: "获取无人机支持的所有操作和参数",
  mimeType: "application/json",
};

// 工作流模板资源
const workflowTemplatesResource: DroneResource = {
  uri: "drone://workflow-templates",
  name: "工作流模板",
  description: "预定义的无人机工作流模板",
  mimeType: "application/json",
};

// 节点类型资源
const nodeTypesResource: DroneResource = {
  uri: "drone://node-types",
  name: "节点类型列表",
  description: "工作流中可用的节点类型及其参数",
  mimeType: "application/json",
};

// 导出资源列表
export const droneResources: DroneResource[] = [
  droneCapabilitiesResource,
  workflowTemplatesResource,
  nodeTypesResource,
];

// 获取资源内容
export async function getResourceContent(uri: string): Promise<any> {
  switch (uri) {
    case "drone://capabilities":
      return {
        capabilities: [
          { name: "takeoff", description: "起飞", params: ["altitude"] },
          { name: "land", description: "降落", params: [] },
          { name: "fly_to", description: "飞行到指定位置", params: ["lat", "lng", "altitude"] },
          { name: "hover", description: "悬停", params: ["duration"] },
          { name: "take_photo", description: "拍照", params: ["count"] },
          { name: "record_video", description: "录像", params: ["action"] },
          { name: "return_home", description: "返航", params: [] },
          { name: "check_battery", description: "检查电量", params: ["threshold"] },
        ],
        maxAltitude: 500,
        maxFlightTime: 30,
        supportedCameras: ["4K", "thermal"],
      };

    case "drone://workflow-templates":
      return {
        templates: [
          {
            name: "区域巡检",
            description: "对指定区域进行巡检拍照",
            nodes: ["start", "takeoff", "fly_to", "take_photo", "return_home", "land", "end"],
          },
          {
            name: "定点监控",
            description: "飞到指定位置进行录像监控",
            nodes: ["start", "takeoff", "fly_to", "hover", "record_video", "return_home", "land", "end"],
          },
          {
            name: "电量检查巡航",
            description: "带电量检查的巡航任务",
            nodes: ["start", "takeoff", "fly_to", "check_battery", "return_home", "land", "end"],
          },
        ],
      };

    case "drone://node-types":
      return {
        nodeTypes: [
          { type: "start", label: "开始", params: {} },
          { type: "end", label: "结束", params: {} },
          { type: "起飞", label: "起飞", params: { altitude: "number" } },
          { type: "降落", label: "降落", params: {} },
          { type: "悬停", label: "悬停", params: { duration: "number" } },
          { type: "飞行到点", label: "飞行到点", params: { lat: "number", lng: "number", altitude: "number" } },
          { type: "区域巡检", label: "区域巡检", params: { areaName: "string" } },
          { type: "定时拍照", label: "定时拍照", params: { intervalSec: "number" } },
          { type: "录像", label: "录像", params: { action: "start|stop" } },
          { type: "电量检查", label: "电量检查", params: { threshold: "number" } },
          { type: "返航", label: "返航", params: {} },
          { type: "条件判断", label: "条件判断", params: { condition: "string" } },
        ],
      };

    default:
      throw new Error(`Resource not found: ${uri}`);
  }
}
