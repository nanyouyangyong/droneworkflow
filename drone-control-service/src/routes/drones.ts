import { Router } from "express";
import type { Request, Response } from "express";
import {
  connectDrone,
  disconnectDrone,
  listDevices,
  getDroneStatus,
  getCommandHistory,
} from "../services/droneService.js";
import type { ConnectRequest, ApiResponse } from "../domain/types.js";
import { ServiceError } from "../domain/errors.js";

export const dronesRouter = Router();

// POST /api/v1/drones/connect
dronesRouter.post("/connect", async (req: Request, res: Response) => {
  try {
    const body: ConnectRequest = req.body;
    const result = await connectDrone(body);
    const response: ApiResponse = { success: true, data: result };
    res.status(200).json(response);
  } catch (err) {
    handleError(res, err);
  }
});

// POST /api/v1/drones/:droneId/disconnect
dronesRouter.post("/:droneId/disconnect", async (req: Request, res: Response) => {
  try {
    const device = await disconnectDrone(req.params.droneId);
    const response: ApiResponse = { success: true, data: { device } };
    res.status(200).json(response);
  } catch (err) {
    handleError(res, err);
  }
});

// GET /api/v1/drones
dronesRouter.get("/", async (_req: Request, res: Response) => {
  try {
    const devices = listDevices();
    const response: ApiResponse = { success: true, data: { devices } };
    res.status(200).json(response);
  } catch (err) {
    handleError(res, err);
  }
});

// GET /api/v1/drones/:droneId/status
dronesRouter.get("/:droneId/status", async (req: Request, res: Response) => {
  try {
    const result = await getDroneStatus(req.params.droneId);
    const response: ApiResponse = { success: true, data: result };
    res.status(200).json(response);
  } catch (err) {
    handleError(res, err);
  }
});

// GET /api/v1/drones/:droneId/commands
dronesRouter.get("/:droneId/commands", async (req: Request, res: Response) => {
  try {
    const commands = getCommandHistory(req.params.droneId);
    const response: ApiResponse = { success: true, data: { commands } };
    res.status(200).json(response);
  } catch (err) {
    handleError(res, err);
  }
});

// ---- 错误处理 ----

function handleError(res: Response, err: unknown) {
  if (err instanceof ServiceError) {
    res.status(err.statusCode).json({
      success: false,
      error: { code: err.code, message: err.message },
    });
  } else {
    const message = err instanceof Error ? err.message : "Unknown error";
    res.status(500).json({
      success: false,
      error: { code: "INTERNAL_ERROR", message },
    });
  }
}
