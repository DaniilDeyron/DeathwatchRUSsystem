import { FoundryAdapter } from '../foundry-adapter.mjs';
import { Sanitizer } from '../sanitizer.mjs';

/**
 * Helper for horde breaking mechanics (Deathwatch Core p. 360).
 *
 * Breaking rules:
 * - When horde loses 25%+ magnitude in a single turn, must test at turn start
 * - Willpower test with -10 penalty if below 50% of starting magnitude
 * - Auto-breaks if below 25% of starting magnitude (unless Disciplined trait)
 * - Disciplined trait: no -10 penalty and no auto-break at <25%
 */
export class HordeBreakingHelper {

  /**
   * Check if horde should make a breaking test at start of its turn.
   * Called by combat turn start hook (GM only).
   *
   * @param {Actor} actor - Horde actor
   * @returns {Promise<Object>} Breaking check result
   * @property {boolean} return.shouldCheck - Whether any check is needed
   * @property {boolean} return.autoBreaks - Whether horde auto-breaks
   * @property {boolean} return.needsTest - Whether WP test is needed
   * @property {number} return.penalty - WP test penalty
   * @property {number} return.percentLost - Percentage lost this turn
   * @property {number} return.currentPercent - Current magnitude percentage
   */
  static async checkBreaking(actor) {
    if (actor.type !== 'horde') {
      return { shouldCheck: false };
    }

    const horde = actor.system;
    const magnitudeLost = horde.magnitudeThisTurn || 0;
    const maxMagnitude = horde.wounds.max || 0;
    const currentMagnitude = maxMagnitude - (horde.wounds.value || 0);

    // Calculate percentages
    const percentLost = (magnitudeLost / maxMagnitude) * 100;
    const currentPercent = (currentMagnitude / maxMagnitude) * 100;

    // Check for Disciplined trait
    const hasDisciplined = actor.items.some(i =>
      i.type === 'trait' &&
      (i.name === 'Disciplined' || i.name === 'Disciplined (Horde)')
    );

    // Auto-break if <25% magnitude (unless Disciplined) - always check, regardless of damage this turn
    if (currentPercent < 25 && !hasDisciplined) {
      return {
        shouldCheck: true,
        autoBreaks: true,
        needsTest: false,
        percentLost,
        currentPercent,
        hasDisciplined
      };
    }

    // No WP test needed if didn't lose 25%+ this turn
    if (percentLost < 25) {
      return {
        shouldCheck: false,
        percentLost,
        currentPercent
      };
    }

    // Need WP test - lost 25%+ this turn and above 25% magnitude
    const penalty = (currentPercent < 50 && !hasDisciplined) ? -10 : 0;

    return {
      shouldCheck: true,
      autoBreaks: false,
      needsTest: true,
      penalty,
      percentLost,
      currentPercent,
      hasDisciplined
    };
  }

