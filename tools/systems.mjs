// System-level tests for the combat/progression core, run in plain Node.
//   node tools/systems.mjs

import { World } from '../src/game/world.js';
import { Player } from '../src/game/player.js';
import { SaveSystem, defaultSave } from '../src/core/save.js';
import { castAbility } from '../src/game/combat.js';
import { defaultMods, rollUpgrades, UPGRADES, makeUpgradeContext } from '../src/data/upgrades.js';
import { generateDungeon, nodeById, roomEnemyList } from '../src/game/dungeon.js';
import { Run } from '../src/game/run.js';
import { ENEMIES, BOSSES, ELITE_MODS } from '../src/data/enemies.js';
import { SHIKIGAMI, AGITO } from '../src/data/shikigami.js';
import { summonShikigami, spawnUltimateSummon, commandSummons } from '../src/game/summon.js';
import { startDomain, updateDomain } from '../src/game/domain.js';
import { ARCS, DIFFICULTIES } from '../src/data/story.js';
import { CHARACTERS } from '../src/data/characters.js';
import { Rng } from '../src/core/util.js';

let pass = 0;
let fail = 0;
const failures = [];
function ok(cond, name, extra = '') {
  if (cond) {
    pass++;
  } else {
    fail++;
    failures.push(name + (extra ? ' — ' + extra : ''));
    console.log('FAIL:', name, extra);
  }
}

function makeSave() {
  const s = new SaveSystem(null);
  s.data = defaultSave();
  return s;
}

function makeWorld(opts = {}) {
  const save = opts.save || makeSave();
  const game = { audio: { play() {} }, save, toasts: { push() {} }, engine: { fps: 60 } };
  const world = new World(game, { arena: { x: 0, y: 0, w: 640, h: 360 }, theme: 'void', seed: opts.seed || 1, scene: opts.scene || null });
  return { world, game, save };
}

function makePlayer(world, save, charId = 'yuji', mods = defaultMods()) {
  const p = new Player(world, { charId, save, mods, x: 320, y: 240 });
  p.controller = p;
  world.player = p;
  world.addActor(p);
  return p;
}

function step(world, seconds, dt = 1 / 60) {
  const n = Math.round(seconds / dt);
  for (let i = 0; i < n; i++) {
    world.update(dt);
    // keep the player alive for mechanical tests
  }
}

// ---------------------------------------------------------------------------
// 1. Damage only during active frames, once per attack
// ---------------------------------------------------------------------------
{
  const { world, save } = makeWorld();
  const p = makePlayer(world, save);
  const enemy = world.spawnEnemy(ENEMIES.curseGrunt, p.x + 16, p.y, { hpMult: 1 });
  enemy.aiTimer = 999;
  enemy.thinkTimer = 999;
  enemy.speed = 0;
  const ab = p.basic[0];
  for (let i = 0; i < 30; i++) world.update(1 / 60); // let spawn invulnerability expire
  const hpBefore = enemy.hp;
  castAbility(world, p, ab, 0, { basic: true, free: true });
  // during startup no hitboxes
  ok(world.hitboxes.length === 0, 'no hitbox during startup');
  world.update(1 / 60);
  ok(enemy.hp === hpBefore, 'no damage during startup frame');
  // advance through active
  for (let i = 0; i < 30; i++) world.update(1 / 60);
  const dmg = hpBefore - enemy.hp;
  ok(dmg > 0, 'damage applied during active frames', `dmg=${dmg}`);
  const afterFirst = enemy.hp;
  for (let i = 0; i < 40; i++) world.update(1 / 60);
  ok(enemy.hp === afterFirst, 'single hitbox does not re-damage', `${afterFirst} vs ${enemy.hp}`);
}

// ---------------------------------------------------------------------------
// 2. Combo chain advances
// ---------------------------------------------------------------------------
{
  const { world, save } = makeWorld();
  const p = makePlayer(world, save);
  p.startBasic();
  ok(p.comboIdx === 1, 'combo starts at 1');
  for (let i = 0; i < 20; i++) world.update(1 / 60);
  p.tryAttack();
  for (let i = 0; i < 20; i++) world.update(1 / 60);
  p.tryAttack();
  for (let i = 0; i < 30; i++) world.update(1 / 60);
  ok(p.comboIdx === 3, 'three-hit combo reached', 'idx=' + p.comboIdx);
}

