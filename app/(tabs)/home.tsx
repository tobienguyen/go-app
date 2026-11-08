import React from 'react';
import { View, Text, StyleSheet, SafeAreaView, TouchableOpacity } from 'react-native';
import { auth } from "../../config/firebaseConfig"; // Note: ../../ because it's inside (tabs)
import { signOut } from "firebase/auth";
import { useRouter } from "expo-router";

export default function HomeScreen() {
  const router = useRouter();
  const user = auth.currentUser;

  const handleSignOut = async () => {
    try {
      await signOut(auth);
      router.replace('/auth' as any);
    } catch (error) {
      console.error("Error signing out", error);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>{"You're In!"}</Text>
        <Text style={styles.subtitle}>Welcome to the GO! Community</Text>
        
        <View style={styles.card}>
          <Text style={styles.label}>Logged in as:</Text>
          <Text style={styles.emailText}>{user?.email || "Guest User"}</Text>
        </View>

        <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut}>
          <Text style={styles.signOutText}>Sign Out</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFF' },
  content: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  title: { fontSize: 32, fontWeight: '800', color: '#000' },
  subtitle: { fontSize: 16, color: '#666', marginTop: 10, marginBottom: 40 },
  card: { backgroundColor: '#F5F3EF', padding: 20, borderRadius: 15, width: '100%', alignItems: 'center', marginBottom: 20 },
  label: { fontSize: 12, color: '#A8A49C', textTransform: 'uppercase', letterSpacing: 1 },
  emailText: { fontSize: 18, fontWeight: '600', color: '#000', marginTop: 5 },
  signOutButton: { marginTop: 20, padding: 10 },
  signOutText: { color: '#D0341A', fontWeight: '600', fontSize: 16 }
});