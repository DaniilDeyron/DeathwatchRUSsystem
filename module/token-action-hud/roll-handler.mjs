/**
 * RollHandler for Token Action HUD integration
 * Executes actions by delegating to existing methods.
 *
 * @module token-action-hud/roll-handler
 */

import { RollExecutor } from '../helpers/roll-executor.mjs';
import { CombatHelper } from '../helpers/combat/combat.mjs';
import { CombatRouter } from '../helpers/combat/combat-router.mjs';
import { PsychicCombatHelper } from '../helpers/combat/psychic-combat.mjs';
import { CHARACTERISTIC_LABELS } from '../helpers/constants/characteristic-constants.mjs';

export let RollHandler = null;

/**
 * Create RollHandler class (factory function for testing)
 * @param {class} BaseRollHandler - Base RollHandler class to extend
 * @param {Object} rollExecutor - RollExecutor dependency (for testing)
 * @param {Object} combatHelper - CombatHelper dependency (for testing)
 * @param {Object} psychicCombatHelper - PsychicCombatHelper dependency (for testing)
 * @param {Object} combatRouter - CombatRouter dependency (for testing)
 * @returns {class} RollHandler class
 */
export function createRollHandler(BaseRollHandler, rollExecutor = RollExecutor, combatHelper = CombatHelper, psychicCombatHelper = PsychicCombatHelper, combatRouter = CombatRouter) {
  return class RollHandler extends BaseRollHandler {
    /**
     * Handle action execution (legacy test interface)
     * @param {Object} actionData - Action data object
     * @param {string} actionData.encodedValue - Encoded action value
     */
    async handleAction(actionData) {
      return this.handleActionClick(null, actionData.encodedValue, actionData.actionId);
    }

    /**
     * Handle action execution (TAH Core API interface)
     * @param {Event} event - Click event
     * @param {string} encodedValue - Encoded action value (e.g., "weapon|abc123|attack")
     * @param {string} actionId - Optional action identifier for socket routing
     */
    async handleActionClick(event, encodedValue, actionId) {
      // Check permissions
      const hasPermission =
        game.user.isGM || this.actor.testUserPermission(game.user, 'OWNER');

      if (!hasPermission) {
        // Route through socket - GM will execute
        const socketData = {
          type: 'tah-action',
          actorId: this.actor.id,
          encodedValue,
        };
        if (actionId) socketData.actionId = actionId;
        game.socket.emit('system.deathwatch', socketData);
        return;
      }

      // Decode action and execute
      const [actionType, itemId, subAction] = encodedValue.split('|');

      switch (actionType) {
        case 'weapon':
          await this._handleWeaponAction(itemId, subAction);
          break;
        case 'skill':
          await this._handleSkillAction(itemId);
          break;
        case 'char':
        case 'characteristic':
          await this._handleCharacteristicAction(itemId);
          break;
        case 'combat-action':
          await this._handleCombatAction(itemId, subAction);
          break;
        case 'psychic-power':
          await this._handlePsychicPowerAction(itemId);
          break;
        default:
          console.warn(`[TAH RollHandler] Unknown action type: ${actionType}`);
      }
    }

    /**
     * Handle weapon action
     * @private
     */
    async _handleWeaponAction(weaponId, subAction) {
      const weapon = this.actor.items.get(weaponId);
      if (!weapon) return;

      if (subAction === 'attack') {
        await combatRouter.executeAttack(this.actor, weapon);
      } else if (subAction === 'unjam') {
        await combatHelper.clearJam(this.actor, weapon);
      } else if (subAction === 'damage') {
        await combatRouter.executeDamage(this.actor, weapon);
      }
    }

    /**
     * Handle combat action (unjam, extinguish, etc.)
     * @private
     */
    async _handleCombatAction(actionType, subAction) {
      if (actionType === 'unjam') {
        // Find first jammed weapon
        const jammedWeapons = this.actor.items.filter?.(i => i.type === 'weapon' && i.system?.jammed) || [];

        if (jammedWeapons.length === 0) {
          if (typeof ui !== 'undefined') {
            ui.notifications.warn('No jammed weapons found.');
          }
          return;
        }

        await combatHelper.clearJam(this.actor, jammedWeapons[0]);
      } else if (actionType === 'extinguish') {
        // TODO: Implement extinguish action
        if (typeof ui !== 'undefined') {
          ui.notifications.info('Extinguish action not yet implemented.');
        }
      }
    }

    /**
     * Handle skill action
     * @private
     */
    async _handleSkillAction(skillKey) {
      // Handle both object format (actual system) and array format (tests)
      let skill;
      if (Array.isArray(this.actor.system.skills)) {
        skill = this.actor.system.skills.find(s => s.key === skillKey);
      } else {
        skill = this.actor.system.skills?.[skillKey];
      }

      if (!skill) return;

      // Use label or name depending on which exists
      const skillName = skill.label || skill.name || skillKey;
      await rollExecutor.showSkillDialog(this.actor, skill, skillName, skill.total || 0);
    }

    /**
     * Handle characteristic test action
     * @private
     */
    async _handleCharacteristicAction(charKey) {
      const characteristic = this.actor.system.characteristics?.[charKey];
      if (!characteristic) return;

      const label = CHARACTERISTIC_LABELS[charKey] || charKey.toUpperCase();
      await rollExecutor.showCharacteristicDialog(this.actor, charKey, label, characteristic);
    }

    /**
     * Handle psychic power action
     * @private
     */
    async _handlePsychicPowerAction(powerId) {
      const power = this.actor.items.get(powerId);

      if (!power) {
        if (typeof ui !== 'undefined') {
          ui.notifications.warn('Psychic power not found.');
        }
        return;
      }

      await psychicCombatHelper.focusPowerDialog(this.actor, power);
    }
  };
}

