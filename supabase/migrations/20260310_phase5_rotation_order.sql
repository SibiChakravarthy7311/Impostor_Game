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

update public.games g
set starting_player_id = p.id
from lateral (
  select id
  from public.players
  where game_id = g.id
  order by joined_at
  limit 1
) p
where g.starting_player_id is null;
