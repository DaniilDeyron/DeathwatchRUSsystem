/**
 * Insanity system constants
 * Source: Deathwatch Core Rulebook p. 215-217
 */

/**
 * Insanity Track thresholds and modifiers.
 *
 * The Insanity Track determines:
 * - Trauma test modifiers (WP penalty when testing to resist Battle Trauma)
 * - Primarch's Curse level activation
 * - Character removal threshold (100+ IP)
 *
 * Core p. 216
 */
export const INSANITY_TRACK = {
  /** Insanity threshold levels (Core p. 216) */
  THRESHOLD_1: 30,  // Level 1: Primarch's Curse Level 1, -10 to trauma tests
  THRESHOLD_2: 60,  // Level 2: Primarch's Curse Level 2, -20 to trauma tests
  THRESHOLD_3: 90,  // Level 3: Primarch's Curse Level 3, -30 to trauma tests
  REMOVAL: 100,     // Character removed from play

  /** Test triggered every X insanity points gained (Core p. 216) */
  TEST_INTERVAL: 10,

  /** Trauma test modifiers by track level (Core p. 216) */
  MODIFIERS: {
    LEVEL_0: 0,    // 0-30 IP: No modifier to trauma tests
    LEVEL_1: -10,  // 31-60 IP: -10 to trauma tests
    LEVEL_2: -20,  // 61-90 IP: -20 to trauma tests
    LEVEL_3: -30   // 91-99 IP: -30 to trauma tests
  }
};

/**
 * Primarch's Curse level thresholds.
 *
 * Each chapter has a unique curse that manifests at different levels
 * as the Battle-Brother's insanity increases.
 *
 * Core p. 216-217
 */
export const PRIMARCHS_CURSE_LEVELS = {
  NONE: 0,    // 0-30 IP: Curse dormant
  LEVEL_1: 1, // 31-60 IP: Minor manifestation
  LEVEL_2: 2, // 61-90 IP: Moderate manifestation
  LEVEL_3: 3  // 91-99 IP: Severe manifestation
};

/**
 * Battle Trauma acquisition constants.
 *
 * Battle Traumas are rolled on a d10 table when an Insanity Test is failed.
 *
 * Core p. 217
 */
export const BATTLE_TRAUMA = {
  /** d10 roll for trauma (Core p. 217) */
  TABLE_SIZE: 10,

  /** Maximum reroll attempts to prevent infinite loop when all traumas owned */
  MAX_REROLL_ATTEMPTS: 20,

  /** RollTable name in compendium */
  TABLE_NAME: "Battle Trauma Table"
};

/**
 * Insanity Point reduction via XP expenditure.
 *
 * A character may spend XP to remove Insanity Points, but may never
 * cross down a track level boundary (cannot lose degree of madness).
 *
 * Core p. 216
 */
export const INSANITY_REDUCTION = {
  /** XP cost to remove 1 Insanity Point (Core p. 216) */
  XP_COST_PER_POINT: 100,

  /** Minimum insanity per track level (cannot reduce below these thresholds) */
  TRACK_FLOORS: {
    0: 0,   // Level 0: Can reduce to 0
    1: 31,  // Level 1: Can only reduce to 31 minimum
    2: 61,  // Level 2: Can only reduce to 61 minimum
    3: 91   // Level 3: Can only reduce to 91 minimum
  }
};
