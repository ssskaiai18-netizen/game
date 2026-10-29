// ---------------------------------------------------------------------------
// domain.js — Domain Expansions: activation sequence, per-domain mechanics,
// domain clashes and termination. Each domain has its own rules; none of them
// are "generic damage over time".
// ---------------------------------------------------------------------------

import { clamp, dist, TAU } from '../core/util.js';

const DOMAIN_SEQUENCE = { expand: 0.95, close: 0.7 };

export function startDomain(world, actor, ab) {
  if (world.domain) {
    // player vs boss domain clash
    if (actor.isPlayer && world.domain.isBoss) {
      resolveClash(world, actor, world.domain.actor);
      return;
    }
    if (!actor.isPlayer && world.domain.owner?.isPlayer) {
      resolveClash(world, actor, world.domain.owner);
      return;
    }
    return;
  }
  const dur = Math.round(((ab.dur || 10) * (actor.mods?.domainDurMult || 1)) * 10) / 10;
  world.domain = {
    id: ab.domainId || ab.id,
    name: ab.domainName || ab.name || 'Domain',
    owner: actor,
    actor,
    color: ab.color || '#a79bff',
    t: 0,
    dur,
    phase: 'expand',
    phaseT: 0,
    tick: 0,
    isBoss: !actor.isPlayer,
    stunT: 0,
  };
  actor.invulnT = Math.max(actor.invulnT, 1.1);
  actor.inDomain = true;
  actor.domainT = dur;
  world.audio?.play('domain');
  world.fx.flash(ab.color || '#a79bff', 0.32);
  world.fx.shake(8, 0.6);
  world.fx.ring(actor.x, actor.y - 10, 40, ab.color || '#a79bff', 1.0, 3, true);
  world.fx.burst(actor.x, actor.y - 10, 40, { color: ab.color || '#a79bff', speed: 200, life: 0.9, glow: true });
  world.fx.text(actor.x, actor.y - 60, 'DOMAIN EXPANSION', { color: '#ffffff', scale: 1.3, life: 1.8 });
  world.fx.text(actor.x, actor.y - 46, (ab.name || '').toUpperCase(), {
    color: ab.color || '#ffffff',
    scale: 0.85,
    life: 2.1,
  });
  // push enemies out and stagger them during the expansion
  for (const e of world.enemies) {
    if (e.dead) continue;
    if (dist(e.x, e.y, actor.x, actor.y) < 220) {
      e.knockback(e.x - actor.x, e.y - actor.y, 260);
      e.applyStatus('stun', 0, 0.45);
    }
  }
  world.scene?.onDomainStart?.(world.domain);
  actor.addUlt?.(10);
}

export function startBossDomain(world, actor, def) {
  if (world.domain) {
    if (world.domain.owner?.isPlayer) resolveClash(world, actor, world.domain.owner);
    return;
  }
  world.domain = {
    id: def.id,
    name: def.name,
    owner: actor,
    actor,
    color: def.color || '#ff6b6b',
    t: 0,
    dur: def.dur || 8,
    phase: 'expand',
    phaseT: 0,
    tick: 0,
    isBoss: true,
    extra: def,
  };
  actor.invulnT = Math.max(actor.invulnT, 0.8);
  actor.inDomain = true;
  world.audio?.play('domain');
  world.fx.flash(def.color || '#ff6b6b', 0.3);
  world.fx.shake(9, 0.7);
  world.fx.text(actor.x, actor.y - 60, 'DOMAIN EXPANSION', { color: '#ffffff', scale: 1.3, life: 1.8 });
  world.fx.text(actor.x, actor.y - 46, (def.name || '').replace('Domain Expansion: ', '').toUpperCase(), {
    color: def.color || '#ffffff',
    scale: 0.8,
    life: 2.2,
  });
  world.scene?.onBossDomain?.(world.domain);
  world.scene?.onDomainStart?.(world.domain);
}

