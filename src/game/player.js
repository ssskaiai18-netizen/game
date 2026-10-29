// ---------------------------------------------------------------------------
// player.js — the player-controlled sorcerer.
//
// Implements combo chains, cursed energy, reinforcement, the Black Flash
// timing window, dodge/perfect-dodge rewards, domain + ultimate activation,
// Boogie Woogie and the Ten Shadows summon interface.
// ---------------------------------------------------------------------------

import { Entity } from './entity.js';
import { castAbility, ceCost, computeDamage, spawnBeam, triggerDivergent, activateTransform } from './combat.js';
import { clamp, angleDiff, dist, TAU } from '../core/util.js';
import { getCharacter } from '../data/characters.js';
import { input } from '../core/input.js';
import { defaultMods } from '../data/upgrades.js';
import { SHIKIGAMI, summonListFor, canSummonAgito as canAgitoOwned } from '../data/shikigami.js';

export class Player extends Entity {
  constructor(world, opts = {}) {
    const charId = opts.charId || 'yuji';
    const def = opts.charDef || getCharacter(charId);
    const save = opts.save;
    const mods = opts.mods || defaultMods();
    const tribute = save?.data?.tribute || {};
    const mastery = save?.data?.mastery?.[charId] || 0;

    const hpBonus = (tribute.vitality || 0) * 6 + (mods.maxHpFlat || 0) + mastery * 3;
    const ceBonus = (tribute.reservoir || 0) * 5 + (mods.maxCeFlat || 0);

    super(world, {
      team: 'player',
      name: def.name,
      kind: 'player',
      look: def.look,
      rig: null,
      x: opts.x || 320,
      y: opts.y || 220,
      radius: def.radius,
      hp: Math.round((def.hp + hpBonus) * (mods.maxHpMult || 1)),
      ce: def.ce + ceBonus,
      speed: def.speed * (mods.moveSpeedMult || 1) * (1 + (tribute.finesse || 0) * 0.02),
      brain: 'player',
      dmgMult: def.power,
    });
    this.char = def;
    this.charId = charId;
    this.isPlayer = true;
    this.mods = mods;
    this.save = save;
    this.run = opts.run || null;
    this.maxCe = def.ce + ceBonus;
    this.ce = this.maxCe;
    this.baseMaxCe = this.maxCe;
    this.speedBase = this.speed;
    this.dashSpeed = def.dashSpeed;

    // ability slots (up to five; custom sorcerers only get unlocked abilities)
    this.basic = def.basic;
    this.techniqueId = def.techniqueId || null;
    this.isCustomSorcerer = !!def.isCustom;
    if (opts.unlockedIds) {
      const ownedIds = new Set(opts.unlockedIds);
      this.slots = def.abilities.filter((a) => ownedIds.has(a.id));
    } else {
      this.slots = def.abilities.slice(0, 5);
    }
    this.ultimate = def.ultimate;
    this.domainAbility = def.domain;
    this.ultimateLocked = !!opts.ultimateLocked;
    this.domainLocked = !!opts.domainLocked;
    // transform state (mirrors actor fields; slots swap while active)
    this.transformT = 0;
    this.fusionPair = opts.fusionPair || opts.save?.data?.custom?.fusionPair || ['toad', 'rabbitEscape'];
    if (opts.extraAbilities) this.slots = this.slots.concat(opts.extraAbilities);

    // combo
    this.comboIdx = 0;
    this.comboWindowT = 0;
    this.bufferedAttack = false;
    this.lastBasicEnd = -10
    this.attackHeld = false;

    // resources
    this.ultMeter = opts.ultMeter || 0;
    this.maxUlt = 100;
    this.dodgeCd = 0;
    this.dodgeCdMax = 0.62;
    this.perfectDodgeWindow = 0;
    this.facingLock = 0;
    this.aimAngle = 0;
    this.aimPoint = { x: this.x + 60, y: this.y };
    this.controlEnabled = true;
    this.autoAim = false;

    // reinforcement
    this.reinforceCost = 16;
    this.reinforceT = 0;

    // black flash
    this.blackSparks = !!save?.data?.unlocks?.blackSparks;
    this.bfState = null;
    this.bfArmed = null;
    this.bfChainT = 0;
    this.pendingTechBuff = 0;
    this.bfEmpowered = 0;
    this.lastBfTime = -10;

    // domain
    this.domainT = 0;
    this.domainCd = 0;
    this.inDomain = false;
    this.domainUsedThisRoom = false;
    this.domainGauge = 0;

    // summon selection (Megumi / Ten Shadows technique)
    this.canTenShadows = charId === 'megumi' || this.techniqueId === 'tenShadows';
    this.summonIndex = 0;
    this.owned = save?.data?.unlocks?.shikigami || {};
    this.summonOptions = summonListFor(this.owned).filter((id) => id !== 'mahoraga' || this.owned.mahoraga);
    if (opts.availableSummons) this.summonOptions = opts.availableSummons;

    // misc
    this.schedule = [];
    this.hitConfirm = 0;
    this.reviveUsed = false;
    this.buffT = 0;
    this.buffMult = 1;
    this.boogieCd = 0;
    this.boogieUnlocked = !!(mods.boogieUnlocked);
    this.blackFlashMod = def.blackFlashMod || 1;
    this.ceGainOnHit = 3;
    this.startupMult = 1;

    this.applyPassive();
    // NPC sparring partners use the same kit pipeline: fall back to the
    // generic ultimate/summon handlers for actors that aren't this player.
    this.world.onUltimate = (actor, ab, angle, aimPoint) => {
      if (ab?.type === 'transform') { activateTransform(this.world, actor, ab); return; }
      if (actor === this) this.doUltimate(ab, angle, aimPoint);
      else this.world.genericUltimate(actor, ab, angle, aimPoint);
    };
    this.world.onSummonAbility = (actor, ab) => {
      if (actor === this) this.doSummon(ab);
      else this.world.summonShikigami(actor, ab.summonId || 'divineDogs');
    };
    this.world.onFloatingText?.();
  }

