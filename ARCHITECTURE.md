# Drone Workflow 系统架构文档

> 最后更新：2026-02-09

---

## 一、系统总览

```
┌─────────────────────────────────────────────────────────────┐
│                        浏览器（React）                          │
│  store/useAppStore ─ store/useAuthStore ─ lib/client/api       │
│  components/ ─ app/login ─ app/register ─ app/page             │
└──────────────┬──────────────────────────────────────────────┘
               │ HTTP / WebSocket
┌──────────────┴──────────────────────────────────────────────┐
│              server.ts（端口 3000）                              │
│  Next.js + Express + Socket.IO + AppEventBus                    │
│  ├── app/api/workflow/execute  统一执行入口（单机/多机）         │
│  ├── TaskOrchestrator         任务编排器                     │
│  ├── SubMissionRunner(s)      子任务执行器（每架无人机一个）     │
│  ├── DroneChannel(s)          无人机消息通道（每架一个）       │
│  └── AppEventBus → Socket.IO   事件桥接 + 多级房间推送       │
└──────────────┬──────────────────────────────────────────────┘
               │ stdio (MCP 协议)
┌──────────────┴──────────────────────────────────────────────┐
│         mcp-client-typescript（MCP Server 进程）                │
│  src/tools.ts ─ resolveDroneId()（显式 droneId 优先）         │
│  src/httpDroneClient.ts → HTTP 调用 drone-control-service      │
└──────────────┬──────────────────────────────────────────────┘
               │ HTTP (端口 4010) + SSE 事件推送
┌──────────────┴──────────────────────────────────────────────┐
│         drone-control-service（无人机控制服务）                  │
│  routes/ → services/ → adapters/ → 真实/模拟无人机              │
│  EventBus → SSE /api/v1/events → 遥测/命令状态推送            │
└─────────────────────────────────────────────────────────────┘
```

---

## 二、目录结构

