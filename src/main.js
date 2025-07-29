import "./style.css";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";
//import { createPuzzle, disposePuzzle } from "./puzzle.js";
import { Board } from "./Board.js";

// Scene
const scene = new THREE.Scene();
const textureLoader = new THREE.TextureLoader();

// Camera
const camera = new THREE.PerspectiveCamera(
  75,
  window.innerWidth / window.innerHeight,
  0.1,
  1000
);
camera.position.z = 2.2;

// Renderer
const renderer = new THREE.WebGLRenderer({
  canvas: document.querySelector("#bg"),
});

renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);

// Lights
const pointLight = new THREE.PointLight(0xffffff, 1.5, 100);
pointLight.position.set(5, 5, 5);
pointLight.castShadow = true;
pointLight.shadow.bias = -0.005;

const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);

const dirLight = new THREE.DirectionalLight(0xffffff, 1.2);
dirLight.position.set(-5, 10, 7);
dirLight.castShadow = true;
dirLight.shadow.bias = -0.005;
scene.add(pointLight, ambientLight, dirLight);

renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

// Controls
const controls = new OrbitControls(camera, renderer.domElement);

// Pass camera and controls to scene for drag logic
scene.userData.camera = camera;
scene.userData.controls = controls;

// Get slider and value display
const pieceSlider = document.getElementById("pieceSlider");
const pieceCountLabel = document.getElementById("pieceCount");
const controlsDiv = document.getElementById("controls");
// let currentPuzzleGroup = null;
// let currentPuzzleListeners = null;
// const BOARD_SIZE = 4; // Fixed board size

// function recreatePuzzle(numPieces) {
//   // Remove and dispose previous puzzle group only
//   if (currentPuzzleGroup) {
//     disposePuzzle(scene, currentPuzzleGroup, currentPuzzleListeners);
//     currentPuzzleGroup = null;
//     currentPuzzleListeners = null;
//   }
//   // Create puzzle pieces only (board size fixed, piece size changes)
//   createPuzzle(scene, numPieces, BOARD_SIZE, (newGroup, listeners) => {
//     if (currentPuzzleGroup) {
//       disposePuzzle(scene, currentPuzzleGroup, currentPuzzleListeners);
//       currentPuzzleGroup = null;
//       currentPuzzleListeners = null;
//     }
//     currentPuzzleGroup = newGroup;
//     currentPuzzleListeners = listeners;
//   });
// }

// --- Board recreation and custom image logic ---
let currentBoard = null;
let currentTexture = null;
let currentListeners = { down: null, move: null, up: null };

function disposeBoard() {
  if (currentBoard) {
    renderer.domElement.removeEventListener(
      "pointerdown",
      currentListeners.down
    );
    renderer.domElement.removeEventListener(
      "pointermove",
      currentListeners.move
    );
    renderer.domElement.removeEventListener("pointerup", currentListeners.up);
    currentBoard.dispose(scene);
    currentBoard = null;
  }
}

function createBoard(texture, size) {
  disposeBoard();
  currentBoard = new Board(
    texture,
    size,
    scene,
    null,
    ws,
    currentRoomId,
    boardReady
  );
  currentListeners.down = (event) =>
    currentBoard.onPointerDown(event, camera, renderer.domElement, controls);
  currentListeners.move = (event) =>
    currentBoard.onPointerMove(event, camera, renderer.domElement, controls);
  currentListeners.up = (event) =>
    currentBoard.onPointerUp(event, camera, renderer.domElement, controls);
  renderer.domElement.addEventListener("pointerdown", currentListeners.down);
  renderer.domElement.addEventListener("pointermove", currentListeners.move);
  renderer.domElement.addEventListener("pointerup", currentListeners.up);
}

