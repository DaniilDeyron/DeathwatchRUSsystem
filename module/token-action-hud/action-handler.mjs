/**
 * Token Action HUD - ActionHandler
 *
 * Builds action groups from actor items (weapons, skills, characteristics).
 * Does NOT execute rolls - that's RollHandler's job.
 *
 * Initialized via tokenActionHudCoreApiReady hook in init.mjs
 */

import {
  CHARACTERISTICS,
  CHARACTERISTIC_LABELS
} from "../helpers/constants/characteristic-constants.mjs";

export let ActionHandler = null;

/**
 * Create ActionHandler class (factory function for testing)
 * @param {class} BaseActionHandler - Base ActionHandler class to extend
 * @returns {class} ActionHandler class
 */
export function createActionHandler(BaseActionHandler) {
  return class ActionHandler extends BaseActionHandler {
    /**
     * Build system-specific actions for requested groups
     * @param {Object} groupIds - Object with group IDs as keys and boolean values
     */
    async buildSystemActions(groupIds) {
      // Get first actor from token (TAH Core sets this.actors)
      if (!this.actors || this.actors.length === 0) {
        return;
      }
      const actor = this.actors[0];

      // Build actions for each requested group
      // groupIds is an object like { rangedWeapons: true, meleeWeapons: false }
      // OR an array like ['psychic-powers', 'ranged-weapons']
      if (groupIds.rangedWeapons) {
        this._buildRangedWeapons(actor);
      }
      if (groupIds.meleeWeapons) {
        this._buildMeleeWeapons(actor);
      }
      if (groupIds.grenades) {
        this._buildGrenades(actor);
      }
      if (groupIds.basicSkills) {
        this._buildBasicSkills(actor);
      }
      if (groupIds.advancedSkills) {
        this._buildAdvancedSkills(actor);
      }
      // Handle array format (used by TAH Core in production)
      if (Array.isArray(groupIds) && groupIds.includes('psychic-powers')) {
        this._buildPsychicPowers(actor);
      }

      // Handle characteristics - either all at once or individually
      if (groupIds.characteristics) {
        // Build all characteristics when "characteristics" group is requested
        this._buildCharacteristic(actor, "ws", "Weapon Skill", "characteristics");
        this._buildCharacteristic(actor, "bs", "Ballistic Skill", "characteristics");
        this._buildCharacteristic(actor, "s", "Strength", "characteristics");
        this._buildCharacteristic(actor, "t", "Toughness", "characteristics");
        this._buildCharacteristic(actor, "ag", "Agility", "characteristics");
        this._buildCharacteristic(actor, "int", "Intelligence", "characteristics");
        this._buildCharacteristic(actor, "per", "Perception", "characteristics");
        this._buildCharacteristic(actor, "wp", "Willpower", "characteristics");
        this._buildCharacteristic(actor, "fs", "Fellowship", "characteristics");
      } else {
        // Handle individual characteristic groups
        if (groupIds['char-ws']) {
          this._buildCharacteristic(actor, "ws", "Weapon Skill", "char-ws");
        }
        if (groupIds['char-bs']) {
          this._buildCharacteristic(actor, "bs", "Ballistic Skill", "char-bs");
        }
        if (groupIds['char-s']) {
          this._buildCharacteristic(actor, "s", "Strength", "char-s");
        }
        if (groupIds['char-t']) {
          this._buildCharacteristic(actor, "t", "Toughness", "char-t");
        }
        if (groupIds['char-ag']) {
          this._buildCharacteristic(actor, "ag", "Agility", "char-ag");
        }
        if (groupIds['char-int']) {
          this._buildCharacteristic(actor, "int", "Intelligence", "char-int");
        }
        if (groupIds['char-per']) {
          this._buildCharacteristic(actor, "per", "Perception", "char-per");
        }
        if (groupIds['char-wp']) {
          this._buildCharacteristic(actor, "wp", "Willpower", "char-wp");
        }
        if (groupIds['char-fs']) {
          this._buildCharacteristic(actor, "fs", "Fellowship", "char-fs");
        }
      }
    }

    /**
     * Build ranged weapon actions
     * @private
     */
    _buildRangedWeapons(actor) {
      const rangedWeapons = actor.items.filter(
        i => i.type === 'weapon' &&
        i.system.equipped &&
        !i.system.class?.toLowerCase().includes('melee') &&
        !i.system.class?.toLowerCase().includes('thrown') &&
        !i.system.class?.toLowerCase().includes('grenade')
      );

      for (const weapon of rangedWeapons) {
        // Add weapon as a group with nested attack/damage actions
        this.addAction("rangedWeapons", {
          id: `weapon-${weapon.id}`,
          name: weapon.name,
          img: weapon.img,
          actions: [
            {
              id: `${weapon.id}-attack`,
              name: 'Attack',
              encodedValue: `weapon|${weapon.id}|attack`,
              img: weapon.img
            },
            {
              id: `${weapon.id}-damage`,
              name: 'Damage',
              encodedValue: `weapon|${weapon.id}|damage`,
              img: weapon.img
            }
          ]
        });
      }
    }

    /**
     * Build melee weapon actions
     * @private
     */
    _buildMeleeWeapons(actor) {
      const meleeWeapons = actor.items.filter(
        i => i.type === 'weapon' &&
        i.system.equipped &&
        i.system.class?.toLowerCase().includes('melee')
      );

      for (const weapon of meleeWeapons) {
        // Add weapon as a group with nested attack/damage actions
        this.addAction("meleeWeapons", {
          id: `weapon-${weapon.id}`,
          name: weapon.name,
          img: weapon.img,
          actions: [
            {
              id: `${weapon.id}-attack`,
              name: 'Attack',
              encodedValue: `weapon|${weapon.id}|attack`,
              img: weapon.img
            },
            {
              id: `${weapon.id}-damage`,
              name: 'Damage',
              encodedValue: `weapon|${weapon.id}|damage`,
              img: weapon.img
            }
          ]
        });
      }
    }

    /**
     * Build grenade actions
     * @private
     */
    _buildGrenades(actor) {
      const grenades = actor.items.filter(
        i => i.type === 'weapon' &&
        i.system.equipped &&
        (i.system.class?.toLowerCase().includes('thrown') ||
         i.system.class?.toLowerCase().includes('grenade'))
      );

      for (const grenade of grenades) {
        // Add grenade as a group with nested attack/damage actions
        this.addAction("grenades", {
          id: `weapon-${grenade.id}`,
          name: grenade.name,
          img: grenade.img,
          actions: [
            {
              id: `${grenade.id}-attack`,
              name: 'Attack',
              encodedValue: `weapon|${grenade.id}|attack`,
              img: grenade.img
            },
            {
              id: `${grenade.id}-damage`,
              name: 'Damage',
              encodedValue: `weapon|${grenade.id}|damage`,
              img: grenade.img
            }
          ]
        });
      }
    }

    /**
     * Build basic skill actions
     * @private
     */
    _buildBasicSkills(actor) {
      const skills = actor.system.skills || {};
      for (const [key, skill] of Object.entries(skills)) {
        if (skill.isBasic) {
          this.addAction("basicSkills", {
            id: key,
            name: skill.name || key,
            encodedValue: `skill|${key}`,
            img: `systems/deathwatch/icons/skills/${key}.webp`
          });
        }
      }
    }

    /**
     * Build advanced skill actions
     * @private
     */
    _buildAdvancedSkills(actor) {
      const skills = actor.system.skills || {};
      for (const [key, skill] of Object.entries(skills)) {
        if (!skill.isBasic && skill.trained) {
          this.addAction("advancedSkills", {
            id: key,
            name: skill.name || key,
            encodedValue: `skill|${key}`,
            img: `systems/deathwatch/icons/skills/${key}.webp`
          });
        }
      }
    }

    /**
     * Build characteristic test action
     * @private
     */
    _buildCharacteristic(actor, charKey, charName, groupId) {
      this.addAction(groupId, {
        id: charKey,
        name: charName,
        encodedValue: `characteristic|${charKey}`,
        img: `systems/deathwatch/icons/characteristics/${charKey}.webp`
      });
    }

    /**
     * Build psychic power actions
     * @param {Object} actor - The actor
     * @private
     */
    _buildPsychicPowers(actor) {
      const powers = actor.items.filter(item => item.type === 'psychic-power');

      const actions = powers.map(power => ({
        id: `psychic-power-${power.id}`,
        name: power.name,
        encodedValue: `psychic-power|${power.id}`,
        icon1: '<i class="fas fa-brain"></i>',
        img: power.img,
        tooltip: power.name
      }));

      this.addActions(actions, { id: 'psychic-powers' });
    }
  };
}

