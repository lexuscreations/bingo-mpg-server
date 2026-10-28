// Short room ID generator (similar to Google Meet)
export const ADJECTIVES = [
  "BIG",
  "RED",
  "BLUE",
  "GREEN",
  "FAST",
  "SLOW",
  "HOT",
  "COLD",
  "WARM",
  "COOL",
  "BOLD",
  "WISE",
  "KIND",
  "BRAVE",
  "CALM",
  "WILD",
  "CUTE",
  "FINE",
  "GOOD",
  "NICE",
  "TALL",
  "WIDE",
  "DEEP",
  "HIGH",
  "LOW",
  "THIN",
  "THICK",
  "LONG",
  "SHORT",
  "NEW",
  "OLD",
  "YOUNG",
  "FRESH",
  "CLEAN",
  "PURE",
  "RICH",
  "POOR",
  "FULL",
  "EMPTY",
  "FREE",
];

export const NOUNS = [
  "CAT",
  "DOG",
  "BIRD",
  "FISH",
  "BEAR",
  "LION",
  "TIGER",
  "WOLF",
  "FOX",
  "DEER",
  "TREE",
  "ROSE",
  "STAR",
  "MOON",
  "SUN",
  "SKY",
  "SEA",
  "LAKE",
  "RIVER",
  "HILL",
  "ROCK",
  "GOLD",
  "SILVER",
  "IRON",
  "WOOD",
  "STONE",
  "GLASS",
  "PAPER",
  "CLOTH",
  "LEATHER",
  "CROWN",
  "RING",
  "CUP",
  "BOWL",
  "PLATE",
  "SPOON",
  "FORK",
  "KNIFE",
  "SWORD",
  "SHIELD",
];

export const NUMBERS = "0123456789";

// Generate short, memorable room ID
export function generateShortRoomId() {
  // Randomly choose between adjective + noun or noun + adjective
  const useAdjectiveFirst = Math.random() < 0.5;

  let roomId;
  if (useAdjectiveFirst) {
    const adjective = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
    const noun = NOUNS[Math.floor(Math.random() * NOUNS.length)];
    roomId = adjective + noun;
  } else {
    const noun = NOUNS[Math.floor(Math.random() * NOUNS.length)];
    const adjective = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
    roomId = noun + adjective;
  }

  // Add 3-4 random numbers
  const numLength = Math.random() < 0.5 ? 3 : 4;
  for (let i = 0; i < numLength; i++) {
    roomId += NUMBERS[Math.floor(Math.random() * NUMBERS.length)];
  }

  return roomId;
}
