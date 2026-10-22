import { POWER_LEVELS, POWER_LEVEL_LABELS, ROLL_CONSTANTS } from "../constants/index.mjs";
import { CombatDialogHelper } from "./combat-dialog.mjs";
import { ModifierCollector } from "../character/modifier-collector.mjs";
import { FoundryAdapter } from "../foundry-adapter.mjs";
import { ChatMessageBuilder } from "../ui/chat-message-builder.mjs";
import { RighteousFuryHelper } from "./righteous-fury-helper.mjs";
import { Sanitizer } from "../sanitizer.mjs";
import { CombatHelper } from "./combat.mjs";

/**
 * Psychic combat helper for Focus Power Tests, Psy Rating, and Phenomena/Perils.
 *
 * Implements the psychic power system from Deathwatch Core p. 188:
 * 1. Select power level (Fettered/Unfettered/Push)
 * 2. Roll Focus Power Test (WP + modifiers, capped at 90)
 * 3. Check for Psychic Phenomena (Push always, Unfettered on doubles)
 * 4. Compute effective Psy Rating for damage/effects
 * 5. Roll Phenomena table → may cascade to Perils of the Warp
 * 6. Apply power effects (damage, opposed test, etc.)
 *
 * Tyranid psykers bypass Phenomena/Perils and take 1d10 Energy damage instead
 * (Hive Mind backlash).
 *
 * @example
 * // Open Focus Power dialog
 * await PsychicCombatHelper.focusPowerDialog(librarian, smitePower);
 */
export class PsychicCombatHelper {
  /** Stored target number for Righteous Fury confirmation (Phase 4) */
  static lastFocusPowerTarget = null;

  /**
   * Calculate effective Psy Rating based on power level.
   *
   * Power levels (Deathwatch Core p. 188):
   * - Fettered: ePR = basePR ÷ 2 (rounded up), no Phenomena
   * - Unfettered: ePR = basePR, Phenomena on doubles
   * - Push: ePR = basePR + 3, always Phenomena, Fatigue on doubles
   *
   * @param {number} basePR - Actor's base Psy Rating
   * @param {string} powerLevel - POWER_LEVELS constant ("fettered", "unfettered", "push")
   * @returns {number} Effective Psy Rating for this manifestation
   * @example
   * const ePR = PsychicCombatHelper.calculateEffectivePsyRating(4, 'push');
   * // Returns: 7 (4 + 3)
   */
  static calculateEffectivePsyRating(basePR, powerLevel) {
    if (powerLevel === POWER_LEVELS.FETTERED) return Math.ceil(basePR / 2);
    if (powerLevel === POWER_LEVELS.PUSH) return basePR + 3;
    return basePR;
  }

  /**
   * Check if a d100 roll has doubles (both digits the same).
   * @param {number} roll - The d100 roll result (1-100)
   * @returns {boolean}
   */
  static isDoubles(roll) {
    const normalized = roll === 100 ? 0 : roll;
    const tens = Math.floor(normalized / 10);
    const units = normalized % 10;
    return tens === units;
  }

  /**
   * Determine psychic side effects based on roll and power level.
   * Push always causes Phenomena. Push + doubles also causes Fatigue.
   * @param {number} roll - The d100 roll result
   * @param {string} powerLevel - POWER_LEVELS value
   * @returns {{ phenomena: boolean, fatigue: boolean }}
   */
  static checkPsychicEffects(roll, powerLevel) {
    if (powerLevel === POWER_LEVELS.FETTERED) {
      return { phenomena: false, fatigue: false };
    }
    if (powerLevel === POWER_LEVELS.PUSH) {
      return { phenomena: true, fatigue: this.isDoubles(roll) };
    }
    // Unfettered
    return { phenomena: this.isDoubles(roll), fatigue: false };
  }

