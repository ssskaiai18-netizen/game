// ---------------------------------------------------------------------------
// sprites.js — procedural pixel-art rendering.
//
// Every actor is drawn from an articulated pixel rig (head, torso, two arms,
// two legs, optional weapon) rather than a single static image, so animation
// comes from real limb motion: anticipation, active frames, follow-through and
// recovery are all visible. Creatures use bespoke shape rigs.
//
// All drawing happens in the 640x360 design space with integer-aligned rects
// for a crisp pixel look.
// ---------------------------------------------------------------------------

import { clamp, lerp, TAU } from '../core/util.js';

const R = (ctx, x, y, w, h, c) => {
  if (w <= 0 || h <= 0) return;
  ctx.fillStyle = c;
  ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
};

function tintColor(c, tint) {
  return tint || c;
}

function limb(ctx, x, y, len, w, ang, color, hand, handColor) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(ang);
  R(ctx, 0, -w / 2, len, w, color);
  if (hand) R(ctx, len - 1, -w / 2 - 0.5, 2, w + 1, handColor || color);
  ctx.restore();
}

// ---------------------------------------------------------------------------
// Animation → pose. Returns rig parameters for the humanoid renderer.
// ---------------------------------------------------------------------------
export function humanoidPose(state, t, opts = {}) {
  const p = {
    bob: 0,
    lean: 0,
    armF: 1.35,
    armB: 1.8,
    elbowF: 0,
    elbowB: 0,
    weapon: 0,
    legs: 0,
    crouch: 0,
    headY: 0,
    headTilt: 0,
    squash: 1,
    armsForward: 0,
    glow: 0,
  };
  const speed = opts.speed || 0;
  switch (state) {
    case 'idle': {
      p.bob = Math.sin(t * 3) * 0.6;
      p.armF = 1.5 + Math.sin(t * 3) * 0.05;
      p.armB = 1.7 + Math.sin(t * 3 + 1) * 0.05;
      p.legs = 0;
      break;
    }
    case 'walk':
    case 'run': {
      const rate = state === 'run' ? 13 : 8;
      const phase = t * rate;
      p.legs = Math.sin(phase) * (state === 'run' ? 1 : 0.7);
      p.bob = Math.abs(Math.cos(phase)) * (state === 'run' ? 1.7 : 1) - 0.5;
      p.lean = (state === 'run' ? 2.2 : 0.9) * (opts.facingX ?? 1);
      p.armF = 1.25 + Math.sin(phase) * 0.5;
      p.armB = 1.9 - Math.sin(phase) * 0.5;
      break;
    }
    case 'windup': {
      const k = clamp(opts.progress ?? 0.5, 0, 1);
      p.lean = -3 * (opts.facingX ?? 1);
      p.armF = lerp(2.4, 1.5, k);
      p.weapon = lerp(-2.2, -1.2, k);
      p.crouch = 1.2;
      p.bob = -0.5;
      p.glow = 0.6;
      break;
    }
    case 'attack': {
      const k = clamp(opts.progress ?? 0.4, 0, 1);
      const swing = Math.sin(k * Math.PI);
      p.lean = (2 + swing * 3) * (opts.facingX ?? 1);
      p.armF = lerp(0.4, 2.1, k);
      p.weapon = lerp(-0.7, 1.1, k) * (opts.swingDir ?? 1);
      p.legs = 0.6;
      p.squash = 1 + swing * 0.05;
      p.glow = 0.8;
      break;
    }
    case 'kick': {
      const k = clamp(opts.progress ?? 0.4, 0, 1);
      const swing = Math.sin(k * Math.PI);
      p.lean = -2 * (opts.facingX ?? 1);
      p.armF = 2.4;
      p.armB = 2.8;
      p.weapon = 0;
      p.legs = 0;
      p.bob = -swing * 3;
      p.crouch = 0.4;
      p.glow = 0.7;
      break;
    }
    case 'cast': {
      const k = clamp(opts.progress ?? 0.5, 0, 1);
      p.armF = 0.15;
      p.armB = 0.35;
      p.armsForward = 1;
      p.lean = 1.5 * (opts.facingX ?? 1);
      p.glow = 1;
      p.bob = -Math.sin(k * Math.PI) * 0.8;
      break;
    }
    case 'guard': {
      p.armF = 0.7;
      p.armB = 0.9;
      p.crouch = 1.4;
      p.lean = -1 * (opts.facingX ?? 1);
      p.glow = 0.9;
      break;
    }
    case 'hurt': {
      const k = clamp(opts.progress ?? 0.2, 0, 1);
      p.lean = -5 * (opts.facingX ?? 1);
      p.armF = 2.6;
      p.armB = 2.9;
      p.headTilt = -0.12;
      p.bob = -1 + k;
      p.glow = 0;
      break;
    }
    case 'dodge': {
      const k = clamp(opts.progress ?? 0.5, 0, 1);
      p.crouch = 2.6 * Math.sin(k * Math.PI);
      p.lean = 4 * (opts.facingX ?? 1);
      p.armF = 2.2;
      p.armB = 2.5;
      p.bob = 0.5;
      break;
    }
    case 'dead': {
      const k = clamp(opts.progress ?? 0, 0, 1);
      p.crouch = 4 * k;
      p.bob = 2 * k;
      break;
    }
    default:
      p.bob = Math.sin(t * 3) * 0.6;
  }
  return p;
}

