// ---------------------------------------------------------------------------
// dungeon.js (scene) — the roguelite run: room spawning, combat, rewards,
// shops, events, branching map, bosses and run end.
// ---------------------------------------------------------------------------

import { ArenaScene } from './arenaBase.js';
import { input } from '../core/input.js';
import { Run } from '../game/run.js';
import { ROOM_TYPES, roomEnemyList, nodeById, bossForArc, cullingBossFor } from '../game/dungeon.js';
import { ENEMIES, BOSSES, ELITE_MODS } from '../data/enemies.js';
import { ARCS } from '../data/story.js';
import { CHARACTERS } from '../data/characters.js';
import { text, panel, bar, wrapText, cardRow, cardRowHit, VerticalMenu, screenShade, FONT } from '../ui/ui.js';
import { clamp, dist, formatNum } from '../core/util.js';
import { defaultMods, RARITY } from '../data/upgrades.js';

const THEMES = ['sewer', 'forest', 'city', 'shibuya', 'colony', 'colony', 'shrine'];

export class DungeonScene extends ArenaScene {
  constructor(game, params = {}) {
    super(game, params);
    this.params = params;
    this.state = 'fight';
    this.stateT = 0;
    this.rewardChoices = [];
    this.rewardIndex = 0;
    this.mapMenu = null;
    this.eventChoices = null;
    this.roomNode = null;
    this.pendingVictory = false;
    this.bossLine = null;
  }

  enter() {
    const arcIndex = this.params.arcIndex ?? 0;
    const run = new Run(this.game, {
      charId: this.params.charId || this.game.selectedChar || 'yuji',
      arcIndex,
      difficultyId: this.params.difficultyId || 'normal',
      seed: this.params.seed,
      culling: this.params.culling,
      colonyId: this.params.colonyId,
    });
    this.run = run;
    this.createWorld({
      arena: { x: 0, y: 26, w: 640, h: 322 },
      theme: THEMES[arcIndex] || 'colony',
      decor: this.decorForTheme(arcIndex),
      obstacles: [],
      seed: run.seed,
    });
    this.createPlayer({
      charId: run.charId,
      x: 90,
      y: 200,
      mods: run.mods,
      run,
    });
    this.world.onBossDefeated = (boss) => this.onBossDefeated(boss);
    this.world.scene = this;
    this.runNode(run.currentNodeId);
  }

  decorForTheme(arc) {
    if (arc === 0) return [{ type: 'pillar', x: 60, y: 120 }, { type: 'pillar', x: 580, y: 120 }];
    if (arc === 1) return [{ type: 'pillar', x: 560, y: 320 }, { type: 'pillar', x: 80, y: 320 }];
    if (arc === 2) return [{ type: 'tree', x: 70, y: 330, s: 1.2 }, { type: 'tree', x: 570, y: 340, s: 1.3 }];
    if (arc === 3) return [{ type: 'crates', x: 60, y: 330 }, { type: 'banner', x: 600, y: 300, color: '#7a1a1a' }];
    return [{ type: 'crates', x: 570, y: 330 }, { type: 'pillar', x: 80, y: 330 }];
  }

