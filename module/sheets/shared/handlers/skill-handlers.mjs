import { RollDialogBuilder } from '../../../helpers/ui/roll-dialog-builder.mjs';
import { ChatMessageBuilder } from '../../../helpers/ui/chat-message-builder.mjs';

/**
 * Handles skill roll events for actor sheets.
 */
export class SkillHandlers {
  /**
   * Attach skill roll handlers to sheet HTML.
   * @param {jQuery} html - Sheet HTML element
   * @param {Actor} actor - Actor document
   */
  static attach(html, actor) {
    // Attach skill checkbox cascade logic
    this._attachSkillCheckboxCascade(html);
  }

  /**
   * Attach skill checkbox cascade logic.
   * When unchecking trained, uncheck mastered and expert.
   * When unchecking mastered, uncheck expert.
   * @param {jQuery} html - Sheet HTML element
   * @private
   */
  static _attachSkillCheckboxCascade(html) {
    // Trained checkbox cascade
    html.find('input[type="checkbox"][name*="system.skills."][name*=".trained"]').change(ev => {
      const match = ev.target.name.match(/system\.skills\.(\w+)\.trained/);
      if (!match) return;
      const skillKey = match[1];
      if (!ev.target.checked) {
        html.find(`input[name="system.skills.${skillKey}.mastered"]`).prop('checked', false);
        html.find(`input[name="system.skills.${skillKey}.expert"]`).prop('checked', false);
      }
    });

    // Mastered checkbox cascade
    html.find('input[type="checkbox"][name*="system.skills."][name*=".mastered"]').change(ev => {
      const match = ev.target.name.match(/system\.skills\.(\w+)\.mastered/);
      if (!match) return;
      const skillKey = match[1];
      if (!ev.target.checked) {
        html.find(`input[name="system.skills.${skillKey}.expert"]`).prop('checked', false);
      }
    });
  }

  /**
   * Handle skill roll with modifier dialog.
   * @param {Object} dataset - Dataset from clicked element
   * @param {Actor} actor - Actor document
   * @returns {Promise<void>}
   */
  static async handleRoll(dataset, actor) {
    const skill = actor.system.skills[dataset.skill];
    const label = `[Skill] ${dataset.label}`;

    if (!skill) {
      ui.notifications.warn(`Skill ${dataset.skill} not found`);
      return;
    }

    if (!skill.isBasic && !skill.trained) {
      ui.notifications.warn(`${dataset.label || dataset.skill} is an advanced skill and must be trained to use.`);
      return;
    }

    const characteristic = actor.system.characteristics[skill.characteristic];
    const baseCharValue = characteristic ? characteristic.value : 0;
    const effectiveChar = skill.trained ? baseCharValue : Math.floor(baseCharValue / 2);
    const skillBonus = skill.expert ? 20 : (skill.mastered ? 10 : 0);
    const skillTotal = effectiveChar + skillBonus + (skill.modifier || 0) + (skill.modifierTotal || 0);

    return foundry.applications.api.DialogV2.wait({
      window: { title: `Roll ${dataset.label}` },
      content: RollDialogBuilder.buildModifierDialog(),
      render: (event, dialog) => RollDialogBuilder.attachModifierInputHandlerV2(dialog.element),
      buttons: [
        {
          label: "Roll", action: "roll",
          class: "dialog-button roll",
          callback: async (event, button, dialog) => {
            const modifiers = RollDialogBuilder.parseModifiersV2(dialog.element);
            const target = skillTotal + modifiers.difficultyModifier + modifiers.additionalModifier;

            const roll = new Roll('1d100', actor.getRollData());
            await roll.evaluate();

            const modifierParts = RollDialogBuilder.buildModifierParts(skillTotal, dataset.label, modifiers);
            const flavor = RollDialogBuilder.buildResultFlavor(label, target, roll, modifierParts);

            ChatMessageBuilder.createRollMessage(roll, actor, flavor);
          }
        },
        { label: "Cancel", action: "cancel", class: "dialog-button cancel" }
      ]
    });
  }
}
