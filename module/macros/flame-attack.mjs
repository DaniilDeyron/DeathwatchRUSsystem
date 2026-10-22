import { CombatHelper } from '../helpers/combat/combat.mjs';
import { FireHelper } from '../helpers/combat/fire-helper.mjs';
import { handleFlameDodgePrompt } from '../init/socket.mjs';

/**
 * Parse recent chat messages for flamer damage rolls.
 * Looks for messages with data-flamer-damage attributes and returns their data.
 * @returns {Array<{damage: string, pen: number, damageType: string, attackerName: string}>}
 */
export function getRecentFlamerDamageRolls() {
    const messages = game.messages.contents.slice(-20); // Last 20 messages
    const results = [];

    for (let i = messages.length - 1; i >= 0; i--) {
        const message = messages[i];
        const parser = new DOMParser();
        const doc = parser.parseFromString(message.content, 'text/html');
        const flamerElement = doc.querySelector('[data-flamer-damage]');

        if (flamerElement) {
            const damage = flamerElement.dataset.flamerDamage;
            const pen = parseInt(flamerElement.dataset.flamerPen) || 0;
            const damageType = flamerElement.dataset.flamerType || 'Energy';

            // Retrieve attacker name from actor ID
            const actorId = flamerElement.dataset.actorId;
            const actor = game.actors.get(actorId);
            const attackerName = actor?.name || 'Unknown';

            results.push({
                damage,
                pen,
                damageType,
                attackerName
            });
        }
    }

    return results;
}

/**
 * Handle flame attack against a horde target.
 * @param {Actor} targetActor - The horde actor
 * @param {string} targetName - Name of the target
 * @param {number} weaponRange - Weapon range in meters
 * @param {string} damageFormula - Damage formula (e.g., "1d10+4")
 * @param {number} penetration - Armor penetration value
 * @param {string} damageType - Damage type (e.g., "Energy")
 * @param {Token} sourceToken - Source token for animation
 * @param {Token} targetToken - Target token for animation
 */
async function handleHordeFlameAttack(targetActor, targetName, weaponRange, damageFormula, penetration, damageType, sourceToken, targetToken) {
    const staticHits = Math.ceil(weaponRange / 4);
    const flameRoll = await new Roll('1d5').evaluate();
    const totalHits = staticHits + flameRoll.total;

    await flameRoll.toMessage({
        speaker: ChatMessage.getSpeaker(),
        flavor: `<strong>🔥 Flame vs Horde: ${targetName}</strong><br>Hits: ${staticHits} (range ${weaponRange}/4) + ${flameRoll.total} (1d5) = <strong>${totalHits} hits</strong>`
    });

    const hordeHitResults = [];
    for (let i = 0; i < totalHits; i++) {
        const roll = await new Roll(damageFormula).evaluate();
        hordeHitResults.push({ damage: roll.total, penetration, location: 'Body', damageType });
    }
    await targetActor.system.receiveBatchDamage(hordeHitResults);
}

/**
 * Handle dodge roll for flame attack against individual target.
 * @param {Actor} targetActor - The target actor
 * @param {string} targetName - Name of the target
 * @param {number} ag - Target's Agility value
 * @param {Object} dodgeDialog - The dodge dialog instance
 * @param {string} damageFormula - Damage formula
 * @param {number} penetration - Armor penetration
 * @param {string} damageType - Damage type
 * @param {Token} sourceToken - Source token for animation
 * @param {Token} targetToken - Target token for animation
 * @deprecated Moved to socket.mjs - use handleFlameDodgePrompt from '../init/socket.mjs'
 */

/**
 * Handle flame attack against an individual target (non-horde).
 * Emits socket message for GM to show dodge dialog.
 * @param {Actor} targetActor - The target actor
 * @param {string} targetName - Name of the target
 * @param {string} damageFormula - Damage formula
 * @param {number} penetration - Armor penetration
 * @param {string} damageType - Damage type
 * @param {Token} sourceToken - Source token for animation
 * @param {Token} targetToken - Target token for animation
 */
async function handleIndividualFlameAttack(targetActor, targetName, damageFormula, penetration, damageType, sourceToken, targetToken) {
    // If GM, show dialog directly
    if (game.user.isGM) {
        await handleFlameDodgePrompt({
            targetActorId: targetActor.id,
            targetName,
            damageFormula,
            penetration,
            damageType,
            sourceTokenId: sourceToken?.id,
            targetTokenId: targetToken?.id,
            sceneId: targetToken?.scene?.id || canvas.scene?.id
        });
    } else {
        // Emit socket for GM to handle
        game.socket.emit('system.deathwatch', {
            type: 'flameDodgePrompt',
            targetActorId: targetActor.id,
            targetName,
            damageFormula,
            penetration,
            damageType,
            sourceTokenId: sourceToken?.id,
            targetTokenId: targetToken?.id,
            sceneId: targetToken?.scene?.id || canvas.scene?.id
        });

        ui.notifications.info(`Flame attack sent to GM. Awaiting ${targetName}'s dodge roll.`);
    }
}

/**
 * GM macro for flame weapon attacks. Opens a dialog for damage/pen,
 * GM targets a token and clicks Burn. Applies damage, rolls catch fire
 * Agility test, and applies On Fire status if failed.
 * @param {Item} [weapon=null] - Optional weapon item to pre-fill dialog values
 */