  // -------------------------------------------------------------------------
  runNode(nodeId) {
    this.run.moveTo(nodeId);
    this.roomNode = this.run.currentNode;
    this.state = 'fight';
    this.stateT = 0;
    this.rewardChoices = [];
    this.eventChoices = null;
    clearEnemies(this.world);
    const node = this.roomNode;
    const t = ROOM_TYPES[node.type];
    this.roomLabel = `${t.name.toUpperCase()}  ·  Floor ${node.layer + 1}/${this.run.dungeon.floors}`;
    const p = this.player;
    p.x = 90;
    p.y = 200;
    p.dead = false;
    p.spawnT = 0.3;

    if (node.type === 'combat' || node.type === 'elite' || node.type === 'boss') {
      this.spawnEnemies(node);
      if (node.type === 'boss') this.beginBossIntro();
      else this.game.audio.play('ui');
    } else if (node.type === 'heal') {
      const heal = Math.round(p.maxHp * 0.35);
      p.heal(heal);
      this.game.audio.play('heal');
      this.game.toast(`Recovered ${heal} HP`, { color: '#7cf0a0' });
      this.world.fx.ring(p.x, p.y - 8, 34, '#7cf0a0', 0.6, 3, true);
      this.completeRoom();
    } else if (node.type === 'ce') {
      p.ce = p.maxCe;
      this.game.audio.play('ce');
      this.game.toast('Cursed energy restored', { color: '#7ec8ff' });
      this.completeRoom();
    } else if (node.type === 'upgrade') {
      this.run.clearCurrentRoom();
      this.openRewards('upgrade');
    } else if (node.type === 'shop') {
      this.run.clearCurrentRoom();
      this.openShop();
    } else if (node.type === 'event') {
      this.run.clearCurrentRoom();
      this.openEvent();
    } else {
      this.completeRoom();
    }
  }

  beginBossIntro() {
    const boss = this.world.enemies.find((e) => e.isBoss);
    if (!boss) return;
    this.state = 'bossIntro';
    this.stateT = 0;
    this.boss = boss;
    boss.introT = 2.0;
    boss.invulnT = 2.0;
    this.bossLine = boss.enemyDef?.intro || '';
    this.game.audio.play('boss');
    this.world.fx.flash('#ffffff', 0.15);
    this.world.fx.shake(6, 0.6);
  }

  spawnEnemies(node) {
    const rng = this.run.rng;
    const list = roomEnemyList(node, this.run, rng);
    const threat = { hpMult: 1 + node.layer * 0.1, dmg: 1 };
    const diff = this.run.diff;
    list.forEach((entry, i) => {
      if (entry.bossId) {
        const def = entry.bossId === 'colonyBoss' ? cullingBossFor(0) : BOSSES[entry.bossId];
        const boss = this.world.spawnEnemy(def, 520, 180, { hpMult: 1, brain: 'boss', dmgMult: diff.enemyDmg });
        boss.isElite = true;
        boss.ultMeter = 0;
        boss.moveCd = {};
      } else {
        const def = ENEMIES[entry.id];
        if (!def) return;
        const ang = (i / Math.max(1, list.length)) * Math.PI * 2;
        const x = clamp(380 + Math.cos(ang) * (60 + rng.range(0, 90)), 60, 590);
        const y = clamp(180 + Math.sin(ang) * (50 + rng.range(0, 60)), 60, 320);
        const mod = entry.mod ? ELITE_MODS[entry.mod] : null;
        const e = this.world.spawnEnemy(def, x, y, {
          brain: 'enemy',
          dmgMult: (1 + node.layer * 0.05) * diff.enemyDmg,
          hpMult: (1 + node.layer * 0.1) * diff.enemyHp * (mod?.hp || 1) * (entry.elite ? 1.8 : 1),
        });
        if (entry.elite) {
          e.isElite = true;
          e.maxHp = Math.round(e.maxHp * 1.5);
          e.hp = e.maxHp;
          e.scale *= 1.25;
          e.radius *= 1.15;
          e.dmgMult *= 1.2;
        }
        if (mod) {
          e.eliteMod = mod.id;
          if (mod.speed) e.speed *= mod.speed;
          if (mod.armor) e.armor = Math.max(e.armor, mod.armor);
          if (mod.shield) {
            e.shield = mod.shield;
            e.maxShield = mod.shield;
          }
          if (mod.lifesteal) e.lifesteal = mod.lifesteal;
          if (mod.explodeOnDeath) e.enemyDef = { ...def, explodeOnDeath: mod.explodeOnDeath };
          e.auraColor = mod.tint;
          e.aura = 0.5;
        }
        if (this.run.isCulling) e.pointsValue = 5 + node.layer * 2;
      }
    });
    if (this.run.isCulling) this.roomLabel += '  ·  CULLING GAMES';
  }

