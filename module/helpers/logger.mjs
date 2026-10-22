/**
 * Centralized logging system using Foundry's logger infrastructure.
 * Provides structured logging with configurable log levels.
 *
 * Log Levels:
 * - CONSOLE: Always output to browser console (for debugging)
 * - DEBUG: Verbose logging (for development)
 * - INFO: Important events (default)
 * - WARN: Warnings and recoverable errors
 * - ERROR: Unrecoverable errors only
 *
 * @example
 * Logger.debug('COMBAT', 'Applying damage', damageData);
 * Logger.info('INIT', 'System initialized');
 * Logger.warn('MODIFIERS', 'Deprecated modifier type used');
 * Logger.error('SKILLS', 'Skills not loaded');
 */
export class Logger {
  static CATEGORY_REGISTRY = {
    // Combat
    'COMBAT.RANGED': { group: 'combat', key: 'ranged-attacks', label: 'Ranged Attacks' },
    'COMBAT.MELEE': { group: 'combat', key: 'melee-attacks', label: 'Melee Attacks' },
    'COMBAT.DAMAGE': { group: 'combat', key: 'damage-application', label: 'Damage Application' },
    'COMBAT.RIGHTEOUS_FURY': { group: 'combat', key: 'righteous-fury', label: 'Righteous Fury' },
    'COMBAT.WEAPON_QUALITIES': { group: 'combat', key: 'weapon-qualities', label: 'Weapon Qualities' },
    'COMBAT.JAMMING': { group: 'combat', key: 'jamming-reloading', label: 'Jamming/Reloading' },

    // Character
    'CHARACTER.MODIFIERS': { group: 'character', key: 'modifiers', label: 'Modifiers' },
    'CHARACTER.XP': { group: 'character', key: 'xp-advancement', label: 'XP/Advancement' },
    'CHARACTER.WOUNDS': { group: 'character', key: 'wounds-fatigue', label: 'Wounds/Fatigue' },
    'CHARACTER.SKILLS': { group: 'character', key: 'skills', label: 'Skills' },
    'CHARACTER.CHARACTERISTICS': { group: 'character', key: 'characteristics', label: 'Characteristics' },
    'CHARACTER.INSANITY': { group: 'character', key: 'insanity', label: 'Insanity' },

    // Psychic
    'PSYCHIC.POWERS': { group: 'psychic', key: 'psychic-powers', label: 'Psychic Powers' },
    'PSYCHIC.PHENOMENA': { group: 'psychic', key: 'phenomena', label: 'Phenomena' },
    'PSYCHIC.PERILS': { group: 'psychic', key: 'perils', label: 'Perils' },

    // Squad
    'SQUAD.COHESION': { group: 'squad', key: 'cohesion', label: 'Cohesion' },
    'SQUAD.MODES': { group: 'squad', key: 'solo-squad-mode', label: 'Solo/Squad Mode' },

    // Items
    'ITEMS.WEAPONS': { group: 'items', key: 'weapon-upgrades', label: 'Weapon Upgrades' },
    'ITEMS.ARMOR': { group: 'items', key: 'armor', label: 'Armor' },
    'ITEMS.CYBERNETICS': { group: 'items', key: 'cybernetics', label: 'Cybernetics' },
    'ITEMS.EQUIPMENT': { group: 'items', key: 'equipment', label: 'Equipment' },

    // System
    'SYSTEM.INIT': { group: 'system', key: 'initialization', label: 'Initialization' },
    'SYSTEM.SETTINGS': { group: 'system', key: 'settings', label: 'Settings' },
    'SYSTEM.MIGRATION': { group: 'system', key: 'data-migration', label: 'Data Migration' },
    'SYSTEM.ERROR': { group: 'system', key: 'error-handling', label: 'Error Handling' },

    // Canvas
    'CANVAS.REGION': { group: 'canvas', key: 'regions', label: 'Regions' },

    // Hooks
    'HOOKS.ANIMATION': { group: 'hooks', key: 'animations', label: 'Animations' },

    // Token Action HUD
    'TAH.INIT': { group: 'tah', key: 'tah-initialization', label: 'TAH Initialization' }
  };

  static _enabledCategories = new Set();

  static _noOpStub;

  static _logger = null;

  /**
   * Initialize the Foundry logger with user-configured log level.
   * Called during system initialization.
   */
  static init() {
    // Get log level from settings (defaults to INFO if not set or game not ready)
    let logLevel = 'INFO';
    try {
      if (typeof game !== 'undefined' && game && game.settings && typeof game.settings.get === 'function') {
        logLevel = game.settings.get('deathwatch', 'logLevel') || 'INFO';
      }
    } catch (error) {
      // Settings not registered yet, use default
    }

    // Load enabled categories from settings
    this._enabledCategories.clear();
    try {
      if (typeof game !== 'undefined' && game && game.settings && typeof game.settings.get === 'function') {
        const enabledCategoryKeys = game.settings.get('deathwatch', 'enabledLogCategories') || [];
        enabledCategoryKeys.forEach(key => this._enabledCategories.add(key));
      }
    } catch (error) {
      // Settings not registered yet, no categories enabled
    }

    // Map string level to Foundry's numeric levels
    const levelMap = {
      'CONSOLE': -1, // Special: always output to console
      'DEBUG': 0,
      'INFO': 1,
      'WARN': 2,
      'ERROR': 3
    };

    const useConsole = logLevel === 'CONSOLE';

    this._logger = {
      level: levelMap.hasOwnProperty(logLevel) ? levelMap[logLevel] : 1,
      useConsole,
      _log(level, context, ...args) {
        // CONSOLE mode: always output to browser console using console.log
        if (this.useConsole) {
          console.log(`[Deathwatch:${context}]`, ...args);
        } else if (level >= this.level) {
          const method = ['log', 'info', 'warn', 'error'][level] || 'log';
          console[method](`[Deathwatch:${context}]`, ...args);
        }
      }
    };
  }

