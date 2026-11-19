// input.js — keyboard + mouse state, pointer-lock look, edge-triggered key presses.
export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.keys = new Set();
    this.pressedSet = new Set();
    this.mouse = { dx: 0, dy: 0, left: false, right: false, leftEdge: false };
    this.locked = false;
    this.enabled = true;
    window.addEventListener('keydown', (e) => {
      if (e.repeat) return;
      this.keys.add(e.code);
      this.pressedSet.add(e.code);
      if (['Space', 'ArrowUp', 'ArrowDown', 'Tab'].includes(e.code)) e.preventDefault();
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => { this.keys.clear(); this.mouse.left = false; });
    canvas.addEventListener('mousedown', (e) => {
      if (!this.enabled) return;
      if (e.button === 0) { this.mouse.left = true; this.mouse.leftEdge = true; }
      if (e.button === 2) this.mouse.right = true;
      if (!this.locked) this.lock();
    });
    window.addEventListener('mouseup', (e) => {
      if (e.button === 0) this.mouse.left = false;
      if (e.button === 2) this.mouse.right = false;
    });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    document.addEventListener('mousemove', (e) => {
      if (!this.locked) return;
      this.mouse.dx += e.movementX || 0;
      this.mouse.dy += e.movementY || 0;
    });
    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === canvas;
      if (!this.locked) this.mouse.left = false;
    });
  }
  lock() {
    if (this.canvas.requestPointerLock) {
      const p = this.canvas.requestPointerLock();
      if (p && p.catch) p.catch(() => {});
    }
  }
  unlock() { if (document.exitPointerLock) document.exitPointerLock(); }
  down(code) { return this.keys.has(code); }
  pressed(code) { return this.pressedSet.has(code); }
  axis(neg, pos) { return (this.down(pos) ? 1 : 0) - (this.down(neg) ? 1 : 0); }
  endFrame() {
    this.pressedSet.clear();
    this.mouse.dx = 0; this.mouse.dy = 0; this.mouse.leftEdge = false;
  }
}
