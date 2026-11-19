// player.js — Dani Solís: on-foot movement relative to the camera, sprinting,
// entering and exiting cars, health, regeneration and respawns.
import * as THREE from '../vendor/three.module.min.js';
import { CFG } from './config.js';
import { resolveCollisions } from './city.js';

function buildPlayerMesh() {
  const g = new THREE.Group();
  const jacket = new THREE.MeshLambertMaterial({ color: 0x2ec4b6 });
  const skin = new THREE.MeshLambertMaterial({ color: 0xd8a878 });
  const jeans = new THREE.MeshLambertMaterial({ color: 0x2b3a55 });
  const hair = new THREE.MeshLambertMaterial({ color: 0x22223b });
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.75, 0.34), jacket);
  torso.position.y = 1.05; torso.castShadow = true; g.add(torso);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.32, 0.32), skin);
  head.position.y = 1.62; head.castShadow = true; g.add(head);
  const hairM = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.14, 0.34), hair);
  hairM.position.y = 1.8; g.add(hairM);
  const limbs = [];
  for (const sx of [-1, 1]) {
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.62, 0.16), jacket);
    arm.geometry.translate(0, -0.31, 0);
    arm.position.set(sx * 0.38, 1.38, 0); arm.castShadow = true;
    g.add(arm); limbs.push(arm);
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.68, 0.2), jeans);
    leg.geometry.translate(0, -0.34, 0);
    leg.position.set(sx * 0.15, 0.68, 0); leg.castShadow = true;
    g.add(leg); limbs.push(leg);
  }
  g.userData.limbs = limbs; // armL, legL, armR, legR
  return g;
}

