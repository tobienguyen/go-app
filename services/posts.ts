import {
  collection, doc, addDoc, getDocs, updateDoc, query,
  where, orderBy, limit, onSnapshot, serverTimestamp,
  increment, arrayUnion, arrayRemove,
} from "firebase/firestore";
import { db } from "../config/firebaseConfig";
import { Post } from "../types";

export function subscribeFeed(
  count: number,
  onData: (posts: Post[]) => void,
): () => void {
  const q = query(collection(db, "posts"), orderBy("createdAt", "desc"), limit(count));
  return onSnapshot(q, snap => {
    onData(snap.docs.map(d => ({ id: d.id, ...d.data() } as Post)));
  });
}

export async function getUserPosts(uid: string, count = 5): Promise<Post[]> {
  const q = query(
    collection(db, "posts"),
    where("authorId", "==", uid),
    orderBy("createdAt", "desc"),
    limit(count),
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as Post));
}

export async function createPost(data: Omit<Post, "id" | "createdAt">): Promise<string> {
  const ref = await addDoc(collection(db, "posts"), {
    ...data,
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

export async function toggleLike(postId: string, uid: string, liked: boolean): Promise<void> {
  await updateDoc(doc(db, "posts", postId), {
    likedBy: liked ? arrayRemove(uid) : arrayUnion(uid),
    likes: increment(liked ? -1 : 1),
  });
}
