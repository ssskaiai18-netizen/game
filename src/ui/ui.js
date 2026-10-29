// ---------------------------------------------------------------------------
// ui.js — pixel UI widgets: panels, bars, text, buttons, vertical menus,
// card rows, toasts and modals. All coordinates are in the 640x360 design
// space. Everything is immediate-mode and works with mouse, keyboard and touch.
// ---------------------------------------------------------------------------

import { clamp, lerp, rgba } from '../core/util.js';
import { input } from '../core/input.js';

export const FONT = '"Courier New", ui-monospace, monospace';

export function text(ctx, str, x, y, opts = {}) {
  const size = opts.size || 8;
  ctx.font = `${opts.bold === false ? '' : 'bold '}${size}px ${FONT}`;
  ctx.textAlign = opts.align || 'left';
  ctx.textBaseline = opts.baseline || 'alphabetic';
  if (opts.shadow !== false) {
    ctx.fillStyle = 'rgba(0,0,0,0.75)';
    ctx.fillText(str, x + 1, y + 1);
  }
  ctx.fillStyle = opts.color || '#e8eef8';
  ctx.fillText(str, x, y);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
}

export function wrapText(ctx, str, x, y, maxWidth, lineHeight = 9, opts = {}) {
  const words = String(str).split(' ');
  let line = '';
  let yy = y;
  const size = opts.size || 8;
  ctx.font = `${opts.bold === false ? '' : 'bold '}${size}px ${FONT}`;
  for (const w of words) {
    const test = line ? line + ' ' + w : w;
    if (ctx.measureText(test).width > maxWidth && line) {
      text(ctx, line, x, yy, { ...opts, size });
      line = w;
      yy += lineHeight;
    } else line = test;
  }
  if (line) text(ctx, line, x, yy, { ...opts, size });
  return yy + lineHeight - y;
}

export function panel(ctx, x, y, w, h, opts = {}) {
  const fill = opts.fill || 'rgba(10,12,20,0.92)';
  const border = opts.border || '#3a4560';
  ctx.fillStyle = fill;
  ctx.fillRect(x, y, w, h);
  // pixel border corners
  ctx.fillStyle = border;
  ctx.fillRect(x, y, w, 1);
  ctx.fillRect(x, y + h - 1, w, 1);
  ctx.fillRect(x, y, 1, h);
  ctx.fillRect(x + w - 1, y, 1, h);
  if (opts.inner !== false) {
    ctx.fillStyle = 'rgba(255,255,255,0.05)';
    ctx.fillRect(x + 1, y + 1, w - 2, 1);
  }
  if (opts.title) {
    text(ctx, opts.title, x + 6, y + 11, { size: 8, color: opts.titleColor || '#9fc0ff' });
  }
}

export function bar(ctx, x, y, w, h, frac, opts = {}) {
  const f = clamp(frac, 0, 1);
  ctx.fillStyle = opts.bg || 'rgba(8,10,16,0.9)';
  ctx.fillRect(x, y, w, h);
  const fg = opts.fg || '#ff4d6d';
  ctx.fillStyle = fg;
  ctx.fillRect(x + 1, y + 1, Math.max(0, (w - 2) * f), h - 2);
  if (opts.gloss !== false) {
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    ctx.fillRect(x + 1, y + 1, Math.max(0, (w - 2) * f), 1);
  }
  if (opts.border !== false) {
    ctx.strokeStyle = opts.border || 'rgba(255,255,255,0.22)';
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
  }
  if (opts.marker !== undefined) {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(x + 1 + (w - 2) * clamp(opts.marker, 0, 1), y, 1, h);
  }
}

export function cooldownIcon(ctx, x, y, r, opts = {}) {
  const { label, sub, frac, ready, color = '#9fc0ff', key, highlight } = opts;
  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = ready ? 'rgba(20,26,40,0.92)' : 'rgba(12,14,22,0.92)';
  ctx.fill();
  ctx.strokeStyle = highlight ? '#ffffff' : ready ? color : 'rgba(120,130,150,0.5)';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  if (frac !== undefined && frac > 0) {
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.arc(x, y, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * clamp(frac, 0, 1));
    ctx.closePath();
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fill();
  }
  if (label) {
    text(ctx, label, x, y + 3, { size: 8, align: 'center', color: ready ? color : '#6a7488' });
  }
  if (sub) {
    text(ctx, sub, x, y + r + 8, { size: 6, align: 'center', color: '#93a0b8' });
  }
  if (key) {
    text(ctx, key, x - r, y - r - 2, { size: 6, color: '#c9d3e0' });
  }
  ctx.restore();
}

