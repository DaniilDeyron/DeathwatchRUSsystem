import DeathwatchItemBase from './base-item.mjs';

const { fields } = foundry.data;

/**
 * DataModel for implant items.
 * @extends {DeathwatchItemBase}
 */
export default class DeathwatchImplant extends DeathwatchItemBase {
  static defineSchema() {
    const schema = super.defineSchema();
    foundry.utils.mergeObject(schema, {
      ...DeathwatchItemBase.equippedTemplate(),
      ...DeathwatchItemBase.requisitionTemplate()
    });
    schema.summary = new fields.StringField({ initial: "", blank: true });
    return schema;
  }
}
