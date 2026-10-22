import { DeathwatchActor } from "../documents/actor.mjs";
import { DeathwatchItem } from "../documents/item.mjs";
import * as models from '../data/_module.mjs';
import { DW_STATUS_EFFECTS } from "../helpers/status-effects.mjs";
import { INITIATIVE_CONSTANTS } from "../helpers/constants/index.mjs";

/**
 * Configures Foundry CONFIG object for the Deathwatch system.
 */
export class ConfigRegistrar {
  /**
   * Configure all system CONFIG settings
   */
  static configure() {
    // Set initiative formula
    CONFIG.Combat.initiative = {
      formula: INITIATIVE_CONSTANTS.FORMULA,
      decimals: INITIATIVE_CONSTANTS.DECIMALS
    };

    // Set combat turn marker
    CONFIG.Combat.turnMarker = {
      path: "systems/deathwatch/icons/aquila.png",
      animation: "pulse"
    };

    // Define custom Document classes
    CONFIG.Actor.documentClass = DeathwatchActor;
    CONFIG.Item.documentClass = DeathwatchItem;

    // Register Actor DataModels
    CONFIG.Actor.dataModels = {
      character: models.DeathwatchCharacter,
      npc: models.DeathwatchNPC,
      enemy: models.DeathwatchEnemy,
      horde: models.DeathwatchHorde
    };

    // Register Item DataModels
    CONFIG.Item.dataModels = {
      gear: models.DeathwatchGear,
      demeanour: models.DeathwatchDemeanour,
      trait: models.DeathwatchTrait,
      "armor-history": models.DeathwatchArmorHistory,
      "weapon-quality": models.DeathwatchWeaponQuality,
      "critical-effect": models.DeathwatchCriticalEffect,
      implant: models.DeathwatchImplant,
      cybernetic: models.DeathwatchCybernetic,
      talent: models.DeathwatchTalent,
      ammunition: models.DeathwatchAmmunition,
      "weapon-upgrade": models.DeathwatchWeaponUpgrade,
      "psychic-power": models.DeathwatchPsychicPower,
      "special-ability": models.DeathwatchSpecialAbility,
      armor: models.DeathwatchArmor,
      chapter: models.DeathwatchChapter,
      specialty: models.DeathwatchSpecialty,
      weapon: models.DeathwatchWeapon,
      "battle-trauma": models.DeathwatchBattleTrauma
    };

    // Register status effects
    CONFIG.statusEffects = DW_STATUS_EFFECTS;

    // Register special status effects
    CONFIG.specialStatusEffects = CONFIG.specialStatusEffects || {};
    for (const effect of DW_STATUS_EFFECTS) {
      if (effect.special) {
        CONFIG.specialStatusEffects[effect.special] = effect.id;
      }
    }
  }
}
