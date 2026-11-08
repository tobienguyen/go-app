import { httpsCallable } from "firebase/functions";
import { functions } from "../config/firebaseConfig";

// Every data request goes through one Cloud Function ("api"), which talks to
// Tiger Cloud. Firebase attaches the signed-in user's token automatically.
const apiFn = httpsCallable(functions, "api");

export async function callApi<T>(action: string, data: Record<string, any> = {}): Promise<T> {
  const res = await apiFn({ action, ...data });
  return res.data as T;
}

/**
 * Polls `load` every `intervalMs` and hands results to `onData`. Replaces
 * Firestore's onSnapshot; returns an unsubscribe function just like it did.
 */
export function poll<T>(
  load: () => Promise<T>,
  intervalMs: number,
  onData: (data: T) => void,
  onError?: (e: Error) => void,
): () => void {
  let stopped = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const tick = async () => {
    try {
      const data = await load();
      if (!stopped) onData(data);
    } catch (e: any) {
      if (!stopped) onError?.(e);
    } finally {
      if (!stopped) timer = setTimeout(tick, intervalMs);
    }
  };
  tick();
  return () => { stopped = true; if (timer) clearTimeout(timer); };
}
