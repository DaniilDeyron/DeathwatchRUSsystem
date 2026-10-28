import { DWConfig } from "../config.mjs";
import { ROLL_CONSTANTS, CHARACTERISTIC_CONSTANTS } from "../constants/index.mjs";

export class RollDialogBuilder {
  /**
   * Build characteristic source selector for cybernetic replacements.
   * @param {number} naturalValue - Natural characteristic value
   * @param {string} label - Characteristic label (e.g., "Strength")
   * @param {Array} replacements - Array of cybernetic replacement objects
   * @returns {string} HTML for source selector
   */
  static buildCharacteristicSourceSelector(naturalValue, label, replacements) {
    const naturalBonus = Math.floor(naturalValue / CHARACTERISTIC_CONSTANTS.BONUS_DIVISOR);

    let content = '<div class="form-group"><label>Источник:</label><select id="characteristic-source" name="source">';
    content += `<option value="natural">Естественная характеристика: ${label} (${naturalValue}, бонус: ${naturalBonus})</option>`;

    for (const replacement of replacements) {
      const bonusText = replacement.item.system.unnaturalMultiplier > 1
        ? `Бонус: ${replacement.bonus} [Сверхъестественный ×${replacement.item.system.unnaturalMultiplier}]`
        : `Бонус: ${replacement.bonus}`;
      content += `<option value="${replacement.item.id}">${replacement.label} (${replacement.value}, ${bonusText})</option>`;
    }

    content += '</select></div>';
    return content;
  }

  /**
   * Build modifier dialog HTML with optional pre-filled values.
   * @param {number} [prefillModifier=null] - Pre-fill misc modifier field (e.g., 10 for +10)
   * @param {number} [prefillDifficulty=null] - Pre-fill difficulty by modifier value (e.g., 30 for Easy)
   * @returns {string} Dialog HTML content
   */
  static buildModifierDialog(prefillModifier = null, prefillDifficulty = null) {
    // Find difficulty key by modifier value if provided
    let selectedDifficultyKey = 'challenging';
    if (prefillDifficulty !== null) {
      for (const [key, difficulty] of Object.entries(DWConfig.TestDifficulties)) {
        if (difficulty.modifier === prefillDifficulty) {
          selectedDifficultyKey = key;
          break;
        }
      }
    }

    let content = `<div class="modifier-dialog"><div class="form-group"><label for="difficulty-select">Сложность проверки:</label><select id="difficulty-select" name="difficulty">`;

    for (const [key, difficulty] of Object.entries(DWConfig.TestDifficulties)) {
      const selected = key === selectedDifficultyKey ? 'selected' : '';
      content += `<option value="${key}" ${selected}>${difficulty.label} (${difficulty.modifier >= 0 ? '+' : ''}${difficulty.modifier})</option>`;
    }

    const modifierValue = prefillModifier !== null && prefillModifier !== 0
      ? (prefillModifier > 0 ? `+${prefillModifier}` : `${prefillModifier}`)
      : '';

    content += `</select></div><div class="form-group modifier-row"><label for="modifier">Доп. модификатор:</label><input type="text" id="modifier" name="modifier" value="${modifierValue}" placeholder="например: +5, -10" /></div></div>`;
    return content;
  }

  static attachModifierInputHandler(html) {
    html.find('#modifier').on('input', function() {
      const value = this.value.replace(/[^0-9+\-\s]/g, '');
      if (this.value !== value) this.value = value;
    });
  }

  static attachModifierInputHandlerV2(dialog) {
    const input = dialog.querySelector('#modifier');
    if (input) {
      input.addEventListener('input', function() {
        const value = this.value.replace(/[^0-9+\-\s]/g, '');
        if (this.value !== value) this.value = value;
      });
    }
  }

  static parseModifiers(html) {
    const selectedDifficulty = html.find('#difficulty-select').val();
    const difficultyModifier = DWConfig.TestDifficulties[selectedDifficulty].modifier;
    const additionalModifierInput = html.find('#modifier').val().trim();
    
    let additionalModifier = 0;
    if (additionalModifierInput && additionalModifierInput.match(/^[-+]?\d+$/)) {
      additionalModifier = parseInt(additionalModifierInput);
    }
    
    return {
      difficulty: selectedDifficulty,
      difficultyModifier,
      additionalModifier,
      difficultyLabel: DWConfig.TestDifficulties[selectedDifficulty].label
    };
  }

  static parseModifiersV2(dialog) {
    const selectedDifficulty = dialog.querySelector('#difficulty-select').value;
    const difficultyModifier = DWConfig.TestDifficulties[selectedDifficulty].modifier;
    const additionalModifierInput = (dialog.querySelector('#modifier').value || '').trim();
    
    let additionalModifier = 0;
    if (additionalModifierInput && additionalModifierInput.match(/^[-+]?\d+$/)) {
      additionalModifier = parseInt(additionalModifierInput);
    }
    
    return {
      difficulty: selectedDifficulty,
      difficultyModifier,
      additionalModifier,
      difficultyLabel: DWConfig.TestDifficulties[selectedDifficulty].label
    };
  }

  static buildModifierParts(baseValue, label, modifiers) {
    const parts = [`Базовое значение (${label}): ${baseValue}`];
    
    if (modifiers.difficultyModifier !== 0) {
      parts.push(`Сложность: ${modifiers.difficultyLabel} (${modifiers.difficultyModifier >= 0 ? '+' : ''}${modifiers.difficultyModifier})`);
    }
    
    if (modifiers.additionalModifier !== 0) {
      parts.push(`Доп. модификатор: ${modifiers.additionalModifier >= 0 ? '+' : ''}${modifiers.additionalModifier}`);
    }
    
    return parts;
  }

  static buildResultFlavor(label, target, roll, modifierParts) {
    const success = roll.total <= target;
    const degrees = Math.floor(Math.abs(target - roll.total) / ROLL_CONSTANTS.DEGREES_DIVISOR);
    const resultText = success ? `<span style="color: green;">УСПЕХ (${degrees} степ. успеха)</span>` : `ПРОВАЛ (${degrees} степ. провала)`;

    let flavor = `${label} — целевое значение: ${target}<br><strong>${resultText}</strong>`;

    if (modifierParts.length > 0) {
      flavor += `<details style="margin-top:4px;"><summary style="cursor:pointer;font-size:0.9em;">Модификаторы</summary><div style="font-size:0.85em;margin-top:4px;">${modifierParts.join('<br>')}</div></details>`;
    }

    return flavor;
  }
}
