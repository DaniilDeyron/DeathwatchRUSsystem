import { Logger } from '../helpers/logger.mjs';

const logger = Logger.category('CANVAS.REGION');

/**
 * Register hook for region cleanup on combat turn change.
 */
export function registerTemplateCleanupHook() {
  Hooks.on('updateCombat', async (combat, changed, options, userId) => {
    try {
      // Only clean up when turn or round changes
      if (!('turn' in changed || 'round' in changed)) {
        return;
      }

      // Only clean up if there's a previous turn
      if (!combat.previous) {
        return;
      }

      // Safety check for canvas availability
      if (!canvas.scene) {
        logger.warn('Cannot clean regions: canvas.scene not available');
        return;
      }

      // Find regions from previous turn
      const regions = canvas.regions?.placeables || [];

      const regionsToDelete = regions.filter(region => {
        const flags = region.document.flags?.deathwatch;
        if (!flags || !flags.isAttackTemplate) {
          return false;
        }

        return (
          flags.createdByTurn === combat.previous.turn &&
          flags.createdInRound === combat.previous.round
        );
      });

      // Delete region documents
      const idsToDelete = regionsToDelete.map(r => r.document.id);
      if (idsToDelete.length > 0) {
        logger.debug(
          `Cleaning up ${idsToDelete.length} regions from turn ${combat.previous.turn}, round ${combat.previous.round}`
        );
        await canvas.scene.deleteEmbeddedDocuments('Region', idsToDelete);
      }
    } catch (error) {
      logger.error('Template cleanup failed:', error);
      ui.notifications.error('Template cleanup failed: ' + error.message);
    }
  });
}
