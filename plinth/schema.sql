-- ═══════════════════════════════════════════════════
-- PLINTH — Supabase Schema
-- Run this in your Supabase SQL Editor
-- ═══════════════════════════════════════════════════

-- Rooms table
create table if not exists rooms (
  id text primary key,
  host_name text not null,
  topic text not null default 'General Knowledge',
  language text not null default 'English',
  level text not null default 'Medium',
  question_count int not null default 10,
  time_limit int not null default 15,
  status text not null default 'waiting', -- waiting | playing | finished
  questions jsonb,
  current_question int not null default 0,
  question_start_time bigint,
  created_at timestamptz not null default now()
);

-- Players table
create table if not exists players (
  id uuid primary key default gen_random_uuid(),
  room_id text not null references rooms(id) on delete cascade,
  name text not null,
  score int not null default 0,
  current_answer int, -- null = not answered, -1 = timed out, 0-3 = option index
  joined_at timestamptz not null default now()
);

-- Index for fast lookups
create index if not exists idx_players_room on players(room_id);

-- Enable realtime
alter publication supabase_realtime add table rooms;
alter publication supabase_realtime add table players;

-- Enable RLS
alter table rooms enable row level security;
alter table players enable row level security;

-- RLS policies — allow all operations for anonymous users
-- (game doesn't require auth, room codes act as access control)
create policy "rooms_select" on rooms for select using (true);
create policy "rooms_insert" on rooms for insert with check (true);
create policy "rooms_update" on rooms for update using (true);
create policy "rooms_delete" on rooms for delete using (true);

create policy "players_select" on players for select using (true);
create policy "players_insert" on players for insert with check (true);
create policy "players_update" on players for update using (true);
create policy "players_delete" on players for delete using (true);

-- Auto-cleanup old rooms (optional — run as a cron or manually)
-- delete from rooms where created_at < now() - interval '24 hours';
