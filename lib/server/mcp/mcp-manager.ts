import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";
import {
  type MCPServerConfig,
  type MCPTransportType,
  getEnabledServers,
  getServerConfig,
  parseToolName,
  buildToolName
} from "./mcp-config";

// MCP 服务实例
interface MCPServerInstance {
  config: MCPServerConfig;
  client: Client;
  connected: boolean;
  tools: Array<{ name: string; description?: string; inputSchema: any }>;
}

// MCP 服务管理器（单例）
class MCPManager {
  private servers: Map<string, MCPServerInstance> = new Map();
  private initialized: boolean = false;

  // 初始化所有启用的服务
  async initialize(): Promise<void> {
    if (this.initialized) return;

    const enabledServers = getEnabledServers();
    console.log(`[MCPManager] Initializing ${enabledServers.length} MCP servers...`);

    const results = await Promise.allSettled(
      enabledServers.map(config => this.connectServer(config))
    );

    results.forEach((result, index) => {
      const config = enabledServers[index];
      if (result.status === "fulfilled") {
        console.log(`[MCPManager] ✓ ${config.name} connected`);
      } else {
        console.error(`[MCPManager] ✗ ${config.name} failed:`, result.reason);
      }
    });

    this.initialized = true;
  }

  // 连接单个服务
  async connectServer(config: MCPServerConfig): Promise<void> {
    if (this.servers.has(config.name)) {
      return; // 已连接
    }

    try {
      const transport = await this.createTransport(config);
      const client = new Client(
        {
          name: `drone-workflow-${config.name}-client`,
          version: "1.0.0",
        },
        {
          capabilities: {},
        }
      );

      await client.connect(transport);

      // 获取工具列表
      const toolsResult = await client.listTools();
      const tools = toolsResult.tools || [];

      this.servers.set(config.name, {
        config,
        client,
        connected: true,
        tools
      });

      console.log(`[MCPManager] ${config.name}: ${tools.length} tools available`);
    } catch (error) {
      console.error(`[MCPManager] Failed to connect ${config.name}:`, error);
      throw error;
    }
  }

  // 创建传输层
  private async createTransport(config: MCPServerConfig): Promise<any> {
    switch (config.transport) {
      case "stdio":
        if (!config.command) {
          throw new Error(`[MCPManager] ${config.name}: stdio transport requires command`);
        }
        return new StdioClientTransport({
          command: config.command,
          args: config.args || [],
          cwd: config.cwd,
          env: config.env ? { ...config.env } : undefined
        });

      case "sse":
        if (!config.url) {
          throw new Error(`[MCPManager] ${config.name}: SSE transport requires url`);
        }
        return new SSEClientTransport(new URL(config.url));

      case "http":
        throw new Error(`[MCPManager] HTTP transport not yet implemented`);

      default:
        throw new Error(`[MCPManager] Unknown transport type: ${config.transport}`);
    }
  }

  // 获取服务实例
  getServer(name: string): MCPServerInstance | undefined {
    return this.servers.get(name);
  }

  // 检查服务是否已连接
  isConnected(name: string): boolean {
    return this.servers.get(name)?.connected ?? false;
  }

  // 调用工具（支持带前缀的工具名）
  async callTool(
    fullToolName: string,
    args: Record<string, any>
  ): Promise<any> {
    await this.initialize();

    const { serverName, toolName } = parseToolName(fullToolName);
    const server = this.servers.get(serverName);

    if (!server) {
      throw new Error(`[MCPManager] Server "${serverName}" not found or not connected`);
    }

    try {
      const result = await server.client.callTool({
        name: toolName,
        arguments: args,
      });

      // 解析结果
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
    } catch (error: any) {
      console.error(`[MCPManager] Tool call failed: ${serverName}:${toolName}`, error);
      throw error;
    }
  }

  // 获取所有可用工具（带服务前缀）
  async listAllTools(): Promise<Array<{
    serverName: string;
    name: string;
    fullName: string;
    description?: string;
    inputSchema: any;
  }>> {
    await this.initialize();

    const allTools: Array<{
      serverName: string;
      name: string;
      fullName: string;
      description?: string;
      inputSchema: any;
    }> = [];

    for (const [serverName, server] of this.servers) {
      for (const tool of server.tools) {
        allTools.push({
          serverName,
          name: tool.name,
          fullName: buildToolName(serverName, tool.name),
          description: tool.description,
          inputSchema: tool.inputSchema
        });
      }
    }

    return allTools;
  }

  // 获取指定服务的工具列表
  async listServerTools(serverName: string): Promise<Array<{
    name: string;
    description?: string;
    inputSchema: any;
  }>> {
    await this.initialize();

    const server = this.servers.get(serverName);
    if (!server) {
      return [];
    }

    return server.tools;
  }

  // 读取资源
  async readResource(serverName: string, uri: string): Promise<any> {
    await this.initialize();

    const server = this.servers.get(serverName);
    if (!server) {
      throw new Error(`[MCPManager] Server "${serverName}" not found`);
    }

    try {
      const result = await server.client.readResource({ uri });
      if (result.contents && result.contents.length > 0) {
        const content = result.contents[0] as { uri: string; text?: string; blob?: string };
        if ("text" in content && content.text) {
          try {
            return JSON.parse(content.text);
          } catch {
            return content.text;
          }
        }
      }
      return result;
    } catch (error) {
      console.error(`[MCPManager] Failed to read resource: ${serverName}:${uri}`, error);
      throw error;
    }
  }

  // 关闭所有服务
  async closeAll(): Promise<void> {
    for (const [name, server] of this.servers) {
      try {
        await server.client.close();
        console.log(`[MCPManager] ${name} disconnected`);
      } catch (error) {
        console.error(`[MCPManager] Error closing ${name}:`, error);
      }
    }
    this.servers.clear();
    this.initialized = false;
  }

  // 关闭指定服务
  async closeServer(name: string): Promise<void> {
    const server = this.servers.get(name);
    if (server) {
      await server.client.close();
      this.servers.delete(name);
    }
  }

  // 获取服务状态
  getStatus(): Record<string, { connected: boolean; toolCount: number }> {
    const status: Record<string, { connected: boolean; toolCount: number }> = {};
    for (const [name, server] of this.servers) {
      status[name] = {
        connected: server.connected,
        toolCount: server.tools.length
      };
    }
    return status;
  }
}

// 导出单例实例
export const mcpManager = new MCPManager();

// 便捷函数
export async function callMCPToolMulti(
  fullToolName: string,
  args: Record<string, any>
): Promise<any> {
  return mcpManager.callTool(fullToolName, args);
}

export async function listAllMCPTools() {
  return mcpManager.listAllTools();
}

export async function getMCPStatus() {
  return mcpManager.getStatus();
}
