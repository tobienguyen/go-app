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

  // 2. Navigation Guard (Instant redirect based on login status)
  useEffect(() => {
  // 1. Wait until Firebase has finished checking the user's session
  if (initializing) return;

  // 2. Figure out where the user currently is
  const inAuthGroup = (segments as any)[0] === 'auth';

  // 3. LOGIC GATE: The "Kick Out" or "Let In"
  if (!user && !inAuthGroup) {
    // If not logged in and trying to see app content -> Kick to Gatekeeper
    router.replace('/auth' as any);
  } else if (user && inAuthGroup) {
    // If logged in and stuck on login screens -> Let into the App
    router.replace('/(tabs)' as any);
  }

  // THIS PART WAS MISSING:
}, [user, segments, initializing]);

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
