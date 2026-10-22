import { MODES, MODE_LABELS } from "./constants/index.mjs";

/**
 * Static helper class for Solo/Squad Mode logic.
 * Pure functions — no Foundry API calls.
 */
export class ModeHelper {

  /**
   * Check if a character can enter Squad Mode.
   * Requires Cohesion >= 1.
   * @param {number} cohesionValue - Current Cohesion pool value
   * @returns {boolean}
   */
  static canEnterSquadMode(cohesionValue) {
    return cohesionValue >= 1;
  }

  /**
   * Get display label for a mode.
   * @param {string} mode - "solo" or "squad"
   * @returns {string}
   */
  static getModeLabel(mode) {
    return MODE_LABELS[mode] || MODE_LABELS[MODES.SOLO];
  }

  /**
   * Build a chat message HTML string for a mode change.
   * @param {string} actorName
   * @param {string} newMode - "solo" or "squad"
   * @returns {string}
   */
  static buildModeChangeMessage(actorName, newMode) {
    if (newMode === MODES.SQUAD) {
      return `<div class="cohesion-chat">🔵 <strong>${actorName}</strong> enters Squad Mode</div>`;
    }
    return `<div class="cohesion-chat">🟢 <strong>${actorName}</strong> returns to Solo Mode</div>`;
  }

  /**
   * Build a chat message for when all characters are forced to Solo Mode.
   * @returns {string}
   */
  static buildCohesionDepletedMessage() {
    return `<div class="cohesion-chat">⚔ <strong>Cohesion depleted</strong> — all Battle-Brothers return to Solo Mode</div>`;
  }

  /**
   * Check if an ability is active for the character's current mode.
   * @param {string} modeRequirement - "" (none), "solo", or "squad"
   * @param {string} currentMode - "solo" or "squad"
   * @returns {boolean}
   */
  static isAbilityActiveForMode(modeRequirement, currentMode) {
    if (!modeRequirement) return true;
    return modeRequirement === currentMode;
  }

  /**
   * Check if a character meets the rank requirement for an ability.
   * @param {number} requiredRank - Minimum rank (0 = no requirement)
   * @param {number} currentRank
   * @returns {boolean}
   */
  static meetsRankRequirement(requiredRank, currentRank) {
    if (!requiredRank || requiredRank <= 0) return true;
    return currentRank >= requiredRank;
  }

  /**
   * Check if a character's chapter matches the ability's chapter requirement.
   * @param {string} abilityChapter - Empty = Codex (available to all)
   * @param {string} characterChapter
   * @returns {boolean}
   */
  static meetsChapterRequirement(abilityChapter, characterChapter) {
    if (!abilityChapter) return true;
    return abilityChapter === characterChapter;
  }

  /**
   * Filter improvements to those the character qualifies for by rank.
   * @param {Array} improvements - Array of {rank, effect} objects
   * @param {number} currentRank
   * @returns {Array}
   */
  static getQualifyingImprovements(improvements, currentRank) {
    if (!Array.isArray(improvements)) return [];
    return improvements.filter(imp => imp.rank <= currentRank);
  }

  /**
   * Build a chat message for activating a mode ability.
   * @param {string} actorName
   * @param {string} abilityName
   * @param {string} modeRequirement - "solo", "squad", or ""
   * @param {string} effect - Base effect summary
   * @param {Array} improvements - Array of {rank, effect} objects
   * @param {number} currentRank
   * @returns {string|null} HTML string, or null if effect is empty (fallback to description)
   */
  static buildAbilityActivationMessage(actorName, abilityName, modeRequirement, effect, improvements, currentRank) {
    if (!effect) return null;

    const emoji = modeRequirement === MODES.SQUAD ? '🔵' : modeRequirement === MODES.SOLO ? '🟢' : '';
    const prefix = emoji ? `${emoji} ` : '';

    let html = `<div class="cohesion-chat"><p>${prefix}<strong>${actorName}</strong> activates <strong>${abilityName}</strong></p>`;
    html += `<p>${effect}</p>`;

    const qualifying = this.getQualifyingImprovements(improvements, currentRank);
    if (qualifying.length > 0) {
      html += '<ul>';
      for (const imp of qualifying) {
        html += `<li>${imp.effect}</li>`;
      }
      html += '</ul>';
    }

    html += '</div>';
    return html;
  }

  /**
   * Check if a Squad Mode ability can be activated.
   * @param {string} mode - Character's current mode
   * @param {number} cohesionValue - Current Cohesion pool value
   * @param {number} cohesionCost - Ability's Cohesion cost
   * @returns {{allowed: boolean, reason: string}}
   */
  static canActivateSquadAbility(mode, cohesionValue, cohesionCost) {
    if (mode !== MODES.SQUAD) {
      return { allowed: false, reason: 'Must be in Squad Mode' };
    }
    if (cohesionValue < cohesionCost) {
      return { allowed: false, reason: `Insufficient Cohesion (need ${cohesionCost}, have ${cohesionValue})` };
    }
    return { allowed: true, reason: '' };
  }

  /**
   * Build a chat message for Squad Mode ability activation with Cohesion cost.
   * @param {string} actorName
   * @param {string} abilityName
   * @param {number} cost - Cohesion spent
   * @param {number} newCohesion - Cohesion value after deduction
   * @param {number} maxCohesion - Maximum Cohesion
   * @param {string} [effect] - Base effect summary
   * @param {Array} [improvements] - Array of {rank, effect} objects
   * @param {number} [currentRank] - Character's current rank
   * @returns {string}
   */
  static buildSquadActivationMessage(actorName, abilityName, cost, newCohesion, maxCohesion, effect = '', improvements = [], currentRank = 0) {
    let html = `<div class="cohesion-chat"><p>🔵 <strong>${actorName}</strong> activates <strong>${abilityName}</strong> — Cohesion: -${cost} (now ${newCohesion} / ${maxCohesion})</p>`;

    if (effect) {
      html += `<p>${effect}</p>`;
      const qualifying = this.getQualifyingImprovements(improvements, currentRank);
      if (qualifying.length > 0) {
        html += '<ul>';
        for (const imp of qualifying) {
          html += `<li>${imp.effect}</li>`;
        }
        html += '</ul>';
      }
    }

    html += '</div>';
    return html;
  }

  /**
   * Build a chat message for deactivating a sustained Squad Mode ability.
   * @param {string} abilityName
   * @returns {string}
   */
  static buildDeactivationMessage(abilityName) {
    return `<div class="cohesion-chat">🔵 <strong>${abilityName}</strong> deactivated</div>`;
  }

  /**
   * Check if an actor is already sustaining a Squad Mode ability.
   * @param {Array} activeAbilities - Current activeSquadAbilities array
   * @param {string} actorId
   * @returns {boolean}
   */
  static isSustainingAbility(activeAbilities, actorId) {
    if (!Array.isArray(activeAbilities)) return false;
    return activeAbilities.some(a => a.initiatorId === actorId && a.sustained);
  }
}
