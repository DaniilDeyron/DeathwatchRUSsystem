import { INSANITY_TRACK, ROLL_CONSTANTS, BATTLE_TRAUMA, INSANITY_REDUCTION } from '../constants/index.mjs';
import { FoundryAdapter } from '../foundry-adapter.mjs';
import { Sanitizer } from '../sanitizer.mjs';
import { Logger } from '../logger.mjs';

/**
 * Helper functions for the Insanity system.
 *
 * Manages insanity point tracking, insanity tests, and battle trauma acquisition.
 * Source: Deathwatch Core Rulebook p. 216-217
 */
export class InsanityHelper {

  /**
   * Get insanity track level for a given insanity point value.
   *
   * Pure function - testable without Foundry.
   *
   * @param {number} insanityPoints - Current insanity points
   * @returns {number} Track level (0-3)
   */
  static getTrackLevel(insanityPoints) {
    if (insanityPoints <= INSANITY_TRACK.THRESHOLD_1) return 0;
    if (insanityPoints <= INSANITY_TRACK.THRESHOLD_2) return 1;
    if (insanityPoints <= INSANITY_TRACK.THRESHOLD_3) return 2;
    if (insanityPoints < INSANITY_TRACK.REMOVAL) return 3;
    return 0; // Removed from play at 100 IP
  }

  /**
   * Get trauma test modifier for current track level.
   *
   * Pure function - testable without Foundry.
   *
   * @param {number} insanityPoints - Current insanity points
   * @returns {number} Modifier to apply to insanity tests
   */
  static getTraumaModifier(insanityPoints) {
    const level = this.getTrackLevel(insanityPoints);
    return INSANITY_TRACK.MODIFIERS[`LEVEL_${level}`];
  }

  /**
   * Add insanity points to a character and trigger tests if needed.
   *
   * Non-pure - uses Foundry API via FoundryAdapter.
   *
   * @param {DeathwatchActor} actor - The character gaining insanity
   * @param {number} points - Number of insanity points to add
   * @param {string} source - Description of insanity source
   * @param {string} [missionId] - Optional mission ID for tracking
   * @returns {Promise<void>}
   */
  static async addInsanity(actor, points, source, missionId = null) {
    Logger.category('CHARACTER.INSANITY').debug( 'Adding insanity', { actor: actor.name, points, source, oldTotal: actor.system.insanity });
    const oldTotal = actor.system.insanity || 0;
    const newTotal = oldTotal + points;

    const entry = {
      points,
      source,
      timestamp: Date.now(),
      missionId: missionId || "",
      testRolled: false,
      testResult: "",
      testModifiers: 0
    };

    const history = [...(actor.system.insanityHistory || []), entry];

    // Check if we crossed a 10-point boundary
    const oldThreshold = Math.floor(oldTotal / INSANITY_TRACK.TEST_INTERVAL);
    const newThreshold = Math.floor(newTotal / INSANITY_TRACK.TEST_INTERVAL);
    let lastTestAt = actor.system.lastInsanityTestAt || 0;

    // Reset lastTestAt if current insanity is below the last test threshold
    // (handles cases where insanity was reduced via GM adjustment)
    if (oldThreshold < lastTestAt) {
      lastTestAt = oldThreshold;
      Logger.category('CHARACTER.INSANITY').debug( 'Resetting lastTestAt due to reduced insanity', {
        from: actor.system.lastInsanityTestAt,
        to: lastTestAt
      });
    }

    const updateData = {
      "system.insanity": newTotal,
      "system.insanityHistory": history
    };

    // Update lastTestAt if we reset it
    if (lastTestAt !== actor.system.lastInsanityTestAt) {
      updateData["system.lastInsanityTestAt"] = lastTestAt;
    }

    await FoundryAdapter.updateDocument(actor, updateData);

    Logger.category('CHARACTER.INSANITY').debug( 'Threshold check', {
      oldTotal,
      newTotal,
      oldThreshold,
      newThreshold,
      lastTestAt,
      shouldTest: newThreshold > oldThreshold && newThreshold > lastTestAt
    });

    // Post to chat first (so it appears before test dialog)
    await this.postInsanityMessage(actor, points, source, newTotal);

    if (newThreshold > oldThreshold && newThreshold > lastTestAt) {
      // Trigger insanity test
      Logger.category('CHARACTER.INSANITY').debug( 'Triggering insanity test', { threshold: newThreshold });
      await this.promptInsanityTest(actor, newThreshold);
    }

    // Check for removal
    if (newTotal >= INSANITY_TRACK.REMOVAL) {
      await this.handleCharacterRemoval(actor, "insanity");
    }
  }

