import { Logger } from "../logger.mjs";
import { CHARACTERISTIC_CONSTANTS } from "../constants/index.mjs";

/**
 * Collects and applies modifiers from various sources to actor characteristics, skills, and attributes.
 * Central hub for the modifier system that aggregates modifiers from items, talents, traits, chapters,
 * active effects, and armor histories, then applies them to derived data during actor preparation.
 *
 * @example
 * // Collect all modifiers from an actor
 * const itemsArray = Array.from(actor.items.values());
 * const mods = ModifierCollector.collectAllModifiers(actor, itemsArray);
 *
 * // Apply them to characteristics
 * ModifierCollector.applyCharacteristicModifiers(actor.system.characteristics, mods);
 */
export class ModifierCollector {
  /**
   * Collect all modifiers from an actor: actor-level modifiers, item modifiers, and active effects.
   *
   * Aggregates modifiers from three sources:
   * 1. Actor system.modifiers - Actor-level custom modifiers
   * 2. Item modifiers - From equipped armor, talents, traits, chapters
   * 3. Active effects - From status effects and other ActiveEffect documents
   *
   * @param {Actor} actor - Actor document
   * @param {Item[]|Map<string, Item>} itemsArray - Array of actor's items (pre-converted from Map for performance), or Map for backward compatibility
   * @returns {Object[]} Array of modifier objects with effectType, valueAffected, modifier, source
   * @property {string} return[].name - Display name of the modifier
   * @property {number|string} return[].modifier - Modifier value (number or "x2" for multipliers)
   * @property {string} return[].effectType - Effect type (characteristic, skill, armor, wounds, etc.)
   * @property {string} return[].valueAffected - The characteristic/skill/etc being modified
   * @property {boolean} return[].enabled - Whether modifier is active
   * @property {string} return[].source - Item/trait/chapter that provides the modifier
   * @example
   * const itemsArray = Array.from(actor.items.values());
   * const mods = ModifierCollector.collectAllModifiers(actor, itemsArray);
   * // Returns: [
   * //   { name: "+10 BS", modifier: 10, effectType: "characteristic", valueAffected: "bs", enabled: true, source: "Marksman Training" },
   * //   { name: "+20 Awareness", modifier: 20, effectType: "skill", valueAffected: "awareness", enabled: true, source: "Heightened Senses" },
   * //   ...
   * // ]
   */
  static collectAllModifiers(actor, itemsArray) {
    const actorModifiers = actor.system.modifiers || [];
    const itemModifiers = this.collectItemModifiers(itemsArray);
    const effectModifiers = this.collectActiveEffectModifiers(actor);
    return [...actorModifiers, ...itemModifiers, ...effectModifiers];
  }

  /**
   * Collect modifiers from active status effects.
   * Converts Foundry ActiveEffect changes to modifier format.
   * @param {Actor} actor - Actor document
   * @returns {Array<Object>} Array of modifier objects from active effects
   */
  static collectActiveEffectModifiers(actor) {
    const modifiers = [];
    
    if (!actor.effects) return modifiers;
    
    for (const effect of actor.effects) {
      if (effect.disabled) continue;
      
      for (const change of effect.changes) {
        const match = change.key.match(/^system\.characteristics\.(\w+)\.value$/);
        if (match && change.mode === 2) {
          modifiers.push({
            name: effect.name,
            modifier: change.value,
            effectType: 'characteristic',
            valueAffected: match[1],
            enabled: true,
            source: 'Status Effect'
          });
        }
      }
    }
    
    return modifiers;
  }

