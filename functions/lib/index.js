"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifyCode = exports.sendCode = void 0;
const functions = __importStar(require("firebase-functions/v2"));
const admin = __importStar(require("firebase-admin"));
const params_1 = require("firebase-functions/params");
const twilio_1 = __importDefault(require("twilio"));
admin.initializeApp();
// Secrets — set these once with:
//   firebase functions:secrets:set TWILIO_ACCOUNT_SID
//   firebase functions:secrets:set TWILIO_AUTH_TOKEN
//   firebase functions:secrets:set TWILIO_VERIFY_SID
const TWILIO_ACCOUNT_SID = (0, params_1.defineSecret)("TWILIO_ACCOUNT_SID");
const TWILIO_AUTH_TOKEN = (0, params_1.defineSecret)("TWILIO_AUTH_TOKEN");
const TWILIO_VERIFY_SID = (0, params_1.defineSecret)("TWILIO_VERIFY_SID");
/**
 * sendCode — sends a 6-digit verification code to the user's email via Twilio Verify.
 * Must be called by an authenticated user (the temp account created in verify-first).
 */
exports.sendCode = functions.https.onCall({ secrets: [TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_VERIFY_SID] }, async (request) => {
    var _a;
    if (!request.auth) {
        throw new functions.https.HttpsError("unauthenticated", "Must be signed in.");
    }
    const email = (_a = request.data) === null || _a === void 0 ? void 0 : _a.email;
    if (!email || !email.includes("@")) {
        throw new functions.https.HttpsError("invalid-argument", "Valid email required.");
    }
    const client = (0, twilio_1.default)(TWILIO_ACCOUNT_SID.value(), TWILIO_AUTH_TOKEN.value());
    try {
        await client.verify.v2
            .services(TWILIO_VERIFY_SID.value())
            .verifications.create({ to: email, channel: "email" });
        return { success: true };
    }
    catch (err) {
        console.error("Twilio sendCode error:", err);
        throw new functions.https.HttpsError("internal", "Could not send verification code.");
    }
});
/**
 * verifyCode — checks the code the user entered against Twilio Verify.
 * If approved, marks the Firebase user's emailVerified = true via Admin SDK.
 */
exports.verifyCode = functions.https.onCall({ secrets: [TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_VERIFY_SID] }, async (request) => {
    if (!request.auth) {
        throw new functions.https.HttpsError("unauthenticated", "Must be signed in.");
    }
    const { email, code } = request.data;
    if (!email || !code) {
        throw new functions.https.HttpsError("invalid-argument", "Email and code required.");
    }
    const client = (0, twilio_1.default)(TWILIO_ACCOUNT_SID.value(), TWILIO_AUTH_TOKEN.value());
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
    }
    catch (err) {
        if (err instanceof functions.https.HttpsError)
            throw err;
        console.error("Twilio verifyCode error:", err);
        throw new functions.https.HttpsError("internal", "Could not verify code.");
    }
});
//# sourceMappingURL=index.js.map