  applyPassive() {
    if (this.charId === 'gojo') this.ceRegenBonus = 0.25;
    else this.ceRegenBonus = 0;
    if (this.char.passive) this.passiveText = this.char.passive;
  }

  get ceRegen() {
    const base = 7 * (this.mods.ceRegenMult || 1) * (1 + (this.ceRegenBonus || 0));
    return base;
  }

  get isDead() {
    return this.dead;
  }

  // -------------------------------------------------------------------------
  update(dt) {
    if (this.dead) return;
    this.animT += dt;
    if (this.flash > 0) this.flash = Math.max(0, this.flash - dt * 4);
    if (this.dodgeCd > 0) this.dodgeCd -= dt;
    if (this.boogieCd > 0) this.boogieCd -= dt;
    if (this.domainCd > 0) this.domainCd -= dt;
    if (this.perfectDodgeWindow > 0) this.perfectDodgeWindow -= dt;
    if (this.comboWindowT > 0) this.comboWindowT -= dt;
    if (this.bfChainT > 0) this.bfChainT -= dt;
    if (this.pendingTechBuff > 0) this.pendingTechBuff -= dt;
    if (this.bfEmpowered > 0) this.bfEmpowered -= dt;
    if (this.buffT > 0) {
      this.buffT -= dt;
      if (this.buffT <= 0) this.buffMult = 1;
    }
    if (this.hitConfirm > 0) this.hitConfirm -= dt;
    this.ultMeter = clamp(this.ultMeter, 0, this.maxUlt);
    this.ce = Math.min(this.maxCe, this.ce + this.ceRegen * dt);
    this.updateScheduled(dt);
    this.updateBlackFlash(dt);

    if (this.stunT > 0) {
      this.vx = 0;
      this.vy = 0;
      return;
    }
    if (!this.controlEnabled) {
      this.vx = 0;
      this.vy = 0;
      return;
    }
    this.updateAim();
    this.updateMovement(dt);
    this.updateInput();
  }

  updateScheduled(dt) {
    for (let i = this.schedule.length - 1; i >= 0; i--) {
      const s = this.schedule[i];
      s.t -= dt;
      if (s.t <= 0) {
        this.schedule.splice(i, 1);
        try {
          s.fn();
        } catch (e) {
          console.error(e);
        }
      }
    }
  }

  updateAim() {
    const w = this.world;
    const mouse = input.mouse;
    const useMouse = !input.usedTouch && !this.autoAim && input.mouseMoved;
    if (useMouse) {
      const wx = mouse.x + w.camera.x;
      const wy = mouse.y + w.camera.y;
      this.aimAngle = Math.atan2(wy - (this.y - 10), wx - this.x);
      this.aimPoint = { x: wx, y: wy };
    } else {
      const t = w.nearestEnemyOf(this, 240);
      if (t) {
        this.aimAngle = Math.atan2(t.y - this.y, t.x - this.x);
        this.aimPoint = { x: t.x, y: t.y };
      } else {
        const mv = input.moveVector();
        if (Math.abs(mv.x) + Math.abs(mv.y) > 0.2) {
          this.aimAngle = Math.atan2(mv.y, mv.x);
          this.aimPoint = { x: this.x + Math.cos(this.aimAngle) * 80, y: this.y + Math.sin(this.aimAngle) * 80 };
        }
      }
    }
    this.faceAngle(this.aimAngle);
  }

