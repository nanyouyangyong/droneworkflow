# Drone Workflow 项目 Owner 文档

## 一、渲染模式判断

> **结论：本项目是 CSR（Client-Side Rendering）客户端渲染**，不是 SSG、ISR 或 SSR。

### 判断依据

| 判断维度 | 代码证据 | 结论 |
|---------|---------|------|
| 页面指令 | `app/page.tsx`、`app/login/page.tsx`、`app/register/page.tsx` 顶部均声明 `"use client"` | 客户端组件 |
| 数据获取 | 无 `getServerSideProps`、`getStaticProps`、`generateStaticParams`，也无 `fetch + revalidate` | 无服务端数据预取 |
| 布局层 | `app/layout.tsx` 是唯一的 Server Component，仅输出静态 HTML 壳（`<html><body>`），不做数据获取 | 仅壳层为 SC |
| 状态管理 | 全部依赖 Zustand（客户端内存状态）+ `useEffect`/`useState` 驱动 | 纯客户端逻辑 |
| 路由 | 使用 `useRouter()`（`next/navigation`）做客户端导航 | 客户端路由 |
| next.config.mjs | 仅配置 `reactStrictMode: true`，无 `output: 'export'`（SSG）也无 `revalidate` 配置 | 无静态导出 |
| 自定义服务器 | `server.ts` 使用 Express + Socket.IO 包裹 Next.js，`app.getRequestHandler()` 处理所有请求 | 自定义 Node.js 服务器 |

### 四种模式对比

**SSG（Static Site Generation）**
- ✗ 无 `generateStaticParams` / `getStaticProps`
- ✗ 无 `output: 'export'`
- ✗ 页面内容完全依赖客户端状态，无法构建时确定

**ISR（Incremental Static Regeneration）**
- ✗ 无 `revalidate` 配置
- ✗ 无 `fetch(..., { next: { revalidate: N } })`
- ✗ 页面不存在"可缓存后定期更新"的场景

**SSR（Server-Side Rendering）**
- ✗ 所有页面组件都标记 `"use client"`
- ✗ 无服务端数据获取（`async Server Component` / `getServerSideProps`）
- ✗ `layout.tsx` 虽是 Server Component，但不获取数据

**CSR（Client-Side Rendering） ← 本项目**
- ✓ 所有页面 `"use client"`
- ✓ 浏览器端 `fetch` API + Zustand 管理状态
- ✓ 首屏加载空壳 HTML，JS 加载后渲染内容

### 为什么选择 CSR？

这是一个**重交互的工具型应用**（工作流编辑器 + 实时聊天 + WebSocket 推送），不是内容展示型网站。页面内容完全由用户操作和实时数据驱动，SEO 无意义，CSR 是最合理的选择。Next.js 在这里的价值不在于渲染模式，而在于：

- **App Router** 提供的文件系统路由
- **API Routes** 作为 BFF 层
- **构建优化**（代码分割、Tree Shaking）
- **TypeScript 一体化**（前后端共享类型）

---

## 二、项目 Owner 视角的完整介绍

### 2.1 项目背景

#### 行业痛点

无人机行业正从"单机手动操控"向"多机自动化编排"演进，但现有方案存在三个核心问题：

1. **任务编排门槛高**：操作员需要手动编写飞行脚本或使用专业 GCS（地面站），学习成本极高
2. **多机协同困难**：多架无人机的任务分配、并行执行、状态同步缺乏统一管理
3. **实时监控割裂**：任务编排、执行监控、日志分析分散在不同工具中

#### 项目定位

Drone Workflow 是一个**基于自然语言的无人机智能工作流编排系统**，核心理念是：

> 用户说一句话 → AI 生成工作流 → 可视化调整 → 一键执行 → 实时监控

**目标用户**：无人机巡检团队、农业植保团队、应急搜救指挥中心。

#### 核心价值

