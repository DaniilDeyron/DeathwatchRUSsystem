import { CHARACTERISTIC_CONSTANTS } from './constants/index.mjs';
import { Logger } from './logger.mjs';

/**
 * Helper for cybernetic augmentation mechanics.
 * Handles characteristic replacement from cybernetics like servo-arms.
 */
export class CyberneticHelper {
  /**
   * Get equipped cybernetics that replace a specific characteristic.
   * @param {Actor} actor - Actor to check
   * @param {string} characteristic - Characteristic key (e.g., "str", "ag")
   * @returns {Array<{item: Item, value: number, bonus: number, label: string}>} Array of cybernetic replacements
   */
  static getCharacteristicReplacements(actor, characteristic) {
    if (!actor || !characteristic) return [];

    const replacements = [];
    for (const item of actor.items) {
      if (item.type !== 'cybernetic') continue;
      if (!item.system.equipped) continue;
      if (item.system.replacesCharacteristic !== characteristic) continue;
      if (!item.system.replacementValue) continue;

      const value = item.system.replacementValue;
      const multiplier = item.system.unnaturalMultiplier || 1;
      const bonus = Math.floor(value / CHARACTERISTIC_CONSTANTS.BONUS_DIVISOR) * multiplier;
      const label = item.system.replacementLabel || item.name;

      replacements.push({ item, value, bonus, label });
    }

    return replacements;
  }

  /**
   * Get strength bonus from weapon's cybernetic source, if specified.
   * For weapons that require cybernetic strength (e.g., servo-arm), this finds
   * any equipped cybernetic that replaces strength.
   * @param {Actor} actor - Actor wielding the weapon
   * @param {Item} weapon - Weapon item
   * @returns {number|null} Strength bonus from cybernetic, or null if not applicable
   */
  static getWeaponStrengthBonus(actor, weapon) {
    // Check if weapon requires cybernetic strength
    if (!weapon.system.cyberneticSource) return null;

    // Find ANY equipped cybernetic that replaces strength
    for (const item of actor.items) {
      if (item.type !== 'cybernetic') continue;
      if (!item.system.equipped) continue;
      if (item.system.replacesCharacteristic !== 'str') continue;
      if (!item.system.replacementValue) continue;

      const value = item.system.replacementValue;
      const multiplier = item.system.unnaturalMultiplier || 1;
      return Math.floor(value / CHARACTERISTIC_CONSTANTS.BONUS_DIVISOR) * multiplier;
    }

    return null;
  }

  /**
   * Get a cybernetic item by ID from an actor.
   * @param {Actor} actor - Actor to search
   * @param {string} cyberneticId - Cybernetic item ID
   * @returns {Item|null} Cybernetic item or null
   */
  static getCybernetic(actor, cyberneticId) {
    if (!actor || !cyberneticId) return null;
    const item = actor.items.get(cyberneticId);
    return (item && item.type === 'cybernetic') ? item : null;
  }
}
