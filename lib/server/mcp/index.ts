// ============================================================================
// MCP 模块统一导出
// ============================================================================

// 类型定义
export * from "./types";

// 错误处理
export * from "./error-handler";

// 工具注册表
export { MCPToolRegistry, toolRegistry } from "./tool-registry";

// 单客户端封装
export { MCPClient } from "./client";

// 配置管理
export {
  mcpConfigManager,
  getEnabledServers,
  parseToolName,
  buildToolName,
} from "./mcp-config";

// 统一管理器（主入口）
export { mcpManager } from "./mcp-manager";
