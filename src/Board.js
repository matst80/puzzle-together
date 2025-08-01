import * as THREE from "three";
import { Piece, Position } from "./piece";
import { TeapotGeometry } from "three/examples/jsm/geometries/TeapotGeometry.js";

export class Board {
  constructor(
    texture,
    gridSize,
    scene,
    piecesState = null,
    sendPieceMove = null
  ) {
    this.texture = texture;
    this.gridSize = gridSize;
    this.group = new THREE.Group();
    scene.add(this.group); // Add group to scene
    const pieceSizePercent = 1.0 / gridSize;
    this.pieces = Array.from({ length: gridSize * gridSize });
    const material = new THREE.MeshStandardMaterial({
      map: texture || null,
      color: texture
        ? 0xffffff
        : new THREE.Color(Math.random(), Math.random(), Math.random()),
      metalness: 0.3,
      roughness: 0.6,
    });
    // Create pieces with correct IDs and positions
    for (var i = 0; i < gridSize; i++) {
      for (var j = 0; j < gridSize; j++) {
        const id = `${i}_${j}`;
        const piece = new Piece(i, j, pieceSizePercent, id, sendPieceMove);
        piece.id = id;
        this.pieces[i * gridSize + j] = piece;
      }
    }
    // Set connectors for all edges, including outer rows/columns
    for (var i = 0; i < gridSize; i++) {
      for (var j = 0; j < gridSize; j++) {
        const current = this.pieces[i * gridSize + j];
        if (i > 0) current.setLeft(this.pieces[(i - 1) * gridSize + j]);
        if (i < gridSize - 1)
          current.setRight(this.pieces[(i + 1) * gridSize + j]);
        if (j > 0) current.setTop(this.pieces[i * gridSize + (j - 1)]);
        if (j < gridSize - 1)
          current.setBottom(this.pieces[i * gridSize + (j + 1)]);
      }
    }
    // Pre-create all meshes once
    for (var i = 0; i < gridSize; i++) {
      for (var j = 0; j < gridSize; j++) {
        const current = this.pieces[i * gridSize + j];
        current.createMesh(scene, material, gridSize);
      }
    }
    if (piecesState) {
      // Set piece positions from state
      for (const key in piecesState) {
        const piece = this.pieces.find((p) => p.id === key);
        if (piece) {
          const pos = piecesState[key];
          piece.setPosition(new Position(pos.x, pos.y, pos.z));
        }
      }
    } else {
      // Place pieces at random positions without overlap
      const placedBoxes = [];
      for (var i = 0; i < gridSize; i++) {
        for (var j = 0; j < gridSize; j++) {
          const current = this.pieces[i * gridSize + j];
          const pieceSize = 1.0 / gridSize;
          let placed = false;
          let attempts = 0;
          const maxAttempts = 200;
          let randX, randY;
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
            for (const placed of placedBoxes) {
              if (
                box.maxX > placed.minX &&
                box.minX < placed.maxX &&
                box.maxY > placed.minY &&
                box.minY < placed.maxY
              ) {
                collision = true;
                break;
              }
            }
            if (!collision) {
              placed = true;
              current.setPosition(new Position(randX, randY, 0));
              placedBoxes.push(box);
            }
            attempts++;
          }
          if (!placed) {
            // Fallback: just place at random (may overlap, but very unlikely)
            current.setPosition(new Position(randX, randY, 0));
            placedBoxes.push({
              minX: randX - pieceSize / 2,
              maxX: randX + pieceSize / 2,
              minY: randY - pieceSize / 2,
              maxY: randY + pieceSize / 2,
            });
          }
        }
      }
    }
    // Make the table much larger than the puzzle area
    const tableThickness = 0.2;
    const tableMaterial = new THREE.MeshStandardMaterial({ color: 0xffffff });
    const tableGeometry = new THREE.BoxGeometry(3, 3, tableThickness);
    const table = new THREE.Mesh(tableGeometry, tableMaterial);
    table.position.set(0, 0, 0);
    table.rotation.z = 0;
    table.receiveShadow = true;
    this.group.add(table); // Add to group, not scene

