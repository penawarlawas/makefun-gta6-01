// traffic.js — AI traffic: cars cruise the right-hand lanes of the grid, turn at
// intersections, queue behind obstacles and yield to pedestrians. Steal one and a
// replacement joins the flow a few seconds later.
import * as THREE from '../vendor/three.module.min.js';
import { CFG, ROAD_LINES, CAR_SPECS, TRAFFIC_COLORS } from './config.js';
import { Car } from './vehicles.js';
import { pick, chance, range } from './random.js';

const TYPES = ['vela', 'vela', 'vela', 'taxi', 'manglar', 'solara', 'van'];

export class Traffic {
  constructor(G) {
    this.G = G;
    this.cars = [];
    this.respawnTimer = 0;
    for (let k = 0; k < CFG.trafficCount; k++) this.spawn(true);
  }
  spawn(anywhere) {
    const G = this.G;
    const type = pick(G.rng, TYPES);
    const axis = chance(G.rng, 0.5) ? 'x' : 'z';
    const line = pick(G.rng, ROAD_LINES);
    const dir = chance(G.rng, 0.5) ? 1 : -1;
    const p = anywhere ? range(G.rng, -CFG.cityHalf, CFG.cityHalf) : -dir * (CFG.cityHalf + 8);
    const car = new Car(type, 0, 0, 0, type === 'taxi' ? 0xf7c948 : pick(G.rng, TRAFFIC_COLORS));
    car.ai = { axis, line, dir, p, target: range(G.rng, 9, 15), stun: 0, turnAt: null };
    this.placeOnLane(car);
    G.scene.add(car.mesh);
    G.cars.push(car);
    this.cars.push(car);
    return car;
  }
  placeOnLane(car) {
    const a = car.ai;
    if (a.axis === 'z') {
      car.pos.set(a.line - 4 * a.dir, 0, a.p);
      car.angle = a.dir > 0 ? 0 : Math.PI;
    } else {
      car.pos.set(a.p, 0, a.line + 4 * a.dir);
      car.angle = a.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
    }
    car.mesh.rotation.y = car.angle;
  }
  remove(car) {
    const i = this.cars.indexOf(car);
    if (i >= 0) this.cars.splice(i, 1);
    car.ai = null;
  }
  update(dt) {
    const G = this.G;
    if (this.cars.length < CFG.trafficCount) {
      this.respawnTimer -= dt;
      if (this.respawnTimer <= 0) { this.respawnTimer = 4; this.spawn(false); }
    }
    for (const car of this.cars) {
      if (car.driver === 'player' || car.disabled) continue;
      const a = car.ai;
      // a hard shove from a collision knocks the car out of its lane: stun it
      if (a.lx !== undefined && Math.hypot(car.pos.x - a.lx, car.pos.z - a.lz) > 1.2) a.stun = 1.6;
      if (a.stun > 0) {
        a.stun -= dt;
        car.speed *= 1 - 2 * dt;
        car.pos.x += Math.sin(car.angle) * car.speed * dt;
        car.pos.z += Math.cos(car.angle) * car.speed * dt;
        if (a.stun <= 0) {
          // rejoin the nearest lane after being knocked around
          a.p = a.axis === 'z' ? car.pos.z : car.pos.x;
          this.placeOnLane(car);
          a.lx = car.pos.x; a.lz = car.pos.z;
        }
        continue;
      }
      // look ahead for cars and pedestrians to yield to
      const f = { x: Math.sin(car.angle), z: Math.cos(car.angle) };
      const ax = car.pos.x + f.x * 11, az = car.pos.z + f.z * 11;
      let target = a.target;
      for (const other of G.cars) {
        if (other === car) continue;
        const dx = other.pos.x - ax, dz = other.pos.z - az;
        if (dx * dx + dz * dz < 36) { target = Math.min(target, Math.max(0, other.speed - 1)); }
      }
      if (G.peds) {
        for (const ped of G.peds.list) {
          if (!ped.alive) continue;
          const dx = ped.x - ax, dz = ped.z - az;
          if (dx * dx + dz * dz < 30) { target = 0; break; }
        }
      }
      if (car.speed < target) car.speed = Math.min(target, car.speed + 6 * dt);
      else car.speed = Math.max(target, car.speed - 12 * dt);
      a.p += a.dir * car.speed * dt;

      // intersections: sometimes turn onto the crossing road
      const along = a.p;
      for (const r of ROAD_LINES) {
        const crossed = a.dir > 0 ? (along >= r && along - a.dir * car.speed * dt < r) : (along <= r && along - a.dir * car.speed * dt > r);
        if (crossed && chance(G.rng, 0.3)) {
          const oldLine = a.line;
          a.axis = a.axis === 'z' ? 'x' : 'z';
          a.line = r;
          a.dir = chance(G.rng, 0.5) ? 1 : -1;
          a.p = oldLine;
          break;
        }
      }
      if (a.p > CFG.cityHalf + 12) a.p = -CFG.cityHalf - 10;
      if (a.p < -CFG.cityHalf - 12) a.p = CFG.cityHalf + 10;
      this.placeOnLane(car);
      a.lx = car.pos.x; a.lz = car.pos.z;
      car.mesh.rotation.y = car.angle;
      const wheels = car.mesh.userData.wheels;
      for (const w of wheels) w.rotation.x += car.speed * dt / 0.38;
    }
  }
}
