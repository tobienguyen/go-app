import { callApi } from "./api";

// Follows / friend requests, stored in Tiger Cloud via the API.
// The signed-in user is always taken from their Firebase token on the server,
// so `fromUid` arguments are kept only for compatibility with existing screens.

export interface Follow {
  id: string;          // "fromUid|toUid"
  fromUid: string;
  toUid: string;
  status: "pending" | "accepted";
  fromName?: string;
  createdAt: string;
}

export async function sendFollowRequest(_fromUid: string, toUid: string): Promise<void> {
  await callApi("followRequest", { toUid });
}

export async function acceptFollowRequest(followId: string): Promise<void> {
  const [fromUid] = followId.split("|");
  await callApi("acceptFollow", { fromUid });
}

export async function removeFollow(fromUid: string, toUid: string): Promise<void> {
  await callApi("removeFollow", { fromUid, toUid });
}

export async function getFollowStatus(
  _fromUid: string, toUid: string,
): Promise<"none" | "pending" | "accepted"> {
  const res = await callApi<{ status: "none" | "pending" | "accepted" }>("followStatus", { toUid });
  return res.status;
}

export function getPendingRequests(_uid: string): Promise<Follow[]> {
  return callApi<Follow[]>("pendingFollows");
}

export async function getFollowCounts(uid: string): Promise<{ followers: number; following: number }> {
  return callApi("followCounts", { uid });
}

export async function getFollowerCount(uid: string): Promise<number> {
  return (await getFollowCounts(uid)).followers;
}

export async function getFollowingCount(uid: string): Promise<number> {
  return (await getFollowCounts(uid)).following;
}
