import { AIM_MODIFIERS, COMBAT_PENALTIES, MELEE_MODIFIERS, HIT_LOCATIONS } from "../constants/index.mjs";
import { CombatHelper } from "./combat.mjs";
import { CombatDialogHelper } from "./combat-dialog.mjs";
import { WeaponQualityHelper } from "./weapon-quality-helper.mjs";
import { Sanitizer } from "../sanitizer.mjs";

/**
 * Melee combat helper for Weapon Skill tests and close combat attacks.
 * Handles Standard Attack, All Out Attack, Charge, and Called Shot melee options.
 *
 * @example
 * // Resolve a melee attack with Charge
 * const result = await MeleeCombatHelper.resolveMeleeAttack(actor, chainsword, {
 *   hitValue: 35,
 *   aim: 0,
 *   allOut: 0,
 *   charge: 10,
 *   calledShot: 0,
 *   miscModifier: 0
 * });
 */
export class MeleeCombatHelper {
  /**
   * Calculate melee attack modifiers and target number.
   *
   * Melee combat modifiers (Deathwatch Core p. 243):
   * - Aim: +0 (None), +10 (Half), +20 (Full)
   * - All Out Attack: +20 (but cannot Parry/Dodge)
   * - Charge: +10 (must move at least 4m)
   * - Called Shot: −20
   * - Running Target: −20
   * - Defensive quality: −10
   * - Size modifiers: +30 (Enormous) to −30 (Minuscule)
   *
   * All modifiers are clamped to [−60, +60] per core rules.
   *
   * @param {Object} [options={}] - Attack modifier options
   * @param {number} [options.ws=0] - Weapon Skill characteristic value
   * @param {number} [options.aim=0] - Aim modifier (+0, +10, or +20)
   * @param {number} [options.allOut=0] - All Out Attack modifier (+20)
   * @param {number} [options.charge=0] - Charge modifier (+10)
   * @param {number} [options.calledShot=0] - Called Shot penalty (−20)
   * @param {number} [options.runningTarget=0] - Running Target penalty (−20)
   * @param {number} [options.miscModifier=0] - Miscellaneous modifier
   * @param {number} [options.sizeModifier=0] - Target size modifier (+30 to −30)
   * @param {boolean} [options.isDefensive=false] - Whether weapon has Defensive quality (−10)
   * @returns {{modifiers: number, clampedModifiers: number, targetNumber: number, defensivePenalty: number}} Modifier calculation result
   * @property {number} return.modifiers - Raw total modifiers (before clamping)
   * @property {number} return.clampedModifiers - Clamped modifiers (−60 to +60)
   * @property {number} return.targetNumber - Final target number (WS + clamped modifiers)
   * @property {number} return.defensivePenalty - Defensive quality penalty (−10 or 0)
   * @example
   * const result = MeleeCombatHelper.buildMeleeModifiers({
   *   ws: 50,
   *   charge: 10,
   *   miscModifier: 10
   * });
   * // Returns: { modifiers: 20, clampedModifiers: 20, targetNumber: 70, defensivePenalty: 0 }
   */
  static buildMeleeModifiers({ ws = 0, aim = 0, allOut = 0, charge = 0, calledShot = 0, runningTarget = 0, miscModifier = 0, sizeModifier = 0, isDefensive = false } = {}) {
    const defensivePenalty = isDefensive ? -10 : 0;
    const modifiers = aim + allOut + charge + calledShot + runningTarget + miscModifier + defensivePenalty + sizeModifier;
    const clampedModifiers = Math.max(-60, Math.min(60, modifiers));
    const targetNumber = ws + clampedModifiers;
    return { modifiers, clampedModifiers, targetNumber, defensivePenalty };
  }

