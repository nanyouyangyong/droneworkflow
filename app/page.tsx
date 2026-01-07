"use client";

import ChatPanel from "@/components/ChatPanel";
import NodeLibrary from "@/components/NodeLibrary";
import WorkflowCanvas from "@/components/WorkflowCanvas";
import LogPanel from "@/components/LogPanel";
import WorkflowHistory from "@/components/WorkflowHistory";

export default function Home() {
  const handleNodeSelect = (nodeType: string) => {
    // This will be handled by the WorkflowCanvas component
    console.log("Selected node type:", nodeType);
  };

  return (
    <main className="h-screen w-screen overflow-hidden">
      <div className="grid h-full grid-cols-[400px_200px_200px_1fr_400px] gap-0">
        {/* 大模型对话 */}
        <div className="h-full min-h-0 overflow-hidden border-r border-slate-200 bg-white">
          <ChatPanel />
        </div>
        {/* 节点库 */}
        <div className="h-full border-r border-slate-200 bg-white">
          <NodeLibrary onNodeSelect={handleNodeSelect} />
        </div>
        {/* 工作流历史记录 */}
        <div className="h-full border-r border-slate-200 bg-white">
          <WorkflowHistory />
        </div>
        {/* 工作流画布 */}
        <div className="h-full border-r border-slate-200 bg-slate-50">
          <WorkflowCanvas />
        </div>
        {/* 日志面板 */}
        <div className="h-full min-h-0 overflow-hidden bg-white">
          <LogPanel />
        </div>
      </div>
    </main>
  );
}
