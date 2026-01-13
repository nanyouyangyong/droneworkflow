import { NextResponse } from "next/server";
import { connectDB } from "@/lib/server/db";
import { ChatHistory } from "@/lib/server/models/ChatHistory";

export const runtime = "nodejs";

// 获取所有会话列表
export async function GET() {
  try {
    await connectDB();
    
    const sessions = await ChatHistory.find({})
      .select("sessionId createdAt updatedAt")
      .sort({ updatedAt: -1 })
      .limit(50)
      .lean();
    
    return NextResponse.json({ sessions });
  } catch (error: any) {
    console.error("Failed to get chat sessions:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
