import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, storage } from "../config/firebaseConfig";
import { UserProfile, MediaItem } from "../types";

export async function getUser(uid: string): Promise<UserProfile | null> {
  const snap = await getDoc(doc(db, "users", uid));
  if (!snap.exists()) return null;
  const d = snap.data();
  return {
    uid,
    name: d.name ?? "",
    email: d.email ?? "",
    photoURL: d.photoURL ?? "",
    positions: d.positions ?? [],
    skillLevel: d.skillLevel ?? d.experience ?? "Beginner",
    description: d.description ?? "",
    mediaItems: d.mediaItems ?? [],
    sessionsHosted: d.sessionsHosted ?? 0,
    sessionsAttended: d.sessionsAttended ?? 0,
    createdAt: d.createdAt,
  };
}

export async function createUser(
  uid: string,
  data: { name: string; email: string; photoURL?: string },
): Promise<void> {
  await setDoc(doc(db, "users", uid), {
    name: data.name,
    email: data.email,
    photoURL: data.photoURL ?? "",
    positions: [],
    skillLevel: "Beginner",
    description: "",
    mediaItems: [],
    sessionsHosted: 0,
    sessionsAttended: 0,
    createdAt: serverTimestamp(),
  });
}

export async function updateUser(
  uid: string,
  updates: Partial<Omit<UserProfile, "uid" | "createdAt">>,
): Promise<void> {
  await setDoc(doc(db, "users", uid), updates, { merge: true });
}

export async function uploadAvatar(uid: string, localUri: string): Promise<string> {
  const blob = await uriToBlob(localUri);
  const storageRef = ref(storage, `users/${uid}/avatar.jpg`);
  await uploadBytes(storageRef, blob, { contentType: "image/jpeg" });
  return getDownloadURL(storageRef);
}

export async function uploadMediaItem(
  uid: string,
  localUri: string,
  index: number,
): Promise<string> {
  const blob = await uriToBlob(localUri);
  const storageRef = ref(storage, `users/${uid}/media/${Date.now()}_${index}.jpg`);
  await uploadBytes(storageRef, blob, { contentType: "image/jpeg" });
  return getDownloadURL(storageRef);
}

async function uriToBlob(uri: string): Promise<Blob> {
  const response = await fetch(uri);
  return response.blob();
}

export function isLocalUri(uri: string): boolean {
  return uri.startsWith("file://") || uri.startsWith("ph://") || uri.startsWith("content://");
}