  /**
   * Filter collected modifiers for psychic-test and no-perils effect types.
   *
   * NOTE: This operates on output from ModifierCollector.collectAllModifiers(),
   * NOT WeaponModifierCollector (psychic powers use actor modifiers, not weapon mods).
   *
   * Extracts psychic-specific modifiers from the full modifier list:
   * - psychic-test: Bonus to Focus Power Test target number
   * - no-perils: Suppresses Perils of the Warp (e.g., Psychic Hood)
   *
   * @param {Object[]} allModifiers - From ModifierCollector.collectAllModifiers()
   * @returns {{testBonus: number, noPerils: boolean, noPerilsSource: string, parts: Object[]}} Psychic modifiers
   * @property {number} return.testBonus - Total Focus Power Test bonus
   * @property {boolean} return.noPerils - Whether Perils of the Warp is suppressed
   * @property {string} return.noPerilsSource - Source of no-perils effect (e.g., "Psychic Hood")
   * @property {Object[]} return.parts - Breakdown of individual modifiers
   * @example
   * const allMods = ModifierCollector.collectAllModifiers(actor, itemsArray);
   * const psychicMods = PsychicCombatHelper.collectPsychicModifiers(allMods);
   * // Returns: { testBonus: 10, noPerils: true, noPerilsSource: "Psychic Hood", parts: [...] }
   */
  static collectPsychicModifiers(allModifiers) {
    let testBonus = 0;
    let noPerils = false;
    const parts = [];
    let noPerilsSource = "";

    for (const mod of allModifiers) {
      if (mod.enabled === false) continue;
      if (mod.effectType === "psychic-test") {
        const value = parseInt(mod.modifier) || 0;
        testBonus += value;
        parts.push({ name: mod.name || mod.source, value });
      }
      if (mod.effectType === "no-perils") {
        noPerils = true;
        noPerilsSource = mod.source || mod.name;
      }
    }

    return { testBonus, noPerils, noPerilsSource, parts };
  }

  /**
   * Build target number and modifier breakdown for chat display.
   * Target = WP + wpBonus + psychicTestBonus + misc, capped at 90.
   * @param {number} wp - Willpower value
   * @param {number} wpBonus - Chosen WP bonus (up to 5 × ePR)
   * @param {number} miscModifier - Misc modifier from dialog
   * @param {{ testBonus: number, parts: Array }} psychicModifiers - From collectPsychicModifiers
   * @returns {{ targetNumber: number, modifierParts: string[] }}
   */
  static buildFocusPowerModifiers(wp, wpBonus, miscModifier = 0, psychicModifiers = { testBonus: 0, parts: [] }) {
    const raw = wp + wpBonus + psychicModifiers.testBonus + miscModifier;
    const targetNumber = Math.min(raw, 90);

    const modifierParts = [];
    modifierParts.push(`${wp} Base Willpower`);
    if (wpBonus !== 0) modifierParts.push(`+${wpBonus} Psy Rating Bonus`);
    for (const part of psychicModifiers.parts) {
      if (part.value !== 0) modifierParts.push(`${part.value >= 0 ? "+" : ""}${part.value} ${part.name}`);
    }
    if (miscModifier !== 0) modifierParts.push(`${miscModifier >= 0 ? "+" : ""}${miscModifier} Misc`);
    if (raw > 90) modifierParts.push("(capped at 90)");

    return { targetNumber, modifierParts };
  }

  /**
   * Build the Focus Power chat label (header line).
   * @param {string} powerName
   * @param {number} targetNumber
   * @param {number} effectivePR
   * @param {string} powerLevel
   * @param {boolean} success
   * @param {number} dos - Degrees of success (0 if failed)
   * @param {number} roll - The d100 result
   * @returns {string} HTML label
   */
  static buildFocusPowerLabel(powerName, targetNumber, effectivePR, powerLevel, success, dos, roll) {
    const levelLabel = POWER_LEVEL_LABELS[powerLevel] || powerLevel;
    let resultText;
    if (roll >= 91) {
      resultText = '<strong style="color: red;">FAILED (Automatic failure: 91+)</strong>';
    } else if (success) {
      resultText = `<strong style="color: green;">SUCCESS</strong> (${dos} Degree${dos !== 1 ? "s" : ""} of Success)`;
    } else {
      const dof = Math.floor((roll - targetNumber) / ROLL_CONSTANTS.DEGREES_DIVISOR);
      resultText = `<strong style="color: red;">FAILED</strong> (${dof} Degree${dof !== 1 ? "s" : ""} of Failure)`;
    }
    return `[Focus Power] ${powerName} — Target: ${targetNumber}<br>Effective Psy Rating: ${effectivePR} (${levelLabel})<br>${resultText}`;
  }

