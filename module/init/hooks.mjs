import { InitiativeHelper } from "../helpers/initiative.mjs";
import { CohesionPanel } from "../ui/cohesion-panel.mjs";
import { applyOnFireEffects } from "../macros/on-fire-effects.mjs";
import { Sanitizer } from "../helpers/sanitizer.mjs";
import { AnimationHook } from "../hooks/animation-hook.mjs";
import { registerTemplateCleanupHook } from "./template-cleanup.mjs";

/**
 * Registers all runtime hooks for the Deathwatch system.
 */
export class InitHooks {
  /**
   * Register all hooks
   */
  static register() {
    this._registerInitiativeOverride();
    this._registerActorHooks();
    this._registerActiveEffectHooks();
    this._registerCombatHooks();
    this._registerSceneControlHooks();
    AnimationHook.register();
    registerTemplateCleanupHook();
  }

  /**
   * Override Combat.rollInitiative to show dialog
   */
  static _registerInitiativeOverride() {
    const originalRollInitiative = Combat.prototype.rollInitiative;
    Combat.prototype.rollInitiative = async function(ids, options = {}) {
      ids = typeof ids === "string" ? [ids] : ids;

      for (const id of ids) {
        const combatant = this.combatants.get(id);
        if (!combatant?.isOwner) continue;

        const customFormula = await InitiativeHelper.rollInitiativeDialog(combatant);
        if (!customFormula) continue;

        const roll = new Roll(customFormula, combatant.actor.getRollData());
        await roll.evaluate();

        await this.updateEmbeddedDocuments("Combatant", [{_id: id, initiative: roll.total}]);

        await roll.toMessage({
          speaker: ChatMessage.getSpeaker({ actor: combatant.actor, token: combatant.token }),
          flavor: `${Sanitizer.escape(combatant.name)} rolls for Initiative!`
        });
      }

      return this;
    };
  }

  /**
   * Register hooks for actor lifecycle events
   */
  static _registerActorHooks() {
    // Sync token name when actor name changes (for unlinked tokens like enemies/NPCs)
    Hooks.on('updateActor', (actor, changes, options, userId) => {
      if (!changes.name) return;
      for (const token of actor.getActiveTokens()) {
        if (!token.document.actorLink) {
          token.document.update({ name: changes.name });
        }
      }
    });

    // Auto-assign enemy/horde actors to an "Enemies" folder
    Hooks.on('createActor', async (actor, options, userId) => {
      if (game.user.id !== userId) return;
      if (actor.type !== 'enemy' && actor.type !== 'horde') return;
      if (actor.folder) return;

      let folder = game.folders.find(f => f.type === 'Actor' && f.name === 'Enemies');
      if (!folder) {
        folder = await Folder.create({ name: 'Enemies', type: 'Actor', parent: null });
      }
      if (folder) await actor.update({ folder: folder.id });
    });
  }

  /**
   * Register hooks for Active Effects
   */
  static _registerActiveEffectHooks() {
    // Re-render actor sheets when Active Effects change to keep checkboxes in sync
    Hooks.on('createActiveEffect', (effect, options, userId) => {
      if (effect.parent?.documentName === 'Actor') {
        effect.parent.sheet?.render(false);
      }
    });

    Hooks.on('deleteActiveEffect', (effect, options, userId) => {
      if (effect.parent?.documentName === 'Actor') {
        effect.parent.sheet?.render(false);
      }
    });
  }

  /**
   * Register hooks for combat events
   */
  static _registerCombatHooks() {
    // Check for On Fire condition when combat turn advances
    Hooks.on('updateCombat', async (combat, changed) => {
      if (!game.user.isGM) return;
      if (!("turn" in changed) && !("round" in changed)) return;

      // Reset Cohesion damage cap on new round
      if ("round" in changed) {
        game.settings.set('deathwatch', 'cohesionDamageThisRound', false);
      }

      const combatant = combat.combatants.get(combat.current.combatantId);
      if (!combatant?.actor?.hasCondition?.('on-fire')) return;

      const actor = combatant.actor;
      const safeActorName = Sanitizer.escape(actor.name);
      foundry.applications.api.DialogV2.wait({
        window: { title: `🔥 ${safeActorName} is On Fire!` },
        content: `<p><strong>${safeActorName}</strong> is On Fire! Apply fire damage and effects?</p>`,
        buttons: [
          { label: '🔥 Apply Fire', action: 'apply', callback: () => applyOnFireEffects(actor) },
          { label: 'Skip', action: 'skip' }
        ]
      });
    });
  }

  /**
   * Register hooks for scene control buttons
   */
  static _registerSceneControlHooks() {
    // Add Kill-team Cohesion toggle to Token Controls toolbar
    Hooks.on('getSceneControlButtons', (controls) => {
      const tokenControls = controls.tokens;
      if (tokenControls?.tools) {
        tokenControls.tools.cohesionPanel = {
          name: 'cohesionPanel',
          title: 'Toggle Cohesion Panel',
          icon: 'fas fa-shield-alt',
          button: true,
          visible: true,
          onChange: () => CohesionPanel.toggle()
        };
      }
    });
  }
}
