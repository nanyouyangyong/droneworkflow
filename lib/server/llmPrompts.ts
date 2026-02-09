import { v4 as uuidv4 } from "uuid";
import type { ParsedWorkflow } from "@/lib/types";

// ============================================================================
// LLM 系统提示词（统一维护）
// ============================================================================

export const WORKFLOW_SYSTEM_PROMPT = `你是一个无人机工作流生成助手。用户会用自然语言描述无人机任务，你需要将其解析为结构化的工作流 JSON。

## 可用的节点类型：
- start: 开始节点（必须有且只有一个）
- end: 结束节点（必须有且只有一个）
- 起飞: 无人机起飞，参数 { altitude: number } 表示起飞高度（米）
- 降落: 无人机降落
- 悬停: 悬停等待，参数 { duration: number } 表示悬停时间（秒）
- 飞行到点: 飞行到指定坐标，参数 { lat: number, lng: number, altitude: number }
- 查询天气: 查询指定城市的天气，参数 { city: string }
- 区域巡检: 巡检指定区域，参数 { areaName: string }
- 定时拍照: 定时拍照，参数 { intervalSec: number } 表示拍照间隔（秒）
- 录像: 开始/停止录像，参数 { action: "start" | "stop" }
- 电量检查: 检查电量，参数 { threshold: number } 表示电量阈值百分比
- 返航: 返回起飞点
- 条件判断: 条件分支节点

## 输出格式：
必须返回一个有效的 JSON 对象，格式如下：
{
  "workflow_name": "工作流名称",
  "nodes": [
    { "id": "唯一ID", "type": "节点类型", "label": "显示标签", "params": {} }
  ],
  "edges": [
    { "id": "唯一ID", "from": "源节点ID", "to": "目标节点ID", "condition": "条件表达式或null" }
  ]
}

## 注意事项：
1. 每个工作流必须以 start 节点开始，以 end 节点结束
2. 节点 ID 使用简短的唯一标识如 node_1, node_2 等
3. 边的 ID 使用 edge_1, edge_2 等
4. condition 字段用于条件分支，如 "battery < 30%" 表示电量低于30%时走这条边
5. 只返回 JSON，不要有其他文字说明
`;

// ============================================================================
// Mock 工作流生成（LLM 不可用时的降级方案）
// ============================================================================

export function createMockWorkflow(userInput: string): ParsedWorkflow {
  const startId = uuidv4();
  const takeoffId = uuidv4();
  const patrolId = uuidv4();
  const photoId = uuidv4();
  const batteryId = uuidv4();
  const rtbId = uuidv4();
  const landId = uuidv4();
  const endId = uuidv4();

  return {
    workflow_name: userInput.slice(0, 24) || "默认工作流",
    nodes: [
      { id: startId, type: "start", label: "开始" },
      { id: takeoffId, type: "起飞", label: "起飞", params: { altitude: 30 } },
      { id: patrolId, type: "区域巡检", label: "区域巡检", params: { areaName: "A区域" } },
      { id: photoId, type: "定时拍照", label: "定时拍照", params: { intervalSec: 10 } },
      { id: batteryId, type: "电量检查", label: "电量检查", params: { threshold: 30 } },
      { id: rtbId, type: "返航", label: "返航" },
      { id: landId, type: "降落", label: "降落" },
      { id: endId, type: "end", label: "结束" }
    ],
    edges: [
      { id: uuidv4(), from: startId, to: takeoffId, condition: null },
      { id: uuidv4(), from: takeoffId, to: patrolId, condition: null },
      { id: uuidv4(), from: patrolId, to: photoId, condition: null },
      { id: uuidv4(), from: photoId, to: batteryId, condition: null },
      { id: uuidv4(), from: batteryId, to: rtbId, condition: "battery < 30%" },
      { id: uuidv4(), from: batteryId, to: photoId, condition: "battery >= 30%" },
      { id: uuidv4(), from: rtbId, to: landId, condition: null },
      { id: uuidv4(), from: landId, to: endId, condition: null }
    ]
  };
}

// ============================================================================
// LLM 响应解析工具
// ============================================================================

export function extractWorkflowJSON(content: string): ParsedWorkflow {
  let jsonStr = content;
  const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonMatch) {
    jsonStr = jsonMatch[1].trim();
  } else {
    const start = content.indexOf("{");
    const end = content.lastIndexOf("}");
    if (start >= 0 && end > start) {
      jsonStr = content.slice(start, end + 1);
    }
  }

  const parsed = JSON.parse(jsonStr) as ParsedWorkflow;

  if (!parsed.workflow_name || !Array.isArray(parsed.nodes) || !Array.isArray(parsed.edges)) {
    throw new Error("Invalid workflow structure");
  }

  parsed.nodes = parsed.nodes.map((n, idx) => ({
    ...n,
    id: n.id || `node_${idx + 1}`
  }));

  parsed.edges = parsed.edges.map((e, idx) => ({
    ...e,
    id: e.id || `edge_${idx + 1}`
  }));

  return parsed;
}
