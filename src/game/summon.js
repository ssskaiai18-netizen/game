// ---------------------------------------------------------------------------
// summon.js — Ten Shadows summoning, Agito/Mahoraga ultimates, summon commands,
// Totality inheritance and Mahoraga's persistent adaptation memory.
// ---------------------------------------------------------------------------

import { Entity } from './entity.js';
import { SHIKIGAMI, AGITO, getSummon } from '../data/shikigami.js';
import { castAbility } from './combat.js';
import { clamp, dist } from '../core/util.js';

const ADAPT_CATS = ['physical', 'cut', 'blunt', 'fire', 'electric', 'water', 'projectile', 'area', 'technique', 'domain'];

export function summonShikigami(world, owner, id, opts = {}) {
  const def = getSummon(id);
  if (!def) return null;
  const mods = owner.mods || {};
  // one instance of each normal shikigami at a time
  if (!opts.allowDuplicate && world.summons.some((s) => s.summonId === id && !s.dead)) {
    world.fx.text(owner.x, owner.y - 36, 'ALREADY SUMMONED', { color: '#a79bff', scale: 0.75, life: 0.7 });
    return null;
  }
  // Shadow copies never displace pre-existing summons. A strict per-entity
  // cap also covers multi-creature summons such as Divine Dogs.
  const limit = opts.shadowCopy ? 10 : 5 + (mods.summonExtra || 0);
  const activeCount = world.summons.filter((s) => !s.dead).length;
  if (activeCount >= limit) {
    if (opts.shadowCopy) {
      world.fx.text(owner.x, owner.y - 36, 'SHADOW LIMIT', { color: '#a79bff', life: 0.7 });
      return null;
    }
    const oldest = world.summons.find((s) => !s.dead && !s.isUltimateSummon);
    if (oldest) world.dismissSummon(oldest, false);
  }
  const remaining = limit - world.summons.filter((s) => !s.dead).length;
  const count = Math.min(remaining, (def.count || 1) + (opts.extra || 0));
  const created = [];
  for (let i = 0; i < count; i++) {
    const ang = (i / Math.max(1, count)) * Math.PI * 2 + world.time;
    const sx = owner.x + Math.cos(ang) * (18 + i * 4);
    const sy = owner.y + Math.sin(ang) * 12 + 6;
    const pal = def.pal;
    const e = new Entity(world, {
      team: owner.team,
      name: def.name,
      kind: 'summon',
      rig: def.rig,
      pal,
      look: null,
      x: clamp(sx, world.arena.x + 10, world.arena.x + world.arena.w - 10),
      y: clamp(sy, world.arena.y + 24, world.arena.y + world.arena.h - 10),
      radius: (def.rig === 'maxElephant' ? 12 : 7) * (def.scale || 1),
      hp: Math.round((def.hp || 80) * (mods.summonHpMult || 1)),
      speed: (def.speed || 100) * (owner.mods?.summonSpeedMult || 1),
      scale: def.scale || 1,
      brain: 'summon',
      abilities: def.abilities,
      ai: def.ai,
      lifetime: (def.duration || 14) * (mods.summonDurMult || 1) * (owner.masterySummonBonus || 1),
      auraColor: def.pal?.light || '#a79bff',
    });
    e.isSummon = true;
    e.owner = owner;
    e.summonId = id;
    e.shadowCopy = !!opts.shadowCopy;
    if (e.shadowCopy) e.pal = { main: '#10101a', dark: '#050509', light: '#252037', accent: '#10101a' };
    e.role = def.role;
    e.rig = def.rig;
    if (!e.shadowCopy) e.pal = def.pal;
    e.maxLifetime = e.lifetime;
    e.spawnT = 0.4;
    e.dmgMult = (owner.dmgMult || 1) * 0.85 * (opts.dmgMult || 1) *
      (mods.totalityPath ? 1.3 : 1) * (mods.summonDmgMult || 1);
    e.armor = def.armor || 0;
    e.pointsValue = 0;
    e.aiTimer = 0.4 + i * 0.1;
    if (id === 'mahoraga') {
      e.adapt = {};
      e.adapts = true;
      const save = world.game?.save;
      for (const c of ADAPT_CATS) {
        const stage = save?.data?.adapt?.[c]?.stage || 0;
        e.adapt[c] = { xp: stage * 20, stage };
      }
      e.hp = Math.round(def.hp * (mods.summonHpMult || 1));
      e.maxHp = e.hp;
      e.adaptKills = 0;
    }
    if (id === 'divineDogs' && count > 1) {
      e.totalityPair = true;
      e.dmgMult *= 0.85;
    }
    world.addActor(e);
    created.push(e);
    world.fx.burst(e.x, e.y - 8, 16, { color: pal?.light || '#a79bff', color2: pal?.main, speed: 120, life: 0.45, glow: true });
    world.fx.ring(e.x, e.y - 6, 30, pal?.light || '#a79bff', 0.45, 2, true);
    world.fx.text(e.x, e.y - 34, def.name.toUpperCase(), { color: pal?.light || '#a79bff', scale: 0.7, life: 1.1 });
  }
  world.audio?.play('summon');
  world.fx.shake(2, 0.15);
  owner.addUlt?.(8);
  return created;
}

