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

// Room state: { [roomId]: { pieces: Map<pieceId, {x, y, z, dragging}>, clients: Set<ws>, users: Map<ws, {username, score}> } }
const rooms = {};

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
      rooms[msg.roomId] = {
        pieces: generateInitialPositions(msg.gridSize),
        clients: new Set([ws]),
        users: new Map([[ws, { username: msg.username, score: 0 }]]),
      };
      ws.roomId = msg.roomId;
      ws.username = msg.username;
      ws.send(
        JSON.stringify({
          type: "full-state",
          roomId: msg.roomId,
          pieces: Object.fromEntries(rooms[msg.roomId].pieces),
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
      ws.roomId = msg.roomId;
      ws.username = msg.username;
      ws.send(
        JSON.stringify({
          type: "full-state",
          roomId: msg.roomId,
          pieces: Object.fromEntries(rooms[msg.roomId].pieces),
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
      // Update state
      room.pieces.set(msg.pieceId, {
        x: msg.x,
        y: msg.y,
        z: msg.z,
        dragging: msg.type === "piece-drag",
      });
      // Broadcast to others in room
      broadcastToRoom(msg.roomId, msg, ws);
      // (Score logic can be added here)
      console.log(
        `[SERVER] Relayed ${msg.type} for ${msg.pieceId} in room ${msg.roomId}`
      );
      return;
    }
    ws.send(JSON.stringify({ type: "error", error: "Invalid message format" }));
  });

  ws.on("close", function () {
    // Remove from room
    if (ws.roomId && rooms[ws.roomId]) {
      rooms[ws.roomId].clients.delete(ws);
      rooms[ws.roomId].users.delete(ws);
      broadcastUserList(ws.roomId);
      // Do NOT delete the room when the last user leaves; persist state
      // Optionally, implement a timeout-based cleanup here if desired
    }
  });
});

httpServer.listen(3001, () => {
  console.log("Server running on http://localhost:3001");
});
