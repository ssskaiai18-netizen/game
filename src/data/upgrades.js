// ---------------------------------------------------------------------------
// upgrades.js — run-scoped boons with rarity tiers, eligibility rules and
// real mechanical effects. Upgrades mutate the player's modifier object which
// every combat calculation reads, so nothing here is cosmetic.
// ---------------------------------------------------------------------------

export const RARITY = {
  common: { name: 'Common', color: '#9aa3b2', weight: 62, glow: '#c9d3e0' },
  rare: { name: 'Rare', color: '#5b8cff', weight: 26, glow: '#9fc0ff' },
  epic: { name: 'Epic', color: '#b06bff', weight: 10, glow: '#d9b6ff' },
  legendary: { name: 'Legendary', color: '#ffb03a', weight: 4, glow: '#ffd98a' },
};

export const CATEGORIES = {
  attack: { name: 'Basic Attack', color: '#ffd166' },
  technique: { name: 'Technique', color: '#8fd7ff' },
  reinforce: { name: 'Reinforcement', color: '#ff8a5c' },
  dodge: { name: 'Dodge', color: '#8fe3b0' },
  ce: { name: 'Cursed Energy', color: '#5b8cff' },
  blackflash: { name: 'Black Flash', color: '#ff3d5a' },
  summon: { name: 'Shikigami', color: '#a79bff' },
  domain: { name: 'Domain', color: '#c9a2ff' },
  ult: { name: 'Ultimate', color: '#ffb03a' },
  survival: { name: 'Survival', color: '#7ec8ff' },
  mobility: { name: 'Mobility', color: '#9ad0ff' },
  status: { name: 'Status', color: '#b0ffb0' },
  character: { name: 'Character', color: '#ff9ac0' },
};

export function defaultMods() {
  return {
    // damage
    dmgMult: 1,
    basicDmgMult: 1,
    techDmgMult: 1,
    ultDmgMult: 1,
    summonDmgMult: 1,
    domainDmgMult: 1,
    markDmgMult: 1,
    executeBonus: 0,
    // resources
    maxHpMult: 1,
    maxHpFlat: 0,
    maxCeMult: 1,
    maxCeFlat: 0,
    ceCostMult: 1,
    ceRegenMult: 1,
    ceOnKill: 0,
    lifesteal: 0,
    healOnKill: 0,
    armor: 0,
    // movement
    moveSpeedMult: 1,
    dashCdMult: 1,
    dashDistMult: 1,
    dashCeCostMult: 1,
    dodgeIframesBonus: 0,
    perfectDodgeCe: 0,
    perfectDodgeBuff: false,
    // reinforcement
    reinforceCostMult: 1,
    reinforceDurMult: 1,
    reinforceDmgMult: 1,
    reinforceSummon: false,
    reinforceArmor: 0,
    // black flash
    bfWindowMult: 1,
    bfDmgMult: 1,
    bfTechBuff: false,
    bfCeRefund: 0,
    bfChain: 0,
    // summons
    summonDurMult: 1,
    summonHpMult: 1,
    summonCdMult: 1,
    summonExtra: 0,
    // domain / ult
    domainCostMult: 1,
    domainDurMult: 1,
    ultGainMult: 1,
    ultCostMult: 1,
    // status
    markDmg: 0,
    bleedOnHit: 0,
    slowOnHit: 0,
    stunChance: 0,
    thorns: 0,
    // meta
    tributeMult: 1,
    scoreMult: 1,
    shrineMark: false,
    boogieFollowup: false,
    domainSynergy: false,
    boogieUnlocked: false,
    hitstopMult: 1,
    knockbackMult: 1,
    projectileBonus: 0,
    pierceBonus: 0,
    // bookkeeping
    taken: [],
  };
}

