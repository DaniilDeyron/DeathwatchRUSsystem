import { Sanitizer } from '../../../helpers/sanitizer.mjs';

/**
 * Handles drag-and-drop events for actor sheets.
 * Manages dropping items on other items (ammo on weapons, histories on armor, etc.)
 * and dropping chapter/specialty items.
 */
export class DropHandlers {
  /**
   * Attach drop handlers to sheet HTML.
   * @param {jQuery} html - Sheet HTML element
   * @param {Actor} actor - Actor document
   */
  static attach(html, actor) {
    // Drop handler for armor histories/ammunition on items
    html.find('.inventory .items-list li.item').each((i, li) => {
      li.addEventListener('drop', (event) => this._onDropItemOnItem(event, actor), false);
      li.addEventListener('dragover', ev => ev.preventDefault(), false);
    });

    // Drop handler for chapter
    html.find('.chapter-drop-zone').each((i, el) => {
      el.addEventListener('drop', (event) => this._onDropChapter(event, actor), false);
      el.addEventListener('dragover', ev => ev.preventDefault(), false);
    });

    // Drop handler for specialty
    html.find('.specialty-drop-zone').each((i, el) => {
      el.addEventListener('drop', (event) => this._onDropSpecialty(event, actor), false);
      el.addEventListener('dragover', ev => ev.preventDefault(), false);
    });

    // Drop handler for actor-level drops (for gear stacking)
    html.find('.window-content').first().each((i, el) => {
      el.addEventListener('drop', async (event) => {
        const data = foundry.applications.ux.TextEditor.implementation.getDragEventData(event);
        if (data.type !== 'Item') return;

        const droppedItem = await Item.implementation.fromDropData(data);
        if (!droppedItem || droppedItem.type !== 'gear') return;

        const stacked = await this._onDropGearForStacking(event, actor, droppedItem);
        if (stacked) {
          event.preventDefault();
          event.stopPropagation();
          return false;
        }
      }, false);
    });
  }

  /**
   * Handle stacking logic for gear items.
   * @param {Event} event - The drop event
   * @param {Actor} actor - Actor document
   * @param {Item} droppedItem - The dropped gear item
   * @returns {Promise<boolean>} True if item was stacked, false if new item should be created
   * @private
   */
  static async _onDropGearForStacking(event, actor, droppedItem) {
    // Only auto-stack if item is stackable
    if (!droppedItem.system.stackable) {
      return false;
    }

    // Search for existing stackable gear with same name
    const existingItem = actor.items.find(i =>
      i.type === 'gear' &&
      i.name === droppedItem.name &&
      i.system.stackable === true
    );

    if (existingItem) {
      // Increment existing item quantity
      const newQuantity = (existingItem.system.quantity || 1) + (droppedItem.system.quantity || 1);
      await existingItem.update({ 'system.quantity': newQuantity });
      ui.notifications.info(`${droppedItem.name} quantity increased to ${newQuantity}.`);
      return true;
    }

    return false;
  }

  /**
   * Handle dropping an item on another item (e.g., armor history on armor, ammo on weapon).
   * @param {Event} event - The drop event
   * @param {Actor} actor - Actor document
   * @private
   */
  static async _onDropItemOnItem(event, actor) {
    event.preventDefault();

    const data = foundry.applications.ux.TextEditor.implementation.getDragEventData(event);
    if (data.type !== 'Item') return;

    const droppedItem = await Item.implementation.fromDropData(data);
    if (!droppedItem) return;

    // Handle armor history drops
    if (droppedItem.type === 'armor-history') {
      await this._handleArmorHistoryDrop(event, actor, droppedItem);
    }
    // Handle ammunition drops on weapons
    else if (droppedItem.type === 'ammunition') {
      await this._handleAmmunitionDrop(event, actor, droppedItem);
    }
    // Handle weapon upgrade drops
    else if (droppedItem.type === 'weapon-upgrade') {
      await this._handleWeaponUpgradeDrop(event, actor, droppedItem);
    }
  }

  /**
   * Handle dropping armor history on armor.
   * @param {Event} event - The drop event
   * @param {Actor} actor - Actor document
   * @param {Item} droppedItem - The dropped armor history item
   * @private
   */
  static async _handleArmorHistoryDrop(event, actor, droppedItem) {
    event.stopPropagation();

    let historyItem = droppedItem;
    if (!droppedItem.parent) {
      const imported = await Item.create(droppedItem.toObject(), { parent: actor });
      historyItem = imported;
    }

    let targetItemId = $(event.currentTarget).data('itemId');
    let targetItem = actor.items.get(targetItemId);

    if (!targetItem || targetItem.type !== 'armor') {
      const armorItems = actor.items.filter(i => i.type === 'armor');
      if (armorItems.length === 1) targetItem = armorItems[0];
      else {
        ui.notifications.warn(armorItems.length > 1 ? 'Multiple armor items found. Please drop directly on the armor item.' : 'No armor items found.');
        return;
      }
    }

    const currentHistories = targetItem.system.attachedHistories || [];
    const existingHistory = currentHistories.find(histId => {
      const existing = actor.items.get(histId);
      if (!existing) return false;
      const sourceId = historyItem.flags?.core?.sourceId || historyItem.name;
      const existingSourceId = existing.flags?.core?.sourceId || existing.name;
      return sourceId === existingSourceId;
    });

    if (existingHistory) {
      ui.notifications.warn(`${historyItem.name} is already attached to ${targetItem.name}.`);
      return;
    }

    let maxHistories = targetItem.name.toLowerCase().includes('artificer') ? 2 : 1;
    if (currentHistories.length >= maxHistories) {
      ui.notifications.warn(`${targetItem.name} can only have ${maxHistories} armor ${maxHistories === 1 ? 'history' : 'histories'}.`);
      return;
    }

    await targetItem.update({ "system.attachedHistories": [...currentHistories, historyItem.id] });
    ui.notifications.info(`${historyItem.name} attached to ${targetItem.name}.`);
  }