function resolveClash(world, challenger, defender) {
  const playerActor = challenger.isPlayer ? challenger : defender;
  const bossActor = challenger.isPlayer ? defender : challenger;
  const pScore =
    (playerActor.ce / Math.max(1, playerActor.maxCe)) * 45 +
    (playerActor.hp / Math.max(1, playerActor.maxHp)) * 35 +
    (playerActor.mods?.domainCostMult ? 10 : 0) +
    (playerActor.domainGauge || 0) * 5;
  const bScore = (bossActor.hp / Math.max(1, bossActor.maxHp)) * 55 + (bossActor.isBoss ? 25 : 0);
  const playerWins = pScore >= bScore;
  world.fx.flash('#ffffff', 0.4);
  world.fx.shake(12, 0.9);
  world.fx.stop(0.14);
  world.audio?.play('domainend');
  world.fx.text(320 + world.camera.x, 150 + world.camera.y, 'DOMAIN CLASH', { color: '#ffd166', scale: 1.8, life: 2 });
  if (playerWins) {
    const old = world.domain;
    world.domain = null;
    if (old) old.owner.inDomain = false;
    if (bossActor) {
      bossActor.applyStatus('stun', 0, 1.6);
      bossActor.domainUsed = true;
      world.damage(bossActor, 40, { source: playerActor, category: 'domain', isDomain: true, hitstop: 0.08 });
    }
    world.fx.text(playerActor.x, playerActor.y - 50, 'DOMAIN OVERWHELMED', { color: '#9fd8ff', scale: 1.1, life: 1.8 });
    if (challenger.isPlayer) {
      // re-run activation for the player domain
      const ab = playerActor.domainAbility;
      setTimeoutSafe(() => {
        if (world.domain === null && !world.finished) startDomain(world, playerActor, ab);
      }, 0);
    }
  } else {
    const old = world.domain;
    world.domain = null;
    if (old) old.owner.inDomain = false;
    if (playerActor) {
      playerActor.applyStatus('stun', 0, 1.2);
      playerActor.ce = Math.max(0, playerActor.ce - 25);
      world.fx.text(playerActor.x, playerActor.y - 50, 'DOMAIN COLLAPSED', { color: '#ff6b6b', scale: 1.1, life: 1.8 });
    }
    if (bossActor.isBoss) bossActor.domainUsed = true;
  }
}

function setTimeoutSafe(fn) {
  fn();
}

function domainEnemies(world, actor) {
  // Hostile actors to the domain's owner (works for player, NPC and boss domains).
  return world.actors.filter((e) => e && !e.dead && e !== actor && e.team !== actor.team && !e.isDummy);
}

function inside(world, x, y) {
  const a = world.arena;
  return x > a.x && x < a.x + a.w && y > a.y && y < a.y + a.h;
}

