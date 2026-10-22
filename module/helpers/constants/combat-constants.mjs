/**
 * Combat-related constants for Deathwatch system.
 * Includes modifiers, hit locations, ranges, and enemy classifications.
 */

// Combat Aim Modifiers
export const AIM_MODIFIERS = {
  NONE: 0,
  HALF: 10,
  FULL: 20
};

// Rate of Fire Modifiers
export const RATE_OF_FIRE_MODIFIERS = {
  SINGLE: 0,
  SEMI_AUTO: 10,
  FULL_AUTO: 20
};

// Combat Penalties
export const COMBAT_PENALTIES = {
  CALLED_SHOT: -20,
  RUNNING_TARGET: -20
};

// Melee Combat Modifiers
export const MELEE_MODIFIERS = {
  ALL_OUT_ATTACK: 20,
  CHARGE: 10
};

// Hit Locations (Deathwatch Core p. 243)
export const HIT_LOCATIONS = [
  "Head", "Right Arm", "Left Arm", "Body", "Right Leg", "Left Leg"
];

// Range Modifiers (Deathwatch Core p. 252)
export const RANGE_MODIFIERS = {
  POINT_BLANK: 30,  // <= 2m
  SHORT: 10,         // < half weapon range
  NORMAL: 0,         // half to 2x weapon range
  LONG: -10,         // 2x to 3x weapon range
  EXTREME: -30       // >= 3x weapon range
};

// Size Hit Modifiers (applied to attacker when targeting creature of this size)
export const SIZE_HIT_MODIFIERS = {
  "Miniscule": -30,
  "Puny": -20,
  "Scrawny": -10,
  "Average": 0,
  "Hulking": 10,
  "Enormous": 20,
  "Massive": 30
};

// Hit Location Ranges (Deathwatch Core p. 243)
// Attack roll digits are reversed to determine hit location
export const HIT_LOCATION_RANGES = {
  HEAD: { min: 1, max: 10, label: "Head" },
  RIGHT_ARM: { min: 11, max: 20, label: "Right Arm" },
  LEFT_ARM: { min: 21, max: 30, label: "Left Arm" },
  BODY: { min: 31, max: 70, label: "Body" },
  RIGHT_LEG: { min: 71, max: 85, label: "Right Leg" },
  LEFT_LEG: { min: 86, max: 100, label: "Left Leg" }
};

// Enemy Classifications
export const ENEMY_CLASSIFICATIONS = {
  HUMAN: 'human',
  XENOS: 'xenos',
  CHAOS: 'chaos'
};

export const ENEMY_CLASSIFICATION_LABELS = {
  [ENEMY_CLASSIFICATIONS.HUMAN]: 'Human',
  [ENEMY_CLASSIFICATIONS.XENOS]: 'Xenos',
  [ENEMY_CLASSIFICATIONS.CHAOS]: 'Chaos'
};
