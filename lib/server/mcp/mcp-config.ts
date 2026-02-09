import path from "path";
import type { MCPServerConfig, RetryConfig } from "./types";
import { DEFAULT_RETRY_CONFIG } from "./types";

// ============================================================================
// 配置管理器 - 支持动态添加/移除服务器配置
// ============================================================================

class MCPConfigManager {
  private configs: Map<string, MCPServerConfig> = new Map();
  private changeListeners: Array<() => void> = [];

  constructor() {
    // 加载预定义配置
    this.loadDefaultConfigs();
  }

  // 加载默认配置
  private loadDefaultConfigs(): void {
    const defaults = getDefaultServerConfigs();
    Object.values(defaults).forEach((config) => {
      this.configs.set(config.name, config);
    });
  }

  // 添加服务器配置
  addServer(config: MCPServerConfig): void {
    this.configs.set(config.name, config);
    this.notifyChange();
  }

  // 移除服务器配置
  removeServer(name: string): boolean {
    const deleted = this.configs.delete(name);
    if (deleted) {
      this.notifyChange();
    }
    return deleted;
  }

  // 更新服务器配置
  updateServer(name: string, updates: Partial<MCPServerConfig>): boolean {
    const existing = this.configs.get(name);
    if (!existing) {
      return false;
    }
    this.configs.set(name, { ...existing, ...updates });
    this.notifyChange();
    return true;
  }

  // 启用/禁用服务器
  setServerEnabled(name: string, enabled: boolean): boolean {
    return this.updateServer(name, { enabled });
  }

  // 获取服务器配置
  getServer(name: string): MCPServerConfig | undefined {
    return this.configs.get(name);
  }

  // 获取所有服务器配置
  getAllServers(): MCPServerConfig[] {
    return Array.from(this.configs.values());
  }

  // 获取所有启用的服务器配置
  getEnabledServers(): MCPServerConfig[] {
    return this.getAllServers().filter((s) => s.enabled);
  }

  // 获取服务器名称列表
  getServerNames(): string[] {
    return Array.from(this.configs.keys());
  }

  // 检查服务器是否存在
  hasServer(name: string): boolean {
    return this.configs.has(name);
  }

  // 监听配置变更
  onConfigChange(listener: () => void): () => void {
    this.changeListeners.push(listener);
    return () => {
      const index = this.changeListeners.indexOf(listener);
      if (index > -1) {
        this.changeListeners.splice(index, 1);
      }
    };
  }

  private notifyChange(): void {
    this.changeListeners.forEach((listener) => {
      try {
        listener();
      } catch (error) {
        console.error("[MCPConfigManager] 配置变更监听器错误:", error);
      }
    });
  }

  // 重置为默认配置
  reset(): void {
    this.configs.clear();
    this.loadDefaultConfigs();
    this.notifyChange();
  }
}

// ============================================================================
// 预定义的 MCP 服务配置
// ============================================================================

function getDefaultServerConfigs(): Record<string, MCPServerConfig> {
  return {
    // 本地无人机控制服务
    drone: {
      name: "drone",
      description: "无人机控制 MCP 服务",
      enabled: true,
      transport: "stdio",
      command: "npx",
      args: ["tsx", "src/index.ts"],
      cwd: path.join(process.cwd(), "mcp-client-typescript"),
      toolPrefix: "drone",
      retryConfig: DEFAULT_RETRY_CONFIG,
      timeout: 30000,
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
        AMAP_MAPS_API_KEY: process.env.AMAP_API_KEY || "",
      },
      toolPrefix: "amap",
      retryConfig: DEFAULT_RETRY_CONFIG,
      timeout: 30000,
    },

    // 天气服务示例
    weather: {
      name: "weather",
      description: "天气查询 MCP 服务",
      enabled: false,
      transport: "stdio",
      command: "npx",
      args: ["-y", "@weather/mcp-server"],
      toolPrefix: "weather",
      retryConfig: DEFAULT_RETRY_CONFIG,
      timeout: 30000,
    },

    // 文件系统服务（可用于保存飞行日志等）
    filesystem: {
      name: "filesystem",
      description: "文件系统 MCP 服务",
      enabled: false,
      transport: "stdio",
      command: "npx",
      args: ["-y", "@modelcontextprotocol/server-filesystem", "./data"],
      toolPrefix: "fs",
      retryConfig: DEFAULT_RETRY_CONFIG,
      timeout: 30000,
    },
  };
}

// ============================================================================
// 导出
// ============================================================================

// 配置管理器单例
export const mcpConfigManager = new MCPConfigManager();

export function getEnabledServers(): MCPServerConfig[] {
  return mcpConfigManager.getEnabledServers();
}

// 解析工具名称，获取服务名和原始工具名
export function parseToolName(fullToolName: string): { serverName: string; toolName: string } {
  const colonIndex = fullToolName.indexOf(":");
  if (colonIndex > 0) {
    return {
      serverName: fullToolName.substring(0, colonIndex),
      toolName: fullToolName.substring(colonIndex + 1),
    };
  }
  return { serverName: "drone", toolName: fullToolName };
}

// 构建完整工具名
export function buildToolName(serverName: string, toolName: string): string {
  return `${serverName}:${toolName}`;
}
