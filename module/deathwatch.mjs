// Import document classes.
import { DeathwatchActor } from "./documents/actor.mjs";
import { DeathwatchItem } from "./documents/item.mjs";
// Import sheet classes.
import { DeathwatchActorSheetV2 } from "./sheets/actor-sheet-v2.mjs";
import { DeathwatchItemSheetV2 } from "./sheets/item-sheet-v2.mjs";
// Import initialization modules.
import { SettingsRegistrar } from "./init/settings.mjs";
import { ConfigRegistrar } from "./init/config.mjs";
import { InitHooks } from "./init/hooks.mjs";
import { SocketHandler } from "./init/socket.mjs";
import { ReadyHook } from "./init/ready-hook.mjs";
import { ChatButtonHandlers } from "./chat/button-handlers.mjs";
// Import helper/utility classes.
import { preloadHandlebarsTemplates } from "./helpers/ui/templates.mjs";
import { DWConfig } from "./helpers/config.mjs";
import { initializeHandlebars } from "./helpers/ui/handlebars.js";
import { SkillLoader } from "./helpers/character/skill-loader.mjs";
import { CohesionHelper } from "./helpers/cohesion.mjs";
import { CohesionPanel } from "./ui/cohesion-panel.mjs";
import { CombatHelper } from "./helpers/combat/combat.mjs";
import { CombatRouter } from "./helpers/combat/combat-router.mjs";
import { Logger } from "./helpers/logger.mjs";
// Import macros.
import { applyOnFireEffects } from "./macros/on-fire-effects.mjs";
import { flameAttack } from "./macros/flame-attack.mjs";
import { rollItemMacro } from "./macros/hotbar.mjs";
// Import API modules.
import { SkillRoller } from "./api/skill-roller.mjs";
import { CharacteristicRoller } from "./api/characteristic-roller.mjs";

/* -------------------------------------------- */
/*  Init Hook                                   */
/* -------------------------------------------- */

Hooks.once('init', async function () {
  // Initialize logger first (before settings are registered)
  Logger.init();
  Logger.category('SYSTEM.INIT').info('Initializing system');

  // Load skill definitions
  await SkillLoader.init();

  // Add utility classes to the global game object so that they're more easily
  // accessible in global contexts.
  game.deathwatch = {
    DeathwatchActor,
    DeathwatchItem,
    rollItemMacro,        // From macros/hotbar.mjs
    flameAttack,          // From macros/flame-attack.mjs
    applyOnFireEffects,   // From macros/on-fire-effects.mjs
    CohesionHelper,
    CohesionPanel,
    CombatHelper,
    CombatRouter,
    Logger,
    // Public API for macros
    rollSkill: SkillRoller.rollSkill.bind(SkillRoller),
    rollCharacteristic: CharacteristicRoller.rollCharacteristic.bind(CharacteristicRoller),
    getDifficulties: SkillRoller.getDifficulties.bind(SkillRoller),
    getCharacteristics: CharacteristicRoller.getCharacteristics.bind(CharacteristicRoller)
  };

  // Add custom constants for configuration.
  game.deathwatch.config = DWConfig;

  // Register world and client settings
  SettingsRegistrar.register();

  // Reinitialize logger after settings are registered (to load log level setting)
  Logger.init();

  // Configure Foundry CONFIG object
  ConfigRegistrar.configure();

  // Register runtime hooks
  InitHooks.register();

  // Register sheet application classes (V2 only)
  foundry.documents.collections.Actors.unregisterSheet("core", foundry.appv1.sheets.ActorSheet);
  foundry.documents.collections.Actors.registerSheet("deathwatch", DeathwatchActorSheetV2, { makeDefault: true });
  foundry.documents.collections.Items.unregisterSheet("core", foundry.appv1.sheets.ItemSheet);
  foundry.documents.collections.Items.registerSheet("deathwatch", DeathwatchItemSheetV2, { makeDefault: true });

  // Initialize Handlebars
  initializeHandlebars();

  // Preload Handlebars templates
  await preloadHandlebarsTemplates();

  Logger.category('SYSTEM.INIT').info('Initialization complete');
});

/* -------------------------------------------- */
/*  Ready Hook                                  */
/* -------------------------------------------- */

Hooks.once('ready', async function () {
  Logger.category('SYSTEM.INIT').info('System ready');

  // Initialize socket communication
  SocketHandler.initialize();

  // Register chat button handlers
  ChatButtonHandlers.register();

  // Initialize ready hook handlers (hotbar, combat tracker, system macros)
  await ReadyHook.initialize();

  Logger.category('SYSTEM.INIT').info('Ready');
});
