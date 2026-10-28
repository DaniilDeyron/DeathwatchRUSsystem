import { Sanitizer } from '../sanitizer.mjs';

/**
 * Helper for fire-related combat effects.
 * Pure functions for calculating fire damage, WP test results, and extinguish results.
 */
export class FireHelper {
  /**
   * Determine if an actor has fully enclosed armor (силовой доспех).
   * @param {Object} actor - Actor document
   * @returns {boolean}
   */
  static hasPowerArmor(actor) {
    if (!actor?.items) return false;
    const items = actor.items instanceof Map ? Array.from(actor.items.values()) : (actor.items.filter ? actor.items.filter(() => true) : []);
    return items.some(i => i.type === 'armor' && i.system?.equipped && i.name?.toLowerCase().includes('power'));
  }

  /**
   * Build the On Fire chat message content.
   * @param {string} name - Actor name
   * @param {number} damage - Fire damage rolled
   * @param {number} currentWounds - Wounds before damage
   * @param {number} maxWounds - Max wounds
   * @param {number} newFatigue - Fatigue after increment
   * @param {{ autoPass: boolean, roll?: number, success?: boolean, wp?: number }} wpResult - WP test result
   * @param {string} actorId - Actor ID for extinguish button
   * @param {string} [sceneId] - Scene ID for unlinked token resolution
   * @param {string} [tokenId] - Token ID for unlinked token resolution
   * @returns {string} HTML content
   */
  static buildOnFireMessage(name, damage, currentWounds, maxWounds, newFatigue, wpResult, actorId, sceneId = '', tokenId = '') {
    const newWounds = currentWounds + damage;
    let content = `<strong>\uD83D\uDD25 On Fire \u2014 ${name}</strong><br>`;
    content += `<strong style="color: red;">1к10 энергетического урона (игнорирует броню): ${damage}</strong> в тело`;

    if (newWounds > maxWounds) {
      const critDmg = newWounds - maxWounds;
      content += `<br><strong style="color: darkred;">\u2620 КРИТИЧЕСКИЙ УРОН: ${critDmg} \u2620</strong>`;
    }

    content += `<br><strong>+1 Усталость</strong> (now ${newFatigue})`;

    if (wpResult.autoPass) {
      content += `<br><strong>Проверка Силы воли:</strong> <strong style="color: green;">АВТОМАТИЧЕСКИЙ УСПЕХ</strong> (силовой доспех)`;
    } else if (wpResult.success) {
      content += `<br><strong>Проверка Силы воли</strong> (WP ${wpResult.wp}): ${wpResult.roll} \u2014 <strong style="color: green;">УСПЕХ</strong> \u2014 может действовать как обычно`;
    } else {
      content += `<br><strong>Проверка Силы воли</strong> (WP ${wpResult.wp}): ${wpResult.roll} \u2014 <strong style="color: red;">ПРОВАЛ</strong> \u2014 может только бежать и кричать (полное действие)!`;
    }

    const canAct = wpResult.autoPass || wpResult.success;
    if (canAct) {
      content += `<br><button class="extinguish-btn" data-actor-id="${actorId}" data-scene-id="${sceneId || ''}" data-token-id="${tokenId || ''}">\uD83D\uDD25 Attempt to Extinguish (\u201320 AG, Full Action)</button>`;
    }
    return content;
  }

  /**
   * Calculate extinguish test result.
   * @param {number} ag - Agility value
   * @param {number} roll - d100 roll result
   * @param {number} [miscMod=0] - Misc modifier from GM
   * @returns {{ targetNumber: number, success: boolean }}
   */
  static resolveExtinguishTest(ag, roll, miscMod = 0) {
    const targetNumber = ag - 20 + miscMod;
    return { targetNumber, success: roll <= targetNumber };
  }

  /**
   * Resolve a flame dodge Agility test.
   * @param {number} ag - Target's Agility value
   * @param {number} roll - d100 roll result
   * @param {number} [miscMod=0] - Misc modifier
   * @returns {{ targetNumber: number, success: boolean }}
   */
  static resolveDodgeFlameTest(ag, roll, miscMod = 0) {
    const targetNumber = ag + miscMod;
    return { targetNumber, success: roll <= targetNumber };
  }

  /**
   * Resolve a catch fire Agility test (Challenging +0).
   * @param {number} ag - Target's Agility value
   * @param {number} roll - d100 roll result
   * @returns {{ targetNumber: number, success: boolean }}
   */
  static resolveCatchFireTest(ag, roll) {
    return { targetNumber: ag, success: roll <= ag };
  }

  /**
   * Build dodge flame result chat flavor.
   * @param {string} name - Target name
   * @param {number} ag - Agility value
   * @param {{ targetNumber: number, success: boolean }} result
   * @param {number} [miscMod=0] - Misc modifier
   * @returns {string} HTML flavor
   */
  static buildDodgeFlameFlavor(name, ag, result, miscMod = 0) {
    let flavor = `<strong>\uD83D\uDD25 Dodge Flame \u2014 ${name}</strong><br>`;
    flavor += `Целевое значение: ${result.targetNumber} (Ловкость ${ag}`;
    if (miscMod !== 0) flavor += ` ${miscMod >= 0 ? '+' : ''}${miscMod} Misc`;
    flavor += `)<br>`;
    if (result.success) {
      flavor += '<strong style="color: green;">УСПЕХ \u2014 Уклонение от пламени удалось!</strong>';
    } else {
      flavor += '<strong style="color: red;">ПРОВАЛ \u2014 Поражён пламенем!</strong>';
    }
    return flavor;
  }

  /**
   * Build catch fire result chat flavor.
   * @param {string} name - Target name
   * @param {number} ag - Agility value
   * @param {{ targetNumber: number, success: boolean }} result
   * @returns {string} HTML flavor
   */
  static buildCatchFireFlavor(name, ag, result) {
    let flavor = `<strong>\uD83D\uDD25 Catch Fire Test \u2014 ${name}</strong><br>`;
    flavor += `Целевое значение: ${ag} (Ловкость)<br>`;
    if (result.success) {
      flavor += '<strong style="color: green;">УСПЕХ \u2014 Не загорелся</strong>';
    } else {
      flavor += '<strong style="color: red;">ПРОВАЛ \u2014 Цель загорелась!</strong>';
    }
    return flavor;
  }

  /**
   * Build extinguish result chat flavor.
   * @param {string} name - Actor name
   * @param {number} ag - Agility value
   * @param {number} roll - d100 roll result
   * @param {{ targetNumber: number, success: boolean }} result
   * @param {number} [miscMod=0] - Misc modifier
   * @returns {string} HTML flavor
   */
  static buildExtinguishFlavor(name, ag, roll, result, miscMod = 0) {
    const safeName = Sanitizer.escape(name);
    let flavor = `<strong>\uD83D\uDD25 Extinguish Attempt \u2014 ${safeName}</strong><br>`;
    flavor += `Целевое значение: ${result.targetNumber} (Ловкость ${ag} \u2212 20`;
    if (miscMod !== 0) flavor += ` ${miscMod >= 0 ? '+' : ''}${miscMod} Misc`;
    flavor += `)<br>`;
    if (result.success) {
      flavor += '<strong style="color: green;">УСПЕХ \u2014 Огонь потушен!</strong>';
    } else {
      flavor += '<strong style="color: red;">ПРОВАЛ \u2014 Всё ещё горит!</strong>';
    }
    return flavor;
  }
}
