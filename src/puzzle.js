import * as THREE from "three";

class Piece {
  constructor(i, j, pieceSize, numPiecesX, numPiecesY, connectors, texture) {
    this.i = i;
    this.j = j;
    this.size = pieceSize;
    this.connectors = connectors;
    this.geometry = Piece.createGeometry(
      pieceSize,
      i,
      j,
      numPiecesX,
      numPiecesY,
      connectors
    );
    // Always use MeshStandardMaterial, but set map only if texture is provided
    this.material = new THREE.MeshStandardMaterial({
      map: texture || null,
      color: texture
        ? 0xffffff
        : new THREE.Color(Math.random(), Math.random(), Math.random()),
      metalness: 0.3,
      roughness: 0.6,
    });
    if (texture) {
      console.log(
        `Calling applyUVs for piece (${i}, ${j}) with texture:`,
        texture
      );
      Piece.applyUVs(this.geometry, i, j, numPiecesX, numPiecesY, pieceSize);
    }
    this.mesh = new THREE.Mesh(this.geometry, this.material);
    if (texture) this.material.needsUpdate = true;
    this.mesh.userData.correctPosition = {
      x: (i - numPiecesX / 2) * pieceSize * 1.1,
      y: (j - numPiecesY / 2) * pieceSize * 1.1,
      z: 0,
    };
    this.mesh.userData.isSnapped = false;
  }
  static createGeometry(size, x, y, numX, numY, connectors) {
    const shape = new THREE.Shape();
    const half = size / 2;
    shape.moveTo(-half, -half);
    if (connectors.top === null) shape.lineTo(half, -half);
    else addConnector(shape, half, 1, connectors.top, connectors.topId);
    if (connectors.right === null) shape.lineTo(half, half);
    else addConnector(shape, half, 2, connectors.right, connectors.rightId);
    if (connectors.bottom === null) shape.lineTo(-half, half);
    else addConnector(shape, half, 3, connectors.bottom, connectors.bottomId);
    if (connectors.left === null) shape.lineTo(-half, -half);
    else addConnector(shape, half, 4, connectors.left, connectors.leftId);
    const extrudeSettings = {
      steps: 2,
      depth: size / 4,
      bevelEnabled: true,
      bevelThickness: 0.01,
      bevelSize: 0.01,
      bevelOffset: 0,
      bevelSegments: 5,
    };
    return new THREE.ExtrudeGeometry(shape, extrudeSettings);
  }
  static applyUVs(geometry, i, j, numX, numY, pieceSize) {
    const uvAttribute = geometry.getAttribute("uv");
    const position = geometry.getAttribute("position");
    for (let k = 0; k < uvAttribute.count; k++) {
      const x = position.getX(k);
      const y = position.getY(k);
      // Clamp x/y to the central square (exclude connectors)
      const clampX = Math.max(-pieceSize / 2, Math.min(pieceSize / 2, x));
      const clampY = Math.max(-pieceSize / 2, Math.min(pieceSize / 2, y));
      // Map to [0,1] range for the whole puzzle, using grid position
      const u = (i + (clampX + pieceSize / 2) / pieceSize) / numX;
      const v = (j + (clampY + pieceSize / 2) / pieceSize) / numY;
      console.log(
        `Setting UV for piece (${i}, ${j}) at index ${k}: u=${u}, v=${v}`
      );
      uvAttribute.setXY(k, u, v);
    }
  }
}

