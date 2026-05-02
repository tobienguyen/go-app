import React, { useState, useRef, useCallback, useEffect } from "react";
import {
  View, Text, StyleSheet, SafeAreaView, TouchableOpacity,
  Alert, ActivityIndicator, Dimensions, Modal, ScrollView, Platform,
} from "react-native";
import {
  Camera, useCameraDevice, useCameraPermission,
  useFrameProcessor, VideoFile,
} from "react-native-vision-camera";
import { useTensorflowModel } from "react-native-fast-tflite";
import { useResizePlugin } from "vision-camera-resize-plugin";
import { useRunOnJS, useSharedValue as useWorkletSharedValue } from "react-native-worklets-core";
import { Ionicons } from "@expo/vector-icons";
import Svg, { Circle, Line } from "react-native-svg";
import * as MediaLibrary from "expo-media-library";
import { auth, storage } from "../../config/firebaseConfig";
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { createPost } from "../../services/posts";

// Bundled via Metro — run `node scripts/downloadModel.js` once to add the file,
// then metro.config.js serves it as an asset (no runtime download needed).
// eslint-disable-next-line @typescript-eslint/no-var-requires
const MOVENET_MODEL = require("../../assets/models/movenet_lightning.tflite");

const { width: SW, height: SH } = Dimensions.get("window");

// ── MoveNet keypoint indices ──────────────────────────────────────────────────
const KP_NOSE = 0;
const KP_L_SHOULDER = 5; const KP_R_SHOULDER = 6;
const KP_L_ELBOW = 7;    const KP_R_ELBOW = 8;
const KP_L_WRIST = 9;    const KP_R_WRIST = 10;
const KP_L_HIP = 11;     const KP_R_HIP = 12;
const KP_L_KNEE = 13;    const KP_R_KNEE = 14;
const KP_L_ANKLE = 15;   const KP_R_ANKLE = 16;

const SKELETON_EDGES: [number, number][] = [
  [KP_NOSE, KP_L_SHOULDER], [KP_NOSE, KP_R_SHOULDER],
  [KP_L_SHOULDER, KP_R_SHOULDER],
  [KP_L_SHOULDER, KP_L_ELBOW], [KP_L_ELBOW, KP_L_WRIST],
  [KP_R_SHOULDER, KP_R_ELBOW], [KP_R_ELBOW, KP_R_WRIST],
  [KP_L_SHOULDER, KP_L_HIP],   [KP_R_SHOULDER, KP_R_HIP],
  [KP_L_HIP, KP_R_HIP],
  [KP_L_HIP, KP_L_KNEE],       [KP_L_KNEE, KP_L_ANKLE],
  [KP_R_HIP, KP_R_KNEE],       [KP_R_KNEE, KP_R_ANKLE],
];

interface Keypoint { y: number; x: number; score: number; }

type Mode = "jump" | "record";
type Phase = "idle" | "calibrating" | "countdown" | "tracking" | "results";

interface JumpResult {
  peakReachIn: number;
  standingReachIn: number;
  jumpHeightIn: number;
  videoPath: string | null;
}

const CONFIDENCE_THRESHOLD = 0.05;
const MODEL_SIZE = 192;

const NET_HEIGHT_MENS = 94;
const NET_HEIGHT_WOMENS = 90;
const TOP_OF_NET_TOUCH_PRO = 121;

function inToFtIn(totalIn: number): string {
  const ft = Math.floor(totalIn / 12);
  const inches = Math.round(totalIn % 12);
  return `${ft}'${inches}"`;
}

// ── Skeleton overlay ──────────────────────────────────────────────────────────
function SkeletonOverlay({
  keypoints, peakY, width, height,
}: {
  keypoints: Keypoint[];
  peakY: number | null;
  width: number;
  height: number;
}) {
  if (!keypoints.length) return null;
  const toX = (x: number) => x * width;
  const toY = (y: number) => y * height;

  return (
    <Svg width={width} height={height} style={StyleSheet.absoluteFill} pointerEvents="none">
      {SKELETON_EDGES.map(([a, b], i) => {
        const kpA = keypoints[a]; const kpB = keypoints[b];
        if (!kpA || !kpB || kpA.score < CONFIDENCE_THRESHOLD || kpB.score < CONFIDENCE_THRESHOLD) return null;
        return (
          <Line
            key={i}
            x1={toX(kpA.x)} y1={toY(kpA.y)}
            x2={toX(kpB.x)} y2={toY(kpB.y)}
            stroke="rgba(255,255,255,0.7)" strokeWidth={2}
          />
        );
      })}
      {keypoints.map((kp, i) => {
        if (kp.score < CONFIDENCE_THRESHOLD) return null;
        const isWrist = i === KP_L_WRIST || i === KP_R_WRIST;
        return (
          <Circle
            key={i}
            cx={toX(kp.x)} cy={toY(kp.y)}
            r={isWrist ? 8 : 5}
            fill={isWrist ? "#FFD700" : "#FFF"}
            stroke={isWrist ? "#FFA500" : "rgba(0,0,0,0.3)"}
            strokeWidth={isWrist ? 2 : 1}
          />
        );
      })}
      {peakY !== null && (
        <Line
          x1={0} y1={toY(peakY)}
          x2={width} y2={toY(peakY)}
          stroke="#FFD700" strokeWidth={2}
          strokeDasharray="8,4"
        />
      )}
    </Svg>
  );
}

