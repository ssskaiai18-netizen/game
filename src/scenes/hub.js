// ---------------------------------------------------------------------------
// hub.js — the explorable Jujutsu High hub: courtyard, training grounds, NPCs,
// shrine, Ten Shadows ritual, sparring, Culling Games kiosk and the cursed gate.
// ---------------------------------------------------------------------------

import { ArenaScene } from './arenaBase.js';
import { input } from '../core/input.js';
import { clamp, dist, TAU, formatNum } from '../core/util.js';
import { HUB_ARENA, HUB_DECOR, HUB_OBSTACLES, HUB_NPCS, DUMMY_SPOTS, TRIBUTE_TRACKS, PORTAL_POS, SHRINE_POS, KOGANE_POS, TRAINING_BOARD } from '../data/hub.js';
import { CHARACTERS, PLAYABLE_ORDER } from '../data/characters.js';
import { SHIKIGAMI, SHIKIGAMI_ORDER, TOTALITY, AGITO } from '../data/shikigami.js';
import { ARCS, DIFFICULTIES, DIALOGUE, isArcUnlocked } from '../data/story.js';
import { drawHumanoid, humanoidPose, PROPS } from '../render/sprites.js';
import { text, panel, bar, wrapText, VerticalMenu, screenShade, keyHint, FONT, cardRow } from '../ui/ui.js';
import { defaultMods } from '../data/upgrades.js';

export class HubScene extends ArenaScene {
  constructor(game, params = {}) {
    super(game, params);
    this.params = params;
    this.npcs = [];
    this.t = 0;
    this.overlay = null;
    this.interactables = [];
    this.trainingStats = true;
    this.showStats = false;
    this.nearTraining = false;
    this.newFlags = {};
  }

  enter() {
    const charId = this.game.selectedChar || 'yuji';
    this.createWorld({
      arena: HUB_ARENA,
      theme: 'hub',
      decor: HUB_DECOR.map((d) => ({ ...d })),
      obstacles: HUB_OBSTACLES,
      seed: 12345,
    });
    this.createPlayer({ charId, x: 360, y: 420, mods: this.game.hubMods || defaultMods() });
    this.world.trainMode = true;
    this.world.safeMode = false;
    // training dummies
    for (const spot of DUMMY_SPOTS) this.world.spawnDummy(spot.x, spot.y, spot.type);
    // NPCs
    this.npcs = HUB_NPCS.map((n) => ({
      ...n,
      t: Math.random() * 10,
      wanderT: Math.random() * 3,
      homeX: n.x,
      homeY: n.y,
      vx: 0,
      vy: 0,
      facingX: n.facingX || 1,
    })).filter((n) => {
      if (n.id === 'nobara') return this.game.save.hasCharacter('nobara');
      if (n.id === 'gojo') return this.game.save.hasCharacter('gojo');
      return true;
    });
    this.world.camera.x = 480 - 320;
    this.world.camera.y = 280 - 180;
    this.roomLabel = '';
    this.hud = this.hud;
    this.world.decor.push({ type: 'kogane', x: KOGANE_POS.x, y: KOGANE_POS.y - 14, active: this.game.save.data.culling.started });
    this.buildInteractables();

    if (!this.game.save.data.seen.intro) {
      this.game.save.data.seen.intro = true;
      this.game.save.save();
      this.openDialogue(DIALOGUE.intro.map((l) => [l.speaker, l.text]), null);
    } else if (this.params.fromRun) {
      this.game.toast(this.summaryLine(), { color: '#9fd8ff', life: 4 });
    }
  }

  summaryLine() {
    const data = this.game.save.data;
    const arc = ARCS[Math.min(data.story.arc, ARCS.length - 1)];
    return `Arc ${data.story.arc + 1}: ${arc.name} — ${arc.hubLine}`;
  }

  buildInteractables() {
    const save = this.game.save;
    this.interactables = [
      { id: 'portal', x: PORTAL_POS.x, y: PORTAL_POS.y - 18, r: 42, label: 'Enter the cursed gate', color: '#b06bff' },
      { id: 'shrine', x: SHRINE_POS.x, y: SHRINE_POS.y, r: 38, label: 'Shrine of blessings', color: '#ffd166' },
      { id: 'board', x: TRAINING_BOARD.x, y: TRAINING_BOARD.y + 20, r: 30, label: 'Training records', color: '#7cf0a0' },
    ];
    if (save.data.culling.started) {
      this.interactables.push({ id: 'kogane', x: KOGANE_POS.x, y: KOGANE_POS.y, r: 32, label: 'Kogane', color: '#ffd166' });
    }
    for (const n of this.npcs) {
      let label = `Talk to ${n.name.split(' ')[0]}`;
      if (n.id === 'megumi') label = 'Megumi — Ten Shadows';
      if (n.id === 'instructor') label = 'Spar with Kusakabe';
      if (n.id === 'researcher') label = 'Technique research';
      if (n.id === 'progression') label = 'Progression';
      this.interactables.push({ id: 'npc_' + n.id, npc: n, x: n.x, y: n.y - 10, r: 34, label, color: '#9fc0ff' });
    }
  }

  updateScene(dt) {
    this.t += dt;
    // keep interactable positions synced with wandering npcs
    for (const it of this.interactables) {
      if (it.npc) {
        it.x = it.npc.x;
        it.y = it.npc.y - 10;
      }
    }
    this.updateNpcs(dt);
    const p = this.player;
    if (!p) return;
    // interaction detection
    this.interactPrompt = null;
    this.nearest = null;
    let bestD = 999;
    for (const it of this.interactables) {
      const d = Math.hypot(p.x - it.x, p.y - it.y);
      if (d < it.r && d < bestD) {
        bestD = d;
        this.nearest = it;
      }
    }
    if (this.nearest) {
      this.interactPrompt = { label: this.nearest.label, color: this.nearest.color };
      if (input.wasPressed('interact') || input.wasPressed('confirm')) this.interact(this.nearest);
    }
    // reaching the portal zone without prompt pressure
    this.nearTraining = p.x < 400 && p.y > 290 && p.y < 470;
    // reset dummies when they are all damaged and player leaves? explicit reset instead
    if (p.hp < p.maxHp) p.heal(6 * dt);
    if (p.ce < p.maxCe) p.ce = Math.min(p.maxCe, p.ce + 6 * dt);
    if (this.world.stats.hits > 0) this.showStats = true;
  }

