# 测试架构文档

## 一、Vitest 原理简介

### 1.1 什么是 Vitest

**Vitest** 是一个基于 Vite 的现代测试框架，专为 Vite 项目设计，具有以下特点：

- **极速启动**：复用 Vite 的转换管道，无需额外配置
- **原生 ESM**：支持 ES Modules，与现代前端工具链无缝集成
- **智能热更新**：只重新运行受影响的测试
- **兼容 Jest**：API 与 Jest 高度兼容，迁移成本低

### 1.2 核心工作原理

```
┌─────────────────────────────────────────────────────────────────┐
│                        Vitest 执行流程                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│   1. 配置解析          2. 文件收集           3. 测试执行          │
│   ┌─────────┐         ┌─────────┐          ┌─────────┐         │
│   │ vitest  │ ──────► │ glob    │ ───────► │ runner  │         │
│   │ config  │         │ pattern │          │ worker  │         │
│   └─────────┘         └─────────┘          └─────────┘         │
│        │                   │                    │               │
│        ▼                   ▼                    ▼               │
│   ┌─────────┐         ┌─────────┐          ┌─────────┐         │
│   │  Vite   │         │  Test   │          │ Report  │         │
│   │ Plugin  │         │  Files  │          │ Output  │         │
│   └─────────┘         └─────────┘          └─────────┘         │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 1.3 关键组件

| 组件 | 作用 |
|------|------|
| **Vite** | 提供模块转换、HMR、别名解析 |
| **happy-dom/jsdom** | 提供浏览器 DOM 环境模拟 |
| **@testing-library** | 提供组件测试工具 |
| **MSW** | 提供 API Mock 服务 |

---

## 二、项目测试架构

### 2.1 目录结构

```
__tests__/
├── setup.ts                    # 全局测试配置（MSW、Mock、环境）
├── infrastructure.test.ts      # 基础设施测试
├── mocks/
│   ├── handlers.ts             # MSW API Mock 处理器
│   └── server.ts               # MSW 服务器实例
├── unit/                       # 单元测试
│   └── store/
│       ├── useAppStore.test.ts
│       └── useAuthStore.test.ts
└── integration/                # 集成测试
    ├── auth/
    │   ├── AuthGuard.test.tsx
    │   ├── LoginPage.test.tsx
    │   └── RegisterPage.test.tsx
    └── chat/
        └── ...
```

### 2.2 架构分层

```
┌────────────────────────────────────────────────────────────────┐
│                         测试金字塔                              │
├────────────────────────────────────────────────────────────────┤
│                                                                 │
│                        ▲  E2E Tests                            │
│                       ╱ ╲  (Playwright)                        │
│                      ╱   ╲  - 完整用户流程                      │
│                     ╱     ╲ - 真实浏览器                        │
│                    ─────────                                    │
│                   ╱         ╲                                   │
│                  ╱ Integration╲  (Vitest + RTL)                │
│                 ╱   Tests      ╲ - 组件交互                     │
│                ╱                ╲ - API Mock                    │
│               ────────────────────                              │
│              ╱                    ╲                             │
│             ╱     Unit Tests       ╲  (Vitest)                 │
│            ╱       - Store          ╲ - 纯函数                  │
│           ╱        - Utils           ╲ - 隔离测试               │
│          ──────────────────────────────                         │
│                                                                 │
└────────────────────────────────────────────────────────────────┘
```

### 2.3 技术栈

| 工具 | 版本 | 用途 |
|------|------|------|
| vitest | ^4.0.18 | 测试运行器 |
| @testing-library/react | ^16.3.2 | React 组件测试 |
| @testing-library/jest-dom | ^6.9.1 | DOM 断言扩展 |
| @testing-library/user-event | ^14.6.1 | 用户事件模拟 |
| happy-dom | ^20.5.0 | DOM 环境模拟 |
| msw | ^2.12.7 | API Mock |
| @playwright/test | ^1.58.1 | E2E 测试 |

---

## 三、配置文件详解

### 3.1 vitest.config.ts

```typescript
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],              // React 支持
  test: {
    environment: 'happy-dom',      // DOM 模拟环境
    setupFiles: ['__tests__/setup.ts'],  // 全局设置
    globals: true,                 // 全局 API (describe, it, expect)
    coverage: {
      provider: 'v8',              // 覆盖率引擎
      reporter: ['text', 'json', 'html'],
      exclude: ['node_modules/', '__tests__/', '*.config.*', '.next/', 'e2e/'],
    },
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, './') },  // 路径别名
  },
});
```

### 3.2 setup.ts 详解

```typescript
// 1. 导入 jest-dom 扩展断言
import '@testing-library/jest-dom';

// 2. MSW 服务器生命周期
beforeAll(() => server.listen());   // 启动 Mock 服务器
afterAll(() => server.close());     // 关闭 Mock 服务器
afterEach(() => {
  server.resetHandlers();           // 重置处理器
  cleanup();                        // 清理 React 渲染
});

