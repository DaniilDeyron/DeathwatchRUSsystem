import { CohesionHelper } from "../helpers/cohesion.mjs";
import { ModeHelper } from "../helpers/mode-helper.mjs";
import { MODES, CHARACTERISTIC_CONSTANTS } from "../helpers/constants/index.mjs";
import { Sanitizer } from "../helpers/sanitizer.mjs";

const { HandlebarsApplicationMixin, DialogV2 } = foundry.applications.api;

/**
 * Floating HUD panel displaying Kill-team Cohesion.
 * Singleton — one instance shared across the session.
 * @extends {ApplicationV2}
 */
export class CohesionPanel extends HandlebarsApplicationMixin(
  foundry.applications.api.ApplicationV2
) {
  static _instance = null;

  static getInstance() {
    if (!CohesionPanel._instance) {
      CohesionPanel._instance = new CohesionPanel();
    }
    return CohesionPanel._instance;
  }

  static DEFAULT_OPTIONS = {
    id: 'cohesion-panel',
    window: {
      title: '⚔ Kill-team Cohesion',
      minimizable: false,
      resizable: false
    },
    position: { width: 220, height: 'auto' },
    classes: ['cohesion-panel'],
    actions: {
      recover: CohesionPanel._onRecover,
      lose: CohesionPanel._onLose,
      recalculate: CohesionPanel._onRecalculate,
      edit: CohesionPanel._onEdit,
      setLeader: CohesionPanel._onSetLeader,
      challenge: CohesionPanel._onChallenge,
      toggleMode: CohesionPanel._onToggleMode,
      deactivateAbility: CohesionPanel._onDeactivateAbility
    }
  };

  static PARTS = {
    panel: { template: 'systems/deathwatch/templates/ui/cohesion-panel.html' }
  };

  _onFirstRender(context, options) {
    const left = Math.round((window.innerWidth - 220) / 2);
    this.setPosition({ left, top: 10 });
  }

  async _prepareContext(options) {
    const cohesion = game.settings.get('deathwatch', 'cohesion');
    const leaderId = game.settings.get('deathwatch', 'squadLeader');
    const leader = leaderId ? game.actors.get(leaderId) : null;
    const gmMod = game.settings.get('deathwatch', 'cohesionModifier');
    const activeAbilities = game.settings.get('deathwatch', 'activeSquadAbilities') || [];

    const characters = game.actors
      .filter(a => a.type === 'character')
      .map(a => ({
        id: a.id,
        name: a.name,
        mode: a.system.mode || MODES.SOLO,
        canToggle: game.user.isGM || a.isOwner
      }));

    const ownedActorIds = game.actors
      .filter(a => a.type === 'character' && a.isOwner)
      .map(a => a.id);

    return {
      value: cohesion.value,
      max: cohesion.max,
      leaderName: leader?.name || 'None',
      isGM: game.user.isGM,
      breakdown: CohesionHelper.buildCohesionBreakdown(leader, gmMod),
      characters,
      activeAbilities: activeAbilities.map(a => ({
        ...a,
        canDeactivate: game.user.isGM || ownedActorIds.includes(a.initiatorId)
      }))
    };
  }

  /**
   * Toggle the panel open/closed.
   */
  static toggle() {
    const panel = CohesionPanel.getInstance();
    if (panel.rendered) {
      panel.close();
    } else {
      panel.render(true);
    }
  }

  /* -------------------------------------------- */
  /*  Action Handlers (static, 'this' = panel)    */
  /* -------------------------------------------- */

  static async _onRecover(event, target) {
    await CohesionHelper.recoverCohesion(1);
  }

  static async _onLose(event, target) {
    await this._adjustCohesion(-1);
  }

  static async _onToggleMode(event, target) {
    if (!game.ready) return;
    const actorId = target.dataset.actorId;
    const actor = game.actors.get(actorId);
    if (!actor || !(actor instanceof Actor)) return;

    const currentMode = actor.system.mode || MODES.SOLO;
    const newMode = currentMode === MODES.SOLO ? MODES.SQUAD : MODES.SOLO;

    if (newMode === MODES.SQUAD) {
      const cohesion = game.settings.get('deathwatch', 'cohesion');
      if (!ModeHelper.canEnterSquadMode(cohesion.value)) {
        ui.notifications.warn('Cannot enter Squad Mode — Cohesion is 0.');
        return;
      }
    }

    if (newMode === MODES.SOLO) {
      await CohesionPanel.deactivateAbilitiesForActor(actorId);
    }

    await actor.update({ 'system.mode': newMode });
    await ChatMessage.create({ content: ModeHelper.buildModeChangeMessage(actor.name, newMode) });
    this.render(false);
  }

  static async _onDeactivateAbility(event, target) {
    const index = parseInt(target.dataset.index);

    if (!game.user.isGM) {
      game.socket.emit('system.deathwatch', { type: 'deactivateSquadAbility', index });
      return;
    }

    const active = game.settings.get('deathwatch', 'activeSquadAbilities') || [];
    if (index < 0 || index >= active.length) return;

    const removed = active[index];
    active.splice(index, 1);
    await game.settings.set('deathwatch', 'activeSquadAbilities', active);
    await ChatMessage.create({ content: ModeHelper.buildDeactivationMessage(removed.abilityName) });
  }

  /**
   * Force all characters in Squad Mode back to Solo Mode.
   */
  static async dropAllToSoloMode() {
    if (!game.ready) return;
    const squadCharacters = game.actors.filter(a => a.type === 'character' && a.system.mode === MODES.SQUAD);
    if (!squadCharacters.length) return;

    for (const actor of squadCharacters) {
      await actor.update({ 'system.mode': MODES.SOLO });
    }

    await game.settings.set('deathwatch', 'activeSquadAbilities', []);
    await ChatMessage.create({ content: ModeHelper.buildCohesionDepletedMessage() });
  }

  /* -------------------------------------------- */
  /*  Squad Ability Activation                    */
  /* -------------------------------------------- */

  static async activateSquadAbility(actor, ability) {
    const sys = ability.system;
    const cohesion = game.settings.get('deathwatch', 'cohesion');
    const check = ModeHelper.canActivateSquadAbility(actor.system.mode || MODES.SOLO, cohesion.value, sys.cohesionCost);
    if (!check.allowed) {
      ui.notifications.warn(check.reason);
      return;
    }

    const active = game.settings.get('deathwatch', 'activeSquadAbilities') || [];
    if (ModeHelper.isSustainingAbility(active, actor.id)) {
      const safeActorName = Sanitizer.escape(actor.name);
      ui.notifications.warn(`${safeActorName} is already sustaining a Squad Mode ability. Deactivate it first.`);
      return;
    }

    if (!game.user.isGM) {
      game.socket.emit('system.deathwatch', { type: 'activateSquadAbility', actorId: actor.id, abilityId: ability.id });
      return;
    }

    const newValue = cohesion.value - sys.cohesionCost;
    await game.settings.set('deathwatch', 'cohesion', { ...cohesion, value: newValue });

    if (sys.sustained) {
      active.push({
        abilityId: ability.id,
        abilityName: ability.name,
        initiatorId: actor.id,
        initiatorName: actor.name,
        sustained: true
      });
      await game.settings.set('deathwatch', 'activeSquadAbilities', active);
    }

    await ChatMessage.create({
      content: ModeHelper.buildSquadActivationMessage(
        actor.name, ability.name, sys.cohesionCost, newValue, cohesion.max,
        sys.effect || '', sys.improvements || [], actor.system.rank || 1
      )
    });
  }

  static async deactivateAbilitiesForActor(actorId) {
    const active = game.settings.get('deathwatch', 'activeSquadAbilities') || [];
    const remaining = active.filter(a => a.initiatorId !== actorId);
    if (remaining.length !== active.length) {
      await game.settings.set('deathwatch', 'activeSquadAbilities', remaining);
    }
  }

  async _adjustCohesion(delta) {
    const cohesion = game.settings.get('deathwatch', 'cohesion');
    const newValue = Math.max(0, Math.min(cohesion.max, cohesion.value + delta));
    if (newValue === cohesion.value) {
      ui.notifications.info(delta > 0 ? 'Cohesion is already at maximum.' : 'Cohesion is already at 0.');
      return;
    }
    await game.settings.set('deathwatch', 'cohesion', { ...cohesion, value: newValue });
    const label = delta > 0 ? 'Recovered' : 'Lost';
    await ChatMessage.create({
      content: `<div class="cohesion-chat"><strong>⚔ Cohesion ${label}</strong> — now ${newValue} / ${cohesion.max}</div>`
    });
  }

  /* -------------------------------------------- */
  /*  Dialogs (migrated to DialogV2)              */
  /* -------------------------------------------- */

  static async _onRecalculate(event, target) {
    const leaderId = game.settings.get('deathwatch', 'squadLeader');
    const leader = leaderId ? game.actors.get(leaderId) : null;
    if (!leader) return ui.notifications.warn('No squad leader assigned.');

    const currentGmMod = game.settings.get('deathwatch', 'cohesionModifier');
    const fsBonus = Math.floor((leader.system.characteristics?.fs?.value || 0) / CHARACTERISTIC_CONSTANTS.BONUS_DIVISOR);
    const rankMod = CohesionHelper.getRankModifier(leader.system.rank || 1);
    const commandMod = CohesionHelper.getCommandModifier(leader.system.skills?.command || {});

    const result = await DialogV2.prompt({
      window: { title: 'Recalculate Cohesion' },
      content: `
        <div class="form-group">Leader: <strong>${Sanitizer.escape(leader.name)}</strong></div>
        <div class="form-group">Fellowship Bonus: <strong>${fsBonus}</strong></div>
        <div class="form-group">Rank Modifier: <strong>+${rankMod}</strong></div>
        <div class="form-group">Command Modifier: <strong>+${commandMod}</strong></div>
        <hr/>
        <div class="form-group">
          <label>GM Modifier:</label>
          <input type="number" name="gmModifier" value="${currentGmMod}" />
        </div>`,
      ok: {
        label: 'Recalculate',
        callback: (event, button, dialog) => {
          return parseInt(button.form.elements.gmModifier.value) || 0;
        }
      }
    });

    if (result !== null) {
      await game.settings.set('deathwatch', 'cohesionModifier', result);
      const max = CohesionHelper.calculateCohesionMaxFromActor(leader, result);
      const current = game.settings.get('deathwatch', 'cohesion');
      await game.settings.set('deathwatch', 'cohesion', { value: Math.min(current.value, max), max });
    }
  }

  static async _onEdit(event, target) {
    const current = game.settings.get('deathwatch', 'cohesion');

    const result = await DialogV2.prompt({
      window: { title: 'Edit Cohesion' },
      content: `
        <div class="form-group">
          <label>Current:</label>
          <input type="number" name="cohesionValue" value="${current.value}" min="0" />
        </div>
        <div class="form-group">
          <label>Maximum:</label>
          <input type="number" name="cohesionMax" value="${current.max}" min="0" />
        </div>`,
      ok: {
        label: 'Save',
        callback: (event, button, dialog) => {
          const value = parseInt(button.form.elements.cohesionValue.value) || 0;
          const max = parseInt(button.form.elements.cohesionMax.value) || 0;
          return { value, max };
        }
      }
    });

    if (result !== null) {
      await game.settings.set('deathwatch', 'cohesion', { value: Math.min(result.value, result.max), max: result.max });
    }
  }

  static async _onSetLeader(event, target) {
    const characters = game.actors.filter(a => a.type === 'character');
    if (!characters.length) return ui.notifications.warn('No character actors found.');

    const currentLeader = game.settings.get('deathwatch', 'squadLeader');
    const options = characters.map(a => {
      const safeName = Sanitizer.escape(a.name);
      return `<option value="${a.id}" ${a.id === currentLeader ? 'selected' : ''}>${safeName}</option>`;
    }).join('');

    const result = await DialogV2.prompt({
      window: { title: 'Set Squad Leader' },
      content: `
        <div class="form-group">
          <label>Squad Leader:</label>
          <select name="leaderId">${options}</select>
        </div>`,
      ok: {
        label: 'Confirm',
        callback: (event, button, dialog) => {
          return button.form.elements.leaderId.value;
        }
      }
    });

    if (result !== null) {
      await game.settings.set('deathwatch', 'squadLeader', result);
      const gmMod = game.settings.get('deathwatch', 'cohesionModifier');
      const leader = game.actors.get(result);
      const max = CohesionHelper.calculateCohesionMaxFromActor(leader, gmMod);
      await game.settings.set('deathwatch', 'cohesion', { value: max, max });
    }
  }

  static async _onChallenge(event, target) {
    const owned = game.actors.filter(a => a.type === 'character' && a.isOwner);
    if (!owned.length) return ui.notifications.warn('No owned character actors found.');

    if (owned.length === 1) {
      return CohesionHelper.rollCohesionChallenge(owned[0]);
    }

    const options = owned.map(a => {
      const safeName = Sanitizer.escape(a.name);
      return `<option value="${a.id}">${safeName}</option>`;
    }).join('');

    const result = await DialogV2.prompt({
      window: { title: 'Cohesion Challenge' },
      content: `
        <div class="form-group">
          <label>Battle-Brother:</label>
          <select name="actorId">${options}</select>
        </div>`,
      ok: {
        label: 'Roll',
        callback: (event, button, dialog) => {
          return button.form.elements.actorId.value;
        }
      }
    });

    if (result !== null) {
      const actor = game.actors.get(result);
      if (actor) await CohesionHelper.rollCohesionChallenge(actor);
    }
  }
}
