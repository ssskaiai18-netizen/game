// ---------------------------------------------------------------------------
// ai.js — enemy, boss, sparring-NPC and summon brains. All of them drive the
// same ability system as the player: wind-ups, telegraphed hitboxes, recovery
// windows and cooldowns are real.
// ---------------------------------------------------------------------------

import { clamp, dist, TAU, angleDiff } from '../core/util.js';
import { castAbility, canCast, ceCost, triggerDivergent, activateTransform } from './combat.js';
import { getCharacter } from '../data/characters.js';

export function updateAI(world, a, dt) {
  if (a.dead) return;
  if (a.stunT > 0) {
    a.vx = 0;
    a.vy = 0;
    return;
  }
  if (a.spawnT > 0) {
    a.vx = 0;
    a.vy = 0;
    return;
  }
  switch (a.brain) {
    case 'boss':
    case 'tame':
      updateBossAI(world, a, dt);
      break;
    case 'npc':
      updateNpcAI(world, a, dt);
      break;
    case 'summon':
      updateSummonAI(world, a, dt);
      break;
    default:
      updateEnemyAI(world, a, dt);
  }
}

function moveToward(a, tx, ty, speedScale = 1) {
  const dx = tx - a.x;
  const dy = ty - a.y;
  const d = Math.hypot(dx, dy) || 1;
  a.vx = (dx / d) * speedScale;
  a.vy = (dy / d) * speedScale;
}

function moveAway(a, tx, ty, speedScale = 1) {
  const dx = a.x - tx;
  const dy = a.y - ty;
  const d = Math.hypot(dx, dy) || 1;
  a.vx = (dx / d) * speedScale;
  a.vy = (dy / d) * speedScale;
}

function strafe(a, target, dir, speedScale = 0.7) {
  const ang = Math.atan2(target.y - a.y, target.x - a.x) + (Math.PI / 2) * dir;
  a.vx = Math.cos(ang) * speedScale;
  a.vy = Math.sin(ang) * speedScale;
}

function predictiveAim(a, t, lead = 0.12) {
  const px = t.x + (t.vx || 0) * t.speed * lead;
  const py = t.y + (t.vy || 0) * t.speed * lead;
  return Math.atan2(py - a.y, px - a.x);
}

function pickAbility(world, a, target, opts = {}) {
  const list = a.abilities || [];
  let best = null;
  let bestScore = -1;
  const d = target ? dist(a.x, a.y, target.x, target.y) : 999;
  for (const ab of list) {
    if (ab.phase && ab.phase > (a.phaseIndex || 1)) continue;
    if ((a.moveCd && a.moveCd[ab.id]) > 0) continue;
    if ((a.cdMap[ab.id] || 0) > 0) continue;
    if (ab.ult && opts.noUlt) continue;
    if (ceCost(a, ab) > a.ce) continue;
    let score = ab.weight || 1;
    const range = ab.range || (ab.type === 'melee' ? 30 : 160);
    if (ab.type === 'aoe' || ab.type === 'mark') {
      if (d > range * 1.6) score *= 0.15;
      else if (d > range) score *= 0.7;
    } else if (ab.type === 'melee' || ab.type === 'dash' || ab.type === 'multi') {
      if (d > range + a.radius + 12) score *= 0.08;
      else score *= 1.4;
    } else if (ab.type === 'projectile' || ab.type === 'beam') {
      if (d < 40) score *= 0.35;
      if (d > (ab.range || 200) * 1.3) score *= 0.2;
    } else if (ab.type === 'buff') {
      score *= 0.9;
    } else if (ab.type === 'summonAdds') {
      score *= 0.9;
    }
    score *= 0.75 + Math.random() * 0.5;
    if (score > bestScore) {
      bestScore = score;
      best = ab;
    }
  }
  return bestScore > 0.2 ? best : null;
}

function doCast(world, a, ab, target, opts = {}) {
  let angle = a.facing;
  let aimPoint = null;
  if (target) {
    angle = opts.lead ? predictiveAim(a, target, opts.lead) : Math.atan2(target.y - a.y, target.x - a.x);
    aimPoint = { x: target.x, y: target.y };
  }
  const ok = castAbility(world, a, ab, angle, { aimPoint, force: true });
  if (ok) {
    a.cdMap[ab.id] = (ab.cd || 2.4) * (a.cdMult || 1);
    a.aiState = 'recover';
    a.aiTimer = (ab.recovery || 0.4) + (ab.startup || 0.3) * 0.5;
    a.attackAngle = angle;
  }
  return ok;
}

