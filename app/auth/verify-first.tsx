import React, { useState } from "react";
import {
  View, Text, StyleSheet, SafeAreaView, TouchableOpacity,
  Alert, ActivityIndicator,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { sendEmailVerification, reload, signOut } from "firebase/auth";
import { auth } from "../../config/firebaseConfig";
import { ensureMyProfile } from "../../services/users";
import { Ionicons } from "@expo/vector-icons";

// Step 3 of signup: wait for the user to tap the emailed verification link,
// then add them to GO!'s player list in Tiger and enter the app.

export default function VerifyFirstScreen() {
  const { email } = useLocalSearchParams<{ email: string }>();
  const router = useRouter();

  const [checking, setChecking]   = useState(false);
  const [resending, setResending] = useState(false);

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
        await ensureMyProfile();
        router.replace("/(tabs)" as any);
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
      Alert.alert("Sent", `A new link was sent to ${email ?? user.email}`);
    } catch {
      Alert.alert("Error", "Could not resend. Wait a moment and try again.");
    } finally {
      setResending(false);
    }
  };

  // Backing out of an unverified signup removes the account so the email can
  // be used again.
  const handleCancel = async () => {
    try { await auth.currentUser?.delete(); } catch {}
    await signOut(auth);
    router.replace("/auth" as any);
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <View style={styles.iconCircle}>
          <Ionicons name="mail-open-outline" size={48} color="#000" />
        </View>
        <Text style={styles.title}>Check your inbox</Text>
        <Text style={styles.subtitle}>We sent a verification link to</Text>
        <Text style={styles.email}>{email ?? auth.currentUser?.email}</Text>
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
    backgroundColor: "#F5F3EF",
    justifyContent: "center", alignItems: "center",
    marginBottom: 28,
  },
  title: { fontSize: 26, fontWeight: "800", color: "#000", marginBottom: 10, textAlign: "center" },
  subtitle: { fontSize: 15, color: "#7D7A73", textAlign: "center" },
  email: { fontSize: 15, fontWeight: "700", color: "#000", marginBottom: 16, textAlign: "center" },
  instruction: {
    fontSize: 14, color: "#A8A49C", textAlign: "center",
    lineHeight: 20, marginBottom: 36,
  },
  primaryBtn: {
    backgroundColor: "#000", width: "100%", paddingVertical: 18,
    borderRadius: 14, alignItems: "center", marginBottom: 14,
  },
  primaryBtnText: { color: "#FFF", fontWeight: "800", fontSize: 16 },
  secondaryBtn: {
    width: "100%", paddingVertical: 16,
    borderRadius: 14, borderWidth: 1, borderColor: "#ECE9E3",
    alignItems: "center", marginBottom: 24,
  },
  secondaryBtnText: { color: "#000", fontWeight: "600", fontSize: 15 },
  cancelLink: { marginTop: 8 },
  cancelText: { color: "#A8A49C", fontSize: 14, fontWeight: "500" },
});