  /**
   * Collect modifiers from all equipped items, talents, traits, and chapters.
   *
   * Item activation rules:
   * - Talents, traits, chapters: Always active (no equipped check)
   * - Armor, weapons, gear: Only active if equipped
   *
   * Includes modifiers from:
   * - Item system.modifiers arrays
   * - Attached armor histories (for armor items)
   *
   * @param {Item[]|Map<string, Item>} items - Array of actor's items (pre-converted from Map for performance), or Map for backward compatibility
   * @returns {Object[]} Array of modifier objects from items
   * @example
   * const itemMods = ModifierCollector.collectItemModifiers(itemsArray);
   * // Returns: [
   * //   { name: "+10 BS", modifier: 10, effectType: "characteristic", valueAffected: "bs", enabled: true, source: "Marksman Training" },
   * //   { name: "+4 Armor (All)", modifier: 4, effectType: "armor", valueAffected: "all", enabled: true, source: "Power Armor (Mk7 Aquila)" },
   * //   ...
   * // ]
   */
  static collectItemModifiers(items) {
    const modifiers = [];

    // Handle both Map (from actor.items) and Array (from prepareDerivedData optimization)
    const itemsArray = items instanceof Map ? Array.from(items.values()) : items;

    for (const item of itemsArray) {
      if (!item?.system) continue;

      // Chapter, trait, and talent items are always active (no equipped check)
      const isActive = item.type === 'chapter' || item.type === 'trait' || item.type === 'talent' || item.system.equipped;
      if (!isActive) continue;

      Logger.category('CHARACTER.MODIFIERS').debug(`Checking item: ${item.name}, type: ${item.type}, equipped: ${item.system.equipped}`);

      if (item.system.modifiers) {
        Logger.category('CHARACTER.MODIFIERS').debug(`  Found ${item.system.modifiers.length} modifiers on ${item.name}`);
        for (const mod of item.system.modifiers) {
          if (mod.enabled !== false) {
            modifiers.push({ ...mod, source: item.name });
          }
        }
      }

      if (item.type === 'armor' && Array.isArray(item.system.attachedHistories)) {
        modifiers.push(...this.collectArmorHistoryModifiers(item, itemsArray));
      }
    }

    Logger.category('CHARACTER.MODIFIERS').debug(`Total item modifiers collected: ${modifiers.length}`);
    return modifiers;
  }

  /**
   * Collect modifiers from armor history items attached to armor.
   * @param {Item} armor - Armor item with attachedHistories
   * @param {Array|Map} allItems - All items to look up history IDs
   * @returns {Array<Object>} Array of modifier objects from armor histories
   */
  static collectArmorHistoryModifiers(armor, allItems) {
    const modifiers = [];

    Logger.category('CHARACTER.MODIFIERS').debug(`  Armor ${armor.name} has ${armor.system.attachedHistories.length} attached histories`);

    for (const historyId of armor.system.attachedHistories) {
      // Use .get() if available (Map or test mock), otherwise use .find() (Array)
      const history = typeof allItems.get === 'function'
        ? allItems.get(historyId)
        : allItems.find(item => item._id === historyId || item.id === historyId);
      Logger.category('CHARACTER.MODIFIERS').debug(`    History ID: ${historyId}, found: ${!!history}`);

      if (history) {
        Logger.category('CHARACTER.MODIFIERS').debug(`    History: ${history.name}, modifiers: ${history.system.modifiers?.length || 0}`);
      }

      if (history && Array.isArray(history.system.modifiers)) {
        for (const mod of history.system.modifiers) {
          Logger.category('CHARACTER.MODIFIERS').debug(`      Modifier: ${mod.name}, ${mod.modifier}, ${mod.effectType}, ${mod.valueAffected}`);
          if (mod.enabled !== false) {
            modifiers.push({ ...mod, source: `${history.name} (${armor.name})` });
          }
        }
      }
    }

    return modifiers;
  }

  /**
   * Collect modifiers from weapon upgrades attached to a weapon.
   * @param {Item} weapon - Weapon item with attachedUpgrades
   * @param {Array|Map} allItems - All items to look up upgrade IDs
   * @returns {Array<Object>} Array of modifier objects from weapon upgrades
   */
  static collectWeaponUpgradeModifiers(weapon, allItems) {
    const modifiers = [];

    Logger.category('CHARACTER.MODIFIERS').debug(`  Weapon ${weapon.name} has ${weapon.system.attachedUpgrades.length} attached upgrades`);

    for (const upgradeRef of weapon.system.attachedUpgrades) {
      const upgradeId = typeof upgradeRef === 'string' ? upgradeRef : upgradeRef.id;
      // Use .get() if available (Map or test mock), otherwise use .find() (Array)
      const upgrade = typeof allItems.get === 'function'
        ? allItems.get(upgradeId)
        : allItems.find(item => item._id === upgradeId || item.id === upgradeId);
      Logger.category('CHARACTER.MODIFIERS').debug(`    Upgrade ID: ${upgradeId}, found: ${!!upgrade}`);

      if (upgrade) {
        Logger.category('CHARACTER.MODIFIERS').debug(`    Upgrade: ${upgrade.name}, modifiers: ${upgrade.system.modifiers?.length || 0}`);
      }

      if (upgrade && Array.isArray(upgrade.system.modifiers)) {
        for (const mod of upgrade.system.modifiers) {
          Logger.category('CHARACTER.MODIFIERS').debug(`      Modifier: ${mod.name}, ${mod.modifier}, ${mod.effectType}, ${mod.valueAffected}`);
          if (mod.enabled !== false) {
            modifiers.push({ ...mod, source: `${upgrade.name} (${weapon.name})` });
          }
        }
      }
    }

    return modifiers;
  }

