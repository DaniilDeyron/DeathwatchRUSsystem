import { ErrorHandler } from '../../../helpers/error-handler.mjs';
import { Validation } from '../../../helpers/validation.mjs';
import { onManageActiveEffect } from '../../../helpers/effects.mjs';
import { ModifierHelper } from '../../../helpers/character/modifiers.mjs';

/**
 * Handles item management operations (equip, create, delete) and related actions.
 * Requires the sheet to be editable (checked by caller).
 */
export class ItemManagementHandlers {
  /**
   * Attach item management handlers to sheet HTML.
   * All handlers in this class require the sheet to be editable.
   * @param {jQuery} html - Sheet HTML element
   * @param {Actor|Item} document - Actor or Item document
   * @param {Object} sheet - Sheet instance (for binding)
   */
  static attach(html, document, sheet) {
    this._attachItemEquipHandler(html, document);
    this._attachItemCRUDHandlers(html, document, sheet);
    this._attachAttachmentHandlers(html, document);
    this._attachEffectHandlers(html, document);
    this._attachModifierHandlers(html, document);
    this._attachChapterSpecialtyHandlers(html, document);
  }

  /**
   * Attach item equip toggle handler.
   * @param {jQuery} html - Sheet HTML element
   * @param {Actor} actor - Actor document
   * @private
   */
  static _attachItemEquipHandler(html, actor) {
    html.find('.item-equip').click(ErrorHandler.wrap(async (ev) => {
      ev.preventDefault();
      const li = $(ev.currentTarget).closest(".item");
      const itemId = li.data("itemId");
      const item = Validation.requireDocument(actor.items.get(itemId), 'Item', 'Toggle Equip');
      await item.update({ "system.equipped": !item.system.equipped });
    }, 'Toggle Equip'));
  }

  /**
   * Attach item create and delete handlers.
   * @param {jQuery} html - Sheet HTML element
   * @param {Actor} actor - Actor document
   * @param {Object} sheet - Sheet instance (for binding _onItemCreate)
   * @private
   */
  static _attachItemCRUDHandlers(html, actor, sheet) {
    // Create item
    html.find('.item-create').click(sheet._onItemCreate.bind(sheet));

    // Delete item
    html.find('.item-delete').click(ErrorHandler.wrap(async (ev) => {
      const li = $(ev.currentTarget).parents(".item");
      const itemId = li.data("itemId");
      const item = Validation.requireDocument(actor.items.get(itemId), 'Item', 'Delete');
      await item.delete();
      li.slideUp(200, () => sheet.render(false));
    }, 'Delete Item'));
  }

  /**
   * Attach handlers for removing attached items (armor history, ammo, weapon upgrades).
   * @param {jQuery} html - Sheet HTML element
   * @param {Actor} actor - Actor document
   * @private
   */
  static _attachAttachmentHandlers(html, actor) {
    // Remove armor history from armor
    html.find('.history-remove').click(ErrorHandler.wrap(async (ev) => {
      const historyId = $(ev.currentTarget).data('historyId');
      const armorId = $(ev.currentTarget).data('armorId');
      const armor = Validation.requireDocument(actor.items.get(armorId), 'Armor', 'Remove History');

      const currentHistories = armor.system.attachedHistories || [];
      const updatedHistories = currentHistories.filter(id => id !== historyId);

      await armor.update({ "system.attachedHistories": updatedHistories });
      ui.notifications.info('Armor history removed.');
    }, 'Remove Armor History'));

    // Remove ammunition from weapon
    html.find('.ammo-remove').click(ErrorHandler.wrap(async (ev) => {
      const ammoId = $(ev.currentTarget).data('ammoId');
      const weaponId = $(ev.currentTarget).data('weaponId');
      const weapon = Validation.requireDocument(actor.items.get(weaponId), 'Weapon', 'Remove Ammo');
      Validation.requireDocument(actor.items.get(ammoId), 'Ammunition', 'Remove Ammo');

      await weapon.update({ "system.loadedAmmo": null });
      ui.notifications.info('Ammunition removed.');
    }, 'Remove Ammunition'));

    // Edit ammunition from inline ammo display
    html.find('.ammo-edit-btn').click(ErrorHandler.wrap(async (ev) => {
      ev.stopPropagation();
      const itemId = $(ev.currentTarget).data('itemId');
      const item = Validation.requireDocument(actor.items.get(itemId), 'Ammunition', 'Edit');
      item.sheet.render(true);
    }, 'Edit Ammunition'));

    // Remove upgrade from weapon
    html.find('.upgrade-remove').click(ErrorHandler.wrap(async (ev) => {
      const upgradeId = $(ev.currentTarget).data('upgradeId');
      const weaponId = $(ev.currentTarget).data('weaponId');
      const weapon = Validation.requireDocument(actor.items.get(weaponId), 'Weapon', 'Remove Upgrade');

      const currentUpgrades = weapon.system.attachedUpgrades || [];
      const updatedUpgrades = currentUpgrades.filter(u => u.id !== upgradeId);

      await weapon.update({ "system.attachedUpgrades": updatedUpgrades });
      ui.notifications.info('Weapon upgrade removed.');
    }, 'Remove Weapon Upgrade'));
  }

