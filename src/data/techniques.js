// ---------------------------------------------------------------------------
// techniques.js — innate techniques for the player's ORIGINAL sorcerer.
//
// The player never plays Yuji / Sukuna / Gojo / Megumi. On first creation a
// single innate technique is rolled once and persisted (save.custom); it is
// never rerolled on later sessions. Every technique grants exactly two
// starting abilities. The remaining abilities, the ultimate and the domain
// are unlocked — in order — by earning training credits from NPC sparring
// and trainer lessons (see applyTrainingCredit).
// ---------------------------------------------------------------------------

import { TECHNIQUE_IDS } from '../core/save.js';

const melee = (o) => ({ type: 'melee', startup: 0.08, active: 0.09, recovery: 0.16, category: 'physical', ...o });
const proj = (o) => ({ type: 'projectile', startup: 0.1, active: 0.05, recovery: 0.2, category: 'projectile', ...o });
const aoe = (o) => ({ type: 'aoe', startup: 0.14, active: 0.05, recovery: 0.22, category: 'area', ...o });
const dash = (o) => ({ type: 'dash', startup: 0.03, active: 0.14, recovery: 0.12, ...o });

export const TECHNIQUES = {
  soulFists: {
    id: 'soulFists', name: 'Divergent Soul Fists', title: 'Innate Technique',
    color: '#ff8a5c',
    desc: 'Your cursed energy lags a heartbeat behind your fists. Every impact lands twice — and, timed perfectly, detonates as Black Flash.',
    basics: 'fists',
    abilities: [
      { type: 'divergent', id: 'cs_divergent', name: 'Divergent Fist', desc: 'A punch, then a delayed cursed impact. Press [1] again in the timing window for Black Flash.', cost: 12, cd: 3.2, startup: 0.08, active: 0.09, recovery: 0.18, dmg: 13, range: 30, arc: 1.7, knockback: 70, hitstop: 0.05, category: 'physical', color: '#ff8a5c', anim: 'attack', sfx: 'hit', divergent: { delay: 0.34, windowStart: 0.14, windowEnd: 0.55, delayedDmg: 12, bfDmg: 34 } },
      { ...dash({ id: 'cs_rush', name: 'Rush', desc: 'Lunge forward into a committed strike. Opens combos and punishes recoveries.', cost: 10, cd: 2.6, dmg: 14, range: 30, arc: 1.4, knockback: 80, hitstop: 0.04, category: 'physical', color: '#9ad0ff', anim: 'attack', sfx: 'dodge' }), move: { type: 'lunge', speed: 430, dur: 0.14 }, hitAt: 0.05 },
      { ...dash({ id: 'cs_crush', name: 'Crushing Blow', desc: 'A heavy committed slam. Bonus damage as a finisher against weakened targets.', cost: 18, cd: 4.5, dmg: 26, range: 40, arc: 1.5, knockback: 160, hitstop: 0.09, category: 'blunt', color: '#ffb03a', anim: 'attack', sfx: 'heavy', finisher: { hpFrac: 0.3, mult: 1.7 } }), move: { type: 'lunge', speed: 380, dur: 0.12 }, hitAt: 0.06 },
      melee({ id: 'cs_strikes', name: 'Cursed Strikes', desc: 'Four strikes, each with its own hit window. The last one hits hardest.', cost: 16, cd: 5, dmg: 9, hits: 3, interval: 0.13, active: 0.42, range: 30, arc: 1.8, knockback: 60, hitstop: 0.04, category: 'physical', color: '#ff8a5c', anim: 'attack', sfx: 'hit', finisherHit: true }),
      { ...dash({ id: 'cs_aerial', name: 'Aerial Assault', desc: 'Launch a foe and strike them down out of the air.', cost: 18, cd: 5.5, dmg: 20, range: 34, arc: 1.8, knockback: 150, hitstop: 0.07, category: 'physical', color: '#ffd166', anim: 'kick', sfx: 'heavy', launch: { stun: 0.7, knock: 170 } }), move: { type: 'lunge', speed: 460, dur: 0.15 }, hitAt: 0.05 },
    ],
    ultimate: {
      id: 'cs_ult', name: 'Soul Barrage', type: 'transform', ultCost: 100, dur: 12, formName: 'Soul Awakening', color: '#ff2a4a',
      desc: 'Your lagging cursed energy fuses with Shrine-like cuts for a short awakening.',
      slots: [
        { ...proj({ id: 'cs_u_blood', name: 'Piercing Blood', desc: 'A narrow, pressurised blood projectile.', cost: 14, cd: 3, startup: 0.26, dmg: 24, range: 260, knockback: 60, color: '#ff2a4a', anim: 'cast', sfx: 'technique', category: 'projectile' }), proj: { speed: 520, life: 0.8, radius: 5, color: '#d90429', trail: '#ff5a6a', pierce: 1 } },
        { ...proj({ id: 'cs_u_dismantle', name: 'Dismantle', desc: 'A thin ranged cursed slash.', cost: 12, cd: 2.2, dmg: 18, range: 240, color: '#ff5a5a', anim: 'attack', sfx: 'slash', category: 'cut' }), proj: { speed: 540, life: 0.55, radius: 6, color: '#ff5a5a', trail: '#ffb0b0', pierce: 3, wide: 14 } },
        { ...aoe({ id: 'cs_u_scissor', name: 'Scissor Cleave', desc: 'Mark a point, then intersecting cuts close like scissors.', cost: 18, cd: 5, dmg: 30, range: 130, color: '#ff3355', anim: 'cast', sfx: 'slash', category: 'cut', scissor: true }), aoe: { radius: 40, atTarget: true, delay: 0.45, ticks: 1, tickInterval: 0.1, knockback: 90 } },
        { type: 'divergent', id: 'cs_u_bf', name: 'Divergent Black Flash', desc: 'An enhanced Divergent Fist. The second press must still be timed.', cost: 16, cd: 4, startup: 0.08, active: 0.09, recovery: 0.2, dmg: 18, range: 32, arc: 1.8, knockback: 110, hitstop: 0.08, category: 'physical', color: '#ff1e3c', anim: 'attack', sfx: 'blackflash', divergent: { delay: 0.34, windowStart: 0.13, windowEnd: 0.58, delayedDmg: 18, bfDmg: 52, empowered: true } },
        { id: 'cs_u_domain', name: 'Incomplete Domain', type: 'domain', domainId: 'incomplete_shrine', desc: 'Domain Expansion: Incomplete Shrine.', cost: 55, cd: 36, dur: 9, color: '#c0273a', anim: 'cast', sfx: 'domain' },
      ],
    },
    domain: { id: 'incomplete_shrine', name: 'Domain Expansion: Incomplete Shrine', type: 'domain', cost: 55, cd: 36, dur: 9, color: '#c0273a', desc: 'Repeated shrine slashes that briefly incapacitate — slower than Malevolent Shrine, and stun cannot chain forever.' },
  },

  shrine: {
    id: 'shrine', name: 'Shrine', title: 'Innate Technique', color: '#ff5a5a',
    desc: 'Invisible cuts answer your hands: Dismantle at range, Cleave up close, and fire held in reserve.',
    basics: 'cut',
    abilities: [
      { ...proj({ id: 'cs_dismantle', name: 'Dismantle', desc: 'A fast invisible slash down your aim.', cost: 13, cd: 2, dmg: 17, range: 240, color: '#ff5a5a', anim: 'attack', sfx: 'slash', category: 'cut' }), proj: { speed: 540, life: 0.55, radius: 6, color: '#ff5a5a', trail: '#ffb0b0', pierce: 3, wide: 14 } },
      melee({ id: 'cs_cleave', name: 'Cleave', desc: 'A close cut that bites deeper into weakened targets.', cost: 17, cd: 3, dmg: 25, startup: 0.1, active: 0.12, recovery: 0.2, range: 40, arc: 2.4, knockback: 120, hitstop: 0.08, category: 'cut', color: '#ff3030', anim: 'attack', sfx: 'heavy', execute: true }),
      { ...dash({ id: 'cs_shrine_rush', name: 'Rush', desc: 'A brutal advance ending in a cut.', cost: 11, cd: 2.8, dmg: 15, range: 32, arc: 1.5, knockback: 90, hitstop: 0.05, category: 'cut', color: '#ff8a8a', anim: 'attack', sfx: 'slash' }), move: { type: 'lunge', speed: 450, dur: 0.14 }, hitAt: 0.05 },
      { ...aoe({ id: 'cs_spiderweb', name: 'Spiderweb', desc: 'Cutting patterns crack across the ground around you.', cost: 24, cd: 6, dmg: 18, hits: 2, range: 72, color: '#ff4040', anim: 'attack', sfx: 'slash', category: 'cut', spiderweb: true }), aoe: { radius: 72, atSelf: true, delay: 0.22, ticks: 3, tickInterval: 0.16, mark: true, knockback: 55 } },
      { ...proj({ id: 'cs_flame', name: 'Flame Arrow', desc: 'Charge and loose a concentrated flame that detonates.', cost: 28, cd: 8, startup: 0.3, dmg: 38, range: 300, color: '#ff8a2a', anim: 'cast', sfx: 'technique', category: 'fire' }), proj: { speed: 250, life: 1.5, radius: 7, color: '#ff8a2a', trail: '#ffd06a', pierce: 0, explode: { radius: 42, dmg: 26 } } },
    ],
    ultimate: {
      id: 'cs_shrine_ult', name: 'Shrine Ascendant', type: 'transform', ultCost: 100, dur: 12, formName: 'Shrine Ascendant', color: '#ff2a2a',
      desc: 'Your cuts sharpen towards the King of Curses for a short ascension.',
      slots: [
        { ...proj({ id: 'cs_su_world', name: 'World-Cutting Slash', desc: 'A spatial cut with a real windup. Devastating, punishable.', cost: 24, cd: 6, startup: 0.4, dmg: 46, range: 280, color: '#ffffff', anim: 'attack', sfx: 'slash', category: 'cut' }), proj: { speed: 620, life: 0.6, radius: 8, color: '#ffe9e9', trail: '#ff5a5a', pierce: 9, wide: 26 } },
        melee({ id: 'cs_su_cleave', name: 'Enhanced Cleave', desc: 'Overlapping cuts converge on one target.', cost: 20, cd: 4, dmg: 16, hits: 2, interval: 0.12, active: 0.3, range: 44, arc: 2.6, knockback: 140, hitstop: 0.08, category: 'cut', color: '#ff2020', anim: 'attack', sfx: 'heavy', execute: true, finisherHit: true }),
        { ...proj({ id: 'cs_su_flame', name: 'Divine Flame', desc: 'A charged flame that erupts on impact.', cost: 30, cd: 9, startup: 0.42, dmg: 52, range: 300, color: '#ff6a1a', anim: 'cast', sfx: 'technique', category: 'fire' }), proj: { speed: 260, life: 1.5, radius: 8, color: '#ff8a2a', trail: '#ffd06a', pierce: 0, explode: { radius: 56, dmg: 36 } } },
        melee({ id: 'cs_su_assault', name: 'Relentless Assault', desc: 'A coordinated flurry ending in a heavy finisher.', cost: 18, cd: 5.5, dmg: 10, hits: 4, interval: 0.11, active: 0.5, range: 36, arc: 2.0, knockback: 70, hitstop: 0.05, category: 'cut', color: '#ff4040', anim: 'attack', sfx: 'slash', finisherHit: true }),
        { id: 'cs_su_domain', name: 'Malevolent Shrine', type: 'domain', domainId: 'malevolent_shrine', desc: 'Domain Expansion: Malevolent Shrine.', cost: 60, cd: 38, dur: 9, color: '#c0392b', anim: 'cast', sfx: 'domain' },
      ],
    },
    domain: { id: 'malevolent_shrine', name: 'Domain Expansion: Malevolent Shrine', type: 'domain', cost: 60, cd: 38, dur: 10, color: '#c0392b', desc: 'Rapid sure-hit cuts. Frequency over stun: dangerous cumulative damage.' },
  },

  limitless: {
    id: 'limitless', name: 'Limitless', title: 'Innate Technique', color: '#5b8cff',
    desc: 'Infinity stands between you and the world. Blue pulls, Red pushes, and Purple erases the line between them.',
    basics: 'palm',
    abilities: [
      { ...aoe({ id: 'cs_blue', name: 'Lapse Blue', desc: 'Compress space: pull enemies into a grinding focal point.', cost: 24, cd: 6, dmg: 22, range: 120, color: '#4a7bff', anim: 'cast', sfx: 'technique', category: 'technique' }), aoe: { radius: 54, atTarget: true, delay: 0.22, pull: 240, pullDur: 0.5, ticks: 3, tickInterval: 0.16 } },
      { ...aoe({ id: 'cs_red', name: 'Reversal Red', desc: 'A divergent repulsion blast with massive knockback.', cost: 28, cd: 7, dmg: 32, range: 110, color: '#ff3b5c', anim: 'cast', sfx: 'heavy', category: 'technique' }), aoe: { radius: 48, atTarget: true, delay: 0.18, push: 420, knockback: 220, hitstop: 0.1 } },
      { ...aoe({ id: 'cs_maxblue', name: 'Maximum Output Blue', desc: 'A larger attraction point that drags everything in.', cost: 34, cd: 10, dmg: 26, range: 140, color: '#6fb7ff', anim: 'cast', sfx: 'technique', category: 'technique' }), aoe: { radius: 78, atTarget: true, delay: 0.3, pull: 330, pullDur: 0.9, ticks: 4, tickInterval: 0.18 } },
      { id: 'cs_teleport', name: 'Teleportation', type: 'blink', desc: 'Fold space and reappear along your aim.', cost: 18, cd: 5, startup: 0.04, active: 0.05, recovery: 0.12, dmg: 0, range: 120, color: '#7ec8ff', anim: 'dodge', sfx: 'dodge', category: 'technique', blink: { dist: 120, iframes: 0.3 } },
      { id: 'cs_purple', name: 'Hollow Purple', type: 'beam', desc: 'Blue and Red collide into an erasing beam. Long charge, long cooldown.', cost: 42, cd: 14, startup: 0.45, active: 0.06, recovery: 0.35, dmg: 95, range: 290, color: '#b06bff', anim: 'cast', sfx: 'beam', category: 'technique', beam: { length: 290, width: 28, dur: 0.4 } },
    ],
    ultimate: {
      id: 'cs_lim_ult', name: 'Limitless Ascendant', type: 'transform', ultCost: 100, dur: 13, formName: 'Limitless Ascendant', color: '#9fd8ff',
      desc: 'Ascend: maximum outputs, Unlimited Void and Infinity, for a short window.',
      slots: [
        { ...aoe({ id: 'cs_lu_maxblue', name: 'Maximum Output Blue', desc: 'An enhanced attraction point with real area control.', cost: 30, cd: 8, dmg: 30, range: 150, color: '#6fb7ff', anim: 'cast', sfx: 'technique', category: 'technique' }), aoe: { radius: 92, atTarget: true, delay: 0.28, pull: 400, pullDur: 1.1, ticks: 5, tickInterval: 0.16 } },
        { ...aoe({ id: 'cs_lu_maxred', name: 'Maximum Output Red', desc: 'An enhanced repulsion. Greater impact than base Red.', cost: 34, cd: 8, dmg: 52, range: 120, color: '#ff3b5c', anim: 'cast', sfx: 'heavy', category: 'technique' }), aoe: { radius: 62, atTarget: true, delay: 0.2, push: 560, knockback: 300, hitstop: 0.12 } },
        { id: 'cs_lu_void', name: 'Unlimited Void', type: 'domain', domainId: 'unlimited_void', desc: 'Domain Expansion: Unlimited Void.', cost: 65, cd: 40, dur: 8, color: '#9fd8ff', anim: 'cast', sfx: 'domain' },
        { id: 'cs_lu_purple', name: 'Enhanced Hollow Purple', type: 'beam', desc: 'A grander Purple: finite range, substantial cooldown.', cost: 48, cd: 16, startup: 0.55, active: 0.06, recovery: 0.4, dmg: 140, range: 300, color: '#c07bff', anim: 'cast', sfx: 'beam', category: 'technique', beam: { length: 300, width: 38, dur: 0.5 } },
        { id: 'cs_lu_infinity', name: 'Infinity', type: 'buff', desc: 'Nothing reaches you — for a few seconds, and never forever.', cost: 22, cd: 12, startup: 0.06, active: 0.05, recovery: 0.1, color: '#a8d8ff', anim: 'guard', sfx: 'reinforce', category: 'technique', buff: { id: 'infinity', dur: 4, hits: 8, ceUpkeep: 7 } },
      ],
    },
    domain: { id: 'unlimited_void', name: 'Domain Expansion: Unlimited Void', type: 'domain', cost: 65, cd: 40, dur: 8, color: '#9fd8ff', desc: 'Infinite information: enemies inside cannot move, attack or use ordinary abilities while it lasts.' },
  },

  tenShadows: {
    id: 'tenShadows', name: 'Ten Shadows', title: 'Innate Technique', color: '#8f7bff',
    desc: 'Ten shadows answer your signs. Tame them in ritual, fuse them in pairs, and never let Mahoraga be your first answer.',
    basics: 'shadow',
    abilities: [
      { ...proj({ id: 'cs_knife', name: 'Knife Throw', desc: 'A cursed knife, thrown hard. Cheap, fast, honest.', cost: 8, cd: 1.6, dmg: 13, range: 220, knockback: 40, color: '#dfe6f2', anim: 'attack', sfx: 'slash', category: 'projectile' }), proj: { speed: 460, life: 0.7, radius: 4, color: '#e8eef8', trail: '#9fb8d8', pierce: 1 } },
      { id: 'cs_summon', name: 'Ten Shadows', type: 'summon', desc: 'Summon the selected tamed shikigami. [C] cycles the selection.', cost: 25, cd: 2, startup: 0.2, active: 0.1, recovery: 0.2, color: '#8f7bff', anim: 'cast', sfx: 'summon', category: 'technique', summon: { duration: 14 } },
      { id: 'cs_fusion', name: 'Shikigami Fusion', type: 'fusion', desc: 'Fuse the two selected shadows into one chimera. Change the pair in Megumi\'s fusion lab.', cost: 30, cd: 9, startup: 0.25, active: 0.1, recovery: 0.25, color: '#c9a2ff', anim: 'cast', sfx: 'summon', category: 'technique' },
      { id: 'cs_command', name: 'Shikigami Command', type: 'command', desc: 'Order every active summon to strike at once.', cost: 22, cd: 7, startup: 0.12, active: 0.1, recovery: 0.2, dmg: 22, color: '#a79bff', anim: 'cast', sfx: 'shikigami', category: 'technique' },
      { id: 'cs_shadowstep', name: 'Shadow Step', type: 'blink', desc: 'Sink through shadow and resurface along your aim.', cost: 16, cd: 4, startup: 0.05, active: 0.05, recovery: 0.14, dmg: 0, range: 110, color: '#5b4bd6', anim: 'dodge', sfx: 'dodge', category: 'technique', blink: { dist: 110, iframes: 0.35 } },
    ],
    ultimate: { id: 'cs_ten_ult', name: 'Ten Shadows: Ultimate', type: 'tenShadowsUlt', ultCost: 50, color: '#a79bff', desc: 'At 50%: summon Agito (needs Round Deer, Nue, Mourning Tiger and Great Serpent tamed). At 100%: summon Mahoraga.' },
    domain: { id: 'chimera_shadow_garden', name: 'Domain Expansion: Chimera Shadow Garden', type: 'domain', cost: 55, cd: 34, dur: 14, color: '#3b2a8a', desc: 'Shadow floods the arena: no summon cooldowns, many shadows at once, and temporary black copies that vanish when the garden closes.' },
  },

  strawDoll: {
    id: 'strawDoll', name: 'Straw Doll', title: 'Innate Technique', color: '#ff6b8a',
    desc: 'A piece of them is a piece of you. Mark, link, and pull the hairpin when it hurts most.',
    basics: 'hammer',
    abilities: [
      { ...proj({ id: 'cs_nail', name: 'Nail Shot', desc: 'Drive a cursed nail forward. Applies Resonance Mark.', cost: 9, cd: 1.5, dmg: 13, range: 220, knockback: 35, color: '#f0d8a0', anim: 'cast', sfx: 'technique', category: 'projectile' }), proj: { speed: 430, life: 0.9, radius: 4, color: '#ffe9b0', trail: '#fff6d8', pierce: 1, mark: true } },
      { id: 'cs_resonance', name: 'Resonance', type: 'mark', desc: 'Hammer the doll: every marked enemy takes resonance damage.', cost: 24, cd: 6, startup: 0.22, active: 0.1, recovery: 0.22, dmg: 18, range: 150, color: '#ff6b8a', anim: 'cast', sfx: 'mark', category: 'technique', mark: { dur: 8, bonus: 0.25, linkRadius: 900 } },
      { ...proj({ id: 'cs_storm', name: 'Nail Storm', desc: 'Scatter five nails in a cone. Each hit adds a mark.', cost: 20, cd: 4.5, dmg: 9, range: 150, knockback: 20, color: '#ffd88a', anim: 'cast', sfx: 'technique', category: 'projectile' }), proj: { speed: 350, life: 0.55, radius: 4, color: '#ffe9b0', trail: '#fff0c0', pierce: 1, count: 5, spread: 0.75, mark: true } },
      { ...aoe({ id: 'cs_hairpin', name: 'Hairpin', desc: 'Detonate the target area. Damage scales with mark stacks.', cost: 26, cd: 5.5, dmg: 20, range: 120, color: '#ff9a5c', anim: 'cast', sfx: 'heavy', category: 'area' }), aoe: { radius: 62, atTarget: true, delay: 0.16, burst: true, markBonus: 12 } },
      melee({ id: 'cs_skull', name: 'Skull Cracker', desc: 'One honest hammer swing to end an argument.', cost: 14, cd: 4, dmg: 24, startup: 0.13, active: 0.11, recovery: 0.25, range: 30, arc: 1.7, knockback: 150, hitstop: 0.08, category: 'blunt', color: '#ff9a5c', anim: 'attack', sfx: 'heavy', lunge: 26 }),
    ],
    ultimate: { id: 'cs_straw_ult', name: 'Absolute Resonance', type: 'ultimate', ultCost: 100, dmg: 90, color: '#ff3d6a', anim: 'cast', sfx: 'ult', category: 'technique', desc: 'Shatter every mark at once.' },
    domain: null,
  },

  blood: {
    id: 'blood', name: 'Blood Manipulation', title: 'Innate Technique', color: '#d90429',
    desc: 'Your blood is a weapon with a pulse. Compress it, edge it, and never waste a drop you cannot replace.',
    basics: 'blood',
    abilities: [
      { ...proj({ id: 'cs_piercing', name: 'Piercing Blood', desc: 'A narrow, pressurised blood projectile.', cost: 14, cd: 3, startup: 0.26, dmg: 24, range: 260, knockback: 60, color: '#ff2a4a', anim: 'cast', sfx: 'technique', category: 'projectile' }), proj: { speed: 520, life: 0.8, radius: 5, color: '#d90429', trail: '#ff5a6a', pierce: 1 } },
      melee({ id: 'cs_bloodedge', name: 'Blood Edge', desc: 'A hardened blood blade at arm\'s length.', cost: 12, cd: 2.6, dmg: 20, range: 34, arc: 2.0, knockback: 80, hitstop: 0.05, category: 'cut', color: '#ff3355', anim: 'attack', sfx: 'slash' }),
      { ...proj({ id: 'cs_slicing', name: 'Slicing Exorcism', desc: 'A spinning blood disc that cuts through lines.', cost: 20, cd: 5, dmg: 22, range: 220, color: '#ff5a6a', anim: 'cast', sfx: 'slash', category: 'cut' }), proj: { speed: 320, life: 0.9, radius: 7, color: '#ff3355', trail: '#ffb0b8', pierce: 4, wide: 12 } },
      { ...aoe({ id: 'cs_crimson', name: 'Crimson Binding', desc: 'Blood nets bind the target area and slow everything in it.', cost: 24, cd: 7, dmg: 14, range: 120, color: '#c9184a', anim: 'cast', sfx: 'technique', category: 'technique' }), aoe: { radius: 58, atTarget: true, delay: 0.25, ticks: 2, tickInterval: 0.3, root: 0.7 } },
      { ...proj({ id: 'cs_supernova', name: 'Blood Supernova', desc: 'Scattered blood spheres detonate around the impact.', cost: 30, cd: 9, startup: 0.3, dmg: 30, range: 240, color: '#ff758f', anim: 'cast', sfx: 'heavy', category: 'projectile' }), proj: { speed: 300, life: 1.1, radius: 7, color: '#ff758f', trail: '#ffc2cd', pierce: 0, explode: { radius: 62, dmg: 30 } } },
    ],
    ultimate: { id: 'cs_blood_ult', name: 'Flowing Red Scale: Flood', type: 'ultimate', ultCost: 100, dmg: 105, color: '#d90429', anim: 'cast', sfx: 'ult', category: 'technique', desc: 'A flood of pressurised blood erases the target area.' },
    domain: null,
  },
};

