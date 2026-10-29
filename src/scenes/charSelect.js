// ---------------------------------------------------------------------------
// charSelect.js — the Sorcerer File. The playable character is the player's
// original sorcerer; Yuji, Sukuna, Gojo and Megumi are NPCs/trainers and are
// hidden from the playable roster. They appear only inside a scrollable
// trainer codex frame (hidden until opened), never as selectable cards.
// ---------------------------------------------------------------------------

import { CHARACTERS } from '../data/characters.js';
import { text, panel, wrapText, screenShade, ScrollableMenu } from '../ui/ui.js';
import { drawHumanoid, humanoidPose } from '../render/sprites.js';
import { input } from '../core/input.js';
import { TECHNIQUES, TRAINERS, progressionFor } from '../data/techniques.js';

export class CharSelectScene {
  constructor(game, params = {}) {
    this.game = game;
    this.params = params;
    this.canPause = false;
    this.t = 0;
    this.showCodex = false; // NPC trainer characters stay hidden until asked for
    this.codex = null;
  }

  enter() {
    const ids = ['yuji', 'sukuna', 'gojo', 'megumi', 'nobara'];
    this.codex = new ScrollableMenu(
      ids.map((id) => {
        const c = CHARACTERS[id];
        return { label: `${c.name} — ${c.title}`, sub: 'NPC · trainer / sparring opponent · not playable', color: c.look?.accent || '#9fc0ff', charId: id };
      }),
      { rowH: 30, gap: 4, viewportH: 170 }
    );
  }

