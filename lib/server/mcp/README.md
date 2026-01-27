# 多 MCP 服务集成指南

## 概述

本项目支持集成多个 MCP (Model Context Protocol) 服务，实现无人机工作流与外部服务（如高德地图）的无缝协作。

## 核心设计原则

基于 MCP 多服务器集成的十大核心设计原则：

1. **统一管理器模式** - 单一 `MCPManager` 管理所有服务器
2. **配置驱动架构** - 通过 `MCPConfigManager` 动态管理配置
3. **透明进程管理** - `MCPClient` 自动管理子进程生命周期
4. **智能工具发现** - `MCPToolRegistry` 统一注册和发现工具
5. **统一调用接口** - 支持指定服务器和自动检测两种调用模式
6. **完整错误处理** - 标准化错误分类和内置重试机制
7. **性能优化集成** - 连接复用和请求优化
8. **安全隔离设计** - 环境变量隔离敏感配置
9. **监控可观测性** - 健康检查和性能指标收集
10. **渐进式扩展** - 模块化设计支持插件式扩展

## 架构

```
┌─────────────────────────────────────────────────────────────┐
│                     executeGraph.ts                          │
│                    (工作流执行引擎)                           │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│                     MCPManager                               │
│                   (统一管理器)                                │
├─────────────────────────────────────────────────────────────┤
│  MCPConfigManager  │  MCPToolRegistry  │  EventSystem       │
│  (配置管理)         │  (工具注册表)      │  (事件系统)         │
└────────┬────────────┴────────────┬──────┴───────────────────┘
         │                         │
         ▼                         ▼
┌────────────────┐         ┌────────────────┐
│   MCPClient    │         │   MCPClient    │
│   (drone)      │         │   (amap)       │
├────────────────┤         ├────────────────┤
│ 重试 │ 监控    │         │ 重试 │ 监控    │
└────────────────┘         └────────────────┘
```

## 模块结构

```
lib/server/mcp/
├── index.ts          # 统一导出入口
├── types.ts          # 类型定义
├── mcp-config.ts     # 配置管理器
├── mcp-manager.ts    # 统一管理器
├── client.ts         # 单客户端封装
├── tool-registry.ts  # 工具注册表
├── error-handler.ts  # 错误处理
└── README.md         # 文档
```

## 快速开始

### 基本使用

```typescript
import { mcpManager, callMCPTool } from "@/lib/server/mcp";

// 初始化（自动连接所有启用的服务器）
await mcpManager.initialize();

// 调用工具（指定服务器）
const result = await mcpManager.callTool("drone:takeoff", { altitude: 10 });

// 调用工具（自动检测服务器）
const geoResult = await mcpManager.callToolAuto("maps_geo", { address: "北京" });

// 获取所有可用工具
const tools = mcpManager.getTools();

// 获取服务器状态
const status = mcpManager.getStatus();
```

### 动态管理服务器

```typescript
import { mcpManager, mcpConfigManager } from "@/lib/server/mcp";

// 动态添加新服务器
await mcpManager.addServer({
  name: "myservice",
  description: "我的自定义服务",
  enabled: true,
  transport: "stdio",
  command: "npx",
  args: ["-y", "@myorg/mcp-server"],
});

// 启用/禁用服务器
await mcpManager.setServerEnabled("weather", true);

// 移除服务器
await mcpManager.removeServer("myservice");
```

### 事件监听

```typescript
import { mcpManager } from "@/lib/server/mcp";

// 监听事件
const unsubscribe = mcpManager.onEvent((event) => {
  console.log(`[${event.type}] ${event.serverName}:`, event.data);
});

// 取消监听
unsubscribe();
```

## 配置外部 MCP 服务

### 1. 添加服务配置

使用配置管理器动态添加，或编辑 `mcp-config.ts`：

