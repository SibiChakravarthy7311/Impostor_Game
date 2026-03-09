create table if not exists public.player_sessions (
  session_token text primary key,
  game_id uuid not null references public.games(id) on delete cascade,
  player_id uuid not null references public.players(id) on delete cascade,
  is_host boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists idx_player_sessions_game on public.player_sessions(game_id);
create index if not exists idx_player_sessions_player on public.player_sessions(player_id);

alter table public.player_sessions enable row level security;

drop policy if exists player_sessions_all_access on public.player_sessions;
create policy player_sessions_all_access on public.player_sessions for all using (true) with check (true);
