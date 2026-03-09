alter table public.rounds
  add column if not exists voting_ends_at timestamptz null;

update public.rounds
set voting_ends_at = started_at + interval '90 seconds'
where voting_ends_at is null
  and phase = 'voting_open';

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
  v_lead_vote_target_id uuid;
  v_kill_target_id uuid;
  v_vote_eliminated_id uuid;
  v_kill_eliminated_id uuid;
  v_tie_count integer;
  v_next_lead_id uuid;
  v_remaining_impostors integer;
  v_remaining_civilians integer;
  v_winner text;
  v_voting_seconds integer;
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

  select greatest(30, coalesce((settings_json->>'votingSeconds')::int, 90))
  into v_voting_seconds
  from games
  where id = p_game_id;

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
    insert into rounds(game_id, round_number, phase, voting_ends_at)
    values (p_game_id, p_round_number + 1, 'voting_open', now() + make_interval(secs => v_voting_seconds))
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