  // -------------------------------------------------------------------------
  updateScene(dt) {
    const run = this.run;
    if (!run) return;
    this.stateT += dt;

    // sync stats
    const st = this.world.stats;
    run.damageDealt = st.totalDamage;
    run.highestHit = st.highestHit;
    run.kills = Math.max(run.kills, st.kills);
    run.bfSuccess = st.bfSuccess;

    if (this.state === 'bossIntro') {
      if (this.stateT > 2.0) {
        this.state = 'fight';
        this.stateT = 0;
        this.boss.introT = 0;
      }
      return;
    }

    if (this.state === 'fight') {
      const alive = this.world.enemies.some((e) => !e.dead);
      if (!alive) {
        this.stateT = 0;
        this.state = 'clearing';
      }
      return;
    }

    if (this.state === 'clearing') {
      if (this.stateT > 0.9) {
        this.completeRoom();
      }
      return;
    }

    if (this.state === 'reward') {
      this.updateReward(dt);
      return;
    }
    if (this.state === 'rewardPicked') {
      if (this.stateT > 0.4) this.openMap();
      return;
    }
    if (this.state === 'map') {
      this.updateMap(dt);
      return;
    }
    if (this.state === 'shop') {
      this.updateShop(dt);
      return;
    }
    if (this.state === 'event') {
      this.updateEvent(dt);
      return;
    }
    if (this.state === 'victoryWait') {
      if (this.stateT > 1.4) this.finishRun(true);
      return;
    }
    if (this.state === 'defeatWait') {
      if (this.stateT > 1.2) this.finishRun(false);
    }
  }

  completeRoom() {
    const node = this.roomNode;
    this.run.clearCurrentRoom();
    const st = this.world.stats;
    this.run.techniques = st.techniques;
    if (node.type === 'boss') return;
    // restore some resources between rooms
    this.player.hp = Math.min(this.player.maxHp, this.player.hp + this.player.maxHp * 0.06);
    this.player.ce = Math.min(this.player.maxCe, this.player.ce + 18);
    const t = ROOM_TYPES[node.type];
    if (node.type === 'combat' || node.type === 'elite' || node.type === 'upgrade' || node.type === 'heal' || node.type === 'ce') {
      this.openRewards(node.type);
    } else {
      this.openMap();
    }
  }

  // -------------------------------------------------------------------------
  // Rewards — three upgrade cards
  // -------------------------------------------------------------------------
  openRewards(kind) {
    const force = kind === 'elite' ? 'rare' : null;
    const choices = this.run.rollUpgrades(3, force);
    this.rewardChoices = choices.map((u) => ({
      ...u,
      title: u.name,
      desc: u.desc,
      color: RARITY[u.rarity].color,
      rarity: u.rarity,
      cat: u.cat,
    }));
    this.rewardIndex = 0;
    this.state = 'reward';
    this.stateT = 0;
    this.rewardKind = kind;
    this.game.audio.play('reward');
    this.world.paused = false;
  }

  updateReward(dt) {
    const cards = this.rewardChoices;
    if (!cards.length) {
      this.openMap();
      return;
    }
    if (input.wasPressed('left')) this.rewardIndex = (this.rewardIndex + cards.length - 1) % cards.length;
    if (input.wasPressed('right')) this.rewardIndex = (this.rewardIndex + 1) % cards.length;
    const tap = cardRowHit(cards, { x: 60, y: 90, w: 520, h: 170, gap: 14 });
    if (tap >= 0) this.rewardIndex = tap;
    if (input.wasPressed('confirm') || input.wasPressed('attack') || input.wasPressed('interact') || (tap >= 0 && input.pointer.pressed)) {
      this.pickReward(cards[this.rewardIndex]);
    }
  }

  pickReward(card) {
    this.run.applyUpgrade(card, this.player);
    this.game.audio.play('pickup');
    this.game.toast(`Acquired: ${card.name}`, { color: card.color });
    this.world.fx.flash(card.color, 0.12);
    this.state = 'rewardPicked';
    this.stateT = 0;
  }

