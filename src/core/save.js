// ---------------------------------------------------------------------------
// save.js — versioned persistent progression stored in localStorage.
// Corrupt / outdated payloads are repaired against DEFAULTS instead of crashing.
// ---------------------------------------------------------------------------

import { clamp } from './util.js';

export const SAVE_VERSION = 3;
const KEY = 'jjk_roguelite_save_v3';
const LEGACY_KEYS = ['jjk_roguelite_save_v2', 'jjk_roguelite_save_v1'];

export const CHARACTER_IDS = ['yuji', 'megumi', 'nobara', 'gojo', 'sukuna'];

export const SHIKIGAMI_IDS = [
  'divineDogs',
  'nue',
  'greatSerpent',
  'toad',
  'maxElephant',
  'rabbitEscape',
  'roundDeer',
  'piercingOx',
  'mourningTiger',
  'mahoraga',
];

export const MAHORAGA_CATEGORIES = [
  'physical',
  'cut',
  'blunt',
  'fire',
  'electric',
  'water',
  'projectile',
  'area',
  'technique',
  'domain',
];

export function defaultSave() {
  return {
    version: SAVE_VERSION,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    unlocks: {
      characters: ['yuji', 'megumi'],
      shikigami: { divineDogs: true, rabbitEscape: true },
      totality: [],
      blackSparks: false,
      domains: ['gojo', 'sukuna', 'megumi'],
      techniques: ['reinforcement', 'dodge'],
      difficulties: ['normal'],
    },
    tribute: {
      vitality: 0,
      reservoir: 0,
      focus: 0,
      finesse: 0,
      fortune: 0,
      spark: 0,
    },
    tributeCurrency: 0,
    story: {
      arc: 0, // index into ARCS
      cleared: [false, false, false, false, false, false, false],
      flags: {},
      mahitoKills: 0,
    },
    adapt: {
      // category -> { xp, stage }  (Mahoraga persistent adaptation memory)
      physical: { xp: 0, stage: 0 },
      cut: { xp: 0, stage: 0 },
      blunt: { xp: 0, stage: 0 },
      fire: { xp: 0, stage: 0 },
      electric: { xp: 0, stage: 0 },
      water: { xp: 0, stage: 0 },
      projectile: { xp: 0, stage: 0 },
      area: { xp: 0, stage: 0 },
      technique: { xp: 0, stage: 0 },
      domain: { xp: 0, stage: 0 },
    },
    culling: {
      points: 0,
      colonies: ['tokyo1'],
      participants: { higuruma: 120, hakari: 95, kashimo: 80, ishigori: 65, uro: 50, you: 0 },
      rules: [],
      started: false,
    },
    stats: {
      runs: 0,
      wins: 0,
      deaths: 0,
      kills: 0,
      bosses: 0,
      rooms: 0,
      blackFlashes: 0,
      bestScore: 0,
      totalDamage: 0,
      bestHit: 0,
      playTime: 0,
    },
    mastery: { yuji: 0, megumi: 0, nobara: 0, gojo: 0, sukuna: 0 },
    highScores: [],
    seen: { intro: false, controlsDesktop: false, controlsTouch: false },
    settings: {
      audio: true,
      shake: true,
      difficulty: 'normal',
    },
  };
}

function num(v, fallback = 0, min = -Infinity, max = Infinity) {
  if (typeof v !== 'number' || !isFinite(v)) return fallback;
  return clamp(v, min, max);
}

function bool(v, fallback = false) {
  return typeof v === 'boolean' ? v : fallback;
}