// ---------------------------------------------------------------------------
// Standard enemies
// ---------------------------------------------------------------------------
function updateEnemyAI(world, a, dt) {
  a.thinkTimer -= dt;
  const target = world.nearestTargetForEnemy(a);
  a.aiTimer -= dt;
  if (!target) {
    a.vx = 0;
    a.vy = 0;
    return;
  }
  a.target = target;
  const d = dist(a.x, a.y, target.x, target.y);
  if (!a.phase) {
    const desired = a.ai.preferredRange ?? 20;
    a.faceAngle(Math.atan2(target.y - a.y, target.x - a.x));

    if (a.aiState === 'recover') {
      if (a.aiTimer > 0) {
        if (d < desired + 14 && a.behavior !== 'melee') moveAway(a, target.x, target.y, 0.6);
        else {
          a.vx = 0;
          a.vy = 0;
        }
        return;
      }
      a.aiState = 'idle';
    }
    // dodge on player windup
    if (a.ai.dodgeChance && a.thinkTimer <= 0) {
      a.thinkTimer = 0.25;
      const p = world.player;
      if (p && p.phase === 'startup' && d < 60 && Math.random() < a.ai.dodgeChance * 0.5) {
        a.strafeDir = Math.random() < 0.5 ? -1 : 1;
        a.dodgeT = 0.28;
      }
    }
    if (a.dodgeT > 0) {
      a.dodgeT -= dt;
      strafe(a, target, a.strafeDir, 1.4);
      return;
    }

    if (a.behavior === 'exploder') {
      moveToward(a, target.x, target.y, 1);
      if (d < 26 && !a.phase) {
        world.detonateEnemy?.(a);
      }
      return;
    }

    if (d > desired + 12) {
      moveToward(a, target.x, target.y, 1);
      // ranged units approach with a zigzag
      if (a.behavior === 'ranged' && d > desired * 1.6) strafe(a, target, a.strafeDir, 0.8);
    } else if (d < desired - 14) {
      moveAway(a, target.x, target.y, 0.85);
    } else {
      if (a.behavior === 'melee' || a.behavior === 'charger') {
        // circle the player
        strafe(a, target, a.strafeDir, 0.55);
      } else {
        a.vx *= 0.9;
        a.vy *= 0.9;
      }
      if (a.thinkTimer <= 0) {
        a.thinkTimer = 0.6 + Math.random() * 0.7;
        if (Math.random() < (a.ai.aggression || 0.7)) {
          const ab = pickAbility(world, a, target);
          if (ab) {
            a.faceAngle(Math.atan2(target.y - a.y, target.x - a.x));
            doCast(world, a, ab, target, { lead: 0.1 });
            return;
          }
        }
      }
    }
    // opportunistic attack while closing
    if (d < 44 && Math.random() < 0.02 * (a.ai.aggression || 1)) {
      const ab = pickAbility(world, a, target);
      if (ab) {
        doCast(world, a, ab, target, { lead: 0.08 });
        return;
      }
    }
  }
  if (a.aiTimer <= 0 && a.aiState !== 'recover') {
    const ab = pickAbility(world, a, target);
    if (ab && d < (ab.range || 200) * 1.1 && d > 8) {
      doCast(world, a, ab, target, { lead: 0.12 });
    }
  }
}

