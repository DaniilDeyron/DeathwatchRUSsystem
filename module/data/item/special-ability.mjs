import DeathwatchItemBase from './base-item.mjs';

const { fields } = foundry.data;

/**
 * DataModel for special ability items.
 * @extends {DeathwatchItemBase}
 */
export default class DeathwatchSpecialAbility extends DeathwatchItemBase {
  static defineSchema() {
    const schema = super.defineSchema();
    foundry.utils.mergeObject(schema, {
      ...DeathwatchItemBase.keyTemplate()
    });
    schema.specialty = new fields.StringField({ initial: "", blank: true });
    schema.modeRequirement = new fields.StringField({ initial: "", blank: true });
    schema.requiredRank = new fields.NumberField({ initial: 0, min: 0, integer: true });
    schema.chapter = new fields.StringField({ initial: "", blank: true });
    schema.abilityCategory = new fields.StringField({ initial: "", blank: true });
    schema.effect = new fields.StringField({ initial: "", blank: true });
    schema.improvements = new fields.ArrayField(new fields.ObjectField(), { initial: [] });
    schema.abilityType = new fields.StringField({ initial: "", blank: true });
    schema.cohesionCost = new fields.NumberField({ initial: 0, min: 0, integer: true });
    schema.sustained = new fields.BooleanField({ initial: false });
    schema.action = new fields.StringField({ initial: "", blank: true });
    schema.chapterImg = new fields.StringField({ initial: "", blank: true });
    schema.specialtyImg = new fields.StringField({ initial: "", blank: true });
    return schema;
  }
}