class Board {
  constructor(scene, pieceSize, numPiecesX, numPiecesY, texture) {
    this.scene = scene;
    // Make puzzle fit table exactly, no gaps
    this.pieceSize = pieceSize;
    this.numPiecesX = numPiecesX;
    this.numPiecesY = numPiecesY;
    this.texture = texture;
    this.pieces = [];
    this.group = new THREE.Group();
    this.createTable();
    this.createPieces();
    scene.add(this.group);
  }
  createTable() {
    // Make the table much larger than the puzzle area
    const tableWidth = this.numPiecesX * this.pieceSize * 3; // 3x puzzle width
    const tableHeight = this.numPiecesY * this.pieceSize * 3; // 3x puzzle height
    const tableThickness = 0.2;
    const tableMaterial = new THREE.MeshStandardMaterial({ color: 0x8b5a2b });
    const tableGeometry = new THREE.BoxGeometry(
      tableWidth,
      tableHeight,
      tableThickness
    );
    const table = new THREE.Mesh(tableGeometry, tableMaterial);
    table.position.set(0, 0, -tableThickness / 2 - 0.01);
    table.rotation.z = 0;
    table.receiveShadow = true;
    this.scene.add(table);
    this.tableWidth = tableWidth;
    this.tableHeight = tableHeight;

    // Add the puzzle image overlay (low opacity) centered on the table
    if (this.texture) {
      const puzzleWidth = this.numPiecesX * this.pieceSize;
      const puzzleHeight = this.numPiecesY * this.pieceSize;
      const puzzleThickness = 0.01;
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
      const puzzleGeometry = new THREE.BoxGeometry(
        puzzleWidth,
        puzzleHeight,
        puzzleThickness
      );
      const puzzleImage = new THREE.Mesh(puzzleGeometry, puzzleMaterial);
      puzzleImage.position.set(0, 0, -puzzleThickness / 2 - 0.005);
      puzzleImage.rotation.z = 0;
      puzzleImage.receiveShadow = false;
      this.scene.add(puzzleImage);
    }
  }
  createPieces() {
    let connectorId = 1;
    const connectors = Array.from({ length: this.numPiecesX }, () =>
      Array.from({ length: this.numPiecesY }, () => ({
        top: null,
        right: null,
        bottom: null,
        left: null,
        topId: null,
        rightId: null,
        bottomId: null,
        leftId: null,
      }))
    );
    // Generate all piece indices
    const indices = [];
    for (let i = 0; i < this.numPiecesX; i++) {
      for (let j = 0; j < this.numPiecesY; j++) {
        indices.push({ i, j });
      }
    }
    // Shuffle all pieces
    for (let k = indices.length - 1; k > 0; k--) {
      const swap = Math.floor(Math.random() * (k + 1));
      [indices[k], indices[swap]] = [indices[swap], indices[k]];
    }
    // Place pieces in grid order for correct connector matching
    const placedPositions = [];
    for (let idx = 0; idx < indices.length; idx++) {
      const { i, j } = indices[idx];
      // Assign connectors so neighbors match
      if (j > 0) {
        connectors[i][j].top =
          connectors[i][j - 1].bottom === "out" ? "in" : "out";
        connectors[i][j].topId = connectors[i][j - 1].bottomId;
      } else {
        connectors[i][j].top = null;
        connectors[i][j].topId = null;
      }
      if (i > 0) {
        connectors[i][j].left =
          connectors[i - 1][j].right === "out" ? "in" : "out";
        connectors[i][j].leftId = connectors[i - 1][j].rightId;
      } else {
        connectors[i][j].left = null;
        connectors[i][j].leftId = null;
      }
      if (i < this.numPiecesX - 1) {
        connectors[i][j].right = Math.random() > 0.5 ? "out" : "in";
        connectors[i][j].rightId = connectorId++;
      } else {
        connectors[i][j].right = null;
        connectors[i][j].rightId = null;
      }
      if (j < this.numPiecesY - 1) {
        connectors[i][j].bottom = Math.random() > 0.5 ? "out" : "in";
        connectors[i][j].bottomId = connectorId++;
      } else {
        connectors[i][j].bottom = null;
        connectors[i][j].bottomId = null;
      }
      const piece = new Piece(
        i,
        j,
        this.pieceSize,
        this.numPiecesX,
        this.numPiecesY,
        connectors[i][j],
        this.texture
      );
      let gridX, gridY;
      const gap = 0.04;
      // Place snapped pieces in correct position
      if (idx < 0) {
        // No snapped pieces at start
        piece.mesh.userData.isSnapped = true;
        gridX = (i - this.numPiecesX / 2 + 0.5) * this.pieceSize + i * gap;
        gridY = (j - this.numPiecesY / 2 + 0.5) * this.pieceSize + j * gap;
      } else {
        // Randomize position outside puzzle area, avoid overlap
        let tries = 0;
        let valid = false;
        while (!valid && tries < 100) {
          // Table bounds
          const halfW = this.tableWidth / 2 - this.pieceSize / 2;
          const halfH = this.tableHeight / 2 - this.pieceSize / 2;
          // Puzzle area bounds
          const puzzleHalfW = (this.numPiecesX * this.pieceSize) / 2;
          const puzzleHalfH = (this.numPiecesY * this.pieceSize) / 2;
          gridX = Math.random() * (halfW * 2) - halfW;
          gridY = Math.random() * (halfH * 2) - halfH;
          // Exclude puzzle area
          if (Math.abs(gridX) < puzzleHalfW && Math.abs(gridY) < puzzleHalfH) {
            tries++;
            continue;
          }
          // Check overlap
          valid = true;
          for (const pos of placedPositions) {
            const dx = gridX - pos.x;
            const dy = gridY - pos.y;
            if (Math.sqrt(dx * dx + dy * dy) < this.pieceSize * 1.05) {
              valid = false;
              break;
            }
          }
          tries++;
        }
        piece.mesh.userData.isSnapped = false;
      }
      piece.mesh.position.set(gridX, gridY, 0);
      piece.mesh.rotation.z = 0;
      piece.mesh.userData.correctI = i;
      piece.mesh.userData.correctJ = j;
      placedPositions.push({ x: gridX, y: gridY });
      this.pieces.push(piece.mesh);
      this.group.add(piece.mesh);
    }
  }
  getPlacementStats() {
    // Tray is defined as below the table (y < -tableHeight/2)
    let trayCount = 0;
    let correctCount = 0;
    for (const piece of this.pieces) {
      if (piece.userData.isSnapped) {
        // Check if snapped to correct position
        const i = piece.userData.correctI;
        const j = piece.userData.correctJ;
        const gridX = (i - this.numPiecesX / 2 + 0.5) * this.pieceSize;
        const gridY = (j - this.numPiecesY / 2 + 0.5) * this.pieceSize;
        if (
          Math.abs(piece.position.x - gridX) < 0.01 &&
          Math.abs(piece.position.y - gridY) < 0.01 &&
          Math.abs(piece.position.z) < 0.01
        ) {
          correctCount++;
        }
      } else if (piece.position.y < -this.tableHeight / 2) {
        trayCount++;
      }
    }
    const total = this.pieces.length;
    return {
      trayPercent: Math.round((trayCount / total) * 100),
      correctPercent: Math.round((correctCount / total) * 100),
      trayCount,
      correctCount,
      total,
    };
  }
}

