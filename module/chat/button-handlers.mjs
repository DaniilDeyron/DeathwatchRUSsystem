import { CombatHelper } from "../helpers/combat/combat.mjs";
import { PsychicCombatHelper } from "../helpers/combat/psychic-combat.mjs";
import { CriticalEffectsHelper } from "../helpers/combat/critical-effects.mjs";
import { FireHelper } from "../helpers/combat/fire-helper.mjs";
import { CohesionHelper } from "../helpers/cohesion.mjs";
import { ErrorHandler } from "../helpers/error-handler.mjs";
import { Validation } from "../helpers/validation.mjs";
import { Sanitizer } from "../helpers/sanitizer.mjs";
import { ROLL_CONSTANTS } from "../helpers/constants/index.mjs";
import { MODIFIER_TYPES } from "../helpers/constants/modifier-constants.mjs";

/**
 * Handles chat message button event listeners.
 */
export class ChatButtonHandlers {
  /**
   * Register all chat button handlers
   */
  static register() {
    Hooks.on('renderChatMessageHTML', (message, html) => {
      this._registerApplyDamageButton(html);
      this._registerShockingTestButton(html);
      this._registerToxicTestButton(html);
      this._registerCharDamageButton(html);
      this._registerForceChannelButton(html);
      this._registerRollCriticalButton(html);
      this._registerCohesionRallyButton(html);
      this._registerCohesionDamageAcceptButton(html);
      this._registerExtinguishButton(html);
      this._registerPsychicOpposeButton(html);
    });
  }

  /**
   * Resolve an actor from button dataset. For unlinked tokens, resolves the
   * synthetic token actor so damage is applied to the token, not the base actor.
   * @param {HTMLElement} button - The clicked button element
   * @param {string} [actorIdAttr='targetId'] - Dataset attribute name for actor ID
   * @returns {Actor|null}
   */
  static _resolveActor(button, actorIdAttr = 'targetId') {
    const sceneId = button.dataset.sceneId;
    const tokenId = button.dataset.tokenId;
    if (sceneId && tokenId) {
      const tokenDoc = game.scenes.get(sceneId)?.tokens.get(tokenId);
      if (tokenDoc?.actor) return tokenDoc.actor;
    }
    const actorId = button.dataset[actorIdAttr];
    return actorId ? game.actors.get(actorId) : null;
  }

