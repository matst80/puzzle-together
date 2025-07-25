import * as THREE from "three";

class Neighbor {
  constructor(type, id, profile, piece = null) {
    this.type = type; // 'in' or 'out' or null
    this.id = id;
    this.profile = profile;
    this.piece = piece; // reference to neighbor piece
  }
}

class Connector {
  constructor(profile) {
    this.profile = profile; // shared profile
    this.id = null;
  }
}

class Piece {
  constructor(i, j, pieceSize, numPiecesX, numPiecesY, texture) {
    this.i = i;
    this.j = j;
    this.size = pieceSize;
    this.neighbors = { top: null, right: null, bottom: null, left: null };
    this.connectors = { top: null, right: null, bottom: null, left: null };
    this.material = new THREE.MeshStandardMaterial({
      map: texture || null,
      color: texture
        ? 0xffffff
        : new THREE.Color(Math.random(), Math.random(), Math.random()),
      metalness: 0.3,
      roughness: 0.6,
    });
    // Geometry will be created after neighbors and connectors are set
    this.mesh = null;
  }
  static addConnector(shape, half, side, connectorType, connectorId, profile) {
    const c = half * 0.4; // connector size
    let p = profile || [0, 0, 0, 0];
    if (connectorType === "in") {
      p = [...p].reverse();
    }
    switch (side) {
      case 1: // Top
        shape.lineTo(-c, -half);
        if (connectorType === "out") {
          shape.bezierCurveTo(
            -c + p[0] * c,
            -half - c - p[1] * c,
            c + p[2] * c,
            -half - c - p[3] * c,
            c,
            -half
          );
        } else {
          shape.bezierCurveTo(
            -c + p[0] * c,
            -half + c + p[1] * c,
            c + p[2] * c,
            -half + c + p[3] * c,
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
            half + c + p[0] * c,
            -c + p[1] * c,
            half + c + p[2] * c,
            c + p[3] * c,
            half,
            c
          );
        } else {
          shape.bezierCurveTo(
            half - c - p[0] * c,
            -c + p[1] * c,
            half - c - p[2] * c,
            c + p[3] * c,
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
            c + p[0] * c,
            half + c + p[1] * c,
            -c + p[2] * c,
            half + c + p[3] * c,
            -c,
            half
          );
        } else {
          shape.bezierCurveTo(
            c + p[0] * c,
            half - c - p[1] * c,
            -c + p[2] * c,
            half - c - p[3] * c,
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
            -half - c - p[0] * c,
            c + p[1] * c,
            -half - c - p[2] * c,
            -c + p[3] * c,
            -half,
            -c
          );
        } else {
          shape.bezierCurveTo(
            -half + c + p[0] * c,
            c + p[1] * c,
            -half + c + p[2] * c,
            -c + p[3] * c,
            -half,
            -c
          );
        }
        shape.lineTo(-half, -half);
        break;
    }
  }
  createGeometry(numPiecesX, numPiecesY, texture) {
    const size = this.size;
    const x = this.i;
    const y = this.j;
    const connectors = this.connectors;
    const shape = new THREE.Shape();
    const half = size / 2;
    shape.moveTo(-half, -half);
    // Top (flat if on top edge)
    if (y === 0) {
      shape.lineTo(half, -half);
    } else {
      Piece.addConnector(
        shape,
        half,
        1,
        "in",
        connectors.top.id,
        connectors.top.profile
      );
    }
    // Right (flat if on right edge)
    if (x === numPiecesX - 1) {
      shape.lineTo(half, half);
    } else {
      Piece.addConnector(
        shape,
        half,
        2,
        "in",
        connectors.right.id,
        connectors.right.profile
      );
    }
    // Bottom (flat if on bottom edge)
    if (y === numPiecesY - 1) {
      shape.lineTo(-half, half);
    } else {
      Piece.addConnector(
        shape,
        half,
        3,
        "out",
        connectors.bottom.id,
        connectors.bottom.profile
      );
    }
    // Left (flat if on left edge)
    if (x === 0) {
      shape.lineTo(-half, -half);
    } else {
      Piece.addConnector(
        shape,
        half,
        4,
        "out",
        connectors.left.id,
        connectors.left.profile
      );
    }
    const extrudeSettings = {
      steps: 2,
      depth: size / 4,
      bevelEnabled: true,
      bevelThickness: 0.01,
      bevelSize: 0.01,
      bevelOffset: 0,
      bevelSegments: 5,
    };
    const geometry = new THREE.ExtrudeGeometry(shape, extrudeSettings);
    if (texture) {
      Piece.applyUVs(geometry, x, y, numPiecesX, numPiecesY, size);
    }
    this.mesh = new THREE.Mesh(geometry, this.material);
    if (texture) this.material.needsUpdate = true;
    this.mesh.userData.correctPosition = {
      x: (x - numPiecesX / 2) * size * 1.1,
      y: (y - numPiecesY / 2) * size * 1.1,
      z: 0,
    };
    this.mesh.userData.isSnapped = false;
    this.mesh.userData.correctI = x;
    this.mesh.userData.correctJ = y;
  }
  static applyUVs(geometry, i, j, numX, numY, pieceSize) {
    const uvAttribute = geometry.getAttribute("uv");
    const position = geometry.getAttribute("position");
    for (let k = 0; k < uvAttribute.count; k++) {
      const x = position.getX(k);
      const y = position.getY(k);
      // Use full x/y including connectors for UV mapping
      const u = (i + (x + pieceSize / 2) / pieceSize) / numX;
      const v = (j + (y + pieceSize / 2) / pieceSize) / numY;
      uvAttribute.setXY(k, u, v);
    }
  }
}

