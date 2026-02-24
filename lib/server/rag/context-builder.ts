import { Document } from "@langchain/core/documents";
import { similaritySearch, isVectorStoreReady } from "./vector-store";
import { findSimilarWorkflows, type RetrievedWorkflow } from "./workflow-retriever";

const RAG_TIMEOUT_MS = 3000;

export async function buildRAGContext(userInput: string): Promise<string> {
  const sections: string[] = [];

  try {
    const results = await Promise.race([
      Promise.allSettled([
        retrieveKnowledge(userInput),
        findSimilarWorkflows(userInput, 2)
      ]),
      new Promise<PromiseSettledResult<any>[]>((_, reject) =>
        setTimeout(() => reject(new Error("RAG timeout")), RAG_TIMEOUT_MS)
      )
    ]);

    const [knowledgeResult, workflowResult] = results;

    // 知识库文档
    if (knowledgeResult.status === "fulfilled" && knowledgeResult.value.length > 0) {
      sections.push(formatKnowledgeDocs(knowledgeResult.value));
    }

    // 历史工作流
    if (workflowResult.status === "fulfilled" && workflowResult.value.length > 0) {
      sections.push(formatWorkflowExamples(workflowResult.value));
    }
  } catch (err: any) {
    if (err.message === "RAG timeout") {
      console.warn("[RAG] Context retrieval timed out, skipping RAG.");
    } else {
      console.warn("[RAG] Context retrieval failed:", err);
    }
  }

  if (sections.length === 0) return "";

  return sections.join("\n\n");
}

async function retrieveKnowledge(query: string): Promise<Document[]> {
  if (!isVectorStoreReady()) return [];
  return await similaritySearch(query, 3);
}

function formatKnowledgeDocs(docs: Document[]): string {
  const lines = docs.map((doc, i) => {
    const title = doc.metadata?.title || `文档${i + 1}`;
    const category = doc.metadata?.category || "unknown";
    return `### ${title}（${categoryLabel(category)}）\n${doc.pageContent}`;
  });

  return `## 相关领域知识\n${lines.join("\n\n")}`;
}

function formatWorkflowExamples(workflows: RetrievedWorkflow[]): string {
  const lines = workflows.map((wf, i) => {
    let text = `### 参考工作流 ${i + 1}: ${wf.name}`;
    if (wf.description) text += `\n描述: ${wf.description}`;
    text += `\n节点类型: ${wf.nodeTypes.join(", ")}`;
    text += `\n结构: ${wf.structure}`;
    return text;
  });

  return `## 相似历史工作流\n以下是之前成功执行过的类似工作流，可作为参考：\n${lines.join("\n\n")}`;
}

function categoryLabel(category: string): string {
  const labels: Record<string, string> = {
    regulation: "飞行法规",
    operation: "操作规范",
    template: "工作流模板",
    param_guide: "参数指南"
  };
  return labels[category] || category;
}
