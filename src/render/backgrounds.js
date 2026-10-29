// ---------------------------------------------------------------------------
// backgrounds.js — cached pixel floors per theme, arena walls, hanging props,
// ambient motes and domain scenery.
// ---------------------------------------------------------------------------

import { clamp, rgba, TAU, mixColor } from '../core/util.js';
import { PROPS } from './sprites.js';

const THEMES = {
  hub: { floor: '#2b3340', floor2: '#313a4a', floor3: '#252c38', wall: '#151a24', grass: '#2e4a38', path: '#4a4438', sky: '#10151f' },
  training: { floor: '#3a3428', floor2: '#413a2c', floor3: '#332e24', wall: '#221e18', grass: '#3a4a30', path: '#5a5040', sky: '#12100c' },
  sewer: { floor: '#23262b', floor2: '#2a2e34', floor3: '#1d2025', wall: '#101216', water: '#1d3a44' },
  forest: { floor: '#232e22', floor2: '#2a3628', floor3: '#1d261d', wall: '#0f150f', water: '#22404a' },
  city: { floor: '#26242a', floor2: '#2d2a31', floor3: '#201e24', wall: '#111014', water: '#20303a' },
  shibuya: { floor: '#241c22', floor2: '#2c2028', floor3: '#1c161c', wall: '#0e0a0e', red: '#5a1a20' },
  colony: { floor: '#2a2a24', floor2: '#31312a', floor3: '#23231e', wall: '#131311' },
  shrine: { floor: '#1e1418', floor2: '#261a1f', floor3: '#170f12', wall: '#0b0608', red: '#6a1a20' },
  taming: { floor: '#1c1a28', floor2: '#232032', floor3: '#161425', wall: '#0c0a14' },
  void: { floor: '#141422', floor2: '#191a2c', floor3: '#101020', wall: '#080812' },
};

const floorCache = new Map();

function hash2(x, y) {
  let h = x * 374761393 + y * 668265263;
  h = (h ^ (h >> 13)) * 1274126177;
  return ((h ^ (h >> 16)) >>> 0) / 4294967296;
}

function getFloor(theme, w, h) {
  const key = `${theme}_${w}_${h}`;
  let c = floorCache.get(key);
  if (c) return c;
  c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d');
  const T = THEMES[theme] || THEMES.hub;
  g.fillStyle = T.floor;
  g.fillRect(0, 0, w, h);
  const tile = 16;
  for (let y = 0; y < h; y += tile) {
    for (let x = 0; x < w; x += tile) {
      const r = hash2(x, y);
      if (r > 0.6) {
        g.fillStyle = r > 0.85 ? T.floor2 : T.floor3;
        g.fillRect(x, y, tile, tile);
      }
      if (r > 0.94) {
        g.fillStyle = 'rgba(0,0,0,0.25)';
        g.fillRect(x + 3, y + 5, 6, 3);
      }
      // grid seams
      g.fillStyle = 'rgba(0,0,0,0.13)';
      g.fillRect(x, y, tile, 1);
      g.fillRect(x, y, 1, tile);
    }
  }
  // vignette / edge darkening
  const grad = g.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.25, w / 2, h / 2, Math.max(w, h) * 0.72);
  grad.addColorStop(0, 'rgba(0,0,0,0)');
  grad.addColorStop(1, 'rgba(0,0,0,0.55)');
  g.fillStyle = grad;
  g.fillRect(0, 0, w, h);
  floorCache.set(key, c);
  return c;
}

export function drawBackground(ctx, world, cam) {
  const theme = world.theme || 'hub';
  const arena = world.arena;
  const T = THEMES[theme] || THEMES.hub;
  ctx.fillStyle = T.sky || '#0a0a10';
  ctx.fillRect(0, 0, 640, 360);

  ctx.save();
  ctx.translate(Math.round(-cam.x), Math.round(-cam.y));

  // floor
  const floor = getFloor(theme, arena.w, arena.h);
  ctx.drawImage(floor, arena.x, arena.y);

  // arena border walls
  ctx.fillStyle = T.wall;
  ctx.fillRect(arena.x - 10, arena.y - 10, arena.w + 20, 12);
  ctx.fillRect(arena.x - 10, arena.y + arena.h, arena.w + 20, 24);
  ctx.fillRect(arena.x - 10, arena.y, 12, arena.h);
  ctx.fillRect(arena.x + arena.w - 2, arena.y, 12, arena.h);
  // wall highlights
  ctx.fillStyle = rgba('#ffffff', 0.05);
  ctx.fillRect(arena.x - 10, arena.y - 10, arena.w + 20, 2);

  drawDecor(ctx, world, theme);
  drawAmbient(ctx, world, theme);
  ctx.restore();
}

