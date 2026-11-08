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
import * as Google from "expo-auth-session/providers/google";
import * as WebBrowser from "expo-web-browser";
import * as AppleAuthentication from "expo-apple-authentication";
import { auth } from "../../config/firebaseConfig";
import { handleGoogleSignIn, handleAppleSignIn } from "../../utils/socialAuth";
import { F } from "../../constants/fonts";

WebBrowser.maybeCompleteAuthSession();

const GOOGLE_IOS_CLIENT_ID = undefined; // Add iOS client ID when you register an iOS app in Firebase
const GOOGLE_ANDROID_CLIENT_ID = undefined; // Add Android client ID after adding SHA-1 in Firebase
const GOOGLE_WEB_CLIENT_ID = "760211922089-c3nmfede113rlfssmm6rj9jeagvgj0o8.apps.googleusercontent.com";

export default function GatekeeperScreen() {
  const [email, setEmail] = useState("");
  const [googleLoading, setGoogleLoading] = useState(false);
  const [appleLoading, setAppleLoading] = useState(false);
  const router = useRouter();

  // Google OAuth
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

  // Apple Sign-In
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

  // Email Continue
  const handleContinue = () => {
    const trimmed = email.trim();
    if (!trimmed.includes("@") || !trimmed.includes(".")) {
      Alert.alert("Invalid Email", "Please enter a valid email address.");
      return;
    }

    // Firebase's email enumeration protection hides whether an account
    // exists, so we don't guess here. The signup form tries to create the
    // account and sends returning users to login if the email is taken.
    router.push({ pathname: "/auth/signup-details", params: { email: trimmed.toLowerCase() } } as any);
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

        <TouchableOpacity style={styles.button} onPress={handleContinue}>
          <Text style={styles.buttonText}>CONTINUE</Text>
        </TouchableOpacity>

        <View style={styles.dividerContainer}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>OR</Text>
          <View style={styles.dividerLine} />
        </View>

        <View style={styles.socialButtons}>
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
  logoImage: { width: 180, height: 180 },
  content: { width: "100%", paddingHorizontal: 30 },
  pageSubtitle: {
    fontFamily: F.w600,
    fontSize: 13, color: "#666666", textAlign: "center",
    marginBottom: 25, letterSpacing: 2,
  },
  input: {
    fontFamily: F.w400,
    backgroundColor: "#F5F3EF", color: "#000", padding: 16,
    borderRadius: 12, fontSize: 18, marginBottom: 16,
    borderWidth: 1, borderColor: "#ECE9E3",
  },
  button: {
    backgroundColor: "#000", padding: 18, borderRadius: 12,
    alignItems: "center", height: 60, justifyContent: "center",
  },
  buttonText: { fontFamily: F.w800, color: "#FFF", fontSize: 18, letterSpacing: 1 },
  dividerContainer: { flexDirection: "row", alignItems: "center", marginVertical: 25 },
  dividerLine: { flex: 1, height: 1, backgroundColor: "#ECE9E3" },
  dividerText: { fontFamily: F.w700, color: "#A8A49C", paddingHorizontal: 10, fontSize: 13, },
  socialButtons: { gap: 12 },
  socialButton: {
    backgroundColor: "#FFF", padding: 16, borderRadius: 12,
    borderWidth: 1, borderColor: "#ECE9E3",
  },
  socialButtonContent: { flexDirection: "row", alignItems: "center", justifyContent: "center" },
  icon: { marginRight: 10 },
  socialButtonText: { fontFamily: F.w600, color: "#000", fontSize: 17 },
});
