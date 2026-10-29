// Balance probe: drives a scripted "decent player" bot through arena fights and
// reports kill speed / damage taken per character and arc. Dev tool only.
//
//   node tools/balance.mjs [arc]

import { World } from '../src/game/world.js';
import { Player } from '../src/game/player.js';
import { input } from '../src/core/input.js';
import { SaveSystem, defaultSave } from '../src/core/save.js';
import { CHARACTERS } from '../src/data/characters.js';
import { defaultMods } from '../src/data/upgrades.js';
import { ARCS, DIFFICULTIES } from '../src/data/story.js';
import { enemyPoolForArc, BOSSES, ENEMIES } from '../src/data/enemies.js';
import { Rng } from '../src/core/util.js';

const arcArg = process.argv[2] ? Number(process.argv[2]) : 0;
const arc = ARCS[arcArg];
const diff = DIFFICULTIES.normal;

function press(action) {
  input.virtualPressed.add(action);
  input.virtualDown.add(action);
}
function release(action) {
  input.virtualDown.delete(action);
}

function runFight(charId, seed, seconds, opts = {}) {
  const save = new SaveSystem(null);
  save.data = defaultSave();
  save.data.unlocks.blackSparks = true;
  save.data.unlocks.shikigami.mahoraga = true;
  save.data.unlocks.shikigami.agito = true;
  // unlock all characters for measurement
  save.data.unlocks.characters = Object.keys(CHARACTERS);
  const game = { audio: { play() {} }, save, toasts: { push() {} } };
  const world = new World(game, { arena: { x: 0, y: 0, w: 640, h: 360 }, theme: arc.theme, seed, scene: null });
  const mods = defaultMods();
  mods.hpMult = 1;
  const player = new Player(world, { charId, save, mods, x: 200, y: 180 });
  player.controller = player;
  world.player = player;
  world.addActor(player);
  world.scene = {
    run: { arcIndex: arcArg, difficultyId: 'normal', arc, diff },
    onBossPhase() {},
    onBossDomain() {},
    onBossLine() {},
    onDomainStart() {},
    onDomainEnd() {},
    onUltimateSummon() {},
    onSummonDefeated() {},
    onTotality() {},
  };

  const rng = new Rng(seed);
  const pool = opts.boss ? null : enemyPoolForArc(arcArg);
  const count = opts.count || 3;
  const spawned = [];
  for (let i = 0; i < count; i++) {
    const def = opts.boss ? BOSSES[opts.boss] : ENEMIES[pool[i % pool.length]];
    const ang = (i / count) * Math.PI * 2;
    const e = world.spawnEnemy(def, 200 + Math.cos(ang) * (opts.dist || 120), 180 + Math.sin(ang) * (opts.dist || 120), {
      hpMult: diff.hpMult,
      dmgMult: diff.dmgMult,
      brain: opts.boss ? 'boss' : 'enemy',
    });
    if (opts.boss) e.introT = 0;
    spawned.push(e);
  }

  let t = 0;
  let attackCd = 0;
  let abilityCd = 0;
  let dodgeCd = 0;
  const dt = 1 / 60;
  let died = false;
  const totalEnemyHp = spawned.reduce((a, e) => a + e.maxHp, 0);
  while (t < seconds) {
    const alive = world.enemies.filter((e) => !e.dead);
    // --- bot decision ------------------------------------------------------
    let target = null;
    let best = Infinity;
    for (const e of alive) {
      const d = Math.hypot(e.x - player.x, e.y - player.y);
      if (d < best) { best = d; target = e; }
    }
    for (const k of ['up', 'down', 'left', 'right']) release(k);
    if (target) {
      const dx = target.x - player.x;
      const dy = target.y - player.y;
      const want = 24;
      if (best > want) {
        if (Math.abs(dx) > 6) press(dx > 0 ? 'right' : 'left');
        if (Math.abs(dy) > 6) press(dy > 0 ? 'down' : 'up');
      }
      if (best < 34 && attackCd <= 0) {
        press('attack');
        attackCd = 0.22;
      }
      if (abilityCd <= 0 && player.ce > 30) {
        press('a1');
        abilityCd = 1.4;
      }
      // dodge incoming telegraphed attacks
      const threat = world.enemies.find((e) => !e.dead && e.phase === 'startup' && Math.hypot(e.x - player.x, e.y - player.y) < 55 && e.phaseT / Math.max(0.01, e.startupDur) > 0.5);
      if (threat && dodgeCd <= 0) {
        press('dodge');
        dodgeCd = 1.0;
      }
    }
    if (player.ultMeter >= 100) press('ult');
    else if (player.ultMeter >= 60 && charId === 'megumi') press('ult');
    if (player.domainAbility && (player.domainGauge >= 100 || player.domainCd <= 0) && world.enemies.length > 0) press('domain');
    if (player.hp / player.maxHp < 0.45 && player.ce > 40 && player.reinforceT <= 0) press('reinforce');

    world.update(dt);
    input.endFrame();
    t += dt;
    attackCd -= dt;
    abilityCd -= dt;
    dodgeCd -= dt;
    if (player.dead) { died = true; break; }
    if (world.enemies.every((e) => e.dead)) break;
    // top up ce/ult a little like pickups would, to keep the loop representative
    player.ce = Math.min(player.maxCe, player.ce + 0.6 * dt);
  }

  const enemiesLeftHp = world.enemies.reduce((a, e) => a + Math.max(0, e.hp), 0);
  const cleared = world.enemies.every((e) => e.dead);
  return {
    charId,
    t: t.toFixed(1),
    cleared,
    died,
    hpPct: Math.round((player.hp / player.maxHp) * 100),
    dps: Math.round((totalEnemyHp - enemiesLeftHp) / t),
    hits: world.stats.hits,
    maxHit: Math.round(world.stats.highestHit),
    taken: Math.round(world.stats.damageTaken),
    bf: `${world.stats.bfSuccess}/${world.stats.bfAttempts}`,
    enemyHp: totalEnemyHp,
  };
}

const rows = [];
for (const charId of Object.keys(CHARACTERS)) {
  rows.push(runFight(charId, 7, 45));
}
console.log(`arc ${arcArg} (${arc.name}) · normal · 3 enemies`);
console.table(rows);

const bossId = arc.boss;
if (bossId && BOSSES[bossId]) {
  const bossRows = [];
  for (const charId of ['yuji', 'gojo', 'sukuna', 'megumi', 'nobara']) {
    bossRows.push(runFight(charId, 11, 90, { boss: bossId, count: 1, dist: 110 }));
  }
  console.log(`boss ${bossId}`);
  console.table(bossRows);
}
