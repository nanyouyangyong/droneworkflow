import "dotenv/config";
import http from "http";
import express from "express";
import next from "next";
import { Server as SocketIOServer } from "socket.io";
import type { Request, Response } from "express";
import type { Socket } from "socket.io";
import { connectDB } from "@/lib/server/db";
import { appEventBus } from "@/lib/server/event-bus";

const dev = process.env.NODE_ENV !== "production";
const app = next({ dev });
const handle = app.getRequestHandler();

const port = Number(process.env.PORT ?? 3000);

await app.prepare();

// 连接 MongoDB
try {
  await connectDB();
  console.log("MongoDB connection initialized");
} catch (error) {
  console.warn("MongoDB connection failed, some features may not work:", error);
}

const expressApp = express();

expressApp.get("/health", (_req: Request, res: Response) => {
  res.json({ ok: true });
});

expressApp.all("*", (req: Request, res: Response) => {
  return handle(req, res);
});

const server = http.createServer(expressApp);

const io = new SocketIOServer(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

(globalThis as any).__io = io;

io.on("connection", (socket: Socket) => {
  socket.emit("server:hello", { ts: Date.now() });

  // 加入任务房间（单机/子任务）
  socket.on("mission:join", (payload: { missionId: string }) => {
    if (!payload?.missionId) return;
    socket.join(payload.missionId);
    socket.emit("mission:joined", { missionId: payload.missionId });
  });

  // 加入父任务房间（自动接收所有子任务事件）
  socket.on("mission:join_parent", (payload: { parentMissionId: string }) => {
    if (!payload?.parentMissionId) return;
    socket.join(`parent:${payload.parentMissionId}`);
    socket.emit("mission:joined_parent", { parentMissionId: payload.parentMissionId });
  });

  // 订阅指定无人机遥测
  socket.on("drone:subscribe", (payload: { droneIds: string[] }) => {
    if (!payload?.droneIds?.length) return;
    for (const droneId of payload.droneIds) {
      socket.join(`drone:${droneId}`);
    }
    socket.emit("drone:subscribed", { droneIds: payload.droneIds });
  });
});

// ---- EventBus → Socket.IO 桥接 ----
// 监听所有事件，转发到对应的 Socket.IO 房间
appEventBus.subscribe("*", (event) => {
  switch (event.type) {
    case "mission:log":
      io.to(event.missionId).emit("mission:log", {
        missionId: event.missionId,
        log: { ts: event.timestamp, ...event.data },
      });
      break;

    case "mission:progress":
      io.to(event.missionId).emit("mission:state", {
        missionId: event.missionId,
        state: { progress: event.data.progress, currentNode: event.data.currentNode },
      });
      break;

    case "mission:status":
      io.to(event.missionId).emit("mission:state", {
        missionId: event.missionId,
        state: { status: event.data.status },
      });
      break;

    case "mission:aggregate":
      // 发送到父任务房间和任务房间
      io.to(event.missionId).to(`parent:${event.missionId}`).emit("mission:aggregate", {
        missionId: event.missionId,
        ...event.data,
      });
      break;

    case "drone:telemetry":
      if (event.droneId) {
        io.to(`drone:${event.droneId}`).emit("drone:telemetry", {
          droneId: event.droneId,
          telemetry: event.data,
        });
      }
      break;
  }
});

// ---- SSE 遥测转发（从 drone-control-service 订阅） ----
function startTelemetryRelay() {
  const baseUrl = process.env.DRONE_CONTROL_BASE_URL || "http://127.0.0.1:4010";
  const apiKey = process.env.DRONE_CONTROL_API_KEY || "";
  let failCount = 0;

  async function connect() {
    try {
      const headers: Record<string, string> = {};
      if (apiKey) headers["Authorization"] = `Bearer ${apiKey}`;

      const response = await fetch(`${baseUrl}/api/v1/events`, {
        headers,
        // SSE 长连接，不设置超时
      });

      if (!response.ok || !response.body) {
        failCount++;
        const retryDelay = Math.min(5000 * Math.ceil(failCount / 5), 60000);
        if (failCount <= 3 || failCount % 10 === 0) {
          console.warn(`SSE relay: failed to connect (${response.status}), retry #${failCount} in ${retryDelay / 1000}s...`);
        }
        setTimeout(connect, retryDelay);
        return;
      }

      failCount = 0;
      console.log("SSE relay: connected to drone-control-service");
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const event = JSON.parse(line.slice(6));
              // 转发到 AppEventBus
              if (event.droneId) {
                appEventBus.publish({
                  type: "drone:telemetry",
                  missionId: "",
                  droneId: event.droneId,
                  data: event.data,
                  timestamp: event.timestamp || Date.now(),
                });
              }
            } catch { /* ignore parse errors for heartbeats */ }
          }
        }
      }

      // 连接断开，重连
      console.warn("SSE relay: connection closed, reconnecting in 3s...");
      setTimeout(connect, 3000);
    } catch (err: any) {
      failCount++;
      const retryDelay = Math.min(5000 * Math.ceil(failCount / 5), 60000);
      if (failCount <= 3 || failCount % 10 === 0) {
        console.warn(`SSE relay: error (${err?.message}), retry #${failCount} in ${retryDelay / 1000}s...`);
      }
      setTimeout(connect, retryDelay);
    }
  }

  // 延迟启动，等待 drone-control-service 就绪
  setTimeout(connect, 3000);
}

startTelemetryRelay();

server.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`Server listening on http://localhost:${port}`);
});
