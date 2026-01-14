import { ChatOpenAI } from "@langchain/openai";
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { getLLM, isLLMConfigured } from "@/lib/server/llm";
import { connectDB } from "@/lib/server/db";
import { Workflow } from "@/lib/server/models/Workflow";
import { Mission } from "@/lib/server/models/Mission";
import mongoose from "mongoose";

// 验证 MongoDB ObjectId
function isValidObjectId(id: string): boolean {
  return mongoose.Types.ObjectId.isValid(id);
}

// ============ 定义 LangGraph 工具 ============

// 工具：查询工作流列表
const listWorkflowsTool = tool(
  async ({ search, limit }) => {
    await connectDB();
    const query: Record<string, any> = {};
    if (search) {
      query.name = { $regex: search, $options: "i" };
    }
    const workflows = await Workflow.find(query)
      .select("name description createdAt updatedAt")
      .sort({ updatedAt: -1 })
      .limit(limit)
      .lean();
    return JSON.stringify({ workflows, count: workflows.length });
  },
  {
    name: "list_workflows",
    description: "获取已保存的无人机工作流列表，可按名称搜索",
    schema: z.object({
      search: z.string().optional().describe("搜索关键词"),
      limit: z.number().default(10).describe("返回数量限制"),
    }),
  }
);

// 工具：获取工作流详情
const getWorkflowTool = tool(
  async ({ id, name }) => {
    await connectDB();
    let workflow;
    if (id) {
      if (!isValidObjectId(id)) {
        return JSON.stringify({ error: "无效的工作流ID格式" });
      }
      workflow = await Workflow.findById(id).lean();
    } else if (name) {
      workflow = await Workflow.findOne({ name }).lean();
    }
    if (!workflow) {
      return JSON.stringify({ error: "工作流未找到" });
    }
    return JSON.stringify({ workflow });
  },
  {
    name: "get_workflow",
    description: "根据ID或名称获取工作流的详细信息",
    schema: z.object({
      id: z.string().optional().describe("工作流ID"),
      name: z.string().optional().describe("工作流名称"),
    }),
  }
);

// 工具：查询任务执行历史
const listMissionsTool = tool(
  async ({ status, limit }) => {
    await connectDB();
    const query: Record<string, any> = {};
    if (status) {
      query.status = status;
    }
    const missions = await Mission.find(query)
      .select("workflowName status progress createdAt completedAt")
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();
    return JSON.stringify({ missions, count: missions.length });
  },
  {
    name: "list_missions",
    description: "获取无人机任务执行历史记录",
    schema: z.object({
      status: z
        .enum(["pending", "running", "completed", "failed"])
        .optional()
        .describe("任务状态筛选"),
      limit: z.number().default(10).describe("返回数量限制"),
    }),
  }
);

// 工具：获取任务详情
const getMissionTool = tool(
  async ({ id }) => {
    await connectDB();
    if (!isValidObjectId(id)) {
      return JSON.stringify({ error: "无效的任务ID格式" });
    }
    const mission = await Mission.findById(id).lean();
    if (!mission) {
      return JSON.stringify({ error: "任务未找到" });
    }
    return JSON.stringify({ mission });
  },
  {
    name: "get_mission",
    description: "根据ID获取任务执行的详细信息，包括日志",
    schema: z.object({
      id: z.string().describe("任务ID"),
    }),
  }
);

// 工具：获取无人机能力
const getDroneCapabilitiesTool = tool(
  async () => {
    return JSON.stringify({
      nodeTypes: [
        { type: "start", label: "开始", description: "工作流起点" },
        { type: "end", label: "结束", description: "工作流终点" },
        { type: "起飞", label: "起飞", params: { altitude: "number (米)" } },
        { type: "降落", label: "降落", description: "无人机降落" },
        { type: "悬停", label: "悬停", params: { duration: "number (秒)" } },
        {
          type: "飞行到点",
          label: "飞行到点",
          params: { lat: "number", lng: "number", altitude: "number" },
        },
        { type: "区域巡检", label: "区域巡检", params: { areaName: "string" } },
        { type: "定时拍照", label: "定时拍照", params: { intervalSec: "number" } },
        { type: "录像", label: "录像", params: { action: "start|stop" } },
        { type: "电量检查", label: "电量检查", params: { threshold: "number (%)" } },
        { type: "返航", label: "返航", description: "返回起飞点" },
        { type: "条件判断", label: "条件判断", description: "条件分支节点" },
      ],
      maxAltitude: 500,
      maxFlightTime: 30,
    });
  },
  {
    name: "get_drone_capabilities",
    description: "获取无人机支持的能力和节点类型列表",
    schema: z.object({}),
  }
);

