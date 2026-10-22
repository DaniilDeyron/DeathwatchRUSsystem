import { getRankImage } from '../../../helpers/character/rank-helper.mjs';
import { WoundHelper } from '../../../helpers/character/wound-helper.mjs';
import { SkillHelper } from '../../../helpers/character/skill-helper.mjs';
import { InsanityHelper } from '../../../helpers/insanity/insanity-helper.mjs';
import { WeaponQualityHelper } from '../../../helpers/combat/weapon-quality-helper.mjs';

/**
 * Prepares character-specific data for character sheets.
 * Handles characteristics, skills, chapter/specialty integration,
 * XP calculations, and character progression.
 */
export class CharacterDataPreparer {
  /**
   * Prepare all character data for sheet display.
   * @param {Object} context - Sheet context
   * @param {Actor} actor - Actor document
   */
  static async prepare(context, actor) {
    this.prepareCharacteristics(context);
    this.prepareChapterAndSpecialty(context, actor);
    this.prepareSkills(context, actor);
    this.prepareConfig(context);
    this.prepareRankAndWounds(context);
    this.prepareRenown(context);
    this.preparePsyRating(context);
    this.prepareMentalState(context, actor);
    await this.prepareWeapons(context);
  }

  /**
   * Prepare weapons with hasFlame flag for template rendering.
   * @param {Object} context - Sheet context
   */
  static async prepareWeapons(context) {
    if (!context.items) return;

    // Add hasFlame flag to each weapon
    for (const item of context.items) {
      if (item.type === 'weapon') {
        item.hasFlame = await WeaponQualityHelper.hasQuality(item, 'flame');
      }
    }
  }

  /**
   * Prepare characteristic labels.
   * @param {Object} context - Sheet context
   */
  static prepareCharacteristics(context) {
    for (let [k, v] of Object.entries(context.system.characteristics)) {
      v.label = game.i18n.localize(game.deathwatch.config.CharacteristicWords[k]) ?? k;
    }
  }

  /**
   * Prepare chapter and specialty items.
   * @param {Object} context - Sheet context
   * @param {Actor} actor - Actor document
   */
  static prepareChapterAndSpecialty(context, actor) {
    // Get chapter item if set
    if (context.system.chapterId) {
      context.chapterItem = actor.items.get(context.system.chapterId);
    }

    // Get specialty item if set
    if (context.system.specialtyId) {
      context.specialtyItem = actor.items.get(context.system.specialtyId);
    }
  }

  /**
   * Prepare skills with costs, totals, sorting, and rank availability.
   * @param {Object} context - Sheet context
   * @param {Actor} actor - Actor document
   */
  static prepareSkills(context, actor) {
    if (!context.system.skills) return;

    const currentRank = context.system.rank || 1;

    // Get skill cost overrides
    const costs = this._getSkillCosts(context);

    // Sort skills alphabetically
    const sortedSkills = this._sortSkills(context.system.skills);

    // Process each skill
    for (const [k, v] of sortedSkills) {
      v.label = game.i18n.localize(game.deathwatch.config.Skills[k]) ?? k;

      // Calculate skill total from live data (includes modifierTotal)
      v.total = this._calculateSkillTotal(v, k, context, actor);

      // Apply cost overrides
      this._applySkillCosts(v, k, costs);

      // Add rank availability flags for UI
      this._addRankAvailability(v, k, currentRank, costs.specialtyRankRequirements);
    }
  }