/**
 * Initialize ActionHandler after TAH Core API is ready
 * @param {Object} coreModule - TAH Core module with API
 */
export function initializeActionHandler(coreModule) {
  ActionHandler = class ActionHandler extends coreModule.api.ActionHandler {
    /**
     * Build system-specific actions for requested groups
     * @param {Object} groupIds - Object with group IDs as keys
     */
    async buildSystemActions(groupIds) {
      // Get first actor from token (TAH Core sets this.actors)
      if (!this.actors || this.actors.length === 0) {
        return;
      }
      const actor = this.actors[0];

      // Build actions for each requested group (TAH Core passes array of group IDs)
      if (groupIds.includes("ranged-weapons")) {
        this._buildRangedWeapons(actor);
      }
      if (groupIds.includes("melee-weapons")) {
        this._buildMeleeWeapons(actor);
      }
      if (groupIds.includes("grenades")) {
        this._buildGrenades(actor);
      }
      if (groupIds.includes("basic-skills")) {
        this._buildBasicSkills(actor);
      }
      if (groupIds.includes("advanced-skills")) {
        this._buildAdvancedSkills(actor);
      }
      // Characteristics - check if any char group is requested
      // Build group IDs from CHARACTERISTICS constant (source of truth)
      const charGroups = Object.values(CHARACTERISTICS).map(key => `char-${key}`);
      if (charGroups.some((id) => groupIds.includes(id))) {
        this._buildCharacteristics(actor);
      }
      // Psychic Powers
      if (groupIds.includes("psychic-powers")) {
        this._buildPsychicPowers(actor);
      }
    }

    // ========================================
    // Weapon Helpers
    // ========================================

    /**
     * Get equipped weapons of specified type
     * @param {Object} actor - The actor
     * @param {Function} filterFn - Function to filter weapon class
     * @returns {Array} Filtered weapons
     */
    _getWeapons(actor, filterFn) {
      return actor.items
        .filter((item) => item.type === "weapon")
        .filter((item) => item.system.equipped)
        .filter((item) => filterFn(item.system.class));
    }

    /**
     * Check if weapon is ranged (NOT melee, NOT thrown/grenade)
     * @param {string} weaponClass - Weapon class
     * @returns {boolean} True if ranged
     */
    _isRangedWeapon(weaponClass) {
      const lower = weaponClass.toLowerCase();
      return (
        !lower.includes("melee") &&
        !lower.includes("thrown") &&
        !lower.includes("grenade")
      );
    }

    /**
     * Check if weapon is melee
     * @param {string} weaponClass - Weapon class
     * @returns {boolean} True if melee
     */
    _isMeleeWeapon(weaponClass) {
      return weaponClass.toLowerCase().includes("melee");
    }

    /**
     * Check if weapon is grenade/thrown
     * @param {string} weaponClass - Weapon class
     * @returns {boolean} True if grenade/thrown
     */
    _isGrenadeWeapon(weaponClass) {
      const lower = weaponClass.toLowerCase();
      return lower.includes("thrown") || lower.includes("grenade");
    }

    // ========================================
    // Characteristic Helpers
    // ========================================

    /**
     * Get characteristic display name from key
     * @param {string} key - Characteristic key (ws, bs, str, etc.)
     * @returns {string} Display name
     */
    _getCharacteristicName(key) {
      return CHARACTERISTIC_LABELS[key] || key.toUpperCase();
    }

    // ========================================
    // Action Builders
    // ========================================

    /**
     * Build ranged weapon actions
     * @param {Object} actor - The actor
     */
    _buildRangedWeapons(actor) {
      const weapons = this._getWeapons(actor, (cls) =>
        this._isRangedWeapon(cls)
      );

      // Create nested subgroup for each weapon
      weapons.forEach((weapon) => {
        // Get loaded ammo info
        const loadedAmmo = weapon.system.loadedAmmo
          ? actor.items.get(weapon.system.loadedAmmo)
          : null;
        const currentAmmo = loadedAmmo?.system.capacity?.value || 0;
        const clipSize = weapon.system.clip || "";

        // Display format: "current/max" or just "max" if no ammo loaded
        const ammoDisplay = loadedAmmo
          ? `${currentAmmo}/${clipSize}`
          : clipSize;
        const ammoInfo = ammoDisplay ? ` (Ammo: ${ammoDisplay})` : "";

        // Add weapon subgroup
        this.groupHandler.addGroup(
          {
            id: `weapon-${weapon.id}`,
            name: weapon.name,
            type: "system-derived",
            img: weapon.img,
            info1: ammoDisplay ? { text: ammoDisplay } : null,
            tooltip: `${weapon.name}${ammoInfo}`
          },
          { id: "ranged-weapons" }
        );

        // Add attack and damage actions to weapon subgroup
        const actions = [
          {
            id: `${weapon.id}-attack`,
            name: "Attack",
            encodedValue: `weapon|${weapon.id}|attack`,
            icon1: '<i class="fas fa-crosshairs"></i>',
            info1: ammoDisplay ? { text: ammoDisplay } : null,
            tooltip: `${weapon.name} - Attack Roll${ammoInfo}`
          },
          {
            id: `${weapon.id}-damage`,
            name: "Damage",
            encodedValue: `weapon|${weapon.id}|damage`,
            icon1: '<i class="fas fa-burst"></i>',
            info1: ammoDisplay ? { text: ammoDisplay } : null,
            tooltip: `${weapon.name} - Damage Roll${ammoInfo}`
          }
        ];

        this.addActions(actions, {
          id: `weapon-${weapon.id}`,
          type: "system-derived"
        });
      });
    }

    /**
     * Build melee weapon actions
     * @param {Object} actor - The actor
     */
    _buildMeleeWeapons(actor) {
      const weapons = this._getWeapons(actor, (cls) =>
        this._isMeleeWeapon(cls)
      );

      weapons.forEach((weapon) => {
        // Add weapon subgroup
        this.groupHandler.addGroup(
          {
            id: `weapon-${weapon.id}`,
            name: weapon.name,
            type: "system-derived",
            img: weapon.img,
            tooltip: weapon.name
          },
          { id: "melee-weapons" }
        );

        // Add attack and damage actions
        const actions = [
          {
            id: `${weapon.id}-attack`,
            name: "Attack",
            encodedValue: `weapon|${weapon.id}|attack`,
            icon1: '<i class="fas fa-crosshairs"></i>',
            tooltip: `${weapon.name} - Attack Roll`
          },
          {
            id: `${weapon.id}-damage`,
            name: "Damage",
            encodedValue: `weapon|${weapon.id}|damage`,
            icon1: '<i class="fas fa-burst"></i>',
            tooltip: `${weapon.name} - Damage Roll`
          }
        ];

        this.addActions(actions, {
          id: `weapon-${weapon.id}`,
          type: "system-derived"
        });
      });
    }

    /**
     * Build grenade actions
     * @param {Object} actor - The actor
     */
    _buildGrenades(actor) {
      const weapons = this._getWeapons(actor, (cls) =>
        this._isGrenadeWeapon(cls)
      );

      weapons.forEach((weapon) => {
        // Get loaded ammo info
        const loadedAmmo = weapon.system.loadedAmmo
          ? actor.items.get(weapon.system.loadedAmmo)
          : null;
        const currentAmmo = loadedAmmo?.system.capacity?.value || 0;
        const clipSize = weapon.system.clip || "";

        // Display format: "current/max" or just "max" if no ammo loaded
        const ammoDisplay = loadedAmmo
          ? `${currentAmmo}/${clipSize}`
          : clipSize;
        const ammoInfo = ammoDisplay ? ` (Ammo: ${ammoDisplay})` : "";

        // Add weapon subgroup
        this.groupHandler.addGroup(
          {
            id: `weapon-${weapon.id}`,
            name: weapon.name,
            type: "system-derived",
            img: weapon.img,
            info1: ammoDisplay ? { text: ammoDisplay } : null,
            tooltip: `${weapon.name}${ammoInfo}`
          },
          { id: "grenades" }
        );

        // Add attack and damage actions
        const actions = [
          {
            id: `${weapon.id}-attack`,
            name: "Attack",
            encodedValue: `weapon|${weapon.id}|attack`,
            icon1: '<i class="fas fa-crosshairs"></i>',
            info1: ammoDisplay ? { text: ammoDisplay } : null,
            tooltip: `${weapon.name} - Attack Roll${ammoInfo}`
          },
          {
            id: `${weapon.id}-damage`,
            name: "Damage",
            encodedValue: `weapon|${weapon.id}|damage`,
            icon1: '<i class="fas fa-burst"></i>',
            info1: ammoDisplay ? { text: ammoDisplay } : null,
            tooltip: `${weapon.name} - Damage Roll${ammoInfo}`
          }
        ];

        this.addActions(actions, {
          id: `weapon-${weapon.id}`,
          type: "system-derived"
        });
      });
    }

    /**
     * Build basic skill actions
     * @param {Object} actor - The actor
     */
    _buildBasicSkills(actor) {
      // Get selected skills from settings
      const selectedSkills =
        game.settings.get("deathwatch", "tahSkillList") || [];
      const selectedSet = new Set(selectedSkills);

      // Skills are in actor.system.skills as an object, not items
      const skillsObj = actor.system.skills || {};
      const skills = Object.entries(skillsObj)
        .filter(
          ([key, skill]) => skill.isBasic === true && selectedSet.has(key)
        )
        .map(([key, skill]) => {
          // Get label from config
          const label = game.deathwatch.config.Skills[key] || key;
          // Calculate total using system's skill helper
          const characteristic =
            actor.system.characteristics[skill.characteristic];
          const baseCharValue = characteristic ? characteristic.value : 0;
          const effectiveChar = skill.trained
            ? baseCharValue
            : Math.floor(baseCharValue / 2);
          const skillBonus = skill.expert ? 20 : skill.mastered ? 10 : 0;
          const total =
            effectiveChar +
            skillBonus +
            (skill.modifier || 0) +
            (skill.modifierTotal || 0);

          return { key, label, total };
        });

      const actions = skills.map((skill) => ({
        id: `skill-${skill.key}`,
        name: skill.label,
        encodedValue: `skill|${skill.key}`,
        icon1: '<i class="fas fa-brain"></i>',
        info1: { text: String(skill.total) },
        tooltip: `${skill.label}: ${skill.total}`
      }));

      this.addActions(actions, { id: "basic-skills" });
    }

    /**
     * Build advanced skill actions
     * @param {Object} actor - The actor
     */
    _buildAdvancedSkills(actor) {
      // Get selected skills from settings
      const selectedSkills =
        game.settings.get("deathwatch", "tahSkillList") || [];
      const selectedSet = new Set(selectedSkills);

      // Skills are in actor.system.skills as an object, not items
      const skillsObj = actor.system.skills || {};
      const skills = Object.entries(skillsObj)
        .filter(
          ([key, skill]) => skill.isBasic === false && selectedSet.has(key)
        )
        .map(([key, skill]) => {
          // Get label from config
          const label = game.deathwatch.config.Skills[key] || key;
          // Calculate total using system's skill helper
          const characteristic =
            actor.system.characteristics[skill.characteristic];
          const baseCharValue = characteristic ? characteristic.value : 0;
          const effectiveChar = skill.trained
            ? baseCharValue
            : Math.floor(baseCharValue / 2);
          const skillBonus = skill.expert ? 20 : skill.mastered ? 10 : 0;
          const total =
            effectiveChar +
            skillBonus +
            (skill.modifier || 0) +
            (skill.modifierTotal || 0);

          return { key, label, total };
        });

      const actions = skills.map((skill) => ({
        id: `skill-${skill.key}`,
        name: skill.label,
        encodedValue: `skill|${skill.key}`,
        icon1: '<i class="fas fa-brain"></i>',
        info1: { text: String(skill.total) },
        tooltip: `${skill.label}: ${skill.total} (Advanced)`
      }));

      this.addActions(actions, { id: "advanced-skills" });
    }

    /**
     * Build characteristic actions (all 9)
     * @param {Object} actor - The actor
     */
    _buildCharacteristics(actor) {
      // Use characteristic constants
      const charKeys = Object.values(CHARACTERISTICS);

      charKeys.forEach((key) => {
        const char = actor.system.characteristics[key];
        const actions = [
          {
            id: `characteristic-${key}`,
            name: CHARACTERISTIC_LABELS[key],
            encodedValue: `characteristic|${key}`,
            icon1: '<i class="fas fa-dice-d20"></i>',
            info1: { text: char?.value || "0" },
            tooltip: `${CHARACTERISTIC_LABELS[key]}: ${char?.value || 0} (Bonus: ${char?.bonus || 0})`
          }
        ];

        this.addActions(actions, { id: `char-${key}` });
      });
    }

    /**
     * Build psychic power actions
     * @param {Object} actor - The actor
     * @private
     */
    _buildPsychicPowers(actor) {
      const powers = actor.items.filter(item => item.type === 'psychic-power');

      const actions = powers.map(power => ({
        id: `psychic-power-${power.id}`,
        name: power.name,
        encodedValue: `psychic-power|${power.id}`,
        icon1: '<i class="fas fa-brain"></i>',
        img: power.img,
        tooltip: power.name
      }));

      this.addActions(actions, { id: 'psychic-powers' });
    }
  };
}
