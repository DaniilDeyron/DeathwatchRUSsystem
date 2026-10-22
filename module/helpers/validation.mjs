/**
 * Input validation utilities for chat button handlers and forms.
 * Throws descriptive errors that can be caught and displayed to users.
 */
export class Validation {
  /**
   * Parse and validate an integer value.
   * @param {*} value - Value to parse (from dataset, input, etc.)
   * @param {string} fieldName - Field name for error messages
   * @returns {number} Parsed integer
   * @throws {Error} If value is not a valid integer
   * @example
   * const damage = Validation.requireInt(button.dataset.damage, 'Damage');
   */
  static requireInt(value, fieldName) {
    const parsed = parseInt(value);
    if (isNaN(parsed)) {
      throw new Error(`${fieldName} must be a valid integer (got: ${value})`);
    }
    return parsed;
  }

  /**
   * Get an actor by ID and validate it exists.
   * @param {string} actorId - Actor ID
   * @param {string} [context='operation'] - Context for error message
   * @returns {Actor} Actor document
   * @throws {Error} If actor not found
   * @example
   * const actor = Validation.requireActor(button.dataset.targetId, 'Apply Damage');
   */
  static requireActor(actorId, context = 'operation') {
    if (!actorId) {
      throw new Error(`Actor ID not provided for ${context}`);
    }
    const actor = game.actors.get(actorId);
    if (!actor) {
      throw new Error(`Actor not found for ${context}: ${actorId}`);
    }
    return actor;
  }

  /**
   * Validate a document exists (actor, item, etc.).
   * @param {*} document - Document to check
   * @param {string} documentType - Type for error message (e.g., "Actor", "Item")
   * @param {string} [context='operation'] - Context for error message
   * @returns {*} The document (passed through)
   * @throws {Error} If document is null/undefined
   * @example
   * const weapon = Validation.requireDocument(item, 'Weapon', 'Attack Roll');
   */
  static requireDocument(document, documentType, context = 'operation') {
    if (!document) {
      throw new Error(`${documentType} not found for ${context}`);
    }
    return document;
  }

  /**
   * Parse a boolean from a string value (e.g., "true" → true).
   * @param {*} value - Value to parse
   * @returns {boolean}
   */
  static parseBoolean(value) {
    if (typeof value === 'boolean') return value;
    return value === 'true' || value === true;
  }

  /**
   * Parse JSON from a string, with error handling.
   * @param {string} jsonString - JSON string to parse
   * @param {string} fieldName - Field name for error messages
   * @returns {*} Parsed JSON value
   * @throws {Error} If JSON is invalid
   */
  static parseJSON(jsonString, fieldName) {
    try {
      return JSON.parse(jsonString);
    } catch (error) {
      throw new Error(`Invalid JSON for ${fieldName}: ${error.message}`);
    }
  }
}
