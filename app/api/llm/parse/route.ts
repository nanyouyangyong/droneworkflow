import { NextResponse } from "next/server";
import { parseInstruction } from "@/lib/server/llmParse";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const workflow = await parseInstruction(body);
    return NextResponse.json({ workflow });
  } catch (e: any) {
    return new NextResponse(e?.message ?? "Bad Request", { status: 400 });
  }
}
