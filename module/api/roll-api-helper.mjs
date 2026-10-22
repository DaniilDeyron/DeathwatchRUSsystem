import { DWConfig } from "../helpers/config.mjs";

/**
 * Shared helper utilities for roll API classes (CharacteristicRoller, SkillRoller).
 * Consolidates common patterns for difficulty parsing and roll execution.
 */
export class RollApiHelper {

  /**
   * Parse difficulty input (string or number) to numeric modifier.
   * Converts difficulty preset names from DWConfig.TestDifficulties.
   *
   * @param {string|number} difficulty - Difficulty preset name or numeric modifier
   * @returns {number} Numeric modifier (defaults to 0 if invalid)
   *
   * @example
   * parseDifficulty('Easy')        // returns 30
   * parseDifficulty('Challenging') // returns 0
   * parseDifficulty(20)            // returns 20
   * parseDifficulty('Invalid')     // returns 0
   */
  static parseDifficulty(difficulty) {
    if (typeof difficulty === 'number') {
      return difficulty;
    }

    if (typeof difficulty === 'string') {
      // Build difficulty map from DWConfig (label -> modifier)
      const difficultyMap = Object.entries(DWConfig.TestDifficulties).reduce((acc, [key, value]) => {
        // Support both capitalized and lowercase labels
        const capitalizedLabel = value.label.charAt(0).toUpperCase() + value.label.slice(1);
        acc[capitalizedLabel] = value.modifier;
        acc[value.label.toLowerCase()] = value.modifier;
        return acc;
      }, {});

      const preset = difficultyMap[difficulty] ?? difficultyMap[difficulty.toLowerCase()];
      if (preset !== undefined) {
        return preset;
      }
    }

    return 0; // Default to Challenging (no modifier)
  }

  /**
   * Execute roll logic with optional dialog bypass.
   * If skipDialog is true or pre-filled modifiers exist, calls executeFn directly.
   * Otherwise shows dialog via showDialogFn.
   *
   * @param {Actor} actor - Actor performing the roll
   * @param {Function} executeFn - Direct roll execution function: (actor, modifiers) => result
   * @param {Function} showDialogFn - Dialog function: (actor) => result
   * @param {Array<Object>} modifiers - Pre-filled modifiers [{label, value}]
   * @param {boolean} skipDialog - Whether to skip dialog
   * @returns {Promise<*>} Roll result
   *
   * @example
   * await RollApiHelper.executeWithDialog(
   *   actor,
   *   (actor, mods) => RollExecutor.executeRoll(actor, mods),
   *   (actor) => showRollDialog(actor),
   *   [{label: 'Aim', value: 10}],
   *   false
   * );
   */
  static async executeWithDialog(actor, executeFn, showDialogFn, modifiers, skipDialog) {
    if (skipDialog || modifiers.length > 0) {
      return await executeFn(actor, modifiers);
    }
    return await showDialogFn(actor);
  }
}
