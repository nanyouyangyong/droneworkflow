import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import path from "path";

// MCP 客户端单例
let mcpClient: Client | null = null;

// MCP 服务器配置
const MCP_SERVER_PATH = path.join(process.cwd(), "mcp-client-typescript");

// 初始化 MCP 客户端
export async function initMCPClient(): Promise<Client> {
  if (mcpClient) {
    return mcpClient;
  }

  try {
    const transport = new StdioClientTransport({
      command: "npx",
      args: ["tsx", "src/index.ts"],
      cwd: MCP_SERVER_PATH,
    });

    mcpClient = new Client(
      { name: "drone-workflow-client", version: "1.0.0" },
      { capabilities: {} }
    );

    await mcpClient.connect(transport);
    console.log("[MCP] Client connected");

    return mcpClient;
  } catch (error) {
    console.error("[MCP] Failed to initialize:", error);
    throw error;
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
    console.error(`[MCP] Tool call failed: ${toolName}`, error);
    throw error;
  }
}