  /**
   * Apply characteristic modifiers to actor characteristics.
   *
   * Modifiers are applied in this critical order:
   * 1. Base characteristic value (from creation/datasheet)
   * 2. Advances (+5 per advance: Simple, Intermediate, Trained, Expert)
   * 3. Standard characteristic modifiers (added to value)
   * 4. Post-multiplier characteristic modifiers (added to value, but bonus calculated separately)
   * 5. Characteristic damage (subtracted from value)
   * 6. Calculate base bonus (value ÷ 10, rounded down)
   * 7. Apply Unnatural Characteristic multipliers (e.g., x2 for Unnatural Strength)
   * 8. Add post-multiplier bonus (NOT multiplied by Unnatural)
   *
   * The post-multiplier system is critical for Power Armor: +20 STR affects skill tests
   * but the +2 SB must NOT be multiplied by Unnatural Strength. See implementation plan
   * docs for full details.
   *
   * @param {Object} characteristics - Actor characteristics object (ws, bs, str, tgh, ag, int, per, wp, fel)
   * @param {Object[]} modifiers - Array of modifier objects from collectAllModifiers
   * @modifies {characteristics} Updates characteristic.value, characteristic.mod, characteristic.unnaturalMultiplier, etc.
   * @example
   * const mods = ModifierCollector.collectAllModifiers(actor, itemsArray);
   * ModifierCollector.applyCharacteristicModifiers(actor.system.characteristics, mods);
   * // actor.system.characteristics.str.value = 70 (base 50 + advances 10 + Power Armor 10)
   * // actor.system.characteristics.str.mod = 9 (base 7 + Unnatural x2 = 14, minus post-multiplier 2 = 7, then add back 2 = 9)
   * @see {@link applySkillModifiers} for skill-based modifiers
   */
  static applyCharacteristicModifiers(characteristics, modifiers) {
    for (const [key, characteristic] of Object.entries(characteristics)) {
      if (characteristic.base === undefined) {
        characteristic.base = characteristic.value;
      }
      
      let total = characteristic.base || 0;
      const appliedMods = [];
      
      // Apply advances (+5 each)
      if (characteristic.advances) {
        if (characteristic.advances.simple) { total += 5; appliedMods.push({ name: 'Simple Advance', value: 5, source: 'Advances' }); }
        if (characteristic.advances.intermediate) { total += 5; appliedMods.push({ name: 'Intermediate Advance', value: 5, source: 'Advances' }); }
        if (characteristic.advances.trained) { total += 5; appliedMods.push({ name: 'Trained Advance', value: 5, source: 'Advances' }); }
        if (characteristic.advances.expert) { total += 5; appliedMods.push({ name: 'Expert Advance', value: 5, source: 'Advances' }); }
      }
      
      // Apply standard characteristic modifiers
      for (const mod of modifiers) {
        if (mod.enabled !== false && mod.effectType === 'characteristic' && mod.valueAffected === key) {
          const modValue = parseInt(mod.modifier) || 0;
          total += modValue;
          appliedMods.push({ name: mod.name, value: modValue, source: mod.source });
        }
      }
      
      // CRITICAL: characteristic-post-multiplier modifiers add to the characteristic VALUE
      // (for skill tests) but their bonus contribution is applied AFTER the Unnatural
      // multiplier. This is used by Power Armor Enhanced Strength (+20 STR) where the
      // +20 affects test target numbers but the +2 SB must not be multiplied by Unnatural.
      // See power-armor-implementation-plan.md for full explanation.
      let postMultiplierTotal = 0;
      for (const mod of modifiers) {
        if (mod.enabled !== false && mod.effectType === 'characteristic-post-multiplier' && mod.valueAffected === key) {
          const modValue = parseInt(mod.modifier) || 0;
          total += modValue;
          postMultiplierTotal += modValue;
          appliedMods.push({ name: mod.name, value: modValue, source: mod.source });
        }
      }

      characteristic.value = total;
      characteristic.modifiers = appliedMods;
      
      // CRITICAL ORDERING: baseMod excludes post-multiplier contributions so that
      // the Unnatural multiplier (below) only applies to the base characteristic bonus.
      // The post-multiplier bonus is added AFTER the multiplier step.
      // Moving this addition before the multiplier will produce incorrect SB values.
      characteristic.mod = Math.floor((total - postMultiplierTotal) / CHARACTERISTIC_CONSTANTS.BONUS_DIVISOR);
      characteristic.baseMod = characteristic.mod;
      characteristic.unnaturalMultiplier = 1;
      characteristic.postMultiplierBonus = Math.floor(postMultiplierTotal / CHARACTERISTIC_CONSTANTS.BONUS_DIVISOR);
      
      // Group and apply characteristic bonus modifiers
      const bonusModGroups = new Map();
      for (const mod of modifiers) {
        if (mod.enabled !== false && mod.effectType === 'characteristic-bonus' && mod.valueAffected === key) {
          const modStr = String(mod.modifier);
          if (bonusModGroups.has(mod.name)) {
            const existing = bonusModGroups.get(mod.name);
            if (modStr.startsWith('x')) {
              const mult = parseFloat(modStr.substring(1)) || 1;
              existing.multiplier += mult - 1;
            } else {
              existing.value += parseInt(mod.modifier) || 0;
            }
          } else {
            bonusModGroups.set(mod.name, {
              name: mod.name,
              source: mod.source,
              value: modStr.startsWith('x') ? 0 : (parseInt(mod.modifier) || 0),
              multiplier: modStr.startsWith('x') ? (parseFloat(modStr.substring(1)) || 1) : null
            });
          }
        }
      }
      
      // Apply grouped modifiers (Unnatural multipliers and flat bonus modifiers)
      const bonusMods = [];
      for (const group of bonusModGroups.values()) {
        if (group.multiplier !== null) {
          const multipliedValue = Math.floor(characteristic.baseMod * group.multiplier);
          const addedValue = multipliedValue - characteristic.baseMod;
          characteristic.mod += addedValue;
          characteristic.unnaturalMultiplier = group.multiplier;
          bonusMods.push({ name: group.name, value: multipliedValue, source: group.source, display: `x${group.multiplier}` });
        } else if (group.value !== 0) {
          characteristic.mod += group.value;
          bonusMods.push({ name: group.name, value: group.value, source: group.source });
        }
      }
      
      // CRITICAL: Post-multiplier bonus applied AFTER Unnatural multiplier.
      // This is the entire purpose of characteristic-post-multiplier — the bonus
      // from e.g. Power Armor (+2 SB from +20 STR) must NOT be multiplied.
      // DO NOT move this above the Unnatural multiplier loop.
      if (characteristic.postMultiplierBonus > 0) {
        characteristic.mod += characteristic.postMultiplierBonus;
        const postMod = modifiers.find(m => m.enabled !== false && m.effectType === 'characteristic-post-multiplier' && m.valueAffected === key);
        bonusMods.push({
          name: postMod?.name || 'Post-Multiplier Bonus',
          value: characteristic.postMultiplierBonus,
          source: postMod?.source || 'Equipment',
          display: `+${characteristic.postMultiplierBonus} (post-multiplier)`
        });
      }
      characteristic.bonusModifiers = bonusMods;
    }
  }

