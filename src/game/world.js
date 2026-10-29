// ---------------------------------------------------------------------------
// world.js — the simulation container shared by the hub, dungeon, training,
// sparring and taming scenes. Owns actors, projectiles, hitboxes, zones,
// pickups, the camera, the damage pipeline and the visual effect layer.
// ---------------------------------------------------------------------------

import { clamp, dist, angleDiff, lerp, Rng, TAU } from '../core/util.js';
import { FX } from '../render/fx.js';
import { Entity } from './entity.js';
import { updateHitboxes, updateProjectiles, updateZones, updateBeams, advanceAbility } from './combat.js';
import { drawActor } from '../render/actor.js';
import { drawBackground } from '../render/backgrounds.js';
import { updateAI } from './ai.js';
import { getEnemy } from '../data/enemies.js';
import { summonShikigami, spawnUltimateSummon, commandSummons, summonFusion, spawnAdds, detonateEnemy, handleSummonDeath } from './summon.js';
import { startDomain, startBossDomain, updateDomain, endDomain } from './domain.js';
import { updateDivergent, endTransform } from './combat.js';
import { drawDomainScenery } from '../render/backgrounds.js';

export function freshStats() {
  return {
    totalDamage: 0,
    hits: 0,
    highestHit: 0,
    combo: 0,
    longestCombo: 0,
    comboTimer: 0,
    dodges: 0,
    damageAvoided: 0,
    ceSpent: 0,
    ceRecovered: 0,
    bfAttempts: 0,
    bfSuccess: 0,
    bfFail: 0,
    summonDamage: 0,
    techDamage: 0,
    domainDamage: 0,
    ultDamage: 0,
    basicDamage: 0,
    damageTaken: 0,
    kills: 0,
    techniques: 0,
    ults: 0,
    domains: 0,
    perfectDodges: 0,
    deaths: 0,
  };
}

export class World {
  constructor(game, opts = {}) {
    this.game = game;
    this.scene = opts.scene || null;
    this.rng = new Rng(opts.seed || ((Math.random() * 4294967295) >>> 0));
    this.seed = this.rng.seed;
    this.actors = [];
    this.enemies = [];
    this.summons = [];
    this.projectiles = [];
    this.hitboxes = [];
    this.zones = [];
    this.beams = [];
    this.pickups = [];
    this.fx = new FX();
    this.fx.enabledShake = game.save ? game.save.data.settings.shake !== false : true;
    this.arena = opts.arena || { x: 0, y: 0, w: 640, h: 360 };
    this.camera = { x: 0, y: 0 };
    this.time = 0;
    this.hitstop = 0;
    this.stats = freshStats();
    this.player = null;
    this.domain = null;
    this.obstacles = opts.obstacles || [];
    this.decor = opts.decor || [];
    this.theme = opts.theme || 'hub';
    this.trainMode = !!opts.trainMode;
    this.paused = false;
    this.finished = false;
    this.killLog = [];
    this.events = [];
    this.groupKillCount = 0;
    this.lastAdaptCategory = {};
    this.effectScale = 1;
    this.safeMode = false;
    this.allowAnyDomain = false;

    // system hooks (overridden by the player controller where needed)
    this.onUltimate = (actor, ab, angle, aimPoint) => {
      if (actor.doUltimate) actor.doUltimate(ab, angle, aimPoint);
      else this.genericUltimate(actor, ab, angle, aimPoint);
    };
    this.onSummonCommand = (actor, ab) => commandSummons(this, actor, ab);
    this.onSummonAdds = (actor, ab) => spawnAdds(this, actor, ab);
    this.onFusion = (actor, ab) => summonFusion(this, actor, ab);
    this.shadowPool = []; // pooled shadow-copy entities (Chimera Shadow Garden)
    this.onDomainRequest = (actor, ab) => startDomain(this, actor, ab);
    this.onTenShadowsUlt = (actor, ab) => actor.tryUltimate?.();
    this.spawnUltimateSummon = (owner, id) => spawnUltimateSummon(this, owner, id);
    this.summonShikigami = (owner, id, opts) => summonShikigami(this, owner, id, opts);
    this.startBossDomain = (actor, def) => startBossDomain(this, actor, def);
    this.detonateEnemy = (a) => detonateEnemy(this, a);
  }

  updateActorAI(a, dt) {
    updateAI(this, a, dt);
  }

  genericUltimate(actor, ab, angle, aimPoint) {
    const x = aimPoint ? aimPoint.x : actor.x + Math.cos(angle) * 90;
    const y = aimPoint ? aimPoint.y : actor.y + Math.sin(angle) * 90;
    this.addZone({
      x, y, radius: 90, delay: 0.35, dmg: (ab.dmg || 40) * 1.4, owner: actor, team: actor.team,
      category: ab.category || 'area', color: ab.color || '#ffffff', ticks: 1, tickInterval: 0.2,
      life: 0.7, hits: new Set(), hasHitOnce: new Set(), isUlt: true, shake: 7, knockback: 220,
    });
    this.fx.flash(ab.color || '#ffffff', 0.25);
    this.fx.shake(7, 0.5);
  }

