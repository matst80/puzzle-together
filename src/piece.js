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
  constructor(
    gridX,
    gridY,
    size,
    id,
    sendPieceMove = null,
    onPieceMoved = null
  ) {
    this.gridX = gridX;
    this.gridY = gridY;
    this.position = new Position(0, 0);
    this.size = size;
    this.group = new THREE.Group();
    // Drag/animation state
    this._dragging = false;

    this._pickupTargetZ = 0.2;

    this._dragPlaneZ = 0.1;

    // Animation controller for position/scale
    this.animController = new AnimationController(this.group, {
      epsilon: 0.002,
      speed: 0.12,
    });
    this._lastDragTarget = null;
    this.id = id;
    this.sendPieceMove = sendPieceMove;
    if (onPieceMoved) {
      onPieceMoved((data) => {
        console.log("Piece moved:", data);
      });
    }

    this.connected = { top: false, bottom: false, left: false, right: false };
  }
  dispose(scene) {
    this.animController.dispose();
    scene.remove(this.group);
    this.group = null; // Set to null to avoid memory leaks
    this.texture = null; // Set to null to avoid memory leaks
    this.mesh = null; // Clear the mesh reference
  }
  createMesh(scene, material, gridSize) {
    this.gridSize = gridSize;
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
      depth: this.size * 0.08,
      bevelEnabled: false,
    };
    const baseGeometry = new THREE.ExtrudeGeometry(shape, baseExtrudeSettings);
    // Cardboard/paper material for all faces
    const paperMaterial = new THREE.MeshStandardMaterial({
      color: 0xc2b280,
      roughness: 0.6,
      metalness: 0.2,
    });
    const baseMesh = new THREE.Mesh(baseGeometry, paperMaterial);
    baseMesh.castShadow = true;
    baseMesh.receiveShadow = false;

    // --- TOP MESH (puzzle image, beveled) ---
    // Slightly increase depth and offset to fully cover base
    const topExtrudeSettings = {
      steps: 2,
      depth: this.size * 0.004, // slightly more than base
      bevelEnabled: true,
      bevelThickness: this.size * 0.05, // slightly more than before
      bevelSize: this.size * 0.05,
      bevelOffset: this.size * -0.05,
      bevelSegments: 12,
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
    topMesh.position.z = this.size * 0.08;

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
      // Move all connected pieces up
      const group = Array.from(this.collectConnectedGroupByProperty());
      for (const piece of group) {
        piece.animController.animateTo({
          position: new THREE.Vector3(
            piece.group.position.x,
            piece.group.position.y,
            this._pickupTargetZ
          ),
        });
      }
    }
  }
  // Animate putdown (lower and scale to 1)
  putdown() {
    if (this._dragging) {
      this._dragging = false;
      this.handleDrop(this.group.position.x, this.group.position.y);
      const group = Array.from(this.collectConnectedGroupByProperty());
      for (const piece of group) {
        this.sendPieceMove?.({
          x: piece.group.position.x,
          y: piece.group.position.y,
          z: this._dragPlaneZ,
          id: piece.id,
        });
        piece.animController.animateTo({
          position: new THREE.Vector3(
            piece.group.position.x,
            piece.group.position.y,
            this._dragPlaneZ
          ),
        });
      }
    }
  }
  // Call every frame
  updateAnimation() {
    this.animController.update();
  }
  getCorrectBoardPosition(piece = this) {
    // Use the same centering logic as Board.js
    const gridSize = this.gridSize || piece.gridSize;
    const pieceSizePercent = piece.size;
    return {
      x: (piece.gridX - gridSize / 2 + 0.5) * pieceSizePercent,
      y: (piece.gridY - gridSize / 2 + 0.5) * pieceSizePercent,
    };
  }

  isCloseToCorrectBoardPosition(x, y) {
    const correct = this.getCorrectBoardPosition(this);

    const threshold = this.size * 0.6;
    const dx = x - correct.x;
    const dy = y - correct.y;
    //console.log({ delta: dx * dx + dy * dy, threshold: threshold * threshold });

    return dx * dx + dy * dy < threshold * threshold;
  }
  getTargetPieces(x, y) {
    return [this.top, this.bottom, this.left, this.right].filter(
      isCloseTo(x, y)
    );
  }
  // Call this on drop to set connection if close to a neighbor
  handleDrop(x, y) {
    const neighbors = this.neighbors();
    const threshold = this.size * 0.5;
    for (const { key, piece: neighbor, dx, dy } of neighbors) {
      if (!neighbor) continue;
      const snapX = neighbor.group.position.x + dx;
      const snapY = neighbor.group.position.y + dy;
      const distSq = (x - snapX) * (x - snapX) + (y - snapY) * (y - snapY);
      const connected = (this.connected[key] = distSq < threshold * threshold);
      if (key === "top" && this.top) {
        this.top.connected.bottom = connected;
      } else if (key === "bottom" && this.bottom) {
        this.bottom.connected.top = connected;
      } else if (key === "left" && this.left) {
        this.left.connected.right = connected;
      } else if (key === "right" && this.right) {
        this.right.connected.left = connected;
      }
    }
  }
  moveByOtherPlayer(position) {
    this.animController.animateTo({
      position,
    });
  }
  // Recursively collect all connected pieces (using the connected property)
  collectConnectedGroupByProperty(group = new Set()) {
    if (group.has(this)) return group;
    group.add(this);
    if (this.connected.top && this.top)
      this.top.collectConnectedGroupByProperty(group);
    if (this.connected.bottom && this.bottom)
      this.bottom.collectConnectedGroupByProperty(group);
    if (this.connected.left && this.left)
      this.left.collectConnectedGroupByProperty(group);
    if (this.connected.right && this.right)
      this.right.collectConnectedGroupByProperty(group);
    return group;
  }
  neighbors() {
    return [
      { key: "top", piece: this.top, dx: 0, dy: this.size },
      { key: "bottom", piece: this.bottom, dx: 0, dy: -this.size },
      { key: "left", piece: this.left, dx: this.size, dy: 0 },
      { key: "right", piece: this.right, dx: -this.size, dy: 0 },
    ];
  }
  handleDrag(x, y, z) {
    if (this._dragging) {
      const group = Array.from(this.collectConnectedGroupByProperty());

      if (this.isCloseToCorrectBoardPosition(x, y)) {
        for (const piece of group) {
          const { x: correctX, y: correctY } =
            this.getCorrectBoardPosition(piece);
          this.sendPieceMove?.({
            x: correctX,
            y: correctY,
            z: this._dragPlaneZ,
            id: piece.id,
          });
          piece.animController.animateTo({
            position: new THREE.Vector3(
              correctX,
              correctY,
              this._pickupTargetZ
            ),
          });
        }
        return;
      } else {
        // For each neighbor, check if the dragged position is close to the correct edge
        if (group.length === 1) {
          const neighbors = this.neighbors();
          const threshold = this.size * 0.5;
          for (const { piece: neighbor, dx, dy } of neighbors) {
            if (!neighbor) continue;
            const snapX = neighbor.group.position.x + dx;
            const snapY = neighbor.group.position.y + dy;
            const distSq =
              (x - snapX) * (x - snapX) + (y - snapY) * (y - snapY);
            if (distSq < threshold * threshold) {
              // Move all connected pieces to snap position

              const dxSnap = snapX - this.group.position.x;
              const dySnap = snapY - this.group.position.y;
              for (const piece of group) {
                this.sendPieceMove?.({
                  x: piece.group.position.x + dxSnap,
                  y: piece.group.position.y + dySnap,
                  z: this._pickupTargetZ,
                  id: piece.id,
                });
                piece.animController.animateTo({
                  position: new THREE.Vector3(
                    piece.group.position.x + dxSnap,
                    piece.group.position.y + dySnap,
                    this._pickupTargetZ
                  ),
                });
              }
              return;
            }
          }
        }
      }
      // Move all connected pieces together

      const dx = x - this.group.position.x;
      const dy = y - this.group.position.y;
      for (const piece of group) {
        this.sendPieceMove?.({
          x: piece.group.position.x + dx,
          y: piece.group.position.y + dy,
          z: this._pickupTargetZ,
          id: piece.id,
        });
        piece.animController.animateTo({
          position: new THREE.Vector3(
            piece.group.position.x + dx,
            piece.group.position.y + dy,
            this._pickupTargetZ
          ),
        });
      }
    }
  }
}
