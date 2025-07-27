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
  currentBoard = new Board(texture, size, scene);
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

  modalPieceSlider.addEventListener("input", (e) => {
    modalPieceCount.textContent = e.target.value;
  });

  // Remove 'let' from these assignments so they update the top-level variables
  createRoomBtn.onclick = () => {
    const roomId = roomNameInput.value.trim();
    const gridSize = parseInt(modalPieceSlider.value, 10);
    if (!roomId) {
      showRoomError("Please enter a room name.");
      return;
    }
    currentRoomId = roomId;
    currentGridSize = gridSize;
    setupWebSocketAndRoom(roomId, gridSize, true);
    // Do NOT show controls here
  };

  joinRoomBtn.onclick = () => {
    const roomId = roomNameInput.value.trim();
    if (!roomId) {
      showRoomError("Please enter a room name.");
      return;
    }
    currentRoomId = roomId;
    setupWebSocketAndRoom(roomId, null, false);
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
});

// Top-level multiplayer state variables (declare only once, before DOMContentLoaded)
let ws = null;
let currentRoomId = null;
let currentGridSize = null;
let boardReady = false;

function setupWebSocketAndRoom(roomId, gridSize, isCreate) {
  // Use relative path for WebSocket, so it works behind Ingress
  const wsProtocol = window.location.protocol === "https:" ? "wss" : "ws";
  const wsHost = window.location.host;
  ws = new window.WebSocket(`${wsProtocol}://${wsHost}/ws`);
  ws.onopen = () => {
    if (isCreate) {
      ws.send(
        JSON.stringify({
          type: "create-room",
          roomId,
          gridSize,
        })
      );
    } else {
      ws.send(
        JSON.stringify({
          type: "join-room",
          roomId,
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
function handleWSMessage(data) {
  try {
    const msg = JSON.parse(data);
    if (msg.type === "full-state") {
      hideRoomModal();
      hideControls(); // Always hide controls for multiplayer
      boardReady = true;
      // Set slider to match room
      if (msg.pieces) {
        const pieceCount = Math.sqrt(Object.keys(msg.pieces).length) | 0;
        pieceSlider.value = pieceCount;
        pieceCountLabel.textContent = pieceCount;
      }
      // Ensure currentTexture is set before creating the board
      if (!currentTexture) {
        textureLoader.load("/puzzle.jpg", (texture) => {
          currentTexture = texture;
          createBoardWithState(msg.pieces);
        });
      } else {
        createBoardWithState(msg.pieces);
      }
    } else if (
      (msg.type === "piece-move" || msg.type === "piece-drag") &&
      currentBoard
    ) {
      const piece = currentBoard.pieces.find((p) => p.id === msg.pieceId);
      if (piece) {
        if (!currentBoard._dragging || currentBoard._selectedPiece !== piece) {
          piece.setPosition({ x: msg.x, y: msg.y, z: msg.z });
        }
      }
    } else if (msg.type === "error") {
      showRoomError(msg.error);
      showRoomModal();
      hideControls();
      boardReady = false;
    }
  } catch (e) {
    console.warn("Invalid WS message", data);
  }
}

function createBoardWithState(piecesState) {
  disposeBoard();
  const gridSize = Math.sqrt(Object.keys(piecesState).length) | 0;
  currentBoard = new Board(currentTexture, gridSize, scene, piecesState);
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

// Patch Board to emit piece moves with room and pieceId
if (Board && !Board.prototype._wsPatched) {
  const origHandleDrag = Board.prototype.onPointerMove;
  Board.prototype.onPointerMove = function (
    event,
    camera,
    domElement,
    controls
  ) {
    origHandleDrag.call(this, event, camera, domElement, controls);
    if (
      boardReady &&
      this._dragging &&
      this._selectedPiece &&
      ws &&
      ws.readyState === 1 &&
      this._selectedPiece.id &&
      currentRoomId
    ) {
      const pos = this._selectedPiece.group.position;
      ws.send(
        JSON.stringify({
          type: "piece-move",
          roomId: currentRoomId,
          pieceId: this._selectedPiece.id,
          x: pos.x,
          y: pos.y,
          z: pos.z,
        })
      );
    }
  };
  Board.prototype._wsPatched = true;
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
