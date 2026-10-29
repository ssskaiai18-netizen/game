// ---------------------------------------------------------------------------
// combat.js — the ability execution engine.
//
// One pipeline drives every attack in the game (player, enemy, boss, summon,
// NPC). Damage is only produced when an ability reaches its ACTIVE frames and
// spawns a hitbox/projectile/zone, never when the animation starts.
// ---------------------------------------------------------------------------

import { clamp, angleDiff, TAU, dist } from '../core/util.js';

export function ceCost(actor, ab) {
  let c = ab.cost || 0;
  if (actor.isPlayer && actor.mods) c *= actor.mods.ceCostMult;
  if (actor.ceCostMult) c *= actor.ceCostMult;
  return Math.round(c);
}

export function abilityCooldown(actor, ab) {
  let cd = ab.cd || 0;
  if (actor.isPlayer && actor.mods) {
    if (ab.type === 'domain') cd *= 1;
    else cd *= actor.mods.techCdMult || 1;
  }
  if (actor.cdMult) cd *= actor.cdMult;
  return cd;
}

export function canCast(world, actor, ab) {
  if (!actor || actor.dead) return false;
  if (actor.stunT > 0) return false;
  if (actor.phase) return false;
  if ((actor.cdMap[ab.id] || 0) > 0) return false;
  if (ceCost(actor, ab) > actor.ce) return false;
  return true;
}

/** Start an ability. Returns true if it began. */
export function castAbility(world, actor, ab, aimAngle = null, opts = {}) {
  if (!ab) return false;
  if (!opts.force && !canCast(world, actor, ab)) return false;
  const angle = aimAngle === null ? actor.facing : aimAngle;
  if (!opts.ignoreFacing) actor.faceAngle(angle);

  if (!opts.free) {
    const cost = ceCost(actor, ab);
    actor.ce -= cost;
    if (actor.isPlayer) {
      world.stats.ceSpent += cost;
    }
    actor.cdMap[ab.id] = abilityCooldown(actor, ab);
  }

  actor.ability = ab;
  actor.abilityIsBasic = !!opts.basic;
  actor.abilityAngle = angle;
  actor.aimPoint = opts.aimPoint || null;
  actor.phase = 'startup';
  actor.phaseT = 0;
  actor.effectsDone = false;
  actor.hitsDone = 0;
  actor.multiTimer = 0;
  actor.startupDur = Math.max(0, (ab.startup ?? 0.1) * (actor.startupMult || 1) * (ab.type === 'domain' ? 1 : 1));
  actor.activeDur = ab.active ?? 0.08;
  actor.recoveryDur = Math.max(0, (ab.recovery ?? 0.2) * (actor.recoveryMult || 1));
  actor.abilityNum = ++actor._abilityNum || 1;
  actor.animState = ab.anim || 'attack';
  actor.animT = 0;
  actor.setState('attack', ab.anim || 'attack');
  actor.phase = 'startup';

  if (ab.type === 'counter') {
    actor.counterActive = 0;
    actor.counterAbility = ab;
  }
  if (ab.type === 'domain') {
    if (actor.isBoss && world.domainBossAI) {
      /* boss domains handled by boss AI */
    }
  }
  if (actor.isPlayer) {
    actor.onAbilityStart?.(ab, opts);
  }
  world.onAbilityCast?.(actor, ab, opts);

  if (actor.startupDur <= 0.0001) {
    executeAbility(world, actor, ab, opts);
  }
  return true;
}

/** Advance the current ability through startup → active → recovery. */
export function advanceAbility(world, actor, dt) {
  const ab = actor.ability;
  if (!ab) return;
  actor.phaseT += dt;

  if (actor.phase === 'startup') {
    // movement during windup (charge/lunge windups hold position)
    if (ab.type === 'counter' && actor.isPlayer) {
      actor.counterActive = Math.max(0, actor.counterActive - dt);
    }
    if (actor.phaseT >= actor.startupDur) {
      executeAbility(world, actor, ab, { basic: actor.abilityIsBasic });
      actor.phase = 'active';
      actor.phaseT = 0;
    }
    return;
  }

  if (actor.phase === 'active') {
    // repeated hits
    if (ab.hits && ab.hits > 1) {
      actor.multiTimer += dt;
      const interval = ab.interval || Math.max(0.06, actor.activeDur / ab.hits);
      if (actor.hitsDone < ab.hits && actor.multiTimer >= interval) {
        actor.multiTimer = 0;
        actor.hitsDone++;
        spawnMelee(world, actor, ab, { basic: actor.abilityIsBasic, hitIndex: actor.hitsDone });
      }
    }
    if (actor.phaseT >= actor.activeDur) {
      actor.phase = 'recovery';
      actor.phaseT = 0;
    }
    return;
  }

  if (actor.phase === 'recovery') {
    if (actor.phaseT >= actor.recoveryDur) {
      endAbility(world, actor);
    }
  }
}

