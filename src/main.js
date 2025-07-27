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
camera.position.z = 5;

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

// Initial puzzle
let initialPieces = parseInt(pieceSlider.value, 10);
pieceCountLabel.textContent = initialPieces;

textureLoader.load("/puzzle.jpg", (texture) => {
  const board = new Board(texture, initialPieces, scene);

  // --- DRAG LOGIC ---
  function onPointerDown(event) {
    board.onPointerDown(event, camera, renderer.domElement, controls);
  }
  function onPointerMove(event) {
    board.onPointerMove(event, camera, renderer.domElement, controls);
  }
  function onPointerUp(event) {
    board.onPointerUp(event, camera, renderer.domElement, controls);
  }

  renderer.domElement.addEventListener("pointerdown", onPointerDown);
  renderer.domElement.addEventListener("pointermove", onPointerMove);
  renderer.domElement.addEventListener("pointerup", onPointerUp);

  function animate() {
    controls.update();
    board.update(scene);
    renderer.render(scene, camera);
    requestAnimationFrame(animate);
  }
  animate();
});
//recreatePuzzle(initialPieces);

// pieceSlider.addEventListener("input", (e) => {
//   const val = parseInt(e.target.value, 10);
//   pieceCountLabel.textContent = val;
//   recreatePuzzle(val);
// });

window.addEventListener("resize", onWindowResize, false);

function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}
