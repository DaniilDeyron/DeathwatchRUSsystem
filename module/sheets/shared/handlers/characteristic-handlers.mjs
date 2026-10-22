import { RollExecutor } from '../../../helpers/roll-executor.mjs';

/**
 * Handles characteristic roll events for actor sheets.
 */
export class CharacteristicHandlers {
  /**
   * Attach characteristic roll handlers to sheet HTML.
   * @param {jQuery} html - Sheet HTML element
   * @param {Actor} actor - Actor document
   */
  static attach(html, actor) {
    // Characteristic rolls are handled by the generic rollable handler
    // This is just a stub for future expansion if we need characteristic-specific handlers
  }

  /**
   * Handle characteristic roll with modifier dialog.
   * @param {Object} dataset - Dataset from clicked element
   * @param {Actor} actor - Actor document
   * @returns {Promise<void>}
   */
  static async handleRoll(dataset, actor) {
    const characteristic = actor.system.characteristics[dataset.characteristic];
    return RollExecutor.showCharacteristicDialog(actor, dataset.characteristic, dataset.label, characteristic);
  }
}
