import { connectDB } from "@/lib/server/db";
import { ChatHistory } from "@/lib/server/models/ChatHistory";
import { Workflow } from "@/lib/server/models/Workflow";
import { getLLM, isLLMConfigured } from "@/lib/server/llm";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { v4 as uuidv4 } from "uuid";

export const runtime = "nodejs";

const SYSTEM_PROMPT = `你是一个无人机工作流生成助手。用户会用自然语言描述无人机任务，你需要将其解析为结构化的工作流 JSON。

## 可用的节点类型：
- start: 开始节点（必须有且只有一个）
- end: 结束节点（必须有且只有一个）
- 起飞: 无人机起飞，参数 { altitude: number } 表示起飞高度（米）
- 降落: 无人机降落
- 悬停: 悬停等待，参数 { duration: number } 表示悬停时间（秒）
- 飞行到点: 飞行到指定坐标，参数 { lat: number, lng: number, altitude: number }
- 区域巡检: 巡检指定区域，参数 { areaName: string }
- 定时拍照: 定时拍照，参数 { intervalSec: number } 表示拍照间隔（秒）
- 录像: 开始/停止录像，参数 { action: "start" | "stop" }
- 电量检查: 检查电量，参数 { threshold: number } 表示电量阈值百分比
- 返航: 返回起飞点
- 条件判断: 条件分支节点

## 输出格式：
必须返回一个有效的 JSON 对象，格式如下：
{
  "workflow_name": "工作流名称",
  "nodes": [
    { "id": "唯一ID", "type": "节点类型", "label": "显示标签", "params": {} }
  ],
  "edges": [
    { "id": "唯一ID", "from": "源节点ID", "to": "目标节点ID", "condition": "条件表达式或null" }
  ]
}

## 注意事项：
1. 每个工作流必须以 start 节点开始，以 end 节点结束
2. 节点 ID 使用简短的唯一标识如 node_1, node_2 等
3. 边的 ID 使用 edge_1, edge_2 等
4. condition 字段用于条件分支，如 "battery < 30%" 表示电量低于30%时走这条边
5. 只返回 JSON，不要有其他文字说明
`;