class Board {
  constructor(scene, pieceSize, numPiecesX, numPiecesY, texture) {
    this.scene = scene;
    this.pieceSize = pieceSize;
    this.numPiecesX = numPiecesX;
    this.numPiecesY = numPiecesY;
    this.texture = texture;
    this.pieces = [];
    this.group = new THREE.Group();
    this.createTable();
    this.createPieces();
    // Only add the group to the scene
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
    this.group.add(table); // Add to group, not scene
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
      this.group.add(puzzleImage); // Add to group, not scene
    }
  }
  createPieces() {
    let connectorId = 1;
    // Create all pieces
    const pieces = [];
    for (let i = 0; i < this.numPiecesX; i++) {
      for (let j = 0; j < this.numPiecesY; j++) {
        pieces.push(
          new Piece(
            i,
            j,
            this.pieceSize,
            this.numPiecesX,
            this.numPiecesY,
            this.texture
          )
        );
      }
    }
    // Set neighbors and connectors
    for (const piece of pieces) {
      const i = piece.i;
      const j = piece.j;
      // Top neighbor
      if (j > 0) {
        const neighbor = pieces.find((p) => p.i === i && p.j === j - 1);
        piece.neighbors.top = neighbor;
        piece.connectors.top = neighbor.connectors.bottom;
      } else {
        piece.connectors.top = new Connector([
          Math.random(),
          Math.random(),
          Math.random(),
          Math.random(),
        ]);
        piece.connectors.top.id = connectorId++;
      }
      // Left neighbor
      if (i > 0) {
        const neighbor = pieces.find((p) => p.i === i - 1 && p.j === j);
        piece.neighbors.left = neighbor;
        piece.connectors.left = neighbor.connectors.right;
      } else {
        piece.connectors.left = new Connector([
          Math.random(),
          Math.random(),
          Math.random(),
          Math.random(),
        ]);
        piece.connectors.left.id = connectorId++;
      }
      // Right neighbor
      if (i < this.numPiecesX - 1) {
        const neighbor = pieces.find((p) => p.i === i + 1 && p.j === j);
        piece.neighbors.right = neighbor;
        // Create connector only if not already set by left neighbor
        if (!neighbor.connectors.left) {
          const conn = new Connector([
            Math.random(),
            Math.random(),
            Math.random(),
            Math.random(),
          ]);
          conn.id = connectorId++;
          piece.connectors.right = conn;
          neighbor.connectors.left = conn;
        } else {
          piece.connectors.right = neighbor.connectors.left;
        }
      } else {
        piece.connectors.right = new Connector([
          Math.random(),
          Math.random(),
          Math.random(),
          Math.random(),
        ]);
        piece.connectors.right.id = connectorId++;
      }
      // Bottom neighbor
      if (j < this.numPiecesY - 1) {
        const neighbor = pieces.find((p) => p.i === i && p.j === j + 1);
        piece.neighbors.bottom = neighbor;
        // Create connector only if not already set by top neighbor
        if (!neighbor.connectors.top) {
          const conn = new Connector([
            Math.random(),
            Math.random(),
            Math.random(),
            Math.random(),
          ]);
          conn.id = connectorId++;
          piece.connectors.bottom = conn;
          neighbor.connectors.top = conn;
        } else {
          piece.connectors.bottom = neighbor.connectors.top;
        }
      } else {
        piece.connectors.bottom = new Connector([
          Math.random(),
          Math.random(),
          Math.random(),
          Math.random(),
        ]);
        piece.connectors.bottom.id = connectorId++;
      }
    }
    // Create geometry and add to scene
    const placedPositions = [];
    for (const piece of pieces) {
      piece.createGeometry(this.numPiecesX, this.numPiecesY, this.texture);
      let gridX, gridY;
      const gap = 0.04;
      let tries = 0;
      let valid = false;
      while (!valid && tries < 100) {
        const halfW = this.tableWidth / 2 - this.pieceSize / 2;
        const halfH = this.tableHeight / 2 - this.pieceSize / 2;
        const puzzleHalfW = (this.numPiecesX * this.pieceSize) / 2;
        const puzzleHalfH = (this.numPiecesY * this.pieceSize) / 2;
        gridX = Math.random() * (halfW * 2) - halfW;
        gridY = Math.random() * (halfH * 2) - halfH;
        if (Math.abs(gridX) < puzzleHalfW && Math.abs(gridY) < puzzleHalfH) {
          tries++;
          continue;
        }
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
      piece.mesh.position.set(gridX, gridY, 0);
      piece.mesh.rotation.z = 0;
      placedPositions.push({ x: gridX, y: gridY });
      this.pieces.push(piece.mesh);
      this.group.add(piece.mesh);
    }
    // Optionally, update neighbor.piece to reference actual mesh if needed
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
        const gridX = (i - this.numPiecesX / 2) * this.pieceSize;
        const gridY = (j - this.numPiecesY / 2) * this.pieceSize;
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

const SNAP_ROTATION = 0.4;
// SNAP_DISTANCE now depends on pieceSize, set in PuzzleScene constructor

class PuzzleScene {
  constructor(scene, pieceSize, numPiecesX, numPiecesY, texture, onReady) {
    this.scene = scene;
    this.pieceSize = pieceSize;
    this.numPiecesX = numPiecesX;
    this.numPiecesY = numPiecesY;
    this.SNAP_DISTANCE = pieceSize * 0.6;
    this.board = new Board(scene, pieceSize, numPiecesX, numPiecesY, texture);
    this.pieces = this.board.pieces;
    this.tableWidth = this.board.tableWidth;
    this.tableHeight = this.board.tableHeight;
    this.listeners = [];
    this.enableDragging();
    if (onReady) onReady(this.board.group, this.listeners);
  }

  getGridPosition(i, j) {
    return {
      x: (i - this.numPiecesX / 2) * this.pieceSize,
      y: (j - this.numPiecesY / 2) * this.pieceSize,
      z: 0,
    };
  }

  snapPiece(piece) {
    const i = piece.userData.correctI ?? piece.i;
    const j = piece.userData.correctJ ?? piece.j;
    const snapAngles = [0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2];
    let snapped = false;
    // 1. Try to snap to neighbor's actual position
    for (const dir of [
      { di: -1, dj: 0 },
      { di: 1, dj: 0 },
      { di: 0, dj: -1 },
      { di: 0, dj: 1 },
    ]) {
      const ni = i + dir.di;
      const nj = j + dir.dj;
      if (ni < 0 || ni >= this.numPiecesX || nj < 0 || nj >= this.numPiecesY)
        continue;
      const neighbor = this.pieces.find(
        (p) => p.userData.correctI === ni && p.userData.correctJ === nj
      );
      if (!neighbor || !neighbor.userData.isSnapped) continue;
      // Use neighbor's actual position for snapping
      const neighborPos = neighbor.position;
      // Calculate where this piece should be relative to neighbor
      const gridPos = this.getGridPosition(i, j);
      const expectedPos = new THREE.Vector3(
        neighborPos.x + dir.di * this.pieceSize,
        neighborPos.y + dir.dj * this.pieceSize,
        0
      );
      const dx = piece.position.x - expectedPos.x;
      const dy = piece.position.y - expectedPos.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      let rot = piece.rotation.z % (2 * Math.PI);
      if (rot < 0) rot += 2 * Math.PI;
      let snappedAngle = snapAngles.reduce((prev, curr) =>
        Math.abs(rot - curr) < Math.abs(rot - prev) ? curr : prev
      );
      const rotDiff = Math.abs(rot - snappedAngle);
      if (dist < this.SNAP_DISTANCE && rotDiff < SNAP_ROTATION) {
        piece.position.set(expectedPos.x, expectedPos.y, 0);
        piece.rotation.z = snappedAngle;
        piece.userData.isSnapped = true;
        snapped = true;
        break;
      }
    }
    // 2. If not snapped to neighbor, try grid snap (centered)
    if (!snapped) {
      const gridPos = this.getGridPosition(i, j);
      const dx = piece.position.x - gridPos.x;
      const dy = piece.position.y - gridPos.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      let rot = piece.rotation.z % (2 * Math.PI);
      if (rot < 0) rot += 2 * Math.PI;
      let snappedAngle = snapAngles.reduce((prev, curr) =>
        Math.abs(rot - curr) < Math.abs(rot - prev) ? curr : prev
      );
      const rotDiff = Math.abs(rot - snappedAngle);
      if (dist < this.SNAP_DISTANCE && rotDiff < SNAP_ROTATION) {
        piece.position.set(gridPos.x, gridPos.y, 0);
        piece.rotation.z = snappedAngle;
        piece.userData.isSnapped = true;
        snapped = true;
      }
    }
    return snapped;
  }

  enableDragging() {
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();
    let draggedPiece = null;
    let isDragging = false;
    let offset = new THREE.Vector3();
    const camera = this.scene.userData.camera;
    const controls = this.scene.userData.controls;
    let isCameraDrag = false;
    let lastPointerX = 0;
    let isRotating = false;
    let justDropped = false;

    const onPointerDown = (event) => {
      if (justDropped) {
        justDropped = false;
        return;
      }
      if (event.altKey) {
        isCameraDrag = true;
        if (controls) controls.enabled = true;
        draggedPiece = null;
        isDragging = false;
        return;
      }
      isCameraDrag = false;
      mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
      mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
      raycaster.setFromCamera(mouse, camera);
      const intersects = raycaster.intersectObjects(this.pieces);
      if (intersects.length > 0) {
        const selectedPiece = intersects[0].object;
        if (selectedPiece.userData.isSnapped) return;
        draggedPiece = selectedPiece;
        isDragging = true;
        const planeZ = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
        const intersection = new THREE.Vector3();
        raycaster.ray.intersectPlane(planeZ, intersection);
        offset.copy(selectedPiece.position).sub(intersection);
        if (controls) controls.enabled = false;
        lastPointerX = event.clientX;
        isRotating = event.shiftKey;
      }
    };

    const onPointerMove = (event) => {
      if (isCameraDrag) return;
      if (!isDragging || !draggedPiece) return;
      if (event.shiftKey) {
        const dx = event.clientX - lastPointerX;
        draggedPiece.rotation.z += dx * 0.01;
        this.snapPiece(draggedPiece);
        lastPointerX = event.clientX;
        return;
      }
      mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
      mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
      raycaster.setFromCamera(mouse, camera);
      const planeZ = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
      const intersection = new THREE.Vector3();
      raycaster.ray.intersectPlane(planeZ, intersection);
      const newPos = {
        x: intersection.x + offset.x,
        y: intersection.y + offset.y,
        z: 0.5,
      };
      draggedPiece.position.set(newPos.x, newPos.y, newPos.z);
    };

    const onPointerUp = (event) => {
      if (isCameraDrag) {
        isCameraDrag = false;
        return;
      }
      if (isDragging && draggedPiece) {
        const snapped = this.snapPiece(draggedPiece);
        if (!snapped) {
          // Clamp to table bounds
          const halfW = this.tableWidth / 2 - 0.5;
          const halfH = this.tableHeight / 2 - 0.5;
          draggedPiece.position.x = Math.max(
            -halfW,
            Math.min(halfW, draggedPiece.position.x)
          );
          draggedPiece.position.y = Math.max(
            -halfH,
            Math.min(halfH, draggedPiece.position.y)
          );
          draggedPiece.position.z = 0;
        }
        draggedPiece = null;
        isDragging = false;
        isRotating = false;
        justDropped = true;
        if (controls) controls.enabled = true;
      }
    };

    // Remove dead wheel handler and collision check
    // Store listeners for later removal
    const pointerDown = (event) => onPointerDown(event);
    const pointerMove = (event) => onPointerMove(event);
    const pointerUp = (event) => onPointerUp(event);
    window.addEventListener("pointerdown", pointerDown);
    window.addEventListener("pointermove", pointerMove);
    window.addEventListener("pointerup", pointerUp);
    this.listeners = [
      ["pointerdown", pointerDown],
      ["pointermove", pointerMove],
      ["pointerup", pointerUp],
    ];
  }
}

export function createPuzzle(scene, numPieces = 4, boardSize = 4, callback) {
  // Add better lighting (only once)
  if (!scene.userData.lightingAdded) {
    scene.add(new THREE.AmbientLight(0xffffff, 0.5)); // Soft fill
    const dirLight = new THREE.DirectionalLight(0xffffff, 1.2);
    dirLight.position.set(0, -5, 8);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 1024;
    dirLight.shadow.mapSize.height = 1024;
    scene.add(dirLight);
    const spotLight = new THREE.SpotLight(
      0xfff8e1,
      0.4,
      20,
      Math.PI / 6,
      0.3,
      1
    );
    spotLight.position.set(5, 5, 8);
    spotLight.castShadow = true;
    scene.add(spotLight);
    scene.userData.lightingAdded = true;
  }

  // Calculate piece size so board stays fixed
  const pieceSize = boardSize / numPieces;
  const numPiecesX = numPieces;
  const numPiecesY = numPieces;
  if (scene.userData.camera) {
    const camera = scene.userData.camera;
    camera.position.set(0, -boardSize * 2.5, boardSize * 3.5);
    camera.lookAt(0, 0, 0);
    camera.rotation.x = Math.PI / 6;
    if (scene.userData.controls) {
      scene.userData.controls.target.set(0, 0, 0);
      scene.userData.controls.update();
    }
  }
  const textureLoader = new THREE.TextureLoader();
  textureLoader.load(
    "/puzzle.jpg",
    (texture) => {
      texture.needsUpdate = true;
      new PuzzleScene(
        scene,
        pieceSize,
        numPiecesX,
        numPiecesY,
        texture,
        (group, listeners) => {
          group.userData.isPuzzle = true;
          if (callback) callback(group, listeners);
        }
      );
    },
    undefined,
    () => {
      new PuzzleScene(
        scene,
        pieceSize,
        numPiecesX,
        numPiecesY,
        null,
        (group, listeners) => {
          group.userData.isPuzzle = true;
          if (callback) callback(group, listeners);
        }
      );
    }
  );
}

export function disposePuzzle(scene, puzzleGroup, listeners) {
  if (!puzzleGroup) return;
  scene.remove(puzzleGroup);
  puzzleGroup.traverse((obj) => {
    if (obj.isMesh) {
      if (obj.geometry) obj.geometry.dispose();
      if (obj.material) {
        if (Array.isArray(obj.material)) {
          obj.material.forEach((mat) => mat.dispose && mat.dispose());
        } else {
          obj.material.dispose && obj.material.dispose();
        }
      }
      if (obj.material && obj.material.map) {
        obj.material.map.dispose && obj.material.map.dispose();
      }
    }
  });
  // Remove listeners
  if (listeners) {
    listeners.forEach(([type, fn]) => {
      window.removeEventListener(type, fn);
    });
  }
}
