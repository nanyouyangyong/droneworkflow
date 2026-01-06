import { NextResponse } from "next/server";
import { z } from "zod";
import { v4 as uuidv4 } from "uuid";
import type { Server as SocketIOServer } from "socket.io";
import type { ParsedWorkflow } from "@/lib/types";
import { startExecution } from "@/lib/server/executeGraph";

export const runtime = "nodejs";

const schema = z.object({
  workflow: z.any()
});

export async function POST(req: Request) {
  try {
    const body = await req.json(); 
    const parsed = schema.parse(body);
    const workflow = parsed.workflow as ParsedWorkflow;

    const missionId = uuidv4();
    const io = (globalThis as any).__io as SocketIOServer | undefined;

    const state = await startExecution(missionId, workflow, io);

    return NextResponse.json({ missionId, state });
  } catch (e: any) {
    return new NextResponse(e?.message ?? "Bad Request", { status: 400 });
  }
}
