import type {
  MCPServerConfig,
  MCPToolInfo,
  MCPManagerStatus,
  MCPHealthStatus,
  MCPCallOptions,
  MCPEvent,
  MCPEventHandler,
} from "./types";
import { DEFAULT_TIMEOUT } from "./types";
import { mcpConfigManager, parseToolName } from "./mcp-config";
import { MCPClient } from "./client";
import { MCPToolRegistry, toolRegistry } from "./tool-registry";
import { classifyError, formatMCPError, withRetry } from "./error-handler";

// ============================================================================
// MCP 统一管理器 - 管理多个MCP服务器
// ============================================================================

class MCPManager {
  private clients: Map<string, MCPClient> = new Map();
  private initialized: boolean = false;
  private initializing: boolean = false;
  private eventHandlers: MCPEventHandler[] = [];

  constructor() {
    // 监听配置变更
    mcpConfigManager.onConfigChange(() => {
      console.log("[MCPManager] 配置已变更，将在下次调用时重新初始化");
      this.initialized = false;
    });
  }

  // =========================================================================
  // 初始化与连接管理
  // =========================================================================

  async initialize(): Promise<void> {
    if (this.initialized || this.initializing) {
      return;
    }

    this.initializing = true;

    try {
      const enabledServers = mcpConfigManager.getEnabledServers();
      console.log(`[MCPManager] 正在初始化 ${enabledServers.length} 个服务器...`);

      // 并行连接所有服务器
      const results = await Promise.allSettled(
        enabledServers.map((config) => this.connectServer(config))
      );

      // 统计结果
      const connected = results.filter((r) => r.status === "fulfilled").length;
      const failed = results.filter((r) => r.status === "rejected").length;

      console.log(`[MCPManager] 初始化完成: ${connected} 成功, ${failed} 失败`);
      this.initialized = true;
    } finally {
      this.initializing = false;
    }
  }

  private async connectServer(config: MCPServerConfig): Promise<void> {
    if (this.clients.has(config.name)) {
      const existing = this.clients.get(config.name)!;
      if (existing.isConnected()) {
        return;
      }
    }

    const client = new MCPClient(config);

    // 转发客户端事件
    client.onEvent((event) => {
      this.emit(event);

      // 工具发现时注册到工具注册表
      if (event.type === "tool:discovered" && event.data?.tool) {
        toolRegistry.registerTool(event.data.tool);
      }
    });

    this.clients.set(config.name, client);

    try {
      await client.connect();
    } catch (error) {
      console.error(`[MCPManager] ${config.name} 连接失败:`, error);
      throw error;
    }
  }

  async disconnectServer(serverName: string): Promise<void> {
    const client = this.clients.get(serverName);
    if (client) {
      await client.disconnect();
      toolRegistry.clearServerTools(serverName);
      this.clients.delete(serverName);
    }
  }

  async disconnectAll(): Promise<void> {
    const disconnects = Array.from(this.clients.keys()).map((name) =>
      this.disconnectServer(name)
    );
    await Promise.allSettled(disconnects);
    this.initialized = false;
  }

  async reconnectServer(serverName: string): Promise<void> {
    const client = this.clients.get(serverName);
    if (client) {
      await client.reconnect();
    }
  }

  // =========================================================================
  // 动态服务器管理
  // =========================================================================

  async addServer(config: MCPServerConfig): Promise<void> {
    mcpConfigManager.addServer(config);
    if (config.enabled) {
      await this.connectServer(config);
    }
  }

  async removeServer(serverName: string): Promise<void> {
    await this.disconnectServer(serverName);
    mcpConfigManager.removeServer(serverName);
  }

  async setServerEnabled(serverName: string, enabled: boolean): Promise<void> {
    mcpConfigManager.setServerEnabled(serverName, enabled);

    if (enabled) {
      const config = mcpConfigManager.getServer(serverName);
      if (config) {
        await this.connectServer(config);
      }
    } else {
      await this.disconnectServer(serverName);
    }
  }

