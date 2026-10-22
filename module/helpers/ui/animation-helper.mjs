/**
 * Animation helper for weapon animations using Sequencer and JB2A.
 * Provides utility functions for validating animation libraries and classifying weapons.
 */
export class AnimationHelper {
  /**
   * Check if required animation libraries (Sequencer + JB2A) are available.
   *
   * @returns {boolean} True if both Sequencer and at least one JB2A module are active
   * @example
   * if (AnimationHelper.areAnimationLibrariesAvailable()) {
   *   // Play animations
   * }
   */
  static areAnimationLibrariesAvailable() {
    const sequencer = game.modules.get("sequencer");
    if (!sequencer?.active) {
      return false;
    }

    const jb2aPatreon = game.modules.get("jb2a_patreon");
    const jb2aFree = game.modules.get("JB2A_DnD5e");

    return jb2aPatreon?.active || jb2aFree?.active || false;
  }

  /**
   * Classify weapon type using 3-tier hierarchy.
   *
   * Priority:
   * 1. Explicit animationKey parameter
   * 2. Name pattern matching
   * 3. Damage type fallback
   *
   * @param {Item} item - Weapon item
   * @param {string} animationKey - Optional explicit animation key from chat message
   * @returns {string} Weapon type classification (bolt, las, plasma, melta, flame, generic)
   * @example
   * const type = AnimationHelper.classifyWeapon(bolter, '');
   * // Returns: 'bolt'
   */
  static classifyWeapon(item, animationKey) {
    // Priority 1: Explicit animationKey parameter
    if (animationKey && animationKey.trim() !== "") {
      return animationKey.toLowerCase();
    }

    // Priority 2: Name pattern matching
    const name = item.name.toLowerCase();

    if (
      name.includes("bolter") ||
      name.includes("bolt pistol") ||
      name.includes("bolt gun")
    ) {
      return "bolt";
    }

    // Check plasma before las (plasma gun contains 'las')
    if (name.includes("plasma")) {
      return "plasma";
    }

    if (name.includes("las") || name.includes("hellgun")) {
      return "las";
    }

    if (
      name.includes("melta") ||
      name.includes("meltagun") ||
      name.includes("multi-melta") ||
      name.includes("infernus")
    ) {
      return "melta";
    }

    if (name.includes("flamer") || name.includes("heavy flamer")) {
      return "flame";
    }

    // Priority 3: Damage type fallback
    const damageType = item.system?.dmgType?.toLowerCase() || "";

    if (damageType === "explosive") {
      return "bolt";
    }

    if (damageType === "energy") {
      return "las";
    }

    // Ultimate fallback
    return "generic";
  }

  /**
   * Get animation configuration for weapon type.
   *
   * @param {string} weaponType - Weapon type classification
   * @returns {{file: string, delay: number}} Animation configuration
   * @example
   * const config = AnimationHelper.getAnimationConfig('bolt');
   * // Returns: { file: 'jb2a.bullet.02.orange', delay: 150 }
   */
  static getAnimationConfig(weaponType) {
    const configs = {
      bolt: {
        file: "jb2a.bullet.02.orange",
        delay: 150
      },
      las: {
        file: "jb2a.lasershot.red",
        delay: 100
      },
      plasma: {
        file: "jb2a.lasershot.blue",
        delay: 200
      },
      melta: {
        file: "jb2a.scorching_ray.01.orange",
        delay: 250
      },
      flame: {
        file: "jb2a.burning_hands.01.orange",
        delay: 0
      },
      generic: {
        file: "jb2a.bullet.01.orange",
        delay: 150
      }
    };

    return configs[weaponType] || configs.generic;
  }

  /**
   * Play weapon animation using Sequencer.
   *
   * @param {Token} sourceToken - Source token (attacker)
   * @param {Token} targetToken - Target token
   * @param {{file: string, delay: number}} config - Animation configuration
   * @param {number} rounds - Number of rounds fired (for repeats)
   * @returns {Promise<void>}
   * @example
   * await AnimationHelper.playWeaponAnimation(sourceToken, targetToken, config, 3);
   */
  static async playWeaponAnimation(sourceToken, targetToken, config, rounds) {
    try {
      const sequence = new Sequence();
      sequence
        .effect()
        .file(config.file)
        .atLocation(sourceToken)
        .stretchTo(targetToken)
        .repeats(rounds, config.delay);
      sequence.play();
    } catch (error) {
      // Silently fail - animation is cosmetic
      console.warn("[Deathwatch] Animation playback error:", error);
    }
  }

  /**
   * Play multi-stage grenade throw animation.
   * Blocks until animation completes.
   * Uses fixed JB2A asset paths (bomb throw=black, shrapnel=black, explosion=orange, ground crack=orange).
   * @param {Token} sourceToken - Source token (thrower)
   * @param {{x: number, y: number}} targetLocation - Impact location in pixel coordinates
   * @param {Object} weapon - Weapon item
   * @returns {Promise<void>}
   */
  static async playGrenadeAnimation(sourceToken, targetLocation, weapon) {
    try {
      const sequence = new Sequence();
      sequence
        .effect()
          .file('jb2a.throwable.throw.bomb.01.black')
          .atLocation(sourceToken)
          .stretchTo(targetLocation)
          .waitUntilFinished(-150)
        .effect()
          .file('jb2a.explosion.shrapnel.bomb.01.black')
          .atLocation(targetLocation)
          .scaleToObject(1.2)
          .waitUntilFinished(-100)
        .effect()
          .file('jb2a.explosion.08.orange')
          .atLocation(targetLocation)
          .waitUntilFinished()
        .effect()
          .file('jb2a.impact.ground_crack.orange')
          .atLocation(targetLocation)
          .belowTokens()
          .scaleToObject(2)
          .scaleIn(0.1, 100, {ease: "easeOutExpo"})
          .duration(5000)
          .fadeOut(3250, {ease: "easeInSine"});
      await sequence.play();
    } catch (error) {
      console.warn("[Deathwatch] Grenade animation playback error:", error);
    }
  }
}