export const TECHNIQUE_LIST = TECHNIQUE_IDS.map((id) => TECHNIQUES[id]).filter(Boolean);

const BASICS = {
  fists: [
    melee({ id: 'cb1', name: 'Jab', dmg: 9, startup: 0.06, active: 0.07, recovery: 0.12, range: 23, arc: 1.5, knockback: 40, hitstop: 0.03, comboWindow: 0.5, ceGain: 4, ultGain: 4, anim: 'attack', blackFlash: true }),
    melee({ id: 'cb2', name: 'Hook', dmg: 11, startup: 0.07, active: 0.08, recovery: 0.14, range: 25, arc: 1.7, knockback: 60, hitstop: 0.04, sfx: 'hit', comboWindow: 0.55, ceGain: 4, ultGain: 4, anim: 'attack', swingDir: -1, blackFlash: true }),
    melee({ id: 'cb3', name: 'Rising Uppercut', dmg: 16, startup: 0.1, active: 0.1, recovery: 0.24, range: 28, arc: 1.9, knockback: 130, hitstop: 0.07, sfx: 'heavy', comboWindow: 0.6, ceGain: 6, ultGain: 6, anim: 'kick', blackFlash: true, lunge: 40 }),
  ],
  cut: [
    melee({ id: 'cb1', name: 'Claw Slash', dmg: 10, startup: 0.06, active: 0.07, recovery: 0.12, range: 26, arc: 1.6, category: 'cut', color: '#ff6b6b', comboWindow: 0.5, ceGain: 4, ultGain: 4, anim: 'attack' }),
    melee({ id: 'cb2', name: 'Rending Cross', dmg: 12, startup: 0.07, active: 0.08, recovery: 0.13, range: 28, arc: 1.8, category: 'cut', color: '#ff6b6b', comboWindow: 0.5, ceGain: 4, ultGain: 4, anim: 'attack', swingDir: -1 }),
    melee({ id: 'cb3', name: 'Cleaving Palm', dmg: 17, startup: 0.11, active: 0.1, recovery: 0.22, range: 31, arc: 1.9, category: 'cut', color: '#ff4d4d', knockback: 110, hitstop: 0.07, sfx: 'heavy', comboWindow: 0.6, ceGain: 6, ultGain: 6, anim: 'attack', lunge: 26 }),
  ],
  palm: [
    melee({ id: 'cb1', name: 'Palm Strike', dmg: 9, startup: 0.07, active: 0.07, recovery: 0.13, range: 25, arc: 1.4, knockback: 55, hitstop: 0.03, color: '#9fd8ff', comboWindow: 0.5, ceGain: 5, ultGain: 4, anim: 'attack' }),
    melee({ id: 'cb2', name: 'Space Palm', dmg: 12, startup: 0.09, active: 0.08, recovery: 0.16, range: 28, arc: 1.6, knockback: 90, hitstop: 0.05, color: '#9fd8ff', comboWindow: 0.55, ceGain: 5, ultGain: 5, anim: 'attack', swingDir: -1 }),
    melee({ id: 'cb3', name: 'Reversal Tap', dmg: 15, startup: 0.11, active: 0.1, recovery: 0.24, range: 30, arc: 1.8, knockback: 140, hitstop: 0.08, color: '#7ec8ff', sfx: 'heavy', comboWindow: 0.6, ceGain: 7, ultGain: 6, anim: 'kick', lunge: 24 }),
  ],
  shadow: [
    melee({ id: 'cb1', name: 'Shadow Jab', dmg: 8, startup: 0.07, active: 0.08, recovery: 0.13, range: 23, arc: 1.5, knockback: 40, hitstop: 0.03, color: '#8fa8e8', comboWindow: 0.5, ceGain: 5, ultGain: 5, anim: 'attack' }),
    melee({ id: 'cb2', name: 'Shadow Sweep', dmg: 10, startup: 0.08, active: 0.09, recovery: 0.15, range: 26, arc: 1.8, knockback: 55, hitstop: 0.04, color: '#8fa8e8', comboWindow: 0.55, ceGain: 5, ultGain: 5, anim: 'attack', swingDir: -1 }),
    melee({ id: 'cb3', name: 'Shade Fang', dmg: 15, startup: 0.11, active: 0.1, recovery: 0.22, range: 30, arc: 1.9, knockback: 110, hitstop: 0.07, color: '#6f8fd0', sfx: 'heavy', comboWindow: 0.6, ceGain: 7, ultGain: 7, anim: 'attack', lunge: 36 }),
  ],
  hammer: [
    melee({ id: 'cb1', name: 'Hammer Jab', dmg: 9, startup: 0.09, active: 0.08, recovery: 0.14, range: 24, arc: 1.4, knockback: 50, hitstop: 0.04, category: 'blunt', comboWindow: 0.5, ceGain: 4, ultGain: 4, anim: 'attack' }),
    melee({ id: 'cb2', name: 'Hammer Swing', dmg: 12, startup: 0.1, active: 0.1, recovery: 0.16, range: 27, arc: 1.8, knockback: 80, hitstop: 0.05, category: 'blunt', comboWindow: 0.55, ceGain: 5, ultGain: 5, anim: 'attack', swingDir: -1 }),
    melee({ id: 'cb3', name: 'Skull Cracker', dmg: 17, startup: 0.13, active: 0.11, recovery: 0.25, range: 30, arc: 1.7, knockback: 140, hitstop: 0.08, category: 'blunt', sfx: 'heavy', comboWindow: 0.6, ceGain: 7, ultGain: 7, anim: 'attack', lunge: 26 }),
  ],
  blood: [
    melee({ id: 'cb1', name: 'Blood Jab', dmg: 9, startup: 0.07, active: 0.07, recovery: 0.13, range: 24, arc: 1.5, knockback: 45, hitstop: 0.03, color: '#ff758f', comboWindow: 0.5, ceGain: 5, ultGain: 4, anim: 'attack' }),
    melee({ id: 'cb2', name: 'Crimson Hook', dmg: 11, startup: 0.08, active: 0.08, recovery: 0.14, range: 26, arc: 1.7, knockback: 65, hitstop: 0.04, color: '#ff758f', comboWindow: 0.55, ceGain: 5, ultGain: 5, anim: 'attack', swingDir: -1 }),
    melee({ id: 'cb3', name: 'Scarlet Slam', dmg: 16, startup: 0.11, active: 0.1, recovery: 0.23, range: 29, arc: 1.9, knockback: 125, hitstop: 0.07, sfx: 'heavy', comboWindow: 0.6, ceGain: 6, ultGain: 6, anim: 'attack', lunge: 30 }),
  ],
};

