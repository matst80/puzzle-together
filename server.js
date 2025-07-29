import { WebSocketServer } from "ws";
import { createServer } from "http";

const httpServer = createServer((req, res) => {
  if (req.method === "GET" && req.url === "/rooms") {
    // List all rooms and users
    const roomList = Object.entries(rooms).map(([roomId, room]) => ({
      roomId,
      users: Array.from(room.users.values()).map((u) => ({
        username: u.username,
        score: u.score,
      })),
      userCount: room.users.size,
    }));
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(roomList));
    return;
  }
  res.writeHead(404);
  res.end();
});

const DEFAULT_GRID_SIZE = 4;

// Room state: { [roomId]: { pieces: Map<pieceId, {x, y, z, dragging}>, clients: Set<ws>, users: Map<ws, {username, score}>, correctPieces: Set<pieceId>, imageUrl: string, cleanupTimeout?: NodeJS.Timeout } }
const rooms = {};

// List of random puzzle image URLs
const PUZZLE_IMAGES = [
  "https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=1000&q=80", // Forest
  "https://images.unsplash.com/photo-1465101046530-73398c7f28ca?auto=format&fit=crop&w=1000&q=80", // Mountain
  "https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?auto=format&fit=crop&w=1000&q=80", // Beach

  "https://images.unsplash.com/photo-1519125323398-675f0ddb6308?auto=format&fit=crop&w=1000&q=80", // City
  "https://images.unsplash.com/photo-1465101046530-73398c7f28ca?auto=format&fit=crop&w=1000&q=80", // Nature
  "https://images.unsplash.com/photo-1502082553048-f009c37129b9?auto=format&fit=crop&w=1000&q=80", // Flowers
];

function generateInitialPositions(gridSize = DEFAULT_GRID_SIZE) {
  const pieces = new Map();
  const usedBoxes = [];
  for (let i = 0; i < gridSize; i++) {
    for (let j = 0; j < gridSize; j++) {
      let placed = false,
        attempts = 0,
        maxAttempts = 200,
        randX,
        randY;
      const pieceSize = 1.0 / gridSize;
      while (!placed && attempts < maxAttempts) {
        randX = Math.random() * 2.4 - 1.2;
        randY = Math.random() * 2.4 - 1.2;
        let box = {
          minX: randX - pieceSize / 2,
          maxX: randX + pieceSize / 2,
          minY: randY - pieceSize / 2,
          maxY: randY + pieceSize / 2,
        };
        let collision = false;
        for (const placedBox of usedBoxes) {
          if (
            box.maxX > placedBox.minX &&
            box.minX < placedBox.maxX &&
            box.maxY > placedBox.minY &&
            box.minY < placedBox.maxY
          ) {
            collision = true;
            break;
          }
        }
        if (!collision) {
          placed = true;
          pieces.set(`${i}_${j}`, {
            x: randX,
            y: randY,
            z: 0,
            dragging: false,
          });
          usedBoxes.push(box);
        }
        attempts++;
      }
      if (!placed) {
        pieces.set(`${i}_${j}`, { x: randX, y: randY, z: 0, dragging: false });
        usedBoxes.push({
          minX: randX - pieceSize / 2,
          maxX: randX + pieceSize / 2,
          minY: randY - pieceSize / 2,
          maxY: randY + pieceSize / 2,
        });
      }
    }
  }
  return pieces;
}

function broadcastToRoom(roomId, data, exceptWs = null) {
  if (!rooms[roomId]) return;
  for (const client of rooms[roomId].clients) {
    if (client !== exceptWs && client.readyState === client.OPEN) {
      client.send(JSON.stringify(data));
    }
  }
}

const wss = new WebSocketServer({ server: httpServer });

