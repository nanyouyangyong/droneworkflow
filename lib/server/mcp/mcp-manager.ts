import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { type MCPServerConfig, getEnabledServers, parseToolName } from "./mcp-config";

// MCP 服务实例
interface MCPServerInstance {
  client: Client;
  connected: boolean;
}

// MCP 服务管理器（单例）
class MCPManager {
  private servers: Map<string, MCPServerInstance> = new Map();
  private initialized: boolean = false;

  // 初始化所有启用的服务
  async initialize(): Promise<void> {
    if (this.initialized) return;

    const enabledServers = getEnabledServers();
    console.log(`[MCPManager] Initializing ${enabledServers.length} servers...`);

    await Promise.allSettled(
      enabledServers.map(config => this.connectServer(config))
    );

    this.initialized = true;
  }

  // 连接单个服务
  private async connectServer(config: MCPServerConfig): Promise<void> {
    if (this.servers.has(config.name) || !config.command) return;

    try {
      const transport = new StdioClientTransport({
        command: config.command,
        args: config.args || [],
        cwd: config.cwd,
        env: config.env ? { ...config.env } : undefined
      });

      const client = new Client(
        { name: `drone-${config.name}-client`, version: "1.0.0" },
        { capabilities: {} }
      );

      await client.connect(transport);
      this.servers.set(config.name, { client, connected: true });
      console.log(`[MCPManager] ✓ ${config.name} connected`);
    } catch (error) {
      console.error(`[MCPManager] ✗ ${config.name} failed:`, error);
    }
  }

  // 调用工具（支持带前缀的工具名）
  async callTool(fullToolName: string, args: Record<string, any>): Promise<any> {
    await this.initialize();

    const { serverName, toolName } = parseToolName(fullToolName);
    const server = this.servers.get(serverName);

    if (!server) {
      throw new Error(`[MCPManager] Server "${serverName}" not connected`);
    }

    try {
      const result = await server.client.callTool({ name: toolName, arguments: args });

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
      console.error(`[MCPManager] ${serverName}:${toolName} failed:`, error);
      throw error;
    }
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