function drawDecor(ctx, world, theme) {
  const t = world.time;
  const decor = world.decor || [];
  for (const d of decor) {
    switch (d.type) {
      case 'tree':
        PROPS.tree(ctx, d.x, d.y, d.s || 1, t, d.leaf);
        break;
      case 'torii':
        PROPS.torii(ctx, d.x, d.y, d.s || 1, t);
        break;
      case 'lantern':
        PROPS.lantern(ctx, d.x, d.y, t);
        break;
      case 'building':
        PROPS.building(ctx, d.x, d.y, d.w || 80, d.h || 50, d.tint);
        break;
      case 'shrine':
        PROPS.shrine(ctx, d.x, d.y, t);
        break;
      case 'portal':
        PROPS.portal(ctx, d.x, d.y + 12, t, d.active !== false);
        break;
      case 'kogane':
        PROPS.kogane(ctx, d.x, d.y, t);
        break;
      case 'crates':
        ctx.fillStyle = '#5a4a32';
        ctx.fillRect(d.x, d.y - 12, 14, 12);
        ctx.fillStyle = '#6b5a3e';
        ctx.fillRect(d.x + 1, d.y - 11, 12, 4);
        ctx.fillStyle = '#4a3c28';
        ctx.fillRect(d.x + 3, d.y - 8, 8, 1);
        break;
      case 'pillar':
        ctx.fillStyle = '#3a3a44';
        ctx.fillRect(d.x, d.y - 46, 12, 46);
        ctx.fillStyle = '#4a4a56';
        ctx.fillRect(d.x + 1, d.y - 46, 4, 46);
        ctx.fillStyle = '#2a2a32';
        ctx.fillRect(d.x - 2, d.y - 48, 16, 4);
        break;
      case 'sign':
        ctx.fillStyle = '#4a3a28';
        ctx.fillRect(d.x, d.y - 26, 3, 26);
        ctx.fillStyle = '#d8c390';
        ctx.fillRect(d.x - 12, d.y - 34, 27, 12);
        ctx.fillStyle = '#2a2018';
        ctx.font = '6px "Courier New", monospace';
        ctx.textAlign = 'center';
        ctx.fillText(d.text || '', d.x + 1, d.y - 25);
        ctx.textAlign = 'left';
        break;
      case 'banner':
        ctx.fillStyle = d.color || '#7a2222';
        ctx.fillRect(d.x, d.y - 34, 8, 34);
        ctx.fillStyle = '#e8dcc0';
        ctx.fillRect(d.x + 2, d.y - 30, 4, 20);
        break;
      case 'rim':
        ctx.fillStyle = d.color || '#3a2a5a';
        ctx.fillRect(d.x, d.y, d.w || 40, d.h || 4);
        break;
      default:
        break;
    }
  }
}

function drawAmbient(ctx, world, theme) {
  const t = world.time;
  const n = 26;
  for (let i = 0; i < n; i++) {
    const seed = i * 97.13;
    const x = world.arena.x + ((seed * 13 + t * (8 + (i % 5) * 3)) % world.arena.w);
    const y = world.arena.y + ((seed * 29 + Math.sin(t * 0.5 + i) * 16 + t * 5) % world.arena.h);
    const a = 0.1 + Math.sin(t * 1.4 + i) * 0.07;
    ctx.globalAlpha = Math.max(0, a);
    ctx.fillStyle = theme === 'shibuya' || theme === 'shrine' ? '#ffb0a0' : '#9fd8ff';
    ctx.fillRect(Math.round(x), Math.round(y), 1, 1);
  }
  ctx.globalAlpha = 1;
  if (theme === 'shibuya') {
    ctx.globalAlpha = 0.07 + Math.sin(t) * 0.02;
    ctx.fillStyle = '#ff2a3a';
    ctx.fillRect(world.arena.x, world.arena.y, world.arena.w, world.arena.h);
    ctx.globalAlpha = 1;
  }
}