  updateNpcs(dt) {
    for (const n of this.npcs) {
      n.t += dt;
      if (n.wander) {
        n.wanderT -= dt;
        if (n.wanderT <= 0) {
          n.wanderT = 2 + Math.random() * 3;
          n.tx = n.homeX + (Math.random() - 0.5) * 90;
          n.ty = n.homeY + (Math.random() - 0.5) * 60;
        }
        if (n.tx !== undefined) {
          const dx = n.tx - n.x;
          const dy = n.ty - n.y;
          const d = Math.hypot(dx, dy);
          if (d > 4) {
            n.x += (dx / d) * 26 * dt;
            n.y += (dy / d) * 26 * dt;
            n.facingX = dx >= 0 ? 1 : -1;
            n.moving = true;
          } else n.moving = false;
        }
      }
    }
  }

  // -------------------------------------------------------------------------
  // Interactions
  // -------------------------------------------------------------------------
  interact(it) {
    this.game.audio.play('ui');
    if (it.id === 'portal') this.openPortal();
    else if (it.id === 'shrine') this.openShrine();
    else if (it.id === 'board') this.showStats = true;
    else if (it.id === 'kogane') this.openKogane();
    else if (it.npc) this.interactNpc(it.npc);
  }

  interactNpc(npc) {
    const save = this.game.save;
    if (npc.id === 'megumi') return this.openMegumi();
    if (npc.id === 'instructor') return this.openSpar();
    if (npc.id === 'researcher') return this.openResearch();
    if (npc.id === 'progression') return this.openShrine();
    // story NPCs
    const lines = [];
    if (npc.charId === 'yuji') {
      lines.push(['Yuji', save.data.story.cleared[0] ? 'We beat the womb. I keep thinking about the people we could not reach in time.' : 'First real mission soon. I am trying not to think about it.']);
      lines.push(['Yuji', save.data.unlocks.blackSparks ? 'Reinforce, then hit. Right as your fist lands. That little lag is everything.' : 'I unlocked Black Flash by accident the first time. Scared me more than the curse.']);
    } else if (npc.charId === 'nobara') {
      lines.push(['Nobara', 'I am not here to support anyone. My technique is the best one here.']);
      lines.push(['Nobara', 'Nails first, questions later. Mark them, then pull the hairpin.']);
    } else if (npc.charId === 'gojo') {
      lines.push(['Gojo', 'You are doing fine. Which is exactly what I would say if you were not.']);
      lines.push(['Gojo', 'Blue pulls. Red pushes. Put them together and the world politely steps aside.']);
    }
    this.openDialogue(lines);
  }

  openDialogue(lines, onEnd) {
    let idx = 0;
    const self = this;
    this.overlay = {
      update(dt) {
        if (input.wasPressed('confirm') || input.wasPressed('interact') || input.wasPressed('attack') || input.pointer.pressed) {
          idx++;
          self.game.audio.play('ui');
          if (idx >= lines.length) self.closeOverlay();
        }
        if (input.wasPressed('pause')) self.closeOverlay();
      },
      draw(ctx) {
        if (idx >= lines.length) return;
        const [speaker, body] = lines[idx];
        drawSpeakerPortrait(ctx, speaker, 24, 250);
        panel(ctx, 96, 250, 528, 92, { fill: 'rgba(8,10,16,0.96)', border: '#5b8cff', inner: false });
        text(ctx, speaker.toUpperCase(), 108, 266, { size: 9, color: '#ffd166' });
        wrapText(ctx, body, 108, 280, 500, 10, { size: 8, color: '#e8eef8', bold: false });
        text(ctx, `${idx + 1}/${lines.length}  — click / Enter`, 614, 332, { size: 6, align: 'right', color: '#93a0b8' });
      },
    };
    this.player.controlEnabled = false;
    this.world.paused = false;
    this.uiOverlay = this.overlay;
  }

  closeOverlay() {
    this.overlay = null;
    this.uiOverlay = null;
    if (this.player) this.player.controlEnabled = true;
    if (!this.game.save.data.seen.hubHint) {
      this.game.save.data.seen.hubHint = true;
      this.game.save.save();
      this.game.toast('Training dummies to the west — say hi with [J]. Cursed gate to the east.', {
        color: '#9fc0ff',
        life: 6,
      });
    }
  }

