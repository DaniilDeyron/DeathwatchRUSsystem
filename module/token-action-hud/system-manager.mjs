/**
 * @file SystemManager for Token Action HUD integration
 * @module token-action-hud/system-manager
 */

import { ActionHandler } from './action-handler.mjs';
import { RollHandler } from './roll-handler.mjs';
import { CHARACTERISTICS, CHARACTERISTIC_LABELS } from '../helpers/constants/characteristic-constants.mjs';

export let SystemManager = null;

/**
 * Create SystemManager class (factory function for testing)
 * @param {class} BaseSystemManager - Base SystemManager class to extend
 * @returns {class} SystemManager class
 */
export function createSystemManager(BaseSystemManager) {
  return class SystemManager extends BaseSystemManager {
    /**
     * Get the action handler for building action lists.
     * @override
     * @returns {ActionHandler|null} ActionHandler instance or null if not implemented
     */
    getActionHandler() {
      return null;
    }

    /**
     * Get the roll handler for executing rolls.
     * @override
     * @param {string} rollHandlerId - Roll handler identifier
     * @returns {RollHandler|null} RollHandler instance or null if not implemented
     */
    getRollHandler(rollHandlerId) {
      return null;
    }

    /**
     * Get list of available roll handlers for this system.
     * @override
     * @returns {Array<Object>} Array of roll handler objects with id and name
     */
    getAvailableRollHandlers() {
      return [
        {
          id: 'deathwatch',
          name: 'Deathwatch'
        }
      ];
    }

    /**
     * Register default action layout and group definitions.
     * @override
     * @returns {{layout: Array, groups: Array}} Default layout configuration
     */
    registerDefaults() {
      // Build characteristic groups from CHARACTERISTICS constant (source of truth)
      const charGroups = {};
      Object.entries(CHARACTERISTICS).forEach(([_, key]) => {
        const groupKey = `char${key.charAt(0).toUpperCase()}${key.slice(1)}`;
        charGroups[groupKey] = {
          id: `char-${key}`,
          name: CHARACTERISTIC_LABELS[key],
          type: 'system'
        };
      });

      const groups = {
        rangedWeapons: { id: 'ranged-weapons', name: 'Ranged Weapons', type: 'system' },
        meleeWeapons: { id: 'melee-weapons', name: 'Melee Weapons', type: 'system' },
        grenades: { id: 'grenades', name: 'Grenades', type: 'system' },
        combatActions: { id: 'combat-actions', name: 'Combat Actions', type: 'system' },
        basicSkills: { id: 'basic-skills', name: 'Basic Skills', type: 'system' },
        advancedSkills: { id: 'advanced-skills', name: 'Advanced Skills', type: 'system' },
        ...charGroups,
        psychicPowers: { id: 'psychic-powers', name: 'Psychic Powers', type: 'system' }
      };

      // Build characteristic layout groups from CHARACTERISTICS constant (source of truth)
      const charLayoutGroups = Object.values(CHARACTERISTICS).map(key => {
        const groupKey = `char${key.charAt(0).toUpperCase()}${key.slice(1)}`;
        return { ...charGroups[groupKey], nestId: `characteristics_char-${key}` };
      });

      return {
        layout: [
          {
            nestId: 'combat',
            id: 'combat',
            name: 'Combat',
            type: 'system',
            groups: [
              { ...groups.rangedWeapons, nestId: 'combat_ranged-weapons' },
              { ...groups.meleeWeapons, nestId: 'combat_melee-weapons' },
              { ...groups.grenades, nestId: 'combat_grenades' },
              { ...groups.combatActions, nestId: 'combat_combat-actions' }
            ]
          },
          {
            nestId: 'skills',
            id: 'skills',
            name: 'Skills',
            type: 'system',
            groups: [
              { ...groups.basicSkills, nestId: 'skills_basic-skills' },
              { ...groups.advancedSkills, nestId: 'skills_advanced-skills' }
            ]
          },
          {
            nestId: 'characteristics',
            id: 'characteristics',
            name: 'Characteristics',
            type: 'system',
            groups: charLayoutGroups
          },
          {
            nestId: 'psychic-powers',
            id: 'psychic-powers',
            name: 'Psychic Powers',
            type: 'system',
            groups: [
              { ...groups.psychicPowers, nestId: 'psychic-powers_psychic-powers' }
            ]
          }
        ],
        groups: Object.values(groups)
      };
    }
  };
}