```
droneworkflow/
├── server.ts                    # 应用入口（Next.js + Express + Socket.IO）
├── middleware.ts                 # Next.js 路由中间件（公开/保护路径）
├── package.json
├── tsconfig.json
├── tailwind.config.ts
├── vitest.config.ts
├── playwright.config.ts
│
├── app/                         # Next.js App Router
│   ├── layout.tsx               # 根布局
│   ├── page.tsx                 # 首页（AuthGuard 保护）
│   ├── globals.css
│   ├── login/page.tsx           # 登录页
│   ├── register/page.tsx        # 注册页
│   └── api/                     # API 路由
│       ├── auth/                # 认证（login/register/refresh/me）
│       ├── chat/                # 聊天历史（CRUD + sessions）
│       ├── llm/                 # LLM 解析（parse + stream）
│       ├── workflow/            # 工作流（save/list/execute/state/[id]）
│       └── mission/             # 任务（list/[id]）
│
├── components/                  # React 组件
│   ├── AuthGuard.tsx            # 认证守卫
│   ├── ChatPanel.tsx            # 聊天面板
│   ├── WorkflowCanvas.tsx       # 工作流画布（ReactFlow）
│   ├── NodeLibrary.tsx          # 节点库
│   ├── NodeEditor.tsx           # 节点编辑器
│   ├── EdgeEditor.tsx           # 边编辑器
│   ├── ContextMenu.tsx          # 右键菜单
│   ├── LogPanel.tsx             # 日志面板
│   ├── WorkflowHistory.tsx      # 工作流历史
│   └── HistoryPanel.tsx         # 历史面板
│
├── store/                       # 前端状态管理（Zustand）
│   ├── useAppStore.ts           # 应用状态（消息/工作流/任务）
│   └── useAuthStore.ts          # 认证状态（用户/Token/持久化）
│
├── lib/
│   ├── types.ts                 # 共享类型定义
│   ├── socket.ts                # Socket.IO 客户端单例
│   ├── client/
│   │   └── api.ts               # 前端 API 封装（fetch + SSE）
│   └── server/
│       ├── db.ts                # MongoDB 连接
│       ├── llm.ts               # LLM 实例管理（DeepSeek）
│       ├── llmParse.ts          # LLM 工作流解析（非流式）
│       ├── llmPrompts.ts        # 共享提示词 + Mock 工作流 + JSON 解析
│       ├── cache.ts             # 内存缓存（LLM 结果）
│       ├── event-bus.ts         # 全局事件总线（AppEventBus）
│       ├── drone-channel.ts     # 单架无人机消息通道（DroneChannel）
│       ├── sub-mission-runner.ts # 子任务执行器（SubMissionRunner）
│       ├── task-orchestrator.ts # 统一任务编排器（TaskOrchestrator）
│       ├── missionStore.ts      # 任务内存存储（支持父子任务）
│       ├── executeGraph.ts      # 工作流执行入口（薄代理层，委托 TaskOrchestrator）
│       ├── auth/                # 认证模块
│       │   ├── index.ts
│       │   ├── jwt.ts           # JWT 签发/验证
│       │   └── password.ts      # 密码哈希/验证
│       ├── middleware/          # API 中间件
│       │   ├── index.ts
│       │   ├── auth.ts          # 认证中间件（withAuth/withAdminAuth）
│       │   └── error.ts         # 错误处理（AppError + createErrorResponse）
│       ├── models/              # Mongoose 模型
│       │   ├── index.ts
│       │   ├── User.ts
│       │   ├── Workflow.ts
│       │   ├── Mission.ts
│       │   └── ChatHistory.ts
│       └── mcp/                 # MCP 客户端管理
│           ├── index.ts         # 统一导出
│           ├── types.ts         # 类型定义
│           ├── client.ts        # 单客户端封装（MCPClient）
│           ├── mcp-manager.ts   # 多服务管理器（MCPManager）
│           ├── mcp-config.ts    # 服务配置管理
│           ├── tool-registry.ts # 工具注册表
│           └── error-handler.ts # 错误分类 + 重试
│
├── mcp-client-typescript/       # MCP Server（独立进程）
│   ├── src/
│   │   ├── index.ts             # MCP Server 入口（stdio 传输）
│   │   ├── tools.ts             # 无人机工具定义（resolveDroneId 显式优先）
│   │   ├── resources.ts         # 静态资源（能力/模板/节点类型）
│   │   └── httpDroneClient.ts   # HTTP 客户端（调用 drone-control-service）
│   ├── package.json
│   └── tsconfig.json
│
├── drone-control-service/       # 无人机控制服务（独立进程）
│   ├── src/
│   │   ├── index.ts             # Express 入口（端口 4010）
│   │   ├── domain/
│   │   │   ├── types.ts         # Device/Telemetry/Command 类型
│   │   │   └── errors.ts        # ServiceError 错误类
│   │   ├── infra/
│   │   │   ├── store.ts         # 内存存储（MemoryStore）
│   │   │   └── event-bus.ts     # 事件总线（EventBus）
│   │   ├── adapters/
│   │   │   ├── droneAdapter.ts  # DroneAdapter 抽象接口
│   │   │   └── mockAdapter.ts   # 模拟适配器
│   │   ├── services/
│   │   │   └── droneService.ts  # 业务编排（集成 EventBus）
│   │   └── routes/
│   │       ├── drones.ts        # 设备管理路由
│   │       ├── commands.ts      # 命令下发路由
│   │       └── events.ts        # SSE 事件推送端点
│   ├── package.json
│   └── tsconfig.json
│
├── __tests__/                   # 测试
│   ├── setup.ts                 # 全局配置（MSW + Mock）
│   ├── mocks/                   # MSW Mock 处理器
│   ├── unit/                    # 单元测试
│   └── integration/             # 集成测试
│
└── e2e/                         # Playwright E2E 测试
```

---

## 三、功能模块详细架构

### 3.1 认证模块

