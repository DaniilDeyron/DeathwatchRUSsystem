/**
 * Quick Dodge Roll
 *
 * Rolls a Dodge SKILL test for the selected token.
 * Dodge is a Challenging (+0) skill test.
 * Click on a token, then run this macro to roll immediately.
 */

const token = canvas.tokens.controlled[0];
if (!token) {
  ui.notifications.warn('Please select a token first');
  return;
}

// Dodge is a SKILL test, so we use rollSkill
await game.deathwatch.rollSkill(token.actor.id, 'dodge', {
  difficulty: 'Challenging',
  skipDialog: true
});
