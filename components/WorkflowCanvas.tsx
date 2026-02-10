"use client";

import { useCallback, useEffect, useMemo, useState, useRef, type MouseEvent } from "react";
import ReactFlow, {
  Background,
  type Connection,
  Controls,
  type Edge,
  type Node,
  useEdgesState,
  useNodesState,
  type OnNodesChange,
  type OnEdgesChange,
  MarkerType
} from "reactflow";
import "reactflow/dist/style.css";
import { useAppStore } from "@/store/useAppStore";
import type { ParsedWorkflow, WorkflowNode, WorkflowEdge } from "@/lib/types";
import NodeEditor from "@/components/NodeEditor";
import EdgeEditor from "@/components/EdgeEditor";
import ContextMenu from "@/components/ContextMenu";
import WorkflowNodeComponent from "@/components/WorkflowNode";
import NodeLibrary from "@/components/NodeLibrary";

const NODE_TYPES = { custom: WorkflowNodeComponent } as const;
const EDGE_TYPES = {} as const;

function wfToReactFlow(wf: ParsedWorkflow): { nodes: Node[]; edges: Edge[] } {
  const COL_W = 220;
  const ROW_H = 120;
  const BASE_X = 50;
  const BASE_Y = 50;

  // 构建邻接表
  const childrenOf = new Map<string, string[]>();
  const parentOf = new Map<string, string[]>();
  for (const e of wf.edges) {
    childrenOf.set(e.from, [...(childrenOf.get(e.from) || []), e.to]);
    parentOf.set(e.to, [...(parentOf.get(e.to) || []), e.from]);
  }

  const nodeMap = new Map(wf.nodes.map((n) => [n.id, n]));
  const positions = new Map<string, { x: number; y: number }>();

  // 找到 parallel_fork 和 parallel_join 节点
  const forkNode = wf.nodes.find((n) => n.type === "parallel_fork");
  const joinNode = wf.nodes.find((n) => n.type === "parallel_join");

  if (forkNode && joinNode) {
    // ---- 并行工作流布局 ----
    // 阶段1：fork 之前的节点（串行）
    const preNodes: string[] = [];
    let cur = wf.nodes.find((n) => n.type === "start")?.id;
    while (cur && cur !== forkNode.id) {
      preNodes.push(cur);
      const children = childrenOf.get(cur) || [];
      cur = children[0];
    }

    // 放置 pre 节点
    for (let i = 0; i < preNodes.length; i++) {
      positions.set(preNodes[i], { x: BASE_X + i * COL_W, y: BASE_Y + 200 });
    }

    // 放置 fork 节点
    const forkCol = preNodes.length;
    positions.set(forkNode.id, { x: BASE_X + forkCol * COL_W, y: BASE_Y + 200 });

    // 阶段2：并行分支
    const branches: string[][] = [];
    const forkChildren = childrenOf.get(forkNode.id) || [];
    for (const firstChild of forkChildren) {
      const branch: string[] = [];
      let node = firstChild;
      while (node && node !== joinNode.id) {
        branch.push(node);
        const children = childrenOf.get(node) || [];
        node = children[0];
      }
      branches.push(branch);
    }

    // 找到最长分支长度
    const maxBranchLen = Math.max(...branches.map((b) => b.length), 1);

    // 放置并行分支节点（每条分支一行）
    const branchStartCol = forkCol + 1;
    const totalBranches = branches.length;
    for (let row = 0; row < totalBranches; row++) {
      const branch = branches[row];
      const y = BASE_Y + row * ROW_H;
      for (let col = 0; col < branch.length; col++) {
        positions.set(branch[col], { x: BASE_X + (branchStartCol + col) * COL_W, y });
      }
    }

    // 放置 join 节点
    const joinCol = branchStartCol + maxBranchLen;
    const joinY = BASE_Y + ((totalBranches - 1) * ROW_H) / 2;
    positions.set(joinNode.id, { x: BASE_X + joinCol * COL_W, y: joinY });

    // 阶段3：join 之后的节点（串行）
    let postCur: string | undefined = (childrenOf.get(joinNode.id) || [])[0];
    let postCol = joinCol + 1;
    while (postCur) {
      positions.set(postCur, { x: BASE_X + postCol * COL_W, y: joinY });
      const postChildren: string[] = childrenOf.get(postCur) || [];
      postCur = postChildren[0];
      postCol++;
    }

    // 更新 fork 节点 Y 居中
    positions.set(forkNode.id, { x: BASE_X + forkCol * COL_W, y: joinY });
    // 更新 pre 节点 Y 居中
    for (const id of preNodes) {
      const pos = positions.get(id)!;
      positions.set(id, { x: pos.x, y: joinY });
    }
  } else {
    // ---- 串行工作流布局（原逻辑优化为拓扑排序） ----
    const visited = new Set<string>();
    const queue: string[] = [];
    const startNode = wf.nodes.find((n) => n.type === "start");
    if (startNode) queue.push(startNode.id);

    let col = 0;
    while (queue.length > 0) {
      const id = queue.shift()!;
      if (visited.has(id)) continue;
      visited.add(id);
      positions.set(id, { x: BASE_X + col * COL_W, y: BASE_Y });
      col++;
      const children = childrenOf.get(id) || [];
      for (const child of children) {
        if (!visited.has(child)) queue.push(child);
      }
    }

    // 放置未被遍历到的孤立节点
    for (const n of wf.nodes) {
      if (!positions.has(n.id)) {
        positions.set(n.id, { x: BASE_X + col * COL_W, y: BASE_Y });
        col++;
      }
    }
  }

  const nodes: Node[] = wf.nodes.map((n) => ({
    id: n.id,
    data: {
      label: n.label,
      nodeType: n.type,
      params: n.params,
    },
    position: positions.get(n.id) || { x: 0, y: 0 },
    type: "custom",
  }));

  const edges: Edge[] = wf.edges.map((e) => ({
    id: e.id,
    source: e.from,
    target: e.to,
    label: e.condition ?? undefined,
    animated: false,
    type: 'default',
    style: { stroke: '#94a3b8', strokeWidth: 1.5 },
    labelStyle: { fontSize: 10, fill: '#64748b' },
    markerEnd: { type: MarkerType.ArrowClosed, color: '#94a3b8', width: 16, height: 16 },
  }));

  return { nodes, edges };
}

