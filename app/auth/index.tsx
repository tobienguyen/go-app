import React, { useState } from "react";
import { 
  View, 
  Text, 
  TextInput, 
  TouchableOpacity, 
  StyleSheet, 
  SafeAreaView, 
  Alert, 
  ActivityIndicator,
  Image 
} from "react-native";
import { useRouter } from "expo-router";
import { FontAwesome } from '@expo/vector-icons'; 
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "../../config/firebaseConfig"; // Verify this path!

export default function GatekeeperScreen() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleContinue = async () => {
    if (!email.includes('@')) {
      Alert.alert("Invalid Email", "Please enter a valid email address.");
      return;
    }
    
    setLoading(true);
    try {
      // Trying a dummy password to check if user exists in Firebase
      await signInWithEmailAndPassword(auth, email, "checking-existence-123");
      
      // If success (rare with dummy pass), send to main app
      router.replace("/(tabs)/index" as any);
      
    } catch (error: any) {
      // Logic for folder navigation
      if (error.code === "auth/user-not-found" || error.code === "auth/invalid-credential") {
        // Redirect to signup-details.tsx inside (auth)
        router.push({ pathname: "/auth/signup-details", params: { email } } as any);
      } else if (error.code === "auth/wrong-password" || error.code === "auth/too-many-requests") {
        router.push({ pathname: "/auth/login", params: { email } } as any);
      } else {
        Alert.alert("Connection Error", "Check your Firebase console or internet.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.logoHeader}>
        <Image 
          // Going up two levels (../../) to reach the assets folder from app/(auth)/
          source={require('../../assets/images/logo.png')} 
          style={styles.logoImage}
          resizeMode="contain"
        />
      </View>

      <View style={styles.content}>
        <Text style={styles.pageSubtitle}>ENTER EMAIL TO BEGIN SYNC.</Text>
        
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
          {loading ? <ActivityIndicator color="#FFF" /> : <Text style={styles.buttonText}>CONTINUE</Text>}
        </TouchableOpacity>

        <View style={styles.dividerContainer}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>OR</Text>
          <View style={styles.dividerLine} />
        </View>

        <View style={styles.socialButtons}>
          <TouchableOpacity style={styles.socialButton} onPress={() => Alert.alert("Coming Soon")}>
            <View style={styles.socialButtonContent}>
              <FontAwesome name="google" size={18} color="#000" style={styles.icon} />
              <Text style={styles.socialButtonText}>Continue with Google</Text>
            </View>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  logoHeader: { marginTop: 80, marginBottom: 20, alignItems: 'center', justifyContent: 'center' },
  logoImage: { width: 250, height: 150 },
  content: { width: '100%', paddingHorizontal: 30 },
  pageSubtitle: { fontSize: 12, color: '#666666', textAlign: 'center', marginBottom: 25, letterSpacing: 2, fontWeight: '600' },
  input: { backgroundColor: '#F3F4F6', color: '#000', padding: 16, borderRadius: 12, fontSize: 16, marginBottom: 16, borderWidth: 1, borderColor: '#E5E7EB' },
  button: { backgroundColor: '#000', padding: 18, borderRadius: 12, alignItems: 'center', height: 60, justifyContent: 'center' },
  buttonText: { color: '#FFF', fontWeight: '800', fontSize: 16, letterSpacing: 1 },
  dividerContainer: { flexDirection: 'row', alignItems: 'center', marginVertical: 25 },
  dividerLine: { flex: 1, height: 1, backgroundColor: '#E5E7EB' },
  dividerText: { color: '#9CA3AF', paddingHorizontal: 10, fontSize: 12, fontWeight: '700' },
  socialButtons: { gap: 12 },
  socialButton: { backgroundColor: '#FFF', padding: 16, borderRadius: 12, borderWidth: 1, borderColor: '#E5E7EB' },
  socialButtonContent: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  icon: { marginRight: 10 },
  socialButtonText: { color: '#000', fontWeight: '600', fontSize: 15 },
});