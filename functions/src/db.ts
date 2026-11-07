import { Pool, PoolClient } from "pg";

// One small pool per function instance. Tiger's 0.5 CPU tier allows a limited
// number of connections, and Cloud Functions may run several instances, so we
// keep each pool tiny instead of adding PgBouncer.
let pool: Pool | null = null;

export function getPool(connectionString: string): Pool {
  if (!pool) {
    pool = new Pool({
      connectionString,
      max: 3,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 10_000,
    });
  }
  return pool;
}

export async function withTransaction<T>(p: Pool, fn: (c: PoolClient) => Promise<T>): Promise<T> {
  const client = await p.connect();
  try {
    await client.query("begin");
    const result = await fn(client);
    await client.query("commit");
    return result;
  } catch (e) {
    await client.query("rollback").catch(() => {});
    throw e;
  } finally {
    client.release();
  }
}

// ── Shapes the app already expects (kept compatible with the old Firestore docs) ──

const TZ = "America/New_York";

function clock(d: Date): string {
  return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: TZ });
}

function durationLabel(start: Date, end: Date): string {
  const mins = Math.round((end.getTime() - start.getTime()) / 60000);
  if (mins <= 0) return "";
  const h = Math.floor(mins / 60), m = mins % 60;
  if (h === 0) return `${m}m`;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

export function initials(name: string): string {
  return (name || "?").split(" ").filter(Boolean).map(n => n[0]).join("").toUpperCase().slice(0, 2);
}

// Columns every session query selects, so toSession() can map any of them.
export const SESSION_COLUMNS = `
  s.id, s.host_id, coalesce(h.name, '') as host_name, s.title, s.description,
  s.court_type, s.court_name, s.address,
  st_y(s.location::geometry) as lat, st_x(s.location::geometry) as lng,
  s.price::float8 as price, s.skill_level, s.starts_at, s.ends_at,
  s.max_players, s.spots_filled, s.active, s.created_at,
  coalesce((select array_agg(a.user_id) from session_attendees a where a.session_id = s.id), '{}') as attendees`;

export function toSession(r: any) {
  const start = new Date(r.starts_at), end = new Date(r.ends_at);
  return {
    id: r.id,
    hostId: r.host_id,
    hostName: r.host_name,
    title: r.title,
    description: r.description,
    type: r.court_type,
    courtName: r.court_name,
    price: Number(r.price),
    skillLevel: r.skill_level,
    startTime: clock(start),
    endTime: clock(end),
    timeRange: `${clock(start)} – ${clock(end)}`,
    duration: durationLabel(start, end),
    maxPlayers: r.max_players,
    spotsFilled: r.spots_filled,
    attendees: r.attendees ?? [],
    coordinate: { latitude: Number(r.lat), longitude: Number(r.lng) },
    address: r.address,
    sessionDate: start.toISOString(),
    endsAt: end.toISOString(),
    active: r.active,
    createdAt: new Date(r.created_at).toISOString(),
    distanceKm: r.distance_km == null ? undefined : Math.round(Number(r.distance_km) * 10) / 10,
  };
}

export function toUser(r: any) {
  return {
    uid: r.id,
    name: r.name,
    email: r.email,
    photoURL: r.photo_url,
    positions: r.positions ?? [],
    skillLevel: r.skill_level,
    description: r.description,
    mediaItems: r.media_items ?? [],
    sessionsHosted: r.sessions_hosted,
    sessionsAttended: r.sessions_attended,
    createdAt: new Date(r.created_at).toISOString(),
  };
}

export const POST_COLUMNS = `
  p.id, p.type, p.author_id, coalesce(u.name, '') as author_name,
  coalesce(u.positions[1], u.skill_level, 'Player') as author_position,
  p.content, p.image_url, p.likes, p.comments, p.created_at, p.session_id,
  coalesce((select array_agg(l.user_id) from post_likes l where l.post_id = p.id), '{}') as liked_by,
  s.court_type as s_type, s.address as s_address, s.price::float8 as s_price,
  s.skill_level as s_skill, s.starts_at as s_start, s.ends_at as s_end`;

export const POST_FROM = `
  from posts p
  left join users u on u.id = p.author_id
  left join sessions s on s.id = p.session_id`;

export function toPost(r: any) {
  const post: any = {
    id: r.id,
    type: r.type,
    authorId: r.author_id,
    authorName: r.author_name,
    authorInitials: initials(r.author_name),
    authorPosition: r.author_position,
    content: r.content,
    imageUrl: r.image_url ?? undefined,
    likes: r.likes,
    likedBy: r.liked_by ?? [],
    comments: r.comments,
    createdAt: new Date(r.created_at).toISOString(),
  };
  if (r.session_id && r.s_start) {
    const start = new Date(r.s_start), end = new Date(r.s_end);
    Object.assign(post, {
      sessionId: r.session_id,
      sessionType: r.s_type,
      sessionLocation: r.s_address,
      sessionPrice: Number(r.s_price),
      sessionSkillLevel: r.s_skill,
      sessionDuration: durationLabel(start, end),
      sessionTimeRange: `${clock(start)} – ${clock(end)}`,
    });
  }
  return post;
}