// ---------------------------------------------------------------------------
// Humanoid renderer (faces right, flipped by facingX)
// ---------------------------------------------------------------------------
export function drawHumanoid(ctx, spec) {
  const {
    x,
    y,
    look,
    facingX = 1,
    pose,
    t = 0,
    scale = 1,
    alpha = 1,
    tint = null,
    flash = 0,
    aura = 0,
    auraColor = '#5b8cff',
    hitMark = 0,
  } = spec;
  const L = look;
  const skin = tintColor(L.skin, tint);
  const hair = tintColor(L.hair, tint);
  const top = tintColor(L.top, tint);
  const topDark = tintColor(L.topDark || L.top, tint);
  const bottom = tintColor(L.bottom, tint);
  const accent = tintColor(L.accent || '#c33', tint);
  const eye = tintColor(L.eye || '#f4f4f4', tint);
  const whiteFlash = flash > 0;

  ctx.save();
  ctx.globalAlpha = clamp(alpha, 0, 1);
  ctx.translate(Math.round(x), Math.round(y));
  ctx.scale(facingX * scale, scale);

  // ground shadow
  ctx.globalAlpha = clamp(alpha * 0.34, 0, 0.34);
  R(ctx, -6 - pose.crouch * 0.4, -1, 12 + pose.crouch, 3, '#000');
  ctx.globalAlpha = clamp(alpha, 0, 1);

  // aura behind
  if (aura > 0.01) {
    ctx.save();
    ctx.globalAlpha = alpha * 0.42 * aura;
    const p = 0.6 + Math.sin(t * 9) * 0.18;
    R(ctx, -8 * p, -26 * p - 2, 16 * p, 26 * p, auraColor);
    ctx.globalAlpha = alpha * 0.2 * aura;
    R(ctx, -11 * p, -30 * p, 22 * p, 30 * p, auraColor);
    ctx.restore();
  }

  const bob = pose.bob;
  const crouch = pose.crouch;
  const hipY = -9 + bob + crouch;
  const shoulderY = -19 + bob + crouch * 0.7;
  const headY = -24 + bob + crouch * 0.75 + pose.headY;

  // legs
  const legAng = 0.18 + pose.legs * 0.5;
  limb(ctx, -0.5, hipY, 7, 3, -legAng, bottom, true, skin);
  limb(ctx, 1.5, hipY, 7, 3, legAng * 0.9, tintColor(L.bottomDark || L.bottom, tint), true, skin);

  // back arm
  ctx.save();
  ctx.translate(0.5, shoulderY + 1);
  ctx.rotate(pose.armB);
  R(ctx, 0, -1.4, 6, 2.8, topDark);
  R(ctx, 5, -1.4, 2, 2.8, skin);
  ctx.restore();

  // torso
  R(ctx, -3.5, hipY - 9.5, 7.5, 10, top);
  R(ctx, -3.5, hipY - 9.5, 2, 10, topDark);
  R(ctx, 3.2, hipY - 7.5, 1.6, 5, tintColor(L.trim || accent, tint));
  if (L.longCoat) {
    R(ctx, -4.5, hipY - 2, 9, 7 + pose.legs * 1.2, topDark);
  }
  if (L.skirt) {
    R(ctx, -5, hipY - 2, 10, 5, bottom);
  }
  // collar / trim
  R(ctx, -2.5, hipY - 9.5, 5, 1.2, tintColor(L.accent || '#ffffff', tint));

  // neck + head
  R(ctx, -1, headY + 5, 2.4, 2, skin);
  R(ctx, -3.5, headY - 2 + pose.headTilt * 6, 7, 7.5, skin);
  // hair
  drawHair(ctx, L, hair, headY + pose.headTilt * 6, tint);
  // eyes
  if (!L.blindfold) {
    R(ctx, 0.4, headY + 0.6, 1.6, 1.6, eye);
    R(ctx, -2.4, headY + 0.6, 1.4, 1.6, eye);
    if (!whiteFlash) {
      R(ctx, 1, headY + 1.1, 1, 1, tintColor(L.pupil || '#1a1420', tint));
      R(ctx, -1.8, headY + 1.1, 1, 1, tintColor(L.pupil || '#1a1420', tint));
    }
    if (L.faceMark) {
      R(ctx, 1, headY - 1, 1.4, 1.4, tint);
    }
  } else {
    R(ctx, -3.8, headY - 0.4 + pose.headTilt * 6, 7.8, 2.4, tintColor(L.blindfold, tint));
  }
  if (L.tattoos) {
    R(ctx, -2, headY + 2.4, 1, 1.6, tintColor('#5a1220', tint));
    R(ctx, 1.2, headY + 2.4, 1, 1.6, tintColor('#5a1220', tint));
    R(ctx, -0.4, headY + 4.2, 1.6, 0.8, tintColor('#5a1220', tint));
  }
  if (L.hitMark && whiteFlash) {
    R(ctx, 6, headY - 4, 3, 1, '#fff');
    R(ctx, 8, headY - 6, 1, 3, '#fff');
  }

  // front arm + weapon
  ctx.save();
  ctx.translate(1.5, shoulderY + 1.5);
  ctx.rotate(pose.armF);
  R(ctx, 0, -1.5, 7, 3, tintColor(L.topLight || L.top, tint));
  R(ctx, 6, -2, 2.4, 4, skin);
  if (L.weapon === 'hammer' && pose.weapon !== undefined) {
    ctx.save();
    ctx.translate(7, 0);
    ctx.rotate(pose.weapon - 0.4);
    R(ctx, -1.5, -1.5, 8, 2.6, '#6b4b32');
    R(ctx, 6.5, -4, 5, 6, '#9aa3b2');
    R(ctx, 6.5, -4, 5, 1.6, '#c9d3e0');
    ctx.restore();
  } else if (L.weapon === 'katana') {
    ctx.save();
    ctx.translate(7, 0);
    ctx.rotate(pose.weapon - 0.5);
    R(ctx, -1, -1.6, 2, 3.2, '#2b2530');
    R(ctx, 1, -1, 14, 2, '#d7e3f0');
    R(ctx, 1, -1, 14, 0.8, '#ffffff');
    ctx.restore();
  } else if (L.weapon === 'claw') {
    R(ctx, 7, -2.4, 2.4, 1, '#ffe9b0');
    R(ctx, 7, 0, 2.4, 1, '#ffe9b0');
  }
  ctx.restore();

  // arms-forward overlay (technique cast): draw glowing hands
  if (pose.armsForward > 0.1) {
    ctx.save();
    ctx.globalAlpha = clamp(alpha * (0.6 + 0.4 * Math.sin(t * 20)), 0, 1);
    R(ctx, 8, shoulderY + 1, 3, 3, '#ffffff');
    R(ctx, 7.6, shoulderY + 0.6, 3.8, 3.8, auraColor);
    ctx.restore();
  }

  // hit flash overlay (white silhouette approximation)
  if (whiteFlash) {
    ctx.globalAlpha = clamp(alpha * Math.min(1, flash), 0, 1);
    ctx.globalCompositeOperation = 'lighter';
    R(ctx, -4, headY - 1, 8, 8, '#ffffff');
    R(ctx, -4, hipY - 10, 8, 11, '#ffffff');
    R(ctx, -0.5, hipY, 3, 8, '#ffffff');
    R(ctx, 0, shoulderY, 8, 3, '#ffffff');
    ctx.globalCompositeOperation = 'source-over';
  }
  if (hitMark > 0) {
    ctx.globalAlpha = clamp(hitMark, 0, 1);
    R(ctx, -9, headY - 6, 2, 12, '#ff4d6d');
    R(ctx, 8, headY - 4, 2, 8, '#ff4d6d');
  }
  ctx.restore();
}

function drawHair(ctx, L, hair, headY, tint) {
  ctx.save();
  switch (L.hairStyle) {
    case 'spiky':
      R(ctx, -4, headY - 3.2, 8, 4, hair);
      for (let i = 0; i < 4; i++) R(ctx, -4 + i * 2, headY - 4.4 - (i % 2), 1.6, 2, hair);
      R(ctx, -4.2, headY - 1, 2, 3, hair);
      break;
    case 'wild':
      R(ctx, -4.4, headY - 4, 8.8, 4.4, hair);
      R(ctx, -5, headY - 5.5, 2, 3, hair);
      R(ctx, 2.4, headY - 5.8, 2, 3.4, hair);
      R(ctx, -2, headY - 6.2, 2.6, 2.6, hair);
      R(ctx, -4.6, headY - 0.5, 2, 4, hair);
      break;
    case 'bob':
      R(ctx, -4.2, headY - 3, 8.4, 4, hair);
      R(ctx, -4.6, headY - 1, 2.2, 6, hair);
      R(ctx, 2.6, headY - 1, 2.2, 5, hair);
      break;
    case 'long':
      R(ctx, -4, headY - 3, 8, 4, hair);
      R(ctx, -4.4, headY - 1.5, 2.4, 9, hair);
      R(ctx, 2.2, headY - 1.5, 2.4, 8, hair);
      break;
    case 'slick':
      R(ctx, -4, headY - 3.4, 8, 3.6, hair);
      R(ctx, -4.4, headY - 2, 1.8, 5, hair);
      break;
    case 'buzz':
      R(ctx, -3.8, headY - 2.8, 7.6, 3.2, hair);
      break;
    case 'messy':
      R(ctx, -4.2, headY - 4, 8.4, 4.2, hair);
      R(ctx, -3, headY - 5.6, 2, 2.4, hair);
      R(ctx, 1, headY - 5.2, 2.4, 2, hair);
      break;
    default:
      R(ctx, -4, headY - 3, 8, 4, hair);
  }
  ctx.restore();
}

