// audio.js — all sound is synthesized with WebAudio: engine, siren, guns, UI and a
// procedural sunset-drive music loop. No audio files, nothing loads over the network.
export class AudioSys {
  constructor() {
    this.ctx = null; this.muted = false; this.musicOn = false;
    this.engine = null; this.sirenNodes = null; this.musicTimer = null;
  }
  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 0.55;
    this.master.connect(this.ctx.destination);
    this.sfxBus = this.ctx.createGain(); this.sfxBus.gain.value = 0.9; this.sfxBus.connect(this.master);
    this.musicBus = this.ctx.createGain(); this.musicBus.gain.value = 0.3; this.musicBus.connect(this.master);
    const len = this.ctx.sampleRate * 1.2;
    this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  }
  toggleMute() {
    this.muted = !this.muted;
    if (this.master) this.master.gain.value = this.muted ? 0 : 0.55;
    return this.muted;
  }
  blip(freq, dur, type, vol, slide) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.type = type || 'sine'; o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, slide), t + dur);
    g.gain.setValueAtTime(vol || 0.2, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(this.sfxBus); o.start(t); o.stop(t + dur + 0.02);
  }
  noise(dur, vol, filterFreq, type) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const s = this.ctx.createBufferSource(); s.buffer = this.noiseBuf;
    const f = this.ctx.createBiquadFilter(); f.type = type || 'lowpass'; f.frequency.value = filterFreq || 1200;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    s.connect(f); f.connect(g); g.connect(this.sfxBus); s.start(t); s.stop(t + dur + 0.02);
  }
  shot() { this.noise(0.14, 0.5, 2600); this.blip(180, 0.09, 'square', 0.25, 60); }
  punch() { this.noise(0.09, 0.35, 500); this.blip(95, 0.1, 'sine', 0.3, 50); }
  hit() { this.blip(220, 0.08, 'square', 0.16, 110); }
  hurt() { this.blip(140, 0.2, 'sawtooth', 0.22, 70); }
  pickup() { this.blip(880, 0.09, 'sine', 0.2); setTimeout(() => this.blip(1320, 0.12, 'sine', 0.2), 70); }
  cash() { this.blip(990, 0.08, 'triangle', 0.22); setTimeout(() => this.blip(1480, 0.14, 'triangle', 0.22), 80); }
  ui() { this.blip(660, 0.06, 'triangle', 0.15); }
  enterCar() { this.blip(300, 0.12, 'triangle', 0.2, 420); this.noise(0.15, 0.15, 700); }
  mission() { [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => this.blip(f, 0.22, 'triangle', 0.22), i * 110)); }
  busted() { [392, 330, 262, 196].forEach((f, i) => setTimeout(() => this.blip(f, 0.3, 'sawtooth', 0.16), i * 160)); }
  crash(intensity) { this.noise(0.22, Math.min(0.5, 0.15 + intensity * 0.3), 900); }
  startEngine() {
    if (!this.ctx || this.engine) return;
    const o = this.ctx.createOscillator(), o2 = this.ctx.createOscillator();
    const f = this.ctx.createBiquadFilter(), g = this.ctx.createGain();
    o.type = 'sawtooth'; o2.type = 'square';
    o.frequency.value = 55; o2.frequency.value = 27;
    f.type = 'lowpass'; f.frequency.value = 420; g.gain.value = 0;
    o.connect(f); o2.connect(f); f.connect(g); g.connect(this.sfxBus);
    o.start(); o2.start();
    this.engine = { o, o2, f, g };
  }
  setEngine(speed01, throttle) {
    if (!this.engine) return;
    const t = this.ctx.currentTime;
    const rpm = 50 + speed01 * 160 + throttle * 22;
    this.engine.o.frequency.setTargetAtTime(rpm, t, 0.08);
    this.engine.o2.frequency.setTargetAtTime(rpm * 0.5, t, 0.08);
    this.engine.f.frequency.setTargetAtTime(320 + speed01 * 900, t, 0.1);
    this.engine.g.gain.setTargetAtTime(0.05 + speed01 * 0.1 + throttle * 0.04, t, 0.1);
  }
  stopEngine() {
    if (!this.engine) return;
    const e = this.engine; this.engine = null;
    e.g.gain.setTargetAtTime(0, this.ctx.currentTime, 0.08);
    setTimeout(() => { try { e.o.stop(); e.o2.stop(); } catch (err) { /* already stopped */ } }, 400);
  }
  setSiren(on, dist01) {
    if (!this.ctx) return;
    if (on && !this.sirenNodes) {
      const o = this.ctx.createOscillator(), g = this.ctx.createGain(), lfo = this.ctx.createOscillator(), lg = this.ctx.createGain();
      o.type = 'triangle'; o.frequency.value = 700;
      lfo.type = 'sine'; lfo.frequency.value = 1.6; lg.gain.value = 240;
      lfo.connect(lg); lg.connect(o.frequency);
      g.gain.value = 0; o.connect(g); g.connect(this.sfxBus);
      o.start(); lfo.start();
      this.sirenNodes = { o, g, lfo };
    }
    if (this.sirenNodes) {
      const vol = on ? Math.max(0, 0.14 * (1 - dist01)) : 0;
      this.sirenNodes.g.gain.setTargetAtTime(vol, this.ctx.currentTime, 0.2);
      if (!on) {
        const s = this.sirenNodes; this.sirenNodes = null;
        setTimeout(() => { try { s.o.stop(); s.lfo.stop(); } catch (err) { /* already stopped */ } }, 800);
      }
    }
  }
  startMusic() {
    if (!this.ctx || this.musicOn) return;
    this.musicOn = true;
    // A-minor sunset loop: Am — F — C — G pads, plucked bass, soft hats.
    const chords = [[220, 261.6, 329.6], [174.6, 220, 261.6], [196, 261.6, 329.6], [196, 246.9, 293.7]];
    const bass = [110, 87.3, 130.8, 98];
    const beat = 0.5; let bar = 0; let next = this.ctx.currentTime + 0.1;
    const schedule = () => {
      if (!this.musicOn) return;
      while (next < this.ctx.currentTime + 0.6) {
        const ch = chords[bar % 4];
        for (const f of ch) this.pad(f, next, beat * 4);
        this.padBass(bass[bar % 4], next, beat * 3.5);
        for (let s = 0; s < 8; s++) this.hat(next + s * beat * 0.5, s % 2 === 0 ? 0.05 : 0.028);
        next += beat * 4; bar++;
      }
      this.musicTimer = setTimeout(schedule, 250);
    };
    schedule();
  }
  pad(freq, t, dur) {
    const o = this.ctx.createOscillator(), o2 = this.ctx.createOscillator();
    const f = this.ctx.createBiquadFilter(), g = this.ctx.createGain();
    o.type = 'sawtooth'; o2.type = 'sawtooth';
    o.frequency.value = freq; o2.frequency.value = freq * 1.005;
    f.type = 'lowpass'; f.frequency.value = 900;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.035, t + 0.4);
    g.gain.setValueAtTime(0.035, t + dur - 0.5);
    g.gain.linearRampToValueAtTime(0.0001, t + dur);
    o.connect(f); o2.connect(f); f.connect(g); g.connect(this.musicBus);
    o.start(t); o2.start(t); o.stop(t + dur + 0.05); o2.stop(t + dur + 0.05);
  }
  padBass(freq, t, dur) {
    const o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.type = 'triangle'; o.frequency.value = freq;
    g.gain.setValueAtTime(0.09, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(this.musicBus); o.start(t); o.stop(t + dur + 0.05);
  }
  hat(t, vol) {
    const s = this.ctx.createBufferSource(); s.buffer = this.noiseBuf;
    const f = this.ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 7000;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
    s.connect(f); f.connect(g); g.connect(this.musicBus); s.start(t); s.stop(t + 0.08);
  }
  stopMusic() {
    this.musicOn = false;
    if (this.musicTimer) { clearTimeout(this.musicTimer); this.musicTimer = null; }
  }
}