// ---------------------------------------------------------------------------
// Domain scenery
// ---------------------------------------------------------------------------
export function drawDomainScenery(ctx, id, t, cam) {
  ctx.save();
  ctx.translate(-cam.x, -cam.y);
  if (id === 'malevolent_shrine') {
    ctx.globalAlpha = 0.5;
    for (let i = 0; i < 40; i++) {
      const x = (i * 73) % 640;
      const y = (i * 41 + Math.sin(t + i) * 6) % 320 + 20;
      ctx.fillStyle = i % 3 ? '#2a0a10' : '#6a1a20';
      ctx.fillRect(x, y, 2 + (i % 4), 2);
    }
    // shrine silhouette
    ctx.globalAlpha = 0.75;
    ctx.fillStyle = '#1a0508';
    for (let i = 0; i < 4; i++) {
      const x = 60 + i * 160;
      ctx.fillRect(x, 40, 10, 120);
      ctx.fillRect(x - 14, 34, 38, 10);
      ctx.fillRect(x + 2, 90, 26, 6);
    }
    ctx.globalAlpha = 0.6;
    ctx.fillStyle = '#ff2a3a';
    for (let i = 0; i < 8; i++) {
      const x = (i * 89 + t * 40) % 660;
      const y = 60 + ((i * 53 + t * 19) % 240);
      ctx.fillRect(x, y, 46, 1);
    }
  } else if (id === 'incomplete_shrine') {
    ctx.globalAlpha = 0.55;
    ctx.fillStyle = '#12060a';
    ctx.fillRect(cam.x, cam.y, 640, 360);
    for (let i = 0; i < 34; i++) {
      const x = (i * 67 + Math.sin(t + i) * 8) % 660;
      const y = 40 + ((i * 43) % 290);
      ctx.globalAlpha = 0.16 + (i % 4) * 0.07;
      ctx.fillStyle = i % 3 ? '#3a0a14' : '#c0273a';
      ctx.fillRect(x, y, 2 + (i % 3), 2);
    }
    ctx.globalAlpha = 0.5;
    ctx.strokeStyle = '#c0273a';
    ctx.lineWidth = 1;
    for (let i = 0; i < 5; i++) {
      ctx.beginPath();
      ctx.arc(320, 180, 36 + i * 30 + Math.sin(t * 1.6 + i) * 4, 0, TAU);
      ctx.stroke();
    }
    ctx.globalAlpha = 0.75;
    ctx.fillStyle = '#1a0508';
    ctx.fillRect(296, 58, 48, 10);
    ctx.fillRect(306, 68, 6, 42);
    ctx.fillRect(328, 68, 6, 42);
  } else if (id === 'unlimited_void') {
    ctx.globalAlpha = 0.8;
    ctx.fillStyle = '#05060f';
    ctx.fillRect(cam.x, cam.y, 640, 360);
    for (let i = 0; i < 70; i++) {
      const a = i * 1.7 + t * 0.4;
      const r = 20 + (i % 9) * 26;
      const x = 320 + Math.cos(a) * r * 1.5;
      const y = 180 + Math.sin(a * 1.2) * r;
      ctx.globalAlpha = 0.25 + (i % 5) * 0.1;
      ctx.fillStyle = i % 3 === 0 ? '#9fd8ff' : '#4a7bff';
      ctx.fillRect(x, y, 2, 2);
    }
    ctx.globalAlpha = 0.25;
    ctx.strokeStyle = '#9fd8ff';
    ctx.lineWidth = 1;
    for (let i = 0; i < 5; i++) {
      ctx.beginPath();
      ctx.arc(320, 180, 40 + i * 34 + Math.sin(t * 2 + i) * 6, 0, TAU);
      ctx.stroke();
    }
  } else if (id === 'chimera_shadow_garden' || id === 'chimera_garden') {
    ctx.globalAlpha = 0.55;
    ctx.fillStyle = '#0a0818';
    ctx.fillRect(cam.x, cam.y, 640, 360);
    for (let i = 0; i < 26; i++) {
      const x = (i * 61 + t * 22) % 660;
      const y = 60 + ((i * 43) % 280);
      ctx.globalAlpha = 0.12 + (i % 4) * 0.05;
      ctx.fillStyle = '#3b2a8a';
      ctx.fillRect(x, y, 26, 18 + Math.sin(t + i) * 5);
    }
    // wolves silhouettes
    ctx.globalAlpha = 0.35;
    ctx.fillStyle = '#0c0820';
    for (let i = 0; i < 5; i++) {
      const x = 60 + i * 130 + Math.sin(t * 0.7 + i) * 20;
      const y = 80 + (i % 2) * 200;
      ctx.fillRect(x, y, 22, 10);
      ctx.fillRect(x + 18, y - 6, 8, 8);
      ctx.fillRect(x + 2, y + 10, 4, 8);
      ctx.fillRect(x + 14, y + 10, 4, 8);
    }
  } else if (id === 'self_embodiment') {
    ctx.globalAlpha = 0.35;
    ctx.fillStyle = '#0d1a2a';
    ctx.fillRect(cam.x, cam.y, 640, 360);
    for (let i = 0; i < 40; i++) {
      const x = (i * 71 + t * 15) % 640;
      const y = (i * 37 + Math.sin(t * 0.8 + i) * 20) % 340;
      ctx.globalAlpha = 0.2 + (i % 3) * 0.1;
      ctx.fillStyle = '#6fd0ff';
      ctx.fillRect(x, y, 1 + (i % 3), 8 + (i % 6));
    }
  } else if (id === 'iron_mountain') {
    ctx.globalAlpha = 0.4;
    ctx.fillStyle = '#2a0a04';
    ctx.fillRect(cam.x, cam.y, 640, 360);
    ctx.fillStyle = '#ff5a1a';
    for (let i = 0; i < 30; i++) {
      const x = (i * 83 + t * 12) % 660;
      const y = 200 + ((i * 47) % 160);
      ctx.globalAlpha = 0.15 + Math.sin(t * 3 + i) * 0.06;
      ctx.fillRect(x, y, 12, 2);
    }
  }
  ctx.restore();
  ctx.globalAlpha = 1;
}