// ---------------------------------------------------------------------------
// Creature rigs
// ---------------------------------------------------------------------------
function ears(ctx, x, y, c) {
  R(ctx, x, y, 2, 3, c);
  R(ctx, x + 5, y, 2, 3, c);
}

function beastBody(ctx, w, h, color, dark, yOff = 0) {
  R(ctx, -w / 2, -h + yOff, w, h, color);
  R(ctx, -w / 2, -h + yOff, w, 1.5, dark);
}

const CREATURES = {
  // ---------------------------------------------------------------- Divine Dog
  divineDog(ctx, o) {
    const { t, pal, pose, angry } = o;
    const c = pal.main;
    const dark = pal.dark;
    const bob = Math.sin(t * 12) * 0.8 + pose.bob;
    const legPhase = Math.sin(t * (pose.moving ? 16 : 4));
    // legs
    R(ctx, -8, -4 + legPhase * 1.6 + bob, 2.4, 5, dark);
    R(ctx, -4, -4 - legPhase * 1.6 + bob, 2.4, 5, dark);
    R(ctx, 3, -4 - legPhase * 1.6 + bob, 2.4, 5, dark);
    R(ctx, 7, -4 + legPhase * 1.6 + bob, 2.4, 5, dark);
    // body
    R(ctx, -10, -11 + bob, 19, 7, c);
    R(ctx, -10, -11 + bob, 19, 2, pal.light);
    R(ctx, -10, -5 + bob, 19, 1.4, dark);
    // tail
    ctx.save();
    ctx.translate(-10, -9 + bob);
    ctx.rotate(Math.sin(t * 9) * 0.5 - 0.5);
    R(ctx, -6, -1, 6, 2, c);
    ctx.restore();
    // head
    const hx = 8;
    const hy = -14 + bob + pose.headY;
    R(ctx, hx, hy, 7, 6, c);
    R(ctx, hx + 5, hy + 2.5, 4, 3.4, c);
    R(ctx, hx + 8, hy + 3, 1.6, 1.6, dark); // nose
    ears(ctx, hx - 1, hy - 2.4, c);
    if (angry) {
      R(ctx, hx + 2, hy + 1.4, 1.6, 1.2, '#ff4466');
      R(ctx, hx + 4.6, hy + 1.4, 1.6, 1.2, '#ff4466');
      R(ctx, hx + 5, hy + 4.4, 3, 0.8, '#f2f2f2');
    } else {
      R(ctx, hx + 2, hy + 1.6, 1.2, 1.2, '#111');
      R(ctx, hx + 4.6, hy + 1.6, 1.2, 1.2, '#111');
    }
    if (pose.attack > 0) {
      R(ctx, hx + 4, hy + 3.6, 5, 2, '#f7f7f7');
      R(ctx, hx + 5, hy + 3.2, 1, 3, '#ffffff');
    }
  },
  // ----------------------------------------------------------------------- Nue
  nue(ctx, o) {
    const { t, pal, pose } = o;
    const c = pal.main;
    const flap = Math.sin(t * (pose.moving ? 22 : 10)) * 5;
    R(ctx, -4, -9 + flap * 0.2 + pose.bob, 9, 6, c);
    // wings
    R(ctx, -12, -10 - flap, 8, 3, pal.dark);
    R(ctx, -10, -8 - flap * 0.7, 6, 2, pal.light);
    R(ctx, 4, -10 + flap, 8, 3, pal.dark);
    R(ctx, 5, -8 + flap * 0.7, 6, 2, pal.light);
    // head
    R(ctx, 3, -13 + pose.bob, 6, 5, c);
    R(ctx, 8, -12 + pose.bob, 3.4, 2.4, pal.light);
    R(ctx, 4, -12 + pose.bob, 1.4, 1.4, '#ffe14d');
    R(ctx, 9.4, -11.6 + pose.bob, 1.4, 1.2, '#fff');
    // talons / lightning
    R(ctx, -3, -3.4 + pose.bob, 1.4, 3, '#e7c34a');
    R(ctx, 2, -3.4 + pose.bob, 1.4, 3, '#e7c34a');
    R(ctx, -6, -12 + pose.bob, 2, 2, '#f7e26b');
  },
  // ------------------------------------------------------------- Great Serpent
  greatSerpent(ctx, o) {
    const { t, pal, pose } = o;
    const segs = 8;
    for (let i = segs - 1; i >= 0; i--) {
      const wave = Math.sin(t * 6 - i * 0.7) * 2.4;
      const x = -i * 3.4 + 4;
      const y = -4 - i * 0.9 + wave * (i / segs) + pose.bob;
      R(ctx, x, y - 3.4, 4.4, 4.4, i % 2 ? pal.main : pal.dark);
    }
    const hx = 4;
    const hy = -10 + pose.bob;
    R(ctx, hx, hy, 8, 6, pal.main);
    R(ctx, hx + 5, hy + 1, 4, 3, pal.dark);
    R(ctx, hx + 3, hy + 1.4, 1.6, 1.6, '#ffe14d');
    if (pose.attack > 0) {
      R(ctx, hx + 7, hy + 2.4, 4, 1.4, '#ffffff');
      R(ctx, hx + 6, hy + 4, 4, 1, '#e0e6f2');
    }
    R(ctx, hx - 2, hy - 2, 2, 2, pal.light);
  },
  // ---------------------------------------------------------------------- Toad
  toad(ctx, o) {
    const { t, pal, pose } = o;
    const breathe = Math.sin(t * 4) * 0.8;
    R(ctx, -8, -10 + breathe + pose.bob, 16, 9, pal.main);
    R(ctx, -8, -10 + breathe + pose.bob, 16, 2, pal.light);
    R(ctx, -9, -6 + breathe + pose.bob, 3, 5, pal.dark);
    R(ctx, 6, -6 + breathe + pose.bob, 3, 5, pal.dark);
    R(ctx, -5, -12.4 + breathe + pose.bob, 4.4, 3.4, pal.main);
    R(ctx, 1, -12.4 + breathe + pose.bob, 4.4, 3.4, pal.main);
    R(ctx, -4, -11 + breathe + pose.bob, 1.8, 1.8, '#f7e26b');
    R(ctx, 2.4, -11 + breathe + pose.bob, 1.8, 1.8, '#f7e26b');
    R(ctx, -3.6, -10.4 + breathe + pose.bob, 0.8, 0.8, '#111');
    R(ctx, 3, -10.4 + breathe + pose.bob, 0.8, 0.8, '#111');
    if (pose.attack > 0) {
      R(ctx, 6, -8 + pose.bob, 10, 1.8, '#f0778a');
      R(ctx, 15, -9 + pose.bob, 3, 3.6, '#e2607a');
    }
  },
  // -------------------------------------------------------------- Max Elephant
  maxElephant(ctx, o) {
    const { t, pal, pose } = o;
    const step = Math.sin(t * (pose.moving ? 7 : 2.6)) * 0.9;
    R(ctx, -14, -12 + step + pose.bob, 8, 8, pal.dark);
    R(ctx, -12, -22 + step + pose.bob, 22, 12, pal.main);
    R(ctx, -12, -22 + step + pose.bob, 22, 2.4, pal.light);
    R(ctx, -11, -24 + step + pose.bob, 16, 3, '#3b2a20');
    // legs
    R(ctx, -10, -10 + pose.bob, 4, 7, pal.dark);
    R(ctx, -3, -10 + pose.bob, 4, 7, pal.dark);
    R(ctx, 4, -10 + pose.bob, 4, 7, pal.dark);
    R(ctx, 9, -10 + pose.bob, 4, 6, pal.dark);
    // head + trunk
    R(ctx, 10, -22 + step + pose.bob, 9, 9, pal.main);
    R(ctx, 17, -20 + step + pose.bob, 5, 4, pal.light);
    R(ctx, 20, -19 + step + pose.bob, 1.6, 1.6, '#111');
    R(ctx, 15, -24 + step + pose.bob, 5, 4, pal.dark);
    ctx.save();
    ctx.translate(19, -16 + step + pose.bob);
    ctx.rotate(Math.sin(t * 3) * 0.25 + 0.7);
    R(ctx, 0, 0, 2.6, 8, pal.light);
    ctx.restore();
    if (pose.attack > 0) R(ctx, 20, -24 + step + pose.bob, 3, 3, '#8fe3ff');
  },
  // --------------------------------------------------------------------- Rabbit
  rabbit(ctx, o) {
    const { t, pal, pose } = o;
    const hop = Math.abs(Math.sin(t * 12 + o.seed)) * 3;
    R(ctx, -3, -7 - hop + pose.bob, 6, 6, pal.main);
    R(ctx, -3, -9 - hop, 2, 3, pal.dark);
    R(ctx, 0.5, -9 - hop, 2, 3, pal.dark);
    R(ctx, 2, -6 - hop, 3, 3, pal.main);
    R(ctx, 4, -5.4 - hop, 1.2, 1.2, '#f2f2f2');
    R(ctx, 2.4, -6.6 - hop, 1, 1, '#c33');
    R(ctx, -2, -2 - hop * 0.4, 3, 1.6, pal.light);
  },
  // ---------------------------------------------------------------- Round Deer
  roundDeer(ctx, o) {
    const { t, pal, pose } = o;
    const step = Math.sin(t * 4) * 0.7;
    R(ctx, -8, -10 + step + pose.bob, 7, 6, pal.main);
    R(ctx, -2, -14 + step + pose.bob, 12, 10, pal.main);
    R(ctx, -2, -14 + step + pose.bob, 12, 2, pal.light);
    R(ctx, -7, -5 + pose.bob, 2.4, 5, pal.dark);
    R(ctx, -2, -5 + pose.bob, 2.4, 5, pal.dark);
    R(ctx, 5, -5 + pose.bob, 2.4, 5, pal.dark);
    // neck + head
    R(ctx, 8, -18 + step + pose.bob, 4, 7, pal.main);
    R(ctx, 8, -20 + step + pose.bob, 7, 4.4, pal.main);
    R(ctx, 13, 0 + -19 + step + pose.bob, 2, 1.6, '#ffe9b0');
    R(ctx, 11, -18 + step + pose.bob, 1.4, 1.4, '#f2f2f2');
    // antlers
    R(ctx, 9, -24 + step + pose.bob, 1.4, 5, '#e7d9b0');
    R(ctx, 12, -23 + step + pose.bob, 1.4, 4, '#e7d9b0');
    R(ctx, 7, -25 + step + pose.bob, 3, 1.4, '#e7d9b0');
    R(ctx, 12, -25 + step + pose.bob, 3, 1.4, '#e7d9b0');
    // aura
    ctx.globalAlpha *= 0.3;
    R(ctx, -10, -20, 22, 20, pal.light);
    ctx.globalAlpha /= 0.3;
  },
  // ---------------------------------------------------------------- Piercing Ox
  piercingOx(ctx, o) {
    const { t, pal, pose } = o;
    const step = Math.sin(t * (pose.moving ? 10 : 3)) * 1;
    R(ctx, -12, -14 + step + pose.bob, 20, 12, pal.main);
    R(ctx, -12, -14 + step + pose.bob, 20, 2.2, pal.light);
    R(ctx, -10, -4 + pose.bob, 3, 5, pal.dark);
    R(ctx, -3, -4 + pose.bob, 3, 5, pal.dark);
    R(ctx, 4, -4 + pose.bob, 3, 5, pal.dark);
    R(ctx, 8, -20 + step + pose.bob, 9, 9, pal.main);
    R(ctx, 16, -18 + step + pose.bob, 5, 5, pal.light);
    R(ctx, 20, -17 + step + pose.bob, 1.6, 1.6, '#111');
    // horns
    R(ctx, 9, -24 + step + pose.bob, 2, 4, '#efe6cf');
    R(ctx, 14, -25 + step + pose.bob, 2, 5, '#efe6cf');
    R(ctx, 6, -23 + step + pose.bob, 3, 1.6, '#efe6cf');
    if (pose.charging) {
      ctx.globalAlpha *= 0.6;
      R(ctx, -22, -12, 12, 8, '#ffd166');
      ctx.globalAlpha /= 0.6;
    }
  },
  // ------------------------------------------------------------ Mourning Tiger
  mourningTiger(ctx, o) {
    const { t, pal, pose } = o;
    const st = Math.sin(t * 10) * 0.8;
    R(ctx, -12, -13 + st + pose.bob, 22, 9, pal.main);
    R(ctx, -12, -13 + st + pose.bob, 22, 2, pal.light);
    for (let i = 0; i < 4; i++) R(ctx, -9 + i * 5, -13 + st + pose.bob, 1.4, 9, pal.dark);
    R(ctx, -14, -10, 2, 2, pal.dark);
    R(ctx, -11, -4 + pose.bob, 3, 5, pal.dark);
    R(ctx, -4, -4 + pose.bob, 3, 5, pal.dark);
    R(ctx, 3, -4 + pose.bob, 3, 5, pal.dark);
    R(ctx, 8, -17 + st + pose.bob, 9, 9, pal.main);
    R(ctx, 15, -14 + st + pose.bob, 5, 6, pal.light);
    R(ctx, 6, -19 + st + pose.bob, 3, 3, pal.dark);
    R(ctx, 11, -19 + st + pose.bob, 3, 3, pal.dark);
    R(ctx, 10.5, -14 + st + pose.bob, 1.6, 1.6, '#ffe14d');
    R(ctx, 13.4, -14 + st + pose.bob, 1.6, 1.6, '#ffe14d');
    if (pose.attack > 0) {
      R(ctx, 16, -13 + st + pose.bob, 4, 2, '#ffffff');
      R(ctx, 17, -12 + st + pose.bob, 3.4, 1.4, '#f2f2f2');
    }
  },
  // ------------------------------------------------------------------ Mahoraga
  mahoraga(ctx, o) {
    const { t, pal, pose } = o;
    const breathe = Math.sin(t * 2.2) * 0.9;
    // legs
    R(ctx, -9, -8 + pose.bob, 4, 9, pal.dark);
    R(ctx, 4, -8 + pose.bob, 4, 9, pal.dark);
    // massive torso
    R(ctx, -12, -26 + breathe + pose.bob, 24, 19, pal.main);
    R(ctx, -12, -26 + breathe + pose.bob, 24, 3, pal.light);
    R(ctx, -14, -20 + breathe + pose.bob, 4, 10, pal.dark);
    R(ctx, 10, -20 + breathe + pose.bob, 4, 10, pal.dark);
    // chest ring markings
    for (let i = 0; i < 3; i++) {
      R(ctx, -6 + i * 4, -23 + breathe + pose.bob, 2.4, 2.4, pal.accent);
    }
    // arms + sword
    const armSwing = pose.attack > 0 ? -0.9 : 0.35;
    ctx.save();
    ctx.translate(9, -22 + pose.bob);
    ctx.rotate(armSwing + Math.sin(t * 2) * 0.06);
    R(ctx, 0, -2.4, 14, 4.8, pal.main);
    R(ctx, 12, -3.4, 4.4, 6.6, pal.dark);
    // Eight-Handled Sword of Divergent Sila
    R(ctx, 14, -8, 3, 16, '#c9c2b0');
    R(ctx, 14, -8, 3, 3, '#efe6cf');
    R(ctx, 17, 2, 14, 2.4, '#e6e0d0');
    R(ctx, 17, 2, 14, 0.8, '#fffdf0');
    ctx.restore();
    ctx.save();
    ctx.translate(-9, -22 + pose.bob);
    ctx.rotate(2.5 + Math.sin(t * 2 + 1) * 0.06);
    R(ctx, 0, -2, 10, 4, pal.dark);
    ctx.restore();
    // head
    R(ctx, -5, -33 + breathe + pose.bob, 11, 8, pal.main);
    R(ctx, -5, -33 + breathe + pose.bob, 11, 1.6, pal.light);
    R(ctx, -4, -30 + breathe + pose.bob, 3, 1.6, '#ffe14d');
    R(ctx, 2, -30 + breathe + pose.bob, 3, 1.6, '#ffe14d');
    R(ctx, -3, -35 + breathe + pose.bob, 2, 3, '#c9c2b0');
    R(ctx, 2, -35 + breathe + pose.bob, 2, 3, '#c9c2b0');
    // adaptation wheel behind head
    const wheelRot = t * 0.6;
    ctx.globalAlpha *= 0.75;
    for (let i = 0; i < 8; i++) {
      const a = wheelRot + (i / 8) * TAU;
      const wx = Math.cos(a) * 11;
      const wy = -34 + flee(pose.bob) + Math.sin(a) * 5;
      const active = o.adaptStage ? i < o.adaptStage * 2 : false;
      R(ctx, wx - 1, wy - 1, 2.4, 2.4, active ? '#ffd166' : '#5c5448');
    }
    ctx.globalAlpha /= 0.75;
  },
  // ---------------------------------------------------------------------- Agito
  agito(ctx, o) {
    const { t, pal, pose } = o;
    const hover = Math.sin(t * 3) * 1.6;
    // wings
    const flap = Math.sin(t * 8) * 3;
    R(ctx, -16, -22 - flap + hover, 9, 4, pal.dark);
    R(ctx, 7, -22 + flap + hover, 9, 4, pal.dark);
    // body
    R(ctx, -7, -22 + hover + pose.bob, 14, 14, pal.main);
    R(ctx, -7, -22 + hover + pose.bob, 14, 2.4, pal.light);
    R(ctx, -6, -20 + hover + pose.bob, 4, 8, pal.accent);
    // legs
    R(ctx, -6, -8 + hover, 3, 6, pal.dark);
    R(ctx, 3, -8 + hover, 3, 6, pal.dark);
    // head (divine dog + nue hybrid)
    R(ctx, -5, -28 + hover + pose.bob, 9, 7, pal.main);
    R(ctx, 3, -26 + hover + pose.bob, 4, 4, pal.light);
    R(ctx, -6, -30 + hover + pose.bob, 2, 3, pal.dark);
    R(ctx, 3, -31 + hover + pose.bob, 2, 4, pal.dark);
    R(ctx, -3, -26 + hover + pose.bob, 1.6, 1.6, '#ffe14d');
    R(ctx, 0.4, -26 + hover + pose.bob, 1.6, 1.6, '#ffe14d');
    // aura lightning
    ctx.globalAlpha *= 0.7;
    R(ctx, -10, -30 + hover, 1.6, 6, '#7ec8ff');
    R(ctx, 9, -26 + hover, 1.6, 5, '#7ec8ff');
    ctx.globalAlpha /= 0.7;
  },
  // --------------------------------------------------------------- Curse / enemy
  curseSmall(ctx, o) {
    const { t, pal, pose } = o;
    const bob = Math.sin(t * 5) * 1.2 + pose.bob;
    R(ctx, -5, -14 + bob, 10, 11, pal.main);
    R(ctx, -5, -14 + bob, 10, 2, pal.light);
    R(ctx, -4, -17 + bob, 9, 4, pal.dark);
    R(ctx, -3, -15.6 + bob, 2, 2, '#ffe14d');
    R(ctx, 1.6, -15.6 + bob, 2, 2, '#ffe14d');
    R(ctx, -2.4, -12 + bob, 5, 1.6, '#2a0d16');
    R(ctx, -6.4, -11 + bob, 2, 6, pal.dark);
    R(ctx, 4.6, -11 + bob, 2, 6, pal.dark);
    if (pose.attack > 0) {
      R(ctx, -8, -18, 4, 3, pal.dark);
      R(ctx, 5, -18, 4, 3, pal.dark);
    }
  },
  curseBrute(ctx, o) {
    const { t, pal, pose } = o;
    const bob = Math.sin(t * 3.5) * 1.4 + pose.bob;
    R(ctx, -8, -26 + bob, 16, 22, pal.main);
    R(ctx, -8, -26 + bob, 16, 3, pal.light);
    R(ctx, -10, -22 + bob, 3, 12, pal.dark);
    R(ctx, 7, -22 + bob, 3, 12, pal.dark);
    R(ctx, -6, -31 + bob, 12, 7, pal.main);
    R(ctx, -5, -29 + bob, 3, 2.4, '#ffe14d');
    R(ctx, 2, -29 + bob, 3, 2.4, '#ffe14d');
    R(ctx, -4, -26.4 + bob, 8, 1.6, '#2a0d16');
    // spiked shoulders
    R(ctx, -11, -27 + bob, 3, 3, pal.accent);
    R(ctx, 8, -27 + bob, 3, 3, pal.accent);
    R(ctx, -7, -6 + pose.bob, 3, 6, pal.dark);
    R(ctx, 4, -6 + pose.bob, 3, 6, pal.dark);
    if (pose.attack > 0) {
      R(ctx, 8, -24 + bob, 10, 4, pal.dark);
      R(ctx, 16, -26 + bob, 4, 8, '#c33');
    }
  },
  flyHead(ctx, o) {
    const { t, pal, pose } = o;
    const bob = Math.sin(t * 8) * 2 + pose.bob;
    R(ctx, -4, -12 + bob, 8, 8, pal.main);
    R(ctx, -3, -13 + bob, 6, 2, pal.dark);
    R(ctx, -3, -10 + bob, 2, 2, '#ffe14d');
    R(ctx, 1.4, -10 + bob, 2, 2, '#ffe14d');
    ctx.save();
    ctx.translate(-4, -12 + bob);
    ctx.rotate(Math.sin(t * 20) * 0.6);
    R(ctx, -6, -2, 6, 2, pal.light);
    ctx.restore();
    ctx.save();
    ctx.translate(4, -12 + bob);
    ctx.rotate(-Math.sin(t * 20) * 0.6);
    R(ctx, 0, -2, 6, 2, pal.light);
    ctx.restore();
    R(ctx, -1.4, -4 + bob, 3, 4, pal.dark);
    R(ctx, -2, -4 + bob, 1, 2, '#e0e6f2');
    R(ctx, 1.4, -4 + bob, 1, 2, '#e0e6f2');
  },
  // -------------------------------------------------------------------- Mahito
  mahito(ctx, o) {
    const { t, pal, pose } = o;
    // stitched humanoid curse
    const bob = Math.sin(t * 3) * 0.8 + pose.bob;
    R(ctx, -3.5, -10 + bob, 7, 10, pal.main);
    R(ctx, -3.5, -10 + bob, 2, 10, pal.dark);
    R(ctx, -1, -20 + bob, 2, 3, pal.skin);
    R(ctx, -4, -27 + bob, 8, 8, pal.skin);
    R(ctx, -4.4, -29 + bob, 8.8, 4, pal.hair);
    R(ctx, 0.4, -24.6 + bob, 1.6, 1.6, '#8fd7ff');
    R(ctx, -2.6, -24.6 + bob, 1.6, 1.6, '#8fd7ff');
    R(ctx, -3.4, -22 + bob, 6, 0.8, '#3a2a3a');
    // stitch marks
    R(ctx, -3.4, -24 + bob, 0.8, 3, '#3a2a3a');
    R(ctx, 2.6, -24 + bob, 0.8, 3, '#3a2a3a');
    // hands with soul shaping
    R(ctx, 5, -14 + bob, 4, 4, pal.skin);
    R(ctx, -9, -14 + bob, 4, 4, pal.skin);
    R(ctx, -3, -2 + pose.bob, 2.4, 4, pal.dark);
    R(ctx, 1, -2 + pose.bob, 2.4, 4, pal.dark);
    if (pose.attack > 0) {
      ctx.globalAlpha *= 0.8;
      R(ctx, -12, -22 + bob, 5, 5, '#6fd0ff');
      ctx.globalAlpha /= 0.8;
    }
  },
  // ---------------------------------------------------------------- Jogo / fire
  curseFire(ctx, o) {
    const { t, pal, pose } = o;
    const bob = Math.sin(t * 3) * 0.7 + pose.bob;
    R(ctx, -4, -9 + bob, 8, 9, pal.main);
    R(ctx, -5, -27 + bob, 10, 19, pal.dark);
    R(ctx, -6, -31 + bob, 12, 6, '#3a1c14');
    R(ctx, -4, -29 + bob, 2, 2, '#ffb03a');
    R(ctx, 2, -29 + bob, 2, 2, '#ffb03a');
    R(ctx, -2, -26 + bob, 4, 1.4, '#1a0b08');
    // volcano head flame
    const f = Math.sin(t * 12) * 2;
    R(ctx, -5, -35 + bob, 3, 4 + f, '#ff7a2a');
    R(ctx, 1, -36 + bob, 3, 5 - f, '#ffb03a');
    R(ctx, -3, -4 + pose.bob, 2.4, 4, pal.main);
    R(ctx, 1, -4 + pose.bob, 2.4, 4, pal.main);
    if (pose.attack > 0) {
      R(ctx, 5, -20 + bob, 6, 6, '#ff8a3a');
      R(ctx, 9, -22 + bob, 4, 10, '#ffd06a');
    }
  },
  // ---------------------------------------------------------- Hanami / nature
  curseNature(ctx, o) {
    const { t, pal, pose } = o;
    const bob = Math.sin(t * 2.4) * 0.8 + pose.bob;
    R(ctx, -5, -9 + bob, 10, 9, pal.dark);
    R(ctx, -6, -24 + bob, 12, 16, pal.main);
    R(ctx, -6, -24 + bob, 12, 2.4, pal.light);
    R(ctx, -7, -30 + bob, 14, 7, '#2c3a26');
    R(ctx, -4, -27 + bob, 2, 2, '#ffe14d');
    R(ctx, 2, -27 + bob, 2, 2, '#ffe14d');
    // branch arms + flower
    R(ctx, 6, -22 + bob, 10, 2.4, pal.dark);
    R(ctx, 13, -27 + bob, 4, 7 + Math.sin(t * 4) * 1, '#d98ab0');
    R(ctx, -13, -20 + bob, 7, 2.4, pal.dark);
    R(ctx, -4, -4 + pose.bob, 2.4, 4, pal.dark);
    R(ctx, 2, -4 + pose.bob, 2.4, 4, pal.dark);
    if (pose.attack > 0) R(ctx, 12, -30 + bob, 6, 6, '#e8a5c6');
  },
  // ------------------------------------------------------------ Culling players
  higuruma(ctx, o) {
    const { t, pal, pose } = o;
    const bob = Math.sin(t * 3) * 0.7 + pose.bob;
    R(ctx, -3.6, -10 + bob, 7.6, 10, pal.main);
    R(ctx, -1, -20 + bob, 2.2, 2, pal.skin);
    R(ctx, -4, -27 + bob, 8, 7.4, pal.skin);
    R(ctx, -4.4, -28.4 + bob, 8.8, 3.6, pal.hair);
    R(ctx, 0.6, -24.4 + bob, 1.4, 1.4, '#3b2a20');
    R(ctx, -2.6, -24.4 + bob, 1.4, 1.4, '#3b2a20');
    // gavel
    R(ctx, 4, -18 + bob, 7, 3, pal.dark);
    R(ctx, 10, -21 + bob, 5, 7, '#7a5a3a');
    R(ctx, -3.4, -3 + pose.bob, 2.4, 5, pal.dark);
    R(ctx, 1.2, -3 + pose.bob, 2.4, 5, pal.dark);
    if (pose.attack > 0) R(ctx, 8, -30 + bob, 4, 9, '#ffe9b0');
  },
  kashimo(ctx, o) {
    const { t, pal, pose } = o;
    const bob = Math.sin(t * 4) * 0.7 + pose.bob;
    R(ctx, -3.4, -10 + bob, 7, 10, pal.main);
    R(ctx, -1, -20 + bob, 2.2, 2, pal.skin);
    R(ctx, -4, -27 + bob, 8, 7.4, pal.skin);
    R(ctx, -4.2, -29 + bob, 8.4, 3.4, '#cfd8e6');
    R(ctx, 0.6, -24.4 + bob, 1.4, 1.4, '#2a4a6a');
    R(ctx, -2.6, -24.4 + bob, 1.4, 1.4, '#2a4a6a');
    R(ctx, -3.4, -3 + pose.bob, 2.4, 5, pal.dark);
    R(ctx, 1.2, -3 + pose.bob, 2.4, 5, pal.dark);
    // staff / lightning
    R(ctx, 5, -22 + bob, 2.4, 16, '#5a6a80');
    R(ctx, 4, -25 + bob, 4.4, 4, '#8fd7ff');
    if (pose.attack > 0) {
      R(ctx, 7, -24 + bob, 9, 2, '#bff0ff');
      R(ctx, 12, -18 + bob, 2, 6, '#bff0ff');
    }
  },
  ishigori(ctx, o) {
    const { t, pal, pose } = o;
    const bob = Math.sin(t * 2.6) * 0.9 + pose.bob;
    R(ctx, -5.5, -12 + bob, 11, 12, pal.main);
    R(ctx, -1.4, -22 + bob, 2.6, 2.4, pal.skin);
    R(ctx, -4.6, -30 + bob, 9.2, 8, pal.skin);
    R(ctx, -5, -32.4 + bob, 10, 4, '#3a2a20');
    R(ctx, -3.4, -29 + bob, 2, 2, '#ffe14d');
    R(ctx, 1.6, -29 + bob, 2, 2, '#ffe14d');
    R(ctx, -4, -3 + pose.bob, 3, 5, pal.dark);
    R(ctx, 1, -3 + pose.bob, 3, 5, pal.dark);
    // granite blast
    ctx.globalAlpha *= 0.9;
    R(ctx, 7, -24 + bob, 6, 6, '#d8b48a');
    if (pose.attack > 0) {
      R(ctx, 12, -28 + bob, 12, 12, '#e8c9a0');
      R(ctx, 16, -24 + bob, 8, 5, '#ffe9c0');
    }
    ctx.globalAlpha /= 0.9;
  },
  uro(ctx, o) {
    const { t, pal, pose } = o;
    const bob = Math.sin(t * 3.4) * 0.8 + pose.bob;
    R(ctx, -3.6, -10 + bob, 7.2, 10, pal.main);
    R(ctx, -1, -20 + bob, 2.2, 2, pal.skin);
    R(ctx, -4, -27 + bob, 8, 7.4, pal.skin);
    R(ctx, -4.6, -29 + bob, 9.2, 4.4, '#c9c2e0');
    R(ctx, -4.6, -23 + bob, 2.2, 5, '#c9c2e0');
    R(ctx, 0.6, -24.6 + bob, 1.4, 1.4, '#6a58a0');
    R(ctx, -3.4, -3 + pose.bob, 2.4, 5, pal.dark);
    R(ctx, 1.2, -3 + pose.bob, 2.4, 5, pal.dark);
    R(ctx, 5, -20 + bob, 4, 9, '#7a68b0');
    if (pose.attack > 0) {
      ctx.globalAlpha *= 0.8;
      R(ctx, 8, -26 + bob, 8, 8, '#a898e0');
      ctx.globalAlpha /= 0.8;
    }
  },
  hakari(ctx, o) {
    const { t, pal, pose } = o;
    const bob = Math.sin(t * 5) * 0.8 + pose.bob;
    R(ctx, -4, -11 + bob, 8, 11, pal.main);
    R(ctx, -1, -21 + bob, 2.2, 2, pal.skin);
    R(ctx, -4, -28 + bob, 8, 7.4, pal.skin);
    R(ctx, -4.4, -30 + bob, 8.8, 4.2, '#1e1a22');
    R(ctx, 0.6, -25.4 + bob, 1.4, 1.4, '#ffe14d');
    R(ctx, -2.6, -25.4 + bob, 1.4, 1.4, '#ffe14d');
    R(ctx, -3.6, -3 + pose.bob, 2.4, 5, pal.dark);
    R(ctx, 1.4, -3 + pose.bob, 2.4, 5, pal.dark);
    R(ctx, 5, -19 + bob, 6, 3, '#c8a04a');
    // jackpot aura
    if (pose.attack > 0 || pose.jackpot) {
      ctx.globalAlpha *= 0.7;
      R(ctx, -12, -32 + bob, 24, 32, '#ffd166');
      ctx.globalAlpha /= 0.7;
    }
  },
  // ---------------------------------------------------------------- Generic NPC
  humanoidNpc(ctx, o) {
    // used when a creature rig is not available; body handled by hair/colors
    const { t, pal, pose } = o;
    const bob = Math.sin(t * 3) * 0.6 + pose.bob;
    R(ctx, -3.5, -10 + bob, 7, 10, pal.main);
    R(ctx, -1, -21 + bob, 2.2, 2, pal.skin || '#e0b090');
    R(ctx, -4, -28 + bob, 8, 7.4, pal.skin || '#e0b090');
    R(ctx, -4.2, -30 + bob, 8.4, 3.6, pal.dark);
    R(ctx, 0.6, -25.4 + bob, 1.4, 1.4, '#fff');
    R(ctx, -2.6, -25.4 + bob, 1.4, 1.4, '#fff');
    R(ctx, -3.4, -3 + pose.bob, 2.4, 5, pal.dark);
    R(ctx, 1.2, -3 + pose.bob, 2.4, 5, pal.dark);
  },
};

