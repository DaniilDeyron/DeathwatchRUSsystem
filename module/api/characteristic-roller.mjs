import { RollExecutor } from "../helpers/roll-executor.mjs";
import { CyberneticHelper } from "../helpers/cybernetic-helper.mjs";
import { Logger } from "../helpers/logger.mjs";
import { DWConfig } from "../helpers/config.mjs";
import { RollApiHelper } from "./roll-api-helper.mjs";
import { ActorHelper } from "../helpers/actor-helper.mjs";

/**
 * Difficulty presets for characteristic tests.
 * Converts DWConfig.TestDifficulties to simple label->modifier map.
 * @enum {number}
 */
const DIFFICULTY = Object.entries(DWConfig.TestDifficulties).reduce((acc, [key, value]) => {
  // Capitalize first letter of label for backwards compatibility
  const capitalizedLabel = value.label.charAt(0).toUpperCase() + value.label.slice(1);
  acc[capitalizedLabel] = value.modifier;
  return acc;
}, {});

/**
 * Characteristic key mappings (short to full name).
 */
const CHARACTERISTIC_NAMES = {
  'ws': 'Weapon Skill',
  'bs': 'Ballistic Skill',
  'str': 'Strength',
  'tg': 'Toughness',
  'ag': 'Agility',
  'int': 'Intelligence',
  'per': 'Perception',
  'wil': 'Willpower',
  'fs': 'Fellowship'
};

/**
 * Public API for rolling characteristic tests programmatically from macros.
 *
 * Allows macro authors to trigger characteristic tests with optional pre-configured
 * modifiers, either showing the dialog or rolling directly. Supports cybernetic
 * characteristic replacements (e.g., servo-arms).
 *
 * @example
 * // Roll with dialog (user can adjust modifiers)
 * await game.deathwatch.rollCharacteristic('actor123', 'str');
 *
 * @example
 * // Roll directly with modifiers (skip dialog)
 * await game.deathwatch.rollCharacteristic('actor123', 'ag', {
 *   modifier: 10,
 *   difficulty: 'Easy',
 *   skipDialog: true
 * });
 *
 * @example
 * // Force use of cybernetic (servo-arm) if available
 * await game.deathwatch.rollCharacteristic('actor123', 'str', {
 *   useCybernetic: true,
 *   skipDialog: true
 * });
 */
export class CharacteristicRoller {

  /**
   * Roll a characteristic test for an actor.
   *
   * @param {string} actorId - Actor ID (use actor.id or actor._id)
   * @param {string} characteristicKey - Characteristic key (e.g., 'str', 'ag', 'ws', 'bs')
   * @param {Object} [options={}] - Roll options
   * @param {number} [options.modifier=0] - Additional modifier to apply
   * @param {string|number} [options.difficulty='Challenging'] - Difficulty name or numeric modifier
   * @param {boolean} [options.skipDialog=false] - If true, roll immediately without showing dialog
   * @param {boolean} [options.useCybernetic=false] - If true and cybernetic available, use cybernetic value
   * @param {boolean} [options.useNatural=false] - If true, force use of natural characteristic (ignore cybernetics)
   * @returns {Promise<Roll|null>} The rolled result, or null if canceled/failed
   *
   * @example
   * // Basic roll with dialog
   * await game.deathwatch.rollCharacteristic('actor123', 'str');
   *
   * @example
   * // Direct roll with +10 modifier
   * await game.deathwatch.rollCharacteristic('actor123', 'ag', {
   *   modifier: 10,
   *   skipDialog: true
   * });
   *
   * @example
   * // Roll with difficulty preset
   * await game.deathwatch.rollCharacteristic('actor123', 'per', {
   *   difficulty: 'Hard',  // -20 modifier
   *   skipDialog: true
   * });
   *
   * @example
   * // Force use of servo-arm strength
   * await game.deathwatch.rollCharacteristic('actor123', 'str', {
   *   useCybernetic: true,
   *   skipDialog: true
   * });
   */
  static async rollCharacteristic(actorId, characteristicKey, options = {}) {
    // Validate inputs
    const actor = ActorHelper.validateActor(actorId, 'CHARACTER.CHARACTERISTICS');
    if (!actor) return null;

    if (!characteristicKey || typeof characteristicKey !== 'string') {
      Logger.category('CHARACTER.CHARACTERISTICS').error('Characteristic key must be a non-empty string');
      ui.notifications.error('Characteristic key must be provided');
      return null;
    }

    // Normalize characteristic key (lowercase)
    const charKey = characteristicKey.toLowerCase();

    // Validate characteristic exists
    const characteristic = actor.system.characteristics?.[charKey];
    if (!characteristic) {
      Logger.category('CHARACTER.CHARACTERISTICS').error(`Characteristic not found: ${characteristicKey}`);
      ui.notifications.error(`Characteristic "${characteristicKey}" not found on actor ${actor.name}`);
      return null;
    }

    const label = CHARACTERISTIC_NAMES[charKey] || charKey.toUpperCase();

    // Parse options
    const {
      modifier = 0,
      difficulty = 'Challenging',
      skipDialog = false,
      useCybernetic = false,
      useNatural = false
    } = options;

    // Check for cybernetic replacements
    const replacements = CyberneticHelper.getCharacteristicReplacements(actor, charKey);
    const hasReplacements = replacements.length > 0;

    // Parse difficulty modifier
    const difficultyModifier = RollApiHelper.parseDifficulty(difficulty);

    Logger.category('CHARACTER.CHARACTERISTICS').debug(`Rolling ${label} for ${actor.name}`, {
      charKey,
      value: characteristic.value,
      modifier,
      difficultyModifier,
      skipDialog,
      hasReplacements
    });

    // Roll immediately if skipDialog is true
    if (skipDialog) {
      // Determine which characteristic value to use
      let selectedValue = characteristic.value;
      let selectedLabel = label;

      if (hasReplacements && !useNatural) {
        if (useCybernetic || replacements.length === 1) {
          // Use first (or only) cybernetic replacement
          const replacement = replacements[0];
          selectedValue = replacement.value;
          selectedLabel = `${label} (${replacement.label})`;
        }
      }

      const modifiers = { difficultyModifier, additionalModifier: modifier };
      return RollExecutor.executeCharacteristicRoll(actor, selectedValue, selectedLabel, modifiers);
    }

    // Show dialog with pre-filled modifiers
    return RollExecutor.showCharacteristicDialog(actor, charKey, label, characteristic, modifier, difficultyModifier);
  }

  /**
   * Get list of all available difficulty presets.
   *
   * @returns {Object} Dictionary of difficulty names to modifiers
   * @example
   * const difficulties = game.deathwatch.getDifficulties();
   * // { 'Trivial': 60, 'Easy': 30, ..., 'Hellish': -60 }
   */
  static getDifficulties() {
    return { ...DIFFICULTY };
  }

  /**
   * Get list of all characteristic keys and names.
   *
   * @returns {Object} Dictionary of characteristic keys to full names
   * @example
   * const chars = game.deathwatch.getCharacteristics();
   * // { 'ws': 'Weapon Skill', 'bs': 'Ballistic Skill', ... }
   */
  static getCharacteristics() {
    return { ...CHARACTERISTIC_NAMES };
  }
}
