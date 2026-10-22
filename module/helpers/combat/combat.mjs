import { RANGE_MODIFIERS, HIT_LOCATION_RANGES } from "../constants/index.mjs";
import { CombatDialogHelper } from "./combat-dialog.mjs";
import { CanvasHelper, FoundryAdapter } from "../foundry-adapter.mjs";
import { ChatMessageBuilder } from "../ui/chat-message-builder.mjs";
import { RangedCombatHelper } from "./ranged-combat.mjs";
import { MeleeCombatHelper } from "./melee-combat.mjs";
import { WeaponQualityHelper } from "./weapon-quality-helper.mjs";
import { RighteousFuryHelper } from "./righteous-fury-helper.mjs";
import { Logger } from "../logger.mjs";
import { HordeCombatHelper } from "./horde-combat.mjs";
import { Sanitizer } from "../sanitizer.mjs";
import { CyberneticHelper } from "../cybernetic-helper.mjs";
import { WeaponModifierCollector } from "./weapon-modifier-collector.mjs";
import { ModifierCollector } from "../character/modifier-collector.mjs";
import { flameAttack } from "../../macros/flame-attack.mjs";

/**
 * Main combat helper providing attack resolution, damage application, and combat utilities.
 * Handles both ranged and melee combat for all actor types (Character, Enemy, Horde).
 *
 * @example
 * // Apply damage to an actor
 * await CombatHelper.applyDamage(target, {
 *   damage: 15,
 *   penetration: 4,
 *   location: 'Body',
 *   damageType: 'Impact'
 * });
 */
export class CombatHelper {
  static lastAttackRoll = null;
  static lastAttackTarget = null;
  static lastAttackHits = 1;
  static lastAttackAim = 0;
  static lastAttackRangeLabel = null;
  static lastAttackDistance = null;
  static lastCalledShotLocation = null;

  /**
   * Get attack tokens for combat resolution.
   * Returns attacker token, target token, and target actor.
   *
   * @param {Actor} actor - Attacking actor
   * @returns {{attackerToken: Token|null, targetToken: Token|null, targetActor: Actor|null}}
   *
   * @example
   * const { attackerToken, targetToken, targetActor } = CombatHelper.getAttackTokens(actor);
   * if (!targetToken) {
   *   ui.notifications.warn("No target selected");
   *   return;
   * }
   */
  static getAttackTokens(actor) {
    const attackerToken = actor.getActiveTokens()[0] || canvas.tokens.controlled[0];
    const targetToken = game.user.targets.first();
    const targetActor = targetToken?.actor;

    return { attackerToken, targetToken, targetActor };
  }

  /**
   * Create and post attack roll chat message with animation data attributes.
   * Used for ranged, melee, and psychic attacks.
   *
   * @param {Actor} actor - Attacking actor
   * @param {Item} weapon - Weapon or power item
   * @param {Roll} roll - Attack roll
   * @param {string} flavor - Flavor text for the attack
   * @param {string} attackType - Attack type: 'ranged', 'melee', 'grenade', or 'psychic'
   * @param {Object} [options={}] - Additional data attributes
   * @param {Token} [options.attackerToken] - Source token for animations
   * @param {Token} [options.targetToken] - Target token for animations
   * @param {number} [options.roundsFired] - Rounds fired (ranged only)
   * @param {string} [options.fireMode] - Fire mode: 'single', 'semi', 'full' (ranged only)
   * @param {string} [options.powerLevel] - Power level: 'fettered', 'unfettered', 'push' (psychic only)
   * @returns {Promise<ChatMessage>} Created chat message
   *
   * @example
   * await CombatHelper.createAttackChatMessage(actor, bolter, roll, flavorText, 'ranged', {
   *   attackerToken, targetToken, roundsFired: 3, fireMode: 'semi'
   * });
   */
  static async createAttackChatMessage(actor, weapon, roll, flavor, attackType, options = {}) {
    const {
      attackerToken,
      targetToken,
      roundsFired,
      fireMode,
      powerLevel
    } = options;

    const rollHtml = await roll.render();
    const sourceTokenId = attackerToken?.id || '';
    const targetTokenId = targetToken?.id || '';

    // Determine animation key based on item type
    let animationKey = '';
    if (attackType === 'psychic') {
      // Psychic powers use 'key' field
      animationKey = weapon.system.key || '';
    } else {
      // Weapons use 'animationKey' field
      animationKey = weapon.system.animationKey || '';
    }

    // Build data attributes (common to all attack types)
    const dataAttributes = {
      'data-actor-id': actor.id,
      'data-item-id': weapon.id,
      'data-item-uuid': weapon.uuid,
      'data-attack-type': attackType,
      'data-animation-key': Sanitizer.escape(animationKey),
      'data-damage-type': Sanitizer.escape(weapon.system.dmgType || ''),
      'data-weapon-class': Sanitizer.escape(weapon.system.class || ''),
      'data-source-token-id': sourceTokenId,
      'data-target-token-id': targetTokenId
    };

    // Add ranged-specific attributes
    if (roundsFired !== undefined) {
      dataAttributes['data-rounds-fired'] = roundsFired;
    }
    if (fireMode) {
      dataAttributes['data-fire-mode'] = fireMode;
    }

    // Add psychic-specific attributes
    if (powerLevel) {
      dataAttributes['data-power-level'] = powerLevel;
    }

    // Convert data attributes object to HTML string
    const dataAttrsString = Object.entries(dataAttributes)
      .map(([key, value]) => `${key}="${value}"`)
      .join('\n  ');

    const content = `<div class="dw-attack-roll"
  ${dataAttrsString}>
  <div class="attack-flavor">${flavor}</div>
  ${rollHtml}
</div>`;

    const speaker = ChatMessage.getSpeaker({ actor });
    return await FoundryAdapter.createChatMessage({
      speaker,
      content,
      rolls: [roll],
      rollMode: game.settings.get('core', 'rollMode')
    });
  }

