import { RollDialogBuilder } from "./ui/roll-dialog-builder.mjs";
import { ChatMessageBuilder } from "./ui/chat-message-builder.mjs";
import { CyberneticHelper } from "./cybernetic-helper.mjs";

const { DialogV2 } = foundry.applications.api;

/**
 * Centralized roll execution logic for skills and characteristics.
 *
 * This is the single source of truth for how rolls are executed in the system.
 * Used by both sheet-based rolls and macro API rolls to ensure consistency.
 */
export class RollExecutor {
  /**
   * Execute a skill roll with given parameters.
   *
   * @param {Actor} actor - Actor performing the roll
   * @param {Object} skill - Skill data object
   * @param {string} label - Skill label for display
   * @param {number} skillTotal - Base skill total
   * @param {Object} modifiers - Modifier object with difficultyModifier and additionalModifier
   * @returns {Promise<Roll>} The evaluated roll
   */
  static async executeSkillRoll(actor, skill, label, skillTotal, modifiers) {
    const targetNum = skillTotal + modifiers.difficultyModifier + modifiers.additionalModifier;
    const roll = new Roll('1d100', actor.getRollData());
    await roll.evaluate();

    const flavorLabel = `[Skill] ${label}`;
    const modifierParts = RollDialogBuilder.buildModifierParts(skillTotal, label, modifiers);
    const flavor = RollDialogBuilder.buildResultFlavor(flavorLabel, targetNum, roll, modifierParts);

    ChatMessageBuilder.createRollMessage(roll, actor, flavor);

    return roll;
  }

  /**
   * Execute a characteristic roll with given parameters.
   *
   * @param {Actor} actor - Actor performing the roll
   * @param {number} characteristicValue - Characteristic value to roll against
   * @param {string} label - Characteristic label for display
   * @param {Object} modifiers - Modifier object with difficultyModifier and additionalModifier
   * @returns {Promise<Roll>} The evaluated roll
   */
  static async executeCharacteristicRoll(actor, characteristicValue, label, modifiers) {
    const targetNum = characteristicValue + modifiers.difficultyModifier + modifiers.additionalModifier;
    const roll = new Roll('1d100', actor.getRollData());
    await roll.evaluate();

    const flavorLabel = `[Characteristic] ${label}`;
    const modifierParts = RollDialogBuilder.buildModifierParts(characteristicValue, label, modifiers);
    const flavor = RollDialogBuilder.buildResultFlavor(flavorLabel, targetNum, roll, modifierParts);

    ChatMessageBuilder.createRollMessage(roll, actor, flavor);

    return roll;
  }

  /**
   * Show skill roll dialog and execute roll on confirmation.
   *
   * @param {Actor} actor - Actor performing the roll
   * @param {Object} skill - Skill data object
   * @param {string} label - Skill label for display
   * @param {number} skillTotal - Base skill total
   * @param {number} [prefillModifier=0] - Pre-filled additional modifier
   * @param {number} [prefillDifficulty=0] - Pre-filled difficulty modifier
   * @returns {Promise<Roll|null>} The evaluated roll or null if canceled
   */
  static async showSkillDialog(actor, skill, label, skillTotal, prefillModifier = 0, prefillDifficulty = 0) {
    const flavorLabel = `[Skill] ${label}`;

    return DialogV2.wait({
      window: { title: `Roll ${label}` },
      content: RollDialogBuilder.buildModifierDialog(prefillModifier, prefillDifficulty),
      render: (event, dialog) => RollDialogBuilder.attachModifierInputHandlerV2(dialog.element),
      buttons: [
        {
          label: "Roll",
          action: "roll",
          class: "dialog-button roll",
          callback: async (event, button, dialog) => {
            const modifiers = RollDialogBuilder.parseModifiersV2(dialog.element);
            return this.executeSkillRoll(actor, skill, label, skillTotal, modifiers);
          }
        },
        {
          label: "Cancel",
          action: "cancel",
          class: "dialog-button cancel"
        }
      ]
    });
  }

  /**
   * Show characteristic roll dialog and execute roll on confirmation.
   * Includes cybernetic source selector if applicable.
   *
   * @param {Actor} actor - Actor performing the roll
   * @param {string} charKey - Characteristic key (e.g., 'str', 'ag')
   * @param {string} label - Characteristic label for display
   * @param {Object} characteristic - Characteristic data object
   * @param {number} [prefillModifier=0] - Pre-filled additional modifier
   * @param {number} [prefillDifficulty=0] - Pre-filled difficulty modifier
   * @returns {Promise<Roll|null>} The evaluated roll or null if canceled
   */
  static async showCharacteristicDialog(actor, charKey, label, characteristic, prefillModifier = 0, prefillDifficulty = 0) {
    const flavorLabel = `[Characteristic] ${label}`;
    const replacements = CyberneticHelper.getCharacteristicReplacements(actor, charKey);
    const hasReplacements = replacements.length > 0;

    // Build dialog content
    let content = RollDialogBuilder.buildModifierDialog(prefillModifier, prefillDifficulty);

    // Add source selector if cybernetics available
    if (hasReplacements) {
      content = RollDialogBuilder.buildCharacteristicSourceSelector(
        characteristic.value,
        label,
        replacements
      ) + content;
    }

    return DialogV2.wait({
      window: { title: `Roll ${label}` },
      content: content,
      render: (event, dialog) => RollDialogBuilder.attachModifierInputHandlerV2(dialog.element),
      buttons: [
        {
          label: "Roll",
          action: "roll",
          class: "dialog-button roll",
          callback: async (event, button, dialog) => {
            const modifiers = RollDialogBuilder.parseModifiersV2(dialog.element);

            // Get selected characteristic source
            let selectedValue = characteristic.value;
            let selectedLabel = label;
            if (hasReplacements) {
              const sourceSelect = dialog.element.querySelector('#characteristic-source');
              const selectedSource = sourceSelect?.value;
              if (selectedSource && selectedSource !== 'natural') {
                const replacement = replacements.find(r => r.item.id === selectedSource);
                if (replacement) {
                  selectedValue = replacement.value;
                  selectedLabel = `${label} (${replacement.label})`;
                }
              }
            }

            return this.executeCharacteristicRoll(actor, selectedValue, selectedLabel, modifiers);
          }
        },
        {
          label: "Cancel",
          action: "cancel",
          class: "dialog-button cancel"
        }
      ]
    });
  }
}