```typescript
// 方式1: 动态添加
mcpConfigManager.addServer({
  name: "amap",
  description: "高德地图 MCP 服务",
  enabled: true,
  transport: "stdio",
  command: "npx",
  args: ["-y", "@amap/amap-maps-mcp-server"],
  env: {
    AMAP_MAPS_API_KEY: process.env.AMAP_API_KEY || ""
  },
  toolPrefix: "amap",
  retryConfig: {
    maxRetries: 3,
    baseDelayMs: 1000,
    maxDelayMs: 10000,
    backoffMultiplier: 2,
  },
  timeout: 30000,
});

// 方式2: 预定义配置 (mcp-config.ts)
export const MCP_SERVERS: Record<string, MCPServerConfig> = {
  amap: {
    name: "amap",
    description: "高德地图 MCP 服务",
    enabled: true,
    transport: "stdio",
    command: "npx",
    args: ["-y", "@amap/amap-maps-mcp-server"],
    env: {
      AMAP_MAPS_API_KEY: process.env.AMAP_API_KEY || ""
    },
    toolPrefix: "amap"
  }
};
```

### 2. 配置环境变量

在 `.env.local` 中添加：

```bash
# 高德地图 API Key
AMAP_API_KEY=your_amap_api_key_here

# 其他服务 API Key
MY_SERVICE_API_KEY=your_api_key_here
```

### 3. 添加节点类型映射

在 `executeGraph.ts` 的 `NODE_TYPE_TO_MCP_TOOL` 中添加：

```typescript
const NODE_TYPE_TO_MCP_TOOL = {
  // ... 已有映射
  
  // 新服务的工具映射
  "我的操作": {
    tool: "myservice:tool_name",
    paramsMapper: (params) => ({
      param1: String(params.param1 ?? ""),
      param2: Number(params.param2 ?? 0)
    })
  }
};
```

## 工具命名规范

工具名称格式：`服务名:工具名`

示例：
- `drone:takeoff` - 无人机起飞
- `amap:maps_geo` - 高德地址解析
- `amap:maps_direction_driving` - 高德路径规划

## 高德地图 MCP 服务

### 获取 API Key

1. 访问 [高德开放平台](https://lbs.amap.com/)
2. 注册/登录账号
3. 创建应用，获取 Web 服务 API Key

### 可用工具

| 工具名　　　　　　　　　 | 描述　　　　 | 参数　　　　　　　　　　　　　　 |
| --------------------------| --------------| ----------------------------------|
| `maps_geo`　　　　　　　 | 地址解析　　 | `address`: 地址字符串　　　　　　|
| `maps_regeo`　　　　　　 | 逆地址解析　 | `location`: 经纬度　　　　　　　 |
| `maps_direction_driving` | 驾车路径规划 | `origin`, `destination`　　　　　|
| `maps_direction_walking` | 步行路径规划 | `origin`, `destination`　　　　　|
| `maps_around`　　　　　　| 周边搜索　　 | `location`, `keywords`, `radius` |
| `maps_weather`　　　　　 | 天气查询　　 | `city`　　　　　　　　　　　　　 |

### 在工作流中使用

创建包含地图服务的工作流节点：

```json
{
  "id": "node_geo",
  "type": "地址解析",
  "label": "解析目标地址",
  "params": {
    "address": "北京市朝阳区望京SOHO"
  }
}
```

## API 端点

### 查看 MCP 服务状态

```
GET /api/mcp/status
```

返回：
```json
{
  "status": {
    "drone": { "connected": true, "toolCount": 10 },
    "amap": { "connected": true, "toolCount": 8 }
  },
  "tools": [...],
  "totalTools": 18
}
```

## 最佳实践

1. **按需启用服务**：只在 `mcp-config.ts` 中启用需要的服务
2. **环境变量管理**：敏感信息使用环境变量
3. **错误处理**：MCP 调用失败时会自动降级到模拟执行
4. **工具前缀**：使用服务前缀避免工具名冲突
5. **连接复用**：MCPManager 自动管理连接，避免重复连接

## 故障排查

1. **服务连接失败**
   - 检查命令是否正确
   - 检查环境变量是否设置
   - 查看控制台日志

2. **工具调用失败**
   - 确认工具名格式正确（`服务名:工具名`）
   - 检查参数是否完整
   - 系统会自动降级到模拟执行

3. **API Key 无效**
   - 确认 `.env.local` 中的 Key 正确
   - 检查 Key 的权限和配额
