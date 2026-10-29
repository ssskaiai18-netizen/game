// ---------------------------------------------------------------------------
// entity.js — the shared actor model used by the player, enemies, bosses,
// sparring NPCs, shikigami and training dummies.
//
// Everything about an actor's combat state lives here; abilities are executed
// by game/combat.js and AI decisions by game/ai.js.
// ---------------------------------------------------------------------------

import { clamp, angleDiff, TAU } from '../core/util.js';

let nextId = 1;

export class Entity {
  constructor(world, def = {}) {
    this.world = world;
    this.id = nextId++;
    this.team = def.team || 'enemy';
    this.name = def.name || 'Cursed Spirit';
    this.def = def;
    this.kind = def.kind || 'enemy';

    this.x = def.x || 0;
    this.y = def.y || 0;
    this.vx = 0;
    this.vy = 0;
    this.radius = def.radius || 7;
    this.scale = def.scale || 1;
    this.speed = def.speed || 70;
    this.baseSpeed = this.speed;

    this.maxHp = def.hp || 50;
    this.hp = this.maxHp;
    this.maxCe = def.ce || 100;
    this.ce = this.maxCe;

    this.facing = 0;
    this.facingX = 1;
    this.state = 'idle';
    this.animState = 'idle';
    this.animT = 0;
    this.stateT = 0;
    this.moving = 0;
    this.dead = false;
    this.removed = false;
    this.deathT = 0;

    // combat
    this.ability = null;
    this.phase = null;
    this.phaseT = 0;
    this.startupDur = 0;
    this.activeDur = 0;
    this.recoveryDur = 0;
    this.abilityAngle = 0;
    this.effectsDone = false;
    this.multiTimer = 0;
    this.hitsDone = 0;
    this.cdMap = {};
    this.globalCd = 0;
    this.invulnT = 0;
    this.stunT = 0;
    this.rootT = 0;
    this.slowT = 0;
    this.slowMult = 1;
    this.flash = 0;
    this.hitstunT = 0;
    this.knockVx = 0;
    this.knockVy = 0;
    this.guardT = 0;
    this.counterActive = 0;
    this.counterAbility = null;
    this.reinforced = 0;
    this.reinforceDur = 0;
    this.auraColor = def.auraColor || '#8f7bff';
    this.aura = 0;

    // statuses
    this.markStacks = 0;
    this.markT = 0;
    this.bleedT = 0;
    this.bleedDmg = 0;
    this.burnT = 0;
    this.burnDmg = 0;
    this.disruptT = 0;
    this.regen = def.regen || 0;

    // ai
    this.brain = def.brain || 'enemy';
    this.ai = def.ai || {};
    this.aiState = 'idle';
    this.aiTimer = 0;
    this.thinkTimer = 0;
    this.target = null;
    this.lastAttacker = null;
    this.strafeDir = Math.random() < 0.5 ? -1 : 1;
    this.wanderT = 0;
    this.homeX = this.x;
    this.homeY = this.y;
    this.patrolAngle = Math.random() * TAU;

    // meta
    this.isPlayer = false;
    this.isBoss = false;
    this.isSummon = false;
    this.isDummy = false;
    this.isNpc = false;
    this.armor = def.armor || 0;
    this.adapts = !!def.adapts;
    this.adapt = def.adapt || null; // { category: stage }
    this.adaptStageShown = 0;
    this.adaptKills = 0;
    this.lifetime = def.lifetime || 0;
    this.maxLifetime = this.lifetime;
    this.owner = def.owner || null;
    this.dmgMult = def.dmgMult || 1;
    this.startupMult = def.startupMult || 1;
    this.recoveryMult = def.recoveryMult || 1;
    this.cdMult = def.cdMult || 1;
    this.knockResist = def.knockResist || 0;
    this.staggerResist = def.staggerResist || 0;
    this.look = def.look || null;
    this.rig = def.rig || null;
    this.pal = def.pal || null;
    this.abilities = def.abilities || [];
    this.stats = { damageDealt: 0, damageTaken: 0, kills: 0, hits: 0 };
    this.deathReward = def.deathReward || null;
    this.goldValue = def.goldValue || 0;
    this.pointsValue = def.pointsValue || 0;
    this.tintFlash = 0;
    this.spawnT = 0.35;
    this.angle = 0;
    this.shadow = true;
    this.hitFlashColor = '#ffffff';
    this.buffered = null;
  }

  get alive() {
    return !this.dead;
  }

  setState(s, anim) {
    this.state = s;
    this.animState = anim || s;
    this.animT = 0;
    this.stateT = 0;
  }

  faceAngle(a) {
    this.facing = a;
    this.facingX = Math.cos(a) >= 0 ? 1 : -1;
  }