  // -------------------------------------------------------------------------
  // Map — branching route choice
  // -------------------------------------------------------------------------
  openMap() {
    this.state = 'map';
    this.stateT = 0;
    this.mapIndex = 0;
    this.mapChoices = this.run.nextChoices();
    if (!this.mapChoices.length) {
      // no route: finish (should not happen if graph is valid)
      this.finishRun(true);
      return;
    }
    this.game.audio.play('ui');
  }

  updateMap(dt) {
    const choices = this.mapChoices || [];
    if (!choices.length) return;
    if (input.wasPressed('left') || input.wasPressed('up')) this.mapIndex = (this.mapIndex + choices.length - 1) % choices.length;
    if (input.wasPressed('right') || input.wasPressed('down')) this.mapIndex = (this.mapIndex + 1) % choices.length;
    // tap
    if (input.pointer.pressed) {
      const px = input.pointer.x;
      const py = input.pointer.y;
      choices.forEach((c, i) => {
        const cx = 300;
        const cy = 110 + i * 74;
        if (px > 180 && px < 460 && py > cy - 26 && py < cy + 26) {
          this.mapIndex = i;
          this.chooseNode(choices[i]);
        }
      });
    }
    if (input.wasPressed('confirm') || input.wasPressed('interact') || input.wasPressed('attack')) {
      this.chooseNode(choices[this.mapIndex]);
    }
  }

  chooseNode(node) {
    this.game.audio.play('domain');
    this.state = 'fight';
    this.runNode(node.id);
  }

  // -------------------------------------------------------------------------
  // Shop
  // -------------------------------------------------------------------------
  openShop() {
    const run = this.run;
    const self = this;
    const items = [
      {
        label: 'Healing draught',
        sub: 'Restore 45% HP',
        color: '#7cf0a0',
        disabled: run.tribute < 20,
        onClick: () => { if (run.tribute >= 20) { run.tribute -= 20; self.player.heal(self.player.maxHp * 0.45); self.game.audio.play('heal'); self.openShop(); } },
      },
      {
        label: 'Cursed energy flask',
        sub: 'Refill all CE',
        color: '#7ec8ff',
        disabled: run.tribute < 15,
        onClick: () => { if (run.tribute >= 15) { run.tribute -= 15; self.player.ce = self.player.maxCe; self.game.audio.play('ce'); self.openShop(); } },
      },
      {
        label: 'Technique scroll',
        sub: '3 upgrade choices (40 tribute)',
        color: '#b06bff',
        disabled: run.tribute < 40,
        onClick: () => { if (run.tribute >= 40) { run.tribute -= 40; self.openRewards('upgrade'); } },
      },
      {
        label: 'Permanent tribute +40',
        sub: 'Bank tribute into your permanent pool (60)',
        color: '#ffd166',
        disabled: run.tribute < 60,
        onClick: () => { if (run.tribute >= 60) { run.tribute -= 60; self.run.addTribute(40); self.game.audio.play('reward'); self.openShop(); } },
      },
      { label: 'Leave', color: '#9aa3b2', onClick: () => self.openMap() },
    ];
    this.shopMenu = new VerticalMenu(items);
    this.state = 'shop';
    this.stateT = 0;
  }

  updateShop(dt) {
    const it = this.shopMenu.update(dt) || this.shopMenu.handleTap(140, 110, 360, 24, 4);
    if (it) it.onClick?.();
  }

