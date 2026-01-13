// 简单的内存缓存，用于缓存 LLM 解析结果
interface CacheEntry<T> {
  value: T;
  expireAt: number;
}

class SimpleCache<T> {
  private cache = new Map<string, CacheEntry<T>>();
  private maxSize: number;
  private defaultTTL: number;

  constructor(maxSize = 100, defaultTTLMs = 5 * 60 * 1000) {
    this.maxSize = maxSize;
    this.defaultTTL = defaultTTLMs;
  }

  set(key: string, value: T, ttlMs?: number): void {
    // 如果缓存已满，删除最旧的条目
    if (this.cache.size >= this.maxSize) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey) this.cache.delete(oldestKey);
    }

    this.cache.set(key, {
      value,
      expireAt: Date.now() + (ttlMs ?? this.defaultTTL)
    });
  }

  get(key: string): T | undefined {
    const entry = this.cache.get(key);
    if (!entry) return undefined;

    if (Date.now() > entry.expireAt) {
      this.cache.delete(key);
      return undefined;
    }

    return entry.value;
  }

  has(key: string): boolean {
    return this.get(key) !== undefined;
  }

  delete(key: string): boolean {
    return this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }

  size(): number {
    return this.cache.size;
  }
}

// 创建工作流解析缓存实例
export const workflowCache = new SimpleCache<any>(100, 10 * 60 * 1000); // 10分钟过期

// 生成缓存键
export function generateCacheKey(userInput: string, model?: string): string {
  const normalized = userInput.trim().toLowerCase();
  return `${model || "default"}:${normalized}`;
}
