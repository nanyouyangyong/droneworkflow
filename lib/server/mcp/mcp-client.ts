import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { spawn, ChildProcess } from "child_process";
import path from "path";

// MCP 客户端单例
let mcpClient: Client | null = null;
let mcpProcess: ChildProcess | null = null;

// MCP 服务器配置
const MCP_SERVER_PATH = path.join(process.cwd(), "mcp-client-typescript");

// 初始化 MCP 客户端
export async function initMCPClient(): Promise<Client> {
  if (mcpClient) {
    return mcpClient;
  }

  try {
    // 启动 MCP 服务器进程
    mcpProcess = spawn("npx", ["tsx", "src/index.ts"], {
      cwd: MCP_SERVER_PATH,
      stdio: ["pipe", "pipe", "pipe"],
      shell: true,
    });

    // 创建传输层
    const transport = new StdioClientTransport({
      command: "npx",
      args: ["tsx", "src/index.ts"],
      cwd: MCP_SERVER_PATH,
    });

    // 创建客户端
    mcpClient = new Client(
      {
        name: "drone-workflow-client",
        version: "1.0.0",
      },
      {
        capabilities: {},
      }
    );

    // 连接到服务器
    await mcpClient.connect(transport);
    console.log("MCP Client connected successfully");

    return mcpClient;
  } catch (error) {
    console.error("Failed to initialize MCP client:", error);
    throw error;
  }
}

// 获取 MCP 客户端
export function getMCPClient(): Client | null {
  return mcpClient;
}

// 检查 MCP 客户端是否已连接
export function isMCPConnected(): boolean {
  return mcpClient !== null;
}

// 关闭 MCP 客户端
export async function closeMCPClient(): Promise<void> {
  if (mcpClient) {
    await mcpClient.close();
    mcpClient = null;
  }
  if (mcpProcess) {
    mcpProcess.kill();
    mcpProcess = null;
  }
}

// 调用 MCP 工具
export async function callMCPTool(
  toolName: string,
  args: Record<string, any>
): Promise<any> {
  const client = await initMCPClient();

  try {
    const result = await client.callTool({
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
    console.error(`MCP tool call failed: ${toolName}`, error);
    throw error;
  }
}

// 获取 MCP 工具列表
export async function listMCPTools(): Promise<
  Array<{ name: string; description?: string; inputSchema: any }>
> {
  const client = await initMCPClient();

  try {
    const result = await client.listTools();
    return result.tools || [];
  } catch (error) {
    console.error("Failed to list MCP tools:", error);
    return [];
  }
}

// 获取 MCP 资源列表
export async function listMCPResources(): Promise<
  Array<{ uri: string; name: string; description?: string }>
> {
  const client = await initMCPClient();

  try {
    const result = await client.listResources();
    return result.resources || [];
  } catch (error) {
    console.error("Failed to list MCP resources:", error);
    return [];
  }
}

// 读取 MCP 资源
export async function readMCPResource(uri: string): Promise<any> {
  const client = await initMCPClient();

  try {
    const result = await client.readResource({ uri });
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
    console.error(`Failed to read MCP resource: ${uri}`, error);
    throw error;
  }
}
