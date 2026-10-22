import { FoundryAdapter } from "../foundry-adapter.mjs";

export class WeaponUpgradeHelper {
  static async getUpgrades(weapon) {
    if (!weapon?.system?.attachedUpgrades) return [];
    
    const upgrades = [];
    for (const upgrade of weapon.system.attachedUpgrades) {
      const upgradeItem = weapon.parent?.items.get(upgrade.id);
      if (upgradeItem) {
        upgrades.push(upgradeItem);
      }
    }
    return upgrades;
  }

  static async hasUpgrade(weapon, upgradeKey) {
    const upgrades = await this.getUpgrades(weapon);
    return upgrades.some(u => u.system.key === upgradeKey);
  }

  /**
   * Get modifiers from weapon upgrades.
   *
   * @deprecated Use WeaponModifierCollector.collectWeaponModifiers() instead.
   * This method only collects upgrade modifiers. The new collector handles
   * weapon, upgrade, AND ammo modifiers in one pass.
   *
   * @param {Item} weapon - Weapon item with attachedUpgrades
   * @param {boolean} isSingleShot - Single shot attack
   * @param {boolean} isAutoFire - Auto-fire attack
   * @returns {Array<Object>} Array of modifier objects (upgrade modifiers only)
   */
  static async getModifiers(weapon, isSingleShot = false, isAutoFire = false) {
    // Delegate to WeaponModifierCollector for consistency
    const actor = weapon.parent?.actor;
    if (!actor) {
      // Fallback for edge case where weapon has no parent
      const upgrades = await this.getUpgrades(weapon);
      const modifiers = [];
      for (const upgrade of upgrades) {
        if (upgrade.system.singleShotOnly && !isSingleShot) continue;
        if (upgrade.system.key === 'motion-predictor' && !isAutoFire) continue;
        if (upgrade.system.modifiers) {
          for (const mod of upgrade.system.modifiers) {
            modifiers.push({ ...mod, source: upgrade.name });
          }
        }
      }
      return modifiers;
    }

    const { WeaponModifierCollector } = await import('./weapon-modifier-collector.mjs');
    const weaponMods = WeaponModifierCollector.collectWeaponModifiers(weapon, actor, { isSingleShot, isAutoFire });

    // Flatten all modifier arrays from collector (backward compatibility)
    const allMods = [
      ...weaponMods.damage,
      ...weaponMods.penetration,
      ...weaponMods.range,
      ...weaponMods.blast,
      ...weaponMods.characteristic,
      ...weaponMods.rof,
      ...weaponMods.weight
    ];

    return allMods;
  }
}