  // -------------------------------------------------------------------------
  // Cursed gate → run preparation
  // -------------------------------------------------------------------------
  openPortal() {
    const save = this.game.save;
    const self = this;
    const arcIdx = Math.min(save.data.story.arc, ARCS.length - 1);
    const state = {
      arc: arcIdx,
      diff: save.data.settings.difficulty || 'normal',
      tab: 'run',
    };
    const diefi = () => Object.values(DIFFICULTIES).filter((d) => save.data.unlocks.difficulties.includes(d.id) || d.unlock(save));
    this.overlay = {
      update(dt) {
        if (input.wasPressed('pause')) return self.closeOverlay();
        if (input.wasPressed('left')) { state.arc = Math.max(0, state.arc - 1); self.game.audio.play('ui'); }
        if (input.wasPressed('right')) { state.arc = Math.min(ARCS.length - 1, state.arc + 1); self.game.audio.play('ui'); }
        if (input.wasPressed('up') || input.wasPressed('down')) {
          const ds = diefi();
          const cur = ds.findIndex((d) => d.id === state.diff);
          state.diff = ds[(cur + (input.wasPressed('down') ? 1 : ds.length - 1)) % ds.length].id;
          self.game.audio.play('ui');
        }
        if (input.wasPressed('confirm') || input.wasPressed('interact') || input.wasPressed('attack')) {
          if (!isArcUnlocked(save, state.arc)) {
            self.game.toast('Clear the previous arc first.', { color: '#ff8a8a' });
            self.game.audio.play('deny');
            return;
          }
          self.startRun(state.arc, state.diff);
        }
        // tap zones: arc arrows / difficulty row / start button
        if (input.pointer.pressed) {
          const px = input.pointer.x;
          const py = input.pointer.y;
          if (py > 306 && px > 180 && px < 460) self.startRun(state.arc, state.diff);
          else if (py > 250 && py < 290 && px > 160 && px < 480) {
            const ds = diefi();
            const cur = ds.findIndex((d) => d.id === state.diff);
            state.diff = ds[(cur + 1) % ds.length].id;
          }
        }
      },
      draw(ctx) {
        screenShade(ctx, 0.72);
        panel(ctx, 46, 26, 548, 306, { fill: 'rgba(8,10,18,0.99)', border: '#b06bff', title: 'THE CURSED GATE — RUN PREPARATION' });
        text(ctx, 'Cursed energy is pooling behind the curtain. Choose where to step through.', 60, 54, {
          size: 7,
          color: '#b9c4d8',
          bold: false,
        });
        // arc selector
        const arc = ARCS[state.arc];
        const unlocked = isArcUnlocked(save, state.arc);
        panel(ctx, 60, 66, 240, 168, { fill: 'rgba(16,14,26,0.96)', border: unlocked ? '#5b8cff' : '#3a3f52', inner: false });
        text(ctx, `ARC ${state.arc + 1}`, 70, 82, { size: 7, color: '#8fd7ff' });
        text(ctx, '◀ ▶', 288, 82, { size: 7, align: 'right', color: '#93a0b8' });
        wrapText(ctx, arc.name, 70, 100, 220, 12, { size: 12, color: unlocked ? '#ffffff' : '#6a7488' });
        text(ctx, arc.subtitle, 70, 130, { size: 6, color: '#93a0b8' });
        wrapText(ctx, arc.intro, 70, 146, 220, 9, { size: 6, color: '#b9c4d8', bold: false });
        text(ctx, `${arc.rooms} rooms · boss: ${arc.boss}`, 70, 202, { size: 6, color: '#ff8a8a' });
        text(ctx, unlocked ? (save.data.story.cleared[state.arc] ? 'CLEARED' : 'AVAILABLE') : 'LOCKED', 70, 220, {
          size: 7,
          color: unlocked ? (save.data.story.cleared[state.arc] ? '#7cf0a0' : '#ffd166') : '#ff6b6b',
        });

        // character + resources
        panel(ctx, 312, 66, 266, 112, { fill: 'rgba(14,16,26,0.96)', border: '#2c3448', inner: false });
        const c = CHARACTERS[self.player.charId];
        text(ctx, `${c.name}`, 324, 84, { size: 10, color: '#ffffff' });
        text(ctx, c.title, 324, 96, { size: 6, color: '#93a0b8' });
        text(ctx, `HP ${self.player.maxHp}   CE ${self.player.maxCe}`, 324, 112, { size: 7, color: '#cfd8e6' });
        const mods = self.player.mods;
        text(ctx, `Run mods: DMG x${mods.dmgMult.toFixed(2)}  CE cost x${mods.ceCostMult.toFixed(2)}  BF x${mods.bfWindowMult.toFixed(2)}`, 324, 126, {
          size: 6,
          color: '#8fd7ff',
        });
        text(ctx, `Black Flash: ${self.player.blackSparks ? 'UNLOCKED' : 'locked (find the scroll)'}`, 324, 140, {
          size: 6,
          color: self.player.blackSparks ? '#ff6b8a' : '#6a7488',
        });
        text(ctx, `Domain: ${c.domain ? c.domain.name : '—'}`, 324, 154, { size: 6, color: '#c9a2ff' });
        text(ctx, `Tribute: ${save.data.tributeCurrency} 呪`, 324, 168, { size: 6, color: '#ffd166' });

        // difficulty
        panel(ctx, 312, 182, 266, 52, { fill: 'rgba(14,16,26,0.96)', border: '#2c3448', inner: false });
        const d = DIFFICULTIES[state.diff];
        text(ctx, `DIFFICULTY: ${d.name}  (↑↓)`, 324, 198, { size: 7, color: '#ffb03a' });
        wrapText(ctx, d.desc, 324, 210, 244, 9, { size: 6, color: '#9aa3b2', bold: false });

        // start
        const canStart = unlocked;
        panel(ctx, 180, 306, 280, 22, {
          fill: canStart ? 'rgba(60,30,110,0.95)' : 'rgba(20,22,30,0.9)',
          border: canStart ? '#b06bff' : '#3a3f52',
          inner: false,
        });
        text(ctx, canStart ? 'STEP THROUGH THE GATE' : 'ARC LOCKED', 320, 321, {
          size: 9,
          align: 'center',
          color: canStart ? '#ffffff' : '#6a7488',
        });
        text(ctx, 'Enter to start · ESC to leave', 320, 344, { size: 6, align: 'center', color: '#93a0b8' });
      },
    };
    this.player.controlEnabled = false;
    this.uiOverlay = this.overlay;
  }

