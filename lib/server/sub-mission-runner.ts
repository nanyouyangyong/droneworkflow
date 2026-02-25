// ============================================================================
// SubMissionRunner — 单个子任务执行器（LangGraph StateGraph 驱动）
// 职责：执行一个工作流，操作一架无人机
// 不知道自己是单机还是多机场景，只通过 DroneChannel 与无人机交互
//
// v2: 内部使用 LangGraph StateGraph 替代手写 BFS 图遍历
//     外部接口（constructor、run()、SubMissionResult）完全不变
// ============================================================================

import type { ParsedWorkflow, SubMissionState } from "@/lib/types";
import { DroneChannel } from "@/lib/server/drone-channel";
import {
  buildWorkflowGraph,
  validateWorkflowForGraph,
  createInitialState,
  type DroneWorkflowState,
} from "@/lib/server/langgraph";
import {
  getCheckpointer,
  createThreadConfig,
  canResume,
} from "@/lib/server/langgraph/checkpointer";

export interface SubMissionResult {
  success: boolean;
  subMissionId: string;
  droneId: string;
  finalState: SubMissionState;
}

export class SubMissionRunner {
  private channel: DroneChannel;
  private workflow: ParsedWorkflow;
  private subMissionId: string;

  constructor(channel: DroneChannel, workflow: ParsedWorkflow, subMissionId: string) {
    this.channel = channel;
    this.workflow = workflow;
    this.subMissionId = subMissionId;
  }

  /** 执行工作流（LangGraph StateGraph 驱动，带 Checkpoint） */
  async run(): Promise<SubMissionResult> {
    // 1. 验证工作流结构
    const validation = validateWorkflowForGraph(this.workflow);
    if (!validation.valid) {
      const errorMsg = `工作流验证失败: ${validation.errors.join("; ")}`;
      this.channel.emitLog("error", errorMsg);
      this.channel.emitStatus("failed", errorMsg);
      return this.buildResult(false, "failed");
    }

    // 2. 构建并编译 StateGraph（注入 Checkpointer）
    const checkpointer = getCheckpointer();
    let compiledGraph;
    try {
      compiledGraph = buildWorkflowGraph(this.workflow, this.channel, {
        checkpointer,
      });
    } catch (buildError: any) {
      const errorMsg = `StateGraph 构建失败: ${buildError.message}`;
      this.channel.emitLog("error", errorMsg);
      this.channel.emitStatus("failed", errorMsg);
      return this.buildResult(false, "failed");
    }

    // 3. 准备初始状态 & thread 配置
    const threadConfig = createThreadConfig(this.subMissionId);
    const isResume = await canResume(this.subMissionId);

    let initialInput;
    if (isResume) {
      // 恢复模式：传入 null 让 LangGraph 从最近 checkpoint 继续
      initialInput = null;
      this.channel.emitLog("info", `子任务恢复 [${this.channel.droneId}]（从 checkpoint 继续）`);
    } else {
      // 全新执行
      initialInput = createInitialState(
        this.channel.droneId,
        this.subMissionId,
        this.workflow.nodes.length
      );
    }

    this.channel.emitStatus("running");
    if (!isResume) {
      this.channel.emitLog("info", `子任务开始 [${this.channel.droneId}]（LangGraph + Checkpoint）`);
    }

    // 4. 执行 StateGraph（每步自动 checkpoint）
    let finalState: DroneWorkflowState;
    try {
      finalState = await compiledGraph.invoke(initialInput, threadConfig);
    } catch (execError: any) {
      const errorMsg = `StateGraph 执行失败: ${execError.message}`;
      this.channel.emitLog("error", errorMsg);
      this.channel.emitStatus("failed", errorMsg);
      return this.buildResult(false, "failed");
    }

    // 5. 根据最终状态判断成功/失败
    const success = finalState.success && !finalState.error;

    if (success) {
      this.channel.emitProgress(100);
      this.channel.emitLog(
        "success",
        `子任务完成 [${this.channel.droneId}]，剩余电量: ${finalState.battery}%`
      );
      this.channel.emitStatus("completed");
    } else {
      this.channel.emitLog("error", finalState.error || "未知错误");
      this.channel.emitStatus("failed", finalState.error || "未知错误");
    }

    return this.buildResultFromState(success, finalState);
  }

  /**
   * 恢复之前中断的任务（从最近 checkpoint 继续执行）
   * 调用方可直接调用 run()，内部自动检测是否有可恢复的 checkpoint
   */
  async resume(): Promise<SubMissionResult> {
    const hasCheckpoint = await canResume(this.subMissionId);
    if (!hasCheckpoint) {
      this.channel.emitLog("warning", "没有可恢复的 checkpoint，将从头开始执行");
    }
    return this.run();
  }

  // ---- 辅助 ----

  private buildResult(success: boolean, status: string): SubMissionResult {
    return {
      success,
      subMissionId: this.subMissionId,
      droneId: this.channel.droneId,
      finalState: {
        subMissionId: this.subMissionId,
        droneId: this.channel.droneId,
        workflow: this.workflow,
        status: status as any,
        progress: success ? 100 : 0,
        logs: [],
        finishedAt: Date.now(),
      },
    };
  }

  private buildResultFromState(
    success: boolean,
    graphState: DroneWorkflowState
  ): SubMissionResult {
    return {
      success,
      subMissionId: this.subMissionId,
      droneId: this.channel.droneId,
      finalState: {
        subMissionId: this.subMissionId,
        droneId: this.channel.droneId,
        workflow: this.workflow,
        status: success ? "completed" : "failed",
        progress: graphState.progress,
        logs: graphState.logs.map((l) => ({
          ts: l.ts,
          level: l.level,
          message: l.message,
          nodeId: l.nodeId,
          droneId: this.channel.droneId,
        })),
        finishedAt: Date.now(),
        error: graphState.error || undefined,
      },
    };
  }
}
