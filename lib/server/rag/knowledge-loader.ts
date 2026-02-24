import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import { Document } from "@langchain/core/documents";
import { KnowledgeDoc } from "@/lib/server/models/KnowledgeDoc";
import { connectDB } from "@/lib/server/db";
import { addDocuments } from "./vector-store";
import fs from "fs";
import path from "path";

const textSplitter = new RecursiveCharacterTextSplitter({
  chunkSize: 800,
  chunkOverlap: 100,
  separators: ["\n## ", "\n### ", "\n#### ", "\n\n", "\n", " "]
});

export async function loadKnowledgeFromDB(): Promise<Document[]> {
  await connectDB();
  const docs = await KnowledgeDoc.find({}).lean();

  if (docs.length === 0) {
    console.log("[RAG] No knowledge documents in DB.");
    return [];
  }

  const allChunks: Document[] = [];

  for (const doc of docs) {
    const chunks = await textSplitter.createDocuments(
      [doc.content],
      [
        {
          source: "knowledge_db",
          docId: doc._id?.toString(),
          title: doc.title,
          category: doc.category,
          tags: doc.tags || []
        }
      ]
    );
    allChunks.push(...chunks);
  }

  console.log(`[RAG] Loaded ${allChunks.length} chunks from ${docs.length} knowledge docs.`);
  return allChunks;
}

export async function loadKnowledgeFromFiles(dirPath: string): Promise<Document[]> {
  if (!fs.existsSync(dirPath)) {
    console.warn(`[RAG] Knowledge directory not found: ${dirPath}`);
    return [];
  }

  const files = fs.readdirSync(dirPath).filter(f => f.endsWith(".md"));
  const allChunks: Document[] = [];

  for (const file of files) {
    const filePath = path.join(dirPath, file);
    const content = fs.readFileSync(filePath, "utf-8");
    const title = file.replace(/\.md$/, "");

    const chunks = await textSplitter.createDocuments(
      [content],
      [
        {
          source: "knowledge_file",
          filePath: filePath,
          title: title,
          category: inferCategory(title)
        }
      ]
    );
    allChunks.push(...chunks);
  }

  console.log(`[RAG] Loaded ${allChunks.length} chunks from ${files.length} knowledge files.`);
  return allChunks;
}

function inferCategory(title: string): string {
  if (title.includes("regulation") || title.includes("flight")) return "regulation";
  if (title.includes("operation") || title.includes("drone")) return "operation";
  if (title.includes("template") || title.includes("workflow")) return "template";
  if (title.includes("param") || title.includes("node") || title.includes("guide")) return "param_guide";
  return "operation";
}

export async function initializeKnowledgeBase(knowledgeDir?: string): Promise<number> {
  const dir = knowledgeDir || path.resolve(process.cwd(), "data", "knowledge");

  // 优先从 DB 加载，如果 DB 为空则从文件加载
  let chunks = await loadKnowledgeFromDB();

  if (chunks.length === 0) {
    chunks = await loadKnowledgeFromFiles(dir);
  }

  if (chunks.length === 0) {
    console.warn("[RAG] No knowledge documents found. RAG will be disabled.");
    return 0;
  }

  await addDocuments(chunks);
  console.log(`[RAG] Knowledge base initialized with ${chunks.length} chunks.`);
  return chunks.length;
}