// ---------------------------------------------------------------------------
// Boss AI
// ---------------------------------------------------------------------------
function updateBossAI(world, a, dt) {
  a.thinkTimer -= dt;
  a.aiTimer -= dt;
  if (a.introT > 0) {
    a.introT -= dt;
    a.vx = 0;
    a.vy = 0;
    a.faceAngle(Math.atan2((world.player?.y || a.y) - a.y, (world.player?.x || a.x) - a.x));
    return;
  }
  const target = world.nearestTargetForEnemy(a);
  a.target = target;
  if (!target) {
    a.vx = 0;
    a.vy = 0;
    return;
  }
  const d = dist(a.x, a.y, target.x, target.y);
  const hpFrac = a.hp / a.maxHp;

  // phase transition
  if (a.enemyDef?.phases && a.phaseIndex === 1 && (hpFrac <= 0.5 || (a.def.forcePhase2 && !a.phase2))) {
    enterPhase2(world, a);
  }
  // boss domain at low health, once
  if (a.enemyDef?.domainAI && !a.domainUsed && hpFrac < 0.42 && !world.domain) {
    a.domainUsed = true;
    world.startBossDomain?.(a, a.enemyDef.domainAI);
    a.aiTimer = 1.4;
    return;
  }

  if (!a.phase) {
    a.faceAngle(Math.atan2(target.y - a.y, target.x - a.x));
    if (a.aiState === 'recover' && a.aiTimer > 0) {
      if (a.enemyDef?.adapts && d < 80) strafe(a, target, a.strafeDir, 0.5);
      else {
        a.vx = 0;
        a.vy = 0;
      }
      return;
    }
    a.aiState = 'idle';
    // adapt-driven behaviour change
    if (a.enemyDef?.adapts && a.adapt) {
      const maxStage = Math.max(0, ...Object.values(a.adapt).map((v) => v.stage));
      if (maxStage >= 2 && a.adaptCounterCd === undefined) a.adaptCounterCd = 4;
      if (a.adaptCounterCd !== undefined) {
        a.adaptCounterCd -= dt;
        if (a.adaptCounterCd <= 0) {
          a.adaptCounterCd = 7;
          const ab = a.abilities.find((m) => m.category === 'blunt' || m.category === 'cut');
          if (ab && d < 120) {
            doCast(world, a, ab, target, { lead: 0.15 });
            return;
          }
        }
      }
    }

    // movement: stay at mid range, close for melee moves
    const wantRange = a.enemyDef?.preferredRange || 60;
    if (d > wantRange + 30) moveToward(a, target.x, target.y, 1);
    else if (d < wantRange - 30) moveAway(a, target.x, target.y, 0.7);
    else strafe(a, target, a.strafeDir, 0.45);

    if (a.thinkTimer <= 0) {
      a.thinkTimer = 0.45 + Math.random() * 0.5;
      if (Math.random() < 0.85) {
        const ab = pickAbility(world, a, target, { noUlt: false });
        if (ab) {
          a.faceAngle(Math.atan2(target.y - a.y, target.x - a.x));
          doCast(world, a, ab, target, { lead: ab.type === 'projectile' ? 0.25 : 0.1 });
          return;
        }
      }
    }
  }
}

function enterPhase2(world, a) {
  a.phaseIndex = 2;
  a.def.forcePhase2 = true;
  const p2 = a.enemyDef.phase2 || {};
  a.speed *= p2.speed || 1.15;
  a.dmgMult *= p2.dmg || 1.15;
  if (p2.regen) a.regen += p2.regen;
  a.invulnT = 0.8;
  a.phase = null;
  a.ability = null;
  world.fx.flash('#ff2a4a', 0.25);
  world.fx.shake(9, 0.6);
  world.fx.ring(a.x, a.y - 10, 70, '#ff2a4a', 0.7, 3);
  world.fx.burst(a.x, a.y - 14, 30, { color: '#ff2a4a', speed: 200, life: 0.6, glow: true });
  world.audio?.play('boss');
  world.fx.text(a.x, a.y - 52, p2.name || 'PHASE 2', { color: '#ff6b6b', scale: 1.4, life: 2 });
  if (p2.line) world.scene?.onBossLine?.(a, p2.line);
  a.cdMult = (a.cdMult || 1) * 0.85;
  world.scene?.onBossPhase?.(a, 2);
}

