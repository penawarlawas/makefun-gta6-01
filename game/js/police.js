// police.js — the wanted system: heat from crimes, star levels, SPD interceptors
// that chase and ram, officers that deploy on foot and shoot, busts and escapes.
import * as THREE from '../vendor/three.module.min.js';
import { CFG, ROAD_LINES, nearestRoadLine } from './config.js';
import { Car } from './vehicles.js';
import { resolveCollisions } from './city.js';
import { range, pick, chance } from './random.js';

function officerMesh() {
  const g = new THREE.Group();
  const navy = new THREE.MeshLambertMaterial({ color: 0x1d3557 });
  const skin = new THREE.MeshLambertMaterial({ color: 0xd8a878 });
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.75, 0.34), navy);
  torso.position.y = 1.05; torso.castShadow = true; g.add(torso);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.32, 0.32), skin);
  head.position.y = 1.62; g.add(head);
  const cap = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.12, 0.36), navy);
  cap.position.y = 1.82; g.add(cap);
  const badge = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.05), new THREE.MeshBasicMaterial({ color: 0xffc94d }));
  badge.position.set(0.15, 1.25, 0.18); g.add(badge);
  for (const sx of [-1, 1]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.68, 0.2), navy);
    leg.geometry.translate(0, -0.34, 0);
    leg.position.set(sx * 0.15, 0.68, 0); g.add(leg);
  }
  return g;
}

