// ---------------------------------------------------------------------------
// arenaBase.js — shared base for every combat scene (dungeon, sparring,
// taming, training). Owns the world, the player, the HUD and pause plumbing.
// ---------------------------------------------------------------------------

import { World } from '../game/world.js';
import { Player } from '../game/player.js';
import { Hud } from '../ui/hud.js';
import { input } from '../core/input.js';
import { clamp } from '../core/util.js';
import { text, panel } from '../ui/ui.js';

export class ArenaScene {
  constructor(game, params = {}, opts = {}) {
    this.game = game;
    this.params = params;
    this.opts = opts;
    this.interactPrompt = null;
    this.roomLabel = '';
    this.canPause = true;
    this.uiOverlay = null;
    this.menuLock = false;
    this.banner = null;
    this.bannerQueue = [];
  }

  // -------------------------------------------------------------------------
  // Event banners — the game tells you when something big happens.
  // -------------------------------------------------------------------------
  showBanner(title, sub = '', color = '#ffffff', dur = 1.9) {
    const b = { title, sub, color, t: 0, dur };
    if (this.banner) this.bannerQueue.push(b);
    else this.banner = b;
  }

  updateBanner(dt) {
    const b = this.banner;
    if (!b) {
      if (this.bannerQueue.length) this.banner = this.bannerQueue.shift();
      return;
    }
    b.t += dt;
    if (b.t >= b.dur) {
      this.banner = null;
      if (this.bannerQueue.length) this.banner = this.bannerQueue.shift();
    }
  }

  drawBanner(ctx) {
    const b = this.banner;
    if (!b) return;
    const inT = clamp(b.t / 0.18, 0, 1);
    const outT = clamp((b.dur - b.t) / 0.3, 0, 1);
    const a = Math.min(inT, outT);
    const h = b.sub ? 40 : 26;
    const y = 74 + (1 - inT) * -10;
    ctx.globalAlpha = a * 0.82;
    ctx.fillStyle = '#06060c';
    ctx.fillRect(0, y - 14, 640, h);
    ctx.globalAlpha = a;
    ctx.fillStyle = b.color;
    ctx.fillRect(0, y - 14, 640, 1.5);
    ctx.fillRect(0, y - 14 + h, 640, 1.5);
    text(ctx, b.title.toUpperCase(), 320, y + 2, { size: 12, align: 'center', color: b.color, bold: true });
    if (b.sub) text(ctx, b.sub, 320, y + 16, { size: 7, align: 'center', color: '#c8d2e4' });
    ctx.globalAlpha = 1;
  }

  onBossPhase(boss, phase) {
    this.showBanner(`${boss?.name || 'BOSS'} · PHASE ${phase}`, 'It is getting serious.', '#ff5a5a');
    this.game.audio?.play('boss');
  }

  onBossDomain(domain) {
    this.showBanner('DOMAIN EXPANSION', (domain?.name || '').replace('Domain Expansion: ', ''), domain?.color || '#ff6b6b', 2.3);
  }

  onDomainStart(domain) {
    if (domain?.isBoss) return;
    this.showBanner('DOMAIN EXPANSION', domain?.name || '', domain?.color || '#a79bff', 2.1);
  }

  onDomainEnd(domain) {
    if (domain?.owner?.isPlayer) this.showBanner('DOMAIN CLOSED', '', '#8b93a7', 1.2);
  }

  onUltimateSummon(summon, id) {
    this.showBanner(id === 'mahoraga' ? 'MAHORAGA' : 'AGITO', 'Ten Shadows: ultimate summon', '#c9a2ff', 2);
  }

  onSummonDefeated(summon) {
    this.showBanner(`${(summon?.name || 'SHIKIGAMI').toUpperCase()} DEFEATED`, '', '#8b93a7', 1);
  }

  onTotality(summon) {
    this.showBanner('TOTALITY', `${summon?.name || ''} absorbs its fallen partner`, '#c9a2ff', 1.8);
  }

  onAdaptation(target, category, stage) {
    const names = ['Exposure', 'Recognition', 'Partial Adaptation', 'Advanced Adaptation'];
    this.showBanner('MAHORAGA ADAPTS', `${String(category).toUpperCase()} · ${names[stage - 1] || stage}`, '#ffd166', 1.7);
  }

  onPointsEarned(points) {
    if (this.run) this.run.addPoints(points);
  }

  onTributePickup(value) {
    this.run?.addTribute?.(value);
  }

  createWorld({ arena, theme, decor = [], obstacles = [], trainMode = false, seed, safeMode = false }) {
    this.world = new World(this.game, { arena, theme, decor, obstacles, seed, trainMode, scene: this });
    this.world.safeMode = safeMode;
    return this.world;
  }

  createPlayer({ charId, x, y, mods, run, extraAbilities, availableSummons }) {
    const p = new Player(this.world, {
      charId,
      save: this.game.save,
      mods,
      run,
      x,
      y,
      extraAbilities,
      availableSummons,
    });
    p.controller = p;
    this.world.player = p;
    this.world.addActor(p);
    this.player = p;
    this.hud = new Hud(this);
    this.world.onPlayerDeath = () => {
      this.onPlayerDeath?.();
    };
    return p;
  }

  enter() {}
  exit() {
    if (this.world) {
      this.world.actors.length = 0;
      this.world.enemies.length = 0;
      this.world.summons.length = 0;
      this.world.projectiles.length = 0;
      this.world.hitboxes.length = 0;
      this.world.zones.length = 0;
      this.world.fx.clear();
      this.world.finished = true;
    }
    input.setButtons([]);
  }

  update(dt) {
    if (!this.world) return;
    if (this.uiOverlay) {
      this.uiOverlay.update(dt);
      this.hud?.update(dt);
      return;
    }
    this.world.update(dt);
    this.hud?.update(dt);
    this.updateScene(dt);
    this.updateBanner(dt);
  }

  updateScene(dt) {}

  draw(ctx) {
    if (!this.world) return;
    this.world.draw(ctx);
    this.drawSceneOverlay(ctx);
    this.drawBanner(ctx);
    this.hud?.draw(ctx);
    if (this.uiOverlay) this.uiOverlay.draw(ctx);
  }

  drawSceneOverlay(ctx) {}

  onPauseToggle(paused) {
    if (this.uiOverlay) return;
  }

  /** helper: distance from player to an interactable */
  near(x, y, r = 30) {
    const p = this.player;
    if (!p) return false;
    return Math.hypot(p.x - x, p.y - y) < r;
  }

  drawInteractPrompt(ctx, x, y, label, color = '#9fc0ff') {
    this.interactPrompt = { x, y, label, color };
  }
}
