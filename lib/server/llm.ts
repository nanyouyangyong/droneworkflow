import { ChatOpenAI } from "@langchain/openai";

let llmInstance: ChatOpenAI | null = null;

function normalizeEnvValue(v: string | undefined | null): string {
  if (!v) return "";
  const trimmed = String(v).trim();
  return trimmed.replace(/^['"]|['"]$/g, "");
}

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
    maxTokens: 4096
  });

  return llmInstance;
}

export function isLLMConfigured(): boolean {
  return normalizeEnvValue(process.env.DEEPSEEK_API_KEY).length > 0;
}