  update(dt) {
    this.t += dt;
    if (input.wasPressed('help')) this.showCodex = !this.showCodex;
    if (this.showCodex) {
      const it = this.codex.update(dt) || this.codex.handleTap(70, 108, 360);
      if (it) this.game.audio.play('ui');
      if (input.wasPressed('pause')) this.showCodex = false;
      return;
    }
    if (input.wasPressed('confirm') || input.wasPressed('attack') || input.wasPressed('interact')) {
      this.game.audio.play('pickup');
      if (!this.game.save.data.custom?.created) { this.game.engine.go('create', { from: 'charSelect' }, 0.3); return; }
      this.game.engine.go('hub', { fresh: true }, 0.3);
    }
    if (input.pointer.pressed && input.pointer.y > 300) {
      this.game.audio.play('pickup');
      this.game.engine.go('hub', { fresh: true }, 0.3);
    }
    if (input.wasPressed('pause')) this.game.engine.go(this.params.from === 'hub' ? 'hub' : 'title', {}, 0.25);
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
    text(ctx, 'YOUR SORCERER', 320, 40, { size: 16, align: 'center', color: '#f2eef8' });
    text(ctx, 'One original sorcerer. Technique assigned once, progression earned from NPC trainers.', 320, 56, { size: 7, align: 'center', color: '#93a0b8' });

    if (!c.created) {
      panel(ctx, 120, 90, 400, 130, { fill: 'rgba(8,10,16,0.95)', border: '#ffd166', title: 'NO SORCERER YET' });
      wrapText(ctx, 'Create your sorcerer first: name, appearance, and a randomly assigned innate technique that persists between sessions.', 140, 122, 360, 10, { size: 8, color: '#d8e0ee', bold: false });
      text(ctx, 'ENTER — create', 320, 190, { size: 9, align: 'center', color: '#7cf0a0' });
      return;
    }

    // custom sorcerer card (existing rendering system, custom look)
    panel(ctx, 60, 74, 200, 190, { fill: 'rgba(24,20,34,0.98)', border: tech?.color || '#ff2a4a', inner: false });
    const pose = humanoidPose('idle', this.t, { facingX: 1 });
    drawHumanoid(ctx, { x: 160, y: 205, look: c.look, facingX: 1, pose, t: this.t, scale: 2.6, alpha: 1, flash: 0, aura: 0.35, auraColor: tech?.color });
    text(ctx, c.name, 160, 232, { size: 10, align: 'center', color: '#ffffff' });
    text(ctx, tech?.name || '', 160, 246, { size: 7, align: 'center', color: tech?.color || '#a79bff' });
    text(ctx, `MASTERY ${c.mastery}`, 160, 258, { size: 6, align: 'center', color: '#ffd166' });

    // progression frame (scrollable list of the technique's unlock path)
    panel(ctx, 280, 74, 300, 190, { fill: 'rgba(8,10,16,0.94)', border: '#2c3448', title: 'TECHNIQUE PROGRESSION' });
    let y = 98;
    const t = tech;
    if (t) {
      t.abilities.forEach((a, i) => {
        const unlocked = c.unlockedAbilities.includes(a.id);
        text(ctx, `${unlocked ? '✔' : '—'} [${i + 1}] ${a.name}`, 292, y, { size: 7, color: unlocked ? '#7cf0a0' : '#5b6478' });
        y += 11;
      });
      text(ctx, `${c.ultimateUnlocked ? '✔' : '—'} [R] ${t.ultimate?.name || '—'}`, 292, y, { size: 7, color: c.ultimateUnlocked ? '#ffb03a' : '#5b6478' });
      y += 11;
      if (t.domain) {
        text(ctx, `${c.domainUnlocked ? '✔' : '—'} [F] ${t.domain.name.replace('Domain Expansion: ', '')}`, 292, y, { size: 7, color: c.domainUnlocked ? '#c9a2ff' : '#5b6478' });
        y += 11;
      }
      const next = progressionFor(c.techniqueId).find((step) =>
        step.kind === 'ability' ? !c.unlockedAbilities.includes(step.id) : step.kind === 'ultimate' ? !c.ultimateUnlocked : !c.domainUnlocked);
      wrapText(ctx, next ? `Next unlock: ${next.name} — win a spar or finish a lesson with any trainer (Yuji · Sukuna · Gojo · Megumi).` : 'Technique complete. Mastery still grows with every trainer win.', 292, y + 8, 276, 9, { size: 6, color: '#9fd8ff', bold: false });
    }

    text(ctx, 'ENTER — to Jujutsu High    H — trainer codex (NPCs)', 320, 336, { size: 7, align: 'center', color: '#7cf0a0' });
    text(ctx, 'ESC back', 320, 350, { size: 6, align: 'center', color: '#6f7a92' });

    if (this.showCodex) {
      screenShade(ctx, 0.78);
      panel(ctx, 56, 60, 528, 250, { fill: 'rgba(8,10,18,0.99)', border: '#9fc0ff', title: 'TRAINERS & NPCs — NOT PLAYABLE (scroll)' });
      this.codex.draw(ctx, 70, 92, 360);
      const sel = this.codex.items[this.codex.index];
      const ch = sel ? CHARACTERS[sel.charId] : null;
      if (ch) {
        panel(ctx, 446, 92, 124, 180, { fill: 'rgba(14,16,26,0.96)', border: '#3a3f52', inner: false });
        const p2 = humanoidPose('idle', this.t, { facingX: 1 });
        drawHumanoid(ctx, { x: 508, y: 180, look: ch.look, facingX: 1, pose: p2, t: this.t, scale: 2, alpha: 1, flash: 0, aura: 0.3, auraColor: ch.look.accent });
        text(ctx, ch.name, 508, 200, { size: 7, align: 'center', color: '#ffffff' });
        wrapText(ctx, `${ch.title}. ${(TRAINERS[sel.charId]?.lessonName || 'Sparring partner')} — find them at Jujutsu High.`, 454, 222, 108, 8, { size: 5, color: '#b9c4d8', bold: false });
      }
      text(ctx, 'H / ESC to close · wheel or ↑↓ to scroll', 320, 300, { size: 6, align: 'center', color: '#93a0b8' });
    }
  }
}
