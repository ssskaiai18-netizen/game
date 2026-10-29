// Headless smoke test: runs the real game modules inside jsdom with a mock 2D
// context, drives input across every scene and reports runtime errors.
//
//   node tools/smoke.mjs
//
// This is a development tool, not part of the shipped game.

import { JSDOM } from 'jsdom';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const html = fs
  .readFileSync(path.join(root, 'index.html'), 'utf8')
  .replace(/<script[^>]*type="module"[^>]*><\/script>/g, '')
  .replace(/<script>[\s\S]*?<\/script>/g, '');

const dom = new JSDOM(html, {
  url: 'http://localhost/',
  pretendToBeVisual: false,
  runScripts: 'outside-only',
});
const { window } = dom;

// ---- mock canvas 2D context ------------------------------------------------
function makeGradient() {
  return { addColorStop() {} };
}
const ctxState = () => ({ globalAlpha: 1, fillStyle: '#000', strokeStyle: '#000', lineWidth: 1, font: '8px monospace', textAlign: 'left', textBaseline: 'alphabetic', globalCompositeOperation: 'source-over', imageSmoothingEnabled: false, lineCap: 'butt' });
function makeCtx(canvas) {
  const state = ctxState();
  const noop = () => {};
  const handler = {
    get(target, prop) {
      if (prop in target) return target[prop];
      if (prop === 'canvas') return canvas;
      if (prop === 'measureText') return (t) => ({ width: String(t).length * 5.5 });
      if (prop === 'createLinearGradient' || prop === 'createRadialGradient' || prop === 'createPattern') return () => makeGradient();
      if (prop === 'getImageData') return (x, y, w, h) => ({ data: new Uint8ClampedArray(w * h * 4), width: w, height: h });
      if (prop === 'putImageData' || prop === 'drawImage' || prop === 'save' || prop === 'restore' || prop === 'translate' || prop === 'rotate' || prop === 'scale' || prop === 'setTransform' || prop === 'clip' || prop === 'rect' || prop === 'beginPath' || prop === 'closePath' || prop === 'arc' || prop === 'ellipse' || prop === 'moveTo' || prop === 'lineTo' || prop === 'stroke' || prop === 'fill' || prop === 'fillRect' || prop === 'strokeRect' || prop === 'clearRect' || prop === 'fillText' || prop === 'strokeText' || prop === 'setLineDash' || prop === 'quadraticCurveTo' || prop === 'bezierCurveTo') return noop;
      if (prop === 'width' || prop === 'height') return canvas[prop];
      return target[prop];
    },
    set(target, prop, value) {
      target[prop] = value;
      return true;
    },
  };
  return new Proxy(state, handler);
}

let selCount = 0;
class FakeCanvas {
  constructor(w = 300, h = 150) {
    this.width = w;
    this.height = h;
    this.style = {};
    this.id = 'fake' + selCount++;
  }
  getContext() {
    if (!this._ctx) this._ctx = makeCtx(this);
    return this._ctx;
  }
  getBoundingClientRect() {
    const w = 640 * ((window.innerWidth || 1024) / 640);
    return { left: 0, top: 0, width: w, height: w * (360 / 640), right: w, bottom: w, x: 0, y: 0 };
  }
  addEventListener(t, fn) {
    (this._h = this._h || {})[t] = (this._h[t] || []).concat(fn);
  }
  removeEventListener() {}
  setPointerCapture() {}
  releasePointerCapture() {}
  dispatch(t, ev) {
    (this._h?.[t] || []).forEach((f) => f(ev));
  }
}

const gameCanvas = new FakeCanvas(640, 360);
window.document.getElementById('game').getContext = () => gameCanvas.getContext();
window.document.getElementById('game').getBoundingClientRect = () => gameCanvas.getBoundingClientRect();
window.HTMLCanvasElement.prototype.getContext = function () {
  if (!this._ctx) this._ctx = makeCtx(this);
  return this._ctx;
};
window.HTMLCanvasElement.prototype.getBoundingClientRect = function () {
  return this.id === 'game' ? gameCanvas.getBoundingClientRect() : { left: 0, top: 0, width: this.width, height: this.height, right: this.width, bottom: this.height, x: 0, y: 0 };
};
window.document.createElement = ((orig) => function (tag, ...rest) {
  if (String(tag).toLowerCase() === 'canvas') {
    const c = new FakeCanvas();
    return c;
  }
  return orig.call(window.document, tag, ...rest);
})(window.document.createElement.bind(window.document));

