// ---------------------------------------------------------------------------
// characters.js — playable character definitions.
//
// Every ability is data. The combat engine (game/combat.js) reads these fields
// generically: timing windows, hitboxes, costs, cooldowns, effects and tags all
// come from here, so adding a character never requires touching the engine.
//
// Ability schema (all optional except id/name/type):
//   cost, cd, startup, active, recovery, dmg, hits, range, arc, knockback,
//   hitstop, category, color, anim, sfx, move{}, proj{}, aoe{}, buff{}, mark{},
//   iframes, ult, domain, comboWindow, ceGain, ultGain, descend
// ---------------------------------------------------------------------------

export const CATEGORY_LABEL = {
  physical: 'Physical',
  cut: 'Cutting',
  blunt: 'Blunt',
  fire: 'Fire',
  electric: 'Electricity',
  water: 'Water',
  projectile: 'Projectile',
  area: 'Area',
  technique: 'Cursed Technique',
  domain: 'Domain',
};

const melee = (o) => ({ type: 'melee', startup: 0.08, active: 0.09, recovery: 0.16, category: 'physical', ...o });
const proj = (o) => ({ type: 'projectile', startup: 0.1, active: 0.05, recovery: 0.2, category: 'projectile', ...o });
const aoe = (o) => ({ type: 'aoe', startup: 0.14, active: 0.05, recovery: 0.22, category: 'area', ...o });
const dash = (o) => ({ type: 'dash', startup: 0.03, active: 0.14, recovery: 0.12, ...o });
const beam = (o) => ({ type: 'beam', startup: 0.3, active: 0.06, recovery: 0.35, ...o });
const buff = (o) => ({ type: 'buff', startup: 0.06, active: 0.05, recovery: 0.1, ...o });

