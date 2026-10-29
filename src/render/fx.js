// ---------------------------------------------------------------------------
// fx.js — particle system, pixel slash arcs, damage numbers, shockwaves,
// screen shake and hit-stop. All allocations are capped so long runs stay at
// 60fps on mobile.
// ---------------------------------------------------------------------------

import { clamp, lerp, rgba, TAU } from '../core/util.js';

const MAX_PARTICLES = 520;
const MAX_TEXTS = 60;
const MAX_ARC = 48;

export class FX {
  constructor() {
    this.particles = [];
    this.texts = [];
    this.arcs = [];
    this.rings = [];
    this.afterimages = [];
    this.shakeT = 0;
    this.shakeDur = 0;
    this.shakeMag = 0;
    this.hitstop = 0;
    this.flashColor = null;
    this.flashT = 0;
    this.flashDur = 0;
    this.vignette = 0;
    this.time = 0;
    this.enabledShake = true;
    this._shakeX = 0;
    this._shakeY = 0;
  }

  clear() {
    this.particles.length = 0;
    this.texts.length = 0;
    this.arcs.length = 0;
    this.rings.length = 0;
    this.afterimages.length = 0;
    this.hitstop = 0;
    this.shakeT = 0;
    this.flashT = 0;
    this.vignette = 0;
  }

  addParticle(p) {
    if (this.particles.length >= MAX_PARTICLES) this.particles.shift();
    this.particles.push({
      x: p.x,
      y: p.y,
      vx: p.vx || 0,
      vy: p.vy || 0,
      life: p.life ?? 0.4,
      maxLife: p.life ?? 0.4,
      color: p.color || '#ffffff',
      size: p.size ?? 2,
      gravity: p.gravity ?? 0,
      drag: p.drag ?? 0.92,
      glow: p.glow ?? false,
      square: p.square ?? true,
      spin: p.spin ?? 0,
      rot: p.rot ?? 0,
    });
  }

  burst(x, y, count, opts = {}) {
    const {
      color = '#ffffff',
      color2 = null,
      speed = 60,
      speedVar = 0.6,
      life = 0.4,
      lifeVar = 0.3,
      size = 2,
      gravity = 0,
      dir = null,
      spread = TAU,
      glow = false,
      drag = 0.9,
    } = opts;
    for (let i = 0; i < count; i++) {
      const a = dir === null ? Math.random() * TAU : dir + (Math.random() - 0.5) * spread;
      const s = speed * (1 + (Math.random() - 0.5) * speedVar * 2);
      this.addParticle({
        x: x + (Math.random() - 0.5) * 4,
        y: y + (Math.random() - 0.5) * 4,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s,
        life: life * (1 + (Math.random() - 0.5) * lifeVar * 2),
        color: color2 && Math.random() < 0.4 ? color2 : color,
        size: size * (0.6 + Math.random() * 0.8),
        gravity,
        glow,
        drag,
      });
    }
  }

  trail(x, y, color = '#ffffff', size = 2, life = 0.3) {
    this.addParticle({ x, y, vx: (Math.random() - 0.5) * 14, vy: (Math.random() - 0.5) * 14, life, color, size, glow: true, drag: 0.86 });
  }

  slash(x, y, angle, len, color = '#ffffff', dir = 1, life = 0.18, thick = 3) {
    if (this.arcs.length >= MAX_ARC) this.arcs.shift();
    this.arcs.push({ x, y, angle, len, color, dir, life, maxLife: life, thick });
  }

  ring(x, y, r, color = '#ffffff', life = 0.35, thick = 2, fill = false) {
    this.rings.push({ x, y, r, color, life, maxLife: life, thick, fill });
  }

  text(x, y, str, opts = {}) {
    if (this.texts.length >= MAX_TEXTS) this.texts.shift();
    this.texts.push({
      x,
      y,
      str: String(str),
      color: opts.color || '#ffffff',
      life: opts.life ?? 0.75,
      maxLife: opts.life ?? 0.75,
      scale: opts.scale ?? 1,
      vy: opts.vy ?? -34,
      vx: opts.vx ?? (Math.random() - 0.5) * 18,
      crit: opts.crit || false,
      shadow: opts.shadow !== false,
      outline: opts.outline || null,
    });
  }

  afterimage(snapshot, color = '#7ec8ff', life = 0.25) {
    if (this.afterimages.length > 40) this.afterimages.shift();
    this.afterimages.push({ ...snapshot, color, life, maxLife: life });
  }

  shake(mag = 3, dur = 0.2) {
    if (!this.enabledShake) return;
    if (mag >= this.shakeMag || this.shakeT <= 0) {
      this.shakeMag = mag;
      this.shakeDur = dur;
      this.shakeT = dur;
    }
  }

  flash(color, dur = 0.18) {
    this.flashColor = color;
    this.flashT = dur;
    this.flashDur = dur;
  }

  stop(seconds) {
    this.hitstop = Math.max(this.hitstop, seconds);
  }

