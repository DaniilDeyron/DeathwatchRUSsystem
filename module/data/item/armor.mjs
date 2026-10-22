import DeathwatchItemBase from './base-item.mjs';

const { fields } = foundry.data;

/**
 * DataModel for armor items.
 * @extends {DeathwatchItemBase}
 */
export default class DeathwatchArmor extends DeathwatchItemBase {
  static defineSchema() {
    const schema = super.defineSchema();
    foundry.utils.mergeObject(schema, {
      ...DeathwatchItemBase.equippedTemplate(),
      ...DeathwatchItemBase.requisitionTemplate()
    });
    schema.body = new fields.NumberField({ initial: 0, min: 0, integer: true });
    schema.head = new fields.NumberField({ initial: 0, min: 0, integer: true });
    schema.left_arm = new fields.NumberField({ initial: 0, min: 0, integer: true });
    schema.right_arm = new fields.NumberField({ initial: 0, min: 0, integer: true });
    schema.left_leg = new fields.NumberField({ initial: 0, min: 0, integer: true });
    schema.right_leg = new fields.NumberField({ initial: 0, min: 0, integer: true });
    schema.effects = new fields.StringField({ initial: "", blank: true });
    schema.armorEffects = new fields.ArrayField(new fields.ObjectField(), { initial: [] });
    schema.attachedHistories = new fields.ArrayField(new fields.StringField(), { initial: [] });
    return schema;
  }
}
