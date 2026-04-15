import React, { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet, SafeAreaView } from "react-native";
import { useRouter } from "expo-router";
import { FontAwesome } from '@expo/vector-icons';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const router = useRouter();

  const handleLogin = () => {
    // This will eventually check Firebase for the user
    console.log("Logging in:", email);
    router.replace('/(tabs)' as any);
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* 1. Brand Logo */}
      <View style={styles.logoHeader}>
        <Text style={styles.logoTextBold}>
          Go
          <Text style={styles.logoTextItalic}>!</Text>
        </Text>
      </View>

      <View style={styles.content}>
        {/* 2. Page Header */}
        <Text style={styles.pageTitle}>Welcome back</Text>
        <Text style={styles.pageSubtitle}>Log in to your account</Text>
        
        {/* 3. Credentials Inputs */}
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
          secureTextEntry // Hides the password characters
        />

        {/* 4. Main Login Button */}
        <TouchableOpacity style={styles.button} onPress={handleLogin}>
          <Text style={styles.buttonText}>Log In</Text>
        </TouchableOpacity>

        {/* 5. Divider */}
        <View style={styles.dividerContainer}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>or</Text>
          <View style={styles.dividerLine} />
        </View>

        {/* 6. Social Buttons (Matching Sign-Up) */}
        <View style={styles.socialButtons}>
          <TouchableOpacity style={styles.socialButton}>
            <View style={styles.socialButtonContent}>
              <FontAwesome name="google" size={18} color="#000" style={styles.icon} />
              <Text style={styles.socialButtonText}>Continue with Google</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity style={styles.socialButton}>
            <View style={styles.socialButtonContent}>
              <FontAwesome name="apple" size={20} color="#000" style={styles.icon} />
              <Text style={styles.socialButtonText}>Continue with Apple</Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* 7. Toggle back to Sign Up */}
        <TouchableOpacity onPress={() => router.push('/auth' as any)} style={styles.signUpLinkContainer}>
          <Text style={styles.signUpText}>
            New here? <Text style={styles.signUpSubLink}>Create an account</Text>
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 20,
  },
  logoHeader: {
    marginTop: 60,
    marginBottom: 40,
    alignItems: 'center',
  },
  logoTextBold: {
    fontSize: 48,
    fontWeight: '800', 
    letterSpacing: -1.5,
    color: '#000000',
  },
  logoTextItalic: {
    fontStyle: 'italic',
    fontWeight: '900',
    color: '#000000',
  },
  content: {
    flex: 1,
    paddingHorizontal: 15,
  },
  pageTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#000000',
    textAlign: 'center',
    marginBottom: 8,
  },
  pageSubtitle: {
    fontSize: 16,
    color: '#666666',
    textAlign: 'center',
    marginBottom: 30,
  },
  input: {
    backgroundColor: '#F3F4F6',
    color: '#000',
    padding: 16,
    borderRadius: 12,
    fontSize: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  button: {
    backgroundColor: '#000000',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 20,
  },
  buttonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 16,
  },
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 15,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#E5E7EB',
  },
  dividerText: {
    color: '#9CA3AF',
    paddingHorizontal: 10,
    fontSize: 14,
  },
  socialButtons: {
    marginTop: 10,
    gap: 12,
  },
  socialButton: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  socialButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: {
    marginRight: 10,
  },
  socialButtonText: {
    color: '#000000',
    fontWeight: '600',
    fontSize: 16,
  },
  signUpLinkContainer: {
    marginTop: 25,
    alignItems: 'center',
  },
  signUpText: {
    fontSize: 15,
    color: '#666666',
  },
  signUpSubLink: {
    color: '#000000',
    fontWeight: '700',
    textDecorationLine: 'underline',
  },
});