// ============================================================================
// TaskOrchestrator — 统一任务编排入口
// 职责：接收任务请求，拆分为子任务，编排执行，聚合结果
// 单机 = 1 个子任务的编排，代码路径完全一致
// ============================================================================

import type {
  TaskRequest,
  MissionState,
  MissionStatus,
  SubMissionState,
  ExecutionStrategy,
  FailurePolicy,
  ParsedWorkflow,
} from "@/lib/types";
import { DroneChannel } from "@/lib/server/drone-channel";
import { SubMissionRunner, type SubMissionResult } from "@/lib/server/sub-mission-runner";
import { appEventBus, type AppEvent } from "@/lib/server/event-bus";
import {
  upsertMission,
  getMission,
  setMissionStatus,
  setMissionProgress,
  appendMissionLog,
  type MissionRecord,
} from "@/lib/server/missionStore";
import { Mission } from "@/lib/server/models";
import { connectDB } from "@/lib/server/db";

export class TaskOrchestrator {
  /**
   * 统一执行入口（单机/多机兼容）
   * 单机：request.drones 长度为 1
   * 多机：request.drones 长度为 N
   */
  async execute(request: TaskRequest): Promise<MissionState> {
    const {
      missionId,
      name,
      drones,
      strategy = "parallel",
      failurePolicy = "continue",
    } = request;

    // 构建子任务列表
    const subMissions: SubMissionState[] = drones.map((d, idx) => ({
      subMissionId: `${missionId}_sub_${idx}`,
      droneId: d.droneId,
      workflow: d.workflow,
      status: "pending" as MissionStatus,
      progress: 0,
      logs: [],
      startedAt: undefined,
      finishedAt: undefined,
    }));

    // 创建父任务状态
    const missionState: MissionState = {
      missionId,
      name,
      description: name,
      status: "running",
      progress: 0,
      logs: [],
      subMissions,
      strategy,
      failurePolicy,
    };

    // 持久化初始状态
    const record: MissionRecord = {
      state: missionState,
      workflow: drones[0].workflow, // 主工作流（单机时就是唯一的工作流）
    };
    upsertMission(missionId, record);
    await this.saveMissionToDB(missionId, missionState);

    // 订阅子任务事件，聚合进度
    const unsubscribe = this.subscribeSubMissionEvents(missionId, subMissions);

    // 后台异步执行（不阻塞 API 响应）
    void this.runSubMissions(missionId, drones, subMissions, strategy, failurePolicy)
      .finally(() => unsubscribe());

    return missionState;
  }

  // ---- 子任务执行 ----

  private async runSubMissions(
    missionId: string,
    drones: Array<{ droneId: string; workflow: ParsedWorkflow }>,
    subMissions: SubMissionState[],
    strategy: ExecutionStrategy,
    failurePolicy: FailurePolicy,
  ): Promise<void> {
    const runners = drones.map((d, idx) => {
      const subMissionId = subMissions[idx].subMissionId;
      const channel = new DroneChannel(d.droneId, subMissionId);
      return new SubMissionRunner(channel, d.workflow, subMissionId);
    });

    let results: SubMissionResult[];

    if (strategy === "parallel") {
      // 并行执行所有子任务
      const settled = await Promise.allSettled(
        runners.map((runner) => runner.run())
      );
      results = settled.map((s, idx) => {
        if (s.status === "fulfilled") return s.value;
        return {
          success: false,
          subMissionId: subMissions[idx].subMissionId,
          droneId: drones[idx].droneId,
          finalState: {
            ...subMissions[idx],
            status: "failed" as MissionStatus,
            error: s.reason?.message || "Unknown error",
            finishedAt: Date.now(),
          },
        };
      });
    } else {
      // 顺序执行
      results = [];
      for (const [idx, runner] of runners.entries()) {
        try {
          const result = await runner.run();
          results.push(result);
          if (!result.success && failurePolicy === "fail_fast") {
            // 标记剩余子任务为跳过
            for (let j = idx + 1; j < runners.length; j++) {
              results.push({
                success: false,
                subMissionId: subMissions[j].subMissionId,
                droneId: drones[j].droneId,
                finalState: {
                  ...subMissions[j],
                  status: "failed" as MissionStatus,
                  error: "Skipped due to fail_fast policy",
                  finishedAt: Date.now(),
                },
              });
            }
            break;
          }
        } catch (err: any) {
          results.push({
            success: false,
            subMissionId: subMissions[idx].subMissionId,
            droneId: drones[idx].droneId,
            finalState: {
              ...subMissions[idx],
              status: "failed" as MissionStatus,
              error: err.message,
              finishedAt: Date.now(),
            },
          });
          if (failurePolicy === "fail_fast") break;
        }
      }
    }

    // 聚合最终结果
    this.aggregateResults(missionId, results, subMissions);
  }

  // ---- 事件订阅与聚合 ----

