import DeathwatchItemBase from './base-item.mjs';

const { fields } = foundry.data;

/**
 * DataModel for weapon quality items.
 * @extends {DeathwatchItemBase}
 */
export default class DeathwatchWeaponQuality extends DeathwatchItemBase {
  static defineSchema() {
    const schema = super.defineSchema();
    foundry.utils.mergeObject(schema, {
      ...DeathwatchItemBase.keyTemplate()
    });
    schema.value = new fields.StringField({ initial: "", blank: true });
    return schema;
  }
}
