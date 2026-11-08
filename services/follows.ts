import {
  collection, query, where, getDocs, addDoc, updateDoc, deleteDoc,
  doc, serverTimestamp,
} from "firebase/firestore";
import { db } from "../config/firebaseConfig";

export interface Follow {
  id: string;
  fromUid: string;
  toUid: string;
  status: "pending" | "accepted";
  createdAt: any;
}

export async function sendFollowRequest(fromUid: string, toUid: string): Promise<void> {
  const q = query(
    collection(db, "follows"),
    where("fromUid", "==", fromUid),
    where("toUid", "==", toUid),
  );
  const existing = await getDocs(q);
  if (!existing.empty) return;
  await addDoc(collection(db, "follows"), {
    fromUid, toUid, status: "pending", createdAt: serverTimestamp(),
  });
}

export async function acceptFollowRequest(followId: string): Promise<void> {
  await updateDoc(doc(db, "follows", followId), { status: "accepted" });
}

export async function removeFollow(fromUid: string, toUid: string): Promise<void> {
  const q = query(
    collection(db, "follows"),
    where("fromUid", "==", fromUid),
    where("toUid", "==", toUid),
  );
  const snap = await getDocs(q);
  await Promise.all(snap.docs.map(d => deleteDoc(d.ref)));
}

export async function getFollowStatus(
  fromUid: string, toUid: string,
): Promise<"none" | "pending" | "accepted"> {
  const q = query(
    collection(db, "follows"),
    where("fromUid", "==", fromUid),
    where("toUid", "==", toUid),
  );
  const snap = await getDocs(q);
  if (snap.empty) return "none";
  return snap.docs[0].data().status as "pending" | "accepted";
}

export async function getPendingRequests(uid: string): Promise<Follow[]> {
  const q = query(
    collection(db, "follows"),
    where("toUid", "==", uid),
    where("status", "==", "pending"),
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as Follow));
}

export async function getFollowerCount(uid: string): Promise<number> {
  const q = query(
    collection(db, "follows"),
    where("toUid", "==", uid),
    where("status", "==", "accepted"),
  );
  return (await getDocs(q)).size;
}

export async function getFollowingCount(uid: string): Promise<number> {
  const q = query(
    collection(db, "follows"),
    where("fromUid", "==", uid),
    where("status", "==", "accepted"),
  );
  return (await getDocs(q)).size;
}
