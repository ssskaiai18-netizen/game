// ---------------------------------------------------------------------------
// create.js — sorcerer creation. The player is always an ORIGINAL sorcerer:
// a name, an appearance built on the existing humanoid renderer, and one
// randomly assigned innate technique that is rolled once and persisted.
// Yuji, Sukuna, Gojo and Megumi are never offered as playable characters.
// ---------------------------------------------------------------------------

import { text, panel, wrapText, ScrollableMenu } from '../ui/ui.js';
import { input } from '../core/input.js';
import { drawHumanoid, humanoidPose } from '../render/sprites.js';
import { TECHNIQUES, APPEARANCE_OPTIONS, NAME_SUGGESTIONS, ensureTechnique } from '../data/techniques.js';
import { clamp } from '../core/util.js';

const DARK_OF = { '#232a3a': '#171c28', '#1b2436': '#121a28', '#2a1a24': '#1a0f16', '#12141c': '#0b0d13', '#2a2230': '#1c1722', '#3a2a4a': '#241a30' };

export class CreateScene {
  constructor(game, params = {}) {
    this.game = game;
    this.params = params;
    this.canPause = false;
    this.t = 0;
    this.row = 0;
    this.nameIdx = 0;
  }

  enter() {
    const save = this.game.save;
    // The technique is assigned the first time this screen is reached and
    // persisted immediately — reopening the game can never reroll it.
    ensureTechnique(save);
    const c = save.data.custom;
    if (!c.name) c.name = NAME_SUGGESTIONS[0];
    this.menu = new ScrollableMenu(
      APPEARANCE_OPTIONS.map((o, i) => ({
        label: o.label,
        sub: String(c.look[o.key]),
        color: '#9fc0ff',
        onClick: () => { this.row = i; this.cycle(1); },
      })),
      { rowH: 24, gap: 3, viewportH: 150 }
    );
  }

  cycle(dir) {
    const save = this.game.save;
    const c = save.data.custom;
    const opt = APPEARANCE_OPTIONS[this.row];
    const vals = opt.values;
    let i = vals.indexOf(c.look[opt.key]);
    if (i < 0) i = 0;
    i = (i + dir + vals.length) % vals.length;
    c.look[opt.key] = vals[i];
    if (opt.syncDark) {
      c.look.topDark = DARK_OF[vals[i]] || c.look.topDark;
      c.look.topLight = vals[i];
    }
    save.save();
    this.game.audio.play('ui');
    this.enterMenuRefresh();
  }

  enterMenuRefresh() {
    if (!this.menu) return;
    const c = this.game.save.data.custom;
    this.menu.menu.setItems(APPEARANCE_OPTIONS.map((o, i) => ({
      label: o.label,
      sub: String(c.look[o.key]),
      color: '#9fc0ff',
      onClick: () => { this.row = i; this.cycle(1); },
    })));
  }

  update(dt) {
    this.t += dt;
    const save = this.game.save;
    const c = save.data.custom;
    // name typing (desktop) / suggestion cycling (touch-friendly)
    if (input.pointer.pressed && input.pointer.y > 56 && input.pointer.y < 78 && input.pointer.x > 400) {
      this.nameIdx = (this.nameIdx + 1) % NAME_SUGGESTIONS.length;
      c.name = NAME_SUGGESTIONS[this.nameIdx];
      save.save();
    }
    // keyboard name entry happens through keydown letters handled by engine input keys
    for (const code of input.pressedKeys || []) {
      if (/^Key[A-Z]$/.test(code) && c.name.length < 16) { c.name += code.slice(3).toLowerCase(); save.save(); }
      if (code === 'Space' && c.name.length < 16 && !c.name.endsWith(' ')) { c.name += ' '; save.save(); }
      if (code === 'Backspace') { c.name = c.name.slice(0, -1); save.save(); }
    }
    if (input.wasPressed('up')) this.row = (this.row - 1 + APPEARANCE_OPTIONS.length) % APPEARANCE_OPTIONS.length;
    if (input.wasPressed('down')) this.row = (this.row + 1) % APPEARANCE_OPTIONS.length;
    if (input.wasPressed('left')) this.cycle(-1);
    if (input.wasPressed('right')) this.cycle(1);
    if (this.menu) {
      this.menu.index = this.row;
      const wheel = input.consumeWheel ? input.consumeWheel() : 0;
      if (wheel) this.menu.scroll = clamp(this.menu.scroll + wheel, 0, this.menu.maxScroll);
      if (this.row < this.menu.scroll) this.menu.scroll = this.row;
      if (this.row >= this.menu.scroll + this.menu.visible) this.menu.scroll = this.row - this.menu.visible + 1;
      const it = this.menu.handleTap(44, 136, 250);
      if (it) { this.row = this.menu.index; it.onClick?.(); }
    }
    if (input.wasPressed('confirm')) this.finish();
    if (input.pointer.pressed && input.pointer.x > 430 && input.pointer.y > 300) this.finish();
  }