  // -------------------------------------------------------------------------
  // Setup
  // -------------------------------------------------------------------------
  addActor(actor) {
    this.actors.push(actor);
    if (actor.team === 'enemy') this.enemies.push(actor);
    if (actor.isSummon) this.summons.push(actor);
    return actor;
  }

  spawnEnemy(def, x, y, extras = {}) {
    if (typeof def === 'string') def = getEnemy(def);
    const e = new Entity(this, {
      ...def,
      team: 'enemy',
      x,
      y,
      hp: Math.round((def.hp || 40) * (extras.hpMult || 1)),
      radius: def.radius || 7,
      brain: extras.brain || (def.moves ? 'boss' : 'enemy'),
      ...extras,
    });
    e.enemyDef = def;
    e.isBoss = !!def.moves;
    e.abilities = def.abilities || def.moves || [];
    e.moveCd = {};
    e.phaseIndex = 1;
    e.invulnT = 0.3;
    e.aiState = 'spawn';
    e.aiTimer = 0.4;
    e.homeX = x;
    e.homeY = y;
    e.wanderAngle = this.rng.next() * TAU;
    e.pointsValue = def.points || 0;
    e.goldValue = def.tribute || 0;
    if (def.adapts) {
      e.adapt = {};
      for (const k of ['physical', 'cut', 'blunt', 'fire', 'electric', 'water', 'projectile', 'area', 'technique', 'domain']) {
        e.adapt[k] = { xp: 0, stage: 0 };
      }
    }
    return this.addActor(e);
  }

  spawnDummy(x, y, type) {
    const e = new Entity(this, {
      team: 'enemy',
      kind: 'dummy',
      name: type === 'reinforcement' ? 'Reinforcement Dummy' : type === 'combat' ? 'Combat Dummy' : 'Basic Dummy',
      x,
      y,
      hp: type === 'basic' ? 999999 : 999999,
      radius: type === 'combat' ? 9 : 8,
      speed: 0,
      brain: 'dummy',
      isDummy: true,
      armor: type === 'reinforcement' ? 0.15 : type === 'combat' ? 0.05 : 0,
    });
    e.dummyType = type;
    e.hitInvuln = false;
    e.swayT = 0;
    e.lastHitTime = 0;
    this.addActor(e);
    return e;
  }

  nearestEnemyOf(actor, maxDist = 400) {
    let best = null;
    let bestD = maxDist;
    for (const t of this.actors) {
      if (!t || t.dead || t.team === actor.team) continue;
      if (t.isDummy && !this.trainMode) continue;
      const d = dist(actor.x, actor.y, t.x, t.y);
      if (d < bestD) {
        bestD = d;
        best = t;
      }
    }
    return best;
  }

  nearestTargetForEnemy(actor) {
    let best = null;
    let bestD = 460;
    const p = this.player;
    if (p && !p.dead && p.team !== actor.team) {
      best = p;
      bestD = dist(actor.x, actor.y, p.x, p.y);
    }
    for (const s of this.summons) {
      if (!s || s.dead) continue;
      const d = dist(actor.x, actor.y, s.x, s.y) * 1.15;
      if (d < bestD) {
        bestD = d;
        best = s;
      }
    }
    return best;
  }

  isWalkable(x, y, r = 4) {
    const a = this.arena;
    if (x - r < a.x || x + r > a.x + a.w || y - r < a.y + 8 || y + r > a.y + a.h) return false;
    for (const o of this.obstacles) {
      if (x + r > o.x && x - r < o.x + o.w && y + r > o.y && y - r < o.y + o.h) return false;
    }
    return true;
  }

  pickupsAt(x, y) {
    for (let i = this.pickups.length - 1; i >= 0; i--) {
      const p = this.pickups[i];
      if (dist(x, y, p.x, p.y) < 14) {
        this.pickups.splice(i, 1);
        return p;
      }
    }
    return null;
  }

  // -------------------------------------------------------------------------
  // Update
  // -------------------------------------------------------------------------
  update(dt) {
    if (this.paused || this.finished) {
      this.fx.update(dt * 0.4);
      return;
    }
    this.time += dt;
    if (this.hitstop > 0) {
      this.hitstop -= dt;
      const s = this.hitstop > 0 ? 0.06 : 1;
      this.fx.update(dt * 0.35);
      this.updateActors(dt * s, true);
      this.updateEffects(dt * s);
      this.updateCamera(dt);
      return;
    }
    this.updateActors(dt, false);
    this.updateEffects(dt);
    this.fx.update(dt);
    this.updateCamera(dt);
    this.stats.comboTimer -= dt;
    if (this.stats.comboTimer <= 0 && this.stats.combo > 0) {
      this.stats.combo = 0;
    }
    this.updatePickups(dt);
    if (this.domain) updateDomain(this, dt);
  }

