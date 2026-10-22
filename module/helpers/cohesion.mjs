import { COHESION, CHARACTERISTIC_CONSTANTS } from "./constants/index.mjs";
import { Sanitizer } from './sanitizer.mjs';
import { FoundryAdapter } from './foundry-adapter.mjs';

/**
 * Static helper class for Kill-team Cohesion calculations.
 * Pure functions — no Foundry API calls unless explicitly noted.
 * Non-pure functions use FoundryAdapter for Foundry API access.
 */
export class CohesionHelper {

  /**
   * Calculate the Cohesion pool maximum.
   * @param {number} fellowshipValue - Squad leader's computed fs.value
   * @param {number} rank - Squad leader's current rank (1–8)
   * @param {Object} commandSkill - { trained, mastered, expert } booleans
   * @param {number} [gmModifier=0] - GM-set modifier from world setting
   * @returns {number}
   */
  static calculateCohesionMax(fellowshipValue, rank, commandSkill, gmModifier = 0) {
    const fsBonus = Math.floor(fellowshipValue / CHARACTERISTIC_CONSTANTS.BONUS_DIVISOR);
    const rankMod = CohesionHelper.getRankModifier(rank);
    const commandMod = CohesionHelper.getCommandModifier(commandSkill);
    return Math.max(0, fsBonus + rankMod + commandMod + gmModifier);
  }

  /**
   * Get rank modifier for Cohesion.
   * Rank 0–3: +0, Rank 4–5: +1, Rank 6+: +2
   * @param {number} rank
   * @returns {number}
   */
  static getRankModifier(rank) {
    if (rank >= COHESION.RANK_THRESHOLD_HIGH) return COHESION.RANK_BONUS_HIGH;
    if (rank >= COHESION.RANK_THRESHOLD_MID) return COHESION.RANK_BONUS_MID;
    return 0;
  }

  /**
   * Get Command skill modifier for Cohesion. Only the highest tier applies.
   * @param {Object} commandSkill - { trained, mastered, expert } booleans
   * @returns {number}
   */
  static getCommandModifier(commandSkill) {
    if (!commandSkill) return 0;
    if (commandSkill.expert) return COHESION.COMMAND_EXPERT;
    if (commandSkill.mastered) return COHESION.COMMAND_MASTERED;
    if (commandSkill.trained) return COHESION.COMMAND_TRAINED;
    return 0;
  }

  /**
   * Convenience wrapper that extracts values from a live actor.
   * @param {Object} actor - Actor document
   * @param {number} [gmModifier=0] - GM-set modifier
   * @returns {number}
   */
  static calculateCohesionMaxFromActor(actor, gmModifier = 0) {
    if (!actor || actor.type !== 'character') return 0;
    const fs = actor.system.characteristics?.fs?.value || 0;
    const rank = actor.system.rank || 1;
    const commandSkill = actor.system.skills?.command || {};
    return CohesionHelper.calculateCohesionMax(fs, rank, commandSkill, gmModifier);
  }

  /**
   * Build a human-readable breakdown string for the Cohesion max tooltip.
   * @param {Object|null} leader - Squad leader actor (or null)
   * @param {number} [gmModifier=0] - GM modifier
   * @returns {string}
   */
  static buildCohesionBreakdown(leader, gmModifier = 0) {
    if (!leader || leader.type !== 'character') return 'No squad leader assigned';
    const fs = leader.system.characteristics?.fs?.value || 0;
    const fsBonus = Math.floor(fs / CHARACTERISTIC_CONSTANTS.BONUS_DIVISOR);
    const rankMod = CohesionHelper.getRankModifier(leader.system.rank || 1);
    const commandMod = CohesionHelper.getCommandModifier(leader.system.skills?.command || {});
    const total = Math.max(0, fsBonus + rankMod + commandMod + gmModifier);
    const parts = [`FS Bonus: ${fsBonus}`];
    if (rankMod !== 0) parts.push(`Rank: +${rankMod}`);
    if (commandMod !== 0) parts.push(`Command: +${commandMod}`);
    if (gmModifier !== 0) parts.push(`GM Modifier: ${gmModifier >= 0 ? '+' : ''}${gmModifier}`);
    parts.push(`= ${total}`);
    return parts.join('\n');
  }

  /* -------------------------------------------- */
  /*  Cohesion Damage (Phase 3)                   */
  /* -------------------------------------------- */

  /**
   * Check if raw damage + weapon qualities should trigger Cohesion damage.
   * @param {number} rawDamage - Damage before armor/TB
   * @param {Array} weaponQualities - Array of quality objects or strings
   * @returns {boolean}
   */
  static shouldTriggerCohesionDamage(rawDamage, weaponQualities = []) {
    if (rawDamage < COHESION.DAMAGE_THRESHOLD) return false;
    const qualityIds = weaponQualities.map(q => typeof q === 'string' ? q : q.id);
    return qualityIds.some(id => ['accurate', 'blast', 'devastating'].includes(id));
  }

  /**
   * Check if a Fear creature should trigger Cohesion damage.
   * @param {number} fearLevel
   * @returns {boolean}
   */
  static shouldTriggerFearCohesionDamage(fearLevel) {
    return fearLevel > 0;
  }

