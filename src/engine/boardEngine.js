import { BINGO_LETTERS } from "../config/constants.js";

// Generate a random 5x5 board containing numbers 1-25 in shuffled order
export function generateBoard() {
  const numbers = Array.from({ length: 25 }, (_, i) => i + 1);
  for (let i = numbers.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [numbers[i], numbers[j]] = [numbers[j], numbers[i]];
  }
  return numbers;
}

// Check if a line (row, col, or diag positions array) is completely marked
export function checkLine(board, marks, line) {
  return line.every((pos) => marks.includes(board[pos]));
}

// Get all completed lines on the board based on current marks
export function getCompletedLines(board, marks) {
  const completedLines = [];

  // Horizontal lines (rows)
  for (let i = 0; i < 5; i++) {
    const line = Array.from({ length: 5 }, (_, j) => i * 5 + j);
    if (checkLine(board, marks, line)) {
      completedLines.push(line);
    }
  }

  // Vertical lines (columns)
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

// Update player's BINGO letters based on completed lines count
export function updateBingoLetters(player) {
  const completedLines = getCompletedLines(player.board, player.marks);

  // Award new letters if we have more completed lines than current letters
  if (completedLines.length > player.bingoLetters.length) {
    while (
      player.bingoLetters.length < completedLines.length &&
      player.bingoLetters.length < BINGO_LETTERS.length
    ) {
      player.bingoLetters.push(BINGO_LETTERS[player.bingoLetters.length]);
    }
  }

  // Return true only if player achieved all 5 BINGO letters
  return player.bingoLetters.length === BINGO_LETTERS.length;
}

// Check for winning conditions
export function checkWin(player) {
  return updateBingoLetters(player);
}
