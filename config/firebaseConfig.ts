import { initializeApp, getApps, getApp } from "firebase/app";
import { initializeAuth, getAuth, getReactNativePersistence, Auth } from "firebase/auth";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getStorage } from "firebase/storage";
import { getFunctions } from "firebase/functions";

const firebaseConfig = {
  apiKey: "AIzaSyDV8OZYCVCmCjBiVOqvSPqm5YxpE89bvJ0",
  authDomain: "go-app-2743c.firebaseapp.com",
  projectId: "go-app-2743c",
  storageBucket: "go-app-2743c.firebasestorage.app",
  messagingSenderId: "760211922089",
  appId: "1:760211922089:web:cf88fd235a86e9322e5db8",
  measurementId: "G-7Y3XGCT244"
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
// Keep users signed in between app launches. initializeAuth can only run
// once per app instance, so fall back to getAuth on fast refresh.
let auth: Auth;
try {
  auth = initializeAuth(app, { persistence: getReactNativePersistence(AsyncStorage) });
} catch {
  auth = getAuth(app);
}
const storage = getStorage(app);
const functions = getFunctions(app);
// App data lives in Tiger Cloud (see functions/ and db/); Firebase handles
// sign-in (auth), photo/video files (storage), and hosts the API (functions).
export { auth, storage, functions };
