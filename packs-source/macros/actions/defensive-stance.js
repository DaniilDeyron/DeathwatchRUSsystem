/**
 * Defensive Stance (Dodge/Parry with +20)
 *
 * Rolls Dodge (skill) or Parry (WS characteristic) with the +20 bonus from Defensive Stance.
 * When a character takes a Full Action to assume Defensive Stance,
 * all Dodge and Parry tests gain a +20 bonus until their next turn.
 *
 * IMPORTANT:
 * - Dodge is a SKILL test (uses rollSkill)
 * - Parry is a CHARACTERISTIC test (uses rollCharacteristic with WS)
 *
 * Usage:
 * 1. Select token
 * 2. Run macro
 * 3. Choose Dodge or Parry
 * 4. Automatically applies +20 bonus
 */

const token = canvas.tokens.controlled[0];
if (!token) {
  ui.notifications.warn('Please select a token first');
  return;
}

// Get actor's WS and Dodge skill values
const ws = token.actor.system.characteristics.ws.value;
const dodgeSkill = token.actor.system.skills.dodge;
const dodgeTotal = dodgeSkill ? dodgeSkill.total : 0;

const content = `
  <div class="form-group">
    <label>Reaction Type (with Defensive Stance +20):</label>
    <select id="reaction-type" name="reactionType" style="width: 100%;">
      <option value="dodge">Dodge (Skill ${dodgeTotal} + 20)</option>
      <option value="parry">Parry (Weapon Skill ${ws} + 20)</option>
    </select>
  </div>
  <div class="form-group">
    <label>Additional Modifier:</label>
    <input type="number" id="modifier" name="modifier" value="0" style="width: 100%;" />
  </div>
  <p style="font-size: 0.9em; color: #666; margin-top: 10px;">
    <strong>Defensive Stance:</strong> Full Action that grants +20 to all Dodge and Parry tests until your next turn.
  </p>
`;

const result = await foundry.applications.api.DialogV2.wait({
  window: { title: `Defensive Stance - ${token.actor.name}` },
  content,
  buttons: [
    {
      label: 'Roll',
      action: 'roll',
      callback: (event, button, dialog) => {
        const form = dialog.element.querySelector('form');
        const reactionType = form.querySelector('#reaction-type').value;
        const modifier = parseInt(form.querySelector('#modifier').value) || 0;
        return { reactionType, modifier };
      }
    },
    { label: 'Cancel', action: 'cancel' }
  ]
});

if (result && result !== 'cancel') {
  // Defensive Stance grants +20 bonus
  const defensiveBonus = 20;
  const totalModifier = result.modifier + defensiveBonus;

  if (result.reactionType === 'dodge') {
    // Dodge is a SKILL test
    await game.deathwatch.rollSkill(token.actor.id, 'dodge', {
      modifier: totalModifier,
      difficulty: 'Challenging',
      skipDialog: true
    });
  } else {
    // Parry is a CHARACTERISTIC test
    await game.deathwatch.rollCharacteristic(token.actor.id, 'ws', {
      modifier: totalModifier,
      difficulty: 'Challenging',
      skipDialog: true
    });
  }
}