  /**
   * Build the full chat flavor with collapsible modifier breakdown.
   * Matches the <details> pattern from buildAttackFlavor in combat-dialog.mjs.
   * @param {string} label - From buildFocusPowerLabel
   * @param {string[]} modifierParts - From buildFocusPowerModifiers
   * @param {string} phenomenaLine - Phenomena/fatigue status lines (HTML)
   * @returns {string} HTML flavor
   */
  static buildFocusPowerFlavor(label, modifierParts, phenomenaLine = "") {
    let flavor = label;
    if (phenomenaLine) flavor += `<br>${phenomenaLine}`;
    if (modifierParts.length > 0) {
      flavor += `<details style="margin-top:4px;"><summary style="cursor:pointer;font-size:0.9em;">Modifiers</summary><div style="font-size:0.85em;margin-top:4px;">${modifierParts.join("<br>")}</div></details>`;
    }
    return flavor;
  }

  /**
   * Build the phenomena/fatigue status lines for chat.
   * @param {{ phenomena: boolean, fatigue: boolean }} effects
   * @param {string} powerLevel
   * @returns {string} HTML lines
   */
  static buildPhenomenaLine(effects, powerLevel) {
    const lines = [];
    if (effects.phenomena) {
      const reason = powerLevel === POWER_LEVELS.PUSH ? "Push!" : "Doubles rolled!";
      lines.push(`⚡ <strong>PSYCHIC PHENOMENA</strong> — ${reason}`);
    }
    if (effects.fatigue) {
      lines.push('💀 <strong>FATIGUE</strong> — Doubles on Push! (+1 Fatigue)');
    }
    return lines.join("<br>");
  }

  /**
   * Substitute PR placeholder in a formula with the effective Psy Rating.
   * @param {string} formula - Formula containing "PR" (e.g., "1d10*PR", "2*PR")
   * @param {number} effectivePR - The effective Psy Rating value
   * @returns {string} Formula with PR replaced
   */
  static substitutePR(formula, effectivePR) {
    if (!formula) return "";
    return formula.replace(/PR/g, String(effectivePR));
  }

  /**
   * Check if an actor is a Tyranid psyker (has the Tyranid trait).
   * Tyranid psykers skip Phenomena/Perils tables and instead take 1d10 Energy backlash damage.
   * @param {Object} actor - Actor document
   * @returns {boolean}
   */
  static isTyranidPsyker(actor) {
    if (!actor?.items) return false;
    const items = actor.items instanceof Map ? Array.from(actor.items.values()) : (actor.items.filter ? actor.items.filter(() => true) : []);
    return items.some(i => i.type === 'trait' && i.name?.toLowerCase() === 'tyranid');
  }

  /**
   * Resolve an opposed Willpower test between psyker and target.
   * @param {number} psykerDoS - Psyker's degrees of success from Focus Power Test
   * @param {number} targetWP - Target's Willpower value
   * @param {number} targetRoll - Target's d100 roll result
   * @param {number} targetMiscMod - Target's misc modifier (optional)
   * @returns {{ targetSuccess: boolean, targetDoS: number, psykerWins: boolean, netDoS: number }}
   */
  static resolveOpposedTest(psykerDoS, targetWP, targetRoll, targetMiscMod = 0) {
    const targetNumber = targetWP + targetMiscMod;
    const targetSuccess = targetRoll <= targetNumber;
    const targetDoS = targetSuccess ? Math.floor((targetNumber - targetRoll) / ROLL_CONSTANTS.DEGREES_DIVISOR) : 0;
    const psykerWins = psykerDoS > targetDoS;
    const netDoS = psykerDoS - targetDoS;
    return { targetSuccess, targetDoS, psykerWins, netDoS, targetNumber };
  }

