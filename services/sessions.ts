import {
  collection, doc, getDoc, query, where, orderBy,
  onSnapshot, writeBatch, increment, arrayUnion, arrayRemove,
  Timestamp, QueryConstraint,
} from "firebase/firestore";
import { db } from "../config/firebaseConfig";
import { Session } from "../types";

export async function getSession(id: string): Promise<Session | null> {
  const snap = await getDoc(doc(db, "sessions", id));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as Session;
}

export function subscribeSessions(
  filters: { date?: Date | null; courtType?: string },
  onData: (sessions: Session[]) => void,
  onError?: (e: Error) => void,
): () => void {
  const constraints: QueryConstraint[] = [
    where("active", "==", true),
    orderBy("sessionDate", "asc"),
  ];

  if (filters.date) {
    const dayStart = Timestamp.fromDate(filters.date);
    const next = new Date(filters.date);
    next.setDate(next.getDate() + 1);
    const dayEnd = Timestamp.fromDate(next);
    constraints.push(where("sessionDate", ">=", dayStart));
    constraints.push(where("sessionDate", "<", dayEnd));
  }

  if (filters.courtType && filters.courtType !== "all") {
    constraints.push(where("type", "==", filters.courtType));
  }

  const q = query(collection(db, "sessions"), ...constraints);
  return onSnapshot(
    q,
    snap => onData(snap.docs.map(d => ({ id: d.id, ...d.data() } as Session))),
    onError,
  );
}

export async function joinSession(sessionId: string, uid: string): Promise<void> {
  const batch = writeBatch(db);
  batch.update(doc(db, "sessions", sessionId), {
    spotsFilled: increment(1),
    attendees: arrayUnion(uid),
  });
  batch.update(doc(db, "users", uid), {
    sessionsAttended: increment(1),
  });
  await batch.commit();
}

export async function leaveSession(sessionId: string, uid: string): Promise<void> {
  const batch = writeBatch(db);
  batch.update(doc(db, "sessions", sessionId), {
    spotsFilled: increment(-1),
    attendees: arrayRemove(uid),
  });
  batch.update(doc(db, "users", uid), {
    sessionsAttended: increment(-1),
  });
  await batch.commit();
}
