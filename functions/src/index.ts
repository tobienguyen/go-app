// GO! API: every app read/write goes through this one callable function.
//
// Firebase Auth verifies who is calling (request.auth); Tiger Cloud
// (PostgreSQL + TimescaleDB + PostGIS) stores and queries all app data.
// One function instead of many means one warm instance serves every screen.
//
// The old Twilio Verify functions are archived in archive/twilio-verify/.

import { onCall, HttpsError, CallableRequest } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import { Pool, PoolClient } from "pg";
import {
  getPool, withTransaction, SESSION_COLUMNS, toSession, toUser,
  POST_COLUMNS, POST_FROM, toPost,
} from "./db";
import { parseSearch, SearchFilters } from "./gemini";

const TIGER_DATABASE_URL = defineSecret("TIGER_DATABASE_URL");
const GEMINI_API_KEY = defineSecret("GEMINI_API_KEY");
const TZ = "America/New_York";

type Ctx = { db: Pool; uid: string; data: any };
type Handler = (ctx: Ctx) => Promise<any>;

// Helpers

function str(v: any, max = 500): string {
  return typeof v === "string" ? v.trim().slice(0, max) : "";
}

function num(v: any): number | undefined {
  const n = Number(v);
  return v === null || v === undefined || v === "" || Number.isNaN(n) ? undefined : n;
}

async function logEvent(c: PoolClient, sessionId: string, uid: string, type: string) {
  await c.query(
    `insert into session_events (session_id, user_id, event_type, court_name, court_type)
     select id, $2, $3, court_name, court_type from sessions where id = $1`,
    [sessionId, uid, type],
  );
}

async function getSessionById(db: Pool | PoolClient, id: string) {
  const { rows } = await db.query(
    `select ${SESSION_COLUMNS} from sessions s left join users h on h.id = s.host_id where s.id = $1`,
    [id],
  );
  return rows[0] ? toSession(rows[0]) : null;
}

/** Shared search used by the map and by Ask GO!. Uses PostGIS for distance. */
async function searchSessions(
  db: Pool,
  f: SearchFilters & { lat?: number; lng?: number; limit?: number },
) {
  const where = ["s.active", "s.ends_at > now()"];
  const params: any[] = [];
  const p = (v: any) => { params.push(v); return `$${params.length}`; };

  let distance = "null::float8";
  const order = "s.starts_at";
  if (f.lat !== undefined && f.lng !== undefined) {
    const point = `st_setsrid(st_makepoint(${p(f.lng)}, ${p(f.lat)}), 4326)::geography`;
    distance = `st_distance(s.location, ${point}) / 1000`;
    if (f.maxDistanceKm) where.push(`st_dwithin(s.location, ${point}, ${p(f.maxDistanceKm * 1000)})`);
  }
  if (f.courtType) where.push(`s.court_type = ${p(f.courtType)}`);
  if (f.day) where.push(`(s.starts_at at time zone '${TZ}')::date = ${p(f.day)}::date`);
  if (f.timeOfDay) {
    const [lo, hi] = { morning: [5, 11], afternoon: [12, 16], evening: [17, 23] }[f.timeOfDay];
    where.push(`extract(hour from s.starts_at at time zone '${TZ}') between ${lo} and ${hi}`);
  }
  if (f.maxPrice !== undefined) where.push(`s.price <= ${p(f.maxPrice)}`);
  if (f.skillLevel) where.push(`(s.skill_level ilike ${p("%" + f.skillLevel + "%")} or s.skill_level in ('All levels', 'Social'))`);
  if (f.openSpotsOnly) where.push("s.spots_filled < s.max_players");

  const { rows } = await db.query(
    `select ${SESSION_COLUMNS}, ${distance} as distance_km
     from sessions s left join users h on h.id = s.host_id
     where ${where.join(" and ")}
     order by ${order}
     limit ${Math.min(Math.max(f.limit ?? 200, 1), 500)}`,
    params,
  );
  return rows.map(toSession);
}

// Actions

