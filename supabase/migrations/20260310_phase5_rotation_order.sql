alter table public.games
  add column if not exists rotation_direction text not null default 'clockwise'
    check (rotation_direction in ('clockwise', 'anticlockwise'));

alter table public.games
  add column if not exists starting_player_id uuid null;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'games_starting_player_fk'
  ) then
    alter table public.games
      add constraint games_starting_player_fk
      foreign key (starting_player_id) references public.players(id) on delete set null;
  end if;
end $$;

with first_player_per_game as (
  select distinct on (p.game_id)
    p.game_id,
    p.id as player_id
  from public.players p
  order by p.game_id, p.joined_at
)
update public.games g
set starting_player_id = f.player_id
from first_player_per_game f
where g.id = f.game_id
  and g.starting_player_id is null;

