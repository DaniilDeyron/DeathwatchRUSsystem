/**
 * Combat Reactions (Advanced)
 *
 * Comprehensive macro for all defensive reactions with automatic modifiers.
 * Includes: Dodge (skill), Parry (WS characteristic), Defensive Stance, and situational modifiers.
 *
 * IMPORTANT:
 * - Dodge is a SKILL test (uses rollSkill)
 * - Parry is a CHARACTERISTIC test (uses rollCharacteristic with WS)
 *
 * Features:
 * - Automatic talent detection (Lightning Reflexes, Step Aside, etc.)
 * - Defensive Stance support (+20)
 * - Multiple attacker penalty tracking
 * - Called Shot penalty (-20)
 *
 * Usage:
 * 1. Select token
 * 2. Run macro
 * 3. Configure situation (attackers, stance, etc.)
 * 4. Choose reaction type
 * 5. Roll automatically posts to chat
 */

const token = canvas.tokens.controlled[0];
if (!token) {
  ui.notifications.warn('Please select a token first');
  return;
}

// Get actor data
const actor = token.actor;
const ws = actor.system.characteristics.ws.value;
const dodgeSkill = actor.system.skills.dodge;
const dodgeTotal = dodgeSkill ? dodgeSkill.total : 0;

// Check for relevant talents
const hasLightningReflexes = actor.items.find(i => i.name === 'Lightning Reflexes');
const hasStepAside = actor.items.find(i => i.name === 'Step Aside');
const hasBlademaster = actor.items.find(i => i.name === 'Blademaster');

// Build dialog
const content = `
  <div class="form-group">
    <label>Reaction Type:</label>
    <select id="reaction-type" name="reactionType" style="width: 100%;">
      <option value="dodge">Dodge (Skill ${dodgeTotal})</option>
      <option value="parry">Parry (WS Characteristic ${ws})</option>
    </select>
  </div>

  <div class="form-group">
    <label>Situation:</label>
    <div style="margin-top: 5px;">
      <label style="display: block;">
        <input type="checkbox" id="defensive-stance" name="defensiveStance" />
        Defensive Stance (+20)
      </label>
      <label style="display: block;">
        <input type="checkbox" id="called-shot" name="calledShot" />
        Called Shot attack (-20 to react)
      </label>
    </div>
  </div>

  <div class="form-group">
    <label>Number of attackers this round:</label>
    <input type="number" id="num-attackers" name="numAttackers" value="1" min="1" style="width: 100%;" />
    <p style="font-size: 0.8em; color: #666; margin-top: 3px;">
      2+ attackers: Each reaction after first at -20 (cumulative)
    </p>
  </div>

  <div class="form-group">
    <label>Additional Modifier:</label>
    <input type="number" id="modifier" name="modifier" value="0" style="width: 100%;" />
  </div>

  <hr style="margin: 10px 0;">

  <div style="font-size: 0.9em; color: #444;">
    <strong>Active Talents:</strong><br>
    ${hasLightningReflexes ? '✓ Lightning Reflexes (+10 to Dodge)<br>' : ''}
    ${hasStepAside ? '✓ Step Aside (Dodge as Free Action)<br>' : ''}
    ${hasBlademaster ? '✓ Blademaster (+10 to Parry with melee)<br>' : ''}
    ${!hasLightningReflexes && !hasStepAside && !hasBlademaster ? 'None detected' : ''}
  </div>
`;

const result = await foundry.applications.api.DialogV2.wait({
  window: { title: `Combat Reaction - ${actor.name}` },
  content,
  buttons: [
    {
      label: 'Roll',
      action: 'roll',
      callback: (event, button, dialog) => {
        const form = dialog.element.querySelector('form');
        return {
          reactionType: form.querySelector('#reaction-type').value,
          defensiveStance: form.querySelector('#defensive-stance').checked,
          calledShot: form.querySelector('#called-shot').checked,
          numAttackers: parseInt(form.querySelector('#num-attackers').value) || 1,
          modifier: parseInt(form.querySelector('#modifier').value) || 0
        };
      }
    },
    { label: 'Cancel', action: 'cancel' }
  ]
});

if (result && result !== 'cancel') {
  let totalModifier = result.modifier;
  let modifierDesc = [];

  // Apply Defensive Stance
  if (result.defensiveStance) {
    totalModifier += 20;
    modifierDesc.push('Defensive Stance +20');
  }

  // Apply Called Shot penalty
  if (result.calledShot) {
    totalModifier -= 20;
    modifierDesc.push('Called Shot -20');
  }

  // Apply multiple attacker penalty
  if (result.numAttackers > 1) {
    const multiAttackerPenalty = (result.numAttackers - 1) * -20;
    totalModifier += multiAttackerPenalty;
    modifierDesc.push(`Multiple attackers ${multiAttackerPenalty}`);
  }

  // Apply talent bonuses
  if (result.reactionType === 'dodge' && hasLightningReflexes) {
    totalModifier += 10;
    modifierDesc.push('Lightning Reflexes +10');
  }

  if (result.reactionType === 'parry' && hasBlademaster) {
    totalModifier += 10;
    modifierDesc.push('Blademaster +10');
  }

  // Show modifier summary
  if (modifierDesc.length > 0) {
    ui.notifications.info(`Modifiers: ${modifierDesc.join(', ')}`);
  }

  // Roll the reaction
  if (result.reactionType === 'dodge') {
    // Dodge is a SKILL test
    await game.deathwatch.rollSkill(actor.id, 'dodge', {
      modifier: totalModifier,
      difficulty: 'Challenging',
      skipDialog: true
    });
  } else {
    // Parry is a CHARACTERISTIC test
    await game.deathwatch.rollCharacteristic(actor.id, 'ws', {
      modifier: totalModifier,
      difficulty: 'Challenging',
      skipDialog: true
    });
  }
}
