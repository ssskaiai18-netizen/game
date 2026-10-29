// ---------------------------------------------------------------------------
// main.js — bootstraps the engine, save data, audio and every scene.
// ---------------------------------------------------------------------------

import { Engine } from './core/engine.js';
import { input } from './core/input.js';
import { audio } from './core/audio.js';
import { saveSystem } from './core/save.js';
import { Toasts } from './ui/ui.js';
import { PauseOverlay } from './ui/hud.js';
import { TitleScene } from './scenes/title.js';
import { CharSelectScene } from './scenes/charSelect.js';
import { HubScene } from './scenes/hub.js';
import { DungeonScene } from './scenes/dungeon.js';
import { TameScene } from './scenes/tame.js';
import { SparScene } from './scenes/spar.js';
import { SummaryScene } from './scenes/summary.js';

const canvas = document.getElementById('game');

const game = {
  engine: null,
  save: saveSystem,
  audio,
  input,
  toasts: new Toasts(),
  selectedChar: 'yuji',
  forceTouch: false,
  debug: false,
  started: false,
  lastTouchAt: 0,
  toast(msg, opts) {
    this.toasts.push(msg, opts);
  },
  toggleFullscreen() {
    const el = document.documentElement;
    const isFs = document.fullscreenElement || document.webkitFullscreenElement;
    if (!isFs) {
      const p = el.requestFullscreen?.({ navigationUI: 'hide' }) || el.webkitRequestFullscreen?.();
      if (p && p.then) {
        p.then(() => {
          try {
            screen.orientation?.lock?.('landscape').catch(() => {});
          } catch (e) {
            /* not supported */
          }
        }).catch(() => {});
      }
      audio.init();
    } else {
      document.exitFullscreen?.() || document.webkitExitFullscreen?.();
    }
  },
  onSceneChanged(name) {
    this.sceneName = name;
    input.setButtons([]);
  },
};

saveSystem.load();
audio.setMuted(!saveSystem.data.settings.audio);
if (saveSystem.data.sorcerer) game.selectedChar = saveSystem.data.sorcerer.technique;

const engine = new Engine(canvas, game);
game.engine = engine;
engine.debug = false;

engine.register('title', (g) => new TitleScene(g));
engine.register('charSelect', (g, p) => new CharSelectScene(g, p));
engine.register('hub', (g, p) => new HubScene(g, p));
engine.register('dungeon', (g, p) => new DungeonScene(g, p));
engine.register('tame', (g, p) => new TameScene(g, p));
engine.register('spar', (g, p) => new SparScene(g, p));
engine.register('summary', (g, p) => new SummaryScene(g, p));

engine.pauseOverlay = new PauseOverlay(game, engine);

// global input hooks -------------------------------------------------------
const startAudio = () => {
  audio.init();
  if (saveSystem.data.settings.audio) audio.setMuted(false);
};
window.addEventListener('pointerdown', startAudio, { once: true });
window.addEventListener('keydown', startAudio, { once: true });
window.addEventListener('touchstart', () => (game.forceTouch = true), { once: true, passive: true });

window.addEventListener('keydown', (e) => {
  if (e.code === 'F3') {
    game.debug = !game.debug;
    engine.debug = game.debug;
    e.preventDefault();
  }
  if (e.code === 'F11') return; // let the browser handle it
});

// Auto-detect touch devices so the virtual controls show immediately.
if (typeof navigator !== 'undefined' && /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent)) {
  game.forceTouch = true;
  input.usedTouch = true;
}

// Portrait warning handled in HTML/CSS.
function checkOrientation() {
  const portrait = window.innerHeight > window.innerWidth;
  const warn = document.getElementById('rotate-hint');
  if (warn) warn.style.display = portrait && game.forceTouch ? 'flex' : 'none';
}
window.addEventListener('resize', checkOrientation);
checkOrientation();

// Pause the game when the tab is hidden so timers do not dump frames on return.
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    if (engine.paused === false && engine.scene?.canPause !== false) engine.paused = true;
  }
});

engine.setScene('title');
engine.startLoop();
game.started = true;

// Expose for debugging / integration tests.
window.__JJK = { game, engine, input, save: saveSystem, audio };

// Toast renderer overlay is drawn by scenes that need it; keep a tiny global
// render tick for the toasts on top of everything.
const origRender = engine.render.bind(engine);
engine.render = function patchedRender(...args) {
  origRender(...args);
  game.toasts.draw(this.ctx);
};