- **降低门槛**：自然语言 → 工作流，非技术人员也能编排复杂任务
- **多机统一**：单机和多机使用同一套代码路径，"单机是多机的特例"
- **全链路可视**：从任务生成到执行完成，全程可视化 + 实时日志

### 2.2 技术选型及理由

#### 前端技术栈

| 技术 | 选型理由 | 备选方案 & 放弃原因 |
|------|---------|-------------------|
| Next.js 15 | App Router + API Routes 实现全栈一体化，减少部署复杂度 | Vite + Express：前后端分离增加运维成本 |
| React 19 | 生态最成熟，ReactFlow 依赖 React | Vue 3：ReactFlow 无 Vue 版本 |
| ReactFlow 11 | 专业的工作流/DAG 可视化库，支持自定义节点、拖拽、连线 | D3.js：太底层，开发成本高；JointJS：商业授权 |
| Zustand | 轻量级状态管理，API 简洁，无 boilerplate | Redux Toolkit：过重；Jotai：原子化不适合全局状态 |
| TailwindCSS | 原子化 CSS，开发效率高，与 Next.js 深度集成 | CSS Modules：可维护性不如 Tailwind |
| Socket.IO Client | 与服务端 Socket.IO 配套，自动重连、房间机制 | 原生 WebSocket：缺少房间、重连等高级特性 |

#### 后端技术栈

| 技术 | 选型理由 | 备选方案 & 放弃原因 |
|------|---------|-------------------|
| Express | 自定义服务器，集成 Socket.IO，成熟稳定 | Fastify：Socket.IO 集成不如 Express 成熟 |
| Socket.IO | 多级房间（mission/parent/drone）+ 自动重连 + 广播 | ws：功能太基础，需自行实现房间和重连 |
| LangChain + LangGraph | LLM 编排框架，支持流式输出、链式调用 | 直接调用 OpenAI SDK：缺少编排能力和提示词管理 |
| DeepSeek | OpenAI 兼容 API，性价比高，中文能力强 | GPT-4：成本高；Claude：API 不兼容 |
| MongoDB + Mongoose | 文档型数据库，Schema 灵活，适合工作流 JSON 存储 | PostgreSQL：工作流结构变化频繁，关系型不灵活 |
| MCP SDK | Model Context Protocol 标准化工具调用，可扩展多种外部服务 | 自定义 RPC：缺乏标准化，不利于生态扩展 |
| Zod | 运行时类型校验，与 TypeScript 类型系统互补 | Joi：TypeScript 类型推导不如 Zod |

#### 独立服务

| 服务 | 选型理由 |
|------|---------|
| drone-control-service（端口 4010） | 无人机控制逻辑独立部署，适配器模式支持 Mock/真实硬件切换，SSE 推送遥测数据 |
| mcp-client-typescript（stdio 进程） | MCP Server 独立进程，通过 stdio 与主应用通信，崩溃不影响主进程 |

### 2.3 技术方案研讨与确定

#### 方案一（初始方案）：单体 + 单机

```
用户 → LLM → 工作流 → 直接执行 → 日志
```

**问题**：无法支持多机、无人机控制逻辑与业务逻辑耦合。

#### 方案二（演进方案）：分层 + MCP + 多机

经过研讨，确定了当前的分层架构：

```
┌─ 表现层 ─┐   ┌─ 编排层 ─┐   ┌─ 通信层 ─┐   ┌─ 控制层 ─┐
│ ReactFlow │ → │ TaskOrch │ → │ MCP/Channel│ → │ drone-svc│
│ ChatPanel │   │ SubRunner│   │ EventBus  │   │ Adapter  │
└──────────┘   └─────────┘   └──────────┘   └─────────┘
```

#### 关键决策记录

