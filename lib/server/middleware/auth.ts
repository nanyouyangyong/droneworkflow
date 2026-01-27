import { NextRequest, NextResponse } from "next/server";
import { verifyToken, extractTokenFromHeader, type JWTPayload } from "../auth/jwt";

// ============================================================================
// Types
// ============================================================================

export interface AuthenticatedRequest extends NextRequest {
  user?: JWTPayload;
}

// ============================================================================
// Middleware Helper
// ============================================================================

/**
 * 验证请求中的 JWT Token
 * 返回 user payload 或 null
 */
export function authenticateRequest(request: NextRequest): JWTPayload | null {
  const authHeader = request.headers.get("authorization");
  const token = extractTokenFromHeader(authHeader || undefined);

  if (!token) return null;

  return verifyToken(token);
}

/**
 * 创建需要认证的 API 处理器包装器
 */
export function withAuth<T>(
  handler: (request: NextRequest, user: JWTPayload) => Promise<NextResponse<T>>
) {
  return async (request: NextRequest): Promise<NextResponse> => {
    const user = authenticateRequest(request);

    if (!user) {
      return NextResponse.json(
        { success: false, error: "未授权访问，请先登录" },
        { status: 401 }
      );
    }

    return handler(request, user);
  };
}

/**
 * 创建需要管理员权限的 API 处理器包装器
 */
export function withAdminAuth<T>(
  handler: (request: NextRequest, user: JWTPayload) => Promise<NextResponse<T>>
) {
  return async (request: NextRequest): Promise<NextResponse> => {
    const user = authenticateRequest(request);

    if (!user) {
      return NextResponse.json(
        { success: false, error: "未授权访问，请先登录" },
        { status: 401 }
      );
    }

    if (user.role !== "admin") {
      return NextResponse.json(
        { success: false, error: "权限不足，需要管理员权限" },
        { status: 403 }
      );
    }

    return handler(request, user);
  };
}