export async function POST(req: Request) {
  const encoder = new TextEncoder();
  
  try {
    const body = await req.json();
    const { userInput, sessionId, model } = body;
    
    if (!userInput) {
      return new Response("userInput is required", { status: 400 });
    }
    
    const currentSessionId = sessionId || uuidv4();
    
    // 保存用户消息到数据库
    try {
      await connectDB();
      await ChatHistory.findOneAndUpdate(
        { sessionId: currentSessionId },
        {
          $push: {
            messages: {
              role: "user",
              content: userInput,
              ts: Date.now()
            }
          },
          $setOnInsert: { sessionId: currentSessionId }
        },
        { upsert: true }
      );
    } catch (dbError) {
      console.warn("Failed to save user message to DB:", dbError);
    }
    
    // 检查 LLM 是否配置
    if (!isLLMConfigured()) {
      // 返回 mock 响应
      const mockWorkflow = createMockWorkflow(userInput);
      
      // 保存 mock 工作流到数据库
      let savedWorkflowId = null;
      try {
        const savedWorkflow = await Workflow.create({
          name: mockWorkflow.workflow_name || `工作流_${new Date().toLocaleString("zh-CN")}`,
          description: userInput.slice(0, 200),
          nodes: mockWorkflow.nodes || [],
          edges: mockWorkflow.edges || []
        });
        savedWorkflowId = savedWorkflow._id.toString();
      } catch (dbError) {
        console.warn("Failed to save mock workflow to DB:", dbError);
      }

      // 保存助手消息到数据库
      try {
        await ChatHistory.findOneAndUpdate(
          { sessionId: currentSessionId },
          {
            $push: {
              messages: {
                role: "assistant",
                content: "已生成工作流（模拟数据），请在画布确认/调整后执行。",
                ts: Date.now()
              }
            },
            ...(savedWorkflowId ? { $set: { workflowId: savedWorkflowId } } : {})
          }
        );
      } catch (dbError) {
        console.warn("Failed to save mock assistant message to DB:", dbError);
      }
      
      return new Response(
        encoder.encode(`data: ${JSON.stringify({ 
          type: "complete", 
          workflow: mockWorkflow,
          sessionId: currentSessionId
        })}\n\n`),
        {
          headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            "Connection": "keep-alive"
          }
        }
      );
    }
    
    // 创建流式响应
    const stream = new ReadableStream({
      async start(controller) {
        try {
          const llm = getLLM();
          
          const messages = [
            new SystemMessage(SYSTEM_PROMPT),
            new HumanMessage(`请将以下无人机任务描述转换为工作流 JSON：\n\n${userInput}`)
          ];
          
          let fullContent = "";
          
          // 使用流式调用
          const streamResponse = await llm.stream(messages);
          
          for await (const chunk of streamResponse) {
            const content = typeof chunk.content === "string" ? chunk.content : "";
            if (content) {
              fullContent += content;
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify({ type: "chunk", content })}\n\n`)
              );
            }
          }
          
          // 解析完整的 JSON
          let workflow = null;
          try {
            let jsonStr = fullContent;
            const jsonMatch = fullContent.match(/```(?:json)?\s*([\s\S]*?)```/);
            if (jsonMatch) {
              jsonStr = jsonMatch[1].trim();
            } else {
              const start = fullContent.indexOf("{");
              const end = fullContent.lastIndexOf("}");
              if (start >= 0 && end > start) {
                jsonStr = fullContent.slice(start, end + 1);
              }
            }
            workflow = JSON.parse(jsonStr);
            
            // 确保节点和边都有 ID
            if (workflow.nodes) {
              workflow.nodes = workflow.nodes.map((n: any, idx: number) => ({
                ...n,
                id: n.id || `node_${idx + 1}`
              }));
            }
            if (workflow.edges) {
              workflow.edges = workflow.edges.map((e: any, idx: number) => ({
                ...e,
                id: e.id || `edge_${idx + 1}`
              }));
            }
          } catch (parseError) {
            console.error("Failed to parse workflow JSON:", parseError);
          }
          
          // 保存工作流到数据库
          let savedWorkflowId = null;
          if (workflow) {
            try {
              const savedWorkflow = await Workflow.create({
                name: workflow.workflow_name || `工作流_${new Date().toLocaleString("zh-CN")}`,
                description: userInput.slice(0, 200),
                nodes: workflow.nodes || [],
                edges: workflow.edges || []
              });
              savedWorkflowId = savedWorkflow._id.toString();
            } catch (dbError) {
              console.warn("Failed to save workflow to DB:", dbError);
            }
          }

          // 保存助手消息到数据库
          try {
            const assistantMessage = workflow 
              ? "已生成工作流，请在画布确认/调整后执行。"
              : "工作流解析失败，请重试。";
              
            await ChatHistory.findOneAndUpdate(
              { sessionId: currentSessionId },
              {
                $push: {
                  messages: {
                    role: "assistant",
                    content: assistantMessage,
                    ts: Date.now()
                  }
                },
                ...(savedWorkflowId ? { $set: { workflowId: savedWorkflowId } } : {})
              }
            );
          } catch (dbError) {
            console.warn("Failed to save assistant message to DB:", dbError);
          }
          
          // 发送完成事件
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ 
              type: "complete", 
              workflow,
              sessionId: currentSessionId
            })}\n\n`)
          );
          
          controller.close();
        } catch (error: any) {
          console.error("Stream error:", error);
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ type: "error", message: error.message })}\n\n`)
          );
          controller.close();
        }
      }
    });
    
    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive"
      }
    });
  } catch (error: any) {
    console.error("API error:", error);
    return new Response(error.message, { status: 500 });
  }
}

function createMockWorkflow(userInput: string) {
  const startId = uuidv4();
  const takeoffId = uuidv4();
  const patrolId = uuidv4();
  const photoId = uuidv4();
  const batteryId = uuidv4();
  const rtbId = uuidv4();
  const landId = uuidv4();
  const endId = uuidv4();

  return {
    workflow_name: userInput.slice(0, 24) || "默认工作流",
    nodes: [
      { id: startId, type: "start", label: "开始" },
      { id: takeoffId, type: "起飞", label: "起飞", params: { altitude: 30 } },
      { id: patrolId, type: "区域巡检", label: "区域巡检", params: { areaName: "A区域" } },
      { id: photoId, type: "定时拍照", label: "定时拍照", params: { intervalSec: 10 } },
      { id: batteryId, type: "电量检查", label: "电量检查", params: { threshold: 30 } },
      { id: rtbId, type: "返航", label: "返航" },
      { id: landId, type: "降落", label: "降落" },
      { id: endId, type: "end", label: "结束" }
    ],
    edges: [
      { id: uuidv4(), from: startId, to: takeoffId, condition: null },
      { id: uuidv4(), from: takeoffId, to: patrolId, condition: null },
      { id: uuidv4(), from: patrolId, to: photoId, condition: null },
      { id: uuidv4(), from: photoId, to: batteryId, condition: null },
      { id: uuidv4(), from: batteryId, to: rtbId, condition: "battery < 30%" },
      { id: uuidv4(), from: batteryId, to: photoId, condition: "battery >= 30%" },
      { id: uuidv4(), from: rtbId, to: landId, condition: null },
      { id: uuidv4(), from: landId, to: endId, condition: null }
    ]
  };
}
