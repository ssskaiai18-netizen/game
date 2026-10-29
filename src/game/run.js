// ---------------------------------------------------------------------------
// run.js — one roguelite run: seed, arc, build, room progress, rewards and the
// permanent progression applied exactly once when the run ends.
// ---------------------------------------------------------------------------

import { Rng, clamp } from '../core/util.js';
import { defaultMods, UPGRADES, rollUpgrades, makeUpgradeContext } from '../data/upgrades.js';
import { ARCS, DIFFICULTIES } from '../data/story.js';
import { generateDungeon, nodeById, ROOM_TYPES } from './dungeon.js';
import { getCharacter } from '../data/characters.js';

export class Run {
  constructor(game, opts = {}) {
    this.game = game;
    this.charId = opts.charId || 'yuji';
    this.arcIndex = clamp(opts.arcIndex ?? 0, 0, ARCS.length - 1);
    this.difficultyId = opts.difficultyId || 'normal';
    this.seed = opts.seed || ((Math.random() * 4294967295) >>> 0);
    this.rng = new Rng(this.seed);
    this.arc = ARCS[this.arcIndex];
    this.diff = DIFFICULTIES[this.difficultyId] || DIFFICULTIES.normal;
    this.mods = defaultMods();
    this.upgrades = [];
    this.currentNodeId = null;
    this.roomsCleared = 0;
    this.bossesDefeated = 0;
    this.kills = 0;
    this.tribute = 0;
    this.cullingPoints = 0;
    this.score = 0;
    this.damageDealt = 0;
    this.highestHit = 0;
    this.bfSuccess = 0;
    this.bfAttempts = 0;
    this.techniques = 0;
    this.summonsUsed = 0;
    this.domainsUsed = 0;
    this.ultsUsed = 0;
    this.time = 0;
    this.victory = false;
    this.ended = false;
    this.rewardApplied = false;
    this.dungeon = generateDungeon(this.seed, this.arcIndex, this.difficultyId);
    this.currentNodeId = this.dungeon.startId;
    this.availableNodes = [this.dungeon.startId];
    this.visited = [];
    this.totalRooms = this.dungeon.floors;
    this.isCulling = !!opts.culling;
    this.colonyId = opts.colonyId || null;
    this.statsSnapshot = null;
  }

  get char() {
    return getCharacter(this.charId);
  }

  get currentNode() {
    return nodeById(this.dungeon, this.currentNodeId);
  }

  nextChoices() {
    const node = this.currentNode;
    if (!node) return [];
    if (node.type === 'boss') return [];
    return node.edges.map((id) => nodeById(this.dungeon, id)).filter(Boolean);
  }

  moveTo(nodeId) {
    const node = nodeById(this.dungeon, nodeId);
    if (!node) return false;
    const cur = this.currentNode;
    if (cur && !cur.cleared && cur.type !== 'combat') return false;
    this.currentNodeId = nodeId;
    this.visited.push(nodeId);
    return true;
  }

  clearCurrentRoom() {
    const node = this.currentNode;
    if (!node || node.cleared) return;
    node.cleared = true;
    node.visited = true;
    this.roomsCleared++;
    this.score += 60;
  }

  addTribute(n) {
    const fortune = 1 + (this.game.save?.data.tribute.fortune || 0) * 0.08;
    this.tribute += Math.round(n * fortune * (this.mods.tributeMult || 1));
  }

  addPoints(n) {
    this.cullingPoints += n;
  }

  addKill(enemy) {
    this.kills++;
    this.score += enemy.isBoss ? 400 : enemy.isElite ? 120 : 25;
  }

  addDamage(d) {
    this.damageDealt += d;
    this.highestHit = Math.max(this.highestHit, d);
    this.score += d * 0.25;
  }

  upgradeContext() {
    return makeUpgradeContext(this.charId, this.game.save, this);
  }