  updateActors(dt, frozen) {
    const list = this.actors;
    for (let i = list.length - 1; i >= 0; i--) {
      const a = list[i];
      if (a.removed) {
        list.splice(i, 1);
        continue;
      }
      if (a.spawnT > 0) a.spawnT -= dt;
      a.updateStatuses(dt, this);
      if (a.dead) {
        a.deathT += dt;
        a.animT += dt;
        a.x += a.knockVx * dt;
        a.y += a.knockVy * dt;
        a.knockVx *= 0.9;
        a.knockVy *= 0.9;
        if (a.deathT > 1.1) a.removed = true;
        continue;
      }
      if (frozen) continue;
      if (a.infinityT > 0) a.infinityT -= dt;
      if (a.moveT > 0) {
        a.moveT -= dt;
        const ramp = a.moveRamp ? 1 + (1 - a.moveT / 0.15) * 0.6 : 1;
        a.x += a.moveVx * dt * ramp;
        a.y += a.moveVy * dt * ramp;
      }
      // ability phases
      if (a.phase) this.advanceActorAbility(a, dt);
      if (a.divergentState) updateDivergent(this, a, dt);
      if (a.transformT > 0) {
        a.transformT -= dt;
        if (a.transformT <= 0) endTransform(this, a);
      }
      // ai / player
      if (a.isPlayer) {
        a.controller?.update(dt);
      } else if (a.brain === 'dummy') {
        this.updateDummy(a, dt);
      } else {
        this.updateActorAI(a, dt);
      }
      // movement integration
      this.integrateActor(a, dt);
    }
    // Removed summons must not accumulate over long sessions.
    this.summons = this.summons.filter((s) => !s.removed);
    // separation
    for (let i = 0; i < list.length; i++) {
      const a = list[i];
      if (a.dead || a.isDummy) continue;
      for (let j = i + 1; j < list.length; j++) {
        const b = list[j];
        if (b.dead || b.isDummy) continue;
        const min = a.radius + b.radius;
        const d = dist(a.x, a.y, b.x, b.y);
        if (d > 0 && d < min) {
          const push = (min - d) / d * 0.5;
          const dx = (b.x - a.x) * push;
          const dy = (b.y - a.y) * push;
          const wa = a.isPlayer ? 0.72 : 0.5;
          const wb = b.isPlayer ? 0.72 : 0.5;
          a.x -= dx * wa;
          a.y -= dy * wa;
          b.x += dx * wb;
          b.y += dy * wb;
        }
      }
    }
    for (const s of this.summons) {
      if (s.lifetime !== undefined && !s.dead && s.maxLifetime > 0) {
        s.lifetime -= dt;
        if (s.lifetime <= 0) {
          this.dismissSummon(s, false);
        }
      }
    }
  }

  integrateActor(a, dt) {
    const spd = a.speed * (a.slowT > 0 ? a.slowMult : 1);
    if (a.stunT <= 0 && a.rootT <= 0) {
      a.x += a.vx * spd * dt;
      a.y += a.vy * spd * dt;
    }
    if (a.knockVx || a.knockVy) {
      a.x += a.knockVx * dt;
      a.y += a.knockVy * dt;
      a.knockVx *= Math.pow(0.0016, dt);
      a.knockVy *= Math.pow(0.0016, dt);
      if (Math.abs(a.knockVx) < 1) a.knockVx = 0;
      if (Math.abs(a.knockVy) < 1) a.knockVy = 0;
    }
    // bounds
    const a2 = this.arena;
    a.x = clamp(a.x, a2.x + a.radius, a2.x + a2.w - a.radius);
    a.y = clamp(a.y, a2.y + a.radius + 8, a2.y + a2.h - a.radius);
    for (const o of this.obstacles) {
      if (a.x + a.radius > o.x && a.x - a.radius < o.x + o.w && a.y + a.radius > o.y && a.y - a.radius < o.y + o.h) {
        const cx = clamp(a.x, o.x, o.x + o.w);
        const cy = clamp(a.y, o.y, o.y + o.h);
        const dx = a.x - cx;
        const dy = a.y - cy;
        const d = Math.hypot(dx, dy) || 1;
        a.x = cx + (dx / d) * a.radius;
        a.y = cy + (dy / d) * a.radius;
      }
    }
    const moving = Math.hypot(a.vx, a.vy);
    a.moving = moving;
    if (!a.phase && a.stunT <= 0) {
      if (moving > 0.15) {
        if (a.state !== 'walk' && a.state !== 'run' && !a.dead) a.setState('walk', moving > 0.75 ? 'run' : 'walk');
        else a.animState = moving > 0.75 ? 'run' : 'walk';
      } else if (a.state === 'walk' || a.state === 'run') {
        a.setState('idle', 'idle');
      }
    }
    if (a.state === 'hurt' && a.hitstunT <= 0) a.setState('idle', 'idle');
  }

  advanceActorAbility(a, dt) {
    if (a.counterActive > 0) a.counterActive -= dt;
    advanceAbility(this, a, dt);
  }

  updateDummy(d, dt) {
    d.vx = 0;
    d.vy = 0;
    d.swayT = Math.max(0, (d.swayT || 0) - dt);
    if (d.hp < d.maxHp && this.trainMode) {
      // dummies visually dent but never die
      d.hp = Math.min(d.maxHp, d.hp + d.maxHp * dt * 0.02);
    }
  }

  updateEffects(dt) {
    updateHitboxes(this, dt);
    updateProjectiles(this, dt);
    updateZones(this, dt);
    updateBeams(this, dt);
  }