export function endAbility(world, actor) {
  const ab = actor.ability;
  if (ab && ab.type === 'counter') {
    actor.counterActive = 0;
    actor.counterAbility = null;
  }
  actor.ability = null;
  actor.abilityIsBasic = false;
  actor.phase = null;
  actor.phaseT = 0;
  actor.effectsDone = false;
  actor.hitsDone = 0;
  if (!actor.dead) {
    actor.setState('idle', 'idle');
    actor.aiTimer = 0;
  }
  if (actor.isPlayer) actor.onAbilityEnd?.(ab);
}

// ---------------------------------------------------------------------------
// Damage calculation
// ---------------------------------------------------------------------------
export function computeDamage(actor, ab, opts = {}) {
  let d = ab.dmg || 0;
  if (ab.type === 'ultimate' && actor.isPlayer && actor.mods) d *= actor.mods.ultDmgMult;
  d *= actor.dmgMult || 1;
  const mods = actor.mods;
  if (mods) {
    if (opts.basic) d *= mods.basicDmgMult;
    else if (ab.type !== 'ultimate') d *= mods.techDmgMult;
    if (opts.finisher) d *= 1 + (mods.finisherBonus || 0);
    if (actor.reinforced > 0 && (ab.category === 'physical' || ab.category === 'cut' || ab.category === 'blunt')) {
      d *= 1.25 * mods.reinforceDmgMult;
    }
    if (actor.bfEmpowered > 0) d *= 1.18;
    // Black Flash / Shrine mark empowers the NEXT technique
    if (actor.pendingTechBuff > 0 && !opts.basic && ab.type !== 'ultimate' && !opts.tickBuffConsumed) {
      d *= 1.8;
      actor.pendingTechBuff = 0;
      world_fx_text(actor, 'AMPED');
    }
  } else if (actor.reinforced > 0 && (ab.category === 'physical' || ab.category === 'cut' || ab.category === 'blunt')) {
    d *= 1.25;
  }
  if (actor.isSummon && actor.owner && actor.owner.mods) {
    d *= actor.owner.mods.summonDmgMult;
  }
  if (world_domainBonus(actor, ab)) d *= 1.3;
  return d;
}

function world_fx_text(actor, text) {
  actor.world?.fx?.text?.(actor.x, actor.y - 44, text, { color: '#ff8fa8', scale: 0.8, life: 0.7 });
}

function world_domainBonus(actor, ab) {
  const mods = actor.mods;
  if (mods && mods.domainSynergy && actor.inDomain) return true;
  return false;
}

// ---------------------------------------------------------------------------
// Ability execution — spawns the actual damage sources
// ---------------------------------------------------------------------------
export function executeAbility(world, actor, ab, opts = {}) {
  if (actor.effectsDone) return;
  actor.effectsDone = true;
  const angle = actor.abilityAngle;
  const aimPoint = actor.aimPoint;

  switch (ab.type) {
    case 'melee':
    case 'multi':
      spawnMelee(world, actor, ab, { ...opts, hitIndex: 0 });
      break;
    case 'projectile':
      spawnProjectile(world, actor, ab, angle, aimPoint, opts);
      break;
    case 'aoe':
      spawnZone(world, actor, ab, aimPoint);
      break;
    case 'beam':
      spawnBeam(world, actor, ab, angle);
      break;
    case 'dash':
      startDashMove(world, actor, ab, angle);
      if ((ab.dmg || 0) > 0) spawnMelee(world, actor, ab, { ...opts, moving: true });
      break;
    case 'blink':
      doBlink(world, actor, ab, angle);
      break;
    case 'buff':
      applyBuff(world, actor, ab);
      break;
    case 'summon':
      world.onSummonAbility?.(actor, ab);
      break;
    case 'command':
      world.onSummonCommand?.(actor, ab);
      break;
    case 'tenShadowsUlt':
      world.onTenShadowsUlt?.(actor, ab);
      break;
    case 'ultimate':
      world.onUltimate?.(actor, ab, angle, aimPoint);
      break;
    case 'domain':
      world.onDomainRequest?.(actor, ab);
      break;
    case 'counter':
      actor.counterActive = ab.active;
      break;
    case 'mark':
      spawnZone(world, actor, ab, aimPoint, true);
      break;
    case 'summonAdds':
      world.onSummonAdds?.(actor, ab);
      break;
    case 'divergent':
      executeDivergent(world, actor, ab, opts);
      break;
    case 'transform':
      activateTransform(world, actor, ab);
      break;
    case 'fusion':
      world.onFusion?.(actor, ab);
      break;
    default:
      spawnMelee(world, actor, ab, opts);
  }
}


