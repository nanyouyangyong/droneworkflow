"use client";

import {
  useMemo,
  useState,
  useRef,
  useEffect,
  useCallback,
  type KeyboardEvent as ReactKeyboardEvent
} from "react";
import { useAppStore } from "@/store/useAppStore";
import { 
  getSessionId, 
  resetSessionId, 
  getChatHistory, 
  streamParseWorkflow 
} from "@/lib/client/api";

const models = ["deepseek-chat", "gpt-4", "claude-3.5", "local-llm"] as const;

export default function ChatPanel() {
  const model = useAppStore((s) => s.model);
  const setModel = useAppStore((s) => s.setModel);
  const messages = useAppStore((s) => s.messages);
  const addMessage = useAppStore((s) => s.addMessage);
  const updateLastMessage = useAppStore((s) => s.updateLastMessage);
  const setMessages = useAppStore((s) => s.setMessages);
  const setWorkflow = useAppStore((s) => s.setWorkflow);

  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [sessionId, setSessionId] = useState("");
  const [streamingContent, setStreamingContent] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const placeholder = useMemo(
    () => "描述你的无人机任务，如：'巡查A区域并拍照，电量低于30%时返航'",
    []
  );

  // 初始化：获取 sessionId 并加载历史消息
  useEffect(() => {
    const initSession = async () => {
      const sid = getSessionId();
      setSessionId(sid);

      if (sid) {
        const res = await getChatHistory(sid);
        if (res.ok && res.data?.messages?.length) {
          // 转换为 store 格式
          const storeMessages = res.data.messages.map((m, idx) => ({
            id: `${sid}-${idx}`,
            role: m.role as "user" | "assistant",
            content: m.content,
            ts: m.ts
          }));
          setMessages(storeMessages);
        }
      }
      setLoading(false);
    };

    initSession();
  }, [setMessages]);

  // 开始新会话
  const onNewSession = useCallback(() => {
    const newSid = resetSessionId();
    setSessionId(newSid);
    setMessages([]);
  }, [setMessages]);

  // Auto scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, busy, streamingContent]);

  // 流式发送消息
  const onSendStream = useCallback(async () => {
    const text = input.trim();
    if (!text || busy || !sessionId) return;

    setInput("");
    addMessage("user", text);
    setBusy(true);
    setStreamingContent("");

    // 创建 AbortController 用于取消请求
    abortControllerRef.current = new AbortController();

    // 添加一个占位的助手消息
    addMessage("assistant", "");

    await streamParseWorkflow(text, model, sessionId, {
      signal: abortControllerRef.current.signal,
      onChunk: (content) => {
        setStreamingContent(content);
        updateLastMessage(content);
      },
      onComplete: (workflow) => {
        if (workflow) {
          setWorkflow(workflow);
          updateLastMessage("已生成工作流，请在画布确认/调整后执行。");
        } else {
          updateLastMessage("工作流解析失败，请重试。");
        }
      },
      onError: (message) => {
        updateLastMessage(`错误: ${message}`);
      }
    });

    setBusy(false);
    setStreamingContent("");
    abortControllerRef.current = null;
  }, [input, busy, model, sessionId, addMessage, updateLastMessage, setWorkflow]);

  const onSend = onSendStream;

  // 中断当前请求
  const onAbort = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
      setBusy(false);
      setStreamingContent("");
    }
  }, []);

  const handleKeyDown = (e: ReactKeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      onSend();
    }
  };

  const formatTime = (ts: number) => {
    try {
      return new Date(ts).toLocaleTimeString("zh-CN", {
        hour: "2-digit",
        minute: "2-digit"
      });
    } catch {
      return "";
    }
  };

  return (
    <div className="flex h-full flex-col bg-[#f7f7f8] overflow-hidden">
      {/* Header */}
      <div className="flex-shrink-0 flex items-center justify-between border-b border-slate-200 bg-white/80 px-4 py-3 backdrop-blur">
        <div className="flex items-center gap-2 min-w-0">
          <div className="flex-shrink-0 flex h-8 w-8 items-center justify-center rounded-xl bg-slate-900 text-white">
            AI
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold text-slate-900 truncate">大模型对话</div>
            <div className="text-xs text-slate-500 truncate">生成工作流并支持继续追问</div>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={onNewSession}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 shadow-sm hover:bg-slate-50 whitespace-nowrap"
            title="开始新会话"
          >
            新会话
          </button>
          <select
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 shadow-sm outline-none focus:ring-2 focus:ring-slate-900/10 max-w-[120px]"
            value={model}
            onChange={(e) => setModel(e.target.value)}
          >
            {models.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Messages Area */}
      <div className="app-scrollbar flex-1 min-h-0 overflow-y-auto overflow-x-hidden">
        <div className="mx-auto w-full max-w-[820px] px-4 py-6">
          {loading ? (
            <div className="flex min-h-[60vh] items-center justify-center">
              <div className="text-sm text-slate-500">加载历史对话...</div>
            </div>
          ) : messages.length === 0 ? (
            <div className="flex min-h-[60vh] items-center justify-center">
              <div className="w-full rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="text-lg font-semibold text-slate-900">开始描述你的任务</div>
                <div className="mt-1 text-sm text-slate-600">
                  我会把你的自然语言指令解析为可编辑的工作流。
                </div>
                <div className="mt-4 grid gap-2 text-sm">
                  <div className="rounded-2xl bg-slate-50 px-4 py-3 text-slate-700 break-words">
                    巡查 A 区域并拍照，电量低于 30% 时返航
                  </div>
                  <div className="rounded-2xl bg-slate-50 px-4 py-3 text-slate-700 break-words">
                    起飞到 20 米，飞行到坐标点，悬停 10 秒后录像
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-5">
              {messages.map((m) => {
                const isUser = m.role === "user";

                if (isUser) {
                  return (
                    <div key={m.id} className="w-full">
                      <div className="flex justify-end">
                        <div className="w-full max-w-[820px]">
                          <div className="mb-2 flex justify-end">
                            <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-blue-600 text-xs font-semibold text-white shadow-sm">
                              U
                            </div>
                          </div>
                          <div className="flex justify-end">
                            <div className="max-w-[92%] rounded-2xl bg-gradient-to-r from-slate-900 to-slate-800 px-4 py-3 text-white shadow-sm ring-1 ring-slate-900">
                              <div className="whitespace-pre-wrap break-words text-[14px] leading-6">
                                {m.content}
                              </div>
                            </div>
                          </div>
                          <div className="mt-1 text-right text-xs text-slate-400">
                            {formatTime(m.ts)}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                }

                return (
                  <div key={m.id} className="flex justify-start">
                    <div className="mr-3 mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-slate-900 to-slate-600 text-xs font-semibold text-white">
                      AI
                    </div>
                    <div className="max-w-[82%] min-w-0">
                      <div className="rounded-3xl bg-white px-4 py-3 text-slate-800 shadow-sm ring-1 ring-slate-200">
                        <div className="whitespace-pre-wrap break-words text-[14px] leading-6">
                          {m.content}
                        </div>
                      </div>
                      <div className="mt-1 text-left text-xs text-slate-400">{formatTime(m.ts)}</div>
                    </div>
                  </div>
                );
              })}

              {busy && (
                <div className="flex justify-start">
                  <div className="mr-3 mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-slate-900 to-slate-600 text-xs font-semibold text-white">
                    AI
                  </div>
                  <div className="max-w-[82%]">
                    <div className="rounded-3xl bg-white px-4 py-3 shadow-sm ring-1 ring-slate-200">
                      <div className="flex items-center gap-2 text-sm text-slate-500">
                        <span className="inline-flex h-2 w-2 animate-pulse rounded-full bg-slate-400" />
                        <span className="inline-flex h-2 w-2 animate-pulse rounded-full bg-slate-400 [animation-delay:150ms]" />
                        <span className="inline-flex h-2 w-2 animate-pulse rounded-full bg-slate-400 [animation-delay:300ms]" />
                        <span className="ml-2">正在生成工作流…</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>
          )}
        </div>
      </div>

      {/* Input Area */}
      <div className="flex-shrink-0 border-t border-slate-200 bg-white/80 backdrop-blur">
        <div className="mx-auto w-full max-w-[820px] px-4 py-4">
          <div className="flex items-end gap-3 rounded-3xl border border-slate-200 bg-white px-3 py-3 shadow-sm focus-within:ring-2 focus-within:ring-slate-900/10">
            <textarea
              className="max-h-40 flex-1 resize-none bg-transparent px-2 py-1 text-sm leading-6 text-slate-800 outline-none placeholder:text-slate-400"
              placeholder={placeholder}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              rows={2}
            />
            <button
              className="inline-flex h-10 w-20 flex-shrink-0 items-center justify-center rounded-2xl text-sm font-medium text-white shadow-sm transition disabled:cursor-not-allowed disabled:opacity-40"
              style={{ backgroundColor: busy ? '#dc2626' : '#0f172a' }}
              onClick={busy ? onAbort : onSend}
              disabled={!busy && !input.trim()}
            >
              {busy ? (
                <>
                  <svg className="animate-spin -ml-1 mr-1.5 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <span>停止</span>
                </>
              ) : (
                "发送"
              )}
            </button>
          </div>
          <div className="mt-2 text-xs text-slate-400">Enter 发送，Shift + Enter 换行</div>
        </div>
      </div>
    </div>
  );
}