  /**
   * Build the opposed test result chat message.
   * @param {string} targetName
   * @param {number} targetWP
   * @param {number} targetRoll
   * @param {{ targetSuccess: boolean, targetDoS: number, psykerWins: boolean, netDoS: number, targetNumber: number }} result
   * @param {string} powerName
   * @param {number} psykerDoS
   * @returns {string} HTML content
   */
  static buildOpposedResultMessage(targetName, targetWP, targetRoll, result, powerName, psykerDoS) {
    let msg = `<strong>⚔ Opposed Willpower Test — ${powerName}</strong>`;
    msg += `<br>Psyker: ${psykerDoS} Degree${psykerDoS !== 1 ? "s" : ""} of Success`;
    msg += `<br><strong>${targetName}</strong> WP ${result.targetNumber}: rolled ${targetRoll}`;
    if (result.targetSuccess) {
      msg += ` — <strong style="color: green;">SUCCESS</strong> (${result.targetDoS} DoS)`;
    } else {
      msg += ` — <strong style="color: red;">FAILED</strong> (0 DoS)`;
    }
    if (result.psykerWins) {
      msg += `<br><strong style="color: #9900cc;">POWER MANIFESTS</strong> (${result.netDoS} net DoS)`;
    } else {
      msg += `<br><strong style="color: green;">POWER RESISTED</strong> by ${targetName}`;
    }
    return msg;
  }

  /**
   * Extract status effect suggestions from attached weapon qualities.
   *
   * CRITICAL: This method identifies status effects but does NOT auto-apply them.
   * Status effects are manually enforced by the GM. The system provides information
   * for GM decision-making only.
   *
   * Supported status effects:
   * - Crippling(X): Target takes X Rending damage if taking more than a Half Action
   * - Snared(X): Target's movement is reduced by X meters
   *
   * @param {Array<{key: string, name: string, value: number}>} attachedQualities - Power's attached qualities
   * @returns {Array<{effect: string, value: number, description: string}>} Status effect suggestions for GM
   * @example
   * const qualities = [{ key: 'crippling', name: 'Crippling', value: 3 }];
   * const suggestions = PsychicCombatHelper.getStatusEffectSuggestions(qualities);
   * // Returns: [{ effect: 'crippled', value: 3, description: 'Crippling(3) - Target takes 3 Rending damage...' }]
   */
  static getStatusEffectSuggestions(attachedQualities) {
    if (!attachedQualities || !Array.isArray(attachedQualities)) {
      return [];
    }

    const suggestions = [];

    const crippling = attachedQualities.find(q => q.key === 'crippling');
    if (crippling) {
      suggestions.push({
        effect: 'crippled',
        value: crippling.value,
        description: `Crippling(${crippling.value}) - Target takes ${crippling.value} Rending damage if taking more than Half Action`
      });
    }

    const snare = attachedQualities.find(q => q.key === 'snared');
    if (snare) {
      suggestions.push({
        effect: 'snared',
        value: snare.value,
        description: `Snared(${snare.value}) - Movement reduced by ${snare.value}m`
      });
    }

    return suggestions;
  }

  /**
   * Look up a roll table by name from world tables or compendium.
   * @param {string} tableName
   * @returns {Promise<RollTable|null>}
   */
  /* istanbul ignore next */
  static async _getTable(tableName) {
    let table = game.tables?.getName(tableName);
    if (table) return table;

    const pack = game.packs?.get("deathwatch.tables");
    if (pack) {
      const index = await pack.getIndex();
      const entry = index.find(e => e.name === tableName);
      if (entry) return pack.getDocument(entry._id);
    }
    return null;
  }

  /**
   * Draw from the Psychic Phenomena table.
   * @returns {Promise<Object|null>} The draw result
   */
  /* istanbul ignore next */
  static async rollPhenomena() {
    const table = await this._getTable("Psychic Phenomena");
    if (!table) {
      FoundryAdapter.showNotification("warn", "Psychic Phenomena table not found.");
      return null;
    }
    return await table.draw();
  }

  /**
   * Draw from the Perils of the Warp table.
   * @returns {Promise<Object|null>} The draw result
   */
  /* istanbul ignore next */
  static async rollPerils() {
    const table = await this._getTable("Perils of the Warp");
    if (!table) {
      FoundryAdapter.showNotification("warn", "Perils of the Warp table not found.");
      return null;
    }
    return await table.draw();
  }