// ── Outer screen: permission gate only (model is bundled, no download needed) ──
export default function AnalyzeScreen() {
  const { hasPermission, requestPermission } = useCameraPermission();
  const [hasMedia, setHasMedia] = useState(false);

  useEffect(() => {
    MediaLibrary.requestPermissionsAsync().then(({ status }) =>
      setHasMedia(status === "granted"),
    );
  }, []);

  if (!hasPermission) {
    return (
      <SafeAreaView style={styles.center}>
        <Ionicons name="camera-outline" size={48} color="#9CA3AF" />
        <Text style={styles.permTitle}>Camera Access Needed</Text>
        <Text style={styles.permSub}>Go! needs camera access to track your jump.</Text>
        <TouchableOpacity style={styles.permBtn} onPress={requestPermission}>
          <Text style={styles.permBtnText}>Allow Camera</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return <AnalyzeCameraView hasMedia={hasMedia} />;
}

// ── Inner screen: loads bundled TFLite asset + runs camera ────────────────────
function AnalyzeCameraView({ hasMedia }: { hasMedia: boolean }) {
  const uid = auth.currentUser?.uid ?? "";
  const userName = auth.currentUser?.displayName ?? "Player";

  const [facing, setFacing] = useState<"front" | "back">("back");
  const device = useCameraDevice(facing);
  const cameraRef = useRef<Camera>(null);

  const tfModel = useTensorflowModel(MOVENET_MODEL, []);
  const modelReady = tfModel.state === "loaded";

  // NitroModules HybridObjects can't cross the worklets-core runtime boundary —
  // neither as closure deps (serializer throws) nor via SharedValue (setter throws).
  // Keep the model on the JS thread and access it via a ref.
  const modelRef = useRef<any>(null);
  useEffect(() => {
    modelRef.current = tfModel.state === "loaded" ? tfModel.model : null;
  }, [tfModel.state]);

  // Shared values for the VisionCamera Worker Runtime (react-native-worklets-core).
  // Reanimated shared values are NOT accessible from VisionCamera's Worker Runtime.
  const isBusy = useWorkletSharedValue(false);
  const facingShared = useWorkletSharedValue<"front" | "back">("back");
  useEffect(() => {
    facingShared.value = facing;
  }, [facing]);

  const { resize } = useResizePlugin();

  const [mode, setMode] = useState<Mode>("jump");
  const [phase, setPhase] = useState<Phase>("idle");
  const [countdown, setCountdown] = useState(3);
  const [keypoints, setKeypoints] = useState<Keypoint[]>([]);
  const [peakWristY, setPeakWristY] = useState<number | null>(null);
  const [calibratedAnkleY, setCalibratedAnkleY] = useState<number | null>(null);
  const [calibratedWristY, setCalibratedWristY] = useState<number | null>(null);
  const [userHeightIn, setUserHeightIn] = useState<number>(72);
  const [result, setResult] = useState<JumpResult | null>(null);
  const [showHeightModal, setShowHeightModal] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [sharing, setSharing] = useState(false);
  const [calibCountdown, setCalibCountdown] = useState<number | null>(null);
  const [debugInfo, setDebugInfo] = useState({ frameW: 0, frameH: 0, maxConf: 0, count: 0, workletFiring: false, lastError: "" });
  const [debugRotation, setDebugRotation] = useState<"0deg" | "90deg" | "180deg" | "270deg">("90deg");
  const debugRotationShared = useWorkletSharedValue<"0deg" | "90deg" | "180deg" | "270deg">("90deg");
  useEffect(() => { debugRotationShared.value = debugRotation; }, [debugRotation]);

  const isTracking = useRef(false);
  const peakRef = useRef<number>(1);
  const calibAnkle = useRef<number>(0.9);
  const calibWrist = useRef<number>(0.3);
  const pixelsPerInch = useRef<number>(1);

  // ── Frame processor ─────────────────────────────────────────────────────────
  const updateKeypoints = useCallback((kps: Keypoint[]) => {
    setKeypoints(kps);
    if (!isTracking.current || kps.length < 17) return;
    const lw = kps[KP_L_WRIST]; const rw = kps[KP_R_WRIST];
    if (!lw || !rw) return;
    const highestWrist = Math.min(
      lw.score > CONFIDENCE_THRESHOLD ? lw.y : 1,
      rw.score > CONFIDENCE_THRESHOLD ? rw.y : 1,
    );
    if (highestWrist < peakRef.current) {
      peakRef.current = highestWrist;
      setPeakWristY(highestWrist);
    }
  }, []);

  // Runs on the JS thread after inference finishes in the Worker Runtime.
  // Only 51 plain numbers (17 kps × 3 floats) cross the createRunOnJS bridge —
  // primitives are always supported, no ArrayBuffer transfer needed.
  const updateKeypointsWC = useRunOnJS((kpFlat: number[], frameW: number, frameH: number) => {
    const kps: Keypoint[] = [];
    for (let i = 0; i < 17; i++) {
      kps.push({ y: kpFlat[i * 3], x: kpFlat[i * 3 + 1], score: kpFlat[i * 3 + 2] });
    }
    const maxConf = kps.reduce((m, k) => Math.max(m, k.score), 0);
    setDebugInfo(prev => ({ ...prev, frameW, frameH, maxConf, count: prev.count + 1, workletFiring: true }));
    updateKeypoints(kps);
    isBusy.value = false;
  }, [updateKeypoints, isBusy]);

  const noteWorkletFiringWC = useRunOnJS(() => {
    setDebugInfo(prev => prev.workletFiring ? prev : { ...prev, workletFiring: true });
  }, []);

  const logErrorWC = useRunOnJS((msg: string) => {
    console.error("[Analyze worklet]", msg);
    setDebugInfo(prev => ({ ...prev, lastError: msg.slice(0, 80) }));
  }, []);

  // modelShared (SharedValue) is safe in deps — its .value holds the HostObject
  // reference, which worklets-core transfers cross-runtime without enumerating it.
  const frameProcessor = useFrameProcessor((frame) => {
    "worklet";
    noteWorkletFiringWC();
    if (isBusy.value) return;
    const m = modelShared.value;
    if (!m) {
      logErrorWC("model is null in worklet");
      return;
    }
    isBusy.value = true;
    const isFront = facingShared.value === "front";
    try {
      const resized = resize(frame, {
        scale: { width: MODEL_SIZE, height: MODEL_SIZE },
        pixelFormat: "rgb",
        dataType: "float32",
        rotation: debugRotationShared.value,
        mirror: isFront,
      });
      const outputs = m.runSync([resized]);
      const raw = new Float32Array(outputs[0]);
      const kpFlat: number[] = [];
      for (let i = 0; i < 17 * 3; i++) kpFlat.push(raw[i]);
      updateKeypointsWC(kpFlat, frame.width, frame.height);
    } catch (e: any) {
      logErrorWC(String(e?.message ?? e));
      isBusy.value = false;
    }
  }, [modelShared, isBusy, facingShared, debugRotationShared, resize, updateKeypointsWC, noteWorkletFiringWC, logErrorWC]);

  // ── Calibration ─────────────────────────────────────────────────────────────
  const captureCalibration = useCallback(() => {
    if (!keypoints.length) {
      Alert.alert("No pose detected", "Stand fully in frame and try again.");
      return;
    }
    const lAnkle = keypoints[KP_L_ANKLE]; const rAnkle = keypoints[KP_R_ANKLE];
    const lWrist = keypoints[KP_L_WRIST]; const rWrist = keypoints[KP_R_WRIST];
    const ankleY = ((lAnkle?.y ?? 0.9) + (rAnkle?.y ?? 0.9)) / 2;
    const wristY = Math.min(
      lWrist?.score > CONFIDENCE_THRESHOLD ? lWrist.y : 1,
      rWrist?.score > CONFIDENCE_THRESHOLD ? rWrist.y : 1,
    );
    calibAnkle.current = ankleY;
    calibWrist.current = wristY;
    setCalibratedAnkleY(ankleY);
    setCalibratedWristY(wristY);
    const standingReachIn = userHeightIn * 1.33;
    const bodyInNorm = ankleY - wristY;
    pixelsPerInch.current = bodyInNorm > 0 ? bodyInNorm / standingReachIn : 1;
    startCountdown();
  }, [keypoints, userHeightIn]);

  // Ref keeps captureCalibration fresh inside the timer effect without re-running it.
  const captureCalibrationRef = useRef(captureCalibration);
  useEffect(() => { captureCalibrationRef.current = captureCalibration; }, [captureCalibration]);

  useEffect(() => {
    if (calibCountdown === null) return;
    if (calibCountdown === 0) {
      setCalibCountdown(null);
      captureCalibrationRef.current();
      return;
    }
    const t = setTimeout(() => setCalibCountdown(c => (c !== null ? c - 1 : null)), 1000);
    return () => clearTimeout(t);
  }, [calibCountdown]);

  // ── Countdown → tracking ────────────────────────────────────────────────────
  const startCountdown = useCallback(() => {
    setPhase("countdown");
    setCountdown(3);
    peakRef.current = 1;
    setPeakWristY(null);
    let c = 3;
    const tick = setInterval(() => {
      c--;
      setCountdown(c);
      if (c === 0) { clearInterval(tick); startTracking(); }
    }, 1000);
  }, []);

  const startTracking = useCallback(async () => {
    isTracking.current = true;
    setPhase("tracking");
    if (mode === "jump") {
      try {
        cameraRef.current?.startRecording({
          onRecordingFinished: (video) => finishJumpTest(video),
          onRecordingError: (e) => console.error("Recording error", e),
        });
        setTimeout(() => {
          cameraRef.current?.stopRecording();
          isTracking.current = false;
        }, 5000);
      } catch (e) {
        console.error(e);
        finishJumpTest(null);
      }
    } else {
      cameraRef.current?.startRecording({
        onRecordingFinished: (video) => finishFreeRecord(video),
        onRecordingError: (e) => console.error(e),
      });
    }
  }, [mode]);

  const stopFreeRecord = useCallback(() => {
    isTracking.current = false;
    cameraRef.current?.stopRecording();
  }, []);

  const finishJumpTest = useCallback((video: VideoFile | null) => {
    const ankleNorm = calibAnkle.current;
    const standingWristNorm = calibWrist.current;
    const peakNorm = peakRef.current;
    const standingReachIn = userHeightIn * 1.33;
    const peakDistFromAnkle = (ankleNorm - peakNorm) / (ankleNorm - standingWristNorm);
    const peakReachIn = peakDistFromAnkle * standingReachIn;
    const jumpHeightIn = Math.max(0, peakReachIn - standingReachIn);
    setResult({
      peakReachIn: Math.round(peakReachIn),
      standingReachIn: Math.round(standingReachIn),
      jumpHeightIn: Math.round(jumpHeightIn),
      videoPath: video?.path ?? null,
    });
    setPhase("results");
  }, [userHeightIn]);

  const finishFreeRecord = useCallback((video: VideoFile) => {
    setResult({ peakReachIn: 0, standingReachIn: 0, jumpHeightIn: 0, videoPath: video.path });
    setPhase("results");
  }, []);

  // ── Save / post ──────────────────────────────────────────────────────────────
  const saveToLibrary = useCallback(async () => {
    if (!result?.videoPath) return;
    if (!hasMedia) { Alert.alert("Permission needed", "Allow photo library access to save."); return; }
    try {
      await MediaLibrary.saveToLibraryAsync(result.videoPath);
      Alert.alert("Saved!", "Clip saved to your photo library.");
    } catch {
      Alert.alert("Error", "Could not save clip.");
    }
  }, [result, hasMedia]);

  const postToFeed = useCallback(async () => {
    if (!result) return;
    setSharing(true);
    try {
      let videoUrl: string | undefined;
      if (result.videoPath) {
        const uri = Platform.OS === "ios" ? result.videoPath : `file://${result.videoPath}`;
        const response = await fetch(uri);
        const blob = await response.blob();
        const storageRef = ref(storage, `posts/${uid}/videos/${Date.now()}.mp4`);
        await new Promise<void>((resolve, reject) => {
          const task = uploadBytesResumable(storageRef, blob, { contentType: "video/mp4" });
          task.on("state_changed",
            (snap) => setUploadProgress(snap.bytesTransferred / snap.totalBytes),
            reject,
            async () => { videoUrl = await getDownloadURL(storageRef); resolve(); },
          );
        });
      }
      const initials = userName.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
      const content = mode === "jump"
        ? `Jump test: ${inToFtIn(result.peakReachIn)} peak reach · ${inToFtIn(result.jumpHeightIn)} above standing reach 🏐`
        : "Check out this clip 🏐";
      await createPost({
        type: "text",
        authorId: uid,
        authorName: userName,
        authorInitials: initials,
        authorPosition: "Player",
        content,
        likes: 0,
        likedBy: [],
        comments: 0,
        ...(videoUrl ? { imageUrl: videoUrl } : {}),
      });
      Alert.alert("Posted!", "Your clip has been shared to the feed.");
      setPhase("idle");
      setResult(null);
    } catch (e) {
      console.error(e);
      Alert.alert("Error", "Could not post. Try again.");
    } finally {
      setSharing(false);
      setUploadProgress(0);
    }
  }, [result, uid, userName, mode]);

  const reset = useCallback(() => {
    setPhase("idle");
    setResult(null);
    setPeakWristY(null);
    setKeypoints([]);
    setCalibCountdown(null);
    peakRef.current = 1;
  }, []);

  // ── Camera unavailable ───────────────────────────────────────────────────────
  if (!device) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator size="large" color="#000" />
        <Text style={{ color: "#9CA3AF", marginTop: 12 }}>Loading camera…</Text>
      </SafeAreaView>
    );
  }

  // ── Results screen ───────────────────────────────────────────────────────────
  if (phase === "results" && result) {
    const isJump = mode === "jump" && result.jumpHeightIn > 0;
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={reset} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={22} color="#000" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Results</Text>
          <View style={{ width: 40 }} />
        </View>
        <ScrollView contentContainerStyle={styles.resultsScroll}>
          {isJump && (
            <>
              <View style={styles.resultHero}>
                <Text style={styles.resultHeroLabel}>PEAK REACH</Text>
                <Text style={styles.resultHeroValue}>{inToFtIn(result.peakReachIn)}</Text>
              </View>
              <View style={styles.statRow}>
                <View style={styles.statCard}>
                  <Text style={styles.statValue}>{inToFtIn(result.standingReachIn)}</Text>
                  <Text style={styles.statLabel}>Standing Reach</Text>
                </View>
                <View style={styles.statCard}>
                  <Text style={styles.statValue}>{inToFtIn(result.jumpHeightIn)}</Text>
                  <Text style={styles.statLabel}>Jump Height</Text>
                </View>
              </View>
              <View style={styles.compCard}>
                <Text style={styles.compTitle}>How you compare</Text>
                {[
                  { label: "Men's Net", val: NET_HEIGHT_MENS, color: "#3B82F6" },
                  { label: "Women's Net", val: NET_HEIGHT_WOMENS, color: "#EC4899" },
                  { label: "Pro Attack Height", val: TOP_OF_NET_TOUCH_PRO, color: "#F59E0B" },
                ].map(({ label, val, color }) => {
                  const pct = Math.min((result.peakReachIn / val) * 100, 100);
                  return (
                    <View key={label} style={styles.compRow}>
                      <Text style={styles.compLabel}>{label} ({inToFtIn(val)})</Text>
                      <View style={styles.compTrack}>
                        <View style={[styles.compFill, { width: `${pct}%`, backgroundColor: color }]} />
                        <View style={[styles.compYourMark, {
                          left: `${Math.min(pct, 98)}%`,
                          backgroundColor: result.peakReachIn >= val ? "#10B981" : "#EF4444",
                        }]} />
                      </View>
                      <Text style={[styles.compPct, { color: result.peakReachIn >= val ? "#10B981" : "#EF4444" }]}>
                        {result.peakReachIn >= val ? "✓ Above" : `${inToFtIn(val - result.peakReachIn)} below`}
                      </Text>
                    </View>
                  );
                })}
              </View>
            </>
          )}
          {!isJump && (
            <View style={styles.resultHero}>
              <Ionicons name="videocam" size={48} color="#FFF" />
              <Text style={[styles.resultHeroLabel, { marginTop: 12 }]}>CLIP RECORDED</Text>
            </View>
          )}
          <View style={styles.actionBtns}>
            {result.videoPath && (
              <TouchableOpacity style={styles.saveBtn} onPress={saveToLibrary}>
                <Ionicons name="download-outline" size={20} color="#000" />
                <Text style={styles.saveBtnText}>Save to Library</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={[styles.postBtn, sharing && { opacity: 0.6 }]}
              onPress={postToFeed}
              disabled={sharing}
            >
              {sharing ? (
                <ActivityIndicator size="small" color="#FFF" />
              ) : (
                <>
                  <Ionicons name="share-outline" size={20} color="#FFF" />
                  <Text style={styles.postBtnText}>Post to Feed</Text>
                </>
              )}
            </TouchableOpacity>
            {sharing && uploadProgress > 0 && (
              <View style={styles.progressTrack}>
                <View style={[styles.progressFill, { width: `${uploadProgress * 100}%` }]} />
              </View>
            )}
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ── Camera view ──────────────────────────────────────────────────────────────
  return (
    <View style={{ flex: 1, backgroundColor: "#000" }}>
      <Camera
        ref={cameraRef}
        style={StyleSheet.absoluteFill}
        device={device}
        isActive={phase !== "results"}
        frameProcessor={frameProcessor}
        video
        audio
      />

      <SkeletonOverlay keypoints={keypoints} peakY={peakWristY} width={SW} height={SH} />

      {/* Model loading spinner — shown until TFLite finishes initializing from local file */}
      {!modelReady && (
        <View style={styles.modelLoading}>
          <ActivityIndicator color="#FFF" size="small" />
          <Text style={styles.modelLoadingText}>
            {tfModel.state === "error" ? "Model error — try relaunching" : "Initializing AI model…"}
          </Text>
        </View>
      )}

      {/* DEBUG — remove once pose detection is confirmed working */}
      <View style={styles.debugOverlay}>
        <Text style={styles.debugText}>
          worklet: {debugInfo.workletFiring ? "FIRING ✓" : "NOT FIRING ✗"} | model: {modelReady ? "ready" : "loading"}
        </Text>
        <Text style={styles.debugText}>
          {debugInfo.count === 0
            ? "inference: waiting…"
            : `${debugInfo.frameW}×${debugInfo.frameH} | conf: ${debugInfo.maxConf.toFixed(3)} | #${debugInfo.count}`}
        </Text>
        {debugInfo.lastError !== "" && (
          <Text style={[styles.debugText, { color: "#F87171" }]}>{debugInfo.lastError}</Text>
        )}
        <TouchableOpacity
          onPress={() => {
            const rots = ["0deg", "90deg", "180deg", "270deg"] as const;
            setDebugRotation(r => rots[(rots.indexOf(r) + 1) % 4]);
          }}
          style={styles.debugRotBtn}
        >
          <Text style={styles.debugText}>rot: {debugRotation} (tap to cycle)</Text>
        </TouchableOpacity>
      </View>

      {/* Top bar */}
      <SafeAreaView style={styles.topBar}>
        <View style={styles.topBarInner}>
          <Text style={styles.logoText}>Go<Text style={{ fontStyle: "italic" }}>!</Text></Text>
          <View style={styles.modeToggle}>
            {(["jump", "record"] as Mode[]).map(m => (
              <TouchableOpacity
                key={m}
                style={[styles.modeBtn, mode === m && styles.modeBtnActive]}
                onPress={() => { if (phase === "idle") setMode(m); }}
              >
                <Text style={[styles.modeBtnText, mode === m && styles.modeBtnTextActive]}>
                  {m === "jump" ? "Jump Test" : "Record"}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <TouchableOpacity
            style={styles.flipBtn}
            onPress={() => setFacing(f => f === "back" ? "front" : "back")}
          >
            <Ionicons name="camera-reverse-outline" size={28} color="#FFF" />
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      {phase === "countdown" && (
        <View style={styles.countdownOverlay}>
          <Text style={styles.countdownNumber}>{countdown || "GO!"}</Text>
        </View>
      )}

      {phase === "tracking" && (
        <View style={styles.trackingHUD}>
          <View style={styles.hudRow}>
            <View style={styles.hudDot} />
            <Text style={styles.hudText}>TRACKING</Text>
          </View>
          {mode === "jump" && peakWristY !== null && calibratedAnkleY !== null && calibratedWristY !== null && (() => {
            const peakDistFromAnkle = (calibratedAnkleY - peakWristY) / (calibratedAnkleY - calibratedWristY);
            const peakReachIn = peakDistFromAnkle * (userHeightIn * 1.33);
            return <Text style={styles.hudPeak}>Peak: {inToFtIn(Math.round(peakReachIn))}</Text>;
          })()}
          {mode === "record" && (
            <TouchableOpacity style={styles.stopBtn} onPress={stopFreeRecord}>
              <View style={styles.stopIcon} />
            </TouchableOpacity>
          )}
        </View>
      )}

      {phase === "idle" && (
        <SafeAreaView style={styles.bottomBar}>
          {mode === "jump" ? (
            <View style={styles.bottomInner}>
              <TouchableOpacity style={styles.heightPill} onPress={() => setShowHeightModal(true)}>
                <Ionicons name="person-outline" size={14} color="#FFF" />
                <Text style={styles.heightPillText}>{inToFtIn(userHeightIn)}</Text>
                <Ionicons name="chevron-down" size={12} color="#FFF" />
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.recordBtn, !modelReady && { opacity: 0.4 }]}
                onPress={() => modelReady
                  ? setPhase("calibrating")
                  : Alert.alert("AI loading", "Wait for the model to finish initializing.")}
              >
                <Ionicons name="body-outline" size={26} color="#FFF" />
              </TouchableOpacity>
              <Text style={styles.hintText}>Stand in frame, then tap to calibrate</Text>
            </View>
          ) : (
            <View style={styles.bottomInner}>
              <TouchableOpacity style={styles.recordBtn} onPress={startCountdown}>
                <View style={styles.recordDot} />
              </TouchableOpacity>
              <Text style={styles.hintText}>Tap to start recording</Text>
            </View>
          )}
        </SafeAreaView>
      )}

      {phase === "calibrating" && (
        <SafeAreaView style={styles.bottomBar}>
          <View style={styles.bottomInner}>
            <Text style={styles.calibrateText}>Stand straight, arms relaxed at your sides</Text>
            {calibCountdown !== null ? (
              <View style={styles.calibCountdownCircle}>
                <Text style={styles.calibCountdownNum}>{calibCountdown}</Text>
              </View>
            ) : (
              <View style={{ gap: 12, alignItems: "center" }}>
                <TouchableOpacity style={styles.calibrateBtn} onPress={captureCalibration}>
                  <Text style={styles.calibrateBtnText}>I'm Ready — Calibrate</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.timerBtn} onPress={() => setCalibCountdown(5)}>
                  <Ionicons name="timer-outline" size={18} color="#FFF" />
                  <Text style={styles.timerBtnText}>5s Self-Timer</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </SafeAreaView>
      )}

      <HeightModal
        visible={showHeightModal}
        currentIn={userHeightIn}
        onSave={(h) => { setUserHeightIn(h); setShowHeightModal(false); }}
        onClose={() => setShowHeightModal(false)}
      />
    </View>
  );
}

// ── Height picker modal ───────────────────────────────────────────────────────
function HeightModal({
  visible, currentIn, onSave, onClose,
}: {
  visible: boolean; currentIn: number;
  onSave: (inches: number) => void; onClose: () => void;
}) {
  const [ft, setFt] = useState(Math.floor(currentIn / 12).toString());
  const [inches, setInches] = useState((currentIn % 12).toString());

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.modalOverlay}>
        <View style={styles.modalCard}>
          <Text style={styles.modalTitle}>Your Height</Text>
          <Text style={styles.modalSub}>Used to calibrate your standing reach</Text>
          <View style={styles.heightInputRow}>
            <View style={styles.heightField}>
              <Text style={styles.heightFieldLabel}>Feet</Text>
              <View style={styles.heightFieldInput}>
                <Text style={styles.heightValue}>{ft}</Text>
                <View style={styles.heightStepper}>
                  <TouchableOpacity onPress={() => setFt(f => String(Math.min(8, parseInt(f || "0") + 1)))}>
                    <Ionicons name="chevron-up" size={18} color="#000" />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => setFt(f => String(Math.max(4, parseInt(f || "0") - 1)))}>
                    <Ionicons name="chevron-down" size={18} color="#000" />
                  </TouchableOpacity>
                </View>
              </View>
            </View>
            <View style={styles.heightField}>
              <Text style={styles.heightFieldLabel}>Inches</Text>
              <View style={styles.heightFieldInput}>
                <Text style={styles.heightValue}>{inches}</Text>
                <View style={styles.heightStepper}>
                  <TouchableOpacity onPress={() => setInches(i => String(Math.min(11, parseInt(i || "0") + 1)))}>
                    <Ionicons name="chevron-up" size={18} color="#000" />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => setInches(i => String(Math.max(0, parseInt(i || "0") - 1)))}>
                    <Ionicons name="chevron-down" size={18} color="#000" />
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </View>
          <TouchableOpacity
            style={styles.modalSaveBtn}
            onPress={() => onSave(parseInt(ft) * 12 + parseInt(inches))}
          >
            <Text style={styles.modalSaveBtnText}>Save</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={onClose}>
            <Text style={styles.modalCancelText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F3F4F6" },
  center: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#FFF", padding: 32, gap: 12 },
  permTitle: { fontSize: 20, fontWeight: "800", color: "#000", textAlign: "center" },
  permSub: { fontSize: 14, color: "#6B7280", textAlign: "center" },
  permBtn: { backgroundColor: "#000", paddingHorizontal: 28, paddingVertical: 14, borderRadius: 14, marginTop: 8 },
  permBtnText: { color: "#FFF", fontWeight: "700", fontSize: 15 },
  downloadTrack: { width: 200, height: 4, backgroundColor: "#E5E7EB", borderRadius: 2, overflow: "hidden" },
  downloadFill: { height: "100%", backgroundColor: "#000", borderRadius: 2 },

  topBar: { position: "absolute", top: 0, left: 0, right: 0 },
  topBarInner: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 8 },
  logoText: { fontSize: 24, fontWeight: "900", color: "#FFF", letterSpacing: -1 },
  modeToggle: { flexDirection: "row", backgroundColor: "rgba(0,0,0,0.45)", borderRadius: 20, padding: 3 },
  modeBtn: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 18 },
  modeBtnActive: { backgroundColor: "#FFF" },
  modeBtnText: { fontSize: 13, fontWeight: "600", color: "rgba(255,255,255,0.7)" },
  modeBtnTextActive: { color: "#000" },

  modelLoading: { position: "absolute", top: 100, alignSelf: "center", flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "rgba(0,0,0,0.6)", paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20 },
  modelLoadingText: { color: "#FFF", fontSize: 13, fontWeight: "600" },

  countdownOverlay: { ...StyleSheet.absoluteFillObject, justifyContent: "center", alignItems: "center", backgroundColor: "rgba(0,0,0,0.3)" },
  countdownNumber: { fontSize: 120, fontWeight: "900", color: "#FFF" },

  trackingHUD: { position: "absolute", top: 110, left: 0, right: 0, alignItems: "center", gap: 8 },
  hudRow: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "rgba(239,68,68,0.9)", paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20 },
  hudDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#FFF" },
  hudText: { color: "#FFF", fontWeight: "800", fontSize: 12, letterSpacing: 1.5 },
  hudPeak: { color: "#FFD700", fontWeight: "800", fontSize: 18 },
  stopBtn: { marginTop: 12, width: 56, height: 56, borderRadius: 28, backgroundColor: "rgba(0,0,0,0.6)", borderWidth: 3, borderColor: "#FFF", justifyContent: "center", alignItems: "center" },
  stopIcon: { width: 18, height: 18, backgroundColor: "#EF4444", borderRadius: 3 },

  bottomBar: { position: "absolute", bottom: 0, left: 0, right: 0 },
  bottomInner: { alignItems: "center", paddingBottom: 32, gap: 16, paddingHorizontal: 24 },
  recordBtn: { width: 72, height: 72, borderRadius: 36, backgroundColor: "rgba(0,0,0,0.7)", borderWidth: 4, borderColor: "#FFF", justifyContent: "center", alignItems: "center" },
  recordDot: { width: 28, height: 28, borderRadius: 14, backgroundColor: "#EF4444" },
  hintText: { color: "rgba(255,255,255,0.8)", fontSize: 13, fontWeight: "500" },
  heightPill: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "rgba(0,0,0,0.5)", paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: "rgba(255,255,255,0.3)" },
  heightPillText: { color: "#FFF", fontWeight: "700", fontSize: 14 },
  calibrateText: { color: "#FFF", fontSize: 15, fontWeight: "600", textAlign: "center", lineHeight: 22 },
  calibrateBtn: { backgroundColor: "#FFF", paddingHorizontal: 32, paddingVertical: 16, borderRadius: 16 },
  calibrateBtnText: { color: "#000", fontWeight: "800", fontSize: 15 },
  timerBtn: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "rgba(255,255,255,0.2)", paddingHorizontal: 20, paddingVertical: 10, borderRadius: 12, borderWidth: 1, borderColor: "rgba(255,255,255,0.35)" },
  timerBtnText: { color: "#FFF", fontWeight: "700", fontSize: 14 },
  calibCountdownCircle: { width: 80, height: 80, borderRadius: 40, backgroundColor: "rgba(255,255,255,0.9)", justifyContent: "center", alignItems: "center" },
  calibCountdownNum: { fontSize: 42, fontWeight: "900", color: "#000" },
  flipBtn: { width: 44, height: 44, justifyContent: "center", alignItems: "center" },
  debugOverlay: { position: "absolute", top: 110, left: 0, right: 0, alignItems: "center", gap: 6, zIndex: 99 },
  debugRotBtn: { backgroundColor: "rgba(0,0,0,0.6)", paddingHorizontal: 12, paddingVertical: 4, borderRadius: 8 },
  debugText: { color: "#0F0", fontSize: 11, fontFamily: "monospace", backgroundColor: "rgba(0,0,0,0.6)", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },

  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 12, backgroundColor: "#FFF", borderBottomWidth: 1, borderBottomColor: "#E5E7EB" },
  headerTitle: { fontSize: 18, fontWeight: "800", color: "#000" },
  backBtn: { padding: 4 },
  resultsScroll: { padding: 16, gap: 16, paddingBottom: 40 },
  resultHero: { backgroundColor: "#000", borderRadius: 20, padding: 32, alignItems: "center" },
  resultHeroLabel: { fontSize: 11, fontWeight: "800", color: "#9CA3AF", letterSpacing: 2 },
  resultHeroValue: { fontSize: 52, fontWeight: "900", color: "#FFF", marginTop: 4 },
  statRow: { flexDirection: "row", gap: 12 },
  statCard: { flex: 1, backgroundColor: "#FFF", borderRadius: 16, padding: 16, alignItems: "center" },
  statValue: { fontSize: 24, fontWeight: "800", color: "#000" },
  statLabel: { fontSize: 12, color: "#9CA3AF", fontWeight: "600", marginTop: 4, textAlign: "center" },
  compCard: { backgroundColor: "#FFF", borderRadius: 16, padding: 16, gap: 16 },
  compTitle: { fontSize: 15, fontWeight: "700", color: "#000" },
  compRow: { gap: 6 },
  compLabel: { fontSize: 12, color: "#6B7280", fontWeight: "500" },
  compTrack: { height: 10, backgroundColor: "#F3F4F6", borderRadius: 5, overflow: "visible", position: "relative" },
  compFill: { height: "100%", borderRadius: 5 },
  compYourMark: { position: "absolute", top: -3, width: 4, height: 16, borderRadius: 2 },
  compPct: { fontSize: 12, fontWeight: "700" },
  actionBtns: { gap: 12 },
  saveBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: "#FFF", borderRadius: 14, padding: 16, borderWidth: 1, borderColor: "#E5E7EB" },
  saveBtnText: { fontWeight: "700", fontSize: 15, color: "#000" },
  postBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: "#000", borderRadius: 14, padding: 16 },
  postBtnText: { color: "#FFF", fontWeight: "700", fontSize: 15 },
  progressTrack: { height: 4, backgroundColor: "#E5E7EB", borderRadius: 2, overflow: "hidden" },
  progressFill: { height: "100%", backgroundColor: "#000", borderRadius: 2 },

  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  modalCard: { backgroundColor: "#FFF", borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 28, gap: 16 },
  modalTitle: { fontSize: 20, fontWeight: "800", color: "#000" },
  modalSub: { fontSize: 13, color: "#9CA3AF", marginTop: -8 },
  heightInputRow: { flexDirection: "row", gap: 16 },
  heightField: { flex: 1, gap: 8 },
  heightFieldLabel: { fontSize: 12, fontWeight: "700", color: "#9CA3AF", textTransform: "uppercase", letterSpacing: 0.5 },
  heightFieldInput: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: "#F3F4F6", borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12 },
  heightValue: { fontSize: 22, fontWeight: "800", color: "#000" },
  heightStepper: { gap: 0 },
  modalSaveBtn: { backgroundColor: "#000", borderRadius: 14, padding: 16, alignItems: "center" },
  modalSaveBtnText: { color: "#FFF", fontWeight: "700", fontSize: 15 },
  modalCancelText: { textAlign: "center", color: "#9CA3AF", fontWeight: "600", fontSize: 14 },
});