  /**
   * Prompt player to roll an insanity test with modifier dialog.
   *
   * Non-pure - uses Foundry API via FoundryAdapter.
   *
   * @param {DeathwatchActor} actor - The character testing
   * @param {number} threshold - The 10-point threshold crossed
   * @returns {Promise<void>}
   */
  static async promptInsanityTest(actor, threshold) {
    Logger.category('CHARACTER.INSANITY').debug( 'Prompting insanity test', { actor: actor.name, threshold, insanity: actor.system.insanity });
    const trackLevel = this.getTrackLevel(actor.system.insanity);
    const trackModifier = INSANITY_TRACK.MODIFIERS[`LEVEL_${trackLevel}`];
    const wp = actor.system.characteristics?.wil?.value || 0;
    const actorName = Sanitizer.escape(actor.name);

    const content = `
      <form class="insanity-test-dialog deathwatch-dialog">
        <div class="form-group">
          <p><strong>${actorName}</strong> has gained significant mental trauma.</p>
          <p>Current Insanity: <strong>${actor.system.insanity}</strong> (Track Level ${trackLevel})</p>
          <p class="warning">If you fail, you will gain a Battle Trauma.</p>
        </div>

        <div class="form-group">
          <label>Base Willpower:</label>
          <input type="number" name="base-wp" value="${wp}" readonly />
        </div>

        <div class="form-group">
          <label>Track Modifier (Level ${trackLevel}):</label>
          <input type="number" name="track-modifier" value="${trackModifier}" readonly />
        </div>

        <div class="form-group">
          <label>Situational Modifier:</label>
          <input type="number" name="situational-modifier" value="0" autofocus />
          <p class="hint">Enter any situational bonuses or penalties</p>
        </div>

        <div class="form-group">
          <label>Target Number:</label>
          <input type="number" name="target" value="${wp + trackModifier}" readonly class="target-display" />
        </div>
      </form>
    `;

    await FoundryAdapter.showDialog({
      title: "Insanity Test Required",
      content,
      buttons: {
        roll: {
          icon: '<i class="fas fa-dice-d20"></i>',
          label: "Roll Insanity Test",
          callback: async (html) => {
            const situationalMod = parseInt(html.find('[name="situational-modifier"]').val()) || 0;
            const finalTarget = wp + trackModifier + situationalMod;

            await this.rollInsanityTest(actor, {
              wp,
              trackModifier,
              situationalMod,
              finalTarget,
              threshold
            });
          }
        },
        later: {
          icon: '<i class="fas fa-clock"></i>',
          label: "Roll Later",
          callback: () => {
            FoundryAdapter.showNotification("warn", `${actorName} must roll an insanity test before next session.`);
          }
        }
      },
      default: "roll",
      render: (html) => {
        // Update target number dynamically as modifier changes
        html.find('[name="situational-modifier"]').on('input', (event) => {
          const situationalMod = parseInt(event.target.value) || 0;
          const target = wp + trackModifier + situationalMod;
          html.find('.target-display').val(target);
        });
      }
    });
  }

