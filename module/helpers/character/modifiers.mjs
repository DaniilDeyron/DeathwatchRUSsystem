import { DWConfig } from "../config.mjs";
import { CHARACTERISTICS, CHARACTERISTIC_LABELS, MODIFIER_TYPES, EFFECT_TYPES, EFFECT_TYPE_LABELS } from "../constants/index.mjs";

// Effect types that don't need a valueAffected field
const NO_VALUE_AFFECTED = new Set([
  EFFECT_TYPES.INITIATIVE, EFFECT_TYPES.WOUNDS, EFFECT_TYPES.ARMOR,
  EFFECT_TYPES.PSY_RATING, EFFECT_TYPES.MOVEMENT, EFFECT_TYPES.MOVEMENT_MULTIPLIER,
  EFFECT_TYPES.MOVEMENT_RESTRICTION, EFFECT_TYPES.WEAPON_DAMAGE, EFFECT_TYPES.WEAPON_DAMAGE_OVERRIDE,
  EFFECT_TYPES.WEAPON_RANGE, EFFECT_TYPES.WEAPON_WEIGHT, EFFECT_TYPES.WEAPON_ROF,
  EFFECT_TYPES.WEAPON_BLAST, EFFECT_TYPES.WEAPON_FELLING, EFFECT_TYPES.WEAPON_PENETRATION,
  EFFECT_TYPES.WEAPON_PENETRATION_MODIFIER, EFFECT_TYPES.RIGHTEOUS_FURY_THRESHOLD,
  EFFECT_TYPES.MAGNITUDE_BONUS_DAMAGE, EFFECT_TYPES.PREMATURE_DETONATION,
  EFFECT_TYPES.IGNORES_NATURAL_ARMOUR
]);

// Effect types that use characteristic dropdown for valueAffected
const CHARACTERISTIC_VALUE_AFFECTED = new Set([
  EFFECT_TYPES.CHARACTERISTIC, EFFECT_TYPES.CHARACTERISTIC_BONUS,
  EFFECT_TYPES.CHARACTERISTIC_POST_MULTIPLIER, EFFECT_TYPES.CHARACTERISTIC_DAMAGE
]);

export class ModifierHelper {
  
  static async createModifier(actor) {
    const modifiers = Array.isArray(actor.system.modifiers) ? [...actor.system.modifiers] : [];
    modifiers.push({
      _id: foundry.utils.randomID(),
      name: "New Modifier",
      modifier: "0",
      type: MODIFIER_TYPES.UNTYPED,
      modifierType: "constant",
      effectType: EFFECT_TYPES.CHARACTERISTIC,
      valueAffected: "",
      enabled: true,
      source: "Actor"
    });
    await actor.update({ "system.modifiers": modifiers });
  }

  static async deleteModifier(actor, modifierId) {
    const modifiers = Array.isArray(actor.system.modifiers) ? actor.system.modifiers.filter(m => m._id !== modifierId) : [];
    await actor.update({ "system.modifiers": modifiers });
  }

  static async toggleModifierEnabled(actor, modifierId) {
    const modifiers = [...actor.system.modifiers];
    const index = modifiers.findIndex(m => m._id === modifierId);
    if (index >= 0) {
      modifiers[index].enabled = !modifiers[index].enabled;
      await actor.update({ "system.modifiers": modifiers });
    }
  }

  static async editModifierDialog(actor, modifierId) {
    const modifier = actor.system.modifiers?.find(m => m._id === modifierId);
    if (!modifier) return;

    ModifierHelper._showEditDialog(modifier, async (updated) => {
      const modifiers = [...actor.system.modifiers];
      const index = modifiers.findIndex(m => m._id === modifierId);
      if (index >= 0) {
        modifiers[index] = { ...modifiers[index], ...updated };
        await actor.update({ "system.modifiers": modifiers });
      }
    });
  }