/** Merge loaded data onto a clean default save, dropping anything malformed. */
export function sanitize(raw) {
  const d = defaultSave();
  if (!raw || typeof raw !== 'object') return d;

  d.createdAt = num(raw.createdAt, Date.now(), 0);
  d.updatedAt = num(raw.updatedAt, Date.now(), 0);

  // unlocks
  const u = raw.unlocks || {};
  if (Array.isArray(u.characters)) {
    const valid = u.characters.filter((c) => CHARACTER_IDS.includes(c));
    d.unlocks.characters = Array.from(new Set(['yuji', 'megumi', ...valid]));
  }
  d.unlocks.blackSparks = bool(u.blackSparks, false);
  d.unlocks.shikigami = { divineDogs: true, rabbitEscape: true };
  if (u.shikigami && typeof u.shikigami === 'object') {
    for (const id of SHIKIGAMI_IDS) {
      if (u.shikigami[id] === true) d.unlocks.shikigami[id] = true;
    }
  }
  d.unlocks.totality = Array.isArray(u.totality)
    ? u.totality.filter((t) => typeof t === 'string')
    : [];
  d.unlocks.domains = Array.isArray(u.domains)
    ? u.domains.filter((t) => typeof t === 'string')
    : d.unlocks.domains;
  if (Array.isArray(u.techniques)) d.unlocks.techniques = u.techniques.filter((t) => typeof t === 'string');
  if (Array.isArray(u.difficulties)) {
    d.unlocks.difficulties = Array.from(new Set(['normal', ...u.difficulties.filter((x) => typeof x === 'string')]));
  }

  // tribute
  if (raw.tribute && typeof raw.tribute === 'object') {
    for (const k of Object.keys(d.tribute)) d.tribute[k] = num(raw.tribute[k], 0, 0, 12);
  }
  d.tributeCurrency = num(raw.tributeCurrency, 0, 0, 9999999);

  // story
  const s = raw.story || {};
  d.story.arc = num(s.arc, 0, 0, 6);
  if (Array.isArray(s.cleared)) {
    for (let i = 0; i < 7; i++) d.story.cleared[i] = s.cleared[i] === true;
  }
  d.story.flags = s.flags && typeof s.flags === 'object' ? Object.assign({}, s.flags) : {};
  d.story.mahitoKills = num(s.mahitoKills, 0, 0);

  // adaptation
  if (raw.adapt && typeof raw.adapt === 'object') {
    for (const c of MAHORAGA_CATEGORIES) {
      const a = raw.adapt[c];
      if (a && typeof a === 'object') {
        d.adapt[c] = { xp: num(a.xp, 0, 0, 9999), stage: num(a.stage, 0, 0, 4) };
      }
    }
  }

  // culling games
  const cg = raw.culling || {};
  d.culling.points = num(cg.points, 0, 0, 999999);
  if (Array.isArray(cg.colonies)) d.culling.colonies = Array.from(new Set(['tokyo1', ...cg.colonies.filter((x) => typeof x === 'string')]));
  d.culling.participants = Object.assign(
    { higuruma: 120, hakari: 95, kashimo: 80, ishigori: 65, uro: 50, you: 0 },
    cg.participants && typeof cg.participants === 'object' ? cg.participants : {}
  );
  for (const k of Object.keys(d.culling.participants)) d.culling.participants[k] = num(d.culling.participants[k], 0, 0, 999999);
  d.culling.rules = Array.isArray(cg.rules) ? cg.rules.filter((x) => typeof x === 'string') : [];
  d.culling.started = bool(cg.started, false);

  // stats
  const st = raw.stats || {};
  for (const k of Object.keys(d.stats)) d.stats[k] = num(st[k], 0, 0);

  // mastery
  if (raw.mastery && typeof raw.mastery === 'object') {
    for (const k of CHARACTER_IDS) d.mastery[k] = num(raw.mastery[k], 0, 0);
  }

  // high scores
  if (Array.isArray(raw.highScores)) {
    d.highScores = raw.highScores
      .filter((e) => e && typeof e === 'object' && isFinite(e.score))
      .map((e) => ({
        score: num(e.score, 0, 0),
        char: CHARACTER_IDS.includes(e.char) ? e.char : 'yuji',
        rooms: num(e.rooms, 0, 0),
        arc: num(e.arc, 0, 0, 6),
        win: !!e.win,
        date: num(e.date, Date.now(), 0),
      }))
      .slice(0, 10);
  }

  d.seen = Object.assign({}, d.seen, raw.seen && typeof raw.seen === 'object' ? raw.seen : {});
  d.settings = Object.assign({}, d.settings, raw.settings && typeof raw.settings === 'object' ? raw.settings : {});
  d.settings.audio = bool(d.settings.audio, true);
  d.settings.shake = bool(d.settings.shake, true);
  if (!['normal', 'hard', 'hell'].includes(d.settings.difficulty)) d.settings.difficulty = 'normal';

  return d;
}