  updatePickups(dt) {
    for (let i = this.pickups.length - 1; i >= 0; i--) {
      const p = this.pickups[i];
      p.t += dt;
      p.life -= dt;
      p.y += Math.sin(p.t * 5) * 0.05;
      if (p.life <= 0) {
        this.pickups.splice(i, 1);
        continue;
      }
      const pl = this.player;
      if (pl && !pl.dead && dist(pl.x, pl.y, p.x, p.y) < 12) {
        if (p.type === 'heal') {
          pl.heal(p.value);
          this.fx.text(pl.x, pl.y - 26, `+${Math.round(p.value)} HP`, { color: '#7cf0a0', life: 0.8 });
          this.game.audio?.play('heal');
        } else if (p.type === 'ce') {
          pl.addCe(p.value);
          this.stats.ceRecovered += p.value;
          this.fx.text(pl.x, pl.y - 26, `+${Math.round(p.value)} CE`, { color: '#7ec8ff', life: 0.8 });
          this.game.audio?.play('ce');
        } else if (p.type === 'tribute') {
          this.scene?.onTributePickup?.(p.value);
          this.fx.text(pl.x, pl.y - 26, `+${p.value} 呪`, { color: '#ffd166', life: 0.9 });
          this.game.audio?.play('pickup');
        }
        this.pickups.splice(i, 1);
      }
    }
  }

  updateCamera(dt) {
    const a = this.arena;
    const w = 640;
    const h = 360;
    let tx;
    let ty;
    if (a.w <= w) tx = a.x + a.w / 2 - w / 2;
    else {
      const p = this.player || { x: a.x + a.w / 2, y: a.y + a.h / 2 };
      tx = clamp(p.x - w / 2, a.x, a.x + a.w - w);
    }
    if (a.h <= h) ty = a.y + a.h / 2 - h / 2;
    else {
      const p = this.player || { x: a.x + a.w / 2, y: a.y + a.h / 2 };
      ty = clamp(p.y - h / 2, a.y, a.y + a.h - h);
    }
    // keep HUD space at top when arena is short
    if (a.h < h) ty = Math.min(ty, a.y + a.h - h + 26);
    this.camera.x = lerp(this.camera.x, tx, 1 - Math.pow(0.001, dt));
    this.camera.y = lerp(this.camera.y, ty, 1 - Math.pow(0.001, dt));
    if (Math.abs(this.camera.x - tx) < 0.4) this.camera.x = tx;
    if (Math.abs(this.camera.y - ty) < 0.4) this.camera.y = ty;
  }

