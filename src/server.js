import "dotenv/config";
import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import cors from "cors";

const app = express();
const httpServer = createServer(app);

// Parse allowed client origins from environment
const rawOrigins = process.env.CLIENT_ORIGIN
  ? process.env.CLIENT_ORIGIN.split(",")
      .map((s) => s.trim())
      .filter(Boolean)
  : [];

// Include both trimmed and trailing-slash variants to ensure seamless CORS matching
const allowedOrigins =
  rawOrigins.length > 0
    ? Array.from(
        new Set(
          rawOrigins.flatMap((s) => [
            s.replace(/\/+$/, ""),
            `${s.replace(/\/+$/, "")}/`,
          ]),
        ),
      )
    : "*";

const corsOptions = {
  origin: allowedOrigins,
  methods: ["GET", "POST"],
  credentials: true,
};

const io = new Server(httpServer, {
  cors: corsOptions,
});

app.use(cors(corsOptions));
app.use(express.json());

// Game state storage
const rooms = new Map();

// BINGO letters in order
const BINGO_LETTERS = ["B", "I", "N", "G", "O"];

// Short room ID generator (similar to Google Meet)
const ADJECTIVES = [
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

const NOUNS = [
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

const NUMBERS = "0123456789";

// Generate short, memorable room ID
function generateShortRoomId() {
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

// AI Strategy Classes
class AIStrategy {
  constructor(name, description, priority = 5) {
    this.name = name;
    this.description = description;
    this.priority = priority;
  }

  selectNumber(availableNumbers, playerBoard, playerMarks, opponentMarks) {
    return availableNumbers[
      Math.floor(Math.random() * availableNumbers.length)
    ];
  }

  getRowNumbers(row, board) {
    return Array.from({ length: 5 }, (_, col) => board[row * 5 + col]);
  }

  getColumnNumbers(col, board) {
    return Array.from({ length: 5 }, (_, row) => board[row * 5 + col]);
  }

  randomSelection(availableNumbers) {
    return availableNumbers[
      Math.floor(Math.random() * availableNumbers.length)
    ];
  }
}

// Random Strategy
class RandomStrategy extends AIStrategy {
  constructor(name) {
    super(name, "Plays completely randomly", 1);
  }

  selectNumber(availableNumbers) {
    return this.randomSelection(availableNumbers);
  }
}

// Row Strategy (Alice)
class RowStrategy extends AIStrategy {
  constructor(name) {
    super(name, "Completes rows from top to bottom", 6);
  }

  selectNumber(availableNumbers, playerBoard, playerMarks) {
    // Complete rows from top to bottom
    for (let row = 0; row < 5; row++) {
      const rowNumbers = this.getRowNumbers(row, playerBoard);
      const availableInRow = rowNumbers.filter(
        (num) => availableNumbers.includes(num) && !playerMarks.includes(num),
      );
      if (availableInRow.length > 0) {
        return availableInRow[0];
      }
    }
    return this.randomSelection(availableNumbers);
  }
}

// Column Strategy (Mike)
class ColumnStrategy extends AIStrategy {
  constructor(name) {
    super(name, "Completes columns from left to right", 6);
  }

  selectNumber(availableNumbers, playerBoard, playerMarks) {
    // Complete columns from left to right
    for (let col = 0; col < 5; col++) {
      const colNumbers = this.getColumnNumbers(col, playerBoard);
      const availableInCol = colNumbers.filter(
        (num) => availableNumbers.includes(num) && !playerMarks.includes(num),
      );
      if (availableInCol.length > 0) {
        return availableInCol[0];
      }
    }
    return this.randomSelection(availableNumbers);
  }
}

// Boundary Strategy (Lisa)
class BoundaryStrategy extends AIStrategy {
  constructor(name) {
    super(name, "Focuses on outer edges first", 7);
  }

  selectNumber(availableNumbers, playerBoard, playerMarks) {
    const boundaryPositions = [
      // Top row
      ...Array.from({ length: 5 }, (_, i) => i),
      // Bottom row
      ...Array.from({ length: 5 }, (_, i) => 20 + i),
      // Left column
      ...Array.from({ length: 5 }, (_, i) => i * 5),
      // Right column
      ...Array.from({ length: 5 }, (_, i) => i * 5 + 4),
    ];

    // Remove duplicates and get unique boundary positions
    const uniqueBoundary = [...new Set(boundaryPositions)];

    for (const pos of uniqueBoundary) {
      const num = playerBoard[pos];
      if (availableNumbers.includes(num) && !playerMarks.includes(num)) {
        return num;
      }
    }

    return this.randomSelection(availableNumbers);
  }
}

// Diagonal Strategy (Anna)
class DiagonalStrategy extends AIStrategy {
  constructor(name) {
    super(name, "Completes diagonals first", 8);
  }

  selectNumber(availableNumbers, playerBoard, playerMarks) {
    // Get diagonal positions (these are board positions, not numbers)
    const mainDiagonalPositions = [0, 6, 12, 18, 24]; // Top-left to bottom-right
    const antiDiagonalPositions = [4, 8, 12, 16, 20]; // Top-right to bottom-left

    // Check main diagonal first
    for (const pos of mainDiagonalPositions) {
      const num = playerBoard[pos];
      if (availableNumbers.includes(num) && !playerMarks.includes(num)) {
        return num;
      }
    }

    // Check anti-diagonal
    for (const pos of antiDiagonalPositions) {
      const num = playerBoard[pos];
      if (availableNumbers.includes(num) && !playerMarks.includes(num)) {
        return num;
      }
    }

    return this.randomSelection(availableNumbers);
  }
}

// Corner Strategy (Tom)
class CornerStrategy extends AIStrategy {
  constructor(name) {
    super(name, "Focuses on corners first", 5);
  }

  selectNumber(availableNumbers, playerBoard, playerMarks) {
    const corners = [0, 4, 20, 24]; // Top-left, top-right, bottom-left, bottom-right

    // Check corners first
    for (const pos of corners) {
      const num = playerBoard[pos];
      if (availableNumbers.includes(num) && !playerMarks.includes(num)) {
        return num;
      }
    }

    // Check edges
    const edges = [
      // Top and bottom edges
      ...Array.from({ length: 5 }, (_, i) => i),
      ...Array.from({ length: 5 }, (_, i) => 20 + i),
      // Left and right edges
      ...Array.from({ length: 5 }, (_, i) => i * 5),
      ...Array.from({ length: 5 }, (_, i) => i * 5 + 4),
    ];

    for (const pos of edges) {
      const num = playerBoard[pos];
      if (availableNumbers.includes(num) && !playerMarks.includes(num)) {
        return num;
      }
    }

    return this.randomSelection(availableNumbers);
  }
}

// Center Strategy (Emma)
class CenterStrategy extends AIStrategy {
  constructor(name) {
    super(name, "Starts from center and works outward", 6);
  }

  selectNumber(availableNumbers, playerBoard, playerMarks) {
    const centerPositions = [
      12, // Center
      7,
      8,
      9,
      11,
      13,
      15,
      16,
      17, // Around center
      2,
      3,
      4,
      6,
      10,
      14,
      18,
      22,
      23,
      24, // Outer ring
      1,
      5,
      21,
      25, // Corners
    ];

    for (const pos of centerPositions) {
      const num = playerBoard[pos];
      if (availableNumbers.includes(num) && !playerMarks.includes(num)) {
        return num;
      }
    }

    return this.randomSelection(availableNumbers);
  }
}

// Smart AI Strategy - Truly intelligent opponent
class SmartAIStrategy extends AIStrategy {
  constructor(name) {
    super(
      name,
      "Intelligent AI that analyzes game state and adapts strategy",
      10,
    );
  }

  selectNumber(availableNumbers, playerBoard, playerMarks, opponentMarks) {
    // Analyze current game state
    const gameState = this.analyzeGameState(
      playerBoard,
      playerMarks,
      opponentMarks,
    );

    // Get all possible lines and their states
    const playerLines = this.getAllLineStates(playerBoard, playerMarks);
    const opponentLines = this.getAllLineStates(playerBoard, opponentMarks);

    // 1. CRITICAL DEFENSE: Block opponent if they're about to win
    const criticalBlock = this.findCriticalBlock(
      availableNumbers,
      opponentLines,
      playerBoard,
    );
    if (criticalBlock !== null) {
      return criticalBlock;
    }

    // 2. WINNING MOVE: Complete our own line if possible
    const winningMove = this.findWinningMove(
      availableNumbers,
      playerLines,
      playerBoard,
    );
    if (winningMove !== null) {
      return winningMove;
    }

    // 3. DEFENSIVE PLAY: Block opponent's dangerous lines
    const defensiveMove = this.findDefensiveMove(
      availableNumbers,
      opponentLines,
      playerBoard,
    );
    if (defensiveMove !== null) {
      return defensiveMove;
    }

    // 4. OFFENSIVE PLAY: Advance our best lines
    const offensiveMove = this.findOffensiveMove(
      availableNumbers,
      playerLines,
      playerBoard,
      gameState,
    );
    if (offensiveMove !== null) {
      return offensiveMove;
    }

    // 5. STRATEGIC PLAY: Choose numbers that contribute to multiple lines
    const strategicMove = this.findStrategicMove(
      availableNumbers,
      playerLines,
      playerBoard,
    );
    if (strategicMove !== null) {
      return strategicMove;
    }

    // 6. Fallback to random
    return this.randomSelection(availableNumbers);
  }

  analyzeGameState(playerBoard, playerMarks, opponentMarks) {
    const totalNumbers = playerMarks.length;
    const playerCompletedLines = this.getCompletedLinesCount(
      playerBoard,
      playerMarks,
    );
    const opponentCompletedLines = this.getCompletedLinesCount(
      playerBoard,
      opponentMarks,
    );

    let phase = "early";
    if (totalNumbers > 15) phase = "late";
    else if (totalNumbers > 8) phase = "mid";

    return {
      phase,
      totalNumbers,
      playerCompletedLines,
      opponentCompletedLines,
      isPlayerAhead: playerCompletedLines > opponentCompletedLines,
      isOpponentThreatening: opponentCompletedLines >= 3,
    };
  }

  getAllLineStates(board, marks) {
    const lines = [];

    // Horizontal lines (rows)
    for (let i = 0; i < 5; i++) {
      const line = Array.from({ length: 5 }, (_, j) => i * 5 + j);
      lines.push(this.analyzeLineState(board, marks, line, `row_${i}`));
    }

    // Vertical lines (columns)
    for (let i = 0; i < 5; i++) {
      const line = Array.from({ length: 5 }, (_, j) => i + j * 5);
      lines.push(this.analyzeLineState(board, marks, line, `col_${i}`));
    }

    // Diagonals
    const diag1 = [0, 6, 12, 18, 24];
    const diag2 = [4, 8, 12, 16, 20];
    lines.push(this.analyzeLineState(board, marks, diag1, "diag_main"));
    lines.push(this.analyzeLineState(board, marks, diag2, "diag_anti"));

    return lines;
  }

  analyzeLineState(board, marks, positions, lineId) {
    const numbers = positions.map((pos) => board[pos]);
    const markedCount = numbers.filter((num) => marks.includes(num)).length;
    const remainingNumbers = numbers.filter((num) => !marks.includes(num));

    return {
      id: lineId,
      positions,
      numbers,
      markedCount,
      remainingNumbers,
      isComplete: markedCount === 5,
      isOneMoveFromWin: markedCount === 4 && remainingNumbers.length === 1,
      isTwoMovesFromWin: markedCount === 3 && remainingNumbers.length === 2,
      progress: markedCount / 5,
    };
  }

  getCompletedLinesCount(board, marks) {
    return this.getAllLineStates(board, marks).filter((line) => line.isComplete)
      .length;
  }

  findCriticalBlock(availableNumbers, opponentLines, board) {
    // Find opponent lines that are one move away from completion
    const criticalLines = opponentLines.filter((line) => line.isOneMoveFromWin);

    for (const line of criticalLines) {
      const blockingNumber = line.remainingNumbers[0];
      if (availableNumbers.includes(blockingNumber)) {
        return blockingNumber;
      }
    }

    return null;
  }

  findWinningMove(availableNumbers, playerLines, board) {
    // Find our lines that are one move away from completion
    const winningLines = playerLines.filter((line) => line.isOneMoveFromWin);

    for (const line of winningLines) {
      const winningNumber = line.remainingNumbers[0];
      if (availableNumbers.includes(winningNumber)) {
        return winningNumber;
      }
    }

    return null;
  }

  findDefensiveMove(availableNumbers, opponentLines, board) {
    // Block opponent lines that are two moves away (if we're ahead or threatened)
    const dangerousLines = opponentLines.filter(
      (line) => line.isTwoMovesFromWin,
    );

    if (dangerousLines.length === 0) return null;

    // Score each available number by how many dangerous lines it blocks
    const numberScores = new Map();

    for (const number of availableNumbers) {
      let score = 0;
      for (const line of dangerousLines) {
        if (line.remainingNumbers.includes(number)) {
          // Higher score for lines with more progress
          score += line.progress * 2;
        }
      }
      if (score > 0) {
        numberScores.set(number, score);
      }
    }

    if (numberScores.size > 0) {
      // Return the number that blocks the most dangerous lines
      const bestNumber = Array.from(numberScores.entries()).sort(
        (a, b) => b[1] - a[1],
      )[0][0];
      return bestNumber;
    }

    return null;
  }

  findOffensiveMove(availableNumbers, playerLines, board, gameState) {
    // Focus on our most promising lines
    const promisingLines = playerLines
      .filter((line) => !line.isComplete && line.markedCount >= 1)
      .sort((a, b) => b.progress - a.progress);

    if (promisingLines.length === 0) return null;

    // Score available numbers by their contribution to our lines
    const numberScores = new Map();

    for (const number of availableNumbers) {
      let score = 0;
      let lineContributions = 0;

      for (const line of promisingLines) {
        if (line.remainingNumbers.includes(number)) {
          lineContributions++;
          // Higher score for lines closer to completion
          score += Math.pow(line.progress, 2) * 10;

          // Bonus for lines that would become winnable in one more move
          if (line.markedCount === 3) {
            score += 15;
          }
        }
      }

      // Bonus for numbers that contribute to multiple lines
      if (lineContributions > 1) {
        score += lineContributions * 5;
      }

      if (score > 0) {
        numberScores.set(number, score);
      }
    }

    if (numberScores.size > 0) {
      const bestNumber = Array.from(numberScores.entries()).sort(
        (a, b) => b[1] - a[1],
      )[0][0];
      return bestNumber;
    }

    return null;
  }

  findStrategicMove(availableNumbers, playerLines, board) {
    // Look for numbers that appear in multiple unstarted lines
    const unstartedLines = playerLines.filter((line) => line.markedCount === 0);

    if (unstartedLines.length === 0) return null;

    const numberAppearances = new Map();

    for (const line of unstartedLines) {
      for (const number of line.numbers) {
        if (availableNumbers.includes(number)) {
          numberAppearances.set(
            number,
            (numberAppearances.get(number) || 0) + 1,
          );
        }
      }
    }

    if (numberAppearances.size > 0) {
      // Prefer numbers that appear in multiple lines
      const bestNumbers = Array.from(numberAppearances.entries())
        .filter(([num, count]) => count > 1)
        .sort((a, b) => b[1] - a[1]);

      if (bestNumbers.length > 0) {
        return bestNumbers[0][0];
      }

      // If no number appears multiple times, pick from center positions
      const centerPositions = [12, 7, 8, 9, 11, 13, 15, 16, 17];
      for (const pos of centerPositions) {
        const number = board[pos];
        if (availableNumbers.includes(number)) {
          return number;
        }
      }
    }

    return null;
  }
}

// AI Strategy Manager
class AIStrategyManager {
  constructor() {
    this.strategies = new Map();
    this.registerStrategies();
  }

  registerStrategies() {
    // Random strategies
    this.strategies.set("random", new RandomStrategy("Random Player"));

    // Pattern strategies
    this.strategies.set("alice", new RowStrategy("Alice"));
    this.strategies.set("mike", new ColumnStrategy("Mike"));
    this.strategies.set("lisa", new BoundaryStrategy("Lisa"));
    this.strategies.set("anna", new DiagonalStrategy("Anna"));
    this.strategies.set("tom", new CornerStrategy("Tom"));
    this.strategies.set("emma", new CenterStrategy("Emma"));

    // Smart AI strategy
    this.strategies.set("smart", new SmartAIStrategy("Smart AI"));
  }

  getStrategy(strategyName) {
    return this.strategies.get(strategyName);
  }

  getRandomStrategy() {
    const strategyNames = Array.from(this.strategies.keys());
    const randomName =
      strategyNames[Math.floor(Math.random() * strategyNames.length)];
    return this.strategies.get(randomName);
  }

  getRandomPlayOpponents() {
    const randomNames = [
      "Jake",
      "Sara",
      "Alex",
      "Zoe",
      "Max",
      "Luna",
      "Rio",
      "Nova",
      "Kai",
      "Maya",
    ];
    return randomNames[Math.floor(Math.random() * randomNames.length)];
  }

  getSmartAIOpponents() {
    const smartNames = [
      "Neo",
      "Sage",
      "Apex",
      "Zen",
      "Nova",
      "Echo",
      "Void",
      "Prism",
      "Quantum",
      "Matrix",
    ];
    return smartNames[Math.floor(Math.random() * smartNames.length)];
  }
}

const aiManager = new AIStrategyManager();

// Create AI Player
function createAIPlayer(aiOpponent) {
  let aiName, aiStrategy;

  if (aiOpponent.type === "random") {
    aiName = aiManager.getRandomPlayOpponents();
    aiStrategy = aiManager.getStrategy("random");
  } else if (aiOpponent.type === "pattern") {
    if (aiOpponent.specific && aiOpponent.specific !== "random") {
      // Specific pattern opponent (Alice, Mike, etc.)
      aiName = aiOpponent.specific;
      aiStrategy = aiManager.getStrategy(aiOpponent.specific.toLowerCase());
    } else {
      // Random pattern opponent - select any pattern player
      const patternOpponents = ["alice", "mike", "lisa", "anna", "tom", "emma"];
      const randomPattern =
        patternOpponents[Math.floor(Math.random() * patternOpponents.length)];
      aiName = randomPattern.charAt(0).toUpperCase() + randomPattern.slice(1);
      aiStrategy = aiManager.getStrategy(randomPattern);
    }
  } else if (aiOpponent.type === "smart") {
    aiName = aiManager.getSmartAIOpponents();
    aiStrategy = aiManager.getStrategy("smart"); // Now uses truly smart strategy
  } else {
    // Default to random
    aiName = aiManager.getRandomPlayOpponents();
    aiStrategy = aiManager.getStrategy("random");
  }

  return {
    id: `ai_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    name: aiName,
    board: generateBoard(),
    marks: [],
    bingoLetters: [],
    isAI: true,
    strategy: aiStrategy,
  };
}

// AI Move Logic
function makeAIMove(room, aiPlayer) {
  if (!room || room.status !== "playing" || room.players.length < 2) return;
  if (!aiPlayer || !aiPlayer.isAI || !aiPlayer.strategy) return;

  // Get available numbers (1-25 that haven't been marked by anyone)
  const allMarkedNumbers = new Set();
  room.players.forEach((player) => {
    player.marks.forEach((mark) => allMarkedNumbers.add(mark));
  });

  const availableNumbers = [];
  for (let i = 1; i <= 25; i++) {
    if (!allMarkedNumbers.has(i)) {
      availableNumbers.push(i);
    }
  }

  if (availableNumbers.length === 0) return;

  const humanPlayer = room.players.find((p) => !p.isAI);
  const opponentMarks = humanPlayer?.marks || [];

  const selectedNumber = aiPlayer.strategy.selectNumber(
    availableNumbers,
    aiPlayer.board,
    aiPlayer.marks,
    opponentMarks,
  );

  // Mark for both players
  room.players.forEach((player) => {
    if (!player.marks.includes(selectedNumber)) {
      player.marks.push(selectedNumber);
    }
  });

  room.lastNumber = selectedNumber;
  if (!room.calledHistory) room.calledHistory = [];
  room.calledHistory.unshift(selectedNumber);
  if (room.calledHistory.length > 5) {
    room.calledHistory = room.calledHistory.slice(0, 5);
  }
  room.currentTurn = (room.currentTurn + 1) % 2;

  // Update BINGO letters
  updateBingoLetters(aiPlayer);
  if (humanPlayer) updateBingoLetters(humanPlayer);

  const aiWon = checkWin(aiPlayer);
  const humanWon = humanPlayer ? checkWin(humanPlayer) : false;

  // Broadcast the move
  sendUpdateToAllPlayers(room);

  // Check for win
  if (aiWon || humanWon) {
    const winner = aiWon ? aiPlayer : humanPlayer;
    room.status = "finished";
    const gameTimeInSeconds = Math.floor(
      (Date.now() - (room.startTime || Date.now())) / 1000,
    );
    room.gameTime = gameTimeInSeconds;

    setTimeout(() => {
      for (const [id, r] of rooms.entries()) {
        if (r === room) {
          io.to(id).emit("game:win", {
            winner: winner.name,
            gameTime: gameTimeInSeconds,
            message: `${winner.name} has completed B-I-N-G-O!`,
          });
          break;
        }
      }
    }, 1000);
  }
}

// Generate a random board (1-25)
function generateBoard() {
  const numbers = Array.from({ length: 25 }, (_, i) => i + 1);
  for (let i = numbers.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [numbers[i], numbers[j]] = [numbers[j], numbers[i]];
  }
  return numbers;
}

// Check if a line is complete
function checkLine(board, marks, line) {
  return line.every((pos) => marks.includes(board[pos]));
}

// Get all completed lines
function getCompletedLines(board, marks) {
  let completedLines = [];

  // Horizontal lines
  for (let i = 0; i < 5; i++) {
    const line = Array.from({ length: 5 }, (_, j) => i * 5 + j);
    if (checkLine(board, marks, line)) {
      completedLines.push(line);
    }
  }

  // Vertical lines
  for (let i = 0; i < 5; i++) {
    const line = Array.from({ length: 5 }, (_, j) => i + j * 5);
    if (checkLine(board, marks, line)) {
      completedLines.push(line);
    }
  }

  // Diagonals
  const diag1 = [0, 6, 12, 18, 24];
  const diag2 = [4, 8, 12, 16, 20];
  if (checkLine(board, marks, diag1)) completedLines.push(diag1);
  if (checkLine(board, marks, diag2)) completedLines.push(diag2);

  return completedLines;
}

// Update player's BINGO letters based on completed lines
function updateBingoLetters(player) {
  const completedLines = getCompletedLines(player.board, player.marks);

  // Only update if we have more completed lines than current BINGO letters
  if (completedLines.length > player.bingoLetters.length) {
    // Award new letters based on the number of newly completed lines
    while (
      player.bingoLetters.length < completedLines.length &&
      player.bingoLetters.length < BINGO_LETTERS.length
    ) {
      player.bingoLetters.push(BINGO_LETTERS[player.bingoLetters.length]);
    }
  }

  // Return true only if we have all 5 BINGO letters
  return player.bingoLetters.length === BINGO_LETTERS.length;
}

// Check for winning conditions
function checkWin(player) {
  return updateBingoLetters(player);
}

// Room ID validation endpoint
app.post("/api/validate-room", (req, res) => {
  const { roomId } = req.body;

  if (!roomId) {
    return res.json({ valid: false, error: "Room ID is required" });
  }

  // Check format
  if (roomId.length < 3 || roomId.length > 16) {
    return res.json({
      valid: false,
      error: "Room ID must be 3-16 characters long",
    });
  }

  if (!/^[A-Za-z0-9-]+$/.test(roomId)) {
    return res.json({
      valid: false,
      error: "Room ID can only contain letters, numbers, and hyphens",
    });
  }

  // Check if room exists
  const roomExists = rooms.has(roomId.toUpperCase());

  res.json({
    valid: !roomExists,
    exists: roomExists,
    error: roomExists ? "Room ID already exists" : null,
  });
});

// Helper to generate personalized player payloads for a recipient socket
function getPersonalizedPlayers(room, recipientSocketId) {
  return room.players.map((p, idx) => ({
    id: p.id,
    sessionKey: p.sessionKey,
    name: p.name,
    board: p.id === recipientSocketId ? p.board : null,
    marks: p.id === recipientSocketId ? p.marks : p.marks || [],
    bingoLetters: p.bingoLetters,
    isAI: p.isAI || false,
    isConnected: p.isConnected,
    isYou: p.id === recipientSocketId,
    playerIndex: idx,
  }));
}

function sendStartToPlayer(room, socketId) {
  const isPaused = room.status === "paused";
  const disconnectedOpponent = isPaused
    ? room.players.find((p) => !p.isConnected)
    : null;

  io.to(socketId).emit("game:start", {
    players: getPersonalizedPlayers(room, socketId),
    currentTurn: room.currentTurn,
    startTime: room.startTime,
    lastNumber: room.lastNumber,
    calledHistory: room.calledHistory || [],
    isPaused,
    disconnectedPlayerName: disconnectedOpponent
      ? disconnectedOpponent.name
      : "",
    timeoutSeconds: room.pauseSecondsLeft || 30,
  });
}

function sendStartToAllPlayers(room) {
  room.players.forEach((player) => {
    if (!player.isConnected || player.isAI) return;
    sendStartToPlayer(room, player.id);
  });
}

function sendUpdateToAllPlayers(room) {
  room.players.forEach((player) => {
    if (!player.isConnected || player.isAI) return;
    io.to(player.id).emit("game:update", {
      players: getPersonalizedPlayers(room, player.id),
      currentTurn: room.currentTurn,
      lastNumber: room.lastNumber,
      calledHistory: room.calledHistory || [],
    });
  });
}

io.on("connection", (socket) => {
  // Create a new room
  socket.on(
    "room:create",
    ({ playerName, customRoomId, aiOpponent }, callback) => {
      console.log("Room create request:", {
        playerName,
        customRoomId,
        aiOpponent,
      });
      let roomId;

      if (customRoomId) {
        // Validate custom room ID
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
        // Generate short memorable room ID
        roomId = generateShortRoomId();
        // Ensure uniqueness
        while (rooms.has(roomId)) {
          roomId = generateShortRoomId();
        }
      }

      const sessionKey = `${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      const room = {
        roomId,
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
        console.log("Creating AI opponent:", aiOpponent);
        const aiPlayer = createAIPlayer(aiOpponent);
        console.log("AI player created:", aiPlayer);
        room.players.push(aiPlayer);
        room.aiOpponent = aiOpponent;

        // Start game immediately with AI opponent
        const startTimeNow = Date.now();
        room.startTime = startTimeNow;

        sendStartToAllPlayers(room);

        // If AI opponent exists and it's AI's turn, make AI move
        const aiPlayerForMove = room.players.find((p) => p.isAI);
        if (
          aiPlayerForMove &&
          room.currentTurn === room.players.indexOf(aiPlayerForMove)
        ) {
          setTimeout(() => {
            makeAIMove(room, aiPlayerForMove);
          }, 2000); // 2 second delay for AI move
        }
      }

      rooms.set(roomId, room);
      socket.join(roomId);
      callback({ roomId, sessionKey });
    },
  );

  // Join an existing room
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
          board: oldPlayer.board, // Inherits original board
          marks: [...oldPlayer.marks], // Inherits marks
          bingoLetters: [...oldPlayer.bingoLetters], // Inherits letters
          isAI: false,
          isConnected: true,
          disconnectedAt: null,
        };

        if (room.disconnectTimer) {
          clearInterval(room.disconnectTimer);
          room.disconnectTimer = null;
        }
        room.pauseSecondsLeft = 30;
        // In-place slot replacement preserves array index & currentTurn!
        room.players[vacantIndex] = substitutePlayer;
        room.status = "playing";
        socket.join(roomId);

        // Notify the room that substitute joined and match resumed
        io.to(roomId).emit("match:resumed", {
          message: `${playerName} joined as substitute! Match resumed.`,
          substituteName: playerName,
        });

        // Send personalized game state to the substitute
        sendStartToPlayer(room, socket.id);

        // Send updated player state to opponent
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

      // Start the game if we now have 2 players
      if (room.players.length === 2) {
        room.status = "playing";
        const startTimeNow = Date.now();
        console.log("Game starting with time:", startTimeNow);
        room.startTime = startTimeNow;
        room.currentTurn = 0;
        room.lastNumber = null;
        room.calledHistory = [];
        room.winner = null;
        room.winnerReason = null;
        room.winnerMessage = null;
        room.gameTime = 0;

        // Reset ALL players' boards, marks, and letters for a 100% fresh match
        room.players.forEach((p) => {
          p.board = generateBoard();
          p.marks = [];
          p.bingoLetters = [];
          p.isConnected = true;
          p.disconnectedAt = null;
        });

        sendStartToAllPlayers(room);
      }

      callback({ success: true, sessionKey });
    },
  );

  // Handle a player's turn
  socket.on("turn:click", ({ roomId, number }) => {
    const room = rooms.get(roomId);
    if (!room || room.status !== "playing") return;

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
      const gameTimeInSeconds = Math.floor(
        (Date.now() - (room.startTime || Date.now())) / 1000,
      );
      room.gameTime = gameTimeInSeconds;
      room.status = "finished";
      room.winner = winner.name;
      room.winnerReason = "bingo";
      room.winnerMessage = `${winner.name} has completed B-I-N-G-O!`;

      // First send the final board update to reflect the last move
      sendUpdateToAllPlayers(room);

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
      sendUpdateToAllPlayers(room);

      // If it's AI's turn, make AI move
      const aiPlayerForMove = room.players.find((p) => p.isAI);
      if (
        aiPlayerForMove &&
        room.currentTurn === room.players.indexOf(aiPlayerForMove)
      ) {
        setTimeout(() => {
          makeAIMove(room, aiPlayerForMove);
        }, 2000); // 2 second delay for AI move
      }
    }
  });

  // Handle player reconnecting with session
  socket.on(
    "room:reconnect",
    ({ roomId, sessionKey, playerName }, callback) => {
      const room = rooms.get(roomId);
      if (!room) {
        if (callback) callback({ error: "Room no longer exists" });
        return;
      }

      // Slot index is permanent! Look up by persistent sessionKey
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
      player.disconnectedAt = null;
      if (playerName) player.name = playerName;
      socket.join(roomId);

      // If match has already finished (e.g. opponent claimed forfeit while player was away)
      if (room.status === "finished") {
        sendStartToPlayer(room, socket.id);

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

      // Check if both players are now connected
      const allConnected =
        room.players.length === 2 && room.players.every((p) => p.isConnected);

      if (allConnected && room.status === "paused") {
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

      // Send game:start to reconnecting player with full state (including pause info if room is paused)
      sendStartToPlayer(room, socket.id);

      if (!allConnected && room.status === "paused") {
        // Confirm match:paused to ensure modal displays with latest secondsLeft
        const disconnectedOpponent = room.players.find((p) => !p.isConnected);
        socket.emit("match:paused", {
          disconnectedPlayerName: disconnectedOpponent
            ? disconnectedOpponent.name
            : "Opponent",
          timeoutSeconds: room.pauseSecondsLeft || 30,
        });
      }

      // Broadcast game:update to the opponent (if connected)
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

      if (callback) callback({ success: true, sessionKey });
    },
  );

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
      room.winnerReason = "forfeit";
      room.winnerMessage = `${leavingPlayer.name} exited the match. You win by forfeit!`;

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

  // Handle Player claiming forfeit while room is paused
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

  // Handle game reset
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
    room.currentTurn = 0;
    room.lastNumber = null;
    room.calledHistory = [];
    room.startTime = Number(Date.now());

    // If only 1 player remains in the room, transition to waiting lobby!
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

    // Both players (or human + AI) are connected: start a new match!
    room.status = "playing";
    sendStartToAllPlayers(room);
  });

  // Handle disconnection with 30s countdown grace period
  socket.on("disconnect", () => {
    for (const [roomId, room] of rooms.entries()) {
      const playerIndex = room.players.findIndex((p) => p.id === socket.id);
      if (playerIndex === -1) continue;

      const player = room.players[playerIndex];

      // If waiting in lobby, or match concluded (finished), or only 1 player in room
      if (
        room.status === "waiting" ||
        room.status === "finished" ||
        (room.status !== "playing" && room.status !== "paused")
      ) {
        room.players.splice(playerIndex, 1);
        if (room.players.length === 0) {
          rooms.delete(roomId);
        } else {
          // Reset remaining player's board & marks so they never carry into the next game
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

          // Also emit clean state to remaining player so client updates to waiting screen with fresh board
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

        // Mark player disconnected in their permanent slot - NEVER splice during match!
        player.isConnected = false;
        player.disconnectedAt = Date.now();
        room.status = "paused";

        // Notify remaining connected player if one exists
        const otherPlayer = room.players[1 - playerIndex];
        if (otherPlayer && otherPlayer.isConnected) {
          io.to(otherPlayer.id).emit("match:paused", {
            disconnectedPlayerName: player.name,
            timeoutSeconds: room.pauseSecondsLeft || 30,
          });
        }

        // Send updated player connectivity status to anyone still connected
        sendUpdateToAllPlayers(room);

        // If countdown timer not already running, start it
        if (!room.disconnectTimer) {
          room.pauseSecondsLeft = 30;
          room.disconnectTimer = setInterval(() => {
            room.pauseSecondsLeft -= 1;
            io.to(roomId).emit("match:pause_tick", {
              secondsLeft: room.pauseSecondsLeft,
            });

            if (room.pauseSecondsLeft <= 0) {
              clearInterval(room.disconnectTimer);
              room.disconnectTimer = null;

              const connectedPlayers = room.players.filter(
                (p) => p.isConnected,
              );
              if (connectedPlayers.length === 1) {
                const winner = connectedPlayers[0];
                const loser = room.players.find((p) => !p.isConnected);
                const gameTimeInSeconds = Math.max(
                  1,
                  Math.floor((Date.now() - (room.startTime || Date.now())) / 1000),
                );
                room.gameTime = gameTimeInSeconds;
                room.status = "finished";
                room.winner = winner.name;
                room.winnerReason = "timeout";
                room.winnerMessage = `${loser ? loser.name : "Opponent"} failed to reconnect. Victory by forfeit!`;
                io.to(roomId).emit("game:win", {
                  winner: winner.name,
                  reason: "timeout",
                  message: `${loser ? loser.name : "Opponent"} failed to reconnect. Victory by forfeit!`,
                  gameTime: gameTimeInSeconds,
                });
              } else {
                rooms.delete(roomId);
              }
            }
          }, 1000);
        }

        break;
      }
    }
  });
});

const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

// Export for testing
export { SmartAIStrategy };
