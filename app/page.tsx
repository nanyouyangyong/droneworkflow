"use client";

import ChatPanel from "@/components/ChatPanel";
import NodeLibrary from "@/components/NodeLibrary";
import WorkflowCanvas from "@/components/WorkflowCanvas";
import LogPanel from "@/components/LogPanel";

export default function Home() {
  const handleNodeSelect = (nodeType: string) => {
    // This will be handled by the WorkflowCanvas component
    console.log("Selected node type:", nodeType);
  };

  return (
    <main className="h-screen w-screen overflow-hidden">
      <div className="grid h-full grid-cols-[400px_300px_1fr_400px] gap-0">
        <div className="h-full border-r border-slate-200 bg-white">
          <ChatPanel />
        </div>
        <div className="h-full border-r border-slate-200 bg-white">
          <NodeLibrary onNodeSelect={handleNodeSelect} />
        </div>
        <div className="h-full border-r border-slate-200 bg-slate-50">
          <WorkflowCanvas />
        </div>
        <div className="h-full bg-white">
          <LogPanel />
        </div>
      </div>
    </main>
  );
}
