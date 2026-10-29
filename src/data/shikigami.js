// ---------------------------------------------------------------------------
// shikigami.js — the complete Ten Shadows roster, Totality paths, Agito and
// Mahoraga. Each summon has its own rig, palette, AI profile, moveset and
// taming encounter rules. All of them run through the same combat engine.
// ---------------------------------------------------------------------------

export const SHIKIGAMI = {
  divineDogs: {
    id: 'divineDogs',
    name: 'Divine Dogs',
    title: 'Twin wolves of shadow',
    desc: 'A bonded pair of shadow wolves. Fast, relentless and cheap to keep on the field.',
    cost: 18,
    hp: 90,
    duration: 16,
    speed: 132,
    rig: 'divineDog',
    pal: { main: '#3b2f52', dark: '#241c34', light: '#6b5b8f', accent: '#a79bff' },
    scale: 1,
    count: 2,
    role: 'rush',
    ai: { preferredRange: 16, cooldown: 0.75, aggression: 0.9 },
    starter: true,
    abilities: [
      { id: 'dogBite', name: 'Savage Bite', type: 'melee', dmg: 7, startup: 0.1, active: 0.08, recovery: 0.3, range: 20, arc: 1.6, knockback: 30, hitstop: 0.02, category: 'cut', color: '#a79bff', anim: 'attack' },
      { id: 'dogPounce', name: 'Shadows Pounce', type: 'dash', dmg: 10, startup: 0.08, active: 0.12, recovery: 0.4, range: 26, arc: 1.4, knockback: 60, hitstop: 0.04, category: 'physical', color: '#8f7bff', anim: 'attack', move: { type: 'lunge', speed: 340, dur: 0.13 }, cd: 3 },
    ],
    tame: {
      desc: 'Two wolves, one shadow. They are already bonded to you — no ritual required.',
      hp: 120,
      rule: 'none',
      unlocks: 'no ritual needed',
    },
  },

  nue: {
    id: 'nue',
    name: 'Nue',
    title: 'Winged shadow',
    desc: 'An aerial shikigami that rains lightning and dives at distant targets.',
    cost: 22,
    hp: 100,
    duration: 16,
    speed: 150,
    rig: 'nue',
    pal: { main: '#3a3550', dark: '#241f33', light: '#8f7bff', accent: '#ffe14d' },
    scale: 1,
    hover: 14,
    role: 'aerial',
    ai: { preferredRange: 60, cooldown: 1.2, aggression: 0.75 },
    abilities: [
      { id: 'nueBolt', name: 'Thunder Wing', type: 'projectile', dmg: 8, startup: 0.14, active: 0.05, recovery: 0.4, category: 'electric', color: '#ffe14d', anim: 'cast', proj: { speed: 260, life: 0.9, radius: 5, color: '#ffe14d', trail: '#bff0ff', pierce: 1, chain: 2 }, cd: 2.2 },
      { id: 'nueDive', name: 'Diving Talon', type: 'dash', dmg: 12, startup: 0.16, active: 0.14, recovery: 0.45, range: 24, arc: 1.4, knockback: 70, hitstop: 0.04, category: 'physical', color: '#8fd7ff', anim: 'attack', move: { type: 'lunge', speed: 480, dur: 0.16 }, cd: 3.4 },
    ],
    tame: {
      desc: 'Nue never lands. Bring it down and prove you can reach the sky.',
      hp: 220,
      rule: 'timer',
      time: 70,
      unlocks: 'Nue summon',
    },
  },

  greatSerpent: {
    id: 'greatSerpent',
    name: 'Great Serpent',
    title: 'Shadow of the deep',
    desc: 'A huge serpent that burrows through shadow and emerges behind its prey.',
    cost: 26,
    hp: 130,
    duration: 15,
    speed: 118,
    rig: 'greatSerpent',
    pal: { main: '#4a3b6b', dark: '#2a2040', light: '#8f7bff', accent: '#c9a2ff' },
    scale: 1.15,
    role: 'ambush',
    ai: { preferredRange: 30, cooldown: 1.6, aggression: 0.8 },
    abilities: [
      { id: 'serpentBite', name: 'Venom Fang', type: 'melee', dmg: 11, startup: 0.16, active: 0.1, recovery: 0.45, range: 30, arc: 1.3, knockback: 40, hitstop: 0.04, category: 'physical', color: '#c9a2ff', anim: 'attack', cd: 2.2 },
      { id: 'serpentLunge', name: 'Burrow Ambush', type: 'dash', dmg: 18, startup: 0.4, active: 0.16, recovery: 0.5, range: 34, arc: 1.5, knockback: 110, hitstop: 0.07, category: 'physical', color: '#a78bff', anim: 'attack', move: { type: 'blinkStrike', dist: 90, iframes: 0.3 }, cd: 5 },
      { id: 'serpentConstrict', name: 'Constrict', type: 'aoe', dmg: 9, startup: 0.25, active: 0.1, recovery: 0.4, category: 'physical', color: '#8f7bff', anim: 'attack', aoe: { radius: 34, atTarget: true, root: 1.2, delay: 0.2 }, cd: 6 },
    ],
    tame: {
      desc: 'The Great Serpent strikes from below. Track the shadows and punish its emergence.',
      hp: 300,
      rule: 'ambush',
      unlocks: 'Great Serpent summon',
    },
  },

  toad: {
    id: 'toad',
    name: 'Toad',
    title: 'Tongue of the marsh',
    desc: 'Utility summon. Tongue-lashes pull enemies out of position and yank you free of danger.',
    cost: 18,
    hp: 120,
    duration: 15,
    speed: 110,
    rig: 'toad',
    pal: { main: '#4a5a3a', dark: '#2c3824', light: '#8aa06a', accent: '#f0778a' },
    scale: 1.05,
    role: 'utility',
    ai: { preferredRange: 55, cooldown: 1.4, aggression: 0.5 },
    abilities: [
      { id: 'toadLash', name: 'Tongue Lash', type: 'melee', dmg: 8, startup: 0.18, active: 0.1, recovery: 0.4, range: 46, arc: 0.8, knockback: 20, hitstop: 0.03, category: 'physical', color: '#f0778a', anim: 'attack', pull: 90, cd: 2.4 },
      { id: 'toadGuard', name: 'Warding Croak', type: 'aoe', dmg: 6, startup: 0.2, active: 0.1, recovery: 0.4, category: 'area', color: '#8aa06a', anim: 'cast', aoe: { radius: 52, atSelf: true, delay: 0.1, stun: 0.6, healOwner: 6 }, cd: 7 },
    ],
    tame: {
      desc: 'The Toad will try to drag you into the mud. Keep your feet and break its guard.',
      hp: 260,
      rule: 'pull',
      unlocks: 'Toad summon',
    },
  },

  maxElephant: {
    id: 'maxElephant',
    name: 'Max Elephant',
    title: 'Mountain of water',
    desc: 'Slow, enormous, and devastating. Calls water from nowhere and floods the field.',
    cost: 32,
    hp: 200,
    duration: 16,
    speed: 72,
    rig: 'maxElephant',
    pal: { main: '#4a5a6b', dark: '#2a3540', light: '#9fb8c9', accent: '#8fe3ff' },
    scale: 1.3,
    role: 'tank',
    ai: { preferredRange: 40, cooldown: 2.2, aggression: 0.6 },
    abilities: [
      { id: 'elephantJet', name: 'Water Jet', type: 'projectile', dmg: 10, startup: 0.3, active: 0.08, recovery: 0.6, category: 'water', color: '#8fe3ff', anim: 'cast', proj: { speed: 240, life: 1.2, radius: 8, color: '#8fe3ff', trail: '#dff6ff', pierce: 2, knockback: 90 }, cd: 3.4 },
      { id: 'elephantSlam', name: 'Crushing Fall', type: 'aoe', dmg: 22, startup: 0.5, active: 0.12, recovery: 0.7, category: 'blunt', color: '#9fb8c9', anim: 'attack', aoe: { radius: 66, atSelf: true, delay: 0.2, knockback: 150, shake: 6 }, cd: 6.5 },
    ],
    tame: {
      desc: 'Max Elephant will not be moved. Endure the flood and break its stance.',
      hp: 420,
      rule: 'armor',
      unlocks: 'Max Elephant summon',
    },
  },

  rabbitEscape: {
    id: 'rabbitEscape',
    name: 'Rabbit Escape',
    title: 'A hundred shadows',
    desc: 'A swarm of rabbits that pulls attention away from you. Utility, not damage.',
    cost: 14,
    hp: 30,
    duration: 12,
    speed: 150,
    rig: 'rabbit',
    pal: { main: '#d8d0e0', dark: '#a89ab8', light: '#f2edf8', accent: '#ffb0c8' },
    scale: 0.75,
    count: 8,
    role: 'swarm',
    ai: { preferredRange: 24, cooldown: 1.2, aggression: 0.3 },
    starter: true,
    abilities: [
      { id: 'rabbitBump', name: 'Swarm Bump', type: 'melee', dmg: 2, startup: 0.1, active: 0.06, recovery: 0.3, range: 12, arc: 2.4, knockback: 10, hitstop: 0.0, category: 'physical', color: '#ffb0c8', anim: 'attack', taunt: 1.4 },
    ],
    tame: {
      desc: 'Already yours. Rabbit Escape exists to be everywhere at once.',
      hp: 60,
      rule: 'none',
      unlocks: 'no ritual needed',
    },
  },

  roundDeer: {
    id: 'roundDeer',
    name: 'Round Deer',
    title: 'Reverse cursed energy',
    desc: 'A calm presence that mends wounds and disrupts cursed techniques around it.',
    cost: 28,
    hp: 150,
    duration: 18,
    speed: 96,
    rig: 'roundDeer',
    pal: { main: '#6b5a4a', dark: '#3a3026', light: '#c9b89a', accent: '#bff0d0' },
    scale: 1.1,
    role: 'support',
    ai: { preferredRange: 46, cooldown: 2.4, aggression: 0.35 },
    abilities: [
      { id: 'deerAura', name: 'Reverse Aura', type: 'aoe', dmg: 0, startup: 0.4, active: 0.1, recovery: 0.6, category: 'area', color: '#bff0d0', anim: 'cast', aoe: { radius: 62, atSelf: true, delay: 0.2, healOwner: 14, cleanse: true, disrupt: 2 }, cd: 9 },
      { id: 'deerBolt', name: 'Positive Burst', type: 'projectile', dmg: 7, startup: 0.2, active: 0.05, recovery: 0.5, category: 'technique', color: '#bff0d0', anim: 'cast', proj: { speed: 220, life: 1.0, radius: 6, color: '#bff0d0', trail: '#e8fff2', pierce: 1, disrupt: 1.5 }, cd: 5 },
    ],
    tame: {
      desc: 'Round Deer will heal itself endlessly. Out-damage the reverse cursed energy.',
      hp: 340,
      rule: 'regen',
      unlocks: 'Round Deer summon',
    },
  },

  piercingOx: {
    id: 'piercingOx',
    name: 'Piercing Ox',
    title: 'Unstoppable charge',
    desc: 'Telegraphs a long charge. The further it runs, the more damage it deals.',
    cost: 26,
    hp: 170,
    duration: 15,
    speed: 90,
    rig: 'piercingOx',
    pal: { main: '#4a3f36', dark: '#2a241e', light: '#8a7a64', accent: '#ffd166' },
    scale: 1.2,
    role: 'charge',
    ai: { preferredRange: 90, cooldown: 2.6, aggression: 0.85 },
    abilities: [
      { id: 'oxCharge', name: 'Piercing Charge', type: 'dash', dmg: 20, startup: 0.65, active: 0.3, recovery: 0.55, range: 30, arc: 1.2, knockback: 200, hitstop: 0.08, category: 'blunt', color: '#ffd166', anim: 'attack', move: { type: 'charge', speed: 460, dur: 0.45, ramp: true }, cd: 5 },
      { id: 'oxStomp', name: 'Ground Stomp', type: 'aoe', dmg: 10, startup: 0.3, active: 0.1, recovery: 0.5, category: 'blunt', color: '#8a7a64', anim: 'attack', aoe: { radius: 42, atSelf: true, delay: 0.15, stun: 0.5 }, cd: 8 },
    ],
    tame: {
      desc: 'Step aside from the charge and strike while it is winded.',
      hp: 330,
      rule: 'charge',
      unlocks: 'Piercing Ox summon',
    },
  },

  mourningTiger: {
    id: 'mourningTiger',
    name: 'Mourning Tiger',
    title: 'Silent predator',
    desc: 'A close-range predator that opens wounds and thrives in Totality combinations.',
    cost: 30,
    hp: 160,
    duration: 16,
    speed: 140,
    rig: 'mourningTiger',
    pal: { main: '#c08a3a', dark: '#2a2018', light: '#f0d090', accent: '#ffe14d' },
    scale: 1.15,
    role: 'predator',
    ai: { preferredRange: 18, cooldown: 1.0, aggression: 0.95 },
    abilities: [
      { id: 'tigerClaw', name: 'Rending Claw', type: 'melee', dmg: 9, startup: 0.08, active: 0.09, recovery: 0.28, range: 24, arc: 1.8, category: 'cut', color: '#ffe14d', anim: 'attack', bleed: 3, cd: 1.6 },
      { id: 'tigerMaul', name: 'Mourning Maul', type: 'melee', dmg: 18, startup: 0.2, active: 0.12, recovery: 0.5, range: 30, arc: 2.0, knockback: 120, hitstop: 0.06, category: 'cut', color: '#ffbe3a', anim: 'attack', cd: 4 },
    ],
    tame: {
      desc: 'The Mourning Tiger hunts without warning. Punish its recovery windows.',
      hp: 320,
      rule: 'hunter',
      unlocks: 'Mourning Tiger summon',
    },
  },

  mahoraga: {
    id: 'mahoraga',
    name: 'Mahoraga',
    title: 'Eight-Handled Sword Divergent Sila Divine General',
    desc: 'The untamed shadow. Adapts to every attack it survives and retaliates with the wheel.',
    cost: 0,
    hp: 620,
    duration: 60,
    isUltimate: true,
    speed: 104,
    rig: 'mahoraga',
    pal: { main: '#6f6a5e', dark: '#3a382f', light: '#c9c2b0', accent: '#ffd166' },
    scale: 1.4,
    role: 'boss',
    ai: { preferredRange: 34, cooldown: 1.6, aggression: 0.85 },
    abilities: [
      { id: 'mahoSlash', name: 'Sword of Divergent Sila', type: 'melee', dmg: 22, startup: 0.25, active: 0.12, recovery: 0.5, range: 40, arc: 2.2, knockback: 180, hitstop: 0.07, category: 'cut', color: '#e6e0d0', anim: 'attack', cd: 2.4 },
      { id: 'mahoCrush', name: 'Divine General Slam', type: 'aoe', dmg: 26, startup: 0.5, active: 0.14, recovery: 0.7, category: 'blunt', color: '#c9c2b0', anim: 'attack', aoe: { radius: 60, atTarget: true, delay: 0.2, knockback: 200, shake: 8 }, cd: 6 },
      { id: 'mahoLeap', name: 'General\'s Leap', type: 'dash', dmg: 16, startup: 0.2, active: 0.16, recovery: 0.4, range: 30, arc: 1.6, knockback: 120, category: 'physical', color: '#ffd166', anim: 'attack', move: { type: 'lunge', speed: 420, dur: 0.18 }, cd: 5 },
      { id: 'mahoUlt', name: 'Wheel of Adaptation: Judgement', type: 'aoe', dmg: 60, startup: 0.9, active: 0.2, recovery: 0.9, category: 'area', color: '#ffd166', anim: 'attack', aoe: { radius: 90, atSelf: true, delay: 0.3, knockback: 260, shake: 10 }, cd: 22, ult: true },
    ],
    tame: {
      desc: 'The Divine General has never been tamed. Survive its wheel and break its adaptation.',
      hp: 1400,
      rule: 'adapt',
      unlocks: 'Mahoraga summon + adaptation memory',
    },
  },
};

