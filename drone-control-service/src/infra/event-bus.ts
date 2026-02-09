// ============================================================================
// EventBus — 发布-订阅事件总线（drone-control-service 内部）
// 命令执行、设备状态变更后发布事件，SSE 端点订阅并推送给上游
// ============================================================================

export type DroneEventType = "telemetry" | "command_status" | "device_status";

export interface DroneEvent {
  type: DroneEventType;
  droneId: string;
  data: any;
  timestamp: number;
}

type EventCallback = (event: DroneEvent) => void;

class EventBus {
  private listeners = new Map<string, Set<EventCallback>>();

  /**
   * 订阅事件
   * @param channel - droneId 或 "*"（订阅所有）
   */
  subscribe(channel: string, callback: EventCallback): () => void {
    if (!this.listeners.has(channel)) {
      this.listeners.set(channel, new Set());
    }
    this.listeners.get(channel)!.add(callback);

    // 返回取消订阅函数
    return () => {
      this.listeners.get(channel)?.delete(callback);
      if (this.listeners.get(channel)?.size === 0) {
        this.listeners.delete(channel);
      }
    };
  }

  /**
   * 发布事件
   * 同时通知 droneId 频道和 "*" 全局频道的订阅者
   */
  publish(event: DroneEvent): void {
    // 通知指定 droneId 的订阅者
    const droneListeners = this.listeners.get(event.droneId);
    if (droneListeners) {
      for (const cb of droneListeners) {
        try { cb(event); } catch (e) { console.error("EventBus callback error:", e); }
      }
    }

    // 通知全局订阅者
    const globalListeners = this.listeners.get("*");
    if (globalListeners) {
      for (const cb of globalListeners) {
        try { cb(event); } catch (e) { console.error("EventBus callback error:", e); }
      }
    }
  }

  /** 获取当前订阅者数量（调试用） */
  getSubscriberCount(): number {
    let count = 0;
    for (const set of this.listeners.values()) {
      count += set.size;
    }
    return count;
  }
}

export const eventBus = new EventBus();
