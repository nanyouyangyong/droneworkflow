import type { MissionState, ParsedWorkflow, LogEvent, LogLevel } from "@/lib/types";

export type MissionRecord = {
  state: MissionState;
  workflow: ParsedWorkflow;
};

function getMissionMap(): Map<string, MissionRecord> {
  const g = globalThis as any;
  if (!g.__missions) g.__missions = new Map<string, MissionRecord>();
  return g.__missions as Map<string, MissionRecord>;
}

export function upsertMission(missionId: string, record: MissionRecord) {
  getMissionMap().set(missionId, record);
}

export function getMission(missionId: string): MissionRecord | undefined {
  return getMissionMap().get(missionId);
}

export function appendMissionLog(missionId: string, level: LogLevel, message: string, nodeId?: string) {
  const rec = getMissionMap().get(missionId);
  if (!rec) return;
  const log: LogEvent = { ts: Date.now(), level, message, nodeId };
  rec.state.logs.push(log);
}

export function setMissionProgress(missionId: string, progress: number, currentNode?: string) {
  const rec = getMissionMap().get(missionId);
  if (!rec) return;
  rec.state.progress = progress;
  rec.state.currentNode = currentNode;
}

export function setMissionStatus(missionId: string, status: MissionState["status"]) {
  const rec = getMissionMap().get(missionId);
  if (!rec) return;
  rec.state.status = status;
}
