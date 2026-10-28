import { rooms, sendUpdateToAllPlayers, sendStartToAllPlayers, getPersonalizedPlayers } from "../services/roomManager.js";
import { generateBoard, updateBingoLetters, checkWin } from "../engine/boardEngine.js";
import { makeAIMove } from "../engine/aiStrategy.js";
import { determineFirstTurn } from "../engine/turnRules.js";

// Register all in-game gameplay events for a connected socket
export function registerGameplayHandlers(io, socket) {
  // Handle a player's number call / board click
  socket.on("turn:click", ({ roomId, number }) => {
    const room = rooms.get(roomId);
    if (!room) return;

    // If match was already finished (e.g. opponent claimed forfeit or timed out while away)
    if (room.status === "finished") {
      const player = room.players.find((p) => p.id === socket.id);
      const isWinner = player && room.winner === player.name;
      const forfeitMsg = isWinner
        ? room.winnerMessage || "You won by forfeit!"
        : `${room.winner || "Opponent"} claimed victory by forfeit while you were away.`;

      socket.emit("game:win", {
        winner: room.winner,
        reason: room.winnerReason || "forfeit",
        message:
          room.winnerReason === "forfeit" || room.winnerReason === "timeout"
            ? forfeitMsg
            : room.winnerMessage || `${room.winner} won the match!`,
        gameTime: room.gameTime || 0,
      });
      return;
    }

    if (room.status !== "playing") return;

    const playerIndex = room.players.findIndex((p) => p.id === socket.id);
    if (playerIndex !== room.currentTurn) return;

    // Update both players' marks
    room.players.forEach((player) => {
      if (!player.marks.includes(number)) {
        player.marks.push(number);
      }
    });

    room.lastNumber = number;
    if (!room.calledHistory) room.calledHistory = [];
    room.calledHistory.unshift(number);
    if (room.calledHistory.length > 5) {
      room.calledHistory = room.calledHistory.slice(0, 5);
    }

    room.currentTurn = (room.currentTurn + 1) % 2;

    // Update BINGO letters and check for win
    const currentPlayer = room.players[playerIndex];
    const opponent = room.players[(playerIndex + 1) % 2];

    updateBingoLetters(currentPlayer);
    if (opponent) updateBingoLetters(opponent);

    const currentWon = checkWin(currentPlayer);
    const opponentWon = opponent ? checkWin(opponent) : false;

    if (currentWon || opponentWon) {
      const winner = currentWon ? currentPlayer : opponent;
      room.lastWinnerIndex = currentWon ? playerIndex : (playerIndex + 1) % 2;
      const gameTimeInSeconds = Math.floor(
        (Date.now() - (room.startTime || Date.now())) / 1000,
      );
      room.gameTime = gameTimeInSeconds;
      room.status = "finished";
      room.winner = winner.name;
      room.winnerReason = "bingo";
      room.winnerMessage = `${winner.name} has completed B-I-N-G-O!`;

      // First send the final board update to reflect the last move
      sendUpdateToAllPlayers(io, room);

      // Emit win event after delay for smooth UI transition
      setTimeout(() => {
        io.to(roomId).emit("game:win", {
          winner: winner.name,
          gameTime: gameTimeInSeconds,
          message: `${winner.name} has completed B-I-N-G-O!`,
        });
      }, 1000);
    } else {
      // Send updates to each player separately
      sendUpdateToAllPlayers(io, room);

      // If it's AI's turn, make AI move
      const aiPlayerForMove = room.players.find((p) => p.isAI);
      if (
        aiPlayerForMove &&
        room.currentTurn === room.players.indexOf(aiPlayerForMove)
      ) {
        setTimeout(() => {
          makeAIMove(room, aiPlayerForMove, io, (r) => sendUpdateToAllPlayers(io, r));
        }, 2000);
      }
    }
  });

  // Handle player intentional exit / forfeit
  socket.on("player:forfeit", ({ roomId }) => {
    const room = rooms.get(roomId);
    if (!room) return;

    if (room.disconnectTimer) {
      clearInterval(room.disconnectTimer);
      room.disconnectTimer = null;
    }

    const leavingIndex = room.players.findIndex((p) => p.id === socket.id);
    if (leavingIndex !== -1) {
      const leavingPlayer = room.players[leavingIndex];
      const remainingPlayer = room.players.find((p) => p.id !== socket.id);

      const gameTimeInSeconds = Math.max(
        1,
        Math.floor((Date.now() - (room.startTime || Date.now())) / 1000),
      );
      room.gameTime = gameTimeInSeconds;
      room.status = "finished";
      room.winner = remainingPlayer ? remainingPlayer.name : null;
      room.lastWinnerIndex = remainingPlayer
        ? room.players.indexOf(remainingPlayer)
        : null;
      room.winnerReason = "forfeit";
      room.winnerMessage = `${leavingPlayer.name} exited the match. You win by forfeit!`;

      // Cleanly disconnect leaving player from match room
      leavingPlayer.isConnected = false;
      leavingPlayer.forfeited = true;
      socket.leave(roomId);

      if (remainingPlayer && remainingPlayer.isConnected && !remainingPlayer.isAI) {
        io.to(remainingPlayer.id).emit("game:win", {
          winner: remainingPlayer.name,
          reason: "forfeit",
          message: `${leavingPlayer.name} exited the match. You win by forfeit!`,
          gameTime: gameTimeInSeconds,
        });
      } else {
        rooms.delete(roomId);
      }
    }
  });

  // Handle player claiming forfeit while room is paused
  socket.on("player:claim_forfeit", ({ roomId }) => {
    const room = rooms.get(roomId);
    if (!room || room.status !== "paused") return;

    if (room.disconnectTimer) {
      clearInterval(room.disconnectTimer);
      room.disconnectTimer = null;
    }

    const claimingPlayer = room.players.find((p) => p.id === socket.id);
    if (claimingPlayer) {
      const gameTimeInSeconds = Math.max(
        1,
        Math.floor((Date.now() - (room.startTime || Date.now())) / 1000),
      );
      room.gameTime = gameTimeInSeconds;
      room.status = "finished";
      room.winner = claimingPlayer.name;
      room.lastWinnerIndex = room.players.indexOf(claimingPlayer);
      room.winnerReason = "forfeit";
      room.winnerMessage = "Opponent abandoned the game. You win by forfeit!";

      io.to(roomId).emit("game:win", {
        winner: claimingPlayer.name,
        reason: "forfeit",
        message: "Opponent abandoned the game. You win by forfeit!",
        gameTime: gameTimeInSeconds,
      });
    }
  });

  // Handle game reset / play again
  socket.on("game:reset", ({ roomId }) => {
    const room = rooms.get(roomId);
    if (!room) return;

    if (room.disconnectTimer) {
      clearInterval(room.disconnectTimer);
      room.disconnectTimer = null;
    }

    room.winner = null;
    room.winnerReason = null;
    room.winnerMessage = null;
    room.gameTime = 0;

    // Prune any disconnected players who forfeited or abandoned
    room.players = room.players.filter((p) => p.isConnected || p.isAI);

    // Reset remaining players' boards and marks
    room.players.forEach((player) => {
      player.board = generateBoard();
      player.marks = [];
      player.bingoLetters = [];
    });

    // Determine starter turn for rematch (Fair Alternating swaps starter; Winner Starts gives to last winner)
    determineFirstTurn(room, true);
    room.lastNumber = null;
    room.calledHistory = [];
    room.startTime = Number(Date.now());

    // If only 1 player remains in the room, transition to waiting lobby
    if (room.players.length < 2) {
      room.status = "waiting";
      const remainingPlayer = room.players[0];
      if (remainingPlayer && remainingPlayer.isConnected) {
        io.to(remainingPlayer.id).emit("game:start", {
          players: getPersonalizedPlayers(room, remainingPlayer.id),
          currentTurn: 0,
          startTime: null,
          lastNumber: null,
          calledHistory: [],
        });
      }
      return;
    }

    // Both players (or human + AI) are connected: start fresh match!
    room.status = "playing";
    sendStartToAllPlayers(io, room);

    // If starting player in rematch is AI, trigger AI move
    const aiPlayerForMove = room.players.find((p) => p.isAI);
    if (
      aiPlayerForMove &&
      room.currentTurn === room.players.indexOf(aiPlayerForMove)
    ) {
      setTimeout(() => {
        makeAIMove(room, aiPlayerForMove, io, (r) => sendUpdateToAllPlayers(io, r));
      }, 2000);
    }
  });
}