  /**
   * Register Apply Damage button handler
   */
  static _registerApplyDamageButton(html) {
    html.querySelectorAll('.apply-damage-btn').forEach(btn => {
      // Check permission and set visibility attribute
      const targetActor = this._resolveActor(btn);
      if (targetActor) {
        const restrictButtons = game.settings.get('deathwatch', 'restrictApplyDamageButton');
        const canApply = !restrictButtons || game.user.isGM || targetActor.isOwner;
        btn.dataset.canApply = canApply;
      } else {
        // No target actor found - hide button (safety fallback)
        btn.dataset.canApply = false;
      }

      btn.addEventListener('click', ErrorHandler.wrap(async (ev) => {
        const button = ev.currentTarget;
        const d = button.dataset;

      // Validate and parse required fields
      const damage = Validation.requireInt(d.damage, 'Damage');
      const penetration = Validation.requireInt(d.penetration, 'Penetration');
      const location = d.location;
      const damageType = d.damageType || 'Impact';
      const isPrimitive = Validation.parseBoolean(d.isPrimitive);
      const isRazorSharp = Validation.parseBoolean(d.isRazorSharp);
      const degreesOfSuccess = parseInt(d.degreesOfSuccess) || 0;
      const isScatter = Validation.parseBoolean(d.isScatter);
      const isLongOrExtremeRange = Validation.parseBoolean(d.isLongOrExtremeRange);
      const isShocking = Validation.parseBoolean(d.isShocking);
      const isToxic = Validation.parseBoolean(d.isToxic);
      const isMeltaRange = Validation.parseBoolean(d.isMeltaRange);

      const charDamageFormula = d.charDamageFormula;
      const charDamageChar = d.charDamageChar;
      const charDamageName = d.charDamageName;
      const charDamageEffect = charDamageFormula ? { formula: charDamageFormula, characteristic: charDamageChar, name: charDamageName } : null;

      const isForce = Validation.parseBoolean(d.isForce);
      const forceAttackerId = d.forceAttackerId;
      const forcePsyRating = parseInt(d.forcePsyRating) || 0;
      const forceWeaponData = isForce ? { attackerId: forceAttackerId, psyRating: forcePsyRating } : null;

      const magnitudeBonusDamage = parseInt(d.magnitudeBonusDamage) || 0;
      const ignoresNaturalArmour = Validation.parseBoolean(d.ignoresNaturalArmour);
      const criticalDamageBonus = parseInt(d.criticalDamageBonus) || 0;

      const sceneId = d.sceneId;
      const tokenId = d.tokenId;
      const tokenInfo = (sceneId && tokenId) ? { sceneId, tokenId } : null;

      const targetActor = this._resolveActor(button);
      Validation.requireDocument(targetActor, 'Target Actor', 'Apply Damage');

      await CombatHelper.applyDamageWithPermissionCheck(targetActor, { damage, penetration, location, damageType, felling: 0, isPrimitive, isRazorSharp, degreesOfSuccess, isScatter, isLongOrExtremeRange, isShocking, isToxic, isMeltaRange, charDamageEffect, forceWeaponData, tokenInfo, magnitudeBonusDamage, ignoresNaturalArmour, criticalDamageBonus });

      const weaponQualitiesRaw = d.weaponQualities;
      const weaponQualities = weaponQualitiesRaw ? (typeof weaponQualitiesRaw === 'string' ? Validation.parseJSON(weaponQualitiesRaw, 'Weapon Qualities') : weaponQualitiesRaw) : [];
      if (targetActor.type === 'character' && CohesionHelper.shouldTriggerCohesionDamage(damage, weaponQualities)) {
        await CohesionHelper.handleCohesionDamage(`${Sanitizer.escape(targetActor.name)} took ${damage} raw damage from a qualifying weapon.`);
      }
      }, 'Apply Damage'));
    });
  }

  /**
   * Register Shocking Test button handler
   */
  static _registerShockingTestButton(html) {
    html.querySelectorAll('.shocking-test-btn').forEach(btn => btn.addEventListener('click', ErrorHandler.wrap(async (ev) => {
      const button = ev.currentTarget;
      const armorValue = Validation.requireInt(button.dataset.armorValue, 'Armor Value');
      const stunRounds = Validation.requireInt(button.dataset.stunRounds, 'Stun Rounds');

      const actor = this._resolveActor(button, 'actorId');
      Validation.requireDocument(actor, 'Actor', 'Shocking Test');

      const tg = actor.system.characteristics?.tg?.value || 0;
      const armorBonus = armorValue * 10;
      const targetNumber = tg + armorBonus;

      const roll = await new Roll('1d100').evaluate();
      const success = roll.total <= targetNumber;

      let flavor = `<strong>Shocking Toughness Test</strong><br>Target: ${targetNumber} (TG ${tg} + ${armorBonus} armor bonus)<br>`;
      if (success) {
        flavor += '<strong style="color: green;">SUCCESS - Not Stunned</strong>';
      } else {
        flavor += `<strong style="color: red;">FAILED - Stunned for ${stunRounds} rounds!</strong>`;
      }

      await roll.toMessage({
        speaker: ChatMessage.getSpeaker({ actor }),
        flavor,
        rollMode: game.settings.get('core', 'rollMode')
      });
    }, 'Shocking Test')));
  }

