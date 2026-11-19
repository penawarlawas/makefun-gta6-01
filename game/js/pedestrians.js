// pedestrians.js — the people of Port Solara: instanced crowds walking the sidewalk
// rings of each block, panicking away from gunfire, and getting back up after a while.
import * as THREE from '../vendor/three.module.min.js';
import { CFG, PED_SHIRTS, PED_PANTS, blockCenter } from './config.js';
import { range, irange, pick, chance } from './random.js';

const SKIN = [0xf0c8a0, 0xd8a878, 0xa87848, 0x885830, 0xf8d8b8];
const RING = (CFG.cell - CFG.roadW) / 2 + 0.4; // sidewalk walking ring half-size
const SIDE = RING * 2;

export class Pedestrians {
  constructor(G) {
    this.G = G;
    this.list = [];
    const n = CFG.pedCount;
    const bodyGeo = new THREE.BoxGeometry(0.56, 0.82, 0.34);
    const headGeo = new THREE.BoxGeometry(0.3, 0.3, 0.3);
    const legGeo = new THREE.BoxGeometry(0.44, 0.56, 0.28);
    this.body = new THREE.InstancedMesh(bodyGeo, new THREE.MeshLambertMaterial(), n);
    this.head = new THREE.InstancedMesh(headGeo, new THREE.MeshLambertMaterial(), n);
    this.legs = new THREE.InstancedMesh(legGeo, new THREE.MeshLambertMaterial(), n);
    this.body.castShadow = true;
    const col = new THREE.Color();
    for (let k = 0; k < n; k++) {
      const p = this.makePed(k);
      this.list.push(p);
      this.body.setColorAt(k, col.setHex(p.shirt));
      this.head.setColorAt(k, col.setHex(p.skin));
      this.legs.setColorAt(k, col.setHex(p.pants));
    }
    G.scene.add(this.body); G.scene.add(this.head); G.scene.add(this.legs);
    this.dummy = new THREE.Object3D();
  }
  makePed(k) {
    const rng = this.G.rng;
    return {
      k, blockI: irange(rng, 0, 6), blockJ: irange(rng, 0, 6),
      s: range(rng, 0, SIDE * 4), dir: chance(rng, 0.5) ? 1 : -1,
      speed: range(rng, 1.1, 2.1), x: 0, z: 0, angle: 0,
      alive: true, health: 40, fall: 0, respawn: 0,
      panic: 0, px: 0, pz: 0, bob: range(rng, 0, 6),
      shirt: pick(rng, PED_SHIRTS), pants: pick(rng, PED_PANTS), skin: pick(rng, SKIN),
    };
  }
  ringPos(p) {
    const cx = blockCenter(p.blockI), cz = blockCenter(p.blockJ);
    const s = ((p.s % (SIDE * 4)) + SIDE * 4) % (SIDE * 4);
    const side = Math.floor(s / SIDE), t = (s % SIDE) - RING;
    if (side === 0) return { x: cx + t, z: cz - RING, a: p.dir > 0 ? Math.PI / 2 : -Math.PI / 2 };
    if (side === 1) return { x: cx + RING, z: cz + t, a: p.dir > 0 ? 0 : Math.PI };
    if (side === 2) return { x: cx - t, z: cz + RING, a: p.dir > 0 ? -Math.PI / 2 : Math.PI / 2 };
    return { x: cx - RING, z: cz - t, a: p.dir > 0 ? Math.PI : 0 };
  }
  panic(fromX, fromZ, radius) {
    for (const p of this.list) {
      if (!p.alive) continue;
      const d = Math.hypot(p.x - fromX, p.z - fromZ);
      if (d < radius) {
        p.panic = 4.5;
        const inv = 1 / (d || 1);
        p.px = (p.x - fromX) * inv; p.pz = (p.z - fromZ) * inv;
      }
    }
  }
  damage(p, n, fromX, fromZ) {
    if (!p.alive) return false;
    p.health -= n;
    this.panic(fromX, fromZ, 34);
    if (p.health <= 0) {
      p.alive = false; p.fall = 0.001; p.respawn = 22;
      return true; // killed
    }
    p.panic = 5;
    const d = Math.hypot(p.x - fromX, p.z - fromZ) || 1;
    p.px = (p.x - fromX) / d; p.pz = (p.z - fromZ) / d;
    return false;
  }
  nearest(x, z, r) {
    let best = null, bd = r * r;
    for (const p of this.list) {
      if (!p.alive) continue;
      const d2 = (p.x - x) ** 2 + (p.z - z) ** 2;
      if (d2 < bd) { bd = d2; best = p; }
    }
    return best;
  }
  update(dt) {
    const d = this.dummy;
    for (const p of this.list) {
      if (!p.alive) {
        p.fall = Math.min(1, p.fall + dt * 3.2);
        p.respawn -= dt;
        if (p.respawn <= 0) {
          const np = this.makePed(p.k);
          Object.assign(p, np, { fall: 0 });
        }
      } else if (p.panic > 0) {
        p.panic -= dt;
        p.x += p.px * 5.2 * dt; p.z += p.pz * 5.2 * dt;
        p.angle = Math.atan2(p.px, p.pz);
        p.x = Math.max(-CFG.cityHalf, Math.min(CFG.cityHalf, p.x));
        p.z = Math.max(-CFG.cityHalf, Math.min(CFG.cityHalf, p.z));
        if (p.panic <= 0) {
          // rejoin the nearest block ring
          p.blockI = Math.max(0, Math.min(6, Math.round(p.x / CFG.cell) + 3));
          p.blockJ = Math.max(0, Math.min(6, Math.round(p.z / CFG.cell) + 3));
          p.s = range(this.G.rng, 0, SIDE * 4);
        }
      } else {
        if (!(this.G.shotMode && p.staged)) {
          p.s += p.dir * p.speed * dt;
          if (chance(this.G.rng, dt * 0.04)) p.dir *= -1;
          const rp = this.ringPos(p);
          p.x = rp.x; p.z = rp.z; p.angle = rp.a;
        }
      }
      p.bob += dt * (p.panic > 0 ? 14 : 7);
      const bobY = p.alive ? Math.abs(Math.sin(p.bob)) * 0.06 : 0;
      const fallX = p.fall * 1.5;
      const yBase = p.alive ? 0 : -p.fall * 0.35;
      d.position.set(p.x, 0.98 + bobY + yBase, p.z);
      d.rotation.set(fallX, p.angle, 0);
      d.updateMatrix(); this.body.setMatrixAt(p.k, d.matrix);
      d.position.set(p.x, 1.58 + bobY + yBase - p.fall * 0.5, p.z);
      d.updateMatrix(); this.head.setMatrixAt(p.k, d.matrix);
      d.position.set(p.x, 0.28 + bobY * 0.5 + yBase, p.z);
      d.updateMatrix(); this.legs.setMatrixAt(p.k, d.matrix);
    }
    this.body.instanceMatrix.needsUpdate = true;
    this.head.instanceMatrix.needsUpdate = true;
    this.legs.instanceMatrix.needsUpdate = true;
  }
}