  /**
   * Check if a category is enabled based on context string.
   * @param {string} contextString - Hierarchical context (e.g., 'COMBAT.RANGED')
   * @returns {boolean} True if category is enabled
   * @private
   */
  static _isCategoryEnabled(contextString) {
    const meta = this.CATEGORY_REGISTRY[contextString];
    if (!meta) return false;
    return this._enabledCategories.has(meta.key);
  }

  /**
   * Create a logger proxy that forwards to real Logger with context.
   * @param {string} context - Context string for this category
   * @returns {Object} Logger proxy with debug/info/warn/error methods
   * @private
   */
  static _createCategoryLogger(context) {
    return {
      debug: (...args) => this.debug(context, ...args),
      info: (...args) => this.info(context, ...args),
      warn: (...args) => this.warn(context, ...args),
      error: (...args) => this.error(context, ...args)
    };
  }

  /**
   * Create a no-op logger stub (zero overhead when disabled).
   * @returns {Object} No-op stub with empty methods
   * @private
   */
  static _createNoOpLogger() {
    if (!this._noOpStub) {
      this._noOpStub = {
        debug: () => {},
        info: () => {},
        warn: () => {},
        error: () => {}
      };
    }
    return this._noOpStub;
  }

  /**
   * Get a category-filtered logger for a specific context.
   * Returns real logger if category is enabled, no-op stub if disabled.
   *
   * @param {string} contextString - Hierarchical context (e.g., 'COMBAT.RANGED')
   * @returns {Object} Logger proxy or no-op stub
   * @throws {Error} If context string is not in registry
   *
   * @example
   * Logger.category('COMBAT.RANGED').debug('Hit roll:', result);
   */
  static category(contextString) {
    if (!this.CATEGORY_REGISTRY[contextString]) {
      throw new Error(`Unknown logging category context: ${contextString}`);
    }

    if (this._isCategoryEnabled(contextString)) {
      return this._createCategoryLogger(contextString);
    } else {
      return this._createNoOpLogger();
    }
  }

  /**
   * Log debug message (verbose, for developers).
   * Only shown when log level is DEBUG or CONSOLE.
   *
   * @param {string} context - Component name (COMBAT, MODIFIERS, INIT, etc.)
   * @param {...any} args - Arguments to log
   *
   * @example
   * Logger.debug('COMBAT', 'Calculating damage', { damage: 15, penetration: 4 });
   */
  static debug(context, ...args) {
    if (!this._logger) this.init();
    this._logger._log(0, context, ...args);
  }

  /**
   * Log info message (important events).
   * Shown at INFO level and above, or when CONSOLE mode is enabled.
   *
   * @param {string} context - Component name
   * @param {...any} args - Arguments to log
   *
   * @example
   * Logger.info('INIT', 'System initialization complete');
   */
  static info(context, ...args) {
    if (!this._logger) this.init();
    this._logger._log(1, context, ...args);
  }

  /**
   * Log warning (recoverable errors, deprecated usage).
   * Shown at WARN level and above, or when CONSOLE mode is enabled.
   *
   * @param {string} context - Component name
   * @param {...any} args - Arguments to log
   *
   * @example
   * Logger.warn('MODIFIERS', 'Deprecated modifier type "bonus" used, use "characteristic" instead');
   */
  static warn(context, ...args) {
    if (!this._logger) this.init();
    this._logger._log(2, context, ...args);
  }

  /**
   * Log error (unrecoverable errors).
   * Always shown at any log level.
   *
   * @param {string} context - Component name
   * @param {...any} args - Arguments to log
   *
   * @example
   * Logger.error('SKILLS', 'Skills not loaded. Call SkillLoader.init() first.');
   */
  static error(context, ...args) {
    if (!this._logger) this.init();
    this._logger._log(3, context, ...args);
  }

  /**
   * Log compatibility warning for deprecated APIs.
   * Uses Foundry's built-in compatibility warning system.
   *
   * @param {string} message - Deprecation message
   * @param {Object} options - Deprecation options
   * @param {string} options.since - Version when deprecated
   * @param {string} options.until - Version when removed
   *
   * @example
   * Logger.compatibility('rollItemMacro() is deprecated', {
   *   since: '2.0.0',
   *   until: '3.0.0'
   * });
   */
  static compatibility(message, { since, until }) {
    if (typeof foundry !== 'undefined' && foundry.utils?.logCompatibilityWarning) {
      foundry.utils.logCompatibilityWarning(message, {
        since,
        until,
        details: 'See docs/improvements/ for migration guide'
      });
    } else {
      // Fallback if Foundry API not available
      this.warn('COMPATIBILITY', message, `(since ${since}, until ${until})`);
    }
  }
}
