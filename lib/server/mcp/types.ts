import type { Client } from "@modelcontextprotocol/sdk/client/index.js";

// ============================================================================
// 传输类型
// ============================================================================

export type MCPTransportType = "stdio" | "sse" | "http";

// ============================================================================
// 服务器配置
// ============================================================================

export interface MCPServerConfig {
  name: string;
  description: string;
  enabled: boolean;
  transport: MCPTransportType;
  // stdio 传输配置
  command?: string;
  args?: string[];
  cwd?: string;
  env?: Record<string, string>;
  // HTTP/SSE 传输配置
  url?: string;
  headers?: Record<string, string>;
  // 工具前缀（避免工具名冲突）
  toolPrefix?: string;
  // 重试配置
  retryConfig?: RetryConfig;
  // 超时配置（毫秒）
  timeout?: number;
}

// ============================================================================
// 服务器实例状态
// ============================================================================

export type MCPServerStatus = "disconnected" | "connecting" | "connected" | "error" | "reconnecting";

export interface MCPServerInstance {
  config: MCPServerConfig;
  client: Client | null;
  status: MCPServerStatus;
  tools: MCPToolInfo[];
  lastError?: Error;
  lastConnectedAt?: Date;
  reconnectAttempts: number;
  metrics: MCPServerMetrics;
}

// ============================================================================
// 工具信息
// ============================================================================

export interface MCPToolInfo {
  name: string;
  description?: string;
  inputSchema?: Record<string, any>;
  serverName: string;
  fullName: string; // serverName:toolName
}

export interface MCPToolCallResult {
  success: boolean;
  data?: any;
  error?: MCPError;
  duration: number;
  serverName: string;
  toolName: string;
}

// ============================================================================
// 错误处理
// ============================================================================

export type MCPErrorCode = 
  | "CONNECTION_FAILED"
  | "CONNECTION_TIMEOUT"
  | "SERVER_NOT_FOUND"
  | "TOOL_NOT_FOUND"
  | "TOOL_CALL_FAILED"
  | "INVALID_ARGUMENTS"
  | "PROCESS_CRASHED"
  | "RATE_LIMITED"
  | "UNKNOWN";

export interface MCPError {
  code: MCPErrorCode;
  message: string;
  serverName?: string;
  toolName?: string;
  originalError?: Error;
  retryable: boolean;
}

export interface RetryConfig {
  maxRetries: number;
  baseDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
}

// ============================================================================
// 健康检查与监控
// ============================================================================

export interface MCPServerMetrics {
  totalCalls: number;
  successfulCalls: number;
  failedCalls: number;
  averageResponseTime: number;
  lastCallAt?: Date;
}

export interface MCPHealthStatus {
  serverName: string;
  status: MCPServerStatus;
  connected: boolean;
  toolCount: number;
  uptime?: number;
  metrics: MCPServerMetrics;
  lastError?: string;
}

export interface MCPManagerStatus {
  initialized: boolean;
  servers: MCPHealthStatus[];
  totalTools: number;
  allTools: MCPToolInfo[];
}

// ============================================================================
// 事件系统
// ============================================================================

export type MCPEventType = 
  | "server:connecting"
  | "server:connected"
  | "server:disconnected"
  | "server:error"
  | "server:reconnecting"
  | "tool:discovered"
  | "tool:call:start"
  | "tool:call:success"
  | "tool:call:error";

export interface MCPEvent {
  type: MCPEventType;
  serverName: string;
  timestamp: Date;
  data?: any;
}

export type MCPEventHandler = (event: MCPEvent) => void;

// ============================================================================
// 调用选项
// ============================================================================

export interface MCPCallOptions {
  timeout?: number;
  retries?: number;
  skipCache?: boolean;
}

// ============================================================================
// 默认配置
// ============================================================================

export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  baseDelayMs: 1000,
  maxDelayMs: 10000,
  backoffMultiplier: 2,
};

export const DEFAULT_TIMEOUT = 30000;