// ---------------------------------------------------------------------------
// Divergent Fist — initial punch, delayed impact, timed Black Flash re-press.
// The second press only works inside [windowStart, windowEnd]. Pressing early
// fails the attempt (anti-mash); missing the window gives the normal impact.
// ---------------------------------------------------------------------------
export function executeDivergent(world, actor, ab, opts = {}) {
  spawnMelee(world, actor, ab, { ...opts, hitIndex: 0 });
  const d = ab.divergent || {};
  actor.divergentState = {
    ab,
    angle: actor.abilityAngle,
    t: 0,
    windowStart: d.windowStart ?? 0.14,
    windowEnd: d.windowEnd ?? 0.55,
    resolveAt: Math.max(d.delay ?? 0.34, d.windowEnd ?? 0.55),
    delayedDmg: d.delayedDmg ?? (ab.dmg || 10),
    bfDmg: d.bfDmg ?? (ab.dmg || 10) * 2.4,
    empowered: !!d.empowered,
    resolved: false,
    failed: false,
    hitIds: new Set(),
  };
  world.fx.burst(actor.x + Math.cos(actor.abilityAngle) * 14, actor.y - 10, 6, { color: ab.color || '#ff8a5c', speed: 80, dir: actor.abilityAngle, spread: 1.1, life: 0.22 });
}

/** Attempt the Black Flash re-press. Returns 'bf' | 'early' | null. */
export function triggerDivergent(world, actor) {
  const st = actor.divergentState;
  if (!st || st.resolved) return null;
  if (st.t < st.windowStart) {
    st.failed = true;
    world.fx.text(actor.x, actor.y - 36, 'TOO EARLY', { color: '#777f8f', scale: 0.75, life: 0.5 });
    return 'early';
  }
  if (st.t > st.windowEnd) return null;
  st.resolved = true;
  actor.divergentState = null;
  const ab = st.ab;
  const hb = {
    owner: actor, team: actor.team, ability: ab,
    x: actor.x, y: actor.y, follow: true, angle: st.angle,
    range: (ab.range || 30) + 8, arc: (ab.arc || 1.7) + 0.3,
    dmg: Math.max(1, Math.round(st.bfDmg / 2.6)),
    category: ab.category || 'physical', knockback: 150, hitstop: 0.12,
    color: '#ff1e3c', life: 0.12, hits: new Set(), pierce: 99,
    forceBlackFlash: true, basic: false, isUlt: !!st.empowered,
  };
  world.addHitbox(hb);
  world.fx.flash('#2a0008', 0.16);
  world.fx.stop(st.empowered ? 0.12 : 0.09);
  world.fx.shake(st.empowered ? 7 : 5, 0.28);
  world.fx.slash(actor.x, actor.y - 12, st.angle, 2.6, '#ff1e3c', 1, 0.28, 5);
  world.fx.burst(actor.x + Math.cos(st.angle) * 18, actor.y - 12, 24, { color: '#ff1e3c', color2: '#1a0010', speed: 190, life: 0.5, glow: true });
  world.fx.text(actor.x, actor.y - 44, st.empowered ? 'DIVERGENT BLACK FLASH!' : 'BLACK FLASH!', { color: '#ff1e3c', scale: 1.4, life: 0.95, crit: true });
  world.audio?.play('blackflash');
  if (world.stats) world.stats.bfSuccess++;
  actor.bfEmpowered = 3;
  return 'bf';
}

export function updateDivergent(world, actor, dt) {
  const st = actor.divergentState;
  if (!st) return;
  st.t += dt;
  if (st.resolved) { actor.divergentState = null; return; }
  if (st.t >= st.resolveAt) {
    st.resolved = true;
    actor.divergentState = null;
    const ab = st.ab;
    // delayed cursed-energy impact: hits whatever the punch touched (or the space in front)
    const targets = world.actors.filter((t) => t && !t.dead && t.team !== actor.team && (st.hitIds.has(t.id) || Math.hypot(t.x - actor.x, t.y - actor.y) < (ab.range || 30) + 20));
    world.fx.ring(actor.x + Math.cos(st.angle) * 16, actor.y - 10, 22, '#ff5a3a', 0.3, 3);
    world.fx.burst(actor.x + Math.cos(st.angle) * 16, actor.y - 10, 12, { color: '#ff8a5c', color2: '#5a1408', speed: 130, life: 0.4, glow: true });
    world.fx.stop(0.045);
    world.audio?.play('heavy');
    for (const t of targets) {
      world.damage(t, st.delayedDmg * (actor.dmgMult || 1), {
        source: actor, category: 'technique', knockback: 90, dir: st.angle, hitstop: 0.05, ability: ab,
      });
      t.applyStatus('stun', 0, 0.18);
    }
  }
}

