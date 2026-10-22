import { CohesionPanel } from "../ui/cohesion-panel.mjs";
import { ModeHelper } from "../helpers/mode-helper.mjs";
import { HordeBreakingHelper } from "../helpers/combat/horde-breaking.mjs";
import { FireHelper } from "../helpers/combat/fire-helper.mjs";
import { Logger } from "../helpers/logger.mjs";
import { RollExecutor } from "../helpers/roll-executor.mjs";
import { CombatHelper } from "../helpers/combat/combat.mjs";
import { CombatRouter } from "../helpers/combat/combat-router.mjs";

/**
 * Handles socket communication for player-initiated world setting changes.
 */
export class SocketHandler {
  /**
   * Initialize socket communication
   */
  static initialize() {
    // Register socket namespace
    if (game.deathwatch) {
      game.deathwatch.socket = `system.deathwatch`;
    }

    // Register socket listener
    this._registerSocketListener();

    // Register hooks for settings changes
    this._registerSettingsHooks();

    // Register hooks for actor updates
    this._registerActorUpdateHooks();

    // Register hooks for horde breaking checks
    this._registerHordeBreakingHooks();
  }

  /**
   * Listen for socket messages (GM processes player requests)
   */
  static _registerSocketListener() {
    game.socket.on('system.deathwatch', async (data) => {
      if (data.type === 'activateSquadAbility' && game.user.isGM) {
        const actor = game.actors.get(data.actorId);
        const ability = actor?.items.get(data.abilityId);
        if (actor && ability) {
          await CohesionPanel.activateSquadAbility(actor, ability);
        }
      }

      if (data.type === 'deactivateSquadAbility' && game.user.isGM) {
        const active = game.settings.get('deathwatch', 'activeSquadAbilities') || [];
        if (data.index >= 0 && data.index < active.length) {
          const removed = active[data.index];
          active.splice(data.index, 1);
          await game.settings.set('deathwatch', 'activeSquadAbilities', active);
          await ChatMessage.create({ content: ModeHelper.buildDeactivationMessage(removed.abilityName) });
        }
      }

      if (data.type === 'applyActorDamage' && game.user.isGM) {
        const actor = game.actors.get(data.actorId);
        if (actor) {
          await actor.system.receiveDamage(data.damageOptions);
        }
      }

      if (data.type === 'applyHordeBatchDamage' && game.user.isGM) {
        const actor = game.actors.get(data.actorId);
        if (actor && actor.type === 'horde') {
          await actor.system.receiveBatchDamage(data.hits);
        }
      }

      if (data.type === 'flameDodgePrompt' && game.user.isGM) {
        await handleFlameDodgePrompt(data);
      }

      if (data.type === 'tah-action' && game.user.isGM) {
        await handleTAHSocketAction(data);
      }
    });
  }

  /**
   * Re-render Cohesion panel when settings change
   */
  static _registerSettingsHooks() {
    Hooks.on('updateSetting', (setting) => {
      // Re-render panel on cohesion-related settings changes
      if (['deathwatch.cohesion', 'deathwatch.squadLeader', 'deathwatch.cohesionModifier', 'deathwatch.activeSquadAbilities'].includes(setting.key)) {
        const panel = CohesionPanel.getInstance();
        if (panel.rendered) panel.render(false);
      }

      // Auto-drop to Solo Mode when cohesion reaches zero
      if (setting.key === 'deathwatch.cohesion' && game.user.isGM) {
        const cohesion = game.settings.get('deathwatch', 'cohesion');
        if (cohesion.value <= 0) {
          CohesionPanel.dropAllToSoloMode();
        }
      }
    });
  }

  /**
   * Re-render Cohesion panel when a character's mode changes
   */
  static _registerActorUpdateHooks() {
    Hooks.on('updateActor', (actor, changes) => {
      if (actor.type === 'character' && changes.system?.mode !== undefined) {
        const panel = CohesionPanel.getInstance();
        if (panel.rendered) panel.render(false);
      }
    });
  }

  /**
   * Check for horde breaking at start of horde's turn (GM only)
   */
  static _registerHordeBreakingHooks() {
    Hooks.on('updateCombat', async (combat, changed, options, userId) => {
      // Only GM processes horde breaking checks
      if (!game.user.isGM) return;

      // Only check when turn changes (not round changes or other updates)
      if (!("turn" in changed)) return;

      const combatant = combat.combatants.get(combat.current.combatantId);
      if (!combatant?.actor || combatant.actor.type !== 'horde') return;

      const actor = combatant.actor;
      const checkResult = await HordeBreakingHelper.checkBreaking(actor);

      if (checkResult.shouldCheck) {
        if (checkResult.autoBreaks) {
          // Auto-break (magnitude < 25%)
          await HordeBreakingHelper.applyBroken(actor, true);
        } else if (checkResult.needsTest) {
          // Prompt WP test
          await HordeBreakingHelper.promptBreakingTest(actor, checkResult);
        }
      }

      // Reset counter for new turn
      await HordeBreakingHelper.resetTurnCounter(actor);
    });
  }
}