    // Add the puzzle image overlay (low opacity) centered on the table
    if (this.texture) {
      const puzzleTexture = this.texture.clone();
      puzzleTexture.needsUpdate = true;
      puzzleTexture.center.set(0.5, 0.5);
      puzzleTexture.rotation = 0;
      const puzzleMaterial = new THREE.MeshStandardMaterial({
        map: puzzleTexture,
        color: 0xffffff,
        transparent: true,
        opacity: 0.45,
        metalness: 0.2,
        roughness: 0.7,
      });
      const puzzleGeometry = new THREE.BoxGeometry(1, 1, 0.01);
      const puzzleImage = new THREE.Mesh(puzzleGeometry, puzzleMaterial);
      puzzleImage.position.set(0, 0, tableThickness / 2 - 0.002);
      puzzleImage.rotation.z = 0;
      puzzleImage.receiveShadow = false;
      this.group.add(puzzleImage); // Add to group, not scene
    }
    // --- Add a teapot in a random corner of the table ---
    const corners = [
      [1, 1],
      [-1, 1],
      [1, -1],
      [-1, -1],
    ];
    const [cornerX, cornerY] =
      corners[Math.floor(Math.random() * corners.length)];
    const teapotGeometry = new TeapotGeometry(
      0.13,
      10,
      true,
      true,
      true,
      true,
      true
    );
    const teapotMaterial = new THREE.MeshPhysicalMaterial({
      color: 0xff69b4,
      metalness: 0.7,
      roughness: 0.2,
      clearcoat: 0.6,
      clearcoatRoughness: 0.1,
      transmission: 0.3,
      ior: 1.4,
    });
    const teapot = new THREE.Mesh(teapotGeometry, teapotMaterial);
    teapot.position.set(
      cornerX * 1.2,
      cornerY * 1.2,
      tableThickness // base sits on table
    );
    teapot.rotation.x = Math.PI / 2; // upright on table
    //teapot.rotation.z = Math.random() * Math.PI * 2; // random rotation
    teapot.castShadow = true;
    teapot.receiveShadow = true;
    this.group.add(teapot);

    this._dragging = false;
    this._selectedPiece = null;
    this._dragOffset = new THREE.Vector3();
    this._dragPlaneZ = 0.3;
    this._raycaster = new THREE.Raycaster();
    this._mouse = new THREE.Vector2();
  }

  onPointerDown(event, camera, domElement, controls) {
    const rect = domElement.getBoundingClientRect();
    this._mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this._mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    this._raycaster.setFromCamera(this._mouse, camera);
    // Raycast against all meshes (topMesh) of each piece
    const allMeshes = this.pieces.map((p) => p.mesh);
    const intersects = this._raycaster.intersectObjects(allMeshes, false);
    if (intersects.length > 0) {
      const piece = (this._selectedPiece = this.pieces.find(
        (p) => p.mesh === intersects[0].object
      ));
      if (piece != null) {
        // Prevent pickup if piece is being dragged by another user
        if (piece.dragging) {
          if (controls) controls.enabled = true;
          return;
        }
        this._dragging = true;
        const intersectPoint = intersects[0].point;
        this._dragOffset.copy(piece.group.position).sub(intersectPoint);
        if (controls) controls.enabled = false;
        // Start pickup animation via Piece
        piece.pickup();
      }
    } else {
      if (controls) controls.enabled = true;
    }
  }
  triggerCompletedAnimation() {
    // Trigger all pieces to fall down and fade out
    for (const piece of this.pieces) {
      piece.triggerFallAnimation();
    }
  }
  onPointerMove(event, camera, domElement, controls) {
    if (!this._dragging || !this._selectedPiece) return;
    const rect = domElement.getBoundingClientRect();
    this._mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this._mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    this._raycaster.setFromCamera(this._mouse, camera);
    const plane = new THREE.Plane(
      new THREE.Vector3(0, 0, 1),
      -this._dragPlaneZ
    );
    const intersection = new THREE.Vector3();
    this._raycaster.ray.intersectPlane(plane, intersection);
    if (intersection) {
      this._selectedPiece.handleDrag(
        intersection.x + this._dragOffset.x,
        intersection.y + this._dragOffset.y,
        this._dragPlaneZ
      );
    }
  }
  pieceMovedByOtherPlayer({ pieceId, x, y, z }) {
    const piece = this.pieces.find((p) => p.id === pieceId);
    if (piece) {
      piece.moveByOtherPlayer(
        new THREE.Vector3(
          x,
          y,
          z // Use drag plane as default Z
        )
      );
    }
  }
  // Animate pieces dragged by other users to same height and reduce opacity
  update(scene) {
    // Animate pickup/putdown for all pieces via Piece's updateAnimation
    for (const piece of this.pieces) {
      piece.updateAnimation();
    }
  }
  dispose(scene) {
    // Dispose all meshes and materials
    for (const piece of this.pieces) {
      piece.dispose(scene);
    }
    this.pieces = [];
    scene.remove(this.group);
    this.group = null; // Set to null to avoid memory leaks
    this.texture.dispose(); // Dispose the texture if it exists
    this.texture = null; // Set to null to avoid memory leaks
  }
  onPointerUp(event, camera, domElement, controls) {
    if (!this._dragging || !this._selectedPiece) return;
    this._dragging = false;
    if (this._selectedPiece) {
      // Start put-down animation via Piece
      this._selectedPiece.putdown();
    }
    this._selectedPiece = null;
    if (controls) controls.enabled = true;
  }

  render() {}
}