function reactFlowToWf(nodes: Node[], edges: Edge[], workflowName: string): ParsedWorkflow {
  const workflowNodes: WorkflowNode[] = nodes.map(n => ({
    id: n.id,
    type: n.data.nodeType || 'action',
    label: n.data.label ?? n.data.nodeType ?? '',
    params: n.data.params || {}
  }));

  const workflowEdges = edges.map(e => ({
    id: e.id,
    from: e.source,
    to: e.target,
    condition: e.label as string || undefined
  }));

  return {
    workflow_name: workflowName,
    nodes: workflowNodes,
    edges: workflowEdges
  };
}

export default function WorkflowCanvas() {
  const workflow = useAppStore((s) => s.workflow);
  const setWorkflow = useAppStore((s) => s.setWorkflow);
  const setActiveMissionId = useAppStore((s) => s.setActiveMissionId);
  const setMissionState = useAppStore((s) => s.setMissionState);
  const upsertHistory = useAppStore((s) => s.upsertHistory);
  const resetExecutionState = useAppStore((s) => s.resetExecutionState);
  const missionState = useAppStore((s) => s.missionState);
  
  const [selectedNode, setSelectedNode] = useState<WorkflowNode | null>(null);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [selectedEdge, setSelectedEdge] = useState<WorkflowEdge | null>(null);
  const [isEdgeEditorOpen, setIsEdgeEditorOpen] = useState(false);
  
  // Context menu state
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    node?: Node;
    edge?: Edge;
  } | null>(null);
  
  const [executing, setExecuting] = useState(false);
  const executeTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [showNodeLibrary, setShowNodeLibrary] = useState(false);

  // Dedupe workflow <-> canvas syncing to avoid infinite loops / memory blowups
  const lastSyncedWorkflowStrRef = useRef<string | null>(null);
  // 标记当前是否是画布内部编辑引起的 workflow 变化（不需要重新布局）
  const internalEditRef = useRef(false);

  const initial = useMemo(() => {
    if (!workflow) return { nodes: [], edges: [] };
    return wfToReactFlow(workflow);
  }, [workflow]);

  const [nodes, setNodes, onNodesChangeInternal] = useNodesState(initial.nodes);
  const [edges, setEdges, onEdgesChangeInternal] = useEdgesState(initial.edges);

  // Only sync from workflow to canvas when workflow changes externally (e.g., from LLM)
  useEffect(() => {
    if (!workflow) {
      setNodes([]);
      setEdges([]);
      lastSyncedWorkflowStrRef.current = null;
      return;
    }
    
    const workflowStr = JSON.stringify(workflow);

    // 如果是内部编辑引起的 workflow 变化，跳过重新布局
    if (internalEditRef.current) {
      internalEditRef.current = false;
      lastSyncedWorkflowStrRef.current = workflowStr;
      return;
    }

    // 只有外部更新（如 LLM 生成新工作流）才重新布局
    if (lastSyncedWorkflowStrRef.current !== workflowStr) {
      const next = wfToReactFlow(workflow);
      setNodes(next.nodes);
      setEdges(next.edges);
      lastSyncedWorkflowStrRef.current = workflowStr;
    }
  }, [setEdges, setNodes, workflow]);

  const onConnect = useCallback(
    (connection: Connection) => {
      if (!connection.source || !connection.target) return;
      setEdges((eds:any) => [
        ...eds,
        {
          ...connection,
          id: `${connection.source}-${connection.target}`,
          type: 'default',
          style: { stroke: '#94a3b8', strokeWidth: 1.5 },
          markerEnd: { type: MarkerType.ArrowClosed, color: '#94a3b8', width: 16, height: 16 },
        }
      ]);
    },
    [setEdges]
  );

  const onNodesChange: OnNodesChange = useCallback(
    (changes) => {
      onNodesChangeInternal(changes);
    },
    [onNodesChangeInternal]
  );

  const onEdgesChange: OnEdgesChange = useCallback(
    (changes) => {
      onEdgesChangeInternal(changes);
    },
    [onEdgesChangeInternal]
  );

  // Sync workflow data when nodes or edges change, but not during initial load
  useEffect(() => {
    if (workflow) {
      const updatedWorkflow = reactFlowToWf(
        nodes,
        edges,
        workflow.workflow_name ?? "自定义工作流"
      );

      const updatedStr = JSON.stringify(updatedWorkflow);
      if (lastSyncedWorkflowStrRef.current !== updatedStr) {
        lastSyncedWorkflowStrRef.current = updatedStr;
        // 标记为内部编辑，避免触发 wfToReactFlow 重新布局
        internalEditRef.current = true;
        setWorkflow(updatedWorkflow);
      }
    }
  }, [nodes, edges, workflow, setWorkflow]);

  // Handle keyboard events for delete
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // 如果焦点在可编辑元素中（如 NodeEditor 的 input），忽略键盘事件
      const tag = (event.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || (event.target as HTMLElement)?.isContentEditable) {
        return;
      }

      if (event.key === 'Delete' || event.key === 'Backspace') {
        // Delete selected nodes and edges
        const selectedNodes = nodes.filter(n => n.selected);
        const selectedEdges = edges.filter(e => e.selected);
        
        if (selectedNodes.length > 0 || selectedEdges.length > 0) {
          const nodeIds = selectedNodes.map(n => n.id);
          const edgeIds = selectedEdges.map(e => e.id);
          
          setNodes(currentNodes => currentNodes.filter(n => !nodeIds.includes(n.id)));
          setEdges(currentEdges => currentEdges.filter(e => !edgeIds.includes(e.id)));
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [nodes, edges, setNodes, setEdges]);

  // Close context menu when clicking outside
  useEffect(() => {
    const handleClickOutside = () => setContextMenu(null);
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  const onNodeContextMenu = useCallback(
    (event: React.MouseEvent, node: Node) => {
      event.preventDefault();
      setContextMenu({
        x: event.clientX,
        y: event.clientY,
        node
      });
    },
    []
  );

  const onEdgeContextMenu = useCallback(
    (event: React.MouseEvent, edge: Edge) => {
      event.preventDefault();
      setContextMenu({
        x: event.clientX,
        y: event.clientY,
        edge
      });
    },
    []
  );

  const handleContextMenuEditNode = useCallback(
    (node: Node) => {
      const workflowNode: WorkflowNode = {
        id: node.id,
        type: node.data.nodeType || node.data.label,
        label: node.data.label,
        params: node.data.params || {}
      };
      setSelectedNode(workflowNode);
      setIsEditorOpen(true);
    },
    []
  );

  const handleContextMenuEditEdge = useCallback(
    (edge: Edge) => {
      const workflowEdge: WorkflowEdge = {
        id: edge.id,
        from: edge.source,
        to: edge.target,
        condition: edge.label as string || undefined
      };
      setSelectedEdge(workflowEdge);
      setIsEdgeEditorOpen(true);
    },
    []
  );

  const handleContextMenuDeleteNode = useCallback(
    (nodeId: string) => {
      setNodes(currentNodes => currentNodes.filter(n => n.id !== nodeId));
    },
    []
  );

  const handleContextMenuDeleteEdge = useCallback(
    (edgeId: string) => {
      setEdges(currentEdges => currentEdges.filter(e => e.id !== edgeId));
    },
    []
  );

  const onNodeDoubleClick = useCallback(
    (event: React.MouseEvent, node: Node) => {
      const workflowNode: WorkflowNode = {
        id: node.id,
        type: node.data.nodeType || node.data.label,
        label: node.data.label,
        params: node.data.params || {}
      };
      setSelectedNode(workflowNode);
      setIsEditorOpen(true);
    },
    []
  );

  const onEdgeDoubleClick = useCallback(
    (event: React.MouseEvent, edge: Edge) => {
      const workflowEdge: WorkflowEdge = {
        id: edge.id,
        from: edge.source,
        to: edge.target,
        condition: edge.label as string || undefined
      };
      setSelectedEdge(workflowEdge);
      setIsEdgeEditorOpen(true);
    },
    []
  );

  const onDragOver = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      event.dataTransfer.dropEffect = 'move';
    },
    []
  );

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      
      const type = event.dataTransfer.getData('application/reactflow');
      if (!type) return;

      const reactFlowBounds = event.currentTarget.getBoundingClientRect();
      const position = {
        x: event.clientX - reactFlowBounds.left,
        y: event.clientY - reactFlowBounds.top,
      };

      const newNode: Node = {
        id: `${type}-${Date.now()}`,
        type: 'custom',
        position,
        data: {
          label: type,
          nodeType: type,
          params: {}
        },
      };

      setNodes((nds) => {
        const updatedNodes = [...nds, newNode];
        return updatedNodes;
      });
    },
    [setNodes, edges]
  );

  const handleNodeUpdate = useCallback(
    (updatedNode: WorkflowNode) => {
      setNodes((nds) => {
        const updatedNodes = nds.map(n => 
          n.id === updatedNode.id 
            ? {
                ...n,
                data: {
                  ...n.data,
                  label: updatedNode.label,
                  nodeType: updatedNode.type || n.data.nodeType,
                  params: updatedNode.params
                }
              }
            : n
        );
        return updatedNodes;
      });
    },
    [setNodes, edges]
  );

  // 双击节点库添加节点到画布
  const addNodeFromLibrary = useCallback(
    (nodeType: string) => {
      const offsetX = 100 + Math.random() * 300;
      const offsetY = 100 + Math.random() * 200;
      const newNode: Node = {
        id: `${nodeType}-${Date.now()}`,
        type: 'custom',
        position: { x: offsetX, y: offsetY },
        data: {
          label: nodeType,
          nodeType: nodeType,
          params: {}
        },
      };
      setNodes((nds) => [...nds, newNode]);
    },
    [setNodes]
  );

  const handleEdgeUpdate = useCallback(
    (updatedEdge: WorkflowEdge) => {
      setEdges((eds) => {
        const updatedEdges = eds.map(e => 
          e.id === updatedEdge.id 
            ? {
                ...e,
                label: updatedEdge.condition
              }
            : e
        );
        return updatedEdges;
      });
    },
    [setEdges, nodes]
  );

  const onExecute = useCallback(async () => {
    if (!workflow || executing) return;
    
    if (executeTimeoutRef.current) {
      clearTimeout(executeTimeoutRef.current);
    }
    
    setExecuting(true);
    resetExecutionState();

    try {
      const res = await fetch("/api/workflow/execute", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ workflow })
      });

      if (!res.ok) {
        setExecuting(false);
        return;
      }
      const data = (await res.json()) as { missionId: string; state: any };

      setActiveMissionId(data.missionId);
      setMissionState(data.state);

      upsertHistory({
        id: data.missionId,
        ts: Date.now(),
        instruction: workflow.workflow_name,
        nodeCount: workflow.nodes.length,
        status: data.state.status,
        missionId: data.missionId
      });
    } catch (error) {
      console.error('Execute workflow failed:', error);
    } finally {
      setExecuting(false);
    }
  }, [workflow, executing, setActiveMissionId, setMissionState, upsertHistory, resetExecutionState]);
  
  // 清理定时器
  useEffect(() => {
    return () => {
      if (executeTimeoutRef.current) {
        clearTimeout(executeTimeoutRef.current);
      }
    };
  }, []);

  // 任务完成/失败时：清除 currentNode
  useEffect(() => {
    if (!missionState) return;
    const { status } = missionState;
    if (status === "completed" || status === "failed") {
      useAppStore.getState().setCurrentNode(null);
    }
  }, [missionState?.status]);

  // 根据节点执行状态动态更新边样式（按执行顺序逐步标记）
  const executedNodes = useAppStore((s) => s.executedNodes);
  const failedNodes = useAppStore((s) => s.failedNodes);
  const currentNode = useAppStore((s) => s.currentNode);

  useEffect(() => {
    if (executedNodes.size === 0 && failedNodes.size === 0 && !currentNode) return;

    setEdges(eds => eds.map(e => {
      const sourceExecuted = executedNodes.has(e.source);
      const targetExecuted = executedNodes.has(e.target);
      const sourceFailed = failedNodes.has(e.source);
      const targetFailed = failedNodes.has(e.target);
      const targetIsCurrent = currentNode === e.target;
      const sourceIsCurrent = currentNode === e.source;

      // 当前执行中的边：源节点已完成，目标节点正在执行
      if ((sourceExecuted || sourceIsCurrent) && targetIsCurrent) {
        return {
          ...e,
          animated: true,
          style: { stroke: '#3b82f6', strokeWidth: 2.5 },
          markerEnd: { type: MarkerType.ArrowClosed, color: '#3b82f6', width: 18, height: 18 },
        };
      }

      // 已完成的边：源和目标都已执行
      if (sourceExecuted && targetExecuted) {
        return {
          ...e,
          animated: false,
          style: { stroke: '#10b981', strokeWidth: 2 },
          markerEnd: { type: MarkerType.ArrowClosed, color: '#10b981', width: 16, height: 16 },
        };
      }

      // 失败的边：目标节点失败
      if (targetFailed || sourceFailed) {
        return {
          ...e,
          animated: false,
          style: { stroke: '#ef4444', strokeWidth: 2 },
          markerEnd: { type: MarkerType.ArrowClosed, color: '#ef4444', width: 16, height: 16 },
        };
      }

      // 未执行的边：保持默认样式
      return {
        ...e,
        animated: false,
        style: { stroke: '#94a3b8', strokeWidth: 1.5 },
        markerEnd: { type: MarkerType.ArrowClosed, color: '#94a3b8', width: 16, height: 16 },
      };
    }));
  }, [executedNodes, failedNodes, currentNode, setEdges]);

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-slate-200/80 bg-white px-4 py-2">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-slate-600">画布</span>
          {missionState && (
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
              missionState.status === "completed" ? "bg-emerald-100 text-emerald-700" :
              missionState.status === "failed" ? "bg-red-100 text-red-700" :
              missionState.status === "running" ? "bg-blue-100 text-blue-700" :
              "bg-slate-100 text-slate-600"
            }`}>
              {missionState.status === "completed" ? "✓ 完成" :
               missionState.status === "failed" ? "✗ 失败" :
               missionState.status === "running" ? `▶ ${missionState.progress}%` :
               missionState.status}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 shadow-sm transition-all hover:bg-slate-50 hover:shadow"
            onClick={() => setShowNodeLibrary(true)}
          >
            <svg className="mr-1.5 h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            节点库
          </button>
          <button
            className="inline-flex items-center justify-center rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white shadow-sm transition-all hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed min-w-[80px]"
            onClick={onExecute}
            disabled={!workflow || executing}
          >
          {executing ? (
            <>
              <svg className="animate-spin -ml-0.5 mr-1.5 h-3 w-3 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              执行中
            </>
          ) : (
            <>▶ 执行</>
          )}
          </button>
        </div>
      </div>
      <div className="flex-1">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onNodeDoubleClick={onNodeDoubleClick}
          onEdgeDoubleClick={onEdgeDoubleClick}
          onNodeContextMenu={onNodeContextMenu}
          onEdgeContextMenu={onEdgeContextMenu}
          onDragOver={onDragOver}
          onDrop={onDrop}
          fitView
          nodeTypes={NODE_TYPES}
          edgeTypes={EDGE_TYPES}
        >
          <Background gap={20} color="#e2e8f0" />
          <Controls />
        </ReactFlow>
        
        {contextMenu && (
          <ContextMenu
            x={contextMenu.x}
            y={contextMenu.y}
            onClose={() => setContextMenu(null)}
            onEditNode={handleContextMenuEditNode}
            onEditEdge={handleContextMenuEditEdge}
            onDeleteNode={handleContextMenuDeleteNode}
            onDeleteEdge={handleContextMenuDeleteEdge}
            selectedNode={contextMenu.node}
            selectedEdge={contextMenu.edge}
          />
        )}
        
        {isEditorOpen && (
          <NodeEditor
            node={selectedNode}
            onNodeUpdate={handleNodeUpdate}
            onClose={() => {
              setIsEditorOpen(false);
              setSelectedNode(null);
            }}
          />
        )}
        
        {isEdgeEditorOpen && (
          <EdgeEditor
            edge={selectedEdge}
            onEdgeUpdate={handleEdgeUpdate}
            onClose={() => {
              setIsEdgeEditorOpen(false);
              setSelectedEdge(null);
            }}
          />
        )}
      </div>

      {/* 节点库弹窗 */}
      {showNodeLibrary && (
        <NodeLibrary onClose={() => setShowNodeLibrary(false)} onAddNode={addNodeFromLibrary} />
      )}
    </div>
  );
}
