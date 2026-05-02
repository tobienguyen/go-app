import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth } from '../config/firebaseConfig'; // Ensure this path matches your file structure
import 'react-native-reanimated';

import { useColorScheme } from 'react-native';

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const [user, setUser] = useState<User | null>(null);
  const [initializing, setInitializing] = useState(true);
  const segments = useSegments();
  const router = useRouter();

  // 1. Listen for Auth State Changes (Keeps user signed in)
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (initializing) setInitializing(false);
    });

    return unsubscribe;
  }, [initializing]);

  // 2. Navigation Guard
  useEffect(() => {
    if (initializing) return;

    const inAuthGroup = (segments as any)[0] === 'auth';
    const onVerifyScreen = (segments as any)[1] === 'verify-email';
    const onVerifyFirst = (segments as any)[1] === 'verify-first';
    const onSignupDetails = (segments as any)[1] === 'signup-details';

    // Social sign-in users (Google/Apple) don't go through signup-details —
    // they already have a verified email and their profile is created automatically.
    const isSocialUser = user?.providerData?.some(
      (p) => p.providerId !== 'password'
    ) ?? false;

    if (!user && !inAuthGroup) {
      // Not logged in — send to gatekeeper
      router.replace('/auth' as any);
    } else if (user && !user.emailVerified && !onVerifyScreen && !onVerifyFirst) {
      // Logged in but email not verified — hold at verify screen
      router.replace('/auth/verify-email' as any);
    } else if (
      user && user.emailVerified && !user.displayName &&
      !isSocialUser && !onSignupDetails
    ) {
      // Email user verified but hasn't set up profile yet
      router.replace('/auth/signup-details' as any);
    } else if (
      user && user.emailVerified &&
      (user.displayName || isSocialUser) &&
      inAuthGroup
    ) {
      // Fully set up and stuck on auth screens — let into the app
      router.replace('/(tabs)' as any);
    }
  }, [user, segments, initializing, router]);

  // Show nothing (or a splash screen) while checking the login status
  if (initializing) return null;

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack>
        {/* The Tab system (Home, Map, etc.) */}
        <Stack.Screen 
          name="(tabs)" 
          options={{ headerShown: false }} 
        />
        
        {/* The Auth system (Login, Sign-up) */}
        <Stack.Screen
          name="auth"
          options={{ headerShown: false }}
        />
        
        {/* Session creation screen */}
        <Stack.Screen
          name="create-session"
          options={{ headerShown: false, presentation: 'modal' }}
        />

        {/* Session detail screen */}
        <Stack.Screen
          name="session/[id]"
          options={{ headerShown: false }}
        />

        {/* Modals and other standalone screens */}
        <Stack.Screen
          name="modal"
          options={{ presentation: 'modal', title: 'Details' }}
        />
      </Stack>
      <StatusBar style="auto" />
    </ThemeProvider>
  );
}
