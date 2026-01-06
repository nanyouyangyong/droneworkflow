import { NextResponse } from "next/server";
import { z } from "zod";
import { getMission } from "@/lib/server/missionStore";

export const runtime = "nodejs";

const querySchema = z.object({
  missionId: z.string().min(1)
});

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const { missionId } = querySchema.parse({ missionId: searchParams.get("missionId") });

    const rec = getMission(missionId);
    if (!rec) return new NextResponse("Not Found", { status: 404 });

    return NextResponse.json({ state: rec.state });
  } catch (e: any) {
    return new NextResponse(e?.message ?? "Bad Request", { status: 400 });
  }
}
