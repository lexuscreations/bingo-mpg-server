import "dotenv/config";
import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import cors from "cors";

import { corsOptions, SOCKET_CONFIG } from "./config/constants.js";
import { rooms } from "./services/roomManager.js";
import { registerLifecycleHandlers } from "./sockets/lifecycleHandler.js";
import { registerGameplayHandlers } from "./sockets/gameplayHandler.js";

// Re-export for unit tests
export { SmartAIStrategy } from "./engine/aiStrategy.js";

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, SOCKET_CONFIG);

app.use(cors(corsOptions));
app.use(express.json());

// Healthcheck endpoint
app.get("/health", (req, res) => {
  res.json({ status: "ok", timestamp: Date.now() });
});

// Room ID format & availability validation endpoint
app.post("/api/validate-room", (req, res) => {
  const { roomId } = req.body;

  if (!roomId) {
    return res.json({ valid: false, error: "Room ID is required" });
  }

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

  const roomExists = rooms.has(roomId.toUpperCase());

  res.json({
    valid: !roomExists,
    exists: roomExists,
    error: roomExists ? "Room ID already exists" : null,
  });
});

// Register real-time Socket.IO event handlers per connection
io.on("connection", (socket) => {
  registerLifecycleHandlers(io, socket);
  registerGameplayHandlers(io, socket);
});

const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
