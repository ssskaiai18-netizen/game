// ---------------------------------------------------------------------------
// story.js — the seven arcs, their dungeon parameters, rewards and dialogue.
// Story state lives in the save file; the hub and dungeon read it to decide
// which encounters and lines are available.
// ---------------------------------------------------------------------------

export const ARCS = [
  {
    id: 'fearsomeWomb',
    name: 'Fearsome Womb',
    subtitle: 'Detention Centre, Sendai',
    intro:
      'A cursed womb has consumed a detention centre. Three students, one special grade curse, and far too little information.',
    outro:
      'The womb is sealed. Yuji Itadori has eaten a finger and lived — and something old is awake inside him.',
    rooms: 6,
    boss: 'bloodPainting',
    difficultyBase: 1.0,
    reward: { tribute: 40, unlock: 'character:nobara' },
    hubLine: 'The detention centre is cleansed. Ijichi wants us ready for the next one.',
  },
  {
    id: 'vsMahito',
    name: 'Vs. Mahito',
    subtitle: 'Sewer Tunnels beneath Tokyo',
    intro:
      'A patchwork curse is reshaping human souls in the dark. Junpei is dead. Mahito is waiting.',
    outro:
      'Mahito slips away, laughing. But the shape of his technique is known now — and so is its weakness.',
    rooms: 7,
    boss: 'mahito',
    difficultyBase: 1.12,
    reward: { tribute: 55, unlock: 'shikigami:greatSerpent' },
    hubLine: 'Mahito still breathes. That is a problem we intend to fix.',
  },
  {
    id: 'kyoto',
    name: 'Kyoto Goodwill Event',
    subtitle: 'Jujutsu High Forest',
    intro:
      'The exchange event has become a hunting ground. Special grade curses are walking out of the trees, and Hanami is at the centre.',
    outro:
      'Hanami retreats into the forest. Gojo-sensei says the real enemy has finally shown their face.',
    rooms: 8,
    boss: 'hanami',
    difficultyBase: 1.25,
    reward: { tribute: 60, unlock: 'character:gojo' },
    hubLine: 'The exchange event is suspended. Everyone is training harder now.',
  },
  {
    id: 'shibuya',
    name: 'Shibuya Incident',
    subtitle: 'Shibuya, 19:00',
    intro:
      'A curtain has fallen over Shibuya. Civilians are trapped inside, and the curses are not interested in hiding anymore.',
    outro:
      'Shibuya is gone. The world knows about curses now, and nothing will be the same.',
    rooms: 9,
    boss: 'jogo',
    difficultyBase: 1.4,
    reward: { tribute: 75, unlock: 'character:sukuna' },
    hubLine: 'Shibuya is sealed. The higher-ups are deciding who to blame.',
  },
  {
    id: 'extermination',
    name: "Itadori's Extermination",
    subtitle: 'Colony Perimeter',
    intro:
      'Yuji has been marked for execution. The order is being carried out by a sorcerer with a gavel and a domain.',
    outro:
      'The execution order is suspended — for now. Higuruma walks away with more questions than answers.',
    rooms: 8,
    boss: 'higuruma',
    difficultyBase: 1.5,
    reward: { tribute: 80, unlock: 'culling:start' },
    hubLine: 'The Culling Games have begun. Kogane is waiting in the courtyard.',
  },
  {
    id: 'cullingGames',
    name: 'Culling Games',
    subtitle: 'Tokyo Colony No. 1',
    intro:
      'Kogane explains the rules: kill, survive, earn points. The colonies are full of sorcerers who have nothing left to lose.',
    outro:
      'The colony is quiet. Points are banked. Somewhere, the rules are being rewritten.',
    rooms: 9,
    boss: 'kashimo',
    difficultyBase: 1.62,
    reward: { tribute: 90, unlock: 'arc:6' },
    hubLine: 'The colonies are still live. Kogane never sleeps.',
  },
  {
    id: 'shinjuku',
    name: 'Shinjuku Showdown',
    subtitle: 'Shinjuku, the final night',
    intro:
      'Sukuna has taken everything. One last battle remains, and the shrine is already opening.',
    outro:
      'The shrine falls silent. The King of Curses is beaten — this time. The world begins to rebuild.',
    rooms: 10,
    boss: 'sukunaBoss',
    difficultyBase: 1.8,
    reward: { tribute: 150 },
    hubLine: 'It is over. The students stand in the ruined courtyard and breathe.',
  },
];

