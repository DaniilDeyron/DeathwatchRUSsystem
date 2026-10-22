/**
 * Squad mode, cohesion, and horde constants for Deathwatch system.
 */

// Combat Modes
export const MODES = {
  SOLO: 'solo',
  SQUAD: 'squad'
};

export const MODE_LABELS = {
  [MODES.SOLO]: 'Solo Mode',
  [MODES.SQUAD]: 'Squad Mode'
};

// Cohesion System
export const COHESION = {
  RANK_THRESHOLD_MID: 4,
  RANK_THRESHOLD_HIGH: 6,
  RANK_BONUS_MID: 1,
  RANK_BONUS_HIGH: 2,
  COMMAND_TRAINED: 1,
  COMMAND_MASTERED: 2,
  COMMAND_EXPERT: 3,
  DAMAGE_THRESHOLD: 10,
  MAX_DAMAGE_PER_ROUND: 1
};

// Horde Constants (Deathwatch Core p. 358-360)
export const HORDE_CONSTANTS = {
  MAGNITUDE_DAMAGE_DIVISOR: 10,  // Horde damage bonus = magnitude / 10 d10s
  MAX_MAGNITUDE_BONUS_DICE: 2    // Maximum +2d10 from magnitude
};
