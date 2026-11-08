import { callApi, poll } from "./api";
import { Session, CourtType } from "../types";

export function listSessions(params: { lat?: number; lng?: number; courtType?: string } = {}) {
  return callApi<Session[]>("listSessions", params);
}

/** Upcoming games, refreshed every 10 seconds so new pins appear live. */
export function subscribeSessions(
  getParams: () => { lat?: number; lng?: number },
  onData: (sessions: Session[]) => void,
  onError?: (e: Error) => void,
): () => void {
  return poll(() => listSessions(getParams()), 10_000, onData, onError);
}

export function getSession(id: string) {
  return callApi<Session | null>("getSession", { id });
}

export function createSession(data: {
  title: string;
  description: string;
  type: CourtType;
  price: number;
  skillLevel: string;
  date: string;        // YYYY-MM-DD (local)
  startTime: string;   // "7:00 PM"
  endTime: string;
  maxPlayers: number;
  coordinate: { latitude: number; longitude: number };
  address: string;
}) {
  return callApi<Session>("createSession", data);
}

export function joinSession(id: string) {
  return callApi<Session>("joinSession", { id });
}

export function leaveSession(id: string) {
  return callApi<Session>("leaveSession", { id });
}

/** Local calendar date as YYYY-MM-DD (not UTC). */
export function localDateString(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
