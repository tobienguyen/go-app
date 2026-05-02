import { GoogleAuthProvider, OAuthProvider, signInWithCredential } from "firebase/auth";
import * as AppleAuthentication from "expo-apple-authentication";
import * as Crypto from "expo-crypto";
import { auth } from "../config/firebaseConfig";
import { getUser, createUser } from "../services/users";

export async function handleGoogleSignIn(accessToken: string): Promise<void> {
  const credential = GoogleAuthProvider.credential(null, accessToken);
  const { user } = await signInWithCredential(auth, credential);
  await ensureProfile(user.uid, user.displayName ?? "Player", user.email ?? "", user.photoURL ?? "");
}

export async function handleAppleSignIn(): Promise<void> {
  const rawNonce = Math.random().toString(36).substring(2, 34);
  const hashedNonce = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    rawNonce,
  );

  const appleCred = await AppleAuthentication.signInAsync({
    requestedScopes: [
      AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
      AppleAuthentication.AppleAuthenticationScope.EMAIL,
    ],
    nonce: hashedNonce,
  });

  if (!appleCred.identityToken) throw new Error("No identity token from Apple.");

  const provider = new OAuthProvider("apple.com");
  const firebaseCred = provider.credential({ idToken: appleCred.identityToken, rawNonce });
  const { user } = await signInWithCredential(auth, firebaseCred);

  const fullName =
    [appleCred.fullName?.givenName, appleCred.fullName?.familyName]
      .filter(Boolean).join(" ") ||
    user.displayName ||
    "Player";

  await ensureProfile(user.uid, fullName, user.email ?? "", user.photoURL ?? "");
}

async function ensureProfile(
  uid: string, name: string, email: string, photoURL: string,
): Promise<void> {
  const existing = await getUser(uid);
  if (!existing) {
    await createUser(uid, { name, email, photoURL });
  }
}