  startRun(arcIndex, difficultyId) {
    this.game.audio.play('domain');
    this.closeOverlay();
    this.game.engine.go('dungeon', { arcIndex, difficultyId, charId: this.player.charId }, 0.4);
  }

  // -------------------------------------------------------------------------
  // Shrine of permanent blessings
  // -------------------------------------------------------------------------
  openShrine() {
    const save = this.game.save;
    const self = this;
    let menu;
    const rebuild = () => {
      const items = TRIBUTE_TRACKS.map((tr) => {
        const lvl = save.data.tribute[tr.id] || 0;
        const maxed = lvl >= tr.max;
        const cost = tr.cost(lvl);
        return {
          label: `${tr.name} ${'▮'.repeat(lvl)}${'▯'.repeat(Math.max(0, tr.max - lvl))}`,
          sub: maxed ? 'MAXED' : `${tr.desc} — ${cost} 呪`,
          color: tr.color,
          disabled: maxed || save.data.tributeCurrency < cost,
          onClick: () => {
            if (save.data.tributeCurrency >= cost && lvl < tr.max) {
              save.data.tributeCurrency -= cost;
              save.data.tribute[tr.id] = lvl + 1;
              save.save();
              self.game.audio.play('reward');
              self.applyTributeToPlayer();
              rebuild();
            }
          },
        };
      });
      if (!save.data.unlocks.blackSparks) {
        const cost = 120;
        items.push({
          label: 'Black Sparks Scroll — 120 呪',
          sub: 'PERMANENT: unlocks the Black Flash timing mechanic for every run',
          color: '#ff5a7a',
          disabled: save.data.tributeCurrency < cost,
          onClick: () => {
            if (save.data.tributeCurrency < cost) return;
            save.data.tributeCurrency -= cost;
            save.data.unlocks.blackSparks = true;
            save.save();
            if (self.player) self.player.blackSparks = true;
            self.game.audio.play('blackflash');
            self.game.toast('Black Sparks Scroll: reinforce, attack, then tap Shift on impact.', {
              color: '#ff5a7a',
              life: 6,
            });
            rebuild();
          },
        });
      }
      items.push({ label: 'Close', color: '#9aa3b2', onClick: () => self.closeOverlay() });
      menu = new VerticalMenu(items);
    };
    rebuild();
    this.overlay = {
      update(dt) {
        if (input.wasPressed('pause')) return self.closeOverlay();
        const it = menu.update(dt) || menu.handleTap(80, 110, 300, 24, 4);
        if (it) it.onClick?.();
      },
      draw(ctx) {
        screenShade(ctx, 0.75);
        panel(ctx, 60, 20, 520, 320, { fill: 'rgba(8,10,18,0.99)', border: '#ffd166', title: 'SHRINE OF PERMANENT BLESSINGS' });
        text(ctx, `Tribute: ${save.data.tributeCurrency} 呪`, 500, 44, { size: 9, align: 'right', color: '#ffd166' });
        menu.draw(ctx, 80, 108, 300, { rowH: 24 });
        panel(ctx, 396, 108, 172, 200, { fill: 'rgba(14,16,26,0.96)', border: '#3a3f52', inner: false });
        text(ctx, 'BLESSINGS', 408, 124, { size: 7, color: '#ffd166' });
        text(ctx, 'These persist', 408, 138, { size: 6, color: '#9aa3b2' });
        text(ctx, 'through every death', 408, 148, { size: 6, color: '#9aa3b2' });
        text(ctx, 'and every run.', 408, 158, { size: 6, color: '#9aa3b2' });
        const rows = [
          ['HP bonus', save.data.tribute.vitality * 6],
          ['CE bonus', save.data.tribute.reservoir * 5],
          ['Tech dmg', `+${save.data.tribute.focus * 3}%`],
          ['Move spd', `+${save.data.tribute.finesse * 2}%`],
          ['Tribute', `+${save.data.tribute.fortune * 8}%`],
          ['BF window', `+${save.data.tribute.spark * 5}%`],
        ];
        rows.forEach(([k, v], i) => {
          text(ctx, k, 408, 178 + i * 14, { size: 6, color: '#8b98b0' });
          text(ctx, `${v}`, 558, 178 + i * 14, { size: 6, align: 'right', color: '#e8eef8' });
        });
        text(ctx, 'ESC to close', 320, 332, { size: 6, align: 'center', color: '#93a0b8' });
      },
    };
    this.player.controlEnabled = false;
    this.uiOverlay = this.overlay;
  }

  applyTributeToPlayer() {
    const p = this.player;
    const tr = this.game.save.data.tribute;
    p.maxHp = Math.round(p.baseHp * (p.mods.maxHpMult || 1) + (p.mods.maxHpFlat || 0) + tr.vitality * 6);
    p.maxCe = Math.round(p.baseCe * (p.mods.maxCeMult || 1) + (p.mods.maxCeFlat || 0) + tr.reservoir * 5);
    p.hp = Math.min(p.hp, p.maxHp);
    p.ce = Math.min(p.ce, p.maxCe);
  }