  // -------------------------------------------------------------------------
  // Damage pipeline
  // -------------------------------------------------------------------------
  damage(target, amount, opts = {}) {
    if (!target || target.dead || this.finished) return 0;
    if (target.isDummy) {
      // dummies use the real pipeline; they simply never die
      target.hp = Math.max(1, target.hp);
    }
    if (target.isPlayer && target.perfectDodgeWindow > 0 && !opts.dot) {
      target.onPerfectDodge?.(opts);
      return 0;
    }
    if (target.invulnT > 0 && !opts.ignoreInvuln) {
      if (opts.source?.isPlayer) {
        this.stats.combo = 0;
      }
      return 0;
    }
    if (target.infinityT > 0 && !opts.isDomain) {
      target.infinityHits--;
      target.ce = Math.max(0, target.ce - 6);
      amount *= 0.1;
      this.fx.text(target.x, target.y - 34, 'INFINITY', { color: '#a8d8ff', scale: 0.9, life: 0.6 });
      this.fx.ring(target.x, target.y - 10, 22, '#a8d8ff', 0.25, 2);
      if (target.infinityHits <= 0) {
        target.infinityT = 0;
        this.fx.text(target.x, target.y - 40, 'BROKEN', { color: '#ff6b6b', scale: 1.1, life: 0.9 });
      }
    }
    // counter
    if (target.counterActive > 0 && target.counterAbility && !opts.dot) {
      target.counterActive = 0;
      const cAb = target.counterAbility;
      this.fx.flash('#ffd166', 0.15);
      this.fx.stop(0.1);
      this.fx.shake(4, 0.2);
      this.game.audio?.play('heavy');
      if (target.isPlayer) {
        this.fx.text(target.x, target.y - 34, 'COUNTER!', { color: '#ffd166', scale: 1.2, life: 1 });
        target.cdMap[cAb.id] = 0;
        target.ce = Math.min(target.maxCe, target.ce + 12);
      }
      const dmg = (cAb.counterDmg || 30) * target.dmgMult;
      this.spawnCounterHit(target, opts.source, dmg);
      return 0;
    }
    let dmg = amount;
    if (opts.blackFlash) {
      dmg *= 2.6 * (opts.source?.mods?.bfDmgMult || 1);
    }
    // adaptation (Mahoraga)
    if (target.adapt && opts.category && target.adapt[opts.category]) {
      const s = target.adapt[opts.category].stage;
      if (s > 0) dmg *= 1 - Math.min(0.55, s * 0.14);
      const ad = target.adapt[opts.category];
      ad.xp += 1;
      const need = 12 + ad.stage * 14;
      if (ad.xp >= need && ad.stage < 4) {
        ad.xp = 0;
        ad.stage++;
        this.onAdaptation(target, opts.category, ad.stage);
      }
    }
    // marked targets
    if (target.markStacks > 0) {
      const bonus = 0.25 + (opts.source?.mods?.markDmg || 0);
      dmg *= 1 + Math.min(1.2, bonus * target.markStacks * 0.5);
    }
    if (target.stunT > 0 && opts.source?.mods?.impactBonus) dmg *= 1.25;
    // armour
    const armour = clamp(target.armor || 0, 0, 0.8);
    dmg *= 1 - armour;
    if (target.reinforced > 0 && target.isPlayer) dmg *= 1 - (0.15 + (target.mods?.reinforceArmor || 0));
    if (target.guardT > 0) dmg *= 0.35;
    // player defensive mods
    if (target.isPlayer && target.mods) {
      dmg *= 1 - clamp(target.mods.armor, 0, 0.75);
    }
    // player offensive mods that trigger on hit
    if (opts.source?.isPlayer && opts.source.mods) {
      const sm = opts.source.mods;
      if (sm.lowHpRage && opts.source.hp / opts.source.maxHp < 0.4) dmg *= 1 + sm.lowHpRage;
      if (target.stunT > 0 && sm.stunChance) dmg *= 1.25;
    }
    if (opts.source?.isPlayer && !opts.dot) {
      const sm = opts.source.mods || {};
      if (sm.bleedOnHit) target.applyStatus?.('bleed', sm.bleedOnHit, 3);
      if (sm.slowOnHit) target.applyStatus?.('slow', sm.slowOnHit, 1.2);
      if (sm.stunChance && Math.random() < sm.stunChance) target.applyStatus?.('stun', 0, 0.7);
    }
    if (target.safeMode) dmg = 0;
    dmg = Math.max(1, Math.round(dmg));

    target.hp -= dmg;
    target.stats.damageTaken += dmg;
    target.flash = 1;
    target.tintFlash = 1;

    const src = opts.source;
    if (src) {
      src.stats.damageDealt += dmg;
      src.stats.hits++;
    }
    if (target.isPlayer) {
      this.stats.damageTaken += dmg;
      this.stats.combo = 0;
      this.fx.vignette = Math.min(1, this.fx.vignette + 0.5);
      if (target.mods?.thorns && src && !opts.dot) {
        this.damage(src, dmg * target.mods.thorns, { category: 'technique', dot: true, silent: true });
      }
      if (!opts.dot) this.game.audio?.play('hurt');
    } else {
      this.registerPlayerHit(dmg, opts, src);
      if (!opts.dot) this.game.audio?.play(opts.category === 'cut' ? 'slash' : 'hit');
    }

    // visual feedback
    this.spawnDamageFeedback(target, dmg, opts);

    if (target.hp <= 0) {
      if (target.isPlayer && target.mods?.revive && !target.reviveUsed) {
        target.reviveUsed = true;
        target.hp = Math.max(1, Math.round(target.maxHp * 0.25));
        target.invulnT = 1.4;
        target.stunT = 0;
        this.fx.flash('#ffd166', 0.35);
        this.fx.ring(target.x, target.y - 10, 40, '#ffd166', 0.6, 4);
        this.fx.text(target.x, target.y - 46, 'SECOND WIND', { color: '#ffd166', scale: 1.2, life: 1.2 });
        this.fx.shake(6, 0.4);
        this.game.audio?.play('heal');
      } else {
        this.kill(target, opts);
      }
    }
    return dmg;
  }

  registerPlayerHit(dmg, opts, src) {
    if (!src) return;
    if (src.isPlayer) {
      this.stats.totalDamage += dmg;
      this.stats.hits++;
      this.stats.highestHit = Math.max(this.stats.highestHit, dmg);
      this.stats.combo++;
      this.stats.longestCombo = Math.max(this.stats.longestCombo, this.stats.combo);
      this.stats.comboTimer = 2.2;
      if (opts.blackFlash) this.stats.bfSuccess++;
      if (opts.isUlt) this.stats.ultDamage += dmg;
      else if (opts.isDomain) this.stats.domainDamage += dmg;
      else if (opts.isSummon) this.stats.summonDamage += dmg;
      else if (opts.basic) this.stats.basicDamage += dmg;
      else this.stats.techDamage += dmg;
      const mods = src.mods;
      if (mods) {
        if (mods.lifesteal) src.heal(dmg * mods.lifesteal);
      }
      if (src.ceGainOnHit) src.ce = Math.min(src.maxCe, src.ce + src.ceGainOnHit);
      src.addUlt?.(opts.isUlt ? 0 : 1.1);
    } else if (src.isSummon && src.owner?.isPlayer) {
      this.stats.summonDamage += dmg;
      this.stats.totalDamage += 0;
    }
  }