export class VerticalMenu {
  constructor(items = [], opts = {}) {
    this.items = items;
    this.index = 0;
    this.opts = opts;
    this.scroll = 0;
    this.time = 0;
  }
  setItems(items) {
    this.items = items;
    this.index = clamp(this.index, 0, Math.max(0, items.length - 1));
  }
  update(dt) {
    this.time += dt;
    let activated = null;
    const enabled = this.items.filter((i) => !i.disabled);
    if (!enabled.length) return null;
    if (input.wasPressed('down') || input.wasPressed('right')) {
      this.move(1);
      this.game?.audio?.play?.('ui');
    }
    if (input.wasPressed('up') || input.wasPressed('left')) this.move(-1);
    if (input.wasPressed('confirm') || input.wasPressed('attack') || input.wasPressed('interact')) {
      const it = this.items[this.index];
      if (it && !it.disabled) activated = it;
    }
    return activated;
  }
  move(dir) {
    let i = this.index;
    for (let n = 0; n < this.items.length; n++) {
      i = (i + dir + this.items.length) % this.items.length;
      if (!this.items[i].disabled) break;
    }
    this.index = i;
  }
  draw(ctx, x, y, w, opts = {}) {
    const rowH = opts.rowH || 26;
    const gap = opts.gap ?? 4;
    this.items.forEach((it, i) => {
      const ry = y + i * (rowH + gap);
      const active = i === this.index;
      const hover = this.pointerHover(x, ry, w, rowH);
      if (hover !== null && hover !== this.index) this.index = hover;
      const hi = active || hover === i;
      panel(ctx, x, ry, w, rowH, {
        fill: hi ? 'rgba(30,40,64,0.96)' : 'rgba(12,14,22,0.9)',
        border: it.disabled ? '#2a3040' : hi ? (it.color || '#9fc0ff') : '#39415a',
        inner: false,
      });
      if (hi) {
        ctx.fillStyle = it.color || '#9fc0ff';
        ctx.fillRect(x, ry, 2, rowH);
      }
      const labelColor = it.disabled ? '#5b6478' : it.color || '#e8eef8';
      text(ctx, it.label, x + 10, ry + 12, { size: opts.labelSize || 9, color: labelColor });
      if (it.sub) text(ctx, it.sub, x + 10, ry + 21, { size: 6, color: it.disabled ? '#4a5264' : '#93a0b8' });
      if (it.right) text(ctx, it.right, x + w - 8, ry + 15, { size: 7, align: 'right', color: '#c9d3e0' });
      if (hi) text(ctx, '▶', x + w - 12, ry + 12, { size: 7, align: 'right', color: it.color || '#9fc0ff' });
    });
    return y + this.items.length * (rowH + gap);
  }
  pointerHover(x, y, w, h) {
    if (!input.mouse.x) return null;
    const px = input.mouse.x;
    const py = input.mouse.y;
    if (px >= x && px <= x + w && py >= y && py <= y + h) return this.index;
    return null;
  }
  /** separate absolute-layout hit test used by scenes that lay menus out manually */
  handleTap(x, y, w, rowH, gap) {
    if (!input.pointer.pressed) return null;
    const px = input.pointer.x;
    const py = input.pointer.y;
    for (let i = 0; i < this.items.length; i++) {
      const ry = y + i * (rowH + gap);
      if (px >= x && px <= x + w && py >= ry && py <= ry + rowH) {
        const it = this.items[i];
        if (it.disabled) return null;
        this.index = i;
        return it;
      }
    }
    return null;
  }
}


// ---------------------------------------------------------------------------
// ScrollableMenu — a VerticalMenu inside a fixed-height, clipped frame.
// Long lists (taming, trainers, codex, fusion pairs) scroll with the wheel,
// touch drag, and by following the keyboard selection. A scrollbar shows
// position; content outside the frame is never drawn or clickable.
// ---------------------------------------------------------------------------
export class ScrollableMenu {
  constructor(items = [], opts = {}) {
    this.menu = new VerticalMenu(items);
    this.rowH = opts.rowH || 24;
    this.gap = opts.gap ?? 4;
    this.viewportH = opts.viewportH || 200;
    this.scroll = 0;
  }
  get items() { return this.menu.items; }
  get index() { return this.menu.index; }
  set index(v) { this.menu.index = v; }
  get pitch() { return this.rowH + this.gap; }
  get visible() { return Math.max(1, Math.floor((this.viewportH + this.gap) / this.pitch)); }
  get maxScroll() { return Math.max(0, this.items.length - this.visible); }

