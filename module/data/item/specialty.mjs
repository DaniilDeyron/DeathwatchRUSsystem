import DeathwatchItemBase from './base-item.mjs';

const { fields } = foundry.data;

/**
 * DataModel for specialty items.
 * @extends {DeathwatchItemBase}
 */
export default class DeathwatchSpecialty extends DeathwatchItemBase {
  static defineSchema() {
    const schema = super.defineSchema();
    schema.hasPsyRating = new fields.BooleanField({ initial: false });
    schema.talentCosts = new fields.ObjectField({ initial: {} });
    schema.skillCosts = new fields.ObjectField({ initial: {} });
    schema.characteristicCosts = new fields.ObjectField({ initial: {
      ws: { simple: 0, intermediate: 0, trained: 0, expert: 0 },
      bs: { simple: 0, intermediate: 0, trained: 0, expert: 0 },
      str: { simple: 0, intermediate: 0, trained: 0, expert: 0 },
      tg: { simple: 0, intermediate: 0, trained: 0, expert: 0 },
      ag: { simple: 0, intermediate: 0, trained: 0, expert: 0 },
      int: { simple: 0, intermediate: 0, trained: 0, expert: 0 },
      per: { simple: 0, intermediate: 0, trained: 0, expert: 0 },
      wil: { simple: 0, intermediate: 0, trained: 0, expert: 0 },
      fs: { simple: 0, intermediate: 0, trained: 0, expert: 0 }
    }});
    schema.rankCosts = new fields.ObjectField({ initial: {
      "1": { skills: {}, talents: {} },
      "2": { skills: {}, talents: {} },
      "3": { skills: {}, talents: {} },
      "4": { skills: {}, talents: {} },
      "5": { skills: {}, talents: {} },
      "6": { skills: {}, talents: {} },
      "7": { skills: {}, talents: {} },
      "8": { skills: {}, talents: {} }
    }});
    return schema;
  }
}
