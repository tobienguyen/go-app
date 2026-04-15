import React, { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet, SafeAreaView, Alert } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { auth } from "../../config/firebaseConfig"; // Double check: is your config folder next to the app folder?
import { createUserWithEmailAndPassword } from "firebase/auth";

export default function SignupDetails() {
  const { email } = useLocalSearchParams();
  const router = useRouter();

  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [skillLevel, setSkillLevel] = useState("Intermediate"); // Default value

  const handleCreateAccount = async () => {
    if (!password || !name) {
      Alert.alert("Missing Info", "Please enter your name and a password.");
      return;
    }

    try {
      // 1. Create the user in Firebase Auth
      const userCredential = await createUserWithEmailAndPassword(auth, email as string, password);
      
      console.log("Account created for:", userCredential.user.email);
      
      // 2. SUCCESS! Send them to the main app
      // In the future, we will save 'name' and 'skillLevel' to Firestore here
      router.replace('/(tabs)' as any);
      
    } catch (error: any) {
      Alert.alert("Signup Failed", error.message);
    }
  };

  const SkillButton = ({ level }: { level: string }) => (
    <TouchableOpacity 
      style={[styles.skillBtn, skillLevel === level && styles.skillBtnActive]} 
      onPress={() => setSkillLevel(level)}
    >
      <Text style={[styles.skillBtnText, skillLevel === level && styles.skillBtnTextActive]}>
        {level}
      </Text>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Complete your profile</Text>
        <Text style={styles.subtitle}>You're signing up with {email}</Text>
      </View>

      <View style={styles.form}>
        <Text style={styles.label}>Full Name</Text>
        <TextInput 
          style={styles.input} 
          placeholder="John Doe" 
          value={name}
          onChangeText={setName}
        />

        <Text style={styles.label}>Create Password</Text>
        <TextInput 
          style={styles.input} 
          placeholder="At least 6 characters" 
          secureTextEntry 
          value={password}
          onChangeText={setPassword}
        />

        <Text style={styles.label}>Volleyball Skill Level</Text>
        <View style={styles.skillContainer}>
          <SkillButton level="Beginner" />
          <SkillButton level="Intermediate" />
          <SkillButton level="Advanced" />
        </View>

        <TouchableOpacity style={styles.mainButton} onPress={handleCreateAccount}>
          <Text style={styles.mainButtonText}>Create Account</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFF' },
  header: { padding: 30, marginTop: 20 },
  title: { fontSize: 28, fontWeight: '800', color: '#000' },
  subtitle: { fontSize: 14, color: '#666', marginTop: 5 },
  form: { paddingHorizontal: 30 },
  label: { fontSize: 14, fontWeight: '600', color: '#000', marginBottom: 8, marginTop: 15 },
  input: { backgroundColor: '#F3F4F6', padding: 16, borderRadius: 12, fontSize: 16, borderWidth: 1, borderColor: '#E5E7EB' },
  skillContainer: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 5, gap: 10 },
  skillBtn: { flex: 1, paddingVertical: 12, borderRadius: 10, borderWidth: 1, borderColor: '#E5E7EB', alignItems: 'center' },
  skillBtnActive: { backgroundColor: '#000', borderColor: '#000' },
  skillBtnText: { color: '#666', fontWeight: '600' },
  skillBtnTextActive: { color: '#FFF' },
  mainButton: { backgroundColor: '#000', padding: 18, borderRadius: 12, alignItems: 'center', marginTop: 40 },
  mainButtonText: { color: '#FFF', fontWeight: '700', fontSize: 16 }
});