export class SaveSystem {
  constructor(storage) {
    this.storage = storage || (typeof localStorage !== 'undefined' ? localStorage : null);
    this.data = defaultSave();
    this.memoryOnly = false;
  }

  load() {
    let raw = null;
    try {
      if (this.storage) {
        raw = this.storage.getItem(KEY);
        if (!raw) {
          for (const k of LEGACY_KEYS) {
            const legacy = this.storage.getItem(k);
            if (legacy) {
              raw = legacy;
              break;
            }
          }
        }
      }
    } catch (e) {
      this.memoryOnly = true;
    }
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        this.data = sanitize(parsed);
      } catch (e) {
        this.data = defaultSave();
      }
    } else {
      this.data = defaultSave();
    }
    return this.data;
  }

  save() {
    this.data.version = SAVE_VERSION;
    this.data.updatedAt = Date.now();
    try {
      if (this.storage) this.storage.setItem(KEY, JSON.stringify(this.data));
    } catch (e) {
      this.memoryOnly = true;
    }
  }

  reset() {
    this.data = defaultSave();
    try {
      if (this.storage) {
        this.storage.removeItem(KEY);
        for (const k of LEGACY_KEYS) this.storage.removeItem(k);
      }
    } catch (e) {
      /* ignore */
    }
    this.save();
  }

  // ---- convenience guards ---------------------------------------------------
  hasCharacter(id) {
    return this.data.unlocks.characters.includes(id);
  }
  unlockCharacter(id) {
    if (!this.hasCharacter(id)) {
      this.data.unlocks.characters.push(id);
      this.save();
      return true;
    }
    return false;
  }
  hasShikigami(id) {
    return !!this.data.unlocks.shikigami[id];
  }
  tameShikigami(id) {
    if (!this.hasShikigami(id)) {
      this.data.unlocks.shikigami[id] = true;
      this.save();
      return true;
    }
    return false;
  }
  hasTotality(id) {
    return this.data.unlocks.totality.includes(id);
  }
  unlockTotality(id) {
    if (!this.hasTotality(id)) {
      this.data.unlocks.totality.push(id);
      this.save();
      return true;
    }
    return false;
  }
  tributeLevel(key) {
    return this.data.tribute[key] || 0;
  }
  addTribute(key) {
    this.data.tribute[key] = Math.min(12, (this.data.tribute[key] || 0) + 1);
    this.save();
  }
  addTributeCurrency(n) {
    this.data.tributeCurrency = clamp((this.data.tributeCurrency || 0) + n, 0, 9999999);
    this.save();
    return this.data.tributeCurrency;
  }
  addScore(entry) {
    this.data.highScores.push(entry);
    this.data.highScores.sort((a, b) => b.score - a.score);
    this.data.highScores = this.data.highScores.slice(0, 10);
    if (entry.score > this.data.stats.bestScore) this.data.stats.bestScore = entry.score;
    this.save();
  }
  addAdaptation(category, xp) {
    const a = this.data.adapt[category];
    if (!a) return 0;
    a.xp = clamp(a.xp + xp, 0, 999);
    while (a.stage < 4 && a.xp >= (a.stage + 1) * 20) a.stage++;
    return a.stage;
  }
  isFlag(name) {
    return !!this.data.story.flags[name];
  }
  setFlag(name, value = true) {
    this.data.story.flags[name] = value;
    this.save();
  }
}

export const saveSystem = new SaveSystem();