function loadTextureAndCreateBoard(imageUrlOrTexture, size) {
  if (typeof imageUrlOrTexture === "string") {
    textureLoader.load(imageUrlOrTexture, (texture) => {
      currentTexture = texture;
      createBoard(texture, size);
    });
  } else {
    // Already a THREE.Texture
    currentTexture = imageUrlOrTexture;
    createBoard(imageUrlOrTexture, size);
  }
}

// Move these to top-level so they're available everywhere
function showControls() {
  controlsDiv.style.display = "";
}
function hideControls() {
  controlsDiv.style.display = "none";
}
function showRoomError(msg) {
  const roomError = document.getElementById("roomError");
  if (roomError) roomError.textContent = msg;
}
function hideRoomModal() {
  const roomModal = document.getElementById("roomModal");
  if (roomModal) roomModal.style.display = "none";
}
function showRoomModal() {
  const roomModal = document.getElementById("roomModal");
  if (roomModal) roomModal.style.display = "flex";
}

// --- Room modal logic ---
document.addEventListener("DOMContentLoaded", () => {
  const roomModal = document.getElementById("roomModal");
  const roomNameInput = document.getElementById("roomNameInput");
  const createRoomBtn = document.getElementById("createRoomBtn");
  const joinRoomBtn = document.getElementById("joinRoomBtn");
  const roomError = document.getElementById("roomError");
  const modalPieceSlider = document.getElementById("modalPieceSlider");
  const modalPieceCount = document.getElementById("modalPieceCount");
  const soloBtn = document.getElementById("soloBtn");
  const usernameInput = document.getElementById("usernameInput");
  const roomModalContent = document.getElementById("roomModalContent");

  // Prefill username from localStorage if available
  const savedUsername = localStorage.getItem("username");
  if (savedUsername && usernameInput) {
    usernameInput.value = savedUsername;
  }

  modalPieceSlider.addEventListener("input", (e) => {
    modalPieceCount.textContent = e.target.value;
  });

  function getAndStoreUsername() {
    const username = usernameInput ? usernameInput.value.trim() : "";
    if (username) localStorage.setItem("username", username);
    return username;
  }

  createRoomBtn.onclick = () => {
    const roomId = roomNameInput.value.trim();
    const gridSize = parseInt(modalPieceSlider.value, 10);
    const username = getAndStoreUsername();
    if (!roomId) {
      showRoomError("Please enter a room name.");
      return;
    }
    if (!username) {
      showRoomError("Please enter a username.");
      return;
    }
    currentRoomId = roomId;
    currentGridSize = gridSize;
    setupWebSocketAndRoom(roomId, gridSize, true, username);
    // Do NOT show controls here
  };

  joinRoomBtn.onclick = () => {
    const roomId = roomNameInput.value.trim();
    const username = getAndStoreUsername();
    if (!roomId) {
      showRoomError("Please enter a room name.");
      return;
    }
    if (!username) {
      showRoomError("Please enter a username.");
      return;
    }
    currentRoomId = roomId;
    setupWebSocketAndRoom(roomId, null, false, username);
    // Do NOT show controls here
  };

  soloBtn.onclick = () => {
    hideRoomModal();
    showControls();
    const gridSize = parseInt(modalPieceSlider.value, 10);
    pieceSlider.value = gridSize;
    pieceCountLabel.textContent = gridSize;
    if (!currentTexture) {
      textureLoader.load("/puzzle.jpg", (texture) => {
        currentTexture = texture;
        loadTextureAndCreateBoard(texture, gridSize);
      });
    } else {
      loadTextureAndCreateBoard(currentTexture, gridSize);
    }
    boardReady = false; // disables multiplayer
  };

  // Hide controls until in a room
  hideControls();
  showRoomModal();

  const roomListDiv = document.getElementById("roomList");

  async function fetchRoomList() {
    try {
      const res = await fetch("/rooms");
      if (!res.ok) return;
      const rooms = await res.json();
      roomListDiv.innerHTML =
        "<b>Active Rooms:</b><br>" +
        (rooms.length === 0
          ? "<i>No rooms</i>"
          : rooms
              .map(
                (r) =>
                  `<div style='margin-bottom:4px'><b>${r.roomId}</b> (${
                    r.userCount
                  } users): <span style='font-size:90%'>${r.users
                    .map((u) => u.username)
                    .join(", ")}</span></div>`
              )
              .join(""));
    } catch (e) {
      roomListDiv.innerHTML = "<i>Could not load rooms</i>";
    }
  }
  setInterval(fetchRoomList, 3000);
  fetchRoomList();
});