// ---------------------------------------------------------------------------
// Transformations (King of Curses / Heian Form / Limitless Ascendant).
// One entity, swapped kit + optional look override, restored on expiry.
// ---------------------------------------------------------------------------
export function activateTransform(world, actor, ab) {
  if (!actor || actor.transformT > 0) return false;
  actor._preTransform = {
    slots: actor.isPlayer ? (actor.slots || []).slice() : null,
    abilities: actor.transformSlots ? actor.transformSlots.slice() : null,
    look: actor.look ? { ...actor.look } : null,
    scale: actor.scale,
  };
  actor.transformT = ab.dur || 12;
  actor.transformDur = ab.dur || 12;
  actor.transformName = ab.formName || ab.name;
  actor.transformAbility = ab;
  if (actor.isPlayer && ab.slots) actor.slots = ab.slots.slice();
  else if (ab.slots) actor.transformSlots = ab.slots.slice();
  if (ab.look && actor.look) actor.look = { ...actor.look, ...ab.look };
  if (ab.id === 'sukuna_ult') actor.scale = (actor._preTransform.scale || actor.scale) * 1.12;
  actor.invulnT = Math.max(actor.invulnT, 0.5);
  world.fx.flash(ab.color || '#ffffff', 0.3);
  world.fx.shake(7, 0.45);
  world.fx.ring(actor.x, actor.y - 10, 54, ab.color || '#ffffff', 0.8, 3, true);
  world.fx.burst(actor.x, actor.y - 12, 34, { color: ab.color || '#ffffff', speed: 200, life: 0.7, glow: true });
  world.fx.text(actor.x, actor.y - 56, (ab.formName || ab.name || 'TRANSFORM').toUpperCase(), { color: ab.color || '#ffffff', scale: 1.3, life: 1.6 });
  world.audio?.play('ult');
  world.scene?.showBanner?.(ab.formName || ab.name, actor.name || '', ab.color || '#ffd166', 1.6);
  return true;
}

export function endTransform(world, actor) {
  if (!actor || !actor._preTransform) { if (actor) actor.transformT = 0; return; }
  const pre = actor._preTransform;
  if (actor.isPlayer && pre.slots) actor.slots = pre.slots;
  actor.transformSlots = pre.abilities;
  if (pre.look) actor.look = pre.look;
  if (pre.scale) actor.scale = pre.scale;
  actor._preTransform = null;
  actor.transformT = 0;
  actor.transformName = null;
  actor.transformAbility = null;
  world.fx.ring(actor.x, actor.y - 10, 34, '#8b98b0', 0.4, 2);
  world.fx.text(actor.x, actor.y - 44, 'FORM ENDS', { color: '#8b98b0', scale: 0.85, life: 0.9 });
  world.audio?.play('domainend');
}

function startDashMove(world, actor, ab, angle) {
  const mv = ab.move || {};
  const speed = (mv.speed || 320) * (actor.moveSpeedMult || 1);
  if (mv.type === 'blinkStrike') {
    doBlink(world, actor, ab, angle);
    return;
  }
  actor.moveVx = Math.cos(angle) * speed;
  actor.moveVy = Math.sin(angle) * speed;
  actor.moveT = mv.dur || 0.15;
  if (mv.iframes) actor.invulnT = Math.max(actor.invulnT, mv.iframes);
  if (mv.ramp) actor.moveRamp = true;
}

function doBlink(world, actor, ab, angle) {
  const b = ab.blink || {};
  let dist = (b.dist || 100) * (actor.mods?.dashDistMult || 1);
  if (b.type === 'blinkStrike' || (ab.move && ab.move.type === 'blinkStrike')) {
    // blink toward nearest enemy instead of raw aim
    const t = world.nearestEnemyOf(actor, 220);
    if (t) {
      const d = Math.hypot(t.x - actor.x, t.y - actor.y);
      dist = Math.min(dist, Math.max(0, d - (t.radius + actor.radius + 8)));
      angle = Math.atan2(t.y - actor.y, t.x - actor.x);
    }
  }
  const steps = Math.max(1, Math.ceil(dist / 6));
  const sx = actor.x;
  const sy = actor.y;
  let okX = actor.x;
  let okY = actor.y;
  for (let i = 1; i <= steps; i++) {
    const nx = sx + Math.cos(angle) * (dist * i) / steps;
    const ny = sy + Math.sin(angle) * (dist * i) / steps;
    if (world.isWalkable(nx, ny, actor.radius)) {
      okX = nx;
      okY = ny;
    } else break;
  }
  world.fx.burst(sx, sy - 8, 10, { color: ab.color || '#8f7bff', speed: 70, life: 0.3 });
  world.fx.burst(okX, okY - 8, 12, { color: ab.color || '#8f7bff', speed: 90, life: 0.35 });
  actor.x = okX;
  actor.y = okY;
  if (b.iframes) actor.invulnT = Math.max(actor.invulnT, b.iframes);
  world.audio?.play('dodge');
  if (b.leaveRift) {
    world.addZone({
      x: sx,
      y: sy,
      radius: 26,
      delay: 0,
      dmg: b.riftDmg || 10,
      owner: actor,
      team: actor.team,
      category: 'technique',
      color: '#7ec8ff',
      ticks: 1,
      tickInterval: 0.2,
      life: 0.5,
      hits: new Set(),
      atSelf: true,
    });
  }
}

function applyBuff(world, actor, ab) {
  const b = ab.buff || {};
  if (b.id === 'infinity') {
    actor.infinityT = b.dur;
    actor.infinityHits = b.hits + (actor.mods?.infinityHit || 0);
    actor.aura = 1.4;
    actor.auraColor = '#a8d8ff';
    world.fx.ring(actor.x, actor.y - 10, 30, '#a8d8ff', 0.4, 2);
    world.audio?.play('reinforce');
    return;
  }
  if (b.dur) actor.invulnT = Math.max(actor.invulnT, b.dur);
  if (b.heal) actor.heal(b.heal);
  actor.aura = 1;
}