  /**
   * Register Toxic Test button handler
   */
  static _registerToxicTestButton(html) {
    html.querySelectorAll('.toxic-test-btn').forEach(btn => btn.addEventListener('click', ErrorHandler.wrap(async (ev) => {
      const button = ev.currentTarget;
      const penalty = Validation.requireInt(button.dataset.penalty, 'Penalty');

      const actor = this._resolveActor(button, 'actorId');
      Validation.requireDocument(actor, 'Actor', 'Toxic Test');

      const tg = actor.system.characteristics?.tg?.value || 0;
      const targetNumber = tg - penalty;

      const roll = await new Roll('1d100').evaluate();
      const success = roll.total <= targetNumber;

      let flavor = `<strong>Toxic Toughness Test</strong><br>Target: ${targetNumber} (TG ${tg} - ${penalty} penalty)<br>`;
      if (success) {
        flavor += '<strong style="color: green;">SUCCESS - No Additional Damage</strong>';
      } else {
        const toxicRoll = await new Roll('1d10').evaluate();
        const toxicDamage = toxicRoll.total;
        flavor += `<strong style="color: red;">FAILED - Takes ${toxicDamage} Impact Damage (ignores armor & TB)</strong>`;

        const currentWounds = actor.system.wounds.value || 0;
        await actor.update({ 'system.wounds.value': currentWounds + toxicDamage });

        await toxicRoll.toMessage({
          speaker: ChatMessage.getSpeaker({ actor }),
          flavor: '<strong>Toxic Damage</strong>',
          rollMode: game.settings.get('core', 'rollMode')
        });
      }

      await roll.toMessage({
        speaker: ChatMessage.getSpeaker({ actor }),
        flavor,
        rollMode: game.settings.get('core', 'rollMode')
      });
    }, 'Toxic Test')));
  }

  /**
   * Register Characteristic Damage button handler
   */
  static _registerCharDamageButton(html) {
    html.querySelectorAll('.char-damage-btn').forEach(btn => btn.addEventListener('click', ErrorHandler.wrap(async (ev) => {
      const button = ev.currentTarget;
      const formula = button.dataset.formula;
      const characteristic = button.dataset.characteristic;
      const effectName = button.dataset.name || 'Characteristic Damage';

      const actor = this._resolveActor(button, 'actorId');
      Validation.requireDocument(actor, 'Actor', 'Characteristic Damage');

      if (!formula) {
        throw new Error('Damage formula not provided');
      }
      if (!characteristic) {
        throw new Error('Characteristic not provided');
      }

      const roll = await new Roll(formula).evaluate();
      const charDamage = roll.total;

      // Find existing modifier for this characteristic damage source, or create new
      const modifiers = Array.isArray(actor.system.modifiers) ? [...actor.system.modifiers] : [];
      const existingIndex = modifiers.findIndex(m =>
        m.effectType === 'characteristic' &&
        m.valueAffected === characteristic &&
        m.source === 'Characteristic Damage' &&
        m.name === effectName
      );

      if (existingIndex >= 0) {
        // Accumulate damage to existing modifier
        const currentModifier = modifiers[existingIndex].modifier;
        const newModifier = currentModifier - charDamage; // Negative for penalty
        modifiers[existingIndex].modifier = newModifier;
      } else {
        // Create new modifier
        modifiers.push({
          _id: foundry.utils.randomID(),
          name: effectName,
          modifier: -charDamage, // Negative for penalty
          type: MODIFIER_TYPES.CIRCUMSTANCE,
          modifierType: 'constant',
          effectType: 'characteristic',
          valueAffected: characteristic,
          enabled: true,
          source: 'Characteristic Damage'
        });
      }

      await actor.update({ 'system.modifiers': modifiers });

      const charName = characteristic.toUpperCase();
      const totalPenalty = modifiers
        .filter(m => m.effectType === 'characteristic' && m.valueAffected === characteristic && m.source === 'Characteristic Damage')
        .reduce((sum, m) => sum + m.modifier, 0);

      const flavor = `<strong>Characteristic Damage</strong><br><strong style="color: red;">${charName} takes ${charDamage} damage</strong><br>Total ${charName} Penalty: ${totalPenalty}`;

      await roll.toMessage({
        speaker: ChatMessage.getSpeaker({ actor }),
        flavor,
        rollMode: game.settings.get('core', 'rollMode')
      });
    }, 'Characteristic Damage')));
  }

