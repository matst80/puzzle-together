// AnimationController.js
// Simple reusable animation controller for position/scale/rotation
import * as THREE from "three";

export class AnimationController {
  constructor(target, options = {}) {
    this.target = target; // THREE.Object3D
    this.animations = [];
    this.active = false;
    this.epsilon = options.epsilon || 0.002;
    this.speed = options.speed || 0.12;
    this._lastPositionTarget = null;
    this._lastScaleTarget = null;
  }

  animateTo(props, speed) {
    // props: { position: THREE.Vector3, scale: THREE.Vector3 }
    let needsNewAnim = false;
    if (props.position) {
      if (
        !this._lastPositionTarget ||
        !this._lastPositionTarget.equals(props.position)
      ) {
        needsNewAnim = true;
        this._lastPositionTarget = props.position.clone();
      }
    }
    if (props.scale) {
      if (
        !this._lastScaleTarget ||
        !this._lastScaleTarget.equals(props.scale)
      ) {
        needsNewAnim = true;
        this._lastScaleTarget = props.scale.clone();
      }
    }
    if (!needsNewAnim) return; // Don't reset animation if target is the same
    this.animations = [];
    if (props.position) {
      this.animations.push({
        type: "position",
        from: this.target.position.clone(),
        to: props.position.clone(),
        progress: 0,
        speed: speed || this.speed,
      });
    }
    if (props.scale) {
      this.animations.push({
        type: "scale",
        from: this.target.scale.clone(),
        to: props.scale.clone(),
        progress: 0,
        speed: speed || this.speed,
      });
    }
    this.active = true;
  }

  update() {
    if (!this.active) return;
    let done = true;
    for (const anim of this.animations) {
      anim.progress += anim.speed;
      if (anim.progress > 1) anim.progress = 1;
      if (anim.type === "position") {
        this.target.position.lerpVectors(anim.from, anim.to, anim.progress);
        if (anim.progress < 1 - this.epsilon) done = false;
        else this.target.position.copy(anim.to);
      } else if (anim.type === "scale") {
        this.target.scale.lerpVectors(anim.from, anim.to, anim.progress);
        if (anim.progress < 1 - this.epsilon) done = false;
        else this.target.scale.copy(anim.to);
      }
    }
    if (done) this.active = false;
  }
}
