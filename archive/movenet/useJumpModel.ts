import { useState, useEffect } from "react";
import * as FileSystem from "expo-file-system/legacy";

// Tried in order; first download that passes the size check wins.
const MODEL_URLS = [
  // TFHub post-migration format (float16)
  "https://tfhub.dev/google/lite-model/movenet/singlepose/lightning/tflite/float16/4?lite-format=tflite",
  // TFHub int8 variant (quantized, ~3 MB, works on all hardware)
  "https://tfhub.dev/google/lite-model/movenet/singlepose/lightning/tflite/int8/4?lite-format=tflite",
  // Community-hosted GitHub raw copy
  "https://raw.githubusercontent.com/NSTiwari/Video-Game-Control-using-Pose-Classification-and-TensorFlow-Lite/main/movenet_lightning.tflite",
];

// File name includes a version so any previously-corrupted cache is bypassed
const MODEL_PATH = FileSystem.cacheDirectory + "movenet_lightning_v3.tflite";

// A real TFLite model is several MB; an HTML/XML error page is a few hundred bytes
const MIN_VALID_BYTES = 1_000_000;

export type ModelState =
  | { status: "idle" }
  | { status: "downloading"; progress: number }
  | { status: "ready"; path: string }
  | { status: "error"; message: string };

export function useJumpModel(): ModelState {
  const [state, setState] = useState<ModelState>({ status: "idle" });

  useEffect(() => {
    let cancelled = false;

    async function loadModel() {
      try {
        // Use valid cached copy if one exists
        const info = await FileSystem.getInfoAsync(MODEL_PATH);
        if (info.exists && info.size != null && info.size >= MIN_VALID_BYTES) {
          if (!cancelled) setState({ status: "ready", path: MODEL_PATH });
          return;
        }

        // Wipe any corrupt/partial file before retrying
        if (info.exists) {
          await FileSystem.deleteAsync(MODEL_PATH, { idempotent: true });
        }

        // Try each URL until one produces a valid file
        let lastError = "All download URLs failed.";
        for (const url of MODEL_URLS) {
          if (cancelled) return;
          if (!cancelled) setState({ status: "downloading", progress: 0 });

          try {
            const download = FileSystem.createDownloadResumable(
              url,
              MODEL_PATH,
              {},
              ({ totalBytesWritten, totalBytesExpectedToWrite }) => {
                if (!cancelled && totalBytesExpectedToWrite > 0) {
                  setState({
                    status: "downloading",
                    progress: totalBytesWritten / totalBytesExpectedToWrite,
                  });
                }
              },
            );

            const result = await download.downloadAsync();
            if (cancelled) return;

            if (!result?.uri) {
              lastError = `No URI returned from ${url}`;
              await FileSystem.deleteAsync(MODEL_PATH, { idempotent: true });
              continue;
            }

            const downloaded = await FileSystem.getInfoAsync(result.uri);
            if (
              downloaded.exists &&
              downloaded.size != null &&
              downloaded.size >= MIN_VALID_BYTES
            ) {
              // Valid file — done
              if (!cancelled) setState({ status: "ready", path: result.uri });
              return;
            }

            // Too small — this URL returned an error page, try the next
            lastError = `${url} returned only ${downloaded.size ?? 0} bytes`;
            await FileSystem.deleteAsync(MODEL_PATH, { idempotent: true });
          } catch (e: any) {
            lastError = e?.message ?? String(e);
            await FileSystem.deleteAsync(MODEL_PATH, { idempotent: true });
          }
        }

        if (!cancelled) setState({ status: "error", message: lastError });
      } catch (e: any) {
        if (!cancelled) {
          setState({ status: "error", message: e?.message ?? "Unknown error" });
        }
      }
    }

    loadModel();
    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}
