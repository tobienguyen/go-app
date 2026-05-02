import React, { useState } from "react";
import {
  View, Text, StyleSheet, SafeAreaView,
  TouchableOpacity, Alert, ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import { sendEmailVerification, reload, signOut } from "firebase/auth";
import { auth } from "../../config/firebaseConfig";
import { Ionicons } from "@expo/vector-icons";

export default function VerifyEmailScreen() {
  const router = useRouter();
  const user = auth.currentUser;
  const [checking, setChecking] = useState(false);
  const [resending, setResending] = useState(false);

  const handleCheckVerified = async () => {
    if (!user) return;
    setChecking(true);
    try {
      // Reload forces Firebase to re-fetch the latest emailVerified status
      await reload(user);
      if (user.emailVerified) {
        // If profile setup was never completed, go there first
        if (!user.displayName) {
          router.replace("/auth/signup-details" as any);
        } else {
          router.replace("/(tabs)" as any);
        }
      } else {
        Alert.alert(
          "Not Verified Yet",
          "We haven't received your verification yet. Check your inbox (and spam folder) then tap the link."
        );
      }
    } catch {
      Alert.alert("Error", "Could not check verification. Try again.");
    } finally {
      setChecking(false);
    }
  };

  const handleResend = async () => {
    if (!user) return;
    setResending(true);
    try {
      await sendEmailVerification(user);
      Alert.alert("Email Sent", `A new verification link was sent to ${user.email}`);
    } catch {
      Alert.alert("Error", "Could not resend email. Wait a moment and try again.");
    } finally {
      setResending(false);
    }
  };

  const handleSignOut = async () => {
    await signOut(auth);
    router.replace("/auth" as any);
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <View style={styles.iconCircle}>
          <Ionicons name="mail-outline" size={48} color="#000" />
        </View>

        <Text style={styles.title}>Check your inbox</Text>
        <Text style={styles.subtitle}>
          We sent a verification link to
        </Text>
        <Text style={styles.email}>{user?.email}</Text>
        <Text style={styles.instruction}>
          Tap the link in the email, then come back here and press the button below.
        </Text>

        <TouchableOpacity
          style={[styles.primaryBtn, checking && { opacity: 0.6 }]}
          onPress={handleCheckVerified}
          disabled={checking}
        >
          {checking
            ? <ActivityIndicator color="#FFF" />
            : <Text style={styles.primaryBtnText}>{"I've Verified My Email"}</Text>
          }
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.secondaryBtn, resending && { opacity: 0.5 }]}
          onPress={handleResend}
          disabled={resending}
        >
          {resending
            ? <ActivityIndicator color="#000" size="small" />
            : <Text style={styles.secondaryBtnText}>Resend verification email</Text>
          }
        </TouchableOpacity>

        <TouchableOpacity style={styles.signOutLink} onPress={handleSignOut}>
          <Text style={styles.signOutText}>Use a different account</Text>
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
  signOutLink: { marginTop: 8 },
  signOutText: { color: "#9CA3AF", fontSize: 14, fontWeight: "500" },
});
