/**
 * On Fire Round (GM Only)
 *
 * Applies the effects of being "On Fire" for one combat round.
 *
 * Usage:
 * 1. Target a token with the "On Fire" status
 * 2. Run this macro at the start of their turn
 *
 * Effects Applied:
 * - 1d10 Energy damage (ignores armor)
 * - +1 Fatigue
 * - WP test to act normally (automatically passes with Power Armor)
 *
 * The character can attempt an Agility test (-20, Hard) to extinguish the flames.
 * If successful, the "On Fire" status is removed.
 *
 * Reference: Deathwatch Core Rulebook, p. 259 (Flame Weapons)
 */

const targetToken = game.user.targets.first();
if (!targetToken?.actor) {
  ui.notifications.warn('Target a token first.');
} else {
  game.deathwatch.applyOnFireEffects(targetToken.actor);
}
