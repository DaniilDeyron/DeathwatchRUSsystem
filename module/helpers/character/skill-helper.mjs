/**
 * Helper functions for skill calculations.
 */
export class SkillHelper {
  /**
   * Calculate skill total for display.
   * @param {Object} skill - The skill object
   * @param {Object} characteristics - The actor's characteristics
   * @returns {number} The calculated skill total
   */
  static calculateSkillTotal(skill, characteristics) {
    const characteristic = characteristics[skill.characteristic];
    const baseCharValue = characteristic ? characteristic.value : 0;
    const effectiveChar = skill.trained ? baseCharValue : Math.floor(baseCharValue / 2);
    const skillBonus = skill.expert ? 20 : (skill.mastered ? 10 : 0);

    return effectiveChar + skillBonus + skill.modifier;
  }
}