// ---------------------------------------------------------------------------
// Hitbox spawning
// ---------------------------------------------------------------------------
export function spawnMelee(world, actor, ab, opts = {}) {
  const range = (ab.range || 24) * (actor.rangeMult || 1) * (ab.aoeWide || 1);
  const hb = {
    owner: actor,
    team: actor.team,
    ability: ab,
    x: actor.x,
    y: actor.y,
    follow: true,
    angle: actor.abilityAngle,
    range,
    arc: ab.arc || 1.6,
    dmg: computeDamage(actor, ab, opts),
    category: ab.category || 'physical',
    knockback: ab.knockback || 60,
    hitstop: ab.hitstop ?? 0.03,
    color: ab.color || '#ffffff',
    life: Math.max(0.06, actor.activeDur),
    hits: new Set(),
    pierce: 99,
    pull: ab.pull || 0,
    push: ab.push || 0,
    mark: ab.mark,
    status: {
      bleed: ab.bleed,
      slow: ab.slowOnHit,
      stun: ab.stun,
      root: ab.root,
      burn: ab.burn,
    },
    basic: !!opts.basic,
    isUlt: ab.type === 'ultimate',
    isDomain: !!ab.isDomain,
    execute: ab.execute,
    onHit: ab.onHit,
    finisher: ab.finisher || null,
    launch: ab.launch || null,
    tickIndex: opts.hitIndex || 0,
  };
  if (ab.finisherHit && ab.hits && (opts.hitIndex || 0) >= ab.hits) {
    hb.dmg = Math.round(hb.dmg * 1.8);
    hb.knockback = (hb.knockback || 60) * 1.6;
    hb.hitstop = Math.max(hb.hitstop || 0.03, 0.08);
    hb.isFinisher = true;
  }
  world.addHitbox(hb);
  return hb;
}

export function spawnProjectile(world, actor, ab, angle, aimPoint, opts = {}) {
  const p = ab.proj || {};
  const count = (p.count || ab.count || 1) + (actor.mods?.projectileBonus || 0);
  const spread = p.spread ?? ab.spread ?? 0.3;
  const startX = actor.x + Math.cos(angle) * (actor.radius + 3);
  const startY = actor.y - 8 + Math.sin(angle) * (actor.radius + 3);
  for (let i = 0; i < count; i++) {
    const offset = count === 1 ? 0 : (i / (count - 1) - 0.5) * spread;
    const a = angle + offset;
    world.addProjectile({
      owner: actor,
      team: actor.team,
      x: startX,
      y: startY,
      vx: Math.cos(a) * (p.speed || 260),
      vy: Math.sin(a) * (p.speed || 260),
      radius: p.radius || 5,
      life: p.life || 1,
      maxLife: p.life || 1,
      dmg: computeDamage(actor, ab, opts),
      category: ab.category || 'projectile',
      color: p.color || ab.color || '#ffffff',
      trail: p.trail || null,
      pierce: (p.pierce || 0) + (actor.mods?.pierceBonus || 0),
      knockback: ab.knockback || p.knockback || 30,
      hitstop: ab.hitstop ?? 0.03,
      ability: ab,
      hits: new Set(),
      explode: p.explode || null,
      chain: p.chain || 0,
      slow: p.slow,
      slowDur: p.slowDur,
      mark: p.mark,
      homing: p.homing || 0,
      gravity: p.gravity || 0,
      wide: p.wide || 0,
      isUlt: ab.type === 'ultimate',
      isDomain: !!ab.isDomain,
      trailT: 0,
    });
  }
  world.audio?.play(ab.sfx || 'slash');
  world.fx.burst(actor.x + Math.cos(angle) * 10, actor.y - 8, 5, {
    color: ab.color || '#ffffff',
    speed: 60,
    dir: angle,
    spread: 0.9,
    life: 0.2,
  });
}

export function aimPointFor(actor, ab, aimPoint) {
  if (aimPoint) return aimPoint;
  const range = ab.range || 100;
  return { x: actor.x + Math.cos(actor.abilityAngle) * range, y: actor.y + Math.sin(actor.abilityAngle) * range };
}

