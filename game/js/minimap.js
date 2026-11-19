// minimap.js — the round live minimap: streets, beach, ocean, traffic, police,
// sun coins, the mission marker and the player arrow, north-up around the player.
import { CFG } from './config.js';

const SIZE = 184;
const VIEW = 150; // world metres from centre to edge

export class Minimap {
  constructor(canvas, city, landmarks) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.city = city;
    this.landmarks = landmarks;
    this.frame = 0;
  }
  update(G) {
    this.frame++;
    if (this.frame % 2 === 0) return; // 30 Hz is plenty
    const ctx = this.ctx, p = G.player;
    const s = (SIZE / 2) / VIEW;
    ctx.clearRect(0, 0, SIZE, SIZE);
    ctx.save();
    ctx.beginPath();
    ctx.arc(SIZE / 2, SIZE / 2, SIZE / 2 - 2, 0, Math.PI * 2);
    ctx.clip();
    ctx.fillStyle = '#12263f';
    ctx.fillRect(0, 0, SIZE, SIZE);
    ctx.translate(SIZE / 2, SIZE / 2);
    ctx.scale(s, s);
    ctx.translate(-p.x, -p.z);

    // ocean and beach to the east
    ctx.fillStyle = '#1d5f7e';
    ctx.fillRect(CFG.oceanStart, -VIEW * 2 + p.z, VIEW * 4, VIEW * 4);
    ctx.fillStyle = '#c9a86a';
    ctx.fillRect(CFG.cityHalf, -VIEW * 2 + p.z, CFG.beachEnd - CFG.cityHalf, VIEW * 4);
    // asphalt + block pads
    ctx.fillStyle = '#2c3e50';
    ctx.fillRect(-CFG.cityHalf - 2, -CFG.cityHalf - 2, CFG.cityHalf * 2 + 4, CFG.cityHalf * 2 + 4);
    ctx.fillStyle = '#3d5266';
    for (const b of this.city.minimap.blocks) {
      const e = (CFG.cell - CFG.roadW) / 2;
      ctx.fillRect(b.x - e, b.z - e, e * 2, e * 2);
    }
    // landmark dots
    ctx.fillStyle = '#7fb069';
    for (const name in this.landmarks.positions) {
      const l = this.landmarks.positions[name];
      ctx.fillRect(l.x - 3, l.z - 3, 6, 6);
    }
    // sun coins
    ctx.fillStyle = '#ffd700';
    for (const c of G.missions.coins) {
      if (c.taken) continue;
      ctx.beginPath(); ctx.arc(c.x, c.z, 2.4, 0, Math.PI * 2); ctx.fill();
    }
    // traffic
    ctx.fillStyle = '#8fa3b8';
    for (const car of G.cars) {
      if (car.driver === 'player' || car.type === 'police') continue;
      ctx.fillRect(car.pos.x - 1.6, car.pos.z - 1.6, 3.2, 3.2);
    }
    // police
    for (const car of G.police.cars) {
      if (car.driver === 'player') continue;
      ctx.fillStyle = car.mode === 'chase' ? '#ff4444' : '#6fb7ff';
      ctx.fillRect(car.pos.x - 2.2, car.pos.z - 2.2, 4.4, 4.4);
    }
    // mission marker
    if (G.missions.marker.visible) {
      const m = G.missions.markerPos;
      ctx.fillStyle = '#ffc94d';
      ctx.beginPath(); ctx.arc(m.x, m.z, 4 + Math.sin(G.time * 4) * 1.2, 0, Math.PI * 2); ctx.fill();
    }
    // player arrow
    ctx.save();
    ctx.translate(p.x, p.z);
    ctx.rotate(Math.PI - p.angle);
    ctx.fillStyle = '#2ec4b6';
    ctx.strokeStyle = '#fdf6ec';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(0, -6); ctx.lineTo(4.4, 5); ctx.lineTo(0, 2.6); ctx.lineTo(-4.4, 5);
    ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.restore();
    ctx.restore();
  }
}
