// Kit coverage: every ability of every playable character must actually do
// something measurable (damage, buff, summon, mark, heal, mobility...).
//
//   node tools/kits.mjs

import { World } from '../src/game/world.js';
import { Player } from '../src/game/player.js';
import { input } from '../src/core/input.js';
import { SaveSystem, defaultSave } from '../src/core/save.js';
import { CHARACTERS } from '../src/data/characters.js';
import { defaultMods } from '../src/data/upgrades.js';
import { castAbility } from '../src/game/combat.js';

function makeWorld(charId) {
  const save = new SaveSystem(null);
  save.data = defaultSave();
  save.data.unlocks.characters = Object.keys(CHARACTERS);
  save.data.unlocks.domains = Object.keys(CHARACTERS);
  save.data.unlocks.shikigami = Object.fromEntries(
    Object.keys(save.data.unlocks.shikigami).map((k) => [k, true])
  );
  const game = { audio: { play() {} }, save, toasts: { push() {} } };
  const world = new World(game, { arena: { x: 0, y: 0, w: 640, h: 360 }, theme: 'shrine', seed: 3 });
  world.scene = { run: { arcIndex: 0 } };
  const p = new Player(world, { charId, save, mods: defaultMods(), x: 300, y: 180 });
  p.controller = p;
  world.player = p;
  world.addActor(p);
  return { world, p, save };
}

function dummy(world, x = 322, y = 180) {
  const e = world.spawnEnemy('curseBrute', x, y, { hpMult: 8 });
  e.speed = 0;
  e.brain = 'none';
  e.aiTimer = 999;
  e.thinkTimer = 999;
  return e;
}

let pass = 0;
let fail = 0;
const problems = [];
function ok(cond, msg) {
  if (cond) pass++;
  else {
    fail++;
    problems.push(msg);
  }
}

for (const charId of Object.keys(CHARACTERS)) {
  const def = CHARACTERS[charId];
  const list = [
    ...def.basic.map((a, i) => ['basic' + i, a]),
    ...def.abilities.map((a, i) => ['a' + (i + 1), a]),
  ];
  if (def.ultimate) list.push(['ultimate', def.ultimate]);
  if (def.domain) list.push(['domain', def.domain]);

  for (const [slot, ab] of list) {
    const { world, p } = makeWorld(charId);
    p.maxCe = p.ce = 9999;
    p.maxUlt = 100;
    p.ultMeter = 100;
    p.aimAngle = 0;
    p.aimPoint = { x: 400, y: 180 };
    const target = dummy(world, 322, 180);
    const before = {
      hp: target.hp,
      php: p.hp,
      phpMax: p.maxHp,
      ce: p.ce,
      summons: world.summons.length,
      domain: !!world.domain,
      stun: target.stunT,
      buffs: JSON.stringify(p.buffs || {}),
      marks: Object.keys(target.marks || {}).length,
      moves: p.bufferedMove ? 1 : 0,
      x: p.x,
    };
    for (let i = 0; i < 50; i++) world.update(1 / 60); // clear spawn i-frames
    const hp0 = target.hp;
    const startX = p.x;
    const beforeStun = target.stunT;
    const beforeUlt = p.ultMeter;
    // summons / commands need a body to command
    if (ab.type === 'command' || ab.type === 'summonAdds' || ab.id === 'mCommand') {
      world.summonShikigami(p, p.summonOptions?.[0] || 'divineDogs');
    }
    if (slot === 'ultimate') p.tryUltimate();
    else if (slot === 'domain') p.tryDomain();
    else castAbility(world, p, ab, 0, { basic: true, free: true, force: true });
    // let it resolve
    let counterSeen = false;
    for (let i = 0; i < 150; i++) {
      world.update(1 / 60);
      if (p.counterActive > 0) counterSeen = true;
      // keep attacking the same target in place so DoT/beam/multi hits land
    }
    const dealt = hp0 - target.hp + (target.dead ? target.maxHp : 0);
    const summoned = world.summons.length > before.summons;
    const domained = !!world.domain || before.domain;
    const healed = p.hp > before.php + 0.5;
    const buffed = JSON.stringify(p.buffs || {}) !== before.buffs || p.reinforceT > 0 || p.invulnT > 0 ||
      p.ce > before.ce || p.infinityT > 0 || p.techBuff > 0 || p.shield > 0;
    const moved = Math.abs(p.x - startX) > 8;
    const counterReady = counterSeen || p.counterActive > 0;
    const stunned = target.stunT > Math.max(0.05, beforeStun);
    const marked = Object.keys(target.marks || {}).length > before.marks;
    const ultSpent = p.ultMeter < beforeUlt;
    const useful = dealt > 0 || summoned || domained || healed || buffed || moved || stunned || marked || ultSpent || counterReady;
    ok(useful, `${charId} ${slot} ${ab.name}: no measurable effect (dmg=${dealt.toFixed(1)})`);
    const DAMAGING = ['melee', 'projectile', 'aoe', 'beam', 'multi', 'dash', 'trap', 'mark'];
    if (DAMAGING.includes(ab.type)) {
      ok(dealt > 0 || stunned || marked, `${charId} ${slot} ${ab.name} (${ab.type}): dealt no damage`);
    }
    // reset for next
    p.buffs = {};
  }
}
console.log(`kits: ${pass} passed, ${fail} failed`);
if (problems.length) {
  console.log(problems.join('\n'));
  process.exitCode = 1;
}