export function spawnZone(world, actor, ab, aimPoint, isMark = false) {
  const z = ab.aoe || {};
  let x;
  let y;
  if (z.atSelf) {
    x = actor.x;
    y = actor.y;
  } else {
    const pt = aimPointFor(actor, ab, aimPoint);
    x = pt.x;
    y = pt.y;
    // clamp to arena
    x = clamp(x, world.arena.x + 8, world.arena.x + world.arena.w - 8);
    y = clamp(y, world.arena.y + 8, world.arena.y + world.arena.h - 8);
  }
  world.addZone({
    x,
    y,
    radius: z.radius || 50,
    delay: z.delay || 0.15,
    dmg: computeDamage(actor, ab, {}),
    owner: actor,
    team: actor.team,
    category: ab.category || 'area',
    color: ab.color || '#ffffff',
    ticks: z.ticks || 1,
    tickInterval: z.tickInterval || 0.2,
    life: (z.ticks || 1) * (z.tickInterval || 0.2) + 0.3,
    hits: new Set(),
    knockback: z.knockback || 60,
    hitstop: z.shake ? 0.05 : 0.02,
    pull: z.pull || 0,
    pullDur: z.pullDur || 0,
    push: z.push || 0,
    stun: z.stun,
    root: z.root,
    burn: z.burn,
    healOwner: z.healOwner || 0,
    healAllies: z.healAllies || 0,
    cleanse: z.cleanse,
    disrupt: z.disrupt,
    mark: z.mark || isMark,
    ability: ab,
    isUlt: ab.type === 'ultimate',
    isDomain: false,
    shake: z.shake || 0,
    multHits: (z.ticks || 1) > 1,
    scissor: !!ab.scissor,
    hasHitOnce: new Set(),
  });
  if (ab.spiderweb) {
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + (actor.abilityAngle || 0);
      world.fx.slash(x + Math.cos(a) * 26, y - 4 + Math.sin(a) * 18, a, 2.2, ab.color || '#ff4040', i % 2 ? 1 : -1, 0.4, 2);
    }
    world.fx.ring(x, y - 4, z.radius || 60, ab.color || '#ff4040', 0.45, 2);
    world.fx.text(actor.x, actor.y - 42, 'SPIDERWEB', { color: ab.color || '#ff4040', scale: 0.9, life: 0.8 });
  }
  if (ab.scissor) {
    world.fx.ring(x, y, 26, '#ff3355', 0.5, 2);
    world.fx.text(x, y - 30, '✂ MARKED', { color: '#ff3355', scale: 0.9, life: 0.7 });
    world.fx.slash(x, y - 8, 0.7, 2.4, '#ff3355', 1, 0.45, 3);
    world.fx.slash(x, y - 8, -0.7, 2.4, '#ff3355', -1, 0.45, 3);
  }
  if (isMark) world.audio?.play('mark');
  else world.audio?.play(ab.sfx || 'technique');
}

export function spawnBeam(world, actor, ab, angle) {
  const b = ab.beam || {};
  const len = b.length || 300;
  const width = b.width || 24;
  world.addBeam({
    owner: actor,
    team: actor.team,
    x: actor.x,
    y: actor.y - 8,
    angle,
    length: len,
    width,
    life: b.dur || 0.35,
    maxLife: b.dur || 0.35,
    color: ab.color || '#ffffff',
    dmg: 0,
    isUlt: ab.type === 'ultimate',
  });
  // instant line damage
  const targets = world.actors.filter((a) => a.team !== actor.team && !a.dead);
  let hitAny = false;
  for (const t of targets) {
    const relX = t.x - actor.x;
    const relY = t.y - 8 - (actor.y - 8);
    const along = relX * Math.cos(angle) + relY * Math.sin(angle);
    if (along < -t.radius || along > len + t.radius) continue;
    const perp = Math.abs(-relX * Math.sin(angle) + relY * Math.cos(angle));
    if (perp > width / 2 + t.radius) continue;
    const dmg = computeDamage(actor, ab, {});
    world.damage(t, dmg, {
      source: actor,
      category: ab.category || 'technique',
      knockback: 120,
      dir: angle,
      hitstop: 0.06,
      isUlt: ab.type === 'ultimate',
      isBeam: true,
    });
    hitAny = true;
  }
  world.fx.shake(hitAny ? 5 : 3, 0.2);
  world.fx.flash(ab.color || '#ffffff', 0.12);
  world.audio?.play(ab.sfx || 'beam');
}

// ---------------------------------------------------------------------------
// World tick helpers
// ---------------------------------------------------------------------------
export function updateHitboxes(world, dt) {
  const hbs = world.hitboxes;
  for (let i = hbs.length - 1; i >= 0; i--) {
    const hb = hbs[i];
    hb.life -= dt;
    if (hb.follow && hb.owner && !hb.owner.dead) {
      hb.x = hb.owner.x;
      hb.y = hb.owner.y;
      hb.angle = hb.owner.abilityAngle;
    }
    if (hb.life <= 0) {
      hbs.splice(i, 1);
      continue;
    }
    // resolve hits
    for (const t of world.actors) {
      if (!t || t.dead || t.team === hb.team) continue;
      if (hb.hits.has(t.id)) continue;
      if (t.invulnT > 0 && !hb.isDomain) continue;
      if (t.spawnT > 0) continue;
      const dx = t.x - hb.x;
      const dy = t.y - 8 - (hb.y - 8);
      const d = Math.hypot(dx, dy);
      if (d > hb.range + t.radius) continue;
      const ang = Math.atan2(dy, dx);
      if (Math.abs(angleDiff(hb.angle, ang)) > hb.arc / 2 + 0.12) continue;
      hb.hits.add(t.id);
      applyHit(world, hb, t);
      if (hb.pierce-- <= 0) break;
    }
  }
}