export function updateDomain(world, dt) {
  const d = world.domain;
  if (!d) return;
  d.t += dt;
  d.phaseT += dt;
  const actor = d.actor;
  if (!actor || actor.dead) {
    endDomain(world);
    return;
  }
  if (d.phase === 'expand') {
    if (actor.isPlayer) actor.invulnT = Math.max(actor.invulnT, 0.06);
    if (d.phaseT >= DOMAIN_SEQUENCE.expand) {
      d.phase = 'active';
      d.phaseT = 0;
    }
    return;
  }
  if (d.phase === 'close') {
    if (d.phaseT >= DOMAIN_SEQUENCE.close) endDomain(world);
    return;
  }

  // active phase
  d.tick += dt;
  actor.inDomain = true;
  const isPlayerDomain = actor.isPlayer;

  switch (d.id) {
    case 'unlimited_void': {
      // CE drain + information overload stun
      actor.ce -= 6 * dt;
      if (actor.ce <= 0) {
        actor.ce = 0;
        endDomain(world);
        return;
      }
      if (d.tick >= 0.7) {
        d.tick = 0;
        for (const e of domainEnemies(world, actor)) {
          if (!inside(world, e.x, e.y)) continue;
          e.applyStatus('stun', 0, 0.75);
          world.damage(e, 9 * (actor.mods?.domainDmgMult || 1), {
            source: actor,
            category: 'domain',
            hitstop: 0.01,
            isDomain: true,
            dot: true,
          });
          world.fx.burst(e.x, e.y - 20, 2, { color: '#9fd8ff', speed: 20, life: 0.4 });
        }
      }
      if (Math.random() < dt * 12) {
        world.fx.addParticle({
          x: 40 + Math.random() * 560,
          y: 40 + Math.random() * 280,
          vx: 0,
          vy: 0,
          life: 0.5,
          color: '#9fd8ff',
          size: 1.5,
          glow: true,
        });
      }
      break;
    }
    case 'incomplete_shrine': {
      // Yuji's shrine: slower slashes than Malevolent Shrine, each briefly
      // incapacitates — but a per-target stun clock prevents stun-locking.
      if (d.tick >= 0.85) {
        d.tick = 0;
        for (const e of domainEnemies(world, actor)) {
          if (!inside(world, e.x, e.y)) continue;
          const ang = Math.random() * TAU;
          world.fx.slash(e.x + Math.cos(ang) * 10, e.y - 8 + Math.sin(ang) * 10, ang, 2.4, '#ff5a6a', Math.random() < 0.5 ? 1 : -1, 0.3, 3);
          world.damage(e, 6 * (actor.mods?.domainDmgMult || 1), {
            source: actor, category: 'cut', hitstop: 0.01, isDomain: true, dot: true,
          });
          if ((e.domainStunCd || 0) <= 0) {
            e.applyStatus('stun', 0, 0.35);
            e.domainStunCd = 1.5;
          }
        }
      }
      if (Math.random() < dt * 8) {
        world.fx.addParticle({ x: actor.x + (Math.random() - 0.5) * 320, y: actor.y + (Math.random() - 0.5) * 200, vx: 0, vy: -8, life: 0.7, color: '#c0273a', size: 2, glow: true });
      }
      break;
    }
    case 'malevolent_shrine':
    case 'malevolentShrine': {
      if (d.tick >= 0.32) {
        d.tick = 0;
        const targets = domainEnemies(world, actor).filter((e) => inside(world, e.x, e.y));
        for (const e of targets) {
          if (Math.random() < 0.85) {
            const ang = Math.random() * TAU;
            world.fx.slash(e.x + Math.cos(ang) * 10, e.y - 8 + Math.sin(ang) * 10, ang, 2.4, '#ff2a3a', Math.random() < 0.5 ? 1 : -1, 0.3, 3);
            world.damage(e, 5 * (actor.mods?.domainDmgMult || 1), {
              source: actor,
              category: 'cut',
              hitstop: 0.01,
              isDomain: true,
              dot: true,
            });
            e.applyStatus('mark', 1, 5);
          }
        }
        if (isPlayerDomain) {
          // shrine marks empower the next hit (synergy)
          if (actor.mods?.shrineMark) {
            actor.pendingTechBuff = Math.max(actor.pendingTechBuff || 0, 2);
          }
        }
      }
      break;
    }
    case 'chimera_shadow_garden': {
      // Inside the Garden: normal summon cooldown restrictions are removed.
      for (const k of Object.keys(actor.cdMap || {})) {
        if (k.includes('summon') || k.includes('fusion') || k === 'megumi_summon' || k === 'cs_summon' || k === 'cs_fusion') actor.cdMap[k] = 0;
      }
      // summons frenzy, enemies dragged & slowed
      for (const s of world.summons) {
        if (s.dead) continue;
        s.speed = (s.baseSpeed || s.speed) * 1.5;
        s.dmgMult = (s.summonBaseDmg || (s.summonBaseDmg = s.dmgMult)) * 1.5;
        s.cdMult = 0.6;
      }
      actor.speed = (actor.speedBase || actor.speed) * 1.2;
      if (d.tick >= 0.6) {
        d.tick = 0;
        for (const e of domainEnemies(world, actor)) {
          if (!inside(world, e.x, e.y)) continue;
          e.applyStatus('slow', 0.45, 1.2);
          const dx = actor.x - e.x;
          const dy = actor.y - e.y;
          const dd = Math.hypot(dx, dy) || 1;
          e.x += (dx / dd) * 6;
          e.y += (dy / dd) * 6;
          world.damage(e, 3, { source: actor, category: 'area', isDomain: true, dot: true });
        }
      }
      if (Math.random() < dt * 8) {
        world.fx.addParticle({
          x: actor.x + (Math.random() - 0.5) * 300,
          y: actor.y + (Math.random() - 0.5) * 200,
          vx: 0,
          vy: -12,
          life: 0.8,
          color: '#5b4bd6',
          size: 2,
          glow: true,
        });
      }
      break;
    }
    // ------------------------------------------------------------ boss domains
    case 'selfEmbodiment': {
      if (d.tick >= 0.85) {
        d.tick = 0;
        const p = world.player;
        if (p && !p.dead) {
          world.addZone({
            x: p.x,
            y: p.y,
            radius: 44,
            delay: 0.55,
            dmg: 12,
            owner: actor,
            team: actor.team,
            category: 'domain',
            color: '#6fd0ff',
            ticks: 1,
            tickInterval: 0.2,
            life: 0.8,
            hits: new Set(),
            hasHitOnce: new Set(),
            stun: 0.7,
            isDomain: true,
            shake: 3,
          });
        }
      }
      break;
    }
    case 'ironMountain': {
      if (d.tick >= 0.7) {
        d.tick = 0;
        const p = world.player;
        if (p && !p.dead && inside(world, p.x, p.y)) {
          world.damage(p, 8, { source: actor, category: 'fire', isDomain: true, dot: true, hitstop: 0.01 });
          p.applyStatus('burn', 4, 2.5);
        }
      }
      break;
    }
    case 'deadlySentencing': {
      if (d.tick >= 1.0) {
        d.tick = 0;
        const p = world.player;
        if (p) {
          p.ultMeter = Math.max(0, p.ultMeter - 6);
          p.ce = Math.max(0, p.ce - 4);
          world.fx.text(p.x, p.y - 40, 'CONFISCATED', { color: '#ffd166', scale: 0.9, life: 0.9 });
          world.addZone({
            x: p.x,
            y: p.y,
            radius: 50,
            delay: 0.6,
            dmg: 14,
            owner: actor,
            team: actor.team,
            category: 'domain',
            color: '#ffd166',
            ticks: 1,
            tickInterval: 0.2,
            life: 0.8,
            hits: new Set(),
            hasHitOnce: new Set(),
            isDomain: true,
          });
        }
      }
      break;
    }
    case 'idleDeathGamble': {
      actor.heal(4 * dt);
      if (d.tick >= 0.9) {
        d.tick = 0;
        const p = world.player;
        if (p) {
          world.addZone({
            x: p.x,
            y: p.y,
            radius: 42,
            delay: 0.5,
            dmg: 14,
            owner: actor,
            team: actor.team,
            category: 'domain',
            color: '#ffd166',
            ticks: 1,
            tickInterval: 0.2,
            life: 0.7,
            hits: new Set(),
            hasHitOnce: new Set(),
            isDomain: true,
            shake: 4,
          });
        }
      }
      break;
    }
    default:
      break;
  }

  // duration
  if (d.t >= d.dur + DOMAIN_SEQUENCE.expand) {
    endDomain(world);
  }
}

export function endDomain(world) {
  const d = world.domain;
  if (!d) return;
  world.domain = null;
  if (d.actor) {
    d.actor.inDomain = false;
    d.actor.domainT = 0;
  }
  for (const s of world.summons) {
    if (s.dead) continue;
    s.cdMult = 1;
    if (s.summonBaseDmg) s.dmgMult = s.summonBaseDmg;
    s.speed = s.baseSpeed || s.speed;
  }
  // Centralised cleanup: temporary shadow copies never outlive the Garden.
  for (const s of world.summons.slice()) {
    if (s.isShadowCopy && !s.dead) world.dismissSummon(s, false);
  }
  const p = world.player;
  if (p) p.speed = p.speedBase || p.speed;
  world.fx.flash(d.color, 0.18);
  world.fx.burst(d.actor?.x || 320, (d.actor?.y || 200) - 10, 24, { color: d.color, speed: 160, life: 0.6, glow: true });
  world.audio?.play('domainend');
  world.scene?.onDomainEnd?.(d);
}