  /**
   * Handle Phenomena triggering, including Perils cascade.
   * @param {{ phenomena: boolean, fatigue: boolean }} effects
   * @param {boolean} noPerils - Whether Perils are suppressed
   * @param {string} noPerilsSource - Source name for suppression message
   * @param {Object} actor - Actor document (for fatigue update)
   */
  /* istanbul ignore next */
  static async handlePhenomenaAndFatigue(effects, noPerils, noPerilsSource, actor) {
    if (effects.phenomena) {
      if (this.isTyranidPsyker(actor)) {
        // Tyranid backlash: 1d10 Energy damage, ignores armor and TB
        const backlashRoll = await FoundryAdapter.evaluateRoll('1d10');
        const backlashDamage = backlashRoll.total;
        const currentWounds = actor.system.wounds?.value || 0;
        await FoundryAdapter.updateDocument(actor, {
          'system.wounds.value': currentWounds + backlashDamage
        });
        const speaker = FoundryAdapter.getChatSpeaker(actor);
        const safeActorName = Sanitizer.escape(actor.name);
        await FoundryAdapter.sendRollToChat(backlashRoll, {
          speaker,
          flavor: `<strong>\uD83D\uDC1B Hive Mind Backlash \u2014 ${safeActorName}</strong><br><strong style="color: red;">1d10 Energy Damage (ignores armor & TB): ${backlashDamage}</strong><br><em>Tyranid psyker loses control \u2014 no Phenomena or Perils table roll.</em>`
        });
      } else {
        const draw = await this.rollPhenomena();

        // Check for Perils cascade (Phenomena result 75+)
        if (draw?.results?.[0]) {
          const result = draw.results[0];
          const range = result.range;
          if (range && range[0] >= 75) {
            if (noPerils) {
              const speaker = FoundryAdapter.getChatSpeaker(actor);
              await FoundryAdapter.createChatMessage({
                content: `\uD83D\uDEE1 <strong>Perils of the Warp suppressed</strong> by ${noPerilsSource}`,
                speaker
              });
            } else {
              await this.rollPerils();
            }
          }
        }
      }
    }

    if (effects.fatigue) {
      const currentFatigue = actor.system.fatigue?.value || 0;
      await FoundryAdapter.updateDocument(actor, {
        "system.fatigue.value": currentFatigue + 1
      });
    }
  }