/** The full unlock order after the two starters: abilities 3-5, ultimate, domain. */
export function progressionFor(techniqueId) {
  const t = TECHNIQUES[techniqueId];
  if (!t) return [];
  const out = t.abilities.slice(2).map((a) => ({ kind: 'ability', id: a.id, name: a.name }));
  if (t.ultimate) out.push({ kind: 'ultimate', id: t.ultimate.id, name: t.ultimate.name });
  if (t.domain) out.push({ kind: 'domain', id: t.domain.id, name: t.domain.name });
  return out;
}

export function startingAbilityIds(techniqueId) {
  const t = TECHNIQUES[techniqueId];
  return t ? t.abilities.slice(0, 2).map((a) => a.id) : [];
}

/** Assign the innate technique exactly once. Returns the technique id. */
export function ensureTechnique(save, rng = Math.random) {
  const c = save.data.custom;
  if (c.techniqueId && TECHNIQUES[c.techniqueId]) return c.techniqueId;
  const ids = TECHNIQUE_IDS.filter((id) => TECHNIQUES[id]);
  c.techniqueId = ids[Math.min(ids.length - 1, Math.floor(rng() * ids.length))];
  if (!c.unlockedAbilities.length) c.unlockedAbilities = startingAbilityIds(c.techniqueId);
  save.save();
  return c.techniqueId;
}

