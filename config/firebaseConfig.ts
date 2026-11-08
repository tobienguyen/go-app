import { initializeApp, getApps, getApp } from "firebase/app";
import { initializeAuth, getAuth, getReactNativePersistence } from "firebase/auth";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getFirestore } from "firebase/firestore";
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
const auth = getApps().length === 1
  ? initializeAuth(app, { persistence: getReactNativePersistence(AsyncStorage) })
  : getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);
const functions = getFunctions(app);
export { auth, db, storage, functions };
