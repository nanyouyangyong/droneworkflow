# Drone Control Service

无人机控制后端服务 —— 为 MCP Server 提供真实/模拟无人机操控能力。

## 架构

```
┌─────────────────────────────────────────────────┐
│  MCP Server (mcp-client-typescript)             │
│  tools.ts → httpDroneClient → HTTP 调用         │
└──────────────────┬──────────────────────────────┘
                   │ HTTP (默认 :4010)
┌──────────────────┴──────────────────────────────┐
│  drone-control-service (本服务)                  │
│                                                  │
│  routes/     → Express 路由                      │
│  services/   → 业务编排（幂等/状态推进）          │
│  adapters/   → 无人机适配器（Mock / DJI / PX4）  │
│  infra/      → 存储（内存 → Redis/Mongo）        │
│  domain/     → 类型定义 + 错误码                 │
└──────────────────┬──────────────────────────────┘
                   │ SDK / 串口 / UDP / 4G
┌──────────────────┴──────────────────────────────┐
│              Real Drone Hardware                 │
└─────────────────────────────────────────────────┘
```

## 快速开始

```bash
cd drone-control-service
npm install
npm run dev
```

服务默认监听 `http://localhost:4010`。

## 环境变量

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `PORT` | `4010` | 服务端口 |
| `DRONE_CONTROL_API_KEY` | (空) | API Key，为空则不校验 |

## API 接口

### 健康检查
- **GET** `/health`

### 设备管理
- **POST** `/api/v1/drones/connect` — 连接无人机
- **POST** `/api/v1/drones/:droneId/disconnect` — 断开连接
- **GET** `/api/v1/drones` — 列出所有设备
- **GET** `/api/v1/drones/:droneId/status` — 获取设备状态 + 遥测

### 命令下发
- **POST** `/api/v1/drones/:droneId/commands` — 执行命令
- **GET** `/api/v1/commands/:commandId` — 查询命令状态
- **GET** `/api/v1/drones/:droneId/commands` — 查询命令历史

### 命令列表

| 命令名 | 参数 | 说明 |
|--------|------|------|
| `takeoff` | `{ altitude: number }` | 起飞 |
| `land` | `{}` | 降落 |
| `fly_to` | `{ lat, lng, altitude? }` | 飞行到坐标 |
| `hover` | `{ duration: number }` | 悬停 |
| `take_photo` | `{ count?: number }` | 拍照 |
| `record_video` | `{ action: "start"\|"stop" }` | 录像 |
| `return_home` | `{}` | 返航 |
| `check_battery` | `{ threshold?: number }` | 电量检查 |

### 请求示例

```bash
# 连接无人机
curl -X POST http://localhost:4010/api/v1/drones/connect \
  -H "Content-Type: application/json" \
  -d '{"droneId": "drone-001", "name": "测试无人机"}'

# 起飞
curl -X POST http://localhost:4010/api/v1/drones/drone-001/commands \
  -H "Content-Type: application/json" \
  -d '{"name": "takeoff", "args": {"altitude": 30}}'

# 查询状态
curl http://localhost:4010/api/v1/drones/drone-001/status
```

## 扩展适配器

在 `src/adapters/` 下新增适配器文件，实现 `DroneAdapter` 接口，然后在 `src/services/droneService.ts` 的 `adapters` 注册表中注册即可。

```typescript
// src/adapters/djiAdapter.ts
import type { DroneAdapter } from "./droneAdapter.js";

export class DjiAdapter implements DroneAdapter {
  // 实现 connect / disconnect / executeCommand / getTelemetry
}
```

## 与 MCP Server 联调

1. 启动本服务：`npm run dev`（端口 4010）
2. 设置 MCP 环境变量：
   ```
   DRONE_CONTROL_BASE_URL=http://127.0.0.1:4010
   DRONE_CONTROL_API_KEY=（可选）
   ```
3. 启动 MCP Server：`cd ../mcp-client-typescript && npm run dev`
4. MCP 调用 `connect_drone` → `takeoff` → `get_drone_status` → `land`
