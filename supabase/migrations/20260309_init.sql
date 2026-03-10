create extension if not exists pgcrypto;

create table if not exists public.games (
  id uuid primary key default gen_random_uuid(),
  join_code text not null unique,
  host_player_id uuid null,
  status text not null default 'lobby' check (status in ('lobby', 'in_progress', 'finished')),
  round_number integer not null default 1,
  winner text null check (winner in ('civilian', 'impostor')),
  settings_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.players (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games(id) on delete cascade,
  name text not null,
  is_alive boolean not null default true,
  joined_at timestamptz not null default now()
);

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'games_host_player_fk'
  ) then
    alter table public.games
      add constraint games_host_player_fk
      foreign key (host_player_id) references public.players(id) on delete set null;
  end if;
end $$;

create table if not exists public.roles (
  game_id uuid not null references public.games(id) on delete cascade,
  player_id uuid not null references public.players(id) on delete cascade,
  role text not null check (role in ('civilian', 'impostor')),
  is_lead_impostor boolean not null default false,
  assigned_at timestamptz not null default now(),
  primary key (game_id, player_id)
);

create table if not exists public.rounds (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games(id) on delete cascade,
  round_number integer not null,
  phase text not null default 'voting_open' check (phase in ('discussion', 'voting_open', 'resolution', 'round_end')),
  started_at timestamptz not null default now(),
  ended_at timestamptz null,
  unique (game_id, round_number)
);

create table if not exists public.votes (
  round_id uuid not null references public.rounds(id) on delete cascade,
  voter_player_id uuid not null references public.players(id) on delete cascade,
  target_player_id uuid not null references public.players(id) on delete cascade,
  submitted_at timestamptz not null default now(),
  primary key (round_id, voter_player_id)
);

create table if not exists public.kills (
  round_id uuid not null references public.rounds(id) on delete cascade,
  lead_player_id uuid not null references public.players(id) on delete cascade,
  target_player_id uuid not null references public.players(id) on delete cascade,
  submitted_at timestamptz not null default now(),
  primary key (round_id, lead_player_id)
);

create table if not exists public.eliminations (
  id bigserial primary key,
  round_id uuid not null references public.rounds(id) on delete cascade,
  player_id uuid not null references public.players(id) on delete cascade,
  reason text not null check (reason in ('vote', 'kill')),
  created_at timestamptz not null default now(),
  unique (round_id, player_id)
);

create table if not exists public.events (
  id bigserial primary key,
  game_id uuid not null references public.games(id) on delete cascade,
  round_id uuid null references public.rounds(id) on delete cascade,
  type text not null,
  payload_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create or replace function public.touch_games_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_touch_games_updated_at on public.games;
create trigger trg_touch_games_updated_at
before update on public.games
for each row execute function public.touch_games_updated_at();

alter table public.games enable row level security;
alter table public.players enable row level security;
alter table public.roles enable row level security;
alter table public.rounds enable row level security;
alter table public.votes enable row level security;
alter table public.kills enable row level security;
