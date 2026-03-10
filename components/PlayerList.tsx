import type { Player } from "../lib/types";

const CHARACTER_EMOJIS: { [key: string]: string } = {
  "emoji_1": "😀",
  "emoji_2": "🎮",
  "emoji_3": "👾",
  "emoji_4": "🎭",
  "emoji_5": "🕵️",
  "emoji_6": "🚀",
  "emoji_7": "🎸",
  "emoji_8": "🦸"
};

type Props = {
  players: Player[];
  showStatus?: boolean;
  highlightPlayerId?: string | null;
  isGameStarted?: boolean;
};

export function PlayerList({ players, showStatus = true, highlightPlayerId, isGameStarted = false }: Props) {
  return (
    <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
      {players.map((player) => {
        const isHighlighted = highlightPlayerId === player.id;
        const emoji = player.character_emoji_id && CHARACTER_EMOJIS[player.character_emoji_id] 
          ? CHARACTER_EMOJIS[player.character_emoji_id] 
          : "🎭";
        
        return (
          <li
            key={player.id}
            className={`rounded-lg border-2 px-4 py-3 transition-all ${
              isHighlighted
                ? "border-cyan-400 bg-gradient-to-br from-cyan-900/40 to-purple-900/40 shadow-lg shadow-cyan-500/30"
                : player.is_alive
                  ? "border-slate-600 bg-slate-700"
                  : "border-red-600/50 bg-slate-800"
            }`}
          >
            <div className="flex items-start gap-3">
              <span className="text-3xl">{emoji}</span>
              <div className="flex-1">
                <p className={`font-semibold ${player.is_alive ? "text-gray-100" : "text-gray-500 line-through"}`}>
                  {player.name}
                </p>
                {showStatus && (
                  <p
                    className={`text-xs font-medium ${
                      player.is_alive ? "text-emerald-400" : "text-red-400"
                    }`}
                  >
                    {player.is_alive ? "Alive" : "Eliminated"}
                  </p>
                )}
              </div>
              {isHighlighted && (
                <div className="animate-pulse">
                  <span className="text-xl">🔊</span>
                </div>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
