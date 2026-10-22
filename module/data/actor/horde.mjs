import DeathwatchEnemy from './enemy.mjs';
import { HordeCombatHelper } from '../../helpers/combat/horde-combat.mjs';
import { FoundryAdapter } from '../../helpers/foundry-adapter.mjs';
import { Sanitizer } from '../../helpers/sanitizer.mjs';

const { fields } = foundry.data;

/**
 * Horde DataModel for groups of weaker enemies (Ork Boyz, Tyranid Gaunts, etc.).
 *
 * Hordes use Magnitude instead of individual wounds:
 * - **Magnitude**: Number of enemies in the horde (1-100+)
 * - **Health**: Magnitude × 10 (e.g., magnitude 30 = 300 wounds)
 * - **Damage**: Each 10 damage = −1 magnitude
 * - **Single armor value**: No hit locations, one armor for whole horde
 *
 * **Horde combat rules** (Deathwatch Core p. 357):
 * - Melee DoS-based hits: 1 DoS = 1 hit, 3 DoS = 1d5 hits, 5 DoS = 1d10 hits
 * - Blast/Flame: Hits multiplied by 1.5×
 * - Explosive: +1d10 damage per hit
 * - Power Field: +1d5 magnitude damage
 *
 * @extends {DeathwatchEnemy}
 * @example
 * // Ork Boyz horde with magnitude 30
 * const orkHorde = game.actors.getName("Ork Mob");
 * const magnitude = orkHorde.system.wounds.max / 10; // 30
 * const armor = orkHorde.system.armor; // 4 (applies to all hits)
 */
export default class DeathwatchHorde extends DeathwatchEnemy {

  static defineSchema() {
    const schema = super.defineSchema();
    schema.gearArmor = new fields.NumberField({ initial: 0, min: 0, integer: true });
    schema.magnitudeThisTurn = new fields.NumberField({ initial: 0, min: 0, integer: true });
    return schema;
  }

  /** @override */
  getArmorValue(_location) {
    return (this.gearArmor || 0) + (this.naturalArmorValue || 0);
  }

  /** @override */
  getDefenses(_location) {
    return {
      armorValue: (this.gearArmor || 0) + (this.naturalArmorValue || 0),
      naturalArmorValue: this.naturalArmorValue || 0,
      toughnessBonus: this.characteristics?.tg?.baseMod || 0,
      unnaturalToughnessMultiplier: this.characteristics?.tg?.unnaturalMultiplier || 1
    };
  }

  /**
   * Calculate hits received using horde rules (blast, flame, melee DoS).
   * @override
   */
  calculateHitsReceived(options) {
    return HordeCombatHelper.calculateHordeHits(options);
  }

  /** @override */
  prepareDerivedData() {
    super.prepareDerivedData();
    this.armor = (this.gearArmor || 0) + (this.naturalArmorValue || 0);
  }

  /**
   * Apply damage as magnitude reduction. Each hit that penetrates reduces magnitude by 1.
   * @override
   */
  async receiveDamage(options) {
    return this.receiveBatchDamage([options]);
  }

