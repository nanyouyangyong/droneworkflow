import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/server/db";
import { Mission } from "@/lib/server/models";

export async function GET(req: NextRequest) {
  try {
    await connectDB();

    const { searchParams } = new URL(req.url);
    const limit = parseInt(searchParams.get("limit") || "20", 10);
    const skip = parseInt(searchParams.get("skip") || "0", 10);
    const status = searchParams.get("status");

    const query: Record<string, unknown> = {};
    if (status) {
      query.status = status;
    }

    const missions = await Mission.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const total = await Mission.countDocuments(query);

    return NextResponse.json({
      missions: missions.map((m: any) => ({
        id: m._id.toString(),
        missionId: m.missionId,
        workflowName: m.workflowSnapshot?.name,
        status: m.status,
        progress: m.progress,
        nodeCount: m.workflowSnapshot?.nodes?.length || 0,
        logCount: m.logs?.length || 0,
        startedAt: m.startedAt,
        completedAt: m.completedAt,
        createdAt: m.createdAt
      })),
      total,
      limit,
      skip
    });
  } catch (error: any) {
    console.error("Failed to list missions:", error);
    return NextResponse.json(
      { error: error.message || "Failed to list missions" },
      { status: 500 }
    );
  }
}
