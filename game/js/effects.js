// effects.js — particle bursts, gun tracers, muzzle flashes, smoke and camera shake.
// One instanced pool keeps the draw call count flat no matter how chaotic it gets.
import * as THREE from '../vendor/three.module.min.js';

const MAX_P = 320;
const MAX_TRACERS = 14;

export class Effects {
  constructor(scene) {
    this.scene = scene;
    this.parts = [];
    for (let i = 0; i < MAX_P; i++) this.parts.push({ life: 0 });
    this.geo = new THREE.BoxGeometry(1, 1, 1);
    this.mat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.95 });
    this.mesh = new THREE.InstancedMesh(this.geo, this.mat, MAX_P);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false;
    scene.add(this.mesh);
    this.dummy = new THREE.Object3D();
    this.color = new THREE.Color();
    this.tracers = [];
    for (let i = 0; i < MAX_TRACERS; i++) {
      const g = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
      const m = new THREE.LineBasicMaterial({ color: 0xffe9a0, transparent: true, opacity: 0 });
      const line = new THREE.Line(g, m);
      line.frustumCulled = false;
      scene.add(line);
      this.tracers.push({ line, life: 0 });
    }
    this.flash = new THREE.PointLight(0xffc94d, 0, 18);
    scene.add(this.flash);
    this.shakeAmt = 0;
    this.cursor = 0;
  }
  burst(x, y, z, colorHex, n, speed, opts) {
    const o = opts || {};
    for (let i = 0; i < n; i++) {
      const p = this.parts[this.cursor];
      this.cursor = (this.cursor + 1) % MAX_P;
      const a = Math.random() * Math.PI * 2;
      const up = (o.up === undefined ? 0.5 : o.up) + Math.random() * 0.8;
      p.x = x; p.y = y; p.z = z;
      p.vx = Math.cos(a) * speed * (0.3 + Math.random() * 0.7);
      p.vz = Math.sin(a) * speed * (0.3 + Math.random() * 0.7);
      p.vy = up * speed * (0.4 + Math.random() * 0.6);
      p.life = p.maxLife = (o.life || 0.5) * (0.6 + Math.random() * 0.6);
      p.size = (o.size || 0.12) * (0.7 + Math.random() * 0.6);
      p.grav = o.grav === undefined ? 9 : o.grav;
      p.color = colorHex;
    }
  }
  smoke(x, y, z) {
    this.burst(x, y, z, 0x555555, 2, 0.8, { life: 1.4, size: 0.4, grav: -1.2, up: 0.9 });
  }
  muzzle(x, y, z) {
    this.burst(x, y, z, 0xffe9a0, 5, 3, { life: 0.12, size: 0.09, grav: 0 });
    this.flash.position.set(x, y, z);
    this.flash.intensity = 26;
  }
  explosion(x, y, z) {
    this.burst(x, y, z, 0xff6f3d, 26, 7, { life: 0.8, size: 0.3 });
    this.burst(x, y, z, 0xffc94d, 16, 9, { life: 0.5, size: 0.2 });
    this.burst(x, y + 1, z, 0x333333, 12, 2.5, { life: 1.8, size: 0.6, grav: -1.5 });
    this.flash.position.set(x, y + 1, z);
    this.flash.intensity = 60;
    this.shake(0.6);
  }
  tracer(ax, ay, az, bx, by, bz) {
    let best = this.tracers[0];
    for (const t of this.tracers) if (t.life < best.life) best = t;
    const pos = best.line.geometry.attributes.position;
    pos.setXYZ(0, ax, ay, az); pos.setXYZ(1, bx, by, bz);
    pos.needsUpdate = true;
    best.life = 0.09;
    best.line.material.opacity = 0.9;
  }
  shake(amount) { this.shakeAmt = Math.min(0.8, this.shakeAmt + amount); }
  applyShake(camera) {
    if (this.shakeAmt > 0.002) {
      camera.position.x += (Math.random() - 0.5) * this.shakeAmt;
      camera.position.y += (Math.random() - 0.5) * this.shakeAmt;
      camera.position.z += (Math.random() - 0.5) * this.shakeAmt;
    }
  }
  update(dt) {
    const d = this.dummy;
    for (let i = 0; i < MAX_P; i++) {
      const p = this.parts[i];
      if (p.life > 0) {
        p.life -= dt;
        p.vy -= p.grav * dt;
        p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
        if (p.y < 0.05) { p.y = 0.05; p.vy *= -0.3; p.vx *= 0.7; p.vz *= 0.7; }
        const s = p.size * Math.max(0.05, p.life / p.maxLife);
        d.position.set(p.x, p.y, p.z);
        d.scale.set(s, s, s);
        d.rotation.set(p.life * 3, p.life * 2, 0);
        d.updateMatrix();
        this.mesh.setMatrixAt(i, d.matrix);
        this.mesh.setColorAt(i, this.color.setHex(p.color));
      } else {
        d.position.set(0, -100, 0); d.scale.set(0.001, 0.001, 0.001);
        d.updateMatrix();
        this.mesh.setMatrixAt(i, d.matrix);
      }
    }
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
    for (const t of this.tracers) {
      if (t.life > 0) {
        t.life -= dt;
        t.line.material.opacity = Math.max(0, t.life / 0.09);
      }
    }
    this.flash.intensity *= Math.pow(0.001, dt * 3);
    if (this.flash.intensity < 0.3) this.flash.intensity = 0;
    this.shakeAmt *= Math.pow(0.02, dt);
  }
}
