-- ============================================================================
-- GO! demo data: 24 players, 10 Buffalo-area courts, ~4 weeks of past games,
-- ~50 upcoming games over the next 3 days, and the activity history behind Court Pulse.
--
-- Run after schema.sql. Everything is relative to now(), so re-running this
-- file later always produces fresh upcoming games. Demo users have ids that
-- start with 'demo_' so they never collide with real Firebase accounts.
-- ============================================================================

delete from post_likes;
delete from posts         where author_id like 'demo_%';
delete from session_events where user_id like 'demo_%';
delete from sessions      where host_id like 'demo_%';
delete from users         where id like 'demo_%';

select setseed(0.42);  -- same "random" data every run

-- ── Players ─────────────────────────────────────────────────────────────────
insert into users (id, name, email, positions, skill_level, description, created_at)
select
  'demo_' || lpad(i::text, 2, '0'),
  n.name,
  'demo' || i || '@go-demo.app',
  array[(array['Outside Hitter','Setter','Middle Blocker','Libero','Opposite','Defensive Specialist'])[1 + (i % 6)]],
  (array['Social','Beginner','Intermediate','Mid-Intermediate','Advanced','Pro'])[1 + (i * 7 % 6)],
  (array['Down for any pickup game','Beach season never ends','Looking for a regular Sunday crew',
         'Former club player, still got it','Learning to set, be patient with me','Will travel for a good run'])[1 + (i % 6)],
  now() - interval '60 days'
from (select row_number() over () as i, name from unnest(array[
  'Maya Chen','Jordan Reyes','Priya Patel','Liam O''Brien','Sofia Martinez','Ethan Brooks',
  'Aaliyah Johnson','Noah Kim','Grace Okafor','Lucas Silva','Hannah Weiss','Marcus Lee',
  'Zoe Ramirez','Owen Murphy','Isabella Rossi','Tyler Nguyen','Chloe Adams','Andre Thompson',
  'Nina Kowalski','Sam Fitzgerald','Leah Goldberg','Kai Tanaka','Ava Robinson','Diego Herrera'
]) as name) n;

-- ── Courts (weight = how popular; drives the Court Pulse patterns) ─────────
create temp table demo_courts (court_name text, court_type text, address text, lat float8, lng float8, weight float8);
insert into demo_courts values
  ('UB Alumni Arena',            'indoor', 'Alumni Arena, University at Buffalo, Amherst, NY',  43.0010, -78.7810, 3.0),
  ('UB Clark Hall Gym',          'indoor', 'Clark Hall, UB South Campus, Buffalo, NY',          42.9540, -78.8190, 2.0),
  ('Buffalo State Sports Arena', 'indoor', 'SUNY Buffalo State, Buffalo, NY',                   42.9330, -78.8770, 1.2),
  ('Delaware Park Meadow',       'grass',  'Delaware Park, Buffalo, NY',                        42.9365, -78.8640, 2.5),
  ('Amherst State Park',         'grass',  'Amherst State Park, Amherst, NY',                   42.9790, -78.7690, 1.0),
  ('Ellicott Creek Park',        'grass',  'Ellicott Creek Park, Tonawanda, NY',                43.0240, -78.8330, 1.5),
  ('Canalside Sand Courts',      'beach',  'Canalside, Buffalo, NY',                            42.8770, -78.8780, 2.2),
  ('Woodlawn Beach',             'beach',  'Woodlawn Beach State Park, Blasdell, NY',           42.7915, -78.8540, 1.8),
  ('Bennett Beach',              'beach',  'Bennett Beach, Angola, NY',                         42.6600, -79.0500, 0.8),
  ('Chestnut Ridge Park',        'grass',  'Chestnut Ridge Park, Orchard Park, NY',             42.7130, -78.7540, 0.7);

-- ── Games + activity history ───────────────────────────────────────────────
do $$
declare
  d          date;
  is_weekend boolean;
  n_games    int;
  c          record;
  start_ts   timestamptz;
  created_ts timestamptz;
  max_p      int;
  filled     int;
  host       text;
  sid        uuid;
  u          record;
  joined_ts  timestamptz;
  upcoming   boolean;