  /**
   * Register Force Channel button handler (for Force weapon quality)
   */
  static _registerForceChannelButton(html) {
    html.querySelectorAll('.force-channel-btn').forEach(btn => btn.addEventListener('click', ErrorHandler.wrap(async (ev) => {
      const button = ev.currentTarget;
      const attackerId = button.dataset.attackerId;
      const psyRating = Validation.requireInt(button.dataset.psyRating, 'Psy Rating');

      const attacker = Validation.requireActor(attackerId, 'Force Channel');
      const target = this._resolveActor(button);
      Validation.requireDocument(target, 'Target Actor', 'Force Channel');
      const targetId = button.dataset.targetId;

      const attackerWP = attacker.system.characteristics?.wil?.value || 0;
      const targetWP = target.system.characteristics?.wil?.value || 0;

      const attackerRoll = await new Roll('1d100').evaluate();
      const targetRoll = await new Roll('1d100').evaluate();

      const attackerDoS = attackerRoll.total <= attackerWP ? Math.floor((attackerWP - attackerRoll.total) / ROLL_CONSTANTS.DEGREES_DIVISOR) + 1 : 0;
      const targetDoS = targetRoll.total <= targetWP ? Math.floor((targetWP - targetRoll.total) / ROLL_CONSTANTS.DEGREES_DIVISOR) + 1 : 0;

      const attackerWins = attackerDoS > targetDoS;
      const netDoS = attackerDoS - targetDoS;

      const safeAttackerName = Sanitizer.escape(attacker.name);
      const safeTargetName = Sanitizer.escape(target.name);
      let flavor = `<strong style="background: #4a0080; color: #e0b0ff; padding: 2px 6px; border-radius: 3px;">🔮 Force: Channel Psychic Energy 🔮</strong>`;
      flavor += `<br><strong>${safeAttackerName}</strong> WP ${attackerWP}: rolled ${attackerRoll.total} (${attackerDoS} DoS)`;
      flavor += `<br><strong>${safeTargetName}</strong> WP ${targetWP}: rolled ${targetRoll.total} (${targetDoS} DoS)`;

      if (attackerWins && netDoS > 0) {
        const forceDamageFormula = `${netDoS}d10`;
        const forceDamageRoll = await new Roll(forceDamageFormula).evaluate();
        const forceDamage = forceDamageRoll.total;

        flavor += `<br><strong style="color: #9900cc;">SUCCESS (${netDoS} net DoS) - ${forceDamage} Energy Damage (ignores Armour & TB)</strong>`;

        const currentWounds = target.system.wounds.value || 0;
        const maxWounds = target.system.wounds.max || 0;
        const newWounds = currentWounds + forceDamage;
        await target.update({ 'system.wounds.value': newWounds });

        if (newWounds > maxWounds) {
          const criticalDamage = newWounds - maxWounds;
          flavor += `<br><strong style="color: darkred; font-size: 1.1em;">☠ CRITICAL DAMAGE: ${criticalDamage} ☠</strong>`;
          flavor += `<br><button class="roll-critical-btn" data-actor-id="${targetId}" data-location="Body" data-damage-type="Energy" data-critical-damage="${criticalDamage}">Apply Critical Effect</button>`;
        }

        await forceDamageRoll.toMessage({
          speaker: ChatMessage.getSpeaker({ actor: attacker }),
          flavor,
          rollMode: game.settings.get('core', 'rollMode')
        });
      } else {
        flavor += `<br><strong style="color: green;">FAILED - Target resists the psychic force</strong>`;

        await attackerRoll.toMessage({
          speaker: ChatMessage.getSpeaker({ actor: attacker }),
          flavor,
          rollMode: game.settings.get('core', 'rollMode')
        });
      }
    }, 'Force Channel')));
  }