  /**
   * Apply skill modifiers to actor skills.
   * Computes modifierTotal for each skill from all skill-type modifiers.
   * @param {Object} skills - Actor skills object
   * @param {Array<Object>} modifiers - Array of modifier objects
   */
  static applySkillModifiers(skills, modifiers) {
    for (const [key, skill] of Object.entries(skills)) {
      let total = 0;
      
      for (const mod of modifiers) {
        if (mod.enabled !== false && mod.effectType === 'skill' && mod.valueAffected === key) {
          total += parseInt(mod.modifier) || 0;
        }
      }
      
      skill.modifierTotal = total;
    }
  }

  /**
   * Calculate total initiative bonus from modifiers.
   * @param {Array<Object>} modifiers - Array of modifier objects
   * @returns {number} Total initiative bonus
   */
  static applyInitiativeModifiers(modifiers) {
    let total = 0;
    
    for (const mod of modifiers) {
      if (mod.enabled !== false && mod.effectType === 'initiative') {
        total += parseInt(mod.modifier) || 0;
      }
    }
    
    return total;
  }

  /**
   * Apply wound modifiers to actor wounds.
   * Computes max wounds from base + modifiers.
   * @param {Object} wounds - Actor wounds object (value, max, base)
   * @param {Array<Object>} modifiers - Array of modifier objects
   */
  static applyWoundModifiers(wounds, modifiers) {
    if (!wounds) return;
    
    if (wounds.base === undefined) {
      wounds.base = wounds.max;
    }
    
    let total = wounds.base || 0;
    const appliedMods = [];
    
    for (const mod of modifiers) {
      if (mod.enabled !== false && mod.effectType === 'wounds') {
        const modValue = parseInt(mod.modifier) || 0;
        total += modValue;
        appliedMods.push({ name: mod.name, value: modValue, source: mod.source });
      }
    }
    
    wounds.max = total;
    wounds.modifiers = appliedMods;
  }