const SNAP_DISTANCE = 0.5;
const SNAP_ROTATION = 0.4;

class PuzzleScene {
  constructor(scene, pieceSize, numPiecesX, numPiecesY, texture) {
    this.scene = scene;
    this.board = new Board(scene, pieceSize, numPiecesX, numPiecesY, texture);
    this.pieces = this.board.pieces;
    this.tableWidth = this.board.tableWidth;
    this.tableHeight = this.board.tableHeight;
    this.enableDragging();
  }
  enableDragging() {
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();
    let selectedPiece = null;
    let offset = new THREE.Vector3();
    const camera = this.scene.userData.camera;
    const controls = this.scene.userData.controls;
    let isCameraDrag = false;
    let lastPointerX = 0;
    let isRotating = false;

    const checkCollision = (piece, newPos) => {
      piece.updateMatrixWorld();
      const bbox = new THREE.Box3().setFromObject(piece);
      const delta = new THREE.Vector3(
        newPos.x - piece.position.x,
        newPos.y - piece.position.y,
        newPos.z - piece.position.z
      );
      bbox.translate(delta);
      for (const other of this.pieces) {
        if (other === piece || other.userData.isSnapped) continue;
        other.updateMatrixWorld();
        const otherBox = new THREE.Box3().setFromObject(other);
        if (bbox.intersectsBox(otherBox)) return true;
      }
      return false;
    };

    const onPointerDown = (event) => {
      // Alt/Option for camera drag
      if (event.altKey) {
        isCameraDrag = true;
        if (controls) controls.enabled = true;
        selectedPiece = null;
        return;
      }
      isCameraDrag = false;
      mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
      mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
      raycaster.setFromCamera(mouse, camera);
      const intersects = raycaster.intersectObjects(this.pieces);
      if (intersects.length > 0) {
        selectedPiece = intersects[0].object;
        // Only group truly connected pieces (adjacent and snapped)
        const group = [selectedPiece];
        if (selectedPiece.userData.isSnapped) {
          const i = selectedPiece.userData.correctI;
          const j = selectedPiece.userData.correctJ;
          const neighbors = [
            { di: -1, dj: 0 },
            { di: 1, dj: 0 },
            { di: 0, dj: -1 },
            { di: 0, dj: 1 },
          ];
          for (const n of neighbors) {
            const ni = i + n.di;
            const nj = j + n.dj;
            if (
              ni < 0 ||
              ni >= this.board.numPiecesX ||
              nj < 0 ||
              nj >= this.board.numPiecesY
            )
              continue;
            const neighbor = this.pieces.find(
              (p) =>
                p.userData.correctI === ni &&
                p.userData.correctJ === nj &&
                p.userData.isSnapped
            );
            if (neighbor) group.push(neighbor);
          }
        }
        selectedPiece.userData.snappedGroup = group;
        // Track all snapped pieces as a group if selectedPiece is snapped
        if (selectedPiece.userData.isSnapped) {
          selectedPiece.userData.snappedGroup = this.pieces.filter(
            (p) => p.userData.isSnapped
          );
        } else {
          selectedPiece.userData.snappedGroup = [selectedPiece];
        }
        const planeZ = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
        const intersection = new THREE.Vector3();
        raycaster.ray.intersectPlane(planeZ, intersection);
        offset.copy(selectedPiece.position).sub(intersection);
        if (controls) controls.enabled = false;
        lastPointerX = event.clientX;
        isRotating = event.shiftKey;
      }
    };

    const checkAndSnapPiece = (piece) => {
      const pieceSize = this.board.pieceSize;
      const i =
        piece.userData.correctI !== undefined
          ? piece.userData.correctI
          : piece.i;
      const j =
        piece.userData.correctJ !== undefined
          ? piece.userData.correctJ
          : piece.j;
      const gridX = (i - this.board.numPiecesX / 2 + 0.5) * pieceSize;
      const gridY = (j - this.board.numPiecesY / 2 + 0.5) * pieceSize;
      const dx = piece.position.x - gridX;
      const dy = piece.position.y - gridY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      let rot = piece.rotation.z % (2 * Math.PI);
      if (rot < 0) rot += 2 * Math.PI;
      const snapAngles = [0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2];
      let snappedAngle = snapAngles.reduce((prev, curr) =>
        Math.abs(rot - curr) < Math.abs(rot - prev) ? curr : prev
      );
      const rotDiff = Math.abs(rot - snappedAngle);
      if (dist < SNAP_DISTANCE && rotDiff < SNAP_ROTATION) {
        piece.position.x = gridX;
        piece.position.y = gridY;
        piece.position.z = 0;
        piece.rotation.z = snappedAngle;
        piece.userData.isSnapped = true;
        // Snap correct neighbors if they are close
        const neighbors = [
          { di: -1, dj: 0 }, // left
          { di: 1, dj: 0 }, // right
          { di: 0, dj: -1 }, // top
          { di: 0, dj: 1 }, // bottom
        ];
        for (const n of neighbors) {
          const ni = i + n.di;
          const nj = j + n.dj;
          if (
            ni < 0 ||
            ni >= this.board.numPiecesX ||
            nj < 0 ||
            nj >= this.board.numPiecesY
          )
            continue;
          const neighbor = this.pieces.find(
            (p) => p.userData.correctI === ni && p.userData.correctJ === nj
          );
          if (!neighbor || neighbor.userData.isSnapped) continue;
          const nGridX = (ni - this.board.numPiecesX / 2 + 0.5) * pieceSize;
          const nGridY = (nj - this.board.numPiecesY / 2 + 0.5) * pieceSize;
          const ndx = neighbor.position.x - nGridX;
          const ndy = neighbor.position.y - nGridY;
          const ndist = Math.sqrt(ndx * ndx + ndy * ndy);
          let nrot = neighbor.rotation.z % (2 * Math.PI);
          if (nrot < 0) nrot += 2 * Math.PI;
          let nSnappedAngle = snapAngles.reduce((prev, curr) =>
            Math.abs(nrot - curr) < Math.abs(nrot - prev) ? curr : prev
          );
          const nRotDiff = Math.abs(nrot - nSnappedAngle);
          if (ndist < SNAP_DISTANCE && nRotDiff < SNAP_ROTATION) {
            neighbor.position.x = nGridX;
            neighbor.position.y = nGridY;
            neighbor.position.z = 0;
            neighbor.rotation.z = nSnappedAngle;
            neighbor.userData.isSnapped = true;
          }
        }
      }
    };

    const onPointerMove = (event) => {
      if (isCameraDrag) return;
      if (!selectedPiece) return;
      const group = selectedPiece.userData.snappedGroup || [selectedPiece];
      // Only rotate if Shift is pressed, do not move
      if (event.shiftKey) {
        const dx = event.clientX - lastPointerX;
        for (const piece of group) {
          piece.rotation.z += dx * 0.01;
          checkAndSnapPiece(piece);
        }
        lastPointerX = event.clientX;
        return;
      }
      // Only move if Shift is not pressed
      mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
      mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
      raycaster.setFromCamera(mouse, camera);
      const planeZ = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
      const intersection = new THREE.Vector3();
      raycaster.ray.intersectPlane(planeZ, intersection);
      const newPos = {
        x: intersection.x + offset.x,
        y: intersection.y + offset.y,
        z: 0,
      };
      // Calculate movement delta
      const dx = newPos.x - selectedPiece.position.x;
      const dy = newPos.y - selectedPiece.position.y;
      for (const piece of group) {
        piece.position.x += dx;
        piece.position.y += dy;
        piece.position.z = 0.5;
        checkAndSnapPiece(piece);
      }
      for (const other of this.pieces) {
        // Only affect unsnapped pieces
        if (other === selectedPiece || other.userData.isSnapped) continue;
        if (selectedPiece.userData.isSnapped) continue;
        const odx = other.position.x - selectedPiece.position.x;
        const ody = other.position.y - selectedPiece.position.y;
        const dist = Math.sqrt(odx * odx + ody * ody);
        if (dist < 1.1) {
          const force = (1.1 - dist) * 0.18;
          const angle = Math.atan2(ody, odx);
          other.position.x += Math.cos(angle) * force;
          other.position.y += Math.sin(angle) * force;
        }
      }
    };

    const onPointerUp = (event) => {
      if (isCameraDrag) {
        isCameraDrag = false;
        return;
      }
      if (selectedPiece) {
        // Use the piece's correct grid cell for snapping
        const pieceSize = this.board.pieceSize * 1.1;
        const i =
          selectedPiece.userData.correctI !== undefined
            ? selectedPiece.userData.correctI
            : selectedPiece.i;
        const j =
          selectedPiece.userData.correctJ !== undefined
            ? selectedPiece.userData.correctJ
            : selectedPiece.j;
        const gridX = (i - this.board.numPiecesX / 2) * pieceSize;
        const gridY = (j - this.board.numPiecesY / 2) * pieceSize;
        const dx = selectedPiece.position.x - gridX;
        const dy = selectedPiece.position.y - gridY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        let rot = selectedPiece.rotation.z % (2 * Math.PI);
        if (rot < 0) rot += 2 * Math.PI;
        const snapAngles = [0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2];
        let snappedAngle = snapAngles.reduce((prev, curr) =>
          Math.abs(rot - curr) < Math.abs(rot - prev) ? curr : prev
        );
        const rotDiff = Math.abs(rot - snappedAngle);
        // Snap only if close to correct cell and orientation
        if (dist < SNAP_DISTANCE && rotDiff < SNAP_ROTATION) {
          selectedPiece.position.x = gridX;
          selectedPiece.position.y = gridY;
          selectedPiece.position.z = 0;
          selectedPiece.rotation.z = snappedAngle;
          selectedPiece.userData.isSnapped = true;
        } else {
          // Clamp to table bounds (now much larger)
          const halfW = this.tableWidth / 2 - 0.5;
          const halfH = this.tableHeight / 2 - 0.5;
          selectedPiece.position.x = Math.max(
            -halfW,
            Math.min(halfW, selectedPiece.position.x)
          );
          selectedPiece.position.y = Math.max(
            -halfH,
            Math.min(halfH, selectedPiece.position.y)
          );
          selectedPiece.position.z = 0;
          selectedPiece.rotation.z = snappedAngle;
        }
        // Try to snap to neighbors if both are correct
        for (const other of this.pieces) {
          if (other === selectedPiece || other.userData.isSnapped) continue;
          const otherCorrect = other.userData.correctPosition;
          const otherPos = other.position.clone();
          const otherDist = otherPos.distanceTo(
            new THREE.Vector3(otherCorrect.x, otherCorrect.y, otherCorrect.z)
          );
          let otherRot = other.rotation.z % (2 * Math.PI);
          if (otherRot < 0) otherRot += 2 * Math.PI;
          let otherSnappedAngle = snapAngles.reduce((prev, curr) =>
            Math.abs(otherRot - curr) < Math.abs(otherRot - prev) ? curr : prev
          );
          const otherRotDiff = Math.abs(otherRot - otherSnappedAngle);
          // If both are close to their correct positions and rotations, snap both
          if (
            dist < SNAP_DISTANCE &&
            rotDiff < SNAP_ROTATION &&
            otherDist < SNAP_DISTANCE &&
            otherRotDiff < SNAP_ROTATION &&
            currentPos.distanceTo(otherPos) < SNAP_DISTANCE * 1.2
          ) {
            selectedPiece.position.copy(correctPos);
            selectedPiece.rotation.z = snappedAngle;
            selectedPiece.userData.isSnapped = true;
            other.position.copy(
              new THREE.Vector3(otherCorrect.x, otherCorrect.y, otherCorrect.z)
            );
            other.rotation.z = otherSnappedAngle;
            other.userData.isSnapped = true;
          }
        }
        selectedPiece = null;
        isRotating = false;
        if (controls) controls.enabled = true;
      }
    };

    const onWheel = (event) => {
      if (selectedPiece) {
        selectedPiece.rotation.z += event.deltaY * 0.01;
      }
    };

    window.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("wheel", onWheel);
  }
}

