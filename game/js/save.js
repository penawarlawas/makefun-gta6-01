// save.js — localStorage persistence: money, story progress, sun coins and position.
const KEY = 'portSolaraSaveV1';

export class SaveSys {
  constructor(G) { this.G = G; }
  hasSave() {
    try { return !!localStorage.getItem(KEY); } catch (e) { return false; }
  }
  save() {
    const G = this.G, p = G.player;
    const data = {
      money: G.money,
      missionIndex: G.missions.index,
      coins: G.missions.coins.map((c) => c.taken),
      health: p.health,
      x: p.x, z: p.z,
      weapon: p.weapon, mag: p.mag, reserve: p.reserve,
      savedAt: Date.now(),
    };
    try { localStorage.setItem(KEY, JSON.stringify(data)); } catch (e) { /* private mode */ }
  }
  load() {
    const G = this.G;
    let data = null;
    try { data = JSON.parse(localStorage.getItem(KEY)); } catch (e) { return false; }
    if (!data) return false;
    G.money = data.money ?? G.money;
    G.missions.index = data.missionIndex ?? 0;
    G.missions.active = null;
    if (Array.isArray(data.coins)) {
      G.missions.coins.forEach((c, i) => {
        c.taken = !!data.coins[i];
        c.mesh.visible = !c.taken;
      });
    }
    G.player.respawn(data.x ?? G.city.playerStart.x, data.z ?? G.city.playerStart.z);
    G.player.health = data.health ?? 100;
    G.player.weapon = data.weapon ?? 0;
    G.player.mag = data.mag ?? 12;
    G.player.reserve = data.reserve ?? 72;
    G.police.clearWanted();
    G.missions.refreshObjective();
    G.cam.snapBehind(G.player.mesh.position, G.player.angle);
    return true;
  }
  clear() {
    try { localStorage.removeItem(KEY); } catch (e) { /* ignore */ }
  }
}
// Saves survive page reloads; Continue on the title screen restores the whole run.
