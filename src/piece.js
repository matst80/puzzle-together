import * as THREE from "three";
import { Connector } from "./Connector";
import { AnimationController } from "./AnimationController";

export class Position {
  constructor(x, y) {
    this.x = x;
    this.y = y;
  }
}

const isCloseTo = (x, y) => (piece) => {
  if (!piece) return false; // Handle undefined piece
  const correctX = piece.group.position.x;
  const correctY = piece.group.position.y;
  const threshold = piece.size * 0.6; // Allow some tolerance
  const dx = x - correctX;
  const dy = y - correctY;
  return dx * dx + dy * dy < threshold * threshold;
};

export class Piece {
  constructor(gridX, gridY, size) {
    this.gridX = gridX;
    this.gridY = gridY;
    this.position = new Position(0, 0);
    this.size = size;
    this.group = new THREE.Group();
    // Drag/animation state
    this._dragging = false;

    this._pickupTargetZ = 0.4;

    this._dragPlaneZ = 0.3;

    // Animation controller for position/scale
    this.animController = new AnimationController(this.group, {
      epsilon: 0.002,
      speed: 0.12,
    });
    this._lastDragTarget = null;
  }
  createMesh(scene, material, gridSize) {
    console.log(
      "Creating mesh for piece at grid position:",
      this.gridX,
      this.gridY,
      this.size
    );
    const shape = new THREE.Shape();
    // top left corner
    shape.moveTo(-this.size / 2, -this.size / 2);
    // clockwise top line
    if (this.topConnector) {
      this.topConnector.drawTop(shape);
    } else {
      shape.lineTo(this.size / 2, -this.size / 2);
    }
    // clockwise right line
    if (this.rightConnector) {
      this.rightConnector.drawRight(shape);
    } else {
      shape.lineTo(this.size / 2, this.size / 2);
    }
    // clockwise bottom line
    if (this.bottomConnector) {
      this.bottomConnector.drawBottom(shape);
    } else {
      shape.lineTo(-this.size / 2, this.size / 2);
    }
    // clockwise left line
    if (this.leftConnector) {
      this.leftConnector.drawLeft(shape);
    } else {
      //shape.lineTo(-this.size / 2, -this.size / 2);
      shape.closePath();
    }

    // --- BASE MESH (cardboard/paper sides & bottom) ---
    const baseExtrudeSettings = {
      steps: 2,
      depth: 0.03,
      bevelEnabled: false,
    };
    const baseGeometry = new THREE.ExtrudeGeometry(shape, baseExtrudeSettings);
    // Cardboard/paper material for all faces
    const paperMaterial = new THREE.MeshStandardMaterial({
      color: 0xc2b280,
      roughness: 0.8,
      metalness: 0.1,
    });
    const baseMesh = new THREE.Mesh(baseGeometry, paperMaterial);
    baseMesh.castShadow = true;
    baseMesh.receiveShadow = false;

    // --- TOP MESH (puzzle image, beveled) ---
    // Slightly increase depth and offset to fully cover base
    const topExtrudeSettings = {
      steps: 2,
      depth: 0.002, // slightly more than base
      bevelEnabled: true,
      bevelThickness: 0.011, // slightly more than before
      bevelSize: 0.011,
      bevelOffset: -0.011,
      bevelSegments: 8,
    };
    const topGeometry = new THREE.ExtrudeGeometry(shape, topExtrudeSettings);
    // Calculate UV mapping for the top mesh
    const uvAttribute = topGeometry.getAttribute("uv");
    const position = topGeometry.getAttribute("position");
    for (let k = 0; k < uvAttribute.count; k++) {
      const x = position.getX(k);
      const y = position.getY(k);
      const u = (this.gridX + (x + this.size / 2) / this.size) / gridSize;
      const v = (this.gridY + (y + this.size / 2) / this.size) / gridSize;
      uvAttribute.setXY(k, u, v);
    }
    const topMesh = new THREE.Mesh(topGeometry, material);
    topMesh.castShadow = true;
    topMesh.receiveShadow = false;
    // Position the top mesh to fully cover the base
    topMesh.position.z = 0.03;

    // --- GROUPING ---

    this.group.add(baseMesh);
    this.group.add(topMesh);
    this.mesh = topMesh; // For setPosition
    this.bottomMesh = baseMesh; // For setPosition
    scene.add(this.group);
  }
  setTop(piece) {
    this.top = piece;
    const profile = null; // Placeholder for profile logic
    const offset = Math.random() * 0.8 + 0.1; // Random offset for the connector
    if (!this.topConnector) {
      this.topConnector = new Connector(
        "vertical",
        offset,
        profile,
        this,
        piece
      );
      piece.bottomConnector = new Connector(
        "vertical",
        offset,
        profile,
        piece,
        this
      );
    }
  }
  setBottom(piece) {
    this.bottom = piece;
    const profile = null; // Placeholder for profile logic
    const offset = Math.random() * 0.8 + 0.1; // Random offset for the connector
    if (!this.bottomConnector) {
      this.bottomConnector = new Connector(
        "vertical",
        offset,
        profile,
        this,
        piece
      );
      piece.topConnector = new Connector(
        "vertical",
        offset,
        profile,
        piece,
        this
      );
    }
  }
  setLeft(piece) {
    this.left = piece;
    const profile = null; // Placeholder for profile logic
    const offset = Math.random() * 0.8 + 0.1; // Random offset for the connector
    if (!this.leftConnector) {
      this.leftConnector = new Connector(
        "horizontal",
        offset,
        profile,
        this,
        piece
      );
      piece.rightConnector = new Connector(
        "horizontal",
        offset,
        profile,
        piece,
        this
      );
    }
  }
  setRight(piece) {
    this.right = piece;
    const profile = null; // Placeholder for profile logic
    const offset = Math.random() * 0.8 + 0.1; //
    if (!this.rightConnector) {
      this.rightConnector = new Connector(
        "horizontal",
        offset,
        profile,
        this,
        piece
      );
      piece.leftConnector = new Connector(
        "horizontal",
        offset,
        profile,
        piece,
        this
      );
    }
  }
  setPosition(position) {
    this.position = position;
    this.group.position.set(
      position.x,
      position.y,
      this._dragPlaneZ // Use drag plane as default Z
    );
  }
  // Animate pickup (lift and scale up)
  pickup() {
    console.log(
      "Pickup animation started for piece at:",
      this.gridX,
      this.gridY,
      this._dragging
    );
    if (!this._dragging) {
      this._dragging = true;
      this.animController.animateTo({
        position: new THREE.Vector3(
          this.group.position.x,
          this.group.position.y,
          this._pickupTargetZ
        ),
        scale: new THREE.Vector3(1, 1, 1),
      });
    }
  }
  // Animate putdown (lower and scale to 1)
  putdown() {
    if (this._dragging) {
      this._dragging = false;
      this.animController.animateTo({
        position: new THREE.Vector3(
          this.group.position.x,
          this.group.position.y,
          this._dragPlaneZ
        ),
        scale: new THREE.Vector3(1, 1, 1),
      });
    }
  }
  // Call every frame
  updateAnimation() {
    this.animController.update();
  }
  getCorrectBoardPosition(gridSize) {
    // Use the exact centering logic as Board
    const pieceSizePercent = this.size;
    const correctX = (this.gridX - gridSize / 2 - 1) * pieceSizePercent;
    const correctY = (this.gridY - gridSize / 2 - 1) * pieceSizePercent;
    return { x: correctX, y: correctY };
  }

