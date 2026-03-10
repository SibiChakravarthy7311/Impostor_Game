-- Phase 6: Character emojis, speaking order, and improved phase transitions

-- Available character emojis
create table if not exists public.character_emojis (
  id text primary key,
  emoji text not null,
  name text not null,
  description text,
  created_at timestamptz not null default now()
);

-- Insert default character emojis
delete from public.character_emojis;
insert into public.character_emojis (id, emoji, name, description) values
  ('emoji_1', '😀', 'Happy', 'Cheerful and easygoing'),
  ('emoji_2', '🎮', 'Gamer', 'Competitive and strategic'),
  ('emoji_3', '👾', 'Alien', 'Mysterious and unpredictable'),
  ('emoji_4', '🎭', 'Actor', 'Dramatic and expressive'),
  ('emoji_5', '🕵️', 'Detective', 'Observant and analytical'),
  ('emoji_6', '🚀', 'Rocket', 'Bold and adventurous'),
  ('emoji_7', '🎸', 'Rockstar', 'Cool and confident'),
  ('emoji_8', '🦸', 'Hero', 'Strong and reliable');

-- Add character selection to players
alter table public.players
  add column if not exists character_emoji_id text references public.character_emojis(id) on delete set null;

-- Add speaking order phase to rounds
alter table public.rounds
  add column if not exists current_speaker_id uuid null references public.players(id) on delete set null,
  add column if not exists speaking_order jsonb null default '[]'::jsonb,
  add column if not exists speakers_completed jsonb null default '[]'::jsonb;

-- Create trigger to prevent duplicate players on same game with same name
create or replace function public.check_duplicate_player()
returns trigger
language plpgsql
as $$
begin
  if exists (
    select 1 from public.players
    where game_id = new.game_id
      and lower(name) = lower(new.name)
      and id <> new.id
  ) then
    raise exception 'Player with this name already exists in game';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_check_duplicate_player on public.players;
create trigger trg_check_duplicate_player
before insert on public.players
for each row execute function public.check_duplicate_player();

-- Create index for faster duplicate checks
create index if not exists idx_players_game_name on public.players (game_id, lower(name));

-- Update resolve_round to handle speaking order phase transition
create or replace function public.resolve_round(p_game_id uuid, p_round_number integer)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_round_id uuid;
  v_round_phase text;
  v_lead_id uuid;
  v_kill_target_id uuid;
  v_vote_eliminated_id uuid;
  v_kill_eliminated_id uuid;
  v_tie_count integer;
  v_next_lead_id uuid;
  v_remaining_impostors integer;
  v_remaining_civilians integer;
  v_winner text;
  v_next_word text;
  v_words text[] := array[
    'ocean','desert','volcano','forest','thunder','library','museum','airport','subway','stadium',
    'diamond','chocolate','lantern','compass','pyramid','telescope','festival','carousel','waterfall','avalanche',
    'hurricane','backpack','notebook','whistle','sapphire','rainbow','carnival','satellite','canyon','glacier'
  ];
begin
  select id, phase into v_round_id, v_round_phase
  from rounds
  where game_id = p_game_id and round_number = p_round_number
  for update;

  if v_round_id is null then
    raise exception 'Round % for game % not found', p_round_number, p_game_id;
  end if;

  if v_round_phase <> 'voting_open' then
    return jsonb_build_object(
      'game_id', p_game_id,
      'round_number', p_round_number,
      'skipped', true,
      'reason', 'round_not_open'
    );
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

  if v_winner is not null then
    update games
    set status = 'finished', winner = v_winner
    where id = p_game_id;
  else
    select (v_words[floor(random() * array_length(v_words, 1)) + 1])
    into v_next_word;

    select max(round_number) + 1
    into v_next_lead_id
    from roles
    where game_id = p_game_id
      and role = 'impostor'
      and is_lead_impostor = true
      and player_id in (select id from players where is_alive = true)
    limit 1;

    if v_next_lead_id is null or not exists (
      select 1 from players
      where id = v_next_lead_id and is_alive = true
    ) then
      select r.player_id
      into v_next_lead_id
      from roles r
      join players p on p.id = r.player_id
      where r.game_id = p_game_id
        and r.role = 'impostor'
        and p.is_alive = true
      order by r.assigned_at
      limit 1;
    end if;

    insert into rounds (game_id, round_number, phase, secret_word, speaking_order, current_speaker_id, speakers_completed)
    select
      p_game_id,
      p_round_number + 1,
      'speaking_order'::text,
      v_next_word,
      jsonb_agg(p.id),
      (array_agg(p.id order by p.joined_at))[1],
      '[]'::jsonb
    from players p
    where p.game_id = p_game_id and p.is_alive = true;

    update games
    set round_number = round_number + 1
    where id = p_game_id;

    if v_lead_id is not null
      and not exists (select 1 from players where id = v_lead_id and is_alive = true)
    then
      update roles
      set is_lead_impostor = true
      where game_id = p_game_id
        and player_id = v_next_lead_id;

      update roles
      set is_lead_impostor = false
      where game_id = p_game_id
        and player_id <> v_next_lead_id
        and role = 'impostor';
    end if;
  end if;

  return jsonb_build_object(
    'game_id', p_game_id,
    'round_number', p_round_number,
    'vote_eliminated_id', v_vote_eliminated_id,
    'kill_eliminated_id', v_kill_eliminated_id,
    'remaining_impostors', v_remaining_impostors,
    'winner', v_winner
  );
end;
$$;
