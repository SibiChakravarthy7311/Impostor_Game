export const WORD_BANK = [
  "ocean",
  "desert",
  "volcano",
  "forest",
  "thunder",
  "library",
  "museum",
  "airport",
  "subway",
  "stadium",
  "diamond",
  "chocolate",
  "lantern",
  "compass",
  "pyramid",
  "telescope",
  "festival",
  "carousel",
  "waterfall",
  "avalanche",
  "hurricane",
  "backpack",
  "notebook",
  "whistle",
  "sapphire",
  "rainbow",
  "carnival",
  "satellite",
  "canyon",
  "glacier"
] as const;

export function randomSecretWord(): string {
  return WORD_BANK[Math.floor(Math.random() * WORD_BANK.length)];
}