function flee(b) {
  return b || 0;
}

/**
 * Draw any creature. `kind` maps to a rig in CREATURES.
 * pose: { bob, moving, attack, headY, charging, jackpot }
 * pal: { main, dark, light, accent, skin, hair }
 */
export function drawCreature(ctx, kind, spec) {
  const fn = CREATURES[kind] || CREATURES.humanoidNpc;
  const { x, y, facingX = 1, scale = 1, alpha = 1, t = 0, tint = null, flash = 0, aura = 0, auraColor, pose = {}, pal = {}, adaptStage = 0, seed = 0 } = spec;
  const colors = {};
  for (const k of Object.keys(pal)) colors[k] = tint || pal[k];
  ctx.save();
  ctx.globalAlpha = clamp(alpha, 0, 1);
  ctx.translate(Math.round(x), Math.round(y));
  ctx.scale(facingX * scale, scale);
  // shadow
  ctx.globalAlpha = clamp(alpha * 0.3, 0, 0.3);
  R(ctx, -7, -1, 14, 3, '#000');
  ctx.globalAlpha = clamp(alpha, 0, 1);
  if (aura > 0.01) {
    ctx.globalAlpha = alpha * 0.3 * aura;
    const p = 0.7 + Math.sin(t * 10) * 0.15;
    R(ctx, -13 * p, -30 * p, 26 * p, 30 * p, auraColor || '#8f6bff');
    ctx.globalAlpha = clamp(alpha, 0, 1);
  }
  fn(ctx, { t, pal: colors, pose: { moving: false, attack: 0, ...pose }, angry: spec.angry, adaptStage, seed, flash });
  if (flash > 0) {
    ctx.globalAlpha = clamp(alpha * Math.min(1, flash) * 0.85, 0, 1);
    ctx.globalCompositeOperation = 'lighter';
    R(ctx, -10, -32, 20, 32, '#ffffff');
    ctx.globalCompositeOperation = 'source-over';
  }
  ctx.restore();
}

