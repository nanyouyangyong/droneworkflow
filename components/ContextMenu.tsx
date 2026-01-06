"use client";

import { useState, useCallback } from "react";
import type { Node, Edge } from "reactflow";

interface ContextMenuProps {
  x: number;
  y: number;
  onClose: () => void;
  onEditNode: (node: Node) => void;
  onEditEdge: (edge: Edge) => void;
  onDeleteNode: (nodeId: string) => void;
  onDeleteEdge: (edgeId: string) => void;
  selectedNode?: Node;
  selectedEdge?: Edge;
}

export default function ContextMenu({ 
  x, 
  y, 
  onClose, 
  onEditNode, 
  onEditEdge, 
  onDeleteNode, 
  onDeleteEdge,
  selectedNode,
  selectedEdge 
}: ContextMenuProps) {
  
  const handleEditNode = useCallback(() => {
    if (selectedNode) {
      onEditNode(selectedNode);
    }
    onClose();
  }, [selectedNode, onEditNode, onClose]);

  const handleEditEdge = useCallback(() => {
    if (selectedEdge) {
      onEditEdge(selectedEdge);
    }
    onClose();
  }, [selectedEdge, onEditEdge, onClose]);

  const handleDeleteNode = useCallback(() => {
    if (selectedNode) {
      onDeleteNode(selectedNode.id);
    }
    onClose();
  }, [selectedNode, onDeleteNode, onClose]);

  const handleDeleteEdge = useCallback(() => {
    if (selectedEdge) {
      onDeleteEdge(selectedEdge.id);
    }
    onClose();
  }, [selectedEdge, onDeleteEdge, onClose]);

  return (
    <div
      className="fixed z-50 bg-white border border-slate-200 rounded-lg shadow-lg py-1"
      style={{ left: x, top: y }}
      onClick={(e) => e.stopPropagation()}
    >
      {selectedNode && (
        <>
          <button
            onClick={handleEditNode}
            className="w-full px-4 py-2 text-left text-sm hover:bg-slate-100 flex items-center space-x-2"
          >
            <span>✏️</span>
            <span>编辑节点</span>
          </button>
          <button
            onClick={handleDeleteNode}
            className="w-full px-4 py-2 text-left text-sm hover:bg-slate-100 flex items-center space-x-2 text-red-600"
          >
            <span>🗑️</span>
            <span>删除节点</span>
          </button>
        </>
      )}
      
      {selectedEdge && (
        <>
          <button
            onClick={handleEditEdge}
            className="w-full px-4 py-2 text-left text-sm hover:bg-slate-100 flex items-center space-x-2"
          >
            <span>✏️</span>
            <span>编辑条件</span>
          </button>
          <button
            onClick={handleDeleteEdge}
            className="w-full px-4 py-2 text-left text-sm hover:bg-slate-100 flex items-center space-x-2 text-red-600"
          >
            <span>🗑️</span>
            <span>删除连接</span>
          </button>
        </>
      )}
    </div>
  );
}