  // -------------------------------------------------------------------------
  // Megumi — Ten Shadows taming
  // -------------------------------------------------------------------------
  openMegumi() {
    const save = this.game.save;
    const self = this;
    const tameable = SHIKIGAMI_ORDER.filter((id) => id !== 'divineDogs' && id !== 'rabbitEscape');
    const items = tameable.map((id) => {
      const def = SHIKIGAMI[id];
      const tamed = save.hasShikigami(id);
      return {
        label: `${def.name} ${tamed ? '✔' : ''}`,
        sub: tamed ? 'Tamed — summon available' : `${def.tame.rule === 'adapt' ? 'EXTREME' : 'Ritual'} · ${def.tame.desc}`,
        color: tamed ? '#7cf0a0' : id === 'mahoraga' ? '#ff5a5a' : '#a79bff',
        disabled: tamed,
        onClick: () => {
          if (tamed) return;
          self.confirmTame(id);
        },
      };
    });
    items.push({ label: 'Totality status', sub: 'Combination paths', color: '#ffd166', onClick: () => self.openTotality() });
    items.push({ label: 'Leave', color: '#9aa3b2', onClick: () => self.closeOverlay() });
    const menu = new VerticalMenu(items);
    this.overlay = {
      update(dt) {
        if (input.wasPressed('pause')) return self.closeOverlay();
        const it = menu.update(dt) || menu.handleTap(70, 100, 300, 24, 4);
        if (it) it.onClick?.();
      },
      draw(ctx) {
        screenShade(ctx, 0.75);
        panel(ctx, 46, 18, 548, 324, { fill: 'rgba(8,10,18,0.99)', border: '#a79bff', title: 'MEGUMI FUSHIGURO — TEN SHADOWS' });
        menu.draw(ctx, 70, 98, 320, { rowH: 24 });
        panel(ctx, 408, 96, 168, 210, { fill: 'rgba(14,16,26,0.96)', border: '#3a3f52', inner: false });
        const hovered = menu.items[menu.index];
        text(ctx, 'RITUAL', 420, 112, { size: 7, color: '#a79bff' });
        wrapText(ctx, hovered?.sub || '', 420, 128, 144, 9, { size: 6, color: '#b9c4d8', bold: false });
        text(ctx, 'Tamed shadows are', 420, 200, { size: 6, color: '#93a0b8' });
        text(ctx, 'permanent. You must', 420, 210, { size: 6, color: '#93a0b8' });
        text(ctx, 'defeat them in a real', 420, 220, { size: 6, color: '#93a0b8' });
        text(ctx, 'fight to bind them.', 420, 230, { size: 6, color: '#93a0b8' });
        text(ctx, `Agito: ${save.hasShikigami('divineDogs') && save.hasShikigami('nue') && save.hasShikigami('greatSerpent') ? 'available at 50% meter' : 'tame dogs + nue + serpent'}`, 420, 256, { size: 6, color: '#8fd7ff' });
        text(ctx, `Mahoraga: ${save.hasShikigami('mahoraga') ? 'summonable at 100%' : 'untamed'}`, 420, 268, { size: 6, color: '#ff8a8a' });
        text(ctx, 'ESC to leave', 320, 334, { size: 6, align: 'center', color: '#93a0b8' });
      },
    };
    this.player.controlEnabled = false;
    this.uiOverlay = this.overlay;
  }

  confirmTame(id) {
    const def = SHIKIGAMI[id];
    const self = this;
    const menu = new VerticalMenu([
      {
        label: 'Begin the ritual',
        color: '#ff8a8a',
        onClick: () => {
          self.closeOverlay();
          self.game.engine.go('tame', { shikigami: id, charId: self.player.charId }, 0.35);
        },
      },
      { label: 'Not yet', color: '#9aa3b2', onClick: () => self.openMegumi() },
    ]);
    this.overlay = {
      update(dt) {
        if (input.wasPressed('pause')) return self.openMegumi();
        const it = menu.update(dt) || menu.handleTap(150, 220, 340, 24, 4);
        if (it) it.onClick?.();
      },
      draw(ctx) {
        screenShade(ctx, 0.85);
        panel(ctx, 90, 90, 460, 190, { fill: 'rgba(16,10,22,0.99)', border: def.tame.rule === 'adapt' ? '#ff2a4a' : '#a79bff', title: `${def.name.toUpperCase()} — TAMING RITUAL` });
        wrapText(ctx, def.desc, 110, 122, 420, 10, { size: 8, color: '#e8eef8', bold: false });
        wrapText(ctx, def.tame.desc, 110, 150, 420, 10, { size: 7, color: '#ffd166', bold: false });
        text(ctx, `ENCOUNTER HP: ${def.tame.hp}  ·  ${def.tame.rule === 'adapt' ? 'EXTREME DIFFICULTY' : 'Defeat it to bind it'}`, 110, 186, {
          size: 7,
          color: def.tame.rule === 'adapt' ? '#ff5a5a' : '#a79bff',
        });
        menu.draw(ctx, 150, 216, 340, { rowH: 24 });
      },
    };
    this.uiOverlay = this.overlay;
  }

  openTotality() {
    const save = this.game.save;
    const self = this;
    const keys = Object.keys(TOTALITY);
    this.overlay = {
      update(dt) {
        if (input.wasPressed('pause') || input.wasPressed('confirm') || input.wasPressed('interact') || input.pointer.pressed) self.openMegumi();
      },
      draw(ctx) {
        screenShade(ctx, 0.82);
        panel(ctx, 60, 40, 520, 270, { fill: 'rgba(8,10,18,0.99)', border: '#ffd166', title: 'TOTALITY PATHS' });
        let y = 68;
        for (const k of keys) {
          const t = TOTALITY[k];
          const ok = t.requires.every((r) => save.hasShikigami(r));
          text(ctx, `${t.name} — ${ok ? 'LEARNED' : 'LOCKED'}`, 78, y, { size: 8, color: ok ? '#7cf0a0' : '#ff8a8a' });
          y += 10;
          y += wrapText(ctx, t.desc, 86, y, 460, 9, { size: 6, color: '#b9c4d8', bold: false });
          y += 4;
        }
        text(ctx, 'Enter to return', 320, 300, { size: 6, align: 'center', color: '#93a0b8' });
      },
    };
    this.uiOverlay = this.overlay;
  }