  update(dt) {
    const picked = this.menu.update(dt);
    const wheel = input.consumeWheel ? input.consumeWheel() : 0;
    if (wheel) this.scroll = clamp(this.scroll + wheel, 0, this.maxScroll);
    if (input.pointer.pressed && input.pointer.y !== undefined) this._dragY = input.pointer.y;
    // keep the keyboard selection visible
    const idx = this.menu.index;
    if (idx < this.scroll) this.scroll = idx;
    if (idx >= this.scroll + this.visible) this.scroll = idx - this.visible + 1;
    this.scroll = clamp(this.scroll, 0, this.maxScroll);
    return picked;
  }

  handleTap(x, y, w) {
    if (!input.pointer.pressed) return null;
    const px = input.pointer.x;
    const py = input.pointer.y;
    if (px < x || px > x + w || py < y || py > y + this.viewportH) return null;
    for (let vi = 0; vi < this.visible; vi++) {
      const i = this.scroll + vi;
      if (i >= this.items.length) break;
      const ry = y + vi * this.pitch;
      if (py >= ry && py <= ry + this.rowH) {
        const it = this.items[i];
        if (it.disabled) return null;
        this.menu.index = i;
        return it;
      }
    }
    return null;
  }

  draw(ctx, x, y, w, opts = {}) {
    const h = this.viewportH;
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, w, h);
    ctx.clip();
    // draw a translated copy of the menu: temporarily render only the window.
    const full = this.menu.items;
    const windowItems = full.slice(this.scroll, this.scroll + this.visible);
    const savedIndex = this.menu.index;
    const tmp = new VerticalMenu(windowItems);
    tmp.index = savedIndex - this.scroll;
    tmp.draw(ctx, x, y, w, { rowH: this.rowH, gap: this.gap });
    ctx.restore();
    // scrollbar
    if (this.maxScroll > 0) {
      const trackH = h - 4;
      const thumbH = Math.max(14, trackH * (this.visible / Math.max(1, full.length)));
      const thumbY = y + 2 + (trackH - thumbH) * (this.scroll / this.maxScroll);
      ctx.fillStyle = 'rgba(255,255,255,0.12)';
      ctx.fillRect(x + w - 5, y + 2, 3, trackH);
      ctx.fillStyle = '#8f7bff';
      ctx.fillRect(x + w - 5, thumbY, 3, thumbH);
      text(ctx, '↕ scroll', x + w - 8, y + h + 9, { size: 5, align: 'right', color: '#6f7a92' });
    }
    if (opts.hint !== false) {
      text(ctx, `${Math.min(this.scroll + this.visible, full.length)}/${full.length}`, x, y + h + 9, { size: 5, color: '#6f7a92' });
    }
  }
}

export function cardRow(ctx, cards, layout, selected, time = 0) {
  const { x, y, w, h, gap = 10 } = layout;
  const cw = (w - gap * (cards.length - 1)) / cards.length;
  cards.forEach((c, i) => {
    const cx = x + i * (cw + gap);
    const active = i === selected;
    const lift = active ? -3 : 0;
    const col = c.color || '#9fc0ff';
    panel(ctx, cx, y + lift, cw, h, {
      fill: active ? 'rgba(26,32,50,0.98)' : 'rgba(10,12,20,0.94)',
      border: active ? col : '#333c52',
      inner: false,
    });
    ctx.globalAlpha = active ? 0.18 : 0.09;
    ctx.fillStyle = col;
    ctx.fillRect(cx + 1, y + lift + 1, cw - 2, 26);
    ctx.globalAlpha = 1;
    if (c.rarity) {
      text(ctx, c.rarity.toUpperCase(), cx + 6, y + lift + 12, { size: 6, color: col });
    }
    wrapText(ctx, c.title || c.label || '', cx + 8, y + lift + 30, cw - 16, 10, { size: 9, color: '#ffffff' });
    wrapText(ctx, c.desc || '', cx + 8, y + lift + 58, cw - 16, 9, { size: 7, color: '#b9c4d8', bold: false });
    if (c.cat) text(ctx, c.cat, cx + 6, y + lift + h - 8, { size: 6, color: '#8b98b0' });
    if (active) {
      ctx.fillStyle = col;
      ctx.fillRect(cx + cw / 2 - 8, y + lift + h - 4, 16, 2);
    }
  });
  return cw;
}

