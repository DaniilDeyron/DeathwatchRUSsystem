import { createItemMacro } from "../macros/hotbar.mjs";
import { shouldLoadTAH, initialize as initializeTAH } from '../token-action-hud/init.mjs';

/**
 * Handles initialization that must occur on the 'ready' hook.
 */
export class ReadyHook {
  /**
   * Initialize ready hook handlers
   */
  static async initialize() {
    await this._registerHotbarHook();
    await this._configureCombatTracker();
    await this._createSystemMacros();
    await this._initializeTokenActionHUD();
  }

  /**
   * Register hotbar drop handler
   */
  static async _registerHotbarHook() {
    // Wait to register hotbar drop hook on ready so that modules could register earlier if they want to
    Hooks.on("hotbarDrop", (bar, data, slot) => {
      if (data.type === "Item") {
        createItemMacro(data, slot);
        return false;
      }
    });
  }

  /**
   * Configure Combat Tracker defaults
   */
  static async _configureCombatTracker() {
    // Set Skip Defeated default on first load (respects manual changes after)
    if (game.user.isGM) {
      const config = game.settings.get("core", "combatTrackerConfig") || {};
      if (config.skipDefeated === undefined) {
        await game.settings.set("core", "combatTrackerConfig", { ...config, skipDefeated: true });
      }
    }
  }

  /**
   * Auto-create system macros for GM
   * NOTE: System macros have been moved to the Macros compendium pack.
   * GMs can drag macros from Compendium Packs > Deathwatch: Macros to their hotbar.
   */
  static async _createSystemMacros() {
    // No longer auto-creates macros - they are now available in the Macros compendium
  }

  /**
   * Initialize Token Action HUD integration if enabled
   */
  static async _initializeTokenActionHUD() {
    if (shouldLoadTAH()) {
      initializeTAH();
    }
  }
}