  spawnDamageFeedback(target, dmg, opts) {
    const col = opts.blackFlash
      ? '#ff1e3c'
      : opts.isUlt
        ? '#d0a8ff'
        : opts.isDomain
          ? '#c9a2ff'
          : opts.category === 'cut'
            ? '#ff8080'
            : opts.category === 'fire'
              ? '#ffb03a'
              : opts.category === 'electric'
                ? '#bff0ff'
                : opts.category === 'water'
                  ? '#8fe3ff'
                  : opts.basic
                    ? '#ffffff'
                    : '#bfe8ff';
    this.fx.text(
      target.x + (Math.random() - 0.5) * 10,
      target.y - 26 - target.radius,
      Math.round(dmg),
      { color: col, crit: !!opts.blackFlash, scale: opts.blackFlash ? 1.7 : opts.isUlt ? 1.35 : 1, life: opts.blackFlash ? 1.1 : 0.7 }
    );
    const hx = target.x;
    const hy = target.y - 10;
    if (opts.blackFlash) {
      this.fx.burst(hx, hy, 26, { color: '#ff1e3c', color2: '#1a0010', speed: 170, life: 0.5, size: 2.5, glow: true });
      this.fx.ring(hx, hy, 34, '#ff1e3c', 0.4, 3, true);
      this.fx.ring(hx, hy, 20, '#ffffff', 0.25, 2);
      this.fx.flash('#3a0010', 0.15);
      this.fx.shake(6, 0.26);
      this.fx.stop(0.11);
    } else {
      this.fx.burst(hx, hy, opts.isUlt ? 18 : 7, {
        color: col,
        speed: opts.isUlt ? 160 : 90,
        life: 0.3,
        size: opts.isUlt ? 3 : 1.8,
        glow: !!opts.isUlt,
      });
      if (opts.hitstop) this.fx.stop(Math.min(0.09, opts.hitstop));
      this.fx.shake(opts.isUlt ? 5 : opts.hitstop > 0.05 ? 2.5 : 1.2, 0.12);
    }
  }

  spawnCounterHit(target, source, dmg) {
    if (!source) return;
    this.fx.slash(source.x, source.y - 12, Math.atan2(source.y - target.y, source.x - target.x), 2.2, '#ffd166', 1, 0.22, 4);
    this.damage(source, dmg, {
      source: target,
      category: 'blunt',
      knockback: 220,
      hitstop: 0.1,
      isUlt: false,
    });
  }

  onAdaptation(target, category, stage) {
    this.fx.text(target.x, target.y - 44, `ADAPTED: ${category.toUpperCase()} ${'I'.repeat(stage)}`, {
      color: '#ffd166',
      scale: 1.1,
      life: 1.6,
    });
    this.fx.ring(target.x, target.y - 16, 40, '#ffd166', 0.6, 2);
    this.game.audio?.play('reinforce');
    this.scene?.onAdaptation?.(target, category, stage);
    if (target.isSummon && target.owner?.isPlayer && this.game.save) {
      this.game.save.addAdaptation(category, 20);
    }
  }

  kill(target, opts = {}) {
    if (target.dead) return;
    target.dead = true;
    target.hp = 0;
    target.deathT = 0;
    target.phase = null;
    target.ability = null;
    target.setState('dead', 'dead');
    target.animT = 0;
    this.audio?.play?.(target.isPlayer ? 'death' : 'hit');
    const src = opts.source;
    if (target.isPlayer) {
      this.stats.deaths++;
      this.game.audio?.play('death');
      this.fx.flash('#5a0010', 0.35);
      this.fx.shake(8, 0.5);
      this.onPlayerDeath?.();
      this.scene?.onPlayerDeath?.();
      return;
    }
    // adaptation milestones: 5 distinct defeats = one adaptation
    if (target.enemyDef) {
      this.stats.kills++;
      this.groupKillCount++;
      this.fx.burst(target.x, target.y - 10, 16, { color: '#8f7bff', color2: '#2a1a3a', speed: 120, life: 0.5, glow: true });
      this.fx.ring(target.x, target.y - 8, 26, '#a79bff', 0.35, 2);
      this.game.audio?.play('hit');
      if (target.isBoss) {
        this.fx.flash('#ffffff', 0.3);
        this.fx.shake(10, 0.7);
        this.onBossDefeated?.(target);
      }
      // player summons killing enemies feed Mahoraga adaptation
      const killerSummon = src && src.isSummon ? src : null;
      if (killerSummon && killerSummon.adapt) {
        killerSummon.adaptKills = (killerSummon.adaptKills || 0) + 1;
        if (killerSummon.adaptKills % 5 === 0) {
          const cat = this.mostCommonDamageCategory();
          const ad = killerSummon.adapt[cat] || (killerSummon.adapt[cat] = { xp: 0, stage: 0 });
          if (ad.stage < 4) {
            ad.stage++;
            this.onAdaptation(killerSummon, cat, ad.stage);
            this.game.save?.addAdaptation(cat, 20);
          }
        }
      }
      // pickups
      const rng = this.rng;
      if (rng.chance(0.28)) this.spawnPickup(target.x, target.y, 'ce', 12);
      else if (rng.chance(0.1)) this.spawnPickup(target.x, target.y, 'heal', 8);
      if (target.pointsValue > 0) this.scene?.onPointsEarned?.(target.pointsValue);
      this.scene?.onEnemyKilled?.(target);
    } else if (target.isSummon) {
      this.fx.burst(target.x, target.y - 10, 12, { color: target.pal?.light || '#a79bff', speed: 90, life: 0.45, glow: true });
      handleSummonDeath(this, target);
      this.scene?.onSummonDefeated?.(target);
    } else if (target.isDummy) {
      target.hp = target.maxHp;
    }
  }

  mostCommonDamageCategory() {
    const counts = {};
    for (const e of this.enemies) {
      if (e.lastDamageCategory) counts[e.lastDamageCategory] = (counts[e.lastDamageCategory] || 0) + 1;
    }
    let best = 'physical';
    let n = 0;
    for (const k of Object.keys(counts)) {
      if (counts[k] > n) {
        n = counts[k];
        best = k;
      }
    }
    return best;
  }