// ---------------------------------------------------------------------------
// 3. Reinforcement cost & damage bonus
// ---------------------------------------------------------------------------
{
  const { world, save } = makeWorld();
  const p = makePlayer(world, save);
  const ceBefore = p.ce;
  p.toggleReinforce();
  ok(p.reinforced > 0, 'reinforcement activates');
  ok(p.ce < ceBefore, 'reinforcement costs CE');
  const enemyA = world.spawnEnemy(ENEMIES.curseBrute, p.x + 18, p.y, {});
  enemyA.speed = 0;
  enemyA.aiTimer = 999;
  const ab = p.basic[0];
  const dmgReinforced = (world.damage(enemyA, 10, { source: p, category: 'physical' }), 10);
  // compare computeDamage values through a real cast
  const { computeDamage } = await import('../src/game/combat.js');
  const base = computeDamage(p, ab, { basic: true });
  p.reinforced = 0;
  const unReinforced = computeDamage(p, ab, { basic: true });
  ok(base > unReinforced, 'reinforcement increases damage', `${base} vs ${unReinforced}`);
}

// ---------------------------------------------------------------------------
// 4. Black Flash timing window
// ---------------------------------------------------------------------------
{
  const { world, save } = makeWorld();
  save.data.unlocks.blackSparks = true;
  const p = makePlayer(world, save, 'yuji');
  const enemy = world.spawnEnemy(ENEMIES.curseBrute, p.x + 16, p.y, {});
  enemy.speed = 0;
  enemy.aiTimer = 999;
  for (let i = 0; i < 30; i++) world.update(1 / 60);
  p.toggleReinforce();
  ok(p.reinforced > 0, 'BF test reinforcement');
  p.startBasic();
  ok(world.stats.bfAttempts === 1, 'black flash attempt registered', 'attempts=' + world.stats.bfAttempts);
  // advance to the window then press
  const s = p.bfState;
  let guard = 0;
  while (p.bfState && !p.bfState.windowOpen && guard++ < 200) world.update(1 / 240);
  ok(p.bfState && p.bfState.windowOpen, 'window opens');
  p.attemptBlackFlash();
  ok(p.bfArmed !== null, 'black flash armed');
  for (let i = 0; i < 40; i++) world.update(1 / 60);
  ok(world.stats.bfSuccess > 0, 'black flash success counted', JSON.stringify({ s: world.stats.bfSuccess, f: world.stats.bfFail }));
  ok(enemy.hp < enemy.maxHp, 'black flash dealt damage');
}
{
  const { world, save } = makeWorld();
  save.data.unlocks.blackSparks = true;
  const p = makePlayer(world, save, 'megumi');
  p.toggleReinforce();
  p.startBasic();
  ok(world.stats.bfAttempts === 1, 'physical basic attack registers a BF attempt for any sorcerer');
  for (let i = 0; i < 90; i++) world.update(1 / 60);
  ok(world.stats.bfFail > 0, 'missed window counts as failure', 'fail=' + world.stats.bfFail);
}

// ---------------------------------------------------------------------------
// 5. Perfect dodge & i-frames
// ---------------------------------------------------------------------------
{
  const { world, save } = makeWorld();
  const p = makePlayer(world, save);
  p.tryDodge();
  ok(p.invulnT > 0, 'dodge grants i-frames');
  ok(p.perfectDodgeWindow > 0, 'perfect dodge window active');
  const hp = p.hp;
  const dealt = world.damage(p, 30, { category: 'physical' });
  ok(dealt === 0 && p.hp === hp, 'perfect dodge negates damage');
  ok(world.stats.perfectDodges === 1, 'perfect dodge counted');
  ok(p.ce >= p.maxCe - 30, 'perfect dodge restores CE');
}