const actions: Record<string, Handler> = {
  // Sessions
  async listSessions({ db, data }) {
    return searchSessions(db, {
      lat: num(data.lat), lng: num(data.lng),
      maxDistanceKm: num(data.radiusKm),
      courtType: ["beach", "grass", "indoor"].includes(data.courtType) ? data.courtType : undefined,
    });
  },

  async getSession({ db, data }) {
    return getSessionById(db, str(data.id, 64));
  },

  async createSession({ db, uid, data }) {
    const title = str(data.title, 120);
    const courtType = data.type;
    const lat = num(data.coordinate?.latitude), lng = num(data.coordinate?.longitude);
    const day = str(data.date, 10);                  // YYYY-MM-DD (local)
    const startTime = str(data.startTime, 10);       // "7:00 PM"
    const endTime = str(data.endTime, 10);
    const maxPlayers = Math.max(2, Math.min(num(data.maxPlayers) ?? 6, 50));
    if (!title || !["beach", "grass", "indoor"].includes(courtType) || lat === undefined || lng === undefined
        || !/^\d{4}-\d{2}-\d{2}$/.test(day) || !startTime || !endTime) {
      throw new HttpsError("invalid-argument", "Missing session details.");
    }
    const address = str(data.address, 200) || "Dropped pin";

    const id = await withTransaction(db, async c => {
      const { rows } = await c.query(
        `insert into sessions (host_id, title, description, court_type, court_name, address, location,
                               price, skill_level, starts_at, ends_at, max_players, spots_filled)
         values ($1, $2, $3, $4, $5, $5, st_setsrid(st_makepoint($6, $7), 4326)::geography,
                 $8, $9,
                 ($10::date + $11::time) at time zone '${TZ}',
                 ($10::date + $12::time) at time zone '${TZ}',
                 $13, 1)
         returning id`,
        [uid, title, str(data.description, 1000), courtType, address, lng, lat,
         Math.max(0, num(data.price) ?? 0), str(data.skillLevel, 40) || "All levels",
         day, startTime, endTime, maxPlayers],
      );
      const sessionId = rows[0].id;
      await c.query(`insert into session_attendees (session_id, user_id) values ($1, $2)`, [sessionId, uid]);
      await logEvent(c, sessionId, uid, "create");
      await logEvent(c, sessionId, uid, "join");
      await c.query(
        `insert into posts (author_id, type, content, session_id) values ($1, 'session', $2, $3)`,
        [uid, title, sessionId],
      );
      await c.query(
        `update users set sessions_hosted = sessions_hosted + 1, sessions_attended = sessions_attended + 1 where id = $1`,
        [uid],
      );
      return sessionId;
    });
    return getSessionById(db, id);
  },

  async joinSession({ db, uid, data }) {
    const id = str(data.id, 64);
    await withTransaction(db, async c => {
      // Lock the session row so two players can't take the last spot at once
      const { rows } = await c.query(
        `select (active and ends_at > now()) as open, spots_filled < max_players as has_room,
                exists (select 1 from session_attendees where session_id = $1 and user_id = $2) as already
         from sessions where id = $1 for update`,
        [id, uid],
      );
      if (!rows[0]) throw new HttpsError("not-found", "Game not found.");
      if (rows[0].already) return;
      if (!rows[0].open || !rows[0].has_room) {
        throw new HttpsError("failed-precondition", "This game is full or has ended.");
      }
      await c.query(`insert into session_attendees (session_id, user_id) values ($1, $2)`, [id, uid]);
      await c.query(`update sessions set spots_filled = spots_filled + 1 where id = $1`, [id]);
      await logEvent(c, id, uid, "join");
      await c.query(`update users set sessions_attended = sessions_attended + 1 where id = $1`, [uid]);
    });
    return getSessionById(db, id);
  },

  async leaveSession({ db, uid, data }) {
    const id = str(data.id, 64);
    await withTransaction(db, async c => {
      const removed = await c.query(
        `delete from session_attendees where session_id = $1 and user_id = $2`, [id, uid],
      );
      if (removed.rowCount === 0) return;
      await c.query(`update sessions set spots_filled = greatest(spots_filled - 1, 0) where id = $1`, [id]);
      await logEvent(c, id, uid, "leave");
      await c.query(`update users set sessions_attended = greatest(sessions_attended - 1, 0) where id = $1`, [uid]);
    });
    return getSessionById(db, id);
  },

  // Court Pulse: reads the TimescaleDB continuous aggregate
  async courtPulse({ db, data }) {
    const court = str(data.courtName, 200);
    if (!court) {
      const { rows } = await db.query(
        `select court_name, court_type, sum(joins + checkins)::int as activity
         from court_activity_hourly
         where bucket > now() - interval '7 days'
         group by 1, 2 order by activity desc limit 5`,
      );
      return { topCourts: rows.map(r => ({ courtName: r.court_name, courtType: r.court_type, activity: r.activity })) };
    }
    const [byHour, byDay, trend] = await Promise.all([
      db.query(
        `select hour, sum(activity)::int as activity from court_best_times
         where court_name = $1 group by hour order by hour`, [court]),
      db.query(
        `select day_of_week, sum(activity)::int as activity from court_best_times
         where court_name = $1 group by day_of_week order by day_of_week`, [court]),
      db.query(
        `select
           coalesce(sum(joins + checkins) filter (where bucket > now() - interval '7 days'), 0)::int as this_week,
           coalesce(sum(joins + checkins) filter (where bucket <= now() - interval '7 days'), 0)::int as last_week
         from court_activity_hourly
         where court_name = $1 and bucket > now() - interval '14 days'`, [court]),
    ]);
    return {
      courtName: court,
      byHour: byHour.rows.map(r => ({ hour: r.hour, activity: r.activity })),
      byDay: byDay.rows.map(r => ({ dayOfWeek: r.day_of_week, activity: r.activity })),
      thisWeek: trend.rows[0]?.this_week ?? 0,
      lastWeek: trend.rows[0]?.last_week ?? 0,
    };
  },

  // Weekly leaderboard: reads the player_activity_weekly continuous aggregate
  async leaderboard({ db }) {
    const { rows } = await db.query(
      `select p.user_id, u.name, u.positions[1] as position, u.photo_url,
              sum(p.games_played)::int as games_played,
              sum(p.games_hosted)::int as games_hosted
       from player_activity_weekly p
       join users u on u.id = p.user_id
       where p.week = time_bucket('1 week', now())
       group by 1, 2, 3, 4
       having sum(p.games_played) > 0 or sum(p.games_hosted) > 0
       order by games_played desc, games_hosted desc, u.name
       limit 25`,
    );
    return rows.map((r, i) => ({
      rank: i + 1, uid: r.user_id, name: r.name, position: r.position ?? "Player",
      photoURL: r.photo_url, gamesPlayed: r.games_played, gamesHosted: r.games_hosted,
    }));
  },

  // Ask GO!: Gemini parses the request, Tiger runs the search
  async askGo({ db, data }) {
    const query = str(data.query, 300);
    if (!query) throw new HttpsError("invalid-argument", "Type what kind of game you're looking for.");
    let parsed;
    try {
      parsed = await parseSearch(query, GEMINI_API_KEY.value());
    } catch (e) {
      console.error("Gemini parse failed", e);
      throw new HttpsError("unavailable", "Search assistant is unavailable right now. Try the filters instead.");
    }
    const sessions = await searchSessions(db, { ...parsed.filters, lat: num(data.lat), lng: num(data.lng) });
    return { reply: parsed.reply, filters: parsed.filters, sessions };
  },

  // Users
  async getUser({ db, data }) {
    const { rows } = await db.query(`select * from users where id = $1`, [str(data.uid, 128)]);
    return rows[0] ? toUser(rows[0]) : null;
  },

  async createUser({ db, uid, data }) {
    const { rows } = await db.query(
      `insert into users (id, name, email, photo_url, skill_level)
       values ($1, $2, $3, $4, coalesce(nullif($5, ''), 'Beginner'))
       on conflict (id) do update set
         name = case when users.name = '' then excluded.name else users.name end,
         email = excluded.email
       returning *`,
      [uid, str(data.name, 100), str(data.email, 200), str(data.photoURL, 1000), str(data.skillLevel, 40)],
    );
    return toUser(rows[0]);
  },

  async updateUser({ db, uid, data }) {
    const fields: Record<string, [string, (v: any) => any]> = {
      name:        ["name",        v => str(v, 100)],
      photoURL:    ["photo_url",   v => str(v, 1000)],
      positions:   ["positions",   v => (Array.isArray(v) ? v.map(x => str(x, 40)).slice(0, 6) : [])],
      skillLevel:  ["skill_level", v => str(v, 40)],
      description: ["description", v => str(v, 1000)],
      mediaItems:  ["media_items", v => JSON.stringify(Array.isArray(v) ? v.slice(0, 12) : [])],
    };
    const sets: string[] = [];
    const params: any[] = [uid];
    for (const [key, [col, clean]] of Object.entries(fields)) {
      if (data[key] !== undefined) {
        params.push(clean(data[key]));
        sets.push(`${col} = $${params.length}`);
      }
    }
    if (sets.length === 0) return null;
    const { rows } = await db.query(`update users set ${sets.join(", ")} where id = $1 returning *`, params);
    return rows[0] ? toUser(rows[0]) : null;
  },

  // Follows (friend requests)
  async followRequest({ db, uid, data }) {
    const toUid = str(data.toUid, 128);
    if (!toUid || toUid === uid) throw new HttpsError("invalid-argument", "Can't follow that user.");
    await db.query(
      `insert into follows (from_uid, to_uid) values ($1, $2) on conflict do nothing`, [uid, toUid],
    );
    return { status: "pending" };
  },

  async acceptFollow({ db, uid, data }) {
    // Only the person who received the request can accept it
    await db.query(
      `update follows set status = 'accepted' where from_uid = $1 and to_uid = $2`,
      [str(data.fromUid, 128), uid],
    );
    return { status: "accepted" };
  },

  async removeFollow({ db, uid, data }) {
    const fromUid = str(data.fromUid, 128), toUid = str(data.toUid, 128);
    if (uid !== fromUid && uid !== toUid) throw new HttpsError("permission-denied", "Not your follow.");
    await db.query(`delete from follows where from_uid = $1 and to_uid = $2`, [fromUid, toUid]);
    return { status: "none" };
  },

  async followStatus({ db, uid, data }) {
    const { rows } = await db.query(
      `select status from follows where from_uid = $1 and to_uid = $2`, [uid, str(data.toUid, 128)],
    );
    return { status: rows[0]?.status ?? "none" };
  },

  async pendingFollows({ db, uid }) {
    const { rows } = await db.query(
      `select f.from_uid, f.to_uid, f.status, f.created_at, coalesce(u.name, '') as from_name
       from follows f left join users u on u.id = f.from_uid
       where f.to_uid = $1 and f.status = 'pending'
       order by f.created_at desc`,
      [uid],
    );
    return rows.map(r => ({
      id: `${r.from_uid}|${r.to_uid}`, fromUid: r.from_uid, toUid: r.to_uid,
      status: r.status, fromName: r.from_name, createdAt: new Date(r.created_at).toISOString(),
    }));
  },

  async followCounts({ db, data }) {
    const { rows } = await db.query(
      `select
         count(*) filter (where to_uid = $1)::int   as followers,
         count(*) filter (where from_uid = $1)::int as following
       from follows where status = 'accepted' and (to_uid = $1 or from_uid = $1)`,
      [str(data.uid, 128)],
    );
    return { followers: rows[0]?.followers ?? 0, following: rows[0]?.following ?? 0 };
  },

  // Feed
  async feed({ db, data }) {
    const limit = Math.min(Math.max(num(data.limit) ?? 50, 1), 100);
    const { rows } = await db.query(
      `select ${POST_COLUMNS} ${POST_FROM} order by p.created_at desc limit $1`, [limit],
    );
    return rows.map(toPost);
  },

  async userPosts({ db, data }) {
    const limit = Math.min(Math.max(num(data.limit) ?? 5, 1), 50);
    const { rows } = await db.query(
      `select ${POST_COLUMNS} ${POST_FROM} where p.author_id = $1 order by p.created_at desc limit $2`,
      [str(data.uid, 128), limit],
    );
    return rows.map(toPost);
  },

  async createPost({ db, uid, data }) {
    const content = str(data.content, 2000);
    const imageUrl = str(data.imageUrl, 1000) || null;
    if (!content && !imageUrl) throw new HttpsError("invalid-argument", "Post is empty.");
    const { rows } = await db.query(
      `insert into posts (author_id, type, content, image_url) values ($1, 'text', $2, $3) returning id`,
      [uid, content, imageUrl],
    );
    return { id: rows[0].id };
  },

  async toggleLike({ db, uid, data }) {
    const postId = str(data.postId, 64);
    return withTransaction(db, async c => {
      const removed = await c.query(`delete from post_likes where post_id = $1 and user_id = $2`, [postId, uid]);
      const liked = removed.rowCount === 0;
      if (liked) await c.query(`insert into post_likes (post_id, user_id) values ($1, $2)`, [postId, uid]);
      const { rows } = await c.query(
        `update posts set likes = greatest(likes + $2, 0) where id = $1 returning likes`,
        [postId, liked ? 1 : -1],
      );
      return { liked, likes: rows[0]?.likes ?? 0 };
    });
  },
};

// Entry point

export const api = onCall(
  {
    secrets: [TIGER_DATABASE_URL, GEMINI_API_KEY],
    timeoutSeconds: 30,
    memory: "256MiB",
    // Set minInstances to 1 before judging to avoid cold starts (small cost).
  },
  async (request: CallableRequest<any>) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Please sign in.");
    const action = String(request.data?.action ?? "");
    const handler = actions[action];
    if (!handler) throw new HttpsError("invalid-argument", `Unknown action: ${action}`);

    const started = Date.now();
    try {
      const db = getPool(TIGER_DATABASE_URL.value());
      return await handler({ db, uid: request.auth.uid, data: request.data ?? {} });
    } catch (e: any) {
      if (e instanceof HttpsError) throw e;
      console.error(`api.${action} failed`, e);
      throw new HttpsError("internal", "Something went wrong. Try again.");
    } finally {
      console.log(`api.${action} ${Date.now() - started}ms`);
    }
  },
);
