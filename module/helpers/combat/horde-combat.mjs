import { HORDE_CONSTANTS } from "../constants/index.mjs";

/**
 * Helper for horde-specific combat mechanics.
 * Hordes lose 1 Magnitude per hit that deals any damage after armor and TB.
 */
export class HordeCombatHelper {

  /**
   * Calculate bonus hits against a horde from weapon properties.
   * @param {Object} options
   * @param {string} options.damageType - Weapon damage type (e.g., 'Explosive', 'Energy')
   * @param {number} options.blastValue - Blast(X) value, 0 if not blast
   * @param {boolean} options.isFlame - Whether weapon has Flame quality
   * @param {number} options.flameRange - Weapon range (for flame hit calculation)
   * @param {boolean} options.isMelee - Whether this is a melee attack
   * @param {number} options.degreesOfSuccess - DoS on the attack roll
   * @param {boolean} options.hasPowerField - Whether melee weapon has Power Field quality
   * @param {number} options.baseHits - Hits from the normal attack calculation
   * @returns {number} Total hits against the horde
   */
  static calculateHordeHits(options) {
    console.log('[HordeCombat] calculateHordeHits called with:', options);

    const {
      damageType = '',
      blastValue = 0,
      isFlame = false,
      flameRange = 0,
      isMelee = false,
      degreesOfSuccess = 0,
      hasPowerField = false,
      baseHits = 1,
      isPsychic = false,
      effectivePR = 0
    } = options;

    console.log('[HordeCombat] Extracted values:', {
      damageType,
      blastValue,
      isFlame,
      isMelee,
      baseHits
    });

    // Psychic powers: hits = effective PR
    if (isPsychic) {
      console.log('[HordeCombat] Psychic path, returning:', effectivePR);
      return Math.max(0, effectivePR);
    }

    // Blast weapons add bonus hits equal to Blast value
    // Stacks additively with baseHits (from Full Auto, etc.)
    if (blastValue > 0) {
      let hits = baseHits + blastValue;

      // Explosive bonus applies when weapon has both Blast quality and Explosive damage type
      if (damageType.toLowerCase() === 'explosive') hits += 1;

      console.log('[HordeCombat] Blast path, baseHits:', baseHits, 'blastValue:', blastValue, 'explosive bonus:', damageType.toLowerCase() === 'explosive' ? 1 : 0, 'total hits:', hits);
      return hits;
    }

    // Flame weapons: ceil(range / 4) + 1d5
    // Returns static component only; 1d5 rolled in ranged-combat.mjs after calculateHitsReceived()
    if (isFlame) {
      return Math.ceil(flameRange / 4);
    }

    // Melee vs horde: 1 hit per 2 DoS, Power Field adds 1
    if (isMelee) {
      let hits = degreesOfSuccess >= 2 ? Math.floor(degreesOfSuccess / 2) : 0;
      // Minimum 1 hit on a successful attack (DoS >= 0 means success)
      if (hits === 0 && degreesOfSuccess >= 0) hits = 1;
      if (hasPowerField) hits += 1;
      return hits;
    }

    // Ranged (non-blast, non-flame): use normal hits + explosive bonus
    let hits = baseHits;
    if (damageType.toLowerCase() === 'explosive') hits += 1;
    console.log('[HordeCombat] Ranged non-blast path, returning hits:', hits);
    return hits;
  }

  /**
   * Calculate the static flame hit component (without the 1d5 roll).
   * @param {number} weaponRange - The flame weapon's range
   * @returns {number} Static hits = ceil(range / 4)
   */
  static getFlameStaticHits(weaponRange) {
    return Math.ceil(weaponRange / 4);
  }

  /**
   * Calculate bonus damage dice for a horde's attack based on its Magnitude.
   * Bonus = floor(magnitude / 10) d10s, max +2d10 (Deathwatch Core p. 358).
   * @param {number} magnitude - Current horde magnitude (max - value)
   * @returns {number} Number of bonus d10s (0-2)
   */
  static calculateHordeDamageBonusDice(magnitude) {
    return Math.min(HORDE_CONSTANTS.MAX_MAGNITUDE_BONUS_DICE, Math.floor(magnitude / HORDE_CONSTANTS.MAGNITUDE_DAMAGE_DIVISOR));
  }

  /**
   * Calculate magnitude reduction from a single damage application.
   * Each hit that deals any damage after armor and TB reduces magnitude by 1.
   * @param {number} damage - Raw damage dealt
   * @param {number} armorValue - Horde's single armor value
   * @param {number} penetration - Weapon penetration
   * @param {number} toughnessBonus - Target's effective TB
   * @param {Object} qualityOptions - Weapon quality modifiers for armor/pen
   * @param {boolean} qualityOptions.isPrimitive - Primitive quality
   * @param {boolean} qualityOptions.isRazorSharp - Razor Sharp quality
   * @param {number} qualityOptions.degreesOfSuccess - DoS for Razor Sharp
   * @param {boolean} qualityOptions.isMeltaRange - Melta at short range
   * @returns {number} 1 if damage penetrates, 0 if fully absorbed
   */
  static calculateMagnitudeReduction(damage, armorValue, penetration, toughnessBonus, qualityOptions = {}) {
    const { isPrimitive = false, isRazorSharp = false, degreesOfSuccess = 0, isMeltaRange = false } = qualityOptions;

    let effectivePenetration = penetration;
    if (isRazorSharp && degreesOfSuccess >= 2) {
      effectivePenetration = penetration * 2;
    } else if (isMeltaRange) {
      effectivePenetration = penetration * 2;
    }

    let effectiveArmor = isPrimitive
      ? Math.max(0, (armorValue * 2) - effectivePenetration)
      : Math.max(0, armorValue - effectivePenetration);

    const totalReduction = effectiveArmor + toughnessBonus;
    return damage > totalReduction ? 1 : 0;
  }
}