  /**
   * Build modifier breakdown parts array for chat message display.
   *
   * Creates a human-readable array of modifier strings to show players
   * how the target number was calculated.
   *
   * @param {Object} [options={}] - Modifier breakdown options
   * @param {number} [options.ws=0] - Weapon Skill value
   * @param {number} [options.aim=0] - Aim modifier
   * @param {number} [options.allOut=0] - All Out Attack modifier
   * @param {number} [options.charge=0] - Charge modifier
   * @param {number} [options.calledShot=0] - Called Shot penalty
   * @param {number} [options.runningTarget=0] - Running Target penalty
   * @param {number} [options.miscModifier=0] - Miscellaneous modifier
   * @param {number} [options.defensivePenalty=0] - Defensive quality penalty
   * @param {number} [options.sizeModifier=0] - Target size modifier
   * @param {string} [options.sizeLabel=''] - Target size label (e.g., "Enormous", "Minuscule")
   * @returns {string[]} Array of modifier strings for chat display
   * @example
   * const parts = MeleeCombatHelper.buildMeleeModifierParts({
   *   ws: 50,
   *   charge: 10,
   *   miscModifier: 10
   * });
   * // Returns: ["50 WS", "+10 Charge", "+10 Misc"]
   */
  static buildMeleeModifierParts({ ws = 0, aim = 0, allOut = 0, charge = 0, calledShot = 0, runningTarget = 0, miscModifier = 0, defensivePenalty = 0, sizeModifier = 0, sizeLabel = "" } = {}) {
    const parts = [`${ws} WS`];
    if (aim !== 0) parts.push(`+${aim} Aim`);
    if (allOut !== 0) parts.push(`+${allOut} All Out Attack`);
    if (charge !== 0) parts.push(`+${charge} Charge`);
    if (defensivePenalty !== 0) parts.push(`${defensivePenalty} Defensive`);
    if (calledShot !== 0) parts.push(`${calledShot} Called Shot`);
    if (runningTarget !== 0) parts.push(`${runningTarget} Running Target`);
    if (miscModifier !== 0) parts.push(`${miscModifier >= 0 ? '+' : ''}${miscModifier} Misc`);
    if (sizeModifier !== 0) parts.push(`${sizeModifier >= 0 ? '+' : ''}${sizeModifier} ${sizeLabel || 'Target Size'}`);
    return parts;
  }
  /**
   * Resolve a melee attack given parsed dialog inputs and a d100 roll.
   *
   * This is the core melee attack resolution function. It computes:
   * - Target number (WS + modifiers, clamped to [−60, +60])
   * - Success/failure (roll ≤ target number)
   * - Degrees of success (for damage calculation)
   * - Hits landed (usually 1, but hordes may receive multiple hits)
   *
   * This is a pure logic function: no UI, no rolls, no document updates.
   * All randomness (d100 roll) is passed in via options.hitValue.
   *
   * @param {Actor} actor - Attacking actor
   * @param {Item} weapon - Melee weapon item
   * @param {Object} options - Parsed attack options from dialog or preset
   * @param {number} options.hitValue - The d100 attack roll result (1-100)
   * @param {number} options.aim - Aim modifier (+0, +10, or +20)
   * @param {number} options.allOut - All Out Attack modifier (+20)
   * @param {number} options.charge - Charge modifier (+10)
   * @param {number} options.calledShot - Called Shot penalty (−20)
   * @param {number} options.runningTarget - Running Target penalty (−20)
   * @param {number} options.miscModifier - Miscellaneous modifier
   * @param {number} [options.sizeModifier=0] - Target size modifier (+30 to −30)
   * @param {string} [options.sizeLabel=''] - Target size label ("Enormous", "Minuscule", etc.)
   * @param {Actor} [options.targetActor=null] - Target actor (for horde hit recalculation)
   * @returns {Promise<Object>} Attack resolution result
   * @property {number} return.hitValue - The attack roll
   * @property {number} return.targetNumber - Target number (WS + modifiers)
   * @property {boolean} return.success - Whether the attack hit
   * @property {number} return.degreesOfSuccess - Degrees of success (0 if missed)
   * @property {number} return.hitsTotal - Total hits landed (usually 1, more for hordes)
   * @property {string[]} return.modifierParts - Breakdown of all modifiers
   * @property {number} return.defensivePenalty - Defensive quality penalty (−10 or 0)
   * @example
   * const result = await MeleeCombatHelper.resolveMeleeAttack(actor, chainsword, {
   *   hitValue: 35,
   *   aim: 0,
   *   allOut: 20,
   *   charge: 0,
   *   calledShot: 0,
   *   runningTarget: 0,
   *   miscModifier: 0
   * });
   * // Returns: { hitValue: 35, targetNumber: 70, success: true, degreesOfSuccess: 3, hitsTotal: 1, ... }
   */
  static async resolveMeleeAttack(actor, weapon, options) {
    const {
      hitValue, aim, allOut, charge, calledShot, runningTarget, miscModifier,
      sizeModifier = 0, sizeLabel = '', targetActor = null
    } = options;

    const ws = actor.system.characteristics.ws.value || 0;
    const isDefensive = weapon.system?.attachedQualities?.some(
      q => (typeof q === 'string' ? q : q.id) === 'defensive'
    ) || false;

    const { targetNumber, defensivePenalty } = MeleeCombatHelper.buildMeleeModifiers({
      ws, aim, allOut, charge, calledShot, runningTarget, miscModifier, sizeModifier, isDefensive
    });

    const success = hitValue <= targetNumber;
    const degreesOfSuccess = success ? CombatDialogHelper.calculateDegreesOfSuccess(hitValue, targetNumber) : 0;
    let hitsTotal = success ? 1 : 0;

    let hasPowerField = false;
    if (targetActor && hitsTotal > 0) {
      hasPowerField = await WeaponQualityHelper.hasQuality(weapon, 'power-field');
      hitsTotal = targetActor.system.calculateHitsReceived({
        isMelee: true, degreesOfSuccess, hasPowerField, baseHits: 1
      });
    }

    const modifierParts = MeleeCombatHelper.buildMeleeModifierParts({
      ws, aim, allOut, charge, calledShot, runningTarget, miscModifier, defensivePenalty, sizeModifier, sizeLabel
    });

    // Build hits breakdown array
    const hitsParts = [];
    const isHordeTarget = targetActor && targetActor.type === 'horde';

    if (success) {
      hitsParts.push(`Degrees of Success: ${degreesOfSuccess}`);

      if (isHordeTarget) {
        // Melee vs horde: base hits = floor(DoS ÷ 2), minimum 1 on success
        const baseHits = degreesOfSuccess >= 2 ? Math.floor(degreesOfSuccess / 2) : 1;
        hitsParts.push(`Base Hits: ${baseHits} (DoS ÷ 2, minimum 1 on success)`);

        if (hasPowerField) {
          hitsParts.push(`Power Field: +1`);
        }

        hitsParts.push(`<strong>Total: ${hitsTotal}</strong>`);
      } else {
        // Single target - always 1 hit on success
        hitsParts.push(`<strong>1 Hit</strong> (successful attack)`);
      }
    } else {
      // Miss
      hitsParts.push(`Degrees of Success: ${degreesOfSuccess} (negative = miss)`);
      hitsParts.push(`<strong>Total: 0 Hits (MISS)</strong>`);
    }

    return {
      hitValue, targetNumber, success, degreesOfSuccess,
      hitsTotal, modifierParts, defensivePenalty, hitsParts
    };
  }