  updateMovement(dt) {
    const mv = input.moveVector();
    const busy = this.phase === 'startup' || this.phase === 'active';
    const slow = busy ? 0.22 : this.mods.moveSpeedMult ? 1 : 1;
    const rooted = this.rootT > 0 || this.moveT > 0;
    if (rooted) {
      this.vx = 0;
      this.vy = 0;
      return;
    }
    this.vx = mv.x * (busy ? slow : 1);
    this.vy = mv.y * (busy ? slow : 1);
    if (this.moving > 0.2) {
      this.facingX = this.vx >= 0 ? 1 : -1;
    }
    if (busy && this.phase === 'active' && this.ability && this.ability.move) {
      // dash/lunge abilities keep the actor's facing from the cast
    }
  }

  updateInput() {
    const w = this.world;
    // reinforcement toggle / black flash sync share a key
    if (input.wasPressed('reinforce')) {
      if (this.bfState && this.bfState.windowOpen) {
        this.attemptBlackFlash();
      } else if (this.bfState && this.bfState.t >= this.bfState.windowStart) {
        // pressed slightly early/late → counts as a failed attempt
        this.failBlackFlash();
      } else {
        this.toggleReinforce();
      }
    }
    if (input.wasPressed('attack')) this.tryAttack();
    if (input.wasPressed('dodge')) this.tryDodge();
    if (input.wasPressed('a1')) this.trySlot(0);
    if (input.wasPressed('a2')) this.trySlot(1);
    if (input.wasPressed('a3')) this.trySlot(2);
    if (input.wasPressed('a4')) this.trySlot(3);
    if (input.wasPressed('a5')) this.trySlot(4);
    if (input.wasPressed('ult')) this.tryUltimate();
    if (input.wasPressed('domain')) this.tryDomain();
    if (input.wasPressed('boogie')) this.tryBoogie();
    if (input.wasPressed('summonCmd')) this.cycleSummon();
    if (input.isDown('attack')) this.attackHeld = true;
    else this.attackHeld = false;
  }

  // -------------------------------------------------------------------------
  // Basic attacks & combo chain
  // -------------------------------------------------------------------------
  tryAttack() {
    if (this.stunT > 0) return;
    if (this.phase === null) {
      this.startBasic();
      return;
    }
    // buffer during the second half of the current attack
    if (this.abilityIsBasic && this.phase !== 'startup') {
      this.bufferedAttack = true;
    }
  }

  startBasic() {
    const idx = this.comboWindowT > 0 ? this.comboIdx % this.basic.length : 0;
    const ab = this.basic[idx];
    this.comboIdx = idx + 1;
    this.comboWindowT = ab.comboWindow || 0.5;
    const ok = castAbility(this.world, this, ab, this.aimAngle, {
      basic: true,
      aimPoint: this.aimPoint,
      free: true,
    });
    if (ok) {
      this.world.audio?.play(ab.sfx || 'slash');
      if (idx === this.basic.length - 1) {
        this.world.fx.burst(this.x + Math.cos(this.aimAngle) * 12, this.y - 10, 6, {
          color: ab.color || '#ffffff',
          speed: 70,
          dir: this.aimAngle,
          spread: 1.2,
          life: 0.2,
        });
      }
      this.registerBlackFlashAttempt(ab, true);
    }
  }

  onAbilityEnd(ab) {
    if (ab === this.ultimate) {
      this.controlEnabled = true;
    }
    if (this.abilityIsBasic) {
      this.comboWindowT = Math.max(this.comboWindowT, 0.18);
      if (this.bufferedAttack) {
        this.bufferedAttack = false;
        this.startBasic();
      }
    }
  }

