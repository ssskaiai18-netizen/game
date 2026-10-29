// ---------------------------------------------------------------------------
// hud.js — combat HUD, ability bar, boss bar, combo counter, touch controls,
// interaction prompts and the pause overlay.
// ---------------------------------------------------------------------------

import { clamp, rgba, TAU } from '../core/util.js';
import { input } from '../core/input.js';
import { text, panel, bar, cooldownIcon, FONT, VerticalMenu, keyHint, screenShade } from './ui.js';
import { SHIKIGAMI } from '../data/shikigami.js';

export class Hud {
  constructor(scene) {
    this.scene = scene;
    this.game = scene.game;
    this.showTouch = false;
    this.buttons = [];
    this.hintT = 0;
    this.selectedSlot = 0;
  }

  get player() {
    return this.scene.world?.player;
  }

  update(dt) {
    this.hintT += dt;
    this.showTouch = input.usedTouch || this.game.forceTouch;
    this.buttons = [];
    const p = this.player;
    if (!p || p.dead) {
      input.setButtons([]);
      return;
    }
    if (this.showTouch) this.buildTouchButtons(p);
    input.setButtons(this.buttons);
  }

  buildTouchButtons(p) {
    const B = (id, x, y, r, label, extra = {}) => {
      this.buttons.push({ id, x, y, r, label, ...extra });
    };
    B('attack', 590, 302, 24, 'ATK');
    B('dodge', 528, 316, 18, 'DASH');
    B('reinforce', 424, 286, 16, 'CE+');
    const slots = p.slots || [];
    const xs = [398, 440, 482, 524];
    slots.forEach((ab, i) => {
      if (!ab) return;
      B(i === 0 ? 'a1' : i === 1 ? 'a2' : i === 2 ? 'a3' : 'a4', xs[i], 232, 14, `${i + 1}`, { ab });
    });
    B('ult', 574, 218, 17, 'ULT');
    if (p.domainAbility) B('domain', 606, 254, 15, 'DOM');
    if (p.boogieUnlocked) B('boogie', 366, 318, 14, 'BW');
    if (p.charId === 'megumi') B('summonCmd', 590, 170, 12, '⇄');
    if (this.scene.interactPrompt) B('interact', 320, 306, 20, 'E', { highlight: true });
    B('pause', 616, 16, 12, 'II');
  }

  draw(ctx) {
    const p = this.player;
    if (!p) return;
    this.drawPlayerBars(ctx, p);
    this.drawAbilityBar(ctx, p);
    this.drawBossBar(ctx);
    this.drawCombo(ctx, p);
    this.drawRoomInfo(ctx);
    this.drawTouchControls(ctx, p);
    this.drawPrompt(ctx);
    if (this.game.debug) this.drawDebug(ctx, p);
  }