  /**
   * Attach Active Effect management handlers.
   * @param {jQuery} html - Sheet HTML element
   * @param {Actor} actor - Actor document
   * @private
   */
  static _attachEffectHandlers(html, actor) {
    html.find(".effect-control").click(ev => onManageActiveEffect(ev, actor));
  }

  /**
   * Attach modifier management handlers.
   * @param {jQuery} html - Sheet HTML element
   * @param {Actor} actor - Actor document
   * @private
   */
  static _attachModifierHandlers(html, actor) {
    html.find('.modifier-create').click(ErrorHandler.wrap(async (ev) => {
      await ModifierHelper.createModifier(actor);
    }, 'Create Modifier'));

    html.find('.modifier-edit').click(ErrorHandler.wrap(async (ev) => {
      const modifierId = $(ev.currentTarget).closest('.modifier').data('modifierId');
      if (modifierId === undefined) throw new Error('Modifier ID not found');
      await ModifierHelper.editModifierDialog(actor, modifierId);
    }, 'Edit Modifier'));

    html.find('.modifier-delete').click(ErrorHandler.wrap(async (ev) => {
      const modifierId = $(ev.currentTarget).closest('.modifier').data('modifierId');
      if (modifierId === undefined) throw new Error('Modifier ID not found');
      await ModifierHelper.deleteModifier(actor, modifierId);
    }, 'Delete Modifier'));

    html.find('.modifier-toggle').click(ErrorHandler.wrap(async (ev) => {
      const modifierId = $(ev.currentTarget).closest('.modifier').data('modifierId');
      if (modifierId === undefined) throw new Error('Modifier ID not found');
      await ModifierHelper.toggleModifierEnabled(actor, modifierId);
    }, 'Toggle Modifier'));
  }

  /**
   * Attach chapter and specialty removal handlers.
   * @param {jQuery} html - Sheet HTML element
   * @param {Actor} actor - Actor document
   * @private
   */
  static _attachChapterSpecialtyHandlers(html, actor) {
    // Remove chapter
    html.find('.chapter-remove').click(ErrorHandler.wrap(async (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      const chapterId = actor.system.chapterId;
      if (chapterId) {
        const chapter = actor.items.get(chapterId);
        if (chapter) await chapter.delete();
      }
      await actor.update({ "system.chapterId": "" });
      ui.notifications.info('Chapter removed.');
    }, 'Remove Chapter'));

    // Remove specialty
    html.find('.specialty-remove').click(ErrorHandler.wrap(async (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      const specialtyId = actor.system.specialtyId;
      if (specialtyId) {
        const specialty = actor.items.get(specialtyId);
        if (specialty) await specialty.delete();
      }
      await actor.update({ "system.specialtyId": "" });
      ui.notifications.info('Specialty removed.');
    }, 'Remove Specialty'));
  }
}