  trySlot(i) {
    const ab = this.slots[i];
    if (!ab || this.stunT > 0) return;
    // Divergent Fist: pressing the same slot again is the Black Flash input.
    if (this.divergentState && this.divergentState.ab?.id === ab.id) {
      triggerDivergent(this.world, this);
      return;
    }
    // Domain abilities living in (ultimate) slots route through domain rules.
    if (ab.type === 'domain') {
      const names = {
        incomplete_shrine: 'Domain Expansion: Incomplete Shrine',
        malevolent_shrine: 'Domain Expansion: Malevolent Shrine',
        unlimited_void: 'Domain Expansion: Unlimited Void',
        chimera_shadow_garden: 'Domain Expansion: Chimera Shadow Garden',
      };
      this.tryDomain({
        id: ab.domainId || ab.id, domainId: ab.domainId || ab.id,
        name: names[ab.domainId || ab.id] || ab.name, type: 'domain',
        cost: ab.cost || 55, cd: ab.cd || 36, dur: ab.dur || 9, color: ab.color || '#c9a2ff',
        anim: 'cast', sfx: 'domain',
      });
      return;
    }
    if (this.phase) {
      if (this.phase === 'recovery' && ab.type) {
        // allow cancel from recovery
      } else return;
    }
    if (!this.canAfford(ab)) {
      this.world.audio?.play('deny');
      this.world.fx.text(this.x, this.y - 34, 'NO CE', { color: '#7ec8ff', life: 0.5, scale: 0.8 });
      return;
    }
    if ((this.cdMap[ab.id] || 0) > 0) {
      this.world.audio?.play('deny');
      return;
    }
    const ok = castAbility(this.world, this, ab, this.aimAngle, { aimPoint: this.aimPoint });
    if (ok) {
      this.world.stats.techniques++;
      this.world.audio?.play(ab.sfx || 'technique');
      this.world.fx.ring(this.x, this.y - 8, 18, ab.color || '#8fd7ff', 0.25, 1.5);
      this.registerBlackFlashAttempt(ab, false);
      this.addUlt(ab.type === 'ultimate' ? 0 : 2);
    }
  }

  canAfford(ab) {
    return this.ce >= ceCost(this, ab);
  }

  onAbilityStart(ab, opts) {
    if (ab === this.ultimate) {
      this.controlEnabled = false;
    }
  }

  addUlt(v) {
    this.ultMeter = clamp(this.ultMeter + v * (this.mods.ultGainMult || 1), 0, this.maxUlt);
  }

  // -------------------------------------------------------------------------
  // Dodge
  // -------------------------------------------------------------------------
  tryDodge() {
    if (this.stunT > 0 || this.dodgeCd > 0) return;
    const mv = input.moveVector();
    const ang = Math.abs(mv.x) + Math.abs(mv.y) > 0.2 ? Math.atan2(mv.y, mv.x) : this.aimAngle;
    const cost = Math.round(8 * (this.mods.dashCeCostMult || 1));
    if (this.ce < cost) {
      this.world.audio?.play('deny');
      return;
    }
    this.ce -= cost;
    this.world.stats.ceSpent += cost;
    this.dodgeCd = this.dodgeCdMax * (this.mods.dashCdMult || 1);
    this.phase = null;
    this.ability = null;
    this.moveVx = Math.cos(ang) * this.dashSpeed * (this.mods.dashDistMult || 1);
    this.moveVy = Math.sin(ang) * this.dashSpeed * (this.mods.dashDistMult || 1);
    this.moveT = 0.16;
    this.invulnT = Math.max(this.invulnT, 0.2 + (this.mods.dodgeIframesBonus || 0));
    this.perfectDodgeWindow = 0.19;
    this.setState('dodge', 'dodge');
    this.faceAngle(ang);
    this.world.audio?.play('dodge');
    for (let i = 0; i < 4; i++) {
      this.world.fx.afterimage({ x: this.x, y: this.y, look: this.look, facingX: this.facingX }, '#7ec8ff', 0.25);
    }
    this.world.fx.burst(this.x, this.y - 6, 8, { color: '#7ec8ff', speed: 60, life: 0.3 });
    if (this.mods.dodgeEcho) {
      this.world.addZone({
        x: this.x,
        y: this.y,
        radius: 24,
        delay: 0.06,
        dmg: this.mods.dodgeEcho,
        owner: this,
        team: this.team,
        category: 'technique',
        color: '#7ec8ff',
        ticks: 1,
        tickInterval: 0.2,
        life: 0.35,
        hits: new Set(),
        hasHitOnce: new Set(),
      });
    }
  }

  onPerfectDodge() {
    const w = this.world;
    w.stats.dodges++;
    w.stats.perfectDodges++;
    const ceGain = 8 + (this.mods.perfectDodgeCe || 0);
    this.addCe(ceGain);
    w.stats.ceRecovered += ceGain;
    w.fx.text(this.x, this.y - 36, 'PERFECT DODGE', { color: '#8fe3b0', scale: 1.1, life: 0.9 });
    w.fx.ring(this.x, this.y - 10, 26, '#8fe3b0', 0.35, 2);
    w.fx.stop(0.05);
    w.audio?.play('dodge');
    if (this.mods.perfectDodgeBuff) {
      this.buffT = 2.5;
      this.buffMult = 1.3;
      w.fx.text(this.x, this.y - 48, 'COUNTER FLOW +30%', { color: '#ffd166', scale: 0.85, life: 1 });
    }
  }

