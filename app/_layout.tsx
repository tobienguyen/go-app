import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth } from '../config/firebaseConfig'; // Ensure this path matches your file structure
import { ensureMyProfile } from "../services/users";
import 'react-native-reanimated';

import { useColorScheme } from 'react-native';

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const [user, setUser] = useState<User | null>(null);
  const [initializing, setInitializing] = useState(true);
  const segments = useSegments();
  const router = useRouter();

  // Track the signed-in user
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (initializing) setInitializing(false);
    });

    return unsubscribe;
  }, [initializing]);

  // Route users based on sign-in and verification state
  useEffect(() => {
    if (initializing) return;

    const inAuthGroup = (segments as any)[0] === 'auth';
    const onVerifyScreen  = (segments as any)[1] === 'verify-email';
    const onVerifyFirst   = (segments as any)[1] === 'verify-first';
    const onSignupDetails = (segments as any)[1] === 'signup-details';

    // Google/Apple users skip email verification; their provider already verified it.
    const isSocialUser = user?.providerData?.some(
      (p) => p.providerId !== 'password'
    ) ?? false;

    if (!user && !inAuthGroup) {
      router.replace('/auth' as any);
    } else if (user && !user.emailVerified && !onVerifyScreen && !onVerifyFirst && !onSignupDetails) {
      // Logged in but email not verified — hold at verify screen
      router.replace('/auth/verify-email' as any);
    } else if (user && (user.emailVerified || isSocialUser) && inAuthGroup && !onVerifyFirst && !onVerifyScreen) {
      // Fully set up and stuck on auth screens — let into the app
      router.replace('/(tabs)' as any);
    }
  }, [user, segments, initializing, router]);

  // Make sure every verified user is on GO!'s player list in Tiger
  // (covers logging in later, or verifying and then closing the app).
  useEffect(() => {
    if (!user) return;
    const isSocial = user.providerData?.some(p => p.providerId !== 'password') ?? false;
    if (user.emailVerified || isSocial) ensureMyProfile().catch(() => {});
  }, [user]);

  // Wait until Firebase reports the sign-in state
  if (initializing) return null;

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack>
        <Stack.Screen 
          name="(tabs)" 
          options={{ headerShown: false }} 
        />
        
        <Stack.Screen
          name="auth"
          options={{ headerShown: false }}
        />
        
        <Stack.Screen
          name="create-session"
          options={{ headerShown: false, presentation: 'modal' }}
        />

        <Stack.Screen
          name="session/[id]"
          options={{ headerShown: false }}
        />

        <Stack.Screen
          name="user/[id]"
          options={{ headerShown: false }}
        />

        <Stack.Screen
          name="modal"
          options={{ presentation: 'modal', title: 'Details' }}
        />
      </Stack>
      <StatusBar style="auto" />
    </ThemeProvider>
  );
}
