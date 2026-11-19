// scenery.js — the sun-soaked look: sunset sky dome, warm directional sun with
// shadows, ocean, beach, palm trees, street lamps and the El Faro lighthouse.
import * as THREE from '../vendor/three.module.min.js';
import { CFG } from './config.js';
import { range, chance } from './random.js';

const SKY_VERT = `
varying vec3 vDir;
void main() {
  vDir = normalize(position);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;
const SKY_FRAG = `
varying vec3 vDir;
uniform vec3 sunDir;
void main() {
  float h = clamp(vDir.y, -0.05, 1.0);
  vec3 zenith = vec3(0.16, 0.30, 0.58);
  vec3 mid = vec3(0.99, 0.62, 0.36);
  vec3 horizon = vec3(1.0, 0.85, 0.62);
  vec3 col = mix(horizon, mid, smoothstep(0.0, 0.18, h));
  col = mix(col, zenith, smoothstep(0.12, 0.65, h));
  float s = max(dot(normalize(vDir), normalize(sunDir)), 0.0);
  col += vec3(1.0, 0.75, 0.45) * pow(s, 90.0) * 1.4;
  col += vec3(1.0, 0.6, 0.3) * pow(s, 8.0) * 0.22;
  gl_FragColor = vec4(col, 1.0);
}`;

export function buildScenery(scene, rng) {
  const sunDir = new THREE.Vector3(-0.72, 0.28, 0.35).normalize();

  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(1400, 24, 16),
    new THREE.ShaderMaterial({
      vertexShader: SKY_VERT, fragmentShader: SKY_FRAG,
      uniforms: { sunDir: { value: sunDir } },
      side: THREE.BackSide, depthWrite: false, fog: false,
    })
  );
  scene.add(sky);
  scene.fog = new THREE.Fog(0xffc9a0, 220, 1050);

  const hemi = new THREE.HemisphereLight(0xffd9b0, 0x44546a, 0.95);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xffd2a0, 2.7);
  sun.position.copy(sunDir).multiplyScalar(300);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -95; sun.shadow.camera.right = 95;
  sun.shadow.camera.top = 95; sun.shadow.camera.bottom = -95;
  sun.shadow.camera.near = 50; sun.shadow.camera.far = 700;
  sun.shadow.bias = -0.0006;
  scene.add(sun); scene.add(sun.target);

  // Beach sand strip and the ocean east of the city.
  const sand = new THREE.Mesh(
    new THREE.PlaneGeometry(CFG.beachEnd - CFG.cityHalf, CFG.cityHalf * 2 + 40),
    new THREE.MeshLambertMaterial({ color: 0xf0d9a8 })
  );
  sand.rotation.x = -Math.PI / 2;
  sand.position.set((CFG.cityHalf + CFG.beachEnd) / 2, 0.01, 0);
  sand.receiveShadow = true;
  scene.add(sand);

  const ocean = new THREE.Mesh(
    new THREE.PlaneGeometry(2400, 2600, 1, 1),
    new THREE.MeshStandardMaterial({ color: 0x1d7f9e, roughness: 0.35, metalness: 0.25, emissive: 0x0a3550, emissiveIntensity: 0.35 })
  );
  ocean.rotation.x = -Math.PI / 2;
  ocean.position.set(CFG.oceanStart + 1200, -0.35, 0);
  scene.add(ocean);
  const surf = new THREE.Mesh(
    new THREE.PlaneGeometry(3.5, CFG.cityHalf * 2 + 40),
    new THREE.MeshBasicMaterial({ color: 0xd8f4f8, transparent: true, opacity: 0.65 })
  );
  surf.rotation.x = -Math.PI / 2;
  surf.position.set(CFG.oceanStart + 1.2, -0.1, 0);
  scene.add(surf);

  // Palm trees: instanced trunks + stylized frond crowns, on the beach and park.
  const spots = [];
  for (let z = -270; z <= 270; z += 26) spots.push({ x: 300 + range(rng, -4, 10), z: z + range(rng, -6, 6) });
  for (let k = 0; k < 10; k++) spots.push({ x: range(rng, -24, 24), z: 80 + range(rng, -24, 24) });
  for (let k = 0; k < 14; k++) spots.push({ x: range(rng, -260, 260), z: range(rng, -260, 260) });
  const trunkGeo = new THREE.CylinderGeometry(0.16, 0.26, 5.4, 6);
  const trunkMat = new THREE.MeshLambertMaterial({ color: 0x8a6a48 });
  const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, spots.length);
  trunks.castShadow = true;
  const crownGeo = new THREE.ConeGeometry(2.5, 1.5, 7);
  const crownMat = new THREE.MeshLambertMaterial({ color: 0x3f8f4f });
  const crowns = new THREE.InstancedMesh(crownGeo, crownMat, spots.length);
  crowns.castShadow = true;
  const m4 = new THREE.Matrix4();
  spots.forEach((s, k) => {
    const lean = range(rng, -0.12, 0.12);
    m4.compose(new THREE.Vector3(s.x, 2.7, s.z),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(lean, 0, lean)),
      new THREE.Vector3(1, 1, 1));
    trunks.setMatrixAt(k, m4);
    m4.compose(new THREE.Vector3(s.x + lean * 5, 5.6, s.z + lean * 5),
      new THREE.Quaternion(), new THREE.Vector3(1, range(rng, 0.8, 1.2), 1));
    crowns.setMatrixAt(k, m4);
  });
  scene.add(trunks); scene.add(crowns);

  // Street lamps at block corners: warm heads that read at dusk.
  const lampSpots = [];
  for (let i = 0; i < CFG.grid; i++) for (let j = 0; j < CFG.grid; j++) {
    if ((i + j) % 2 === 0) continue;
    const cx = (i - 3) * CFG.cell, cz = (j - 3) * CFG.cell;
    const e = (CFG.cell - CFG.roadW) / 2 + 1.2;
    lampSpots.push({ x: cx - e, z: cz - e }, { x: cx + e, z: cz + e });
  }
  const poleGeo = new THREE.CylinderGeometry(0.09, 0.12, 6.2, 5);
  const poleMat = new THREE.MeshLambertMaterial({ color: 0x2f3640 });
  const poles = new THREE.InstancedMesh(poleGeo, poleMat, lampSpots.length);
  const headGeo = new THREE.SphereGeometry(0.32, 8, 6);
  const headMat = new THREE.MeshBasicMaterial({ color: 0xffe6a8 });
  const heads = new THREE.InstancedMesh(headGeo, headMat, lampSpots.length);
  lampSpots.forEach((s, k) => {
    m4.makeTranslation(s.x, 3.1, s.z); poles.setMatrixAt(k, m4);
    m4.makeTranslation(s.x, 6.3, s.z); heads.setMatrixAt(k, m4);
  });
  scene.add(poles); scene.add(heads);

  // El Faro lighthouse on the north beach, with a rotating beam.
  const tower = new THREE.Mesh(
    new THREE.CylinderGeometry(2.2, 3.2, 24, 12),
    new THREE.MeshLambertMaterial({ color: 0xf4f1de })
  );
  tower.position.set(318, 12, -268); tower.castShadow = true;
  scene.add(tower);
  const stripe = new THREE.Mesh(
    new THREE.CylinderGeometry(2.5, 2.7, 4, 12),
    new THREE.MeshLambertMaterial({ color: 0xc94f3d })
  );
  stripe.position.set(318, 17, -268); scene.add(stripe);
  const lamp = new THREE.Mesh(
    new THREE.SphereGeometry(1.3, 10, 8),
    new THREE.MeshBasicMaterial({ color: 0xfff2b0 })
  );
  lamp.position.set(318, 25.4, -268); scene.add(lamp);
  const beam = new THREE.Mesh(
    new THREE.PlaneGeometry(160, 5),
    new THREE.MeshBasicMaterial({ color: 0xffe9a0, transparent: true, opacity: 0.16, side: THREE.DoubleSide, depthWrite: false, fog: false })
  );
  beam.position.set(318, 25.4, -268);
  scene.add(beam);

  let t = 0;
  return {
    sun, sky, ocean,
    update(dt, focus) {
      t += dt;
      // Shadow frustum follows the player so nearby streets always have shadows.
      sun.position.set(focus.x + sunDir.x * 300, sunDir.y * 300, focus.z + sunDir.z * 300);
      sun.target.position.set(focus.x, 0, focus.z);
      sky.position.set(focus.x, 0, focus.z);
      beam.rotation.y = t * 0.7;
      ocean.material.emissiveIntensity = 0.3 + Math.sin(t * 0.8) * 0.08;
      surf.material.opacity = 0.5 + Math.sin(t * 1.7) * 0.18;
    },
  };
}