  /**
   * Add rank availability flags to skill for UI display.
   * @param {Object} skill - Skill object
   * @param {string} skillKey - Skill key
   * @param {number} currentRank - Character's current rank
   * @param {Object} specialtyRankReqs - Specialty rank requirements map
   * @private
   */
  static _addRankAvailability(skill, skillKey, currentRank, specialtyRankReqs = {}) {
    // Check each training level for rank availability
    const trainingLevels = [
      { level: 'trained', costKey: 'costTrain', rankKey: 'trainedRank' },
      { level: 'mastered', costKey: 'costMaster', rankKey: 'masteredRank' },
      { level: 'expert', costKey: 'costExpert', rankKey: 'expertRank' }
    ];

    for (const { level, costKey, rankKey } of trainingLevels) {
      const trainingData = skill[level] || skill.training?.[level];
      const hasCostOverride = skill[costKey] !== undefined && skill[costKey] !== null;
      const specialtyRank = specialtyRankReqs[skillKey]?.[rankKey];

      if (trainingData === null || trainingData === undefined) {
        // Check if specialty/chapter provides cost override for forbidden skill
        if (hasCostOverride) {
          // Use specialty's explicit rank requirement if available
          const rankRequired = specialtyRank !== undefined ? specialtyRank : 1;
          skill[`${level}Available`] = currentRank >= rankRequired;
          skill[`${level}RankRequired`] = rankRequired;
        } else {
          // Never available
          skill[`${level}Available`] = false;
          skill[`${level}RankRequired`] = -1;
        }
      } else if (typeof trainingData === 'object' && trainingData.rank !== undefined) {
        // New nested format - base skill has rank requirement
        // Specialty rank override takes precedence over base rank requirement
        const rankRequired = specialtyRank !== undefined ? specialtyRank : trainingData.rank;
        skill[`${level}Available`] = currentRank >= rankRequired;
        skill[`${level}RankRequired`] = rankRequired;
      } else {
        // Legacy format or always available
        skill[`${level}Available`] = true;
        skill[`${level}RankRequired`] = 1;
      }
    }
  }

  /**
   * Get skill cost overrides from chapter and specialty.
   * @param {Object} context - Sheet context
   * @returns {Object} Cost overrides
   * @private
   */
  static _getSkillCosts(context) {
    // Get chapter skill cost overrides
    const chapterSkillCosts = {};
    if (context.chapterItem && context.chapterItem.system.skillCosts) {
      Object.assign(chapterSkillCosts, context.chapterItem.system.skillCosts);
    }

    // Get specialty base skill cost overrides
    const specialtyBaseSkillCosts = {};
    if (context.specialtyItem && context.specialtyItem.system.skillCosts) {
      Object.assign(specialtyBaseSkillCosts, context.specialtyItem.system.skillCosts);
    }

    // Get specialty rank-based skill cost overrides (cumulative from rank 1 to current rank)
    const specialtySkillCosts = {};
    const specialtySkillRanks = {}; // Maps skillKey -> { trainedRank, masteredRank, expertRank }
    const specialtyTalentCosts = {}; // Maps talent ID to array of costs

    if (context.specialtyItem && context.specialtyItem.system.rankCosts) {
      const currentRank = context.system.rank || 1;
      // Accumulate costs from rank 1 up to current rank
      for (let rank = 1; rank <= currentRank; rank++) {
        const rankData = context.specialtyItem.system.rankCosts[rank.toString()];
        if (rankData) {
          // Merge skills (later ranks override earlier ranks for same skill level)
          if (rankData.skills) {
            for (const [skillKey, skillCost] of Object.entries(rankData.skills)) {
              if (!specialtySkillCosts[skillKey]) specialtySkillCosts[skillKey] = {};
              if (!specialtySkillRanks[skillKey]) specialtySkillRanks[skillKey] = {};

              // Track which rank each training level becomes available
              if (skillCost.costTrain !== undefined) {
                specialtySkillRanks[skillKey].trainedRank = rank;
              }
              if (skillCost.costMaster !== undefined) {
                specialtySkillRanks[skillKey].masteredRank = rank;
              }
              if (skillCost.costExpert !== undefined) {
                specialtySkillRanks[skillKey].expertRank = rank;
              }

              Object.assign(specialtySkillCosts[skillKey], skillCost);
            }
          }
          // Accumulate talents as arrays (for stackable talents)
          if (rankData.talents) {
            for (const [talentId, cost] of Object.entries(rankData.talents)) {
              if (!specialtyTalentCosts[talentId]) specialtyTalentCosts[talentId] = [];
              specialtyTalentCosts[talentId].push(cost);
            }
          }
        }
      }
    }

    // Store talent cost overrides for later use in _prepareItems
    context.specialtyTalentCosts = specialtyTalentCosts;
    context.chapterTalentCosts = context.chapterItem?.system.talentCosts || {};
    context.specialtyBaseTalentCosts = context.specialtyItem?.system.talentCosts || {};

    return {
      chapter: chapterSkillCosts,
      specialtyBase: specialtyBaseSkillCosts,
      specialtyRank: specialtySkillCosts,
      specialtyRankRequirements: specialtySkillRanks
    };
  }

