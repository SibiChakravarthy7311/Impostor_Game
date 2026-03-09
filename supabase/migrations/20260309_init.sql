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

alter table public.games
  add constraint games_host_player_fk
  foreign key (host_player_id) references public.players(id) on delete set null;

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
alter table public.eliminations enable row level security;
alter table public.events enable row level security;

drop policy if exists games_all_access on public.games;
create policy games_all_access on public.games for all using (true) with check (true);

drop policy if exists players_all_access on public.players;
create policy players_all_access on public.players for all using (true) with check (true);

drop policy if exists roles_all_access on public.roles;
create policy roles_all_access on public.roles for all using (true) with check (true);

drop policy if exists rounds_all_access on public.rounds;
create policy rounds_all_access on public.rounds for all using (true) with check (true);

drop policy if exists votes_all_access on public.votes;
create policy votes_all_access on public.votes for all using (true) with check (true);

drop policy if exists kills_all_access on public.kills;
create policy kills_all_access on public.kills for all using (true) with check (true);

drop policy if exists eliminations_all_access on public.eliminations;
create policy eliminations_all_access on public.eliminations for all using (true) with check (true);

drop policy if exists events_all_access on public.events;
create policy events_all_access on public.events for all using (true) with check (true);

create or replace function public.resolve_round(p_game_id uuid, p_round_number integer)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_round_id uuid;
  v_lead_id uuid;
  v_lead_vote_target_id uuid;
  v_kill_target_id uuid;
  v_vote_eliminated_id uuid;
  v_kill_eliminated_id uuid;
  v_tie_count integer;
  v_next_lead_id uuid;
  v_remaining_impostors integer;
  v_remaining_civilians integer;
  v_winner text;
