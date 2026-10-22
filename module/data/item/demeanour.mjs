import DeathwatchItemBase from './base-item.mjs';

const { fields } = foundry.data;

/**
 * DataModel for demeanour items.
 * @extends {DeathwatchItemBase}
 */
export default class DeathwatchDemeanour extends DeathwatchItemBase {
  static defineSchema() {
    const schema = super.defineSchema();
    schema.chapter = new fields.StringField({ initial: "", blank: true });
    return schema;
  }
}
