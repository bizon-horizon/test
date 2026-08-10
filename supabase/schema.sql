-- Fridge Frenzy — Supabase schema (run in the SQL editor of your Supabase project)

drop table if exists player_saves;
drop table if exists servers;

create table if not exists servers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

create table if not exists player_saves (
  player_name text primary key,
  food text not null default 'carrot',
  total_kills integer not null default 0,
  best_score integer not null default 0,
  updated_at timestamptz not null default now()
);

alter table servers enable row level security;
alter table player_saves enable row level security;

-- Anonymous game clients need read/write access (free-plan friendly, no auth flow)
create policy "servers read" on servers for select using (true);
create policy "servers insert" on servers for insert with check (true);

create policy "saves read" on player_saves for select using (true);
create policy "saves insert" on player_saves for insert with check (true);
create policy "saves update" on player_saves for update using (true);

-- Default lobby
insert into servers (name) values ('Kitchen Arena (Official)');