/**
 * Earn one training credit (spar win or completed lesson). Unlocks the next
 * item in the technique's progression order. Returns the unlocked entry or null.
 */
export function applyTrainingCredit(save, trainerId) {
  const c = save.data.custom;
  if (!c.techniqueId) ensureTechnique(save);
  if (trainerId && c.training[trainerId]) {
    c.training[trainerId].sparWins++;
    c.training[trainerId].lessons++;
  }
  c.trainingCredits++;
  c.mastery++;
  const next = progressionFor(c.techniqueId).find((step) => {
    if (step.kind === 'ability') return !c.unlockedAbilities.includes(step.id);
    if (step.kind === 'ultimate') return !c.ultimateUnlocked;
    return !c.domainUnlocked;
  });
  if (next) {
    if (next.kind === 'ability') c.unlockedAbilities.push(next.id);
    else if (next.kind === 'ultimate') c.ultimateUnlocked = true;
    else c.domainUnlocked = true;
  }
  save.save();
  return next || null;
}

export function techniqueMasteryLevel(save) {
  return Math.floor((save.data.custom.mastery || 0) / 3);
}

/** Build the runtime character definition for the custom sorcerer. */
export function buildCustomDef(save) {
  const c = save.data.custom;
  const t = TECHNIQUES[c.techniqueId] || TECHNIQUES.soulFists;
  const look = { ...c.look, accent: c.look.accent || t.color };
  return {
    id: 'custom',
    name: c.name || 'Sorcerer',
    title: t.name,
    techniqueId: t.id,
    blurb: t.desc,
    hp: 112, ce: 110, power: 1, speed: 84, dashSpeed: 335, radius: 6,
    comboStyle: 'custom',
    look,
    role: 'Custom',
    aiStyle: 'rush',
    basic: BASICS[t.basics] || BASICS.fists,
    abilities: t.abilities,
    ultimate: t.ultimate,
    domain: t.domain,
    passive: t.desc,
    blackFlashMod: t.id === 'soulFists' ? 1.5 : 1,
    masteryPerk: ['Technique mastery grows through NPC training'],
    isCustom: true,
  };
}

