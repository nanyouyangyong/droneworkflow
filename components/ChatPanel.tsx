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
  const setMessages = useAppStore((s) => s.setMessages);
  const setWorkflow = useAppStore((s) => s.setWorkflow);

  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [sessionId, setSessionId] = useState("");
  const [streamingContent, setStreamingContent] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const thinkingRef = useRef<string>("");

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
    thinkingRef.current = "";

    abortControllerRef.current = new AbortController();

    await streamParseWorkflow(text, model, sessionId, {
      signal: abortControllerRef.current.signal,
      onChunk: (content) => {
        setStreamingContent(content);
        thinkingRef.current = content;
      },
      onComplete: (workflow) => {
        const thinking = thinkingRef.current;
        if (workflow) {
          setWorkflow(workflow);
          const finalMsg = thinking
            ? `<think>${thinking}</think>\n已生成工作流，请在画布确认/调整后执行。`
            : "已生成工作流，请在画布确认/调整后执行。";
          addMessage("assistant", finalMsg);
        } else {
          const finalMsg = thinking
            ? `<think>${thinking}</think>\n工作流解析失败，请重试。`
            : "工作流解析失败，请重试。";
          addMessage("assistant", finalMsg);
        }
      },
      onError: (message) => {
        const thinking = thinkingRef.current;
        const errorMsg = thinking
          ? `<think>${thinking}</think>\n错误: ${message}`
          : `错误: ${message}`;
        addMessage("assistant", errorMsg);
      }
    });

    setBusy(false);
    setStreamingContent("");
    abortControllerRef.current = null;
  }, [input, busy, model, sessionId, addMessage, setWorkflow]);

  const onSend = onSendStream;

  // 中断当前请求
  const onAbort = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
      // 如果有思考内容，保留到消息中
      const thinking = thinkingRef.current;
      if (thinking) {
        addMessage("assistant", `<think>${thinking}</think>\n(已中断)`);
      }
      setBusy(false);
      setStreamingContent("");
    }
  }, [addMessage]);

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
    <div className="flex h-full flex-col overflow-hidden bg-[#f8f9fb]">
      {/* Header */}
      <div className="shrink-0 flex items-center justify-between border-b border-slate-200/80 bg-white px-4 py-2.5">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="shrink-0 flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-slate-800 to-slate-600 text-[11px] font-bold text-white">
            AI
          </div>
          <div className="min-w-0">
            <div className="text-sm font-semibold text-slate-800">智能对话</div>
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={onNewSession}
            className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-600 shadow-sm transition-all hover:bg-slate-50 hover:shadow whitespace-nowrap"
            title="开始新会话"
          >
            + 新会话
          </button>
          <select
            className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-600 shadow-sm outline-none focus:ring-2 focus:ring-blue-500/20 max-w-[110px]"
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
        <div className="w-full px-3 py-4">
          {loading ? (
            <div className="flex h-full items-center justify-center py-20">
              <div className="text-sm text-slate-400">加载历史对话...</div>
            </div>
          ) : messages.length === 0 ? (
            <div className="flex h-full items-center justify-center py-10">
              <div className="w-full rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
                <div className="text-base font-semibold text-slate-800">描述你的任务</div>
                <div className="mt-1 text-xs text-slate-500">
                  自然语言指令 → 可编辑工作流
                </div>
                <div className="mt-3 grid gap-1.5 text-xs">
                  <div className="cursor-pointer rounded-xl bg-slate-50 px-3 py-2.5 text-slate-600 transition-colors hover:bg-slate-100">
                    巡查 A 区域并拍照，电量低于 30% 时返航
                  </div>
                  <div className="cursor-pointer rounded-xl bg-slate-50 px-3 py-2.5 text-slate-600 transition-colors hover:bg-slate-100">
                    3架无人机同时巡检ABC三个区域
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {messages.map((m) => {
                const isUser = m.role === "user";

                if (isUser) {
                  return (
                    <div key={m.id} className="flex justify-end">
                      <div className="max-w-[88%]">
                        <div className="rounded-2xl rounded-tr-md bg-gradient-to-r from-blue-600 to-blue-500 px-3.5 py-2.5 text-white shadow-sm">
                          <div className="whitespace-pre-wrap break-words text-[13px] leading-5">
                            {m.content}
                          </div>
                        </div>
                        <div className="mt-0.5 text-right text-[10px] text-slate-400">
                          {formatTime(m.ts)}
                        </div>
                      </div>
                    </div>
                  );
                }

                // 解析思考过程和最终回答
                const thinkMatch = m.content.match(/^<think>([\s\S]*?)<\/think>\n?([\s\S]*)$/);
                const thinkPart = thinkMatch ? thinkMatch[1].trim() : null;
                const answerPart = thinkMatch ? thinkMatch[2].trim() : m.content;

                return (
                  <div key={m.id} className="flex justify-start gap-2">
                    <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-slate-700 to-slate-500 text-[9px] font-bold text-white">
                      AI
                    </div>
                    <div className="max-w-[85%] min-w-0">
                      <div className="rounded-2xl rounded-tl-md bg-white px-3.5 py-2.5 text-slate-700 shadow-sm ring-1 ring-slate-200/80">
                        {thinkPart && (
                          <details className="mb-2 group">
                            <summary className="cursor-pointer select-none text-[11px] font-medium text-slate-400 hover:text-slate-600 transition-colors flex items-center gap-1">
                              <svg className="h-3 w-3 transition-transform group-open:rotate-90" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                              </svg>
                              思考过程
                            </summary>
                            <div className="mt-1.5 rounded-lg bg-slate-50 px-3 py-2 text-[11px] text-slate-500 leading-5 whitespace-pre-wrap break-words border border-slate-100 max-h-[200px] overflow-y-auto app-scrollbar">
                              {thinkPart}
                            </div>
                          </details>
                        )}
                        <div className="whitespace-pre-wrap break-words text-[13px] leading-5">
                          {answerPart}
                        </div>
                      </div>
                      <div className="mt-0.5 text-[10px] text-slate-400">{formatTime(m.ts)}</div>
                    </div>
                  </div>
                );
              })}

              {busy && (
                <div className="flex justify-start gap-2">
                  <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-slate-700 to-slate-500 text-[9px] font-bold text-white">
                    AI
                  </div>
                  <div className="max-w-[85%] min-w-0">
                    <div className="rounded-2xl rounded-tl-md bg-white px-3.5 py-2.5 shadow-sm ring-1 ring-slate-200/80">
                      {streamingContent ? (
                        <div>
                          <div className="flex items-center gap-1.5 mb-2">
                            <span className="inline-flex h-1.5 w-1.5 animate-pulse rounded-full bg-blue-400" />
                            <span className="text-[11px] font-medium text-blue-500 animate-pulse">思考中...</span>
                          </div>
                          <div className="rounded-lg bg-slate-50 px-3 py-2 text-[11px] text-slate-500 leading-5 whitespace-pre-wrap break-words border border-slate-100 max-h-[150px] overflow-y-auto app-scrollbar">
                            {streamingContent}
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 text-xs text-slate-400">
                          <span className="inline-flex h-1.5 w-1.5 animate-pulse rounded-full bg-blue-400" />
                          <span className="inline-flex h-1.5 w-1.5 animate-pulse rounded-full bg-blue-400 [animation-delay:150ms]" />
                          <span className="inline-flex h-1.5 w-1.5 animate-pulse rounded-full bg-blue-400 [animation-delay:300ms]" />
                          <span className="ml-1">思考中…</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>
          )}
        </div>
      </div>

      {/* Input Area — shrink-0 确保始终可见 */}
      <div className="shrink-0 border-t border-slate-200/80 bg-white p-3">
        <div className="flex items-end gap-2 rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2 focus-within:border-blue-300 focus-within:ring-2 focus-within:ring-blue-500/10 transition-all">
          <textarea
            className="max-h-24 flex-1 resize-none bg-transparent text-[13px] leading-5 text-slate-700 outline-none placeholder:text-slate-400"
            placeholder={placeholder}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={2}
          />
          <button
            className="inline-flex h-8 w-16 shrink-0 items-center justify-center rounded-lg text-xs font-medium text-white shadow-sm transition-all disabled:cursor-not-allowed disabled:opacity-40"
            style={{ backgroundColor: busy ? '#dc2626' : '#3b82f6' }}
            onClick={busy ? onAbort : onSend}
            disabled={!busy && !input.trim()}
          >
            {busy ? (
              <>
                <svg className="animate-spin -ml-0.5 mr-1 h-3 w-3 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                停止
              </>
            ) : (
              "发送"
            )}
          </button>
        </div>
        <div className="mt-1.5 text-center text-[10px] text-slate-400">Enter 发送 · Shift+Enter 换行</div>
      </div>
    </div>
  );
}