export const DIFFICULTIES = {
  normal: {
    id: 'normal',
    name: 'Normal',
    desc: 'Intended experience. Enemies telegraph clearly and healing rooms are common.',
    enemyHp: 1,
    enemyDmg: 1,
    count: 1,
    healRooms: 1,
    rewardMult: 1,
    unlock: () => true,
  },
  hard: {
    id: 'hard',
    name: 'Hard',
    desc: 'Elite modifiers appear earlier, enemies coordinate, fewer healing rooms. +30% tribute.',
    enemyHp: 1.3,
    enemyDmg: 1.25,
    count: 1.2,
    healRooms: 0.6,
    rewardMult: 1.3,
    unlock: (save) => save.data.story.cleared[0],
  },
  hell: {
    id: 'hell',
    name: 'Hell',
    desc: 'Bosses gain extra patterns, enemies hunt in packs. +65% tribute and score.',
    enemyHp: 1.7,
    enemyDmg: 1.5,
    count: 1.4,
    healRooms: 0.35,
    rewardMult: 1.65,
    unlock: (save) => save.data.stats.wins >= 2,
  },
};

// ---------------------------------------------------------------------------
// Dialogue — helpers pick the right set for current save state.
// ---------------------------------------------------------------------------
export const DIALOGUE = {
  intro: [
    { speaker: 'Gojo', text: 'Welcome to Jujutsu High. Try not to die in your first week — paperwork is a nightmare.' },
    { speaker: 'Gojo', text: 'You can train in the courtyard, talk to everyone, then walk through the cursed gate when you are ready.' },
    { speaker: 'Yuji', text: 'So... hitting the dummies is fine? Good. I learn best by hitting things.' },
  ],
  yuji: {
    default: [
      { speaker: 'Yuji', text: 'Oh — hey! Training hard? I keep trying to get three Black Flashes in a row and failing spectacularly.' },
      { speaker: 'Yuji', text: 'If you reinforce right as your fist lands, the cursed energy hits about a millionth of a second late. That is the whole trick.' },
    ],
    noScroll: [
      { speaker: 'Yuji', text: 'Black Flash needs a scroll to attempt on purpose. I got mine from Gojo-sensei. Rumor says one shows up in the dungeon.' },
    ],
    cleared: [
      { speaker: 'Yuji', text: 'We beat the womb, huh. I keep thinking about the people we could not get to in time.' },
      { speaker: 'Yuji', text: 'So train with me. If I get stronger, next time nobody dies.' },
    ],
  },
  megumi: {
    default: [
      { speaker: 'Megumi', text: 'Ten Shadows is about combinations, not brute force. Which shikigami do you want to tame?' },
    ],
    agito: [
      { speaker: 'Megumi', text: 'Agito is a Totality. Three shadows held in one form — Divine Dogs, Nue, Great Serpent. It lasts 120 seconds.' },
    ],
    mahoraga: [
      { speaker: 'Megumi', text: 'Mahoraga cannot be controlled by force. It adapts to everything that fails to kill it. If you want it, you fight it.' },
    ],
  },
  instructor: {
    default: [
      { speaker: 'Kusakabe', text: 'Sparring rules are simple. Use your real techniques. I will not go easy, and I will not go lethal.' },
      { speaker: 'Kusakabe', text: 'If you want to test your timing, fight me. The dummies do not punish bad habits.' },
    ],
  },
  researcher: {
    default: [
      { speaker: 'Ieiri', text: 'Cursed energy is a resource, not a meter. Spend it wrong and you will be standing there, empty, in front of a special grade.' },
      { speaker: 'Ieiri', text: 'Black Flash increases cursed energy output. That is why it matters more than the damage.' },
    ],
  },
  progression: {
    default: [
      { speaker: 'Ijichi', text: 'Your tribute can be invested permanently at the shrine. Those blessings persist between runs and between deaths.' },
    ],
  },
  kogane: [
    { speaker: 'Kogane', text: 'Culling Games rule: earn points by defeating players and completing colony objectives.' },
    { speaker: 'Kogane', text: 'Rules can be added by the top scorer. You are not the top scorer. Yet.' },
  ],
  portal: [
    { speaker: 'Ijichi', text: 'The curtain is anchored here. Choose your destination and difficulty before you step through.' },
  ],
};

export function arcFor(save) {
  const idx = Math.max(0, Math.min(ARCS.length - 1, save.data.story.arc));
  return ARCS[idx];
}

export function isArcUnlocked(save, idx) {
  if (idx === 0) return true;
  return save.data.story.cleared[idx - 1] || save.data.story.cleared[idx];
}

export function nextArcIndex(save) {
  const cleared = save.data.story.cleared;
  for (let i = 0; i < ARCS.length; i++) if (!cleared[i]) return i;
  return ARCS.length - 1;
}
