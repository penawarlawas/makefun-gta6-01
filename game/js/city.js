// city.js — the street grid of Port Solara: asphalt, sidewalks, lane markings and
// instanced buildings. Returns collision AABBs and the data the minimap draws from.
import * as THREE from '../vendor/three.module.min.js';
import { CFG, ROAD_LINES, blockCenter, BUILDING_PALETTES, LANDMARK_BLOCKS } from './config.js';
import { range, irange, pick, chance } from './random.js';

function windowTexture() {
  const c = document.createElement('canvas'); c.width = 128; c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#ffffff'; g.fillRect(0, 0, 128, 256);
  for (let y = 8; y < 250; y += 18) {
    for (let x = 6; x < 124; x += 16) {
      const lit = Math.random() < 0.22;
      g.fillStyle = lit ? '#ffd98a' : (Math.random() < 0.5 ? '#3a4a5c' : '#54687c');
      g.fillRect(x, y, 10, 12);
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function buildCity(scene, rng) {
  const colliders = [];
  const blocks = [];
  const half = CFG.cityHalf;

  // Asphalt slab under the whole grid, sidewalk pads per block.
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(half * 2 + 4, half * 2 + 4),
    new THREE.MeshLambertMaterial({ color: 0x41454d })
  );
  ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true;
  scene.add(ground);

  const padGeo = new THREE.PlaneGeometry(CFG.cell - CFG.roadW, CFG.cell - CFG.roadW);
  const padMat = new THREE.MeshLambertMaterial({ color: 0x9b968c });
  const pads = new THREE.InstancedMesh(padGeo, padMat, CFG.grid * CFG.grid);
  pads.receiveShadow = true;
  const m4 = new THREE.Matrix4();
  let pi = 0;
  for (let i = 0; i < CFG.grid; i++) for (let j = 0; j < CFG.grid; j++) {
    const x = blockCenter(i), z = blockCenter(j);
    m4.makeRotationX(-Math.PI / 2); m4.setPosition(x, 0.03, z);
    pads.setMatrixAt(pi++, m4);
    blocks.push({ i, j, x, z, type: blockType(i, j) });
  }
  scene.add(pads);

  // Dashed center lines on every road (both axes), instanced.
  const dashGeo = new THREE.PlaneGeometry(0.35, 3.2);
  const dashMat = new THREE.MeshBasicMaterial({ color: 0xe8d9a0 });
  const dashes = [];
  for (const r of ROAD_LINES) {
    for (let s = -half + 4; s < half; s += 8) {
      dashes.push({ x: r, z: s, rot: 0 });
      dashes.push({ x: s, z: r, rot: Math.PI / 2 });
    }
  }
  const dashMesh = new THREE.InstancedMesh(dashGeo, dashMat, dashes.length);
  const q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0);
  dashes.forEach((d, k) => {
    q.setFromAxisAngle(up, d.rot);
    m4.compose(new THREE.Vector3(d.x, 0.05, d.z), q, new THREE.Vector3(1, 1, 1));
    // plane lies flat: rotate X first via quaternion multiply
    const flat = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 2);
    m4.compose(new THREE.Vector3(d.x, 0.05, d.z), q.clone().multiply(flat), new THREE.Vector3(1, 1, 1));
    dashMesh.setMatrixAt(k, m4);
  });
  scene.add(dashMesh);

  // Buildings: one instanced mesh, per-instance color, shared window texture.
  const special = new Set(Object.values(LANDMARK_BLOCKS).map(([i, j]) => i + ',' + j));
  const instances = [];
  for (const b of blocks) {
    if (special.has(b.i + ',' + b.j)) continue;
    const palette = BUILDING_PALETTES[b.type] || BUILDING_PALETTES.midtown;
    const inner = (CFG.cell - CFG.roadW) / 2 - CFG.sidewalk;
    if (b.type === 'downtown') {
      const n = irange(rng, 2, 3);
      for (let k = 0; k < n; k++) {
        const w = range(rng, 12, 20), d = range(rng, 12, 20), h = range(rng, 26, 66);
        const x = b.x + range(rng, -inner + w / 2, inner - w / 2);
        const z = b.z + range(rng, -inner + d / 2, inner - d / 2);
        instances.push({ x, z, w, d, h, color: pick(rng, palette) });
      }
    } else if (b.type === 'industrial') {
      const w = range(rng, 26, 40), d = range(rng, 20, 32), h = range(rng, 6, 10);
      instances.push({ x: b.x, z: b.z, w, d, h, color: pick(rng, palette) });
    } else {
      const n = b.type === 'beach' ? irange(rng, 1, 2) : irange(rng, 2, 3);
      for (let k = 0; k < n; k++) {
        const w = range(rng, 10, 18), d = range(rng, 10, 18);
        const h = b.type === 'beach' ? range(rng, 5, 13) : range(rng, 9, 24);
        const x = b.x + range(rng, -inner + w / 2, inner - w / 2);
        const z = b.z + range(rng, -inner + d / 2, inner - d / 2);
        instances.push({ x, z, w, d, h, color: pick(rng, palette) });
      }
    }
  }
  const buildGeo = new THREE.BoxGeometry(1, 1, 1);
  const buildMat = new THREE.MeshLambertMaterial({ map: windowTexture() });
  const buildMesh = new THREE.InstancedMesh(buildGeo, buildMat, instances.length);
  buildMesh.castShadow = true; buildMesh.receiveShadow = true;
  const col = new THREE.Color();
  instances.forEach((b, k) => {
    m4.compose(new THREE.Vector3(b.x, b.h / 2, b.z), new THREE.Quaternion(), new THREE.Vector3(b.w, b.h, b.d));
    buildMesh.setMatrixAt(k, m4);
    buildMesh.setColorAt(k, col.setHex(b.color));
    colliders.push({ x: b.x, z: b.z, hx: b.w / 2, hz: b.d / 2, h: b.h });
  });
  buildMesh.instanceMatrix.needsUpdate = true;
  if (buildMesh.instanceColor) buildMesh.instanceColor.needsUpdate = true;
  scene.add(buildMesh);

  return {
    colliders, blocks, instances,
    minimap: { roads: ROAD_LINES, half, blocks, beachEnd: CFG.beachEnd },
    playerStart: { x: 140, z: 26 },
  };
}

function blockType(i, j) {
  if (i >= 2 && i <= 4 && j >= 2 && j <= 4) return 'downtown';
  if (i === 6) return 'beach';
  if (j === 6 || j === 0) return 'industrial';
  return 'midtown';
}

// Circle-vs-AABB push-out used by the player and every car. Returns corrected x/z.
export function resolveCollisions(x, z, radius, colliders) {
  for (const c of colliders) {
    const dx = x - c.x, dz = z - c.z;
    const px = c.hx + radius - Math.abs(dx);
    const pz = c.hz + radius - Math.abs(dz);
    if (px > 0 && pz > 0) {
      if (px < pz) x = c.x + Math.sign(dx || 1) * (c.hx + radius);
      else z = c.z + Math.sign(dz || 1) * (c.hz + radius);
    }
  }
  // keep everything inside the world: ocean to the east, city limits elsewhere
  const lim = CFG.cityHalf + 2;
  if (x < -lim) x = -lim; if (x > CFG.beachEnd - 2) x = CFG.beachEnd - 2;
  if (z < -lim) z = -lim; if (z > lim) z = lim;
  return { x, z };
}
