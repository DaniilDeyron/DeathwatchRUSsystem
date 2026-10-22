import { ErrorHandler } from '../../../helpers/error-handler.mjs';

/**
 * Handles miscellaneous sheet-specific events that don't fit into other categories.
 * Includes status effects, collapsible sections, input focus behavior, etc.
 */
export class SheetHandlers {
  /**
   * Attach sheet-specific handlers to HTML.
   * @param {jQuery} html - Sheet HTML element
   * @param {Actor} actor - Actor document
   */
  static attach(html, actor) {
    this._attachInputFocusHandlers(html);
    this._attachStatusEffectHandlers(html, actor);
    this._attachCollapsibleSectionHandlers(html, actor);
  }

  /**
   * Attach input focus handlers - select all text on focus.
   * @param {jQuery} html - Sheet HTML element
   * @private
   */
  static _attachInputFocusHandlers(html) {
    html.find('input[type="text"], input[type="number"]').focus(function() {
      $(this).select();
    });
  }

  /**
   * Attach status effect toggle handlers.
   * @param {jQuery} html - Sheet HTML element
   * @param {Actor} actor - Actor document
   * @private
   */
  static _attachStatusEffectHandlers(html, actor) {
    html.find('.effect-toggle').change(ErrorHandler.wrap(async (ev) => {
      const effectId = $(ev.currentTarget).data('effectId');
      if (!effectId) throw new Error('Effect ID not provided');
      const enabled = ev.currentTarget.checked;
      await actor.setCondition(effectId, enabled);
    }, 'Toggle Status Effect'));
  }

  /**
   * Attach collapsible gear section handlers.
   * @param {jQuery} html - Sheet HTML element
   * @param {Actor} actor - Actor document
   * @private
   */
  static _attachCollapsibleSectionHandlers(html, actor) {
    // Initialize collapsed state from actor flags
    const collapsedSections = actor.getFlag('deathwatch', 'collapsedGearSections') || {};
    html.find('.gear-section').each((i, el) => {
      const section = el.dataset.section;
      if (collapsedSections[section]) el.classList.add('collapsed');
    });

    // Attach toggle handler
    html.find('.section-toggle').click(ErrorHandler.wrap(async (ev) => {
      const section = $(ev.currentTarget).closest('.gear-section');
      const sectionKey = section.data('section');
      if (!sectionKey) throw new Error('Section key not found');
      section.toggleClass('collapsed');
      const current = actor.getFlag('deathwatch', 'collapsedGearSections') || {};
      current[sectionKey] = section.hasClass('collapsed');
      await actor.setFlag('deathwatch', 'collapsedGearSections', current);
    }, 'Toggle Section'));
  }
}
