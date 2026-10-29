// ---------------------------------------------------------------------------
// tame.js — Ten Shadows taming ritual. A real combat encounter against the
// shikigami using the same engine as the dungeon. Failure does not unlock it.
// ---------------------------------------------------------------------------

import { ArenaScene } from './arenaBase.js';
import { SHIKIGAMI } from '../data/shikigami.js';
import { BOSSES } from '../data/enemies.js';
import { text, panel, wrapText, VerticalMenu, screenShade } from '../ui/ui.js';
import { input } from '../core/input.js';
import { clamp, dist } from '../core/util.js';
import { defaultMods } from '../data/upgrades.js';

export class TameScene extends ArenaScene {
  constructor(game, params = {}) {
    super(game, params);
    this.id = params.shikigami || 'nue';
    this.def = SHIKIGAMI[this.id];
    this.state = 'intro';
    this.stateT = 0;
    this.timer = 0;
    this.result = null;
  }

  enter() {
    const def = this.def;
    this.createWorld({ arena: { x: 0, y: 26, w: 640, h: 322 }, theme: 'taming', decor: [], obstacles: [] });
    this.createPlayer({
      charId: this.params.charId || (this.game.save.data.custom?.created ? 'custom' : 'megumi'),
      x: 96,
      y: 200,
      mods: defaultMods(),
    });
    this.world.trainMode = false;
    const rule = def.tame.rule;
    let bossDef;
    if (this.id === 'mahoraga') {
      bossDef = { ...BOSSES.mahoragaBoss };
      bossDef.hp = def.tame.hp;
    } else {
      bossDef = {
        id: 'tame_' + this.id,
        name: def.name,
        rig: def.rig,
        pal: def.pal,
        hp: def.tame.hp,
        speed: def.speed,
        radius: (def.rig === 'maxElephant' ? 13 : 9) * (def.scale || 1),
        scale: (def.scale || 1) * 1.35,
        xp: 0,
        moves: def.abilities.map((a) => ({ ...a, startup: (a.startup || 0.3) * 1.35 })),
        phases: false,
        tame: true,
      };
    }
    if (rule === 'adapt') bossDef.adapts = true;
    const boss = this.world.spawnEnemy(bossDef, 500, 190, { brain: 'boss', hpMult: 1, adapts: rule === 'adapt' });
    boss.isBoss = true;
    boss.introT = 1.6;
    boss.invulnT = 1.6;
    if (rule === 'regen') boss.regen = 6;
    if (rule === 'armor') boss.armor = Math.max(boss.armor, 0.25);
    if (rule === 'hunter') boss.speed *= 1.15;
    if (rule === 'charge') boss.chargeRule = true;
    this.boss = boss;
    this.rule = rule;
    this.timer = def.tame.time || 0;
    this.state = 'intro';
    this.stateT = 0;
    this.game.audio.play('boss');
  }

  updateScene(dt) {
    this.stateT += dt;
    if (this.state === 'intro') {
      if (this.stateT > 1.6) {
        this.boss.introT = 0;
        this.state = 'fight';
        this.stateT = 0;
      }
      return;
    }
    if (this.state === 'fight') {
      if (this.rule === 'timer' && this.timer > 0) {
        this.timer -= dt;
        if (this.timer <= 0) return this.fail('Time ran out. The shadow slipped away.');
      }
      if (this.boss.dead) return this.succeed();
      if (this.player.dead) return this.fail('You fell. The ritual is broken.');
      // rule feedback
      if (this.rule === 'regen') this.boss.heal(4 * dt);
      return;
    }
    if (this.state === 'result') {
      if (this.stateT > 0.8 && (input.wasPressed('confirm') || input.wasPressed('interact') || input.wasPressed('attack') || input.pointer.pressed)) {
        this.game.engine.go('hub', { fromRun: true }, 0.45);
      }
    }
  }

