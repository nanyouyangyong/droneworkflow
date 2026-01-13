import { NextResponse } from "next/server";
import { connectDB } from "@/lib/server/db";
import { ChatHistory, type IChatHistory } from "@/lib/server/models/ChatHistory";

export const runtime = "nodejs";

// 获取聊天历史
export async function GET(req: Request) {
  try {
    await connectDB();
    
    const { searchParams } = new URL(req.url);
    const sessionId = searchParams.get("sessionId");
    
    if (!sessionId) {
      return NextResponse.json({ error: "sessionId is required" }, { status: 400 });
    }
    
    const history = await ChatHistory.findOne({ sessionId }).lean() as IChatHistory | null;
    
    return NextResponse.json({
      sessionId,
      messages: history?.messages || [],
      workflowId: history?.workflowId || null
    });
  } catch (error: any) {
    console.error("Failed to get chat history:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// 保存聊天消息
export async function POST(req: Request) {
  try {
    await connectDB();
    
    const body = await req.json();
    const { sessionId, message, workflowId } = body;
    
    if (!sessionId || !message) {
      return NextResponse.json({ error: "sessionId and message are required" }, { status: 400 });
    }
    
    const result = await ChatHistory.findOneAndUpdate(
      { sessionId },
      {
        $push: { messages: message },
        $set: workflowId ? { workflowId } : {},
        $setOnInsert: { sessionId }
      },
      { upsert: true, new: true }
    ) as IChatHistory | null;
    
    return NextResponse.json({ success: true, messageCount: result?.messages?.length || 0 });
  } catch (error: any) {
    console.error("Failed to save chat message:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
