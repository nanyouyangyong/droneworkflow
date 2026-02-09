import { z } from "zod";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import type { ParsedWorkflow } from "@/lib/types";
import { getFastLLM, isLLMConfigured } from "@/lib/server/llm";
import { workflowCache, generateCacheKey } from "@/lib/server/cache";
import { WORKFLOW_SYSTEM_PROMPT, createMockWorkflow, extractWorkflowJSON } from "@/lib/server/llmPrompts";

const parseInputSchema = z.object({
  userInput: z.string().min(1),
  model: z.string().optional()
});

async function parseWithLLM(userInput: string): Promise<ParsedWorkflow> {
  const llm = getFastLLM();

  const messages = [
    new SystemMessage(WORKFLOW_SYSTEM_PROMPT),
    new HumanMessage(`请将以下无人机任务描述转换为工作流 JSON：\n\n${userInput}`)
  ];

  const response = await llm.invoke(messages);
  const content = typeof response.content === "string" ? response.content : JSON.stringify(response.content);

  try {
    return extractWorkflowJSON(content);
  } catch (parseError) {
    console.error("Failed to parse LLM response as JSON:", content);
    throw new Error(`LLM 返回的内容无法解析为有效的工作流 JSON: ${parseError}`);
  }
}

export async function parseInstruction(body: unknown): Promise<ParsedWorkflow> {
  const { userInput, model } = parseInputSchema.parse(body);
  
  // 检查缓存
  const cacheKey = generateCacheKey(userInput, model);
  const cached = workflowCache.get(cacheKey);
  if (cached) {
    console.log("[CACHE HIT] Returning cached workflow");
    return cached as ParsedWorkflow;
  }
  
  // 如果配置了 DeepSeek API，使用真正的 LLM 解析
  if (isLLMConfigured()) {
    try {
      console.log("Using DeepSeek LLM to parse instruction...");
      const startTime = Date.now();
      const result = await parseWithLLM(userInput);
      console.log(`[PERF] LLM parsing took ${Date.now() - startTime}ms`);
      
      // 缓存结果
      workflowCache.set(cacheKey, result);
      return result;
    } catch (error) {
      console.error("LLM parsing failed, falling back to mock:", error);
      return createMockWorkflow(userInput);
    }
  }

  // 没有配置 API Key，使用 mock 数据
  console.log("DEEPSEEK_API_KEY not configured, using mock workflow");
  const mockResult = createMockWorkflow(userInput);
  workflowCache.set(cacheKey, mockResult);
  return mockResult;
}
