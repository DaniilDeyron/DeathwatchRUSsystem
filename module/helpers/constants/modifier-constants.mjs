/**
 * Modifier and effect type constants for Deathwatch system.
 * Defines the modifier system used throughout the game.
 */

// Modifier Types
export const MODIFIER_TYPES = {
  TRAIT: 'trait',
  EQUIPMENT: 'equipment',
  TALENT: 'talent',
  CIRCUMSTANCE: 'circumstance',
  CHAPTER: 'chapter',
  PSYCHIC: 'psychic',
  UNTYPED: 'untyped' // Deprecated - for legacy modifiers only
};

// Modifier type labels for UI display
export const MODIFIER_TYPE_LABELS = {
  [MODIFIER_TYPES.TRAIT]: 'Trait',
  [MODIFIER_TYPES.EQUIPMENT]: 'Equipment',
  [MODIFIER_TYPES.TALENT]: 'Talent',
  [MODIFIER_TYPES.CIRCUMSTANCE]: 'Circumstance',
  [MODIFIER_TYPES.CHAPTER]: 'Chapter',
  [MODIFIER_TYPES.PSYCHIC]: 'Psychic',
  [MODIFIER_TYPES.UNTYPED]: 'Untyped (Legacy)'
};

// Effect Types
export const EFFECT_TYPES = {
  CHARACTERISTIC: 'characteristic',
  CHARACTERISTIC_POST_MULTIPLIER: 'characteristic-post-multiplier',
  SKILL: 'skill',
  CHARACTERISTIC_BONUS: 'characteristic-bonus',
  INITIATIVE: 'initiative',
  WOUNDS: 'wounds',
  ARMOR: 'armor',
  PSY_RATING: 'psy-rating',
  MOVEMENT: 'movement',
  MOVEMENT_MULTIPLIER: 'movement-multiplier',
  MOVEMENT_RESTRICTION: 'movement-restriction',
  WEAPON_DAMAGE: 'weapon-damage',
  WEAPON_DAMAGE_OVERRIDE: 'weapon-damage-override',
  WEAPON_RANGE: 'weapon-range',
  WEAPON_WEIGHT: 'weapon-weight',
  WEAPON_ROF: 'weapon-rof',
  WEAPON_BLAST: 'weapon-blast',
  WEAPON_FELLING: 'weapon-felling',
  WEAPON_PENETRATION: 'weapon-penetration',
  WEAPON_PENETRATION_MODIFIER: 'weapon-penetration-modifier',
  RIGHTEOUS_FURY_THRESHOLD: 'righteous-fury-threshold',
  CHARACTERISTIC_DAMAGE: 'characteristic-damage',
  MAGNITUDE_BONUS_DAMAGE: 'magnitude-bonus-damage',
  PREMATURE_DETONATION: 'premature-detonation',
  IGNORES_NATURAL_ARMOUR: 'ignores-natural-armour',
  PSYCHIC_TEST: 'psychic-test',
  NO_PERILS: 'no-perils',
  CRITICAL_DAMAGE: 'critical-damage'
};

// Effect type labels for UI display
export const EFFECT_TYPE_LABELS = {
  [EFFECT_TYPES.CHARACTERISTIC]: 'Characteristic',
  [EFFECT_TYPES.CHARACTERISTIC_POST_MULTIPLIER]: 'Characteristic (Post-Multiplier)',
  [EFFECT_TYPES.SKILL]: 'Skill',
  [EFFECT_TYPES.CHARACTERISTIC_BONUS]: 'Characteristic Bonus',
  [EFFECT_TYPES.INITIATIVE]: 'Initiative',
  [EFFECT_TYPES.WOUNDS]: 'Wounds',
  [EFFECT_TYPES.ARMOR]: 'Armor',
  [EFFECT_TYPES.PSY_RATING]: 'Psy Rating',
  [EFFECT_TYPES.MOVEMENT]: 'Movement',
  [EFFECT_TYPES.MOVEMENT_MULTIPLIER]: 'Movement Multiplier',
  [EFFECT_TYPES.MOVEMENT_RESTRICTION]: 'Movement Restriction',
  [EFFECT_TYPES.WEAPON_DAMAGE]: 'Weapon Damage',
  [EFFECT_TYPES.WEAPON_DAMAGE_OVERRIDE]: 'Weapon Damage Override',
  [EFFECT_TYPES.WEAPON_RANGE]: 'Weapon Range',
  [EFFECT_TYPES.WEAPON_WEIGHT]: 'Weapon Weight',
  [EFFECT_TYPES.WEAPON_ROF]: 'Weapon Rate of Fire',
  [EFFECT_TYPES.WEAPON_BLAST]: 'Weapon Blast',
  [EFFECT_TYPES.WEAPON_FELLING]: 'Weapon Felling',
  [EFFECT_TYPES.WEAPON_PENETRATION]: 'Weapon Penetration',
  [EFFECT_TYPES.WEAPON_PENETRATION_MODIFIER]: 'Weapon Penetration Modifier',
  [EFFECT_TYPES.RIGHTEOUS_FURY_THRESHOLD]: 'Righteous Fury Threshold',
  [EFFECT_TYPES.CHARACTERISTIC_DAMAGE]: 'Characteristic Damage',
  [EFFECT_TYPES.MAGNITUDE_BONUS_DAMAGE]: 'Magnitude Bonus Damage',
  [EFFECT_TYPES.PREMATURE_DETONATION]: 'Premature Detonation',
  [EFFECT_TYPES.IGNORES_NATURAL_ARMOUR]: 'Ignores Natural Armour',
  [EFFECT_TYPES.PSYCHIC_TEST]: 'Psychic Test',
  [EFFECT_TYPES.NO_PERILS]: 'No Perils of the Warp',
  [EFFECT_TYPES.CRITICAL_DAMAGE]: 'Critical Damage'
};
