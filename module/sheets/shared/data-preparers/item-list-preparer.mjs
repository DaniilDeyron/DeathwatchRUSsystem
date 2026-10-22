import { ItemHandlers } from '../../../helpers/ui/item-handlers.mjs';

/**
 * Prepares and categorizes all actor items for sheet display.
 * Handles item categorization and talent cost overrides.
 */
export class ItemListPreparer {
  /**
   * Prepare and categorize all actor items.
   * @param {Object} context - Sheet context
   * @param {Actor} actor - Actor document
   */
  static prepare(context, actor) {
    // Convert items to objects with live system data (unless already provided in context for testing)
    if (!context.items && actor?.items?.map) {
      context.items = actor.items.map(i => ({
        ...i.toObject(false),
        system: { ...i.system }
      }));
    }

    // Categorize items using ItemHandlers
    const categories = ItemHandlers.processItems(context.items || []);
    Object.assign(context, categories);

    // Apply talent cost overrides
    this._applyTalentCostOverrides(context);
  }

  /**
   * Apply chapter and specialty talent cost overrides to talents.
   * @param {Object} context - Sheet context
   * @private
   */
  static _applyTalentCostOverrides(context) {
    if (!context.talents || context.talents.length === 0) return;

    const chapterTalentCosts = context.chapterTalentCosts || {};
    const specialtyBaseTalentCosts = context.specialtyBaseTalentCosts || {};
    const specialtyTalentCosts = context.specialtyTalentCosts || {};

    // Count instances of each talent by compendiumId
    const talentCounts = {};

    for (const talent of context.talents) {
      let effectiveCost = talent.system.cost;

      // Get talent ID for matching (prefer compendiumId for dragged talents)
      const talentId = talent.system.compendiumId || talent._id;

      // Track instance count for this talent
      if (!talentCounts[talentId]) {
        talentCounts[talentId] = { count: 0, stackable: talent.system.stackable };
      }
      talentCounts[talentId].count++;
      const instanceCount = talentCounts[talentId].count;

      // Apply chapter override
      if (chapterTalentCosts[talentId] !== undefined) {
        effectiveCost = chapterTalentCosts[talentId];
      }

      // Apply specialty base talent cost override (takes precedence over chapter)
      if (specialtyBaseTalentCosts[talentId] !== undefined) {
        effectiveCost = specialtyBaseTalentCosts[talentId];
      }

      // Apply specialty rank override (takes precedence)
      const specialtyOverrides = specialtyTalentCosts[talentId];
      if (Array.isArray(specialtyOverrides) && specialtyOverrides.length > 0) {
        if (talentCounts[talentId].stackable) {
          // For stackable talents, use the array index for this instance (if available)
          if (specialtyOverrides.length >= instanceCount) {
            effectiveCost = specialtyOverrides[instanceCount - 1];
          }
          // If no override for this instance, use subsequentCost or base cost
          else if (instanceCount > 1 && talent.system.subsequentCost) {
            effectiveCost = talent.system.subsequentCost;
          }
        } else {
          // For non-stackable talents, use the last (most recent rank) override
          effectiveCost = specialtyOverrides[specialtyOverrides.length - 1];
        }
      }

      talent.system.effectiveCost = effectiveCost;
    }
  }
}