  // -------------------------------------------------------------------------
  // Reinforcement
  // -------------------------------------------------------------------------
  toggleReinforce() {
    const w = this.world;
    if (this.reinforced > 0) {
      this.reinforced = 0;
      this.aura = 0;
      w.fx.text(this.x, this.y - 34, 'REINFORCEMENT OFF', { color: '#9aa3b2', scale: 0.8, life: 0.6 });
      return;
    }
    const cost = Math.round(this.reinforceCost * (this.mods.reinforceCostMult || 1));
    if (this.ce < cost) {
      w.audio?.play('deny');
      w.fx.text(this.x, this.y - 34, 'NO CE', { color: '#7ec8ff', scale: 0.8, life: 0.5 });
      return;
    }
    this.ce -= cost;
    w.stats.ceSpent += cost;
    this.reinforced = 4.6 * (this.mods.reinforceDurMult || 1);
    this.aura = 1.2;
    this.auraColor = this.charId === 'sukuna' ? '#ff5a5a' : this.charId === 'gojo' ? '#9fd8ff' : '#ff9a6b';
    w.audio?.play('reinforce');
    w.fx.ring(this.x, this.y - 10, 26, this.auraColor, 0.3, 2);
    w.fx.burst(this.x, this.y - 10, 10, { color: this.auraColor, speed: 80, life: 0.35 });
    w.fx.text(this.x, this.y - 38, 'REINFORCED', { color: this.auraColor, scale: 0.9, life: 0.7 });
  }

  // -------------------------------------------------------------------------
  // Black Flash
  // -------------------------------------------------------------------------
  isBFEligible(ab, isBasic) {
    if (!ab) return false;
    if (ab.blackFlash) return true;
    if (isBasic && (ab.type === 'melee' || ab.type === 'multi')) return true;
    if (!isBasic && (ab.type === 'melee' || ab.type === 'dash') && ['physical', 'blunt', 'cut'].includes(ab.category)) return true;
    return false;
  }

  registerBlackFlashAttempt(ab, isBasic) {
    if (!this.blackSparks) {
      this.bfState = null;
      return;
    }
    if (!this.isBFEligible(ab, isBasic)) return;
    if (this.reinforced <= 0) {
      // reinforcement must be active; no attempt is registered
      return;
    }
    const windowBase = 0.155 * (this.mods.bfWindowMult || 1) * (this.blackFlashMod || 1) * (this.bfChainT > 0 ? 1.6 : 1);
    const impact = Math.max(0.02, this.startupDur);
    this.bfState = {
      ab,
      t: 0,
      impact,
      windowStart: impact - 0.09,
      windowEnd: impact + windowBase,
      windowOpen: false,
      resolved: false,
      isBasic,
    };
    this.world.stats.bfAttempts++;
  }

  updateBlackFlash(dt) {
    const s = this.bfState;
    if (!s) return;
    s.t += dt;
    if (s.t >= s.windowStart && s.t <= s.windowEnd && !s.resolved) {
      if (!s.windowOpen) {
        s.windowOpen = true;
        this.world.fx.ring(this.x, this.y - 12, 18, '#ff2a4a', 0.18, 1.5);
      }
    }
    if (s.t > s.windowEnd && !s.resolved) {
      this.failBlackFlash();
    }
  }

  attemptBlackFlash() {
    const s = this.bfState;
    if (!s || s.resolved) return;
    s.resolved = true;
    s.windowOpen = false;
    this.bfArmed = { abilityId: s.ab.id, until: this.world.time + 0.45 };
    this.bfState = null;
    this.bfChainT = 1.2;
    this.world.fx.flash('#ff2a4a', 0.08);
    this.world.audio?.play('blackflash');
    this.world.fx.text(this.x, this.y - 42, 'BLACK FLASH!', { color: '#ff2a4a', scale: 1.35, life: 0.9, crit: true });
    this.world.fx.ring(this.x, this.y - 12, 30, '#ff2a4a', 0.4, 3);
    this.world.fx.stop(0.06);
    this.addUlt(6);
  }

  failBlackFlash() {
    const s = this.bfState;
    if (!s || s.resolved) {
      this.bfState = null;
      return;
    }
    s.resolved = true;
    this.bfState = null;
    this.world.stats.bfFail++;
    if (this.world.stats.bfAttempts > this.world.stats.bfSuccess + this.world.stats.bfFail) {
      // keep counts consistent
    }
    this.world.fx.text(this.x, this.y - 36, 'MISS', { color: '#777f8f', scale: 0.75, life: 0.5 });
  }

