import { Logger } from './logger.mjs';

/**
 * Error handling utilities for wrapping async operations with error boundaries.
 * Provides user-friendly error messages while logging detailed errors to console.
 */
export class ErrorHandler {
  /**
   * Wrap an async event handler with error boundary.
   * Catches errors, logs them, and shows user-friendly notifications.
   * @param {Function} handler - The async handler function
   * @param {string} context - Description for logging (e.g., "Apply Damage")
   * @returns {Function} Wrapped handler with error boundary
   * @example
   * btn.addEventListener('click', ErrorHandler.wrap(async (ev) => {
   *   // Your logic here
   * }, 'Apply Damage'));
   */
  static wrap(handler, context) {
    return async function(event) {
      try {
        await handler.call(this, event);
      } catch (error) {
        Logger.error('ERROR_HANDLER', `${context} failed:`, error);
        ui.notifications.error(`${context} failed: ${error.message}`);
      }
    };
  }

  /**
   * Wrap a promise with a fallback value if it fails.
   * Useful for non-critical operations that shouldn't block execution.
   * @param {Promise} promise - The promise to wrap
   * @param {*} fallback - Value to return on error
   * @returns {Promise} Promise that resolves to result or fallback
   * @example
   * const result = await ErrorHandler.safe(riskyOperation(), defaultValue);
   */
  static async safe(promise, fallback = null) {
    try {
      return await promise;
    } catch (error) {
      Logger.warn('ERROR_HANDLER', 'Promise failed, using fallback:', error);
      return fallback;
    }
  }
}