// ---------------------------------------------------------------------------
// NPC trainers: dialogue, lesson names and sparring identities.
// ---------------------------------------------------------------------------
export const TRAINERS = {
  yuji: {
    id: 'yuji', name: 'Yuji Itadori', charId: 'yuji', color: '#ff8a5c',
    lessonName: 'Timing & Impact',
    lessons: [
      'Land the delayed impact. Then learn to break it.',
      'Black Flash is not luck. It is the lag, answered on time.',
      'Finishers are promises: only make them when they land.',
    ],
    lines: [
      ['Yuji', 'Your technique is yours. I can only teach you timing — what you hit with is up to it.'],
      ['Yuji', 'Press the same technique again right as the first impact lands. Too early is just mashing.'],
    ],
  },
  sukuna: {
    id: 'sukuna', name: 'Ryomen Sukuna', charId: 'sukuna', color: '#ff5a5a',
    lessonName: 'Cutting Pressure',
    lessons: [
      'Survive the dismantling. Then answer it.',
      'Cleave respects nothing. Neither should your guard.',
      'The shrine does not stun you. It simply does not stop.',
    ],
    lines: [
      ['Sukuna', 'Brat. Your technique will not save you from a real cut. Come and learn the distance.'],
      ['Sukuna', 'Win, and I may admit your sorcery has a shape.'],
    ],
  },
  gojo: {
    id: 'gojo', name: 'Satoru Gojo', charId: 'gojo', color: '#5b8cff',
    lessonName: 'Spatial Control',
    lessons: [
      'Blue pulls. Red pushes. Position is a weapon.',
      'Infinity ends. Everything ends. Fight like it.',
      'Inside Unlimited Void, ordinary answers stop working.',
    ],
    lines: [
      ['Gojo', 'Strong students, boring lessons. Show me your technique doing something interesting.'],
      ['Gojo', 'Beat me in a spar and I will sign off on your next technique. Sensei\'s honour.'],
    ],
  },
  megumi: {
    id: 'megumi', name: 'Megumi Fushiguro', charId: 'megumi', color: '#8f7bff',
    lessonName: 'Shadow Tactics',
    lessons: [
      'A shadow you cannot command is just a witness.',
      'Fusion is arithmetic with teeth: two answers, one question.',
      'In the Garden, copies are free. Discipline is not.',
    ],
    lines: [
      ['Megumi', 'Spar me if you want. My shadows will be there either way.'],
      ['Megumi', 'Taming is separate. Win the ritual, or the shadow keeps its name.'],
    ],
  },
};

