import { NextRequest, NextResponse } from "next/server";
import { refreshAccessToken } from "@/lib/server/auth/jwt";
import { createErrorResponse, ValidationError, AuthenticationError } from "@/lib/server/middleware/error";

interface RefreshRequest {
  refreshToken: string;
}

interface RefreshResponse {
  success: true;
  data: {
    accessToken: string;
    refreshToken: string;
    expiresIn: number;
  };
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as RefreshRequest;
    const { refreshToken } = body;

    if (!refreshToken) {
      throw new ValidationError("Refresh Token 不能为空");
    }

    const tokens = refreshAccessToken(refreshToken);

    if (!tokens) {
      throw new AuthenticationError("Refresh Token 无效或已过期");
    }

    const response: RefreshResponse = {
      success: true,
      data: tokens,
    };

    return NextResponse.json(response);
  } catch (error) {
    return createErrorResponse(error);
  }
}
