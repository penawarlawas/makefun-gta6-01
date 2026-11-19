// shots.js — deterministic ?shot=<scene> staging for the entry screenshots.
// Every scene is the real game state: same city, same systems, same renderer.
import { CFG, blockCenter, landmarkPos } from './config.js';
import { Car } from './vehicles.js';

const RING = (CFG.cell - CFG.roadW) / 2 + 0.4;
const SIDE = RING * 2;

function putPlayerInCar(G, type, x, z, angle, color, speed) {
  const car = new Car(type, x, z, angle, color);
  car.driver = 'player';
  car.speed = speed;
  G.scene.add(car.mesh);
  G.cars.push(car);
  G.player.inCar = car;
  G.player.mesh.visible = false;
  G.player.x = x; G.player.z = z;
  G.player.mesh.position.set(x, 0, z); // shadow frustum follows from frame one
  return car;
}

// reassign a traffic car to a coastal-road lane so it flows through the scene
function putTrafficNear(G, z, speed, dir) {
  const car = G.traffic.cars[0];
  if (!car) return;
  car.ai = { axis: 'z', line: 280, dir, p: z, target: speed, stun: 0 };
  car.speed = speed;
  G.traffic.placeOnLane(car);
}

// place a pedestrian on the beach-column sidewalk ring at a chosen z
function putPedOnRing(G, idx, blockJ, z) {
  const p = G.peds.list[idx];
  p.blockI = 6; p.blockJ = blockJ;
  p.s = SIDE + (z - blockCenter(blockJ) + RING);
  p.dir = 1; p.panic = 0; p.alive = true; p.fall = 0;
}

function chaseCarBehind(G, x, z, angle, hold, speed) {
  G.police.spawnChase();
  const car = G.police.cars[G.police.cars.length - 1];
  car.pos.set(x, 0, z);
  car.angle = angle; car.mesh.rotation.y = angle;
  car.speed = speed;
  car.shotHold = hold;
  return car;
}

export function stageShot(G, name) {
  G.shotMode = true;
  G.state = 'play';
  G.hud.setVisible(true);
  G.input.enabled = false;
  G.police.clearWanted();

  if (name === 'chase') {
    // cover: side tracking shot from the beach — the Solara GT flees north with
    // three SPD interceptors right on its bumper, sunset sun over the city
    putPlayerInCar(G, 'solara', 284, 60, Math.PI, 0xff6f61, 24);
    G.shotCruise = 24;
    G.missions.index = 3;
    G.missions.active = { def: G.missions.defs[3], step: 2, timer: 0 };
    G.missions.refreshObjective();
    G.police.heat = 112; G.police.stars = 3; G.police.sinceCrime = 0;
    chaseCarBehind(G, 284, 68, Math.PI, 5, 27);   // nearly ramming
    chaseCarBehind(G, 276, 74, Math.PI, 9, 28);   // overtaking in the left lane
    chaseCarBehind(G, 284, 82, Math.PI, 14, 30);
    putTrafficNear(G, -140, 12, -1);
    for (let k = 0; k < 5; k++) putPedOnRing(G, k, 4, 52 + k * 6);
    G.cam.shotDist = 24;
    G.cam.yaw = -Math.PI / 2 - 0.22; G.cam.pitch = 0.22;
    G.cam.snapBehind(G.player.inCar.pos, G.cam.yaw);
  } else if (name === 'street') {
    // on foot on the beach boardwalk, lighthouse ahead, ocean to the right
    G.player.respawn(330, -40);
    G.player.angle = Math.PI + 0.3;
    G.player.weapon = 0;
    G.missions.index = 0;
    G.missions.refreshObjective();
    const beachSpots = [[300, -52], [306, -60], [296, -66], [310, -72], [288, -58], [292, -76]];
    beachSpots.forEach(([x, z], k) => {
      const p = G.peds.list[k];
      p.staged = true; p.alive = true; p.fall = 0; p.panic = 0;
      p.x = x; p.z = z; p.angle = Math.PI + (k % 3) * 0.5;
    });
    putTrafficNear(G, -70, 12, -1);
    G.cam.yaw = Math.PI + 0.3; G.cam.pitch = 0.22;
    G.cam.snapBehind(G.player.mesh.position, Math.PI + 0.3);
  } else if (name === 'drive') {
    // sunset cruise on the coast road, delivery timer running
    putPlayerInCar(G, 'solara', 284, -120, Math.PI, 0x2ec4b6, 33);
    G.shotCruise = 33;
    G.missions.index = 0;
    G.missions.active = { def: G.missions.defs[0], step: 2, timer: 74 };
    G.missions.refreshObjective();
    putTrafficNear(G, -170, 12, 1);
    G.cam.yaw = Math.PI; G.cam.pitch = 0.26;
    G.cam.snapBehind(G.player.inCar.pos, Math.PI);
  } else if (name === 'mission') {
    // the Cormorant interception: marker beam on the van, pistol out, SPD closing
    G.missions.index = 2;
    G.missions.startMission(2);
    G.missions.active.step = 0;
    G.missions.van.pos.set(12, 0, 280);
    G.missions.van.angle = Math.PI / 2;
    G.missions.van.mesh.rotation.y = Math.PI / 2;
    G.player.respawn(-6, 274);
    G.player.weapon = 1;
    G.player.angle = Math.PI / 2;
    G.police.heat = 55; G.police.stars = 2; G.police.sinceCrime = 0;
    chaseCarBehind(G, 36, 280, -Math.PI / 2, 12, 20);
    G.police.spawnOfficer(2, 266);
    G.police.spawnOfficer(6, 288);
    G.cam.yaw = Math.PI / 2; G.cam.pitch = 0.24;
    G.cam.snapBehind(G.player.mesh.position, Math.PI / 2);
  }
  G.time = 100;
  G.hud.update(G);
  G.minimap.frame = 1;
  G.minimap.update(G);
  G.minimap.update(G);
}