  /**
   * Open the Focus Power dialog and resolve the psychic power manifestation.
   *
   * This is the main entry point for psychic powers. Opens a dialog with:
   * - Power level selection (Fettered/Unfettered/Push)
   * - WP bonus slider (0 to 5×ePR)
   * - Miscellaneous modifier input
   * - Opposed test target selection (for powers like Compel, Dominate)
   *
   * After the Focus Power Test resolves:
   * 1. Checks for Psychic Phenomena/Fatigue
   * 2. Rolls Phenomena table (may cascade to Perils)
   * 3. Rolls damage if power has a damage formula
   * 4. Posts opposed test button if applicable
   *
   * Tyranid psykers skip Phenomena/Perils and take 1d10 Energy damage instead.
   *
   * @param {Actor} actor - Psyker actor
   * @param {Item} power - Psychic power item
   * @returns {Promise<void>} Resolves when power manifestation is complete
   * @example
   * // Standard power usage
   * await PsychicCombatHelper.focusPowerDialog(librarian, smitePower);
   *
   * @example
   * // Opposed test power (Compel, Dominate, Mind Probe)
   * await PsychicCombatHelper.focusPowerDialog(librarian, compelPower);
   * // Dialog includes target selection for opposed WP test
   */
  /* istanbul ignore next */
  static async focusPowerDialog(actor, power) {
    const wp = actor.system.characteristics.wil?.value || 0;
    const basePR = actor.system.psyRating?.value || 0;

    if (basePR <= 0) {
      FoundryAdapter.showNotification("warn", "This actor has no Psy Rating.");
      return;
    }

    // If items has .get() method (Map or test mock), keep it as-is; otherwise convert to array
    const itemsArray = typeof actor.items.get === 'function'
      ? (actor.items instanceof Map ? Array.from(actor.items.values()) : actor.items)
      : Array.from(actor.items);
    const allModifiers = ModifierCollector.collectAllModifiers(actor, itemsArray);
    const psychicMods = this.collectPsychicModifiers(allModifiers);

    const safePowerName = Sanitizer.escape(power.name);
    const content = `
      <div style="text-align: center; margin-bottom: 10px;">
        <img src="${power.img}" alt="${safePowerName}" style="max-width: 100px; max-height: 100px; border: none;" />
      </div>
      <div style="display: flex; gap: 20px; margin-bottom: 8px; font-size: 0.9em;">
        <span><strong>Action:</strong> ${power.system.action || "—"}</span>
        <span><strong>Range:</strong> ${power.system.range || "—"}</span>
      </div>
      <div style="display: flex; gap: 20px; margin-bottom: 8px; font-size: 0.9em;">
        <span><strong>Opposed:</strong> ${power.system.opposed || "No"}</span>
        <span><strong>Sustained:</strong> ${power.system.sustained || "No"}</span>
      </div>
      <div class="form-group">
        <label>Power Level:</label>
        <select id="powerLevel" name="powerLevel">
          <option value="${POWER_LEVELS.FETTERED}">Fettered (PR ÷ 2, no Phenomena)</option>
          <option value="${POWER_LEVELS.UNFETTERED}" selected>Unfettered (Full PR, doubles risk)</option>
          <option value="${POWER_LEVELS.PUSH}">Push (+3 PR, auto Phenomena, Fatigue on doubles)</option>
        </select>
      </div>
      <div class="form-group" style="display: flex; gap: 20px; align-items: center;">
        <span><strong>Effective PR:</strong> <span id="effectivePR">${basePR}</span></span>
        <span><strong>WP Bonus:</strong> <input type="number" id="wpBonus" value="${5 * basePR}" min="0" max="${5 * basePR}" style="width: 50px;" /></span>
        <span style="font-size: 0.85em; color: #666;">(max +<span id="wpBonusMax">${5 * basePR}</span>)</span>
      </div>
      <div class="form-group">
        <label>Modifier:</label>
        <input type="text" id="miscModifier" name="miscModifier" value="0" />
      </div>
    `;

    await foundry.applications.api.DialogV2.wait({
      window: { title: `Focus Power: ${safePowerName}` },
      content,
      render: (event, dialog) => {
        const el = dialog.element;
        const miscInput = el.querySelector("#miscModifier");
        if (miscInput) miscInput.addEventListener("input", function () {
          this.value = this.value.replace(/[^0-9+\-]/g, "");
        });
        const levelSelect = el.querySelector("#powerLevel");
        if (levelSelect) levelSelect.addEventListener("change", () => {
          const level = levelSelect.value;
          const ePR = PsychicCombatHelper.calculateEffectivePsyRating(basePR, level);
          const maxBonus = 5 * ePR;
          el.querySelector("#effectivePR").textContent = ePR;
          const wpInput = el.querySelector("#wpBonus");
          wpInput.max = maxBonus;
          wpInput.value = maxBonus;
          el.querySelector("#wpBonusMax").textContent = maxBonus;
        });
      },
      buttons: [
        {
          label: "Focus Power", action: "focus",
          callback: async (event, button, dialog) => {
            const el = dialog.element;
            const powerLevel = el.querySelector("#powerLevel").value;
            const miscModifier = parseInt(el.querySelector("#miscModifier").value) || 0;
            const effectivePR = PsychicCombatHelper.calculateEffectivePsyRating(basePR, powerLevel);
            const maxWpBonus = 5 * effectivePR;
            const wpBonus = Math.min(Math.max(parseInt(el.querySelector("#wpBonus").value) || 0, 0), maxWpBonus);
            const { targetNumber, modifierParts } = PsychicCombatHelper.buildFocusPowerModifiers(wp, wpBonus, miscModifier, psychicMods);

            this.lastFocusPowerTarget = targetNumber;

            const hitRoll = await FoundryAdapter.evaluateRoll("1d100");
            const roll = hitRoll.total;
            const autoFail = roll >= 91;
            const success = !autoFail && roll <= targetNumber;
            const dos = success ? CombatDialogHelper.calculateDegreesOfSuccess(roll, targetNumber) : 0;

            const effects = this.checkPsychicEffects(roll, powerLevel);
            const label = this.buildFocusPowerLabel(power.name, targetNumber, effectivePR, powerLevel, success, dos, roll);
            const phenomenaLine = this.buildPhenomenaLine(effects, powerLevel);
            const flavor = this.buildFocusPowerFlavor(label, modifierParts, phenomenaLine);

            const speaker = FoundryAdapter.getChatSpeaker(actor);

            // Wrap successful manifestations with animation metadata
            if (success) {
              // Render roll to HTML
              const rollHtml = await hitRoll.render();

              // Capture token information for animation
              const sourceToken = actor.getActiveTokens()[0];
              const targetToken = game.user.targets?.first();

              // Create attack chat message (psychic powers don't need damage-type/weapon-class)
              await CombatHelper.createAttackChatMessage(actor, power, hitRoll, flavor, 'psychic', {
                attackerToken: sourceToken,
                targetToken,
                powerLevel
              });
            } else {
              // Failed manifestation - no wrapper, no animation
              await FoundryAdapter.sendRollToChat(hitRoll, { speaker, flavor });
            }

            // Add Oppose button for opposed powers when psyker succeeds
            if (success && power.system.opposed?.toLowerCase() === "yes") {
              const targetToken = game.user.targets?.first();
              const targetName = targetToken?.actor?.name || "Target";
              const targetId = targetToken?.actor?.id || "";
              const targetWP = targetToken?.actor?.system?.characteristics?.wil?.value || 0;
              const sceneId = targetToken?.document?.parent?.id || "";
              const tokenId = targetToken?.document?.id || "";
              const safePowerNameData = Sanitizer.escape(power.name);
              const safeTargetNameData = Sanitizer.escape(targetName);
              const safeTargetNameDisplay = Sanitizer.escape(targetName);
              const opposeContent = `<button class="psychic-oppose-btn" data-power-name="${safePowerNameData}" data-psyker-dos="${dos}" data-target-name="${safeTargetNameData}" data-target-id="${targetId}" data-target-wp="${targetWP}" data-scene-id="${sceneId}" data-token-id="${tokenId}">⚔ Opposed Willpower Test: ${safeTargetNameDisplay} (WP ${targetWP})</button>`;
              await FoundryAdapter.createChatMessage({ content: opposeContent, speaker });
            }

            await PsychicCombatHelper.handlePhenomenaAndFatigue(effects, psychicMods.noPerils, psychicMods.noPerilsSource, actor);

            if (success && power.system.damageFormula) {
              await PsychicCombatHelper._rollPsychicDamage(actor, power, effectivePR, targetNumber, dos);
            }
          }
        },
        { label: "Cancel", action: "cancel" }
      ]
    });
  }