// ---------------------------------------------------------------------------
// 6. Dash i-frames without perfect window
// ---------------------------------------------------------------------------
{
  const { world, save } = makeWorld();
  const p = makePlayer(world, save);
  p.invulnT = 0.5;
  p.perfectDodgeWindow = 0;
  const hp = p.hp;
  world.damage(p, 20, { category: 'physical' });
  ok(p.hp === hp, 'i-frames block damage');
}

// ---------------------------------------------------------------------------
// 7. Domains — Gojo Unlimited Void
// ---------------------------------------------------------------------------
{
  const { world, save } = makeWorld();
  const p = makePlayer(world, save, 'gojo');
  const e = world.spawnEnemy(ENEMIES.curseBrute, p.x + 40, p.y, {});
  e.speed = 0;
  startDomain(world, p, p.domainAbility);
  ok(!!world.domain, 'domain created');
  ok(world.domain.id === 'unlimited_void', 'gojo domain id');
  for (let i = 0; i < 180; i++) world.update(1 / 60);
  ok(e.stunT > 0 || e.dead || e.hp < e.maxHp, 'unlimited void affects enemies', `hp=${e.hp} stun=${e.stunT.toFixed(2)}`);
  ok(world.stats.domains === 0, 'domain not double counted by direct start');
}
{
  const { world, save } = makeWorld();
  const p = makePlayer(world, save, 'sukuna');
  startDomain(world, p, p.domainAbility);
  const e = world.spawnEnemy(ENEMIES.curseGrunt, p.x + 30, p.y, {});
  const hp0 = e.hp;
  for (let i = 0; i < 150; i++) world.update(1 / 60);
  ok(e.hp < hp0 || e.dead, 'malevolent shrine deals cutting damage', `${hp0} → ${e.hp}`);
  ok(world.domain === null || world.domain.id === 'malevolent_shrine', 'shrine identity preserved');
}

// ---------------------------------------------------------------------------
// 8. Summons, commands, Agito and Mahoraga
// ---------------------------------------------------------------------------
{
  const { world, save } = makeWorld();
  save.data.unlocks.shikigami.nue = true;
  save.data.unlocks.shikigami.mahoraga = true;
  const p = makePlayer(world, save, 'megumi');
  const dogs = summonShikigami(world, p, 'divineDogs');
  ok(dogs.length === 2, 'divine dogs spawn as a pair', 'n=' + dogs.length);
  ok(world.summons.length === 2, 'summons tracked');
  const e = world.spawnEnemy(ENEMIES.curseGrunt, p.x + 40, p.y, {});
  e.speed = 0;
  const hp0 = e.hp;
  for (let i = 0; i < 240; i++) world.update(1 / 60);
  ok(e.hp < hp0 || e.dead, 'summons attack enemies', `${hp0} → ${e.hp}`);
  commandSummons(world, p, {});
  ok(true, 'summon command executes');
  const agito = spawnUltimateSummon(world, p, 'agito');
  ok(agito && agito.isUltimateSummon, 'agito summoned');
  ok(agito.maxLifetime === 120, 'agito duration 120s', 'dur=' + agito.maxLifetime);
  const maho = spawnUltimateSummon(world, p, 'mahoraga');
  ok(maho && maho.summonId === 'mahoraga', 'mahoraga summoned');
  ok(maho.maxLifetime === 60, 'mahoraga duration 60s', 'dur=' + maho.maxLifetime);
  ok(maho.adapt && maho.adapt.cut, 'mahoraga has adaptation memory');
}

// ---------------------------------------------------------------------------
// 9. Mahoraga adaptation reduces repeated damage
// ---------------------------------------------------------------------------
{
  const { world, save } = makeWorld();
  save.data.unlocks.shikigami.mahoraga = true;
  const p = makePlayer(world, save, 'megumi');
  const maho = spawnUltimateSummon(world, p, 'mahoraga');
  const dmgFirst = world.damage(maho, 100, { source: p, category: 'cut' });
  for (let i = 0; i < 60; i++) world.damage(maho, 10, { source: p, category: 'cut', dot: true });
  const stage = maho.adapt.cut.stage;
  ok(stage >= 1, 'adaptation stage rises from repeated cutting damage', 'stage=' + stage);
  const dmgAfter = world.damage(maho, 100, { source: p, category: 'cut' });
  ok(dmgAfter < dmgFirst, 'adapted damage is reduced', `${dmgFirst} → ${dmgAfter}`);
  ok(save.data.adapt.cut.stage >= 0, 'persistent adaptation record exists');
}

