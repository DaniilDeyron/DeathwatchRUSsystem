export class WeaponQualityHelper {
  static async getQualityKey(qualityId) {
    const pack = game.packs.get('deathwatch.weapon-qualities');
    if (!pack) return null;
    const quality = await pack.getDocument(qualityId);
    return quality?.system?.key || null;
  }

  static async getQualityValue(qualityId, field) {
    const pack = game.packs.get('deathwatch.weapon-qualities');
    if (!pack) return null;
    const quality = await pack.getDocument(qualityId);
    return quality?.system?.[field] || null;
  }

  static async hasQuality(weapon, qualityKey) {
    const qualityIds = weapon.system.attachedQualities || [];
    for (const q of qualityIds) {
      const id = typeof q === 'string' ? q : q.id;
      const key = await this.getQualityKey(id);
      if (key === qualityKey) return true;
    }
    return false;
  }

  /**
   * Check multiple weapon qualities in a single pass through attachedQualities.
   * Reduces async overhead from 10-15 sequential hasQuality() calls to a single batch operation.
   *
   * @param {Object} weapon - The weapon item
   * @param {string[]} qualityKeys - Array of quality keys to check
   * @returns {Promise<Object>} Object mapping quality keys to boolean presence
   *
   * @example
   * const qualities = await WeaponQualityHelper.checkMultipleQualities(weapon, [
   *   'accurate', 'storm', 'twin-linked', 'scatter'
   * ]);
   * if (qualities.storm) { ... }
   * if (qualities['twin-linked']) { ... }
   */
  static async checkMultipleQualities(weapon, qualityKeys) {
    const result = {};

    // Initialize all keys to false
    for (const key of qualityKeys) {
      result[key] = false;
    }

    // Single pass through attachedQualities
    const qualityIds = weapon.system.attachedQualities || [];
    for (const q of qualityIds) {
      const id = typeof q === 'string' ? q : q.id;
      const key = await this.getQualityKey(id);

      // Mark as true if key is in the requested list
      if (qualityKeys.includes(key)) {
        result[key] = true;
      }
    }

    return result;
  }

  /**
   * Extract a numeric value from a weapon quality.
   * @param {Object} weapon - The weapon item
   * @param {string} qualityKey - The quality key to search for (e.g., 'blast', 'devastating', 'proven')
   * @returns {Promise<number>} The quality's numeric value, or 0 if not found
   * @private
   */
  static async _getNumericQualityValue(weapon, qualityKey) {
    const qualityIds = weapon.system.attachedQualities || [];
    for (const q of qualityIds) {
      const id = typeof q === 'string' ? q : q.id;
      const key = await this.getQualityKey(id);
      if (key === qualityKey) {
        const value = typeof q === 'object' ? q.value : await this.getQualityValue(id, 'value');
        return parseInt(value) || 0;
      }
    }
    return 0;
  }

  static async getProvenRating(weapon) {
    return this._getNumericQualityValue(weapon, 'proven');
  }

  static async isLightningClaw(weapon) {
    return await this.hasQuality(weapon, 'lightning-claw');
  }

  static async hasLightningClawPair(actor) {
    const equippedClaws = [];
    for (const item of actor.items) {
      if (item.type === 'weapon' && item.system.equipped && await this.isLightningClaw(item)) {
        equippedClaws.push(item);
      }
    }
    return equippedClaws.length >= 2;
  }

  static async isMelta(weapon) {
    return await this.hasQuality(weapon, 'melta');
  }

  static async isStalkerPattern(weapon) {
    return await this.hasQuality(weapon, 'stalker-pattern');
  }

  /**
   * Get the Blast value for a weapon.
   * Blast(X) affects hit calculation and area of effect.
   * @param {Object} weapon - The weapon item
   * @returns {Promise<number>} Blast value (e.g., 5 for Blast(5))
   */
  static async getBlastValue(weapon) {
    if (weapon.system.effectiveBlast) return weapon.system.effectiveBlast;
    return this._getNumericQualityValue(weapon, 'blast');
  }

  /**
   * Get the Devastating value for a weapon.
   * Devastating(X) reduces horde magnitude by X per penetrating hit.
   * @param {Object} weapon - The weapon item
   * @returns {Promise<number>} Devastating value (e.g., 2 for Devastating(2))
   */
  static async getDevastatingValue(weapon) {
    return this._getNumericQualityValue(weapon, 'devastating');
  }

  /**
   * Extract the Crippling value from attached qualities array.
   * Used for psychic powers that apply weapon qualities.
   * @param {Array<Object>} attachedQualities - Array of quality objects with key and value
   * @returns {number|null} Crippling value or null if not found
   */
  static getCripplingValue(attachedQualities) {
    const quality = attachedQualities?.find(q => q.key === 'crippling');
    return quality?.value || null;
  }

  /**
   * Extract the Snare value from attached qualities array.
   * Used for psychic powers that apply weapon qualities.
   * @param {Array<Object>} attachedQualities - Array of quality objects with key and value
   * @returns {number|null} Snare value or null if not found
   */
  static getSnareValue(attachedQualities) {
    const quality = attachedQualities?.find(q => q.key === 'snared');
    return quality?.value || null;
  }

  /**
   * Extract the Felling value from attached qualities array.
   * Used for psychic powers that apply weapon qualities.
   * @param {Array<Object>} attachedQualities - Array of quality objects with key and value
   * @returns {number|null} Felling value or null if not found
   */
  static getFellingValue(attachedQualities) {
    const quality = attachedQualities?.find(q => q.key === 'felling');
    return quality?.value || null;
  }
}
