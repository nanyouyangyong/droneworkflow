import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/server/db";
import { Workflow } from "@/lib/server/models";

export async function GET(req: NextRequest) {
  try {
    await connectDB();

    const { searchParams } = new URL(req.url);
    const limit = parseInt(searchParams.get("limit") || "20", 10);
    const skip = parseInt(searchParams.get("skip") || "0", 10);

    const workflows = await Workflow.find()
      .sort({ updatedAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const total = await Workflow.countDocuments();

    return NextResponse.json({
      workflows: workflows.map((w: any) => ({
        id: w._id.toString(),
        name: w.name,
        description: w.description,
        nodeCount: w.nodes?.length || 0,
        edgeCount: w.edges?.length || 0,
        createdAt: w.createdAt,
        updatedAt: w.updatedAt
      })),
      total,
      limit,
      skip
    });
  } catch (error: any) {
    console.error("Failed to list workflows:", error);
    return NextResponse.json(
      { error: error.message || "Failed to list workflows" },
      { status: 500 }
    );
  }
}
