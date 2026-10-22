import { CombatHelper } from './combat.mjs';
import { GrenadeHelper } from './grenade-helper.mjs';
import { PsychicCombatHelper } from './psychic-combat.mjs';
import { WeaponQualityHelper } from './weapon-quality-helper.mjs';

/**
 * Unified combat routing system.
 * Provides single entry points for all attack and damage operations,
 * handling template weapons, psychic powers, and special weapon qualities.
 */
export class CombatRouter {
  static _mocks = null;

  /**
   * Internal: Inject mocks for testing.
   * @param {Object} mocks - Mock implementations
   * @private
   */
  static _setMocks(mocks) {
    this._mocks = mocks;
  }

  /**
   * Get helper (use mock if available, otherwise use real implementation).
   * @param {string} name - Helper name
   * @returns {Object} Helper object
   * @private
   */
  static _getHelper(name) {
    if (this._mocks) return this._mocks[name];

    switch (name) {
      case 'CombatHelper': return CombatHelper;
      case 'GrenadeHelper': return GrenadeHelper;
      case 'PsychicCombatHelper': return PsychicCombatHelper;
      case 'WeaponQualityHelper': return WeaponQualityHelper;
      default: throw new Error(`Unknown helper: ${name}`);
    }
  }

  /**
   * Execute attack roll or manifestation test.
   * Routes based on item type to appropriate helper.
   *
   * @param {Actor} actor - Attacking actor
   * @param {Item} item - Item being used (weapon or psychic power)
   * @returns {Promise<void>}
   * @throws {Error} If item type does not support attacks
   *
   * @example
   * // Weapon attack
   * await CombatRouter.executeAttack(actor, boltgun);
   *
   * @example
   * // Psychic power manifestation
   * await CombatRouter.executeAttack(actor, smite);
   */
  static async executeAttack(actor, item) {
    switch (item.type) {
      case 'weapon': {
        // Check for flame quality first
        const WeaponQualityHelper = this._getHelper('WeaponQualityHelper');
        const isFlame = await WeaponQualityHelper.hasQuality(item, 'flame');
        if (isFlame) {
          // Flamers skip attack roll, go straight to damage output
          const CombatHelper = this._getHelper('CombatHelper');
          return await CombatHelper.weaponDamageRoll(actor, item, { isFlamerAttack: true });
        }

        // Check for thrown weapon (grenades)
        if (item.system.class?.toLowerCase() === 'thrown') {
          const GrenadeHelper = this._getHelper('GrenadeHelper');
          return await GrenadeHelper.executeGrenadeThrow(actor, item);
        }

        // Standard weapon attack dialog
        return await this._getHelper('CombatHelper').weaponAttackDialog(actor, item);
      }

      case 'psychic-power':
        return await this._getHelper('PsychicCombatHelper').focusPowerDialog(actor, item);

      default:
        throw new Error(`Item type "${item.type}" does not support attacks`);
    }
  }

  /**
   * Execute damage roll or effect resolution.
   * Routes based on:
   * 1. Weapon qualities (flame, etc.)
   * 2. Item type (weapon vs psychic power)
   *
   * @param {Actor} actor - Attacking actor
   * @param {Item} item - Item being used (weapon or psychic power)
   * @returns {Promise<void>}
   * @throws {Error} If item type does not support damage rolls
   *
   * @example
   * // Standard weapon damage
   * await CombatRouter.executeDamage(actor, boltgun);
   *
   * @example
   * // Psychic power
   * await CombatRouter.executeDamage(actor, smite);
   */
  static async executeDamage(actor, item) {
    // Priority 1: Weapon-specific routing
    if (item.type === 'weapon') {
      // Check if weapon has flame quality
      const isFlameWeapon = await this._getHelper('WeaponQualityHelper').hasQuality(
        item,
        'flame'
      );

      if (isFlameWeapon) {
        // Show notification and return early - flame weapons require template placement
        ui.notifications.info(
          'Use Attack button to roll damage, then run Flame Attack macro for each target.'
        );
        return;
      }

      // Standard weapon damage
      return await this._getHelper('CombatHelper').weaponDamageRoll(actor, item);
    }

    // Priority 2: Psychic power routing
    if (item.type === 'psychic-power') {
      return await this._getHelper('PsychicCombatHelper').focusPowerDialog(actor, item);
    }

    // Unsupported item type
    throw new Error(`Item type "${item.type}" does not support damage rolls`);
  }
}
