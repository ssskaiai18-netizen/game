// ---------------------------------------------------------------------------
// charSelect.js — character selection with animated portraits and full kit
// preview. Locked characters show their unlock condition.
// ---------------------------------------------------------------------------

import { CHARACTERS, PLAYABLE_ORDER, UNLOCK_HINTS } from '../data/characters.js';
import { text, panel, wrapText, screenShade, FONT } from '../ui/ui.js';
import { drawHumanoid, humanoidPose } from '../render/sprites.js';
import { input } from '../core/input.js';
import { clamp, TAU } from '../core/util.js';

export class CharSelectScene {
  constructor(game, params = {}) {
    this.game = game;
    this.params = params;
    this.canPause = false;
    this.index = Math.max(0, PLAYABLE_ORDER.indexOf(game.selectedChar || 'yuji'));
    this.t = 0;
    this.animT = 0;
    this.mode = 'select';
    this.buttons = [];
  }

  enter() {
    this.index = Math.max(0, PLAYABLE_ORDER.indexOf(this.game.selectedChar || 'yuji'));
  }

  unlocked(id) {
    return this.game.save.hasCharacter(id);
  }

  update(dt) {
    this.t += dt;
    if (this.mode === 'detail') {
      if (input.wasPressed('pause')) this.mode = 'select';
      return;
    }
    if (input.wasPressed('left') || input.wasPressed('up')) this.index = (this.index - 1 + PLAYABLE_ORDER.length) % PLAYABLE_ORDER.length;
    if (input.wasPressed('right') || input.wasPressed('down')) this.index = (this.index + 1) % PLAYABLE_ORDER.length;
    // pointer taps on cards
    if (input.pointer.pressed) {
      const px = input.pointer.x;
      const py = input.pointer.y;
      const cardW = 108;
      const gap = 8;
      const totalW = PLAYABLE_ORDER.length * cardW + (PLAYABLE_ORDER.length - 1) * gap;
      const x0 = 320 - totalW / 2;
      for (let i = 0; i < PLAYABLE_ORDER.length; i++) {
        const cx = x0 + i * (cardW + gap);
        if (px >= cx && px <= cx + cardW && py >= 74 && py <= 240) {
          this.index = i;
          this.game.audio.play('ui');
        }
      }
      if (py > 300) {
        this.confirm();
      }
    }
    if (input.wasPressed('confirm') || input.wasPressed('attack') || input.wasPressed('interact')) this.confirm();
    if (input.wasPressed('pause')) this.game.engine.go(this.params.from === 'hub' ? 'hub' : 'title', {}, 0.25);
    if (input.wasPressed('help')) this.mode = this.mode === 'detail' ? 'select' : 'detail';
  }

  confirm() {
    const id = PLAYABLE_ORDER[this.index];
    if (!this.unlocked(id)) {
      this.game.audio.play('deny');
      this.game.toast(`Locked — ${UNLOCK_HINTS[id] || 'Progress the story.'}`, { color: '#ff8a8a' });
      return;
    }
    this.game.selectedChar = id;
    this.game.save.data.lastChar = id;
    this.game.save.save();
    this.game.audio.play('pickup');
    if (this.params.from === 'hub') this.game.engine.go('hub', { fromSelect: true }, 0.3);
    else this.game.engine.go('hub', { fresh: true }, 0.3);
  }

  draw(ctx) {
    const g = ctx.createLinearGradient(0, 0, 0, 360);
    g.addColorStop(0, '#0a0a16');
    g.addColorStop(1, '#10121c');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 640, 360);
    // ambient
    for (let i = 0; i < 22; i++) {
      const x = (i * 97 + this.t * 12) % 640;
      const y = (i * 53) % 360;
      ctx.globalAlpha = 0.09;
      ctx.fillStyle = '#6b5bff';
      ctx.fillRect(x, y, 2, 6);
    }
    ctx.globalAlpha = 1;

    text(ctx, 'SELECT YOUR SORCERER', 320, 40, { size: 16, align: 'center', color: '#f2eef8' });
    text(ctx, 'Each character has a unique kit, combo chain, ultimate and domain.', 320, 56, {
      size: 7,
      align: 'center',
      color: '#93a0b8',
    });