  // -------------------------------------------------------------------------
  // Events
  // -------------------------------------------------------------------------
  openEvent() {
    const run = this.run;
    const events = [
      {
        title: 'A dying sorcerer',
        text: 'A sorcerer is slumped against the wall. "Take it. I will not need it where I am going."',
        options: [
          { label: 'Take the tribute (+45 tribute)', fn: () => { run.addTribute(45); this.game.toast('+45 tribute', { color: '#ffd166' }); } },
          { label: 'Ask about the curse (+1 upgrade)', fn: () => { this.openRewards('upgrade'); return true; } },
        ],
      },
      {
        title: 'Cursed spring',
        text: 'Black water bubbles from the floor. It smells of iron and something older.',
        options: [
          { label: 'Drink (heal 60%, gain 30 CE)', fn: () => { this.player.heal(this.player.maxHp * 0.6); this.player.ce = Math.min(this.player.maxCe, this.player.ce + 30); this.game.toast('The water burns, then soothes.', { color: '#7cf0a0' }); } },
          { label: 'Bottle it (+25 tribute)', fn: () => { run.addTribute(25); } },
        ],
      },
      {
        title: 'Kogane appears',
        text: '"A small correction to the rules. Points may be exchanged for power."',
        options: [
          { label: 'Trade points for an upgrade (requires 80)', fn: () => { if (run.cullingPoints >= 80) { run.cullingPoints -= 80; this.openRewards('upgrade'); return true; } this.game.toast('Not enough points', { color: '#ff8a8a' }); } },
          { label: 'Refuse', fn: () => {} },
        ],
      },
    ];
    this.event = events[Math.floor(Math.random() * events.length)];
    this.eventMenu = new VerticalMenu(
      this.event.options.map((o) => ({
        label: o.label,
        onClick: () => {
          const keepOpen = o.fn?.();
          if (!keepOpen) {
            const node = this.roomNode;
            this.state = 'eventDone';
            this.openMap();
          }
        },
      }))
    );
    this.state = 'event';
    this.stateT = 0;
  }

  updateEvent(dt) {
    const it = this.eventMenu.update(dt) || this.eventMenu.handleTap(120, 210, 400, 24, 4);
    if (it) it.onClick?.();
  }

  // -------------------------------------------------------------------------
  // Boss & run end
  // -------------------------------------------------------------------------
  onEnemyKilled(enemy) {
    if (this.run) {
      this.run.addKill(enemy);
      if (enemy.goldValue) this.run.addTribute(enemy.goldValue);
    }
  }

  onBossDefeated(boss) {
    this.run.bossesDefeated++;
    this.run.score += 800;
    this.pendingVictory = true;
    this.state = 'victoryWait';
    this.stateT = 0;
    this.game.audio.play('victory');
    this.boss = boss;
  }

  onPlayerDeath() {
    if (this.state === 'defeatWait' || this.state === 'dead') return;
    this.state = 'defeatWait';
    this.stateT = 0;
    this.game.audio.play('defeat');
    this.world.fx.flash('#5a0010', 0.5);
  }

  finishRun(victory) {
    if (this.finished) return;
    this.finished = true;
    const summary = this.run.finish(victory, this.world);
    this.game.engine.go('summary', { summary, returnTo: 'hub' }, 0.5);
  }

  // -------------------------------------------------------------------------
  // Rendering
  // -------------------------------------------------------------------------
  drawSceneOverlay(ctx) {
    if (this.state === 'bossIntro' && this.boss) {
      const k = clamp(this.stateT / 0.5, 0, 1);
      ctx.globalAlpha = k * (1 - clamp((this.stateT - 1.5) / 0.5, 0, 1));
      ctx.fillStyle = 'rgba(0,0,0,0.7)';
      ctx.fillRect(0, 130, 640, 70);
      text(ctx, this.boss.name.toUpperCase(), 320, 162, { size: 20, align: 'center', color: '#ff5a5a' });
      text(ctx, this.boss.title || '', 320, 178, { size: 8, align: 'center', color: '#e8eef8' });
      wrapText(ctx, this.bossLine || '', 320 - 200, 190, 400, 9, { size: 7, color: '#b9c4d8', align: 'center', bold: false });
      ctx.globalAlpha = 1;
    }
    if (this.state === 'clearing') {
      text(ctx, 'ROOM CLEAR', 320, 180, { size: 16, align: 'center', color: '#7cf0a0' });
    }
    if (this.state === 'reward') this.drawRewards(ctx);
    if (this.state === 'map') this.drawMap(ctx);
    if (this.state === 'shop') this.drawShop(ctx);
    if (this.state === 'event') this.drawEvent(ctx);
    if (this.run?.isCulling) {
      text(ctx, `POINTS ${this.run.cullingPoints}`, 630, 44, { size: 7, align: 'right', color: '#ffd166' });
    }
  }

