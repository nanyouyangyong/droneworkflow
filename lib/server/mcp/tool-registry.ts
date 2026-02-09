import type { MCPToolInfo } from "./types";

// ============================================================================
// 工具注册表 - 统一管理所有MCP服务器的工具
// ============================================================================

export class MCPToolRegistry {
  private tools: Map<string, MCPToolInfo> = new Map();
  private toolsByServer: Map<string, MCPToolInfo[]> = new Map();

  // 注册工具
  registerTool(tool: MCPToolInfo): void {
    this.tools.set(tool.fullName, tool);

    const serverTools = this.toolsByServer.get(tool.serverName) || [];
    serverTools.push(tool);
    this.toolsByServer.set(tool.serverName, serverTools);
  }

  // 批量注册工具
  registerTools(tools: MCPToolInfo[]): void {
    tools.forEach((tool) => this.registerTool(tool));
  }

  // 清除服务器的所有工具
  clearServerTools(serverName: string): void {
    const serverTools = this.toolsByServer.get(serverName) || [];
    serverTools.forEach((tool) => this.tools.delete(tool.fullName));
    this.toolsByServer.delete(serverName);
  }

  // 获取工具
  getTool(fullName: string): MCPToolInfo | undefined {
    return this.tools.get(fullName);
  }

  // 获取服务器的所有工具
  getServerTools(serverName: string): MCPToolInfo[] {
    return this.toolsByServer.get(serverName) || [];
  }

  // 获取所有工具
  getAllTools(): MCPToolInfo[] {
    return Array.from(this.tools.values());
  }

  // 获取工具总数
  getToolCount(): number {
    return this.tools.size;
  }

  // 搜索工具
  searchTools(query: string): MCPToolInfo[] {
    const lowerQuery = query.toLowerCase();
    return this.getAllTools().filter(
      (tool) =>
        tool.name.toLowerCase().includes(lowerQuery) ||
        tool.fullName.toLowerCase().includes(lowerQuery) ||
        tool.description?.toLowerCase().includes(lowerQuery)
    );
  }

  // 查找工具（支持自动检测服务器）
  findTool(toolName: string): MCPToolInfo | undefined {
    // 首先尝试完整名称
    const direct = this.tools.get(toolName);
    if (direct) return direct;

    // 如果没有冒号，尝试在所有服务器中搜索
    if (!toolName.includes(":")) {
      for (const tool of this.tools.values()) {
        if (tool.name === toolName) {
          return tool;
        }
      }
    }

    return undefined;
  }

  // 检查工具是否存在
  hasTool(fullName: string): boolean {
    return this.tools.has(fullName);
  }

  // 获取所有服务器名称
  getServerNames(): string[] {
    return Array.from(this.toolsByServer.keys());
  }

  // 清除所有工具
  clear(): void {
    this.tools.clear();
    this.toolsByServer.clear();
  }
}

// 导出单例
export const toolRegistry = new MCPToolRegistry();
