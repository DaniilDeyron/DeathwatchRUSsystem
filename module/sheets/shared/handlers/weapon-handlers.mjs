import { ErrorHandler } from '../../../helpers/error-handler.mjs';
import { Validation } from '../../../helpers/validation.mjs';
import { CombatRouter } from '../../../helpers/combat/combat-router.mjs';

/**
 * Handles weapon-specific actions (attack, damage roll, clear jam).
 */
export class WeaponHandlers {
  /**
   * Attach weapon action handlers to sheet HTML.
   * @param {jQuery} html - Sheet HTML element
   * @param {Actor} actor - Actor document
   * @param {Object} sheet - Sheet instance (for binding _onWeaponAttack)
   */
  static attach(html, actor, sheet) {
    this._attachWeaponImageClickHandler(html, sheet);
    this._attachWeaponButtonHandlers(html, actor);
  }

  /**
   * Attach weapon image click handler for attacks.
   * @param {jQuery} html - Sheet HTML element
   * @param {Object} sheet - Sheet instance (for binding _onWeaponAttack)
   * @private
   */
  static _attachWeaponImageClickHandler(html, sheet) {
    html.find('.item-image.rollable').click(sheet._onWeaponAttack.bind(sheet));
  }

  /**
   * Attach weapon action button handlers (attack, damage, unjam).
   * @param {jQuery} html - Sheet HTML element
   * @param {Actor} actor - Actor document
   * @private
   */
  static _attachWeaponButtonHandlers(html, actor) {
    // Weapon attack
    html.find('.weapon-attack-btn').click(ErrorHandler.wrap(async (ev) => {
      const itemId = $(ev.currentTarget).data('itemId');
      const weapon = Validation.requireDocument(actor.items.get(itemId), 'Weapon', 'Attack');
      await CombatRouter.executeAttack(actor, weapon);
    }, 'Weapon Attack'));

    // Weapon damage roll
    html.find('.weapon-damage-btn').click(ErrorHandler.wrap(async (ev) => {
      const itemId = $(ev.currentTarget).data('itemId');
      const weapon = Validation.requireDocument(actor.items.get(itemId), 'Weapon', 'Roll Damage');
      await CombatRouter.executeDamage(actor, weapon);
    }, 'Weapon Damage'));

    // Clear weapon jam
    html.find('.weapon-unjam-btn').click(ErrorHandler.wrap(async (ev) => {
      const itemId = $(ev.currentTarget).data('itemId');
      const weapon = Validation.requireDocument(actor.items.get(itemId), 'Weapon', 'Clear Jam');
      await game.deathwatch.CombatHelper.clearJam(actor, weapon);
    }, 'Clear Jam'));
  }
}
