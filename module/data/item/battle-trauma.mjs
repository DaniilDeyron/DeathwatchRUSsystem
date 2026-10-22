import DeathwatchItemBase from './base-item.mjs';

const { fields } = foundry.data;

/**
 * DataModel for Battle Trauma items.
 *
 * Battle Traumas are permanent mental wounds gained from failed Insanity Tests.
 * They trigger under specific conditions and impose behavioral or mechanical effects.
 *
 * Source: Deathwatch Core Rulebook p. 217
 *
 * @extends {DeathwatchItemBase}
 */
export default class DeathwatchBattleTrauma extends DeathwatchItemBase {
  static defineSchema() {
    const schema = super.defineSchema();
    foundry.utils.mergeObject(schema, {
      ...DeathwatchItemBase.keyTemplate()
    });

    // Trigger condition - when does this trauma activate?
    schema.triggerType = new fields.StringField({
      initial: "always",
      choices: {
        always: "Always Active",
        combat: "During Combat",
        righteousFury: "On Righteous Fury",
        psychicPower: "When Using Psychic Powers",
        fellowship: "During Social Interaction",
        willpowerTest: "During Willpower Tests"
      },
      label: "Trigger Type"
    });

    // Mechanical effect type
    schema.effectType = new fields.StringField({
      initial: "modifier",
      choices: {
        modifier: "Stat/Skill Modifier",
        behavior: "Behavioral Requirement",
        cohesion: "Cohesion Penalty",
        custom: "Custom Effect (see description)"
      },
      label: "Effect Type"
    });

    // Modifier value (if effectType is "modifier")
    schema.modifier = new fields.NumberField({
      initial: 0,
      integer: true,
      label: "Modifier Value"
    });

    // What to modify (characteristic/skill/etc)
    schema.modifierTarget = new fields.StringField({
      initial: "",
      blank: true,
      label: "Modifier Target"
    });

    // Cohesion penalty (if effectType is "cohesion")
    schema.cohesionPenalty = new fields.NumberField({
      initial: 0,
      min: 0,
      integer: true,
      label: "Cohesion Penalty"
    });

    // Can resist with Willpower test?
    schema.canResist = new fields.BooleanField({
      initial: false,
      label: "Can Resist with Willpower Test"
    });

    // Resist difficulty
    schema.resistDifficulty = new fields.StringField({
      initial: "challenging",
      choices: {
        easy: "Easy (+30)",
        routine: "Routine (+20)",
        ordinary: "Ordinary (+10)",
        challenging: "Challenging (+0)",
        difficult: "Difficult (-10)",
        hard: "Hard (-20)",
        veryHard: "Very Hard (-30)"
      },
      label: "Resist Difficulty"
    });

    return schema;
  }

  /**
   * Prepare derived data for Battle Trauma.
   * Sets default icon if not specified.
   */
  prepareDerivedData() {
    // Set default icon if not already set
    if (!this.parent?.img || this.parent.img === "icons/svg/item-bag.svg") {
      this.img = "systems/deathwatch/assets/icons/battle-trauma.svg";
    }
  }

  /**
   * Get modifiers from this trauma (if applicable).
   *
   * @returns {Array} Array of modifier objects
   */
  getModifiers() {
    if (this.effectType !== "modifier") {
      return [];
    }

    if (!this.modifier || !this.modifierTarget) {
      return [];
    }

    return [{
      value: this.modifier,
      target: this.modifierTarget,
      source: this.parent?.name || "Battle Trauma",
      type: "battle-trauma"
    }];
  }
}