  /**
   * Open the melee attack dialog and resolve the attack.
   *
   * This is the main entry point for melee attacks. Opens a dialog with:
   * - Aim options (None, Half, Full)
   * - All Out Attack checkbox (+20 bonus, cannot Parry/Dodge)
   * - Charge checkbox (+10 bonus)
   * - Called Shot checkbox (−20 penalty, select hit location)
   * - Running Target checkbox (−20 penalty)
   * - Miscellaneous modifier input
   *
   * If `options` are provided with `skipDialog: true`, skips the dialog and
   * uses preset values (useful for hotbar macros).
   *
   * After the attack resolves, stores attack data in CombatHelper state for
   * the subsequent damage roll dialog.
   *
   * @param {Actor} actor - Attacking actor
   * @param {Item} weapon - Melee weapon item
   * @param {Object} [options={}] - Optional preset attack parameters
   * @param {number} [options.aim] - Preset aim modifier (0, 1, or 2 for None/Half/Full)
   * @param {boolean} [options.allOut] - Preset All Out Attack (true/false)
   * @param {boolean} [options.charge] - Preset Charge (true/false)
   * @param {string} [options.calledShot] - Preset called shot location
   * @param {boolean} [options.runningTarget] - Preset Running Target (true/false)
   * @param {number} [options.miscModifier] - Preset misc modifier
   * @param {boolean} [options.skipDialog] - If true, skip dialog and roll immediately
   * @returns {Promise<void>} Resolves when attack is complete
   * @example
   * // Standard attack with dialog
   * await MeleeCombatHelper.attackDialog(actor, chainsword);
   *
   * @example
   * // Preset Charge attack (for hotbar macro)
   * await MeleeCombatHelper.attackDialog(actor, chainsword, {
   *   charge: true,
   *   skipDialog: true
   * });
   */
  /* istanbul ignore next */
  static async attackDialog(actor, weapon, options = {}) {
    const hasOptions = Object.keys(options).length > 0 && options.action !== 'damage';

    if (hasOptions && options.skipDialog) {
      return this._attackWithOptions(actor, weapon, options);
    }

    const ws = actor.system.characteristics.ws.value || 0;

    const safeWeaponName = Sanitizer.escape(weapon.name);
    const content = `
      <div style="text-align: center; margin-bottom: 10px;">
        <img src="${weapon.img}" alt="${safeWeaponName}" style="max-width: 100px; max-height: 100px; border: none;" />
      </div>
      <div class="form-group">
        <label>Aim:</label>
        <select id="aim" name="aim">
          <option value="${AIM_MODIFIERS.NONE}">None</option>
          <option value="${AIM_MODIFIERS.HALF}">Half (+${AIM_MODIFIERS.HALF})</option>
          <option value="${AIM_MODIFIERS.FULL}">Full (+${AIM_MODIFIERS.FULL})</option>
        </select>
      </div>
      <div class="form-group" style="display: flex; gap: 20px;">
        <label title="+${MELEE_MODIFIERS.ALL_OUT_ATTACK} bonus"><i class="far fa-square" id="allOutIcon"></i> All Out Attack
          <input type="checkbox" id="allOut" name="allOut" style="display:none;" />
        </label>
        <label title="+${MELEE_MODIFIERS.CHARGE} bonus"><i class="far fa-square" id="chargeIcon"></i> Charge
          <input type="checkbox" id="charge" name="charge" style="display:none;" />
        </label>
      </div>
      <div class="form-group" style="display: flex; gap: 20px;">
        <label title="${COMBAT_PENALTIES.CALLED_SHOT} penalty"><i class="far fa-square" id="calledShotIcon"></i> Called Shot
          <input type="checkbox" id="calledShot" name="calledShot" style="display:none;" />
        </label>
        <label title="${COMBAT_PENALTIES.RUNNING_TARGET} penalty"><i class="far fa-square" id="runningTargetIcon"></i> Running Target
          <input type="checkbox" id="runningTarget" name="runningTarget" style="display:none;" />
        </label>
      </div>
      <div class="form-group" id="calledShotLocationGroup" style="display: none;">
        <label>Location:</label>
        <select id="calledShotLocation" name="calledShotLocation">
          ${HIT_LOCATIONS.map(loc => `<option value="${loc}">${loc}</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label>Modifier:</label>
        <input type="text" id="miscModifier" name="miscModifier" value="0" />
      </div>
    `;

    foundry.applications.api.DialogV2.wait({
      window: { title: `Melee Attack: ${safeWeaponName}` },
      position: { width: 325 },
      content: content,
      render: (event, dialog) => {
        const el = dialog.element;
        const miscInput = el.querySelector('#miscModifier');
        if (miscInput) miscInput.addEventListener('input', function() {
          this.value = this.value.replace(/[^0-9+\-]/g, '');
        });

        ['allOut', 'charge', 'calledShot', 'runningTarget'].forEach(id => {
          const label = el.querySelector(`label:has(#${id})`);
          if (!label) return;
          label.addEventListener('click', (e) => {
            e.preventDefault();
            const cb = label.querySelector(`#${id}`);
            const icon = label.querySelector(`#${id}Icon`);
            cb.checked = !cb.checked;
            icon.classList.toggle('fa-square');
            icon.classList.toggle('fa-check-square');
            if (id === 'calledShot') {
              el.querySelector('#calledShotLocationGroup').style.display = cb.checked ? '' : 'none';
            }
          });
        });