  // -------------------------------------------------------------------------
  // Sparring
  // -------------------------------------------------------------------------
  openSpar() {
    const save = this.game.save;
    const self = this;
    const opponents = [
      { id: 'kusakabe', name: 'Kusakabe (instructor)', locked: false, desc: 'A measured swordsman. Punishes greedy attacks.' },
      ...PLAYABLE_ORDER.filter((id) => id !== this.player.charId).map((id) => ({
        id,
        name: CHARACTERS[id].name,
        locked: !save.hasCharacter(id),
        desc: CHARACTERS[id].blurb,
      })),
    ];
    let skill = 0.55;
    const skillNames = ['Friendly', 'Serious', 'Lethal'];
    const menu = new VerticalMenu(
      opponents.map((o) => ({
        label: o.name,
        sub: o.locked ? 'Locked' : o.desc,
        color: o.locked ? '#5b6478' : '#9fc0ff',
        disabled: o.locked,
        onClick: () => {
          self.closeOverlay();
          self.game.engine.go('spar', { opponent: o.id, charId: self.player.charId, skill }, 0.35);
        },
      })).concat([{ label: 'Leave', color: '#9aa3b2', onClick: () => self.closeOverlay() }])
    );
    this.overlay = {
      update(dt) {
        if (input.wasPressed('pause')) return self.closeOverlay();
        if (input.wasPressed('left') || input.wasPressed('right')) {
          const i = ['Friendly', 'Serious', 'Lethal'].indexOf(skillNames[Math.round((skill - 0.4) / 0.25)]);
          skill = [0.4, 0.65, 0.9][(i + (input.wasPressed('right') ? 1 : 2)) % 3];
          self.game.audio.play('ui');
        }
        const it = menu.update(dt) || menu.handleTap(70, 96, 300, 22, 4);
        if (it) it.onClick?.();
      },
      draw(ctx) {
        screenShade(ctx, 0.78);
        panel(ctx, 46, 16, 548, 328, { fill: 'rgba(8,10,18,0.99)', border: '#5b8cff', title: 'SPARRING — TRAINING HALL' });
        menu.draw(ctx, 70, 96, 300, { rowH: 22, gap: 3 });
        panel(ctx, 392, 96, 184, 170, { fill: 'rgba(14,16,26,0.96)', border: '#3a3f52', inner: false });
        text(ctx, 'RULES', 404, 112, { size: 7, color: '#ffd166' });
        wrapText(ctx, 'Real combat. First to zero HP loses. Your opponent uses their actual techniques, dodges, and attempts Black Flash.', 404, 128, 160, 9, { size: 6, color: '#b9c4d8', bold: false });
        text(ctx, `DIFFICULTY: ${['Friendly', 'Serious', 'Lethal'][skill <= 0.4 ? 0 : skill <= 0.65 ? 1 : 2]}`, 404, 200, { size: 7, color: '#8fd7ff' });
        text(ctx, '← → to change', 404, 212, { size: 6, color: '#93a0b8' });
        text(ctx, 'ESC to leave', 320, 334, { size: 6, align: 'center', color: '#93a0b8' });
      },
    };
    this.player.controlEnabled = false;
    this.uiOverlay = this.overlay;
  }

  // -------------------------------------------------------------------------
  // Technique research
  // -------------------------------------------------------------------------
  openResearch() {
    const self = this;
    const c = CHARACTERS[this.player.charId];
    const menu = new VerticalMenu([
      { label: 'Mechanics reference', onClick: () => self.openResearchDetail('mechanics') },
      { label: `${c.name} — kit`, onClick: () => self.openResearchDetail('kit') },
      { label: 'Enemy archive', onClick: () => self.openResearchDetail('enemies') },
      { label: 'Leave', color: '#9aa3b2', onClick: () => self.closeOverlay() },
    ]);
    this.overlay = {
      update(dt) {
        if (input.wasPressed('pause')) return self.closeOverlay();
        const it = menu.update(dt) || menu.handleTap(80, 120, 300, 24, 4);
        if (it) it.onClick?.();
      },
      draw(ctx) {
        screenShade(ctx, 0.75);
        panel(ctx, 60, 40, 520, 280, { fill: 'rgba(8,10,18,0.99)', border: '#8fd7ff', title: 'TECHNIQUE RESEARCH — SHOKO IEIRI' });
        menu.draw(ctx, 80, 118, 300, { rowH: 24 });
        text(ctx, 'Cursed energy is a resource.', 400, 130, { size: 7, color: '#8fd7ff' });
        text(ctx, 'Black Flash raises output.', 400, 146, { size: 6, color: '#b9c4d8' });
        text(ctx, 'Domains rewrite rules.', 400, 160, { size: 6, color: '#b9c4d8' });
        text(ctx, 'ESC to leave', 320, 300, { size: 6, align: 'center', color: '#93a0b8' });
      },
    };
    this.player.controlEnabled = false;
    this.uiOverlay = this.overlay;
  }