/**
 * Initialize RollHandler after TAH Core API is ready
 * @param {Object} coreModule - TAH Core module with API
 */
export function initializeRollHandler(coreModule) {
  RollHandler = class RollHandler extends coreModule.api.RollHandler {
    /**
     * Handle action execution
     * @param {Object} actionData - Action data from TAH Core
     * @param {string} actionData.actionId - Action identifier
     * @param {string} actionData.encodedValue - Encoded action value (e.g., "weapon|abc123|attack")
     */
    async handleActionClick(event, encodedValue) {
      // Check permissions
      const hasPermission =
        game.user.isGM || this.actor.testUserPermission(game.user, 'OWNER');

      if (!hasPermission) {
        // Route through socket - GM will execute
        game.socket.emit('system.deathwatch', {
          type: 'tah-action',
          actorId: this.actor.id,
          encodedValue,
        });
        return;
      }

      // Decode action and execute
      await this._executeAction(encodedValue);
    }

    /**
     * Execute action based on encoded value
     * @param {string} encodedValue - Encoded action value
     * @private
     */
    async _executeAction(encodedValue) {
      // Guard against null/undefined encodedValue (e.g., clicking weapon parent group)
      if (!encodedValue) {
        return;
      }

      const [type, id, subaction] = encodedValue.split('|');

      switch (type) {
        case 'weapon':
          await this._handleWeaponAction(id, subaction);
          break;

        case 'skill':
          await this._handleSkillAction(id);
          break;

        case 'characteristic':
          await this._handleCharacteristicAction(id);
          break;

        case 'psychic-power':
          await this._handlePsychicPowerAction(id);
          break;

        default:
          ui.notifications.warn(`Unknown action type: ${type}`);
      }
    }

    /**
     * Handle weapon action
     * @param {string} weaponId - Weapon item ID
     * @param {string} subaction - Subaction (attack/damage)
     * @private
     */
    async _handleWeaponAction(weaponId, subaction) {
      const weapon = this.actor.items.get(weaponId);

      if (!weapon) {
        ui.notifications.warn(`Weapon not found: ${weaponId}`);
        return;
      }

      switch (subaction) {
        case 'attack':
          // Delegate to combat router
          await game.deathwatch.CombatRouter.executeAttack(this.actor, weapon);
          break;

        case 'damage':
          // Delegate to combat router
          await game.deathwatch.CombatRouter.executeDamage(this.actor, weapon);
          break;

        default:
          ui.notifications.warn(`Unknown weapon subaction: ${subaction}`);
      }
    }

    /**
     * Handle skill action
     * @param {string} skillKey - Skill key (e.g., "awareness")
     * @private
     */
    async _handleSkillAction(skillKey) {
      const skill = this.actor.system.skills?.[skillKey];

      if (!skill) {
        ui.notifications.warn(`Skill not found: ${skillKey}`);
        return;
      }

      // Delegate to existing method
      await RollExecutor.showSkillDialog(this.actor, skill, skill.label, skill.total);
    }

    /**
     * Handle characteristic action
     * @param {string} charKey - Characteristic key (e.g., "weaponSkill")
     * @private
     */
    async _handleCharacteristicAction(charKey) {
      const characteristic = this.actor.system.characteristics[charKey];

      if (!characteristic) {
        ui.notifications.warn(`Characteristic not found: ${charKey}`);
        return;
      }

      // Convert key to label (e.g., "weaponSkill" -> "Weapon Skill")
      const label = this._charKeyToLabel(charKey);

      // Delegate to existing method
      await RollExecutor.showCharacteristicDialog(this.actor, charKey, label, characteristic);
    }

    /**
     * Convert characteristic key to label
     * @param {string} key - Characteristic key (e.g., "ws")
     * @returns {string} Label (e.g., "Weapon Skill")
     * @private
     */
    _charKeyToLabel(key) {
      return CHARACTERISTIC_LABELS[key] || key;
    }

    /**
     * Handle psychic power action
     * @param {string} powerId - Psychic power item ID
     * @private
     */
    async _handlePsychicPowerAction(powerId) {
      const power = this.actor.items.get(powerId);

      if (!power) {
        ui.notifications.warn(`Psychic power not found: ${powerId}`);
        return;
      }

      await game.deathwatch.CombatRouter.executeDamage(this.actor, power);
    }
  };
}