export const SHIKIGAMI_ORDER = [
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

// ---------------------------------------------------------------------------
// Agito — dedicated combined summon (not a reskin). 50% Ten Shadows meter.
// ---------------------------------------------------------------------------
export const AGITO = {
  id: 'agito',
  name: 'Agito',
  title: 'Totality of shadow',
  desc: 'A combined shikigami of the Divine Dogs, Nue and Great Serpent. Sustained, versatile pressure.',
  cost: 0,
  hp: 340,
  duration: 120,
  speed: 138,
  rig: 'agito',
  pal: { main: '#4a3b7b', dark: '#2a2048', light: '#a79bff', accent: '#8fd7ff' },
  scale: 1.25,
  role: 'predator',
  isUltimate: true,
  ai: { preferredRange: 26, cooldown: 1.0, aggression: 0.95 },
  abilities: [
    { id: 'agitoClaw', name: 'Totality Claw', type: 'melee', dmg: 14, startup: 0.1, active: 0.1, recovery: 0.26, range: 28, arc: 1.9, knockback: 100, hitstop: 0.05, category: 'cut', color: '#a79bff', anim: 'attack', cd: 1.2 },
    { id: 'agitoDive', name: 'Thunder Dive', type: 'dash', dmg: 20, startup: 0.16, active: 0.14, recovery: 0.4, range: 30, arc: 1.5, knockback: 140, hitstop: 0.06, category: 'electric', color: '#8fd7ff', anim: 'attack', move: { type: 'lunge', speed: 440, dur: 0.16 }, cd: 4 },
    { id: 'agitoGale', name: 'Wing Gale', type: 'projectile', dmg: 11, startup: 0.2, active: 0.06, recovery: 0.4, category: 'technique', color: '#8fd7ff', anim: 'cast', proj: { speed: 300, life: 0.9, radius: 6, color: '#8fd7ff', trail: '#dff6ff', pierce: 2, chain: 1 }, cd: 3.2 },
    { id: 'agitoSpecial', name: 'Sable Fang', type: 'aoe', dmg: 34, startup: 0.45, active: 0.14, recovery: 0.6, category: 'area', color: '#a79bff', anim: 'cast', aoe: { radius: 58, atTarget: true, delay: 0.2, knockback: 160, shake: 6 }, cd: 9 },
  ],
  ultimate: {
    id: 'agitoUlt', name: 'Totality: Sky Rend', type: 'aoe', dmg: 70, startup: 0.6, active: 0.2, recovery: 0.8,
    category: 'area', color: '#c9a2ff', anim: 'attack', aoe: { radius: 100, atSelf: true, delay: 0.3, knockback: 240, shake: 9 }, cd: 30,
  },
};

export const TOTALITY = {
  divineDogsTotality: {
    id: 'divineDogsTotality',
    name: 'Divine Dog: Totality',
    desc: 'When one of the twins falls, its shadow passes to the survivor. A single black wolf with doubled strength.',
    requires: ['divineDogs'],
    bonus: { hp: 60, dmg: 1.5, speed: 1.2 },
    unlock: 'Tame the Divine Dogs (or lose one in combat).',
  },
  agito: {
    id: 'agito',
    name: 'Agito',
    desc: 'Combined Totality of the Divine Dogs, Nue and Great Serpent. Unlocked in the Ten Shadows ultimate at 50% meter.',
    requires: ['divineDogs', 'nue', 'greatSerpent'],
    bonus: { duration: 120 },
    unlock: 'Tame Divine Dogs, Nue and Great Serpent.',
  },
  mahoragaTotality: {
    id: 'mahoragaTotality',
    name: 'Mahoraga',
    desc: 'The untamed Divine General. Summoned at 100% meter for 60 seconds with persistent adaptation memory.',
    requires: ['mahoraga'],
    bonus: { duration: 60 },
    unlock: 'Defeat Mahoraga in the taming ritual.',
  },
};

export function getSummon(id) {
  if (id === 'agito') return AGITO;
  return SHIKIGAMI[id];
}

export function summonListFor(owned) {
  return SHIKIGAMI_ORDER.filter((id) => owned[id]);
}
