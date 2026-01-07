import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/server/db";
import { Workflow } from "@/lib/server/models";

export async function POST(req: NextRequest) {
  try {
    await connectDB();

    const body = await req.json();
    const { workflow_name, nodes, edges, workflowId } = body;

    if (!workflow_name || !nodes || !edges) {
      return NextResponse.json(
        { error: "Missing required fields: workflow_name, nodes, edges" },
        { status: 400 }
      );
    }

    let savedWorkflow;

    if (workflowId) {
      // 更新现有工作流
      savedWorkflow = await Workflow.findByIdAndUpdate(
        workflowId,
        { name: workflow_name, nodes, edges },
        { new: true }
      );

      if (!savedWorkflow) {
        return NextResponse.json(
          { error: "Workflow not found" },
          { status: 404 }
        );
      }
    } else {
      // 创建新工作流
      savedWorkflow = await Workflow.create({
        name: workflow_name,
        nodes,
        edges
      });
    }

    return NextResponse.json({
      success: true,
      workflow: {
        id: savedWorkflow._id.toString(),
        name: savedWorkflow.name,
        nodes: savedWorkflow.nodes,
        edges: savedWorkflow.edges,
        createdAt: savedWorkflow.createdAt,
        updatedAt: savedWorkflow.updatedAt
      }
    });
  } catch (error: any) {
    console.error("Failed to save workflow:", error);
    return NextResponse.json(
      { error: error.message || "Failed to save workflow" },
      { status: 500 }
    );
  }
}