  update(dt) {
    this.time += dt;
    // shake
    if (this.shakeT > 0) {
      this.shakeT -= dt;
      const k = clamp(this.shakeT / this.shakeDur, 0, 1);
      const m = this.shakeMag * k * k;
      this._shakeX = (Math.random() - 0.5) * 2 * m;
      this._shakeY = (Math.random() - 0.5) * 2 * m;
      if (this.shakeT <= 0) {
        this.shakeMag = 0;
        this._shakeX = 0;
        this._shakeY = 0;
      }
    } else {
      this._shakeX = 0;
      this._shakeY = 0;
    }
    if (this.flashT > 0) this.flashT = Math.max(0, this.flashT - dt);
    if (this.vignette > 0) this.vignette = Math.max(0, this.vignette - dt * 0.8);

    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= dt;
      if (p.life <= 0) {
        this.particles.splice(i, 1);
        continue;
      }
      const d = Math.pow(p.drag, dt * 60);
      p.vx *= d;
      p.vy *= d;
      p.vy += p.gravity * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rot += p.spin * dt;
    }
    for (let i = this.texts.length - 1; i >= 0; i--) {
      const t = this.texts[i];
      t.life -= dt;
      if (t.life <= 0) {
        this.texts.splice(i, 1);
        continue;
      }
      t.x += t.vx * dt;
      t.y += t.vy * dt;
      t.vy *= 0.94;
    }
    for (let i = this.arcs.length - 1; i >= 0; i--) {
      const a = this.arcs[i];
      a.life -= dt;
      if (a.life <= 0) this.arcs.splice(i, 1);
    }
    for (let i = this.rings.length - 1; i >= 0; i--) {
      const r = this.rings[i];
      r.life -= dt;
      if (r.life <= 0) this.rings.splice(i, 1);
    }
    for (let i = this.afterimages.length - 1; i >= 0; i--) {
      const a = this.afterimages[i];
      a.life -= dt;
      if (a.life <= 0) this.afterimages.splice(i, 1);
    }
  }

  get shakeX() {
    return this._shakeX;
  }
  get shakeY() {
    return this._shakeY;
  }

  drawWorld(ctx) {
    // rings
    for (const r of this.rings) {
      const k = 1 - r.life / r.maxLife;
      const rad = r.r * (0.35 + k * 0.85);
      ctx.globalAlpha = (1 - k) * 0.9;
      ctx.strokeStyle = r.color;
      ctx.lineWidth = r.thick;
      ctx.beginPath();
      ctx.arc(r.x, r.y, rad, 0, TAU);
      ctx.stroke();
      if (r.fill) {
        ctx.globalAlpha = (1 - k) * 0.18;
        ctx.fillStyle = r.color;
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;

    // slash arcs — drawn as a rotating crescent made of pixel segments
    for (const a of this.arcs) {
      const k = 1 - a.life / a.maxLife;
      const sweep = a.len;
      const start = a.angle - (sweep / 2) * (a.dir >= 0 ? 1 : -1);
      const segs = 9;
      ctx.globalAlpha = (1 - k * k) * 0.95;
      for (let i = 0; i < segs; i++) {
        const f = i / (segs - 1);
        const ang = start + a.dir * sweep * f;
        const rr = 8 + f * 4 + k * 6;
        const px = a.x + Math.cos(ang) * rr;
        const py = a.y + Math.sin(ang) * rr * 0.75;
        const thick = a.thick * (1 - Math.abs(f - 0.5) * 1.5) * (1 - k * 0.4);
        ctx.fillStyle = i % 3 === 0 ? '#ffffff' : a.color;
        ctx.fillRect(Math.round(px - thick / 2), Math.round(py - thick / 2), Math.max(1, thick), Math.max(1, thick));
      }
    }
    ctx.globalAlpha = 1;

    // particles
    for (const p of this.particles) {
      const k = p.life / p.maxLife;
      ctx.globalAlpha = clamp(k, 0, 1);
      ctx.fillStyle = p.color;
      if (p.glow) {
        ctx.globalAlpha = clamp(k * 0.35, 0, 0.35);
        ctx.fillRect(Math.round(p.x - p.size), Math.round(p.y - p.size), Math.round(p.size * 2.6), Math.round(p.size * 2.6));
        ctx.globalAlpha = clamp(k, 0, 1);
      }
      const s = p.size * (0.4 + k * 0.6);
      ctx.fillRect(Math.round(p.x), Math.round(p.y), Math.max(1, Math.round(s)), Math.max(1, Math.round(s)));
    }
    ctx.globalAlpha = 1;
  }

  drawTexts(ctx) {
    ctx.textAlign = 'center';
    for (const t of this.texts) {
      const k = t.life / t.maxLife;
      const pop = t.crit ? 1 + Math.max(0, (1 - k) * 1.2) : 1;
      const size = Math.round(7 * t.scale * pop);
      ctx.globalAlpha = clamp(k * 1.6, 0, 1);
      ctx.font = `bold ${size}px "Courier New", monospace`;
      if (t.shadow) {
        ctx.fillStyle = 'rgba(0,0,0,0.75)';
        ctx.fillText(t.str, Math.round(t.x) + 1, Math.round(t.y) + 1);
      }
      ctx.fillStyle = t.color;
      ctx.fillText(t.str, Math.round(t.x), Math.round(t.y));
    }
    ctx.globalAlpha = 1;
    ctx.textAlign = 'left';
  }

  drawOverlay(ctx, w = 640, h = 360) {
    if (this.flashT > 0 && this.flashColor) {
      ctx.globalAlpha = clamp((this.flashT / this.flashDur) * 0.5, 0, 0.5);
      ctx.fillStyle = this.flashColor;
      ctx.fillRect(0, 0, w, h);
      ctx.globalAlpha = 1;
    }
    if (this.vignette > 0) {
      const g = ctx.createRadialGradient(w / 2, h / 2, h * 0.28, w / 2, h / 2, h * 0.75);
      g.addColorStop(0, 'rgba(120,0,20,0)');
      g.addColorStop(1, rgba('#a00020', Math.min(0.65, this.vignette)));
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
    }
  }
}
