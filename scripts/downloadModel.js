/**
 * Downloads the MoveNet Lightning TFLite model into assets/models/.
 * Run once before starting the dev server: node scripts/downloadModel.js
 */
const https = require("https");
const http = require("http");
const fs = require("fs");
const path = require("path");

const URLS = [
  // TFHub post-migration direct-download format
  "https://tfhub.dev/google/lite-model/movenet/singlepose/lightning/tflite/float16/4?lite-format=tflite",
  // int8 quantized variant (~3 MB, works on all hardware)
  "https://tfhub.dev/google/lite-model/movenet/singlepose/lightning/tflite/int8/4?lite-format=tflite",
  // Community-hosted GitHub raw copy
  "https://raw.githubusercontent.com/NSTiwari/Video-Game-Control-using-Pose-Classification-and-TensorFlow-Lite/main/movenet_lightning.tflite",
];

const OUT = path.join(__dirname, "..", "assets", "models", "movenet_lightning.tflite");
fs.mkdirSync(path.dirname(OUT), { recursive: true });

function download(url, dest, hops = 0) {
  return new Promise((resolve, reject) => {
    if (hops > 10) return reject(new Error("Too many redirects"));
    const parsed = new URL(url);
    const client = parsed.protocol === "https:" ? https : http;
    const req = client.get(url, { headers: { "User-Agent": "curl/7.79.1" } }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return resolve(download(new URL(res.headers.location, url).href, dest, hops + 1));
      }
      if (res.statusCode !== 200) {
        res.resume();
        return reject(new Error(`HTTP ${res.statusCode}`));
      }
      const file = fs.createWriteStream(dest);
      let received = 0;
      const total = parseInt(res.headers["content-length"] || "0", 10);
      res.on("data", (chunk) => {
        received += chunk.length;
        if (total > 0) {
          process.stdout.write(`\r  ${((received / total) * 100).toFixed(1)}%`);
        }
      });
      res.pipe(file);
      file.on("finish", () =>
        file.close(() => {
          process.stdout.write("\n");
          const { size } = fs.statSync(dest);
          if (size < 1_000_000) {
            fs.unlinkSync(dest);
            reject(new Error(`File too small (${size} bytes) — likely an error page`));
          } else {
            resolve(size);
          }
        })
      );
      file.on("error", (e) => { fs.unlinkSync(dest); reject(e); });
    });
    req.on("error", reject);
  });
}

(async () => {
  if (fs.existsSync(OUT)) {
    const { size } = fs.statSync(OUT);
    if (size >= 1_000_000) {
      console.log(`Model already present (${(size / 1e6).toFixed(1)} MB) — nothing to do.`);
      return;
    }
    fs.unlinkSync(OUT);
  }

  for (const url of URLS) {
    console.log(`Trying: ${url.slice(0, 80)}…`);
    try {
      const size = await download(url, OUT);
      console.log(`✓ Saved ${(size / 1e6).toFixed(1)} MB → ${path.relative(process.cwd(), OUT)}`);
      return;
    } catch (e) {
      console.log(`  ✗ ${e.message}`);
      if (fs.existsSync(OUT)) fs.unlinkSync(OUT);
    }
  }

  console.error("\nAll URLs failed. Download the model manually:");
  console.error("  https://tfhub.dev/google/lite-model/movenet/singlepose/lightning/tflite/float16/4");
  console.error(`Place the .tflite file at: ${OUT}`);
  process.exit(1);
})();
