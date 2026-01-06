"use client";

import { useMemo, useState } from "react";
import { useAppStore } from "@/store/useAppStore";

const models = ["gpt-4", "claude-3.5", "deepseek-coder", "local-llm"] as const;

export default function ChatPanel() {
  const model = useAppStore((s) => s.model);
  const setModel = useAppStore((s) => s.setModel);
  const messages = useAppStore((s) => s.messages);
  const addMessage = useAppStore((s) => s.addMessage);
  const setWorkflow = useAppStore((s) => s.setWorkflow);

  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);

  const placeholder = useMemo(
    () => "描述你的无人机任务，如：'巡查A区域并拍照，电量低于30%时返航'",
    []
  );

  async function onSend() {
    const text = input.trim();
    if (!text || busy) return;

    setInput("");
    addMessage("user", text);
    setBusy(true);

    try {
      const res = await fetch("/api/llm/parse", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ userInput: text, model })
      });

      if (!res.ok) {
        const errText = await res.text();
        addMessage("assistant", `解析失败: ${errText}`);
        return;
      }

      const data = (await res.json()) as { workflow: unknown };
      setWorkflow(data.workflow as any);
      addMessage("assistant", "已生成工作流，请在画布确认/调整后执行。");
    } catch (e: any) {
      addMessage("assistant", `请求失败: ${e?.message ?? String(e)}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
        <div className="text-sm font-semibold">大模型对话</div>
        <select
          className="rounded border border-slate-200 bg-white px-2 py-1 text-sm"
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

      <div className="flex-1 overflow-auto p-4">
        {messages.length === 0 ? (
          <div className="text-sm text-slate-500">在左下角输入指令开始。</div>
        ) : (
          <div className="space-y-3">
            {messages.map((m) => (
              <div key={m.id} className="text-sm">
                <div className="mb-1 font-medium text-slate-700">
                  {m.role === "user" ? "用户" : "助手"}
                </div>
                <div className="whitespace-pre-wrap rounded border border-slate-200 bg-slate-50 p-2">
                  {m.content}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="border-t border-slate-200 p-3">
        <textarea
          className="h-24 w-full resize-none rounded border border-slate-200 p-2 text-sm outline-none focus:border-slate-400"
          placeholder={placeholder}
          value={input}
          onChange={(e) => setInput(e.target.value)}
        />
        <div className="mt-2 flex justify-end">
          <button
            className="rounded bg-slate-900 px-3 py-2 text-sm text-white disabled:opacity-50"
            onClick={onSend}
            disabled={busy || !input.trim()}
          >
            {busy ? "解析中..." : "发送并生成工作流"}
          </button>
        </div>
      </div>
    </div>
  );
}