        if (hasOptions) {
          if (options.aim !== undefined) el.querySelector('#aim').value = CombatDialogHelper.mapAimOption(options.aim);
          if (options.allOut) {
            el.querySelector('#allOut').checked = true;
            el.querySelector('#allOutIcon').classList.replace('fa-square', 'fa-check-square');
          }
          if (options.charge) {
            el.querySelector('#charge').checked = true;
            el.querySelector('#chargeIcon').classList.replace('fa-square', 'fa-check-square');
          }
          if (options.calledShot) {
            el.querySelector('#calledShot').checked = true;
            el.querySelector('#calledShotIcon').classList.replace('fa-square', 'fa-check-square');
            el.querySelector('#calledShotLocationGroup').style.display = '';
            if (options.calledShotLocation) el.querySelector('#calledShotLocation').value = options.calledShotLocation;
          }
          if (options.runningTarget) {
            el.querySelector('#runningTarget').checked = true;
            el.querySelector('#runningTargetIcon').classList.replace('fa-square', 'fa-check-square');
          }
          if (options.miscModifier !== undefined) el.querySelector('#miscModifier').value = options.miscModifier;
        }
      },
      buttons: [
        {
          label: "Attack", action: "attack",
          callback: async (event, button, dialog) => {
            const el = dialog.element;
            const aim = parseInt(el.querySelector('#aim').value) || 0;
            const allOut = el.querySelector('#allOut').checked ? MELEE_MODIFIERS.ALL_OUT_ATTACK : 0;
            const charge = el.querySelector('#charge').checked ? MELEE_MODIFIERS.CHARGE : 0;
            const calledShot = el.querySelector('#calledShot').checked ? COMBAT_PENALTIES.CALLED_SHOT : 0;
            const runningTarget = el.querySelector('#runningTarget').checked ? COMBAT_PENALTIES.RUNNING_TARGET : 0;
            const miscModifier = parseInt(el.querySelector('#miscModifier').value) || 0;

            const hitRoll = await new Roll('1d100').evaluate();
            const hitValue = hitRoll.total;

            const { attackerToken, targetToken, targetActor } = CombatHelper.getAttackTokens(actor);
            const { modifier: sizeModifier, label: sizeLabel } = CombatDialogHelper.getTargetSizeModifier(targetActor);

            const result = await MeleeCombatHelper.resolveMeleeAttack(actor, weapon, {
              hitValue, aim, allOut, charge, calledShot, runningTarget, miscModifier,
              sizeModifier, sizeLabel, targetActor
            });

            const { targetNumber, success, degreesOfSuccess, hitsTotal, modifierParts, hitsParts } = result;

            CombatHelper.lastAttackRoll = hitValue;
            CombatHelper.lastAttackTarget = targetNumber;
            CombatHelper.lastAttackHits = hitsTotal;
            CombatHelper.lastAttackAim = aim;
            CombatHelper.lastCalledShotLocation = (calledShot !== 0 && hitsTotal > 0) ? el.querySelector('#calledShotLocation').value : null;

            let label = CombatDialogHelper.buildAttackLabel(weapon.name, targetNumber, hitsTotal, false);
            if (success) label += `<br><em>${degreesOfSuccess} Degree${degreesOfSuccess !== 1 ? 's' : ''} of Success</em>`;
            const flavor = CombatDialogHelper.buildAttackFlavor(label, modifierParts, hitsParts);

            // Create message with data attributes for animation system
            await CombatHelper.createAttackChatMessage(actor, weapon, hitRoll, flavor, 'melee', {
              attackerToken,
              targetToken
            });
          }
        },
        { label: "Cancel", action: "cancel" }
      ]
    });
  }

  /**
   * Execute a melee attack immediately with preset options (skip dialog).
   * @param {Object} actor - Actor document
   * @param {Object} weapon - Weapon item
   * @param {Object} options - Preset attack options
   */
  /* istanbul ignore next */
  static async _attackWithOptions(actor, weapon, options) {
    const aim = CombatDialogHelper.mapAimOption(options.aim || 0);
    const allOut = options.allOut ? MELEE_MODIFIERS.ALL_OUT_ATTACK : 0;
    const charge = options.charge ? MELEE_MODIFIERS.CHARGE : 0;
    const calledShot = options.calledShot ? COMBAT_PENALTIES.CALLED_SHOT : 0;
    const runningTarget = options.runningTarget ? COMBAT_PENALTIES.RUNNING_TARGET : 0;
    const miscModifier = options.miscModifier || 0;

    const hitRoll = await new Roll('1d100').evaluate();
    const hitValue = hitRoll.total;

    const { attackerToken, targetToken, targetActor } = CombatHelper.getAttackTokens(actor);
    const { modifier: sizeModifier, label: sizeLabel } = CombatDialogHelper.getTargetSizeModifier(targetActor);

    const result = await MeleeCombatHelper.resolveMeleeAttack(actor, weapon, {
      hitValue, aim, allOut, charge, calledShot, runningTarget, miscModifier,
      sizeModifier, sizeLabel, targetActor
    });

    const { targetNumber, success, degreesOfSuccess, hitsTotal, modifierParts, hitsParts } = result;

    CombatHelper.lastAttackRoll = hitValue;
    CombatHelper.lastAttackTarget = targetNumber;
    CombatHelper.lastAttackHits = hitsTotal;
    CombatHelper.lastAttackAim = aim;
    CombatHelper.lastCalledShotLocation = (calledShot !== 0 && hitsTotal > 0 && options.calledShotLocation) ? options.calledShotLocation : null;

    let label = CombatDialogHelper.buildAttackLabel(weapon.name, targetNumber, hitsTotal, false);
    if (success) label += `<br><em>${degreesOfSuccess} Degree${degreesOfSuccess !== 1 ? 's' : ''} of Success</em>`;
    const flavor = CombatDialogHelper.buildAttackFlavor(label, modifierParts, hitsParts);

    // Create message with data attributes for animation system
    await CombatHelper.createAttackChatMessage(actor, weapon, hitRoll, flavor, 'melee', {
      attackerToken,
      targetToken
    });
  }
}
