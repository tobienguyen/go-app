-- ============================================================================
-- GO! database schema for Tiger Data (Tiger Cloud: PostgreSQL + TimescaleDB)
--
-- Run this whole file once in the Tiger Cloud SQL editor, then run seed.sql.
-- Safe to re-run: it drops and recreates everything (all data is lost).
-- ============================================================================

create extension if not exists timescaledb;
create extension if not exists postgis;   -- location queries ("games near me")

drop view if exists court_best_times;
drop materialized view if exists player_activity_weekly cascade;
drop materialized view if exists court_activity_hourly cascade;
drop table if exists follows, post_likes, posts, session_events, session_attendees, sessions, users cascade;

-- ── Users ───────────────────────────────────────────────────────────────────
-- id is the Firebase Auth uid (Firebase still handles login).
create table users (
  id                 text primary key,
  name               text not null default '',
  email              text not null default '',
  photo_url          text not null default '',
  positions          text[] not null default '{}',
  skill_level        text not null default 'Beginner',
  description        text not null default '',
  media_items        jsonb not null default '[]',  -- [{uri, landscape}], files stay in Firebase Storage
  sessions_hosted    int not null default 0,
  sessions_attended  int not null default 0,
  created_at         timestamptz not null default now()
);

-- ── Sessions (the pins on the map) ─────────────────────────────────────────
create table sessions (
  id            uuid primary key default gen_random_uuid(),
  host_id       text not null references users(id) on delete cascade,
  title         text not null,
  description   text not null default '',
  court_type    text not null check (court_type in ('beach', 'grass', 'indoor')),
  court_name    text not null,              -- groups sessions at the same court for Court Pulse
  address       text not null default '',
  location      geography(point, 4326) not null,
  price         numeric(6,2) not null default 0,
  skill_level   text not null default 'All levels',
  starts_at     timestamptz not null,
  ends_at       timestamptz not null,
  max_players   int not null check (max_players > 0),
  spots_filled  int not null default 0,
  active        boolean not null default true,
  created_at    timestamptz not null default now()
);
create index sessions_location_idx on sessions using gist (location);
create index sessions_upcoming_idx on sessions (starts_at) where active;

create table session_attendees (
  session_id  uuid not null references sessions(id) on delete cascade,
  user_id     text not null references users(id) on delete cascade,
  joined_at   timestamptz not null default now(),
  primary key (session_id, user_id)
);
create index session_attendees_user_idx on session_attendees (user_id);

-- ── Activity log: a TimescaleDB hypertable ─────────────────────────────────
-- Every create / join / leave / check-in is appended here. court_name and
-- court_type are copied in so analytics never need a join.
create table session_events (
  time        timestamptz not null default now(),
  session_id  uuid not null references sessions(id) on delete cascade,
  user_id     text not null references users(id) on delete cascade,
  event_type  text not null check (event_type in ('create', 'join', 'leave', 'checkin')),
  court_name  text not null,
  court_type  text not null
);
select create_hypertable('session_events', by_range('time', interval '7 days'));
create index session_events_court_idx on session_events (court_name, time desc);
create index session_events_user_idx  on session_events (user_id, time desc);

-- ── Social feed ─────────────────────────────────────────────────────────────
create table posts (
  id          uuid primary key default gen_random_uuid(),
  author_id   text not null references users(id) on delete cascade,
  type        text not null default 'text' check (type in ('text', 'session')),
  content     text not null default '',
  image_url   text,
  session_id  uuid references sessions(id) on delete set null,
  likes       int not null default 0,
  comments    int not null default 0,
  created_at  timestamptz not null default now()
);
create index posts_feed_idx   on posts (created_at desc);
create index posts_author_idx on posts (author_id, created_at desc);

create table post_likes (
  post_id  uuid not null references posts(id) on delete cascade,
  user_id  text not null references users(id) on delete cascade,
  primary key (post_id, user_id)
);

-- ── Follows / friend requests ──────────────────────────────────────────────
create table follows (
  from_uid    text not null references users(id) on delete cascade,
  to_uid      text not null references users(id) on delete cascade,
  status      text not null default 'pending' check (status in ('pending', 'accepted')),
  created_at  timestamptz not null default now(),
  primary key (from_uid, to_uid),
  check (from_uid <> to_uid)
);
create index follows_to_idx on follows (to_uid, status);

-- ── Court Pulse: continuous aggregate (auto-updating hourly rollup) ─────────
-- materialized_only = false makes it real-time: queries combine the stored
-- rollup with events that arrived since the last refresh.
create materialized view court_activity_hourly
with (timescaledb.continuous, timescaledb.materialized_only = false) as
select
  time_bucket('1 hour', time) as bucket,
  court_name,
  court_type,
  count(*) filter (where event_type = 'join')    as joins,
  count(*) filter (where event_type = 'checkin') as checkins,
  count(*) filter (where event_type = 'create')  as games_created
from session_events
group by bucket, court_name, court_type
with no data;

select add_continuous_aggregate_policy('court_activity_hourly',
  start_offset      => interval '30 days',
  end_offset        => interval '1 hour',
  schedule_interval => interval '15 minutes');

-- "Best time to play": activity by weekday and hour, last 4 weeks, local time.
create view court_best_times as
select
  court_name,
  court_type,
  extract(isodow from bucket at time zone 'America/New_York')::int as day_of_week,  -- 1 = Mon
  extract(hour   from bucket at time zone 'America/New_York')::int as hour,
  sum(joins + checkins)::int as activity
from court_activity_hourly
where bucket > now() - interval '28 days'
group by 1, 2, 3, 4;

-- ── Leaderboard: weekly player activity (continuous aggregate) ─────────────
create materialized view player_activity_weekly
with (timescaledb.continuous, timescaledb.materialized_only = false) as
select
  time_bucket('1 week', time) as week,
  user_id,
  count(*) filter (where event_type = 'checkin') as games_played,
  count(*) filter (where event_type = 'create')  as games_hosted,
  count(*) filter (where event_type = 'join')    as games_joined
from session_events
group by week, user_id
with no data;

select add_continuous_aggregate_policy('player_activity_weekly',
  start_offset      => interval '90 days',
  end_offset        => interval '1 hour',
  schedule_interval => interval '30 minutes');
