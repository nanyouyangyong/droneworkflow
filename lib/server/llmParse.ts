import { v4 as uuidv4 } from "uuid";
import { z } from "zod";
import type { ParsedWorkflow } from "@/lib/types";

const parseInputSchema = z.object({
  userInput: z.string().min(1),
  model: z.string().optional()
});

function mockParse(userInput: string): ParsedWorkflow {
  const startId = uuidv4();
  const areaId = uuidv4();
  const takeoffId = uuidv4();
  const photoId = uuidv4();
  const batteryId = uuidv4();
  const rtbId = uuidv4();
  const landId = uuidv4();

  return {
    workflow_name: userInput.slice(0, 24),
    nodes: [
      { id: startId, type: "start", label: "开始" },
      { id: areaId, type: "区域定义", label: "区域定义", params: { source: "user" } },
      { id: takeoffId, type: "起飞", label: "起飞", params: { alt: 30 } },
      { id: photoId, type: "定时拍照", label: "定时拍照", params: { intervalSec: 10 } },
      { id: batteryId, type: "电量检查", label: "电量检查", params: { low: 30 } },
      { id: rtbId, type: "返航", label: "返航" },
      { id: landId, type: "降落", label: "降落" }
    ],
    edges: [
      { id: uuidv4(), from: startId, to: areaId, condition: null },
      { id: uuidv4(), from: areaId, to: takeoffId, condition: null },
      { id: uuidv4(), from: takeoffId, to: photoId, condition: null },
      { id: uuidv4(), from: photoId, to: batteryId, condition: null },
      { id: uuidv4(), from: batteryId, to: rtbId, condition: "battery < low" },
      { id: uuidv4(), from: rtbId, to: landId, condition: null }
    ]
  };
}

export async function parseInstruction(body: unknown): Promise<ParsedWorkflow> {
  const { userInput } = parseInputSchema.parse(body);

  // TODO: If OPENAI_API_KEY exists, can implement real structured output parsing.
  // To keep it runnable without keys, default to mock.
  return mockParse(userInput);
}