// Top-level multiplayer state variables (declare only once, before DOMContentLoaded)
let ws = null;
let currentRoomId = null;
let currentGridSize = null;
let boardReady = false;

function setupWebSocketAndRoom(roomId, gridSize, isCreate, username) {
  // Use relative path for WebSocket, so it works behind Ingress
  const wsProtocol = window.location.protocol === "https:" ? "wss" : "ws";
  const wsHost = window.location.host;
  console.log(wsHost, wsProtocol);
  ws = new window.WebSocket(
    wsHost.includes("localhost")
      ? `wss://puzzle.tornberg.me/ws`
      : `${wsProtocol}://${wsHost}/ws`
  );
  ws.onopen = () => {
    if (isCreate) {
      ws.send(
        JSON.stringify({
          type: "create-room",
          roomId,
          gridSize,
          username,
        })
      );
    } else {
      ws.send(
        JSON.stringify({
          type: "join-room",
          roomId,
          username,
        })
      );
    }
  };
  ws.onmessage = (event) => {
    if (typeof event.data === "string") {
      handleWSMessage(event.data);
    } else if (event.data instanceof Blob) {
      event.data.text().then(handleWSMessage);
    }
  };
  ws.onclose = () => {
    setTimeout(() => setupWebSocketAndRoom(roomId, gridSize, isCreate), 1000);
  };
}

// --- Multiplayer WebSocket setup (overrides old setupWebSocket) ---
let userListDiv = null;
function showUserList(users) {
  if (!userListDiv) {
    userListDiv = document.createElement("div");
    userListDiv.id = "userListDiv";
    userListDiv.style.position = "absolute";
    userListDiv.style.top = "20px";
    userListDiv.style.right = "20px";
    userListDiv.style.background = "#fff";
    userListDiv.style.padding = "16px 18px 12px 18px";
    userListDiv.style.borderRadius = "12px";
    userListDiv.style.zIndex = 2001;
    userListDiv.style.minWidth = "200px";
    userListDiv.style.boxShadow = "0 4px 16px rgba(0,0,0,0.18)";
    userListDiv.style.fontFamily = "system-ui, sans-serif";
    userListDiv.style.fontSize = "16px";
    userListDiv.style.border = "1.5px solid #e0e0e0";
    userListDiv.style.color = "#222";
    document.body.appendChild(userListDiv);
  }
  userListDiv.innerHTML =
    `<div style='font-weight:600;font-size:18px;margin-bottom:8px;color:#2a2a2a;letter-spacing:0.5px;'>Users in room</div>` +
    `<ul style='list-style:none;padding:0;margin:0;'>` +
    users
      .map(
        (u, idx) =>
          `<li style='display:flex;align-items:center;justify-content:space-between;padding:6px 0;border-bottom:1px solid #f0f0f0;${
            idx === users.length - 1 ? "border-bottom:none;" : ""
          }'>` +
          `<span style='font-weight:500;'>${u.username}</span>` +
          `<span style='background:#f5f5f5;border-radius:6px;padding:2px 10px;font-size:14px;color:#4a4a4a;margin-left:10px;'>` +
          `Score: <span style='font-weight:700;color:#1976d2;'>${u.score}</span>` +
          `</span>` +
          `</li>`
      )
      .join("") +
    `</ul>`;
  userListDiv.style.display = "";
}
function hideUserList() {
  if (userListDiv) userListDiv.style.display = "none";
}