// ---------------------------------------------------------------------------
// 10. Upgrade pool eligibility + application
// ---------------------------------------------------------------------------
{
  const save = makeSave();
  const { world } = makeWorld({ save });
  const p = makePlayer(world, save);
  const ctx = makeUpgradeContext('yuji', save, { domain: null, mods: defaultMods() });
  const rng = new Rng(7);
  for (let i = 0; i < 40; i++) {
    const picks = rollUpgrades(rng, ctx, 3);
    for (const u of picks) {
      ok(!(u.chars && !u.chars.includes('yuji')), 'no ineligible character upgrades', u.id);
    }
  }
  const bfRoll = UPGRADES.find((u) => u.id === 'bf_sparks');
  const mods = defaultMods();
  bfRoll.apply(mods, ctx);
  ok(ctx.unlockBlackSparks === true, 'black sparks scroll flags permanent unlock');
  save.data.unlocks.blackSparks = true;
  const ctx2 = makeUpgradeContext('yuji', save, { domain: null, mods: defaultMods() });
  ok(UPGRADES.find((u) => u.id === 'bf_instinct').requires(ctx2), 'BF upgrades unlock after scroll');
}

// ---------------------------------------------------------------------------
// 11. Dungeon graph connectivity across many seeds
// ---------------------------------------------------------------------------
{
  let bad = 0;
  for (let seed = 1; seed < 200; seed++) {
    const dg = generateDungeon(seed, seed % 7, 'normal');
    const reach = new Set([dg.startId]);
    const queue = [dg.startId];
    while (queue.length) {
      const id = queue.shift();
      const n = nodeById(dg, id);
      for (const e of n.edges) if (!reach.has(e)) { reach.add(e); queue.push(e); }
    }
    if (!reach.has(dg.bossId)) bad++;
    if (reach.size !== dg.nodes.length) bad++;
    // every node must have edges unless boss
    for (const n of dg.nodes) {
      const isBoss = n.type === 'boss';
      if (!isBoss && n.edges.length === 0) bad++;
    }
  }
  ok(bad === 0, 'all generated dungeons are fully connected', 'bad=' + bad);
}

// ---------------------------------------------------------------------------
// 12. Room enemy generation produces valid enemies for every arc
// ---------------------------------------------------------------------------
{
  for (let arc = 0; arc < ARCS.length; arc++) {
    const dg = generateDungeon(42, arc, 'normal');
    const run = { arcIndex: arc, difficultyId: 'normal', arc: ARCS[arc], diff: DIFFICULTIES.normal };
    for (const node of dg.nodes) {
      const list = roomEnemyList(node, run, new Rng(arc + node.layer));
      for (const entry of list) {
        if (entry.bossId) {
          ok(!!BOSSES[entry.bossId], 'boss exists for arc ' + arc, entry.bossId);
        } else {
          ok(!!ENEMIES[entry.id], 'enemy exists in arc ' + arc, entry.id);
          if (entry.mod) ok(!!ELITE_MODS[entry.mod], 'elite mod exists', entry.mod);
        }
      }
    }
  }
}

// ---------------------------------------------------------------------------
// 13. Enemy AI attacks the player over time
// ---------------------------------------------------------------------------
{
  const { world, save } = makeWorld();
  const p = makePlayer(world, save);
  p.hp = p.maxHp = 5000;
  const e = world.spawnEnemy(ENEMIES.curseGrunt, p.x + 30, p.y, { dmgMult: 3 });
  for (let i = 0; i < 60 * 12; i++) world.update(1 / 60);
  ok(world.stats.damageTaken > 0, 'enemy AI lands attacks', 'taken=' + world.stats.damageTaken);
}

