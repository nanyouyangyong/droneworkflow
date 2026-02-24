import { isEmbeddingsConfigured } from "./embeddings";
import { isVectorStoreReady } from "./vector-store";
import { initializeKnowledgeBase } from "./knowledge-loader";
import { buildRAGContext } from "./context-builder";

let ragInitialized = false;
let ragEnabled = false;

export async function initRAG(): Promise<boolean> {
  if (ragInitialized) return ragEnabled;

  if (!isEmbeddingsConfigured()) {
    console.log("[RAG] Embeddings not configured, RAG disabled.");
    ragInitialized = true;
    ragEnabled = false;
    return false;
  }

  try {
    const chunkCount = await initializeKnowledgeBase();
    ragEnabled = chunkCount > 0;
    ragInitialized = true;
    console.log(`[RAG] Initialization ${ragEnabled ? "succeeded" : "skipped"} (${chunkCount} chunks).`);
    return ragEnabled;
  } catch (err) {
    console.warn("[RAG] Initialization failed, RAG disabled:", err);
    ragInitialized = true;
    ragEnabled = false;
    return false;
  }
}

export async function retrieveContext(userInput: string): Promise<string> {
  if (!ragEnabled || !isVectorStoreReady()) return "";

  try {
    return await buildRAGContext(userInput);
  } catch (err) {
    console.warn("[RAG] Context retrieval failed:", err);
    return "";
  }
}

export function isRAGEnabled(): boolean {
  return ragEnabled;
}

export function resetRAG(): void {
  ragInitialized = false;
  ragEnabled = false;
}

export { buildRAGContext } from "./context-builder";
export { initializeKnowledgeBase } from "./knowledge-loader";
export { findSimilarWorkflows } from "./workflow-retriever";
export { getEmbeddings, isEmbeddingsConfigured } from "./embeddings";
export { similaritySearch, addDocuments, resetVectorStore } from "./vector-store";
