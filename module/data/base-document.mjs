const { fields } = foundry.data;

/**
 * Base DataModel for all Deathwatch system data.
 * Provides shared template methods for common field groups.
 * @extends {foundry.abstract.TypeDataModel}
 */
export default class DeathwatchDataModel extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {};
  }

  /**
   * Equipped toggle for wearable/usable items.
   * Used by: weapon, armor, gear, implant, cybernetic
   */
  static equippedTemplate() {
    return {
      equipped: new fields.BooleanField({ initial: false })
    };
  }

  /**
   * Requisition and renown requirements.
   * Used by: weapon, armor, gear, ammunition, implant, cybernetic, weapon-upgrade
   */
  static requisitionTemplate() {
    return {
      req: new fields.NumberField({ initial: 0, min: 0, integer: true }),
      renown: new fields.StringField({ initial: "", blank: true })
    };
  }

  /**
   * Capacity fields (current/max) for ammo and weapons.
   * Used by: weapon, ammunition
   */
  static capacityTemplate() {
    return {
      capacity: new fields.SchemaField({
        value: new fields.NumberField({ initial: 0, min: 0, integer: true }),
        max: new fields.NumberField({ initial: 0, min: 0, integer: true })
      })
    };
  }

  /**
   * Key field for lookup-based items.
   * Used by: weapon-quality, weapon-upgrade, psychic-power, special-ability
   */
  static keyTemplate() {
    return {
      key: new fields.StringField({ initial: "", blank: true })
    };
  }
}
