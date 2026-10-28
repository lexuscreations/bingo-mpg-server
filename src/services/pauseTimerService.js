import { rooms, sendUpdateToAllPlayers } from "./roomManager.js";
import { DEFAULT_PAUSE_SECONDS } from "../config/constants.js";

// Central helper to pause a match immediately and manage the 30s forfeit countdown
export function triggerMatchPause(io, room, disconnectedPlayer) {
  if (room.status !== "playing" && room.status !== "paused") return;

  room.status = "paused";

  const otherPlayer = room.players.find((p) => p !== disconnectedPlayer);
  if (otherPlayer && otherPlayer.isConnected) {
    io.to(otherPlayer.id).emit("match:paused", {
      disconnectedPlayerName: disconnectedPlayer
        ? disconnectedPlayer.name
        : "Opponent",
      timeoutSeconds: room.pauseSecondsLeft || DEFAULT_PAUSE_SECONDS,
    });
  }

  sendUpdateToAllPlayers(io, room);

  if (!room.disconnectTimer) {
    room.pauseSecondsLeft = DEFAULT_PAUSE_SECONDS;
    room.disconnectTimer = setInterval(() => {
      room.pauseSecondsLeft -= 1;
      io.to(room.roomId).emit("match:pause_tick", {
        secondsLeft: room.pauseSecondsLeft,
      });

      if (room.pauseSecondsLeft <= 0) {
        clearInterval(room.disconnectTimer);
        room.disconnectTimer = null;

        const connectedPlayers = room.players.filter(
          (p) => p.isConnected && !p.isAway,
        );
        if (connectedPlayers.length === 1) {
          const winner = connectedPlayers[0];
          const loser = room.players.find((p) => p !== winner);
          const gameTimeInSeconds = Math.max(
            1,
            Math.floor((Date.now() - (room.startTime || Date.now())) / 1000),
          );
          room.gameTime = gameTimeInSeconds;
          room.status = "finished";
          room.winner = winner.name;
          room.winnerReason = "timeout";
          room.winnerMessage = `${loser ? loser.name : "Opponent"} failed to reconnect. Victory by forfeit!`;

          io.to(room.roomId).emit("game:win", {
            winner: winner.name,
            reason: "timeout",
            message: room.winnerMessage,
            gameTime: gameTimeInSeconds,
          });
        } else {
          rooms.delete(room.roomId);
        }
      }
    }, 1000);
  }
}
