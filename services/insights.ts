import { callApi } from "./api";
import { Session } from "../types";

// Court Pulse and the leaderboard read TimescaleDB continuous aggregates.

export interface CourtPulse {
  courtName: string;
  byHour: { hour: number; activity: number }[];
  byDay: { dayOfWeek: number; activity: number }[];  // 1 = Monday
  thisWeek: number;
  lastWeek: number;
}

export interface LeaderboardEntry {
  rank: number;
  uid: string;
  name: string;
  position: string;
  photoURL: string;
  gamesPlayed: number;
  gamesHosted: number;
}

export interface AskGoResult {
  reply: string;
  filters: Record<string, any>;
  sessions: Session[];
}

export function getCourtPulse(courtName: string) {
  return callApi<CourtPulse>("courtPulse", { courtName });
}

export function getTopCourts() {
  return callApi<{ topCourts: { courtName: string; courtType: string; activity: number }[] }>("courtPulse", {});
}

export function getLeaderboard() {
  return callApi<LeaderboardEntry[]>("leaderboard");
}

/** Natural-language search: Gemini reads the request, Tiger runs the query. */
export function askGo(query: string, location?: { latitude: number; longitude: number } | null) {
  return callApi<AskGoResult>("askGo", { query, lat: location?.latitude, lng: location?.longitude });
}