  /**
   * Create and post flame damage chat message with animation data.
   * Used for flame weapons and psychic flame powers.
   *
   * @param {Actor} actor - Actor using flame weapon/power
   * @param {string} weaponName - Weapon or power name
   * @param {Roll} damageRoll - Damage roll object
   * @param {Object} flameData - Flame attack data
   * @param {number} flameData.damage - Total damage
   * @param {number} flameData.penetration - Armor penetration
   * @param {string} flameData.damageType - Damage type (usually 'Energy')
   * @param {number|string} flameData.range - Range in meters
   * @param {string} [flameData.title='Flamer'] - Title prefix ('Flamer' or 'Psychic Flame')
   * @returns {Promise<ChatMessage>} Created chat message
   *
   * @example
   * await CombatHelper.createFlamerDamageMessage(actor, 'Heavy Flamer', roll, {
   *   damage: 15, penetration: 6, damageType: 'Energy', range: 20
   * });
   */
  static async createFlamerDamageMessage(actor, weaponName, damageRoll, flameData) {
    const { damage, penetration, damageType, range, title = 'Flamer' } = flameData;
    const safeWeaponName = Sanitizer.escape(weaponName);
    const timestamp = Date.now();

    const content = `
      <div class="flamer-damage-roll"
           data-flamer-damage="${damage}"
           data-flamer-pen="${penetration}"
           data-flamer-type="${Sanitizer.escape(damageType)}"
           data-flamer-range="${range}"
           data-actor-id="${actor.id}"
           data-weapon-name="${safeWeaponName}"
           data-timestamp="${timestamp}">
        <h3>🔥 ${title}: ${safeWeaponName}</h3>
        <p><strong>Damage:</strong> ${damage}</p>
        <p><strong>Penetration:</strong> ${penetration}</p>
        <p><strong>Damage Type:</strong> ${Sanitizer.escape(damageType)}</p>
        <p><strong>Range:</strong> ${range}m</p>
        <em>Run Flame Attack macro for each target in cone.</em>
      </div>
    `;

    return await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor }),
      content,
      rolls: [damageRoll],
      rollMode: game.settings.get('core', 'rollMode')
    });
  }

  /**
   * Deduct ammunition from a weapon after firing.
   * Handles horde check, ammo management validation, capacity update, and out-of-ammo notification.
   *
   * @param {Actor} actor - Actor firing the weapon
   * @param {Item} weapon - Weapon item
   * @param {number} [ammoExpended=1] - Number of rounds expended
   * @param {boolean} [hasAmmoManagement=true] - Whether weapon uses ammo management
   * @returns {Promise<{success: boolean, remainingAmmo: number}>} Result of ammo deduction
   *
   * @example
   * const result = await CombatHelper.deductAmmo(actor, weapon, 3);
   * if (result.remainingAmmo === 0) {
   *   console.log('Out of ammo!');
   * }
   */
  static async deductAmmo(actor, weapon, ammoExpended = 1, hasAmmoManagement = true) {
    const isHorde = actor.type === 'horde';

    // Hordes don't track ammo
    if (isHorde) {
      return { success: false, remainingAmmo: -1 };
    }

    // Check if weapon has ammo management enabled
    if (!hasAmmoManagement || !weapon.system.loadedAmmo) {
      return { success: false, remainingAmmo: -1 };
    }

    // Get loaded ammo item
    const loadedAmmo = actor.items.get(weapon.system.loadedAmmo);
    if (!loadedAmmo) {
      return { success: false, remainingAmmo: -1 };
    }

    // Calculate new ammo value
    const currentAmmo = loadedAmmo.system.capacity.value;
    const newAmmoValue = Math.max(0, currentAmmo - ammoExpended);

    // Update ammo capacity
    await loadedAmmo.update({ "system.capacity.value": newAmmoValue });

    // Show out-of-ammo warning
    if (newAmmoValue === 0) {
      const safeWeaponName = Sanitizer.escape(weapon.name);
      ui.notifications.warn(`${safeWeaponName} is out of ammunition!`);
    }

    // Refresh sheet to show updated ammo
    actor.sheet.render(false);

    return { success: true, remainingAmmo: newAmmoValue };
  }

  /**
   * Calculate range modifier and band label for a ranged attack.
   * Based on Deathwatch Core Rulebook p. 245.
   * @param {number} distance - Distance to target in meters
   * @param {number} weaponRange - Weapon's maximum range in meters
   * @returns {{modifier: number, label: string}} Range modifier (+30 to -30) and band label
   * @example
   * const result = CombatHelper.calculateRangeModifier(15, 30);
   * // Returns: { modifier: +10, label: "Short" }
   */
  static calculateRangeModifier(distance, weaponRange) {
    Logger.category('COMBAT.RANGED').debug(`Distance: ${distance}m, Weapon Range: ${weaponRange}m`);
    if (distance <= 2) {
      return { modifier: RANGE_MODIFIERS.POINT_BLANK, label: "Point Blank" };
    } else if (distance < (weaponRange * 0.5)) {
      return { modifier: RANGE_MODIFIERS.SHORT, label: "Short" };
    } else if (distance >= (weaponRange * 3)) {
      return { modifier: RANGE_MODIFIERS.EXTREME, label: "Extreme" };
    } else if (distance >= (weaponRange * 2)) {
      return { modifier: RANGE_MODIFIERS.LONG, label: "Long" };
    } else {
      return { modifier: RANGE_MODIFIERS.NORMAL, label: "Normal" };
    }
  }

  /**
   * Get distance between two tokens in meters.
   * @param {Token} token1 - First token
   * @param {Token} token2 - Second token
   * @returns {number|null} Distance in meters, or null if tokens are on different scenes
   */
  static getTokenDistance(token1, token2) {
    if (!token1 || !token2) return null;
    if (token1.scene.id !== token2.scene.id) return null;

    const distance = CanvasHelper.measureDistance(token1, token2);
    return distance;
  }

  /**
   * Clear a jammed weapon. Requires a BS test (Deathwatch Core p. 257).
   * On success, weapon is cleared but needs reloading.
   * @param {Actor} actor - Actor clearing the jam
   * @param {Item} weapon - Jammed weapon item
   */
  static async clearJam(actor, weapon) {
    if (!weapon.system.jammed) {
      const safeWeaponName = Sanitizer.escape(weapon.name);
      FoundryAdapter.showNotification('info', `${safeWeaponName} is not jammed.`);
      return;
    }

    const bs = actor.system.characteristics.bs.value || 0;
    const advances = actor.system.characteristics.bs.advances || {};
    const bsAdv = (advances.simple ? 5 : 0) + (advances.intermediate ? 5 : 0) + (advances.trained ? 5 : 0) + (advances.expert ? 5 : 0);
    const targetNumber = CombatDialogHelper.calculateClearJamTarget(bs, bsAdv);

    const roll = await FoundryAdapter.evaluateRoll('1d100');
    const success = roll.total <= targetNumber;

    if (success) {
      await FoundryAdapter.updateDocument(weapon, { "system.jammed": false });
      if (weapon.system.loadedAmmo) {
        const loadedAmmo = actor.items.get(weapon.system.loadedAmmo);
        if (loadedAmmo) {
          await FoundryAdapter.updateDocument(loadedAmmo, { "system.capacity.value": 0 });
        }
        await FoundryAdapter.updateDocument(weapon, { "system.loadedAmmo": null });
      }
      const safeWeaponName = Sanitizer.escape(weapon.name);
      FoundryAdapter.showNotification('info', `${safeWeaponName} jam cleared! Weapon needs reloading.`);
    } else {
      const safeWeaponName = Sanitizer.escape(weapon.name);
      FoundryAdapter.showNotification('warn', `Failed to clear jam on ${safeWeaponName}.`);
    }

    const flavor = CombatDialogHelper.buildClearJamFlavor(weapon.name, targetNumber, success);
    const speaker = FoundryAdapter.getChatSpeaker(actor);
    await FoundryAdapter.sendRollToChat(roll, { speaker, flavor });
  }

  /**
   * Determine the attack type for a weapon based on class and qualities.
   * @param {Object} weapon - Weapon item
   * @returns {Promise<string>} 'melee', 'flame', or 'ranged'
   * @example
   * const type = await CombatHelper.getWeaponAttackType(boltgun);
   * // Returns: 'ranged'
   */
  static async getWeaponAttackType(weapon) {
    if (weapon.system.class?.toLowerCase().includes('melee')) return 'melee';
    if (await WeaponQualityHelper.hasQuality(weapon, 'flame')) return 'flame';
    return 'ranged';
  }

  /**
   * Open the appropriate attack dialog based on weapon type.
   * Delegates to RangedCombatHelper, MeleeCombatHelper, or flame weapon handling.
   * @param {Actor} actor - Attacking actor
   * @param {Item} weapon - Weapon item
   * @param {Object} [options={}] - Optional preset attack parameters (aim, rof, etc.)
   * @example
   * await CombatHelper.weaponAttackDialog(actor, boltgun, { rateOfFire: 'full', aim: 1 });
   */
  /* istanbul ignore next */
  static async weaponAttackDialog(actor, weapon, options = {}) {
    const attackType = await this.getWeaponAttackType(weapon);
    if (attackType === 'melee') return MeleeCombatHelper.attackDialog(actor, weapon, options);
    if (attackType === 'flame') return this._flameWeaponRoll(actor, weapon);
    return RangedCombatHelper.attackDialog(actor, weapon, options);
  }

  /**
   * Roll damage for a flame weapon and post to chat. No attack roll needed.
   * GM uses the Flame Attack macro to apply damage to individual targets.
   * @param {Object} actor - Actor document
   * @param {Object} weapon - Weapon item
   */
  /* istanbul ignore next */
  static async _flameWeaponRoll(actor, weapon) {
    const dmg = weapon.system.effectiveDamage || weapon.system.dmg;
    if (!dmg) return FoundryAdapter.showNotification('warn', 'This weapon has no damage value.');

    const penetration = weapon.system.effectivePenetration ?? weapon.system.penetration ?? 0;
    const dmgType = weapon.system.dmgType || 'Energy';
    const range = weapon.system.effectiveRange || weapon.system.range || '—';

    const roll = await FoundryAdapter.evaluateRoll(dmg);
    const safeWeaponName = Sanitizer.escape(weapon.name);
    const flavor = `<strong style="font-size: 1.1em;">\uD83D\uDD25 ${safeWeaponName}</strong><br><strong>Range:</strong> ${range}m | <strong>Damage:</strong> ${roll.total} | <strong>Pen:</strong> ${penetration} | <strong>Type:</strong> ${dmgType}<br><em>No attack roll — all targets in 30° cone must test Agility to dodge. Use \uD83D\uDD25 Flame Attack macro to apply damage per target.</em>`;

    const speaker = FoundryAdapter.getChatSpeaker(actor);
    await FoundryAdapter.sendRollToChat(roll, { speaker, flavor });

    // Deduct ammunition (flamers consume 1 round per shot)
    const clip = weapon.system.clip;
    const hasAmmoManagement = clip && clip !== '—' && clip !== '-' && clip !== '';
    await this.deductAmmo(actor, weapon, 1, hasAmmoManagement);
  }

  /**
   * Determine hit location from reversed d100 attack roll (Deathwatch Core p. 243).
   * Attack roll digits are reversed: roll of 42 → 24 → Body.
   * @param {number} attackRoll - The d100 attack roll (1-100)
   * @returns {string} Hit location: "Head", "Body", "Right Arm", "Left Arm", "Right Leg", or "Left Leg"
   * @example
   * const location = CombatHelper.determineHitLocation(42);
   * // Roll 42 → reversed to 24 → "Left Arm"
   */
  static determineHitLocation(attackRoll) {
    const normalizedRoll = attackRoll === 100 ? 0 : attackRoll;
    const paddedRoll = normalizedRoll.toString().padStart(2, '0');
    const reversed = parseInt(paddedRoll.split('').reverse().join(''));

    for (const [, range] of Object.entries(HIT_LOCATION_RANGES)) {
      if (reversed >= range.min && reversed <= range.max) {
        return range.label;
      }
    }

    return HIT_LOCATION_RANGES.LEFT_LEG.label;  // Default fallback
  }

  /**
   * Determine multiple hit locations for multi-hit attacks (Full Auto, etc.).
   * Uses hit pattern from first location: hits spread to adjacent body parts.
   * @param {string} firstLocation - Initial hit location
   * @param {number} totalHits - Total number of hits
   * @returns {string[]} Array of hit locations for each hit
   * @see {@link determineHitLocation} for single hit determination
   */
  static determineMultipleHitLocations(firstLocation, totalHits) {
    if (totalHits <= 1) return [firstLocation];

    const hitPattern = {
      "Head": ["Head", "Head", "Arm", "Body", "Arm", "Body"],
      "Right Arm": ["Right Arm", "Left Arm", "Body", "Head", "Body", "Arm"],
      "Left Arm": ["Left Arm", "Right Arm", "Body", "Head", "Body", "Arm"],
      "Body": ["Body", "Body", "Arm", "Head", "Arm", "Body"],
      "Right Leg": ["Right Leg", "Left Leg", "Body", "Arm", "Head", "Body"],
      "Left Leg": ["Left Leg", "Right Leg", "Body", "Arm", "Head", "Body"]
    };

    const basePattern = hitPattern[firstLocation] || hitPattern["Body"];
    const locations = [];
    let armToggle = firstLocation.includes("Right");
    let legToggle = firstLocation.includes("Right");

    for (let i = 0; i < totalHits; i++) {
      let location = basePattern[Math.min(i, 5)];
      
      if (location === "Arm") {
        location = armToggle ? "Right Arm" : "Left Arm";
        armToggle = !armToggle;
      } else if (location === "Leg") {
        location = legToggle ? "Right Leg" : "Left Leg";
        legToggle = !legToggle;
      }
      
      locations.push(location);
    }

    return locations;
  }

  /**
   * Get armor value for a specific location.
   * Delegates to actor's DataModel for polymorphic handling.
   * @param {Actor} actor - Actor document
   * @param {string} location - Hit location ("Head", "Body", etc.)
   * @returns {number} Armor points for that location
   */
  static getArmorValue(actor, location) {
    return actor.system.getArmorValue(location);
  }

  /**
   * Get all defensive values for a target actor at a specific location.
   * @param {Actor} targetActor - Target actor
   * @param {string} location - Hit location
   * @returns {Object} Defense data (armor, naturalArmor, toughnessBonus)
   * @private
   */
  static _getTargetDefenses(targetActor, location) {
    return targetActor.system.getDefenses(location);
  }

  /**
   * Apply damage to a target actor.
   * Delegates to actor's DataModel for polymorphic damage handling.
   * @param {Actor} targetActor - Target actor
   * @param {Object} options - Damage data (damage, penetration, location, damageType, etc.)
   * @returns {Promise<Object>} Result object with wounds dealt, critical damage, etc.
   * @example
   * await CombatHelper.applyDamage(target, {
   *   damage: 15,
   *   penetration: 4,
   *   location: 'Body',
   *   damageType: 'Impact'
   * });
   */
  static async applyDamage(targetActor, options) {
    return targetActor.system.receiveDamage(options);
  }

  /**
   * Apply damage with permission check and socket routing.
   *
   * If the current user is GM or owns the target actor, applies damage directly.
   * If the current user is a player attacking a GM-owned actor, routes through
   * socket messaging so the GM executes the update with their permissions.
   *
   * @param {Actor} targetActor - Target actor document
   * @param {Object} options - Damage options (same as applyDamage)
   * @returns {Promise<void>}
   * @example
   * // Player attacking GM-owned horde (routes through socket)
   * await CombatHelper.applyDamageWithPermissionCheck(hordeActor, damageOptions);
   *
   * @example
   * // GM attacking any actor (direct update)
   * await CombatHelper.applyDamageWithPermissionCheck(enemyActor, damageOptions);
   */
  static async applyDamageWithPermissionCheck(targetActor, options) {
    // Check if current user can update the actor
    const canUpdate = game.user.isGM || targetActor.testUserPermission(game.user, "OWNER");

    if (canUpdate) {
      // Direct update - user has permission
      return await targetActor.system.receiveDamage(options);
    } else {
      // Route through socket - GM will execute with their permissions
      game.socket.emit('system.deathwatch', {
        type: 'applyActorDamage',
        actorId: targetActor.id,
        damageOptions: options,
        userId: game.user.id,
        userName: game.user.name
      });
    }
  }

  /**
   * Check if a damage roll contains a natural 10 (for Righteous Fury).
   * @param {Roll} roll - Foundry Roll object
   * @returns {boolean} True if any d10 in the roll rolled a natural 10
   * @see {@link RighteousFuryHelper.hasNaturalTen}
   */
  static hasNaturalTen(roll) {
    return RighteousFuryHelper.hasNaturalTen(roll, 10);
  }

  /**
   * Get Righteous Fury threshold from loaded ammo modifiers.
   *
   * Some ammo types (e.g., Hellfire Rounds) lower the threshold from 10 to 9,
   * making Righteous Fury trigger on 9-10 instead of just 10.
   *
   * @param {Item} weapon - Weapon item
   * @param {Actor} actor - Actor with the weapon (to access loaded ammo)
   * @returns {number} Fury threshold (default: 10, can be lowered to 9 or 8)
   * @example
   * const threshold = CombatHelper._getFuryThreshold(boltgun, actor);
   * // Returns: 9 if Hellfire Rounds loaded, 10 otherwise
   * @private
   */
  static _getFuryThreshold(weapon, actor) {
    if (!weapon || !actor) return 10;

    const weaponMods = WeaponModifierCollector.collectWeaponModifiers(weapon, actor, {});
    if (weaponMods.righteousFury.length > 0) {
      return parseInt(weaponMods.righteousFury[0].modifier) || 10;
    }
    return 10;
  }

  /**
   * Get bonus magnitude damage against hordes from loaded ammo modifiers and weapon qualities.
   *
   * Sources of magnitude bonus damage:
   * 1. Ammo modifiers (e.g., Frag Missiles, Metal Storm rounds)
   * 2. Devastating weapon quality (Deathwatch Core p. 142)
   *
   * This bonus is added to magnitude reduction for each penetrating hit against a horde.
   *
   * @param {Item} weapon - Weapon item
   * @param {Actor} actor - Actor with the weapon (to access loaded ammo)
   * @returns {Promise<number>} Total bonus magnitude damage per penetrating hit (default: 0)
   * @example
   * const bonus = await CombatHelper._getMagnitudeBonusDamage(bolter, actor);
   * // Returns: 1 if Metal Storm rounds loaded, 0 otherwise
   * @example
   * const bonus = await CombatHelper._getMagnitudeBonusDamage(strangler, actor);
   * // Returns: 2 if weapon has Devastating(2), 0 otherwise
   * @private
   */
  static async _getMagnitudeBonusDamage(weapon, actor) {
    let total = 0;

    // Check ammo modifiers via collector
    if (weapon && actor) {
      const weaponMods = WeaponModifierCollector.collectWeaponModifiers(weapon, actor, {});
      total += weaponMods.magnitudeBonus.reduce((sum, mod) => sum + (parseInt(mod.modifier) || 0), 0);
    }

    // Check Devastating weapon quality
    const { WeaponQualityHelper } = await import('./weapon-quality-helper.mjs');
    const devastatingValue = await WeaponQualityHelper.getDevastatingValue(weapon);
    total += devastatingValue;

    return total;
  }

  /**
   * Get characteristic damage effect from loaded ammo modifiers.
   *
   * Some ammo types (e.g., Toxin rounds) deal characteristic damage on hit.
   * This is applied in addition to normal wounds.
   *
   * @param {Item} weapon - Weapon item
   * @param {Actor} actor - Actor with the weapon (to access loaded ammo)
   * @returns {Object|null} Characteristic damage data or null if no effect
   * @property {string} return.formula - Damage formula (e.g., "1d10")
   * @property {string} return.characteristic - Characteristic key (e.g., "tgh", "str")
   * @property {string} return.name - Display name of the effect
   * @example
   * const effect = CombatHelper._getCharacteristicDamageEffect(pistol, actor);
   * // Returns: { formula: "1d10", characteristic: "tgh", name: "Toxin" } for Toxin rounds
   * @private
   */
  static _getCharacteristicDamageEffect(weapon, actor) {
    if (!weapon || !actor) return null;

    const weaponMods = WeaponModifierCollector.collectWeaponModifiers(weapon, actor, {});
    const charDamage = weaponMods.characteristicDamage;

    // Strip 'source' field for backward compatibility with legacy callers
    if (charDamage) {
      const { source, ...legacyFormat } = charDamage;
      return legacyFormat;
    }

    return null;
  }

  /**
   * Check if loaded ammo ignores natural armor.
   *
   * Some ammo types (e.g., Kraken rounds) bypass natural armor completely.
   * This allows weapons to bypass the natural armor of Tyranids and other
   * creatures with thick hides.
   *
   * @param {Item} weapon - Weapon item
   * @param {Actor} actor - Actor with the weapon (to access loaded ammo)
   * @returns {boolean} True if ammo ignores natural armor
   * @example
   * const ignores = CombatHelper._getIgnoresNaturalArmour(boltgun, actor);
   * // Returns: true if Kraken rounds loaded, false otherwise
   * @private
   */
  static _getIgnoresNaturalArmour(weapon, actor) {
    if (!weapon || !actor) return false;

    const weaponMods = WeaponModifierCollector.collectWeaponModifiers(weapon, actor, {});
    return weaponMods.ignoresNaturalArmor;
  }

  /**
   * Check if an actor has a specific talent by name.
   *
   * Searches the actor's items for a talent with the exact name match.
   * Handles both Map and Array item collections for compatibility.
   *
   * @param {Actor} actor - Actor document
   * @param {string} talentName - Exact talent name to search for (case-sensitive)
   * @returns {boolean} True if actor has the talent
   * @example
   * const hasTalent = CombatHelper.hasTalent(actor, 'Mighty Shot');
   * // Returns: true if actor has Mighty Shot talent
   */
  static hasTalent(actor, talentName) {
    if (!actor?.items) return false;
    const items = actor.items instanceof Map ? Array.from(actor.items.values()) : actor.items;
    return items.some(i => i.type === 'talent' && i.name === talentName);
  }

  /**
   * Get weapon damage bonus from talents.
   *
   * Calculates total weapon damage bonus from:
   * - Crushing Blow (+2 melee damage)
   * - Mighty Shot (+2 ranged damage)
   * - Hunter of Aliens (+2 melee damage)
   * - Scourge of Heretics (+2 melee damage)
   * - Slayer of Daemons (+2 melee damage)
   *
   * @param {Actor} actor - Actor document
   * @param {boolean} isMelee - Whether the attack is melee
   * @returns {number} Total weapon damage bonus
   * @example
   * const bonus = CombatHelper.getWeaponDamageBonus(actor, true);
   * // Returns: 2 if actor has Crushing Blow talent
   */
  static getWeaponDamageBonus(actor, isMelee) {
    if (!actor?.items || !actor?.system) return 0;

    // Collect all modifiers from actor
    const modifiers = ModifierCollector.collectAllModifiers(actor, actor.items);

    // Filter for weapon-damage modifiers
    // Note: conditional modifiers (Hunter of Aliens, etc.) apply unconditionally for now
    // Future enhancement: add enemy-type detection
    const weaponDamageMods = modifiers.filter(m => {
      if (m.effectType !== 'weapon-damage' || m.enabled === false) {
        return false;
      }
      // No attack type filtering - weapon-damage applies to all attacks from that talent
      return true;
    });

    // Sum up the bonuses
    const bonus = weaponDamageMods.reduce((sum, m) => sum + parseInt(m.modifier), 0);

    return bonus;
  }

  /**
   * Get the critical damage bonus from talents.
   *
   * Calculates total critical damage bonus from:
   * - Crack Shot (+2 ranged critical damage)
   * - Crippling Strike (+4 melee critical damage)
   * - Street Fighting (+2 melee critical damage with knives/unarmed)
   *
   * @param {Actor} actor - Actor document
   * @param {boolean} isMelee - Whether the attack is melee
   * @param {string} [weaponName=''] - Weapon name (for Street Fighting check)
   * @returns {number} Total critical damage bonus (0-6)
   * @example
   * const bonus = CombatHelper.getCriticalDamageBonus(actor, true, 'Combat Knife');
   * // Returns: 6 if actor has both Crippling Strike and Street Fighting
   */
  static getCriticalDamageBonus(actor, isMelee, weaponName = '') {
    if (!actor?.items || !actor?.system) return 0;

    // Collect all modifiers from actor
    const modifiers = ModifierCollector.collectAllModifiers(actor, actor.items);

    // Filter for critical-damage modifiers matching attack type
    const attackType = isMelee ? 'melee' : 'ranged';
    const critDamageMods = modifiers.filter(m => {
      if (m.effectType !== 'critical-damage' || m.valueAffected !== attackType || m.enabled === false) {
        return false;
      }

      // Check weapon restriction if specified
      if (m.weaponRestriction === 'unarmed-or-knife') {
        const name = weaponName.toLowerCase();
        return name.includes('unarmed') || name.includes('knife') || name.includes('combat knife');
      }

      return true;
    });

    // Sum up the bonuses
    const bonus = critDamageMods.reduce((sum, m) => sum + parseInt(m.modifier), 0);

    return bonus;
  }

  /**
   * Roll Righteous Fury confirmation and critical damage.
   * @param {Actor} actor - Attacking actor
   * @param {Item} weapon - Weapon used
   * @param {number} targetNumber - Target number for confirmation roll
   * @param {string} hitLocation - Hit location for critical damage
   * @returns {Promise<Object>} Fury result with damage and critical effects
   * @see {@link RighteousFuryHelper.rollConfirmation}
   */
  static async rollRighteousFury(actor, weapon, targetNumber, hitLocation) {
    return RighteousFuryHelper.rollConfirmation(actor, targetNumber, hitLocation);
  }

  /**
   * Open weapon damage dialog and roll damage for one or more hits.
   * Handles single/multi-hit damage, weapon qualities, Righteous Fury, and horde targets.
   * Pre-loads attack roll data from lastAttackRoll/lastAttackTarget state.
   * @param {Actor} actor - Attacking actor
   * @param {Item} weapon - Weapon item
   * @param {Object} [options] - Optional parameters
   * @param {boolean} [options.isFlamerAttack=false] - If true, create simple chat message for Flame Attack macro consumption
   * @example
   * // After an attack roll, roll damage
   * await CombatHelper.weaponDamageRoll(actor, boltgun);
   */
  /* istanbul ignore next */
  static async weaponDamageRoll(actor, weapon, options = {}) {
    const dmg = weapon.system.effectiveDamage || weapon.system.dmg;
    if (!dmg) return ui.notifications.warn("This weapon has no damage value.");

    // Flamer attack: create simple chat message with data attributes for macro consumption
    if (options.isFlamerAttack) {
      const dmg = weapon.system.effectiveDamage || weapon.system.dmg;
      if (!dmg) {
        ui.notifications.warn("This weapon has no damage value.");
        return;
      }

      // Roll damage
      const damageRoll = await new Roll(dmg).evaluate();
      const damage = damageRoll.total;

      // Extract weapon data
      const penetration = weapon.system.effectivePenetration ?? weapon.system.penetration ?? weapon.system.pen ?? 0;
      const damageType = weapon.system.dmgType || 'Energy';
      const range = parseInt(weapon.system.effectiveRange || weapon.system.range) || 20;
      const timestamp = Date.now();
      const safeWeaponName = Sanitizer.escape(weapon.name);


      // Play flame animation if target is selected (optional)
      const attackerToken = actor.getActiveTokens?.()?.[0] || canvas?.tokens?.controlled?.[0];
      const targetToken = game?.user?.targets?.first();

      if (attackerToken && targetToken) {
        // Import AnimationHelper dynamically to avoid circular dependencies
        const { AnimationHelper } = await import('../ui/animation-helper.mjs');
        const librariesAvailable = AnimationHelper.areAnimationLibrariesAvailable();
        
        if (librariesAvailable) {
          const flameConfig = AnimationHelper.getAnimationConfig('flame');
          await AnimationHelper.playWeaponAnimation(attackerToken, targetToken, flameConfig, 1);
        }
      }

      // Create chat message with machine-readable metadata
      await this.createFlamerDamageMessage(actor, weapon.name, damageRoll, {
        damage,
        penetration,
        damageType,
        range,
        title: 'Flamer'
      });


      // Deduct ammunition (flamers consume 1 round per shot)
      const clip = weapon.system.clip;
      const hasAmmoManagement = clip && clip !== '—' && clip !== '-' && clip !== '';
      const isHorde = actor.type === 'horde';

      if (!isHorde && hasAmmoManagement && weapon.system.loadedAmmo) {
        const loadedAmmo = actor.items.get(weapon.system.loadedAmmo);
        if (loadedAmmo) {
          const newAmmoValue = Math.max(0, loadedAmmo.system.capacity.value - 1);
          await loadedAmmo.update({ 'system.capacity.value': newAmmoValue });
          if (newAmmoValue === 0) {
            ui.notifications.warn(`${safeWeaponName} is out of ammunition!`);
          }
          actor.sheet.render(false);
        }
      }

      return;
    }

    const defaultRoll = this.lastAttackRoll || '';
    const defaultTarget = this.lastAttackTarget || '';
    const defaultHits = this.lastAttackHits || 1;
    const aimUsed = this.lastAttackAim || 0;
    const isMelee = weapon.system.class?.toLowerCase().includes('melee');
    // Check if weapon uses cybernetic strength (e.g., servo-arm)
    const cyberneticStrBonus = CyberneticHelper.getWeaponStrengthBonus(actor, weapon);
    const strBonus = cyberneticStrBonus !== null ? cyberneticStrBonus : (actor.system.characteristics.str?.mod || 0);
    const targetToken = game.user.targets.first();
    const tokenInfo = targetToken?.document ? { sceneId: targetToken.document.parent.id, tokenId: targetToken.document.id } : null;

    const content = `
      <div style="display: flex; gap: 10px;">
        <div class="form-group" style="flex: 1;">
          <label>Roll:</label>
          <input type="number" id="attackRoll" name="attackRoll" value="${defaultRoll}" placeholder="e.g., 32" min="1" max="100" readonly />
        </div>
        <div class="form-group" style="flex: 1;">
          <label>Target:</label>
          <input type="number" id="targetNumber" name="targetNumber" value="${defaultTarget}" placeholder="e.g., 50" min="1" max="200" readonly />
        </div>
      </div>
      <div class="form-group">
        <label>Hits:</label>
        <input type="number" id="numHits" name="numHits" value="${defaultHits}" min="1" max="10" />
      </div>
      <div class="form-group">
        <label>Modifier:</label>
        <input type="text" id="miscDamageModifier" name="miscDamageModifier" value="" placeholder="e.g., 5 or 1d10" />
      </div>
      ${targetToken ? `<div class="form-group"><strong>Target:</strong> ${Sanitizer.escape(targetToken.actor.name)}</div>` : ''}
    `;

    const safeWeaponName = Sanitizer.escape(weapon.name);
    foundry.applications.api.DialogV2.wait({
      window: { title: `Damage: ${safeWeaponName}` },
      content: content,
      buttons: [
        {
          label: "Roll Damage", action: "roll",
          callback: async (event, button, dialog) => {
            const el = dialog.element;
            const attackRollInput = el.querySelector('#attackRoll').value;
            const targetNumberInput = el.querySelector('#targetNumber').value;
            const numHits = parseInt(el.querySelector('#numHits').value) || 1;
            const miscDamageModifier = el.querySelector('#miscDamageModifier').value?.trim() || '';
            let firstHitLocation = "Unknown";
            let degreesOfSuccess = 0;
            let targetNumber = 0;
            
            if (attackRollInput && targetNumberInput) {
              const attackRoll = parseInt(attackRollInput);
              targetNumber = parseInt(targetNumberInput);
              if (attackRoll >= 1 && attackRoll <= 100) {
                firstHitLocation = this.lastCalledShotLocation || this.determineHitLocation(attackRoll);
                degreesOfSuccess = CombatDialogHelper.calculateDegreesOfSuccess(attackRoll, targetNumber);
              }
            }
            this.lastCalledShotLocation = null;

            const hitLocations = this.determineMultipleHitLocations(firstHitLocation, numHits);
            const penetration = weapon.system.effectivePenetration ?? weapon.system.penetration ?? weapon.system.pen ?? 0;
            const isAccurate = weapon.system.isAccurate || false;
            const isAiming = aimUsed > 0;
            const isSingleShot = numHits === 1;
            const isPrimitive = weapon.system.isPrimitive || false;
            const isRazorSharp = await WeaponQualityHelper.hasQuality(weapon, 'razor-sharp');
            const isScatter = await WeaponQualityHelper.hasQuality(weapon, 'scatter');
            const isShocking = await WeaponQualityHelper.hasQuality(weapon, 'shocking');
            const isTearing = await WeaponQualityHelper.hasQuality(weapon, 'tearing');
            const isToxic = await WeaponQualityHelper.hasQuality(weapon, 'toxic');
            const isVolatile = await WeaponQualityHelper.hasQuality(weapon, 'volatile');
            const provenRating = await WeaponQualityHelper.getProvenRating(weapon);
            const rangeLabel = this.lastAttackRangeLabel || "Unknown";
            const isLongOrExtremeRange = rangeLabel === "Long" || rangeLabel === "Extreme";
            const isPowerFist = await WeaponQualityHelper.hasQuality(weapon, 'power-fist');
            const isLightningClaw = await WeaponQualityHelper.isLightningClaw(weapon);
            const hasLightningClawPair = await WeaponQualityHelper.hasLightningClawPair(actor);
            const isMelta = await WeaponQualityHelper.isMelta(weapon);
            const distance = this.lastAttackDistance;
            const weaponRange = parseInt(weapon.system.range) || 0;
            const isMeltaRange = isMelta && distance !== null && weaponRange > 0 && distance < (weaponRange * 0.5);
            const furyThreshold = this._getFuryThreshold(weapon, actor);
            const charDamageEffect = this._getCharacteristicDamageEffect(weapon, actor);
            const magnitudeBonusDamage = await this._getMagnitudeBonusDamage(weapon, actor);
            const ignoresNaturalArmour = this._getIgnoresNaturalArmour(weapon, actor);
            const isForce = weapon.system.attachedQualities?.some(q => (typeof q === 'string' ? q : q.id) === 'force') || false;
            const psyRating = actor.system?.psyRating?.value || 0;
            const forceWeaponData = (isForce && psyRating > 0) ? { attackerId: actor.id, psyRating } : null;
            const criticalDamageBonus = this.getCriticalDamageBonus(actor, isMelee, weapon.name);
            
            const isHordeTarget = targetToken?.actor?.type === 'horde';
            const hordeHitResults = [];

            for (let i = 0; i < numHits; i++) {
              let totalDamage = 0;
              
              let damageFormula = CombatDialogHelper.buildDamageFormula({
                baseDmg: dmg,
                degreesOfSuccess,
                isMelee,
                strBonus,
                hitIndex: i,
                isAccurate,
                isAiming,
                isSingleShot,
                isTearing,
                provenRating,
                isPowerFist,
                isLightningClaw,
                hasLightningClawPair,
                weaponDamageBonus: this.getWeaponDamageBonus(actor, isMelee)
              });
              const combatDamageFormula = damageFormula;

              if (actor.type === 'horde') {
                const currentMagnitude = (actor.system.wounds.max || 0) - (actor.system.wounds.value || 0);
                const bonusDice = HordeCombatHelper.calculateHordeDamageBonusDice(currentMagnitude);
                if (bonusDice > 0) damageFormula += ` + ${bonusDice}d10`;
              }

              if (miscDamageModifier) {
                damageFormula += ` + ${miscDamageModifier}`;
              }

              const roll = await new Roll(damageFormula).evaluate();
              totalDamage += roll.total;

              if (isHordeTarget) {
                if (actor.system.canRighteousFury() && RighteousFuryHelper.hasNaturalTen(roll, furyThreshold) && targetNumber > 0) {
                  const { totalDamage: furyDamage } = await RighteousFuryHelper.processFuryChain(
                    actor, weapon, combatDamageFormula, targetNumber, hitLocations[i], isVolatile, furyThreshold, targetToken?.actor
                  );
                  totalDamage += furyDamage;
                }

                hordeHitResults.push({
                  damage: totalDamage, penetration, location: hitLocations[i],
                  damageType: weapon.system.dmgType || 'Impact',
                  isPrimitive, isRazorSharp, degreesOfSuccess,
                  isScatter, isLongOrExtremeRange, isMeltaRange, magnitudeBonusDamage, ignoresNaturalArmour
                });
              } else {
                const applyButton = targetToken ? ChatMessageBuilder.createDamageApplyButton({
                  damage: totalDamage, penetration, location: hitLocations[i], targetId: targetToken.actor.id,
                  damageType: weapon.system.dmgType || 'Impact', isPrimitive, isRazorSharp, degreesOfSuccess,
                  isScatter, isLongOrExtremeRange, isShocking, isToxic, isMeltaRange,
                  charDamageEffect, forceWeaponData, tokenInfo, magnitudeBonusDamage, ignoresNaturalArmour,
                  criticalDamageBonus, weaponQualities: weapon.system.attachedQualities || []
                }) : '';
                const flavor = ChatMessageBuilder.createDamageFlavor(weapon.name, i + 1, numHits, hitLocations[i], degreesOfSuccess, penetration, isMelee, strBonus, applyButton);
              
                await roll.toMessage({
                  speaker: ChatMessage.getSpeaker({ actor }),
                  flavor
                });
              
                if (actor.system.canRighteousFury() && RighteousFuryHelper.hasNaturalTen(roll, furyThreshold) && targetNumber > 0) {
                  const { totalDamage: furyDamage, furyCount } = await RighteousFuryHelper.processFuryChain(
                    actor, weapon, combatDamageFormula, targetNumber, hitLocations[i], isVolatile, furyThreshold, targetToken?.actor
                  );
                
                  totalDamage += furyDamage;
                
                  const applyFuryButton = targetToken ? ChatMessageBuilder.createDamageApplyButton({
                    damage: totalDamage, penetration, location: hitLocations[i], targetId: targetToken.actor.id,
                    damageType: weapon.system.dmgType || 'Impact', isPrimitive, isRazorSharp, degreesOfSuccess,
                    isScatter, isLongOrExtremeRange, isShocking, isToxic, isMeltaRange,
                    charDamageEffect, forceWeaponData, tokenInfo, magnitudeBonusDamage, ignoresNaturalArmour,
                    criticalDamageBonus, weaponQualities: weapon.system.attachedQualities || []
                  }) : '';
                  const summaryContent = ChatMessageBuilder.createRighteousFurySummary(furyCount, hitLocations[i], totalDamage, applyFuryButton);
                
                  await ChatMessage.create({
                    speaker: ChatMessage.getSpeaker({ actor }),
                    content: summaryContent
                  });
                }
              }
            }

            if (isHordeTarget && hordeHitResults.length > 0) {
              await targetToken.actor.system.receiveBatchDamage(hordeHitResults);
            }
          }
        },
        { label: "Cancel", action: "cancel" }
      ]
    });
  }
}
