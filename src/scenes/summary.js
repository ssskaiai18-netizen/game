// ---------------------------------------------------------------------------
// summary.js — run summary (victory or defeat) with stats, rewards, unlocks
// and the way back to the hub.
// ---------------------------------------------------------------------------

import { text, panel, wrapText, VerticalMenu, screenShade, bar, FONT } from '../ui/ui.js';
import { input } from '../core/input.js';
import { CHARACTERS } from '../data/characters.js';
import { formatNum, clamp } from '../core/util.js';

export class SummaryScene {
  constructor(game, params = {}) {
    this.game = game;
    this.params = params;
    this.summary = params.summary || null;
    this.canPause = false;
    this.t = 0;
    this.menu = new VerticalMenu([
      { label: 'Return to Jujutsu High', color: '#7cf0a0', onClick: () => this.goHub() },
      {
        label: 'Retry this arc',
        color: '#9fc0ff',
        onClick: () => this.retry(),
      },
      { label: 'Title screen', color: '#9aa3b2', onClick: () => this.game.engine.go('title', {}, 0.35) },
    ]);
  }

  enter() {
    this.audio();
  }

  audio() {
    setTimeout(() => {
      this.game.audio.play(this.summary?.victory ? 'victory' : 'defeat');
    }, 120);
  }

  goHub() {
    this.game.engine.go('hub', { fromRun: true }, 0.45);
  }

  retry() {
    const s = this.summary;
    if (!s) return this.goHub();
    this.game.engine.go('dungeon', {
      arcIndex: s.arcIndex ?? 0,
      difficultyId: s.difficultyId || 'normal',
      charId: s.charId,
    }, 0.45);
  }

  update(dt) {
    this.t += dt;
    const it = this.menu.update(dt) || this.menu.handleTap(200, 292, 240, 22, 4);
    if (it) {
      this.game.audio.play('ui');
      it.onClick?.();
    }
  }

  draw(ctx) {
    const s = this.summary;
    ctx.fillStyle = '#05060c';
    ctx.fillRect(0, 0, 640, 360);
    // backdrop glow
    const g = ctx.createRadialGradient(320, 180, 20, 320, 180, 320);
    g.addColorStop(0, s?.victory ? 'rgba(60,20,80,0.5)' : 'rgba(80,10,20,0.45)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 640, 360);
    // falling embers
    for (let i = 0; i < 30; i++) {
      const x = (i * 71 + this.t * 18) % 640;
      const y = (this.t * 40 + i * 33) % 360;
      ctx.globalAlpha = 0.12 + (i % 4) * 0.05;
      ctx.fillStyle = s?.victory ? '#b06bff' : '#ff2a4a';
      ctx.fillRect(x, y, 2, 2);
    }
    ctx.globalAlpha = 1;

    if (!s) {
      text(ctx, 'No run data', 320, 180, { size: 10, align: 'center' });
      return;
    }
    const win = s.victory;
    text(ctx, win ? 'ARC CLEARED' : 'YOU DIED', 320, 46, { size: 26, align: 'center', color: win ? '#7cf0a0' : '#ff2a4a' });
    text(ctx, `${s.charName} — ${s.arcName}  ·  ${s.difficulty}`, 320, 64, { size: 8, align: 'center', color: '#c9d3e0' });

    panel(ctx, 44, 74, 258, 204, { fill: 'rgba(10,12,20,0.94)', border: '#39415a', title: 'COMBAT' });
    const rows = [
      ['Rooms cleared', `${s.rooms} / ${s.totalRooms}`],
      ['Enemies defeated', s.kills],
      ['Bosses defeated', s.bosses],
      ['Total damage', formatNum(s.damage)],
      ['Highest single hit', formatNum(s.highestHit)],
      ['Black Flash', `${s.bfSuccess} / ${s.bfAttempts}`],
      ['Techniques used', s.techniques],
      ['Ultimates used', s.ults],
      ['Domains used', s.domains],
      ['Summon damage', formatNum(s.summons)],
    ];
    rows.forEach(([k, v], i) => {
      const y = 98 + i * 17;
      text(ctx, k, 58, y, { size: 7, color: '#8b98b0' });
      text(ctx, `${v}`, 288, y, { size: 8, align: 'right', color: '#e8eef8' });
    });

    panel(ctx, 312, 74, 284, 204, { fill: 'rgba(10,12,20,0.94)', border: '#39415a', title: 'REWARDS' });
    text(ctx, `Score`, 326, 100, { size: 8, color: '#ffd166' });
    text(ctx, `${s.score}`, 584, 100, { size: 12, align: 'right', color: '#ffffff' });
    text(ctx, `Tribute earned`, 326, 118, { size: 7, color: '#8b98b0' });
    text(ctx, `+${s.tribute} 呪`, 584, 118, { size: 8, align: 'right', color: '#ffd166' });
    text(ctx, 'Run upgrades', 326, 140, { size: 7, color: '#8b98b0' });
    wrapText(ctx, s.upgrades.length ? s.upgrades.join(', ') : 'None', 326, 152, 258, 9, { size: 6, color: '#cfd8e6', bold: false });
    if (s.unlocks && s.unlocks.length) {
      text(ctx, 'PERMANENT UNLOCKS', 326, 196, { size: 7, color: '#7cf0a0' });
      wrapText(ctx, s.unlocks.join(' · '), 326, 208, 258, 9, { size: 6, color: '#b9f0c8', bold: false });
    }
    // high score rank
    const hs = this.game.save.data.highScores;
    const idx = hs.findIndex((e) => e.score === s.score && e.char === s.charId);
    if (idx >= 0) {
      text(ctx, `Local high score rank #${idx + 1}`, 584, 266, { size: 7, align: 'right', color: '#ffb03a' });
    }
    this.menu.draw(ctx, 200, 288, 240, { rowH: 22, gap: 3 });
    text(ctx, 'Progress is saved automatically.', 320, 352, { size: 6, align: 'center', color: '#6f7a92' });
  }
}