  /**
   * Register Roll Critical button handler
   */
  static _registerRollCriticalButton(html) {
    html.querySelectorAll('.roll-critical-btn').forEach(btn => {
      // Check permission and set visibility attribute
      const targetActor = this._resolveActor(btn, 'actorId');
      if (targetActor) {
        const restrictButtons = game.settings.get('deathwatch', 'restrictApplyDamageButton');
        const canApply = !restrictButtons || game.user.isGM || targetActor.isOwner;
        btn.dataset.canApply = canApply;
      } else {
        // No target actor found - hide button (safety fallback)
        btn.dataset.canApply = false;
      }

      btn.addEventListener('click', ErrorHandler.wrap(async (ev) => {
        const button = ev.currentTarget;
        const location = button.dataset.location;
        const damageType = button.dataset.damageType;
        const criticalDamage = button.dataset.criticalDamage ? parseInt(button.dataset.criticalDamage) : undefined;

        const actor = this._resolveActor(button, 'actorId');
        Validation.requireDocument(actor, 'Actor', 'Roll Critical');

        await CriticalEffectsHelper.applyCriticalEffect(actor, location, damageType, criticalDamage);
      }, 'Roll Critical'));
    });
  }

  /**
   * Register Cohesion Rally button handler
   */
  static _registerCohesionRallyButton(html) {
    html.querySelectorAll('.cohesion-rally-btn').forEach(btn => btn.addEventListener('click', ErrorHandler.wrap(async (ev) => {
      const button = ev.currentTarget;
      const leaderId = button.dataset.leaderId;
      const leader = Validation.requireActor(leaderId, 'Rally Test');

      const commandTotal = leader.system.skills?.command?.total || 0;
      const fsValue = leader.system.characteristics?.fs?.value || 0;
      const targetNumber = Math.max(commandTotal, fsValue);

      const roll = await new Roll('1d100').evaluate();
      const success = CohesionHelper.resolveRallyTest(targetNumber, roll.total);

      const safeLeaderName = Sanitizer.escape(leader.name);
      if (success) {
        await roll.toMessage({
          speaker: ChatMessage.getSpeaker({ actor: leader }),
          flavor: `<strong>🛡 Rally Successful!</strong><br>${safeLeaderName} rallies the Kill-team! (Rolled ${roll.total} vs ${targetNumber})<br>Cohesion damage negated.`
        });
      } else {
        await CohesionHelper.applyCohesionDamage(1);
        const cohesion = game.settings.get('deathwatch', 'cohesion');
        await roll.toMessage({
          speaker: ChatMessage.getSpeaker({ actor: leader }),
          flavor: `<strong>⚠ Rally Failed!</strong><br>${safeLeaderName} fails to rally! (Rolled ${roll.total} vs ${targetNumber})<br>Kill-team loses 1 Cohesion. Now ${cohesion.value} / ${cohesion.max}`
        });
      }
    }, 'Rally Test')));
  }

  /**
   * Register Cohesion Damage Accept button handler
   */
  static _registerCohesionDamageAcceptButton(html) {
    html.querySelectorAll('.cohesion-damage-accept-btn').forEach(btn => btn.addEventListener('click', ErrorHandler.wrap(async () => {
      await CohesionHelper.applyCohesionDamage(1);
      const cohesion = game.settings.get('deathwatch', 'cohesion');
      await ChatMessage.create({
        content: `<div class="cohesion-chat"><strong>⚠ Cohesion Lost</strong> — Kill-team loses 1 Cohesion. Now ${cohesion.value} / ${cohesion.max}</div>`
      });
    }, 'Accept Cohesion Damage')));
  }

  /**
   * Register Extinguish button handler (put out On Fire status)
   */
  static _registerExtinguishButton(html) {
    html.querySelectorAll('.extinguish-btn').forEach(btn => btn.addEventListener('click', ErrorHandler.wrap(async (ev) => {
      const button = ev.currentTarget;
      const actor = this._resolveActor(button, 'actorId');
      Validation.requireDocument(actor, 'Actor', 'Extinguish Test');

      const ag = actor.system.characteristics?.ag?.value || 0;
      const safeActorName = Sanitizer.escape(actor.name);
      const content = `
        <div style="margin-bottom: 8px;"><strong>Extinguish Attempt: ${safeActorName}</strong></div>
        <div class="form-group">
          <label>AG: ${ag} | Base Target: ${ag - 20} (Hard −20)</label>
        </div>
        <div class="form-group">
          <label>Misc Modifier:</label>
          <input type="number" id="extinguishMod" value="0" style="width: 60px;" />
        </div>
      `;

      foundry.applications.api.DialogV2.wait({
        window: { title: `🔥 Extinguish: ${safeActorName}` },
        content,
        buttons: [
          {
            label: 'Roll', action: 'roll',
            callback: async (event, button, dialog) => {
              const miscMod = parseInt(dialog.element.querySelector('#extinguishMod').value) || 0;
              const roll = await new Roll('1d100').evaluate();
              const result = FireHelper.resolveExtinguishTest(ag, roll.total, miscMod);
              const flavor = FireHelper.buildExtinguishFlavor(actor.name, ag, roll.total, result, miscMod);

              if (result.success) {
                await actor.setCondition('on-fire', false);
              }

              await roll.toMessage({
                speaker: ChatMessage.getSpeaker({ actor }),
                flavor,
                rollMode: game.settings.get('core', 'rollMode')
              });
            }
          },
          { label: 'Cancel', action: 'cancel' }
        ]
      });
    }, 'Extinguish Test')));
  }