  openResearchDetail(kind) {
    const self = this;
    const lines = [];
    if (kind === 'mechanics') {
      lines.push('Active frames: damage only occurs during an attack\'s active window. Telegraphs are real time.');
      lines.push('Reinforcement costs 16 CE and drains 1.6 CE/s. It adds 25% damage, 15% damage reduction and enables Black Flash.');
      lines.push('Black Flash: with the scroll unlocked, press Shift as your reinforced attack lands. Success deals 2.6x damage and refunds CE.');
      lines.push('Perfect dodge: dashing into an attack within the first 0.19s negates it and restores CE.');
      lines.push('Domains clash when both expand. Your remaining CE and health decide the winner.');
    } else if (kind === 'kit') {
      const c = CHARACTERS[this.player.charId];
      c.abilities.forEach((a, i) => lines.push(`[${i + 1}] ${a.name} — ${a.desc}`));
      lines.push(`[R] ${c.ultimate?.name} — ${c.ultimate?.desc}`);
      if (c.domain) lines.push(`[F] ${c.domain.name} — ${c.domain.desc}`);
    } else {
      lines.push('Fly Heads harass from range. Close the gap or shoot them down.');
      lines.push('Bloated Husks explode on death. Kill them from a distance.');
      lines.push('Curse Menders heal other curses — kill them first.');
      lines.push('Cursed Brutes are armoured: interrupt their slam during the wind-up.');
      lines.push('Mahoraga adapts to the attack types it survives. Vary your damage.');
    }
    let i = 0;
    this.overlay = {
      update(dt) {
        if (input.wasPressed('pause') || input.wasPressed('confirm') || input.wasPressed('interact') || input.pointer.pressed) self.openResearch();
      },
      draw(ctx) {
        screenShade(ctx, 0.8);
        panel(ctx, 70, 50, 500, 260, { fill: 'rgba(8,10,18,0.99)', border: '#8fd7ff', title: 'REFERENCE' });
        let y = 80;
        for (const l of lines) y += wrapText(ctx, l, 90, y, 460, 10, { size: 7, color: '#cfd8e6', bold: false }) + 4;
        text(ctx, 'Enter to return', 320, 292, { size: 6, align: 'center', color: '#93a0b8' });
      },
    };
    this.uiOverlay = this.overlay;
  }

  // -------------------------------------------------------------------------
  // Kogane / Culling Games
  // -------------------------------------------------------------------------
  openKogane() {
    const save = this.game.save;
    const self = this;
    const colonies = [
      { id: 'tokyo1', name: 'Tokyo Colony No. 1', boss: 'higuruma' },
      { id: 'tokyo2', name: 'Tokyo Colony No. 2', boss: 'ishigori' },
      { id: 'sendai', name: 'Sendai Colony', boss: 'uro' },
    ];
    const menu = new VerticalMenu([
      ...colonies.map((c) => ({
        label: c.name,
        sub: save.data.culling.colonies.includes(c.id) ? 'Enter colony (points awarded on completion)' : 'Locked — clear more story arcs',
        color: save.data.culling.colonies.includes(c.id) ? '#ffd166' : '#5b6478',
        disabled: !save.data.culling.colonies.includes(c.id),
        onClick: () => {
          self.closeOverlay();
          self.game.engine.go('dungeon', { arcIndex: 5, difficultyId: save.data.settings.difficulty, charId: self.player.charId, culling: true, colonyId: c.id }, 0.4);
        },
      })),
      { label: 'Add a rule (100 points)', sub: 'Raise colony difficulty for extra rewards', color: '#8fd7ff', disabled: save.data.culling.points < 100, onClick: () => { save.data.culling.points -= 100; save.data.culling.rules.push('Hunted'); save.save(); self.game.toast('Rule added: Hunted — elites appear more often'); self.openKogane(); } },
      { label: 'Leave', color: '#9aa3b2', onClick: () => self.closeOverlay() },
    ]);
    this.overlay = {
      update(dt) {
        if (input.wasPressed('pause')) return self.closeOverlay();
        const it = menu.update(dt) || menu.handleTap(70, 100, 330, 24, 4);
        if (it) it.onClick?.();
      },
      draw(ctx) {
        screenShade(ctx, 0.75);
        panel(ctx, 46, 24, 548, 312, { fill: 'rgba(10,10,6,0.99)', border: '#ffd166', title: 'KOGANE — CULLING GAMES INTERFACE' });
        text(ctx, `POINTS: ${save.data.culling.points}`, 480, 48, { size: 10, align: 'right', color: '#ffd166' });
        menu.draw(ctx, 70, 100, 330, { rowH: 24 });
        panel(ctx, 420, 100, 156, 200, { fill: 'rgba(16,16,10,0.96)', border: '#5a5232', inner: false });
        text(ctx, 'RULERS', 432, 116, { size: 7, color: '#ffd166' });
        const names = { higuruma: 'Higuruma', hakari: 'Hakari', kashimo: 'Kashimo', ishigori: 'Ishigori', uro: 'Uro', you: 'YOU' };
        let py = 130;
        for (const [id, pts] of Object.entries(save.data.culling.participants || {})) {
          const label = names[id] || id;
          text(ctx, label, 432, py, { size: 6, color: id === 'you' ? '#7cf0a0' : '#cfc8a8' });
          text(ctx, String(pts), 566, py, { size: 6, align: 'right', color: id === 'you' ? '#7cf0a0' : '#ffd166' });
          py += 10;
        }
        text(ctx, 'RULES', 432, py + 8, { size: 7, color: '#ffd166' });
        const rules = ['1. Kill or complete objectives for points.', '2. 100 points lets you add a rule.', '3. Colonies are linked; progress is permanent.'].concat(save.data.culling.rules.map((r, i) => `${i + 4}. ${r}`));
        let y = py + 22;
        for (const r of rules) y += wrapText(ctx, r, 432, y, 132, 9, { size: 6, color: '#cfc8a8', bold: false }) + 4;
        text(ctx, 'ESC to leave', 320, 320, { size: 6, align: 'center', color: '#93a0b8' });
      },
    };
    this.player.controlEnabled = false;
    this.uiOverlay = this.overlay;
  }

  // -------------------------------------------------------------------------
  // Rendering
  // -------------------------------------------------------------------------
  draw(ctx) {
    super.draw(ctx);
    this.drawNpcs(ctx);
    this.drawHubHud(ctx);
    if (this.showStats && !this.uiOverlay) this.drawTrainingPanel(ctx);
  }

