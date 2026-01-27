import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import type {
  MCPServerConfig,
  MCPServerInstance,
  MCPServerStatus,
  MCPToolInfo,
  MCPServerMetrics,
  MCPEvent,
  MCPEventHandler,
  RetryConfig,
} from "./types";
import { DEFAULT_RETRY_CONFIG, DEFAULT_TIMEOUT } from "./types";
import { withRetry, classifyError, createMCPError } from "./error-handler";

// ============================================================================
// MCP 客户端封装 - 管理单个MCP服务器连接
// ============================================================================

export class MCPClient {
  private instance: MCPServerInstance;
  private eventHandlers: MCPEventHandler[] = [];
  private reconnectTimer: NodeJS.Timeout | null = null;

  constructor(config: MCPServerConfig) {
    this.instance = {
      config,
      client: null,
      status: "disconnected",
      tools: [],
      reconnectAttempts: 0,
      metrics: this.createEmptyMetrics(),
    };
  }

  // =========================================================================
  // 连接管理
  // =========================================================================

  async connect(): Promise<void> {
    if (this.instance.status === "connected") {
      return;
    }

    const { config } = this.instance;
    this.updateStatus("connecting");
    this.emit("server:connecting");

    try {
      const retryConfig = config.retryConfig || DEFAULT_RETRY_CONFIG;

      await withRetry(
        async () => {
          await this.doConnect();
        },
        retryConfig,
        (attempt, error, delay) => {
          console.log(`[MCPClient] ${config.name} 重试 #${attempt}, 等待 ${delay}ms...`);
          this.updateStatus("reconnecting");
          this.emit("server:reconnecting", { attempt, error, delay });
        }
      );

      this.instance.lastConnectedAt = new Date();
      this.instance.reconnectAttempts = 0;
      this.updateStatus("connected");
      this.emit("server:connected");

      // 发现工具
      await this.discoverTools();

      console.log(`[MCPClient] ✓ ${config.name} 已连接, 发现 ${this.instance.tools.length} 个工具`);
    } catch (error) {
      const mcpError = classifyError(error, { serverName: config.name });
      this.instance.lastError = mcpError.originalError;
      this.updateStatus("error");
      this.emit("server:error", { error: mcpError });
      console.error(`[MCPClient] ✗ ${config.name} 连接失败:`, mcpError.message);
      throw mcpError;
    }
  }

  private async doConnect(): Promise<void> {
    const { config } = this.instance;

    if (config.transport !== "stdio" || !config.command) {
      throw createMCPError("CONNECTION_FAILED", "仅支持 stdio 传输类型", {
        serverName: config.name,
      });
    }

    const transport = new StdioClientTransport({
      command: config.command,
      args: config.args || [],
      cwd: config.cwd,
      env: config.env ? { ...config.env } : undefined,
    });

    const client = new Client(
      { name: `drone-${config.name}-client`, version: "1.0.0" },
      { capabilities: {} }
    );

    const timeout = config.timeout || DEFAULT_TIMEOUT;
    await Promise.race([
      client.connect(transport),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error("连接超时")), timeout)
      ),
    ]);

    this.instance.client = client;
  }

  async disconnect(): Promise<void> {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.instance.client) {
      try {
        await this.instance.client.close();
      } catch (error) {
        console.warn(`[MCPClient] ${this.instance.config.name} 断开连接时出错:`, error);
      }
      this.instance.client = null;
    }

    this.instance.tools = [];
    this.updateStatus("disconnected");
    this.emit("server:disconnected");
    console.log(`[MCPClient] ${this.instance.config.name} 已断开`);
  }

  async reconnect(): Promise<void> {
    await this.disconnect();
    await this.connect();
  }

  // =========================================================================
  // 工具发现
  // =========================================================================

  private async discoverTools(): Promise<void> {
    if (!this.instance.client) {
      return;
    }

    try {
      const result = await this.instance.client.listTools();
      const tools: MCPToolInfo[] = (result.tools || []).map((tool: any) => ({
        name: tool.name,
        description: tool.description,
        inputSchema: tool.inputSchema,
        serverName: this.instance.config.name,
        fullName: `${this.instance.config.name}:${tool.name}`,
      }));

      this.instance.tools = tools;

      tools.forEach((tool) => {
        this.emit("tool:discovered", { tool });
      });
    } catch (error) {
      console.warn(`[MCPClient] ${this.instance.config.name} 工具发现失败:`, error);
    }
  }

  // =========================================================================
  // 工具调用
  // =========================================================================

  async callTool(toolName: string, args: Record<string, any>): Promise<any> {
    if (!this.instance.client || this.instance.status !== "connected") {
      throw createMCPError("SERVER_NOT_FOUND", "服务器未连接", {
        serverName: this.instance.config.name,
        toolName,
      });
    }

    const startTime = Date.now();
    this.emit("tool:call:start", { toolName, args });

    try {
      const result = await this.instance.client.callTool({
        name: toolName,
        arguments: args,
      });

      const duration = Date.now() - startTime;
      this.updateMetrics(true, duration);
      this.emit("tool:call:success", { toolName, result, duration });

      return this.parseResult(result);
    } catch (error) {
      const duration = Date.now() - startTime;
      this.updateMetrics(false, duration);

      const mcpError = classifyError(error, {
        serverName: this.instance.config.name,
        toolName,
      });

      this.emit("tool:call:error", { toolName, error: mcpError, duration });
      throw mcpError;
    }
  }

  private parseResult(result: any): any {
    if (result.content && Array.isArray(result.content)) {
      const textContent = result.content.find((c: any) => c.type === "text");
      if (textContent) {
        try {
          return JSON.parse(textContent.text);
        } catch {
          return textContent.text;
        }
      }
    }
    return result;
  }

  // =========================================================================
  // 状态与指标
  // =========================================================================

  getStatus(): MCPServerStatus {
    return this.instance.status;
  }

  isConnected(): boolean {
    return this.instance.status === "connected";
  }

  getTools(): MCPToolInfo[] {
    return [...this.instance.tools];
  }

  getMetrics(): MCPServerMetrics {
    return { ...this.instance.metrics };
  }

  getConfig(): MCPServerConfig {
    return { ...this.instance.config };
  }

  getInstance(): MCPServerInstance {
    return {
      ...this.instance,
      tools: [...this.instance.tools],
      metrics: { ...this.instance.metrics },
    };
  }

  private updateStatus(status: MCPServerStatus): void {
    this.instance.status = status;
  }

  private createEmptyMetrics(): MCPServerMetrics {
    return {
      totalCalls: 0,
      successfulCalls: 0,
      failedCalls: 0,
      averageResponseTime: 0,
    };
  }

  private updateMetrics(success: boolean, duration: number): void {
    const metrics = this.instance.metrics;
    metrics.totalCalls++;
    metrics.lastCallAt = new Date();

    if (success) {
      metrics.successfulCalls++;
    } else {
      metrics.failedCalls++;
    }

    // 更新平均响应时间
    const prevTotal = metrics.averageResponseTime * (metrics.totalCalls - 1);
    metrics.averageResponseTime = (prevTotal + duration) / metrics.totalCalls;
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

  private emit(type: MCPEvent["type"], data?: any): void {
    const event: MCPEvent = {
      type,
      serverName: this.instance.config.name,
      timestamp: new Date(),
      data,
    };

    this.eventHandlers.forEach((handler) => {
      try {
        handler(event);
      } catch (error) {
        console.error(`[MCPClient] 事件处理器错误:`, error);
      }
    });
  }
}
