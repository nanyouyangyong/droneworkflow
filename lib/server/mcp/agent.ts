import { HumanMessage, SystemMessage, AIMessage } from "@langchain/core/messages";
import { getLLM, isLLMConfigured } from "@/lib/server/llm";
import { allTools, getToolByName, getToolDescriptions } from "./tools";

// Agent 系统提示词
const AGENT_SYSTEM_PROMPT = `你是一个智能无人机工作流助手，可以帮助用户管理和执行无人机任务。

你可以使用以下工具来完成任务：

${getToolDescriptions()}

## 使用工具的格式：
当你需要使用工具时，请使用以下 JSON 格式：
\`\`\`tool
{
  "tool": "工具名称",
  "params": { 参数对象 }
}
\`\`\`

## 注意事项：
1. 仔细分析用户的问题，决定是否需要使用工具
2. 如果需要使用工具，先调用工具获取信息，再基于结果回答用户
3. 如果不需要工具，直接回答用户的问题
4. 回答要简洁明了，使用中文
`;

interface ToolCall {
  tool: string;
  params: Record<string, any>;
}

// 解析 LLM 响应中的工具调用
function parseToolCalls(content: string): ToolCall[] {
  const toolCalls: ToolCall[] = [];
  const toolBlockRegex = /```tool\s*([\s\S]*?)```/g;
  
  let match;
  while ((match = toolBlockRegex.exec(content)) !== null) {
    try {
      const parsed = JSON.parse(match[1].trim());
      if (parsed.tool && typeof parsed.tool === "string") {
        toolCalls.push({
          tool: parsed.tool,
          params: parsed.params || {}
        });
      }
    } catch (e) {
      console.warn("Failed to parse tool call:", match[1]);
    }
  }
  
  return toolCalls;
}

// 执行工具调用
async function executeToolCalls(toolCalls: ToolCall[]): Promise<string> {
  const results: string[] = [];
  
  for (const call of toolCalls) {
    const tool = getToolByName(call.tool);
    if (!tool) {
      results.push(`工具 "${call.tool}" 不存在`);
      continue;
    }
    
    try {
      // 验证参数
      const validatedParams = tool.parameters.parse(call.params);
      const result = await tool.execute(validatedParams);
      results.push(`[${call.tool}] 执行结果:\n${JSON.stringify(result, null, 2)}`);
    } catch (error: any) {
      results.push(`[${call.tool}] 执行失败: ${error.message}`);
    }
  }
  
  return results.join("\n\n");
}

export interface AgentResponse {
  content: string;
  toolResults?: string;
  workflow?: any;
}

// Agent 对话处理
export async function runAgent(
  userMessage: string,
  conversationHistory: Array<{ role: "user" | "assistant"; content: string }> = []
): Promise<AgentResponse> {
  if (!isLLMConfigured()) {
    return {
      content: "LLM 未配置，无法使用 Agent 功能。请配置 DEEPSEEK_API_KEY。"
    };
  }

  const llm = getLLM();
  
  // 构建消息历史
  const messages: Array<SystemMessage | HumanMessage | AIMessage> = [
    new SystemMessage(AGENT_SYSTEM_PROMPT)
  ];
  
  for (const msg of conversationHistory) {
    if (msg.role === "user") {
      messages.push(new HumanMessage(msg.content));
    } else {
      messages.push(new AIMessage(msg.content));
    }
  }
  
  messages.push(new HumanMessage(userMessage));
  
  // 第一次 LLM 调用
  const response = await llm.invoke(messages);
  const content = typeof response.content === "string" ? response.content : JSON.stringify(response.content);
  
  // 检查是否有工具调用
  const toolCalls = parseToolCalls(content);
  
  if (toolCalls.length === 0) {
    return { content };
  }
  
  // 执行工具调用
  const toolResults = await executeToolCalls(toolCalls);
  
  // 第二次 LLM 调用，基于工具结果生成最终回答
  messages.push(new AIMessage(content));
  messages.push(new HumanMessage(`工具执行结果:\n${toolResults}\n\n请基于以上结果回答用户的问题。`));
  
  const finalResponse = await llm.invoke(messages);
  const finalContent = typeof finalResponse.content === "string" 
    ? finalResponse.content 
    : JSON.stringify(finalResponse.content);
  
  return {
    content: finalContent,
    toolResults
  };
}

// 获取可用工具列表
export function getAvailableTools() {
  return allTools.map(t => ({
    name: t.name,
    description: t.description
  }));
}
