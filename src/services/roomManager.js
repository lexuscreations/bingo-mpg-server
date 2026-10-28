// Central game rooms storage
export const rooms = new Map();

// Helper to generate personalized player payloads for a recipient socket
export function getPersonalizedPlayers(room, recipientSocketId) {
  return room.players.map((p, idx) => ({
    id: p.id,
    sessionKey: p.sessionKey,
    name: p.name,
    board: p.id === recipientSocketId ? p.board : null,
    marks: p.id === recipientSocketId ? p.marks : p.marks || [],
    bingoLetters: p.bingoLetters,
    isAI: p.isAI || false,
    isConnected: p.isConnected,
    isAway: Boolean(p.isAway),
    isYou: p.id === recipientSocketId,
    playerIndex: idx,
  }));
}

// Send full game:start payload to an individual player socket
export function sendStartToPlayer(io, room, socketId, isReconnect = false) {
  const isPaused = room.status === "paused";
  const disconnectedOpponent = isPaused
    ? room.players.find((p) => !p.isConnected || p.isAway)
    : null;

  io.to(socketId).emit("game:start", {
    players: getPersonalizedPlayers(room, socketId),
    currentTurn: room.currentTurn,
    firstTurnRule: room.firstTurnRule || "alternating",
    turnReason: room.turnReason || "coin_toss",
    starterIndex:
      room.starterIndex !== undefined ? room.starterIndex : room.currentTurn,
    starterPlayerName:
      room.players[room.starterIndex]?.name ||
      room.players[room.currentTurn]?.name ||
      "",
    startTime: room.startTime,
    lastNumber: room.lastNumber,
    calledHistory: room.calledHistory || [],
    isPaused,
    disconnectedPlayerName: disconnectedOpponent
      ? disconnectedOpponent.name
      : "",
    timeoutSeconds: room.pauseSecondsLeft || 30,
    isReconnect,
  });
}

// Send personalized start payloads to all active connected players
export function sendStartToAllPlayers(io, room) {
  room.players.forEach((player) => {
    if (!player.isConnected || player.isAI) return;
    sendStartToPlayer(io, room, player.id);
  });
}

// Broadcast game state update to all active connected players
export function sendUpdateToAllPlayers(io, room) {
  room.players.forEach((player) => {
    if (!player.isConnected || player.isAI) return;
    io.to(player.id).emit("game:update", {
      players: getPersonalizedPlayers(room, player.id),
      currentTurn: room.currentTurn,
      firstTurnRule: room.firstTurnRule || "alternating",
      lastNumber: room.lastNumber,
      calledHistory: room.calledHistory || [],
    });
  });
}
