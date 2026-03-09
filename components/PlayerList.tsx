import type { Player } from "../lib/types";

type Props = {
  players: Player[];
};

export function PlayerList({ players }: Props) {
  return (
    <ul className="grid gap-2 sm:grid-cols-2">
      {players.map((player) => (
        <li key={player.id} className="rounded border border-slate-300 bg-white px-3 py-2">
          <p className="font-medium">{player.name}</p>
          <p className="text-xs text-slate-500">{player.is_alive ? "Alive" : "Eliminated"}</p>
        </li>
      ))}
    </ul>
  );
}