begin
  select id into v_round_id
  from rounds
  where game_id = p_game_id and round_number = p_round_number
  for update;

  if v_round_id is null then
    raise exception 'Round % for game % not found', p_round_number, p_game_id;
  end if;

  update rounds set phase = 'resolution' where id = v_round_id;

  select r.player_id
  into v_lead_id
  from roles r
  join players p on p.id = r.player_id
  where r.game_id = p_game_id
    and r.role = 'impostor'
    and r.is_lead_impostor = true
    and p.is_alive = true
  limit 1;

  with vote_tally as (
    select v.target_player_id, count(*)::int as votes
    from votes v
    join players voter on voter.id = v.voter_player_id and voter.is_alive = true
    join players target on target.id = v.target_player_id and target.is_alive = true
    where v.round_id = v_round_id
      and (v_lead_id is null or v.voter_player_id <> v_lead_id)
    group by v.target_player_id
  ), top_vote as (
    select max(votes) as mv from vote_tally
  ), ties as (
    select vt.target_player_id
    from vote_tally vt
    join top_vote tv on tv.mv = vt.votes
  )
  select count(*)::int into v_tie_count from ties;

  if coalesce(v_tie_count, 0) = 1 then
    with vote_tally as (
      select v.target_player_id, count(*)::int as votes
      from votes v
      join players voter on voter.id = v.voter_player_id and voter.is_alive = true
      join players target on target.id = v.target_player_id and target.is_alive = true
      where v.round_id = v_round_id
        and (v_lead_id is null or v.voter_player_id <> v_lead_id)
      group by v.target_player_id
    ), top_vote as (
      select max(votes) as mv from vote_tally
    )
    select vt.target_player_id
    into v_vote_eliminated_id
    from vote_tally vt
    join top_vote tv on tv.mv = vt.votes
    limit 1;
  elsif coalesce(v_tie_count, 0) > 1 and v_lead_id is not null then
    select target_player_id
    into v_lead_vote_target_id
    from votes
    where round_id = v_round_id and voter_player_id = v_lead_id;

    if v_lead_vote_target_id is not null and exists (
      with vote_tally as (
        select v.target_player_id, count(*)::int as votes
        from votes v
        join players voter on voter.id = v.voter_player_id and voter.is_alive = true
        join players target on target.id = v.target_player_id and target.is_alive = true
        where v.round_id = v_round_id
          and (v_lead_id is null or v.voter_player_id <> v_lead_id)
        group by v.target_player_id
      ), top_vote as (
        select max(votes) as mv from vote_tally
      )
      select 1
      from vote_tally vt
      join top_vote tv on tv.mv = vt.votes
      where vt.target_player_id = v_lead_vote_target_id
    ) then
      v_vote_eliminated_id := v_lead_vote_target_id;
    end if;
  end if;

  if v_vote_eliminated_id is not null then
    insert into eliminations(round_id, player_id, reason)
    values (v_round_id, v_vote_eliminated_id, 'vote')
    on conflict (round_id, player_id) do nothing;

    update players
    set is_alive = false
    where id = v_vote_eliminated_id;
  end if;

  if v_lead_id is not null and (v_vote_eliminated_id is null or v_vote_eliminated_id <> v_lead_id) then
    select k.target_player_id
    into v_kill_target_id
    from kills k
    where k.round_id = v_round_id
      and k.lead_player_id = v_lead_id
    limit 1;

    if v_kill_target_id is not null
      and v_kill_target_id <> v_lead_id
      and (v_vote_eliminated_id is null or v_kill_target_id <> v_vote_eliminated_id)
      and exists (select 1 from players where id = v_kill_target_id and is_alive = true)
    then
      v_kill_eliminated_id := v_kill_target_id;

      insert into eliminations(round_id, player_id, reason)
      values (v_round_id, v_kill_eliminated_id, 'kill')
      on conflict (round_id, player_id) do nothing;

      update players
      set is_alive = false
      where id = v_kill_eliminated_id;
    end if;
  end if;

  select count(*)::int
  into v_remaining_impostors
  from roles r
  join players p on p.id = r.player_id
  where r.game_id = p_game_id
    and r.role = 'impostor'
    and p.is_alive = true;

  select count(*)::int
  into v_remaining_civilians
  from roles r
  join players p on p.id = r.player_id
  where r.game_id = p_game_id
    and r.role = 'civilian'
    and p.is_alive = true;

  if v_remaining_impostors = 0 then
    v_winner := 'civilian';
  elsif v_remaining_impostors >= v_remaining_civilians then
    v_winner := 'impostor';
  else
    v_winner := null;
  end if;

  -- Leadership for next round: if current lead is gone, promote first alive impostor.
  if v_lead_id is null or not exists (select 1 from players where id = v_lead_id and is_alive = true) then
    select r.player_id
    into v_next_lead_id
    from roles r
    join players p on p.id = r.player_id
    where r.game_id = p_game_id
      and r.role = 'impostor'
      and p.is_alive = true
    order by p.joined_at
    limit 1;

    update roles
    set is_lead_impostor = false
    where game_id = p_game_id
      and role = 'impostor';

    if v_next_lead_id is not null then
      update roles
      set is_lead_impostor = true
      where game_id = p_game_id
        and player_id = v_next_lead_id;
    end if;
  else
    v_next_lead_id := v_lead_id;
  end if;

  update rounds
  set phase = 'round_end', ended_at = now()
  where id = v_round_id;

  insert into events(game_id, round_id, type, payload_json)
  values (
    p_game_id,
    v_round_id,
    'round_resolved',
    jsonb_build_object(
      'vote_eliminated_player_id', v_vote_eliminated_id,
      'kill_eliminated_player_id', v_kill_eliminated_id,
      'remaining_impostors', v_remaining_impostors,
      'next_lead_impostor_id', v_next_lead_id,
      'winner', v_winner
    )
  );

  if v_winner is not null then
    update games
    set status = 'finished', winner = v_winner
    where id = p_game_id;
  else
    insert into rounds(game_id, round_number, phase)
    values (p_game_id, p_round_number + 1, 'voting_open')
    on conflict (game_id, round_number) do nothing;

    update games
    set status = 'in_progress', round_number = p_round_number + 1, winner = null
    where id = p_game_id;
  end if;

  return jsonb_build_object(
    'game_id', p_game_id,
    'round_number', p_round_number,
    'vote_eliminated_player_id', v_vote_eliminated_id,
    'kill_eliminated_player_id', v_kill_eliminated_id,
    'remaining_impostors', v_remaining_impostors,
    'next_lead_impostor_id', v_next_lead_id,
    'winner', v_winner
  );
end;
$$;

grant execute on function public.resolve_round(uuid, integer) to anon, authenticated, service_role;