  /**
   * Register Psychic Oppose button handler (for opposed psychic power tests)
   */
  static _registerPsychicOpposeButton(html) {
    html.querySelectorAll('.psychic-oppose-btn').forEach(btn => btn.addEventListener('click', ErrorHandler.wrap(async (ev) => {
      const button = ev.currentTarget;
      const powerName = button.dataset.powerName;
      const psykerDoS = Validation.requireInt(button.dataset.psykerDos, 'Psyker DoS');
      const targetName = button.dataset.targetName || 'Target';
      const targetWP = Validation.requireInt(button.dataset.targetWp, 'Target WP');
      const targetId = button.dataset.targetId;
      const sceneId = button.dataset.sceneId;
      const tokenId = button.dataset.tokenId;

      const target = (sceneId && tokenId)
        ? game.scenes.get(sceneId)?.tokens.get(tokenId)?.actor
        : (targetId ? game.actors.get(targetId) : null);

      const content = `
        <div style="margin-bottom: 8px;"><strong>Opposed Willpower Test: ${targetName}</strong></div>
        <div class="form-group">
          <label>Target WP:</label>
          <input type="number" id="opposeTargetWP" value="${targetWP}" style="width: 60px;" />
        </div>
        <div class="form-group">
          <label>Misc Modifier:</label>
          <input type="number" id="opposeMiscMod" value="0" style="width: 60px;" />
        </div>
        <div class="form-group">
          <label>Manual Roll (leave blank to auto-roll):</label>
          <input type="number" id="opposeManualRoll" min="1" max="100" placeholder="Auto" style="width: 60px;" />
        </div>
      `;

      foundry.applications.api.DialogV2.wait({
        window: { title: `Opposed Test: ${powerName}` },
        content,
        buttons: [
          {
            label: "Resolve", action: "resolve",
            callback: async (event, button, dialog) => {
              const el = dialog.element;
              const wp = parseInt(el.querySelector('#opposeTargetWP').value) || 0;
              const miscMod = parseInt(el.querySelector('#opposeMiscMod').value) || 0;
              const manualRoll = el.querySelector('#opposeManualRoll').value;

              let targetRoll;
              let rollObj = null;
              if (manualRoll && manualRoll.trim() !== '') {
                targetRoll = parseInt(manualRoll);
              } else {
                rollObj = await new Roll('1d100').evaluate();
                targetRoll = rollObj.total;
              }

              const result = PsychicCombatHelper.resolveOpposedTest(psykerDoS, wp, targetRoll, miscMod);
              const msg = PsychicCombatHelper.buildOpposedResultMessage(targetName, wp, targetRoll, result, powerName, psykerDoS);

              if (rollObj) {
                await rollObj.toMessage({
                  speaker: ChatMessage.getSpeaker({ actor: target }),
                  flavor: msg,
                  rollMode: game.settings.get('core', 'rollMode')
                });
              } else {
                await ChatMessage.create({
                  content: msg + `<br><em>(Manual roll: ${targetRoll})</em>`,
                  speaker: ChatMessage.getSpeaker({ actor: target })
                });
              }
            }
          },
          { label: "Cancel", action: "cancel" }
        ]
      });
    }, 'Psychic Oppose Test')));
  }
}