  /** Called by a hitbox just before it deals damage — true means Black Flash. */
  consumeBlackFlash(ability) {
    if (!this.bfArmed) return false;
    if (this.world.time > this.bfArmed.until) {
      this.bfArmed = null;
      return false;
    }
    if (this.bfArmed.abilityId !== ability?.id) return false;
    this.bfArmed = null;
    this.bfEmpowered = 4;
    if (this.mods.bfCeRefund) {
      this.addCe(this.mods.bfCeRefund);
      this.world.stats.ceRecovered += this.mods.bfCeRefund;
    }
    if (this.mods.bfTechBuff) this.pendingTechBuff = 6;
    if (this.mods.bfChain) this.bfChainT = Math.max(this.bfChainT, 1.4);
    this.lastBfTime = this.world.time;
    return true;
  }

  // -------------------------------------------------------------------------
  // Ultimate
  // -------------------------------------------------------------------------
  ultimateCost() {
    return Math.round((this.ultimate?.ultCost || 100) * (this.mods.ultCostMult || 1));
  }

  tryUltimate() {
    if (!this.ultimate || this.stunT > 0) return;
    const w = this.world;
    if (this.ultimateLocked) {
      w.audio?.play('deny');
      w.fx.text(this.x, this.y - 38, 'ULTIMATE LOCKED — TRAIN WITH NPCs', { color: '#ffb03a', scale: 0.8, life: 0.9 });
      return;
    }
    if (this.transformT > 0) return;
    if (this.canTenShadows && this.ultimate?.type === 'tenShadowsUlt') {
      const met = this.ultMeter;
      if (met < 50) {
        w.audio?.play('deny');
        w.fx.text(this.x, this.y - 38, '50% REQUIRED', { color: '#a79bff', scale: 0.85, life: 0.8 });
        return;
      }
      const canMaho = this.owned.mahoraga && met >= 100;
      if (canMaho) {
        this.ultMeter = 0;
        this.spawnUltimateSummon('mahoraga');
      } else if (canAgitoOwned(this.owned)) {
        this.ultMeter -= 50;
        this.spawnUltimateSummon('agito');
      } else {
        w.audio?.play('deny');
        w.fx.text(this.x, this.y - 38, 'AGITO: TAME DEER · NUE · TIGER · SERPENT', { color: '#c9a2ff', scale: 0.78, life: 1.1 });
      }
      return;
    }
    const cost = this.ultimateCost();
    if (this.ultMeter < cost) {
      w.audio?.play('deny');
      w.fx.text(this.x, this.y - 38, `${Math.ceil(cost - this.ultMeter)}% MORE`, { color: '#ffb03a', scale: 0.85, life: 0.8 });
      return;
    }
    if (this.phase) return;
    this.ultMeter -= cost;
    w.stats.ults++;
    this.controlEnabled = true;
    const ok = castAbility(w, this, this.ultimate, this.aimAngle, { aimPoint: this.aimPoint, free: true });
    if (ok) {
      w.audio?.play('ult');
      w.fx.flash(this.ultimate.color || '#ffffff', 0.2);
      w.fx.shake(6, 0.3);
      w.fx.text(this.x, this.y - 48, this.ultimate.name.toUpperCase(), {
        color: this.ultimate.color || '#ffffff',
        scale: 1.2,
        life: 1.3,
      });
      this.controlEnabled = false;
    }
  }

