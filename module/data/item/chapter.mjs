import DeathwatchItemBase from './base-item.mjs';
import { INSANITY_TRACK } from '../../helpers/constants/index.mjs';

const { fields } = foundry.data;

/**
 * DataModel for chapter items.
 * @extends {DeathwatchItemBase}
 */
export default class DeathwatchChapter extends DeathwatchItemBase {
  static defineSchema() {
    const schema = super.defineSchema();
    foundry.utils.mergeObject(schema, {
      ...DeathwatchItemBase.keyTemplate()
    });

    schema.skillCosts = new fields.ObjectField({ initial: {} });
    schema.talentCosts = new fields.ObjectField({ initial: {} });

    // ═══════════════════════════════════════════════════════════
    // PRIMARCH'S CURSE
    // ═══════════════════════════════════════════════════════════

    // Overall curse information
    schema.curseName = new fields.StringField({
      initial: "",
      blank: true,
      label: "Primarch's Curse Name"
    });

    schema.curseDescription = new fields.HTMLField({
      initial: "",
      blank: true,
      label: "Curse Overview"
    });

    // Level 1 (31-60 IP)
    schema.curseLevel1Name = new fields.StringField({
      initial: "",
      blank: true,
      label: "Level 1 Name"
    });

    schema.curseLevel1Description = new fields.HTMLField({
      initial: "",
      blank: true,
      label: "Level 1 Description"
    });

    schema.curseLevel1Effect = new fields.StringField({
      initial: "none",
      choices: {
        none: "No Mechanical Effect",
        modifier: "Stat/Skill Modifier",
        fellowshipPenalty: "Fellowship Penalty vs Target",
        cohesionPenalty: "Cohesion Penalty",
        custom: "Custom Effect (see description)"
      },
      label: "Level 1 Effect Type"
    });

    schema.curseLevel1Modifier = new fields.NumberField({
      initial: 0,
      integer: true,
      label: "Level 1 Modifier"
    });

    schema.curseLevel1Target = new fields.StringField({
      initial: "",
      blank: true,
      label: "Level 1 Modifier Target"
    });

    // Level 2 (61-90 IP)
    schema.curseLevel2Name = new fields.StringField({
      initial: "",
      blank: true,
      label: "Level 2 Name"
    });

    schema.curseLevel2Description = new fields.HTMLField({
      initial: "",
      blank: true,
      label: "Level 2 Description"
    });

    schema.curseLevel2Effect = new fields.StringField({
      initial: "none",
      choices: {
        none: "No Mechanical Effect",
        modifier: "Stat/Skill Modifier",
        fellowshipPenalty: "Fellowship Penalty vs Target",
        cohesionPenalty: "Cohesion Penalty",
        custom: "Custom Effect (see description)"
      },
      label: "Level 2 Effect Type"
    });

    schema.curseLevel2Modifier = new fields.NumberField({
      initial: 0,
      integer: true,
      label: "Level 2 Modifier"
    });

    schema.curseLevel2Target = new fields.StringField({
      initial: "",
      blank: true,
      label: "Level 2 Modifier Target"
    });

    schema.curseLevel2CohesionPenalty = new fields.NumberField({
      initial: 0,
      min: 0,
      integer: true,
      label: "Level 2 Cohesion Penalty"
    });

    // Level 3 (91-99 IP)
    schema.curseLevel3Name = new fields.StringField({
      initial: "",
      blank: true,
      label: "Level 3 Name"
    });

    schema.curseLevel3Description = new fields.HTMLField({
      initial: "",
      blank: true,
      label: "Level 3 Description"
    });

    schema.curseLevel3Effect = new fields.StringField({
      initial: "none",
      choices: {
        none: "No Mechanical Effect",
        modifier: "Stat/Skill Modifier",
        behavioralRequirement: "Behavioral Requirement",
        cohesionPenalty: "Cohesion Penalty",
        custom: "Custom Effect (see description)"
      },
      label: "Level 3 Effect Type"
    });

    schema.curseLevel3Modifier = new fields.NumberField({
      initial: 0,
      integer: true,
      label: "Level 3 Modifier"
    });

    schema.curseLevel3Target = new fields.StringField({
      initial: "",
      blank: true,
      label: "Level 3 Modifier Target"
    });

    schema.curseLevel3CohesionPenalty = new fields.NumberField({
      initial: 0,
      min: 0,
      integer: true,
      label: "Level 3 Cohesion Penalty"
    });

    return schema;
  }

  /**
   * Get the active curse level data for a given insanity point value.
   *
   * @param {number} insanityPoints - Current insanity points
   * @returns {Object|null} Active level data or null if curse not active
   */
  getActiveCurseLevel(insanityPoints) {
    if (!this.hasCurse()) return null;

    const level = this._getCurseLevel(insanityPoints);

    if (level === 0) return null;

    return {
      level,
      name: this[`curseLevel${level}Name`],
      description: this[`curseLevel${level}Description`],
      effectType: this[`curseLevel${level}Effect`],
      modifier: this[`curseLevel${level}Modifier`],
      target: this[`curseLevel${level}Target`],
      cohesionPenalty: this[`curseLevel${level}CohesionPenalty`] || 0
    };
  }

  /**
   * Check if this chapter has a Primarch's Curse defined.
   *
   * @returns {boolean}
   */
  hasCurse() {
    return !!this.curseName;
  }

  /**
   * Get curse level for given insanity points.
   *
   * @param {number} insanityPoints - Current insanity points
   * @returns {number} Curse level (0-3)
   * @private
   */
  _getCurseLevel(insanityPoints) {
    if (insanityPoints <= INSANITY_TRACK.THRESHOLD_1) return 0;
    if (insanityPoints <= INSANITY_TRACK.THRESHOLD_2) return 1;
    if (insanityPoints <= INSANITY_TRACK.THRESHOLD_3) return 2;
    if (insanityPoints < INSANITY_TRACK.REMOVAL) return 3;
    return 0; // Removed from play
  }
}
