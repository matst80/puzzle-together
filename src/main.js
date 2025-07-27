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

// Initial puzzle
let initialPieces = parseInt(pieceSlider.value, 10);
pieceCountLabel.textContent = initialPieces;
loadTextureAndCreateBoard("/puzzle.jpg", initialPieces);

// Slider event
pieceSlider.addEventListener("input", (e) => {
  const val = parseInt(e.target.value, 10);
  pieceCountLabel.textContent = val;
  loadTextureAndCreateBoard(currentTexture || "/puzzle.jpg", val);
});

// --- Custom image upload ---
const imageInput = document.getElementById("customImageInput");
if (imageInput) {
  imageInput.addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function (event) {
      const img = new window.Image();
      img.onload = function () {
        const texture = new THREE.Texture(img);
        texture.needsUpdate = true;
        currentTexture = texture;
        loadTextureAndCreateBoard(texture, parseInt(pieceSlider.value, 10));
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
  });
}

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