  faceTowards(x, y) {
    this.faceAngle(Math.atan2(y - this.y, x - this.x));
  }

  canAct() {
    return !this.dead && this.stunT <= 0 && this.phase === null;
  }

  get busy() {
    return this.phase !== null;
  }

  addCe(v) {
    const before = this.ce;
    this.ce = clamp(this.ce + v, 0, this.maxCe);
    return this.ce - before;
  }

  spendCe(v) {
    if (this.ce < v) return false;
    this.ce -= v;
    return true;
  }

  heal(v) {
    const before = this.hp;
    this.hp = clamp(this.hp + v, 0, this.maxHp);
    return this.hp - before;
  }

  consumeBlackFlash(ability) {
    if (!this.bfArmed) return false;
    if (this.world.time > this.bfArmed.until) {
      this.bfArmed = null;
      return false;
    }
    if (this.bfArmed.abilityId !== (ability && ability.id)) return false;
    this.bfArmed = null;
    this.bfEmpowered = 3;
    return true;
  }

  knockback(dx, dy, force) {
    const m = Math.hypot(dx, dy) || 1;
    const resist = 1 - clamp(this.knockResist, 0, 0.9);
    this.knockVx += (dx / m) * force * resist;
    this.knockVy += (dy / m) * force * resist;
  }

  applyStatus(type, amount, dur) {
    switch (type) {
      case 'bleed':
        this.bleedDmg = Math.max(this.bleedDmg, amount);
        this.bleedT = Math.max(this.bleedT, dur);
        break;
      case 'burn':
        this.burnDmg = Math.max(this.burnDmg, amount);
        this.burnT = Math.max(this.burnT, dur);
        break;
      case 'slow':
        this.slowMult = Math.max(this.slowMult, 1 - amount);
        this.slowT = Math.max(this.slowT, dur);
        break;
      case 'stun':
        this.stunT = Math.max(this.stunT, dur);
        break;
      case 'root':
        this.rootT = Math.max(this.rootT, dur);
        break;
      case 'mark':
        this.markStacks = Math.min(5, this.markStacks + 1);
        this.markT = Math.max(this.markT, dur || 8);
        break;
      case 'disrupt':
        this.disruptT = Math.max(this.disruptT, dur);
        break;
      default:
        break;
    }
  }

  updateStatuses(dt, world) {
    if (this.invulnT > 0) this.invulnT -= dt;
    if (this.stunT > 0) this.stunT -= dt;
    if (this.rootT > 0) this.rootT -= dt;
    if (this.flash > 0) this.flash = Math.max(0, this.flash - dt * 5);
    if (this.tintFlash > 0) this.tintFlash = Math.max(0, this.tintFlash - dt * 3);
    if (this.hitstunT > 0) this.hitstunT -= dt;
    if (this.globalCd > 0) this.globalCd -= dt;
    if (this.reinforced > 0) {
      this.reinforced -= dt;
      if (this.isPlayer) {
        const drain = 1.6 * dt;
        this.ce = Math.max(0, this.ce - drain);
        if (this.ce <= 0) this.reinforced = 0;
      }
      if (this.reinforced <= 0) {
        this.reinforced = 0;
        this.aura = Math.max(0, this.aura - 3);
      }
    }
    if (this.slowT > 0) {
      this.slowT -= dt;
      if (this.slowT <= 0) this.slowMult = 1;
    }
    if (this.markT > 0) {
      this.markT -= dt;
      if (this.markT <= 0) this.markStacks = 0;
    }
    if (this.bleedT > 0) {
      this.bleedT -= dt;
      this._bleedTick = (this._bleedTick || 0) + dt;
      if (this._bleedTick > 0.5) {
        this._bleedTick = 0;
        world.damage(this, this.bleedDmg * 0.5, { category: 'physical', silent: true, dot: true });
      }
    }
    if (this.burnT > 0) {
      this.burnT -= dt;
      this._burnTick = (this._burnTick || 0) + dt;
      if (this._burnTick > 0.4) {
        this._burnTick = 0;
        world.damage(this, this.burnDmg * 0.4, { category: 'fire', silent: true, dot: true });
        world.fx.burst(this.x, this.y - 8, 2, { color: '#ff8a2a', speed: 20, life: 0.25 });
      }
    }
    if (this.disruptT > 0) this.disruptT -= dt;
    if (this.regen > 0 && !this.dead) this.heal(this.regen * dt);
    for (const k of Object.keys(this.cdMap)) {
      if (this.cdMap[k] > 0) this.cdMap[k] = Math.max(0, this.cdMap[k] - dt);
    }
    if (this.animT !== undefined) this.animT += dt;
  }
}
