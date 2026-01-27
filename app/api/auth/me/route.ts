import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/server/db";
import { User } from "@/lib/server/models/User";
import { withAuth } from "@/lib/server/middleware/auth";
import { createErrorResponse, NotFoundError } from "@/lib/server/middleware/error";
import type { JWTPayload } from "@/lib/server/auth/jwt";

interface MeResponse {
  success: true;
  data: {
    id: string;
    email: string;
    name: string;
    avatar?: string;
    role: string;
    createdAt: string;
  };
}

async function handler(
  _request: NextRequest,
  user: JWTPayload
): Promise<NextResponse<MeResponse>> {
  try {
    await connectDB();

    const dbUser = await User.findById(user.userId);

    if (!dbUser) {
      throw new NotFoundError("用户不存在");
    }

    return NextResponse.json({
      success: true,
      data: {
        id: dbUser._id.toString(),
        email: dbUser.email,
        name: dbUser.name,
        avatar: dbUser.avatar,
        role: dbUser.role,
        createdAt: dbUser.createdAt.toISOString(),
      },
    });
  } catch (error) {
    return createErrorResponse(error) as unknown as NextResponse<MeResponse>;
  }
}

export const GET = withAuth(handler);
