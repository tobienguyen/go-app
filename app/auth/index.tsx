import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  Alert,
  ActivityIndicator,
  Image,
  Platform,
} from "react-native";
import { useRouter } from "expo-router";
import { FontAwesome } from "@expo/vector-icons";
import { signInWithEmailAndPassword } from "firebase/auth";
import * as Google from "expo-auth-session/providers/google";
import * as WebBrowser from "expo-web-browser";
import * as AppleAuthentication from "expo-apple-authentication";
import { auth } from "../../config/firebaseConfig";
import { handleGoogleSignIn, handleAppleSignIn } from "../../utils/socialAuth";

WebBrowser.maybeCompleteAuthSession();

// ─── Replace these with your own from Firebase Console ──────────────────────
// Firebase Console → Project Settings → Your Apps → Web app → OAuth 2.0 Client IDs
// Google Cloud Console → APIs & Services → Credentials
const GOOGLE_IOS_CLIENT_ID = undefined; // Add iOS client ID when you register an iOS app in Firebase
const GOOGLE_ANDROID_CLIENT_ID = undefined; // Add Android client ID after adding SHA-1 in Firebase
const GOOGLE_WEB_CLIENT_ID = "760211922089-c3nmfede113rlfssmm6rj9jeagvgj0o8.apps.googleusercontent.com";
// ─────────────────────────────────────────────────────────────────────────────

export default function GatekeeperScreen() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [appleLoading, setAppleLoading] = useState(false);
  const router = useRouter();

  // ── Google OAuth ────────────────────────────────────────────────────────
  const [, googleResponse, googlePrompt] = Google.useAuthRequest({
    iosClientId: GOOGLE_WEB_CLIENT_ID,
    androidClientId: GOOGLE_ANDROID_CLIENT_ID,
    webClientId: GOOGLE_WEB_CLIENT_ID,
  });

  useEffect(() => {
    if (googleResponse?.type === "success") {
      const { access_token } = googleResponse.params;
      setGoogleLoading(true);
      handleGoogleSignIn(access_token)
        .then(() => router.replace("/(tabs)" as any))
        .catch((e) => Alert.alert("Google Sign-In Failed", e.message))
        .finally(() => setGoogleLoading(false));
    }
  }, [googleResponse, router]);

  // ── Apple Sign-In ───────────────────────────────────────────────────────
  const onApplePress = async () => {
    setAppleLoading(true);
    try {
      await handleAppleSignIn();
      router.replace("/(tabs)" as any);
    } catch (e: any) {
      if (e.code !== "ERR_REQUEST_CANCELED") {
        Alert.alert("Apple Sign-In Failed", e.message);
      }
    } finally {
      setAppleLoading(false);
    }
  };

  // ── Email Continue ──────────────────────────────────────────────────────
  const handleContinue = async () => {
    if (!email.includes("@")) {
      Alert.alert("Invalid Email", "Please enter a valid email address.");
      return;
    }

    setLoading(true);
    try {
      // Probe whether an account exists by attempting a sign-in with a dummy password.
      // firebase/auth no longer reliably returns sign-in methods, so this is the
      // only way to distinguish "account exists" from "new user" without a backend.
      await signInWithEmailAndPassword(auth, email, "____probe____");
    } catch (error: any) {
      if (
        error.code === "auth/wrong-password" ||
        error.code === "auth/invalid-credential"
      ) {
        // Account exists — send to login
        router.push({ pathname: "/auth/login", params: { email } } as any);
      } else if (
        error.code === "auth/user-not-found" ||
        error.code === "auth/invalid-email"
      ) {
        // No account — start verification flow
        router.push({ pathname: "/auth/verify-first", params: { email } } as any);
      } else {
        Alert.alert("Connection Error", "Check your internet connection and try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.logoHeader}>
        <Image
          source={require("../../assets/images/logo.png")}
          style={styles.logoImage}
          resizeMode="contain"
        />
      </View>

      <View style={styles.content}>
        <Text style={styles.pageSubtitle}>ENTER YOUR EMAIL</Text>

        <TextInput
          style={styles.input}
          placeholder="email@domain.com"
          placeholderTextColor="#A0A0A0"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
        />

        <TouchableOpacity style={styles.button} onPress={handleContinue} disabled={loading}>
          {loading ? (
            <ActivityIndicator color="#FFF" />
          ) : (
            <Text style={styles.buttonText}>CONTINUE</Text>
          )}
        </TouchableOpacity>

        <View style={styles.dividerContainer}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>OR</Text>
          <View style={styles.dividerLine} />
        </View>

        <View style={styles.socialButtons}>
          {/* Google */}
          <TouchableOpacity
            style={[styles.socialButton, googleLoading && { opacity: 0.6 }]}
            onPress={() => googlePrompt()}
            disabled={googleLoading}
          >
            <View style={styles.socialButtonContent}>
              {googleLoading ? (
                <ActivityIndicator size="small" color="#000" style={styles.icon} />
              ) : (
                <FontAwesome name="google" size={18} color="#000" style={styles.icon} />
              )}
              <Text style={styles.socialButtonText}>Continue with Google</Text>
            </View>
          </TouchableOpacity>

          {/* Apple — iOS only */}
          {Platform.OS === "ios" && (
            <TouchableOpacity
              style={[styles.socialButton, appleLoading && { opacity: 0.6 }]}
              onPress={onApplePress}
              disabled={appleLoading}
            >
              <View style={styles.socialButtonContent}>
                {appleLoading ? (
                  <ActivityIndicator size="small" color="#000" style={styles.icon} />
                ) : (
                  <FontAwesome name="apple" size={20} color="#000" style={styles.icon} />
                )}
                <Text style={styles.socialButtonText}>Continue with Apple</Text>
              </View>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#FFFFFF" },
  logoHeader: { marginTop: 80, marginBottom: 20, alignItems: "center", justifyContent: "center" },
  logoImage: { width: 250, height: 150 },
  content: { width: "100%", paddingHorizontal: 30 },
  pageSubtitle: {
    fontSize: 12, color: "#666666", textAlign: "center",
    marginBottom: 25, letterSpacing: 2, fontWeight: "600",
  },
  input: {
    backgroundColor: "#F3F4F6", color: "#000", padding: 16,
    borderRadius: 12, fontSize: 16, marginBottom: 16,
    borderWidth: 1, borderColor: "#E5E7EB",
  },
  button: {
    backgroundColor: "#000", padding: 18, borderRadius: 12,
    alignItems: "center", height: 60, justifyContent: "center",
  },
  buttonText: { color: "#FFF", fontWeight: "800", fontSize: 16, letterSpacing: 1 },
  dividerContainer: { flexDirection: "row", alignItems: "center", marginVertical: 25 },
  dividerLine: { flex: 1, height: 1, backgroundColor: "#E5E7EB" },
  dividerText: { color: "#9CA3AF", paddingHorizontal: 10, fontSize: 12, fontWeight: "700" },
  socialButtons: { gap: 12 },
  socialButton: {
    backgroundColor: "#FFF", padding: 16, borderRadius: 12,
    borderWidth: 1, borderColor: "#E5E7EB",
  },
  socialButtonContent: { flexDirection: "row", alignItems: "center", justifyContent: "center" },
  icon: { marginRight: 10 },
  socialButtonText: { color: "#000", fontWeight: "600", fontSize: 15 },
});