  /**
   * Roll psychic power damage after a successful Focus Power Test.
   *
   * Supports weapon qualities attached to psychic powers:
   * - Tearing: Roll damage twice and take the higher result
   * - Tainted: Add actor's Corruption Bonus to damage
   *
   * @param {Object} actor - Actor document
   * @param {Object} power - Psychic power item
   * @param {number} effectivePR - Effective Psy Rating used
   * @param {number} targetNumber - Focus Power target number (for Righteous Fury)
   * @param {number} dos - Degrees of success
   */
  /* istanbul ignore next */
  static async _rollPsychicDamage(actor, power, effectivePR, targetNumber, dos) {
    const damageFormula = this.substitutePR(power.system.damageFormula, effectivePR);

    // Calculate penetration - evaluate formula after PR substitution
    let penetration = 0;
    if (power.system.penetrationFormula) {
      const penFormula = this.substitutePR(power.system.penetrationFormula, effectivePR);
      try {
        // Use Function constructor to safely evaluate arithmetic expressions like "2*4"
        penetration = Function(`'use strict'; return (${penFormula})`)();
      } catch (e) {
        // Fallback to parseInt for simple numbers
        penetration = parseInt(penFormula) || 0;
      }
    }

    const damageType = power.system.damageType || "Energy";

    const targetToken = game.user.targets?.first();
    const targetActor = targetToken?.actor;
    const tokenInfo = targetToken?.document ? { sceneId: targetToken.document.parent.id, tokenId: targetToken.document.id } : null;

    // Check for weapon qualities (can be string or object with id property)
    const hasFlame = power.system.attachedQualities?.some(q => (typeof q === 'string' ? q : q.id) === 'flame');
    const hasTearing = power.system.attachedQualities?.some(q => (typeof q === 'string' ? q : q.id) === 'tearing');
    const hasTainted = power.system.attachedQualities?.some(q => (typeof q === 'string' ? q : q.id) === 'tainted');

    // Flame quality: create flamer-style chat message for Flame Attack macro consumption
    if (hasFlame) {
      const damageRoll = await FoundryAdapter.evaluateRoll(damageFormula);
      const damage = damageRoll.total;
      const range = parseInt(power.system.range?.match(/\d+/)?.[0]) || 30; // Extract first number from range string
      const timestamp = Date.now();
      const safePowerName = Sanitizer.escape(power.name);

      // Play flame animation if target is selected (optional)
      const attackerToken = actor.getActiveTokens?.()?.[0] || game.canvas?.tokens?.controlled?.[0];

      if (attackerToken && targetToken) {
        const { AnimationHelper } = await import('../ui/animation-helper.mjs');
        const librariesAvailable = AnimationHelper.areAnimationLibrariesAvailable();

        if (librariesAvailable) {
          const flameConfig = AnimationHelper.getAnimationConfig('flame');
          await AnimationHelper.playWeaponAnimation(attackerToken, targetToken, flameConfig, 1);
        }
      }

      await CombatHelper.createFlamerDamageMessage(actor, power.name, damageRoll, {
        damage,
        penetration,
        damageType,
        range,
        title: 'Psychic Flame'
      });

      return; // Exit early for flame powers
    }

    // Horde hit calculation
    let numHits = 1;
    if (targetActor?.type === "horde") {
      numHits = targetActor.system.calculateHitsReceived({
        isPsychic: true,
        effectivePR
      });
    }

    const isHordeTarget = targetActor?.type === "horde";
    const hordeHitResults = [];

    for (let i = 0; i < numHits; i++) {
      let damageRoll = await FoundryAdapter.evaluateRoll(damageFormula);

      // Apply Tearing: roll twice, take higher
      if (hasTearing) {
        const roll2 = await FoundryAdapter.evaluateRoll(damageFormula);
        if (roll2.total > damageRoll.total) {
          damageRoll = roll2;
        }
      }

      let totalDamage = damageRoll.total;

      // Apply Tainted: add Corruption Bonus
      if (hasTainted) {
        const corruptionBonus = Math.floor((actor.system.corruption?.current || 0) / 10);
        totalDamage += corruptionBonus;
      }

      // Righteous Fury check
      if (actor.system.canRighteousFury?.() && RighteousFuryHelper.hasNaturalTen(damageRoll, 10) && targetNumber > 0) {
        const { totalDamage: furyDamage } = await RighteousFuryHelper.processFuryChain(
          actor, null, damageFormula, targetNumber, "Body", false, 10, targetActor
        );
        totalDamage += furyDamage;
      }

      if (isHordeTarget) {
        hordeHitResults.push({ damage: totalDamage, penetration, location: "Body", damageType });
      } else {
        const applyButton = targetToken ? ChatMessageBuilder.createDamageApplyButton({
          damage: totalDamage, penetration, location: "Body", targetId: targetActor.id,
          damageType, degreesOfSuccess: dos, tokenInfo
        }) : "";

        const hitInfo = numHits > 1 ? ` (${i + 1}/${numHits})` : "";
        const safePowerName = Sanitizer.escape(power.name);
        const flavor = `<strong style="font-size: 1.1em;">\uD83D\uDD2E ${safePowerName}${hitInfo}</strong><br><strong>Penetration:</strong> ${penetration} | <strong>Type:</strong> ${damageType}<br>${applyButton}`;
        const speaker = FoundryAdapter.getChatSpeaker(actor);
        await FoundryAdapter.sendRollToChat(damageRoll, { speaker, flavor });
      }
    }

    if (isHordeTarget && hordeHitResults.length > 0) {
      await targetActor.system.receiveBatchDamage(hordeHitResults);
    }
  }
}
