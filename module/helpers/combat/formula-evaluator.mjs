/**
 * Mapping of characteristic abbreviations to system data keys.
 */
const CHARACTERISTIC_MAP = {
  'PR': 'pr',
  'WS': 'ws',
  'BS': 'bs',
  'S': 'str',
  'T': 'tg',
  'AG': 'ag',
  'INT': 'int',
  'PER': 'per',
  'WP': 'wil',
  'FEL': 'fs'
};

/**
 * Mapping of characteristic abbreviations to friendly names.
 */
const CHARACTERISTIC_NAMES = {
  'PR': 'Psy Rating (PR)',
  'WS': 'Weapon Skill (WS)',
  'BS': 'Ballistic Skill (BS)',
  'S': 'Strength (S)',
  'T': 'Toughness (T)',
  'AG': 'Agility (AG)',
  'INT': 'Intelligence (INT)',
  'PER': 'Perception (PER)',
  'WP': 'Willpower (WP)',
  'FEL': 'Fellowship (FEL)'
};

/**
 * Get friendly name for characteristic abbreviation.
 * @param {string} abbrev - Characteristic abbreviation
 * @returns {string} Friendly name
 */
function getCharacteristicName(abbrev) {
  return CHARACTERISTIC_NAMES[abbrev] || abbrev;
}

/**
 * Get characteristic value from actor.
 * @param {string} abbrev - Characteristic abbreviation (PR, AG, etc.)
 * @param {Actor} actor - Actor to query
 * @returns {number|undefined} Characteristic value or undefined
 */
export function getCharacteristicValue(abbrev, actor) {
  const key = CHARACTERISTIC_MAP[abbrev];
  if (!key) return undefined;

  return actor?.system?.characteristics?.[key]?.value;
}

/**
 * Safely evaluate a mathematical expression.
 * @param {string} expression - Expression like "10*5" or "2+3"
 * @returns {number} Evaluated result
 * @throws {Error} If expression is invalid
 */
function safeEvaluateExpression(expression) {
  // Use Function constructor for safe evaluation (no access to global scope)
  try {
    const fn = new Function('return ' + expression);
    const result = fn();
    if (typeof result !== 'number' || isNaN(result)) {
      throw new Error(`Expression "${expression}" did not evaluate to a valid number`);
    }
    return result;
  } catch (error) {
    throw new Error(`Invalid expression "${expression}": ${error.message}`);
  }
}

/**
 * Evaluate a formula string in the context of an actor.
 * @param {string} formula - Formula like "30" or "10*PR"
 * @param {Actor} actor - Source actor for characteristic lookup
 * @returns {number} Evaluated result
 * @throws {Error} If formula is invalid or characteristic missing
 */
export function evaluateFormula(formula, actor) {
  if (!formula || formula.trim() === '') {
    throw new Error('Invalid formula: formula is empty');
  }

  const trimmed = formula.trim();

  // Try parsing as literal number
  const literalValue = Number(trimmed);
  if (!isNaN(literalValue)) {
    return literalValue;
  }

  // Check for unknown characteristics (any capitalized word that's not a known characteristic or operator)
  const allCharPattern = /\b[A-Z][A-Z]*\b/g;
  const allMatches = [...trimmed.matchAll(allCharPattern)];
  for (const match of allMatches) {
    const word = match[0];
    // Skip if it's a known characteristic
    if (!CHARACTERISTIC_MAP[word]) {
      // Could be a formula error - will be caught later
      // But first check if it looks like a characteristic (all caps, 1-3 letters)
      if (/^[A-Z]{1,3}$/.test(word)) {
        throw new Error(`Invalid formula '${formula}' - unknown characteristic '${word}'`);
      }
    }
  }

  // Replace characteristic abbreviations with their values
  let expression = trimmed;
  const characteristicPattern = /\b(PR|WS|BS|S|T|AG|INT|PER|WP|FEL)\b/g;
  const matches = [...trimmed.matchAll(characteristicPattern)];

  for (const match of matches) {
    const abbrev = match[0];
    const value = getCharacteristicValue(abbrev, actor);

    if (value === undefined) {
      throw new Error(`Actor has no ${getCharacteristicName(abbrev)} value`);
    }

    expression = expression.replace(new RegExp(`\\b${abbrev}\\b`, 'g'), value);
  }

  // Evaluate the expression - wrap error with "Invalid formula" for clarity
  try {
    return safeEvaluateExpression(expression);
  } catch (error) {
    // If it looks like the original formula was just a bare word, wrap with "Invalid formula"
    if (!trimmed.includes('*') && !trimmed.includes('+') && !trimmed.includes('-') && !trimmed.includes('/')) {
      throw new Error(`Invalid formula: "${trimmed}" is not a valid number or expression`);
    }
    throw error;
  }
}

/**
 * Validate formula syntax without evaluation.
 * @param {string} formula - Formula to validate
 * @returns {boolean} True if syntactically valid
 */
export function validateFormula(formula) {
  if (!formula || typeof formula !== 'string' || formula.trim() === '') {
    return false;
  }

  const trimmed = formula.trim();

  // Check for dangerous patterns (function calls, property access)
  const dangerousPatterns = [
    /[a-zA-Z_][a-zA-Z0-9_]*\s*\(/,  // Function calls
    /\./,                           // Property access
    /\[/,                           // Array access
    /;/,                            // Statement separator
    /(eval|Function|require|import|export)/  // Dangerous keywords
  ];

  for (const pattern of dangerousPatterns) {
    if (pattern.test(trimmed)) {
      return false;
    }
  }

  // Valid formula contains only:
  // - Numbers (including decimals)
  // - Characteristic abbreviations (PR, WS, BS, S, T, AG, INT, PER, WP, FEL)
  // - Math operators (+, -, *, /, %)
  // - Parentheses
  // - Whitespace
  const validPattern = /^[\d\s+\-*/%()PRAWBSTGINEF]+$/;

  return validPattern.test(trimmed);
}