export function createPuzzle(scene) {
  // Add better lighting
  scene.add(new THREE.AmbientLight(0xffffff, 0.5)); // Soft fill
  const dirLight = new THREE.DirectionalLight(0xffffff, 1.2);
  dirLight.position.set(0, -5, 8);
  dirLight.castShadow = true;
  dirLight.shadow.mapSize.width = 1024;
  dirLight.shadow.mapSize.height = 1024;
  scene.add(dirLight);
  const spotLight = new THREE.SpotLight(0xfff8e1, 0.4, 20, Math.PI / 6, 0.3, 1);
  spotLight.position.set(5, 5, 8);
  spotLight.castShadow = true;
  scene.add(spotLight);

  const pieceSize = 1;
  const numPiecesX = 4;
  const numPiecesY = 4;
  if (scene.userData.camera) {
    const camera = scene.userData.camera;
    camera.position.set(
      0,
      -numPiecesY * pieceSize * 2.5,
      numPiecesY * pieceSize * 3.5
    );
    camera.lookAt(0, 0, 0);
    camera.rotation.x = Math.PI / 6;
    if (scene.userData.controls) {
      scene.userData.controls.target.set(0, 0, 0);
      scene.userData.controls.update();
    }
  }
  const textureLoader = new THREE.TextureLoader();
  textureLoader.load(
    "/puzzle.jpg", // Vite serves from public/
    (texture) => {
      texture.needsUpdate = true;
      new PuzzleScene(scene, pieceSize, numPiecesX, numPiecesY, texture);
    },
    undefined,
    () => {
      // Fallback: show colored pieces if texture fails
      new PuzzleScene(scene, pieceSize, numPiecesX, numPiecesY, null);
    }
  );
}

