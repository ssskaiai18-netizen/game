// ---------------------------------------------------------------------------
// spar.js — sparring against a real character AI that uses its actual kit.
// ---------------------------------------------------------------------------

import { ArenaScene } from './arenaBase.js';
import { CHARACTERS } from '../data/characters.js';
import { Entity } from '../game/entity.js';
import { text, panel, wrapText, VerticalMenu, screenShade } from '../ui/ui.js';
import { input } from '../core/input.js';
import { clamp, dist, formatNum } from '../core/util.js';
import { defaultMods } from '../data/upgrades.js';

const KUSAKABE = {
  id: 'kusakabe',
  name: 'Atsuya Kusakabe',
  title: 'New Shadow Style',
  hp: 150,
  speed: 84,
  radius: 6,
  look: {
    skin: '#e8c0a0', hair: '#2a2a2a', hairStyle: 'buzz', top: '#2a2a30', topDark: '#1a1a20', topLight: '#3a3a44',
    bottom: '#22222a', bottomDark: '#16161c', accent: '#c9c2b0', eye: '#f0f0f0', weapon: 'katana',
  },
  basic: [
    { id: 'k1', name: 'Kata Cut', type: 'melee', dmg: 9, startup: 0.07, active: 0.08, recovery: 0.16, range: 26, arc: 1.5, category: 'cut', color: '#dfe6f2' },
    { id: 'k2', name: 'Return Cut', type: 'melee', dmg: 12, startup: 0.09, active: 0.09, recovery: 0.2, range: 28, arc: 1.7, category: 'cut', color: '#dfe6f2', swingDir: -1 },
  ],
  abilities: [
    { id: 'kSimple', name: 'Simple Domain', type: 'counter', desc: 'A small domain that neutralises technique attacks.', cost: 20, cd: 6, startup: 0.05, active: 0.4, recovery: 0.2, dmg: 18, counterDmg: 26, range: 40, arc: 2.2, category: 'technique', color: '#9fd8ff' },
    { id: 'kLunge', name: 'Shadow Lunge', type: 'dash', desc: 'A quick advance with the blade.', cost: 12, cd: 3, dmg: 14, startup: 0.1, active: 0.12, recovery: 0.2, range: 34, arc: 1.6, category: 'cut', color: '#9fd8ff', move: { type: 'lunge', speed: 360, dur: 0.14 } },
    { id: 'kBat', name: 'Bat to the Knee', type: 'melee', desc: 'Rude, but effective.', cost: 8, cd: 4, dmg: 10, startup: 0.2, active: 0.1, recovery: 0.3, range: 30, arc: 1.8, category: 'blunt', knockback: 160, stun: 1.0, color: '#ffd166' },
    { id: 'kShroud', name: 'Veil Step', type: 'blink', desc: 'Slip around the opponent.', cost: 10, cd: 4, startup: 0.05, active: 0.05, recovery: 0.15, blink: { dist: 80, iframes: 0.2 }, color: '#9fd8ff' },
  ],
  ultimate: { id: 'kUlt', name: 'New Shadow Style: Full Draw', type: 'ultimate', dmg: 70, color: '#9fd8ff', category: 'technique', anim: 'attack', ultCost: 100 },
  domain: null,
};

export class SparScene extends ArenaScene {
  constructor(game, params = {}) {
    super(game, params);
    this.opponentId = params.opponent || 'yuji';
    this.state = 'intro';
    this.stateT = 0;
    this.result = null;
  }

  enter() {
    const oppId = this.opponentId;
    const isChar = !!CHARACTERS[oppId];
    const def = isChar ? CHARACTERS[oppId] : KUSAKABE;
    this.def = def;
    this.createWorld({ arena: { x: 0, y: 26, w: 640, h: 322 }, theme: 'training', decor: [{ type: 'rim', x: 20, y: 320, w: 600, h: 3, color: '#4a4030' }], obstacles: [] });
    this.createPlayer({ charId: this.params.charId || this.game.selectedChar || 'yuji', x: 120, y: 200, mods: defaultMods() });
    this.world.safeMode = false;

    const npc = new Entity(this.world, {
      team: 'enemy',
      name: def.name,
      kind: 'npc',
      look: def.look,
      x: 500,
      y: 200,
      radius: def.radius || 6,
      hp: (def.hp || 120) * 1.35,
      ce: def.ce || 100,
      speed: def.speed || 80,
      brain: 'npc',
      abilities: def.abilities,
      auraColor: def.look?.accent || '#9fc0ff',
    });
    npc.isNpc = true;
    npc.charId = isChar ? oppId : null;
    npc.basic = def.basic;
    npc.skill = this.params.skill || 0.55;
    npc.ultMeter = 30;
    npc.dodgeCd = 0;
    npc.startupMult = 1.1 - npc.skill * 0.2;
    npc.cdMult = 1.15 - npc.skill * 0.25;
    npc.dmgMult = 0.72 + npc.skill * 0.35;
    npc.aiTimer = 0.8;
    npc.spawnT = 0.4;
    this.world.addActor(npc);
    this.npc = npc;
    this.state = 'intro';
    this.stateT = 0;
    this.game.audio.play('reinforce');
  }

