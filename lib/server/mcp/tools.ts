import { z } from "zod";
import mongoose from "mongoose";
import { connectDB } from "@/lib/server/db";
import { Workflow } from "@/lib/server/models/Workflow";
import { Mission } from "@/lib/server/models/Mission";

// 验证 MongoDB ObjectId
function isValidObjectId(id: string): boolean {
  return mongoose.Types.ObjectId.isValid(id);
}

// MCP 工具定义
export interface MCPTool {
  name: string;
  description: string;
  parameters: z.ZodObject<any>;
  execute: (params: any) => Promise<any>;
}

// 工具：查询工作流列表
export const listWorkflowsTool: MCPTool = {
  name: "list_workflows",
  description: "获取已保存的无人机工作流列表，可按名称搜索",
  parameters: z.object({
    search: z.string().optional().describe("搜索关键词"),
    limit: z.number().optional().default(10).describe("返回数量限制")
  }),
  execute: async (params) => {
    await connectDB();
    const query: any = {};
    if (params.search) {
      query.name = { $regex: params.search, $options: "i" };
    }
    const workflows = await Workflow.find(query)
      .select("name description createdAt updatedAt")
      .sort({ updatedAt: -1 })
      .limit(params.limit || 10)
      .lean();
    return { workflows, count: workflows.length };
  }
};

// 工具：获取工作流详情
export const getWorkflowTool: MCPTool = {
  name: "get_workflow",
  description: "根据ID或名称获取工作流的详细信息",
  parameters: z.object({
    id: z.string().optional().describe("工作流ID"),
    name: z.string().optional().describe("工作流名称")
  }),
  execute: async (params) => {
    await connectDB();
    let workflow;
    if (params.id) {
      if (!isValidObjectId(params.id)) {
        return { error: "无效的工作流ID格式" };
      }
      workflow = await Workflow.findById(params.id).lean();
    } else if (params.name) {
      workflow = await Workflow.findOne({ name: params.name }).lean();
    }
    if (!workflow) {
      return { error: "工作流未找到" };
    }
    return { workflow };
  }
};

// 工具：查询任务执行历史
export const listMissionsTool: MCPTool = {
  name: "list_missions",
  description: "获取无人机任务执行历史记录",
  parameters: z.object({
    status: z.enum(["pending", "running", "completed", "failed"]).optional().describe("任务状态筛选"),
    limit: z.number().optional().default(10).describe("返回数量限制")
  }),
  execute: async (params) => {
    await connectDB();
    const query: any = {};
    if (params.status) {
      query.status = params.status;
    }
    const missions = await Mission.find(query)
      .select("workflowName status progress createdAt completedAt")
      .sort({ createdAt: -1 })
      .limit(params.limit || 10)
      .lean();
    return { missions, count: missions.length };
  }
};

// 工具：获取任务详情
export const getMissionTool: MCPTool = {
  name: "get_mission",
  description: "根据ID获取任务执行的详细信息，包括日志",
  parameters: z.object({
    id: z.string().describe("任务ID")
  }),
  execute: async (params) => {
    await connectDB();
    if (!isValidObjectId(params.id)) {
      return { error: "无效的任务ID格式" };
    }
    const mission = await Mission.findById(params.id).lean();
    if (!mission) {
      return { error: "任务未找到" };
    }
    return { mission };
  }
};

// 工具：获取无人机状态模板
export const getDroneCapabilitiesTool: MCPTool = {
  name: "get_drone_capabilities",
  description: "获取无人机支持的能力和节点类型列表",
  parameters: z.object({}),
  execute: async () => {
    return {
      nodeTypes: [
        { type: "start", description: "工作流开始节点" },
        { type: "end", description: "工作流结束节点" },
        { type: "起飞", description: "无人机起飞", params: { altitude: "起飞高度(米)" } },
        { type: "降落", description: "无人机降落" },
        { type: "悬停", description: "悬停等待", params: { duration: "悬停时间(秒)" } },
        { type: "飞行到点", description: "飞行到指定坐标", params: { lat: "纬度", lng: "经度", altitude: "高度" } },
        { type: "区域巡检", description: "巡检指定区域", params: { areaName: "区域名称" } },
        { type: "定时拍照", description: "定时拍照", params: { intervalSec: "拍照间隔(秒)" } },
        { type: "录像", description: "开始/停止录像", params: { action: "start|stop" } },
        { type: "电量检查", description: "检查电量", params: { threshold: "电量阈值百分比" } },
        { type: "返航", description: "返回起飞点" },
        { type: "条件判断", description: "条件分支节点" }
      ],
      conditionExamples: [
        "battery < 30%",
        "battery >= 30%",
        "altitude > 100",
        "distance < 500"
      ]
    };
  }
};

// 工具：验证工作流
export const validateWorkflowTool: MCPTool = {
  name: "validate_workflow",
  description: "验证工作流结构是否正确",
  parameters: z.object({
    workflow: z.object({
      workflow_name: z.string(),
      nodes: z.array(z.any()),
      edges: z.array(z.any())
    }).describe("要验证的工作流对象")
  }),
  execute: async (params) => {
    const { workflow } = params;
    const errors: string[] = [];
    const warnings: string[] = [];

    // 检查必要字段
    if (!workflow.workflow_name) {
      errors.push("缺少工作流名称");
    }

    // 检查节点
    const nodes = workflow.nodes || [];
    const nodeIds = new Set(nodes.map((n: any) => n.id));
    
    const startNodes = nodes.filter((n: any) => n.type === "start");
    const endNodes = nodes.filter((n: any) => n.type === "end");

    if (startNodes.length === 0) {
      errors.push("缺少开始节点");
    } else if (startNodes.length > 1) {
      errors.push("存在多个开始节点");
    }

    if (endNodes.length === 0) {
      errors.push("缺少结束节点");
    }

    // 检查边
    const edges = workflow.edges || [];
    for (const edge of edges) {
      if (!nodeIds.has(edge.from)) {
        errors.push(`边 ${edge.id} 的源节点 ${edge.from} 不存在`);
      }
      if (!nodeIds.has(edge.to)) {
        errors.push(`边 ${edge.id} 的目标节点 ${edge.to} 不存在`);
      }
    }

    // 检查孤立节点
    const connectedNodes = new Set<string>();
    for (const edge of edges) {
      connectedNodes.add(edge.from);
      connectedNodes.add(edge.to);
    }
    for (const node of nodes) {
      if (!connectedNodes.has(node.id) && node.type !== "start" && node.type !== "end") {
        warnings.push(`节点 ${node.id} (${node.label}) 未连接到任何边`);
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }
};

// 所有可用工具
export const allTools: MCPTool[] = [
  listWorkflowsTool,
  getWorkflowTool,
  listMissionsTool,
  getMissionTool,
  getDroneCapabilitiesTool,
  validateWorkflowTool
];

// 根据名称获取工具
export function getToolByName(name: string): MCPTool | undefined {
  return allTools.find(t => t.name === name);
}

// 获取工具描述（用于 LLM prompt）
export function getToolDescriptions(): string {
  return allTools.map(tool => {
    const params = Object.entries(tool.parameters.shape)
      .map(([key, schema]: [string, any]) => {
        const desc = schema._def?.description || "";
        const optional = schema.isOptional?.() ? "(可选)" : "";
        return `    - ${key}${optional}: ${desc}`;
      })
      .join("\n");
    
    return `- ${tool.name}: ${tool.description}\n  参数:\n${params || "    无"}`;
  }).join("\n\n");
}
