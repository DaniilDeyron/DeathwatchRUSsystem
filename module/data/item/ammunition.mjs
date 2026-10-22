import DeathwatchItemBase from './base-item.mjs';

const { fields } = foundry.data;

/**
 * DataModel for ammunition items.
 * @extends {DeathwatchItemBase}
 */
export default class DeathwatchAmmunition extends DeathwatchItemBase {
  static defineSchema() {
    const schema = super.defineSchema();
    foundry.utils.mergeObject(schema, {
      ...DeathwatchItemBase.capacityTemplate(),
      ...DeathwatchItemBase.requisitionTemplate()
    });
    schema.quantity = new fields.NumberField({ initial: 1, min: 0, integer: true });
    return schema;
  }
}
