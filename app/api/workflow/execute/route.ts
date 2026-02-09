import { NextResponse } from "next/server";
import { z } from "zod";
import { v4 as uuidv4 } from "uuid";
import type { ParsedWorkflow, TaskRequest } from "@/lib/types";
import { startExecution, startMultiDroneExecution } from "@/lib/server/executeGraph";

export const runtime = "nodejs";

// 单机格式（向后兼容）
const singleSchema = z.object({
  workflow: z.any(),
  droneId: z.string().optional(),
});

// 多机格式
const multiSchema = z.object({
  name: z.string().optional(),
  drones: z.array(z.object({
    droneId: z.string(),
    workflow: z.any(),
  })).min(1),
  strategy: z.enum(["parallel", "sequential"]).optional(),
  failurePolicy: z.enum(["fail_fast", "continue"]).optional(),
});

/**
 * 从包含 parallel_fork/parallel_join 的工作流中，按 droneId 拆分出独立子工作流
 * 每条并行分支变成一个独立的 { droneId, workflow }
 */
function splitParallelWorkflow(
  wf: ParsedWorkflow
): Array<{ droneId: string; workflow: ParsedWorkflow }> {
  const forkNode = wf.nodes.find((n) => n.type === "parallel_fork");
  const joinNode = wf.nodes.find((n) => n.type === "parallel_join");
  if (!forkNode || !joinNode) return [];

  // 构建邻接表
  const childrenOf = new Map<string, string[]>();
  for (const e of wf.edges) {
    childrenOf.set(e.from, [...(childrenOf.get(e.from) || []), e.to]);
  }

  const nodeMap = new Map(wf.nodes.map((n) => [n.id, n]));
  const forkChildren = childrenOf.get(forkNode.id) || [];

  const result: Array<{ droneId: string; workflow: ParsedWorkflow }> = [];

  for (const firstChild of forkChildren) {
    // 收集这条分支上的所有节点
    const branchNodes: ParsedWorkflow["nodes"] = [];
    let cur: string | undefined = firstChild;
    while (cur && cur !== joinNode.id) {
      const node = nodeMap.get(cur);
      if (node) branchNodes.push(node);
      const next: string[] = childrenOf.get(cur) || [];
      cur = next[0];
    }

    if (branchNodes.length === 0) continue;

    // 从分支节点的 params 中提取 droneId
    const droneId =
      (branchNodes[0].params?.droneId as string) ||
      `drone-${String(result.length + 1).padStart(3, "0")}`;

    // 构建子工作流：start → 分支节点... → end
    const startNode = { id: `start_${droneId}`, type: "start" as const, label: "开始" };
    const endNode = { id: `end_${droneId}`, type: "end" as const, label: "结束" };

    const subNodes = [startNode, ...branchNodes, endNode];
    const subEdges: ParsedWorkflow["edges"] = [
      { id: `e_start_${droneId}`, from: startNode.id, to: branchNodes[0].id, condition: null },
    ];

    // 连接分支内部节点
    for (let i = 0; i < branchNodes.length - 1; i++) {
      subEdges.push({
        id: `e_${droneId}_${i}`,
        from: branchNodes[i].id,
        to: branchNodes[i + 1].id,
        condition: null,
      });
    }

    subEdges.push({
      id: `e_end_${droneId}`,
      from: branchNodes[branchNodes.length - 1].id,
      to: endNode.id,
      condition: null,
    });

    result.push({
      droneId,
      workflow: {
        workflow_name: `${wf.workflow_name} - ${droneId}`,
        nodes: subNodes,
        edges: subEdges,
      },
    });
  }

  return result;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const missionId = uuidv4();

    // 多机格式：{ drones: [...] }
    if (body.drones && Array.isArray(body.drones)) {
      const parsed = multiSchema.parse(body);
      const request: TaskRequest = {
        missionId,
        name: parsed.name || `多机任务_${new Date().toLocaleString("zh-CN")}`,
        drones: parsed.drones.map((d) => ({
          droneId: d.droneId,
          workflow: d.workflow as ParsedWorkflow,
        })),
        strategy: parsed.strategy,
        failurePolicy: parsed.failurePolicy,
      };
      const state = await startMultiDroneExecution(request);
      return NextResponse.json({ missionId, state });
    }

    // 单机格式（向后兼容）：{ workflow, droneId? }
    const parsed = singleSchema.parse(body);
    const workflow = parsed.workflow as ParsedWorkflow;

    // 检测并行工作流结构：如果包含 parallel_fork，自动拆分为多机任务
    const forkNode = workflow.nodes.find((n) => n.type === "parallel_fork");
    if (forkNode) {
      const splitResult = splitParallelWorkflow(workflow);
      if (splitResult.length > 1) {
        const request: TaskRequest = {
          missionId,
          name: workflow.workflow_name || `多机并行任务_${new Date().toLocaleString("zh-CN")}`,
          drones: splitResult,
          strategy: "parallel",
          failurePolicy: "continue",
        };
        const state = await startMultiDroneExecution(request);
        return NextResponse.json({ missionId, state });
      }
    }

    // 普通单机执行
    const io = (globalThis as any).__io;
    const state = await startExecution(missionId, workflow, io, parsed.droneId);

    return NextResponse.json({ missionId, state });
  } catch (e: any) {
    return new NextResponse(e?.message ?? "Bad Request", { status: 400 });
  }
}