```
浏览器
  │
  ├── app/login/page.tsx ──POST──→ app/api/auth/login/route.ts
  ├── app/register/page.tsx ─POST─→ app/api/auth/register/route.ts
  │                                      │
  │                                      ▼
  │                              lib/server/auth/
  │                              ├── jwt.ts (signToken/verifyToken/generateTokenPair)
  │                              └── password.ts (hashPassword/verifyPassword)
  │                                      │
  │                                      ▼
  │                              lib/server/models/User.ts (MongoDB)
  │
  ├── store/useAuthStore.ts ←── Token 持久化 (localStorage)
  └── components/AuthGuard.tsx ←── 路由保护
```

**关键设计**：
- JWT 双 Token（Access 2h + Refresh 7d）
- 密码使用 PBKDF2 + SHA512 哈希
- `withAuth()` / `withAdminAuth()` 中间件保护 API
- `AuthGuard` 组件保护前端页面

---

### 3.2 LLM 工作流解析模块

```
用户输入自然语言
  │
  ├── 非流式 ──→ app/api/llm/parse/route.ts
  │                  │
  │                  ▼
  │              lib/server/llmParse.ts
  │                  ├── 检查缓存 (lib/server/cache.ts)
  │                  ├── LLM 可用 → parseWithLLM() → DeepSeek API
  │                  └── LLM 不可用 → createMockWorkflow()
  │
  └── 流式 ────→ app/api/llm/stream/route.ts
                     ├── SSE 流式输出
                     ├── LLM 可用 → getLLM().stream() → DeepSeek API
                     └── LLM 不可用 → createMockWorkflow()
                     │
                     ▼
                 共享模块: lib/server/llmPrompts.ts
                 ├── WORKFLOW_SYSTEM_PROMPT (统一提示词)
                 ├── createMockWorkflow()  (降级 Mock)
                 └── extractWorkflowJSON() (JSON 解析)
```

**关键设计**：
- 提示词和 Mock 逻辑统一在 `llmPrompts.ts`，避免重复
- 支持流式/非流式两种调用方式
- 内存缓存避免重复 LLM 调用（10 分钟 TTL）
- LLM 不可用时自动降级到 Mock 数据

---

### 3.3 工作流执行引擎（多无人机编排）

```
app/api/workflow/execute/route.ts
  │
  ├── 单机格式: { workflow, droneId? }
  └── 多机格式: { drones: [{droneId, workflow},...], strategy?, failurePolicy? }
  │
  ▼
lib/server/executeGraph.ts（薄代理层）
  ├── startExecution()        ← 单机兼容入口
  └── startMultiDroneExecution() ← 多机入口
  │
  ▼
lib/server/task-orchestrator.ts（TaskOrchestrator）
  │
  ├── execute(request)
  │     ├── 创建父任务 + 子任务列表
  │     ├── 订阅子任务事件 → 聚合进度
  │     └── 根据 strategy 启动 SubMissionRunner(s)
  │           ├── parallel: Promise.allSettled
  │           └── sequential: 依次执行
  │
  ▼
lib/server/sub-mission-runner.ts（SubMissionRunner）
  │  ← 不知道自己是单机还是多机场景
  ├── BFS 遍历工作流图
  ├── 通过 DroneChannel 执行节点
  ├── NODE_TYPE_TO_MCP_TOOL 映射表
  ├── MCP 失败时降级模拟
  └── 条件分支评估
  │
  ▼
lib/server/drone-channel.ts（DroneChannel）
  ├── callTool(name, args) → 自动注入 droneId
  ├── emitLog/emitProgress/emitStatus → AppEventBus
  └── 维护单架无人机的 DroneState
```

**关键设计**：
- **单机是多机的特例**：单机 = 1 个子任务的编排，代码路径完全一致
- **高内聚**：DroneChannel（通信）、SubMissionRunner（执行）、TaskOrchestrator（编排）各司其职
- **低耦合**：模块间通过 AppEventBus 事件通信，不直接引用
- 节点类型 → MCP 工具的声明式映射
- MCP 不可用时自动降级到本地模拟
- 支持 parallel/sequential 执行策略和 fail_fast/continue 失败策略

