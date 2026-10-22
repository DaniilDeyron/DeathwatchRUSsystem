/**
 * Flame Attack (GM Only)
 *
 * GM macro for flame weapon attacks. Opens a dialog to configure:
 * - Damage formula (e.g., "1d10+4")
 * - Penetration value
 * - Damage type (default: Energy)
 * - Weapon range in meters
 *
 * Usage:
 * 1. Target a token on the canvas
 * 2. Run this macro
 * 3. Enter flame weapon stats
 * 4. Click "Burn"
 *
 * Behavior:
 * - Against hordes: Automatic hits based on range (range/4 + 1d5)
 * - Against individuals: Target rolls Dodge (Agility test)
 *   - If dodge fails: Apply damage + Catch Fire test (Agility)
 *   - If catch fire fails: Apply "On Fire" status
 *
 * The flame attack automatically handles:
 * - Hit location determination
 * - Armor penetration
 * - Catch fire tests
 * - On Fire status application
 */

game.deathwatch.flameAttack();