  /**
   * Apply fatigue modifiers based on toughness bonus.
   *
   * Fatigue system (Deathwatch Core p. 259):
   * - Max fatigue = Toughness Bonus
   * - Fatigued (value > 0): −10 to all tests
   * - Unconscious (value > TB): Character collapses
   *
   * Each fatigue point represents accumulated exhaustion from:
   * - Combat (flame weapons, toxins, psychic backlash)
   * - Extended activity without rest
   * - Environmental hazards
   *
   * @param {Object} fatigue - Actor fatigue object (value, max, unconscious, penalty)
   * @param {number} toughnessBonus - Actor's toughness bonus (computed from TGH characteristic)
   * @modifies {fatigue} Updates fatigue.max, fatigue.unconscious, fatigue.penalty
   * @example
   * // Character with TGH 40 (TB 4) and 2 fatigue
   * ModifierCollector.applyFatigueModifiers(fatigue, 4);
   * // fatigue.max = 4, fatigue.unconscious = false, fatigue.penalty = -10
   * @example
   * // Character with TGH 40 (TB 4) and 5 fatigue (over limit)
   * ModifierCollector.applyFatigueModifiers(fatigue, 4);
   * // fatigue.max = 4, fatigue.unconscious = true, fatigue.penalty = -10
   */
  static applyFatigueModifiers(fatigue, toughnessBonus) {
    if (!fatigue) return;
    
    fatigue.max = toughnessBonus;
    fatigue.unconscious = fatigue.value > toughnessBonus;
    fatigue.penalty = fatigue.value > 0 ? -10 : 0;
  }

  /**
   * Apply Psy Rating modifiers to actor psychic power.
   * Computes effective Psy Rating from base + modifiers.
   * @param {Object} psyRating - Actor psyRating object (value, base, modifiers)
   * @param {Array<Object>} modifiers - Array of modifier objects
   */
  static applyPsyRatingModifiers(psyRating, modifiers) {
    if (!psyRating) return;

    let total = psyRating.base || 0;
    const appliedMods = [];

    for (const mod of modifiers) {
      if (mod.enabled !== false && mod.effectType === 'psy-rating') {
        const modValue = parseInt(mod.modifier) || 0;
        total += modValue;
        appliedMods.push({ name: mod.name, value: modValue, source: mod.source });
      }
    }

    psyRating.value = total;
    psyRating.modifiers = appliedMods;
  }

