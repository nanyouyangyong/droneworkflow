// ============================================================================
// Checkpointer — LangGraph 状态持久化管理
// 提供中断/恢复能力，每步自动存档
//
// 开发阶段使用内存 MemorySaver，后续可替换为 MongoDB 持久化
// ============================================================================

import { MemorySaver } from "@langchain/langgraph-checkpoint";
import type { RunnableConfig } from "@langchain/core/runnables";

// 全局单例 checkpointer（内存存储）
let checkpointerInstance: MemorySaver | null = null;

/**
 * 获取全局 checkpointer 实例
 * 使用 MemorySaver（内存存储），适用于开发和单进程部署
 */
export function getCheckpointer(): MemorySaver {
  if (!checkpointerInstance) {
    checkpointerInstance = new MemorySaver();
    console.log("[Checkpointer] MemorySaver initialized");
  }
  return checkpointerInstance;
}

/**
 * 重置 checkpointer（清除所有存档，主要用于测试）
 */
export function resetCheckpointer(): void {
  checkpointerInstance = null;
}

/**
 * 为指定任务生成 LangGraph RunnableConfig
 * thread_id 是 LangGraph 的会话标识，用于隔离不同任务的 checkpoint
 *
 * @param threadId - 通常使用 subMissionId 作为 thread_id
 * @param checkpointId - 可选，指定从哪个 checkpoint 恢复
 */
export function createThreadConfig(
  threadId: string,
  checkpointId?: string
): RunnableConfig {
  const config: RunnableConfig = {
    configurable: {
      thread_id: threadId,
      ...(checkpointId ? { checkpoint_id: checkpointId } : {}),
    },
  };
  return config;
}

/**
 * 获取指定任务的最新 checkpoint
 * 用于判断任务是否可以恢复
 */
export async function getLatestCheckpoint(threadId: string) {
  const saver = getCheckpointer();
  const config = createThreadConfig(threadId);
  const tuple = await saver.getTuple(config);
  return tuple || null;
}

/**
 * 列出指定任务的所有 checkpoint（用于调试/审计）
 */
export async function listCheckpoints(threadId: string, limit = 10) {
  const saver = getCheckpointer();
  const config = createThreadConfig(threadId);
  const checkpoints = [];
  for await (const tuple of saver.list(config, { limit })) {
    checkpoints.push({
      id: tuple.checkpoint.id,
      ts: tuple.checkpoint.ts,
      metadata: tuple.metadata,
    });
  }
  return checkpoints;
}

/**
 * 判断任务是否有可恢复的 checkpoint
 */
export async function canResume(threadId: string): Promise<boolean> {
  const tuple = await getLatestCheckpoint(threadId);
  return tuple !== null;
}
