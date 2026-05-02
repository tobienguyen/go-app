import React, { useState } from "react";
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  SafeAreaView, Alert, ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import { updateProfile, updatePassword } from "firebase/auth";
import { auth } from "../../config/firebaseConfig";
import { createUser } from "../../services/users";

const SKILL_LEVELS = ["Social", "Beginner", "Intermediate", "Mid-Intermediate", "Advanced", "Pro"];

export default function SignupDetails() {
  const router = useRouter();

  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [skillLevel, setSkillLevel] = useState("Beginner");
  const [loading, setLoading] = useState(false);

  const handleFinishSetup = async () => {
    const user = auth.currentUser;
    if (!user) {
      Alert.alert("Session Expired", "Please start over.");
      router.replace("/auth" as any);
      return;
    }

    if (!name.trim()) {
      Alert.alert("Missing Info", "Please enter your name.");
      return;
    }
    if (password.length < 6) {
      Alert.alert("Weak Password", "Password must be at least 6 characters.");
      return;
    }

    setLoading(true);
    try {
      // Replace the temporary password with the one the user chose
      await updatePassword(user, password);

      await updateProfile(user, { displayName: name.trim() });

      await createUser(user.uid, {
        name: name.trim(),
        email: user.email ?? "",
      });

      router.replace("/(tabs)" as any);
    } catch (error: any) {
      Alert.alert("Setup Failed", error.message ?? "Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  const user = auth.currentUser;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Complete your profile</Text>
        <Text style={styles.subtitle}>Signing up as {user?.email}</Text>
      </View>

      <View style={styles.form}>
        <Text style={styles.label}>Full Name</Text>
        <TextInput
          style={styles.input}
          placeholder="John Doe"
          placeholderTextColor="#9CA3AF"
          value={name}
          onChangeText={setName}
        />

        <Text style={styles.label}>Create Password</Text>
        <TextInput
          style={styles.input}
          placeholder="At least 6 characters"
          placeholderTextColor="#9CA3AF"
          secureTextEntry
          value={password}
          onChangeText={setPassword}
        />

        <Text style={styles.label}>Volleyball Skill Level</Text>
        <View style={styles.skillContainer}>
          {SKILL_LEVELS.map(level => (
            <TouchableOpacity
              key={level}
              style={[styles.skillBtn, skillLevel === level && styles.skillBtnActive]}
              onPress={() => setSkillLevel(level)}
            >
              <Text style={[styles.skillBtnText, skillLevel === level && styles.skillBtnTextActive]}>
                {level}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        <Text style={{ fontSize: 12, color: "#9CA3AF", marginTop: 8 }}>
          You can change this anytime in your profile.
        </Text>

        <TouchableOpacity style={styles.mainButton} onPress={handleFinishSetup} disabled={loading}>
          {loading
            ? <ActivityIndicator color="#FFF" />
            : <Text style={styles.mainButtonText}>Finish Setup</Text>
          }
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#FFF" },
  header: { padding: 30, marginTop: 20 },
  title: { fontSize: 28, fontWeight: "800", color: "#000" },
  subtitle: { fontSize: 14, color: "#666", marginTop: 5 },
  form: { paddingHorizontal: 30 },
  label: { fontSize: 14, fontWeight: "600", color: "#000", marginBottom: 8, marginTop: 15 },
  input: {
    backgroundColor: "#F3F4F6", padding: 16, borderRadius: 12,
    fontSize: 16, borderWidth: 1, borderColor: "#E5E7EB", color: "#000",
  },
  skillContainer: { flexDirection: "row", flexWrap: "wrap", marginTop: 5, gap: 8 },
  skillBtn: {
    flex: 1, paddingVertical: 12, borderRadius: 10,
    borderWidth: 1, borderColor: "#E5E7EB", alignItems: "center",
  },
  skillBtnActive: { backgroundColor: "#000", borderColor: "#000" },
  skillBtnText: { color: "#666", fontWeight: "600" },
  skillBtnTextActive: { color: "#FFF" },
  mainButton: {
    backgroundColor: "#000", padding: 18, borderRadius: 12,
    alignItems: "center", marginTop: 40, height: 60, justifyContent: "center",
  },
  mainButtonText: { color: "#FFF", fontWeight: "700", fontSize: 16 },
});
