// vehicles.js — procedural car meshes for the original Port Solara roster and
// arcade driving physics: throttle, steering, handbrake drift, collisions, damage.
import * as THREE from '../vendor/three.module.min.js';
import { CAR_SPECS } from './config.js';
import { resolveCollisions } from './city.js';

const wheelGeo = new THREE.CylinderGeometry(0.38, 0.38, 0.3, 10);
wheelGeo.rotateZ(Math.PI / 2);
const wheelMat = new THREE.MeshLambertMaterial({ color: 0x1a1a1a });
const glassMat = new THREE.MeshLambertMaterial({ color: 0x1d3557 });
const headMat = new THREE.MeshBasicMaterial({ color: 0xfff2cc });
const tailMat = new THREE.MeshBasicMaterial({ color: 0xff4444 });

export function makeCarMesh(type, color) {
  const s = CAR_SPECS[type];
  const g = new THREE.Group();
  const bodyMat = new THREE.MeshLambertMaterial({ color });
  const body = new THREE.Mesh(new THREE.BoxGeometry(s.wid, 0.6, s.len), bodyMat);
  body.position.y = 0.62; body.castShadow = true;
  g.add(body);
  const wheels = [];
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const w = new THREE.Mesh(wheelGeo, wheelMat);
    w.position.set(sx * (s.wid / 2 - 0.05), 0.38, sz * s.len * 0.32);
    w.castShadow = true; g.add(w); wheels.push(w);
  }
  if (s.kind === 'van') {
    const top = new THREE.Mesh(new THREE.BoxGeometry(s.wid * 0.96, s.hgt - 0.9, s.len * 0.82), bodyMat);
    top.position.set(0, 0.9 + (s.hgt - 0.9) / 2, -s.len * 0.05); top.castShadow = true;
    g.add(top);
    const shield = new THREE.Mesh(new THREE.BoxGeometry(s.wid * 0.8, 0.55, 0.1), glassMat);
    shield.position.set(0, 1.5, s.len * 0.37); g.add(shield);
  } else if (s.kind === 'pickup') {
    const cab = new THREE.Mesh(new THREE.BoxGeometry(s.wid * 0.88, 0.75, s.len * 0.38), glassMat);
    cab.position.set(0, 1.28, s.len * 0.16); cab.castShadow = true; g.add(cab);
    const bed = new THREE.Mesh(new THREE.BoxGeometry(s.wid * 0.94, 0.3, s.len * 0.44), bodyMat);
    bed.position.set(0, 1.05, -s.len * 0.26); g.add(bed);
  } else {
    const cabinH = s.kind === 'sport' ? 0.42 : 0.55;
    const cab = new THREE.Mesh(new THREE.BoxGeometry(s.wid * 0.84, cabinH, s.len * 0.46), glassMat);
    cab.position.set(0, 0.92 + cabinH / 2, -s.len * 0.06); cab.castShadow = true;
    g.add(cab);
    const roof = new THREE.Mesh(new THREE.BoxGeometry(s.wid * 0.86, 0.08, s.len * 0.48), bodyMat);
    roof.position.set(0, 0.96 + cabinH, -s.len * 0.06); g.add(roof);
  }
  for (const sx of [-1, 1]) {
    const hl = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.16, 0.08), headMat);
    hl.position.set(sx * s.wid * 0.32, 0.68, s.len / 2 + 0.02); g.add(hl);
    const tl = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.16, 0.08), tailMat);
    tl.position.set(sx * s.wid * 0.32, 0.68, -s.len / 2 - 0.02); g.add(tl);
  }
  if (type === 'police') {
    const hood = new THREE.Mesh(new THREE.BoxGeometry(s.wid * 0.98, 0.1, s.len * 0.3), new THREE.MeshLambertMaterial({ color: 0x14213d }));
    hood.position.set(0, 0.96, s.len * 0.3); g.add(hood);
    const barR = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.22, 0.42), new THREE.MeshBasicMaterial({ color: 0xff2222 }));
    const barB = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.22, 0.42), new THREE.MeshBasicMaterial({ color: 0x2266ff }));
    barR.position.set(-0.32, 1.66, -s.len * 0.06); barB.position.set(0.32, 1.66, -s.len * 0.06);
    g.add(barR); g.add(barB);
    g.userData.lightbar = [barR.material, barB.material];
    // crossed glow planes so the flash reads from any camera angle, even against the sunset
    const glowMats = [];
    for (const [gx, gc] of [[-0.32, 0xff3333], [0.32, 0x3377ff]]) {
      const mat = new THREE.MeshBasicMaterial({
        color: gc, transparent: true, opacity: 0,
        depthWrite: false, side: THREE.DoubleSide,
      });
      for (const ry of [0, Math.PI / 2]) {
        const plane = new THREE.Mesh(new THREE.PlaneGeometry(2.8, 1.6), mat);
        plane.position.set(gx, 2.05, -s.len * 0.06);
        plane.rotation.y = ry;
        g.add(plane);
      }
      glowMats.push(mat);
    }
    g.userData.lightglow = glowMats;
  }
  if (type === 'taxi') {
    const ts = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.24, 0.36), new THREE.MeshBasicMaterial({ color: 0xffe9b0 }));
    ts.position.set(0, 1.62, -s.len * 0.06); g.add(ts);
  }
  g.userData.wheels = wheels;
  return g;
}

