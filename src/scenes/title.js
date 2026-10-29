// ---------------------------------------------------------------------------
// title.js — title screen with animated cursed energy, menus, high scores,
// controls and save reset.
// ---------------------------------------------------------------------------

import { text, panel, VerticalMenu, screenShade, wrapText, FONT } from '../ui/ui.js';
import { input } from '../core/input.js';
import { CHARACTERS } from '../data/characters.js';
import { clamp, TAU } from '../core/util.js';

export class TitleScene {
  constructor(game) {
    this.game = game;
    this.canPause = false;
    this.t = 0;
    this.mode = 'main';
    this.menu = new VerticalMenu([]);
    this.subMenu = new VerticalMenu([]);
    this.particles = [];
    for (let i = 0; i < 40; i++) {
      this.particles.push({
        x: Math.random() * 640,
        y: Math.random() * 360,
        s: 0.5 + Math.random() * 2,
        v: 6 + Math.random() * 22,
        p: Math.random() * TAU,
      });
    }
    this.buildMain();
  }

  buildMain() {
    const save = this.game.save;
    const hasProgress = save.data.stats.runs > 0 || save.data.story.cleared.some(Boolean);
    this.menu = new VerticalMenu([
      { label: hasProgress ? 'Continue' : 'Enter Jujutsu High', sub: hasProgress ? 'Return to the courtyard' : 'Begin your first run', onClick: () => this.enterHub() },
      { label: 'Sorcerer File', sub: 'Your original sorcerer & trainer codex', onClick: () => this.game.engine.go(this.game.save.data.custom?.created ? 'charSelect' : 'create', { from: 'title' }) },
      { label: 'How to Play', sub: 'Controls & core systems', onClick: () => (this.mode = 'help') },
      { label: 'High Scores', sub: 'Local leaderboard', onClick: () => (this.mode = 'scores') },
      { label: save.data.settings.audio ? 'Audio: ON' : 'Audio: OFF', onClick: () => this.toggleAudio() },
      { label: 'Fullscreen', sub: 'Landscape recommended', onClick: () => this.game.toggleFullscreen() },
      { label: 'Reset Save', color: '#ff8a8a', sub: 'Erase all progression', onClick: () => (this.mode = 'reset') },
    ]);
  }

  toggleAudio() {
    const s = this.game.save;
    s.data.settings.audio = !s.data.settings.audio;
    s.save();
    this.game.audio.setMuted(!s.data.settings.audio);
    this.game.audio.play('ui');
    this.buildMain();
  }

  enterHub() {
    this.game.audio.init();
    if (!this.game.save.data.custom?.created) {
      this.game.engine.go('create', { from: 'title' }, 0.35);
      return;
    }
    this.game.engine.go('hub', { fresh: true }, 0.35);
  }

  enter(params) {
    this.buildMain();
    this.mode = 'main';
  }

  update(dt) {
    this.t += dt;
    for (const p of this.particles) {
      p.y -= p.v * dt;
      p.p += dt;
      if (p.y < -4) {
        p.y = 364;
        p.x = Math.random() * 640;
      }
    }
    if (this.mode === 'main') {
      const it = this.menu.update(dt) || this.menu.handleTap(232, 176, 190, 24, 4);
      if (it) {
        this.game.audio.play('ui');
        it.onClick?.();
      }
    } else if (this.mode === 'reset') {
      const it = this.subMenu.update(dt) || this.subMenu.handleTap(200, 210, 240, 24, 4);
      if (it) {
        this.game.audio.play('ui');
        if (it.confirm) {
          this.game.save.reset();
          this.game.toast('Save data erased');
          this.buildMain();
          this.mode = 'main';
        } else this.mode = 'main';
      }
      if (input.wasPressed('pause')) this.mode = 'main';
    } else {
      if (input.wasPressed('pause') || input.wasPressed('confirm') || input.wasPressed('interact') || input.pointer.pressed) {
        this.mode = 'main';
        this.buildMain();
      }
    }
  }

  draw(ctx) {
    // background
    const g = ctx.createLinearGradient(0, 0, 0, 360);
    g.addColorStop(0, '#0a0a16');
    g.addColorStop(0.55, '#141024');
    g.addColorStop(1, '#05050a');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 640, 360);
    // cursed energy motes
    for (const p of this.particles) {
      ctx.globalAlpha = 0.15 + Math.sin(p.p) * 0.1;
      ctx.fillStyle = p.s > 1.4 ? '#ff3a4a' : '#6b5bff';
      ctx.fillRect(Math.round(p.x), Math.round(p.y), p.s, p.s * 2.2);
    }
    ctx.globalAlpha = 1;
    // large torii silhouette
    ctx.globalAlpha = 0.22;
    ctx.fillStyle = '#8a1a2a';
    ctx.fillRect(96, 96, 10, 264);
    ctx.fillRect(534, 96, 10, 264);
    ctx.fillRect(72, 88, 496, 12);
    ctx.fillRect(88, 72, 464, 8);
    ctx.globalAlpha = 1;
    // floor glow
    const gg = ctx.createRadialGradient(320, 320, 10, 320, 320, 220);
    gg.addColorStop(0, 'rgba(120,40,220,0.25)');
    gg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = gg;
    ctx.fillRect(0, 160, 640, 200);

