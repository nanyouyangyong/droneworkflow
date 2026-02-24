import { MemoryVectorStore } from "langchain/vectorstores/memory";
import { Document } from "@langchain/core/documents";
import { getEmbeddings, isEmbeddingsConfigured } from "./embeddings";

let vectorStoreInstance: MemoryVectorStore | null = null;
let isInitialized = false;

export async function getVectorStore(): Promise<MemoryVectorStore> {
  if (vectorStoreInstance && isInitialized) return vectorStoreInstance;

  if (!isEmbeddingsConfigured()) {
    throw new Error("Embeddings not configured, cannot create vector store.");
  }

  const embeddings = getEmbeddings();
  vectorStoreInstance = new MemoryVectorStore(embeddings);
  isInitialized = true;

  return vectorStoreInstance;
}

export async function addDocuments(docs: Document[]): Promise<void> {
  const store = await getVectorStore();
  await store.addDocuments(docs);
}

export async function similaritySearch(
  query: string,
  k: number = 3
): Promise<Document[]> {
  if (!isInitialized || !vectorStoreInstance) {
    return [];
  }

  try {
    return await vectorStoreInstance.similaritySearch(query, k);
  } catch (err) {
    console.warn("Vector similarity search failed:", err);
    return [];
  }
}

export function isVectorStoreReady(): boolean {
  return isInitialized && vectorStoreInstance !== null;
}

export function resetVectorStore(): void {
  vectorStoreInstance = null;
  isInitialized = false;
}
