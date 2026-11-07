import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { auth, storage } from "../config/firebaseConfig";
import { callApi } from "./api";
import { UserProfile } from "../types";

// Profile data lives in Tiger Cloud (via the API). Photos and videos stay in
// Firebase Storage; only their URLs are saved in the database.

export function getUser(uid: string) {
  return callApi<UserProfile | null>("getUser", { uid });
}

/** Creates the signed-in user's profile (the server uses the auth uid). */
export async function createUser(
  _uid: string,
  data: { name: string; email: string; photoURL?: string; skillLevel?: string },
): Promise<void> {
  await callApi("createUser", data);
}

// Skill level picked on the signup form, held until the email is verified.
let pendingSkillLevel: string | undefined;
export function setPendingSkillLevel(level: string) { pendingSkillLevel = level; }

let ensuredUid: string | null = null;
/**
 * Adds the signed-in, verified user to GO!'s player list in Tiger (no-op if
 * they're already there). Called after verification and on every app start.
 */
export async function ensureMyProfile(): Promise<void> {
  const user = auth.currentUser;
  if (!user || ensuredUid === user.uid) return;
  const isSocial = user.providerData.some(p => p.providerId !== "password");
  if (!user.emailVerified && !isSocial) return;
  await createUser(user.uid, {
    name: user.displayName || user.email?.split("@")[0] || "Player",
    email: user.email ?? "",
    photoURL: user.photoURL ?? "",
    skillLevel: pendingSkillLevel,
  });
  ensuredUid = user.uid;
}

export async function updateUser(
  _uid: string,
  updates: Partial<Omit<UserProfile, "uid" | "createdAt">>,
): Promise<void> {
  await callApi("updateUser", updates);
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