// ---------------------------------------------------------------------------
// 14. Boss phase transition + domain
// ---------------------------------------------------------------------------
{
  const { world, save } = makeWorld();
  const p = makePlayer(world, save, 'gojo');
  p.hp = p.maxHp = 4000;
  const boss = world.spawnEnemy(BOSSES.jogo, p.x + 120, p.y, { brain: 'boss' });
  boss.introT = 0;
  boss.hp = boss.maxHp * 0.45;
  let phase2 = false;
  let domain = false;
  for (let i = 0; i < 60 * 25; i++) {
    if (i === 120) boss.hp = boss.maxHp * 0.3;
    world.update(1 / 60);
    if (boss.phaseIndex === 2) phase2 = true;
    if (world.domain) domain = true;
  }
  ok(phase2, 'boss reaches phase 2');
  ok(domain, 'boss uses its domain');
}

// ---------------------------------------------------------------------------
// 15. Save sanitisation of corrupt data
// ---------------------------------------------------------------------------
{
  const { sanitize } = await import('../src/core/save.js');
  const bad = sanitize({ unlocks: { characters: ['yuji', 'hacker'], shikigami: { nue: 'yes' } }, stats: { runs: 'lots' }, tribute: { vitality: -5 }, story: { arc: 99 } });
  ok(bad.unlocks.characters.includes('yuji') && !bad.unlocks.characters.includes('hacker'), 'invalid characters dropped');
  ok(bad.unlocks.shikigami.nue === undefined, 'invalid shikigami value dropped');
  ok(bad.stats.runs === 0, 'invalid stat repaired');
  ok(bad.tribute.vitality === 0, 'negative tribute clamped');
  ok(bad.story.arc === 6, 'arc index clamped');
}

// ---------------------------------------------------------------------------
// 16. Run rewards applied exactly once
// ---------------------------------------------------------------------------
{
  const save = makeSave();
  const { world } = makeWorld({ save });
  const game = { audio: { play() {} }, save, toasts: { push() {} } };
  const run = new Run(game, { charId: 'yuji', arcIndex: 0, difficultyId: 'normal', seed: 5 });
  const p = makePlayer(world, save);
  run.applyUpgrade(UPGRADES.find((u) => u.id === 'refined_tech'), p);
  const before = save.data.tributeCurrency;
  run.finish(true, world);
  const mid = save.data.tributeCurrency;
  run.finish(true, world);
  ok(save.data.tributeCurrency === mid, 'rewards are not duplicated');
  ok(mid > before, 'victory grants tribute');
  ok(save.data.story.cleared[0] === true, 'arc marked cleared');
  ok(save.hasCharacter('nobara'), 'arc 0 unlocks Nobara');
  ok(save.data.highScores.length === 1, 'single high score entry');
}

// ---------------------------------------------------------------------------
// 17. Ten Shadows taming persists
// ---------------------------------------------------------------------------
{
  const save = makeSave();
  ok(!save.hasShikigami('nue'), 'nue locked initially');
  save.tameShikigami('nue');
  ok(save.hasShikigami('nue'), 'nue tamed');
  ok(save.data.unlocks.shikigami.divineDogs === true, 'dogs available by default');
  ok(save.data.unlocks.shikigami.rabbitEscape === true, 'rabbits available by default');
}

// ---------------------------------------------------------------------------
// 18. All playable characters have >= 5 distinct abilities
// ---------------------------------------------------------------------------
{
  for (const id of Object.keys(CHARACTERS)) {
    const c = CHARACTERS[id];
    const kit = new Set();
    c.basic.forEach((a) => kit.add(a.id));
    c.abilities.forEach((a) => kit.add(a.id));
    if (c.ultimate) kit.add(c.ultimate.id);
    if (c.domain) kit.add(c.domain.id);
    ok(kit.size >= 6, `${id} has at least 5 distinct actions`, 'n=' + kit.size);
    ok(!!c.ultimate, `${id} has an ultimate`);
  }
}