export const APPEARANCE_OPTIONS = [
  { key: 'hairStyle', label: 'Hair style', values: ['spiky', 'wild', 'bob', 'long', 'slick', 'buzz', 'messy'] },
  { key: 'hair', label: 'Hair colour', values: ['#3a2a3a', '#1b1b24', '#f2a2b8', '#eef2ff', '#c06a3a', '#5b8cff', '#2f5d3a', '#ffd166'] },
  { key: 'skin', label: 'Skin', values: ['#f0c8a0', '#e8c0a0', '#c98a5e', '#8a5a3a', '#f0d0b8'] },
  { key: 'top', label: 'Uniform', values: ['#232a3a', '#1b2436', '#2a1a24', '#12141c', '#2a2230', '#3a2a4a'], syncDark: true },
  { key: 'accent', label: 'Accent', values: ['#8f7bff', '#ff2a4a', '#5b8cff', '#ffd166', '#7cf0a0', '#ff8a5c'] },
  { key: 'eye', label: 'Eyes', values: ['#f7f7f7', '#9fd8ff', '#ffd166', '#ff9a9a', '#bff0d0'] },
];

export const NAME_SUGGESTIONS = ['Ren', 'Kai', 'Sora', 'Yuna', 'Haru', 'Akira', 'Nia', 'Rin', 'Theo', 'Mika', 'Juno', 'Asa'];