  finish() {
    const save = this.game.save;
    const c = save.data.custom;
    c.name = (c.name || '').trim() || 'Sorcerer';
    c.name = c.name[0].toUpperCase() + c.name.slice(1);
    c.created = true;
    save.save();
    this.game.selectedChar = 'custom';
    this.game.audio.play('pickup');
    this.game.toast(`${c.name} — ${TECHNIQUES[c.techniqueId]?.name || 'Technique'} awakened`, { color: '#a79bff', life: 4 });
    this.game.engine.go('hub', { fresh: true }, 0.35);
  }

  draw(ctx) {
    const save = this.game.save;
    const c = save.data.custom;
    const tech = TECHNIQUES[c.techniqueId];
    const g = ctx.createLinearGradient(0, 0, 0, 360);
    g.addColorStop(0, '#0a0a16');
    g.addColorStop(1, '#10121c');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 640, 360);
    text(ctx, 'CREATE YOUR SORCERER', 320, 34, { size: 16, align: 'center', color: '#f2eef8' });
    text(ctx, 'An original sorcerer. The four great names of this school are your teachers — never your character.', 320, 50, { size: 6, align: 'center', color: '#93a0b8' });

    // name
    panel(ctx, 36, 62, 250, 46, { fill: 'rgba(8,10,16,0.94)', border: '#5b8cff', title: 'NAME' });
    text(ctx, c.name || 'Sorcerer', 46, 92, { size: 13, color: '#ffffff' });
    text(ctx, 'type to edit · tap for a suggestion', 46, 104, { size: 5, color: '#6f7a92' });

    // appearance (scrollable frame)
    panel(ctx, 36, 116, 268, 176, { fill: 'rgba(8,10,16,0.94)', border: '#5b8cff', title: 'APPEARANCE  (↑↓ select · ←→ change · scroll)' });
    this.menu?.draw(ctx, 44, 136, 250);

    // preview
    panel(ctx, 320, 62, 130, 230, { fill: 'rgba(8,10,16,0.94)', border: tech?.color || '#5b8cff', title: 'PREVIEW' });
    const pose = humanoidPose('idle', this.t, { facingX: 1 });
    drawHumanoid(ctx, { x: 385, y: 250, look: c.look, facingX: 1, pose, t: this.t, scale: 3.2, alpha: 1, flash: 0, aura: 0.4, auraColor: tech?.color });
    text(ctx, c.name || 'Sorcerer', 385, 276, { size: 8, align: 'center', color: '#ffffff' });

    // technique (assigned once, persistent)
    panel(ctx, 466, 62, 138, 230, { fill: 'rgba(8,10,16,0.94)', border: tech?.color || '#5b8cff', title: 'INNATE TECHNIQUE' });
    if (tech) {
      text(ctx, tech.name, 534, 92, { size: 9, align: 'center', color: tech.color });
      wrapText(ctx, tech.desc, 476, 108, 118, 9, { size: 6, color: '#b9c4d8', bold: false });
      text(ctx, 'STARTING ABILITIES', 476, 196, { size: 6, color: '#ffd166' });
      tech.abilities.slice(0, 2).forEach((a, i) => {
        text(ctx, `[${i + 1}] ${a.name}`, 476, 212 + i * 12, { size: 6, color: '#9fd8ff' });
      });
      wrapText(ctx, 'Assigned by fate and saved forever. More of this technique unlocks through NPC training and sparring — never by rerolling.', 476, 244, 118, 8, { size: 5, color: '#8b98b0', bold: false });
    }

    panel(ctx, 430, 306, 174, 30, { fill: 'rgba(20,30,20,0.95)', border: '#7cf0a0', inner: false });
    text(ctx, 'BEGIN  ▶', 517, 325, { size: 10, align: 'center', color: '#7cf0a0' });
    text(ctx, 'ENTER to begin', 320, 350, { size: 6, align: 'center', color: '#6f7a92' });
  }
}