/**
 * Handle Token Action HUD socket actions (GM only)
 * Processes player-initiated actions on GM-owned actors
 * Delegates to same methods as RollHandler for consistency
 *
 * @param {Object} data - Socket message data
 * @param {string} data.actorId - Actor ID
 * @param {string} data.encodedValue - Encoded action value (type|id or type|subtype|id)
 */
export async function handleTAHSocketAction(data) {
  // Only GM processes TAH socket actions
  if (!game.user.isGM) {
    return;
  }

  const actor = game.actors.get(data.actorId);
  if (!actor) {
    Logger.debug(`TAH Socket: Actor not found: ${data.actorId}`);
    return;
  }

  const decoded = _decodeValue(data.encodedValue);

  // Route to appropriate handler based on action type
  switch (decoded.type) {
    case 'weapon':
      await _handleWeaponAction(actor, decoded);
      break;
    case 'skill':
      await _handleSkillAction(actor, decoded);
      break;
    case 'characteristic':
      await _handleCharacteristicAction(actor, decoded);
      break;
    case 'combat-action':
      await _handleCombatAction(actor, decoded);
      break;
    default:
      Logger.debug(`TAH Socket: Unknown action type: ${decoded.type}`);
  }
}

/**
 * Decode TAH encoded value string
 * Format: "type|id" or "type|id|subaction" or "combat-action|unjam|weaponId"
 *
 * @param {string} encodedValue - Encoded value string
 * @returns {Object} Decoded action object with type, id, and optional subaction
 */
function _decodeValue(encodedValue) {
  const parts = encodedValue.split('|');

  if (parts.length >= 2) {
    return {
      type: parts[0],
      id: parts[1],
      subaction: parts[2] || null
    };
  }

  return { type: 'unknown', id: null, subaction: null };
}

/**
 * Handle combat action (unjam, etc.)
 * Format: "combat-action|unjam|weaponId"
 *
 * @param {Actor} actor - Actor performing action
 * @param {Object} decoded - Decoded action { type: 'combat-action', id: 'unjam', subaction: weaponId }
 */
async function _handleCombatAction(actor, decoded) {
  const actionType = decoded.id;
  const weaponId = decoded.subaction;

  if (actionType === 'unjam') {
    // Find jammed weapon
    const jammedWeapons = actor.items.filter(i => i.type === 'weapon' && i.system.jammed);

    // If weaponId provided, use that specific weapon
    let weapon;
    if (weaponId) {
      weapon = actor.items.get(weaponId);
      if (!weapon || !weapon.system.jammed) {
        Logger.debug(`TAH Socket: Weapon ${weaponId} not found or not jammed`);
        return;
      }
    } else if (jammedWeapons.length > 0) {
      // Use first jammed weapon
      weapon = jammedWeapons[0];
    } else {
      Logger.debug('TAH Socket: No jammed weapons found');
      return;
    }

    await CombatHelper.clearJam(actor, weapon);
  }
}

/**
 * Handle weapon attack action
 * Delegates to CombatRouter (same as RollHandler)
 *
 * @param {Actor} actor - Actor performing attack
 * @param {Object} decoded - Decoded action { type, id, subaction }
 */
async function _handleWeaponAction(actor, decoded) {
  const weaponId = decoded.id;
  const weapon = actor.items.get(weaponId);

  if (!weapon) {
    return; // Fail silently - weapon not found
  }

  await CombatRouter.executeAttack(actor, weapon);
}

/**
 * Handle skill test action
 * Delegates to RollExecutor.showSkillDialog (same as RollHandler)
 *
 * @param {Actor} actor - Actor performing skill test
 * @param {Object} decoded - Decoded action { type, id }
 */
async function _handleSkillAction(actor, decoded) {
  const skillKey = decoded.id;
  const skill = actor.system.skills?.find(s => s.key === skillKey);

  if (!skill) {
    return; // Fail silently - skill not found
  }

  // Delegate to RollExecutor (same signature as RollHandler line 126)
  await RollExecutor.showSkillDialog(actor, skill, skill.label, skill.total);
}

/**
 * Handle characteristic test action
 * Delegates to RollExecutor.showCharacteristicDialog (same as RollHandler)
 *
 * @param {Actor} actor - Actor performing characteristic test
 * @param {Object} decoded - Decoded action { type, id }
 */
async function _handleCharacteristicAction(actor, decoded) {
  const charKey = decoded.id;
  const charValue = actor.system.characteristics[charKey]?.total;

  if (charValue === undefined) {
    return; // Fail silently - characteristic not found
  }

  // Convert key to label (same as RollHandler line 143)
  const label = _charKeyToLabel(charKey);

  // Delegate to RollExecutor (same signature as RollHandler line 146)
  await RollExecutor.showCharacteristicDialog(actor, charValue, label);
}