// ---------------------------------------------------------------------------
// 19. Ultimate meter gating
// ---------------------------------------------------------------------------
{
  const { world, save } = makeWorld();
  save.data.unlocks.shikigami.mahoraga = true;
  // Agito gate (update): Round Deer + Nue + Mourning Tiger + Great Serpent
  for (const id of ['roundDeer', 'nue', 'mourningTiger', 'greatSerpent']) save.data.unlocks.shikigami[id] = true;
  const p = makePlayer(world, save, 'megumi');
  p.ultMeter = 40;
  p.charId = 'megumi';
  p.summonOptions = ['divineDogs'];
  p.tryUltimate();
  ok(p.ultMeter === 40, 'below 50% cannot summon');
  p.ultMeter = 60;
  p.tryUltimate();
  ok(p.ultMeter === 10, 'agito consumes 50%', 'meter=' + p.ultMeter);
  ok(world.summons.some((s) => s.summonId === 'agito'), 'agito active');
  p.ultMeter = 100;
  p.tryUltimate();
  ok(world.summons.some((s) => s.summonId === 'mahoraga'), '100% summons mahoraga over agito');
}

// ---------------------------------------------------------------------------
// 20. Cooldowns and CE gating
// ---------------------------------------------------------------------------
{
  const { world, save } = makeWorld();
  const p = makePlayer(world, save, 'nobara');
  const ab = p.slots[0];
  p.ce = 0;
  const okCast = castAbility(world, p, ab, 0, {});
  ok(okCast === false, 'cannot cast without CE');
  p.ce = p.maxCe;
  const okCast2 = castAbility(world, p, ab, 0, {});
  ok(okCast2 === true, 'casts with CE');
  const okCast3 = castAbility(world, p, ab, 0, {});
  ok(okCast3 === false, 'cooldown blocks immediate recast');
}


// ---------------------------------------------------------------------------
// 21. Upgrade effects actually fire
// ---------------------------------------------------------------------------
{
  // Second Wind revive
  const { world, save } = makeWorld();
  const mods = defaultMods();
  mods.revive = true;
  const p = makePlayer(world, save, 'yuji', mods);
  p.invulnT = 0;
  world.damage(p, 9999, { category: 'physical', source: null });
  ok(!p.dead && p.hp > 0, 'Second Wind prevents the killing blow', `hp=${p.hp}`);
  ok(p.reviveUsed === true, 'Second Wind is once per run');
  p.invulnT = 0;
  world.damage(p, 9999, { category: 'physical' });
  ok(p.dead, 'second lethal hit still kills');
}
{
  // low HP rage buffs damage dealt, not taken
  const { world, save } = makeWorld();
  const mods = defaultMods();
  mods.lowHpRage = 0.3;
  const p = makePlayer(world, save, 'yuji', mods);
  const { computeDamage } = await import('../src/game/combat.js');
  const e = world.spawnEnemy('curseBrute', p.x + 18, p.y, {});
  e.invulnT = 0;
  p.hp = p.maxHp;
  p.hp = p.maxHp * 0.2;
  const low = computeDamage(p, p.basic[0], { basic: true });
  // computeDamage is called before world.damage applies lowHpRage, so compare via damage
  const hp0 = e.hp;
  world.damage(e, 100, { source: p, category: 'physical' });
  const lowDealt = hp0 - e.hp;
  p.hp = p.maxHp;
  const hp1 = e.hp;
  world.damage(e, 100, { source: p, category: 'physical' });
  const fullDealt = hp1 - e.hp;
  ok(lowDealt > fullDealt, 'low HP rage increases damage dealt', `${lowDealt} vs ${fullDealt}`);
}
{
  // on-hit status upgrades
  const { world, save } = makeWorld();
  const mods = defaultMods();
  mods.bleedOnHit = 4;
  mods.slowOnHit = 0.3;
  const p = makePlayer(world, save, 'yuji', mods);
  const e = world.spawnEnemy('curseBrute', p.x + 20, p.y, {});
  e.invulnT = 0;
  world.damage(e, 5, { source: p, category: 'physical' });
  ok(e.bleedT > 0 && e.bleedDmg >= 4, 'bleed upgrade applies bleed', `t=${e.bleedT}`);
  ok(e.slowT > 0, 'slow upgrade applies slow');
}
{
  // Black Flash → next technique amplification
  const { world, save } = makeWorld();
  const mods = defaultMods();
  mods.bfTechBuff = true;
  const p = makePlayer(world, save, 'yuji', mods);
  const { computeDamage } = await import('../src/game/combat.js');
  const ab = p.slots[0];
  const base = computeDamage(p, ab, {});
  p.pendingTechBuff = 5;
  const amped = computeDamage(p, ab, {});
  ok(amped > base, 'pending technique buff increases technique damage', `${base} → ${amped}`);
  ok(p.pendingTechBuff === 0, 'technique buff is consumed');
}
{
  // Totality Path: defeated shikigami leaves a shadow echo
  const { world, save } = makeWorld();
  const mods = defaultMods();
  mods.totalityPath = true;
  save.data.unlocks.shikigami.nue = true;
  const p = makePlayer(world, save, 'megumi', mods);
  const [nue] = summonShikigami(world, p, 'nue');
  nue.hp = 1;
  world.damage(nue, 999, { category: 'physical' });
  ok(!nue.dead && nue.hp > 0, 'Totality Path gives a shikigami a second life', `hp=${nue.hp}`);
}

