/**
 * Quick Parry Roll
 *
 * Rolls a Weapon Skill CHARACTERISTIC test (Parry) for the selected token.
 * Parry is a Challenging (+0) characteristic test against Weapon Skill.
 * Unlike Dodge (which is a skill), Parry is a raw WS test.
 * Click on a token, then run this macro to roll immediately.
 */

const token = canvas.tokens.controlled[0];
if (!token) {
  ui.notifications.warn('Please select a token first');
  return;
}

// Parry is a CHARACTERISTIC test, so we use rollCharacteristic
await game.deathwatch.rollCharacteristic(token.actor.id, 'ws', {
  difficulty: 'Challenging',
  skipDialog: true
});
