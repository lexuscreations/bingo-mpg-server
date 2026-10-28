import {
  rooms,
  getPersonalizedPlayers,
  sendStartToPlayer,
  sendStartToAllPlayers,
  sendUpdateToAllPlayers,
} from "../services/roomManager.js";
import { triggerMatchPause } from "../services/pauseTimerService.js";
import { generateBoard } from "../engine/boardEngine.js";
import { generateShortRoomId } from "../engine/roomIdGenerator.js";
import { createAIPlayer, makeAIMove } from "../engine/aiStrategy.js";
import { determineFirstTurn } from "../engine/turnRules.js";

// Register all room lifecycle and connection management events for a socket
export function registerLifecycleHandlers(io, socket) {
  // Create a new game room
  socket.on(
    "room:create",
    ({ playerName, customRoomId, aiOpponent, firstTurnRule }, callback) => {
      let roomId;

      if (customRoomId) {
        if (customRoomId.length < 3 || customRoomId.length > 16) {
          callback({ error: "Room ID must be 3-16 characters long" });
          return;
        }
        if (!/^[A-Za-z0-9-]+$/.test(customRoomId)) {
          callback({
            error: "Room ID can only contain letters, numbers, and hyphens",
          });
          return;
        }
        if (rooms.has(customRoomId.toUpperCase())) {
          callback({ error: "Room ID already exists" });
          return;
        }
        roomId = customRoomId.toUpperCase();
      } else {
        roomId = generateShortRoomId();
        while (rooms.has(roomId)) {
          roomId = generateShortRoomId();
        }
      }

      const sessionKey = `${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      const room = {
        roomId,
        firstTurnRule: firstTurnRule || "alternating",
        starterIndex: null,
        lastWinnerIndex: null,
        turnReason: null,
        players: [
          {
            id: socket.id,
            sessionKey,
            name: playerName,
            board: generateBoard(),
            marks: [],
            bingoLetters: [],
            isAI: false,
            isConnected: true,
            disconnectedAt: null,
          },
        ],
        currentTurn: 0,
        lastNumber: null,
        calledHistory: [],
        startTime: null,
        gameTime: 0,
        aiOpponent: null,
        status: aiOpponent ? "playing" : "waiting",
        disconnectTimer: null,
        pauseSecondsLeft: 30,
      };

      // Add AI opponent if requested
      if (aiOpponent) {
        const aiPlayer = createAIPlayer(aiOpponent);
        room.players.push(aiPlayer);
        room.aiOpponent = aiOpponent;

        // Determine starter turn via configured rule
        determineFirstTurn(room, false);

        const startTimeNow = Date.now();
        room.startTime = startTimeNow;

        sendStartToAllPlayers(io, room);

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

      rooms.set(roomId, room);
      socket.join(roomId);
      callback({ roomId, sessionKey });
    },
  );

  // Join an existing game room
  socket.on(
    "room:join",
    ({ roomId, playerName, sessionKey: clientSessionKey }, callback) => {
      const room = rooms.get(roomId);

      if (!room) {
        callback({ error: "Room not found" });
        return;
      }

      // Check if room is paused and a substitute friend can inherit the vacant slot
      const vacantIndex = room.players.findIndex(
        (p) => !p.isConnected && !p.isAI,
      );
      if (room.status === "paused" && vacantIndex !== -1) {
        const sessionKey =
          clientSessionKey ||
          `${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
        const oldPlayer = room.players[vacantIndex];
        const substitutePlayer = {
          id: socket.id,
          sessionKey,
          name: playerName,
          board: oldPlayer.board,
          marks: [...oldPlayer.marks],
          bingoLetters: [...oldPlayer.bingoLetters],
          isAI: false,
          isConnected: true,
          disconnectedAt: null,
        };

        if (room.disconnectTimer) {
          clearInterval(room.disconnectTimer);
          room.disconnectTimer = null;
        }
        room.pauseSecondsLeft = 30;
        room.players[vacantIndex] = substitutePlayer;
        room.status = "playing";
        socket.join(roomId);

        io.to(roomId).emit("match:resumed", {
          message: `${playerName} joined as substitute! Match resumed.`,
          substituteName: playerName,
        });

        sendStartToPlayer(io, room, socket.id);

        const remainingPlayer = room.players[1 - vacantIndex];
        if (remainingPlayer && remainingPlayer.isConnected) {
          io.to(remainingPlayer.id).emit("game:update", {
            players: getPersonalizedPlayers(room, remainingPlayer.id),
            currentTurn: room.currentTurn,
            lastNumber: room.lastNumber,
            calledHistory: room.calledHistory || [],
          });
        }

        callback({ success: true, sessionKey, isSubstitute: true });
        return;
      }

      if (room.players.length >= 2 || room.status === "playing") {
        callback({ error: "Room is full or a match is already in progress" });
        return;
      }

      const sessionKey =
        clientSessionKey ||
        `${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      const player = {
        id: socket.id,
        sessionKey,
        name: playerName,
        board: generateBoard(),
        marks: [],
        bingoLetters: [],
        isAI: false,
        isConnected: true,
        disconnectedAt: null,
      };

      room.players.push(player);
      socket.join(roomId);

      // Start the game if 2 players are ready
      if (room.players.length === 2) {
        if (room.disconnectTimer) {
          clearTimeout(room.disconnectTimer);
          room.disconnectTimer = null;
        }
        room.status = "playing";
        const startTimeNow = Date.now();
        room.startTime = startTimeNow;
        // Determine first turn via configured rule (Coin Toss on Game 1 for Fair Alternating)
        determineFirstTurn(room, false);
        room.lastNumber = null;
        room.calledHistory = [];
        room.winner = null;
        room.winnerReason = null;
        room.winnerMessage = null;
        room.gameTime = 0;

        room.players.forEach((p) => {
          p.board = generateBoard();
          p.marks = [];
          p.bingoLetters = [];
          p.isConnected = true;
          p.disconnectedAt = null;
        });

        sendStartToAllPlayers(io, room);
      }

      callback({ success: true, sessionKey });
    },
  );

  // Handle player session reconnection
  socket.on(
    "room:reconnect",
    ({ roomId, sessionKey, playerName }, callback) => {
      const room = rooms.get(roomId);
      if (!room) {
        if (callback) callback({ error: "Room no longer exists" });
        return;
      }

      const playerIndex = room.players.findIndex(
        (p) => p.sessionKey === sessionKey,
      );

      if (playerIndex === -1) {
        if (callback) callback({ error: "No active slot found to reconnect" });
        return;
      }

      const player = room.players[playerIndex];
      player.id = socket.id;
      player.isConnected = true;
      player.isAway = false;
      player.awayAt = null;
      player.disconnectedAt = null;
      if (playerName) player.name = playerName;
      socket.join(roomId);

      // If match finished while away (e.g. forfeit timeout)
      if (room.status === "finished") {
        sendStartToPlayer(io, room, socket.id, true);

        const isWinner = room.winner === player.name;
        const forfeitMsg = isWinner
          ? room.winnerMessage || "You won by forfeit!"
          : `${room.winner || "Opponent"} claimed victory by forfeit while you were disconnected.`;

        io.to(socket.id).emit("game:win", {
          winner: room.winner,
          reason: room.winnerReason || "forfeit",
          message:
            room.winnerReason === "forfeit" || room.winnerReason === "timeout"
              ? forfeitMsg
              : room.winnerMessage || `${room.winner} won the match!`,
          gameTime: room.gameTime || 0,
        });

        if (callback) callback({ success: true, sessionKey, isFinished: true });
        return;
      }

      // If in waiting lobby: reconnect host cleanly and restore lobby state
      if (room.status === "waiting") {
        if (room.disconnectTimer) {
          clearTimeout(room.disconnectTimer);
          room.disconnectTimer = null;
        }
        player.isConnected = true;
        player.disconnectedAt = null;

        sendStartToPlayer(io, room, socket.id, true);

        if (callback) {
          callback({
            success: true,
            sessionKey,
            room: {
              id: room.roomId,
              roomId: room.roomId,
              players: getPersonalizedPlayers(room, socket.id),
              currentTurn: 0,
              firstTurnRule: room.firstTurnRule,
              status: room.status,
            },
          });
        }
        return;
      }

      // Check if both players are now active
      const allActive =
        room.players.length === 2 &&
        room.players.every((p) => p.isConnected && !p.isAway);

      if (allActive && room.status === "paused") {
        if (room.disconnectTimer) {
          clearInterval(room.disconnectTimer);
          room.disconnectTimer = null;
        }
        room.pauseSecondsLeft = 30;
        room.status = "playing";
        io.to(roomId).emit("match:resumed", {
          message: `${player.name} reconnected! Match resumed.`,
        });
      }

      sendStartToPlayer(io, room, socket.id, true);

      if (!allActive && room.status === "paused") {
        const disconnectedOpponent = room.players.find(
          (p) => !p.isConnected || p.isAway,
        );
        socket.emit("match:paused", {
          disconnectedPlayerName: disconnectedOpponent
            ? disconnectedOpponent.name
            : "Opponent",
          timeoutSeconds: room.pauseSecondsLeft || 30,
        });
      }

      const opponent = room.players.find(
        (p) => p.id !== socket.id && p.isConnected && !p.isAI,
      );
      if (opponent) {
        io.to(opponent.id).emit("game:update", {
          players: getPersonalizedPlayers(room, opponent.id),
          currentTurn: room.currentTurn,
          lastNumber: room.lastNumber,
          calledHistory: room.calledHistory || [],
        });
      }

      if (callback) {
        callback({
          success: true,
          sessionKey,
          room: {
            id: room.roomId,
            roomId: room.roomId,
            players: getPersonalizedPlayers(room, socket.id),
            currentTurn: room.currentTurn,
            firstTurnRule: room.firstTurnRule,
            status: room.status,
            startTime: room.startTime,
            lastNumber: room.lastNumber,
            calledHistory: room.calledHistory || [],
            winner: room.winner,
            winnerMessage: room.winnerMessage,
            winnerReason: room.winnerReason,
          },
        });
      }
    },
  );

  // Handle player explicitly leaving room (waiting lobby or finished game)
  socket.on("room:leave", ({ roomId }) => {
    if (!roomId) return;
    socket.leave(roomId);
    const room = rooms.get(roomId);
    if (!room) return;

    if (room.disconnectTimer) {
      clearTimeout(room.disconnectTimer);
      clearInterval(room.disconnectTimer);
      room.disconnectTimer = null;
    }

    const playerIdx = room.players.findIndex((p) => p.id === socket.id);
    if (playerIdx !== -1) {
      const leavingPlayer = room.players[playerIdx];
      leavingPlayer.isConnected = false;

      // If still in waiting lobby
      if (room.status === "waiting") {
        room.players.splice(playerIdx, 1);
        if (room.players.length === 0) {
          rooms.delete(roomId);
        } else {
          io.to(roomId).emit("room:opponent_left", {
            message: `${leavingPlayer.name} left the room.`,
          });
        }
      } else if (room.status === "finished") {
        room.players = room.players.filter((p) => p.id !== socket.id);
        if (
          room.players.length === 0 ||
          room.players.every((p) => !p.isConnected || p.isAI)
        ) {
          rooms.delete(roomId);
        }
      }
    }
  });

  // Handle player mobile screen lock / tab backgrounded
  socket.on("player:backgrounded", ({ roomId }) => {
    if (!roomId) return;
    const room = rooms.get(roomId);
    if (!room) return;

    const player = room.players.find((p) => p.id === socket.id);
    if (!player) return;

    player.isAway = true;
    player.awayAt = Date.now();
    triggerMatchPause(io, room, player);
  });

  // Handle player mobile screen unlock / tab foregrounded
  socket.on("player:foregrounded", ({ roomId }) => {
    if (!roomId) return;
    const room = rooms.get(roomId);
    if (!room) return;

    const player = room.players.find((p) => p.id === socket.id);
    if (!player) return;

    player.isAway = false;
    player.awayAt = null;

    const allActive =
      room.players.length === 2 &&
      room.players.every((p) => p.isConnected && !p.isAway);

    if (allActive && room.status === "paused") {
      if (room.disconnectTimer) {
        clearInterval(room.disconnectTimer);
        room.disconnectTimer = null;
      }
      room.pauseSecondsLeft = 30;
      room.status = "playing";
      io.to(roomId).emit("match:resumed", {
        message: `${player.name} returned! Match resumed.`,
      });
    }

    sendUpdateToAllPlayers(io, room);
  });

  // Handle socket disconnection with 30s/60s grace periods
  socket.on("disconnect", () => {
    for (const [roomId, room] of rooms.entries()) {
      const playerIndex = room.players.findIndex((p) => p.id === socket.id);
      if (playerIndex === -1) continue;

      const player = room.players[playerIndex];

      // 1. If in waiting lobby: do NOT delete immediately! Allow 60s for host to refresh/reconnect
      if (room.status === "waiting") {
        player.isConnected = false;
        player.disconnectedAt = Date.now();

        if (room.disconnectTimer) {
          clearTimeout(room.disconnectTimer);
          room.disconnectTimer = null;
        }

        room.disconnectTimer = setTimeout(() => {
          const currentRoom = rooms.get(roomId);
          if (currentRoom && currentRoom.status === "waiting") {
            const hasConnectedPlayer = currentRoom.players.some((p) => p.isConnected);
            if (!hasConnectedPlayer) {
              rooms.delete(roomId);
            }
          }
        }, 60000);
        break;
      }

      // 2. If match concluded, or only 1 player in finished room
      if (
        room.status === "finished" ||
        (room.status !== "playing" && room.status !== "paused")
      ) {
        room.players.splice(playerIndex, 1);
        if (room.players.length === 0) {
          rooms.delete(roomId);
        } else {
          const remaining = room.players[0];
          if (remaining) {
            remaining.board = generateBoard();
            remaining.marks = [];
            remaining.bingoLetters = [];
            remaining.isConnected = true;
          }
          room.status = "waiting";
          room.winner = null;
          room.winnerReason = null;
          room.winnerMessage = null;
          room.gameTime = 0;
          room.lastNumber = null;
          room.calledHistory = [];

          io.to(roomId).emit("player:disconnect");

          if (remaining && remaining.isConnected) {
            io.to(remaining.id).emit("game:start", {
              players: getPersonalizedPlayers(room, remaining.id),
              currentTurn: 0,
              startTime: null,
              lastNumber: null,
              calledHistory: [],
            });
          }
        }
        break;
      }

      // If match was in progress or paused
      if (room.status === "playing" || room.status === "paused") {
        const hasAI = room.players.some((p) => p.isAI);
        if (hasAI) {
          rooms.delete(roomId);
          break;
        }

        player.isConnected = false;
        player.disconnectedAt = Date.now();
        triggerMatchPause(io, room, player);
        break;
      }
    }
  });
}