export const UPGRADES = [
  // ---------------------------------------------------------------- ATTACK
  { id: 'sharp_fists', name: 'Honed Knuckles', desc: 'Basic attacks deal +18% damage.', rarity: 'common', cat: 'attack', apply: (m) => (m.basicDmgMult *= 1.18) },
  { id: 'heavy_hands', name: 'Heavy Hands', desc: 'Basic attacks knock enemies back 35% further and stagger harder.', rarity: 'common', cat: 'attack', apply: (m) => (m.knockbackMult *= 1.35) },
  { id: 'quick_chain', name: 'Quick Chain', desc: 'Combo windows are more forgiving and basic attacks recover 25% faster.', rarity: 'rare', cat: 'attack', tags: ['combo'], apply: (m) => (m.basicDmgMult *= 1.1) },
  { id: 'finisher', name: 'Finisher Instinct', desc: 'The last hit of each combo deals +60% damage.', rarity: 'rare', cat: 'attack', apply: (m) => (m.finisherBonus = 0.6) },
  { id: 'wide_arc', name: 'Wide Arc', desc: 'Melee hitboxes are 20% wider and hit 1 extra nearby enemy.', rarity: 'epic', cat: 'attack', apply: (m) => (m.meleeWide = 1.2) },
  { id: 'bloodlust', name: 'Bloodlust', desc: 'Killing an enemy heals 6 HP and refunds 10 CE.', rarity: 'epic', cat: 'attack', apply: (m) => { m.healOnKill += 6; m.ceOnKill += 10; } },

  // ------------------------------------------------------------- TECHNIQUE
  { id: 'refined_tech', name: 'Refined Technique', desc: 'Technique damage +20%.', rarity: 'common', cat: 'technique', apply: (m) => (m.techDmgMult *= 1.2) },
  { id: 'efficient', name: 'Efficient Cursed Energy', desc: 'All technique costs reduced by 15%.', rarity: 'rare', cat: 'technique', apply: (m) => (m.ceCostMult *= 0.85) },
  { id: 'fast_cast', name: 'Fast Casting', desc: 'Technique cooldowns reduced by 20%.', rarity: 'rare', cat: 'technique', apply: (m) => (m.techCdMult = (m.techCdMult || 1) * 0.8) },
  { id: 'piercing_will', name: 'Piercing Will', desc: 'Your projectiles pierce 2 extra targets and travel 20% further.', rarity: 'rare', cat: 'technique', apply: (m) => (m.pierceBonus += 2) },
  { id: 'twin_cast', name: 'Twin Cast', desc: 'Ranged techniques fire one extra projectile.', rarity: 'epic', cat: 'technique', apply: (m) => (m.projectileBonus += 1) },
  { id: 'cursed_overload', name: 'Cursed Overload', desc: 'Technique damage +45%, but techniques cost 20% more CE.', rarity: 'epic', cat: 'technique', apply: (m) => { m.techDmgMult *= 1.45; m.ceCostMult *= 1.2; } },

  // ---------------------------------------------------------- REINFORCEMENT
  { id: 'deep_well', name: 'Deep Well', desc: 'Max cursed energy +30.', rarity: 'common', cat: 'ce', apply: (m) => (m.maxCeFlat += 30) },
  { id: 'flow', name: 'Cursed Flow', desc: 'CE regeneration +35%.', rarity: 'common', cat: 'ce', apply: (m) => (m.ceRegenMult *= 1.35) },
  { id: 'reinforced_core', name: 'Reinforced Core', desc: 'Reinforcement costs 30% less and lasts 40% longer.', rarity: 'rare', cat: 'reinforce', apply: (m) => { m.reinforceCostMult *= 0.7; m.reinforceDurMult *= 1.4; } },
  { id: 'iron_skin', name: 'Iron Skin', desc: 'While reinforced, take 20% less damage. Gain +3% armour permanently.', rarity: 'rare', cat: 'reinforce', apply: (m) => { m.reinforceArmor += 0.2; m.armor += 0.03; } },
  { id: 'overcharge', name: 'Overcharge', desc: 'Reinforced attacks deal +35% damage.', rarity: 'epic', cat: 'reinforce', apply: (m) => (m.reinforceDmgMult *= 1.35) },
  { id: 'reinforce_bond', name: 'Reinforced Bond', desc: 'Reinforced hits empower your next summon command by 50%.', rarity: 'epic', cat: 'reinforce', apply: (m) => (m.reinforceSummon = true) },

  // ------------------------------------------------------------------ DODGE
  { id: 'light_steps', name: 'Light Steps', desc: 'Dodge cooldown -20% and dodge distance +15%.', rarity: 'common', cat: 'dodge', apply: (m) => { m.dashCdMult *= 0.8; m.dashDistMult *= 1.15; } },
  { id: 'perfect_timing', name: 'Perfect Timing', desc: 'Dodging within 0.18s of an incoming hit restores 12 CE.', rarity: 'rare', cat: 'dodge', apply: (m) => (m.perfectDodgeCe += 12) },
  { id: 'counter_flow', name: 'Counter Flow', desc: 'Perfect dodges grant a 2.5s +30% damage window.', rarity: 'rare', cat: 'dodge', apply: (m) => (m.perfectDodgeBuff = true) },
  { id: 'phantom_step', name: 'Phantom Step', desc: 'Dodge gives 0.15s of extra invulnerability.', rarity: 'epic', cat: 'dodge', apply: (m) => (m.dodgeIframesBonus += 0.15) },
  { id: 'shadow_echo', name: 'Shadow Echo', desc: 'Dodging leaves a damaging shadow echo behind you.', rarity: 'epic', cat: 'dodge', apply: (m) => (m.dodgeEcho = 18) },

  // --------------------------------------------------------------- SURVIVAL
  { id: 'vitality', name: 'Steel Frame', desc: 'Max HP +25.', rarity: 'common', cat: 'survival', apply: (m) => (m.maxHpFlat += 25) },
  { id: 'thick_hide', name: 'Thick Hide', desc: 'Take 6% less damage.', rarity: 'common', cat: 'survival', apply: (m) => (m.armor += 0.06) },
  { id: 'leech', name: 'Cursed Leech', desc: 'Heal for 8% of damage dealt.', rarity: 'rare', cat: 'survival', apply: (m) => (m.lifesteal += 0.08) },
  { id: 'bastion', name: 'Bastion', desc: 'Max HP +40 and damage taken -8%.', rarity: 'epic', cat: 'survival', apply: (m) => { m.maxHpFlat += 40; m.armor += 0.08; } },
  { id: 'second_wind', name: 'Second Wind', desc: 'Once per run, survive a killing blow at 1 HP and gain 25% damage for 6s.', rarity: 'legendary', cat: 'survival', apply: (m) => (m.revive = true) },

  // --------------------------------------------------------------- MOBILITY
  { id: 'sprint', name: 'Cursed Sprint', desc: 'Movement speed +12%.', rarity: 'common', cat: 'mobility', apply: (m) => (m.moveSpeedMult *= 1.12) },
  { id: 'air_step', name: 'Air Step', desc: 'Dodge costs 40% less CE.', rarity: 'rare', cat: 'mobility', apply: (m) => (m.dashCeCostMult *= 0.6) },

  // ------------------------------------------------------------ BLACK FLASH
  {
    id: 'bf_sparks',
    name: 'Black Sparks Scroll',
    desc: 'Unlock Black Flash attempts. Time reinforcement to the moment of impact. Permanent unlock.',
    rarity: 'legendary',
    cat: 'blackflash',
    requires: (ctx) => !ctx.blackSparks,
    apply: (m, ctx) => {
      m.bfWindowMult *= 1.0;
      ctx.unlockBlackSparks = true;
      m.taken.push('bf_sparks');
    },
    permanent: true,
  },
  { id: 'bf_instinct', name: 'Spark Instinct', desc: 'Black Flash timing window +35%.', rarity: 'rare', cat: 'blackflash', requires: (c) => c.blackSparks, apply: (m) => (m.bfWindowMult *= 1.35) },
  { id: 'bf_power', name: 'Resonant Impact', desc: 'Black Flash deals +50% damage and refunds 15 CE.', rarity: 'epic', cat: 'blackflash', requires: (c) => c.blackSparks, apply: (m) => { m.bfDmgMult *= 1.5; m.bfCeRefund += 15; } },
  { id: 'bf_overflow', name: 'Spark Overflow', desc: 'A Black Flash empowers your next technique by +80% damage.', rarity: 'legendary', cat: 'blackflash', requires: (c) => c.blackSparks, apply: (m) => (m.bfTechBuff = true) },
  { id: 'bf_chain', name: 'Consecutive Spark', desc: 'Black Flash success grants a 1.2s window where the next eligible hit has a wider window.', rarity: 'legendary', cat: 'blackflash', requires: (c) => c.blackSparks, apply: (m) => (m.bfChain += 1) },

  // ---------------------------------------------------------------- SUMMONS
  { id: 'summon_bond', name: 'Shadow Bond', desc: 'Shikigami deal +25% damage.', rarity: 'rare', cat: 'summon', chars: ['megumi'], apply: (m) => (m.summonDmgMult *= 1.25) },
  { id: 'summon_health', name: 'Twilight Vigor', desc: 'Shikigami gain +40% max HP.', rarity: 'rare', cat: 'summon', chars: ['megumi'], apply: (m) => (m.summonHpMult *= 1.4) },
  { id: 'summon_duration', name: 'Lingering Shadows', desc: 'Shikigami persist 35% longer.', rarity: 'rare', cat: 'summon', chars: ['megumi'], apply: (m) => (m.summonDurMult *= 1.35) },
  { id: 'summon_twin', name: 'Twin Summons', desc: 'Summon one additional shikigami for free.', rarity: 'epic', cat: 'summon', chars: ['megumi'], apply: (m) => (m.summonExtra += 1) },
  { id: 'summon_command', name: 'Absolute Command', desc: 'Shikigami commands deal +60% damage and have -40% cooldown.', rarity: 'epic', cat: 'summon', chars: ['megumi'], apply: (m) => { m.techDmgMult *= 1.2; m.summonCdMult *= 0.6; } },
  { id: 'ten_shadows_meter', name: 'Ten Shadows Resonance', desc: 'Ultimate meter gain +35%.', rarity: 'rare', cat: 'ult', chars: ['megumi'], apply: (m) => (m.ultGainMult *= 1.35) },

  // ------------------------------------------------------------ DOMAIN / ULT
  { id: 'domain_mastery', name: 'Domain Mastery', desc: 'Domains cost 25% less CE and last 30% longer. (Requires a Domain.)', rarity: 'epic', cat: 'domain', requires: (c) => !!c.hasDomain, apply: (m) => { m.domainCostMult *= 0.75; m.domainDurMult *= 1.3; } },
  { id: 'domain_synergy', name: 'Domain Symbiosis', desc: 'Inside your Domain, your other upgrades are amplified: +30% technique damage and doubled proc effects.', rarity: 'legendary', cat: 'domain', requires: (c) => !!c.hasDomain, apply: (m) => (m.domainSynergy = true) },
  { id: 'ult_charge', name: 'Overflowing Cursed Energy', desc: 'Ultimate meter gain +30%.', rarity: 'common', cat: 'ult', apply: (m) => (m.ultGainMult *= 1.3) },
  { id: 'ult_power', name: 'Ultimate Focus', desc: 'Ultimate damage +40%.', rarity: 'rare', cat: 'ult', apply: (m) => (m.ultDmgMult *= 1.4) },
  { id: 'ult_cost', name: 'Instinctive Release', desc: 'Ultimate meter requirement reduced by 15%.', rarity: 'epic', cat: 'ult', apply: (m) => (m.ultCostMult *= 0.85) },

  // ---------------------------------------------------------------- STATUS
  { id: 'bleeding_edge', name: 'Bleeding Edge', desc: 'Attacks apply bleed for 3 damage per second.', rarity: 'rare', cat: 'status', apply: (m) => (m.bleedOnHit += 3) },
  { id: 'frost_touch', name: 'Chilling Strikes', desc: 'Attacks slow enemies by 25% for 1.2s.', rarity: 'rare', cat: 'status', apply: (m) => (m.slowOnHit += 0.25) },
  { id: 'impact', name: 'Impact Force', desc: 'Stunned enemies take +25% damage. Attacks have a 15% stun chance.', rarity: 'epic', cat: 'status', apply: (m) => (m.stunChance += 0.15) },
  { id: 'thorn_cursed', name: 'Thorned Cursed Skin', desc: 'Reflect 25% of melee damage taken.', rarity: 'epic', cat: 'status', apply: (m) => (m.thorns += 0.25) },

  // ------------------------------------------------------- CHARACTER SPECIFIC
  { id: 'yuji_blackflash', name: 'Vessel of the King', desc: 'Black Flash window +50% and Black Flash grants 2 extra combo hits of empowerment. (Yuji)', rarity: 'epic', cat: 'character', chars: ['yuji'], apply: (m) => { m.bfWindowMult *= 1.5; m.bfChain += 1; } },
  { id: 'yuji_blood', name: 'Unbroken Will', desc: 'Below 40% HP, deal +30% damage. (Yuji)', rarity: 'rare', cat: 'character', chars: ['yuji'], apply: (m) => (m.lowHpRage = 0.3) },
  { id: 'megumi_totality', name: 'Totality Path', desc: 'Summons inherit +30% of your damage and gain a life on defeat. (Megumi)', rarity: 'epic', cat: 'character', chars: ['megumi'], apply: (m) => (m.totalityPath = true) },
  { id: 'nobara_mark', name: 'Deep Resonance', desc: 'Marked enemies take +40% more damage and marks spread on death. (Nobara)', rarity: 'epic', cat: 'character', chars: ['nobara'], apply: (m) => { m.markDmg += 0.4; } },
  { id: 'gojo_infinity', name: 'Six Eyes', desc: 'CE regeneration +40%, Infinity blocks one extra hit. (Gojo)', rarity: 'epic', cat: 'character', chars: ['gojo'], apply: (m) => { m.ceRegenMult *= 1.4; m.infinityHit = 1; } },
  { id: 'sukuna_cleave', name: 'King\'s Authority', desc: 'Cutting damage +30% and Cleave costs 40% less. (Sukuna)', rarity: 'epic', cat: 'character', chars: ['sukuna'], apply: (m) => { m.basicDmgMult *= 1.3; } },

  // ----------------------------------------------------------- SYNERGY FLAGS
  {
    id: 'boogie_woogie',
    name: 'Boogie Woogie',
    desc: 'Gain the Boogie Woogie technique [T]: swap places with the nearest enemy, opening an enhanced follow-up.',
    rarity: 'legendary',
    cat: 'mobility',
    requires: (c) => !c.hasBoogie,
    apply: (m) => {
      m.boogieUnlocked = true;
      m.boogieFollowup = true;
    },
    grantsAbility: 'boogie',
  },
  {
    id: 'shrine_mark',
    name: 'Shrine\'s Mark',
    desc: 'Shrine and cutting attacks mark targets. Marked targets take +30% from your next eligible attack.',
    rarity: 'epic',
    cat: 'status',
    apply: (m) => (m.shrineMark = true),
  },
];