  addHitbox(hb) {
    if (!hb) return;
    if (this.hitboxes.length > 120) this.hitboxes.shift();
    this.hitboxes.push(hb);
  }

  addProjectile(p) {
    if (!p) return;
    if (this.projectiles.length > 160) this.projectiles.shift();
    this.projectiles.push(p);
  }

  addZone(z) {
    if (!z) return;
    if (this.zones.length > 90) this.zones.shift();
    z.t = 0;
    if (!z.hits) z.hits = new Set();
    if (!z.hasHitOnce) z.hasHitOnce = new Set();
    this.zones.push(z);
  }

  addBeam(b) {
    if (!b) return;
    if (this.beams.length > 24) this.beams.shift();
    this.beams.push(b);
  }

  spawnPickup(x, y, type, value) {
    this.pickups.push({ x, y, type, value, t: 0, life: 14 });
  }

  onPlayerDeath() {
    this.finished = true;
  }

  // -------------------------------------------------------------------------
  // Summon lifecycle (implemented by game/summon.js helpers)
  // -------------------------------------------------------------------------
  dismissSummon(s, defeated) {
    if (!s || s.dead) return;
    s.dead = true;
    s.deathT = 0;
    s.removed = true;
    if (s.isShadowCopy) {
      // return the entity to the pool instead of dropping it for the GC
      const ai = this.actors.indexOf(s); if (ai >= 0) this.actors.splice(ai, 1);
      const si = this.summons.indexOf(s); if (si >= 0) this.summons.splice(si, 1);
      if (this.shadowPool.length < 12) this.shadowPool.push(s);
    }
    this.fx.burst(s.x, s.y - 10, 14, { color: s.pal?.light || '#a79bff', speed: 110, life: 0.5, glow: true });
    this.fx.ring(s.x, s.y - 8, 24, '#a79bff', 0.35, 2);
    this.game.audio?.play('summon');
    this.scene?.onSummonDismissed?.(s);
  }

  // -------------------------------------------------------------------------
  // Drawing
  // -------------------------------------------------------------------------
  draw(ctx) {
    const cam = this.camera;
    drawBackground(ctx, this, cam);
    if (this.domain) {
      ctx.save();
      ctx.translate(Math.round(-cam.x + this.fx.shakeX), Math.round(-cam.y + this.fx.shakeY));
      drawDomainScenery(ctx, this.domain.id, this.time, cam);
      ctx.restore();
    }
    ctx.save();
    ctx.translate(Math.round(-cam.x + this.fx.shakeX), Math.round(-cam.y + this.fx.shakeY));
    this.drawPickups(ctx);
    // sort by y
    const drawList = this.actors.filter((a) => !a.removed);
    drawList.sort((a, b) => a.y - b.y);
    // area telegraphs beneath actors
    for (const z of this.zones) {
      if (z.t < z.delay) {
        const k = clamp(z.t / z.delay, 0, 1);
        ctx.globalAlpha = 0.18 + k * 0.25;
        ctx.fillStyle = z.color;
        ctx.beginPath();
        ctx.arc(z.x, z.y, z.radius * (0.3 + k * 0.7), 0, TAU);
        ctx.fill();
        ctx.globalAlpha = 0.7;
        ctx.strokeStyle = z.color;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(z.x, z.y, z.radius * (0.3 + k * 0.7), 0, TAU);
        ctx.stroke();
        ctx.globalAlpha = 1;
      } else if (z.ticks > 0) {
        ctx.globalAlpha = 0.16;
        ctx.fillStyle = z.color;
        ctx.beginPath();
        ctx.arc(z.x, z.y, z.radius, 0, TAU);
        ctx.fill();
        ctx.globalAlpha = 1;
      }
    }
    for (const a of drawList) {
      drawActor(ctx, a, this.time);
      this.drawTelegraph(ctx, a);
    }
    this.drawProjectiles(ctx);
    this.fx.drawWorld(ctx);
    ctx.restore();
    this.fx.drawTexts(ctx);
    this.fx.drawOverlay(ctx, 640, 360);
    if (this.domain) this.drawDomainOverlay(ctx);
  }

