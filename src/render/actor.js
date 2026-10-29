// ---------------------------------------------------------------------------
// actor.js — turns an actor's combat state into a pose and draws it.
// Animation states are derived from real ability phases (startup/active/
// recovery), movement speed, hit reactions and death, so what you see always
// matches what the simulation is doing.
// ---------------------------------------------------------------------------

import { clamp } from '../core/util.js';
import { drawHumanoid, drawCreature, humanoidPose, PROPS } from './sprites.js';
import { CHARACTERS } from '../data/characters.js';

export function poseForActor(a, time) {
  const t = time + (a.id % 17) * 0.31;
  const opts = { speed: a.moving, facingX: a.facingX, swingDir: 1, progress: 0.4 };
  let state = a.animState;
  let progress = 0.4;

  if (a.dead) {
    state = 'dead';
    progress = clamp(a.deathT / 0.5, 0, 1);
    opts.progress = progress;
  } else if (a.phase) {
    state = a.animState || 'attack';
    if (a.phase === 'startup') progress = clamp(a.phaseT / Math.max(0.001, a.startupDur), 0, 1) * 0.5;
    else if (a.phase === 'active') progress = 0.5 + clamp(a.phaseT / Math.max(0.001, a.activeDur), 0, 1) * 0.35;
    else progress = 0.85 + clamp(a.phaseT / Math.max(0.001, a.recoveryDur), 0, 1) * 0.15;
    opts.progress = progress;
    if (state === 'attack' && a.phase === 'startup') state = 'windup';
  } else if (a.stunT > 0 || a.state === 'hurt') {
    state = 'hurt';
    opts.progress = 0.3;
  } else if (a.moving > 0.15) {
    state = a.moving > 0.75 ? 'run' : 'walk';
  } else {
    state = 'idle';
  }
  const pose = humanoidPose(state, t, opts);
  if (a.isSummon || a.rig) {
    // creature poses are simpler flags
    return {
      ...pose,
      bob: pose.bob * 0.5,
      moving: a.moving > 0.2,
      attack: a.phase === 'active' ? 1 : 0,
      headY: state === 'hurt' ? 1.5 : 0,
      charging: !!a.ability && a.ability.move && a.ability.move.type === 'charge' && a.phase === 'startup',
      jackpot: !!(a.jackpotT > 0),
    };
  }
  return pose;
}

export function drawActor(ctx, a, time) {
  if (a.removed) return;
  if (a.isDummy) {
    PROPS.dummy(ctx, a.x, a.y, a.dummyType, time, a.flash * 0.8);
    if (a.flash > 0.1) {
      ctx.globalAlpha = a.flash * 0.35;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(a.x - 12, a.y - 40, 24, 40);
      ctx.globalAlpha = 1;
    }
    return;
  }
  const pose = poseForActor(a, time);
  const alpha = a.dead ? clamp(1 - a.deathT / 1.1, 0, 1) : a.spawnT > 0 ? clamp(1 - a.spawnT / 0.35, 0.2, 1) : 1;
  const aura = a.reinforced > 0 ? 0.85 : (a.aura || 0);
  const auraColor = a.reinforced > 0 ? (a.isPlayer ? '#ff9a6b' : a.auraColor) : a.auraColor;

  const look = a.look || (a.def && CHARACTERS[a.def.look] ? CHARACTERS[a.def.look].look : null);

  if (a.rig && !look) {
    drawCreature(ctx, a.rig, {
      x: a.x,
      y: a.y,
      facingX: a.facingX,
      scale: a.scale,
      alpha,
      t: time + (a.id % 13) * 0.2,
      pal: a.pal || { main: '#5a4a5a', dark: '#332233', light: '#8a6a8a' },
      pose,
      flash: a.flash,
      aura,
      auraColor,
      adaptStage: a.adapt ? Math.max(...Object.values(a.adapt).map((v) => v.stage)) : 0,
      angry: a.isBoss,
      seed: a.id,
    });
  } else {
    drawHumanoid(ctx, {
      x: a.x,
      y: a.y,
      look: look || CHARACTERS.yuji.look,
      facingX: a.facingX || 1,
      pose,
      t: time,
      scale: a.scale,
      alpha,
      flash: a.flash,
      aura,
      auraColor: auraColor || '#5b8cff',
      tint: a.tintFlash > 0.7 && a.dead ? '#ffffff' : null,
    });
  }
  // summon ring / boss aura marker
  if (a.isSummon && a.spawnT > 0) {
    ctx.globalAlpha = clamp(a.spawnT / 0.35, 0, 1);
    ctx.strokeStyle = '#a79bff';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.ellipse(a.x, a.y, 20 * (1 - a.spawnT / 0.35) + 4, 7, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
  if (a.markStacks > 0) {
    for (let i = 0; i < a.markStacks; i++) {
      const ang = (i / 5) * Math.PI * 2 + time * 2;
      ctx.fillStyle = '#ff6b8a';
      ctx.fillRect(Math.round(a.x + Math.cos(ang) * 13), Math.round(a.y - 26 + Math.sin(ang) * 9), 2, 2);
    }
  }
  if (a.infinityT > 0) {
    ctx.globalAlpha = 0.25 + Math.sin(time * 8) * 0.08;
    ctx.strokeStyle = '#a8d8ff';
    ctx.lineWidth = 1;
    const r = 16 + Math.sin(time * 3) * 1.5;
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.arc(a.x, a.y - 12, r + i * 4, time * (i + 1) * 0.5, time * (i + 1) * 0.5 + 2.2);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }
}