    const cardW = 108;
    const gap = 8;
    const totalW = PLAYABLE_ORDER.length * cardW + (PLAYABLE_ORDER.length - 1) * gap;
    const x0 = 320 - totalW / 2;
    PLAYABLE_ORDER.forEach((id, i) => {
      const c = CHARACTERS[id];
      const cx = x0 + i * (cardW + gap);
      const active = i === this.index;
      const locked = !this.unlocked(id);
      const lift = active ? -4 : 0;
      panel(ctx, cx, 74 + lift, cardW, 166, {
        fill: active ? 'rgba(24,20,34,0.98)' : 'rgba(10,12,20,0.9)',
        border: active ? (locked ? '#5b6478' : '#ff2a4a') : '#2c3448',
        inner: false,
      });
      // portrait
      ctx.save();
      ctx.beginPath();
      ctx.rect(cx + 1, 75 + lift, cardW - 2, 96);
      ctx.clip();
      const pg = ctx.createLinearGradient(cx, 75, cx, 170);
      pg.addColorStop(0, locked ? '#14161e' : 'rgba(60,30,60,0.7)');
      pg.addColorStop(1, 'rgba(10,10,18,0.9)');
      ctx.fillStyle = pg;
      ctx.fillRect(cx + 1, 75 + lift, cardW - 2, 96);
      const pose = humanoidPose(active ? 'idle' : 'idle', this.t + i, { facingX: 1, progress: 0.2 });
      drawHumanoid(ctx, {
        x: cx + cardW / 2,
        y: 158 + lift,
        look: c.look,
        facingX: 1,
        pose,
        t: this.t + i,
        scale: 2.4,
        alpha: locked ? 0.4 : 1,
        flash: 0,
        aura: active ? 0.35 : 0,
        auraColor: c.look.accent,
      });
      ctx.restore();
      if (locked) {
        ctx.fillStyle = 'rgba(6,8,14,0.6)';
        ctx.fillRect(cx + 1, 75 + lift, cardW - 2, 96);
        text(ctx, 'LOCKED', cx + cardW / 2, 126 + lift, { size: 9, align: 'center', color: '#8b98b0' });
      }
      text(ctx, c.name, cx + cardW / 2, 188 + lift, { size: 8, align: 'center', color: active ? '#ffffff' : '#c9d3e0' });
      text(ctx, c.title, cx + cardW / 2, 199 + lift, { size: 6, align: 'center', color: '#8b98b0' });
      // stat bars
      const stats = [
        ['HP', c.hp / 130],
        ['CE', c.ce / 130],
        ['PWR', c.power / 1.2],
      ];
      stats.forEach(([l, f], si) => {
        text(ctx, l, cx + 8, 214 + lift + si * 9, { size: 5, color: '#8b98b0' });
        panel(ctx, cx + 26, 208 + lift + si * 9, cardW - 36, 4, { fill: 'rgba(40,46,60,0.9)', border: '#2c3448', inner: false });
        ctx.fillStyle = si === 2 ? '#ff8a5c' : si === 1 ? '#4a7bff' : '#e8485f';
        ctx.fillRect(cx + 27, 209 + lift + si * 9, (cardW - 38) * clamp(f, 0, 1), 2);
      });
      if (locked) {
        text(ctx, UNLOCK_HINTS[id] || 'Locked', cx + cardW / 2, 240 + lift, { size: 5, align: 'center', color: '#ff8a8a' });
      }
    });

    // details for the selected character
    const c = CHARACTERS[PLAYABLE_ORDER[this.index]];
    const locked = !this.unlocked(PLAYABLE_ORDER[this.index]);
    panel(ctx, 40, 250, 560, 74, { fill: 'rgba(8,10,16,0.9)', border: '#2c3448', inner: false });
    text(ctx, c.blurb, 50, 262, { size: 7, color: '#cfd8e6', bold: false });
    const kit = [...c.abilities.map((a) => a.name), c.ultimate?.name, c.domain?.name].filter(Boolean);
    wrapText(ctx, `KIT: ${kit.join(' · ')}`, 50, 276, 540, 9, { size: 6, color: '#9fd8ff', bold: false });
    wrapText(ctx, `PASSIVE: ${c.passive}`, 50, 300, 540, 9, { size: 6, color: '#ffd166', bold: false });

    if (this.mode === 'detail') {
      screenShade(ctx, 0.72);
      panel(ctx, 100, 40, 440, 280, { fill: 'rgba(8,10,16,0.99)', border: '#9fc0ff', title: `${c.name.toUpperCase()} — FULL KIT` });
      let y = 64;
      c.basic.forEach((a, i) => {
        text(ctx, `Combo ${i + 1}: ${a.name}`, 116, y, { size: 7, color: '#ffd166' });
        text(ctx, `${a.dmg} dmg · ${Math.round((a.range || 20))} range`, 330, y, { size: 6, color: '#93a0b8' });
        y += 12;
      });
      c.abilities.forEach((a, i) => {
        text(ctx, `[${i + 1}] ${a.name} (${a.cost} CE, ${a.cd || 0}s)`, 116, y, { size: 7, color: '#9fd8ff' });
        y += 9;
        y += wrapText(ctx, a.desc, 124, y, 400, 9, { size: 6, color: '#b9c4d8', bold: false });
      });
      text(ctx, `[R] ${c.ultimate?.name || '—'}`, 116, y + 4, { size: 7, color: '#ffb03a' });
      y += 12;
      y += wrapText(ctx, c.ultimate?.desc || '', 124, y, 400, 9, { size: 6, color: '#b9c4d8', bold: false });
      text(ctx, `[F] ${c.domain?.name || 'No domain'}` , 116, y + 4, { size: 7, color: '#c9a2ff' });
      y += 12;
      y += wrapText(ctx, c.domain?.desc || 'This sorcerer has no Domain Expansion.', 124, y, 400, 9, { size: 6, color: '#b9c4d8', bold: false });
      text(ctx, 'H to close', 320, 312, { size: 6, align: 'center', color: '#93a0b8' });
      return;
    }

    text(ctx, locked ? `${UNLOCK_HINTS[PLAYABLE_ORDER[this.index]]}` : 'ENTER / CLICK TO SELECT', 320, 336, {
      size: 8,
      align: 'center',
      color: locked ? '#ff8a8a' : '#7cf0a0',
    });
    text(ctx, '← → choose · H full kit · ESC back', 320, 350, { size: 6, align: 'center', color: '#6f7a92' });
  }
}
