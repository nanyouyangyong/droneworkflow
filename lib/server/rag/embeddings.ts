import { OpenAIEmbeddings } from "@langchain/openai";

let embeddingsInstance: OpenAIEmbeddings | null = null;

function normalizeEnvValue(v: string | undefined | null): string {
  if (!v) return "";
  return String(v).trim().replace(/^['"]|['"]$/g, "");
}

export function getEmbeddings(): OpenAIEmbeddings {
  if (embeddingsInstance) return embeddingsInstance;

  const apiKey = normalizeEnvValue(process.env.DEEPSEEK_API_KEY);
  const baseURL = normalizeEnvValue(process.env.DEEPSEEK_BASE_URL) || "https://api.deepseek.com";

  if (!apiKey) {
    throw new Error("DEEPSEEK_API_KEY is not configured for embeddings.");
  }

  embeddingsInstance = new OpenAIEmbeddings({
    openAIApiKey: apiKey,
    configuration: {
      baseURL: baseURL
    },
    modelName: "text-embedding-ada-002",
    maxRetries: 2,
    timeout: 15000
  });

  return embeddingsInstance;
}

export function isEmbeddingsConfigured(): boolean {
  return normalizeEnvValue(process.env.DEEPSEEK_API_KEY).length > 0;
}

export function resetEmbeddings(): void {
  embeddingsInstance = null;
}