// ---------------------------------------------------------------------------
// Static pixel props for the hub & dungeon environment
// ---------------------------------------------------------------------------
export const PROPS = {
  torii(ctx, x, y, s = 1, t = 0) {
    const c = '#b23a3a';
    const d = '#7a2222';
    R(ctx, x - 16 * s, y - 30 * s, 4 * s, 30 * s, c);
    R(ctx, x + 12 * s, y - 30 * s, 4 * s, 30 * s, c);
    R(ctx, x - 20 * s, y - 34 * s, 40 * s, 4 * s, c);
    R(ctx, x - 16 * s, y - 38 * s, 32 * s, 3 * s, d);
    R(ctx, x - 14 * s, y - 26 * s, 28 * s, 3 * s, c);
    R(ctx, x - 20 * s, y - 34 * s, 40 * s, 1.4 * s, '#d95a5a');
  },
  tree(ctx, x, y, s = 1, t = 0, leaf = '#2f5d3a') {
    R(ctx, x - 3 * s, y - 24 * s, 6 * s, 24 * s, '#4a3526');
    R(ctx, x - 11 * s, y - 34 * s, 22 * s, 14 * s, leaf);
    R(ctx, x - 8 * s, y - 40 * s, 16 * s, 9 * s, '#3a7048');
    const sway = Math.sin(t * 1.2 + x * 0.1) * 1.2 * s;
    R(ctx, x - 6 * s + sway, y - 42 * s, 10 * s, 4 * s, '#4a8a58');
  },
  lantern(ctx, x, y, t = 0) {
    R(ctx, x - 1, y - 18, 2, 18, '#4a4038');
    R(ctx, x - 5, y - 26, 10, 9, '#d8c390');
    R(ctx, x - 4, y - 25, 8, 7, `rgba(255,220,140,${0.6 + Math.sin(t * 3 + x) * 0.2})`);
    R(ctx, x - 6, y - 27, 12, 2, '#6b5a44');
  },
  building(ctx, x, y, w, h, tint = '#2a2d3a') {
    R(ctx, x, y - h, w, h, tint);
    R(ctx, x, y - h, w, 3, '#3b4052');
    R(ctx, x, y - 3, w, 3, '#1a1c24');
    // roof
    ctx.fillStyle = '#1f222d';
    ctx.beginPath();
    ctx.moveTo(x - 6, y - h);
    ctx.lineTo(x + w + 6, y - h);
    ctx.lineTo(x + w - 4, y - h - 10);
    ctx.lineTo(x + 4, y - h - 10);
    ctx.closePath();
    ctx.fill();
  },
  dummy(ctx, x, y, type, t = 0, hurt = 0) {
    const c = type === 'reinforcement' ? '#5b7c8a' : type === 'combat' ? '#6a4a5a' : '#6b5a44';
    R(ctx, x - 2, y - 4, 4, 4, '#4a3a2a');
    R(ctx, x - 1, y - 18, 2, 14, '#5a4a36');
    R(ctx, x - 7, y - 30, 14, 13, c);
    R(ctx, x - 7, y - 30, 14, 2, '#8a7a64');
    R(ctx, x - 12, y - 28, 5, 2, '#5a4a36');
    R(ctx, x + 7, y - 28, 5, 2, '#5a4a36');
    // head
    R(ctx, x - 4, y - 38, 8, 8, '#7a6a52');
    R(ctx, x - 5, y - 40, 10, 3, '#9a8a70');
    R(ctx, x - 2, y - 35, 1.6, 2, '#2a2018');
    R(ctx, x + 1, y - 35, 1.6, 2, '#2a2018');
    // target mark
    R(ctx, x - 3, y - 26, 6, 1, type === 'combat' ? '#e05a5a' : '#d8c390');
    if (type === 'reinforcement') {
      ctx.globalAlpha = 0.4 + Math.sin(t * 4) * 0.15;
      R(ctx, x - 7, y - 30, 14, 12, '#7ec8ff');
      ctx.globalAlpha = 1;
    }
    if (type === 'combat') {
      R(ctx, x - 9, y - 34, 2, 2, '#e05a5a');
      R(ctx, x + 7, y - 34, 2, 2, '#e05a5a');
    }
    if (hurt > 0) {
      ctx.globalAlpha = hurt;
      R(ctx, x - 7, y - 30, 14, 13, '#ffffff');
      ctx.globalAlpha = 1;
    }
  },
  portal(ctx, x, y, t = 0, active = true) {
    const r = 26;
    ctx.save();
    ctx.translate(x, y - 22);
    ctx.globalAlpha = active ? 1 : 0.5;
    // rings
    for (let i = 0; i < 4; i++) {
      const rr = r * (0.55 + i * 0.15) + Math.sin(t * 2 + i) * 2;
      ctx.strokeStyle = `rgba(130,80,220,${0.25 + i * 0.08})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, rr, 0, TAU);
      ctx.stroke();
    }
    // cursed swirl
    for (let i = 0; i < 14; i++) {
      const a = t * 0.9 + (i / 14) * TAU;
      const rr = 20 + Math.sin(t * 3 + i) * 5;
      const px = Math.cos(a) * rr;
      const py = Math.sin(a) * rr * 0.9;
      ctx.fillStyle = i % 2 ? '#8f5cff' : '#c9a2ff';
      ctx.fillRect(Math.round(px), Math.round(py), 2, 2);
    }
    ctx.globalAlpha = 0.3 + Math.sin(t * 4) * 0.08;
    ctx.fillStyle = '#2a0a44';
    ctx.beginPath();
    ctx.ellipse(0, 0, 16, 20, 0, 0, TAU);
    ctx.fill();
    ctx.restore();
  },
  kogane(ctx, x, y, t = 0) {
    const bob = Math.sin(t * 2) * 2;
    ctx.save();
    ctx.translate(x, y - 14 + bob);
    R(ctx, -4, 0, 8, 10, '#c8b060');
    R(ctx, -4, 0, 8, 2, '#e8d080');
    R(ctx, -3, -3, 6, 4, '#c8b060');
    R(ctx, -2, -1.6, 1.6, 1.6, '#2a2010');
    R(ctx, 1, -1.6, 1.6, 1.6, '#2a2010');
    R(ctx, -7, 3, 3, 2, '#e8d080');
    R(ctx, 4, 3, 3, 2, '#e8d080');
    R(ctx, -7, -2, 3, 2, '#e8d080');
    R(ctx, 4, -2, 3, 2, '#e8d080');
    ctx.restore();
  },
  shrine(ctx, x, y, t = 0) {
    R(ctx, x - 26, y - 6, 52, 6, '#2a2228');
    R(ctx, x - 20, y - 40, 4, 34, '#6a2a2a');
    R(ctx, x + 16, y - 40, 4, 34, '#6a2a2a');
    R(ctx, x - 26, y - 44, 52, 5, '#8a3a3a');
    R(ctx, x - 16, y - 30, 32, 3, '#8a3a3a');
    for (let i = 0; i < 4; i++) {
      const flick = 0.6 + Math.sin(t * 4 + i * 1.7) * 0.3;
      ctx.globalAlpha = flick;
      R(ctx, x - 12 + i * 8, y - 24, 2, 7, '#ffb03a');
      R(ctx, x - 12 + i * 8, y - 22, 2, 3, '#ffe9a0');
      ctx.globalAlpha = 1;
    }
  },
};