---

### 3.4 MCP 多服务管理

```
lib/server/mcp/
  │
  ├── mcp-config.ts ←── 服务配置（drone/amap/weather/filesystem）
  │     └── MCPConfigManager (动态添加/移除/启用/禁用)
  │
  ├── client.ts ←── 单客户端封装
  │     └── MCPClient (连接/断开/重连/工具发现/工具调用/指标)
  │
  ├── mcp-manager.ts ←── 多服务管理器
  │     └── MCPManager (并行初始化/自动检测服务/工具查询/健康检查)
  │
  ├── tool-registry.ts ←── 工具注册表
  │     └── MCPToolRegistry (注册/查找/搜索/按服务分组)
  │
  ├── error-handler.ts ←── 错误处理
  │     ├── classifyError() (自动分类错误类型)
  │     ├── withRetry() (指数退避重试)
  │     └── formatMCPError() (格式化错误信息)
  │
  └── types.ts ←── 类型定义
        ├── MCPServerConfig / MCPServerInstance
        ├── MCPToolInfo / MCPToolCallResult
        ├── MCPError / MCPErrorCode / RetryConfig
        ├── MCPHealthStatus / MCPManagerStatus
        └── MCPEvent / MCPEventHandler
```

**关键设计**：
- 单例 `mcpManager` 统一管理所有 MCP 服务
- 支持动态添加/移除服务器
- 工具注册表支持跨服务搜索
- 内置重试、超时、指标收集
- 事件系统支持监听连接/工具调用事件

---

### 3.5 无人机控制链路（多机并发安全）

```
DroneChannel (droneId="d1")
  │ callTool("drone:takeoff", {altitude: 30})
  │ 自动注入 droneId → {droneId:"d1", altitude:30}
  ▼
mcpManager.callToolAuto()
  │ 解析 "drone:takeoff" → 服务名 "drone" + 工具名 "takeoff"
  ▼
MCPClient (stdio 传输)
  │ MCP 协议调用
  ▼
mcp-client-typescript/src/tools.ts
  │ resolveDroneId(params) → 显式 droneId 优先
  │ httpDroneClient.sendCommand("d1", "takeoff", ...)
  ▼
drone-control-service (HTTP :4010)
  │ routes/commands.ts → services/droneService.ts
  │ → adapters/mockAdapter.ts (或真实适配器)
  │ → EventBus.publish(telemetry + command_status)
  ▼                          │
无人机硬件 / 模拟器            │ SSE /api/v1/events
                              ▼
                        server.ts SSE Consumer
                              │
                              ▼
                        AppEventBus → Socket.IO
                        io.to("drone:d1").emit("drone:telemetry")
```

**关键设计**：
- `resolveDroneId()` 机制：显式 droneId 优先，兼容单机 activeDroneId
- 多机并发安全：每个子任务通过 DroneChannel 隔离，不共享全局状态
- 适配器模式：`DroneAdapter` 接口，可替换 Mock/DJI/PX4
- 命令幂等性：通过 `idempotencyKey` 防止重复执行
- 遥测实时推送：EventBus → SSE → AppEventBus → Socket.IO
- 设备状态自动推进：命令执行后根据结果更新设备状态

---

### 3.6 前端状态管理

```
store/
├── useAppStore.ts
│   ├── model          当前 LLM 模型
│   ├── messages[]     聊天消息
│   ├── history[]      工作流历史
│   ├── workflow       当前工作流
│   ├── activeMissionId 当前任务 ID
│   └── missionState   任务执行状态
│
└── useAuthStore.ts (持久化)
    ├── user           当前用户
    ├── accessToken    访问令牌
    ├── refreshToken   刷新令牌
    ├── isAuthenticated 认证状态
    ├── login()        登录
    ├── register()     注册
    ├── logout()       登出
    └── refreshTokens() 刷新令牌
```

