// ============================================================================
// SSE 事件推送端点 — 上游服务订阅无人机实时事件
// GET /api/v1/events?droneIds=drone-001,drone-002
// GET /api/v1/events                              （订阅所有）
// ============================================================================

import { Router } from "express";
import { eventBus, type DroneEvent } from "../infra/event-bus.js";

export const eventsRouter = Router();

eventsRouter.get("/", (req, res) => {
  // SSE 响应头
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();

  // 解析要订阅的 droneId 列表
  const droneIdsParam = req.query.droneIds as string | undefined;
  const channels: string[] = droneIdsParam
    ? droneIdsParam.split(",").map((s) => s.trim()).filter(Boolean)
    : ["*"];

  // 订阅事件
  const unsubscribes: Array<() => void> = channels.map((channel) =>
    eventBus.subscribe(channel, (event: DroneEvent) => {
      res.write(`data: ${JSON.stringify(event)}\n\n`);
    })
  );

  // 心跳保活（每 30 秒）
  const heartbeat = setInterval(() => {
    res.write(`: heartbeat\n\n`);
  }, 30_000);

  // 客户端断开时清理
  req.on("close", () => {
    clearInterval(heartbeat);
    unsubscribes.forEach((unsub) => unsub());
  });
});
