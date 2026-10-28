// Turn selection strategy rules
export const FIRST_TURN_RULES = {
  ALTERNATING: "alternating", // Coin toss on game 1, then alternate on every rematch
  RANDOM: "random",           // Fresh 50/50 coin toss on every match
  WINNER: "winner",           // Coin toss on game 1, previous winner starts on rematch
  HOST: "host",               // Room host always starts
};

/**
 * Determine which player slot (0 or 1) gets the first turn for the match.
 * @param {Object} room - The game room object
 * @param {boolean} isRematch - True if this is a rematch/play-again
 * @returns {{ starterIndex: number, currentTurn: number, turnReason: string }}
 */
export function determineFirstTurn(room, isRematch = false) {
  const rule = room.firstTurnRule || FIRST_TURN_RULES.ALTERNATING;
  let starterIndex = 0;
  let turnReason = "host";

  if (rule === FIRST_TURN_RULES.HOST) {
    starterIndex = 0;
    turnReason = "host";
  } else if (rule === FIRST_TURN_RULES.RANDOM) {
    starterIndex = Math.random() < 0.5 ? 0 : 1;
    turnReason = "coin_toss";
  } else if (rule === FIRST_TURN_RULES.WINNER) {
    if (isRematch && room.lastWinnerIndex !== null && room.lastWinnerIndex !== undefined) {
      starterIndex = room.lastWinnerIndex;
      turnReason = "winner";
    } else {
      // First game under winner rule uses coin toss
      starterIndex = Math.random() < 0.5 ? 0 : 1;
      turnReason = "coin_toss";
    }
  } else {
    // Default: "alternating" (Fair Play: Coin toss on Game 1, then alternates)
    if (isRematch && room.starterIndex !== null && room.starterIndex !== undefined) {
      starterIndex = 1 - room.starterIndex;
      turnReason = "alternating";
    } else {
      starterIndex = Math.random() < 0.5 ? 0 : 1;
      turnReason = "coin_toss";
    }
  }

  // Update room state
  room.starterIndex = starterIndex;
  room.currentTurn = starterIndex;
  room.turnReason = turnReason;

  return { starterIndex, currentTurn: starterIndex, turnReason };
}