// ---------------------------------------------------------------------------
// Sparring NPCs — use the character's real kit
// ---------------------------------------------------------------------------
function updateNpcAI(world, a, dt) {
  const def = getCharacter(a.charId || 'yuji');
  if (!a.fusionPair) a.fusionPair = ['toad', 'rabbitEscape'];
  // Divergent Fist: the NPC answers its own timing window like a player would.
  if (a.divergentState && !a.divergentState.resolved) {
    const st = a.divergentState;
    if (st.t >= st.windowStart && st.t <= st.windowEnd && Math.random() < 0.06 + (a.skill ?? 0.5) * 0.12) {
      triggerDivergent(world, a);
    }
  }
  a.thinkTimer -= dt;
  const p = world.player;
  if (!p || p.dead) {
    a.vx = 0;
    a.vy = 0;
    return;
  }
  const d = dist(a.x, a.y, p.x, p.y);
  a.aiTimer -= dt;
  if (!a.phase) {
    a.faceAngle(Math.atan2(p.y - a.y, p.x - a.x));
    const skill = a.skill ?? 0.6;
    if (a.dodgeCd === undefined) a.dodgeCd = 0;
    if (a.dodgeCd > 0) a.dodgeCd -= dt;
    // dodge player windups
    if (p.phase === 'startup' && d < 55 && a.dodgeCd <= 0 && Math.random() < 0.05 * skill) {
      a.dodgeCd = 1.1;
      const ang = Math.atan2(p.y - a.y, p.x - a.x) + (Math.random() < 0.5 ? 1.6 : -1.6);
      a.moveVx = Math.cos(ang) * 260;
      a.moveVy = Math.sin(ang) * 260;
      a.moveT = 0.16;
      a.invulnT = 0.2;
      world.fx.burst(a.x, a.y - 6, 6, { color: '#9ad0ff', speed: 60, life: 0.25 });
      a.aiTimer = 0.2;
      return;
    }
    const desired = a.npcRange || 26;
    if (d > desired + 18) moveToward(a, p.x, p.y, 1);
    else if (d < desired - 12) moveAway(a, p.x, p.y, 0.7);
    else strafe(a, p, a.strafeDir, 0.4);

    if (a.aiTimer <= 0 && a.thinkTimer <= 0) {
      a.thinkTimer = clamp(0.9 - skill * 0.5, 0.12, 0.9) + Math.random() * 0.4;
      // reinforcement & black flash
      if (a.ce > 30 && a.reinforced <= 0 && Math.random() < 0.25 * skill) {
        a.reinforced = 4;
        a.ce -= 16;
        world.fx.ring(a.x, a.y - 10, 20, '#ff9a6b', 0.3, 2);
        world.audio?.play('reinforce');
      }
      // ultimate (transformations swap the kit instead of firing a projectile)
      if ((a.ultMeter || 0) >= 100 && a.transformT <= 0 && Math.random() < 0.4 * skill) {
        a.ultMeter = 0;
        const ult = def.ultimate;
        if (ult) {
          if (ult.type === 'transform') activateTransform(world, a, ult);
          else castAbility(world, a, ult, a.facing, { free: true, force: true, aimPoint: { x: p.x, y: p.y } });
          world.fx.text(a.x, a.y - 46, (ult.name || 'ULTIMATE').toUpperCase(), { color: ult.color || '#ffd166', scale: 1.0, life: 1.2 });
          world.scene?.showBanner?.(`${a.name} · ULTIMATE`, ult.name || '', ult.color || '#ffd166', 1.6);
          return;
        }
      }
      // domain at low health, once per spar (real domain rules, incl. clashes).
      // Transformed kits carry their domain in a slot; it is cast only here,
      // never from the normal attack rotation (no domain spam).
      const slotDomain = a.transformT > 0 ? a.activeAbilities(def.abilities || []).find((x) => x.type === 'domain') : null;
      const domAb = def.domain || slotDomain;
      if (domAb && !a._domainUsed && a.hp / a.maxHp < 0.55 && !world.domain && Math.random() < 0.3 * skill) {
        a._domainUsed = true;
        castAbility(world, a, domAb, a.facing, { force: true, aimPoint: { x: p.x, y: p.y } });
        return;
      }
      // choose attack (Heian / King of Curses / Ascendant kits replace the base kit)
      const options = [...a.activeAbilities(def.abilities || [])];
      for (const ab of options) {
        if (ab.type === 'domain') continue; // domains cast only via the low-HP rule above
        if ((a.cdMap[ab.id] || 0) > 0) continue;
        if (ceCost(a, ab) > a.ce) continue;
        const range = ab.range || 40;
        const good = ab.type === 'projectile' ? d > 50 && d < range : d < range + 20;
        if (!good) continue;
        if (Math.random() < 0.55 * skill) {
          if (castAbility(world, a, ab, predictiveAim(a, p, 0.1), { aimPoint: { x: p.x, y: p.y }, force: true })) {
            a.cdMap[ab.id] = ab.cd || 3;
            a.aiTimer = (ab.recovery || 0.3) + 0.1;
            if (ab.blackFlash && a.reinforced > 0) {
              // NPC black flash attempt uses the same success rule with AI timing
              if (Math.random() < 0.55 * skill) {
                a.bfArmed = { abilityId: ab.id, until: world.time + 0.5 };
                world.fx.ring(a.x, a.y - 12, 16, '#ff2a4a', 0.2, 1.5);
              }
            }
            return;
          }
        }
      }
      // basic combo
      if (d < 40 && a.aiTimer <= 0) {
        const basics = def.basic;
        a.comboI = ((a.comboI || 0) + 1) % basics.length;
        const ab = basics[a.comboI];
        if (castAbility(world, a, ab, a.facing, { basic: true, force: true })) {
          a.aiTimer = 0.32;
          if (a.reinforced > 0 && Math.random() < 0.5 * skill) {
            a.bfArmed = { abilityId: ab.id, until: world.time + 0.4 };
          }
        }
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Summons
// ---------------------------------------------------------------------------
function updateSummonAI(world, a, dt) {
  const owner = a.owner;
  if (!owner || owner.dead) {
    a.vx = 0;
    a.vy = 0;
    return;
  }
  a.aiTimer -= dt;
  const target = world.nearestEnemyOf(a, a.role === 'support' ? 260 : 340);
  const dToOwner = dist(a.x, a.y, owner.x, owner.y);

  if (a.role === 'support') {
    // stay near the owner, heal when hurt
    if (dToOwner > 60) moveToward(a, owner.x, owner.y, 1);
    else {
      a.vx *= 0.85;
      a.vy *= 0.85;
    }
    if (!a.phase && a.aiTimer <= 0) {
      const healAb = (a.abilities || []).find((ab) => ab.aoe && ab.aoe.healOwner);
      if (healAb && owner.hp / owner.maxHp < 0.72 && canCast(world, a, healAb)) {
        doCast(world, a, healAb, target);
        a.aiTimer = 2;
        return;
      }
    }
    if (target && owner.hp / owner.maxHp > 0.7 && dToOwner <= 80) {
      a.faceAngle(Math.atan2(target.y - a.y, target.x - a.x));
    }
    return;
  }

  if (!target) {
    // follow the player
    if (dToOwner > 44) moveToward(a, owner.x, owner.y, 1.05);
    else {
      a.vx *= 0.85;
      a.vy *= 0.85;
    }
    return;
  }
  a.faceAngle(Math.atan2(target.y - a.y, target.x - a.x));
  const d = dist(a.x, a.y, target.x, target.y);
  const preferred = a.ai?.preferredRange ?? 20;
  if (a.role === 'swarm') {
    // rabbits scatter around enemies
    if (d > 16) moveToward(a, target.x, target.y, 1);
    else strafe(a, target, a.strafeDir, 0.8);
  } else if (d > preferred + 10) {
    moveToward(a, target.x, target.y, 1);
  } else if (d < preferred - 12) {
    moveAway(a, target.x, target.y, 0.7);
  } else {
    strafe(a, target, a.strafeDir, 0.5);
  }
  // stay near the summoner if very far
  if (dToOwner > 260 && a.role !== 'aerial') {
    moveToward(a, owner.x, owner.y, 1.1);
    return;
  }
  if (a.phase) return;
  if (a.aiTimer > 0) return;
  const ab = pickAbility(world, a, target, { noUlt: true });
  if (ab) {
    const inRange = ab.type === 'projectile' ? d < (ab.range || 200) : d < (ab.range || 30) + a.radius + 16;
    if (inRange) {
      doCast(world, a, ab, target, { lead: 0.1 });
      a.aiTimer = a.ai?.cooldown || 1.2;
      if (a.ability && a.ability.type === 'projectile') a.aiTimer += 0.4;
    }
  }
}

export { pickAbility, doCast, enterPhase2 };
