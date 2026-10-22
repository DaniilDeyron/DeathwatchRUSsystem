/**
 * Define a set of template paths to pre-load
 * Pre-loaded templates are compiled and cached for fast access when rendering
 * @return {Promise}
 */
export const preloadHandlebarsTemplates = async function () {
  return foundry.applications.handlebars.loadTemplates([

    // Actor main sheets.
    "systems/deathwatch/templates/actor/actor-character-sheet.html",
    "systems/deathwatch/templates/actor/actor-npc-sheet.html",
    "systems/deathwatch/templates/actor/actor-enemy-sheet.html",
    "systems/deathwatch/templates/actor/actor-horde-sheet.html",

    // Actor partials.
    "systems/deathwatch/templates/actor/parts/actor-characteristics.html",
    "systems/deathwatch/templates/actor/parts/actor-movement.html",
    "systems/deathwatch/templates/actor/parts/actor-wounds.html",
    "systems/deathwatch/templates/actor/parts/actor-fatigue.html",
    "systems/deathwatch/templates/actor/parts/actor-psy-rating.html",
    "systems/deathwatch/templates/actor/parts/actor-talents.html",
    "systems/deathwatch/templates/actor/parts/actor-traits.html",
    "systems/deathwatch/templates/actor/parts/actor-augmentations.html",
    "systems/deathwatch/templates/actor/parts/actor-biography-fields.html",
    "systems/deathwatch/templates/actor/parts/actor-skills.html",
    "systems/deathwatch/templates/actor/parts/actor-items.html",
    "systems/deathwatch/templates/actor/parts/actor-psychic-powers.html",
    "systems/deathwatch/templates/actor/parts/actor-effects.html",
    "systems/deathwatch/templates/actor/parts/actor-mental-state.html",
    "systems/deathwatch/templates/actor/parts/actor-armor.html",
    "systems/deathwatch/templates/actor/parts/item-controls.html",
    "systems/deathwatch/templates/actor/parts/item-equipped.html",
    "systems/deathwatch/templates/actor/parts/item-image.html",

    // Item sheets.
    "systems/deathwatch/templates/item/item-weapon-sheet.html",
    "systems/deathwatch/templates/item/item-armor-sheet.html",
    "systems/deathwatch/templates/item/item-gear-sheet.html",
    "systems/deathwatch/templates/item/item-ammunition-sheet.html",
    "systems/deathwatch/templates/item/item-talent-sheet.html",
    "systems/deathwatch/templates/item/item-trait-sheet.html",
    "systems/deathwatch/templates/item/item-weapon-quality-sheet.html",
    "systems/deathwatch/templates/item/item-chapter-sheet.html",
    "systems/deathwatch/templates/item/item-armor-history-sheet.html",
    "systems/deathwatch/templates/item/item-implant-sheet.html",
    "systems/deathwatch/templates/item/item-cybernetic-sheet.html",
    "systems/deathwatch/templates/item/item-demeanour-sheet.html",
    "systems/deathwatch/templates/item/item-specialty-sheet.html",
    "systems/deathwatch/templates/item/item-characteristic-sheet.html",
    "systems/deathwatch/templates/item/item-characteristic-advance-sheet.html",
    "systems/deathwatch/templates/item/item-critical-effect-sheet.html",
    "systems/deathwatch/templates/item/item-psychic-power-sheet.html",

    // UI panels.
    "systems/deathwatch/templates/ui/cohesion-panel.html",

    // Token Action HUD.
    "systems/deathwatch/templates/token-action-hud/skill-selector.hbs",
  ]);
};
