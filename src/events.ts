import { randomUUID } from "node:crypto";

export type MissionEventType =
  | "status"
  | "tool.started"
  | "tool.completed"
  | "verification"
  | "recovery"
  | "agent.started"
  | "agent.completed";

export interface MissionEvent {
  id: string;
  taskId: string;
  type: MissionEventType;
  timestamp: string;
  message: string;
  data?: Record<string, unknown>;
}

export function missionEvent(
  taskId: string,
  type: MissionEventType,
  message: string,
  data?: Record<string, unknown>,
): MissionEvent {
  return { id: randomUUID(), taskId, type, timestamp: new Date().toISOString(), message, data };
}
