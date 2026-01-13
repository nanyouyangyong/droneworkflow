import { NextResponse } from "next/server";
import { getAvailableTools } from "@/lib/server/mcp/agent";

export const runtime = "nodejs";

// 获取可用工具列表
export async function GET() {
  try {
    const tools = getAvailableTools();
    return NextResponse.json({ tools });
  } catch (error: any) {
    console.error("Failed to get tools:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