begin
  for d in select generate_series(current_date - 28, current_date + 3, interval '1 day')::date loop
    is_weekend := extract(isodow from d) >= 6;
    n_games := case when is_weekend then 6 + floor(random() * 4)::int else 3 + floor(random() * 3)::int end;
    -- busier upcoming days so the demo map is full of pins
    if d >= current_date then n_games := n_games + 16; end if;

    for g in 1..n_games loop
      -- weighted random court: popular courts get more games
      select * into c from demo_courts order by -ln(random()) / weight limit 1;

      -- weekends: daytime games; weekdays: after-work/after-class games
      start_ts := (d + make_time(
                    case when is_weekend then 10 + floor(random() * 10)::int
                         else 17 + floor(random() * 4)::int end,
                    (array[0, 30])[1 + floor(random() * 2)::int], 0)
                  ) at time zone 'America/New_York';

      -- skip slots more than 3 days out, or ones starting in the next 30 minutes
      continue when start_ts > now() + interval '3 days';
      continue when start_ts between now() and now() + interval '30 minutes';

      upcoming   := start_ts > now();
      max_p      := (array[6, 8, 12, 12, 16])[1 + floor(random() * 5)::int];
      filled     := case when upcoming then 1 + floor(random() * max_p * 0.75)::int
                         else greatest(2, floor(max_p * least(1.0, 0.35 + random() * 0.4 + c.weight * 0.1))::int) end;
      created_ts := least(start_ts - interval '1 hour' * (6 + random() * 60), now() - interval '5 minutes');

      select id into host from users where id like 'demo_%' order by random() limit 1;

      insert into sessions (host_id, title, description, court_type, court_name, address, location,
                            price, skill_level, starts_at, ends_at, max_players, spots_filled, active, created_at)
      values (
        host,
        (array['Open run', 'Pickup game', 'Competitive 6s', 'Casual doubles', 'Queen of the court',
               'After-class run', 'Sunday funday', 'Coed pickup'])[1 + floor(random() * 8)::int]
          || ' @ ' || c.court_name,
        (array['All welcome, bring water!', 'Rotating teams, winners stay on.', 'Need a few more hitters.',
               'Chill vibes, no ego.', 'Looking for a setter.', 'Balls provided.'])[1 + floor(random() * 6)::int],
        c.court_type, c.court_name, c.address,
        st_setsrid(st_makepoint(c.lng + (random() - 0.5) * 0.002, c.lat + (random() - 0.5) * 0.002), 4326)::geography,
        case when c.court_type = 'indoor' then (array[0, 3, 5, 5, 8])[1 + floor(random() * 5)::int] else 0 end,
        (array['All levels', 'Beginner', 'Intermediate', 'Advanced'])[1 + floor(random() * 4)::int],
        start_ts, start_ts + interval '2 hours', max_p, filled, upcoming, created_ts
      )
      returning id into sid;

      insert into session_events (time, session_id, user_id, event_type, court_name, court_type)
      values (created_ts, sid, host, 'create', c.court_name, c.court_type);

      -- host first, then random players
      for u in
        select id, (id = host) as is_host from users where id like 'demo_%'
        order by (id = host) desc, random() limit filled
      loop
        joined_ts := case when u.is_host then created_ts
                          else created_ts + (least(start_ts, now()) - created_ts) * random() end;
        insert into session_attendees (session_id, user_id, joined_at) values (sid, u.id, joined_ts);
        insert into session_events (time, session_id, user_id, event_type, court_name, court_type)
        values (joined_ts, sid, u.id, 'join', c.court_name, c.court_type);
        if not upcoming then
          insert into session_events (time, session_id, user_id, event_type, court_name, court_type)
          values (start_ts + interval '1 minute' * random() * 20, sid, u.id, 'checkin', c.court_name, c.court_type);
        end if;
      end loop;

      -- a few players bail on past games (realistic churn)
      if not upcoming and random() < 0.3 then
        insert into session_events (time, session_id, user_id, event_type, court_name, court_type)
        select start_ts - interval '3 hours', sid, id, 'leave', c.court_name, c.court_type
        from users where id like 'demo_%' and id not in (select user_id from session_attendees where session_id = sid)
        order by random() limit 1;
      end if;
    end loop;
  end loop;
end $$;

-- ── Profile counters ────────────────────────────────────────────────────────
update users u set
  sessions_hosted   = (select count(*) from sessions s where s.host_id = u.id),
  sessions_attended = (select count(*) from session_attendees a where a.user_id = u.id)
where u.id like 'demo_%';

-- ── Feed posts ──────────────────────────────────────────────────────────────
insert into posts (author_id, type, content, session_id, created_at)
select s.host_id, 'session',
  'Hosting ' || lower(split_part(s.title, ' @ ', 1)) || ' at ' || s.court_name || '. Come through!',
  s.id, s.created_at
from sessions s where s.host_id like 'demo_%' and s.active
order by s.starts_at limit 8;

insert into posts (author_id, type, content, created_at)
select 'demo_' || lpad((1 + floor(random() * 24))::int::text, 2, '0'), 'text', t.content,
       now() - interval '1 hour' * (2 + random() * 120)
from unnest(array[
  'Anyone know if Alumni Arena has open gym hours this week?',
  'Shoutout to everyone at Delaware Park yesterday, best run in weeks',
  'Looking for a doubles partner for sand season. Hit me up!',
  'Finally got my approach timing down. Jump training is paying off',
  'Who left a Mikasa ball at Canalside? I have it',
  'New to Buffalo, where do people play on weeknights?'
]) as t(content);

update posts p set likes = 1 + floor(random() * 15)::int where author_id like 'demo_%';

-- ── Build the rollups now instead of waiting for the background refresh ────
-- (If your SQL editor complains about CALL inside a transaction, run these
--  two lines on their own.)
call refresh_continuous_aggregate('court_activity_hourly', null, null);
call refresh_continuous_aggregate('player_activity_weekly', null, null);

-- Quick sanity check
select
  (select count(*) from users where id like 'demo_%')    as players,
  (select count(*) from sessions where active)            as upcoming_games,
  (select count(*) from sessions where not active)        as past_games,
  (select count(*) from session_events)                   as activity_events;
