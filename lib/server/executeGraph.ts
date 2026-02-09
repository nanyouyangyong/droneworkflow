// ============================================================================
// executeGraph.ts — 工作流执行入口（薄代理层）
// 向后兼容旧 API，内部委托给 TaskOrchestrator
// 所有执行逻辑已迁移到：
//   - SubMissionRunner（单子任务执行）
//   - TaskOrchestrator（任务编排与聚合）
//   - DroneChannel（无人机消息通道）
// ============================================================================

import type { Server as SocketIOServer } from "socket.io";
import type { MissionState, ParsedWorkflow, TaskRequest } from "@/lib/types";
import { taskOrchestrator } from "@/lib/server/task-orchestrator";

/**
 * 启动工作流执行（向后兼容旧 API）
 * 单机场景：自动包装为 1 个子任务的编排
 * @param missionId - 任务 ID
 * @param workflow - 工作流定义
 * @param _io - Socket.IO 实例（已通过 EventBus 桥接，此参数保留兼容）
 * @param droneId - 无人机 ID（可选，默认从 missionId 生成）
 */
export async function startExecution(
  missionId: string,
  workflow: ParsedWorkflow,
  _io: SocketIOServer | undefined,
  droneId?: string,
): Promise<MissionState> {
  const resolvedDroneId = droneId || `drone-${missionId.slice(0, 8)}`;

  const request: TaskRequest = {
    missionId,
    name: workflow.workflow_name,
    drones: [{ droneId: resolvedDroneId, workflow }],
    strategy: "parallel",
    failurePolicy: "continue",
  };

  return taskOrchestrator.execute(request);
}

/**
 * 启动多无人机工作流执行
 * @param request - 完整的任务请求（包含多个 drone + workflow）
 */
export async function startMultiDroneExecution(
  request: TaskRequest,
): Promise<MissionState> {
  return taskOrchestrator.execute(request);
}