// ---------------------------------------------------------------------------
// Update coverage: custom sorcerer, Divergent Fist timing, transformations,
// NPC-slot domains, fusions, Chimera copies, and the new Agito gate.
// ---------------------------------------------------------------------------
const dummyE = (world, x, y) => {
  const e = world.spawnEnemy(ENEMIES.curseBrute, x, y, { hpMult: 8 });
  e.speed = 0; e.brain = 'none'; e.aiTimer = 999; e.thinkTimer = 999; e.invulnT = 0;
  return e;
};
{
  const { ensureTechnique: ensureT, applyTrainingCredit } = await import('../src/data/techniques.js');
  const { SaveSystem: SS, defaultSave: DS } = await import('../src/core/save.js');
  const cs = new SS(null); cs.data = DS();
  const t1 = ensureT(cs);
  ok(t1 === ensureT(cs), 'innate technique is assigned once and persists');
  ok(cs.data.custom.unlockedAbilities.length === 2, 'custom sorcerer starts with exactly 2 abilities');
  ok(!!applyTrainingCredit(cs, 'yuji'), 'trainer win unlocks the next own-technique ability');
  ok(cs.data.custom.unlockedAbilities.length === 3, 'third ability unlocked in fixed order');
}
{
  const { castAbility: cast2, triggerDivergent } = await import('../src/game/combat.js');
  const { CHARACTERS: CH } = await import('../src/data/characters.js');
  for (const mode of ['bf', 'normal', 'early']) {
    const { world, save } = makeWorld();
    const p = makePlayer(world, save, 'yuji');
    const e = dummyE(world, p.x + 26, p.y);
    step(world, 0.7);
    const hp0 = e.hp;
    p.aimAngle = 0;
    cast2(world, p, CH.yuji.abilities[0], 0, { force: true, free: true });
    if (mode === 'bf') { for (let i = 0; i < 15; i++) world.update(1 / 60); triggerDivergent(world, p); step(world, 0.5); }
    else if (mode === 'early') { triggerDivergent(world, p); step(world, 1.4); }
    else step(world, 1.4);
    const dealt = hp0 - e.hp;
    if (mode === 'bf') ok(dealt > 30, 'Divergent Fist: correctly timed second press triggers Black Flash', dealt);
    if (mode === 'normal') ok(dealt > 5 && dealt <= 60, 'Divergent Fist: no press = normal delayed impact', dealt);
    if (mode === 'early') ok(dealt <= 60, 'Divergent Fist: early mash cannot trigger Black Flash', dealt);
  }
}
{
  const { world, save } = makeWorld();
  const p = makePlayer(world, save, 'sukuna');
  step(world, 0.7);
  p.ultMeter = 100; p.tryUltimate(); step(world, 0.5);
  ok(p.transformT > 0 && p.slots[0].name === 'World-Cutting Slash' && p.look.fourArms === true, 'Heian form swaps kit and look');
  p.transformT = 0.01; step(world, 0.2);
  ok(p.transformT <= 0 && p.slots[0].name === 'Dismantle' && !p.look.fourArms, 'Heian form expiry restores base kit and look');
  p.ultMeter = 100; p.tryUltimate(); step(world, 1.5); p.ce = 999; p.domainCd = 0; p.trySlot(4); step(world, 0.5);
  if (!world.domain) { p.trySlot(4); step(world, 0.5); }
  ok(world.domain?.id === 'malevolent_shrine', 'Malevolent Shrine casts from the Heian slot');
}
{
  const { world, save } = makeWorld();
  const p = makePlayer(world, save, 'gojo');
  step(world, 0.7);
  p.ultMeter = 100; p.tryUltimate(); step(world, 0.5);
  ok(p.slots[2].type === 'domain' && p.slots[4].name === 'Infinity', 'Limitless Ascendant swaps kit');
  p.ce = 999; step(world, 1); p.trySlot(4); step(world, 0.2);
  ok(p.infinityT > 0, 'Infinity state activates with its own timer', p.infinityT);
}
{
  const { startDomain: sd } = await import('../src/game/domain.js');
  const { world, save } = makeWorld();
  const p = makePlayer(world, save, 'yuji');
  const e = dummyE(world, p.x + 40, p.y);
  step(world, 0.7);
  const hp0 = e.hp;
  sd(world, p, { id: 'incomplete_shrine', domainId: 'incomplete_shrine', name: 'Domain Expansion: Incomplete Shrine', type: 'domain', cost: 0, cd: 36, dur: 3, color: '#c0273a' });
  let stuns = 0, was = false;
  for (let i = 0; i < 200; i++) { world.update(1 / 60); if (e.stunT > 0 && !was) stuns++; was = e.stunT > 0; }
  ok(e.hp < hp0, 'Incomplete Shrine damages over time');
  ok(stuns >= 1 && stuns <= 5, 'Incomplete Shrine stuns but cannot stun-lock', stuns);
}
{
  const { summonFusion: fuse } = await import('../src/game/summon.js');
  const { startDomain: sd, endDomain: ed } = await import('../src/game/domain.js');
  const { world, save } = makeWorld();
  for (const id of ['toad', 'rabbitEscape', 'nue', 'roundDeer', 'mourningTiger', 'greatSerpent']) save.data.unlocks.shikigami[id] = true;
  const p = makePlayer(world, save, 'megumi');
  step(world, 0.7);
  p.fusionPair = ['toad', 'rabbitEscape'];
  const fused = fuse(world, p, {});
  ok(Array.isArray(fused) && fused.length === 5 && fused[0].isFusionSummon, 'Toad+Rabbit fusion spawns the winged toad swarm');
  const { world: w2, save: s2 } = makeWorld();
  const p2 = makePlayer(w2, s2, 'megumi');
  p2.ultMeter = 60; p2.tryUltimate();
  ok(p2.ultMeter === 60, 'Agito blocked without deer+nue+tiger+serpent tamed');
  summonShikigami(world, p, 'divineDogs');
  sd(world, p, p.domainAbility);
  step(world, 1.2);
  summonShikigami(world, p, 'divineDogs');
  const copies = world.summons.filter((x) => x.isShadowCopy && !x.dead);
  ok(copies.length > 0, 'Garden re-summon creates black shadow copies');
  const before = world.summons.filter((x) => !x.isShadowCopy && !x.dead).length;
  ed(world);
  ok(world.summons.filter((x) => x.isShadowCopy && !x.dead).length === 0, 'shadow copies are removed when the Garden ends');
  ok(world.summons.filter((x) => !x.dead).length === before, 'pre-existing summons survive Garden cleanup');
}

console.log(`\nsystems: ${pass} passed, ${fail} failed`);
if (fail) {
  console.log(failures.join('\n'));
  process.exitCode = 1;
}
