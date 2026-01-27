import { NextResponse } from "next/server";
import { mcpManager, getMCPStatus, listAllMCPTools } from "@/lib/server/mcp";

export const runtime = "nodejs";

// 获取 MCP 服务状态
export async function GET() {
  try {
    const status = getMCPStatus();
    const tools = await listAllMCPTools();
    
    return NextResponse.json({
      status,
      tools: tools.map(t => ({
        server: t.serverName,
        name: t.name,
        fullName: t.fullName,
        description: t.description
      })),
      totalTools: tools.length
    });
  } catch (error: any) {
    console.error("Failed to get MCP status:", error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
