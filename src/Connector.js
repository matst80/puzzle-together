export class Connector {
  constructor(direction, offset, profile, from, to, size) {
    this.direction = direction; // 'horizontal' or 'vertical'
    this.offset = offset; // Position offset for the connector
    this.profile = profile; // Profile of the connector
    this.from = from; // Piece this connector is from
    this.to = to; // Piece this connector is to
    this.size = from.size; // Default size if not provided
  }
  drawTop(shape) {
    const y = -this.size / 2;
    const tabWidth = this.size * 0.25;
    const tabHeight = this.size * 0.12;
    // Center tab based on offset percentage (-0.5 to 0.5 across the top)
    const midX = this.offset * (this.size / 2 - tabWidth / 2);
    // Move to start of tab on top edge
    shape.lineTo(midX - tabWidth / 2, y);
    // Tab: up, curve out, curve in, down (outward)
    shape.quadraticCurveTo(
      midX - tabWidth / 4,
      y - tabHeight, // left control point (outward)
      midX,
      y - tabHeight // top of tab (outward)
    );
    shape.quadraticCurveTo(
      midX + tabWidth / 4,
      y - tabHeight, // right control point (outward)
      midX + tabWidth / 2,
      y // right base of tab
    );
    // Continue to right edge
    shape.lineTo(this.size / 2, y);
  }
  drawBottom(shape) {
    const y = this.size / 2;
    const tabWidth = this.size * 0.25;
    const tabHeight = this.size * 0.12;
    // Center tab based on offset percentage (-0.5 to 0.5 across the bottom)
    const midX = this.offset * (this.size / 2 - tabWidth / 2);
    // Start at right edge
    shape.lineTo(this.size / 2, y);
    // Move to start of tab on bottom edge (right to left)
    shape.lineTo(midX + tabWidth / 2, y);
    // Tab: down, curve out, curve in, up (outward, mirrored)
    shape.quadraticCurveTo(
      midX + tabWidth / 4,
      y - tabHeight, // right control point (outward)
      midX,
      y - tabHeight // bottom of tab (outward)
    );
    shape.quadraticCurveTo(
      midX - tabWidth / 4,
      y - tabHeight, // left control point (outward)
      midX - tabWidth / 2,
      y // left base of tab
    );
    // Continue to left edge
    shape.lineTo(-this.size / 2, y);
  }
  drawLeft(shape) {
    const x = -this.size / 2;
    const tabWidth = this.size * 0.25;
    const tabHeight = this.size * 0.12;
    // Center cutout based on offset percentage (-0.5 to 0.5 along the left edge)
    const midY = this.offset * (this.size / 2 - tabWidth / 2);
    // Move to start of cutout on left edge
    shape.lineTo(x, midY + tabWidth / 2);
    // Cutout: left, curve in, curve out, right (inward)
    shape.quadraticCurveTo(
      x + tabHeight,
      midY + tabWidth / 4, // lower control point (inward)
      x + tabHeight,
      midY // tip of cutout (inward)
    );
    shape.quadraticCurveTo(
      x + tabHeight,
      midY - tabWidth / 4, // upper control point (inward)
      x,
      midY - tabWidth / 2 // end of cutout base
    );
    // Continue to top left corner
    shape.lineTo(x, -this.size / 2);
  }
  drawRight(shape) {
    const x = this.size / 2;
    const tabWidth = this.size * 0.25;
    const tabHeight = this.size * 0.12;
    // Center tab based on offset percentage (-0.5 to 0.5 along the right edge)
    const midY = this.offset * (this.size / 2 - tabWidth / 2);
    // Move to start of tab on right edge
    shape.lineTo(x, midY - tabWidth / 2);
    // Tab: right, curve out, curve in, left
    shape.quadraticCurveTo(
      x + tabHeight,
      midY - tabWidth / 4, // upper control point
      x + tabHeight,
      midY // tip of tab
    );
    shape.quadraticCurveTo(
      x + tabHeight,
      midY + tabWidth / 4, // lower control point
      x,
      midY + tabWidth / 2 // end of tab base
    );
    // Continue to bottom right corner
    shape.lineTo(x, this.size / 2);
  }
}
