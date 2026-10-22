import { FoundryAdapter } from "../foundry-adapter.mjs";
import { ChatMessageBuilder } from "../ui/chat-message-builder.mjs";

export class RighteousFuryHelper {
  static hasNaturalTen(roll, furyThreshold = 10) {
    return roll.dice.some(d => d.results.some(r => r.result >= furyThreshold || (d.faces === 5 && r.result === 5)));
  }

  /**
   * Check if actor has the Deathwatch Training talent.
   * @param {Object} actor - Actor document
   * @returns {boolean}
   */
  static hasDeathwatchTraining(actor) {
    if (!actor?.items) return false;
    const items = actor.items instanceof Map
      ? Array.from(actor.items.values())
      : (actor.items.filter ? actor.items.filter(() => true) : []);
    return items.some(i => i.type === 'talent' && i.name === 'Deathwatch Training');
  }

  /**
   * Check if Deathwatch Training auto-confirm applies (attacker has talent AND target is xenos).
   * @param {Object} actor - Attacking actor
   * @param {Object} targetActor - Target actor (may be null)
   * @returns {boolean}
   */
  static isDeathwatchAutoConfirm(actor, targetActor) {
    if (!this.hasDeathwatchTraining(actor)) return false;
    return targetActor?.system?.classification === 'xenos';
  }

  static async rollConfirmation(actor, targetNumber, hitLocation) {
    const confirmRoll = await FoundryAdapter.evaluateRoll('1d100');
    const confirmed = confirmRoll.total <= targetNumber;
    
    const speaker = FoundryAdapter.getChatSpeaker(actor);
    const flavor = ChatMessageBuilder.createRighteousFuryFlavor(targetNumber, confirmed);
    await FoundryAdapter.sendRollToChat(confirmRoll, { speaker, flavor });
    
    return confirmed;
  }

  static async processFuryChain(actor, weapon, damageFormula, targetNumber, hitLocation, isVolatile, furyThreshold = 10, targetActor = null) {
    let totalDamage = 0;
    let furyCount = 0;
    const allRolls = [];
    const isDeathwatchAutoConfirm = this.isDeathwatchAutoConfirm(actor, targetActor);
    const isAutoConfirm = isVolatile || isDeathwatchAutoConfirm;

    let keepChecking;
    if (isAutoConfirm) {
      keepChecking = true;
      const speaker = FoundryAdapter.getChatSpeaker(actor);
      const flavor = isVolatile
        ? ChatMessageBuilder.createVolatileAutoConfirmFlavor()
        : ChatMessageBuilder.createDeathwatchTrainingAutoConfirmFlavor();
      await FoundryAdapter.createChatMessage({ content: flavor, speaker });
    } else {
      keepChecking = await this.rollConfirmation(actor, targetNumber, hitLocation);
    }
    
    while (keepChecking) {
      furyCount++;
      const furyRoll = await new Roll(damageFormula).evaluate();
      totalDamage += furyRoll.total;
      allRolls.push(furyRoll);
      
      const furyFlavor = ChatMessageBuilder.createRighteousFuryDamageFlavor(furyCount);
      await furyRoll.toMessage({
        speaker: ChatMessage.getSpeaker({ actor }),
        flavor: furyFlavor
      });
      
      if (this.hasNaturalTen(furyRoll, furyThreshold)) {
        if (isAutoConfirm) {
          const speaker = FoundryAdapter.getChatSpeaker(actor);
          const flavor = isVolatile
            ? ChatMessageBuilder.createVolatileAutoConfirmFlavor()
            : ChatMessageBuilder.createDeathwatchTrainingAutoConfirmFlavor();
          await FoundryAdapter.createChatMessage({ content: flavor, speaker });
          keepChecking = true;
        } else {
          keepChecking = await this.rollConfirmation(actor, targetNumber, hitLocation);
        }
      } else {
        keepChecking = false;
      }
    }
    
    return { totalDamage, furyCount, allRolls };
  }
}
