/**
 * Dodge or Parry Selector
 *
 * Shows a dialog to choose between Dodge (skill) or Parry (WS characteristic).
 * Includes modifier field for situational bonuses/penalties.
 *
 * IMPORTANT:
 * - Dodge is a SKILL test (uses rollSkill)
 * - Parry is a CHARACTERISTIC test (uses rollCharacteristic with WS)
 *
 * Usage:
 * - Select a token
 * - Run macro
 * - Choose Dodge or Parry
 * - Add any modifiers (defensive stance, Called Shot, etc.)
 * - Roll appears in chat
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
    <label>Reaction Type:</label>
    <select id="reaction-type" name="reactionType" style="width: 100%;">
      <option value="dodge">Dodge (Skill ${dodgeTotal})</option>
      <option value="parry">Parry (Weapon Skill ${ws})</option>
    </select>
  </div>
  <div class="form-group">
    <label>Additional Modifier:</label>
    <input type="number" id="modifier" name="modifier" value="0" style="width: 100%;" />
  </div>
  <p style="font-size: 0.9em; color: #666; margin-top: 10px;">
    <strong>Dodge:</strong> Half Action reaction, <em>Skill</em> test (AG-based)<br>
    <strong>Parry:</strong> Half Action reaction, <em>Characteristic</em> test (WS)<br>
    Both are Challenging (+0) tests by default.
  </p>
`;

const result = await foundry.applications.api.DialogV2.wait({
  window: { title: `Reaction - ${token.actor.name}` },
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
  if (result.reactionType === 'dodge') {
    // Dodge is a SKILL test
    await game.deathwatch.rollSkill(token.actor.id, 'dodge', {
      modifier: result.modifier,
      difficulty: 'Challenging',
      skipDialog: true
    });
  } else {
    // Parry is a CHARACTERISTIC test
    await game.deathwatch.rollCharacteristic(token.actor.id, 'ws', {
      modifier: result.modifier,
      difficulty: 'Challenging',
      skipDialog: true
    });
  }
}
