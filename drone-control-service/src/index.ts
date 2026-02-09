import express from "express";
import cors from "cors";
import { dronesRouter } from "./routes/drones.js";
import { commandsRouter } from "./routes/commands.js";
import { eventsRouter } from "./routes/events.js";

const app = express();
const PORT = parseInt(process.env.PORT || "4010", 10);
const API_KEY = process.env.DRONE_CONTROL_API_KEY || "";

// ---- 中间件 ----

app.use(cors());
app.use(express.json());

// API Key 鉴权（如果配置了 API_KEY 则校验）
app.use("/api/v1", (req, res, next) => {
  if (API_KEY) {
    const token = req.headers.authorization?.replace("Bearer ", "");
    if (token !== API_KEY) {
      res.status(401).json({
        success: false,
        error: { code: "UNAUTHORIZED", message: "Invalid API key" },
      });
      return;
    }
  }
  next();
});

// ---- 路由 ----

app.use("/api/v1/drones", dronesRouter);
app.use("/api/v1/drones", commandsRouter);  // POST /:droneId/commands
app.use("/api/v1/commands", commandsRouter); // GET /:commandId
app.use("/api/v1/events", eventsRouter);     // SSE 事件推送

// 健康检查
app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "drone-control-service", timestamp: Date.now() });
});

// ---- 启动 ----

app.listen(PORT, () => {
  console.log(`🚁 Drone Control Service running on http://localhost:${PORT}`);
  console.log(`   Health: http://localhost:${PORT}/health`);
  console.log(`   API:    http://localhost:${PORT}/api/v1/drones`);
  if (API_KEY) {
    console.log(`   Auth:   API Key enabled`);
  } else {
    console.log(`   Auth:   No API Key (open access)`);
  }
});