/**
 * Convert characteristic key to label
 * Same mapping as RollHandler line 209-220
 *
 * @param {string} key - Characteristic key (e.g., "weaponSkill")
 * @returns {string} Label (e.g., "Weapon Skill")
 */
function _charKeyToLabel(key) {
  const labels = {
    weaponSkill: 'Weapon Skill',
    ballisticSkill: 'Ballistic Skill',
    strength: 'Strength',
    toughness: 'Toughness',
    agility: 'Agility',
    intelligence: 'Intelligence',
    perception: 'Perception',
    willpower: 'Willpower',
    fellowship: 'Fellowship',
  };

  return labels[key] || key;
}

/**
 * GM-only handler for flame dodge prompt.
 * Invoked via socket when player initiates flame attack against individual target.
 * @param {Object} data - Socket data
 */
export async function handleFlameDodgePrompt(data) {
  const { targetActorId, targetName, damageFormula, penetration, damageType, sourceTokenId, targetTokenId, sceneId } = data;

  // Resolve tokens
  const scene = game.scenes.get(sceneId);
  if (!scene) return;

  const sourceTokenDoc = scene.tokens.get(sourceTokenId);
  const targetTokenDoc = scene.tokens.get(targetTokenId);
  if (!sourceTokenDoc || !targetTokenDoc) return;

  const sourceToken = sourceTokenDoc.object;
  const targetToken = targetTokenDoc.object;
  const targetActor = targetTokenDoc.actor;
  if (!targetActor) return;
  const ag = targetActor.system.characteristics?.ag?.value || 0;

  const dodgeContent = `
    <div style="margin-bottom: 8px;"><strong>🔥 Dodge Flame: ${targetName}</strong></div>
    <div class="form-group">
      <label>AG: ${ag}</label>
    </div>
    <div class="form-group">
      <label>Misc Modifier:</label>
      <input type="number" id="dodgeMod" value="0" style="width: 60px;" />
    </div>
  `;

  // GM sees dodge dialog
  foundry.applications.api.DialogV2.wait({
    window: { title: `🔥 Dodge Flame: ${targetName}` },
    content: dodgeContent,
    buttons: [
      {
        label: 'Roll Dodge', action: 'roll',
        callback: (event, button, dodgeDialog) =>
          _handleFlameDodgeRoll(targetActor, targetName, ag, dodgeDialog, damageFormula, penetration, damageType, sourceToken, targetToken)
      },
      { label: 'Cancel', action: 'cancel' }
    ]
  });
}

/**
 * Handle flame dodge roll and subsequent damage/catch fire tests.
 * @private
 */
async function _handleFlameDodgeRoll(targetActor, targetName, ag, dodgeDialog, damageFormula, penetration, damageType, sourceToken, targetToken) {
  const dodgeMod = parseInt(dodgeDialog.element.querySelector('#dodgeMod').value) || 0;
  const dodgeRoll = await new Roll('1d100').evaluate();
  const dodgeResult = FireHelper.resolveDodgeFlameTest(ag, dodgeRoll.total, dodgeMod);
  const dodgeFlavor = FireHelper.buildDodgeFlameFlavor(targetName, ag, dodgeResult, dodgeMod);

  await dodgeRoll.toMessage({
    speaker: ChatMessage.getSpeaker({ actor: targetActor }),
    flavor: dodgeFlavor,
    rollMode: game.settings.get('core', 'rollMode')
  });

  if (!dodgeResult.success) {
    // Apply damage
    const damageRoll = await new Roll(damageFormula).evaluate();
    const damage = damageRoll.total;
    const locRoll = await new Roll('1d100').evaluate();
    const location = CombatHelper.determineHitLocation(locRoll.total);

    await CombatHelper.applyDamage(targetActor, {
      damage, penetration, location, damageType,
      felling: 0, isPrimitive: false, isRazorSharp: false,
      degreesOfSuccess: 0, isScatter: false, isLongOrExtremeRange: false,
      isShocking: false, isToxic: false, isMeltaRange: false
    });

    // Catch Fire test
    const catchFireRoll = await new Roll('1d100').evaluate();
    const catchResult = FireHelper.resolveCatchFireTest(ag, catchFireRoll.total);
    const catchFlavor = FireHelper.buildCatchFireFlavor(targetName, ag, catchResult);

    if (!catchResult.success) {
      await targetActor.setCondition('on-fire', true);
    }

    await catchFireRoll.toMessage({
      speaker: ChatMessage.getSpeaker({ actor: targetActor }),
      flavor: catchFlavor,
      rollMode: game.settings.get('core', 'rollMode')
    });
  }
}
