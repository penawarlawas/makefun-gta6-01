// landmarks.js — Port Solara's named places: Delmar's Garage, Casa Marina bank,
// the SPD station, hospital, docks, marina, Cormorant warehouse, Club Marea,
// the park fountain, neon signage and the hidden sun coins.
import * as THREE from '../vendor/three.module.min.js';
import { landmarkPos } from './config.js';
import { range } from './random.js';

function signTexture(text, fg, bg) {
  const c = document.createElement('canvas'); c.width = 512; c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = bg; g.fillRect(0, 0, 512, 128);
  g.strokeStyle = fg; g.lineWidth = 6; g.strokeRect(8, 8, 496, 112);
  g.fillStyle = fg;
  g.font = 'bold 54px "Segoe UI", Arial, sans-serif';
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(text, 256, 68, 470);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function box(scene, colliders, x, z, w, d, h, color, y) {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(w, h, d),
    new THREE.MeshLambertMaterial({ color })
  );
  mesh.position.set(x, (y || 0) + h / 2, z);
  mesh.castShadow = true; mesh.receiveShadow = true;
  scene.add(mesh);
  if (colliders) colliders.push({ x, z, hx: w / 2, hz: d / 2, h });
  return mesh;
}

function sign(scene, text, x, y, z, w, fg, bg, rotY) {
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(w, w / 4),
    new THREE.MeshBasicMaterial({ map: signTexture(text, fg, bg), fog: true })
  );
  mesh.position.set(x, y, z);
  mesh.rotation.y = rotY || 0;
  scene.add(mesh);
  return mesh;
}

