// camera.js — third-person chase camera: mouse orbit, smooth follow, pulls in
// when geometry blocks the view, and widens slightly at speed.
import * as THREE from '../vendor/three.module.min.js';

export class ChaseCamera {
  constructor(camera) {
    this.camera = camera;
    this.yaw = Math.PI;
    this.pitch = 0.32;
    this.dist = 6.5;
    this.current = new THREE.Vector3(0, 8, 12);
    this.look = new THREE.Vector3();
    this.sens = 0.0026;
  }
  addLook(dx, dy) {
    this.yaw -= dx * this.sens;
    this.pitch += dy * this.sens;
    this.pitch = Math.max(0.06, Math.min(1.25, this.pitch));
  }
  update(dt, target, inCar, speed01) {
    const wantDist = inCar ? 9.5 + speed01 * 2.5 : 6.5;
    this.dist += (wantDist - this.dist) * Math.min(1, dt * 4);
    const height = inCar ? 2.4 : 1.7;
    const cp = Math.cos(this.pitch), sp = Math.sin(this.pitch);
    const dirX = Math.sin(this.yaw) * cp, dirZ = Math.cos(this.yaw) * cp;
    let dist = this.dist;
    // pull the camera in if a building sits between it and the player
    const steps = 6;
    for (let i = 1; i <= steps; i++) {
      const d = (this.dist * i) / steps;
      const px = target.x - dirX * d, pz = target.z - dirZ * d;
      if (this.blocked(px, pz)) { dist = d - 0.4; break; }
    }
    dist = Math.max(1.6, dist);
    const want = new THREE.Vector3(
      target.x - dirX * dist,
      target.y + height + sp * dist,
      target.z - dirZ * dist
    );
    const k = Math.min(1, dt * (inCar ? 7 : 10));
    this.current.lerp(want, k);
    this.look.lerp(new THREE.Vector3(target.x, target.y + height, target.z), Math.min(1, dt * 12));
    this.camera.position.copy(this.current);
    this.camera.lookAt(this.look);
    const fov = 62 + speed01 * 12;
    if (Math.abs(this.camera.fov - fov) > 0.2) {
      this.camera.fov += (fov - this.camera.fov) * Math.min(1, dt * 5);
      this.camera.updateProjectionMatrix();
    }
  }
  blocked(x, z) {
    const colliders = this.colliders || [];
    for (const c of colliders) {
      if (c.h < 2) continue;
      if (Math.abs(x - c.x) < c.hx + 0.3 && Math.abs(z - c.z) < c.hz + 0.3) return true;
    }
    return false;
  }
  snapBehind(target, angle) {
    this.yaw = angle;
    this.current.set(target.x - Math.sin(angle) * this.dist, target.y + 4, target.z - Math.cos(angle) * this.dist);
    this.look.copy(target);
  }
}
