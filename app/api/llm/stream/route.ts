import { connectDB } from "@/lib/server/db";
import { ChatHistory } from "@/lib/server/models/ChatHistory";
import { Workflow } from "@/lib/server/models/Workflow";
import { getLLM, isLLMConfigured } from "@/lib/server/llm";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { v4 as uuidv4 } from "uuid";
import { WORKFLOW_SYSTEM_PROMPT, createMockWorkflow, createMockParallelWorkflow, extractWorkflowJSON } from "@/lib/server/llmPrompts";

export const runtime = "nodejs";

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
      // 检测是否为多无人机任务
      const multiDroneKeywords = /多(架|个|台)|同时|并行|\d+\s*架|\d+\s*台|\d+\s*个无人机|多机/;
      const droneCountMatch = userInput.match(/(\d+)\s*[架台个]/); 
      const isMultiDrone = multiDroneKeywords.test(userInput);
      const droneCount = droneCountMatch ? parseInt(droneCountMatch[1], 10) : 2;

      // 返回 mock 响应
      const mockWorkflow = isMultiDrone
        ? createMockParallelWorkflow(userInput, Math.min(droneCount, 5))
        : createMockWorkflow(userInput);
      
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

      // 保存助手消息到数据库（不含思考过程，mock 模式无思考内容）
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
            new SystemMessage(WORKFLOW_SYSTEM_PROMPT),
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
            workflow = extractWorkflowJSON(fullContent);
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

          // 保存助手消息到数据库（包含思考过程，与前端 <think> 格式一致）
          try {
            const resultText = workflow 
              ? "已生成工作流，请在画布确认/调整后执行。"
              : "工作流解析失败，请重试。";
            const assistantMessage = fullContent
              ? `<think>${fullContent}</think>\n${resultText}`
              : resultText;
              
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

