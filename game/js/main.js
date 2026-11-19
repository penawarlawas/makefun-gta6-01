// main.js — Port Solara boot and game loop: renderer, world, systems, the
// menu/play/pause/busted/wasted state machine, and the ?shot= screenshot scenes.
import * as THREE from '../vendor/three.module.min.js';
import { CFG } from './config.js';
import { mulberry32 } from './random.js';
import { Input } from './input.js';
import { AudioSys } from './audio.js';
import { Effects } from './effects.js';
import { buildCity } from './city.js';
import { buildScenery } from './scenery.js';
import { buildLandmarks } from './landmarks.js';
import { Traffic } from './traffic.js';
import { Pedestrians } from './pedestrians.js';
import { Player } from './player.js';
import { Police } from './police.js';
import { Missions } from './missions.js';
import { ChaseCamera } from './camera.js';
import { Hud } from './hud.js';
import { Minimap } from './minimap.js';
import { SaveSys } from './save.js';
import { playerAttack, swapWeapon, tryReload } from './combat.js';
import { stageShot } from './shots.js';

window.__smoke = { ok: false, frames: 0, state: 'boot', errors: [] };
window.addEventListener('error', (e) => window.__smoke.errors.push(String(e.message)));
window.addEventListener('unhandledrejection', (e) => window.__smoke.errors.push(String(e.reason)));

const canvas = document.getElementById('game-canvas');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 2600);
const clock = new THREE.Clock();

const G = {
  renderer, scene, camera, clock,
  rng: mulberry32(CFG.seed),
  time: 0, state: 'menu', money: CFG.startMoney,
  cars: [], shotMode: false, shotCruise: 0,
};
G.input = new Input(canvas);
G.audio = new AudioSys();
G.effects = new Effects(scene);
G.city = buildCity(scene, G.rng);
G.scenery = buildScenery(scene, G.rng);
G.landmarks = buildLandmarks(scene, G.rng, G.city);
G.cam = new ChaseCamera(camera);
G.cam.colliders = G.city.colliders;
G.hud = new Hud();
G.peds = new Pedestrians(G);
G.traffic = new Traffic(G);
G.player = new Player(G);
G.police = new Police(G);
G.missions = new Missions(G);
G.minimap = new Minimap(document.getElementById('minimap'), G.city, G.landmarks);
G.save = new SaveSys(G);

const screens = ['screen-start', 'screen-pause', 'screen-busted', 'screen-wasted', 'screen-complete'];
function showScreen(id) {
  for (const s of screens) document.getElementById(s).classList.toggle('hidden', s !== id);
}
function hideScreens() {
  for (const s of screens) document.getElementById(s).classList.add('hidden');
}

function enterPlay() {
  G.state = 'play';
  hideScreens();
  G.hud.setVisible(true);
  G.input.enabled = true;
  G.input.lock();
  G.audio.init();
  G.audio.startMusic();
}
function newGame() {
  G.police.clearWanted();
  G.missions.resetForNewGame();
  G.money = CFG.startMoney;
  G.player.respawn(G.city.playerStart.x, G.city.playerStart.z);
  G.player.weapon = 0;
  G.player.mag = CFG.pistol.mag;
  G.player.reserve = CFG.pistol.reserve;
  G.cam.snapBehind(G.player.mesh.position, Math.PI);
  enterPlay();
  G.hud.banner('PORT SOLARA', 'Four jobs. One sunset.');
  G.hud.notify('Rosa Delmar is waiting at the garage — follow the yellow marker.', 'mission');
}
function continueGame() {
  if (G.save.load()) {
    enterPlay();
    G.hud.notify('Welcome back to Port Solara.', 'mission');
  } else newGame();
}
function pauseGame() {
  if (G.state !== 'play') return;
  G.state = 'pause';
  G.input.unlock();
  showScreen('screen-pause');
  const coins = G.missions.coins.filter((c) => c.taken).length;
  document.getElementById('pause-stats').innerHTML =
    'Money: $' + G.money.toLocaleString('en-US') + '<br>Jobs done: ' + G.missions.index + ' / 4 · Sun coins: ' + coins + ' / ' + CFG.coinCount;
}
function resumeGame() {
  if (G.state !== 'pause') return;
  enterPlay();
}
function quitToTitle() {
  G.save.save();
  G.state = 'menu';
  G.input.unlock();
  G.audio.stopEngine();
  G.hud.setVisible(false);
  showScreen('screen-start');
  document.getElementById('btn-continue').classList.toggle('hidden', !G.save.hasSave());
}
G.onBusted = () => {
  if (G.state !== 'play') return;
  G.state = 'busted';
  const fine = Math.max(50, Math.round(G.money * CFG.bustedFinePct));
  G.money = Math.max(0, G.money - fine);
  G.input.unlock();
  G.audio.busted();
  showScreen('screen-busted');
  document.querySelector('#screen-busted p').textContent =
    'The Solara PD caught up with you. A $' + fine + ' fine was paid from your pocket.';
};
G.onWasted = () => {
  if (G.state !== 'play') return;
  G.state = 'wasted';
  G.money = Math.max(0, G.money - CFG.wastedFine);
  G.input.unlock();
  G.audio.busted();
  showScreen('screen-wasted');
};
G.onStoryComplete = () => {
  G.state = 'complete';
  G.input.unlock();
  showScreen('screen-complete');
};
function respawnAfter(landmark, offset) {
  const l = G.landmarks.positions[landmark];
  G.police.clearWanted();
  G.player.respawn(l.x, l.z + offset);
  G.cam.snapBehind(G.player.mesh.position, Math.PI);
  enterPlay();
}