/**
 * Initialize SystemManager after TAH Core API is ready
 * @param {Object} coreModule - TAH Core module with API
 */
export function initializeSystemManager(coreModule) {
  SystemManager = class SystemManager extends coreModule.api.SystemManager {
    /**
     * Get the action handler for building action lists.
     * @override
     * @returns {ActionHandler} ActionHandler instance
     */
    getActionHandler() {
      return new ActionHandler();
    }

    /**
     * Get the roll handler for executing rolls.
     * @override
     * @param {string} rollHandlerId - Roll handler identifier
     * @returns {RollHandler} RollHandler instance
     */
    getRollHandler(rollHandlerId) {
      return new RollHandler();
    }

    /**
     * Get list of available roll handlers for this system.
     * @override
     * @returns {Object} Object with roll handler IDs as keys and names as values
     */
    getAvailableRollHandlers() {
      return {
        core: 'Deathwatch'
      };
    }

    /**
     * Register default action layout and group definitions.
     * Defines the structure of action categories visible in the HUD.
     *
     * @override
     * @returns {{layout: Array, groups: Array}} Default layout configuration
     */
    async registerDefaults() {
      // Build characteristic groups from CHARACTERISTICS constant (source of truth)
      const charGroups = {};
      Object.entries(CHARACTERISTICS).forEach(([_, key]) => {
        const groupKey = `char${key.charAt(0).toUpperCase()}${key.slice(1)}`;
        charGroups[groupKey] = {
          id: `char-${key}`,
          name: CHARACTERISTIC_LABELS[key],
          type: 'system'
        };
      });

      // Define group objects (like DND5e's GROUP constant)
      const groups = {
        rangedWeapons: { id: 'ranged-weapons', name: 'Ranged Weapons', type: 'system' },
        meleeWeapons: { id: 'melee-weapons', name: 'Melee Weapons', type: 'system' },
        grenades: { id: 'grenades', name: 'Grenades', type: 'system' },
        basicSkills: { id: 'basic-skills', name: 'Basic Skills', type: 'system' },
        advancedSkills: { id: 'advanced-skills', name: 'Advanced Skills', type: 'system' },
        ...charGroups,
        psychicPowers: { id: 'psychic-powers', name: 'Psychic Powers', type: 'system' }
      };

      // Build characteristic layout groups from CHARACTERISTICS constant (source of truth)
      const charLayoutGroups = Object.values(CHARACTERISTICS).map(key => {
        const groupKey = `char${key.charAt(0).toUpperCase()}${key.slice(1)}`;
        return { ...charGroups[groupKey], nestId: `characteristics_char-${key}` };
      });

      const defaults = {
        layout: [
          {
            nestId: 'combat',
            id: 'combat',
            name: 'Combat',
            type: 'system',
            groups: [
              { ...groups.rangedWeapons, nestId: 'combat_ranged-weapons' },
              { ...groups.meleeWeapons, nestId: 'combat_melee-weapons' },
              { ...groups.grenades, nestId: 'combat_grenades' }
            ]
          },
          {
            nestId: 'skills',
            id: 'skills',
            name: 'Skills',
            type: 'system',
            groups: [
              { ...groups.basicSkills, nestId: 'skills_basic-skills' },
              { ...groups.advancedSkills, nestId: 'skills_advanced-skills' }
            ]
          },
          {
            nestId: 'characteristics',
            id: 'characteristics',
            name: 'Characteristics',
            type: 'system',
            groups: charLayoutGroups
          },
          {
            nestId: 'psychic-powers',
            id: 'psychic-powers',
            name: 'Psychic Powers',
            type: 'system',
            groups: [
              { ...groups.psychicPowers, nestId: 'psychic-powers_psychic-powers' }
            ]
          }
        ],
        groups: Object.values(groups)
      };

      return defaults;
    }
  };
}
