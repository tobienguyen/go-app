import React, { useState, useEffect } from "react";
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  SafeAreaView, Alert, ActivityIndicator, Platform,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { FontAwesome } from "@expo/vector-icons";
import { signInWithEmailAndPassword } from "firebase/auth";
import * as Google from "expo-auth-session/providers/google";
import * as WebBrowser from "expo-web-browser";
import { auth } from "../../config/firebaseConfig";
import { handleGoogleSignIn, handleAppleSignIn } from "../../utils/socialAuth";

WebBrowser.maybeCompleteAuthSession();

const GOOGLE_IOS_CLIENT_ID = undefined; // Add iOS client ID when you register an iOS app in Firebase
const GOOGLE_ANDROID_CLIENT_ID = undefined; // Add Android client ID after adding SHA-1 in Firebase
const GOOGLE_WEB_CLIENT_ID = "760211922089-c3nmfede113rlfssmm6rj9jeagvgj0o8.apps.googleusercontent.com";

export default function Login() {
  const { email: prefillEmail } = useLocalSearchParams<{ email: string }>();
  const [email, setEmail] = useState(prefillEmail ?? "");
  const [password, setPassword] = useState("");
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

  // ── Email / Password Login ──────────────────────────────────────────────
  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert("Missing Fields", "Please enter your email and password.");
      return;
    }

    setLoading(true);
    try {
      const { user } = await signInWithEmailAndPassword(auth, email, password);
      if (user.emailVerified) {
        router.replace("/(tabs)" as any);
      } else {
        router.replace("/auth/verify-email" as any);
      }
    } catch (error: any) {
      if (
        error.code === "auth/wrong-password" ||
        error.code === "auth/invalid-credential"
      ) {
        Alert.alert("Incorrect Password", "The password you entered is wrong. Please try again.");
      } else if (error.code === "auth/too-many-requests") {
        Alert.alert("Too Many Attempts", "Account temporarily locked. Try again later.");
      } else {
        Alert.alert("Login Failed", "Something went wrong. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.logoHeader}>
        <Text style={styles.logoTextBold}>
          Go<Text style={styles.logoTextItalic}>!</Text>
        </Text>
      </View>

      <View style={styles.content}>
        <Text style={styles.pageTitle}>Welcome back</Text>
        <Text style={styles.pageSubtitle}>Log in to your account</Text>

        <TextInput
          style={styles.input}
          placeholder="Email"
          placeholderTextColor="#A0A0A0"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
        />

        <TextInput
          style={styles.input}
          placeholder="Password"
          placeholderTextColor="#A0A0A0"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />

        <TouchableOpacity style={styles.button} onPress={handleLogin} disabled={loading}>
          {loading ? (
            <ActivityIndicator color="#FFF" />
          ) : (
            <Text style={styles.buttonText}>Log In</Text>
          )}
        </TouchableOpacity>

        <View style={styles.dividerContainer}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>or</Text>
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

        <TouchableOpacity
          onPress={() => router.push("/auth" as any)}
          style={styles.signUpLinkContainer}
        >
          <Text style={styles.signUpText}>
            New here?{" "}
            <Text style={styles.signUpSubLink}>Create an account</Text>
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#FFFFFF", paddingHorizontal: 20 },
  logoHeader: { marginTop: 60, marginBottom: 40, alignItems: "center" },
  logoTextBold: { fontSize: 48, fontWeight: "800", letterSpacing: -1.5, color: "#000000" },
  logoTextItalic: { fontStyle: "italic", fontWeight: "900", color: "#000000" },
  content: { flex: 1, paddingHorizontal: 15 },
  pageTitle: { fontSize: 28, fontWeight: "700", color: "#000000", textAlign: "center", marginBottom: 8 },
  pageSubtitle: { fontSize: 16, color: "#666666", textAlign: "center", marginBottom: 30 },
  input: {
    backgroundColor: "#F3F4F6", color: "#000", padding: 16,
    borderRadius: 12, fontSize: 16, marginBottom: 16,
    borderWidth: 1, borderColor: "#E5E7EB",
  },
  button: {
    backgroundColor: "#000000", padding: 16, borderRadius: 12,
    alignItems: "center", marginBottom: 20,
  },
  buttonText: { color: "#FFFFFF", fontWeight: "700", fontSize: 16 },
  dividerContainer: { flexDirection: "row", alignItems: "center", marginVertical: 15 },
  dividerLine: { flex: 1, height: 1, backgroundColor: "#E5E7EB" },
  dividerText: { color: "#9CA3AF", paddingHorizontal: 10, fontSize: 14 },
  socialButtons: { marginTop: 10, gap: 12 },
  socialButton: {
    backgroundColor: "#FFFFFF", padding: 16, borderRadius: 12,
    borderWidth: 1, borderColor: "#E5E7EB",
  },
  socialButtonContent: { flexDirection: "row", alignItems: "center", justifyContent: "center" },
  icon: { marginRight: 10 },
  socialButtonText: { color: "#000000", fontWeight: "600", fontSize: 16 },
  signUpLinkContainer: { marginTop: 25, alignItems: "center" },
  signUpText: { fontSize: 15, color: "#666666" },
  signUpSubLink: { color: "#000000", fontWeight: "700", textDecorationLine: "underline" },
});