document.getElementById('btn-new').addEventListener('click', newGame);
document.getElementById('btn-continue').addEventListener('click', continueGame);
document.getElementById('btn-resume').addEventListener('click', resumeGame);
document.getElementById('btn-save').addEventListener('click', () => { G.save.save(); G.audio.ui(); G.hud.notify('Game saved.', ''); });
document.getElementById('btn-load').addEventListener('click', () => { if (G.save.load()) { resumeGame(); G.hud.notify('Save loaded.', ''); } });
document.getElementById('btn-mute').addEventListener('click', () => {
  const muted = G.audio.toggleMute();
  document.getElementById('btn-mute').textContent = 'SOUND: ' + (muted ? 'OFF' : 'ON');
});
document.getElementById('btn-quit').addEventListener('click', quitToTitle);
document.getElementById('btn-busted-ok').addEventListener('click', () => respawnAfter('station', 26));
document.getElementById('btn-wasted-ok').addEventListener('click', () => respawnAfter('hospital', 28));
document.getElementById('btn-freeroam').addEventListener('click', () => { enterPlay(); G.missions.refreshObjective(); });
document.getElementById('btn-continue').classList.toggle('hidden', !G.save.hasSave());

document.addEventListener('pointerlockchange', () => {
  if (!G.input.locked && G.state === 'play' && !G.shotMode) pauseGame();
});
document.addEventListener('visibilitychange', () => { if (document.hidden && G.state === 'play' && !G.shotMode) pauseGame(); });
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

let saveTimer = 0;
let menuAngle = 0;
function handlePlayKeys() {
  const input = G.input;
  if (input.pressed('Escape')) { pauseGame(); return; }
  if (input.pressed('KeyE')) G.player.enterExit();
  if (input.pressed('KeyQ')) swapWeapon(G);
  if (input.pressed('KeyR')) tryReload(G);
  if (input.pressed('KeyM')) {
    const muted = G.audio.toggleMute();
    G.hud.notify(muted ? 'Sound off' : 'Sound on', '');
  }
  if (input.mouse.leftEdge) playerAttack(G);
}

function updatePlay(dt) {
  handlePlayKeys();
  G.cam.addLook(G.input.mouse.dx, G.input.mouse.dy);
  G.player.update(dt);
  G.traffic.update(dt);
  G.peds.update(dt);
  G.police.update(dt);
  G.missions.update(dt);
  const target = G.player.inCar ? G.player.inCar.pos : G.player.mesh.position;
  const speed01 = G.player.inCar ? Math.abs(G.player.inCar.speed) / G.player.inCar.spec.top : 0;
  G.cam.update(dt, target, !!G.player.inCar, speed01);
  saveTimer += dt;
  if (saveTimer > 25 && !G.shotMode) { saveTimer = 0; G.save.save(); }
  G.hud.update(G);
  G.minimap.update(G);
}

