import DeathwatchItemBase from './base-item.mjs';

const { fields } = foundry.data;

/**
 * DataModel for critical effect items.
 * @extends {DeathwatchItemBase}
 */
export default class DeathwatchCriticalEffect extends DeathwatchItemBase {
  static defineSchema() {
    const schema = super.defineSchema();
    schema.location = new fields.StringField({ initial: "", blank: true });
    schema.damageType = new fields.StringField({ initial: "", blank: true });
    schema.effects = new fields.ArrayField(
      new fields.ObjectField(),
      { initial: [] }
    );
    return schema;
  }
}