  drawPlayerBars(ctx, p) {
    const x = 10;
    const y = 10;
    const w = 132;
    const hpFrac = p.hp / p.maxHp;
    // portrait chip
    panel(ctx, x - 4, y - 4, w + 8, 40, { fill: 'rgba(8,10,16,0.72)', border: '#2c3448', inner: false });
    text(ctx, p.char.name.toUpperCase(), x + 1, y + 5, { size: 7, color: '#cfd8e6' });
    bar(ctx, x + 60, y, w - 60, 7, hpFrac, {
      fg: hpFrac > 0.5 ? '#e8485f' : hpFrac > 0.25 ? '#ff8a3a' : '#ff2a4a',
    });
    text(ctx, `${Math.ceil(p.hp)}/${p.maxHp}`, x + w - 4, y + 6, { size: 6, align: 'right', color: '#ffdfe4' });
    const ceFrac = p.ce / p.maxCe;
    bar(ctx, x, y + 10, w, 5, ceFrac, { fg: '#4a7bff' });
    const ultFrac = p.ultMeter / p.maxUlt;
    bar(ctx, x, y + 17, w, 4, ultFrac, { fg: p.charId === 'megumi' ? '#a79bff' : '#ffb03a' });
    if (p.charId === 'megumi') {
      // 50% and 100% thresholds marked
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      ctx.fillRect(x + 0.5 + (w - 1) * 0.5, y + 16, 1, 6);
      text(ctx, p.ultMeter >= 100 ? 'MAHORAGA' : p.ultMeter >= 50 ? 'AGITO READY' : 'TEN SHADOWS', x + w + 6, y + 21, {
        size: 6,
        color: p.ultMeter >= 100 ? '#ffd166' : p.ultMeter >= 50 ? '#a79bff' : '#6a7488',
      });
    } else {
      text(ctx, ultFrac >= 1 ? 'ULTIMATE READY' : `ULT ${Math.floor(ultFrac * 100)}%`, x + w + 6, y + 21, {
        size: 6,
        color: ultFrac >= 1 ? '#ffd166' : '#8b98b0',
      });
    }
    // reinforcement / buff chips
    let cy = y + 28;
    if (p.reinforced > 0) {
      text(ctx, `REINFORCED ${p.reinforced.toFixed(1)}s`, x, cy + 6, { size: 6, color: p.auraColor || '#ff9a6b' });
      cy += 8;
    }
    if (p.buffT > 0 && p.buffMult > 1) {
      text(ctx, `EMPOWERED x${p.buffMult.toFixed(2)}`, x, cy + 6, { size: 6, color: '#ffd166' });
      cy += 8;
    }
    if (p.infinityT > 0) {
      text(ctx, `INFINITY HITS: ${p.infinityHits}`, x, cy + 6, { size: 6, color: '#a8d8ff' });
      cy += 8;
    }
    if (p.blackSparks) {
      text(ctx, p.bfState ? (p.bfState.windowOpen ? 'SYNC NOW!' : 'SYNC...') : 'BLACK SPARK', x, cy + 6, {
        size: 6,
        color: p.bfState && p.bfState.windowOpen ? '#ff2a4a' : '#8b98b0',
      });
    }
    if (p.profile) text(ctx, `MASTERY ${p.profile.mastery} · TRAINING ${p.profile.trainingWins}`, x, cy + 15, { size: 6, color: '#9fc0ff' });
    // domain status
    if (this.scene.world?.domain) {
      const d = this.scene.world.domain;
      const remaining = Math.max(0, d.dur - Math.max(0, d.t - 0.95));
      text(ctx, `${d.name} ${remaining.toFixed(1)}s`, 320, 342, { size: 7, align: 'center', color: d.color });
    }
  }