export async function flameAttack(weapon = null) {
    // Get recent flamer damage rolls
    const recentRolls = getRecentFlamerDamageRolls();

    // Pre-fill values from weapon if provided, otherwise use most recent roll
    let defaultDamage = '';
    let defaultPen = 0;
    let defaultDmgType = 'Energy';
    let defaultRange = 20;

    if (weapon) {
        // Weapon takes priority
        defaultDamage = weapon.system.effectiveDamage || weapon.system.dmg || '';
        defaultPen = weapon.system.effectivePenetration ?? weapon.system.penetration ?? weapon.system.pen ?? 0;
        defaultDmgType = weapon.system.dmgType || 'Energy';
        defaultRange = parseInt(weapon.system.effectiveRange || weapon.system.range) || 20;
    } else if (recentRolls.length > 0) {
        // Use most recent roll as default
        const mostRecent = recentRolls[0];
        defaultDamage = mostRecent.damage;
        defaultPen = mostRecent.pen;
        defaultDmgType = mostRecent.damageType;
    }

    // Build dropdown options
    let dropdownOptions = '<option value="">-- None --</option>\n';
    recentRolls.forEach((roll, index) => {
        const selected = index === 0 && !weapon ? 'selected' : '';
        dropdownOptions += `        <option value="${index}" ${selected}>${roll.attackerName} (${roll.damage}, Pen ${roll.pen}, ${roll.damageType})</option>\n`;
    });

    const content = `
      <div class="form-group">
        <label>Select Recent Damage Source:</label>
        <select id="damageSource">
${dropdownOptions}        </select>
      </div>
      <div class="form-group">
        <label>Damage:</label>
        <input type="text" id="flameDamage" placeholder="e.g., 1d10+4" value="${defaultDamage}" />
      </div>
      <div class="form-group">
        <label>Penetration:</label>
        <input type="number" id="flamePen" value="${defaultPen}" />
      </div>
      <div class="form-group">
        <label>Damage Type:</label>
        <input type="text" id="flameDmgType" value="${defaultDmgType}" />
      </div>
      <div class="form-group">
        <label>Weapon Range (m):</label>
        <input type="number" id="flameRange" value="${defaultRange}" min="1" />
      </div>
    `;

    foundry.applications.api.DialogV2.wait({
        window: { title: '🔥 Flame Attack' },
        content,
        render: (event, dialog) => {
            // Add change listener to dropdown
            const el = dialog.element;
            const dropdown = el.querySelector('#damageSource');
            const damageInput = el.querySelector('#flameDamage');
            const penInput = el.querySelector('#flamePen');
            const dmgTypeInput = el.querySelector('#flameDmgType');

            dropdown?.addEventListener('change', (e) => {
                const selectedIndex = e.target.value;

                if (selectedIndex === '') {
                    // None selected - clear fields
                    damageInput.value = '';
                    penInput.value = '0';
                    dmgTypeInput.value = 'Energy';
                } else {
                    // Populate from selected roll
                    const roll = recentRolls[parseInt(selectedIndex)];
                    damageInput.value = roll.damage;
                    penInput.value = roll.pen;
                    dmgTypeInput.value = roll.damageType;
                }
            });
        },
        buttons: [
            {
                label: '🔥 Burn', action: 'burn',
                callback: async (event, button, dialog) => {
                    const el = dialog.element;
                    const damageFormula = el.querySelector('#flameDamage').value?.trim();
                    if (!damageFormula) {
                        ui.notifications.warn('Enter a damage formula.');
                        return;
                    }
                    const penetration = parseInt(el.querySelector('#flamePen').value) || 0;
                    const damageType = el.querySelector('#flameDmgType').value?.trim() || 'Energy';
                    const weaponRange = parseInt(el.querySelector('#flameRange').value) || 20;

                    const targetTokens = canvas.tokens.controlled;
                    if (!targetTokens || targetTokens.length === 0) {
                        ui.notifications.warn('Select at least one token before clicking Burn.');
                        return;
                    }

                    // Get source token (controlled or speaker's token)
                    let sourceToken = canvas.tokens.controlled[0];
                    if (!sourceToken) {
                        const speaker = ChatMessage.getSpeaker();
                        if (speaker.token) {
                            sourceToken = canvas.tokens.get(speaker.token);
                        }
                    }

                    // Process each selected token
                    for (const targetToken of targetTokens) {
                        if (!targetToken?.actor) continue;

                        const targetActor = targetToken.actor;
                        const targetName = targetActor.name;
                        const isHorde = targetActor.type === 'horde';

                        if (isHorde) {
                            await handleHordeFlameAttack(targetActor, targetName, weaponRange, damageFormula, penetration, damageType, sourceToken, targetToken);
                        } else {
                            await handleIndividualFlameAttack(targetActor, targetName, damageFormula, penetration, damageType, sourceToken, targetToken);
                        }
                    }

                    ui.notifications.info(`Flame attack processed for ${targetTokens.length} target(s).`);
                }
            },
            { label: 'Cancel', action: 'cancel' }
        ]
    });
}