// 3. Mock 外部依赖
vi.mock('next/navigation', ...);    // Next.js 路由
vi.mock('socket.io-client', ...);   // Socket.IO
```

---

## 四、测试类型说明

### 4.1 单元测试 (Unit)

**目标**：测试独立的函数、Store、工具类

**示例**：`useAuthStore.test.ts`
```typescript
describe('useAuthStore', () => {
  it('should set auth state correctly', () => {
    const { setAuth } = useAuthStore.getState();
    setAuth(mockUser, 'token', 'refresh');
    
    const state = useAuthStore.getState();
    expect(state.isAuthenticated).toBe(true);
    expect(state.user).toEqual(mockUser);
  });
});
```

### 4.2 集成测试 (Integration)

**目标**：测试组件间交互、API 调用、用户流程

**示例**：`LoginPage.test.tsx`
```typescript
describe('LoginPage', () => {
  it('should login successfully', async () => {
    render(<LoginPage />);
    
    await userEvent.type(screen.getByLabelText('邮箱'), 'test@example.com');
    await userEvent.type(screen.getByLabelText('密码'), 'password123');
    await userEvent.click(screen.getByRole('button', { name: '登 录' }));
    
    await waitFor(() => {
      expect(mockRouter.push).toHaveBeenCalledWith('/');
    });
  });
});
```

### 4.3 E2E 测试 (Playwright)

**目标**：完整用户流程、真实浏览器环境

**位置**：`e2e/` 目录

---

## 五、MSW Mock 系统

### 5.1 工作原理

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   测试代码    │────►│   MSW 拦截   │────►│  Mock 响应   │
│  fetch(url)  │     │  handlers[]  │     │  HttpResponse│
└──────────────┘     └──────────────┘     └──────────────┘
```

### 5.2 handlers.ts 结构

```typescript
export const handlers = [
  // 认证 API
  http.post('/api/auth/login', async ({ request }) => {
    const body = await request.json();
    // 根据输入返回不同响应
    return HttpResponse.json({ success: true, data: {...} });
  }),
  
  // 工作流 API
  http.get('/api/workflow/list', async () => {...}),
  http.post('/api/workflow/save', async () => {...}),
];
```

---

## 六、测试命令

### 6.1 常用命令

| 命令 | 说明 |
|------|------|
| `pnpm test` | 运行所有测试（监听模式） |
| `pnpm test:ui` | 打开可视化测试界面 |
| `pnpm test:coverage` | 生成覆盖率报告 |
| `pnpm test:e2e` | 运行 Playwright E2E 测试 |
| `pnpm test:e2e:ui` | 打开 Playwright UI 模式 |

### 6.2 进阶命令

```bash
# 运行特定文件
pnpm vitest __tests__/unit/store/useAuthStore.test.ts

# 运行匹配模式的测试
pnpm vitest --filter "auth"

# 单次运行（CI 模式）
pnpm vitest run

# 仅运行变更的测试
pnpm vitest --changed

# 更新快照
pnpm vitest -u
```

### 6.3 覆盖率报告

```bash
pnpm test:coverage

# 输出目录
coverage/
├── index.html      # HTML 报告（浏览器打开）
├── coverage.json   # JSON 数据
└── lcov.info       # LCOV 格式
```

---

## 七、测试流程

### 7.1 开发流程

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  编写功能代码 │────►│  编写测试    │────►│  运行测试    │
└─────────────┘     └─────────────┘     └─────────────┘
                                              │
       ┌──────────────────────────────────────┘
       │
       ▼
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   测试失败   │────►│  修复代码    │────►│  重新测试    │
└─────────────┘     └─────────────┘     └─────────────┘
       │
       ▼
┌─────────────┐
│   测试通过   │────► 提交代码
└─────────────┘
```

### 7.2 CI/CD 流程

```yaml
# .github/workflows/test.yml (示例)
jobs:
  test:
    steps:
      - run: pnpm install
      - run: pnpm test run          # 单元/集成测试
      - run: pnpm test:coverage     # 覆盖率
      - run: pnpm test:e2e          # E2E 测试
```

---

## 八、最佳实践

### 8.1 命名规范

- 测试文件：`[组件/模块名].test.ts(x)`
- 描述块：使用中文描述业务场景
- 测试用例：`should [预期行为] when [条件]`

### 8.2 测试原则

1. **AAA 模式**：Arrange（准备）→ Act（执行）→ Assert（断言）
2. **单一职责**：每个测试只验证一个行为
3. **避免实现细节**：测试行为而非实现
4. **保持独立**：测试之间不应相互依赖

### 8.3 Mock 原则

- 只 Mock 外部依赖（API、第三方库）
- 避免过度 Mock 导致测试失去意义
- 使用 `server.use()` 覆盖特定场景

---

## 九、当前测试覆盖

| 模块 | 文件 | 测试数 | 状态 |
|------|------|--------|------|
| Store | useAppStore.test.ts | ~10 | ✅ |
| Store | useAuthStore.test.ts | ~8 | ✅ |
| Auth | AuthGuard.test.tsx | 7 | ✅ |
| Auth | LoginPage.test.tsx | ~8 | ✅ |
| Auth | RegisterPage.test.tsx | ~8 | ✅ |

---

## 十、常见问题

### Q1: 测试中如何处理异步操作？

```typescript
// 使用 waitFor 等待异步更新
await waitFor(() => {
  expect(screen.getByText('成功')).toBeInTheDocument();
});
```

### Q2: 如何 Mock 特定测试的 API 响应？

```typescript
import { server } from '@/__tests__/mocks/server';
import { http, HttpResponse } from 'msw';

it('should handle error', async () => {
  server.use(
    http.post('/api/auth/login', () => {
      return HttpResponse.json({ error: '服务器错误' }, { status: 500 });
    })
  );
  // 测试错误处理逻辑
});
```

### Q3: 如何调试失败的测试？

```typescript
// 打印当前 DOM
screen.debug();

// 打印特定元素
screen.debug(screen.getByRole('button'));
```