export class Player {
  constructor(G) {
    this.G = G;
    this.mesh = buildPlayerMesh();
    G.scene.add(this.mesh);
    this.x = G.city.playerStart.x; this.z = G.city.playerStart.z;
    this.angle = Math.PI;
    this.health = CFG.playerHealth;
    this.weapon = 0; // 0 fists, 1 pistol
    this.mag = CFG.pistol.mag;
    this.reserve = CFG.pistol.reserve;
    this.reloadT = 0; this.attackT = 0; this.sinceDamage = 99;
    this.inCar = null;
    this.walkPhase = 0;
    this.moving = false;
    this.sprinting = false;
  }
  get pos() { return this.inCar ? this.inCar.pos : this.mesh.position; }
  update(dt) {
    const G = this.G, input = G.input;
    this.attackT = Math.max(0, this.attackT - dt);
    this.sinceDamage += dt;
    if (this.sinceDamage > CFG.regenDelay && this.health < CFG.playerHealth) {
      this.health = Math.min(CFG.playerHealth, this.health + CFG.regenRate * dt);
    }
    if (this.reloadT > 0) {
      this.reloadT -= dt;
      if (this.reloadT <= 0) {
        const take = Math.min(CFG.pistol.mag - this.mag, this.reserve);
        this.mag += take; this.reserve -= take;
        G.audio.ui();
      }
    }
    if (this.inCar) this.drive(dt);
    else this.walk(dt);
  }
  walk(dt) {
    const G = this.G, input = G.input;
    const yaw = G.cam.yaw;
    let mx = input.axis('KeyA', 'KeyD');
    let mz = input.axis('KeyS', 'KeyW');
    this.moving = !!(mx || mz);
    this.sprinting = input.down('ShiftLeft') || input.down('ShiftRight');
    if (this.moving) {
      const len = Math.hypot(mx, mz); mx /= len; mz /= len;
      const sin = Math.sin(yaw), cos = Math.cos(yaw);
      const dx = -mx * cos + mz * sin;
      const dz = mx * sin + mz * cos;
      const sp = this.sprinting ? CFG.sprintSpeed : CFG.walkSpeed;
      const res = resolveCollisions(this.x + dx * sp * dt, this.z + dz * sp * dt, 0.5, G.city.colliders);
      this.x = res.x; this.z = res.z;
      this.angle = Math.atan2(dx, dz);
      this.walkPhase += dt * (this.sprinting ? 13 : 9);
    }
    this.mesh.position.set(this.x, 0, this.z);
    this.mesh.rotation.y = this.angle;
    const swing = this.moving ? Math.sin(this.walkPhase) * (this.sprinting ? 0.8 : 0.55) : 0;
    const limbs = this.mesh.userData.limbs;
    limbs[0].rotation.x = swing; limbs[3].rotation.x = -swing;
    limbs[1].rotation.x = -swing; limbs[2].rotation.x = swing;
    // aim the torso where the camera looks when armed
    if (this.weapon === 1 && !this.moving) this.mesh.rotation.y = G.cam.yaw;
  }
  drive(dt) {
    const G = this.G, input = G.input, car = this.inCar;
    const ctrl = {
      throttle: input.axis('KeyS', 'KeyW'),
      steer: input.axis('KeyD', 'KeyA'),
      handbrake: input.down('Space'),
    };
    if (G.shotMode && G.shotCruise) {
      ctrl.throttle = car.speed < G.shotCruise ? 0.9 : 0;
      ctrl.steer = 0;
      ctrl.handbrake = false;
    }
    const crash = car.update(dt, ctrl, G.city.colliders, G.cars, G.effects, G.audio);
    if (crash > 5) {
      G.audio.crash(crash / 25);
      G.effects.shake(Math.min(0.5, crash / 40));
      if (crash > 14) this.takeDamage(crash * 0.4);
    }
    G.audio.setEngine(Math.abs(car.speed) / car.spec.top, Math.max(0, ctrl.throttle));
    this.x = car.pos.x; this.z = car.pos.z;
    this.angle = car.angle;
    if (car.disabled) this.exitCar();
    // run over pedestrians
    if (Math.abs(car.speed) > 5) {
      const f = car.forward();
      const hx = car.pos.x + f.x * car.spec.len * 0.5, hz = car.pos.z + f.z * car.spec.len * 0.5;
      const ped = G.peds.nearest(hx, hz, 1.7);
      if (ped) {
        const killed = G.peds.damage(ped, 100, car.pos.x, car.pos.z);
        G.police.addHeat(killed ? 30 : 15, killed ? 'Hit and run!' : 'Reckless driving!');
        G.effects.shake(0.25);
        car.speed *= 0.8;
      }
    }
  }
  nearestCar() {
    let best = null, bd = CFG.enterRadius * CFG.enterRadius;
    for (const car of this.G.cars) {
      if (car.disabled || car.driver === 'player') continue;
      const d2 = (car.pos.x - this.x) ** 2 + (car.pos.z - this.z) ** 2;
      if (d2 < bd) { bd = d2; best = car; }
    }
    return best;
  }
  enterExit() {
    const G = this.G;
    if (this.inCar) { this.exitCar(); return; }
    const car = this.nearestCar();
    if (!car) return;
    if (car.ai) G.traffic.remove(car);
    const wasPolice = car.type === 'police';
    car.driver = 'player';
    this.inCar = car;
    this.mesh.visible = false;
    G.audio.enterCar();
    G.audio.startEngine();
    if (wasPolice) G.police.addHeat(25, 'Stole a police cruiser!');
    else if (G.police.stars > 0 || Math.random() < 0.35) G.police.addHeat(10, 'Grand theft auto!');
    G.missions.onEnterCar(car);
    G.hud.notify('Entered ' + car.spec.name, '');
  }
  exitCar() {
    const G = this.G, car = this.inCar;
    if (!car) return;
    car.driver = null;
    car.speed *= 0.4;
    this.inCar = null;
    const f = car.forward();
    const res = resolveCollisions(car.pos.x - f.z * 2.2, car.pos.z + f.x * 2.2, 0.5, G.city.colliders);
    this.x = res.x; this.z = res.z;
    this.mesh.visible = true;
    this.mesh.position.set(this.x, 0, this.z);
    G.audio.stopEngine();
  }
  takeDamage(n) {
    if (this.health <= 0) return;
    this.health -= n;
    this.sinceDamage = 0;
    this.G.audio.hurt();
    this.G.effects.shake(Math.min(0.4, n / 40));
    if (this.health <= 0) { this.health = 0; this.G.onWasted(); }
  }
  respawn(x, z) {
    if (this.inCar) this.exitCar();
    this.x = x; this.z = z;
    this.health = CFG.playerHealth;
    this.mesh.position.set(x, 0, z);
    this.mesh.visible = true;
    this.sinceDamage = 99;
  }
}
