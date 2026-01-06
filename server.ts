import http from "http";
import express from "express";
import next from "next";
import { Server as SocketIOServer } from "socket.io";
import type { Request, Response } from "express";
import type { Socket } from "socket.io";

const dev = process.env.NODE_ENV !== "production";
const app = next({ dev });
const handle = app.getRequestHandler();

const port = Number(process.env.PORT ?? 3000);

await app.prepare();

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

  socket.on("mission:join", (payload: { missionId: string }) => {
    if (!payload?.missionId) return;
    socket.join(payload.missionId);
    socket.emit("mission:joined", { missionId: payload.missionId });
  });
});

server.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`Server listening on http://localhost:${port}`);
});
