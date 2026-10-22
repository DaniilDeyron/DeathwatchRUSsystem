import DeathwatchItemBase from './base-item.mjs';

const { fields } = foundry.data;

/**
 * DataModel for cybernetic items.
 * @extends {DeathwatchItemBase}
 */
export default class DeathwatchCybernetic extends DeathwatchItemBase {
  static defineSchema() {
    const schema = super.defineSchema();
    foundry.utils.mergeObject(schema, {
      ...DeathwatchItemBase.equippedTemplate(),
      ...DeathwatchItemBase.requisitionTemplate()
    });

    // Characteristic replacement (e.g., servo-arm with fixed Strength 75)
    schema.replacesCharacteristic = new fields.StringField({ initial: "", blank: true });
    schema.replacementValue = new fields.NumberField({ initial: 0, min: 0, integer: true });
    schema.unnaturalMultiplier = new fields.NumberField({ initial: 1, min: 1, integer: true });
    schema.replacementLabel = new fields.StringField({ initial: "", blank: true });
    schema.canBeModified = new fields.BooleanField({ initial: true });

    return schema;
  }
}