// ?selftest=1 — run the real update loop synchronously with scripted inputs so a
// headless browser can verify every system without relying on rAF pacing.
function selfTest() {
  newGame();
  const dt = 1 / 60;
  const input = G.input;
  const log = [];
  for (let step = 0; step < 900; step++) {
    input.keys.clear(); input.pressedSet.clear();
    input.mouse.leftEdge = false;
    if (step < 120) input.keys.add('KeyW');
    if (step === 120) {
      const car = G.traffic.cars[0];
      G.player.x = car.pos.x + 2; G.player.z = car.pos.z;
      input.pressedSet.add('KeyE');
    }
    if (step > 130 && step < 400) input.keys.add('KeyW');
    if (step === 400) input.pressedSet.add('KeyE');
    if (step === 410) input.pressedSet.add('KeyQ');
    if (step >= 420 && step < 440 && step % 4 === 0) input.mouse.leftEdge = true;
    if (step === 450) { G.police.addHeat(120, 'selftest heat'); log.push('stars=' + G.police.stars); }
    if (step > 460 && step < 700) { input.keys.add('KeyW'); input.keys.add('ShiftLeft'); }
    if (step === 500) {
      const pc = G.police.cars.find((c) => c.mode === 'patrol' && c.driver !== 'player');
      if (pc) { G.player.x = pc.pos.x + 2; G.player.z = pc.pos.z; }
    }
    if (step === 501) input.pressedSet.add('KeyE');
    if (step === 545) input.pressedSet.add('KeyE');
    if (step === 550) { G.police.clearWanted(); log.push('wanted cleared, inCar=' + !!G.player.inCar); }
    if (step === 720) {
      G.missions.startMission(0);
      log.push('mission0 started');
    }
    if (step > 730 && G.missions.active) {
      const m = G.missions.markerPos;
      if (G.player.inCar) G.player.exitCar();
      G.player.x = m.x; G.player.z = m.z;
    }
    if (step === 850) log.push('missionIndex=' + G.missions.index + ' money=' + G.money);
    G.time += dt;
    updatePlay(dt);
    G.effects.update(dt);
    G.scenery.update(dt, G.player.mesh.position);
    G.landmarks.update(dt);
    input.endFrame();
    if (G.state !== 'play') { log.push('state=' + G.state + '@' + step); break; }
  }
  renderer.render(scene, camera);
  const smoke = window.__smoke;
  smoke.ok = true; smoke.frames = 900; smoke.state = G.state;
  document.getElementById('status').textContent =
    'PORT SOLARA selftest: state=' + G.state + ' errors=' + smoke.errors.length +
    ' money=' + G.money + ' stars=' + G.police.stars + ' cars=' + G.cars.length +
    ' missionIndex=' + G.missions.index + ' log=' + log.join('|') +
    (smoke.errors.length ? ' ERRORS=' + smoke.errors.join(';') : '');
}

function frame() {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, clock.getDelta());
  G.time += dt;
  if (G.state === 'play') {
    updatePlay(dt);
  } else if (G.state === 'menu') {
    menuAngle += dt * 0.06;
    camera.position.set(Math.sin(menuAngle) * 160, 78, Math.cos(menuAngle) * 160);
    camera.lookAt(0, 18, 0);
    G.peds.update(dt);
    G.traffic.update(dt);
  }
  G.effects.update(dt);
  G.effects.applyShake(camera);
  const focus = G.player ? G.player.mesh.position : camera.position;
  G.scenery.update(dt, focus);
  G.landmarks.update(dt);
  renderer.render(scene, camera);
  G.input.endFrame();
  const smoke = window.__smoke;
  smoke.frames++;
  smoke.state = G.state;
  if (!smoke.ok && smoke.frames > 2) smoke.ok = true;
  if (smoke.frames % 60 === 0) {
    document.getElementById('status').textContent =
      'PORT SOLARA smoke: frames=' + smoke.frames + ' state=' + G.state + ' errors=' + smoke.errors.length +
      ' money=' + G.money + ' stars=' + G.police.stars + ' cars=' + G.cars.length;
  }
}

const params = new URLSearchParams(location.search);
const shot = params.get('shot');
if (shot) {
  hideScreens();
  stageShot(G, shot);
} else if (params.get('autostart')) {
  newGame();
} else if (params.get('selftest')) {
  selfTest();
} else {
  showScreen('screen-start');
}
frame();