// ---- globals ---------------------------------------------------------------
const rafQueue = [];
let vtime = 0;
globalThis.window = window;
globalThis.document = window.document;
try { Object.defineProperty(globalThis, 'navigator', { value: window.navigator, configurable: true }); } catch (e) {}
globalThis.HTMLCanvasElement = window.HTMLCanvasElement;
globalThis.KeyboardEvent = window.KeyboardEvent;
globalThis.localStorage = window.localStorage;
globalThis.screen = { orientation: { lock: () => Promise.resolve() } };
globalThis.devicePixelRatio = 1;
globalThis.requestAnimationFrame = (cb) => {
  rafQueue.push(cb);
  return rafQueue.length;
};
globalThis.cancelAnimationFrame = () => {};
window.requestAnimationFrame = globalThis.requestAnimationFrame;
window.innerWidth = 1024;
window.innerHeight = 600;

const errors = [];
const origError = console.error;
console.error = (...args) => {
  errors.push(args.map(String).join(' '));
  origError('[captured]', ...args);
};
window.addEventListener('error', (e) => errors.push('window error: ' + e.message));

function step(frames = 1, dt = 16.7) {
  for (let i = 0; i < frames; i++) {
    vtime += dt;
    const q = rafQueue.splice(0, rafQueue.length);
    for (const cb of q) {
      try {
        cb(vtime);
      } catch (e) {
        errors.push('raf error: ' + (e && e.stack ? e.stack : e));
      }
    }
  }
}

function key(code, down = true) {
  const ev = new window.KeyboardEvent(down ? 'keydown' : 'keyup', { code, key: code, bubbles: true });
  window.dispatchEvent(ev);
}
function tap(x, y) {
  const g = window.document.getElementById('game');
  g.dispatch('pointerdown', { pointerId: 1, pointerType: 'mouse', clientX: x * (window.innerWidth / 640), clientY: y * (window.innerWidth / 640), preventDefault() {}, button: 0 });
  g.dispatch('pointerup', { pointerId: 1, pointerType: 'mouse', clientX: x, clientY: y, preventDefault() {} });
}

// ---- boot ------------------------------------------------------------------
await import(path.join(root, 'src/main.js'));
const jjk = window.__JJK;
const { game, engine, input } = jjk;
console.log('[smoke] booted, scene =', engine.sceneName);

step(30);
key('KeyJ');
key('KeyJ', false);
step(10);
console.log('[smoke] title menu index', engine.scene?.menu?.index);

// Go to hub directly
engine.setScene('hub', { fresh: true });
step(20);
console.log('[smoke] hub scene:', engine.sceneName, 'actors', engine.scene.world.actors.length);
// walk around
key('KeyD');
step(40);
key('KeyD', false);
key('KeyW');
step(20);
key('KeyW', false);
// attack a dummy: move to training area first
const hub = engine.scene;
hub.player.x = 190;
hub.player.y = 400;
step(5);
key('KeyJ');
step(2);
key('KeyJ', false);
step(30);
key('Digit1');
step(20);
key('ShiftLeft');
step(5);
key('ShiftLeft', false);
step(10);
console.log('[smoke] training stats:', JSON.stringify(engine.scene.world.stats).slice(0, 160));

// talk to Megumi (open/close overlay)
hub.openMegumi();
step(5);
key('Escape');
step(3);
hub.closeOverlay();
step(3);

// portal prep
hub.openPortal();
step(5);
key('Escape');
step(3);
hub.closeOverlay();