export function cardRowHit(cards, layout) {
  if (!input.pointer.pressed) return -1;
  const { x, y, w, h, gap = 10 } = layout;
  const cw = (w - gap * (cards.length - 1)) / cards.length;
  const px = input.pointer.x;
  const py = input.pointer.y;
  for (let i = 0; i < cards.length; i++) {
    const cx = x + i * (cw + gap);
    if (px >= cx && px <= cx + cw && py >= y - 4 && py <= y + h) return i;
  }
  return -1;
}

export class Toasts {
  constructor() {
    this.items = [];
  }
  push(msg, opts = {}) {
    this.items.push({ msg, t: 0, life: opts.life || 2.4, color: opts.color || '#e8eef8' });
    if (this.items.length > 4) this.items.shift();
  }
  update(dt) {
    for (let i = this.items.length - 1; i >= 0; i--) {
      this.items[i].t += dt;
      if (this.items[i].t > this.items[i].life) this.items.splice(i, 1);
    }
  }
  draw(ctx) {
    this.items.forEach((it, i) => {
      const a = clamp(Math.min(it.t * 4, (it.life - it.t) * 2), 0, 1);
      ctx.globalAlpha = a;
      ctx.font = `bold 8px ${FONT}`;
      const w = ctx.measureText(it.msg).width + 16;
      panel(ctx, 320 - w / 2, 38 + i * 15, w, 13, { fill: 'rgba(10,12,20,0.92)', border: it.color, inner: false });
      text(ctx, it.msg, 320, 47 + i * 15, { size: 8, align: 'center', color: it.color });
      ctx.globalAlpha = 1;
    });
  }
}

export class Modal {
  constructor() {
    this.active = false;
    this.title = '';
    this.lines = [];
    this.buttons = [];
    this.menu = new VerticalMenu([]);
    this.onClose = null;
  }
  open({ title, lines, buttons, onClose }) {
    this.active = true;
    this.title = title || '';
    this.lines = lines || [];
    this.menu = new VerticalMenu(buttons || [{ label: 'Close' }]);
    this.onClose = onClose || null;
  }
  close() {
    this.active = false;
    this.onClose?.();
  }
  update(dt) {
    if (!this.active) return false;
    if (input.wasPressed('pause')) {
      this.close();
      return false;
    }
    const it = this.menu.update(dt) || this.menu.handleTap(120, 210, 400, 24, 4);
    if (it) {
      if (it.onClick) it.onClick();
      else this.close();
      return false;
    }
    return true;
  }
  draw(ctx) {
    if (!this.active) return;
    ctx.fillStyle = 'rgba(4,6,12,0.7)';
    ctx.fillRect(0, 0, 640, 360);
    panel(ctx, 110, 120, 420, 130, { fill: 'rgba(12,15,24,0.98)', border: '#5b8cff', title: this.title });
    let y = 148;
    for (const line of this.lines) {
      y += wrapText(ctx, line, 126, y, 388, 10, { size: 8, color: '#d8e0ee', bold: false });
    }
    this.menu.draw(ctx, 120, 206, 400, { rowH: 24 });
  }
}

export function keyHint(ctx, x, y, key, label, opts = {}) {
  ctx.font = `bold 7px ${FONT}`;
  const kw = Math.max(12, ctx.measureText(key).width + 6);
  panel(ctx, x, y - 8, kw, 11, { fill: 'rgba(30,36,52,0.95)', border: '#4a5570', inner: false });
  text(ctx, key, x + kw / 2, y, { size: 7, align: 'center', color: '#dfe6f2' });
  text(ctx, label, x + kw + 5, y, { size: 7, color: '#a9b4c8', bold: false });
  return kw + 5 + ctx.measureText(label).width;
}

export function screenShade(ctx, alpha = 0.55) {
  ctx.fillStyle = `rgba(4,6,12,${alpha})`;
  ctx.fillRect(0, 0, 640, 360);
}

export function gradientFade(ctx, x, y, w, h, color = '#05060c', dir = 'up') {
  const g = ctx.createLinearGradient(x, y, x, y + h);
  if (dir === 'up') {
    g.addColorStop(0, rgba(color, 0));
    g.addColorStop(1, rgba(color, 0.92));
  } else {
    g.addColorStop(0, rgba(color, 0.92));
    g.addColorStop(1, rgba(color, 0));
  }
  ctx.fillStyle = g;
  ctx.fillRect(x, y, w, h);
}