export class Police {
  constructor(G) {
    this.G = G;
    this.heat = 0; this.stars = 0; this.sinceCrime = 99;
    this.cars = []; this.officers = [];
    this.spawnCooldown = 0; this.bustT = 0;
    this.lastReason = ''; this.reasonT = 0;
    for (let k = 0; k < CFG.patrolCount; k++) this.spawnPatrol();
  }
  spawnPatrol() {
    const G = this.G;
    const car = new Car('police', 0, 0, 0, 0xf4f1de);
    car.ai = { axis: chance(G.rng, 0.5) ? 'x' : 'z', line: pick(G.rng, ROAD_LINES), dir: chance(G.rng, 0.5) ? 1 : -1, p: range(G.rng, -250, 250) };
    car.mode = 'patrol';
    this.placePatrol(car);
    G.scene.add(car.mesh); G.cars.push(car); this.cars.push(car);
  }
  placePatrol(car) {
    const a = car.ai;
    if (a.axis === 'z') { car.pos.set(a.line - 4 * a.dir, 0, a.p); car.angle = a.dir > 0 ? 0 : Math.PI; }
    else { car.pos.set(a.p, 0, a.line + 4 * a.dir); car.angle = a.dir > 0 ? Math.PI / 2 : -Math.PI / 2; }
    car.mesh.rotation.y = car.angle;
  }
  spawnChase() {
    const G = this.G, p = G.player;
    const car = new Car('police', 0, 0, 0, 0xf4f1de);
    const axis = chance(G.rng, 0.5) ? 'x' : 'z';
    const line = pick(G.rng, ROAD_LINES);
    const dir = chance(G.rng, 0.5) ? 1 : -1;
    const along = (axis === 'z' ? p.z : p.x) + dir * range(G.rng, 120, 190);
    car.ai = { axis, line, dir, p: Math.max(-280, Math.min(280, along)) };
    this.placePatrol(car);
    car.mode = 'chase'; car.stuckT = 0; car.reverseT = 0; car.deployed = false;
    G.scene.add(car.mesh); G.cars.push(car); this.cars.push(car);
  }
  addHeat(n, reason) {
    const G = this.G;
    this.heat = Math.min(340, this.heat + n);
    this.sinceCrime = 0;
    const before = this.stars;
    this.stars = CFG.heatPerStar.filter((h) => this.heat >= h).length;
    this.reasonT -= 0; // reset below
    if (reason && (reason !== this.lastReason || this.reasonT <= 0)) {
      G.hud.notify(reason, 'crime');
      this.lastReason = reason; this.reasonT = 2.5;
    }
    if (this.stars > before) {
      G.audio.busted();
      G.hud.notify('WANTED LEVEL ' + this.stars + ' — SPD is responding', 'crime');
    }
  }
  clearWanted() {
    this.heat = 0; this.stars = 0; this.bustT = 0;
    for (const car of this.cars) if (car.mode === 'chase') this.toPatrol(car);
    for (const off of this.officers) this.G.scene.remove(off.mesh);
    this.officers = [];
    this.G.audio.setSiren(false, 1);
  }
  toPatrol(car) {
    car.mode = 'patrol';
    const axis = chance(this.G.rng, 0.5) ? 'x' : 'z';
    car.ai = { axis, line: nearestRoadLine(axis === 'z' ? car.pos.x : car.pos.z), dir: chance(this.G.rng, 0.5) ? 1 : -1, p: axis === 'z' ? car.pos.z : car.pos.x };
    car.deployed = false;
  }
  nearestOfficer(x, z, r) {
    let best = null, bd = r * r;
    for (const o of this.officers) {
      if (!o.alive) continue;
      const d2 = (o.x - x) ** 2 + (o.z - z) ** 2;
      if (d2 < bd) { bd = d2; best = o; }
    }
    return best;
  }
  damageOfficer(off, n) {
    off.health -= n;
    if (off.health <= 0 && off.alive) {
      off.alive = false; off.fall = 0.001; off.removeT = 6;
      return true;
    }
    return false;
  }
  update(dt) {
    const G = this.G, p = G.player;
    this.sinceCrime += dt; this.reasonT -= dt; this.spawnCooldown -= dt;
    // heat decays once you stop offending and put distance between you and the SPD
    let nearestChase = Infinity;
    for (const car of this.cars) if (car.mode === 'chase') nearestChase = Math.min(nearestChase, Math.hypot(car.pos.x - p.x, car.pos.z - p.z));
    if (this.stars > 0 && this.sinceCrime > CFG.heatDecayDelay && nearestChase > 60) {
      this.heat = Math.max(0, this.heat - CFG.heatDecayRate * dt);
      const s = CFG.heatPerStar.filter((h) => this.heat >= h).length;
      if (s < this.stars) {
        this.stars = s;
        if (s === 0) { G.hud.notify('You lost the cops. Keep it clean.', 'mission'); this.clearWanted(); }
      }
    }
    // spawn pursuit cars up to the wanted level
    const chasing = this.cars.filter((c) => c.mode === 'chase').length;
    const want = this.stars > 0 ? Math.min(this.stars + 1, CFG.maxChaseCars) : 0;
    if (chasing < want && this.spawnCooldown <= 0) { this.spawnChase(); this.spawnCooldown = 2.2; }
    if (this.stars === 0) for (const car of this.cars) if (car.mode === 'chase') this.toPatrol(car);

    let sirenDist = 1;
    for (const car of this.cars) {
      if (car.driver === 'player' || car.disabled) continue;
      if (car.mode === 'patrol') {
        const a = car.ai;
        a.p += a.dir * 11 * dt;
        if (a.p > 292) a.p = -290; if (a.p < -292) a.p = 290;
        this.placePatrol(car);
        car.speed = 11;
      } else {
        const dx = p.x - car.pos.x, dz = p.z - car.pos.z;
        const dist = Math.hypot(dx, dz);
        sirenDist = Math.min(sirenDist, dist / 160);
        const wantAngle = Math.atan2(dx, dz);
        let diff = wantAngle - car.angle;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        let throttle = 1, steer = Math.max(-1, Math.min(1, diff * 2.6));
        if (dist < 9 && !p.inCar) throttle = 0.15;
        if (G.shotMode) {
          // staged scenes: hold a staggered pursuit formation, lanes locked
          steer = 0;
          if (dist < (car.shotHold || 8)) throttle = 0.05;
        }
        if (Math.abs(car.speed) < 1.2 && dist > 10) {
          car.stuckT += dt;
          if (car.stuckT > 1.6) { car.reverseT = 0.9; car.stuckT = 0; }
        } else car.stuckT = 0;
        if (car.reverseT > 0) { car.reverseT -= dt; throttle = -0.7; steer = -steer; }
        const crash = car.update(dt, { throttle, steer, handbrake: false }, G.city.colliders, G.cars, G.effects, G.audio);
        if (crash > 10) G.audio.crash(crash / 30);
        // deploy officers when the player is on foot and the cruiser is close
        if (!p.inCar && dist < 20 && !car.deployed && this.officers.length < Math.min(this.stars + 1, CFG.maxOfficers)) {
          car.deployed = true;
          this.spawnOfficer(car.pos.x + 1.5, car.pos.z);
          if (this.stars >= 3) this.spawnOfficer(car.pos.x - 1.5, car.pos.z);
        }
      }
      // flashing lightbar and its additive glow
      const bar = car.mesh.userData.lightbar;
      if (bar) {
        const on = car.mode === 'chase';
        const phase = Math.floor(G.time * 6) % 2 === 0;
        bar[0].color.setHex(on && phase ? 0xff2222 : 0x551111);
        bar[1].color.setHex(on && !phase ? 0x2266ff : 0x112255);
        const glow = car.mesh.userData.lightglow;
        if (glow) {
          glow[0].opacity = on && phase ? 0.75 : 0.04;
          glow[1].opacity = on && !phase ? 0.75 : 0.04;
        }
      }
    }
    G.audio.setSiren(this.stars > 0, sirenDist);
    this.updateOfficers(dt);
    // bust meter: standing still near the SPD on foot gets you arrested
    let busting = false;
    if (!p.inCar && this.stars > 0 && !G.shotMode) {
      for (const car of this.cars) if (car.mode === 'chase' && Math.hypot(car.pos.x - p.x, car.pos.z - p.z) < CFG.bustRadius + 1) busting = true;
      for (const off of this.officers) if (off.alive && !off.crew && Math.hypot(off.x - p.x, off.z - p.z) < CFG.bustRadius) busting = true;
    }
    this.bustT = busting ? this.bustT + dt : Math.max(0, this.bustT - dt * 2);
    if (this.bustT >= CFG.bustTime) G.onBusted();
  }
  spawnOfficer(x, z, crew) {
    const mesh = officerMesh();
    mesh.position.set(x, 0, z);
    if (crew) {
      mesh.children[0].material = new THREE.MeshLambertMaterial({ color: 0x4a4238 });
      mesh.children[2].visible = false;
    }
    this.G.scene.add(mesh);
    this.officers.push({ mesh, x, z, angle: 0, health: 60, alive: true, fall: 0, removeT: 0, shootT: range(this.G.rng, 0.6, 1.4), bob: 0, crew: !!crew });
  }
  updateOfficers(dt) {
    const G = this.G, p = G.player;
    if (G.shotMode) return; // staged screenshot scenes keep officers in place
    for (let i = this.officers.length - 1; i >= 0; i--) {
      const off = this.officers[i];
      if (!off.alive) {
        off.fall = Math.min(1, off.fall + dt * 3);
        off.mesh.rotation.x = off.fall * 1.5;
        off.mesh.position.y = -off.fall * 0.3;
        off.removeT -= dt;
        if (off.removeT <= 0) { G.scene.remove(off.mesh); this.officers.splice(i, 1); }
        continue;
      }
      const dx = p.x - off.x, dz = p.z - off.z;
      const dist = Math.hypot(dx, dz) || 1;
      off.angle = Math.atan2(dx, dz);
      if (dist > 2.4) {
        const sp = 5.4;
        const res = resolveCollisions(off.x + (dx / dist) * sp * dt, off.z + (dz / dist) * sp * dt, 0.5, G.city.colliders);
        off.x = res.x; off.z = res.z;
        off.bob += dt * 12;
      }
      off.mesh.position.set(off.x, Math.abs(Math.sin(off.bob)) * 0.05, off.z);
      off.mesh.rotation.y = off.angle;
      // officers open fire at wanted level 2+; Cormorant crew always shoot
      off.shootT -= dt;
      if ((this.stars >= 2 || off.crew) && dist < 30 && dist > 2.5 && off.shootT <= 0 && !p.inCar) {
        off.shootT = 1.15;
        G.audio.shot();
        const hitChance = 0.5 - Math.min(0.3, (p.sprinting ? 0.15 : 0) + dist * 0.004);
        const hit = chance(G.rng, hitChance);
        const tx = p.x + (hit ? 0 : range(G.rng, -1.6, 1.6));
        const tz = p.z + (hit ? 0 : range(G.rng, -1.6, 1.6));
        G.effects.tracer(off.x, 1.45, off.z, tx, 1.2, tz);
        if (hit) p.takeDamage(6);
      }
      // run over officers with a car
      if (p.inCar && Math.abs(p.inCar.speed) > 5 && dist < 2) {
        const killed = this.damageOfficer(off, 100);
        this.addHeat(killed ? 45 : 20, killed ? 'Officer down!' : 'Running over police!');
      }
    }
  }
}
