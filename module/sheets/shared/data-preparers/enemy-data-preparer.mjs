import { WoundHelper } from '../../../helpers/character/wound-helper.mjs';
import { SkillHelper } from '../../../helpers/character/skill-helper.mjs';

/**
 * Prepares Enemy/Horde-specific data for enemy sheets.
 * Same as NPCDataPreparer but with psyRating visibility check.
 */
export class EnemyDataPreparer {
  /**
   * Prepare all Enemy/Horde data for sheet display.
   * @param {Object} context - Sheet context
   * @param {Actor} actor - Actor document
   */
  static prepare(context, actor) {
    this.prepareCharacteristics(context);
    this.prepareSkills(context, actor);
    this.prepareConfig(context);
    this.prepareWounds(context);
    this.preparePsyRating(context);
  }

  /**
   * Prepare characteristic labels.
   * @param {Object} context - Sheet context
   */
  static prepareCharacteristics(context) {
    for (let [k, v] of Object.entries(context.system.characteristics)) {
      v.label = game.i18n.localize(game.deathwatch.config.CharacteristicWords[k]) ?? k;
    }
  }

  /**
   * Prepare skills with totals and sorting.
   * @param {Object} context - Sheet context
   * @param {Actor} actor - Actor document
   */
  static prepareSkills(context, actor) {
    if (!context.system.skills) return;

    // Sort skills alphabetically
    const sortedSkills = Object.entries(context.system.skills)
      .sort(([keyA], [keyB]) => {
        const labelA = game.i18n.localize(game.deathwatch.config.Skills[keyA] || keyA);
        const labelB = game.i18n.localize(game.deathwatch.config.Skills[keyB] || keyB);
        return labelA.localeCompare(labelB);
      });

    // Process each skill
    for (const [k, v] of sortedSkills) {
      v.label = game.i18n.localize(game.deathwatch.config.Skills[k]) ?? k;

      // Calculate skill total from live data (includes modifierTotal)
      const liveSkill = actor.system.skills[k];
      const baseSkillTotal = SkillHelper.calculateSkillTotal(v, context.system.characteristics);
      const skillModTotal = liveSkill?.modifierTotal || 0;
      v.total = baseSkillTotal + skillModTotal;
    }
  }

  /**
   * Add config to context for template access.
   * @param {Object} context - Sheet context
   */
  static prepareConfig(context) {
    context.config = game.deathwatch.config;
  }

  /**
   * Prepare wound color class.
   * @param {Object} context - Sheet context
   */
  static prepareWounds(context) {
    const wounds = context.system.wounds;
    context.woundColorClass = WoundHelper.getWoundColorClass(wounds?.value, wounds?.max);
  }

  /**
   * Determine if Psy Rating box should be shown.
   * Show Psy Rating box if psyRating base > 0 or any psy-rating modifiers exist.
   * @param {Object} context - Sheet context
   */
  static preparePsyRating(context) {
    context.showPsyRating = (context.system.psyRating?.base > 0) || (context.system.psyRating?.value > 0);
  }
}
