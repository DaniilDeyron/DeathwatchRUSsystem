import { ErrorHandler } from '../../../helpers/error-handler.mjs';
import { Validation } from '../../../helpers/validation.mjs';
import { ChatMessageBuilder } from '../../../helpers/ui/chat-message-builder.mjs';
import { CombatRouter } from '../../../helpers/combat/combat-router.mjs';
import { ModeHelper } from '../../../helpers/mode-helper.mjs';
import { CohesionPanel } from '../../../ui/cohesion-panel.mjs';

/**
 * Handles display actions for items (show in chat, use power, activate ability, etc.).
 * These handlers are for viewing and using items, not editing or managing them.
 */
export class ItemDisplayHandlers {
  /**
   * Attach item display handlers to sheet HTML.
   * @param {jQuery} html - Sheet HTML element
   * @param {Actor} actor - Actor document
   */
  static attach(html, actor) {
    this._attachItemEditHandler(html, actor);
    this._attachShowInChatHandlers(html, actor);
    this._attachUsageHandlers(html, actor);
  }

  /**
   * Attach item edit handler (used before editable check).
   * @param {jQuery} html - Sheet HTML element
   * @param {Actor} actor - Actor document
   * @private
   */
  static _attachItemEditHandler(html, actor) {
    html.find('.item-edit').click(ErrorHandler.wrap(async (ev) => {
      const li = $(ev.currentTarget).parents(".item");
      const itemId = li.data("itemId");
      const item = Validation.requireDocument(actor.items.get(itemId), 'Item', 'Edit Item');
      item.sheet.render(true);
    }, 'Edit Item'));
  }

  /**
   * Attach "show in chat" handlers for all item types.
   * @param {jQuery} html - Sheet HTML element
   * @param {Actor} actor - Actor document
   * @private
   */
  static _attachShowInChatHandlers(html, actor) {
    // Armor history
    html.find('.history-show').click(ErrorHandler.wrap(async (ev) => {
      const itemId = $(ev.currentTarget).data('itemId');
      const history = Validation.requireDocument(actor.items.get(itemId), 'Armor History', 'Show in Chat');
      await ChatMessageBuilder.createItemCard(history, actor);
    }, 'Show Armor History'));

    // Critical effect
    html.find('.critical-show').click(ErrorHandler.wrap(async (ev) => {
      const itemId = $(ev.currentTarget).data('itemId');
      const critical = Validation.requireDocument(actor.items.get(itemId), 'Critical Effect', 'Show in Chat');
      await ChatMessageBuilder.createItemCard(critical, actor);
    }, 'Show Critical Effect'));

    // Demeanour
    html.find('.demeanour-show').click(ErrorHandler.wrap(async (ev) => {
      const li = $(ev.currentTarget).closest('.item');
      const itemId = li.data('itemId');
      const demeanour = Validation.requireDocument(actor.items.get(itemId), 'Demeanour', 'Show in Chat');
      await ChatMessageBuilder.createItemCard(demeanour, actor);
    }, 'Show Demeanour'));

    // Talent
    html.find('.talent-show').click(ErrorHandler.wrap(async (ev) => {
      const li = $(ev.currentTarget).closest('.item');
      const itemId = li.data('itemId');
      const talent = Validation.requireDocument(actor.items.get(itemId), 'Talent', 'Show in Chat');
      await ChatMessageBuilder.createItemCard(talent, actor);
    }, 'Show Talent'));

    // Trait
    html.find('.trait-show').click(ErrorHandler.wrap(async (ev) => {
      const li = $(ev.currentTarget).closest('.item');
      const itemId = li.data('itemId');
      const trait = Validation.requireDocument(actor.items.get(itemId), 'Trait', 'Show in Chat');
      await ChatMessageBuilder.createItemCard(trait, actor);
    }, 'Show Trait'));

    // Implant
    html.find('.implant-show').click(ErrorHandler.wrap(async (ev) => {
      const li = $(ev.currentTarget).closest('.item');
      const itemId = li.data('itemId');
      const implant = Validation.requireDocument(actor.items.get(itemId), 'Implant', 'Show in Chat');
      await ChatMessageBuilder.createItemCard(implant, actor);
    }, 'Show Implant'));

    // Psychic power
    html.find('.psychic-power-show').click(ErrorHandler.wrap(async (ev) => {
      const li = $(ev.currentTarget).closest('.item');
      const itemId = li.data('itemId');
      const power = Validation.requireDocument(actor.items.get(itemId), 'Psychic Power', 'Show in Chat');
      await ChatMessageBuilder.createItemCard(power, actor);
    }, 'Show Psychic Power'));

    // Special ability (with mode activation message support)
    html.find('.special-ability-show').click(ErrorHandler.wrap(async (ev) => {
      const li = $(ev.currentTarget).closest('.item');
      const itemId = li.data('itemId');
      const ability = Validation.requireDocument(actor.items.get(itemId), 'Special Ability', 'Show in Chat');

      const sys = ability.system;
      if (sys.effect && sys.modeRequirement) {
        const msg = ModeHelper.buildAbilityActivationMessage(
          actor.name, ability.name, sys.modeRequirement,
          sys.effect, sys.improvements || [], actor.system.rank || 1
        );
        if (msg) {
          await ChatMessage.create({ content: msg, speaker: ChatMessage.getSpeaker({ actor }) });
          return;
        }
      }
      await ChatMessageBuilder.createItemCard(ability, actor);
    }, 'Show Special Ability'));
  }

  /**
   * Attach usage handlers (use power, activate ability).
   * @param {jQuery} html - Sheet HTML element
   * @param {Actor} actor - Actor document
   * @private
   */
  static _attachUsageHandlers(html, actor) {
    // Use psychic power (Focus Power Test)
    html.find('.psychic-power-use').click(ErrorHandler.wrap(async (ev) => {
      const li = $(ev.currentTarget).closest('.item');
      const itemId = li.data('itemId');
      const power = Validation.requireDocument(actor.items.get(itemId), 'Psychic Power', 'Use Power');
      await CombatRouter.executeDamage(actor, power);
    }, 'Use Psychic Power'));

    // Activate Squad Mode ability
    html.find('.squad-ability-activate').click(ErrorHandler.wrap(async (ev) => {
      ev.stopPropagation();
      const itemId = $(ev.currentTarget).data('itemId');
      const ability = Validation.requireDocument(actor.items.get(itemId), 'Squad Ability', 'Activate');
      await CohesionPanel.activateSquadAbility(actor, ability);
    }, 'Activate Squad Ability'));
  }
}