  rollUpgrades(count = 3, forceRarity = null) {
    const ctx = this.upgradeContext();
    const taken = this.upgrades.map((u) => u.id);
    const depth = 1 + this.roomsCleared * 0.12;
    return rollUpgrades(this.rng, ctx, count, { exclude: taken, forceRarity, weightedByDepth: depth });
  }

  applyUpgrade(up, player) {
    if (!up) return null;
    const ctx = this.upgradeContext();
    const prevMaxHp = player ? player.maxHp : 0;
    const prevMaxCe = player ? player.maxCe : 0;
    const unlockCtx = { ...ctx };
    up.apply(this.mods, unlockCtx);
    this.upgrades.push(up);
    if (unlockCtx.unlockBlackSparks) {
      this.mods.blackSparksGranted = true;
      const save = this.game.save;
      if (save && !save.data.unlocks.blackSparks) {
        save.data.unlocks.blackSparks = true;
        save.save();
      }
    }
    if (up.grantsAbility === 'boogie') this.mods.boogieUnlocked = true;
    if (player) this.refreshPlayerStats(player, prevMaxHp, prevMaxCe);
    return up;
  }

  refreshPlayerStats(player, prevMaxHp, prevMaxCe) {
    const mods = this.mods;
    const baseHp = player.baseHp || player.maxHp;
    const baseCe = player.baseCe || player.maxCe;
    player.mods = mods;
    player.maxHp = Math.round(baseHp * (mods.maxHpMult || 1) + (mods.maxHpFlat || 0));
    player.maxCe = Math.round(baseCe * (mods.maxCeMult || 1) + (mods.maxCeFlat || 0));
    if (player.maxHp !== prevMaxHp) player.hp = Math.min(player.maxHp, player.hp + Math.max(0, player.maxHp - prevMaxHp));
    if (player.maxCe !== prevMaxCe) player.ce = Math.min(player.maxCe, player.ce + Math.max(0, player.maxCe - prevMaxCe));
    player.speed = player.speedBase * (mods.moveSpeedMult || 1);
    player.blackSparks = player.blackSparks || !!this.game.save?.data.unlocks.blackSparks || !!this.mods.blackSparksGranted;
    player.boogieUnlocked = !!mods.boogieUnlocked;
  }

