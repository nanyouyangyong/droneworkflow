import type { MCPError, MCPErrorCode, RetryConfig } from "./types";
import { DEFAULT_RETRY_CONFIG } from "./types";

// ============================================================================
// 错误创建工厂
// ============================================================================

export function createMCPError(
  code: MCPErrorCode,
  message: string,
  options?: {
    serverName?: string;
    toolName?: string;
    originalError?: Error;
  }
): MCPError {
  const retryableCodes: MCPErrorCode[] = [
    "CONNECTION_FAILED",
    "CONNECTION_TIMEOUT",
    "PROCESS_CRASHED",
    "RATE_LIMITED",
  ];

  return {
    code,
    message,
    serverName: options?.serverName,
    toolName: options?.toolName,
    originalError: options?.originalError,
    retryable: retryableCodes.includes(code),
  };
}

// ============================================================================
// 错误分类
// ============================================================================

export function classifyError(error: unknown, context?: { serverName?: string; toolName?: string }): MCPError {
  const err = error instanceof Error ? error : new Error(String(error));
  const message = err.message.toLowerCase();

  if (message.includes("timeout") || message.includes("timed out")) {
    return createMCPError("CONNECTION_TIMEOUT", `连接超时: ${err.message}`, {
      ...context,
      originalError: err,
    });
  }

  if (message.includes("econnrefused") || message.includes("connection refused")) {
    return createMCPError("CONNECTION_FAILED", `连接被拒绝: ${err.message}`, {
      ...context,
      originalError: err,
    });
  }

  if (message.includes("not found") || message.includes("does not exist")) {
    if (context?.toolName) {
      return createMCPError("TOOL_NOT_FOUND", `工具未找到: ${context.toolName}`, {
        ...context,
        originalError: err,
      });
    }
    return createMCPError("SERVER_NOT_FOUND", `服务未找到`, {
      ...context,
      originalError: err,
    });
  }

  if (message.includes("process") && (message.includes("exit") || message.includes("crash"))) {
    return createMCPError("PROCESS_CRASHED", `进程异常退出: ${err.message}`, {
      ...context,
      originalError: err,
    });
  }

  if (message.includes("rate limit") || message.includes("too many requests")) {
    return createMCPError("RATE_LIMITED", `请求过于频繁: ${err.message}`, {
      ...context,
      originalError: err,
    });
  }

  if (message.includes("invalid") || message.includes("argument")) {
    return createMCPError("INVALID_ARGUMENTS", `参数无效: ${err.message}`, {
      ...context,
      originalError: err,
    });
  }

  return createMCPError("UNKNOWN", err.message, {
    ...context,
    originalError: err,
  });
}

// ============================================================================
// 重试逻辑
// ============================================================================

export async function withRetry<T>(
  fn: () => Promise<T>,
  config: RetryConfig = DEFAULT_RETRY_CONFIG,
  onRetry?: (attempt: number, error: MCPError, delay: number) => void
): Promise<T> {
  let lastError: MCPError | null = null;

  for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = classifyError(error);

      if (!lastError.retryable || attempt >= config.maxRetries) {
        throw lastError;
      }

      const delay = Math.min(
        config.baseDelayMs * Math.pow(config.backoffMultiplier, attempt),
        config.maxDelayMs
      );

      if (onRetry) {
        onRetry(attempt + 1, lastError, delay);
      }

      await sleep(delay);
    }
  }

  throw lastError;
}

// ============================================================================
// 辅助函数
// ============================================================================

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function formatMCPError(error: MCPError): string {
  const parts = [`[${error.code}]`];
  
  if (error.serverName) {
    parts.push(`服务: ${error.serverName}`);
  }
  
  if (error.toolName) {
    parts.push(`工具: ${error.toolName}`);
  }
  
  parts.push(error.message);
  
  return parts.join(" - ");
}

export function isMCPError(error: unknown): error is MCPError {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    "message" in error &&
    "retryable" in error
  );
}