  doUltimate(ab, angle, aimPoint) {
    const w = this.world;
    const mult = this.mods.ultDmgMult || 1;
    if (ab?.type === 'transform') { activateTransform(w, this, ab); return; }
    const switchId = this.isCustomSorcerer ? 'custom' : this.charId;
    switch (switchId) {
      case 'yuji': {
        // three forced Black Flashes
        for (let i = 0; i < 3; i++) {
          this.schedule.push({
            t: 0.1 + i * 0.22,
            fn: () => {
              const target = w.nearestEnemyOf(this, 90);
              const ang = target ? Math.atan2(target.y - this.y, target.x - this.x) : angle;
              this.faceAngle(ang);
              const hb = {
                owner: this,
                team: this.team,
                x: this.x,
                y: this.y,
                range: 44,
                arc: 2.0,
                dmg: 44 * mult * (this.char.power || 1),
                category: 'technique',
                knockback: 150,
                hitstop: 0.09,
                color: '#ff2a4a',
                life: 0.1,
                hits: new Set(),
                pierce: 99,
                isUlt: true,
                blackFlash: true,
              };
              w.addHitbox(hb);
              w.fx.slash(this.x, this.y - 12, ang, 2.2, '#ff2a4a', 1, 0.22, 4);
              w.fx.burst(this.x + Math.cos(ang) * 20, this.y - 12 + Math.sin(ang) * 12, 18, {
                color: '#ff2a4a',
                color2: '#1a0008',
                speed: 180,
                life: 0.45,
                glow: true,
              });
              w.fx.shake(5, 0.2);
              w.fx.stop(0.07);
              w.audio?.play('blackflash');
              w.fx.flash('#2a0008', 0.14);
            },
          });
        }
        break;
      }
      case 'nobara': {
        const marked = w.enemies.filter((e) => !e.dead && e.markStacks > 0);
        const targets = marked.length ? marked : w.enemies.filter((e) => !e.dead && dist(e.x, e.y, this.x, this.y) < 220);
        w.audio?.play('ult');
        w.fx.flash('#ff3d6a', 0.3);
        w.fx.shake(7, 0.5);
        for (const e of targets) {
          const stacks = Math.max(1, e.markStacks) + (marked.includes(e) ? 2 : 0);
          w.fx.ring(e.x, e.y - 10, 30, '#ff6b8a', 0.5, 3, true);
          this.schedule.push({
            t: 0.15,
            fn: () => {
              w.damage(e, 26 * stacks * mult, {
                source: this,
                category: 'technique',
                knockback: 180,
                hitstop: 0.08,
                isUlt: true,
              });
              e.markStacks = 0;
            },
          });
        }
        if (!targets.length) {
          w.addZone({
            x: this.x + Math.cos(angle) * 50,
            y: this.y + Math.sin(angle) * 50,
            radius: 90,
            delay: 0.2,
            dmg: 40 * mult,
            owner: this,
            team: this.team,
            category: 'technique',
            color: '#ff3d6a',
            ticks: 2,
            tickInterval: 0.25,
            life: 0.8,
            hits: new Set(),
            hasHitOnce: new Set(),
            isUlt: true,
            shake: 6,
          });
        }
        break;
      }
      case 'gojo': {
        spawnBeam(w, this, { ...ab, type: 'beam' }, angle);
        this.schedule.push({
          t: 0.4,
          fn: () => {
            w.fx.flash('#b06bff', 0.25);
            w.fx.shake(8, 0.4);
            for (let i = 0; i < 14; i++) {
              const d = 30 + i * 18;
              w.fx.addParticle({
                x: this.x + Math.cos(angle) * d,
                y: this.y - 8 + Math.sin(angle) * d,
                vx: (Math.random() - 0.5) * 80,
                vy: (Math.random() - 0.5) * 80,
                life: 0.6,
                color: i % 2 ? '#b06bff' : '#ffffff',
                size: 3,
                glow: true,
              });
            }
          },
        });
        break;
      }
      case 'sukuna': {
        const targets = w.enemies.filter((e) => !e.dead);
        for (const e of targets) {
          if (dist(this.x, this.y, e.x, e.y) > 320) continue;
          w.fx.slash(e.x, e.y - 8, angle, 2.6, '#ff2a2a', 1, 0.3, 4);
          w.damage(e, 55 * mult, { source: this, category: 'cut', knockback: 140, hitstop: 0.06, isUlt: true });
          e.applyStatus('mark', 1, 6);
        }
        this.schedule.push({
          t: 0.9,
          fn: () => {
            for (const e of w.enemies) {
              if (e.dead) continue;
              w.fx.slash(e.x, e.y - 8, angle + Math.PI / 2, 2.8, '#ff2a2a', -1, 0.3, 4);
              w.damage(e, 45 * mult, { source: this, category: 'cut', knockback: 200, hitstop: 0.08, isUlt: true });
            }
            w.fx.flash('#8a0010', 0.2);
            w.fx.shake(8, 0.35);
            w.audio?.play('heavy');
          },
        });
        break;
      }
      default: {
        w.addZone({
          x: aimPoint?.x || this.x,
          y: aimPoint?.y || this.y,
          radius: 100,
          delay: 0.2,
          dmg: 80 * mult,
          owner: this,
          team: this.team,
          category: 'area',
          color: ab.color || '#ffffff',
          ticks: 1,
          tickInterval: 0.2,
          life: 0.6,
          hits: new Set(),
          hasHitOnce: new Set(),
          isUlt: true,
          shake: 8,
        });
      }
    }
  }

  spawnUltimateSummon(id) {
    // delegated to summon system attached to the world by the scene
    if (this.world.spawnUltimateSummon) {
      this.world.spawnUltimateSummon(this, id);
    }
  }