  drawRewards(ctx) {
    screenShade(ctx, 0.68);
    panel(ctx, 30, 40, 580, 280, { fill: 'rgba(8,10,18,0.97)', border: '#5b8cff', title: 'CHOOSE A REWARD' });
    text(ctx, 'Upgrades last for this run only. Tribute and story progress are permanent.', 320, 68, {
      size: 7,
      align: 'center',
      color: '#93a0b8',
    });
    cardRow(ctx, this.rewardChoices, { x: 60, y: 90, w: 520, h: 170, gap: 14 }, this.rewardIndex);
    const c = this.rewardChoices[this.rewardIndex];
    if (c) {
      text(ctx, `◀ ▶  ·  ENTER to take  ·  ${RARITY[c.rarity]?.name || ''}`, 320, 290, {
        size: 7,
        align: 'center',
        color: '#c9d3e0',
      });
    }
  }

  drawMap(ctx) {
    screenShade(ctx, 0.7);
    panel(ctx, 30, 34, 580, 292, { fill: 'rgba(8,10,18,0.97)', border: '#8fd7ff', title: 'CHOOSE YOUR PATH' });
    const choices = this.mapChoices || [];
    choices.forEach((c, i) => {
      const t = ROOM_TYPES[c.type];
      const cy = 110 + i * 74;
      const active = i === this.mapIndex;
      panel(ctx, 180, cy - 26, 280, 52, {
        fill: active ? 'rgba(28,34,52,0.98)' : 'rgba(14,16,24,0.95)',
        border: active ? t.color : '#39415a',
        inner: false,
      });
      text(ctx, t.icon, 200, cy + 4, { size: 14, color: t.color });
      text(ctx, t.name.toUpperCase(), 224, cy - 8, { size: 9, color: t.color });
      wrapText(ctx, t.desc, 224, cy + 4, 220, 9, { size: 6, color: '#b9c4d8', bold: false });
      text(ctx, active ? '▶' : '', 450, cy + 4, { size: 10, color: t.color });
    });
    text(ctx, `TRIBUTE ${this.run.tribute}  ·  UPGRADES ${this.run.upgrades.length}`, 320, 312, {
      size: 7,
      align: 'center',
      color: '#ffd166',
    });
  }

  drawShop(ctx) {
    screenShade(ctx, 0.72);
    panel(ctx, 110, 44, 420, 268, { fill: 'rgba(8,10,18,0.98)', border: '#ffd166', title: 'EXCHANGE' });
    text(ctx, `Tribute: ${this.run.tribute}`, 320, 72, { size: 9, align: 'center', color: '#ffd166' });
    this.shopMenu.draw(ctx, 140, 106, 360, { rowH: 26 });
    text(ctx, 'ESC is disabled here — choose Leave', 320, 300, { size: 6, align: 'center', color: '#6f7a92' });
  }

  drawEvent(ctx) {
    screenShade(ctx, 0.78);
    panel(ctx, 90, 70, 460, 230, { fill: 'rgba(8,10,18,0.98)', border: '#9fd8ff', title: this.event?.title || 'ENCOUNTER' });
    wrapText(ctx, this.event?.text || '', 110, 100, 420, 10, { size: 8, color: '#dfe6f2', bold: false });
    this.eventMenu.draw(ctx, 120, 200, 400, { rowH: 26 });
  }
}

function clearEnemies(world) {
  for (const e of world.enemies) {
    e.removed = true;
    e.dead = true;
  }
  world.enemies.length = 0;
  world.actors = world.actors.filter((a) => a.team !== 'enemy');
  world.projectiles.length = 0;
  world.hitboxes.length = 0;
  world.zones.length = 0;
  world.pickups.length = 0;
}