export function spawnUltimateSummon(world, owner, id) {
  const def = id === 'agito' ? AGITO : SHIKIGAMI.mahoraga;
  if (!def) return null;
  // dismiss existing ultimate summons
  for (const s of world.summons.slice()) {
    if (s.isUltimateSummon) world.dismissSummon(s, false);
  }
  const e = new Entity(world, {
    team: owner.team,
    name: def.name,
    kind: 'summon',
    rig: def.rig,
    pal: def.pal,
    x: owner.x + 26,
    y: owner.y - 6,
    radius: (id === 'mahoraga' ? 13 : 9) * (def.scale || 1),
    hp: def.hp,
    speed: def.speed,
    scale: def.scale,
    brain: 'summon',
    abilities: def.abilities,
    ai: def.ai,
    lifetime: def.duration,
    auraColor: def.pal.accent,
  });
  e.isSummon = true;
  e.isUltimateSummon = true;
  e.owner = owner;
  e.summonId = id;
  e.role = def.role;
  e.rig = def.rig;
  e.pal = def.pal;
  e.maxLifetime = def.duration;
  e.lifetime = def.duration;
  e.spawnT = 1.0;
  e.dmgMult = (owner.dmgMult || 1) * (id === 'mahoraga' ? 1.0 : 0.95);
  e.knockResist = id === 'mahoraga' ? 0.6 : 0.2;
  e.staggerResist = 0.5;
  if (id === 'mahoraga') {
    e.adapt = {};
    e.adapts = true;
    const save = world.game?.save;
    for (const c of ADAPT_CATS) {
      const stage = save?.data?.adapt?.[c]?.stage || 0;
      e.adapt[c] = { xp: stage * 20, stage };
    }
    e.adaptKills = 0;
  }
  if (def.ultimate) e.abilities = [...def.abilities, def.ultimate];
  world.addActor(e);

  world.fx.flash(id === 'mahoraga' ? '#ffd166' : '#a79bff', 0.35);
  world.fx.shake(9, 0.6);
  world.fx.ring(e.x, e.y - 10, 80, def.pal.accent || '#a79bff', 0.9, 3, true);
  world.fx.burst(e.x, e.y - 10, 40, { color: def.pal.light, color2: def.pal.dark, speed: 220, life: 0.8, glow: true });
  world.audio?.play('ult');
  world.audio?.play('summon');
  world.fx.text(owner.x, owner.y - 54, id === 'mahoraga' ? 'MAHORAGA' : 'AGITO', {
    color: def.pal.accent || '#ffffff',
    scale: 1.6,
    life: 2.2,
  });
  world.scene?.onUltimateSummon?.(e, id);
  return e;
}

export function commandSummons(world, owner, ab) {
  const summons = world.summons.filter((s) => !s.dead && s.owner === owner);
  if (!summons.length) {
    world.fx.text(owner.x, owner.y - 34, 'NO SHIKIGAMI', { color: '#777f8f', scale: 0.8, life: 0.8 });
    return;
  }
  const buff = 1 + (owner.mods?.reinforceSummon && owner.reinforced > 0 ? 0.5 : 0);
  if (buff > 1) {
    world.fx.text(owner.x, owner.y - 44, 'REINFORCED COMMAND +50%', { color: '#ff9a6b', scale: 0.85, life: 1 });
  }
  for (const s of summons) {
    const target = world.nearestEnemyOf(s, 320);
    if (!target) continue;
    const abToUse = (s.abilities || []).slice().sort((a, b) => (b.dmg || 0) - (a.dmg || 0))[0];
    if (!abToUse) continue;
    s.aiTimer = 0;
    s.cdMap[abToUse.id] = 0;
    s.faceAngle(Math.atan2(target.y - s.y, target.x - s.x));
    const ok = castAbility(world, s, abToUse, s.facing, { force: true, aimPoint: { x: target.x, y: target.y } });
    if (ok) {
      s.dmgMult = (s.dmgMult || 1) * buff;
      world.fx.ring(s.x, s.y - 8, 18, '#a79bff', 0.25, 1.5);
      s.buffCommandT = 4;
    }
  }
  world.audio?.play('shikigami');
  world.fx.flash('#a79bff', 0.1);
}

