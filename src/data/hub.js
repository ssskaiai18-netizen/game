// ---------------------------------------------------------------------------
// hub.js (data) — Jujutsu High layout, NPC definitions and permanent tribute
// upgrades purchased at the shrine.
// ---------------------------------------------------------------------------

export const HUB_ARENA = { x: 0, y: 0, w: 960, h: 560 };

export const TRIBUTE_TRACKS = [
  { id: 'vitality', name: 'Vitality', desc: '+6 max HP per rank', max: 12, cost: (l) => 35 + l * 28, color: '#e8485f' },
  { id: 'reservoir', name: 'Reservoir', desc: '+5 max cursed energy per rank', max: 12, cost: (l) => 35 + l * 28, color: '#4a7bff' },
  { id: 'focus', name: 'Focus', desc: '+3% technique damage per rank', max: 12, cost: (l) => 45 + l * 32, color: '#8fd7ff' },
  { id: 'finesse', name: 'Finesse', desc: '+2% movement speed per rank', max: 8, cost: (l) => 40 + l * 30, color: '#9ad0ff' },
  { id: 'fortune', name: 'Fortune', desc: '+8% tribute earned per rank', max: 10, cost: (l) => 50 + l * 34, color: '#ffd166' },
  { id: 'spark', name: 'Spark', desc: '+5% Black Flash timing window per rank', max: 6, cost: (l) => 70 + l * 45, color: '#ff3d5a' },
];

export const HUB_NPCS = [
  {
    id: 'megumi', name: 'Megumi Fushiguro', role: 'tenShadows', x: 300, y: 430, facingX: 1,
    chat: true,
    lines: [
      ['Megumi', 'Ten Shadows is about combinations, not brute force. Which shadow do you want to tame?'],
    ],
  },
  {
    id: 'instructor', name: 'Atsuya Kusakabe', role: 'spar', x: 206, y: 330, facingX: 1,
    lines: [
      ['Kusakabe', 'Rules are simple. Use your real techniques. I punch back.'],
      ['Kusakabe', 'Dummies build habits. Sparring breaks them. Pick an opponent.'],
    ],
  },
  {
    id: 'researcher', name: 'Shoko Ieiri', role: 'research', x: 588, y: 150, facingX: -1,
    lines: [
      ['Ieiri', 'Cursed energy is a resource. Spend it wrong and you are standing there empty.'],
      ['Ieiri', 'Black Flash raises cursed energy output, not just damage. That is the point of it.'],
    ],
  },
  {
    id: 'progression', name: 'Kiyotaka Ijichi', role: 'progression', x: 452, y: 150, facingX: 1,
    lines: [
      ['Ijichi', 'The shrine accepts tribute. Blessings are permanent — they survive death, which is more than most sorcerers manage.'],
    ],
  },
  {
    id: 'yuji', name: 'Yuji Itadori', role: 'story', x: 700, y: 384, facingX: -1, wander: true, charId: 'yuji',
  },
  {
    id: 'nobara', name: 'Nobara Kugisaki', role: 'story', x: 764, y: 436, facingX: -1, wander: true, charId: 'nobara',
  },
  {
    id: 'gojo', name: 'Satoru Gojo', role: 'story', x: 566, y: 470, facingX: 1, wander: false, charId: 'gojo',
  },
  {
    id: 'sukuna', name: 'Ryomen Sukuna', role: 'story', x: 640, y: 300, facingX: -1, wander: false, charId: 'sukuna',
  },
];

export const HUB_DECOR = [
  // buildings
  { type: 'building', x: 380, y: 190, w: 200, h: 70, tint: '#2a2f3d' },
  { type: 'building', x: 60, y: 250, w: 120, h: 60, tint: '#262b37' },
  { type: 'building', x: 760, y: 250, w: 130, h: 64, tint: '#262b37' },
  { type: 'building', x: 610, y: 470, w: 150, h: 56, tint: '#232833' },
  // torii + gate
  { type: 'torii', x: 480, y: 300, s: 1.4 },
  { type: 'lantern', x: 380, y: 330 },
  { type: 'lantern', x: 580, y: 330 },
  { type: 'lantern', x: 140, y: 380 },
  { type: 'lantern', x: 820, y: 390 },
  // trees
  { type: 'tree', x: 90, y: 430, s: 1.2, leaf: '#2f5d3a' },
  { type: 'tree', x: 40, y: 480, s: 1.4, leaf: '#2a5236' },
  { type: 'tree', x: 880, y: 520, s: 1.3, leaf: '#2f5d3a' },
  { type: 'tree', x: 920, y: 300, s: 1.1, leaf: '#2a5236' },
  { type: 'tree', x: 320, y: 120, s: 1.1, leaf: '#33633f' },
  { type: 'tree', x: 660, y: 120, s: 1.0, leaf: '#33633f' },
  // training area
  { type: 'rim', x: 120, y: 300, w: 260, h: 3, color: '#4a4030' },
  { type: 'rim', x: 120, y: 300, w: 3, h: 150, color: '#4a4030' },
  { type: 'rim', x: 120, y: 448, w: 260, h: 3, color: '#4a4030' },
  { type: 'sign', x: 130, y: 300, text: 'TRAINING' },
  // shrine area
  { type: 'shrine', x: 480, y: 200 },
  { type: 'banner', x: 440, y: 228, color: '#7a2222' },
  { type: 'banner', x: 520, y: 228, color: '#7a2222' },
  // portal gate
  { type: 'portal', x: 848, y: 300, active: true },
  { type: 'banner', x: 800, y: 320, color: '#3a1f6a' },
  { type: 'banner', x: 896, y: 320, color: '#3a1f6a' },
  // crates near buildings
  { type: 'crates', x: 620, y: 470 },
  { type: 'crates', x: 640, y: 470 },
  { type: 'pillar', x: 360, y: 440 },
  { type: 'pillar', x: 600, y: 440 },
];

export const HUB_OBSTACLES = [
  { x: 380, y: 120, w: 200, h: 70 },
  { x: 60, y: 190, w: 120, h: 60 },
  { x: 760, y: 186, w: 130, h: 64 },
  { x: 610, y: 414, w: 150, h: 56 },
  { x: 468, y: 160, w: 24, h: 40 },
];

export const DUMMY_SPOTS = [
  { x: 180, y: 350, type: 'basic' },
  { x: 260, y: 400, type: 'reinforcement' },
  { x: 200, y: 424, type: 'combat' },
];

export const PORTAL_POS = { x: 848, y: 330 };
export const SHRINE_POS = { x: 480, y: 224 };
export const KOGANE_POS = { x: 680, y: 300 };
export const TRAINING_BOARD = { x: 140, y: 316 };
