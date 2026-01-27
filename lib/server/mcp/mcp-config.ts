import path from "path";

// MCP 服务类型
export type MCPTransportType = "stdio" | "sse" | "http";

// MCP 服务配置接口
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
}

// 预定义的 MCP 服务配置
export const MCP_SERVERS: Record<string, MCPServerConfig> = {
  // 本地无人机控制服务
  drone: {
    name: "drone",
    description: "无人机控制 MCP 服务",
    enabled: true,
    transport: "stdio",
    command: "npx",
    args: ["tsx", "src/index.ts"],
    cwd: path.join(process.cwd(), "mcp-client-typescript"),
    toolPrefix: "drone"
  },

  // 高德地图 MCP 服务
  amap: {
    name: "amap",
    description: "高德地图 MCP 服务 - 提供地理编码、路径规划、POI搜索等",
    enabled: true,
    transport: "stdio",
    command: "npx",
    args: ["-y", "@amap/amap-maps-mcp-server"],
    env: {
      AMAP_MAPS_API_KEY: process.env.AMAP_API_KEY || ""
    },
    toolPrefix: "amap"
  },

  // 天气服务示例
  weather: {
    name: "weather",
    description: "天气查询 MCP 服务",
    enabled: false,
    transport: "stdio",
    command: "npx",
    args: ["-y", "@weather/mcp-server"],
    toolPrefix: "weather"
  },

  // 文件系统服务（可用于保存飞行日志等）
  filesystem: {
    name: "filesystem",
    description: "文件系统 MCP 服务",
    enabled: false,
    transport: "stdio",
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-filesystem", "./data"],
    toolPrefix: "fs"
  }
};

// 获取所有启用的服务配置
export function getEnabledServers(): MCPServerConfig[] {
  return Object.values(MCP_SERVERS).filter(s => s.enabled);
}

// 根据名称获取服务配置
export function getServerConfig(name: string): MCPServerConfig | undefined {
  return MCP_SERVERS[name];
}

// 动态添加服务配置
export function addServerConfig(config: MCPServerConfig): void {
  MCP_SERVERS[config.name] = config;
}

// 解析工具名称，获取服务名和原始工具名
export function parseToolName(fullToolName: string): { serverName: string; toolName: string } {
  const parts = fullToolName.split(":");
  if (parts.length === 2) {
    return { serverName: parts[0], toolName: parts[1] };
  }
  // 默认使用 drone 服务
  return { serverName: "drone", toolName: fullToolName };
}

// 构建带前缀的工具名
export function buildToolName(serverName: string, toolName: string): string {
  return `${serverName}:${toolName}`;
}
