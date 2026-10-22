/**
 * Character-related constants for Deathwatch system.
 * Includes characteristics, rolls, XP, wounds, and initiative.
 */

// Characteristic Keys
// SOURCE OF TRUTH: These keys MUST match actor.system.characteristics schema.
// All other code (Token Action HUD, UI templates, helpers) derives from this constant.
export const CHARACTERISTICS = {
  WS: 'ws',
  BS: 'bs',
  STR: 'str',
  TG: 'tg',
  AG: 'ag',
  INT: 'int',
  PER: 'per',
  WIL: 'wil',
  FS: 'fs'
};

// Characteristic Labels
export const CHARACTERISTIC_LABELS = {
  [CHARACTERISTICS.WS]: 'Weapon Skill',
  [CHARACTERISTICS.BS]: 'Ballistic Skill',
  [CHARACTERISTICS.STR]: 'Strength',
  [CHARACTERISTICS.TG]: 'Toughness',
  [CHARACTERISTICS.AG]: 'Agility',
  [CHARACTERISTICS.INT]: 'Intelligence',
  [CHARACTERISTICS.PER]: 'Perception',
  [CHARACTERISTICS.WIL]: 'Willpower',
  [CHARACTERISTICS.FS]: 'Fellowship'
};

// Characteristic Constants
export const CHARACTERISTIC_CONSTANTS = {
  BONUS_DIVISOR: 10,  // Characteristic bonus = value / 10 (Deathwatch Core p. 31)
  MAX_VALUE: 100
};

// Roll Constants
export const ROLL_CONSTANTS = {
  D100_MAX: 100,
  D10_MAX: 10,
  DEGREES_DIVISOR: 10  // Degrees of Success/Failure = difference / 10 (Deathwatch Core p. 27)
};

// XP Constants
export const XP_CONSTANTS = {
  STARTING_XP: 12000,
  RANK_THRESHOLDS: [13000, 17000, 21000, 25000, 30000, 35000, 40000, 45000]
};

// Wounds Calculation Constants (Deathwatch Core p. 214)
export const WOUNDS_CONSTANTS = {
  STRENGTH_BONUS_MULTIPLIER: 1,     // Wounds = SB + (2 × TB)
  TOUGHNESS_BONUS_MULTIPLIER: 2
};

// Initiative Constants (Deathwatch Core p. 245)
export const INITIATIVE_CONSTANTS = {
  DECIMALS: 2,  // For tie-breaking in combat tracker (e.g., 15.23 vs 15.45)
  FORMULA: "1d10 + @agBonus + @initiativeBonus"
};
