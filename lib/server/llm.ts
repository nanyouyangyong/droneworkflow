import { ChatOpenAI } from "@langchain/openai";

let llmInstance: ChatOpenAI | null = null;
let fastLLMInstance: ChatOpenAI | null = null;

function normalizeEnvValue(v: string | undefined | null): string {
  if (!v) return "";
  const trimmed = String(v).trim();
  return trimmed.replace(/^['"]|['"]$/g, "");
}

// 标准 LLM 实例（用于复杂任务）
export function getLLM(): ChatOpenAI {
  if (llmInstance) return llmInstance;

  const apiKey = normalizeEnvValue(process.env.DEEPSEEK_API_KEY);
  const baseURL = normalizeEnvValue(process.env.DEEPSEEK_BASE_URL) || "https://api.deepseek.com";

  if (!apiKey) {
    throw new Error("DEEPSEEK_API_KEY is not configured. Please set it in your .env file.");
  }

  llmInstance = new ChatOpenAI({
    modelName: "deepseek-chat",
    openAIApiKey: apiKey,
    configuration: {
      baseURL: baseURL
    },
    temperature: 0.1,
    maxTokens: 4096,
    timeout: 60000,
    maxRetries: 2
  });

  return llmInstance;
}

// 快速 LLM 实例（用于简单任务，更低的 token 限制）
export function getFastLLM(): ChatOpenAI {
  if (fastLLMInstance) return fastLLMInstance;

  const apiKey = normalizeEnvValue(process.env.DEEPSEEK_API_KEY);
  const baseURL = normalizeEnvValue(process.env.DEEPSEEK_BASE_URL) || "https://api.deepseek.com";

  if (!apiKey) {
    throw new Error("DEEPSEEK_API_KEY is not configured. Please set it in your .env file.");
  }

  fastLLMInstance = new ChatOpenAI({
    modelName: "deepseek-chat",
    openAIApiKey: apiKey,
    configuration: {
      baseURL: baseURL
    },
    temperature: 0,
    maxTokens: 2048,
    timeout: 30000,
    maxRetries: 1
  });

  return fastLLMInstance;
}

export function isLLMConfigured(): boolean {
  return normalizeEnvValue(process.env.DEEPSEEK_API_KEY).length > 0;
}

// 重置 LLM 实例（用于配置变更后）
export function resetLLMInstances(): void {
  llmInstance = null;
  fastLLMInstance = null;
}