  /**
   * Sort skills alphabetically by localized label.
   * @param {Object} skills - Skills object
   * @returns {Array} Sorted [key, skill] pairs
   * @private
   */
  static _sortSkills(skills) {
    return Object.entries(skills)
      .sort(([keyA, a], [keyB, b]) => {
        const labelA = game.i18n.localize(game.deathwatch.config.Skills[keyA] || keyA);
        const labelB = game.i18n.localize(game.deathwatch.config.Skills[keyB] || keyB);
        return labelA.localeCompare(labelB);
      });
  }

  /**
   * Calculate total skill value including modifiers.
   * @param {Object} skill - Skill data
   * @param {string} skillKey - Skill key
   * @param {Object} context - Sheet context
   * @param {Actor} actor - Actor document
   * @returns {number} Total skill value
   * @private
   */
  static _calculateSkillTotal(skill, skillKey, context, actor) {
    const liveSkill = actor.system.skills[skillKey];
    const baseSkillTotal = SkillHelper.calculateSkillTotal(skill, context.system.characteristics);
    const skillModTotal = liveSkill?.modifierTotal || 0;
    return baseSkillTotal + skillModTotal;
  }

  /**
   * Apply chapter/specialty cost overrides to skill.
   * @param {Object} skill - Skill object
   * @param {string} skillKey - Skill key
   * @param {Object} costs - Cost overrides
   * @private
   */
  static _applySkillCosts(skill, skillKey, costs) {
    // Apply chapter skill cost overrides
    if (costs.chapter[skillKey]) {
      if (costs.chapter[skillKey].costTrain !== undefined) skill.costTrain = costs.chapter[skillKey].costTrain;
      if (costs.chapter[skillKey].costMaster !== undefined) skill.costMaster = costs.chapter[skillKey].costMaster;
      if (costs.chapter[skillKey].costExpert !== undefined) skill.costExpert = costs.chapter[skillKey].costExpert;
    }

    // Apply specialty base skill cost overrides (takes precedence over chapter)
    if (costs.specialtyBase[skillKey]) {
      if (costs.specialtyBase[skillKey].costTrain !== undefined) skill.costTrain = costs.specialtyBase[skillKey].costTrain;
      if (costs.specialtyBase[skillKey].costMaster !== undefined) skill.costMaster = costs.specialtyBase[skillKey].costMaster;
      if (costs.specialtyBase[skillKey].costExpert !== undefined) skill.costExpert = costs.specialtyBase[skillKey].costExpert;
    }

    // Apply specialty rank-based skill cost overrides (takes precedence over base specialty)
    if (costs.specialtyRank[skillKey] !== undefined) {
      // Support both simple number format and full object format
      if (typeof costs.specialtyRank[skillKey] === 'number') {
        skill.costTrain = costs.specialtyRank[skillKey];
      } else if (typeof costs.specialtyRank[skillKey] === 'object') {
        if (costs.specialtyRank[skillKey].costTrain !== undefined) skill.costTrain = costs.specialtyRank[skillKey].costTrain;
        if (costs.specialtyRank[skillKey].costMaster !== undefined) skill.costMaster = costs.specialtyRank[skillKey].costMaster;
        if (costs.specialtyRank[skillKey].costExpert !== undefined) skill.costExpert = costs.specialtyRank[skillKey].costExpert;
      }
    }
  }

