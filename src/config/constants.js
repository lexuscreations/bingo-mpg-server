// Parse allowed client origins from environment
const rawOrigins = process.env.CLIENT_ORIGIN
  ? process.env.CLIENT_ORIGIN.split(",")
      .map((s) => s.trim())
      .filter(Boolean)
  : [];

// Include both trimmed and trailing-slash variants to ensure seamless CORS matching
export const allowedOrigins =
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

export const corsOptions = {
  origin: allowedOrigins,
  methods: ["GET", "POST"],
  credentials: true,
};

export const SOCKET_CONFIG = {
  cors: corsOptions,
  pingInterval: 3000,
  pingTimeout: 4000,
};

// BINGO letters in order
export const BINGO_LETTERS = ["B", "I", "N", "G", "O"];

export const DEFAULT_PAUSE_SECONDS = 30;
