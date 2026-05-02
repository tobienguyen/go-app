import * as functions from "firebase-functions/v2";
import * as admin from "firebase-admin";
import { defineSecret } from "firebase-functions/params";
import twilio from "twilio";

admin.initializeApp();

// Secrets — set these once with:
//   firebase functions:secrets:set TWILIO_ACCOUNT_SID
//   firebase functions:secrets:set TWILIO_AUTH_TOKEN
//   firebase functions:secrets:set TWILIO_VERIFY_SID
const TWILIO_ACCOUNT_SID = defineSecret("TWILIO_ACCOUNT_SID");
const TWILIO_AUTH_TOKEN  = defineSecret("TWILIO_AUTH_TOKEN");
const TWILIO_VERIFY_SID  = defineSecret("TWILIO_VERIFY_SID");

/**
 * sendCode — sends a 6-digit verification code to the user's email via Twilio Verify.
 * Must be called by an authenticated user (the temp account created in verify-first).
 */
export const sendCode = functions.https.onCall(
  { secrets: [TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_VERIFY_SID] },
  async (request) => {
    if (!request.auth) {
      throw new functions.https.HttpsError("unauthenticated", "Must be signed in.");
    }

    const email = request.data?.email as string | undefined;
    if (!email || !email.includes("@")) {
      throw new functions.https.HttpsError("invalid-argument", "Valid email required.");
    }

    const client = twilio(TWILIO_ACCOUNT_SID.value(), TWILIO_AUTH_TOKEN.value());

    try {
      await client.verify.v2
        .services(TWILIO_VERIFY_SID.value())
        .verifications.create({ to: email, channel: "email" });

      return { success: true };
    } catch (err: any) {
      console.error("Twilio sendCode error:", err);
      throw new functions.https.HttpsError("internal", "Could not send verification code.");
    }
  }
);

/**
 * verifyCode — checks the code the user entered against Twilio Verify.
 * If approved, marks the Firebase user's emailVerified = true via Admin SDK.
 */
export const verifyCode = functions.https.onCall(
  { secrets: [TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_VERIFY_SID] },
  async (request) => {
    if (!request.auth) {
      throw new functions.https.HttpsError("unauthenticated", "Must be signed in.");
    }

    const { email, code } = request.data as { email: string; code: string };
    if (!email || !code) {
      throw new functions.https.HttpsError("invalid-argument", "Email and code required.");
    }

    const client = twilio(TWILIO_ACCOUNT_SID.value(), TWILIO_AUTH_TOKEN.value());

    try {
      const check = await client.verify.v2
        .services(TWILIO_VERIFY_SID.value())
        .verificationChecks.create({ to: email, code });

      if (check.status !== "approved") {
        throw new functions.https.HttpsError("invalid-argument", "Incorrect code.");
      }

      // Mark the Firebase user as verified
      await admin.auth().updateUser(request.auth.uid, { emailVerified: true });

      return { success: true };
    } catch (err: any) {
      if (err instanceof functions.https.HttpsError) throw err;
      console.error("Twilio verifyCode error:", err);
      throw new functions.https.HttpsError("internal", "Could not verify code.");
    }
  }
);
