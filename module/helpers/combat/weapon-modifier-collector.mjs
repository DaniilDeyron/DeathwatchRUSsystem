/**
 * WeaponModifierCollector
 *
 * Centralized weapon modifier collection for combat operations.
 * Collects modifiers from weapon, upgrades, and ammo, grouped by effect type.
 *
 * Distinct from ModifierCollector (actor-level) - this is per-attack lifecycle.
 */
export class WeaponModifierCollector {
  /**
   * Extract string ID from value that might be an object reference or plain string
   * @param {string|Object} idOrObject - ID string or object with _id/id property
   * @returns {string} The extracted ID
   * @private
   */
  static _extractId(idOrObject) {
    if (typeof idOrObject === 'string') {
      return idOrObject;
    }
    if (typeof idOrObject === 'object' && idOrObject !== null) {
      return idOrObject._id || idOrObject.id || String(idOrObject);
    }
    return idOrObject;
  }
  /**
   * Collect all weapon-related modifiers from weapon, upgrades, and ammo
   * @param {Object} weapon - The weapon item being used
   * @param {Object} actor - The actor using the weapon
   * @param {Object} context - Attack context (e.g., { isFullAuto: true })
   * @returns {Object} Modifiers grouped by type: { damage: [], penetration: [], range: [], rof: [], clip: [], characteristic: [] }
   */
  static collectWeaponModifiers(weapon, actor, context = {}) {
    const modifiers = {
      damage: [],
      penetration: [],
      range: [],
      blast: [],
      felling: [],
      rof: [],
      weight: [],
      characteristic: [],
      righteousFury: [],
      magnitudeBonus: [],
      characteristicDamage: null,
      damageOverride: null,
      ignoresNaturalArmor: false,
      prematureDetonation: { threshold: 101, source: null }
    };

    // Collect from weapon
    this._collectFromSource(weapon.system.modifiers, modifiers, context, weapon.name);

    // Collect from attached upgrades
    if (weapon.system.attachedUpgrades?.length && actor.items) {
      for (const upgradeIdOrRef of weapon.system.attachedUpgrades) {
        const upgradeId = this._extractId(upgradeIdOrRef);
        const upgrade = actor.items.get(upgradeId);
        if (upgrade?.system?.modifiers) {
          this._collectFromSource(upgrade.system.modifiers, modifiers, context, upgrade.name);
        }
      }
    }

    // Collect from loaded ammo
    if (weapon.system.loadedAmmo && actor.items) {
      const ammoId = this._extractId(weapon.system.loadedAmmo);
      const ammo = actor.items.get(ammoId);
      if (ammo?.system?.modifiers) {
        this._collectFromSource(ammo.system.modifiers, modifiers, context, ammo.name);
      }
    }

    return modifiers;
  }

  /**
   * Collect modifiers from a source (weapon/upgrade/ammo) and add to appropriate arrays
   * @param {Array} sourceModifiers - Modifiers from the source
   * @param {Object} modifiers - Target modifier collection
   * @param {Object} context - Attack context for conditional filtering
   * @param {string} sourceName - Name of the source (for tracking)
   * @private
   */
  static _collectFromSource(sourceModifiers, modifiers, context, sourceName) {
    if (!Array.isArray(sourceModifiers)) return;

    for (const mod of sourceModifiers) {
      // Skip disabled modifiers
      if (!mod.enabled) continue;

      // Context-aware filtering (e.g., Motion Predictor only on auto-fire)
      if (mod.singleShotOnly && !context.isSingleShot) continue;
      if (mod.requiresAutoFire && !context.isAutoFire) continue;

      // Map effect type to collection array
      switch (mod.effectType) {
        case 'weapon-damage':
          modifiers.damage.push({ ...mod, source: sourceName });
          break;
        case 'weapon-penetration':
        case 'weapon-penetration-modifier':
          modifiers.penetration.push({ ...mod, source: sourceName });
          break;
        case 'weapon-range':
          modifiers.range.push({ ...mod, source: sourceName });
          break;
        case 'weapon-blast':
          modifiers.blast.push({ ...mod, source: sourceName });
          break;
        case 'weapon-felling':
          modifiers.felling.push({ ...mod, source: sourceName });
          break;
        case 'weapon-rof':
          modifiers.rof.push({ ...mod, source: sourceName });
          break;
        case 'weapon-weight':
          modifiers.weight.push({ ...mod, source: sourceName });
          break;
        case 'characteristic':
          modifiers.characteristic.push({ ...mod, source: sourceName });
          break;
        case 'righteous-fury-threshold':
          modifiers.righteousFury.push({ ...mod, source: sourceName });
          break;
        case 'magnitude-bonus-damage':
          modifiers.magnitudeBonus.push({ ...mod, source: sourceName });
          break;
        case 'characteristic-damage':
          // Only set if not already set (first wins, for backward compatibility)
          if (!modifiers.characteristicDamage) {
            modifiers.characteristicDamage = {
              formula: mod.modifier,
              characteristic: mod.valueAffected,
              name: mod.name,
              source: sourceName
            };
          }
          break;
        case 'weapon-damage-override':
          // Last override wins (ammo overrides upgrades, upgrades override weapon)
          modifiers.damageOverride = {
            formula: mod.modifier,
            name: mod.name,
            source: sourceName
          };
          break;
        case 'ignores-natural-armour':
          modifiers.ignoresNaturalArmor = true;
          break;
        case 'premature-detonation':
          modifiers.prematureDetonation = {
            threshold: parseInt(mod.modifier) || 101,
            source: sourceName
          };
          break;
        // Silently ignore unrecognized effect types
      }
    }
  }

}