  /**
   * Execute insanity test and handle result.
   *
   * Non-pure - uses Foundry API via FoundryAdapter.
   *
   * @param {DeathwatchActor} actor - The character testing
   * @param {Object} testData - Test parameters
   * @param {number} testData.wp - Base willpower
   * @param {number} testData.trackModifier - Track level modifier
   * @param {number} testData.situationalMod - Situational modifier
   * @param {number} testData.finalTarget - Final target number
   * @param {number} testData.threshold - Threshold crossed
   * @returns {Promise<void>}
   */
  static async rollInsanityTest(actor, testData) {
    const { wp, trackModifier, situationalMod, finalTarget, threshold } = testData;

    const roll = await FoundryAdapter.evaluateRoll("1d100");
    const success = roll.total <= finalTarget;
    const dos = Math.floor((finalTarget - roll.total) / ROLL_CONSTANTS.DEGREES_DIVISOR);

    // Update test record in history
    const history = [...actor.system.insanityHistory];
    const lastEntry = history[history.length - 1];
    if (lastEntry) {
      lastEntry.testRolled = true;
      lastEntry.testResult = success ? `Success (${dos} DoS)` : `Failure (${Math.abs(dos)} DoF)`;
      // Store the total target number (schema expects integer, not object)
      lastEntry.testModifiers = finalTarget;
    }

    await FoundryAdapter.updateDocument(actor, {
      "system.insanityHistory": history,
      "system.lastInsanityTestAt": threshold
    });

    // Build modifier breakdown for chat
    const modifierParts = [];
    modifierParts.push(`Base WP: ${wp}`);
    if (trackModifier !== 0) {
      modifierParts.push(`Track Modifier: ${trackModifier > 0 ? '+' : ''}${trackModifier}`);
    }
    if (situationalMod !== 0) {
      modifierParts.push(`Situational: ${situationalMod > 0 ? '+' : ''}${situationalMod}`);
    }

    const actorName = Sanitizer.escape(actor.name);

    // Build label similar to attack messages
    const resultLabel = success
      ? `<strong style="color: #00ff88; text-shadow: 0 0 2px rgba(0, 255, 136, 0.5); font-size: 1.2em;">✓</strong> The Battle-Brother resists the trauma.`
      : `<strong style="color: #ff4444; text-shadow: 0 0 2px rgba(255, 68, 68, 0.5); font-size: 1.2em;">✗</strong> The Battle-Brother's mind fractures...`;

    const label = `[Insanity Test] ${actorName} - Target: ${finalTarget}<br>${resultLabel}`;

    // Build flavor with collapsible modifier details (like attack messages)
    const modifierDetails = modifierParts.length > 0
      ? `<details style="margin-top:4px;"><summary style="cursor:pointer;font-size:0.9em;">Modifiers</summary><div style="font-size:0.85em;margin-top:4px;">${modifierParts.join('<br>')}</div></details>`
      : '';

    const content = label + modifierDetails;

    await FoundryAdapter.sendRollToChat(roll, {
      speaker: FoundryAdapter.getChatSpeaker({ actor }),
      flavor: content
    });

    // If failed, roll for trauma
    if (!success) {
      await this.rollBattleTrauma(actor);
    }
  }

  /**
   * Roll for a battle trauma and add it to the character.
   * Uses Foundry's RollTable system for natural integration.
   *
   * Non-pure - uses Foundry API via FoundryAdapter.
   *
   * @param {DeathwatchActor} actor - The character gaining trauma
   * @returns {Promise<void>}
   */
  static async rollBattleTrauma(actor) {
    const existingTraumas = actor.items.filter(i => i.type === "battle-trauma");
    const existingKeys = new Set(existingTraumas.map(t => t.system.key).filter(k => k));

    // Get Battle Trauma RollTable (check compendium first, then world tables)
    const tablePack = game.packs.get("deathwatch.tables");
    let table;

    if (tablePack) {
      const tableIndex = tablePack.index.find(t => t.name === "Battle Trauma Table");
      if (tableIndex) {
        table = await tablePack.getDocument(tableIndex._id);
      }
    }

    if (!table) {
      table = game.tables.getName("Battle Trauma Table");
    }

    if (!table) {
      FoundryAdapter.showNotification("error", "Battle Trauma Table not found! Import it from the Tables compendium.");
      return;
    }

    let attempts = 0;
    let selectedTrauma = null;

    // Roll until we get a non-duplicate (with safety limit)
    while (!selectedTrauma && attempts < BATTLE_TRAUMA.MAX_REROLL_ATTEMPTS) {
      // Draw from table (rolls d10 and looks up result)
      const draw = await table.draw({ displayChat: false });
      const result = draw.results[0];

      Logger.category('CHARACTER.INSANITY').debug( 'Battle Trauma roll result', {
        name: result.name,
        description: result.description,
        type: result.type,
        resultUuid: result.uuid
      });

      // Get the trauma item from the table result
      // In v13, table results of type "document" store compendium UUIDs in result.description
      // The description field contains the UUID like "Compendium.deathwatch.battle-traumas.bt-000000000001"
      let traumaItem;

      // Get UUID from description field (v13 pattern for document type results)
      if (result.description && result.description.startsWith("Compendium.")) {
        traumaItem = await fromUuid(result.description);
      }

      if (!traumaItem) {
        Logger.category('CHARACTER.INSANITY').error( 'Could not resolve trauma item from result', result);
        FoundryAdapter.showNotification("error", `Could not find trauma item for result. Check that the Battle Trauma Table has valid compendium UUIDs in the description field.`);
        return;
      }

      Logger.category('CHARACTER.INSANITY').debug( 'Trauma item resolved', { name: traumaItem.name, uuid: traumaItem.uuid });

      // Check for duplicate
      if (!existingKeys.has(traumaItem.system.key)) {
        selectedTrauma = traumaItem;
      } else {
        attempts++;
        FoundryAdapter.showNotification("info", `${actor.name} already has ${traumaItem.name}, rerolling...`);
      }
    }

    if (!selectedTrauma) {
      FoundryAdapter.showNotification("warn", `${actor.name} has all possible battle traumas!`);
      return;
    }

    // Add trauma to character
    await FoundryAdapter.createEmbeddedDocuments(actor, "Item", [selectedTrauma.toObject()]);

    // Post trauma details to chat
    const actorName = Sanitizer.escape(actor.name);
    const traumaName = Sanitizer.escape(selectedTrauma.name);

    // Build label and expandable description
    const label = `[Battle Trauma Gained] ${actorName}<br><strong style="color: #ff4444; text-shadow: 0 0 2px rgba(255, 68, 68, 0.5);">${traumaName}</strong>`;
    const description = selectedTrauma.system.description
      ? `<details style="margin-top:4px;"><summary style="cursor:pointer;font-size:0.9em;">Details</summary><div style="font-size:0.85em;margin-top:4px;">${selectedTrauma.system.description}</div></details>`
      : '';

    await FoundryAdapter.createChatMessage({
      speaker: FoundryAdapter.getChatSpeaker({ actor }),
      content: label + description
    });
  }

