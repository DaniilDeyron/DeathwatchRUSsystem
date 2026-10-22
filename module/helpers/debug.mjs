import { Logger } from './logger.mjs';

/**
 * @deprecated Use Logger.debug() instead. Will be removed in v3.0.0.
 */
export const DEBUG_FLAGS = {
  COMBAT: false,
  MODIFIERS: false,
  SHEETS: false
};

/**
 * @deprecated Use Logger.debug() instead. Will be removed in v3.0.0.
 * @param {string} context - Component name
 * @param {...any} args - Arguments to log
 * @example
 * // Old way (deprecated):
 * debug('COMBAT', 'Applying damage', damageData);
 *
 * // New way:
 * Logger.debug('COMBAT', 'Applying damage', damageData);
 */
export function debug(context, ...args) {
  // Always log via Logger.debug (respects log level settings)
  Logger.debug(context, ...args);

  // Show compatibility warning once
  if (!debug._warningShown) {
    Logger.compatibility('debug() is deprecated, use Logger.debug() instead', {
      since: '2.1.0',
      until: '3.0.0'
    });
    debug._warningShown = true;
  }
}