function handleWSMessage(data) {
  try {
    const msg = JSON.parse(data);
    if (msg.type === "user-list") {
      showUserList(msg.users);
      return;
    }
    if (msg.type === "full-state") {
      hideRoomModal();
      hideControls(); // Always hide controls for multiplayer
      boardReady = true;
      hideUserList(); // Hide before showing new list
      // Set slider to match room
      if (msg.pieces) {
        const pieceCount = Math.sqrt(Object.keys(msg.pieces).length) | 0;
        pieceSlider.value = pieceCount;
        pieceCountLabel.textContent = pieceCount;
      }
      // Always load the imageUrl from server for each room
      const imageToUse = msg.imageUrl || "/puzzle.jpg";
      textureLoader.load(imageToUse, (texture) => {
        currentTexture = texture;
        createBoardWithState(msg.pieces);
      });
    } else if (
      (msg.type === "piece-move" || msg.type === "piece-drag") &&
      currentBoard
    ) {
      currentBoard.pieceMovedByOtherPlayer(msg);
    } else if (msg.type === "all-correct") {
      currentBoard.triggerCompletedAnimation();
    } else if (msg.type === "error") {
      showRoomError(msg.error);
      showRoomModal();
      hideControls();
      boardReady = false;
      hideUserList();
    }
  } catch (e) {
    console.warn("Invalid WS message", data);
  }
}

// // --- All pieces fall animation and board reset ---
// function triggerAllPiecesFallAnimation() {
//   if (!currentBoard || !currentBoard.pieces) return;
//   // Animate all pieces falling (set a velocity and animate in update)
//   for (const piece of currentBoard.pieces) {
//     if (piece && piece.group) {
//       piece._falling = true;
//       piece._fallVelocity = 0;
//     }
//   }
//   // After 2 seconds, reset the board (request new state from server)
//   setTimeout(() => {
//     ws.send(
//       JSON.stringify({
//         type: "join-room",
//         roomId: currentRoomId,
//         username: localStorage.getItem("username") || "",
//       })
//     );
//   }, 2000);
// }

// Patch Board update to animate falling pieces
const origBoardUpdate = Board.prototype.update;
Board.prototype.update = function (scene) {
  if (this.pieces) {
    for (const piece of this.pieces) {
      if (piece && piece._falling && piece.group) {
        piece._fallVelocity = (piece._fallVelocity || 0) + 0.025;
        piece.group.position.z -= piece._fallVelocity;
        if (piece.group.position.z < -5) {
          piece._falling = false;
        }
      }
    }
  }
  origBoardUpdate.call(this, scene);
};

function createBoardWithState(piecesState) {
  disposeBoard();
  const gridSize = Math.sqrt(Object.keys(piecesState).length) | 0;
  currentBoard = new Board(
    currentTexture,
    gridSize,
    scene,
    piecesState,
    ({ id, x, y, z, correct }) => {
      ws.send(
        JSON.stringify({
          type: "piece-move",
          roomId: currentRoomId,
          pieceId: id,
          x,
          y,
          z,
          ...(correct ? { correct: true } : {}),
        })
      );
    }
  );
  currentListeners.down = (event) =>
    currentBoard.onPointerDown(event, camera, renderer.domElement, controls);
  currentListeners.move = (event) =>
    currentBoard.onPointerMove(event, camera, renderer.domElement, controls);
  currentListeners.up = (event) =>
    currentBoard.onPointerUp(event, camera, renderer.domElement, controls);
  renderer.domElement.addEventListener("pointerdown", currentListeners.down);
  renderer.domElement.addEventListener("pointermove", currentListeners.move);
  renderer.domElement.addEventListener("pointerup", currentListeners.up);
}

// Hide controls until in a room
hideControls();
showRoomModal();

function animate() {
  controls.update();
  if (currentBoard) currentBoard.update(scene);
  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}
animate();

window.addEventListener("resize", onWindowResize, false);

function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}