function applyHit(world, hb, target) {
  const dir = hb.angle;
  if (hb.owner?.divergentState && hb.ability?.type === 'divergent') hb.owner.divergentState.hitIds.add(target.id);
  const bf = hb.forceBlackFlash || (hb.owner && hb.owner.consumeBlackFlash ? hb.owner.consumeBlackFlash(hb.ability) : false);
  let dmg = hb.dmg;
  if (hb.finisher && target.maxHp && target.hp / target.maxHp <= (hb.finisher.hpFrac ?? 0.3)) {
    dmg = Math.round(dmg * (hb.finisher.mult || 1.7));
    world.fx.text(target.x, target.y - 40, 'FINISHER!', { color: '#ffd166', scale: 1.1, life: 0.9, crit: true });
    world.fx.stop(0.08);
    world.fx.shake(5, 0.25);
  }
  world.damage(target, dmg, {
    blackFlash: bf,
    source: hb.owner,
    category: hb.category,
    knockback: hb.knockback,
    dir,
    hitstop: hb.hitstop,
    isUlt: hb.isUlt,
    basic: hb.basic,
    mark: hb.mark,
    ability: hb.ability,
    status: hb.status,
    execute: hb.execute,
  });
  if (hb.launch) {
    target.applyStatus('stun', 0, hb.launch.stun || 0.6);
    target.knockback(Math.cos(dir), Math.sin(dir) - 0.6, hb.launch.knock || 160);
    world.fx.text(target.x, target.y - 42, 'LAUNCHED!', { color: '#ffd166', scale: 0.95, life: 0.8 });
    world.fx.ring(target.x, target.y - 6, 20, '#ffd166', 0.3, 2);
  }
  if (hb.pull) {
    const p = hb.owner;
    if (p) {
      target.knockback(p.x - target.x, p.y - target.y, hb.pull);
    }
  }
  if (hb.push) {
    target.knockback(target.x - hb.owner.x, target.y - hb.owner.y, hb.push);
  }
}

export function updateProjectiles(world, dt) {
  const ps = world.projectiles;
  for (let i = ps.length - 1; i >= 0; i--) {
    const p = ps[i];
    p.life -= dt;
    if (p.homing > 0) {
      const t = world.nearestEnemyOf(p.owner || { team: p.team, x: p.x, y: p.y }, 200);
      if (t) {
        const a = Math.atan2(t.y - p.y, t.x - p.x);
        const cur = Math.atan2(p.vy, p.vx);
        const na = cur + clamp(angleDiff(cur, a), -p.homing * dt, p.homing * dt);
        const sp = Math.hypot(p.vx, p.vy) || 1;
        p.vx = Math.cos(na) * sp;
        p.vy = Math.sin(na) * sp;
      }
    }
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.trailT += dt;
    if (p.trailT > 0.02) {
      p.trailT = 0;
      world.fx.addParticle({
        x: p.x,
        y: p.y,
        vx: (Math.random() - 0.5) * 12,
        vy: (Math.random() - 0.5) * 12,
        life: 0.22,
        color: p.trail || p.color,
        size: Math.max(1, p.radius * 0.55),
        glow: true,
        drag: 0.85,
      });
    }
    let dead = p.life <= 0;
    if (!dead && !world.isWalkable(p.x, p.y, 1)) dead = true;
    if (!dead) {
      for (const t of world.actors) {
        if (!t || t.dead || t.team === p.team) continue;
        if (p.hits.has(t.id)) continue;
        if (t.spawnT > 0) continue;
        if (t.invulnT > 0) continue;
        if (dist(p.x, p.y, t.x, t.y - 8) > p.radius + t.radius) continue;
        p.hits.add(t.id);
        world.damage(t, p.dmg, {
          source: p.owner,
          category: p.category,
          knockback: p.knockback,
          dir: Math.atan2(p.vy, p.vx),
          hitstop: p.hitstop,
          isUlt: p.isUlt,
          mark: p.mark,
          status: { slow: p.slow, stun: undefined },
        });
        if (p.slow) t.applyStatus('slow', p.slow, p.slowDur || 1.2);
        if (p.mark) t.applyStatus('mark', 1, 8);
        if (p.chain > 0) chainLightning(world, p, t);
        if (p.explode) {
          world.addZone({
            x: p.x,
            y: p.y,
            radius: p.explode.radius,
            delay: 0.02,
            dmg: (p.explode.dmg || 10) * (p.owner?.dmgMult || 1),
            owner: p.owner,
            team: p.team,
            category: p.category,
            color: p.color,
            ticks: 1,
            tickInterval: 0.1,
            life: 0.35,
            hits: new Set(),
            hasHitOnce: new Set(),
            knockback: 100,
            isUlt: p.isUlt,
            explosion: true,
          });
          dead = true;
        }
        if (p.pierce-- <= 0) dead = true;
        if (dead) break;
      }
    }
    if (dead) {
      if (p.explode && p.life <= 0) {
        world.addZone({
          x: p.x,
          y: p.y,
          radius: p.explode.radius,
          delay: 0.02,
          dmg: p.explode.dmg || 10,
          owner: p.owner,
          team: p.team,
          category: p.category,
          color: p.color,
          ticks: 1,
          tickInterval: 0.1,
          life: 0.3,
          hits: new Set(),
          hasHitOnce: new Set(),
          isUlt: p.isUlt,
          explosion: true,
        });
      }
      world.fx.burst(p.x, p.y, 5, { color: p.color, speed: 60, life: 0.22 });
      ps.splice(i, 1);
    }
  }
}

