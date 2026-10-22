import DeathwatchItemBase from './base-item.mjs';

const fields = foundry.data.fields;

export default class DeathwatchTalent extends DeathwatchItemBase {
  static defineSchema() {
    const schema = super.defineSchema();
    schema.prerequisite = new fields.StringField({ initial: "", blank: true });
    schema.benefit = new fields.StringField({ initial: "", blank: true });
    schema.cost = new fields.NumberField({ initial: -1, integer: true });
    schema.rankRequired = new fields.NumberField({
      initial: 1,
      min: 1,
      max: 8,
      integer: true,
      label: "Minimum Rank Required"
    });
    schema.stackable = new fields.BooleanField({ initial: false });
    schema.subsequentCost = new fields.NumberField({ initial: 0, min: 0, integer: true });
    schema.compendiumId = new fields.StringField({ initial: "", blank: true });
    return schema;
  }

  prepareDerivedData() {
    if (!this.compendiumId && this.parent?._id?.startsWith('tal')) {
      this.compendiumId = this.parent._id;
    }

    const actor = this.parent?.actor;
    if (!actor) {
      this.effectiveCost = this.cost ?? 0;
      this.effectiveRankRequired = this.rankRequired ?? 1;
      return;
    }

    const currentRank = actor.system.rank || 1;
    let cost = this.cost ?? 0;
    let rankRequired = this.rankRequired ?? 1;

    // Apply specialty overrides (highest priority)
    const specialtyId = actor.system.specialtyId;
    if (specialtyId) {
      const specialty = actor.items.get(specialtyId);
      if (specialty?.system?.rankCosts) {
        const compendiumId = this.compendiumId || this.parent._id;

        // Accumulate overrides from rank 1 up to current rank
        for (let rank = 1; rank <= currentRank; rank++) {
          const rankData = specialty.system.rankCosts[rank.toString()]?.talents?.[compendiumId];
          if (rankData) {
            if (rankData.cost !== undefined) cost = rankData.cost;
            if (rankData.rankRequired !== undefined) rankRequired = rankData.rankRequired;
          }
        }
      }
    }

    // Apply chapter overrides (medium priority)
    const chapterId = actor.system.chapterId;
    if (chapterId) {
      const chapter = actor.items.get(chapterId);
      if (chapter?.system?.talentCosts) {
        const compendiumId = this.compendiumId || this.parent._id;
        const chapterOverride = chapter.system.talentCosts[compendiumId];

        if (chapterOverride) {
          if (typeof chapterOverride === 'number') {
            // Legacy format: just cost
            cost = chapterOverride;
          } else if (typeof chapterOverride === 'object') {
            // New format: { cost, rankRequired }
            if (chapterOverride.cost !== undefined) cost = chapterOverride.cost;
            if (chapterOverride.rankRequired !== undefined) rankRequired = chapterOverride.rankRequired;
          }
        }
      }
    }

    // Store effective values
    this.effectiveRankRequired = rankRequired;
    this.effectiveCost = currentRank >= rankRequired ? cost : -1;
  }
}
