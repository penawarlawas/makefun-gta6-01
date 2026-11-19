// combat.js — fists and pistol: melee arcs, hitscan shots with tracers, damage to
// pedestrians, officers and cars, and the wanted heat every crime generates.
import { CFG } from './config.js';

export function swapWeapon(G) {
  const p = G.player;
  p.weapon = p.weapon === 0 ? 1 : 0;
  p.reloadT = 0;
  G.audio.ui();
  G.hud.notify(p.weapon === 1 ? 'Pistol drawn' : 'Fists up', '');
}

export function tryReload(G) {
  const p = G.player;
  if (p.weapon !== 1 || p.reloadT > 0 || p.mag >= CFG.pistol.mag || p.reserve <= 0) return;
  p.reloadT = CFG.pistol.reload;
  G.hud.notify('Reloading…', '');
}

export function playerAttack(G) {
  const p = G.player;
  if (p.inCar || p.attackT > 0 || p.reloadT > 0) return;
  const yaw = G.cam.yaw;
  const dx = Math.sin(yaw), dz = Math.cos(yaw);
  if (p.weapon === 0) {
    p.attackT = CFG.punch.rate;
    G.audio.punch();
    const limbs = p.mesh.userData.limbs;
    limbs[2].rotation.x = -1.5; // right arm jab
    const ped = G.peds.nearest(p.x + dx * 1.2, p.z + dz * 1.2, CFG.punch.range);
    if (ped) {
      const killed = G.peds.damage(ped, CFG.punch.damage, p.x, p.z);
      G.effects.burst(ped.x, 1.3, ped.z, 0xffffff, 5, 2.5, { life: 0.25, size: 0.08 });
      G.police.addHeat(killed ? 30 : 8, killed ? 'You killed someone!' : 'Assault!');
      G.audio.hit();
    } else {
      const off = G.police.nearestOfficer(p.x + dx * 1.2, p.z + dz * 1.2, CFG.punch.range);
      if (off) {
        const killed = G.police.damageOfficer(off, CFG.punch.damage);
        G.police.addHeat(killed ? 45 : 18, killed ? 'Officer down!' : 'Attacking an officer!');
      }
    }
    return;
  }
  // pistol
  if (p.mag <= 0) {
    if (p.reserve > 0) tryReload(G);
    else G.hud.notify('Out of ammo — find more on the job', 'crime');
    return;
  }
  p.mag--;
  p.attackT = CFG.pistol.rate;
  G.audio.shot();
  const mx = p.x + dx * 0.7, mz = p.z + dz * 0.7, my = 1.45;
  G.effects.muzzle(mx, my, mz);
  G.peds.panic(p.x, p.z, 42);
  G.police.addHeat(12, 'Shots fired!');
  // hitscan: nearest target along the aim ray
  let hitT = CFG.pistol.range, hit = null, kind = null;
  const test = (tx, tz, radius, obj, k) => {
    const rx = tx - p.x, rz = tz - p.z;
    const t = rx * dx + rz * dz;
    if (t < 0.5 || t > hitT) return;
    const perp = Math.abs(rx * dz - rz * dx);
    if (perp < radius) { hitT = t; hit = obj; kind = k; }
  };
  for (const ped of G.peds.list) if (ped.alive) test(ped.x, ped.z, 0.75, ped, 'ped');
  for (const off of G.police.officers) if (off.alive) test(off.x, off.z, 0.75, off, 'officer');
  for (const car of G.cars) test(car.pos.x, car.pos.z, car.radius + 0.4, car, 'car');
  const bx = p.x + dx * hitT, bz = p.z + dz * hitT;
  G.effects.tracer(mx, my, mz, bx, 1.2, bz);
  if (hit) {
    G.effects.burst(bx, 1.2, bz, 0xffc94d, 6, 3, { life: 0.3, size: 0.07 });
    if (kind === 'ped') {
      const killed = G.peds.damage(hit, CFG.pistol.damage, p.x, p.z);
      G.police.addHeat(killed ? 30 : 12, killed ? 'You killed someone!' : 'Shooting civilians!');
    } else if (kind === 'officer') {
      const killed = G.police.damageOfficer(hit, CFG.pistol.damage);
      G.police.addHeat(killed ? 45 : 20, killed ? 'Officer down!' : 'Shooting at police!');
    } else {
      hit.damage(CFG.pistol.damage * 0.7, null);
      if (hit.type === 'police') G.police.addHeat(18, 'Shooting a police car!');
      if (hit.disabled) G.effects.explosion(hit.pos.x, 1, hit.pos.z);
      G.missions.onCarDamaged(hit);
    }
    G.audio.hit();
  }
}
