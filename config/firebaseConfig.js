import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";

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
console.log("Firebase App Initialized:", app.name); // Add this line
const auth = getAuth(app);
export { auth };