  drawNpcs(ctx) {
    const cam = this.world.camera;
    ctx.save();
    ctx.translate(-Math.round(cam.x), -Math.round(cam.y));
    for (const n of this.npcs) {
      const look = n.charId ? CHARACTERS[n.charId].look : NPC_LOOKS[n.id];
      const pose = humanoidPose(n.moving ? 'walk' : 'idle', this.t + n.t, { facingX: n.facingX, speed: n.moving ? 1 : 0 });
      drawHumanoid(ctx, { x: n.x, y: n.y, look, facingX: n.facingX, pose, t: this.t + n.t, scale: 1.15 });
      // name plate when close
      if (this.player && dist(this.player.x, this.player.y, n.x, n.y) < 70) {
        text(ctx, n.name, n.x, n.y - 40, { size: 6, align: 'center', color: '#dfe6f2' });
      }
    }
    ctx.restore();
  }

  drawHubHud(ctx) {
    const save = this.game.save;
    const data = save.data;
    const arc = ARCS[Math.min(data.story.arc, ARCS.length - 1)];
    panel(ctx, 214, 6, 212, 24, { fill: 'rgba(8,10,16,0.72)', border: '#2c3448', inner: false });
    text(ctx, `ARC ${data.story.arc + 1}`, 224, 17, { size: 6, color: '#8fd7ff' });
    text(ctx, arc.name, 224, 26, { size: 8, color: '#e8eef8' });
    text(ctx, `${data.tributeCurrency} 呪`, 416, 22, { size: 8, align: 'right', color: '#ffd166' });
    // objective
    if (!this.uiOverlay) {
      text(ctx, 'Explore Jujutsu High · E to interact · walk into the gate to start a run', 320, 344, {
        size: 6,
        align: 'center',
        color: '#8b98b0',
      });
    }
    // nearby name
    if (this.nearest && this.nearest.npc) {
      text(ctx, this.nearest.npc.name, 320, 264, { size: 7, align: 'center', color: '#9fc0ff' });
    }
    // unlock notifications
    const untamed = SHIKIGAMI_ORDER.filter((id) => !save.hasShikigami(id)).length;
    if (untamed > 0) {
      text(ctx, `Ten Shadows: ${10 - untamed}/10 tamed`, 10, 60, { size: 6, color: '#a79bff' });
    }
    if (save.data.culling.started) {
      text(ctx, `Culling points: ${data.culling.points}`, 10, 70, { size: 6, color: '#ffd166' });
    }
  }

  drawTrainingPanel(ctx) {
    const st = this.world.stats;
    const x = 396;
    const y = 176;
    panel(ctx, x, y, 234, 128, { fill: 'rgba(8,10,16,0.86)', border: '#4a5570', title: 'TRAINING SESSION' });
    const rows = [
      ['Damage per hit', st.hits ? Math.round(st.totalDamage / st.hits) : 0],
      ['Total damage', formatNum(st.totalDamage)],
      ['Highest hit', formatNum(st.highestHit)],
      ['Combo / longest', `${st.combo} / ${st.longestCombo}`],
      ['Dodges', `${st.dodges} (${st.perfectDodges} perfect)`],
      ['CE spent', Math.round(st.ceSpent)],
      ['Black Flash', `${st.bfSuccess} / ${st.bfAttempts} (miss ${st.bfFail})`],
      ['Technique / summon', `${formatNum(st.techDamage)} / ${formatNum(st.summonDamage)}`],
    ];
    rows.forEach(([k, v], i) => {
      const yy = y + 34 + i * 11;
      text(ctx, k, x + 8, yy, { size: 6, color: '#8b98b0' });
      text(ctx, `${v}`, x + 226, yy, { size: 6, align: 'right', color: '#e8eef8' });
    });
    text(ctx, 'Rewards are practice only · R to reset', x + 8, y + 122, { size: 5, color: '#6f7a92' });
    if (input.wasPressed('a1') && false) {
      /* noop */
    }
  }
}

const NPC_LOOKS = {
  megumi: CHARACTERS.megumi.look,
  instructor: {
    skin: '#e8c0a0', hair: '#2a2a2a', hairStyle: 'buzz', top: '#2a2a30', topDark: '#1a1a20', topLight: '#3a3a44',
    bottom: '#22222a', bottomDark: '#16161c', accent: '#c9c2b0', eye: '#f0f0f0', weapon: 'katana',
  },
  researcher: {
    skin: '#f0d0c0', hair: '#6a4a3a', hairStyle: 'long', top: '#e8e8ee', topDark: '#c8c8d0', topLight: '#ffffff',
    bottom: '#3a3a44', bottomDark: '#2a2a32', accent: '#8fd7ff', eye: '#dfe6f2', longCoat: true,
  },
  progression: {
    skin: '#e8c8a8', hair: '#2a2a2a', hairStyle: 'slick', top: '#2a2f3a', topDark: '#1a1f28', topLight: '#3a4150',
    bottom: '#22262e', bottomDark: '#16191f', accent: '#8fd7ff', eye: '#dfe6f2',
  },
};

function drawSpeakerPortrait(ctx, speaker, x, y) {
  const key = (speaker || '').toLowerCase();
  let look = NPC_LOOKS.megumi;
  if (key.includes('yuji')) look = CHARACTERS.yuji.look;
  else if (key.includes('nobara')) look = CHARACTERS.nobara.look;
  else if (key.includes('gojo')) look = CHARACTERS.gojo.look;
  else if (key.includes('sukuna')) look = CHARACTERS.sukuna.look;
  else if (key.includes('kusakabe')) look = NPC_LOOKS.instructor;
  else if (key.includes('ieiri') || key.includes('shoko')) look = NPC_LOOKS.researcher;
  else if (key.includes('ijichi')) look = NPC_LOOKS.progression;
  panel(ctx, x, y, 64, 92, { fill: 'rgba(16,18,28,0.96)', border: '#3a4560', inner: false });
  const pose = humanoidPose('idle', performance.now() / 1000, { facingX: 1 });
  drawHumanoid(ctx, { x: x + 32, y: y + 86, look, facingX: 1, pose, t: performance.now() / 1000, scale: 2.2 });
}
