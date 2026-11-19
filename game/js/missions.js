// missions.js — the Port Solara story: four jobs for Rosa Delmar against the
// Cormorant Crew, with objective markers, timers, rewards and the sun-coin trail.
import * as THREE from '../vendor/three.module.min.js';
import { CFG, landmarkPos } from './config.js';
import { Car } from './vehicles.js';

const GARAGE = landmarkPos('garage');
const DOCKS = landmarkPos('docks');
const BANK = landmarkPos('bank');
const MARINA = landmarkPos('marina');
const CLUB = landmarkPos('beachClub');

function markerMesh() {
  const g = new THREE.Group();
  const ring = new THREE.Mesh(
    new THREE.CylinderGeometry(2.3, 2.3, 0.25, 24),
    new THREE.MeshBasicMaterial({ color: 0xffc94d, transparent: true, opacity: 0.85 })
  );
  ring.position.y = 0.15; g.add(ring);
  const beam = new THREE.Mesh(
    new THREE.CylinderGeometry(0.35, 0.55, 14, 12, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xffc94d, transparent: true, opacity: 0.28, side: THREE.DoubleSide, depthWrite: false })
  );
  beam.position.y = 7; g.add(beam);
  return g;
}

export class Missions {
  constructor(G) {
    this.G = G;
    this.index = 0;          // missions completed
    this.active = null;      // {def, step, timer}
    this.marker = markerMesh();
    G.scene.add(this.marker);
    this.markerPos = { x: GARAGE.x, z: GARAGE.z + 16 };
    this.targetCar = null;
    this.van = null;
    this.vanRoute = [[-200, 280], [200, 280], [280, 200], [280, -200], [200, -280], [-200, -280], [-280, -200], [-280, 200]];
    this.vanWp = 0;
    this.crewLeft = 0;
    this.coins = [];
    const coinGeo = new THREE.CylinderGeometry(0.55, 0.55, 0.14, 16);
    coinGeo.rotateX(Math.PI / 2);
    const coinMat = new THREE.MeshBasicMaterial({ color: 0xffd700 });
    for (const spot of G.landmarks.coinSpots) {
      const m = new THREE.Mesh(coinGeo, coinMat);
      m.position.set(spot.x, 1.1, spot.z);
      G.scene.add(m);
      this.coins.push({ mesh: m, x: spot.x, z: spot.z, taken: false });
    }
    this.defs = this.buildDefs();
    this.refreshObjective();
  }
  buildDefs() {
    const G = this.G;
    return [
      {
        title: 'WELCOME TO PORT SOLARA', sub: 'Rosa Delmar has a delivery job',
        steps: [
          { text: 'Meet Rosa at Delmar\'s Garage', at: { x: GARAGE.x, z: GARAGE.z + 16 }, r: 6, say: 'Rosa: "Dani! Good timing. A package came in at the docks — Club Marea needs it before sunset."' },
          { text: 'Pick up the package at the docks', at: { x: DOCKS.x, z: DOCKS.z + 18 }, r: 7, say: 'You slung the package into the trunk. It hums. Don\'t ask.' },
          { text: 'Deliver the package to Club Marea', at: { x: CLUB.x, z: CLUB.z + 16 }, r: 7, timer: 95, say: 'Rosa: "Smooth work. The strip is talking about you already."' },
        ],
      },
      {
        title: 'CHOP SHOP', sub: 'A Solara GT with the wrong owner',
        steps: [
          { text: 'Head to the marina — a Solara GT is parked there', at: { x: MARINA.x, z: MARINA.z + 18 }, r: 8, say: 'Rosa: "There\'s a coral Solara GT at the marina. Bring it to me. Quietly."' },
          { text: 'Steal the coral Solara GT', carTarget: true, say: 'The alarm tripped — the SPD is on it!' },
          { text: 'Bring the Solara GT to Delmar\'s Garage', at: { x: GARAGE.x, z: GARAGE.z + 16 }, r: 10, needCar: true, say: 'Rosa: "Beautiful. She\'ll ride again under a new name."' },
        ],
      },
      {
        title: 'CORMORANT RUN', sub: 'Vico Lanzas\' van is moving contraband',
        steps: [
          { text: 'Intercept the Cormorant van on the south strip', vanTarget: true, say: 'Rosa: "That van runs contraband for Vico Lanzas. Stop it — hard."' },
          { text: 'Ram the van until it breaks down', vanChase: true, say: 'The van is smoking. The crew is bailing out!' },
          { text: 'Take down the Cormorant crew', crewFight: true, say: 'Rosa: "The ledger is ours. Vico is finished in this town."' },
        ],
      },
      {
        title: 'THE CASA MARINA JOB', sub: 'One last score — the bank on the plaza',
        steps: [
          { text: 'Get to the Casa Marina bank vault', at: { x: BANK.x, z: BANK.z + 16 }, r: 7, say: 'You stepped over the marble rope. The bags were waiting.' },
          { text: 'Grab the cash bags', at: { x: BANK.x, z: BANK.z + 16 }, r: 7, grab: true, say: 'ALARM! The SPD wants you badly. Run!' },
          { text: 'Escape to the docks extraction point', at: { x: 322, z: DOCKS.z }, r: 12, say: 'The boat took the bags. Rosa took the credit. You took the sunset.' },
        ],
      },
    ];
  }
  refreshObjective() {
    const G = this.G;
    if (!this.active) {
      if (this.index >= this.defs.length) {
        G.hud.objective('Story complete — Port Solara is yours. Find the sun coins!');
        this.marker.visible = false;
      } else {
        G.hud.objective('Meet Rosa at Delmar\'s Garage — she has work');
        this.markerPos = { x: GARAGE.x, z: GARAGE.z + 16 };
        this.marker.visible = true;
      }
      return;
    }
    const step = this.active.def.steps[this.active.step];
    G.hud.objective(step.text + (this.active.timer > 0 ? '  ·  ' + Math.ceil(this.active.timer) + 's' : ''));
  }
  startMission(i) {
    const G = this.G;
    this.active = { def: this.defs[i], step: 0, timer: 0 };
    G.hud.banner(this.defs[i].title, this.defs[i].sub);
    G.audio.mission();
    const step = this.active.def.steps[0];
    if (step.timer) this.active.timer = step.timer;
    if (i === 1) this.spawnTargetCar();
    if (i === 2) this.spawnVan();
    this.refreshObjective();
  }
  spawnTargetCar() {
    const G = this.G;
    if (this.targetCar) { G.scene.remove(this.targetCar.mesh); const k = G.cars.indexOf(this.targetCar); if (k >= 0) G.cars.splice(k, 1); }
    this.targetCar = new Car('solara', MARINA.x + 10, MARINA.z + 12, Math.PI / 2, 0xff6f61);
    G.scene.add(this.targetCar.mesh); G.cars.push(this.targetCar);
  }
  spawnVan() {
    const G = this.G;
    this.van = new Car('van', -200, 280, Math.PI / 2, 0x3d3d3d);
    this.vanWp = 1;
    G.scene.add(this.van.mesh); G.cars.push(this.van);
  }
  resetForNewGame() {
    const G = this.G;
    for (const car of [this.targetCar, this.van]) {
      if (!car) continue;
      if (G.player.inCar === car) G.player.exitCar();
      G.scene.remove(car.mesh);
      const k = G.cars.indexOf(car);
      if (k >= 0) G.cars.splice(k, 1);
    }
    this.targetCar = null; this.van = null;
    this.index = 0; this.active = null; this.crewLeft = 0;
    for (const c of this.coins) { c.taken = false; c.mesh.visible = true; }
    this.marker.visible = true;
    this.refreshObjective();
  }
  onEnterCar(car) {
    if (!this.active) return;
    const step = this.active.def.steps[this.active.step];
    if (step.carTarget && car === this.targetCar) {
      this.G.police.addHeat(24, 'The GT\'s alarm tripped!');
      this.advance(step.say);
    }
  }
  onCarDamaged(car) {
    if (!this.active || !this.van || car !== this.van) return;
    const step = this.active.def.steps[this.active.step];
    if (step.vanChase && this.van.hp < 48) {
      this.van.disabled = true;
      this.advance(step.say);
      const G = this.G;
      G.police.spawnOfficer(this.van.pos.x + 3, this.van.pos.z + 2, true);
      G.police.spawnOfficer(this.van.pos.x - 3, this.van.pos.z - 2, true);
      this.crewLeft = 2;
    }
  }
  advance(say) {
    const G = this.G;
    if (say) G.hud.notify(say, 'mission');
    this.active.step++;
    if (this.active.step >= this.active.def.steps.length) { this.complete(); return; }
    const step = this.active.def.steps[this.active.step];
    this.active.timer = step.timer || 0;
    this.refreshObjective();
  }
  complete() {
    const G = this.G;
    const reward = CFG.missionRewards[this.index];
    G.money += reward;
    G.audio.cash();
    G.hud.banner('MISSION COMPLETE', '+$' + reward + '  ·  ' + this.active.def.title);
    G.hud.notify('Rosa wired you $' + reward, 'cash');
    this.index++;
    this.active = null;
    if (this.targetCar && this.index >= 2) this.targetCar = null;
    if (this.van) { G.scene.remove(this.van.mesh); const k = G.cars.indexOf(this.van); if (k >= 0) G.cars.splice(k, 1); this.van = null; }
    G.save.save();
    if (this.index >= this.defs.length) G.onStoryComplete();
    this.refreshObjective();
  }
  fail(reason) {
    const G = this.G;
    G.hud.notify(reason, 'crime');
    const i = this.index;
    this.active = null;
    if (this.van) { G.scene.remove(this.van.mesh); const k = G.cars.indexOf(this.van); if (k >= 0) G.cars.splice(k, 1); this.van = null; }
    this.startMission(i);
  }
  update(dt) {
    const G = this.G, p = G.player;
    this.marker.rotation.y += dt * 1.4;
    // sun coins
    for (const c of this.coins) {
      if (c.taken) continue;
      c.mesh.rotation.y += dt * 2.4;
      c.mesh.position.y = 1.1 + Math.sin(G.time * 2 + c.x) * 0.15;
      if (Math.hypot(p.x - c.x, p.z - c.z) < 2.1) {
        c.taken = true; c.mesh.visible = false;
        G.money += CFG.coinValue;
        G.audio.cash();
        G.hud.notify('Sun coin! +$' + CFG.coinValue, 'cash');
        G.effects.burst(c.x, 1.2, c.z, 0xffd700, 12, 3, { life: 0.6, size: 0.1 });
      }
    }
    // drive the Cormorant van along its escape loop
    if (this.van && !this.van.disabled && this.van.driver !== 'player') {
      const wp = this.vanRoute[this.vanWp];
      const dx = wp[0] - this.van.pos.x, dz = wp[1] - this.van.pos.z;
      const d = Math.hypot(dx, dz);
      if (d < 6) this.vanWp = (this.vanWp + 1) % this.vanRoute.length;
      else {
        const sp = G.shotMode ? 0 : 15;
        this.van.pos.x += (dx / d) * sp * dt;
        this.van.pos.z += (dz / d) * sp * dt;
        this.van.angle = Math.atan2(dx, dz);
        this.van.mesh.rotation.y = this.van.angle;
        this.van.speed = sp;
        const wheels = this.van.mesh.userData.wheels;
        for (const w of wheels) w.rotation.x += sp * dt / 0.38;
      }
    }
    // crew fight progress
    if (this.active && this.active.def.steps[this.active.step].crewFight) {
      const alive = G.police.officers.filter((o) => o.crew && o.alive).length;
      if (alive === 0 && this.crewLeft > 0) { this.crewLeft = 0; this.advance(this.active.def.steps[this.active.step].say); return; }
    }
    // ramming the van counts too — check its hull every frame
    if (this.active && this.van && !this.van.disabled && this.active.def.steps[this.active.step].vanChase && this.van.hp < 48) {
      this.onCarDamaged(this.van);
    }
    // marker position + arrival checks
    if (!this.active) {
      if (this.index < this.defs.length) {
        this.markerPos = { x: GARAGE.x, z: GARAGE.z + 16 };
        this.marker.position.set(this.markerPos.x, 0, this.markerPos.z);
        if (Math.hypot(p.x - this.markerPos.x, p.z - this.markerPos.z) < 6) this.startMission(this.index);
      }
      return;
    }
    const step = this.active.def.steps[this.active.step];
    if ((step.timer || this.active.timer > 0) && !G.shotMode) {
      this.active.timer -= dt;
      if (this.active.timer <= 0) { this.fail('Too slow — the job fell through. Rosa will set it up again.'); return; }
    }
    let at = step.at;
    if (step.carTarget && this.targetCar) at = { x: this.targetCar.pos.x, z: this.targetCar.pos.z };
    if ((step.vanTarget || step.vanChase) && this.van) at = { x: this.van.pos.x, z: this.van.pos.z };
    if (at) {
      this.markerPos = at;
      this.marker.position.set(at.x, 0, at.z);
      this.marker.visible = !step.vanChase;
      const dist = Math.hypot(p.x - at.x, p.z - at.z);
      if (step.grab) {
        if (dist < (step.r || 6)) {
          G.police.addHeat(130, 'Silent alarm! Wanted level 3!');
          this.advance(step.say);
        }
      } else if (step.needCar) {
        if (dist < (step.r || 8) && p.inCar === this.targetCar) this.advance(step.say);
      } else if (!step.carTarget && !step.vanTarget && !step.vanChase && !step.crewFight && dist < (step.r || 6)) {
        this.advance(step.say);
      }
    }
    // wrecked mission vehicles reset the job
    if (this.targetCar && this.targetCar.disabled && this.index === 1 && this.active) {
      this.fail('The GT is wrecked. Rosa will source another one.');
    }
    this.refreshObjective();
  }
}
