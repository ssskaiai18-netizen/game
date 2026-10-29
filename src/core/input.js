// ---------------------------------------------------------------------------
// input.js — unified keyboard / mouse / touch input.
//
// Actions are abstract names ("attack", "dodge", "a1" ...). Both physical keys
// and on-screen touch buttons feed the same action stream, so gameplay code
// never has to care which device is in use.
// ---------------------------------------------------------------------------

import { clamp, pointInCircle } from './util.js';

export const DEFAULT_BINDS = {
  up: ['KeyW', 'ArrowUp'],
  down: ['KeyS', 'ArrowDown'],
  left: ['KeyA', 'ArrowLeft'],
  right: ['KeyD', 'ArrowRight'],
  attack: ['KeyJ'],
  dodge: ['Space'],
  reinforce: ['ShiftLeft', 'ShiftRight'],
  a1: ['Digit1', 'KeyU'],
  a2: ['Digit2', 'KeyI'],
  a3: ['Digit3', 'KeyO'],
  a4: ['Digit4', 'KeyP'],
  a5: ['Digit5', 'KeyL'],
  ult: ['KeyR'],
  domain: ['KeyF'],
  interact: ['KeyE'],
  summonCmd: ['KeyC'],
  boogie: ['KeyT'],
  pause: ['Escape'],
  confirm: ['Enter'],
  help: ['KeyH'],
};

const MOVE_KEYS = ['up', 'down', 'left', 'right'];

export class Input {
  constructor() {
    this.keys = new Set();
    this.pressedKeys = new Set();
    this.releasedKeys = new Set();
    this.virtualDown = new Set();
    this.virtualPressed = new Set();
    this.buttons = []; // touch buttons registered by the HUD each frame
    this.mouse = { x: 320, y: 180, dx: 0, dy: 0, down: false };
    this.mousePressed = false;
    this.mouseReleased = false;
    this.mouseMoved = false;
    this.mouseWorld = { x: 0, y: 0 };
    this.touching = false;
    this.usedTouch = false;
    this.joy = { active: false, id: -1, bx: 0, by: 0, x: 0, y: 0, dx: 0, dy: 0 };
    this.pointer = { x: 320, y: 180, down: false, pressed: false, released: false };
    this.wheelDelta = 0; // accumulated mouse-wheel / trackpad scroll (design px)
    this.binds = JSON.parse(JSON.stringify(DEFAULT_BINDS));
    this.toDesign = (x, y) => ({ x, y }); // engine installs the real transform
    this.anyInputAt = 0;
    this._handlers = [];
    this.enabled = true;
  }

  consumeWheel() {
    const w = this.wheelDelta;
    this.wheelDelta = 0;
    return w;
  }

  attach(canvas) {
    this.canvas = canvas;
    const add = (target, type, fn, opts) => {
      target.addEventListener(type, fn, opts);
      this._handlers.push([target, type, fn]);
    };

    add(window, 'keydown', (e) => {
      if (e.code === 'Space' || e.code.startsWith('Arrow')) e.preventDefault();
      if (e.repeat) return;
      this.keys.add(e.code);
      this.pressedKeys.add(e.code);
      this.anyInputAt = performance.now();
    });
    add(window, 'keyup', (e) => {
      this.keys.delete(e.code);
      this.releasedKeys.add(e.code);
    });
    add(window, 'wheel', (e) => {
      this.wheelDelta += Math.sign(e.deltaY || 0);
    }, { passive: true });
    add(window, 'blur', () => {
      this.keys.clear();
      this.virtualDown.clear();
      this.joy.active = false;
    });

    add(canvas, 'pointerdown', (e) => {
      if (!this.enabled) return;
      e.preventDefault();
      canvas.setPointerCapture?.(e.pointerId);
      const p = this.toDesign(e.clientX, e.clientY);
      this.usedTouch = e.pointerType === 'touch';
      this.touching = this.usedTouch;
      this.anyInputAt = performance.now();
      this.pointer.x = p.x;
      this.pointer.y = p.y;
      this.pointer.down = true;
      this.pointer.pressed = true;

      // 1) touch buttons first
      if (e.pointerType === 'touch') {
        const hit = this.hitTestButtons(p.x, p.y);
        if (hit) {
          this.virtualDown.add(hit.id);
          this.virtualPressed.add(hit.id);
          this._buttonPointer = { id: hit.id, pointerId: e.pointerId, btn: hit };
          return;
        }
        if (p.x < 640 * 0.48 && !this.joy.active) {
          this.joy.active = true;
          this.joy.id = e.pointerId;
          this.joy.bx = p.x;
          this.joy.by = p.y;
          this.joy.x = p.x;
          this.joy.y = p.y;
          this.joy.dx = 0;
          this.joy.dy = 0;
          return;
        }
      }
      this.mouse.down = true;
      this.mousePressed = true;
    });

    add(canvas, 'pointermove', (e) => {
      const p = this.toDesign(e.clientX, e.clientY);
      this.anyInputAt = performance.now();
      if (e.pointerType === 'touch') {
        this.usedTouch = true;
        this.touching = true;
        if (this.joy.active && this.joy.id === e.pointerId) {
          this.joy.x = p.x;
          this.joy.y = p.y;
          const dx = p.x - this.joy.bx;
          const dy = p.y - this.joy.by;
          const m = Math.hypot(dx, dy);
          const maxR = 30;
          if (m > maxR) {
            this.joy.bx = p.x - (dx / m) * maxR;
            this.joy.by = p.y - (dy / m) * maxR;
          }
          const m2 = Math.hypot(this.joy.x - this.joy.bx, this.joy.y - this.joy.by) || 1;
          const clampM = Math.min(m2, maxR) / maxR;
          this.joy.dx = ((this.joy.x - this.joy.bx) / m2) * clampM;
          this.joy.dy = ((this.joy.y - this.joy.by) / m2) * clampM;
        }
        this.pointer.x = p.x;
        this.pointer.y = p.y;
        return;
      }
      if (p.x !== this.mouse.x || p.y !== this.mouse.y) this.mouseMoved = true;
      this.mouse.x = p.x;
      this.mouse.y = p.y;
      this.pointer.x = p.x;
      this.pointer.y = p.y;
      this.touching = false;
    });

    const endPointer = (e) => {
      const p = this.toDesign(e.clientX, e.clientY);
      if (e.pointerType === 'touch') {
        if (this.joy.active && this.joy.id === e.pointerId) {
          this.joy.active = false;
          this.joy.dx = 0;
          this.joy.dy = 0;
          this.joy.id = -1;
        }
        if (this._buttonPointer && this._buttonPointer.pointerId === e.pointerId) {
          this.virtualDown.delete(this._buttonPointer.id);
          this.releasedKey(this._buttonPointer.id);
          this._buttonPointer = null;
        }
      } else {
        this.mouse.down = false;
        this.mouseReleased = true;
      }
      this.pointer.down = false;
      this.pointer.released = true;
      this.pointer.x = p.x;
      this.pointer.y = p.y;
      this.anyInputAt = performance.now();
    };
    add(canvas, 'pointerup', endPointer);
    add(canvas, 'pointercancel', endPointer);
    add(canvas, 'contextmenu', (e) => e.preventDefault());
  }