  /**
   * Resolve a rally test (Command/Fellowship or Willpower). Pure function.
   * @param {number} targetNumber - Test target number
   * @param {number} roll - d100 result
   * @returns {boolean}
   */
  static resolveRallyTest(targetNumber, roll) {
    return roll <= targetNumber;
  }

  /**
   * Post a Cohesion damage prompt to chat with Rally and Accept buttons.
   * Non-pure — uses Foundry API.
   * @param {string} reason - Description of what caused the damage
   */
  static async handleCohesionDamage(reason = 'A devastating attack threatens Kill-team cohesion.') {
    const cohesion = FoundryAdapter.getSetting('deathwatch', 'cohesion');
    const alreadyDamaged = FoundryAdapter.getSetting('deathwatch', 'cohesionDamageThisRound');
    if (cohesion.value <= 0) return;
    if (alreadyDamaged) return;

    const leaderId = FoundryAdapter.getSetting('deathwatch', 'squadLeader');
    const leader = leaderId ? FoundryAdapter.getActor(leaderId) : null;
    const leaderName = leader?.name || 'Squad Leader';

    const content = `<div class="cohesion-damage-prompt">
      <h3>\u26A0 Cohesion Damage!</h3>
      <p>${reason}</p>
      <p><strong>${leaderName}</strong> may attempt a Command or Fellowship Test to rally.</p>
      <button class="cohesion-rally-btn" data-leader-id="${leaderId || ''}">
        \uD83D\uDEE1 Rally Test (Command/Fellowship)
      </button>
      <button class="cohesion-damage-accept-btn">
        \u2717 Accept Cohesion Damage
      </button>
    </div>`;
    const speaker = FoundryAdapter.getChatSpeaker();
    await FoundryAdapter.createChatMessage({ content, speaker });
  }

  /**
   * Apply Cohesion damage and mark the round as damaged.
   * Non-pure — uses Foundry API via FoundryAdapter.
   * @param {number} amount
   */
  static async applyCohesionDamage(amount) {
    const cohesion = FoundryAdapter.getSetting('deathwatch', 'cohesion');
    const newValue = Math.max(0, cohesion.value - amount);
    await FoundryAdapter.setSetting('deathwatch', 'cohesion', { ...cohesion, value: newValue });
    await FoundryAdapter.setSetting('deathwatch', 'cohesionDamageThisRound', true);
  }

  /* -------------------------------------------- */
  /*  Cohesion Recovery (Phase 4)                 */
  /* -------------------------------------------- */

  /**
   * Check if Cohesion can be recovered. Pure function.
   * @param {number} currentValue
   * @param {number} maxValue
   * @returns {boolean}
   */
  static canRecoverCohesion(currentValue, maxValue) {
    return currentValue < maxValue;
  }

  /**
   * Recover Cohesion by amount, capped at max. Posts chat message.
   * Non-pure — uses Foundry API.
   * @param {number} amount
   * @param {string} [reason] - Optional reason for chat message
   * @returns {Promise<boolean>} true if recovered, false if already at max
   */
  static async recoverCohesion(amount, reason = '') {
    const cohesion = FoundryAdapter.getSetting('deathwatch', 'cohesion');
    if (!CohesionHelper.canRecoverCohesion(cohesion.value, cohesion.max)) {
      FoundryAdapter.showNotification('info', 'Cohesion is already at maximum.');
      return false;
    }
    const newValue = Math.min(cohesion.max, cohesion.value + amount);
    await FoundryAdapter.setSetting('deathwatch', 'cohesion', { ...cohesion, value: newValue });
    const reasonText = reason ? ` ${reason}` : '';
    const speaker = FoundryAdapter.getChatSpeaker();
    await FoundryAdapter.createChatMessage({
      content: `<div class="cohesion-chat"><strong>\u2694 Cohesion Recovered</strong> \u2014 now ${newValue} / ${cohesion.max}${reasonText}</div>`,
      speaker
    });
    return true;
  }

  /* -------------------------------------------- */
  /*  Cohesion Challenge                          */
  /* -------------------------------------------- */

  /**
   * Resolve a Cohesion Challenge. Pure function.
   * @param {number} currentCohesion
   * @param {number} roll - 1d10 result
   * @returns {{success: boolean, roll: number, target: number}}
   */
  static resolveCohesionChallenge(currentCohesion, roll) {
    return { success: roll <= currentCohesion, roll, target: currentCohesion };
  }

  /**
   * Roll a Cohesion Challenge and post result to chat.
   * Non-pure — uses Foundry API via FoundryAdapter.
   * @param {Object} actor - Actor making the challenge
   */
  static async rollCohesionChallenge(actor) {
    const cohesion = FoundryAdapter.getSetting('deathwatch', 'cohesion');
    const roll = await FoundryAdapter.evaluateRoll('1d10');
    const result = CohesionHelper.resolveCohesionChallenge(cohesion.value, roll.total);
    const status = result.success
      ? '<strong style="color: green;">✓ PASSED</strong>'
      : '<strong style="color: red;">✗ FAILED</strong>';
    const safeActorName = Sanitizer.escape(actor.name);
    const flavor = `<strong>Cohesion Challenge — ${safeActorName}</strong><br>Rolled ${result.roll} vs Cohesion ${result.target}<br>${status}`;
    const speaker = FoundryAdapter.getChatSpeaker(actor);
    await FoundryAdapter.sendRollToChat(roll, { speaker, flavor });
    return result;
  }
}