  // -------------------------------------------------------------------------
  // Summons & domain
  // -------------------------------------------------------------------------
  cycleSummon() {
    if (!this.canTenShadows) return;
    const list = this.summonOptions || [];
    if (!list.length) return;
    this.summonIndex = (this.summonIndex + 1) % list.length;
    this.world.audio?.play('ui');
    this.world.fx.text(this.x, this.y - 40, `→ ${SHIKIGAMI[list[this.summonIndex]]?.name || 'None'}`, {
      color: '#a79bff',
      scale: 0.85,
      life: 0.9,
    });
  }

  doSummon(ab) {
    if (this.world.summonShikigami) {
      const list = this.summonOptions || [];
      const id = list[this.summonIndex] || 'divineDogs';
      this.world.summonShikigami(this, id);
    }
  }

  tryDomain(domainDef = null) {
    const domAb = domainDef || this.domainAbility;
    if (!domAb) {
      this.world.fx.text(this.x, this.y - 38, 'NO DOMAIN AWAKENED', { color: '#777f8f', scale: 0.8, life: 0.8 });
      return;
    }
    if (this.domainLocked && !domainDef) {
      this.world.fx.text(this.x, this.y - 38, 'DOMAIN LOCKED — TRAIN WITH NPCs', { color: '#c9a2ff', scale: 0.8, life: 0.9 });
      return;
    }
    if (!this.isCustomSorcerer && !domainDef && !this.save?.data?.unlocks?.domains?.includes(this.charId) && !this.world.allowAnyDomain) {
      this.world.fx.text(this.x, this.y - 38, 'DOMAIN NOT UNLOCKED', { color: '#777f8f', scale: 0.8, life: 0.8 });
      return;
    }
    if (this.world.domain) {
      this.world.fx.text(this.x, this.y - 38, 'DOMAIN ACTIVE', { color: '#c9a2ff', scale: 0.8, life: 0.7 });
      return;
    }
    if (this.domainCd > 0) return;
    const cost = Math.round((domAb.cost || 60) * (this.mods.domainCostMult || 1));
    if (this.ce < cost) {
      this.world.audio?.play('deny');
      this.world.fx.text(this.x, this.y - 38, `${cost} CE REQUIRED`, { color: '#7ec8ff', scale: 0.8, life: 0.8 });
      return;
    }
    // Never burn CE/cooldown on a cast the phase machine rejects.
    const ok = castAbility(this.world, this, domAb, this.aimAngle, { free: true });
    if (!ok) {
      this.world.fx.text(this.x, this.y - 38, 'FINISH CURRENT MOVE', { color: '#c9a2ff', scale: 0.75, life: 0.6 });
      return;
    }
    this.ce -= cost;
    this.world.stats.ceSpent += cost;
    this.domainCd = (domAb.cd || 35) * 1;
    this.world.stats.domains++;
  }

  tryBoogie() {
    if (!this.boogieUnlocked || this.boogieCd > 0) return;
    const w = this.world;
    const target = w.nearestEnemyOf(this, 150);
    if (!target) {
      w.fx.text(this.x, this.y - 34, 'NO TARGET', { color: '#777f8f', scale: 0.75, life: 0.6 });
      return;
    }
    this.boogieCd = 6;
    const ox = this.x;
    const oy = this.y;
    w.fx.burst(ox, oy - 10, 12, { color: '#ff9a5c', speed: 90, life: 0.4, glow: true });
    w.fx.burst(target.x, target.y - 10, 12, { color: '#ff9a5c', speed: 90, life: 0.4, glow: true });
    this.x = target.x;
    this.y = target.y;
    target.x = ox;
    target.y = oy;
    target.knockback(0, 0, 0);
    target.applyStatus('stun', 0, 0.45);
    w.fx.flash('#ff9a5c', 0.1);
    w.fx.shake(3, 0.2);
    w.audio?.play('dodge');
    this.buffT = 2.2;
    this.buffMult = 1.35;
    w.fx.text(this.x, this.y - 40, 'BOOGIE WOOGIE! +35%', { color: '#ff9a5c', scale: 1, life: 1 });
    this.addUlt(5);
    if (this.mods.boogieFollowup) {
      this.bfChainT = Math.max(this.bfChainT, 1.2);
      this.cdMap['yuji_crush'] = 0;
      this.cdMap['sukuna_cleave'] = 0;
      this.cdMap['megumi_command'] = 0;
      this.cdMap['nobara_hairpin'] = 0;
      this.cdMap['gojo_red'] = 0;
    }
  }

  // -------------------------------------------------------------------------
  // takeDamage wrapper used by world (keeps stats coherent)
  // -------------------------------------------------------------------------
  onDamaged(dmg) {
    this.world.fx.shake(2, 0.12);
  }

  healPercent(p) {
    this.heal(this.maxHp * p);
  }
}