  /** Permanent progression — safe to call many times; only applies once. */
  finish(victory, world = null) {
    if (this.rewardApplied) return this.summary;
    this.rewardApplied = true;
    this.victory = victory;
    const save = this.game.save;
    const data = save.data;
    const diffMult = this.diff.rewardMult || 1;

    if (world) {
      this.statsSnapshot = { ...world.stats };
      this.score += Math.round(world.stats.longestCombo * 5);
      this.bfSuccess = world.stats.bfSuccess;
      this.bfAttempts = world.stats.bfAttempts;
      this.techniques = world.stats.techniques;
      this.domainsUsed = world.stats.domains;
      this.ultsUsed = world.stats.ults;
    }

    const scoreFinal = Math.round(
      (this.score + (victory ? 1200 : 0) + this.roomsCleared * 40 + this.kills * 10) *
        diffMult *
        (this.mods.scoreMult || 1)
    );

    // currency + stats
    const tributeGain = Math.round((this.tribute + this.roomsCleared * 6 + (victory ? 40 : 0)) * diffMult);
    data.tributeCurrency = clamp(data.tributeCurrency + tributeGain, 0, 999999);
    data.stats.runs++;
    data.stats.rooms += this.roomsCleared;
    data.stats.kills += this.kills;
    data.stats.bosses += this.bossesDefeated;
    data.stats.blackFlashes += this.bfSuccess;
    data.stats.totalDamage += Math.round(this.damageDealt);
    data.stats.bestHit = Math.max(data.stats.bestHit, Math.round(this.highestHit));
    data.stats.bestScore = Math.max(data.stats.bestScore, scoreFinal);
    data.mastery[this.charId] = (data.mastery[this.charId] || 0) + 1 + Math.floor(this.roomsCleared / 3);

    let unlocks = [];
    if (victory) {
      data.stats.wins++;
      const arc = this.arcIndex;
      if (!data.story.cleared[arc]) {
        data.story.cleared[arc] = true;
        unlocks = unlocks.concat(this.applyArcReward(arc, save));
        if (data.story.arc < ARCS.length - 1) data.story.arc = Math.max(data.story.arc, arc + 1);
      }
      if (this.isCulling) {
        data.culling.points += this.cullingPoints + 40;
      data.culling.participants.you = data.culling.points;
      }
      const arcRewardTribute = this.arc.reward?.tribute || 0;
      data.tributeCurrency += Math.round(arcRewardTribute * diffMult);
    } else {
      data.stats.deaths++;
    }
    // difficulty unlocks
    for (const [id, d] of Object.entries(DIFFICULTIES)) {
      if (!data.unlocks.difficulties.includes(id) && d.unlock(save)) {
        data.unlocks.difficulties.push(id);
        unlocks.push(`Difficulty: ${d.name}`);
      }
    }
    // 3-star progression: unlock characters after specific arcs
    if (data.story.cleared[0] && !save.hasCharacter('nobara')) {
      save.data.unlocks.characters.push('nobara');
      unlocks.push('Nobara Kugisaki');
    }
    if (data.story.cleared[2] && !save.hasCharacter('gojo')) {
      save.data.unlocks.characters.push('gojo');
      unlocks.push('Satoru Gojo');
    }
    if (data.story.cleared[3] && !save.hasCharacter('sukuna')) {
      save.data.unlocks.characters.push('sukuna');
      unlocks.push('Ryomen Sukuna');
    }

    const entry = {
      score: scoreFinal,
      char: this.charId,
      rooms: this.roomsCleared,
      arc: this.arcIndex,
      win: victory,
      date: Date.now(),
    };
    save.addScore(entry);
    data.updatedAt = Date.now();
    save.save();

    this.summary = {
      victory,
      charId: this.charId,
      charName: this.char.name,
      arcName: this.arc.name,
      arcIndex: this.arcIndex,
      difficultyId: this.difficultyId,
      rooms: this.roomsCleared,
      totalRooms: this.dungeon.floors,
      kills: this.kills,
      bosses: this.bossesDefeated,
      damage: Math.round(this.damageDealt),
      highestHit: Math.round(this.highestHit),
      bfSuccess: this.bfSuccess,
      bfAttempts: this.bfAttempts,
      techniques: this.techniques,
      summons: this.summonsUsed,
      ults: this.ultsUsed,
      domains: this.domainsUsed,
      upgrades: this.upgrades.map((u) => u.name),
      tribute: tributeGain,
      score: scoreFinal,
      unlocks,
      difficulty: this.diff.name,
    };
    return this.summary;
  }

  applyArcReward(arcIndex, save) {
    const out = [];
    const reward = ARCS[arcIndex].reward || {};
    if (reward.unlock) {
      const [kind, value] = reward.unlock.split(':');
      if (kind === 'character') {
        if (save.unlockCharacter(value)) out.push(`Character: ${getCharacter(value).name}`);
      } else if (kind === 'shikigami') {
        if (save.tameShikigami(value)) out.push(`Shikigami: ${value}`);
      } else if (kind === 'culling') {
        if (value === 'start') {
          save.data.culling.started = true;
          out.push('Culling Games unlocked');
        } else if (value === 'points') {
          save.data.culling.points += 100;
          out.push('Culling Games: +100 points');
        } else if (value === 'colony2') {
          if (!save.data.culling.colonies.includes('tokyo2')) {
            save.data.culling.colonies.push('tokyo2');
            out.push('Colony: Tokyo No. 2');
          }
        } else if (value === 'colony3') {
          if (!save.data.culling.colonies.includes('sendai')) {
            save.data.culling.colonies.push('sendai');
            out.push('Colony: Sendai');
          }
        }
      }
    }
    out.push(`Arc cleared: ${ARCS[arcIndex].name}`);
    return out;
  }

  getSummaryIfAny() {
    return this.summary || null;
  }
}
