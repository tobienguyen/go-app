import { callApi, poll } from "./api";
import { Post } from "../types";

export function getFeed(count = 50) {
  return callApi<Post[]>("feed", { limit: count });
}

/** Feed refreshed every 15 seconds. */
export function subscribeFeed(
  count: number,
  onData: (posts: Post[]) => void,
  onError?: (e: Error) => void,
): () => void {
  return poll(() => getFeed(count), 15_000, onData, onError);
}

export function getUserPosts(uid: string, count = 5) {
  return callApi<Post[]>("userPosts", { uid, limit: count });
}

/** Author name, initials and position are filled in by the server. */
export function createPost(data: { content: string; imageUrl?: string; [key: string]: any }) {
  return callApi<{ id: string }>("createPost", { content: data.content, imageUrl: data.imageUrl });
}

export function toggleLike(postId: string) {
  return callApi<{ liked: boolean; likes: number }>("toggleLike", { postId });
}