wss.on("connection", function connection(ws) {
  ws.roomId = null;
  ws.username = null;

  function broadcastUserList(roomId) {
    if (!rooms[roomId]) return;
    const users = Array.from(rooms[roomId].users.values()).map((u) => ({
      username: u.username,
      score: u.score,
    }));
    broadcastToRoom(roomId, { type: "user-list", users });
  }

  ws.on("message", function incoming(message) {
    let msg;
    try {
      msg = JSON.parse(message);
    } catch (e) {
      ws.send(JSON.stringify({ type: "error", error: "Invalid JSON" }));
      return;
    }
    // Room creation
    if (
      msg.type === "create-room" &&
      typeof msg.roomId === "string" &&
      typeof msg.gridSize === "number" &&
      typeof msg.username === "string"
    ) {
      if (rooms[msg.roomId]) {
        ws.send(
          JSON.stringify({ type: "error", error: "Room already exists" })
        );
        console.log(`[SERVER] Attempt to create existing room: ${msg.roomId}`);
        return;
      }
      // Pick a random image for the room
      const imageUrl =
        PUZZLE_IMAGES[Math.floor(Math.random() * PUZZLE_IMAGES.length)];
      rooms[msg.roomId] = {
        pieces: generateInitialPositions(msg.gridSize),
        clients: new Set([ws]),
        users: new Map([[ws, { username: msg.username, score: 0 }]]),
        imageUrl,
        // cleanupTimeout will be set if needed
      };
      ws.roomId = msg.roomId;
      ws.username = msg.username;
      ws.send(
        JSON.stringify({
          type: "full-state",
          roomId: msg.roomId,
          pieces: Object.fromEntries(rooms[msg.roomId].pieces),
          imageUrl,
        })
      );
      broadcastUserList(msg.roomId);
      console.log(`[SERVER] Room created: ${msg.roomId}`);
      return;
    }
    // Join room
    if (
      msg.type === "join-room" &&
      typeof msg.roomId === "string" &&
      typeof msg.username === "string"
    ) {
      if (!rooms[msg.roomId]) {
        ws.send(
          JSON.stringify({ type: "error", error: "Room does not exist" })
        );
        console.log(
          `[SERVER] Attempt to join non-existent room: ${msg.roomId}`
        );
        return;
      }
      rooms[msg.roomId].clients.add(ws);
      rooms[msg.roomId].users.set(ws, { username: msg.username, score: 0 });
      // Cancel cleanup if it was scheduled
      if (rooms[msg.roomId].cleanupTimeout) {
        clearTimeout(rooms[msg.roomId].cleanupTimeout);
        delete rooms[msg.roomId].cleanupTimeout;
      }
      ws.roomId = msg.roomId;
      ws.username = msg.username;
      ws.send(
        JSON.stringify({
          type: "full-state",
          roomId: msg.roomId,
          pieces: Object.fromEntries(rooms[msg.roomId].pieces),
          imageUrl: rooms[msg.roomId].imageUrl,
        })
      );
      broadcastUserList(msg.roomId);
      console.log(`[SERVER] User joined room: ${msg.roomId}`);
      return;
    }
    // Piece move/drag
    if (
      (msg.type === "piece-move" || msg.type === "piece-drag") &&
      typeof msg.roomId === "string" &&
      typeof msg.pieceId === "string"
    ) {
      const room = rooms[msg.roomId];
      if (!room) {
        ws.send(
          JSON.stringify({ type: "error", error: "Room does not exist" })
        );
        return;
      }
      // Ensure correctPieces set exists
      if (!room.correctPieces) room.correctPieces = new Set();
      // Update state
      room.pieces.set(msg.pieceId, {
        x: msg.x,
        y: msg.y,
        z: msg.z,
        dragging: msg.type === "piece-drag",
      });
      // If the move is a correct placement, increment score only if not already correct
      if (msg.correct && room.users.has(ws)) {
        if (!room.correctPieces.has(msg.pieceId)) {
          room.users.get(ws).score += 1;
          room.correctPieces.add(msg.pieceId);
          broadcastUserList(msg.roomId);
          // Check if all pieces are correct
          if (room.correctPieces.size === room.pieces.size) {
            broadcastToRoom(msg.roomId, { type: "all-correct" });
            // After 5s, send a new board with a new image
            setTimeout(() => {
              const newImageUrl =
                PUZZLE_IMAGES[Math.floor(Math.random() * PUZZLE_IMAGES.length)];
              room.pieces = generateInitialPositions(
                (room.pieces.size ** 0.5) | 0
              );
              room.correctPieces = new Set();
              room.imageUrl = newImageUrl;
              broadcastToRoom(msg.roomId, {
                type: "full-state",
                roomId: msg.roomId,
                pieces: Object.fromEntries(room.pieces),
                imageUrl: newImageUrl,
              });
            }, 5000);
          }
        }
      }
      // Broadcast to others in room
      broadcastToRoom(msg.roomId, msg, ws);
      // (Score logic can be added here)
      // console.log(
      //   `[SERVER] Relayed ${msg.type} for ${msg.pieceId} in room ${msg.roomId}`
      // );
      return;
    }
    ws.send(JSON.stringify({ type: "error", error: "Invalid message format" }));
  });

  ws.on("close", function () {
    // Remove from room
    if (ws.roomId && rooms[ws.roomId]) {
      const room = rooms[ws.roomId];
      room.clients.delete(ws);
      room.users.delete(ws);
      broadcastUserList(ws.roomId);
      // If no users left, schedule cleanup
      if (room.clients.size === 0) {
        room.cleanupTimeout = setTimeout(() => {
          delete rooms[ws.roomId];
          console.log(
            `[SERVER] Room ${ws.roomId} deleted after 10s of inactivity.`
          );
        }, 10000);
      }
      // Do NOT delete the room immediately when the last user leaves; persist state for 10s
    }
  });
});

httpServer.listen(3001, () => {
  console.log("Server running on http://localhost:3001");
});
