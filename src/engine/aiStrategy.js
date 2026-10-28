import { generateBoard, updateBingoLetters, checkWin } from "./boardEngine.js";

// Base AI Strategy Class
export class AIStrategy {
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
export class RandomStrategy extends AIStrategy {
  constructor(name) {
    super(name, "Plays completely randomly", 1);
  }

  selectNumber(availableNumbers) {
    return this.randomSelection(availableNumbers);
  }
}

// Row Strategy (Alice)
export class RowStrategy extends AIStrategy {
  constructor(name) {
    super(name, "Completes rows from top to bottom", 6);
  }

  selectNumber(availableNumbers, playerBoard, playerMarks) {
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
export class ColumnStrategy extends AIStrategy {
  constructor(name) {
    super(name, "Completes columns from left to right", 6);
  }

  selectNumber(availableNumbers, playerBoard, playerMarks) {
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
export class BoundaryStrategy extends AIStrategy {
  constructor(name) {
    super(name, "Focuses on outer edges first", 7);
  }

  selectNumber(availableNumbers, playerBoard, playerMarks) {
    const boundaryPositions = [
      ...Array.from({ length: 5 }, (_, i) => i),
      ...Array.from({ length: 5 }, (_, i) => 20 + i),
      ...Array.from({ length: 5 }, (_, i) => i * 5),
      ...Array.from({ length: 5 }, (_, i) => i * 5 + 4),
    ];

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
export class DiagonalStrategy extends AIStrategy {
  constructor(name) {
    super(name, "Completes diagonals first", 8);
  }

  selectNumber(availableNumbers, playerBoard, playerMarks) {
    const mainDiagonalPositions = [0, 6, 12, 18, 24];
    const antiDiagonalPositions = [4, 8, 12, 16, 20];

    for (const pos of mainDiagonalPositions) {
      const num = playerBoard[pos];
      if (availableNumbers.includes(num) && !playerMarks.includes(num)) {
        return num;
      }
    }

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
export class CornerStrategy extends AIStrategy {
  constructor(name) {
    super(name, "Focuses on corners first", 5);
  }

  selectNumber(availableNumbers, playerBoard, playerMarks) {
    const corners = [0, 4, 20, 24];

    for (const pos of corners) {
      const num = playerBoard[pos];
      if (availableNumbers.includes(num) && !playerMarks.includes(num)) {
        return num;
      }
    }

    const edges = [
      ...Array.from({ length: 5 }, (_, i) => i),
      ...Array.from({ length: 5 }, (_, i) => 20 + i),
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
export class CenterStrategy extends AIStrategy {
  constructor(name) {
    super(name, "Starts from center and works outward", 6);
  }

  selectNumber(availableNumbers, playerBoard, playerMarks) {
    const centerPositions = [
      12, 7, 8, 9, 11, 13, 15, 16, 17, 2, 3, 4, 6, 10, 14, 18, 22, 23, 24, 1, 5, 21, 25,
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
export class SmartAIStrategy extends AIStrategy {
  constructor(name) {
    super(
      name,
      "Intelligent AI that analyzes game state and adapts strategy",
      10,
    );
  }

  selectNumber(availableNumbers, playerBoard, playerMarks, opponentMarks) {
    const gameState = this.analyzeGameState(
      playerBoard,
      playerMarks,
      opponentMarks,
    );

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
    const dangerousLines = opponentLines.filter(
      (line) => line.isTwoMovesFromWin,
    );

    if (dangerousLines.length === 0) return null;

    const numberScores = new Map();

    for (const number of availableNumbers) {
      let score = 0;
      for (const line of dangerousLines) {
        if (line.remainingNumbers.includes(number)) {
          score += line.progress * 2;
        }
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

  findOffensiveMove(availableNumbers, playerLines, board, gameState) {
    const promisingLines = playerLines
      .filter((line) => !line.isComplete && line.markedCount >= 1)
      .sort((a, b) => b.progress - a.progress);

    if (promisingLines.length === 0) return null;

    const numberScores = new Map();

    for (const number of availableNumbers) {
      let score = 0;
      let lineContributions = 0;

      for (const line of promisingLines) {
        if (line.remainingNumbers.includes(number)) {
          lineContributions++;
          score += Math.pow(line.progress, 2) * 10;

          if (line.markedCount === 3) {
            score += 15;
          }
        }
      }

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
      const bestNumbers = Array.from(numberAppearances.entries())
        .filter(([num, count]) => count > 1)
        .sort((a, b) => b[1] - a[1]);

      if (bestNumbers.length > 0) {
        return bestNumbers[0][0];
      }

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
export class AIStrategyManager {
  constructor() {
    this.strategies = new Map();
    this.registerStrategies();
  }

  registerStrategies() {
    this.strategies.set("random", new RandomStrategy("Random Player"));
    this.strategies.set("alice", new RowStrategy("Alice"));
    this.strategies.set("mike", new ColumnStrategy("Mike"));
    this.strategies.set("lisa", new BoundaryStrategy("Lisa"));
    this.strategies.set("anna", new DiagonalStrategy("Anna"));
    this.strategies.set("tom", new CornerStrategy("Tom"));
    this.strategies.set("emma", new CenterStrategy("Emma"));
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
      "Jake", "Sara", "Alex", "Zoe", "Max", "Luna", "Rio", "Nova", "Kai", "Maya",
    ];
    return randomNames[Math.floor(Math.random() * randomNames.length)];
  }

  getSmartAIOpponents() {
    const smartNames = [
      "Neo", "Sage", "Apex", "Zen", "Nova", "Echo", "Void", "Prism", "Quantum", "Matrix",
    ];
    return smartNames[Math.floor(Math.random() * smartNames.length)];
  }
}

export const aiManager = new AIStrategyManager();

// Create AI Player
export function createAIPlayer(aiOpponent) {
  let aiName, aiStrategy;

  if (aiOpponent.type === "random") {
    aiName = aiManager.getRandomPlayOpponents();
    aiStrategy = aiManager.getStrategy("random");
  } else if (aiOpponent.type === "pattern") {
    if (aiOpponent.specific && aiOpponent.specific !== "random") {
      aiName = aiOpponent.specific;
      aiStrategy = aiManager.getStrategy(aiOpponent.specific.toLowerCase());
    } else {
      const patternOpponents = ["alice", "mike", "lisa", "anna", "tom", "emma"];
      const randomPattern =
        patternOpponents[Math.floor(Math.random() * patternOpponents.length)];
      aiName = randomPattern.charAt(0).toUpperCase() + randomPattern.slice(1);
      aiStrategy = aiManager.getStrategy(randomPattern);
    }
  } else if (aiOpponent.type === "smart") {
    aiName = aiManager.getSmartAIOpponents();
    aiStrategy = aiManager.getStrategy("smart");
  } else {
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

// AI Move Execution Logic
export function makeAIMove(room, aiPlayer, io, sendUpdateToAllPlayers) {
  if (!room || room.status !== "playing" || room.players.length < 2) return;
  if (!aiPlayer || !aiPlayer.isAI || !aiPlayer.strategy) return;

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
      io.to(room.roomId).emit("game:win", {
        winner: winner.name,
        gameTime: gameTimeInSeconds,
        message: `${winner.name} has completed B-I-N-G-O!`,
      });
    }, 1000);
  }
}