| 决策点 | 方案 A | 方案 B | 最终选择 | 理由 |
|-------|--------|--------|---------|------|
| 多机执行模型 | 全局 `activeDroneId` 切换 | 每架无人机独立 `DroneChannel` | B | A 有并发竞态风险 |
| 工作流 ↔ 画布同步 | 单向（workflow → canvas） | 双向同步 + `internalEditRef` 防循环 | B | 用户需要在画布上编辑后同步回 workflow |
| LLM 降级策略 | 无 LLM 则报错 | Mock 工作流自动降级 | B | 开发/演示阶段不依赖 LLM 也能运行 |
| 无人机控制 | 内嵌在主应用 | 独立 `drone-control-service` | 独立服务 | 解耦硬件适配，独立部署和测试 |
| 事件通信 | 直接函数调用 | `AppEventBus` 发布-订阅 | EventBus | 低耦合，模块间不直接引用 |

### 2.4 研发计划制定

#### 制定原则

- **MVP 优先**：先跑通核心链路（对话 → 生成 → 执行 → 日志），再扩展
- **垂直切片**：每个阶段交付可演示的完整功能，而非水平分层开发
- **风险前置**：最难的模块（多机编排、MCP 集成）放在中期，留足缓冲

#### 研发阶段

| 阶段 | 周期 | 交付物 | 里程碑 |
|------|------|--------|-------|
| P0：基础框架 | 第 1-2 周 | Next.js 脚手架、认证系统（JWT）、四栏布局、ReactFlow 静态画布 | 可登录、可看到空画布 |
| P1：AI 对话 + 工作流生成 | 第 3-4 周 | ChatPanel 流式对话、LLM 解析、Mock 降级、工作流可视化渲染 | 说一句话 → 画布出现工作流 |
| P2：画布交互 | 第 5-6 周 | 节点库拖拽、节点/边编辑器、右键菜单、双向同步、键盘操作 | 可手动编辑工作流 |
| P3：单机执行引擎 | 第 7-8 周 | SubMissionRunner、MCP 集成、drone-control-service、实时日志推送 | 单机工作流可执行 |
| P4：多机编排 | 第 9-10 周 | TaskOrchestrator、DroneChannel、EventBus、多级 Socket.IO 房间、并行/顺序策略 | 多机并行执行 |
| P5：完善 + 测试 | 第 11-12 周 | 工作流历史、聊天历史、Vitest 单元测试、Playwright E2E、Bug 修复 | 可交付版本 |

#### 风险管控

| 风险 | 概率 | 影响 | 应对措施 |
|------|------|------|---------|
| LLM API 不稳定 | 高 | 中 | Mock 降级机制，`createMockWorkflow()` 保证离线可用 |
| 真实无人机硬件不可用 | 高 | 低 | 适配器模式，`MockAdapter` 模拟全部行为 |
| 双向同步死循环 | 中 | 高 | `lastSyncedWorkflowStrRef` + `internalEditRef` 双重防护 |
| MCP 进程崩溃 | 中 | 中 | 独立 stdio 进程，崩溃不影响主应用，自动降级模拟 |

### 2.5 最难的功能模块及解决方案

#### 🏆 最难模块：多无人机全链路编排（TaskOrchestrator + SubMissionRunner + DroneChannel）

##### 难点分析

这个模块之所以最难，是因为它同时涉及 **5 个维度**的复杂性：

##### 难点 1：单机/多机统一抽象

需要设计一套代码路径同时处理单机和多机场景，不能有 `if (isSingleDrone)` 的分叉逻辑。

**解决方案**：

设计原则："单机是多机的特例"

```
单机 = TaskRequest { drones: [{ droneId, workflow }] }  // 长度为 1
多机 = TaskRequest { drones: [{ ... }, { ... }, ...] }   // 长度为 N

TaskOrchestrator 不区分单机/多机，统一创建 SubMissionRunner[]
```

核心代码体现在 `task-orchestrator.ts`：

```typescript
// 无论单机还是多机，都走同一条路径
const subMissions = drones.map((d, idx) => ({
  subMissionId: `${missionId}_sub_${idx}`,
  droneId: d.droneId,
  workflow: d.workflow,
  ...
}));
```

##### 难点 2：并发安全（多架无人机同时执行）

