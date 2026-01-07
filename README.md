# Drone Workflow

无人机工作流管理系统 - 使用自然语言生成和执行无人机任务工作流。

## 功能特性

- 🤖 **智能对话**: 使用 DeepSeek LLM 将自然语言指令转换为工作流
- 🎨 **可视化编辑**: 基于 ReactFlow 的工作流画布，支持拖拽编辑
- ⚡ **实时执行**: 使用 LangGraph 执行工作流，实时日志反馈
- 💾 **数据持久化**: MongoDB 存储工作流和执行历史
- 🔌 **WebSocket**: 实时推送执行状态和日志

## 技术栈

- **前端**: Next.js 15, React 19, ReactFlow, TailwindCSS, Zustand
- **后端**: Express, Socket.IO, LangChain, LangGraph
- **数据库**: MongoDB (Mongoose)
- **LLM**: DeepSeek API (兼容 OpenAI 接口)

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 配置环境变量

复制 `.env.example` 为 `.env` 并填写配置：

```bash
cp .env.example .env
```

编辑 `.env` 文件：

```env
# DeepSeek API 配置
DEEPSEEK_API_KEY=your_deepseek_api_key_here
DEEPSEEK_BASE_URL=https://api.deepseek.com

# MongoDB 配置
MONGODB_URI=mongodb://localhost:27017/droneworkflow

# Server
PORT=3000
```

### 3. 启动 MongoDB

确保 MongoDB 服务已启动：

```bash
# macOS (Homebrew)
brew services start mongodb-community

# Windows
net start MongoDB

# Docker
docker run -d -p 27017:27017 --name mongodb mongo:latest
```

### 4. 启动开发服务器

```bash
npm run dev
```

打开浏览器访问: http://localhost:3000

## 使用指南

### 生成工作流

1. 在左侧对话框输入自然语言指令，例如：
   - "巡查A区域并拍照，电量低于30%时返航"
   - "起飞到20米，飞行到指定坐标，悬停10秒后录像"

2. LLM 会自动解析并生成工作流

3. 在画布上查看和编辑工作流

### 编辑工作流

- **双击节点**: 编辑节点参数
- **双击边**: 编辑连接条件
- **右键菜单**: 删除节点/边
- **拖拽节点**: 从节点库拖拽添加新节点

### 执行工作流

1. 点击画布上的"执行"按钮
2. 在右侧日志面板查看实时执行状态

## API 接口

### LLM 解析
- `POST /api/llm/parse` - 解析自然语言指令生成工作流

### 工作流管理
- `GET /api/workflow/list` - 获取工作流列表
- `GET /api/workflow/[id]` - 获取工作流详情
- `POST /api/workflow/save` - 保存工作流
- `DELETE /api/workflow/[id]` - 删除工作流

### 任务执行
- `POST /api/workflow/execute` - 执行工作流
- `GET /api/workflow/state` - 获取执行状态
- `GET /api/mission/list` - 获取任务历史
- `GET /api/mission/[id]` - 获取任务详情

## 项目结构

```
droneworkflow/
├── app/                    # Next.js App Router
│   ├── api/                # API 路由
│   │   ├── llm/            # LLM 解析接口
│   │   ├── workflow/       # 工作流管理接口
│   │   └── mission/        # 任务执行接口
│   ├── page.tsx            # 主页面
│   └── layout.tsx          # 布局
├── components/             # React 组件
│   ├── ChatPanel.tsx       # 对话面板
│   ├── WorkflowCanvas.tsx  # 工作流画布
│   ├── NodeLibrary.tsx     # 节点库
│   ├── WorkflowHistory.tsx # 历史记录
│   └── LogPanel.tsx        # 日志面板
├── lib/
│   ├── server/             # 服务端逻辑
│   │   ├── db.ts           # MongoDB 连接
│   │   ├── llm.ts          # LLM 客户端
│   │   ├── llmParse.ts     # 指令解析
│   │   ├── executeGraph.ts # LangGraph 执行
│   │   └── models/         # MongoDB 模型
│   ├── types.ts            # 类型定义
│   └── socket.ts           # Socket.IO 客户端
├── store/                  # Zustand 状态管理
├── server.ts               # Express + Socket.IO 服务器
└── package.json
```

## 许可证

MIT
