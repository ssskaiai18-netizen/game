// ---------------------------------------------------------------------------
// dungeon.js — seeded branching room graph generation and room content.
// ---------------------------------------------------------------------------

import { Rng, clamp } from '../core/util.js';
import { ARCS, DIFFICULTIES } from '../data/story.js';
import { ENEMIES, BOSSES, ELITE_MODS, ARC_BOSS, CULLING_BOSSES, enemyPoolForArc } from '../data/enemies.js';

export const ROOM_TYPES = {
  combat: { name: 'Combat', icon: '⚔', color: '#ff6b6b', desc: 'Cursed spirits patrol this chamber.' },
  elite: { name: 'Elite', icon: '☠', color: '#ff8a3a', desc: 'A strengthened curse guards something valuable.' },
  heal: { name: 'Rest', icon: '✚', color: '#7cf0a0', desc: 'A quiet space. Recover health.' },
  ce: { name: 'Wellspring', icon: '✦', color: '#7ec8ff', desc: 'Cursed energy pools here.' },
  upgrade: { name: 'Awakening', icon: '◆', color: '#b06bff', desc: 'A technique revelation waits.' },
  shop: { name: 'Exchange', icon: '✷', color: '#ffd166', desc: 'Trade tribute for supplies.' },
  event: { name: 'Encounter', icon: '?', color: '#9fd8ff', desc: 'Something other than a fight.' },
  boss: { name: 'Boss', icon: '☠☠', color: '#ff2a4a', desc: 'The arc\'s monster awaits.' },
  story: { name: 'Story', icon: '❖', color: '#ffffff', desc: 'A moment that matters.' },
};

const TYPE_WEIGHTS = [
  { type: 'combat', w: 42 },
  { type: 'elite', w: 11 },
  { type: 'heal', w: 13 },
  { type: 'ce', w: 10 },
  { type: 'upgrade', w: 13 },
  { type: 'shop', w: 5 },
  { type: 'event', w: 6 },
];

export function generateDungeon(seed, arcIndex, difficultyId = 'normal') {
  const rng = new Rng(seed);
  const arc = ARCS[arcIndex];
  const diff = DIFFICULTIES[difficultyId] || DIFFICULTIES.normal;
  const floors = clamp(arc.rooms, 5, 10);
  const nodes = [];
  const layers = [];
  let idc = 0;

  for (let layer = 0; layer < floors; layer++) {
    const isFirst = layer === 0;
    const isLast = layer === floors - 1;
    let count;
    if (isFirst) count = 1;
    else if (isLast) count = 1;
    else count = rng.chance(0.45) ? 3 : 2;
    const layerNodes = [];
    for (let i = 0; i < count; i++) {
      let type;
      if (isLast) type = 'boss';
      else if (isFirst) type = 'combat';
      else {
        type = rng.weighted(TYPE_WEIGHTS).type;
        // healing rooms get rarer on higher difficulties
        if (type === 'heal' && !rng.chance(diff.healRooms)) type = 'combat';
        if (layer === floors - 2) type = rng.chance(0.5) ? 'elite' : 'heal';
      }
      const node = {
        id: 'n' + idc++,
        layer,
        index: i,
        count,
        type,
        edges: [],
        x: 70 + (layer / Math.max(1, floors - 1)) * 480,
        y: count === 1 ? 190 : 130 + i * 120,
        cleared: false,
        visited: false,
        seed: (rng.next() * 4294967295) >>> 0,
      };
      layerNodes.push(node);
      nodes.push(node);
    }
    layers.push(layerNodes);
  }

  // connect layers (all nodes reachable, boss reachable)
  for (let l = 0; l < layers.length - 1; l++) {
    const cur = layers[l];
    const next = layers[l + 1];
    for (let i = 0; i < cur.length; i++) {
      const n = cur[i];
      const targetIdx = Math.round(((i + 0.5) / cur.length) * next.length - 0.5);
      const idxs = [clamp(targetIdx, 0, next.length - 1)];
      if (next.length > 1 && rng.chance(0.5)) {
        idxs.push(clamp(targetIdx + (rng.chance(0.5) ? 1 : -1), 0, next.length - 1));
      }
      for (const idx of new Set(idxs)) n.edges.push(next[idx].id);
    }
    // ensure every node in next is reachable
    for (const nn of next) {
      if (!cur.some((c) => c.edges.includes(nn.id))) {
        const from = cur[rng.int(0, cur.length - 1)];
        from.edges.push(nn.id);
      }
    }
  }

  const startId = layers[0][0].id;
  const bossId = layers[layers.length - 1][0].id;
  return { seed, arcIndex, arc, difficultyId, floors, nodes, layers, startId, bossId, rngSeed: seed };
}

export function nodeById(dungeon, id) {
  return dungeon.nodes.find((n) => n.id === id) || null;
}

export function roomThreat(node, run) {
  const layerScale = 1 + node.layer * 0.1;
  const diff = DIFFICULTIES[run.difficultyId] || DIFFICULTIES.normal;
  return { hpMult: layerScale * diff.enemyHp, dmgMult: (1 + node.layer * 0.06) * diff.enemyDmg, count: diff.count };
}

export function roomEnemyList(node, run, rng) {
  const arc = run.arcIndex;
  const pool = enemyPoolForArc(arc);
  const threat = roomThreat(node, run);
  const list = [];
  if (node.type === 'boss') {
    const bossId = ARC_BOSS[arc] || 'bloodPainting';
    list.push({ bossId, elite: false });
    // final arc boss gets escorts
    if (arc >= 4 && rng.chance(0.5)) list.push({ id: rng.pick(pool), elite: false });
    return list;
  }
  if (node.type === 'elite') {
    const id = rng.pick(pool);
    list.push({ id, elite: true, mod: rng.pick(Object.keys(ELITE_MODS)) });
    const adds = Math.max(1, Math.round(2 * threat.count));
    for (let i = 0; i < adds; i++) list.push({ id: rng.pick(pool) });
    return list;
  }
  if (node.type === 'combat') {
    const base = 2 + Math.floor(node.layer * 0.6) + (rng.chance(0.4) ? 1 : 0);
    const count = Math.max(2, Math.round(base * threat.count));
    for (let i = 0; i < count; i++) {
      const id = rng.pick(pool);
      list.push({ id, elite: false, mod: rng.chance(0.1 * (DIFFICULTIES[run.difficultyId]?.enemyHp || 1)) ? rng.pick(Object.keys(ELITE_MODS)) : null });
    }
    return list;
  }
  return list;
}

export function bossForArc(arcIndex) {
  return BOSSES[ARC_BOSS[arcIndex]] || BOSSES.bloodPainting;
}

export function cullingBossFor(colonyIndex) {
  return BOSSES[CULLING_BOSSES[colonyIndex % CULLING_BOSSES.length]];
}

export function roomRewardOptions(rng, node, run) {
  // number of upgrade choices per room type
  if (node.type === 'upgrade') return { upgrades: 3, rarity: null };
  if (node.type === 'elite') return { upgrades: 3, rarity: 'rare' };
  if (node.type === 'boss') return { upgrades: 3, rarity: 'epic' };
  if (node.type === 'combat') return { upgrades: 3, rarity: null };
  return { upgrades: 0, rarity: null };
}
