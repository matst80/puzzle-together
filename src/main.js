import "./style.css";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";
//import { createPuzzle, disposePuzzle } from "./puzzle.js";
import { Board } from "./piece.js";

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
const pointLight = new THREE.PointLight(0xffffff);
pointLight.position.set(5, 5, 5);

const ambientLight = new THREE.AmbientLight(0xffffff);
scene.add(pointLight, ambientLight);

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
  //texture.needsUpdate = true;
  //console.log("Texture loaded:", texture, initialPieces);
  const board = new Board(texture, initialPieces, scene);
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
