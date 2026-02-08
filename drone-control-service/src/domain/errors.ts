// ============================================================================
// 错误码
// ============================================================================

export const ErrorCodes = {
  VALIDATION_ERROR: "VALIDATION_ERROR",
  DRONE_NOT_FOUND: "DRONE_NOT_FOUND",
  DRONE_OFFLINE: "DRONE_OFFLINE",
  DRONE_ALREADY_CONNECTED: "DRONE_ALREADY_CONNECTED",
  COMMAND_NOT_FOUND: "COMMAND_NOT_FOUND",
  COMMAND_REJECTED: "COMMAND_REJECTED",
  UNAUTHORIZED: "UNAUTHORIZED",
  TIMEOUT: "TIMEOUT",
  INTERNAL_ERROR: "INTERNAL_ERROR",
} as const;

export type ErrorCode = (typeof ErrorCodes)[keyof typeof ErrorCodes];

// ============================================================================
// 自定义错误类
// ============================================================================

export class ServiceError extends Error {
  public readonly code: ErrorCode;
  public readonly statusCode: number;

  constructor(code: ErrorCode, message: string, statusCode = 400) {
    super(message);
    this.name = "ServiceError";
    this.code = code;
    this.statusCode = statusCode;
  }
}

export class ValidationError extends ServiceError {
  constructor(message: string) {
    super(ErrorCodes.VALIDATION_ERROR, message, 400);
    this.name = "ValidationError";
  }
}

export class NotFoundError extends ServiceError {
  constructor(resource: string, id: string) {
    super(ErrorCodes.DRONE_NOT_FOUND, `${resource} "${id}" not found`, 404);
    this.name = "NotFoundError";
  }
}

export class UnauthorizedError extends ServiceError {
  constructor(message = "Unauthorized") {
    super(ErrorCodes.UNAUTHORIZED, message, 401);
    this.name = "UnauthorizedError";
  }
}
