import React, { useState, useRef } from "react";
import {
  View, Text, StyleSheet, SafeAreaView, TouchableOpacity,
  Alert, ActivityIndicator, TextInput,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { createUserWithEmailAndPassword, reload, signOut } from "firebase/auth";
import { httpsCallable } from "firebase/functions";
import { auth, functions } from "../../config/firebaseConfig";
import { Ionicons } from "@expo/vector-icons";

function tempPassword(): string {
  const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let p = "";
  for (let i = 0; i < 28; i++) p += chars[Math.floor(Math.random() * chars.length)];
  return p + "!Zz9";
}

const sendCodeFn   = () => httpsCallable(functions, "sendCode");
const verifyCodeFn = () => httpsCallable(functions, "verifyCode");

export default function VerifyFirstScreen() {
  const { email } = useLocalSearchParams<{ email: string }>();
  const router = useRouter();

  const [sending, setSending]   = useState(false);
  const [sent, setSent]         = useState(false);
  const [code, setCode]         = useState(["", "", "", "", "", ""]);
  const [verifying, setVerifying] = useState(false);
  const [resending, setResending] = useState(false);

  const inputs = useRef<(TextInput | null)[]>([]);

  // ── Step 1: create temp account + send code ──────────────────────────────
  const handleSendCode = async () => {
    setSending(true);
    try {
      await createUserWithEmailAndPassword(auth, email, tempPassword());
      await sendCodeFn()({ email });
      setSent(true);
    } catch (error: any) {
      if (error.code === "auth/email-already-in-use") {
        router.replace({ pathname: "/auth/login", params: { email } } as any);
      } else {
        Alert.alert("Error", "Could not send verification code. Check your connection.");
      }
    } finally {
      setSending(false);
    }
  };

  // ── Step 2: verify the 6-digit code ─────────────────────────────────────
  const handleVerify = async () => {
    const fullCode = code.join("");
    if (fullCode.length < 6) {
      Alert.alert("Enter Code", "Please enter the full 6-digit code.");
      return;
    }

    setVerifying(true);
    try {
      await verifyCodeFn()({ email, code: fullCode });
      // Reload so auth.currentUser.emailVerified is now true
      await reload(auth.currentUser!);
      router.replace("/auth/signup-details" as any);
    } catch (error: any) {
      const msg = error?.message ?? "";
      if (msg.includes("Incorrect code")) {
        Alert.alert("Wrong Code", "That code is incorrect. Please try again.");
      } else {
        Alert.alert("Error", "Could not verify. Try again.");
      }
    } finally {
      setVerifying(false);
    }
  };

  const handleResend = async () => {
    setResending(true);
    try {
      await sendCodeFn()({ email });
      setCode(["", "", "", "", "", ""]);
      inputs.current[0]?.focus();
      Alert.alert("Sent", `A new code was sent to ${email}`);
    } catch {
      Alert.alert("Error", "Could not resend. Wait a moment and try again.");
    } finally {
      setResending(false);
    }
  };

  const handleCancel = async () => {
    try { await auth.currentUser?.delete(); } catch {}
    await signOut(auth);
    router.replace("/auth" as any);
  };

  // ── Code input helpers ───────────────────────────────────────────────────
  const onDigitChange = (text: string, index: number) => {
    const digit = text.replace(/[^0-9]/g, "").slice(-1);
    const next = [...code];
    next[index] = digit;
    setCode(next);
    if (digit && index < 5) inputs.current[index + 1]?.focus();
  };

  const onKeyPress = (key: string, index: number) => {
    if (key === "Backspace" && !code[index] && index > 0) {
      inputs.current[index - 1]?.focus();
    }
  };

  // ── Step 1 UI ─────────────────────────────────────────────────────────────
  if (!sent) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.content}>
          <View style={styles.iconCircle}>
            <Ionicons name="shield-checkmark-outline" size={48} color="#000" />
          </View>
          <Text style={styles.title}>Verify your email first</Text>
          <Text style={styles.subtitle}>{"We'll send a 6-digit code to"}</Text>
          <Text style={styles.email}>{email}</Text>
          <Text style={styles.instruction}>
            Enter the code in this app to confirm it{"'"}s really you.
          </Text>

          <TouchableOpacity
            style={[styles.primaryBtn, sending && { opacity: 0.6 }]}
            onPress={handleSendCode}
            disabled={sending}
          >
            {sending
              ? <ActivityIndicator color="#FFF" />
              : <Text style={styles.primaryBtnText}>Send Code</Text>
            }
          </TouchableOpacity>

          <TouchableOpacity style={styles.cancelLink} onPress={() => router.back()}>
            <Text style={styles.cancelText}>Use a different email</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // ── Step 2 UI ─────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <View style={styles.iconCircle}>
          <Ionicons name="mail-open-outline" size={48} color="#000" />
        </View>
        <Text style={styles.title}>Check your inbox</Text>
        <Text style={styles.subtitle}>We sent a 6-digit code to</Text>
        <Text style={styles.email}>{email}</Text>

        {/* 6-digit code boxes */}
        <View style={styles.codeRow}>
          {code.map((digit, i) => (
            <TextInput
              key={i}
              ref={(el) => { inputs.current[i] = el; }}
              style={[styles.codeBox, digit ? styles.codeBoxFilled : null]}
              value={digit}
              onChangeText={(t) => onDigitChange(t, i)}
              onKeyPress={({ nativeEvent }) => onKeyPress(nativeEvent.key, i)}
              keyboardType="number-pad"
              maxLength={1}
              selectTextOnFocus
            />
          ))}
        </View>

        <TouchableOpacity
          style={[styles.primaryBtn, verifying && { opacity: 0.6 }]}
          onPress={handleVerify}
          disabled={verifying}
        >
          {verifying
            ? <ActivityIndicator color="#FFF" />
            : <Text style={styles.primaryBtnText}>Verify</Text>
          }
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.secondaryBtn, resending && { opacity: 0.5 }]}
          onPress={handleResend}
          disabled={resending}
        >
          {resending
            ? <ActivityIndicator color="#000" size="small" />
            : <Text style={styles.secondaryBtnText}>Resend code</Text>
          }
        </TouchableOpacity>

        <TouchableOpacity style={styles.cancelLink} onPress={handleCancel}>
          <Text style={styles.cancelText}>Use a different email</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#FFF" },
  content: {
    flex: 1, justifyContent: "center", alignItems: "center",
    paddingHorizontal: 32,
  },
  iconCircle: {
    width: 96, height: 96, borderRadius: 48,
    backgroundColor: "#F3F4F6",
    justifyContent: "center", alignItems: "center",
    marginBottom: 28,
  },
  title: { fontSize: 26, fontWeight: "800", color: "#000", marginBottom: 10, textAlign: "center" },
  subtitle: { fontSize: 15, color: "#6B7280", textAlign: "center" },
  email: { fontSize: 15, fontWeight: "700", color: "#000", marginBottom: 16, textAlign: "center" },
  instruction: {
    fontSize: 14, color: "#9CA3AF", textAlign: "center",
    lineHeight: 20, marginBottom: 36,
  },
  codeRow: {
    flexDirection: "row", gap: 10, marginBottom: 36, marginTop: 8,
  },
  codeBox: {
    width: 46, height: 56, borderRadius: 12,
    borderWidth: 1.5, borderColor: "#E5E7EB",
    backgroundColor: "#F9FAFB",
    textAlign: "center", fontSize: 22, fontWeight: "700", color: "#000",
  },
  codeBoxFilled: { borderColor: "#000", backgroundColor: "#FFF" },
  primaryBtn: {
    backgroundColor: "#000", width: "100%", paddingVertical: 18,
    borderRadius: 14, alignItems: "center", marginBottom: 14,
  },
  primaryBtnText: { color: "#FFF", fontWeight: "800", fontSize: 16 },
  secondaryBtn: {
    width: "100%", paddingVertical: 16,
    borderRadius: 14, borderWidth: 1, borderColor: "#E5E7EB",
    alignItems: "center", marginBottom: 24,
  },
  secondaryBtnText: { color: "#000", fontWeight: "600", fontSize: 15 },
  cancelLink: { marginTop: 8 },
  cancelText: { color: "#9CA3AF", fontSize: 14, fontWeight: "500" },
});