export class Car {
  constructor(type, x, z, angle, color) {
    this.type = type;
    this.spec = CAR_SPECS[type];
    this.mesh = makeCarMesh(type, color);
    this.mesh.position.set(x, 0, z);
    this.angle = angle || 0;
    this.mesh.rotation.y = this.angle;
    this.speed = 0;
    this.hp = this.spec.hp;
    this.maxHp = this.spec.hp;
    this.disabled = false;
    this.ai = null;          // set by traffic/police when AI-driven
    this.driver = null;      // 'player' when stolen/entered
    this.radius = Math.max(this.spec.len, this.spec.wid) * 0.42;
    this.smokeTimer = 0;
  }
  get pos() { return this.mesh.position; }
  forward() { return { x: Math.sin(this.angle), z: Math.cos(this.angle) }; }
  update(dt, ctrl, colliders, cars, effects, audio) {
    const s = this.spec;
    if (this.disabled) ctrl = { throttle: 0, steer: 0, handbrake: false };
    const throttle = ctrl.throttle || 0;
    const steer = ctrl.steer || 0;
    if (throttle > 0) this.speed += s.accel * throttle * dt * Math.max(0.15, 1 - this.speed / s.top);
    else if (throttle < 0) {
      if (this.speed > 0.5) this.speed -= 16 * dt;
      else this.speed -= s.accel * 0.5 * dt;
    }
    this.speed *= 1 - 0.45 * dt;
    if (ctrl.handbrake) this.speed *= 1 - 1.6 * dt;
    this.speed = Math.max(-s.top * 0.35, Math.min(s.top, this.speed));
    if (Math.abs(this.speed) < 0.03 && throttle === 0) this.speed = 0;

    const grip = ctrl.handbrake ? 1.7 : 1;
    const sf = Math.max(-1, Math.min(1, this.speed / 7)) / (1 + Math.abs(this.speed) * 0.028);
    this.angle += steer * s.steer * grip * sf * dt;
    this.mesh.rotation.y = this.angle;

    const f = this.forward();
    let nx = this.pos.x + f.x * this.speed * dt;
    let nz = this.pos.z + f.z * this.speed * dt;
    let crash = 0;
    const before = { x: nx, z: nz };
    const res = resolveCollisions(nx, nz, this.radius, colliders);
    if (res.x !== before.x || res.z !== before.z) {
      crash = Math.abs(this.speed);
      this.speed *= -0.22;
      this.damage(crash * 1.6, null);
    }
    nx = res.x; nz = res.z;
    for (const other of cars) {
      if (other === this) continue;
      const dx = nx - other.pos.x, dz = nz - other.pos.z;
      const rr = this.radius + other.radius;
      const d2 = dx * dx + dz * dz;
      if (d2 < rr * rr && d2 > 0.0001) {
        const d = Math.sqrt(d2), push = (rr - d) / 2;
        nx += (dx / d) * push; nz += (dz / d) * push;
        other.pos.x -= (dx / d) * push; other.pos.z -= (dz / d) * push;
        const impact = Math.abs(this.speed - other.speed);
        if (impact > 4) {
          crash = Math.max(crash, impact);
          this.damage(impact * 1.1, other);
          other.damage(impact * 1.1, this);
        }
        this.speed *= 0.55; other.speed *= 0.55;
      }
    }
    this.pos.x = nx; this.pos.z = nz;

    const wheels = this.mesh.userData.wheels;
    for (let i = 0; i < wheels.length; i++) {
      wheels[i].rotation.x += this.speed * dt / 0.38;
      if (i >= 2) wheels[i].rotation.y = steer * 0.35;
    }
    if (this.disabled && effects) {
      this.smokeTimer -= dt;
      if (this.smokeTimer <= 0) {
        this.smokeTimer = 0.12;
        effects.smoke(this.pos.x, 1.2, this.pos.z);
      }
    }
    return crash;
  }
  damage(n, source) {
    if (this.disabled) return;
    this.hp -= n;
    if (this.hp <= 0) { this.hp = 0; this.disabled = true; }
  }
}