  private subscribeSubMissionEvents(
    missionId: string,
    subMissions: SubMissionState[],
  ): () => void {
    const subMissionIds = new Set(subMissions.map((s) => s.subMissionId));
    const unsubscribes: Array<() => void> = [];

    for (const subId of subMissionIds) {
      const unsub = appEventBus.subscribe(subId, (event: AppEvent) => {
        const sub = subMissions.find((s) => s.subMissionId === event.missionId);
        if (!sub) return;

        switch (event.type) {
          case "mission:log":
            sub.logs.push({
              ts: event.timestamp,
              level: event.data.level,
              message: event.data.message,
              nodeId: event.data.nodeId,
              droneId: event.data.droneId,
            });
            // 同步到父任务日志
            appendMissionLog(missionId, event.data.level, `[${sub.droneId}] ${event.data.message}`, event.data.nodeId);
            break;

          case "mission:progress":
            sub.progress = event.data.progress;
            sub.currentNode = event.data.currentNode;
            // 聚合父任务进度
            this.updateAggregateProgress(missionId, subMissions);
            break;

          case "mission:status":
            sub.status = event.data.status;
            if (event.data.status === "running" && !sub.startedAt) {
              sub.startedAt = Date.now();
            }
            if (event.data.error) sub.error = event.data.error;
            break;
        }
      });
      unsubscribes.push(unsub);
    }

    return () => unsubscribes.forEach((u) => u());
  }

  private updateAggregateProgress(missionId: string, subMissions: SubMissionState[]): void {
    const totalProgress = subMissions.reduce((sum, s) => sum + s.progress, 0);
    const overallProgress = Math.floor(totalProgress / subMissions.length);

    setMissionProgress(missionId, overallProgress);

    // 发布聚合事件
    appEventBus.publish({
      type: "mission:aggregate",
      missionId,
      data: {
        overallProgress,
        subStatuses: subMissions.map((s) => ({
          subMissionId: s.subMissionId,
          droneId: s.droneId,
          status: s.status,
          progress: s.progress,
        })),
      },
      timestamp: Date.now(),
    });
  }

  // ---- 结果聚合 ----

  private aggregateResults(
    missionId: string,
    results: SubMissionResult[],
    subMissions: SubMissionState[],
  ): void {
    // 更新子任务最终状态
    for (const result of results) {
      const sub = subMissions.find((s) => s.subMissionId === result.subMissionId);
      if (sub) {
        sub.status = result.finalState.status;
        sub.progress = result.finalState.progress;
        sub.finishedAt = result.finalState.finishedAt;
        sub.error = result.finalState.error;
      }
    }

    // 计算父任务最终状态
    const allSuccess = results.every((r) => r.success);
    const allFailed = results.every((r) => !r.success);
    let overallStatus: MissionStatus;

    if (allSuccess) {
      overallStatus = "completed";
    } else if (allFailed) {
      overallStatus = "failed";
    } else {
      overallStatus = "partial_completed";
    }

    setMissionStatus(missionId, overallStatus);
    setMissionProgress(missionId, allSuccess ? 100 : Math.floor(
      results.filter((r) => r.success).length / results.length * 100
    ));

    const statusMsg = overallStatus === "completed"
      ? `所有子任务执行完成 (${results.length}/${results.length})`
      : `任务部分完成 (${results.filter((r) => r.success).length}/${results.length})`;

    appendMissionLog(missionId, overallStatus === "completed" ? "success" : "warning", statusMsg);

    // 发布最终聚合事件
    appEventBus.publish({
      type: "mission:aggregate",
      missionId,
      data: {
        overallProgress: allSuccess ? 100 : Math.floor(
          results.filter((r) => r.success).length / results.length * 100
        ),
        overallStatus,
        subStatuses: subMissions.map((s) => ({
          subMissionId: s.subMissionId,
          droneId: s.droneId,
          status: s.status,
          progress: s.progress,
        })),
      },
      timestamp: Date.now(),
    });

    // 持久化到 MongoDB
    const rec = getMission(missionId);
    if (rec) {
      void this.saveMissionToDB(missionId, rec.state);
    }
  }

  // ---- 持久化 ----

  private async saveMissionToDB(missionId: string, state: MissionState): Promise<void> {
    try {
      await connectDB();
      await Mission.findOneAndUpdate(
        { missionId },
        {
          missionId,
          workflowSnapshot: {
            name: state.name,
          },
          status: state.status,
          progress: state.progress,
          currentNode: state.currentNode,
          logs: state.logs,
          subMissions: state.subMissions?.map((s) => ({
            subMissionId: s.subMissionId,
            droneId: s.droneId,
            status: s.status,
            progress: s.progress,
            logs: s.logs,
            error: s.error,
          })),
          strategy: state.strategy,
          startedAt: new Date(),
          completedAt: ["completed", "failed", "partial_completed"].includes(state.status)
            ? new Date()
            : undefined,
        },
        { upsert: true, new: true }
      );
    } catch (error) {
      console.error("Failed to save mission to MongoDB:", error);
    }
  }
}

// 单例
export const taskOrchestrator = new TaskOrchestrator();
