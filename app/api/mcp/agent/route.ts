import { NextResponse } from "next/server";
import { runLangGraphAgent, getAvailableTools } from "@/lib/server/mcp/langgraph-agent";

export const runtime = "nodejs";

// Agent 对话接口
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { message, history } = body;

    if (!message) {
      return NextResponse.json({ error: "message is required" }, { status: 400 });
    }

    const result = await runLangGraphAgent(message, history || []);

    return NextResponse.json(result);
  } catch (error: any) {
    console.error("Agent execution failed:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
