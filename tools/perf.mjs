// Performance probe: measures logic+draw cost per frame with a mocked 2D ctx.
// Not a substitute for a real browser, but catches runaway per-frame work.
//
//   node tools/perf.mjs

import { World } from '../src/game/world.js';
import { Player } from '../src/game/player.js';
import { input } from '../src/core/input.js';
import { SaveSystem, defaultSave } from '../src/core/save.js';
import { defaultMods } from '../src/data/upgrades.js';
import { ENEMIES } from '../src/data/enemies.js';

const noop = () => {};
const ctx = new Proxy(
  { canvas: { width: 640, height: 360 } },
  {
    get(t, p) {
      if (p in t) return t[p];
      if (p === 'canvas') return t.canvas;
      if (p === 'measureText') return (s) => ({ width: String(s).length * 5 });
      if (p === 'createLinearGradient' || p === 'createRadialGradient' || p === 'createPattern')
        return () => ({ addColorStop: noop });
      if (p === 'getImageData') return (x, y, w, h) => ({ data: new Uint8ClampedArray(4 * w * h), width: w, height: h });
      return noop;
    },
    set(t, p, v) {
      t[p] = v;
      return true;
    },
  }
);

// backgrounds.js creates real <canvas> elements for floor caching
globalThis.document = {
  createElement() {
    return { width: 0, height: 0, getContext: () => ctx };
  },
};

const save = new SaveSystem(null);
save.data = defaultSave();
const game = { audio: { play: noop }, save, toasts: { push: noop } };
const world = new World(game, { arena: { x: 0, y: 0, w: 640, h: 360 }, theme: 'shrine', seed: 5 });
const p = new Player(world, { charId: 'sukuna', save, mods: defaultMods(), x: 320, y: 180 });
p.controller = p;
world.player = p;
world.addActor(p);
world.scene = { run: { arcIndex: 6 }, showBanner: noop };

for (let i = 0; i < 8; i++) {
  const e = world.spawnEnemy(ENEMIES.curseBrute, 120 + i * 50, 120 + (i % 3) * 60, { hpMult: 6 });
  e.aiTimer = Math.random();
}

let worst = 0;
let total = 0;
const frames = 900;
for (let f = 0; f < frames; f++) {
  p.ce = p.maxCe;
  if (f % 30 === 0) { input.virtualPressed.add('attack'); input.virtualDown.add('attack'); }
  if (f % 90 === 0) { input.virtualPressed.add('a2'); input.virtualDown.add('a2'); }
  if (f % 150 === 0) { input.virtualPressed.add('a3'); }
  const t0 = performance.now();
  world.update(1 / 60);
  world.draw(ctx);
  world.fx?.draw?.(ctx, world.camera);
  const dt = performance.now() - t0;
  worst = Math.max(worst, dt);
  total += dt;
  input.endFrame();
}
console.log({
  frames,
  avgMs: +(total / frames).toFixed(3),
  worstMs: +worst.toFixed(2),
  actors: world.actors.length,
  particles: world.fx.particles.length,
  projectiles: world.projectiles.length,
  hitboxes: world.hitboxes.length,
  zombies: world.actors.filter((a) => a.dead).length,
});
if (total / frames > 6) {
  console.log('WARN: average frame cost above budget');
  process.exitCode = 1;
}
