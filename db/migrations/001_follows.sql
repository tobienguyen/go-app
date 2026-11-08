-- Adds follows / friend requests. Safe to run on an existing GO! database
-- (it's also included in schema.sql for fresh setups).
create table if not exists follows (
  from_uid    text not null references users(id) on delete cascade,
  to_uid      text not null references users(id) on delete cascade,
  status      text not null default 'pending' check (status in ('pending', 'accepted')),
  created_at  timestamptz not null default now(),
  primary key (from_uid, to_uid),
  check (from_uid <> to_uid)
);
create index if not exists follows_to_idx on follows (to_uid, status);
