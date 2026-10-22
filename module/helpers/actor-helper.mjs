import { Logger } from "./logger.mjs";

/**
 * Helper utilities for actor-related operations.
 * Consolidates common actor validation, lookup, and manipulation patterns.
 */
export class ActorHelper {

  /**
   * Validate that an actor exists and return it.
   * Logs error and shows UI notification if actor not found.
   *
   * @param {string} actorId - Actor ID to validate
   * @param {string} logCategory - Logger category for error messages
   * @returns {Actor|null} Actor instance or null if not found
   *
   * @example
   * const actor = ActorHelper.validateActor(actorId, 'COMBAT.RANGED');
   * if (!actor) return;
   */
  static validateActor(actorId, logCategory) {
    const actor = game.actors.get(actorId);
    if (!actor) {
      Logger.category(logCategory).error(`Actor not found: ${actorId}`);
      ui.notifications.error(`Actor not found: ${actorId}`);
      return null;
    }
    return actor;
  }

  // Future actor-centric utilities will be added here:
  // - getActiveToken(actor)
  // - getOwnedItems(actor, type)
  // - hasPermission(actor, user, level)
  // - etc.
}
