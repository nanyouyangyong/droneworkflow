// 客户端 API 工具层 - 封装所有 fetch 请求

const API_TIMEOUT = 30000;

interface ApiResponse<T = any> {
  data?: T;
  error?: string;
  ok: boolean;
}

// 通用请求函数
async function request<T = any>(
  url: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT);

  try {
    const res = await fetch(url, {
      ...options,
      signal: options.signal || controller.signal,
      headers: {
        "Content-Type": "application/json",
        ...options.headers
      }
    });

    clearTimeout(timeoutId);

    if (!res.ok) {
      const errText = await res.text();
      return { ok: false, error: errText || `HTTP ${res.status}` };
    }

    const data = await res.json();
    return { ok: true, data };
  } catch (e: any) {
    clearTimeout(timeoutId);
    if (e.name === "AbortError") {
      return { ok: false, error: "请求超时" };
    }
    return { ok: false, error: e.message || "网络错误" };
  }
}

// ============ Chat API ============

export interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
  ts: number;
}

export interface ChatHistoryResponse {
  sessionId: string;
  messages: ChatMessage[];
  workflowId?: string;
}

// 获取聊天历史
export async function getChatHistory(sessionId: string): Promise<ApiResponse<ChatHistoryResponse>> {
  return request<ChatHistoryResponse>(`/api/chat?sessionId=${encodeURIComponent(sessionId)}`);
}

// ============ LLM API ============

// 流式解析工作流
export async function streamParseWorkflow(
  userInput: string,
  model: string,
  sessionId: string,
  options: {
    onChunk?: (content: string) => void;
    onComplete?: (workflow: any, sessionId: string) => void;
    onError?: (message: string) => void;
    signal?: AbortSignal;
  }
): Promise<void> {
  const { onChunk, onComplete, onError, signal } = options;

  try {
    const res = await fetch("/api/llm/stream", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userInput, model, sessionId }),
      signal
    });

    if (!res.ok) {
      const errText = await res.text();
      onError?.(errText || `HTTP ${res.status}`);
      return;
    }

    const reader = res.body?.getReader();
    if (!reader) {
      onError?.("无法读取响应流");
      return;
    }

    const decoder = new TextDecoder();
    let fullContent = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split("\n");

      for (const line of lines) {
        if (line.startsWith("data: ")) {
          try {
            const data = JSON.parse(line.slice(6));

            if (data.type === "chunk") {
              fullContent += data.content;
              onChunk?.(fullContent);
            } else if (data.type === "complete") {
              onComplete?.(data.workflow, data.sessionId);
            } else if (data.type === "error") {
              onError?.(data.message);
            }
          } catch {
            // 忽略解析错误
          }
        }
      }
    }
  } catch (e: any) {
    if (e.name === "AbortError") {
      onError?.("请求已取消");
    } else {
      onError?.(e.message || "网络错误");
    }
  }
}


// ============ Session 管理 ============

const SESSION_KEY = "drone_workflow_session_id";

// 获取或创建 sessionId
export function getSessionId(): string {
  if (typeof window === "undefined") {
    return "";
  }
  
  let sessionId = localStorage.getItem(SESSION_KEY);
  if (!sessionId) {
    sessionId = crypto.randomUUID();
    localStorage.setItem(SESSION_KEY, sessionId);
  }
  return sessionId;
}

// 重置 sessionId（开始新会话）
export function resetSessionId(): string {
  if (typeof window === "undefined") {
    return "";
  }
  
  const newSessionId = crypto.randomUUID();
  localStorage.setItem(SESSION_KEY, newSessionId);
  return newSessionId;
}