---

### 3.7 数据模型

```
MongoDB Collections:
├── users           { email, password, name, role, createdAt }
├── workflows       { name, description, nodes[], edges[], createdAt }
├── missions        { missionId, workflowSnapshot, status, progress, logs[],
│                     subMissions[], strategy, startedAt, completedAt }
└── chathistories   { sessionId, messages[], workflowId }
```

---

### 3.8 多无人机消息分发架构

```
                        父任务房间: parent:xxx
                              │
              ┌───────────────┼───────────────┐
              ▼               ▼               ▼
        sub_0 房间       sub_1 房间       sub_2 房间
        drone-001        drone-002        drone-003
              │               │               │
              ▼               ▼               ▼
        子任务日志        子任务日志        子任务日志
        子任务进度        子任务进度        子任务进度
              │               │               │
              └───────┬───────┘               │
                      ▼                       │
              进度聚合器 ◄────────────────┘
              (TaskOrchestrator)
                      │
                      ▼
              io.to("parent:xxx").emit("mission:aggregate")

Socket.IO 房间类型：
  - mission:{missionId}     单个任务/子任务日志+状态
  - parent:{missionId}      父任务聚合事件
  - drone:{droneId}         无人机遥测数据
```

**并发安全保障**：

| 层级 | 机制 | 说明 |
|------|------|------|
| MCP 层 | 显式 `droneId` 参数 | 不再依赖全局状态，天然并发安全 |
| 执行层 | `Promise.allSettled` 并行 | 一架失败不阻塞其他 |
| 控制服务 | `MemoryStore` 按 droneId 索引 | Node.js 单线程无竞态 |
| 命令层 | `idempotencyKey` | 网络重试不重复执行 |
| 推送层 | Socket.IO 多级房间 | 日志/状态推送不串台 |
| 遥测层 | SSE → AppEventBus → Socket.IO | 毫秒级遥测推送 |

---

## 四、环境变量

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `PORT` | `3000` | 主应用端口 |
| `MONGODB_URI` | `mongodb://localhost:27017/droneworkflow` | MongoDB 连接 |
| `DEEPSEEK_API_KEY` | - | DeepSeek LLM API Key |
| `DEEPSEEK_BASE_URL` | `https://api.deepseek.com` | DeepSeek API 地址 |
| `JWT_SECRET` | `drone-workflow-secret-key...` | JWT 签名密钥 |
| `JWT_REFRESH_SECRET` | `drone-workflow-refresh-secret-key` | Refresh Token 密钥 |
| `AMAP_API_KEY` | - | 高德地图 API Key |
| `DRONE_CONTROL_BASE_URL` | `http://127.0.0.1:4010` | 无人机控制服务地址 |
| `DRONE_CONTROL_API_KEY` | - | 无人机控制服务 API Key |

---

## 五、启动方式

```bash
# 1. 启动 MongoDB
mongod

# 2. 启动无人机控制服务
cd drone-control-service && npm run dev    # 端口 4010

# 3. 启动主应用（自动启动 MCP Server）
cd .. && npm run dev                       # 端口 3000
```

---

## 六、技术栈

| 层级 | 技术 |
|------|------|
| 前端框架 | Next.js 15 + React 19 |
| 状态管理 | Zustand |
| 工作流画布 | ReactFlow |
| 样式 | TailwindCSS |
| 后端框架 | Express + Next.js API Routes |
| 实时通信 | Socket.IO |
| AI 编排 | LangGraph + LangChain |
| LLM | DeepSeek (OpenAI 兼容) |
| MCP | @modelcontextprotocol/sdk |
| 数据库 | MongoDB + Mongoose |
| 认证 | 自定义 JWT (HMAC-SHA256) |
| 测试 | Vitest + Testing Library + MSW + Playwright |
| 语言 | TypeScript |