  spawnExtras() {}

  updateScene(dt) {
    this.stateT += dt;
    // NPC ult meter builds over time and from hits
    if (this.npc && !this.npc.dead) {
      this.npc.ultMeter = clamp(this.npc.ultMeter + dt * 1.6, 0, 100);
    }
    if (this.state === 'intro') {
      if (this.stateT > 1.5) {
        this.state = 'fight';
        this.stateT = 0;
      }
      return;
    }
    if (this.state === 'fight') {
      if (this.npc.dead) return this.finish(true);
      if (this.player.dead) return this.finish(false);
      return;
    }
    if (this.state === 'result') {
      if (this.stateT > 0.7 && (input.wasPressed('confirm') || input.wasPressed('interact') || input.wasPressed('attack') || input.pointer.pressed)) {
        this.game.engine.go('hub', { fromRun: true }, 0.4);
      }
    }
  }

  finish(win) {
    if (this.state === 'result') return;
    this.state = 'result';
    this.stateT = 0;
    this.result = win ? 'win' : 'lose';
    this.game.audio.play(win ? 'victory' : 'defeat');
    const save = this.game.save;
    if (win) {
      const reward = 12;
      save.data.tributeCurrency += reward;
      save.data.stats.kills++;
      const profile = save.data.sorcerer;
      if (profile && this.opponentId === profile.technique) {
        profile.trainingWins++;
        profile.mastery++;
        if (profile.unlocked < 4) {
          profile.unlocked++;
          this.trainingReward = `Unlocked ${CHARACTERS[profile.technique].abilities[profile.unlocked - 1].name}`;
        } else if (profile.trainingWins === 3) this.trainingReward = 'Ultimate unlocked';
        else if (profile.trainingWins === 4 && CHARACTERS[profile.technique].domain) this.trainingReward = 'Domain unlocked';
        else this.trainingReward = `Technique mastery ${profile.mastery}`;
      }
      save.data.mastery[save.data.lastChar || 'yuji'] = (save.data.mastery[save.data.lastChar || 'yuji'] || 0) + 1;
      save.save();
      this.reward = reward;
    }
    if (!this.npc.dead) {
      this.npc.dead = true;
      this.npc.setState('dead', 'dead');
    }
  }

  drawSceneOverlay(ctx) {
    if (this.state === 'intro') {
      ctx.globalAlpha = clamp(this.stateT / 0.4, 0, 1);
      ctx.fillStyle = 'rgba(0,0,0,0.65)';
      ctx.fillRect(0, 130, 640, 80);
      text(ctx, 'SPARRING', 320, 154, { size: 10, align: 'center', color: '#9fc0ff' });
      text(ctx, this.def.name.toUpperCase(), 320, 180, { size: 18, align: 'center', color: '#ffffff' });
      text(ctx, 'First to zero HP. Real techniques. No lethal blows.', 320, 198, { size: 7, align: 'center', color: '#c9d3e0' });
      ctx.globalAlpha = 1;
      return;
    }
    // opponent health bar (uses Hud boss bar because isBoss false)
    if (this.npc && !this.npc.dead) {
      panel(ctx, 180, 10, 280, 18, { fill: 'rgba(8,10,16,0.8)', border: '#5b8cff', inner: false });
      text(ctx, this.def.name, 190, 22, { size: 7, color: '#dfe6f2' });
      ctx.fillStyle = '#2a2f3e';
      ctx.fillRect(380, 14, 70, 6);
      ctx.fillStyle = '#9fc0ff';
      ctx.fillRect(380, 14, 70 * clamp(this.npc.hp / this.npc.maxHp, 0, 1), 6);
    }
    if (this.state === 'result') {
      screenShade(ctx, 0.72);
      panel(ctx, 120, 96, 400, 170, {
        fill: 'rgba(8,10,18,0.99)',
        border: this.result === 'win' ? '#7cf0a0' : '#ff5a5a',
        title: this.result === 'win' ? 'SPARRING WON' : 'SPARRING LOST',
      });
      const st = this.world.stats;
      const rows = [
        ['Damage dealt', formatNum(st.totalDamage)],
        ['Highest hit', formatNum(st.highestHit)],
        ['Longest combo', st.longestCombo],
        ['Perfect dodges', st.perfectDodges],
        ['Black Flash', `${st.bfSuccess}/${st.bfAttempts}`],
      ];
      rows.forEach(([k, v], i) => {
        text(ctx, k, 150, 132 + i * 16, { size: 7, color: '#8b98b0' });
        text(ctx, `${v}`, 490, 132 + i * 16, { size: 7, align: 'right', color: '#e8eef8' });
      });
      if (this.trainingReward) text(ctx, this.trainingReward, 320, 211, { size: 7, align: 'center', color: '#7cf0a0' });
      if (this.result === 'win') text(ctx, `Training reward: +${this.reward} 呪`, 320, 222, { size: 8, align: 'center', color: '#ffd166' });
      text(ctx, 'Click / Enter to return to the hub', 320, 246, { size: 7, align: 'center', color: '#93a0b8' });
    }
  }
}
