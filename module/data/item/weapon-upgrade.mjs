import DeathwatchItemBase from './base-item.mjs';

const { fields } = foundry.data;

/**
 * DataModel for weapon upgrade items.
 * @extends {DeathwatchItemBase}
 */
export default class DeathwatchWeaponUpgrade extends DeathwatchItemBase {
  static defineSchema() {
    const schema = super.defineSchema();
    foundry.utils.mergeObject(schema, {
      ...DeathwatchItemBase.keyTemplate(),
      ...DeathwatchItemBase.requisitionTemplate()
    });
    schema.singleShotOnly = new fields.BooleanField({ initial: false });
    return schema;
  }
}
