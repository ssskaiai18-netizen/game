// ---------------------------------------------------------------------------
// engine.js — canvas bootstrapping, fixed pixel buffer, main loop and the
// scene manager. The canvas always renders a 640x360 buffer that is scaled to
// fit the window (letterboxed, pixel-perfect, integer-ish scaling) which keeps
// the pixel look crisp and mobile performance stable.
// ---------------------------------------------------------------------------

import { input } from './input.js';
import { DESIGN_W, DESIGN_H, clamp } from './util.js';

export class Engine {
  constructor(canvas, game) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false });
    this.ctx.imageSmoothingEnabled = false;
    this.game = game;
    this.W = DESIGN_W;
    this.H = DESIGN_H;
    this.scenes = new Map();
    this.scene = null;
    this.sceneName = null;
    this.running = false;
    this.time = 0;
    this.frame = 0;
    this.fps = 60;
    this._fpsAcc = 0;
    this._fpsFrames = 0;
    this.viewScale = 1;
    this.viewRect = { x: 0, y: 0, w: DESIGN_W, h: DESIGN_H };
    this.transition = { active: false, t: 0, dir: 0, next: null, params: null, dur: 0.22 };
    this.paused = false;
    this.pauseOverlay = null; // set by ui/menu module
    this._acc = 0;
    this._last = 0;
    this.debug = false;

    canvas.width = DESIGN_W;
    canvas.height = DESIGN_H;
    this.resize();
    window.addEventListener('resize', () => this.resize());
    window.addEventListener('orientationchange', () => setTimeout(() => this.resize(), 120));

    input.toDesign = (x, y) => this.clientToDesign(x, y);
    input.attach(canvas);
  }

  resize() {
    const c = this.canvas;
    const availW = window.innerWidth;
    const availH = window.innerHeight;
    const scale = Math.min(availW / DESIGN_W, availH / DESIGN_H);
    const cssW = Math.round(DESIGN_W * scale);
    const cssH = Math.round(DESIGN_H * scale);
    c.style.width = cssW + 'px';
    c.style.height = cssH + 'px';
    const rect = c.getBoundingClientRect();
    this.viewRect = { x: rect.left, y: rect.top, w: rect.width, h: rect.height };
    this.viewScale = rect.width / DESIGN_W;
  }

  clientToDesign(cx, cy) {
    const rect = this.canvas.getBoundingClientRect();
    const x = ((cx - rect.left) / rect.width) * DESIGN_W;
    const y = ((cy - rect.top) / rect.height) * DESIGN_H;
    return { x: clamp(x, 0, DESIGN_W), y: clamp(y, 0, DESIGN_H) };
  }

  register(name, factory) {
    this.scenes.set(name, factory);
  }

  /** Immediate switch (used by the transition midpoint and first boot). */
  setScene(name, params = {}) {
    const factory = this.scenes.get(name);
    if (!factory) {
      console.error('[engine] unknown scene', name);
      return;
    }
    if (this.scene && this.scene.exit) {
      try {
        this.scene.exit();
      } catch (e) {
        console.error('[engine] scene exit failed', e);
      }
    }
    input.releaseAll();
    this.scene = factory(this.game, params);
    this.sceneName = name;
    this.game.onSceneChanged?.(name, this.scene);
    if (this.scene.enter) this.scene.enter(params);
    this.transition.active = false;
    this.transition.dir = 0;
    this.paused = false;
  }

  /** Switch with a quick pixel fade (used for every player-facing transition). */
  go(name, params = {}, dur = 0.22) {
    if (this.transition.active) return;
    this.transition = { active: true, t: 0, dir: 1, next: name, params, dur };
    this._pendingSwitch = true;
  }

  startLoop() {
    if (this.running) return;
    this.running = true;
    this._last = performance.now();
    const tick = (now) => {
      if (!this.running) return;
      let dt = (now - this._last) / 1000;
      this._last = now;
      if (dt > 0.1) dt = 0.1; // tab-switch guard
      if (dt <= 0) dt = 1 / 60;
      this._fpsAcc += dt;
      this._fpsFrames++;
      if (this._fpsAcc >= 0.5) {
        this.fps = Math.round(this._fpsFrames / this._fpsAcc);
        this._fpsAcc = 0;
        this._fpsFrames = 0;
      }
      this.time += dt;
      this.frame++;
      this.tick(dt);
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  tick(dt) {
    const g = this.game;

    // Pause handling is global so it works in every scene.
    const allowPause = this.scene && this.scene.canPause !== false && this.transition.dir === 0;
    if (allowPause && input.wasPressed('pause')) {
      this.paused = !this.paused;
      if (this.scene.onPauseToggle) this.scene.onPauseToggle(this.paused);
      g.audio?.play('ui');
    }

    if (!this.paused) {
      if (this.transition.active) {
        this.transition.t += dt;
        if (this._pendingSwitch && this.transition.t >= this.transition.dur) {
          this._pendingSwitch = false;
          this.setScene(this.transition.next, this.transition.params);
          this.transition.active = true;
          this.transition.t = 0;
          this.transition.dir = -1;
        } else if (this.transition.dir === -1 && this.transition.t >= this.transition.dur) {
          this.transition.active = false;
          this.transition.dir = 0;
          if (this.scene && this.scene.onTransitionEnd) this.scene.onTransitionEnd();
        }
      }
      if (this.scene && this.scene.update) {
        try {
          this.scene.update(dt);
        } catch (e) {
          console.error('[engine] scene update error', e);
        }
      }
      input.update(dt);
    } else if (this.pauseOverlay && this.pauseOverlay.update) {
      try {
        this.pauseOverlay.update(dt);
      } catch (e) {
        console.error('[engine] pause update error', e);
      }
    }

    this.render();

    if (this.paused && this.pauseOverlay) {
      this.pauseOverlay.draw(this.ctx, this);
    }

    // transition curtain
    if (this.transition.active) {
      const t = clamp(this.transition.t / this.transition.dur, 0, 1);
      const a = this.transition.dir === 1 ? t : 1 - t;
      this.ctx.fillStyle = `rgba(4,4,10,${a})`;
      this.ctx.fillRect(0, 0, DESIGN_W, DESIGN_H);
    }

    input.endFrame();
  }

  render() {
    const ctx = this.ctx;
    ctx.imageSmoothingEnabled = false;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#05050a';
    ctx.fillRect(0, 0, DESIGN_W, DESIGN_H);
    if (this.scene && this.scene.draw) {
      try {
        this.scene.draw(ctx);
      } catch (e) {
        console.error('[engine] scene draw error', e);
      }
    }
  }
}
