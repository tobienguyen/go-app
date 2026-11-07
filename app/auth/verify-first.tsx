import React, { useState } from "react";
import {
  View, Text, StyleSheet, SafeAreaView, TouchableOpacity,
  Alert, ActivityIndicator,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  createUserWithEmailAndPassword, sendEmailVerification, reload, signOut,
} from "firebase/auth";
import { auth } from "../../config/firebaseConfig";
import { Ionicons } from "@expo/vector-icons";

// Email verification uses Firebase's built-in verification link.
// The previous Twilio Verify (6-digit code) flow lives in archive/twilio-verify/.

// The account is created with a throwaway password; the user sets their real
// password on signup-details right after verifying.
function tempPassword(): string {
  const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let p = "";
  for (let i = 0; i < 28; i++) p += chars[Math.floor(Math.random() * chars.length)];
  return p + "!Zz9";
}

export default function VerifyFirstScreen() {
  const { email } = useLocalSearchParams<{ email: string }>();
  const router = useRouter();

  const [sending, setSending]     = useState(false);
  const [sent, setSent]           = useState(false);
  const [checking, setChecking]   = useState(false);
  const [resending, setResending] = useState(false);

  // ── Step 1: create temp account + send verification link ────────────────
  const handleSendLink = async () => {
    setSending(true);
    try {
      const cred = await createUserWithEmailAndPassword(auth, email, tempPassword());
      try {
        await sendEmailVerification(cred.user);
      } catch (sendError) {
        // Don't leave a half-created account behind: it would have a password
        // nobody knows and lock this email out of signing up again.
        try { await cred.user.delete(); } catch {}
        throw sendError;
      }
      setSent(true);
    } catch (error: any) {
      if (error.code === "auth/email-already-in-use") {
        router.replace({ pathname: "/auth/login", params: { email } } as any);
      } else if (error.code === "auth/too-many-requests") {
        Alert.alert("Slow down", "Too many attempts. Wait a minute and try again.");
      } else {
        Alert.alert("Error", "Could not send the verification email. Check your connection.");
      }
    } finally {
      setSending(false);
    }
  };

  // ── Step 2: user taps the link in their email, then comes back ──────────
  const handleCheckVerified = async () => {
    const user = auth.currentUser;
    if (!user) {
      router.replace("/auth" as any);
      return;
    }
    setChecking(true);
    try {
      await reload(user);
      if (auth.currentUser?.emailVerified) {
        router.replace("/auth/signup-details" as any);
      } else {
        Alert.alert(
          "Not verified yet",
          "Tap the link in the email first. If you can't find it, check your spam or junk folder.",
        );
      }
    } catch {
      Alert.alert("Error", "Could not check verification. Try again.");
    } finally {
      setChecking(false);
    }
  };

  const handleResend = async () => {
    const user = auth.currentUser;
    if (!user) return;
    setResending(true);
    try {
      await sendEmailVerification(user);
      Alert.alert("Sent", `A new link was sent to ${email}`);
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

  // ── Step 1 UI ─────────────────────────────────────────────────────────────
  if (!sent) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.content}>
          <View style={styles.iconCircle}>
            <Ionicons name="shield-checkmark-outline" size={48} color="#000" />
          </View>
          <Text style={styles.title}>Verify your email first</Text>
          <Text style={styles.subtitle}>{"We'll send a verification link to"}</Text>
          <Text style={styles.email}>{email}</Text>
          <Text style={styles.instruction}>
            Tap the link in the email to confirm it{"'"}s really you.
          </Text>

          <TouchableOpacity
            style={[styles.primaryBtn, sending && { opacity: 0.6 }]}
            onPress={handleSendLink}
            disabled={sending}
          >
            {sending
              ? <ActivityIndicator color="#FFF" />
              : <Text style={styles.primaryBtnText}>Send Link</Text>
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
        <Text style={styles.subtitle}>We sent a verification link to</Text>
        <Text style={styles.email}>{email}</Text>
        <Text style={styles.instruction}>
          Tap the link, then come back here.{"\n"}
          Don{"'"}t see it? Check your spam or junk folder.
        </Text>

        <TouchableOpacity
          style={[styles.primaryBtn, checking && { opacity: 0.6 }]}
          onPress={handleCheckVerified}
          disabled={checking}
        >
          {checking
            ? <ActivityIndicator color="#FFF" />
            : <Text style={styles.primaryBtnText}>I{"'"}ve verified</Text>
          }
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.secondaryBtn, resending && { opacity: 0.5 }]}
          onPress={handleResend}
          disabled={resending}
        >
          {resending
            ? <ActivityIndicator color="#000" size="small" />
            : <Text style={styles.secondaryBtnText}>Resend link</Text>
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
