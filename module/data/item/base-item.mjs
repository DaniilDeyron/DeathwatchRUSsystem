import DeathwatchDataModel from '../base-document.mjs';

const { fields } = foundry.data;

/**
 * Base DataModel for all Deathwatch item types.
 * Provides description, book, page, and modifiers to every item automatically.
 * @extends {DeathwatchDataModel}
 */
export default class DeathwatchItemBase extends DeathwatchDataModel {
  static defineSchema() {
    const schema = super.defineSchema();
    schema.description = new fields.HTMLField({ initial: "", blank: true });
    schema.book = new fields.StringField({ initial: "", blank: true });
    schema.page = new fields.StringField({ initial: "", blank: true });
    schema.modifiers = new fields.ArrayField(
      new fields.ObjectField(),
      { initial: [] }
    );
    return schema;
  }
}