  /**
   * Apply movement modifiers to actor movement rates.
   *
   * Calculates movement rates based on:
   * 1. Base movement = AG Bonus
   * 2. Movement multipliers (e.g., Unnatural Speed x2)
   * 3. Flat movement modifiers (e.g., +2 from Sprint talent)
   * 4. Movement restrictions (e.g., Terminator Armor cannot Run)
   *
   * Standard movement rates:
   * - Half Action: AG Bonus
   * - Full Action: AG Bonus × 2
   * - Charge: AG Bonus × 3
   * - Run: AG Bonus × 6
   *
   * Movement restrictions set specific rates to "N/A" (e.g., Terminator Armor
   * cannot Run, so movement.run = "N/A").
   *
   * @param {Object} movement - Actor movement object (half, full, charge, run)
   * @param {number} agBonus - Actor's Agility bonus
   * @param {Object[]} modifiers - Array of modifier objects
   * @modifies {movement} Updates movement.half, movement.full, movement.charge, movement.run, movement.modifiers
   * @example
   * // Character with AG 45 (AG Bonus 4) and Unnatural Speed x2
   * ModifierCollector.applyMovementModifiers(movement, 4, modifiers);
   * // movement.half = 8, movement.full = 16, movement.charge = 24, movement.run = 48
   * @example
   * // Terminator with AG 40 (AG Bonus 4) in Terminator Armor (no Run)
   * ModifierCollector.applyMovementModifiers(movement, 4, modifiers);
   * // movement.half = 4, movement.full = 8, movement.charge = 12, movement.run = "N/A"
   */
  static applyMovementModifiers(movement, agBonus, modifiers) {
    if (!movement) return;

    // Apply movement-multiplier first (e.g., Unnatural Speed doubles AG Bonus)
    let effectiveAgBonus = agBonus;
    const appliedMods = [];

    for (const mod of modifiers) {
      if (mod.enabled !== false && mod.effectType === 'movement-multiplier') {
        const multiplier = parseInt(mod.modifier) || 1;
        const added = agBonus * (multiplier - 1);
        effectiveAgBonus += added;
        appliedMods.push({ name: mod.name, value: added, source: mod.source, display: `x${multiplier}` });
      }
    }

    let bonus = 0;

    for (const mod of modifiers) {
      if (mod.enabled !== false && mod.effectType === 'movement') {
        const modValue = parseInt(mod.modifier) || 0;
        bonus += modValue;
        appliedMods.push({ name: mod.name, value: modValue, source: mod.source });
      }
    }

    const base = effectiveAgBonus + bonus;
    movement.half = base;
    movement.full = base * 2;
    movement.charge = base * 3;
    movement.run = base * 6;
    movement.bonus = bonus;
    movement.modifiers = appliedMods;

    // Apply movement restrictions (e.g., Terminator Armor cannot Run)
    for (const mod of modifiers) {
      if (mod.enabled !== false && mod.effectType === 'movement-restriction') {
        const type = mod.modifier?.toLowerCase();
        if (type && movement[type] !== undefined) {
          movement[type] = "N/A";
        }
      }
    }
  }

  /**
   * Apply armor modifiers to equipped armor items.
   *
   * Increases armor values for all hit locations (head, body, left_arm, right_arm,
   * left_leg, right_leg). Modifiers are additive and apply to all locations.
   *
   * Common armor modifiers:
   * - Armor history bonuses (e.g., +2 from Blessed History)
   * - Trait bonuses (e.g., +4 from Machine trait)
   * - Temporary effects (e.g., +2 from Force Barrier)
   *
   * Each armor piece stores its base value and recomputes the total on each
   * prepareDerivedData call.
   *
   * @param {Item[]|Map<string, Item>} items - Array of actor's items (pre-converted from Map for performance), or Map for backward compatibility
   * @param {Object[]} modifiers - Array of modifier objects with effectType='armor'
   * @modifies {items} Updates armor item system.head, system.body, etc.
   * @example
   * ModifierCollector.applyArmorModifiers(itemsArray, modifiers);
   * // Power Armor with base 8 and +4 from Machine trait:
   * // armor.system.body = 12 (base 8 + modifier 4)
   */
  static applyArmorModifiers(items, modifiers) {
    // Handle both Map (backward compatibility) and Array (from prepareDerivedData optimization)
    const itemsArray = items instanceof Map ? Array.from(items.values()) : items;

    for (const item of itemsArray) {
      if (item?.type === 'armor' && item.system.equipped) {
        const locations = ['head', 'body', 'left_arm', 'right_arm', 'left_leg', 'right_leg'];

        for (const location of locations) {
          if (item.system[location] !== undefined) {
            if (item.system[`${location}_base`] === undefined) {
              item.system[`${location}_base`] = item.system[location];
            }
            const base = item.system[`${location}_base`];
            let total = base;

            for (const mod of modifiers) {
              if (mod.enabled !== false && mod.effectType === 'armor') {
                total += parseInt(mod.modifier) || 0;
              }
            }

            item.system[location] = total;
          }
        }
      }
    }
  }

  /**
   * Calculate total natural armor value from trait-sourced armor modifiers.
   * @param {Array} modifiers - All collected modifiers
   * @param {Array|Map} items - Array of actor's items, or Map for backward compatibility
   * @returns {number} Total natural armor bonus from traits
   */
  static calculateNaturalArmor(modifiers, items) {
    // Handle both Map (backward compatibility) and Array (from prepareDerivedData optimization)
    const itemsArray = items instanceof Map ? Array.from(items.values()) : items;

    let total = 0;
    for (const mod of modifiers) {
      if (mod.enabled !== false && mod.effectType === 'armor') {
        const sourceItem = itemsArray.find(i => i.name === mod.source);
        if (sourceItem && sourceItem.type === 'trait') {
          total += parseInt(mod.modifier) || 0;
        }
      }
    }
    return total;
  }
}