  /**
   * Apply multiple hits as a single magnitude update with one summary message.
   * @param {Array<Object>} hits - Array of damage options per hit
   */
  async receiveBatchDamage(hits) {
    const actor = this.parent;

    // Check permissions - if player lacks permission, route through socket
    const canUpdate = game.user.isGM || actor.testUserPermission(game.user, "OWNER");

    if (!canUpdate) {
      // Route through socket - GM will execute with their permissions
      game.socket.emit('system.deathwatch', {
        type: 'applyHordeBatchDamage',
        actorId: actor.id,
        hits: hits,
        userId: game.user.id,
        userName: game.user.name
      });
      return;
    }

    // Direct execution - user has permission
    const baseArmorValue = (this.gearArmor || 0) + (this.naturalArmorValue || 0);
    const toughnessBonus = this.characteristics?.tg?.baseMod || 0;
    const unnaturalMultiplier = this.characteristics?.tg?.unnaturalMultiplier || 1;
    const effectiveTB = toughnessBonus * unnaturalMultiplier;

    let totalMagnitudeLost = 0;
    const hitResults = [];

    for (const hit of hits) {
      const { damage, penetration, isPrimitive = false,
        isRazorSharp = false, degreesOfSuccess = 0, isMeltaRange = false,
        magnitudeBonusDamage = 0, location = 'Body', ignoresNaturalArmour = false } = hit;

      const armorValue = ignoresNaturalArmour
        ? Math.max(0, baseArmorValue - (this.naturalArmorValue || 0))
        : baseArmorValue;

      const baseLost = HordeCombatHelper.calculateMagnitudeReduction(
        damage, armorValue, penetration, effectiveTB,
        { isPrimitive, isRazorSharp, degreesOfSuccess, isMeltaRange }
      );
      const lost = baseLost > 0 ? baseLost + magnitudeBonusDamage : 0;
      totalMagnitudeLost += lost;
      hitResults.push({ damage, penetration, location, lost });
    }

    const currentMagnitude = this.wounds.value || 0;
    const maxMagnitude = this.wounds.max || 0;

    if (totalMagnitudeLost > 0) {
      const newMagnitude = currentMagnitude + totalMagnitudeLost;
      const newMagnitudeThisTurn = (this.magnitudeThisTurn || 0) + totalMagnitudeLost;
      await FoundryAdapter.updateDocument(actor, {
        "system.wounds.value": newMagnitude,
        "system.magnitudeThisTurn": newMagnitudeThisTurn
      });

      const destroyed = newMagnitude >= maxMagnitude;
      const magnitudeBonusDamage = hits[0]?.magnitudeBonusDamage || 0;

      let message = `<strong>${actor.name}</strong> takes <strong>${hits.length}</strong> hit${hits.length > 1 ? 's' : ''}, loses <strong style="color: red;">${totalMagnitudeLost} Magnitude</strong> (${newMagnitude}/${maxMagnitude})`;
      message += `<br><em>Armor: ${baseArmorValue} | TB: ${effectiveTB}</em>`;
      if (magnitudeBonusDamage > 0) {
        message += `<br><em>+${magnitudeBonusDamage} bonus Magnitude per penetrating hit (ammunition/weapon quality)</em>`;
      }

      if (hits.length > 1) {
        const penetrating = hitResults.filter(r => r.lost > 0).length;
        const absorbed = hitResults.length - penetrating;
        message += `<details style="margin-top:4px;"><summary style="cursor:pointer; font-size:0.85em;">${penetrating} penetrating, ${absorbed} absorbed — click for details</summary>`;
        message += `<table style="width:100%; font-size:0.85em; margin-top:4px; border-collapse:collapse;">`;
        message += `<tr style="border-bottom:1px solid #999;"><th>#</th><th>Dmg</th><th>Pen</th><th>Result</th></tr>`;
        for (let i = 0; i < hitResults.length; i++) {
          const r = hitResults[i];
          const result = r.lost > 0
            ? `<span style="color:red;">-${r.lost} Mag</span>`
            : `<span style="color:gray;">Absorbed</span>`;
          message += `<tr><td>${i + 1}</td><td>${r.damage}</td><td>${r.penetration}</td><td>${result}</td></tr>`;
        }
        message += `</table></details>`;
      }

      if (destroyed) {
        message += `<br><strong style="color: darkred; font-size: 1.1em;">☠ HORDE DESTROYED ☠</strong>`;
      }

      await FoundryAdapter.createChatMessage({
        content: message,
        speaker: FoundryAdapter.getChatSpeaker(actor)
      });

      // Apply defeated condition when destroyed
      if (destroyed && actor.setCondition) {
        await actor.setCondition('dead', true);
      }
    } else {
      const safeActorName = Sanitizer.escape(actor.name);
      const message = `<strong>${safeActorName}</strong> takes <strong>${hits.length}</strong> hit${hits.length > 1 ? 's' : ''} — armor and toughness absorb all damage<br><em>Armor: ${baseArmorValue} | TB: ${effectiveTB}</em>`;
      await FoundryAdapter.createChatMessage({
        content: message,
        speaker: FoundryAdapter.getChatSpeaker(actor)
      });
    }
  }
}