function chainLightning(world, p, first) {
  let from = first;
  let remaining = p.chain;
  const hit = new Set([first.id]);
  while (remaining-- > 0) {
    let best = null;
    let bestD = 90;
    for (const t of world.actors) {
      if (!t || t.dead || t.team === p.team || hit.has(t.id)) continue;
      const d = dist(from.x, from.y, t.x, t.y);
      if (d < bestD) {
        bestD = d;
        best = t;
      }
    }
    if (!best) break;
    hit.add(best.id);
    world.fx.ring(from.x, from.y - 8, 20, '#bff0ff', 0.2, 2);
    world.damage(best, p.dmg * 0.6, {
      source: p.owner,
      category: 'electric',
      knockback: 20,
      hitstop: 0.02,
    });
    best.applyStatus('stun', 0, 0.25);
    from = best;
  }
}

export function updateZones(world, dt) {
  const zs = world.zones;
  for (let i = zs.length - 1; i >= 0; i--) {
    const z = zs[i];
    z.life -= dt;
    z.t += dt;
    if (z.pull > 0 && z.t > z.delay) {
      for (const t of world.actors) {
        if (!t || t.dead || t.team === z.team) continue;
        const d = dist(z.x, z.y, t.x, t.y);
        if (d > z.radius * 2) continue;
        const f = (z.pull * dt) / Math.max(20, d);
        t.x += (z.x - t.x) * clamp(f, 0, 0.2);
        t.y += (z.y - t.y) * clamp(f, 0, 0.2);
      }
    }
    if (z.push > 0 && z.t > z.delay && !z._pushed) {
      z._pushed = true;
      for (const t of world.actors) {
        if (!t || t.dead || t.team === z.team) continue;
        if (dist(z.x, z.y, t.x, t.y) > z.radius + t.radius) continue;
        t.knockback(t.x - z.x, t.y - z.y, z.push);
      }
    }
    if (z.t >= z.delay) {
      // damage ticks
      if (z.ticks > 0) {
        z._tickT = (z._tickT || 0) + dt;
        const interval = z.tickInterval || 0.2;
        if (z._tickT >= interval) {
          z._tickT = 0;
          z.ticks--;
          const alreadyHit = new Set();
          for (const t of world.actors) {
            if (!t || t.dead || t.team === z.team) continue;
            if (dist(z.x, z.y, t.x, t.y - 6) > z.radius + t.radius) continue;
            if (z.hits && !z.multHits && z.hits.has(t.id)) continue;
            if (alreadyHit.has(t.id)) continue;
            alreadyHit.add(t.id);
            z.hits.add(t.id);
            world.damage(t, z.dmg, {
              source: z.owner,
              category: z.category,
              knockback: z.knockback || 40,
              dir: Math.atan2(t.y - z.y, t.x - z.x),
              hitstop: z.hitstop || 0.02,
              isUlt: z.isUlt,
              allowMulti: true,
            });
            if (z.stun) t.applyStatus('stun', 0, z.stun);
            if (z.root) t.applyStatus('root', 0, z.root);
            if (z.burn) t.applyStatus('burn', z.burn, 3);
            if (z.mark) t.applyStatus('mark', 1, 8);
          }
          if (z.healOwner && z.owner && !z.owner.dead) {
            z.owner.heal(z.healOwner / (z.ticks + 1));
          }
          if (z.healAllies) {
            for (const a of world.actors) {
              if (a.team === z.team && !a.dead && dist(z.x, z.y, a.x, a.y) < z.radius) a.heal(z.healAllies);
            }
          }
          if (z.cleanse && z.owner) {
            z.owner.bleedT = 0;
            z.owner.burnT = 0;
            z.owner.stunT = 0;
          }
          if (z.scissor) {
            world.fx.slash(z.x, z.y - 8, 0.7, 3, '#ff3355', 1, 0.3, 4);
            world.fx.slash(z.x, z.y - 8, -0.7, 3, '#ffffff', -1, 0.3, 4);
            world.fx.shake(4, 0.2);
            world.fx.stop(0.05);
          }
          if (z.explosion) {
            world.fx.ring(z.x, z.y, z.radius, z.color, 0.35, 3, true);
            world.fx.burst(z.x, z.y, 12, { color: z.color, speed: 130, life: 0.4, glow: true });
            world.fx.shake(3, 0.15);
          }
        }
      }
    }
    if (z.life <= 0) zs.splice(i, 1);
  }
}

export function updateBeams(world, dt) {
  for (let i = world.beams.length - 1; i >= 0; i--) {
    const b = world.beams[i];
    b.life -= dt;
    if (b.life <= 0) world.beams.splice(i, 1);
  }
}