  /**
   * Handle character removal when reaching 100 Insanity Points.
   *
   * Non-pure - uses Foundry API via FoundryAdapter.
   *
   * @param {DeathwatchActor} actor - The character being removed
   * @param {string} reason - Reason for removal ("insanity" or "corruption")
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
   * Post insanity gain message to chat.
   *
   * Non-pure - uses Foundry API via FoundryAdapter.
   *
   * @param {DeathwatchActor} actor - The character gaining insanity
   * @param {number} points - Insanity points gained
   * @param {string} source - Source description
   * @param {number} newTotal - New total insanity points
   * @returns {Promise<void>}
   */
  static async postInsanityMessage(actor, points, source, newTotal) {
    const trackLevel = this.getTrackLevel(newTotal);
    const actorName = Sanitizer.escape(actor.name);
    const sourceText = Sanitizer.escape(source);

    const needsTest = newTotal >= 10 && (newTotal % INSANITY_TRACK.TEST_INTERVAL) < points;
    const warning = needsTest ? ' <strong style="color: #ff4444; text-shadow: 0 0 2px rgba(255, 68, 68, 0.5);">⚠ TEST REQUIRED</strong>' : '';

    const label = `[Insanity Gained] ${actorName} +${points} IP<br>Total: <strong>${newTotal} IP</strong> (Track Level ${trackLevel})${warning}`;
    const details = `<details style="margin-top:4px;"><summary style="cursor:pointer;font-size:0.9em;">Source</summary><div style="font-size:0.85em;margin-top:4px;">${sourceText}</div></details>`;

    await FoundryAdapter.createChatMessage({
      speaker: FoundryAdapter.getChatSpeaker({ actor }),
      content: label + details
    });
  }