  drawTelegraph(ctx, a) {
    if (!a.ability || a.phase !== 'startup' || a.team === 'player') return;
    const ab = a.ability;
    const k = clamp(a.phaseT / Math.max(0.001, a.startupDur), 0, 1);
    const ang = a.abilityAngle;
    const col = ab.type === 'aoe' || ab.type === 'mark' ? '#ff6b6b' : ab.category === 'cut' ? '#ff9a9a' : '#ffb03a';
    ctx.save();
    if (ab.type === 'melee' || ab.type === 'multi' || ab.type === 'dash') {
      const range = (ab.range || 24) + a.radius;
      ctx.globalAlpha = 0.14 + k * 0.22;
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y - 8);
      ctx.arc(a.x, a.y - 8, range, ang - (ab.arc || 1.6) / 2, ang + (ab.arc || 1.6) / 2);
      ctx.closePath();
      ctx.fill();
      ctx.globalAlpha = 0.5 + k * 0.4;
      ctx.strokeStyle = col;
      ctx.lineWidth = 1;
      ctx.stroke();
    } else if (ab.type === 'projectile') {
      ctx.globalAlpha = 0.2 + k * 0.3;
      ctx.strokeStyle = col;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(a.x, a.y - 8);
      ctx.lineTo(a.x + Math.cos(ang) * (ab.range || 180), a.y - 8 + Math.sin(ang) * (ab.range || 180));
      ctx.stroke();
      ctx.setLineDash([]);
    } else if (ab.type === 'beam') {
      ctx.globalAlpha = 0.15 + k * 0.35;
      ctx.fillStyle = col;
      const len = ab.beam?.length || 300;
      const w = (ab.beam?.width || 26) * k;
      ctx.save();
      ctx.translate(a.x, a.y - 8);
      ctx.rotate(ang);
      ctx.fillRect(0, -w / 2, len, w);
      ctx.restore();
    } else if (ab.type === 'aoe' || ab.type === 'mark') {
      const target = a.aimPoint || { x: a.x + Math.cos(ang) * (ab.range || 60), y: a.y + Math.sin(ang) * (ab.range || 60) };
      const r = ab.aoe?.radius || 50;
      ctx.globalAlpha = 0.14 + k * 0.24;
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.arc(target.x, target.y, r * (0.4 + k * 0.6), 0, TAU);
      ctx.fill();
      ctx.globalAlpha = 0.6;
      ctx.strokeStyle = col;
      ctx.beginPath();
      ctx.arc(target.x, target.y, r, 0, TAU);
      ctx.stroke();
    } else if (ab.type === 'counter') {
      ctx.globalAlpha = 0.3 + k * 0.3;
      ctx.strokeStyle = '#ffd166';
      ctx.beginPath();
      ctx.arc(a.x, a.y - 10, 20 + Math.sin(this.time * 20) * 2, 0, TAU);
      ctx.stroke();
    }
    ctx.restore();
  }

  drawProjectiles(ctx) {
    for (const p of this.projectiles) {
      ctx.globalAlpha = 0.35;
      ctx.fillStyle = p.color;
      ctx.fillRect(Math.round(p.x - p.radius - 2), Math.round(p.y - p.radius - 2), Math.round((p.radius + 2) * 2), Math.round((p.radius + 2) * 2));
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(Math.round(p.x - p.radius * 0.55), Math.round(p.y - p.radius * 0.55), Math.round(p.radius * 1.1), Math.round(p.radius * 1.1));
      ctx.fillStyle = p.color;
      ctx.fillRect(Math.round(p.x - p.radius * 0.9), Math.round(p.y - p.radius * 0.9), Math.round(p.radius * 0.7), Math.round(p.radius * 0.7));
    }
    for (const b of this.beams) {
      const k = b.life / b.maxLife;
      ctx.save();
      ctx.translate(b.x, b.y);
      ctx.rotate(b.angle);
      ctx.globalAlpha = clamp(k, 0, 1) * 0.9;
      const w = b.width * (0.4 + k * 0.9);
      ctx.fillStyle = b.color;
      ctx.fillRect(0, -w / 2, b.length, w);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, -w / 6, b.length, Math.max(1, w / 3));
      ctx.restore();
      ctx.globalAlpha = 1;
    }
  }

  drawPickups(ctx) {
    for (const p of this.pickups) {
      const bob = Math.sin(p.t * 5) * 2;
      const col = p.type === 'heal' ? '#7cf0a0' : p.type === 'ce' ? '#7ec8ff' : '#ffd166';
      ctx.globalAlpha = 0.3;
      ctx.fillStyle = col;
      ctx.fillRect(Math.round(p.x - 5), Math.round(p.y - 12 + bob), 10, 10);
      ctx.globalAlpha = 1;
      ctx.fillStyle = col;
      ctx.fillRect(Math.round(p.x - 2), Math.round(p.y - 9 + bob), 4, 4);
      if (p.type === 'heal') {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(Math.round(p.x - 3), Math.round(p.y - 8.4 + bob), 6, 1.6);
        ctx.fillRect(Math.round(p.x - 0.8), Math.round(p.y - 10.6 + bob), 1.6, 6);
      }
    }
  }

  drawDomainOverlay(ctx) {
    const d = this.domain;
    const k = d.phase === 'expand' ? clamp(d.t / 0.9, 0, 1) : d.phase === 'close' ? 1 - clamp(d.t / 0.6, 0, 1) : 1;
    ctx.save();
    ctx.globalAlpha = 0.14 * k;
    ctx.fillStyle = d.color;
    ctx.fillRect(0, 0, 640, 360);
    ctx.globalAlpha = 0.5 * k;
    ctx.strokeStyle = d.color;
    ctx.lineWidth = 2;
    ctx.strokeRect(6, 30, 628, 328);
    // boundary shimmer
    for (let i = 0; i < 26; i++) {
      const x = (i * 53 + this.time * 20) % 640;
      const y = 34 + ((i * 37 + this.time * 14) % 320);
      ctx.globalAlpha = 0.22 * k;
      ctx.fillStyle = d.color;
      ctx.fillRect(x, y, 2, 2);
    }
    ctx.restore();
  }

  // debug helper
  get audio() {
    return this.game.audio;
  }
}