  /**
   * Show the shared modifier edit dialog for any document (actor or item).
   * @param {Object} modifier - The modifier object to edit
   * @param {Function} onSave - Callback receiving the updated fields
   */
  static async _showEditDialog(modifier, onSave) {
    const content = `
      <div class="form-group">
        <label>Name:</label>
        <input type="text" name="name" value="${modifier.name}" />
      </div>
      <div class="form-group">
        <label>Modifier:</label>
        <input type="text" name="modifier" value="${modifier.modifier}" />
      </div>
      <div class="form-group">
        <label>Type:</label>
        <select name="type">
          ${Object.entries(MODIFIER_TYPES).map(([, v]) =>
            `<option value="${v}" ${modifier.type === v ? 'selected' : ''}>${v.charAt(0).toUpperCase() + v.slice(1)}</option>`
          ).join('')}
        </select>
      </div>
      <div class="form-group">
        <label>Effect Type:</label>
        <select name="effectType" id="effectType">
          ${Object.entries(EFFECT_TYPE_LABELS).map(([key, label]) =>
            `<option value="${key}" ${modifier.effectType === key ? 'selected' : ''}>${label}</option>`
          ).join('')}
        </select>
      </div>
      <div class="form-group" id="valueAffectedGroup" style="${NO_VALUE_AFFECTED.has(modifier.effectType) ? 'display: none;' : ''}">
        <label>Value Affected:</label>
        ${ModifierHelper._getValueAffectedField(modifier)}
      </div>
    `;

    const result = await foundry.applications.api.DialogV2.wait({
      window: { title: "Edit Modifier" },
      content: content,
      render: (event, dialog) => {
        const el = dialog.element;
        const effectTypeSelect = el.querySelector('#effectType');
        if (effectTypeSelect) {
          effectTypeSelect.addEventListener('change', (ev) => {
            const effectType = ev.target.value;
            const group = el.querySelector('#valueAffectedGroup');
            if (!group) return;

            if (NO_VALUE_AFFECTED.has(effectType)) {
              group.style.display = 'none';
            } else {
              group.style.display = '';
              const existing = group.querySelector('input[name="valueAffected"], select[name="valueAffected"]');
              if (existing) existing.remove();

              const label = group.querySelector('label');
              if (CHARACTERISTIC_VALUE_AFFECTED.has(effectType)) {
                label.insertAdjacentHTML('afterend', ModifierHelper._getCharacteristicSelect());
              } else if (effectType === EFFECT_TYPES.SKILL) {
                label.insertAdjacentHTML('afterend', ModifierHelper._getSkillSelect());
              } else {
                label.insertAdjacentHTML('afterend', `<input type="text" name="valueAffected" value="" />`);
              }
            }
          });
        }
      },
      buttons: [
        {
          label: "Save",
          action: "save",
          callback: (event, button, dialog) => {
            const el = dialog.element;
            return {
              name: el.querySelector('[name="name"]').value,
              modifier: el.querySelector('[name="modifier"]').value,
              type: el.querySelector('[name="type"]').value,
              effectType: el.querySelector('[name="effectType"]').value,
              valueAffected: el.querySelector('[name="valueAffected"]')?.value || ''
            };
          }
        },
        { label: "Cancel", action: "cancel" }
      ]
    });

    if (result && result !== "cancel") {
      await onSave(result);
    }
  }

  static _getValueAffectedField(modifier) {
    if (CHARACTERISTIC_VALUE_AFFECTED.has(modifier.effectType)) {
      return this._getCharacteristicSelect(modifier.valueAffected);
    } else if (modifier.effectType === EFFECT_TYPES.SKILL) {
      return this._getSkillSelect(modifier.valueAffected);
    } else {
      return `<input type="text" name="valueAffected" value="${modifier.valueAffected || ''}" />`;
    }
  }

  static _getCharacteristicSelect(selected = '') {
    let html = '<select name="valueAffected"><option value="">Select Characteristic</option>';
    for (const [, key] of Object.entries(CHARACTERISTICS)) {
      html += `<option value="${key}" ${selected === key ? 'selected' : ''}>${CHARACTERISTIC_LABELS[key]}</option>`;
    }
    html += '</select>';
    return html;
  }

  static _getSkillSelect(selected = '') {
    let html = '<select name="valueAffected"><option value="">Select Skill</option>';
    for (const [key, label] of Object.entries(DWConfig.Skills)) {
      html += `<option value="${key}" ${selected === key ? 'selected' : ''}>${label}</option>`;
    }
    html += '</select>';
    return html;
  }
}