export const CHARACTERS = {
  // ==========================================================================
  // YUJI ITADORI
  // ==========================================================================
  yuji: {
    id: 'yuji',
    name: 'Yuji Itadori',
    title: 'The Vessel',
    blurb: 'Close-range pressure fighter. Builds Black Flash chains with precise reinforcement timing.',
    hp: 115,
    ce: 100,
    power: 1,
    speed: 82,
    dashSpeed: 320,
    radius: 6,
    comboStyle: 'flurry',
    look: {
      skin: '#f0c8a0',
      hair: '#f2a2b8',
      hairStyle: 'spiky',
      top: '#232a3a',
      topDark: '#171c28',
      topLight: '#2f384c',
      bottom: '#1c2230',
      bottomDark: '#141926',
      accent: '#c33b52',
      eye: '#f7f7f7',
      weapon: 'none',
      faceMark: true,
      hitMark: true,
    },
    role: 'Yuji',
    aiStyle: 'rush',
    basic: [
      melee({ id: 'y1', name: 'Jab', dmg: 9, startup: 0.06, active: 0.07, recovery: 0.12, range: 22, arc: 1.5, knockback: 40, hitstop: 0.03, sfx: 'slash', comboWindow: 0.5, ceGain: 4, ultGain: 4, anim: 'attack', blackFlash: true }),
      melee({ id: 'y2', name: 'Hook', dmg: 11, startup: 0.07, active: 0.08, recovery: 0.14, range: 24, arc: 1.7, knockback: 60, hitstop: 0.04, sfx: 'hit', comboWindow: 0.55, ceGain: 4, ultGain: 4, anim: 'attack', swingDir: -1, blackFlash: true }),
      melee({ id: 'y3', name: 'Rising Uppercut', dmg: 16, startup: 0.1, active: 0.1, recovery: 0.24, range: 27, arc: 1.9, knockback: 130, hitstop: 0.07, sfx: 'heavy', comboWindow: 0.6, ceGain: 6, ultGain: 6, anim: 'kick', blackFlash: true, lunge: 40 }),
    ],
    abilities: [
      // 1) Gap closer
      {
        ...dash({
          id: 'yuji_crush', name: 'Crushing Blow', desc: 'Lunge forward and slam a reinforced fist into the target.',
          cost: 18, cd: 3.5, dmg: 26, range: 46, arc: 1.3, knockback: 150, hitstop: 0.09, category: 'blunt',
          color: '#ff8a5c', anim: 'attack', sfx: 'heavy', blackFlash: true, ultGain: 9,
        }),
        move: { type: 'lunge', speed: 430, dur: 0.13 },
        hitAt: 0.06,
      },
      // 2) Ranged-ish cursed energy palm wave
      {
        ...proj({
          id: 'yuji_palm', name: 'Cursed Palm Wave', desc: 'Release a short shockwave of cursed energy that staggers at range.',
          cost: 14, cd: 2.6, dmg: 15, range: 120, knockback: 70, hitstop: 0.04,
          color: '#ff9a6b', anim: 'cast', sfx: 'technique', category: 'technique', ultGain: 8,
        }),
        proj: { speed: 260, life: 0.5, radius: 7, color: '#ff9a6b', trail: '#ffd2b0', pierce: 1, knockback: 70 },
        range: 120,
      },
      // 3) Counter / parry
      {
        id: 'yuji_manji', name: 'Manji Kick', type: 'counter', desc: 'Assume a counter stance. If struck during the window, kick back for heavy damage.',
        cost: 20, cd: 6, startup: 0.04, active: 0.42, recovery: 0.18, dmg: 30, counterDmg: 44,
        range: 34, arc: 2.2, knockback: 180, hitstop: 0.1, category: 'blunt', color: '#ffd166',
        anim: 'guard', sfx: 'reinforce', ultGain: 12, blackFlash: true,
      },
      // 4) Mobility / shoulder charge
      {
        ...dash({
          id: 'yuji_sprint', name: 'Sprint', desc: 'Burst forward. Contact knocks enemies aside and refunds a little CE.',
          cost: 8, cd: 1.8, dmg: 8, range: 26, arc: 1.2, knockback: 90, hitstop: 0.03,
          category: 'physical', color: '#9ad0ff', anim: 'dodge', sfx: 'dodge', ultGain: 5,
        }),
        move: { type: 'dash', speed: 430, dur: 0.16, iframes: 0.1 },
        hitAt: 0.02,
      },
    ],
    ultimate: {
      id: 'yuji_ult', name: 'Black Flash: Soul Barrage', desc: 'Unleash a relentless barrage that forces three Black Flash detonations.',
      cost: 0, cd: 0, type: 'ultimate', dmg: 120, hits: 3, interval: 0.16, range: 60,
      category: 'technique', color: '#ff1e3c', anim: 'attack', sfx: 'blackflash', ultCost: 100,
    },
    domain: null,
    passive: 'Black Flash timing window is 60% wider than other sorcerers.',
    blackFlashMod: 1.6,
    masteryPerk: ['+6 max HP per mastery level', '+2% Black Flash window per mastery level'],
  },

  // ==========================================================================
  // MEGUMI FUSHIGURO
  // ==========================================================================
  megumi: {
    id: 'megumi',
    name: 'Megumi Fushiguro',
    title: 'Ten Shadows User',
    blurb: 'Tactical summoner. Controls space with shadow steps and a full roster of shikigami.',
    hp: 105,
    ce: 120,
    power: 0.95,
    speed: 84,
    dashSpeed: 340,
    radius: 6,
    comboStyle: 'blade',
    look: {
      skin: '#e8c0a0',
      hair: '#1b1b24',
      hairStyle: 'wild',
      top: '#1b2436',
      topDark: '#121a28',
      topLight: '#28344c',
      bottom: '#161d2b',
      bottomDark: '#0f151f',
      accent: '#6f8fd0',
      eye: '#cfe6ff',
      weapon: 'none',
      longCoat: true,
    },
    role: 'Megumi',
    aiStyle: 'tactical',
    basic: [
      melee({ id: 'm1', name: 'Shadow Jab', dmg: 8, startup: 0.07, active: 0.08, recovery: 0.13, range: 23, arc: 1.5, knockback: 40, hitstop: 0.03, color: '#8fa8e8', comboWindow: 0.5, ceGain: 5, ultGain: 5, anim: 'attack' }),
      melee({ id: 'm2', name: 'Shadow Sweep', dmg: 10, startup: 0.08, active: 0.09, recovery: 0.15, range: 26, arc: 1.8, knockback: 55, hitstop: 0.04, color: '#8fa8e8', comboWindow: 0.55, ceGain: 5, ultGain: 5, anim: 'attack', swingDir: -1 }),
      melee({ id: 'm3', name: 'Shade Fang', dmg: 15, startup: 0.11, active: 0.1, recovery: 0.22, range: 30, arc: 1.9, knockback: 110, hitstop: 0.07, color: '#6f8fd0', sfx: 'heavy', comboWindow: 0.6, ceGain: 7, ultGain: 7, anim: 'attack', lunge: 36 }),
    ],
    abilities: [
      {
        ...proj({
          id: 'megumi_bolt', name: 'Shadow Bolt', desc: 'Fire condensed shadow. Slows the target briefly.',
          cost: 12, cd: 2.2, dmg: 16, range: 170, knockback: 45, color: '#7f6bff',
          anim: 'cast', sfx: 'technique', ultGain: 8, category: 'technique',
        }),
        proj: { speed: 300, life: 0.9, radius: 6, color: '#7f6bff', trail: '#c3b6ff', pierce: 1, slow: 0.4, slowDur: 1.2 },
      },
      {
        id: 'megumi_step', name: 'Shadow Step', type: 'blink', desc: 'Sink into shadow and reappear further along your aim. Brief invulnerability.',
        cost: 16, cd: 4, startup: 0.05, active: 0.05, recovery: 0.14, dmg: 0, range: 110,
        color: '#5b4bd6', anim: 'dodge', sfx: 'dodge', ultGain: 6, category: 'technique',
        blink: { dist: 110, iframes: 0.35 },
      },
      {
        id: 'megumi_summon', name: 'Ten Shadows', type: 'summon', desc: 'Cycle and summon a tamed shikigami. Only one greater summon at a time.',
        cost: 25, cd: 2.0, startup: 0.2, active: 0.1, recovery: 0.2, category: 'technique',
        color: '#8f7bff', anim: 'cast', sfx: 'summon', ultGain: 10,
        summon: { duration: 14, costPerSecond: 0 },
      },
      {
        id: 'megumi_command', name: 'Shikigami Command', type: 'command', desc: 'Order every summon to strike your target. Bonded summons hit harder.',
        cost: 22, cd: 7, startup: 0.12, active: 0.1, recovery: 0.2, dmg: 22,
        color: '#a79bff', anim: 'cast', sfx: 'shikigami', ultGain: 12, category: 'technique',
      },
    ],
    ultimate: {
      id: 'megumi_ult', name: 'Ten Shadows: Ultimate', desc: 'At 50%: summon Agito. At 100%: summon Mahoraga. Consumes the meter.',
      type: 'tenShadowsUlt', cost: 0, cd: 0, ultCost: 50,
    },
    domain: {
      id: 'chimera_garden', name: 'Chimera Shadow Garden', type: 'domain', cost: 55, cd: 34, dur: 14,
      desc: 'Shadow floods the arena: summons gain frenzy, movement speeds up, and enemies are dragged by the tide.',
      color: '#3b2a8a', anim: 'cast', sfx: 'domain',
    },
    passive: 'Summons inherit part of Megumi\'s power. Command skills build the Ten Shadows meter faster.',
    blackFlashMod: 1,
    masteryPerk: ['+1 summon duration per mastery level', '+3% summon damage per mastery level'],
  },

  // ==========================================================================
  // NOBARA KUGISAKI
  // ==========================================================================
  nobara: {
    id: 'nobara',
    name: 'Nobara Kugisaki',
    title: 'Straw Doll Technique',
    blurb: 'Mid-range precision. Marks targets, plants nails, then detonates everything at once.',
    hp: 100,
    ce: 100,
    power: 1,
    speed: 80,
    dashSpeed: 320,
    radius: 6,
    comboStyle: 'hammer',
    look: {
      skin: '#f0c8a8',
      hair: '#c06a3a',
      hairStyle: 'bob',
      top: '#2a2230',
      topDark: '#1c1722',
      topLight: '#3a3044',
      bottom: '#231c2a',
      bottomDark: '#191320',
      accent: '#e0a040',
      eye: '#f7e6c8',
      weapon: 'hammer',
      skirt: true,
      hitMark: true,
    },
    role: 'Nobara',
    aiStyle: 'zoner',
    basic: [
      melee({ id: 'n1', name: 'Hammer Jab', dmg: 9, startup: 0.09, active: 0.08, recovery: 0.14, range: 24, arc: 1.4, knockback: 50, hitstop: 0.04, category: 'blunt', comboWindow: 0.5, ceGain: 4, ultGain: 4, anim: 'attack' }),
      melee({ id: 'n2', name: 'Hammer Swing', dmg: 12, startup: 0.1, active: 0.1, recovery: 0.16, range: 27, arc: 1.8, knockback: 80, hitstop: 0.05, category: 'blunt', comboWindow: 0.55, ceGain: 5, ultGain: 5, anim: 'attack', swingDir: -1 }),
      melee({ id: 'n3', name: 'Skull Cracker', dmg: 17, startup: 0.13, active: 0.11, recovery: 0.25, range: 30, arc: 1.7, knockback: 140, hitstop: 0.08, category: 'blunt', sfx: 'heavy', comboWindow: 0.6, ceGain: 7, ultGain: 7, anim: 'attack', lunge: 26 }),
    ],
    abilities: [
      {
        ...proj({
          id: 'nobara_nail', name: 'Nail Shot', desc: 'Drive a cursed nail forward. Applies Resonance Mark.',
          cost: 9, cd: 1.5, dmg: 13, range: 220, knockback: 35, color: '#f0d8a0', category: 'projectile',
          anim: 'cast', sfx: 'technique', ultGain: 6,
        }),
        proj: { speed: 420, life: 1.0, radius: 4, color: '#ffe9b0', trail: '#fff6d8', pierce: 1, mark: true },
      },
      {
        ...proj({
          id: 'nobara_storm', name: 'Nail Storm', desc: 'Scatter five nails in a cone. Each hit adds a mark stack.',
          cost: 20, cd: 4.5, dmg: 9, hits: 5, range: 150, knockback: 20, color: '#ffd88a',
          category: 'projectile', anim: 'cast', sfx: 'technique', ultGain: 10,
        }),
        proj: { speed: 340, life: 0.55, radius: 4, color: '#ffe9b0', trail: '#fff0c0', pierce: 1, count: 5, spread: 0.75, mark: true },
      },
      {
        id: 'nobara_resonance', name: 'Resonance', type: 'mark', desc: 'Hammer a straw doll. Every marked enemy takes resonance damage and is linked.',
        cost: 24, cd: 6, startup: 0.22, active: 0.1, recovery: 0.22, dmg: 18, range: 150,
        color: '#ff6b8a', anim: 'cast', sfx: 'mark', ultGain: 12, category: 'technique',
        mark: { dur: 8, bonus: 0.25, linkRadius: 900 },
      },
      {
        id: 'nobara_hairpin', name: 'Hairpin', type: 'aoe', desc: 'Detonate every nail in the target area. Damage scales with mark stacks.',
        cost: 26, cd: 5.5, startup: 0.12, active: 0.06, recovery: 0.22, dmg: 20, range: 120,
        color: '#ff9a5c', category: 'area', anim: 'cast', sfx: 'heavy', ultGain: 12,
        aoe: { radius: 62, atTarget: true, delay: 0.16, burst: true, markBonus: 12 },
      },
    ],
    ultimate: {
      id: 'nobara_ult', name: 'Absolute Resonance', desc: 'Shatter every mark at once. Linked enemies share the full damage.',
      type: 'ultimate', cost: 0, cd: 0, dmg: 90, category: 'technique', color: '#ff3d6a',
      anim: 'cast', sfx: 'ult', ultCost: 100,
    },
    domain: null,
    passive: 'Marked enemies take +25% damage from Nobara. Hairpin consumes marks for bonus damage.',
    blackFlashMod: 1,
    masteryPerk: ['+4% mark damage per mastery level', '+1 nail in Nail Storm per 2 levels'],
  },

  // ==========================================================================
  // SATORU GOJO
  // ==========================================================================
  gojo: {
    id: 'gojo',
    name: 'Satoru Gojo',
    title: 'The Strongest',
    blurb: 'Space manipulation with heavy resource demands. Infinity is a timed defence, not immunity.',
    hp: 95,
    ce: 130,
    power: 1.05,
    speed: 88,
    dashSpeed: 350,
    radius: 6,
    comboStyle: 'palm',
    look: {
      skin: '#f0d0b8',
      hair: '#eef2ff',
      hairStyle: 'spiky',
      top: '#12141c',
      topDark: '#0b0d13',
      topLight: '#22242f',
      bottom: '#12141c',
      bottomDark: '#0b0d13',
      accent: '#5b8cff',
      eye: '#9fd8ff',
      weapon: 'none',
      blindfold: '#151824',
      longCoat: true,
    },
    role: 'Gojo',
    aiStyle: 'control',
    basic: [
      melee({ id: 'g1', name: 'Palm Strike', dmg: 9, startup: 0.07, active: 0.07, recovery: 0.13, range: 25, arc: 1.4, knockback: 55, hitstop: 0.03, color: '#9fd8ff', comboWindow: 0.5, ceGain: 5, ultGain: 4, anim: 'attack' }),
      melee({ id: 'g2', name: 'Space Palm', dmg: 12, startup: 0.09, active: 0.08, recovery: 0.16, range: 28, arc: 1.6, knockback: 90, hitstop: 0.05, color: '#9fd8ff', comboWindow: 0.55, ceGain: 5, ultGain: 5, anim: 'attack', swingDir: -1 }),
      melee({ id: 'g3', name: 'Reversal Tap', dmg: 15, startup: 0.11, active: 0.1, recovery: 0.24, range: 30, arc: 1.8, knockback: 140, hitstop: 0.08, color: '#7ec8ff', sfx: 'heavy', comboWindow: 0.6, ceGain: 7, ultGain: 6, anim: 'kick', lunge: 24 }),
    ],
    abilities: [
      {
        ...aoe({
          id: 'gojo_blue', name: 'Cursed Technique Lapse: Blue', desc: 'Compress space. Pulls enemies inward and grinds them.',
          cost: 26, cd: 6, dmg: 24, range: 120, category: 'technique', color: '#4a7bff',
          anim: 'cast', sfx: 'technique', ultGain: 14,
        }),
        aoe: { radius: 56, atTarget: true, delay: 0.22, pull: 240, pullDur: 0.5, ticks: 3, tickInterval: 0.16 },
      },
      {
        ...aoe({
          id: 'gojo_red', name: 'Cursed Technique Reversal: Red', desc: 'Divergent repulsion blast. Massive knockback.',
          cost: 30, cd: 7, dmg: 34, range: 110, category: 'technique', color: '#ff3b5c',
          anim: 'cast', sfx: 'heavy', ultGain: 14,
        }),
        aoe: { radius: 48, atTarget: true, delay: 0.18, push: 420, knockback: 220, hitstop: 0.1, shake: 5 },
      },
      {
        ...buff({
          id: 'gojo_infinity', name: 'Infinity', desc: 'Slow every incoming attack to a crawl. Costs CE over time; breaks after 5 hits.',
          cost: 22, cd: 12, category: 'technique', color: '#a8d8ff', anim: 'guard', sfx: 'reinforce', ultGain: 10,
        }),
        buff: { id: 'infinity', dur: 2.6, hits: 5, ceUpkeep: 7 },
      },
      {
        id: 'gojo_warp', name: 'Spatial Warp', type: 'blink', desc: 'Fold space to reposition instantly. Leaves a damaging tear.',
        cost: 20, cd: 5, startup: 0.04, active: 0.06, recovery: 0.12, dmg: 12, range: 120,
        color: '#7ec8ff', anim: 'dodge', sfx: 'dodge', ultGain: 8, category: 'technique',
        blink: { dist: 120, iframes: 0.3, leaveRift: true, riftDmg: 14 },
      },
    ],
    ultimate: {
      id: 'gojo_ult', name: 'Imaginary Technique: Hollow Purple', desc: 'Collide Blue and Red. A beam that erases everything in its path.',
      type: 'ultimate', cost: 0, cd: 0, dmg: 130, category: 'technique', color: '#b06bff',
      anim: 'cast', sfx: 'beam', ultCost: 100, beam: { length: 300, width: 30, dur: 0.45 },
    },
    domain: {
      id: 'unlimited_void', name: 'Domain Expansion: Unlimited Void', type: 'domain', cost: 70, cd: 40, dur: 8,
      desc: 'Infinite information. Enemies are stunned and take rising technique damage, but the domain drains CE.',
      color: '#9fd8ff', anim: 'cast', sfx: 'domain',
    },
    passive: 'Techniques cost more CE, but Gojo regenerates CE 25% faster.',
    blackFlashMod: 1,
    masteryPerk: ['+1 Infinity hit per 3 levels', '+2% technique damage per mastery level'],
  },

  // ==========================================================================
  // RYOMEN SUKUNA
  // ==========================================================================
  sukuna: {
    id: 'sukuna',
    name: 'Ryomen Sukuna',
    title: 'King of Curses',
    blurb: 'Overwhelming cutting pressure. Dismantle at range, Cleave up close, Malevolent Shrine to erase the field.',
    hp: 130,
    ce: 120,
    power: 1.12,
    speed: 80,
    dashSpeed: 330,
    radius: 7,
    comboStyle: 'cut',
    look: {
      skin: '#e8c4a8',
      hair: '#f0a0b8',
      hairStyle: 'spiky',
      top: '#2a1a24',
      topDark: '#1a0f16',
      topLight: '#3a2430',
      bottom: '#241620',
      bottomDark: '#170d13',
      accent: '#c0392b',
      eye: '#ff9a9a',
      weapon: 'claw',
      tattoos: true,
      longCoat: true,
    },
    role: 'Sukuna',
    aiStyle: 'predator',
    basic: [
      melee({ id: 's1', name: 'Claw Slash', dmg: 10, startup: 0.06, active: 0.07, recovery: 0.12, range: 26, arc: 1.6, category: 'cut', color: '#ff6b6b', comboWindow: 0.5, ceGain: 4, ultGain: 4, anim: 'attack' }),
      melee({ id: 's2', name: 'Rending Cross', dmg: 12, startup: 0.07, active: 0.08, recovery: 0.13, range: 28, arc: 1.8, category: 'cut', color: '#ff6b6b', comboWindow: 0.5, ceGain: 4, ultGain: 4, anim: 'attack', swingDir: -1 }),
      melee({ id: 's3', name: 'Cleaving Palm', dmg: 14, startup: 0.08, active: 0.08, recovery: 0.15, range: 30, arc: 1.9, category: 'cut', color: '#ff4d4d', knockback: 70, comboWindow: 0.5, ceGain: 5, ultGain: 5, anim: 'attack' }),
      melee({ id: 's4', name: 'Guillotine', dmg: 20, startup: 0.12, active: 0.1, recovery: 0.24, range: 32, arc: 2.0, category: 'cut', color: '#ff2a2a', knockback: 150, hitstop: 0.08, sfx: 'heavy', comboWindow: 0.6, ceGain: 7, ultGain: 7, anim: 'attack', lunge: 30 }),
    ],
    abilities: [
      {
        ...proj({
          id: 'sukuna_dismantle', name: 'Dismantle', desc: 'Invisible slash that travels forward and cuts everything in a line.',
          cost: 14, cd: 2.0, dmg: 18, range: 240, category: 'cut', color: '#ff5a5a',
          anim: 'attack', sfx: 'slash', ultGain: 8,
        }),
        proj: { speed: 520, life: 0.6, radius: 6, color: '#ff5a5a', trail: '#ffb0b0', pierce: 3, wide: 16, hitstop: 0.05 },
      },
      {
        ...melee({
          id: 'sukuna_cleave', name: 'Cleave', desc: 'A close-range cut that scales with the target\'s missing health.',
          cost: 18, cd: 3.0, dmg: 26, startup: 0.1, active: 0.12, recovery: 0.2, range: 40, arc: 2.4,
          knockback: 120, hitstop: 0.08, category: 'cut', color: '#ff3030', anim: 'attack', sfx: 'heavy', ultGain: 10,
          execute: true,
        }),
      },
      {
        ...aoe({
          id: 'sukuna_spiderweb', name: 'Spiderweb Slash', desc: 'Carve a lattice of cuts around you. Marks enemies for follow-up.',
          cost: 26, cd: 6, dmg: 20, hits: 3, range: 70, category: 'cut', color: '#ff4040',
          anim: 'attack', sfx: 'slash', ultGain: 14,
        }),
        aoe: { radius: 70, atSelf: true, delay: 0.1, ticks: 3, tickInterval: 0.14, mark: true, knockback: 60 },
      },
      {
        id: 'sukuna_fire', name: 'Flame Arrow', type: 'projectile', desc: 'Open the shrine: a slow arrow of fire that detonates on impact.',
        cost: 30, cd: 8, startup: 0.3, active: 0.06, recovery: 0.28, dmg: 42, range: 320,
        category: 'fire', color: '#ff8a2a', anim: 'cast', sfx: 'technique', ultGain: 16,
        proj: { speed: 240, life: 1.6, radius: 7, color: '#ff8a2a', trail: '#ffd06a', pierce: 0, explode: { radius: 44, dmg: 28 } },
      },
    ],
    ultimate: {
      id: 'sukuna_ult', name: 'Divergent Slash: World Cut', desc: 'A single cut through space, then a delayed second cut across the same line.',
      type: 'ultimate', cost: 0, cd: 0, dmg: 110, category: 'cut', color: '#ff2a2a',
      anim: 'attack', sfx: 'ult', ultCost: 100, delayed: { dmg: 90, delay: 0.9, radius: 90 },
    },
    domain: {
      id: 'malevolent_shrine', name: 'Domain Expansion: Malevolent Shrine', type: 'domain', cost: 65, cd: 38, dur: 10,
      desc: 'A shrine of dismantling. Continuous cuts sweep the field; marked targets take empowered slashes.',
      color: '#c0392b', anim: 'cast', sfx: 'domain',
    },
    passive: 'Cutting attacks build the ultimate meter faster. Cleave executes weakened enemies.',
    blackFlashMod: 1.15,
    masteryPerk: ['+2% cutting damage per mastery level', 'Shrine duration +0.4s per mastery level'],
  },
};

export const PLAYABLE_ORDER = ['yuji', 'megumi', 'nobara', 'gojo', 'sukuna'];

export const UNLOCK_HINTS = {
  nobara: 'Complete the Fearsome Womb arc.',
  gojo: 'Clear the Kyoto Goodwill Event arc.',
  sukuna: 'Survive the Shibuya Incident arc.',
};

export function getCharacter(id) {
  return CHARACTERS[id] || CHARACTERS.yuji;
}

export function abilitiesOf(charId) {
  const c = getCharacter(charId);
  const list = [...c.abilities];
  if (c.ultimate) list.push(c.ultimate);
  if (c.domain) list.push(c.domain);
  return list;
}
