import { CORRUPTION } from '../constants/index.mjs';
import { FoundryAdapter } from '../foundry-adapter.mjs';
import { Sanitizer } from '../sanitizer.mjs';

/**
 * Helper functions for the Corruption system.
 *
 * Manages corruption point tracking and character removal at Purity Threshold.
 * Source: Deathwatch Core Rulebook p. 216
 */
export class CorruptionHelper {

  /**
   * Add corruption points to a character.
   *
   * Non-pure - uses Foundry API via FoundryAdapter.
   *
   * @param {DeathwatchActor} actor - The character gaining corruption
   * @param {number} points - Number of corruption points to add
   * @param {string} source - Description of corruption source
   * @param {string} [missionId] - Optional mission ID for tracking
   * @returns {Promise<void>}
   */
  static async addCorruption(actor, points, source, missionId = null) {
    const newTotal = (actor.system.corruption || 0) + points;

    const entry = {
      points,
      source,
      timestamp: Date.now(),
      missionId: missionId || ""
    };

    const history = [...(actor.system.corruptionHistory || []), entry];

    await FoundryAdapter.updateDocument(actor, {
      "system.corruption": newTotal,
      "system.corruptionHistory": history
    });

    // Check for threshold breach
    if (newTotal >= CORRUPTION.PURITY_THRESHOLD) {
      await this.handleCharacterRemoval(actor, "corruption");
    }

    // Post to chat
    await this.postCorruptionMessage(actor, points, source, newTotal);
  }

  /**
   * Calculate suggested Fellowship penalty based on corruption.
   *
   * Pure function - testable without Foundry.
   *
   * Suggested narrative penalty: -10 per 25 CP over 50.
   * This is not a hard mechanical rule, but a GM guideline.
   *
   * @param {number} corruption - Current corruption points
   * @returns {number} Suggested Fellowship penalty (negative number)
   */
  static getFellowshipPenalty(corruption) {
    if (corruption < 50) return 0;
    const penalty = Math.floor((corruption - 50) / 25) * -10;
    return penalty === -0 ? 0 : penalty; // Avoid -0
  }

  /**
   * Handle character removal when reaching 100 Corruption Points.
   *
   * Non-pure - uses Foundry API via FoundryAdapter.
   *
   * @param {DeathwatchActor} actor - The character being removed
   * @param {string} reason - Reason for removal ("corruption" or "insanity")
   * @returns {Promise<void>}
   */
  static async handleCharacterRemoval(actor, reason) {
    const actorName = Sanitizer.escape(actor.name);
    const points = reason === "insanity" ? actor.system.insanity : actor.system.corruption;
    const pointType = reason === "insanity" ? "Insanity Points" : "Corruption Points";

    const content = `
      <p><strong>${actorName}</strong> has reached ${points} ${pointType}.</p>
      <p>${reason === "insanity"
        ? "Their mind has been completely shattered by the horrors they have witnessed."
        : "Their taint is too great to continue serving the Emperor."
      }</p>
      <p>The Battle-Brother can no longer continue in active duty.</p>
      <p class="warning">What would you like to do?</p>
    `;

    await FoundryAdapter.showDialog({
      title: `${actorName} Has Fallen`,
      content,
      buttons: {
        archive: {
          icon: '<i class="fas fa-archive"></i>',
          label: "Archive Character",
          callback: async () => {
            await this._archiveCharacter(actor, reason);
          }
        },
        keep: {
          icon: '<i class="fas fa-lock"></i>',
          label: "Keep in World (Locked)",
          callback: async () => {
            await this._markCharacterFallen(actor, reason);
          }
        },
        delay: {
          icon: '<i class="fas fa-hourglass-half"></i>',
          label: "Delay (1 Session)",
          callback: () => {
            FoundryAdapter.showNotification("info", `${actorName} granted one final session.`);
          }
        }
      },
      default: "archive"
    });
  }

  /**
   * Archive a fallen character to compendium.
   *
   * @param {DeathwatchActor} actor - The character to archive
   * @param {string} reason - Reason for archival
   * @returns {Promise<void>}
   * @private
   */
  static async _archiveCharacter(actor, reason) {
    // TODO: Implement archival logic (Phase 2)
    FoundryAdapter.showNotification("info", `${actor.name} would be archived (not yet implemented).`);
  }

  /**
   * Mark a character as fallen and lock their sheet.
   *
   * @param {DeathwatchActor} actor - The character to mark
   * @param {string} reason - Reason for fallen status
   * @returns {Promise<void>}
   * @private
   */
  static async _markCharacterFallen(actor, reason) {
    // TODO: Implement fallen status (Phase 2)
    FoundryAdapter.showNotification("info", `${actor.name} would be marked as fallen (not yet implemented).`);
  }

  /**
   * Post corruption gain message to chat.
   *
   * Non-pure - uses Foundry API via FoundryAdapter.
   *
   * @param {DeathwatchActor} actor - The character gaining corruption
   * @param {number} points - Corruption points gained
   * @param {string} source - Source description
   * @param {number} newTotal - New total corruption points
   * @returns {Promise<void>}
   */
  static async postCorruptionMessage(actor, points, source, newTotal) {
    const actorName = Sanitizer.escape(actor.name);
    const sourceText = Sanitizer.escape(source);
    const threshold = CORRUPTION.PURITY_THRESHOLD;
    const nearThreshold = newTotal >= (threshold - 10);

    const content = `
      <div class="corruption-gain deathwatch-chat-card">
        <h3>⚠ Corruption</h3>
        <p><strong>${actorName}</strong> gains <strong>${points} CP</strong></p>
        <p><em>Source: ${sourceText}</em></p>
        <p>Total: <strong>${newTotal} CP</strong> / ${threshold}</p>
        ${nearThreshold && newTotal < threshold
          ? '<p class="warning">⚠ Nearing Purity Threshold!</p>'
          : ''}
        ${newTotal >= threshold
          ? '<p class="critical">⚠⚠⚠ PURITY THRESHOLD BREACHED ⚠⚠⚠</p>'
          : ''}
      </div>
    `;

    await FoundryAdapter.createChatMessage({
      speaker: FoundryAdapter.getChatSpeaker({ actor }),
      content
    });
  }
}