export function isEligible(up, ctx) {
  if (up.chars && !up.chars.includes(ctx.char)) return false;
  if (up.requires && !up.requires(ctx)) return false;
  return true;
}

export function rollUpgrades(rng, ctx, count = 3, options = {}) {
  const { exclude = [], forceRarity = null, weightedByDepth = 1 } = options;
  const pool = UPGRADES.filter((u) => isEligible(u, ctx) && !exclude.includes(u.id));
  const picks = [];
  const used = new Set();
  let guard = 0;
  while (picks.length < count && guard++ < 200) {
    const rarityRoll = forceRarity || weightedRarity(rng, weightedByDepth);
    let candidates = pool.filter((u) => u.rarity === rarityRoll && !used.has(u.id));
    if (!candidates.length) candidates = pool.filter((u) => !used.has(u.id));
    if (!candidates.length) break;
    const pick = rng.pick(candidates);
    used.add(pick.id);
    picks.push(pick);
  }
  return picks;
}

function weightedRarity(rng, depthMult) {
  const entries = Object.entries(RARITY).map(([id, r]) => ({
    id,
    w: id === 'common' ? r.weight / depthMult : r.weight * (id === 'legendary' ? Math.min(2, depthMult) : 1),
  }));
  return rng.weighted(entries).id;
}

export function makeUpgradeContext(charId, save, run) {
  const c = (save && save.data) || { unlocks: { blackSparks: false } };
  const def = { hasDomain: !!(run && run.domain), hasBoogie: !!(run && run.mods && run.mods.boogieUnlocked) };
  return {
    char: charId,
    blackSparks: !!c.unlocks.blackSparks,
    hasDomain: def.hasDomain,
    hasBoogie: def.hasBoogie,
    save,
    run,
  };
}