  /**
   * Purchase insanity point reduction with XP.
   *
   * Characters may spend 100 XP per Insanity Point removed, but cannot
   * cross down a track level (cannot reduce degree of madness).
   *
   * Non-pure - uses Foundry API via FoundryAdapter.
   *
   * Core p. 216
   *
   * @param {DeathwatchActor} actor - The character purchasing reduction
   * @returns {Promise<void>}
   */
  static async purchaseInsanityReduction(actor) {
    const currentInsanity = actor.system.insanity || 0;
    const currentXP = actor.system.xp?.available || 0;

    // Determine track level for floor calculation
    // Special case: 100+ insanity is "removed" but for purchase purposes,
    // treat as level 3 (cannot reduce below 91)
    let trackLevel = this.getTrackLevel(currentInsanity);
    if (currentInsanity >= INSANITY_TRACK.REMOVAL) {
      trackLevel = 3;
    }

    // Determine floor (minimum insanity for current track level)
    const floor = INSANITY_REDUCTION.TRACK_FLOORS[trackLevel] || 0;

    // Maximum points that can be purchased
    const maxPointsAvailable = currentInsanity - floor;
    const maxPointsAffordable = Math.floor(currentXP / INSANITY_REDUCTION.XP_COST_PER_POINT);
    const maxPoints = Math.min(maxPointsAvailable, maxPointsAffordable);

    if (maxPoints <= 0) {
      if (maxPointsAffordable <= 0) {
        FoundryAdapter.showNotification('warn', `Not enough XP. Need ${INSANITY_REDUCTION.XP_COST_PER_POINT} XP per point.`);
      } else {
        FoundryAdapter.showNotification('warn', 'Cannot reduce insanity below current track level.');
      }
      return;
    }

    const actorName = Sanitizer.escape(actor.name);

    const content = `
      <form class="insanity-purchase-dialog deathwatch-dialog">
        <div class="form-group">
          <p><strong>${actorName}</strong> seeks redemption through prayer and reflection.</p>
          <p>Current Insanity: <strong>${currentInsanity} IP</strong> (Track Level ${trackLevel})</p>
          <p>Available XP: <strong>${currentXP}</strong></p>
        </div>

        <div class="form-group">
          <p class="info-box">
            You may spend XP to reduce Insanity Points through long hours of prayer
            and counsel with Deathwatch Chaplains. However, you cannot reduce your
            degree of madness (track level) once gained.
          </p>
        </div>

        <div class="form-group">
          <label>Points to Remove:</label>
          <input type="number" name="points" value="1" min="1" max="${maxPoints}" autofocus />
          <p class="hint">Cost: ${INSANITY_REDUCTION.XP_COST_PER_POINT} XP per point | Max: ${maxPoints} points (${floor} IP minimum)</p>
        </div>

        <div class="form-group preview">
          <label>XP Cost:</label>
          <input type="number" name="cost-preview" value="${INSANITY_REDUCTION.XP_COST_PER_POINT}" readonly class="cost-display" />
        </div>

        <div class="form-group preview">
          <label>New Insanity:</label>
          <input type="number" name="insanity-preview" value="${currentInsanity - 1}" readonly class="insanity-display" />
        </div>

        <div class="form-group preview">
          <label>Remaining XP:</label>
          <input type="number" name="xp-preview" value="${currentXP - INSANITY_REDUCTION.XP_COST_PER_POINT}" readonly class="xp-display" />
        </div>
      </form>
    `;

    await FoundryAdapter.showDialog({
      title: 'Purchase Insanity Reduction',
      content,
      buttons: {
        purchase: {
          icon: '<i class="fas fa-coins"></i>',
          label: 'Purchase',
          callback: async (html) => {
            const points = Math.min(
              Math.max(1, parseInt(html.find('[name="points"]').val()) || 1),
              maxPoints
            );
            const cost = points * INSANITY_REDUCTION.XP_COST_PER_POINT;
            const newInsanity = currentInsanity - points;

            // Add history entry with negative points and XP cost
            const entry = {
              points: -points,
              source: 'XP Purchase - Prayer and Chaplain Counsel',
              timestamp: Date.now(),
              missionId: '',
              testRolled: false,
              testResult: '',
              testModifiers: 0,
              xpSpent: cost
            };

            const history = [...(actor.system.insanityHistory || []), entry];

            // Update insanity and history (XP.spent will be recalculated automatically in prepareDerivedData)
            await FoundryAdapter.updateDocument(actor, {
              'system.insanity': newInsanity,
              'system.insanityHistory': history
            });

            // Post to chat
            const label = `[Insanity Reduced] ${actorName} -${points} IP<br>Total: <strong>${newInsanity} IP</strong> (Track Level ${this.getTrackLevel(newInsanity)})`;
            const details = `<details style="margin-top:4px;"><summary style="cursor:pointer;font-size:0.9em;">Details</summary><div style="font-size:0.85em;margin-top:4px;">Spent ${cost} XP through prayer and reflection with Deathwatch Chaplains.</div></details>`;

            await FoundryAdapter.createChatMessage({
              speaker: FoundryAdapter.getChatSpeaker({ actor }),
              content: label + details
            });

            FoundryAdapter.showNotification('info', `Reduced insanity by ${points} points for ${cost} XP.`);
          }
        },
        cancel: {
          icon: '<i class="fas fa-times"></i>',
          label: 'Cancel'
        }
      },
      default: 'purchase',
      render: (html) => {
        // Update previews dynamically
        html.find('[name="points"]').on('input', (event) => {
          const points = Math.min(
            Math.max(1, parseInt(event.target.value) || 1),
            maxPoints
          );
          const cost = points * INSANITY_REDUCTION.XP_COST_PER_POINT;
          const newInsanity = currentInsanity - points;
          const remainingXP = currentXP - cost;

          html.find('.cost-display').val(cost);
          html.find('.insanity-display').val(newInsanity);
          html.find('.xp-display').val(remainingXP);
        });
      }
    });
  }
}