  /**
   * Prompt GM for horde breaking test.
   * Shows dialog with WP test, auto-rolls and applies result.
   *
   * @param {Actor} actor - Horde actor
   * @param {Object} checkResult - Result from checkBreaking()
   * @returns {Promise<boolean>} True if horde holds, false if breaks
   */
  static async promptBreakingTest(actor, checkResult) {
    const { penalty, percentLost, currentPercent } = checkResult;
    const wp = actor.system.characteristics.wil?.value || 0;
    const targetNumber = wp + penalty;

    const safeActorName = Sanitizer.escape(actor.name);
    const content = `
      <div class="horde-breaking-test" style="color: #f0f0f0;">
        <p style="color: #f0f0f0;"><strong>${safeActorName}</strong> потеряла <strong style="color: #ff6666;">${percentLost.toFixed(0)}%</strong> Численности за прошлый ход!</p>
        <p style="color: #f0f0f0;"><strong>Оставшаяся Численность:</strong> ${currentPercent.toFixed(0)}%</p>
        <hr style="border-color: #666;">
        <p style="color: #f0f0f0;"><strong>Базовая Сила воли:</strong> ${wp} ${penalty !== 0 ? `(${penalty} below 50%)` : ''}</p>
        <div style="margin: 10px 0;">
          <label for="situational-modifier" style="display: block; margin-bottom: 4px; color: #f0f0f0;">
            <strong>Ситуативный модификатор:</strong>
          </label>
          <input type="number" id="situational-modifier" name="situational-modifier" value="0"
                 style="width: 80px; padding: 4px; background: #2a2a2a; color: #f0f0f0; border: 1px solid #555;" step="10" />
          <span style="margin-left: 8px; font-size: 0.9em; color: #bbb;">(+10 за преимущество, −10 за сложность)</span>
        </div>
        <p style="color: #f0f0f0;"><strong>Базовое целевое значение:</strong> <span id="target-display">${targetNumber}</span></p>
        <p class="notification info" style="color: #88ccff; background: #1a3a4a; padding: 8px; border-radius: 4px;">Бросьте 1к100 ≤ целевого значения, иначе Орда впадёт в панику!</p>
      </div>
      <script>
        document.getElementById('situational-modifier').addEventListener('input', (e) => {
          const modifier = parseInt(e.target.value) || 0;
          const newTarget = ${targetNumber} + modifier;
          document.getElementById('target-display').textContent = newTarget;
        });
      </script>
    `;

    const result = await foundry.applications.api.DialogV2.wait({
      window: { title: `${actor.name} — проверка на панику Орды` },
      content,
      buttons: [
        {
          label: "Проверить",
          action: "roll",
          callback: async (event, button, dialog) => {
            const modifierInput = dialog.element.querySelector('#situational-modifier');
            const situationalModifier = parseInt(modifierInput?.value) || 0;
            const finalTarget = targetNumber + situationalModifier;

            const roll = await new Roll('1d100').evaluate();
            const success = roll.total <= finalTarget;

            const flavorParts = [`<strong>Проверка на панику Орды</strong>`];
            if (penalty !== 0) flavorParts.push(`Сила воли ${wp}; штраф ${penalty} (Численность ниже 50%)`);
            if (situationalModifier !== 0) flavorParts.push(`Ситуативный модификатор: ${situationalModifier > 0 ? '+' : ''}${situationalModifier}`);
            flavorParts.push(`Целевое значение: ${finalTarget}`);
            flavorParts.push(success ? '✅ <strong style="color: green;">ОРДА ДЕРЖИТСЯ!</strong>' : '❌ <strong style="color: red;">ОРДА ВПАДАЕТ В ПАНИКУ!</strong>');

            await roll.toMessage({
              speaker: FoundryAdapter.getChatSpeaker(actor),
              flavor: flavorParts.join('<br>'),
              whisper: [game.user.id]
            });

            if (!success) {
              await this.applyBroken(actor, false);
            }

            return success;
          }
        },
        {
          label: "Cancel",
          action: "cancel"
        }
      ],
      default: "roll"
    });

    return result === "roll";
  }

  /**
   * Apply Broken status to horde.
   * Sets "broken" condition, marks defeated in combat tracker, posts message.
   *
   * @param {Actor} actor - Horde actor
   * @param {boolean} autoBreak - Whether this is an automatic break (vs failed test)
   * @returns {Promise<void>}
   */
  static async applyBroken(actor, autoBreak = false) {
    // Apply Broken condition (horde scattered but not dead)
    if (actor.setCondition) {
      await actor.setCondition('broken', true);
    }

    const safeActorName = Sanitizer.escape(actor.name);
    const horde = actor.system;
    const maxMagnitude = horde.wounds.max || 0;
    const currentMagnitude = maxMagnitude - (horde.wounds.value || 0);
    const currentPercent = ((currentMagnitude / maxMagnitude) * 100).toFixed(0);

    const reason = autoBreak
      ? `<p style="color: #ff4444; font-weight: bold;">Численность ниже 25% (${currentPercent}%): Орда автоматически впадает в панику.</p>`
      : `<p style="color: #ff4444; font-weight: bold;">Проверка Силы воли провалена.</p>`;

    await FoundryAdapter.createChatMessage({
      content: `
        <div class="horde-broken" style="border: 3px solid #cc0000; padding: 12px; background: rgba(139, 0, 0, 0.2);">
          <h3 style="color: #ff0000; margin-top: 0; font-weight: bold; text-shadow: 0 0 10px #ff0000;">💀 ОРДА РАССЕЯЛАСЬ!</h3>
          <p style="font-size: 1.1em;"><strong style="color: #ffffff;">${safeActorName}</strong> <span style="color: #ffffff;">распалась и разбегается по полю боя.</span></p>
          ${reason}
          <p style="font-size: 0.95em; color: #dddddd;"><em>Отдельные существа обращаются в бегство, прячутся или выслеживают врагов в соответствии со своей природой.</em></p>
        </div>
      `,
      speaker: FoundryAdapter.getChatSpeaker(actor)
    });

    // Mark defeated in combat tracker (optional - combat tracker syncs with dead status automatically)
    if (game.combat) {
      const combatant = game.combat.combatants.find(c => c.actorId === actor.id);
      if (combatant) {
        await combatant.update({ defeated: true });
      }
    }
  }

  /**
   * Reset magnitude-this-turn counter.
   * Called at start of horde's turn after breaking check.
   *
   * @param {Actor} actor - Horde actor
   * @returns {Promise<void>}
   */
  static async resetTurnCounter(actor) {
    if (actor.type === 'horde') {
      await FoundryAdapter.updateDocument(actor, {
        "system.magnitudeThisTurn": 0
      });
    }
  }
}