  // =========================================================================
  // 工具调用
  // =========================================================================

  async callTool(
    fullToolName: string,
    args: Record<string, any>,
    options?: MCPCallOptions
  ): Promise<any> {
    await this.initialize();

    const { serverName, toolName } = parseToolName(fullToolName);
    const client = this.clients.get(serverName);

    if (!client) {
      throw new Error(`[MCPManager] 服务器 "${serverName}" 未连接`);
    }

    if (!client.isConnected()) {
      throw new Error(`[MCPManager] 服务器 "${serverName}" 连接已断开`);
    }

    return client.callTool(toolName, args);
  }

  // 自动检测服务器调用工具
  async callToolAuto(
    toolName: string,
    args: Record<string, any>,
    options?: MCPCallOptions
  ): Promise<any> {
    await this.initialize();

    // 如果包含冒号，使用标准调用
    if (toolName.includes(":")) {
      return this.callTool(toolName, args, options);
    }

    // 在工具注册表中查找
    const tool = toolRegistry.findTool(toolName);
    if (tool) {
      return this.callTool(tool.fullName, args, options);
    }

    // 尝试在所有连接的服务器中查找
    for (const [serverName, client] of this.clients.entries()) {
      if (!client.isConnected()) continue;

      const serverTools = client.getTools();
      const found = serverTools.find((t) => t.name === toolName);
      if (found) {
        return this.callTool(found.fullName, args, options);
      }
    }

    throw new Error(`[MCPManager] 工具 "${toolName}" 未找到`);
  }

  // =========================================================================
  // 工具查询
  // =========================================================================

  getTools(): MCPToolInfo[] {
    return toolRegistry.getAllTools();
  }

  getServerTools(serverName: string): MCPToolInfo[] {
    return toolRegistry.getServerTools(serverName);
  }

  searchTools(query: string): MCPToolInfo[] {
    return toolRegistry.searchTools(query);
  }

  hasTool(toolName: string): boolean {
    return toolRegistry.hasTool(toolName) || !!toolRegistry.findTool(toolName);
  }

  // =========================================================================
  // 状态与健康检查
  // =========================================================================

  getStatus(): MCPManagerStatus {
    const servers: MCPHealthStatus[] = [];

    for (const [name, client] of this.clients.entries()) {
      const instance = client.getInstance();
      const uptime = instance.lastConnectedAt
        ? Date.now() - instance.lastConnectedAt.getTime()
        : undefined;

      servers.push({
        serverName: name,
        status: instance.status,
        connected: client.isConnected(),
        toolCount: instance.tools.length,
        uptime,
        metrics: instance.metrics,
        lastError: instance.lastError?.message,
      });
    }

    return {
      initialized: this.initialized,
      servers,
      totalTools: toolRegistry.getToolCount(),
      allTools: toolRegistry.getAllTools(),
    };
  }

  isServerConnected(serverName: string): boolean {
    const client = this.clients.get(serverName);
    return client?.isConnected() ?? false;
  }

  getConnectedServerNames(): string[] {
    return Array.from(this.clients.entries())
      .filter(([_, client]) => client.isConnected())
      .map(([name]) => name);
  }

  // =========================================================================
  // 事件系统
  // =========================================================================

  onEvent(handler: MCPEventHandler): () => void {
    this.eventHandlers.push(handler);
    return () => {
      const index = this.eventHandlers.indexOf(handler);
      if (index > -1) {
        this.eventHandlers.splice(index, 1);
      }
    };
  }

  private emit(event: MCPEvent): void {
    this.eventHandlers.forEach((handler) => {
      try {
        handler(event);
      } catch (error) {
        console.error("[MCPManager] 事件处理器错误:", error);
      }
    });
  }
}

// ============================================================================
// 导出
// ============================================================================

// 单例实例
export const mcpManager = new MCPManager();

