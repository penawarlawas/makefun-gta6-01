// hud.js — the DOM heads-up display: money, health, wanted stars, weapon, speed,
// objective line, interact prompts, notifications and mission banners.
export class Hud {
  constructor() {
    this.el = {
      hud: document.getElementById('hud'),
      money: document.getElementById('money'),
      health: document.getElementById('health-bar'),
      weapon: document.getElementById('weapon-name'),
      ammo: document.getElementById('ammo'),
      stars: Array.from(document.querySelectorAll('#wanted .star')),
      heatHint: document.getElementById('heat-hint'),
      objWrap: document.getElementById('objective-wrap'),
      objText: document.getElementById('objective-text'),
      notes: document.getElementById('notifications'),
      prompt: document.getElementById('prompt'),
      crosshair: document.getElementById('crosshair'),
      speedo: document.getElementById('speedo'),
      speedVal: document.getElementById('speed-val'),
      carName: document.getElementById('car-name'),
      vignette: document.getElementById('vignette'),
      banner: document.getElementById('mission-banner'),
      bannerTitle: document.getElementById('banner-title'),
      bannerSub: document.getElementById('banner-sub'),
    };
    this.noteCount = 0;
    this.bannerT = null;
    this.lastMoney = -1;
  }
  setVisible(on) { this.el.hud.classList.toggle('hidden', !on); }
  objective(text) {
    if (!text) { this.el.objWrap.classList.add('no-objective'); return; }
    this.el.objWrap.classList.remove('no-objective');
    if (this.el.objText.textContent !== text) this.el.objText.textContent = text;
  }
  notify(text, cls) {
    const div = document.createElement('div');
    div.className = 'note' + (cls ? ' ' + cls : '');
    div.textContent = text;
    this.el.notes.appendChild(div);
    while (this.el.notes.children.length > 4) this.el.notes.removeChild(this.el.notes.firstChild);
    setTimeout(() => { if (div.parentNode) div.parentNode.removeChild(div); }, 4200);
  }
  banner(title, sub) {
    this.el.bannerTitle.textContent = title;
    this.el.bannerSub.textContent = sub || '';
    this.el.banner.classList.remove('hidden');
    if (this.bannerT) clearTimeout(this.bannerT);
    this.bannerT = setTimeout(() => this.el.banner.classList.add('hidden'), 3400);
  }
  prompt(html) {
    if (!html) { this.el.prompt.classList.add('hidden'); return; }
    if (this.el.prompt.innerHTML !== html) this.el.prompt.innerHTML = html;
    this.el.prompt.classList.remove('hidden');
  }
  update(G) {
    const p = G.player;
    if (G.money !== this.lastMoney) {
      this.el.money.textContent = '$' + G.money.toLocaleString('en-US');
      this.lastMoney = G.money;
    }
    this.el.health.style.width = Math.max(0, p.health) + '%';
    const stars = G.police.stars;
    const escaping = stars > 0 && G.police.sinceCrime > 8;
    this.el.stars.forEach((s, i) => {
      s.classList.toggle('lit', i < stars);
      s.classList.toggle('flash', escaping && i < stars);
    });
    this.el.heatHint.textContent = stars > 0 ? (escaping ? 'LOSING THE COPS…' : 'SPD PURSUIT ACTIVE') : '';
    this.el.weapon.textContent = p.weapon === 1 ? 'PISTOL' : 'FISTS';
    this.el.ammo.textContent = p.weapon === 1 ? (p.reloadT > 0 ? 'RELOADING' : p.mag + ' / ' + p.reserve) : '';
    this.el.crosshair.classList.toggle('hidden', p.weapon !== 1 || !!p.inCar);
    if (p.inCar) {
      this.el.speedo.classList.remove('hidden');
      this.el.speedVal.textContent = Math.abs(Math.round(p.inCar.speed * 3.6));
      this.el.carName.textContent = p.inCar.spec.name.toUpperCase();
    } else this.el.speedo.classList.add('hidden');
    this.el.vignette.style.opacity = p.health < 40 ? String((40 - p.health) / 40) : '0';
    if (!p.inCar && G.state === 'play') {
      const car = p.nearestCar();
      this.prompt(car ? '<b>[E]</b> Enter ' + car.spec.name : '');
    } else this.prompt('');
  }
}
