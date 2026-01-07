import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/server/db";
import { Mission } from "@/lib/server/models";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await connectDB();

    const { id } = await params;

    // 支持通过 _id 或 missionId 查询
    let mission = await Mission.findById(id).lean();
    if (!mission) {
      mission = await Mission.findOne({ missionId: id }).lean();
    }

    if (!mission) {
      return NextResponse.json(
        { error: "Mission not found" },
        { status: 404 }
      );
    }

    const m = mission as any;

    return NextResponse.json({
      mission: {
        id: m._id.toString(),
        missionId: m.missionId,
        workflowSnapshot: m.workflowSnapshot,
        status: m.status,
        progress: m.progress,
        currentNode: m.currentNode,
        logs: m.logs,
        startedAt: m.startedAt,
        completedAt: m.completedAt,
        createdAt: m.createdAt,
        updatedAt: m.updatedAt
      }
    });
  } catch (error: any) {
    console.error("Failed to get mission:", error);
    return NextResponse.json(
      { error: error.message || "Failed to get mission" },
      { status: 500 }
    );
  }
}
