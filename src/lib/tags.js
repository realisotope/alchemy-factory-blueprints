// Database tag values (stored in Supabase)
export const AVAILABLE_TAGS = [
  "automation",
  "brewing",
  "compact",
  "crafting",
  "currency",
  "decorative",
  "early-game",
  "mid-game",
  "late-game",
  "enchanting",
  "experimental",
  "extraction",
  "fuel",
  "manual",
  "misc",
  "modular",
  "multi-floor",
  "relics",
  "scalable",
  "smelting",
  "stable",
  "stackable",
  "logistics",
];

// Emoji mapping for display purposes only
export const TAG_EMOJIS = {
  "automation": "🤖",
  "brewing": "⚗️",
  "compact": "🧊",
  "crafting": "⚒️",
  "currency": "💎",
  "decorative": "✨",
  "early-game": "🌱",
  "mid-game": "⚙️",
  "late-game": "👑",
  "enchanting": "🔮",
  "experimental": "🧪",
  "extraction": "⛏️",
  "fuel": "🔥",
  "manual": "🧤",
  "misc": "🌀",
  "modular": "🧩",
  "multi-floor": "🏢",
  "relics": "🏺",
  "scalable": "📈",
  "smelting": "🏭",
  "stable": "🛡️",
  "stackable": "🧱",
  "logistics": "📦",
};

// Helper function to get display name with emoji
export const getTagDisplay = (tag) => {
  const emoji = TAG_EMOJIS[tag];
  return emoji ? `${emoji} ${tag}` : tag;
};