/**
 * Extend the base Actor document.
 * Derived data computation lives in DataModel classes (character.mjs, npc.mjs).
 * @extends {Actor}
 */
import { CHARACTERISTIC_CONSTANTS } from "../helpers/constants/index.mjs";
import { ActorConditionsMixin } from "./actor-conditions.mjs";

export class DeathwatchActor extends ActorConditionsMixin(Actor) {

  /** @override */
  prepareData() {
    super.prepareData();
  }

  /** @override */
  async _preCreate(data, options, user) {
    await super._preCreate(data, options, user);
    
    const updates = {
      'prototypeToken.name': data.name,
      'prototypeToken.displayName': 20
    };

    if (data.type === 'character' || data.type === 'horde') {
      updates['prototypeToken.actorLink'] = true;
      updates['prototypeToken.displayName'] = 30;
    }

    this.updateSource(updates);
  }

  /**
   * Override getRollData() that's supplied to rolls.
   */
  getRollData() {
    const data = super.getRollData();
    this._getCharacterRollData(data);
    this._getNpcRollData(data);
    return data;
  }

  /**
   * Prepare character roll data.
   */
  _getCharacterRollData(data) {
    if (this.type !== 'character' && this.type !== 'enemy') return;

    if (data.abilities) {
      for (let [k, v] of Object.entries(data.characteristics)) {
        data[k] = foundry.utils.deepClone(v);
      }
    }

    data.agBonus = data.characteristics?.ag?.bonus || Math.floor((data.characteristics?.ag?.value || 0) / CHARACTERISTIC_CONSTANTS.BONUS_DIVISOR);
    data.initiativeBonus = data.initiativeBonus || 0;
  }

  /**
   * Prepare NPC roll data.
   */
  _getNpcRollData(data) {
    if (this.type !== 'npc') return;
  }
}
