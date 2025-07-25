import * as THREE from "three";

class Position {
  constructor(x, y) {
    this.x = x;
    this.y = y;
  }
}

export class Board {
  constructor(texture, gridSize, scene) {
    this.texture = texture;
    this.gridSize = gridSize;
    this.group = new THREE.Group();
    scene.add(this.group); // Add group to scene
    const pieceSizePercent = 1.0 / gridSize;
    this.pieces = Array.from(gridSize * gridSize);
    const material = new THREE.MeshStandardMaterial({
      map: texture || null,
      color: texture
        ? 0xffffff
        : new THREE.Color(Math.random(), Math.random(), Math.random()),
      metalness: 0.3,
      roughness: 0.6,
    });
    for (var i = 0; i < gridSize; i++) {
      for (var j = 0; j < gridSize; j++) {
        this.pieces[i * gridSize + j] = new Piece(
          material,
          i,
          j,
          pieceSizePercent
        );
      }
    }
    for (var i = 1; i < gridSize - 1; i++) {
      for (var j = 1; j < gridSize - 1; j++) {
        const current = this.pieces[i * gridSize + j];
        current.setLeft(this.pieces[(i - 1) * gridSize + j]);
        current.setRight(this.pieces[(i + 1) * gridSize + j]);
        current.setTop(this.pieces[i * gridSize + (j - 1)]);
        current.setBottom(this.pieces[i * gridSize + (j + 1)]);
      }
    }
    for (var i = 0; i < gridSize; i++) {
      for (var j = 0; j < gridSize; j++) {
        const current = this.pieces[i * gridSize + j];
        const gridX = (i - gridSize / 2 + 0.5) * pieceSizePercent;
        const gridY = (j - gridSize / 2 + 0.5) * pieceSizePercent;

        current.createMesh(scene, material);
        current.setPosition(new Position(gridX, gridY));
      }
    }
    // Make the table much larger than the puzzle area

    const tableThickness = 0.2;
    const tableMaterial = new THREE.MeshStandardMaterial({ color: 0x8b5a2b });
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
      puzzleImage.position.set(0, 0, tableThickness / 2 + 0.005);
      puzzleImage.rotation.z = 0;
      puzzleImage.receiveShadow = false;
      this.group.add(puzzleImage); // Add to group, not scene
    }
  }

  update(scene) {
    // console.log(scene);
  }
  render() {}
}

class Connector {
  constructor(direction, offset, profile, from, to) {
    this.direction = direction; // 'horizontal' or 'vertical'
    this.offset = offset; // Position offset for the connector
    this.profile = profile; // Profile of the connector
    this.from = from; // Piece this connector is from
    this.to = to; // Piece this connector is to
  }
  drawTop(shape) {
    const offset = this.offset * this.from.size - this.from.size / 2;
    shape.lineTo(this.size / 2, -this.size / 2);
  }
  drawBottom(shape) {
    const offset = this.offset * this.from.size - this.from.size / 2;
    shape.lineTo(-this.from.size / 2, this.size / 2);
  }
  drawLeft(shape) {
    const offset = this.offset * this.from.size - this.from.size / 2;
    shape.lineTo(-this.size / 2, -this.size / 2);
  }
  drawRight(shape) {
    const offset = this.offset * this.from.size - this.from.size / 2;
    shape.lineTo(this.size / 2, this.size / 2);
  }
}

const extrudeSettings = {
  steps: 2,
  depth: 0.1,
  bevelEnabled: true,
  bevelThickness: 0.01,
  bevelSize: 0.01,
  bevelOffset: 0,
  bevelSegments: 5,
};

class Piece {
  constructor(gridX, gridY, size) {
    this.gridX = gridX;
    this.gridY = gridY;
    this.position = new Position(0, 0);
    this.size = size;
    this.group = new THREE.Group();
  }
  createMesh(scene, material) {
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

    const geometry = new THREE.ExtrudeGeometry(shape, extrudeSettings);

    const uvAttribute = geometry.getAttribute("uv");
    const position = geometry.getAttribute("position");
    for (let k = 0; k < uvAttribute.count; k++) {
      const x = position.getX(k);
      const y = position.getY(k);
      // Use full x/y including connectors for UV mapping
      const u = (x + this.size / 2) / this.size;
      const v = (y + this.size / 2) / this.size;
      console.dir({ x, y, u, v });
      uvAttribute.setXY(k, u, v);
    }

    this.mesh = new THREE.Mesh(geometry, material);

    this.mesh.castShadow = true;
    this.mesh.receiveShadow = false;
    this.group.add(this.mesh); // Add mesh to group
    scene.add(this.group); // Add mesh to scene
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
    this.mesh.position.set(
      position.x,
      position.y,
      0.05 // Slightly above the table
    );
  }
}