// dungeon
engine.setScene('dungeon', { arcIndex: 0, difficultyId: 'normal', charId: 'yuji', seed: 12345 });
step(20);
const d = engine.scene;
console.log('[smoke] dungeon enemies:', d.world.enemies.length, 'state', d.state);
// fight for a while with input
for (let i = 0; i < 260; i++) {
  if (i % 17 === 0) { key('KeyJ'); }
  if (i % 17 === 3) { key('KeyJ', false); }
  if (i % 41 === 0) { key('Digit1'); }
  if (i % 53 === 0) { key('Digit2'); }
  if (i % 67 === 0) { key('ShiftLeft'); key('ShiftLeft', false); }
  if (i % 71 === 0) { key('KeyD'); }
  if (i % 71 === 20) { key('KeyD', false); }
  step(1);
}
console.log('[smoke] after combat: state', d.state, 'stats', JSON.stringify(d.world.stats).slice(0, 200));
// force-clear room
for (const e of d.world.enemies.slice()) d.world.kill(e, { source: d.player });
step(80);
console.log('[smoke] state after clear:', d.state, 'reward choices', d.rewardChoices.length);
key('Enter');
step(30);
console.log('[smoke] state after reward pick:', d.state, 'upgrades', d.run.upgrades.length);

// domain + ultimate test on next room
if (d.state === 'map') {
  key('Enter');
  step(30);
}
console.log('[smoke] next room state', d.state, 'enemies', d.world.enemies.length);
d.player.ultMeter = 100;
key('KeyR');
step(30);
key('KeyF');
step(40);
console.log('[smoke] ult/domain used:', d.world.stats.ults, d.world.stats.domains);

// Megumi summons + tame scene
engine.setScene('tame', { shikigami: 'nue', charId: 'megumi' });
step(20);
console.log('[smoke] tame state', engine.scene.state, 'boss', !!engine.scene.boss);
key('KeyJ');
step(5);
key('KeyJ', false);
step(60);
for (const e of engine.scene.world.enemies.slice()) engine.scene.world.kill(e, { source: engine.scene.player });
step(40);
console.log('[smoke] tame result:', engine.scene.result, 'unlocked', jjk.save.hasShikigami('nue'));

// spar
engine.setScene('spar', { opponent: 'yuji', charId: 'yuji', skill: 0.55 });
step(120);
console.log('[smoke] spar state', engine.scene.state, 'npc hp', Math.round(engine.scene.npc.hp));
for (const e of [engine.scene.npc]) engine.scene.world.kill(e, { source: engine.scene.player });
step(60);
console.log('[smoke] spar result', engine.scene.result);

// summary
engine.setScene('summary', { summary: { victory: true, charId: 'yuji', charName: 'Yuji', arcName: 'Fearsome Womb', arcIndex: 0, difficultyId: 'normal', difficulty: 'Normal', rooms: 4, totalRooms: 6, kills: 12, bosses: 1, damage: 3400, highestHit: 90, bfSuccess: 2, bfAttempts: 5, techniques: 12, ults: 1, domains: 0, summons: 0, upgrades: ['A'], tribute: 40, score: 5000, unlocks: ['Nobara Kugisaki'] } });
step(20);

// all characters in dungeon (short)
for (const id of ['yuji', 'megumi', 'nobara', 'gojo', 'sukuna']) {
  jjk.save.unlockCharacter(id);
  engine.setScene('dungeon', { arcIndex: 2, difficultyId: 'normal', charId: id, seed: 99 });
  step(15);
  const sc = engine.scene;
  sc.player.ultMeter = 100;
  key('KeyR');
  step(10);
  key('KeyF');
  step(10);
  for (let i = 0; i < 120; i++) {
    if (i % 13 === 0) key('KeyJ');
    if (i % 13 === 3) key('KeyJ', false);
    if (i % 29 === 0) key('Digit3');
    if (i % 31 === 0) key('Digit4');
    if (i % 37 === 0) { key('KeyC'); }
    step(1);
  }
  console.log('[smoke] char', id, 'ok', 'enemies alive', sc.world.enemies.filter((e) => !e.dead).length);
}

// extended runtime with everything
step(200);
console.log('[smoke] errors:', errors.length);
if (errors.length) {
  console.log(errors.slice(0, 12).join('\n---\n'));
  process.exitCode = 1;
} else {
  console.log('[smoke] PASS');
}
