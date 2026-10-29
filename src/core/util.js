// ---------------------------------------------------------------------------
// util.js — math, random, colour and easing helpers shared by every system.
// No dependencies. Safe to import anywhere.
// ---------------------------------------------------------------------------

export const TAU = Math.PI * 2;
export const DESIGN_W = 640;
export const DESIGN_H = 360;

export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const invLerp = (a, b, v) => (b === a ? 0 : (v - a) / (b - a));
export const sign = (v) => (v < 0 ? -1 : v > 0 ? 1 : 0);
export const dist = (ax, ay, bx, by) => Math.hypot(bx - ax, by - ay);
export const dist2 = (ax, ay, bx, by) => (bx - ax) * (bx - ax) + (by - ay) * (by - ay);

export function approach(v, target, delta) {
  if (v < target) return Math.min(v + delta, target);
  if (v > target) return Math.max(v - delta, target);
  return target;
}

export function angleDiff(a, b) {
  let d = (b - a) % TAU;
  if (d > Math.PI) d -= TAU;
  if (d < -Math.PI) d += TAU;
  return d;
}

export function angleLerp(a, b, t) {
  return a + angleDiff(a, b) * clamp(t, 0, 1);
}

export function norm(x, y) {
  const m = Math.hypot(x, y) || 1;
  return { x: x / m, y: y / m };
}

export const easeOutCubic = (t) => 1 - Math.pow(1 - clamp(t, 0, 1), 3);
export const easeInCubic = (t) => Math.pow(clamp(t, 0, 1), 3);
export const easeOutBack = (t) => {
  const c = 1.70158;
  t = clamp(t, 0, 1) - 1;
  return 1 + (c + 1) * t * t * t + c * t * t;
};
export const easeInOutSine = (t) => -(Math.cos(Math.PI * clamp(t, 0, 1)) - 1) / 2;
export const easeOutElastic = (t) => {
  t = clamp(t, 0, 1);
  if (t === 0 || t === 1) return t;
  const p = 0.35;
  return Math.pow(2, -10 * t) * Math.sin(((t - p / 4) * TAU) / p) + 1;
};

// Deterministic RNG (mulberry32) -------------------------------------------------
export class Rng {
  constructor(seed = 1) {
    this.seed = (seed >>> 0) || 1;
    this.s = this.seed;
  }
  next() {
    this.s = (this.s + 0x6d2b79f5) >>> 0;
    let t = this.s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  range(a, b) {
    return a + this.next() * (b - a);
  }
  int(a, b) {
    return Math.floor(this.range(a, b + 1));
  }
  chance(p) {
    return this.next() < p;
  }
  pick(arr) {
    return arr[Math.floor(this.next() * arr.length)];
  }
  shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(this.next() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }
  weighted(entries) {
    // entries: [{w, ...}]
    let total = 0;
    for (const e of entries) total += e.w;
    let r = this.next() * total;
    for (const e of entries) {
      r -= e.w;
      if (r <= 0) return e;
    }
    return entries[entries.length - 1];
  }
}

export function seedFromString(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

// Colours -----------------------------------------------------------------------
const hexCache = new Map();
export function hexToRgb(hex) {
  if (hexCache.has(hex)) return hexCache.get(hex);
  let h = hex.replace('#', '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  const n = parseInt(h, 16);
  const rgb = { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
  hexCache.set(hex, rgb);
  return rgb;
}

export function rgba(hex, a) {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r},${g},${b},${a})`;
}

export function mixColor(a, b, t) {
  const c1 = hexToRgb(a);
  const c2 = hexToRgb(b);
  const r = Math.round(lerp(c1.r, c2.r, t));
  const g = Math.round(lerp(c1.g, c2.g, t));
  const bl = Math.round(lerp(c1.b, c2.b, t));
  return `rgb(${r},${g},${bl})`;
}

export function shade(hex, amt) {
  const { r, g, b } = hexToRgb(hex);
  const f = (v) => clamp(Math.round(v + amt), 0, 255);
  return `rgb(${f(r)},${f(g)},${f(b)})`;
}

export function formatTime(sec) {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function formatNum(n) {
  n = Math.round(n);
  if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
  if (n >= 10000) return (n / 1000).toFixed(1) + 'k';
  return String(n);
}

export function weightedPick(rng, list, weightFn = (e) => e.weight ?? 1) {
  let total = 0;
  for (const e of list) total += Math.max(0, weightFn(e));
  if (total <= 0) return list[0];
  let r = rng.next() * total;
  for (const e of list) {
    r -= Math.max(0, weightFn(e));
    if (r <= 0) return e;
  }
  return list[list.length - 1];
}

export function unique(list) {
  return Array.from(new Set(list));
}

export function pointInRect(px, py, x, y, w, h) {
  return px >= x && py >= y && px <= x + w && py <= y + h;
}

export function pointInCircle(px, py, cx, cy, r) {
  return dist2(px, py, cx, cy) <= r * r;
}

export function circleOverlapsCircle(ax, ay, ar, bx, by, br) {
  return dist2(ax, ay, bx, by) <= (ar + br) * (ar + br);
}

export function clampText(ctx, text, maxWidth) {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let t = text;
  while (t.length > 1 && ctx.measureText(t + '…').width > maxWidth) t = t.slice(0, -1);
  return t + '…';
}