export function spawnAdds(world, actor, ab) {
  const cfg = ab.summon || {};
  const count = cfg.count || 2;
  for (let i = 0; i < count; i++) {
    const ang = (i / count) * Math.PI * 2;
    const x = clamp(actor.x + Math.cos(ang) * 40, world.arena.x + 16, world.arena.x + world.arena.w - 16);
    const y = clamp(actor.y + Math.sin(ang) * 30, world.arena.y + 30, world.arena.y + world.arena.h - 16);
    const mini = {
      id: 'add_' + i,
      name: 'Transfigured Human',
      rig: 'curseSmall',
      pal: { main: '#6a4a6a', dark: '#3a2038', light: '#b08ab8' },
      hp: 34,
      speed: 78,
      radius: 6,
      behavior: 'melee',
      ai: { preferredRange: 16, cooldown: 1.2, aggression: 1 },
      abilities: [
        { id: 'addClaw', name: 'Twisted Claw', type: 'melee', dmg: 8, startup: 0.35, active: 0.09, recovery: 0.4, range: 20, arc: 1.5, knockback: 60, category: 'physical', anim: 'attack' },
      ],
      xp: 3,
    };
    const e = world.spawnEnemy(mini, x, y);
    e.spawnT = 0.4;
    world.fx.burst(x, y - 8, 10, { color: '#b08ab8', speed: 80, life: 0.4 });
  }
}

/** Detonate an exploding enemy (Bloated Husk). */
export function detonateEnemy(world, a) {
  if (a.dead) return;
  const cfg = a.enemyDef?.explodeOnDeath || { radius: 46, dmg: 18, color: '#ffb03a' };
  world.fx.ring(a.x, a.y - 8, cfg.radius, cfg.color, 0.4, 3, true);
  world.fx.burst(a.x, a.y - 8, 22, { color: cfg.color, speed: 160, life: 0.5, glow: true });
  world.fx.shake(4, 0.25);
  world.audio?.play('heavy');
  for (const t of world.actors) {
    if (t.dead || t.team === a.team) continue;
    if (dist(a.x, a.y, t.x, t.y) > cfg.radius + t.radius) continue;
    world.damage(t, cfg.dmg, { source: a, category: 'fire', knockback: 140, hitstop: 0.05 });
  }
  world.kill(a, { source: a });
}

/** Totality inheritance when one Divine Dog falls. */
export function handleSummonDeath(world, s) {
  // Totality Path: a defeated shikigami leaves a shadow echo that fights on.
  const mods = s.owner?.mods;
  if (mods?.totalityPath && !s.totalityLifeUsed && (s.summonId === 'divineDogs' || s.summonId === 'nue')) {
    s.totalityLifeUsed = true;
    s.dead = false;
    s.hp = Math.round(s.maxHp * 0.35);
    s.lifetime = Math.max(s.lifetime, 4);
    s.dmgMult *= 1.25;
    s.invulnT = 0.6;
    s.pal = { main: '#241c34', dark: '#12101c', light: '#a79bff', accent: '#c9a2ff' };
    world.fx.text(s.x, s.y - 34, 'SHADOW ECHO', { color: '#a79bff', scale: 0.85, life: 1.1 });
    world.fx.ring(s.x, s.y - 6, 24, '#a79bff', 0.4, 2, true);
    return;
  }
  if (!s.totalityPair) return;
  const partner = world.summons.find((o) => o !== s && !o.dead && o.totalityPair);
  if (!partner) return;
  partner.totalityPair = false;
  partner.dmgMult *= 1.5;
  partner.maxHp = Math.round(partner.maxHp * 1.6);
  partner.hp = partner.maxHp;
  partner.scale *= 1.25;
  partner.radius *= 1.2;
  partner.speed *= 1.15;
  partner.pal = { main: '#241c34', dark: '#12101c', light: '#8f7bff', accent: '#c9a2ff' };
  world.fx.text(partner.x, partner.y - 40, 'TOTALITY!', { color: '#c9a2ff', scale: 1.2, life: 1.6 });
  world.fx.flash('#a79bff', 0.2);
  world.fx.ring(partner.x, partner.y - 8, 36, '#c9a2ff', 0.6, 3, true);
  world.audio?.play('tame');
  world.scene?.onTotality?.(partner);
}