  /**
   * Add config to context for template access.
   * @param {Object} context - Sheet context
   */
  static prepareConfig(context) {
    context.config = game.deathwatch.config;
  }

  /**
   * Prepare rank image and wound color class.
   * @param {Object} context - Sheet context
   */
  static prepareRankAndWounds(context) {
    // Add rank image
    context.rankImage = getRankImage(context.system.rank);

    // Calculate wound color class
    const wounds = context.system.wounds;
    context.woundColorClass = WoundHelper.getWoundColorClass(wounds?.value, wounds?.max);
  }

  /**
   * Calculate and prepare renown rank.
   * @param {Object} context - Sheet context
   */
  static prepareRenown(context) {
    context.renownRank = this._getRenownRank(context.system.renown || 0);
  }

  /**
   * Get renown rank based on renown value.
   * @param {number} renown - The renown value
   * @returns {string} The renown rank
   * @private
   */
  static _getRenownRank(renown) {
    if (renown >= 80) return 'Hero';
    if (renown >= 60) return 'Famed';
    if (renown >= 40) return 'Distinguished';
    if (renown >= 20) return 'Respected';
    return 'Initiated';
  }

  /**
   * Determine if Psy Rating box should be shown.
   * @param {Object} context - Sheet context
   */
  static preparePsyRating(context) {
    // Show Psy Rating box if specialty has hasPsyRating
    context.showPsyRating = context.specialtyItem?.system?.hasPsyRating || false;
  }

  /**
   * Prepare mental state data (corruption, insanity, battle traumas).
   * @param {Object} context - Sheet context
   * @param {Actor} actor - Actor document
   */
  static prepareMentalState(context, actor) {
    const system = context.system;

    // Corruption percentage
    context.corruptionPercent = Math.min(100, (system.corruption || 0));

    // Insanity percentage
    context.insanityPercent = Math.min(100, (system.insanity || 0));

    // Trauma modifier from track level
    context.traumaModifier = InsanityHelper.getTraumaModifier(system.insanity || 0);

    // Battle traumas list - convert items to array if needed
    const itemsArray = actor.items instanceof Map
      ? Array.from(actor.items.values())
      : Array.isArray(actor.items)
        ? actor.items
        : Array.from(actor.items);
    context.battleTraumas = itemsArray.filter(i => i.type === 'battle-trauma');

    // Format insanity history
    context.insanityHistory = this._formatInsanityHistory(system.insanityHistory || []);

    // Format corruption history
    context.corruptionHistory = this._formatCorruptionHistory(system.corruptionHistory || []);
  }

  /**
   * Format insanity history entries with cumulative totals.
   * @param {Array} history - Raw history entries
   * @returns {Array} Formatted entries
   * @private
   */
  static _formatInsanityHistory(history) {
    let runningTotal = 0;
    return history.map(entry => {
      runningTotal += entry.points;
      return {
        date: new Date(entry.timestamp).toLocaleDateString(),
        source: entry.source,
        points: entry.points,
        total: runningTotal,
        testRolled: entry.testRolled,
        testResult: entry.testResult || '—'
      };
    }).reverse(); // Most recent first
  }

  /**
   * Format corruption history entries with cumulative totals.
   * @param {Array} history - Raw history entries
   * @returns {Array} Formatted entries
   * @private
   */
  static _formatCorruptionHistory(history) {
    let runningTotal = 0;
    return history.map(entry => {
      runningTotal += entry.points;
      return {
        date: new Date(entry.timestamp).toLocaleDateString(),
        source: entry.source,
        points: entry.points,
        total: runningTotal
      };
    }).reverse(); // Most recent first
  }
}
