import { Router } from "express";
import type { Request, Response } from "express";
import { executeCommand, getCommandById } from "../services/droneService.js";
import type { CommandRequest, ApiResponse } from "../domain/types.js";
import { ServiceError } from "../domain/errors.js";

export const commandsRouter = Router();

// POST /api/v1/drones/:droneId/commands
commandsRouter.post("/:droneId/commands", async (req: Request, res: Response) => {
  try {
    const body: CommandRequest = req.body;
    const command = await executeCommand(req.params.droneId, body);
    const response: ApiResponse = { success: true, data: { command } };
    res.status(200).json(response);
  } catch (err) {
    handleError(res, err);
  }
});

// GET /api/v1/commands/:commandId
commandsRouter.get("/:commandId", async (req: Request, res: Response) => {
  try {
    const command = getCommandById(req.params.commandId);
    const response: ApiResponse = { success: true, data: { command } };
    res.status(200).json(response);
  } catch (err) {
    handleError(res, err);
  }
});

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
