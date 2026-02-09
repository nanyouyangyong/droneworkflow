// ============================================================================
// EventBus — 主应用全局事件总线
// 模块间解耦通信：子任务执行器 → 编排器 → Socket.IO → 前端
// ============================================================================

import type { LogLevel, MissionStatus } from "@/lib/types";

export type AppEventType =
  | "mission:log"
  | "mission:progress"
  | "mission:status"
  | "mission:aggregate"
  | "drone:telemetry";

export interface AppEvent {
  type: AppEventType;
  missionId: string;
  droneId?: string;
  data: any;
  timestamp: number;
}

export interface MissionLogEventData {
  level: LogLevel;
  message: string;
  nodeId?: string;
  droneId?: string;
}

export interface MissionProgressEventData {
  progress: number;
  currentNode?: string;
  droneId?: string;
}

export interface MissionStatusEventData {
  status: MissionStatus;
  droneId?: string;
  error?: string;
}

export interface MissionAggregateEventData {
  overallProgress: number;
  overallStatus: MissionStatus;
  subStatuses: Array<{
    subMissionId: string;
    droneId: string;
    status: MissionStatus;
    progress: number;
  }>;
}

type EventCallback = (event: AppEvent) => void;

class AppEventBus {
  private listeners = new Map<string, Set<EventCallback>>();

  /**
   * 订阅事件
   * @param channel - missionId、droneId 或 "*"（全局）
   */
  subscribe(channel: string, callback: EventCallback): () => void {
    if (!this.listeners.has(channel)) {
      this.listeners.set(channel, new Set());
    }
    this.listeners.get(channel)!.add(callback);

    return () => {
      this.listeners.get(channel)?.delete(callback);
      if (this.listeners.get(channel)?.size === 0) {
        this.listeners.delete(channel);
      }
    };
  }

  /**
   * 发布事件
   * 通知 missionId 频道、droneId 频道和 "*" 全局频道
   */
  publish(event: AppEvent): void {
    const channels = new Set<string>();
    channels.add("*");
    if (event.missionId) channels.add(event.missionId);
    if (event.droneId) channels.add(`drone:${event.droneId}`);

    for (const channel of channels) {
      const listeners = this.listeners.get(channel);
      if (listeners) {
        for (const cb of listeners) {
          try { cb(event); } catch (e) { console.error("AppEventBus callback error:", e); }
        }
      }
    }
  }

  /** 移除某个频道的所有订阅 */
  removeAll(channel: string): void {
    this.listeners.delete(channel);
  }
}

export const appEventBus = new AppEventBus();