多个 SubMissionRunner 并行执行时，不能共享全局状态，否则会出现竞态条件。

**解决方案**：

| 层级 | 隔离机制 |
|------|---------|
| 执行层 | 每架无人机独立 `SubMissionRunner` 实例 |
| 通信层 | 每架无人机独立 `DroneChannel` 实例，自动注入 `droneId` |
| MCP 层 | `resolveDroneId(params)` 显式 `droneId` 优先，替代全局 `activeDroneId` 单例 |
| 控制服务 | `MemoryStore` 按 `droneId` 索引，Node.js 单线程无竞态 |
| 推送层 | Socket.IO 多级房间（`mission:xxx`、`parent:xxx`、`drone:xxx`），日志不串台 |

##### 难点 3：工作流图遍历 + 条件分支

工作流不是简单的线性列表，而是 **DAG（有向无环图）**，包含条件分支和并行分支。

**解决方案**：SubMissionRunner 使用 BFS 图遍历：

1. 从 `start` 节点开始，入队
2. 出队一个节点，执行对应的 MCP 工具
3. 如果是条件节点，评估条件，选择正确的出边
4. 将后继节点入队
5. 重复直到队列为空或遇到 `end` 节点

节点类型到 MCP 工具的映射采用声明式配置（`NODE_TYPE_TO_MCP_TOOL`），新增节点类型只需添加一行映射。

##### 难点 4：事件聚合与进度计算

父任务需要实时聚合所有子任务的进度，并推送给前端。

**解决方案**：

```
SubMissionRunner → DroneChannel.emitProgress()
                        ↓
                   AppEventBus.publish({ type: "mission:progress" })
                        ↓
              TaskOrchestrator.subscribeSubMissionEvents()
                        ↓
              聚合进度 = Σ(子任务进度) / 子任务数量
                        ↓
              AppEventBus.publish({ type: "mission:aggregate" })
                        ↓
              server.ts EventBus→Socket.IO 桥接
                        ↓
              io.to("parent:xxx").emit("mission:aggregate")
                        ↓
                   前端 LogPanel 更新
```

##### 难点 5：失败策略与降级

多机场景下，一架无人机失败不应阻塞其他无人机。MCP 不可用时需要降级。

**解决方案**：

- **执行策略**：`parallel`（`Promise.allSettled`，一架失败不阻塞）/ `sequential`（依次执行）
- **失败策略**：`fail_fast`（一架失败立即终止所有）/ `continue`（继续执行其余）
- **MCP 降级**：MCP 工具调用失败时，SubMissionRunner 自动降级到本地模拟执行，记录 warning 日志

---

#### 🥈 第二难模块：工作流画布双向同步

**难点**：ReactFlow 内部状态（nodes/edges）和 Zustand 中的 workflow 需要双向同步，极易产生无限循环。

**解决方案**：

- **`lastSyncedWorkflowStrRef`**：JSON 字符串去重，相同内容不触发同步
- **`internalEditRef`**：标记内部编辑（用户拖拽/编辑节点），跳过 `wfToReactFlow` 重新布局
- 只有外部更新（LLM 生成新工作流）才触发完整的布局重算

---

#### 🥉 第三难模块：流式 AI 对话 + 思考过程保留

**难点**：LLM 流式输出需要实时显示，完成后需要保留思考过程，且不能出现重复消息。

**解决方案**：

- **`thinkingRef`（useRef）**：保存最新思考内容，避免闭包陷阱
- 流式期间不 `addMessage`，只更新 `streamingContent` 状态
- `onComplete` 时一次性 `addMessage`，将思考过程嵌入 `<think>` 标签

---

## 总结

本项目的技术难度集中在**"多层抽象的一致性"**——从用户说一句话到多架无人机并行执行，跨越了 AI 解析、可视化编辑、任务编排、MCP 通信、硬件控制 5 个层次，每一层都需要正确的抽象边界和可靠的错误处理。