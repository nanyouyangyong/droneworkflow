import { NextResponse } from "next/server";
import { getToolByName } from "@/lib/server/mcp/tools";

export const runtime = "nodejs";

// 执行单个工具
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { tool: toolName, params } = body;

    if (!toolName) {
      return NextResponse.json({ error: "tool name is required" }, { status: 400 });
    }

    const tool = getToolByName(toolName);
    if (!tool) {
      return NextResponse.json({ error: `Tool "${toolName}" not found` }, { status: 404 });
    }

    // 验证并执行
    const validatedParams = tool.parameters.parse(params || {});
    const result = await tool.execute(validatedParams);

    return NextResponse.json({ result });
  } catch (error: any) {
    console.error("Tool execution failed:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
