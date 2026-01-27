import { NextResponse } from "next/server";

// ============================================================================
// Error Types
// ============================================================================

export class AppError extends Error {
  constructor(
    public statusCode: number,
    public message: string,
    public code?: string
  ) {
    super(message);
    this.name = "AppError";
  }
}

export class ValidationError extends AppError {
  constructor(message: string) {
    super(400, message, "VALIDATION_ERROR");
    this.name = "ValidationError";
  }
}

export class AuthenticationError extends AppError {
  constructor(message: string = "未授权访问") {
    super(401, message, "AUTHENTICATION_ERROR");
    this.name = "AuthenticationError";
  }
}

export class ForbiddenError extends AppError {
  constructor(message: string = "权限不足") {
    super(403, message, "FORBIDDEN_ERROR");
    this.name = "ForbiddenError";
  }
}

export class NotFoundError extends AppError {
  constructor(message: string = "资源不存在") {
    super(404, message, "NOT_FOUND_ERROR");
    this.name = "NotFoundError";
  }
}

export class ConflictError extends AppError {
  constructor(message: string = "资源冲突") {
    super(409, message, "CONFLICT_ERROR");
    this.name = "ConflictError";
  }
}

// ============================================================================
// Error Response
// ============================================================================

export interface ErrorResponse {
  success: false;
  error: string;
  code?: string;
  details?: unknown;
}

/**
 * 统一错误响应生成
 */
export function createErrorResponse(
  error: unknown,
  defaultMessage: string = "服务器内部错误"
): NextResponse<ErrorResponse> {
  // AppError 类型错误
  if (error instanceof AppError) {
    return NextResponse.json(
      {
        success: false,
        error: error.message,
        code: error.code,
      },
      { status: error.statusCode }
    );
  }

  // 标准 Error 类型
  if (error instanceof Error) {
    console.error("[API Error]", error.message, error.stack);

    // 生产环境不暴露错误详情
    const message =
      process.env.NODE_ENV === "production" ? defaultMessage : error.message;

    return NextResponse.json(
      {
        success: false,
        error: message,
        code: "INTERNAL_ERROR",
      },
      { status: 500 }
    );
  }

  // 未知错误类型
  console.error("[API Error] Unknown error type:", error);
  return NextResponse.json(
    {
      success: false,
      error: defaultMessage,
      code: "UNKNOWN_ERROR",
    },
    { status: 500 }
  );
}

/**
 * API 处理器包装器，自动处理错误
 */
export function withErrorHandler<T>(
  handler: () => Promise<NextResponse<T>>
): Promise<NextResponse<T | ErrorResponse>> {
  return handler().catch((error) => createErrorResponse(error));
}
