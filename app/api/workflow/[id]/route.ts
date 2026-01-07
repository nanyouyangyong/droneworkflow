import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/server/db";
import { Workflow } from "@/lib/server/models";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await connectDB();

    const { id } = await params;
    const workflow = await Workflow.findById(id).lean();

    if (!workflow) {
      return NextResponse.json(
        { error: "Workflow not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      workflow: {
        id: (workflow as any)._id.toString(),
        workflow_name: (workflow as any).name,
        nodes: (workflow as any).nodes,
        edges: (workflow as any).edges,
        createdAt: (workflow as any).createdAt,
        updatedAt: (workflow as any).updatedAt
      }
    });
  } catch (error: any) {
    console.error("Failed to get workflow:", error);
    return NextResponse.json(
      { error: error.message || "Failed to get workflow" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await connectDB();

    const { id } = await params;
    const result = await Workflow.findByIdAndDelete(id);

    if (!result) {
      return NextResponse.json(
        { error: "Workflow not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Failed to delete workflow:", error);
    return NextResponse.json(
      { error: error.message || "Failed to delete workflow" },
      { status: 500 }
    );
  }
}