  drawAbilityBar(ctx, p) {
    if (this.showTouch) {
      // Touch buttons remain in their original positions; show their names and
      // resource/cooldown state in a compact readout away from the buttons.
      (p.slots || []).forEach((ab, i) => {
        const cd = Math.max(0, p.cdMap[ab.id] || 0);
        const state = cd > 0 ? `${cd.toFixed(1)}s` : p.ce < (ab.cost || 0) ? 'NO CE' : 'READY';
        text(ctx, `${i + 1} ${ab.name} · ${state} / ${ab.cd || 0}s · ${ab.cost || 0} CE`, 10, 120 + i * 9,
          { size: 6, color: cd > 0 ? '#ff8a8a' : '#c9d3e0' });
      });
      if (!p.ultimate) text(ctx, 'ULT: TRAIN TO UNLOCK', 10, 158, { size: 6, color: '#8b98b0' });
      if (p.domainAbility) text(ctx, `DOM: ${p.domainCd > 0 ? p.domainCd.toFixed(1) + 's' : p.domainAbility.cost + ' CE'}`, 10, 167, { size: 6, color: '#c9a2ff' });
      this.drawSummonSelect(ctx, p);
      return;
    }
    const x = 14;
    const y = 322;
    const slots = p.slots || [];
    for (let i = 0; i < 4; i++) {
      const ab = slots[i];
      const bx = x + i * 46;
      if (!ab) {
        panel(ctx, bx, y, 42, 26, { fill: 'rgba(10,12,20,0.86)', border: '#2a2f3c', inner: false });
        text(ctx, 'LOCKED', bx + 21, y + 15, { size: 6, align: 'center', color: '#5b6478' });
        keyHint(ctx, bx + 1, y - 2, `${i + 1}`, '');
        continue;
      }
      const cd = p.cdMap[ab.id] || 0;
      const cdFrac = cd > 0 ? cd / (ab.cd || 1) : 0;
      const affordable = p.ce >= (ab.cost || 0) * (p.mods?.ceCostMult || 1);
      panel(ctx, bx, y, 42, 26, { fill: 'rgba(10,12,20,0.86)', border: affordable ? '#4a5570' : '#2a2f3c', inner: false });
      ctx.fillStyle = affordable ? '#e8eef8' : '#5b6478';
      ctx.font = `bold 7px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.fillText(ab.name.length > 15 ? ab.name.slice(0, 14) + '…' : ab.name, bx + 21, y + 9);
      ctx.textAlign = 'left';
      text(ctx, `${ab.cost || 0}CE`, bx + 4, y + 22, { size: 5, color: '#7ec8ff' });
      text(ctx, cd > 0 ? `${cd.toFixed(1)}/${ab.cd || 0}` : affordable ? 'READY' : 'NO CE', bx + 38, y + 22, {
        size: 6,
        align: 'right',
        color: cd > 0 || !affordable ? '#ff8a8a' : '#7cf0a0',
      });
      if (cdFrac > 0) {
        ctx.fillStyle = 'rgba(0,0,0,0.55)';
        ctx.fillRect(bx + 1, y + 1, 40, 24 * cdFrac);
      }
      keyHint(ctx, bx + 1, y - 2, `${i + 1}`, '');
    }
    // ultimate + domain
    const ux = x + 4 * 46;
    const ultReady = !!p.ultimate && (p.charId === 'megumi' ? p.ultMeter >= 50 : p.ultMeter >= (p.ultimate.ultCost || 100));
    panel(ctx, ux, y, 62, 26, { fill: 'rgba(10,12,20,0.86)', border: ultReady ? '#ffb03a' : '#2a2f3c', inner: false });
    text(ctx, !p.ultimate ? 'LOCKED' : p.charId === 'megumi' ? (p.ultMeter >= 100 ? 'MAHORAGA' : 'AGITO') : 'ULTIMATE', ux + 31, y + 9, {
      size: 6,
      align: 'center',
      color: ultReady ? '#ffd166' : '#5b6478',
    });
    keyHint(ctx, ux + 6, y + 21, 'R', !p.ultimate ? 'TRAIN' : ultReady ? 'READY' : `${Math.floor(p.ultMeter)}%`);
    // domain
    const dx = ux + 68;
    const domainReady = p.domainAbility && p.domainCd <= 0 && p.ce >= (p.domainAbility.cost || 60);
    panel(ctx, dx, y, 82, 26, { fill: 'rgba(10,12,20,0.86)', border: domainReady ? '#c9a2ff' : '#2a2f3c', inner: false });
    text(ctx, p.domainAbility ? p.domainAbility.name.replace('Domain Expansion: ', '') : 'NO DOMAIN', dx + 41, y + 9, {
      size: 6,
      align: 'center',
      color: domainReady ? '#d9b6ff' : '#5b6478',
    });
    keyHint(ctx, dx + 6, y + 21, 'F', p.domainCd > 0 ? `${p.domainCd.toFixed(0)}s` : `${p.domainAbility ? p.domainAbility.cost : 0} CE`);
    // reinforce
    const rx = dx + 88;
    panel(ctx, rx, y, 58, 26, { fill: 'rgba(10,12,20,0.86)', border: p.reinforced > 0 ? '#ff9a6b' : '#2a2f3c', inner: false });
    text(ctx, 'REINFORCE', rx + 29, y + 9, { size: 6, align: 'center', color: p.reinforced > 0 ? '#ff9a6b' : '#8b98b0' });
    keyHint(ctx, rx + 5, y + 21, '⇧', p.reinforced > 0 ? 'ON' : 'OFF');
    if (p.blackSparks) {
      text(ctx, 'BLACK FLASH: tap ⇧ at impact', rx + 29, y + 34, { size: 6, align: 'center', color: '#ff6b8a' });
    }
    this.drawSummonSelect(ctx, p);
  }

  drawSummonSelect(ctx, p) {
    if (p.charId !== 'megumi') return;
    const list = p.summonOptions || [];
    if (!list.length) return;
    const id = list[p.summonIndex % list.length];
    const def = SHIKIGAMI[id];
    const x = 372;
    const y = 296;
    panel(ctx, x, y, 118, 22, { fill: 'rgba(10,12,20,0.86)', border: '#5b4bd6', inner: false });
    text(ctx, `SHIKIGAMI: ${def ? def.name : '-'}`, x + 4, y + 9, { size: 6, color: '#c9b8ff' });
    text(ctx, `${(p.summonOptions.length && p.summonIndex + 1) || 1}/${list.length}  [C] cycle`, x + 4, y + 18, { size: 6, color: '#8b98b0' });
    const summons = this.scene.world.summons || [];
    summons.slice(0, 5).forEach((s, i) => {
      const sx = 250 + i * 30;
      panel(ctx, sx, 296, 26, 20, { fill: 'rgba(10,12,20,0.8)', border: '#4a3fa0', inner: false });
      text(ctx, (s.summonId || '?').slice(0, 4), sx + 13, 303, { size: 6, align: 'center', color: '#a79bff' });
      bar(ctx, sx + 2, 310, 22, 3, clamp(s.hp / s.maxHp, 0, 1), { fg: '#7cf0a0' });
    });
  }

  drawBossBar(ctx) {
    const boss = this.scene.world?.enemies.find((e) => e.isBoss && !e.dead);
    if (!boss) return;
    const w = 320;
    const x = 160;
    const y = 6;
    panel(ctx, x - 6, y - 2, w + 12, 26, { fill: 'rgba(8,10,16,0.8)', border: '#5a1a24', inner: false });
    text(ctx, boss.enemyDef?.name || boss.name, x, y + 9, { size: 7, color: '#ffb8c0' });
    const frac = boss.hp / boss.maxHp;
    bar(ctx, x, y + 12, w, 8, frac, { fg: frac > 0.5 ? '#c0392b' : '#ff2a4a' });
    if (boss.enemyDef?.phases) {
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.fillRect(x + w * 0.5, y + 12, 1, 8);
    }
    text(ctx, `${Math.ceil(boss.hp)} / ${boss.maxHp}`, x + w, y + 20, { size: 6, align: 'right', color: '#ffd0d6' });
    if (boss.adapt) {
      const stage = Math.max(...Object.values(boss.adapt).map((v) => v.stage));
      text(ctx, `ADAPT ${'●'.repeat(stage)}${'○'.repeat(Math.max(0, 4 - stage))}`, x + w, y + 9, {
        size: 6,
        align: 'right',
        color: '#ffd166',
      });
    }
  }

  drawCombo(ctx, p) {
    const st = this.scene.world?.stats;
    if (!st || st.combo < 2) return;
    const t = clamp(st.comboTimer / 2.2, 0, 1);
    ctx.globalAlpha = 0.4 + t * 0.6;
    text(ctx, `${st.combo} HIT`, 620, 70, { size: 16, align: 'right', color: '#ffd166' });
    text(ctx, 'COMBO', 620, 80, { size: 7, align: 'right', color: '#ffb03a' });
    ctx.globalAlpha = 1;
  }

  drawRoomInfo(ctx) {
    const s = this.scene;
    if (!s.roomLabel) return;
    text(ctx, s.roomLabel, 320, 20, { size: 7, align: 'center', color: '#c9d3e0' });
  }

  drawPrompt(ctx) {
    const prompt = this.scene.interactPrompt;
    if (!prompt) return;
    const y = 288;
    ctx.font = `bold 8px ${FONT}`;
    const label = prompt.label || 'Interact';
    const w = ctx.measureText(label).width + 36;
    panel(ctx, 320 - w / 2, y - 12, w, 18, { fill: 'rgba(10,12,20,0.9)', border: prompt.color || '#9fc0ff', inner: false });
    if (this.showTouch) text(ctx, 'E', 320 - w / 2 + 9, y, { size: 8, color: '#ffffff' });
    else {
      let x = 320 - w / 2 + 7;
      x = keyHint(ctx, x, y, 'E', '');
      text(ctx, label, x + 2, y, { size: 8, color: '#e8eef8' });
      return;
    }
    text(ctx, label, 320 + 6, y, { size: 8, align: 'center', color: '#e8eef8' });
  }

  drawTouchControls(ctx, p) {
    if (!this.showTouch) return;
    const btn = (id, x, y, r, label) => {
      const b = this.buttons.find((b) => b.id === id);
      if (!b) return;
      const pressed = input.virtualDown.has(id);
      ctx.beginPath();
      ctx.arc(x, y, r, 0, TAU);
      ctx.fillStyle = pressed ? 'rgba(90,120,200,0.5)' : 'rgba(16,20,32,0.5)';
      ctx.fill();
      ctx.strokeStyle = b.highlight ? '#ffd166' : 'rgba(160,180,220,0.45)';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      text(ctx, label, x, y + 2, { size: r > 20 ? 8 : 6, align: 'center', color: '#dfe6f2' });
    };
    for (const b of this.buttons) {
      if (b.id === 'pause' || b.id === 'interact') continue;
      let label = b.label;
      if (b.ab) label = `${b.label}`;
      if (b.id === 'ult') label = p.charId === 'megumi' ? (p.ultMeter >= 100 ? 'MAHO' : 'AGITO') : 'ULT';
      if (b.id === 'reinforce') label = p.reinforced > 0 ? 'CE+' : 'CE';
      if (b.id === 'dodge') label = 'DASH';
      const cd = b.ab ? p.cdMap[b.ab.id] || 0 : 0;
      btn(b.id, b.x, b.y, b.r, label);
      if (cd > 0) {
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.r, -Math.PI / 2, -Math.PI / 2 + TAU * clamp(cd / (b.ab.cd || 1), 0, 1));
        ctx.strokeStyle = '#ff8a8a';
        ctx.lineWidth = 2;
        ctx.stroke();
      }
      if (b.id === 'reinforce' && p.reinforced > 0) {
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.r + 3, 0, TAU * clamp(p.reinforced / 5, 0, 1));
        ctx.strokeStyle = '#ff9a6b';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
    }
    // joystick
    if (input.joy.active) {
      ctx.globalAlpha = 0.35;
      ctx.beginPath();
      ctx.arc(input.joy.bx, input.joy.by, 30, 0, TAU);
      ctx.fillStyle = '#1a2030';
      ctx.fill();
      ctx.strokeStyle = '#5b6a8a';
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(input.joy.bx + input.joy.dx * 24, input.joy.by + input.joy.dy * 24, 12, 0, TAU);
      ctx.fillStyle = '#93a0b8';
      ctx.fill();
      ctx.globalAlpha = 1;
    }
    // pause
    const pb = this.buttons.find((b) => b.id === 'pause');
    if (pb) {
      ctx.fillStyle = 'rgba(16,20,32,0.6)';
      ctx.fillRect(pb.x - 12, pb.y - 12, 24, 24);
      ctx.strokeStyle = 'rgba(160,180,220,0.45)';
      ctx.strokeRect(pb.x - 12, pb.y - 12, 24, 24);
      text(ctx, 'II', pb.x, pb.y + 3, { size: 8, align: 'center', color: '#dfe6f2' });
    }
  }

  drawDebug(ctx, p) {
    text(ctx, `fps ${this.game.engine.fps} actors ${this.scene.world.actors.length} fx ${this.scene.world.fx.particles.length}`, 10, 356, {
      size: 6,
      color: '#7cf0a0',
    });
  }
}

// ---------------------------------------------------------------------------
// Pause overlay (engine-level so it works in every scene)
// ---------------------------------------------------------------------------
export class PauseOverlay {
  constructor(game, engine) {
    this.game = game;
    this.engine = engine;
    this.menu = new VerticalMenu([]);
    this.subMenu = new VerticalMenu([]);
    this.sub = null;
    this.refresh();
  }
  refresh() {
    const save = this.game.save;
    this.menu.setItems([
      { label: 'Resume', onClick: () => this.close() },
      { label: 'Controls', onClick: () => (this.sub = 'controls') },
      { label: 'Settings', onClick: () => (this.sub = 'settings') },
      { label: save.data.settings.audio ? 'Audio: ON' : 'Audio: OFF', onClick: () => { save.data.settings.audio = !save.data.settings.audio; save.save(); this.game.audio.setMuted(!save.data.settings.audio); this.refresh(); } },
      { label: save.data.settings.shake ? 'Screen Shake: ON' : 'Screen Shake: OFF', onClick: () => { save.data.settings.shake = !save.data.settings.shake; save.save(); this.refresh(); } },
      { label: 'Reset Save…', color: '#ff8a8a', onClick: () => (this.sub = 'reset') },
      { label: 'Return to Title', onClick: () => { this.sub = null; this.close(); this.engine.go('title', {}, 0.3); } },
    ]);
  }
  close() {
    this.engine.paused = false;
    this.sub = null;
  }
  update(dt) {
    if (this.sub === 'reset') {
      if (!this.subMenu) this.subMenu = new VerticalMenu([]);
      if (input.wasPressed('pause')) { this.sub = null; return; }
      const it = this.subMenu.update(dt) || this.subMenu.handleTap(180, 168, 280, 22, 4);
      if (it) it.onClick?.();
      return;
    }
    if (this.sub) {
      if (input.wasPressed('pause') || input.wasPressed('dodge') || input.wasPressed('confirm') || input.wasPressed('attack')) {
        this.sub = null;
        return;
      }
      return;
    }
    const it = this.menu.update(dt) || this.menu.handleTap(240, 108, 170, 24, 4);
    if (it) it.onClick?.();
  }
  draw(ctx, engine) {
    screenShade(ctx, 0.72);
    panel(ctx, 232, 60, 186, 220, { fill: 'rgba(10,12,20,0.98)', border: '#5b8cff', title: 'PAUSED' });
    this.menu.draw(ctx, 240, 104, 170, { rowH: 24, gap: 4 });
    text(ctx, 'ESC to resume', 320, 340, { size: 6, align: 'center', color: '#8b98b0' });
    if (this.sub === 'controls') this.drawControls(ctx);
    if (this.sub === 'settings') this.drawSettings(ctx);
    if (this.sub === 'reset') this.drawReset(ctx);
  }
  drawControls(ctx) {
    panel(ctx, 120, 40, 400, 280, { fill: 'rgba(8,10,16,0.99)', border: '#5b8cff', title: 'CONTROLS' });
    const lines = [
      ['WASD / Arrows', 'Move'],
      ['Mouse', 'Aim (auto-aim on touch)'],
      ['Left click / J', 'Basic attack combo'],
      ['Space', 'Dodge (i-frames)'],
      ['Shift', 'Reinforcement  •  Black Flash sync'],
      ['1 2 3 4', 'Character techniques'],
      ['R', 'Ultimate'],
      ['F', 'Domain Expansion'],
      ['C', 'Cycle shikigami (Megumi)'],
      ['T', 'Boogie Woogie (if unlocked)'],
      ['E', 'Interact'],
      ['Esc', 'Pause'],
    ];
    lines.forEach(([k, v], i) => {
      const y = 66 + i * 19;
      text(ctx, k, 140, y, { size: 8, color: '#ffd166' });
      text(ctx, v, 280, y, { size: 8, color: '#dfe6f2', bold: false });
    });
    text(ctx, 'Touch: use the on-screen buttons. Tap the left half to move with the joystick.', 320, 300, {
      size: 7,
      align: 'center',
      color: '#93a0b8',
    });
  }
  drawSettings(ctx) {
    panel(ctx, 160, 90, 320, 180, { fill: 'rgba(8,10,16,0.99)', border: '#5b8cff', title: 'SETTINGS' });
    const s = this.game.save.data.settings;
    text(ctx, `Audio: ${s.audio ? 'ON' : 'OFF'}`, 190, 130, { size: 9, color: '#dfe6f2' });
    text(ctx, `Screen shake: ${s.shake ? 'ON' : 'OFF'}`, 190, 152, { size: 9, color: '#dfe6f2' });
    text(ctx, `Difficulty: ${s.difficulty}`, 190, 174, { size: 9, color: '#dfe6f2' });
    text(ctx, 'Change these in the pause menu list or the hub shrine.', 320, 220, { size: 7, align: 'center', color: '#93a0b8' });
  }
  drawReset(ctx) {
    panel(ctx, 140, 100, 360, 170, { fill: 'rgba(20,8,12,0.99)', border: '#ff6b6b', title: 'RESET ALL PROGRESS?' });
    text(ctx, 'This erases characters, shikigami, story progress and scores.', 320, 140, {
      size: 8,
      align: 'center',
      color: '#ffd0d6',
      bold: false,
    });
    this.subMenu = new VerticalMenu([
      { label: 'Yes, erase everything', color: '#ff6b6b', onClick: () => { this.game.save.reset(); this.game.audio.play('deny'); this.sub = null; this.refresh(); this.engine.go('title', {}, 0.3); } },
      { label: 'Cancel', onClick: () => (this.sub = null) },
    ]);
    this.subMenu.draw(ctx, 180, 168, 280, { rowH: 22 });
  }
}

// Ensure submenus exist for touch navigation
