# GO! 🏐

Find and host pickup volleyball games (indoor, grass, and beach) on a live map.

## How it's built

```
Expo app (React Native)
   │  Firebase Auth token
   ▼
Cloud Function `api`  ──►  Gemini (Ask GO! search parsing)
   │  SQL
   ▼
Tiger Cloud: PostgreSQL + TimescaleDB + PostGIS
```

- **Tiger Cloud** stores all app data: players, games, attendees, posts, and the activity log.
  - `session_events` is a **TimescaleDB hypertable**: every create, join, leave, and check-in.
  - **Continuous aggregates** (real-time mode) roll that log up into **Court Pulse**
    (busiest hours and days per court) and the **weekly leaderboard**.
  - **PostGIS** powers "games near me" distance search.
- **Gemini** turns plain-English requests ("free beach games tonight") into search filters; Tiger runs the search.
- **Firebase** handles sign-in, photo/video storage, and hosts the API.

## Setup

1. **Database:** in the Tiger Cloud SQL editor, run `db/schema.sql`, then `db/seed.sql`
   (demo data: 10 Buffalo-area courts, 24 players, 4 weeks of activity, relative to now).
2. **Secrets:** `firebase functions:secrets:set TIGER_DATABASE_URL` and `firebase functions:secrets:set GEMINI_API_KEY`
3. **API:** `cd functions && npm install && cd .. && firebase deploy --only functions` (requires the Blaze plan)
4. **App:** `npm install && npx expo start`

Re-run `db/seed.sql` any time for fresh upcoming games.