  /**
   * Handle dropping ammunition on weapon.
   * @param {Event} event - The drop event
   * @param {Actor} actor - Actor document
   * @param {Item} droppedItem - The dropped ammunition item
   * @private
   */
  static async _handleAmmunitionDrop(event, actor, droppedItem) {
    let targetItemId = $(event.currentTarget).data('itemId');
    let targetItem = actor.items.get(targetItemId);

    if (!targetItem || targetItem.type !== 'weapon') {
      return;
    }
    event.stopPropagation();

    const weaponClass = targetItem.system.class?.toLowerCase();
    if (weaponClass?.includes('melee')) {
      ui.notifications.warn('Ammunition cannot be loaded into melee weapons.');
      return;
    }

    if (targetItem.system.loadedAmmo) {
      ui.notifications.warn(`${targetItem.name} already has ammunition loaded.`);
      return;
    }

    // Ensure the ammo is owned by this actor
    let ammoItem = droppedItem;
    if (!droppedItem.parent || droppedItem.parent.id !== actor.id) {
      ui.notifications.warn('Ammunition must be in your inventory to load it.');
      return;
    }

    await targetItem.update({ "system.loadedAmmo": ammoItem.id });
    ui.notifications.info(`${ammoItem.name} loaded into ${targetItem.name}.`);
  }

  /**
   * Handle dropping weapon upgrade on weapon.
   * @param {Event} event - The drop event
   * @param {Actor} actor - Actor document
   * @param {Item} droppedItem - The dropped weapon upgrade item
   * @private
   */
  static async _handleWeaponUpgradeDrop(event, actor, droppedItem) {
    event.stopPropagation();

    let upgradeItem = droppedItem;
    if (!droppedItem.parent || droppedItem.parent.id !== actor.id) {
      const imported = await Item.create(droppedItem.toObject(), { parent: actor });
      upgradeItem = imported;
    }

    let targetItemId = $(event.currentTarget).data('itemId');
    let targetItem = actor.items.get(targetItemId);

    if (!targetItem || targetItem.type !== 'weapon') {
      ui.notifications.warn('Weapon upgrades can only be attached to weapons.');
      return;
    }

    const currentUpgrades = targetItem.system.attachedUpgrades || [];
    if (currentUpgrades.find(u => u.id === upgradeItem.id)) {
      ui.notifications.warn(`${upgradeItem.name} is already attached to ${targetItem.name}.`);
      return;
    }

    await targetItem.update({ "system.attachedUpgrades": [...currentUpgrades, { id: upgradeItem.id }] });
    ui.notifications.info(`${upgradeItem.name} attached to ${targetItem.name}.`);
  }

  /**
   * Handle dropping a chapter item.
   * @param {Event} event - The drop event
   * @param {Actor} actor - Actor document
   * @private
   */
  static async _onDropChapter(event, actor) {
    event.preventDefault();
    event.stopPropagation();

    const data = foundry.applications.ux.TextEditor.implementation.getDragEventData(event);
    if (data.type !== 'Item') return;

    const droppedItem = await Item.implementation.fromDropData(data);
    if (!droppedItem || droppedItem.type !== 'chapter') {
      ui.notifications.warn('Only chapter items can be dropped here.');
      return;
    }

    if (actor.system.chapterId) {
      const existingChapter = actor.items.get(actor.system.chapterId);
      if (existingChapter) {
        await existingChapter.delete();
      }
    }

    const chapterItem = await Item.create(droppedItem.toObject(), { parent: actor });
    await actor.update({ "system.chapterId": chapterItem.id });
    ui.notifications.info(`Chapter set to ${chapterItem.name}.`);
  }

  /**
   * Handle dropping a specialty item.
   * @param {Event} event - The drop event
   * @param {Actor} actor - Actor document
   * @private
   */
  static async _onDropSpecialty(event, actor) {
    event.preventDefault();
    event.stopPropagation();

    const data = foundry.applications.ux.TextEditor.implementation.getDragEventData(event);
    if (data.type !== 'Item') return;

    const droppedItem = await Item.implementation.fromDropData(data);
    if (!droppedItem || droppedItem.type !== 'specialty') {
      ui.notifications.warn('Only specialty items can be dropped here.');
      return;
    }

    if (actor.system.specialtyId) {
      const existingSpecialty = actor.items.get(actor.system.specialtyId);
      if (existingSpecialty) {
        await existingSpecialty.delete();
      }
    }

    const specialtyItem = await Item.create(droppedItem.toObject(), { parent: actor });
    await actor.update({ "system.specialtyId": specialtyItem.id });
    ui.notifications.info(`Specialty set to ${specialtyItem.name}.`);
  }
}