  releaseAll() {
    this.keys.clear();
    this.pressedKeys.clear();
    this.releasedKeys.clear();
    this.virtualDown.clear();
    this.virtualPressed.clear();
    this.mouse.down = false;
    this.mousePressed = false;
    this.joy.active = false;
    this.joy.dx = 0;
    this.joy.dy = 0;
    this.pointer.down = false;
    this.pointer.pressed = false;
  }

  setButtons(list) {
    this.buttons = list || [];
  }

  hitTestButtons(x, y) {
    for (let i = this.buttons.length - 1; i >= 0; i--) {
      const b = this.buttons[i];
      if (!b || b.hidden) continue;
      if (pointInCircle(x, y, b.x, b.y, (b.r || 18) * 1.15)) return b;
    }
    return null;
  }

  // ---- action queries -------------------------------------------------------
  isDown(action) {
    if (!this.enabled) return false;
    if (this.virtualDown.has(action)) return true;
    const binds = this.binds[action];
    if (!binds) return false;
    for (const k of binds) if (this.keys.has(k)) return true;
    if (action === 'attack' && this.mouse.down) return true;
    return false;
  }

  wasPressed(action) {
    if (!this.enabled) return false;
    if (this.virtualPressed.has(action)) return true;
    const binds = this.binds[action];
    if (binds) {
      for (const k of binds) if (this.pressedKeys.has(k)) return true;
    }
    if (action === 'attack' && this.mousePressed) return true;
    if (action === 'confirm' && this.mousePressed) return true;
    return false;
  }

  releasedKey(action) {
    this.virtualPressed.delete(action);
  }

  /** Movement vector from keyboard + joystick, normalised to length <= 1. */
  moveVector() {
    let x = 0;
    let y = 0;
    if (this.isDown('left')) x -= 1;
    if (this.isDown('right')) x += 1;
    if (this.isDown('up')) y -= 1;
    if (this.isDown('down')) y += 1;
    if (x === 0 && y === 0 && this.joy.active) {
      x = this.joy.dx;
      y = this.joy.dy;
    }
    const m = Math.hypot(x, y);
    if (m > 1) {
      x /= m;
      y /= m;
    }
    return { x, y };
  }

  update(dt) {
    // Reset transient button presses that were not consumed by a scene.
    this.buttons = this.buttons || [];
    this.joy.dx = this.joy.active ? this.joy.dx : 0;
    if (!this.joy.active) {
      this.joy.dx = 0;
      this.joy.dy = 0;
    }
    this.pointer.pressed = this.mousePressed;
    this.pointer.down = this.mouse.down || this.joy.active;
  }

  endFrame() {
    this.pressedKeys.clear();
    this.releasedKeys.clear();
    this.virtualPressed.clear();
    this.mousePressed = false;
    this.mouseReleased = false;
    this.pointer.pressed = false;
    this.pointer.released = false;
    // Release virtual buttons whose pointer was lost.
    if (this._buttonPointer === null && this.virtualDown.size > 0 && !this.touching) {
      this.virtualDown.clear();
    }
  }
}

export const input = new Input();