export function buildLandmarks(scene, rng, city) {
  const C = city.colliders;
  const L = {};
  for (const name of ['garage', 'docks', 'bank', 'station', 'hospital', 'marina', 'warehouse', 'beachClub', 'park']) {
    L[name] = landmarkPos(name);
  }

  // Delmar's Garage — teal workshop with a roll door and a forecourt.
  box(scene, C, L.garage.x, L.garage.z - 8, 24, 14, 6, 0x2ec4b6);
  box(scene, null, L.garage.x, L.garage.z - 0.6, 8, 0.4, 4.4, 0x1d3557);
  sign(scene, "DELMAR'S GARAGE", L.garage.x, 7.6, L.garage.z - 0.8, 18, '#ffe9b0', '#14213d', 0);

  // Casa Marina bank — marble steps, columns, gold sign.
  box(scene, C, L.bank.x, L.bank.z, 28, 20, 16, 0xe8dcc8);
  for (let k = -2; k <= 2; k++) {
    const col = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.8, 12, 8), new THREE.MeshLambertMaterial({ color: 0xf4ecd8 }));
    col.position.set(L.bank.x + k * 5.5, 6, L.bank.z + 11);
    col.castShadow = true; scene.add(col);
  }
  sign(scene, 'CASA MARINA', L.bank.x, 17.8, L.bank.z + 10.4, 20, '#ffc94d', '#1d3557', 0);

  // Solara PD station and Santa Bruma Hospital.
  box(scene, C, L.station.x, L.station.z, 24, 18, 9, 0xd8e0e8);
  box(scene, null, L.station.x, L.station.z + 9.2, 24, 0.5, 2, 0x2e6f9e);
  sign(scene, 'SOLARA PD', L.station.x, 11, L.station.z + 9.4, 14, '#6fb7ff', '#0d1b2e', 0);
  box(scene, C, L.hospital.x, L.hospital.z, 26, 20, 14, 0xf4f1de);
  sign(scene, 'HOSPITAL SANTA BRUMA', L.hospital.x, 16, L.hospital.z + 10.4, 22, '#ff6f61', '#fdf6ec', 0);

  // The docks: crates, a crane and a pier reaching over the water.
  const crateColors = [0xc96f4a, 0x2e6f9e, 0x5b8c5a, 0xe0a83c];
  for (let k = 0; k < 14; k++) {
    const x = L.docks.x + range(rng, -24, 24), z = L.docks.z + range(rng, -24, 24);
    box(scene, C, x, z, 3.4, 3.4, 3.4, crateColors[k % 4]);
  }
  box(scene, C, L.docks.x + 20, L.docks.z - 20, 2.4, 2.4, 26, 0xe0a83c);
  box(scene, null, L.docks.x + 12, L.docks.z - 20, 20, 1.4, 1.4, 0xe0a83c, 24);
  box(scene, null, 322, L.docks.z, 68, 8, 1.2, 0x8a6a48, 0.6);

  // Marina: pier, three bobbing boats, a parking pad for the Solara GT job.
  box(scene, null, 322, L.marina.z, 68, 6, 1.2, 0x8a6a48, 0.6);
  const boats = [];
  for (let k = 0; k < 3; k++) {
    const boat = new THREE.Group();
    const hull = new THREE.Mesh(new THREE.BoxGeometry(3, 1.4, 9), new THREE.MeshLambertMaterial({ color: [0xf4f1de, 0xc94f3d, 0x2e6f9e][k] }));
    hull.position.y = 0.7; boat.add(hull);
    const cab = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.4, 3), new THREE.MeshLambertMaterial({ color: 0xfdf6ec }));
    cab.position.set(0, 1.9, -1); boat.add(cab);
    boat.position.set(368 + k * 14, -0.2, L.marina.z + 10 + k * 16);
    scene.add(boat); boats.push(boat);
  }

  // Cormorant Crew warehouse — the villains' front company.
  box(scene, C, L.warehouse.x, L.warehouse.z, 34, 26, 9, 0x8d99ae);
  sign(scene, 'CORMORANT LOGISTICS', L.warehouse.x, 11, L.warehouse.z + 13.4, 24, '#b8c4cc', '#22223b', 0);

  // Club Marea on the beach road: coral walls, pool, big neon.
  box(scene, C, L.beachClub.x, L.beachClub.z - 6, 22, 16, 7, 0xff8a5c);
  const pool = new THREE.Mesh(new THREE.PlaneGeometry(12, 8), new THREE.MeshBasicMaterial({ color: 0x4ec9c0 }));
  pool.rotation.x = -Math.PI / 2; pool.position.set(L.beachClub.x, 0.08, L.beachClub.z + 12);
  scene.add(pool);
  sign(scene, 'CLUB MAREA', L.beachClub.x, 9.4, L.beachClub.z + 2.4, 18, '#ff6f61', '#14213d', 0);

  // Parque del Sol: grass, fountain, benches.
  const grass = new THREE.Mesh(new THREE.PlaneGeometry(56, 56), new THREE.MeshLambertMaterial({ color: 0x6aa84f }));
  grass.rotation.x = -Math.PI / 2; grass.position.set(L.park.x, 0.06, L.park.z);
  grass.receiveShadow = true; scene.add(grass);
  const fountain = new THREE.Mesh(new THREE.CylinderGeometry(5, 5.6, 1.2, 16), new THREE.MeshLambertMaterial({ color: 0xd8e0e8 }));
  fountain.position.set(L.park.x, 0.6, L.park.z); fountain.castShadow = true; scene.add(fountain);
  const water = new THREE.Mesh(new THREE.CylinderGeometry(4.6, 4.6, 0.3, 16), new THREE.MeshBasicMaterial({ color: 0x7fd4e8 }));
  water.position.set(L.park.x, 1.2, L.park.z); scene.add(water);
  C.push({ x: L.park.x, z: L.park.z, hx: 5.6, hz: 5.6, h: 1.2 });

  // Extra neon along the strips for dusk colour.
  sign(scene, 'SOLARA MOTEL', -120, 12, -118, 14, '#4ec9c0', '#22223b', Math.PI / 2);
  sign(scene, 'MARISCOS LULU', 120, 8, 122, 12, '#ffc94d', '#c94f3d', Math.PI);
  sign(scene, 'DUNAS MALL', -40, 14, -198, 16, '#ff8a5c', '#14213d', 0);
  sign(scene, 'HOTEL BRUMA', 40, 20, -118, 14, '#fcd5ce', '#2e6f9e', Math.PI / 2);

  // Hidden sun coins: 12 pickups on sidewalks across the city.
  const coinSpots = [];
  const corners = [[-240, -240], [-80, -240], [160, -240], [240, -160], [-240, -80], [80, -80], [-160, 80], [240, 80], [-80, 160], [160, 160], [-240, 240], [40, 240]];
  for (const [x, z] of corners) coinSpots.push({ x: x + 34, z: z + 34 });

  let t = 0;
  return {
    positions: L, coinSpots,
    update(dt) {
      t += dt;
      boats.forEach((b, k) => { b.position.y = -0.2 + Math.sin(t * 1.1 + k * 2) * 0.18; b.rotation.z = Math.sin(t * 0.9 + k) * 0.03; });
    },
  };
}
