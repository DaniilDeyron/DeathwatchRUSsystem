/**
 * Central re-export for all constants in the Deathwatch system.
 * Provides backward compatibility by allowing imports from constants/index.mjs.
 *
 * Usage:
 *   import { RANGE_MODIFIERS, CHARACTERISTICS } from '../helpers/constants/index.mjs';
 *
 * Or import from specific domain files:
 *   import { RANGE_MODIFIERS } from '../helpers/constants/combat-constants.mjs';
 *   import { CHARACTERISTICS } from '../helpers/constants/characteristic-constants.mjs';
 */

// Combat constants
export * from './combat-constants.mjs';

// Character constants
export * from './characteristic-constants.mjs';

// Psychic constants
export * from './psychic-constants.mjs';

// Modifier constants
export * from './modifier-constants.mjs';

// Squad/team constants
export * from './squad-constants.mjs';

// Insanity constants
export * from './insanity-constants.mjs';

// Corruption constants
export * from './corruption-constants.mjs';
