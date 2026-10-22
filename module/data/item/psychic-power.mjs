import DeathwatchItemBase from './base-item.mjs';

const { fields } = foundry.data;

/**
 * DataModel for psychic power items.
 * @extends {DeathwatchItemBase}
 */
export default class DeathwatchPsychicPower extends DeathwatchItemBase {
  static defineSchema() {
    const schema = super.defineSchema();
    foundry.utils.mergeObject(schema, {
      ...DeathwatchItemBase.keyTemplate()
    });
    schema.action = new fields.StringField({ initial: "", blank: true });
    schema.opposed = new fields.StringField({ initial: "", blank: true });
    schema.range = new fields.StringField({ initial: "", blank: true });
    schema.sustained = new fields.StringField({ initial: "", blank: true });
    schema.cost = new fields.NumberField({ initial: 0, min: 0, integer: true });
    schema.class = new fields.StringField({ initial: "", blank: true });
    schema.chapterImg = new fields.StringField({ initial: "", blank: true });
    schema.damageFormula = new fields.StringField({ initial: "", blank: true });
    schema.penetrationFormula = new fields.StringField({ initial: "", blank: true });
    schema.damageType = new fields.StringField({ initial: "", blank: true });
    schema.attachedQualities = new fields.ArrayField(new fields.ObjectField(), { initial: [] });
    return schema;
  }
}