  succeed() {
    if (this.state === 'result') return;
    this.state = 'result';
    this.stateT = 0;
    this.result = 'win';
    const save = this.game.save;
    const first = save.tameShikigami(this.id);
    // Totality + Agito availability
    if (save.hasShikigami('divineDogs') && save.hasShikigami('nue') && save.hasShikigami('greatSerpent')) {
      save.unlockTotality('agito');
    }
    if (this.id === 'mahoraga') save.unlockTotality('mahoragaTotality');
    save.data.stats.kills++;
    save.data.mastery[save.data.lastChar || 'megumi'] = (save.data.mastery[save.data.lastChar || 'megumi'] || 0) + 1;
    save.save();
    this.game.audio.play('tame');
    this.world.fx.flash('#ffffff', 0.3);
    this.world.fx.burst(this.boss.x, this.boss.y - 20, 50, { color: this.def.pal.light, speed: 200, life: 1, glow: true });
    this.game.save.data.story.flags['tamed_' + this.id] = true;
    this.game.save.save();
    this.unlocked = first;
  }

  fail(reason) {
    if (this.state === 'result') return;
    this.state = 'result';
    this.stateT = 0;
    this.result = 'fail';
    this.reason = reason;
    this.game.audio.play('defeat');
    this.player.controlEnabled = false;
  }

  drawSceneOverlay(ctx) {
    if (this.state === 'intro') {
      ctx.globalAlpha = clamp(this.stateT / 0.4, 0, 1) * (1 - clamp((this.stateT - 1.2) / 0.4, 0, 1));
      ctx.fillStyle = 'rgba(0,0,0,0.7)';
      ctx.fillRect(0, 120, 640, 100);
      text(ctx, 'TAMING RITUAL', 320, 146, { size: 10, align: 'center', color: '#a79bff' });
      text(ctx, this.def.name.toUpperCase(), 320, 172, { size: 20, align: 'center', color: '#ffffff' });
      wrapText(ctx, this.def.tame.desc, 120, 190, 400, 9, { size: 7, color: '#c9d3e0', align: 'center', bold: false });
      ctx.globalAlpha = 1;
      return;
    }
    // rule banner
    const ruleText = {
      timer: `DEFEAT IT WITHIN ${Math.ceil(this.timer)}s`,
      regen: 'IT REGENERATES — OUT-BURST IT',
      armor: 'HEAVY ARMOUR — PUNISH RECOVERY',
      adapt: 'IT ADAPTS. VARY YOUR ATTACK TYPES.',
      ambush: 'IT STRIKES FROM BELOW',
      charge: 'DODGE THE CHARGE, HIT THE WINDOW',
      hunter: 'IT HUNTS WITHOUT WARNING',
      pull: 'IT DRAGS YOU IN',
      none: '',
    }[this.rule] || '';
    if (ruleText && this.state === 'fight') {
      text(ctx, ruleText, 320, 44, { size: 7, align: 'center', color: '#ffd166' });
    }
    if (this.state === 'result') {
      screenShade(ctx, 0.75);
      panel(ctx, 110, 100, 420, 170, {
        fill: 'rgba(8,10,18,0.99)',
        border: this.result === 'win' ? '#7cf0a0' : '#ff5a5a',
        title: this.result === 'win' ? 'SHADOW BOUND' : 'RITUAL FAILED',
      });
      if (this.result === 'win') {
        text(ctx, `${this.def.name} is yours to summon.`, 320, 140, { size: 12, align: 'center', color: '#ffffff' });
        text(ctx, 'Permanent unlock saved.', 320, 160, { size: 8, align: 'center', color: '#9fd8ff' });
        if (this.id === 'mahoraga') {
          text(ctx, 'At 100% Ten Shadows meter, Mahoraga answers.', 320, 178, { size: 7, align: 'center', color: '#ffd166' });
          text(ctx, 'His adaptation memory persists between summons.', 320, 190, { size: 7, align: 'center', color: '#ffd166' });
        }
      } else {
        text(ctx, this.reason || 'The ritual failed.', 320, 148, { size: 9, align: 'center', color: '#ff9aa8' });
        text(ctx, 'No summon was granted. Try again from the hub.', 320, 170, { size: 7, align: 'center', color: '#c9d3e0' });
      }
      text(ctx, 'Click / Enter to return to Jujutsu High', 320, 246, { size: 7, align: 'center', color: '#93a0b8' });
    }
  }
}