// 工具：生成工作流
const generateWorkflowTool = tool(
  async ({ description, nodes, edges }) => {
    const workflow = {
      workflow_name: description.slice(0, 50),
      nodes: nodes || [],
      edges: edges || [],
    };
    return JSON.stringify({ workflow, message: "工作流已生成" });
  },
  {
    name: "generate_workflow",
    description: "根据描述生成无人机工作流结构",
    schema: z.object({
      description: z.string().describe("工作流描述"),
      nodes: z
        .array(
          z.object({
            id: z.string(),
            type: z.string(),
            label: z.string(),
            params: z.record(z.any()).optional(),
          })
        )
        .optional()
        .describe("工作流节点列表"),
      edges: z
        .array(
          z.object({
            id: z.string(),
            from: z.string(),
            to: z.string(),
            condition: z.string().nullable().optional(),
          })
        )
        .optional()
        .describe("工作流边列表"),
    }),
  }
);

// 所有工具列表
const allTools = [
  listWorkflowsTool,
  getWorkflowTool,
  listMissionsTool,
  getMissionTool,
  getDroneCapabilitiesTool,
  generateWorkflowTool,
];

// ============ 创建 LangGraph Agent ============

let agentExecutor: ReturnType<typeof createReactAgent> | null = null;

function getAgentExecutor() {
  if (!isLLMConfigured()) {
    throw new Error("LLM 未配置，请设置 DEEPSEEK_API_KEY");
  }

  if (!agentExecutor) {
    const llm = getLLM();
    agentExecutor = createReactAgent({
      llm,
      tools: allTools,
    });
  }

  return agentExecutor;
}

// Agent 响应接口
export interface AgentResponse {
  content: string;
  toolCalls?: Array<{ name: string; result: string }>;
  workflow?: any;
}

// 运行 Agent
export async function runLangGraphAgent(
  userMessage: string,
  conversationHistory: Array<{ role: "user" | "assistant"; content: string }> = []
): Promise<AgentResponse> {
  if (!isLLMConfigured()) {
    return {
      content: "LLM 未配置，无法使用 Agent 功能。请配置 DEEPSEEK_API_KEY。",
    };
  }

  try {
    const agent = getAgentExecutor();

    // 构建消息历史
    const messages: Array<{ role: "user" | "assistant"; content: string }> = [
      ...conversationHistory,
      { role: "user", content: userMessage },
    ];

    // 调用 Agent
    const result = await agent.invoke({
      messages: messages.map((m) => ({
        role: m.role === "user" ? "human" : "ai",
        content: m.content,
      })),
    });

    // 提取最终响应
    const lastMessage = result.messages[result.messages.length - 1];
    const content =
      typeof lastMessage.content === "string"
        ? lastMessage.content
        : JSON.stringify(lastMessage.content);

    // 提取工具调用结果
    const toolCalls: Array<{ name: string; result: string }> = [];
    for (const msg of result.messages) {
      if (msg._getType?.() === "tool") {
        toolCalls.push({
          name: (msg as any).name || "unknown",
          result: typeof msg.content === "string" ? msg.content : JSON.stringify(msg.content),
        });
      }
    }

    // 尝试从工具结果中提取 workflow
    let workflow = null;
    for (const tc of toolCalls) {
      try {
        const parsed = JSON.parse(tc.result);
        if (parsed.workflow) {
          workflow = parsed.workflow;
          break;
        }
      } catch {
        // 忽略解析错误
      }
    }

    return {
      content,
      toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
      workflow,
    };
  } catch (error: any) {
    console.error("LangGraph Agent error:", error);
    return {
      content: `Agent 执行出错: ${error.message}`,
    };
  }
}

// 获取可用工具列表
export function getAvailableTools() {
  return allTools.map((t) => ({
    name: t.name,
    description: t.description,
  }));
}