  isCloseToCorrectBoardPosition(x, y, gridSize) {
    const { x: correctX, y: correctY } = this.getCorrectBoardPosition(gridSize);
    const threshold = this.size * 0.6;
    const dx = x - correctX;
    const dy = y - correctY;
    //console.log({ delta: dx * dx + dy * dy, threshold: threshold * threshold });

    return dx * dx + dy * dy < threshold * threshold;
  }
  getTargetPieces(x, y) {
    return [this.top, this.bottom, this.left, this.right].filter(
      isCloseTo(x, y)
    );
  }
  handleDrag(x, y, z) {
    if (this._dragging) {
      const gridSize = this.gridSize || 1; // fallback if not set
      if (this.isCloseToCorrectBoardPosition(x, y, gridSize)) {
        const { x: correctX, y: correctY } =
          this.getCorrectBoardPosition(gridSize);
        this.animController.animateTo({
          position: new THREE.Vector3(correctX, correctY, this._pickupTargetZ),
        });
        return;
      } else {
        // For each neighbor, check if the dragged position is close to the correct edge
        const neighbors = [
          { piece: this.top, dx: 0, dy: this.size }, // top neighbor: dragged piece above
          { piece: this.bottom, dx: 0, dy: -this.size }, // bottom neighbor: dragged piece below
          { piece: this.left, dx: this.size, dy: 0 }, // left neighbor: dragged piece right of neighbor
          { piece: this.right, dx: -this.size, dy: 0 }, // right neighbor: dragged piece left of neighbor
        ];
        const threshold = this.size * 0.5;
        for (const { piece: neighbor, dx, dy } of neighbors) {
          if (!neighbor) continue;
          const snapX = neighbor.group.position.x + dx;
          const snapY = neighbor.group.position.y + dy;
          const distSq = (x - snapX) * (x - snapX) + (y - snapY) * (y - snapY);

          if (distSq < threshold * threshold) {
            console.log({ distSq, threshold: threshold * threshold });
            this.animController.animateTo({
              position: new THREE.Vector3(snapX, snapY, this._pickupTargetZ),
            });
            return;
          }
        }
      }
      // If no neighbors matched, just update position directly
      this.animController.animateTo({
        position: new THREE.Vector3(x, y, this._pickupTargetZ),
      });
    }
  }
}
