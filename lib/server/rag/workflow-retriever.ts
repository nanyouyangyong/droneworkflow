import { Workflow } from "@/lib/server/models/Workflow";
import { Mission } from "@/lib/server/models/Mission";
import { connectDB } from "@/lib/server/db";

export interface RetrievedWorkflow {
  name: string;
  description: string;
  nodeTypes: string[];
  nodeCount: number;
  structure: string;
}

export async function findSimilarWorkflows(
  userInput: string,
  limit: number = 2
): Promise<RetrievedWorkflow[]> {
  try {
    await connectDB();

    // 获取成功执行过的任务关联的工作流 ID
    const completedMissions = await Mission.find(
      { status: "completed" },
      { workflowId: 1 }
    )
      .sort({ completedAt: -1 })
      .limit(20)
      .lean();

    const completedWorkflowIds = completedMissions
      .map(m => m.workflowId)
      .filter(Boolean);

    // 构建查询条件：优先匹配成功执行过的工作流，同时用关键词匹配
    const keywords = extractKeywords(userInput);
    const query: Record<string, unknown> = {};

    if (keywords.length > 0) {
      query.$or = [
        { name: { $regex: keywords.join("|"), $options: "i" } },
        { description: { $regex: keywords.join("|"), $options: "i" } }
      ];
    }

    // 优先查询成功执行过的工作流
    let workflows;
    if (completedWorkflowIds.length > 0 && keywords.length > 0) {
      workflows = await Workflow.find({
        _id: { $in: completedWorkflowIds },
        ...query
      })
        .sort({ updatedAt: -1 })
        .limit(limit)
        .lean();

      // 如果成功执行的工作流中没有匹配的，回退到全量搜索
      if (workflows.length === 0) {
        workflows = await Workflow.find(query)
          .sort({ updatedAt: -1 })
          .limit(limit)
          .lean();
      }
    } else if (keywords.length > 0) {
      workflows = await Workflow.find(query)
        .sort({ updatedAt: -1 })
        .limit(limit)
        .lean();
    } else {
      // 无关键词时返回最近的工作流
      workflows = await Workflow.find({})
        .sort({ updatedAt: -1 })
        .limit(limit)
        .lean();
    }

    return workflows.map(wf => ({
      name: wf.name,
      description: wf.description || "",
      nodeTypes: (wf.nodes || []).map((n: any) => n.type),
      nodeCount: (wf.nodes || []).length,
      structure: summarizeWorkflowStructure(wf)
    }));
  } catch (err) {
    console.warn("[RAG] Failed to retrieve similar workflows:", err);
    return [];
  }
}

function extractKeywords(input: string): string[] {
  const domainKeywords = [
    "巡检", "巡查", "搜救", "植保", "农业", "测绘", "航拍",
    "光伏", "电力", "桥梁", "基站", "风电", "管道",
    "起飞", "降落", "拍照", "录像", "返航", "悬停",
    "并行", "多机", "多架", "电量", "天气",
    "区域", "航线", "航点"
  ];

  return domainKeywords.filter(kw => input.includes(kw));
}

function summarizeWorkflowStructure(wf: any): string {
  const nodes = wf.nodes || [];
  const edges = wf.edges || [];

  const nodeLabels = nodes.map((n: any) => n.label || n.type).join(" → ");
  const hasParallel = nodes.some((n: any) => n.type === "parallel_fork");
  const hasCondition = nodes.some((n: any) => n.type === "条件判断");

  let summary = `${wf.name}（${nodes.length}节点, ${edges.length}边）`;
  if (hasParallel) summary += " [含并行分支]";
  if (hasCondition) summary += " [含条件判断]";
  summary += `\n流程: ${nodeLabels}`;

  return summary;
}