function addConnector(shape, half, side, connectorType, connectorId) {
  const c = half * 0.4; // connector size
  const seed = connectorId || 0;
  const offset = Math.sin(seed) * c * 0.2;

  switch (side) {
    case 1: // Top
      shape.lineTo(-c, -half);
      if (connectorType === "out") {
        shape.bezierCurveTo(
          -c + offset,
          -half - c,
          c + offset,
          -half - c,
          c,
          -half
        );
      } else {
        shape.bezierCurveTo(
          -c + offset,
          -half + c,
          c + offset,
          -half + c,
          c,
          -half
        );
      }
      shape.lineTo(half, -half);
      break;
    case 2: // Right
      shape.lineTo(half, -c);
      if (connectorType === "out") {
        shape.bezierCurveTo(
          half + c,
          -c + offset,
          half + c,
          c + offset,
          half,
          c
        );
      } else {
        shape.bezierCurveTo(
          half - c,
          -c + offset,
          half - c,
          c + offset,
          half,
          c
        );
      }
      shape.lineTo(half, half);
      break;
    case 3: // Bottom
      shape.lineTo(c, half);
      if (connectorType === "out") {
        shape.bezierCurveTo(
          c + offset,
          half + c,
          -c + offset,
          half + c,
          -c,
          half
        );
      } else {
        shape.bezierCurveTo(
          c + offset,
          half - c,
          -c + offset,
          half - c,
          -c,
          half
        );
      }
      shape.lineTo(-half, half);
      break;
    case 4: // Left
      shape.lineTo(-half, c);
      if (connectorType === "out") {
        shape.bezierCurveTo(
          -half - c,
          c + offset,
          -half - c,
          -c + offset,
          -half,
          -c
        );
      } else {
        shape.bezierCurveTo(
          -half + c,
          c + offset,
          -half + c,
          -c + offset,
          -half,
          -c
        );
      }
      shape.lineTo(-half, -half);
      break;
  }
}