    // title
    ctx.save();
    ctx.textAlign = 'center';
    ctx.font = `bold 40px ${FONT}`;
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillText('JUJUTSU', 322, 92);
    ctx.fillStyle = '#f2eef8';
    ctx.fillText('JUJUTSU', 320, 90);
    ctx.font = `bold 26px ${FONT}`;
    ctx.fillStyle = '#ff2a4a';
    ctx.fillText('R O G U E L I T E', 320, 120);
    ctx.restore();
    text(ctx, 'Domain of the Ten Shadows', 320, 138, { size: 8, align: 'center', color: '#9f8ad8' });
    text(ctx, `BEST ${this.game.save.data.stats.bestScore}  •  RUNS ${this.game.save.data.stats.runs}  •  WINS ${this.game.save.data.stats.wins}`, 320, 152, {
      size: 7,
      align: 'center',
      color: '#6f7a92',
    });

    if (this.mode === 'main') {
      this.menu.draw(ctx, 232, 168, 190, { rowH: 22, gap: 3 });
      text(ctx, 'WASD move • J/click attack • Space dodge • Shift reinforce • E interact', 320, 352, {
        size: 6,
        align: 'center',
        color: '#6f7a92',
      });
    } else if (this.mode === 'help') {
      screenShade(ctx, 0.8);
      panel(ctx, 70, 30, 500, 300, { fill: 'rgba(10,12,20,0.98)', border: '#5b8cff', title: 'HOW TO PLAY' });
      const lines = [
        'You are a Jujutsu sorcerer. Explore Jujutsu High, train, then walk through the cursed gate into a run.',
        '',
        'COMBAT: attacks only damage during active frames. Watch enemy telegraphs, then dodge or punish the recovery.',
        'CURSED ENERGY: every technique costs CE. Basic attacks refund a little. Reinforcement (Shift) costs CE over time but boosts damage and unlocks Black Flash.',
        'BLACK FLASH: after finding the Black Sparks Scroll, press Shift exactly as your attack lands. Yuji has a wider window.',
        'SHIKIGAMI: Megumi tames the Ten Shadows in real fights. Tamed summons persist forever. At 50% meter he summons Agito; at 100%, Mahoraga.',
        'DOMAINS: F activates your domain. Enemies inside are affected by its unique mechanic. Domains clash when both sides expand.',
        'RUNS: pick rooms on the map. Rewards are temporary; tribute and story progress are permanent.',
        '',
        'Touch: left half of the screen is a joystick; buttons on the right. Landscape recommended.',
      ];
      let y = 52;
      for (const line of lines) {
        y += line ? wrapText(ctx, line, 84, y, 472, 10, { size: line.startsWith('COMBAT') || line.startsWith('CURSED') || line.startsWith('BLACK') || line.startsWith('SHIKIGAMI') || line.startsWith('DOMAINS') || line.startsWith('RUNS') ? 8 : 7, color: '#cfd8e6', bold: false }) : 5;
      }
      text(ctx, 'Tap / Enter to return', 320, 322, { size: 7, align: 'center', color: '#93a0b8' });
    } else if (this.mode === 'scores') {
      screenShade(ctx, 0.8);
      panel(ctx, 110, 40, 420, 280, { fill: 'rgba(10,12,20,0.98)', border: '#ffb03a', title: 'HIGH SCORES' });
      const scores = this.game.save.data.highScores;
      if (!scores.length) {
        text(ctx, 'No runs recorded yet. Go make some history.', 320, 180, { size: 8, align: 'center', color: '#93a0b8' });
      } else {
        scores.slice(0, 9).forEach((s, i) => {
          const y = 70 + i * 24;
          const c = CHARACTERS[s.char] || CHARACTERS.yuji;
          text(ctx, `${i + 1}.`, 130, y, { size: 8, color: '#ffd166' });
          text(ctx, `${s.score}`, 160, y, { size: 9, color: '#ffffff' });
          text(ctx, `${c.name}  •  arc ${s.arc + 1}  •  ${s.rooms} rooms  ${s.win ? '• VICTORY' : ''}`, 270, y, {
            size: 7,
            color: s.win ? '#7cf0a0' : '#9aa3b2',
          });
        });
      }
      text(ctx, 'Tap / Enter to return', 320, 300, { size: 7, align: 'center', color: '#93a0b8' });
    } else if (this.mode === 'reset') {
      screenShade(ctx, 0.85);
      panel(ctx, 150, 110, 340, 150, { fill: 'rgba(22,10,14,0.99)', border: '#ff6b6b', title: 'RESET SAVE?' });
      text(ctx, 'All characters, shikigami, story progress and high scores will be erased.', 320, 150, {
        size: 8,
        align: 'center',
        color: '#ffd0d6',
        bold: false,
      });
      this.subMenu = new VerticalMenu([
        { label: 'Erase everything', color: '#ff6b6b', confirm: true },
        { label: 'Cancel', confirm: false },
      ]);
      this.subMenu.draw(ctx, 200, 178, 240, { rowH: 24 });
    }
  }
}
