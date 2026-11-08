# Archived: Twilio Verify email codes

Shelved during the hackathon (Nov 2026). Signup now uses Firebase's built-in
email verification link (`app/auth/verify-first.tsx`).

- `functions-index.ts` — the `sendCode` / `verifyCode` Cloud Functions.
- `verify-first-code-entry.tsx` — the old 6-digit code entry screen.

To restore: move `functions-index.ts` back to `functions/src/index.ts`, re-add
`twilio` to `functions/package.json`, set the TWILIO_ACCOUNT_SID /
TWILIO_AUTH_TOKEN / TWILIO_VERIFY_SID secrets, and connect a SendGrid email
integration to the Verify service in the Twilio console (Verify's email channel
does not work without it). A likely better use later: SMS phone verification.
