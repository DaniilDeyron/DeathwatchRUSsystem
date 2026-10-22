import DeathwatchDataModel from '../base-document.mjs';
import { CombatDialogHelper } from '../../helpers/combat/combat-dialog.mjs';
import { FoundryAdapter } from '../../helpers/foundry-adapter.mjs';
import { ChatMessageBuilder } from '../../helpers/ui/chat-message-builder.mjs';
import { Sanitizer } from '../../helpers/sanitizer.mjs';
import { SkillLoader } from '../../helpers/character/skill-loader.mjs';
import { ModifierCollector } from '../../helpers/character/modifier-collector.mjs';

const { fields } = foundry.data;

/**
 * Base DataModel for all Deathwatch actor types.
 * Provides shared wounds and fatigue schemas, and default combat methods.
 * @extends {DeathwatchDataModel}
 */
export default class DeathwatchActorBase extends DeathwatchDataModel {

  /**
   * Prepare base characteristics shared by all actor types.
   * Handles skill loading, modifier collection/application, and movement calculation.
   * Returns itemsArray and allModifiers for actor-specific processing.
   *
   * @returns {{itemsArray: Item[], allModifiers: Object[]}} Items and collected modifiers
   * @protected
   */
  _prepareBaseCharacteristics() {
    const actor = this.parent;

    // Load skills from skills registry
    if (this.skills) {
      this.skills = SkillLoader.loadSkills(this.skills);
    }

    // Convert items collection to array
    const itemsArray = this._getItemsArray();

    // Collect all modifiers from items, talents, traits, etc.
    const allModifiers = ModifierCollector.collectAllModifiers(actor, itemsArray);

    // Apply characteristic modifiers
    ModifierCollector.applyCharacteristicModifiers(this.characteristics, allModifiers);

    // Apply skill modifiers
    if (this.skills) {
      ModifierCollector.applySkillModifiers(this.skills, allModifiers);
    }

    // Apply combat-related modifiers
    this.initiativeBonus = ModifierCollector.applyInitiativeModifiers(allModifiers);
    ModifierCollector.applyWoundModifiers(this.wounds, allModifiers);
    ModifierCollector.applyFatigueModifiers(this.fatigue, this.characteristics?.tg?.mod || 0);

    // Apply armor modifiers
    ModifierCollector.applyArmorModifiers(itemsArray, allModifiers);
    this.naturalArmorValue = ModifierCollector.calculateNaturalArmor(allModifiers, itemsArray);

    // Apply weapon own modifiers (after characteristics computed)
    for (const item of itemsArray) {
      if (item.type === 'weapon') {
        item.system._applyOwnModifiers();
      }
    }

    // Calculate movement from Agility Bonus
    const agBonus = this.characteristics?.ag?.mod || 0;
    if (!this.movement) this.movement = {};
    ModifierCollector.applyMovementModifiers(this.movement, agBonus, allModifiers);

    return { itemsArray, allModifiers };
  }

  /**
   * Convert actor items collection to array.
   * Handles Map, Array, and generic iterable cases.
   *
   * @returns {Item[]} Array of item documents
   * @protected
   */
  _getItemsArray() {
    const actor = this.parent;
    return actor.items instanceof Map
      ? Array.from(actor.items.values())
      : Array.isArray(actor.items)
        ? actor.items
        : Array.from(actor.items);
  }

  /**
   * Apply psyker-specific modifiers (Psy Rating and Force Weapons).
   * Used by Character and Enemy actors that can be psykers.
   *
   * @param {Item[]} itemsArray - Actor's items
   * @param {Object[]} allModifiers - Collected modifiers
   * @protected
   */
  _applyPsykerModifiers(itemsArray, allModifiers) {
    if (!this.psyRating) return;

    ModifierCollector.applyPsyRatingModifiers(this.psyRating, allModifiers);

    // Apply force weapon modifiers after psy rating is computed
    for (const item of itemsArray) {
      if (item.type === 'weapon') {
        item.system.applyForceWeaponModifiers();
      }
    }
  }

  /**
   * Shared characteristic schema factory.
   * Used by Character, NPC, and Enemy actor types.
   *
   * @param {boolean} [includeDamage=false] - Whether to include damage field (for NPC/Enemy)
   * @returns {foundry.data.fields.SchemaField} Characteristic schema
   */
  static _characteristicFields(includeDamage = false) {
    const schema = {
      value: new fields.NumberField({ initial: 0, min: 0, integer: true }),
      base: new fields.NumberField({ initial: 0, min: 0, integer: true }),
      bonus: new fields.NumberField({ initial: 0, min: 0, integer: true })
    };

    // NPC and Enemy actors track characteristic damage
    if (includeDamage) {
      schema.damage = new fields.NumberField({ initial: 0, min: 0, integer: true });
    }

    // Advances tracking (all actor types)
    schema.advances = new fields.SchemaField({
      simple: new fields.BooleanField({ initial: false }),
      intermediate: new fields.BooleanField({ initial: false }),
      trained: new fields.BooleanField({ initial: false }),
      expert: new fields.BooleanField({ initial: false })
    });

    return new fields.SchemaField(schema);
  }

  static defineSchema() {
    const schema = super.defineSchema();

    schema.wounds = new fields.SchemaField({
      value: new fields.NumberField({ initial: 0, min: 0, integer: true }),
      base: new fields.NumberField({ initial: 0, min: 0, integer: true }),
      max: new fields.NumberField({ initial: 0, min: 0, integer: true })
    });

    schema.fatigue = new fields.SchemaField({
      value: new fields.NumberField({ initial: 0, min: 0, integer: true }),
      max: new fields.NumberField({ initial: 0, min: 0, integer: true })
    });

    // Enemy classification (human, xenos, chaos) — used by Deathwatch Training
    schema.classification = new fields.StringField({ initial: "human", blank: false });

    return schema;
  }

  /**
   * Whether this actor type can trigger Righteous Fury.
   * Only characters can. Override in DeathwatchCharacter.
   * @returns {boolean}
   */
  canRighteousFury() {
    return false;
  }

  /**
   * Get armor value for a hit location.
   * Combines equipped armor item value with natural armor from traits.
   * @param {string} location - Hit location name
   * @returns {number}
   */
  getArmorValue(location) {
    const actor = this.parent;
    const equippedArmor = actor.items.find(i => i.type === 'armor' && i.system.equipped);
    const naturalArmor = this.naturalArmorValue || 0;

    if (!equippedArmor) return naturalArmor;

    const locationMap = {
      "Head": "head", "Body": "body",
      "Right Arm": "right_arm", "Left Arm": "left_arm",
      "Right Leg": "right_leg", "Left Leg": "left_leg"
    };
    const armorField = locationMap[location];
    const itemArmor = armorField ? (equippedArmor.system[armorField] || 0) : 0;
    return itemArmor + naturalArmor;
  }

  /**
   * Get defensive stats for damage calculation.
   * @param {string} location - Hit location name
   * @returns {{armorValue: number, naturalArmorValue: number, toughnessBonus: number, unnaturalToughnessMultiplier: number}}
   */
  getDefenses(location) {
    return {
      armorValue: this.getArmorValue(location),
      naturalArmorValue: this.naturalArmorValue || 0,
      toughnessBonus: this.characteristics?.tg?.baseMod || 0,
      unnaturalToughnessMultiplier: this.characteristics?.tg?.unnaturalMultiplier || 1
    };
  }

  /**
   * Calculate effective hits received from an attack.
   * Default: pass through baseHits unchanged.
   * @param {Object} options - Attack options
   * @param {number} options.baseHits - Hits from normal calculation
   * @returns {number}
   */
  calculateHitsReceived(options) {
    return options.baseHits || 1;
  }

  /**
   * Apply damage to this actor. Default: wound-based with critical damage.
   * @param {Object} options - Damage options
   */
  async receiveDamage(options) {
    const actor = this.parent;
    const { damage, penetration, location, damageType = 'Impact', felling = 0, isPrimitive = false,
      isRazorSharp = false, degreesOfSuccess = 0, isScatter = false, isLongOrExtremeRange = false,
      isShocking = false, isToxic = false, hasDrainLife = false, attackerActor = null,
      isMeltaRange = false, charDamageEffect = null, forceWeaponData = null, tokenInfo = null,
      ignoresNaturalArmour = false, criticalDamageBonus = 0 } = options;

    const defenses = this.getDefenses(location);
    const effectiveArmorValue = ignoresNaturalArmour
      ? Math.max(0, defenses.armorValue - defenses.naturalArmorValue)
      : defenses.armorValue;
    const damageResult = CombatDialogHelper.calculateDamageResult({
      damage, penetration, felling, isPrimitive, isRazorSharp, degreesOfSuccess,
      isScatter, isLongOrExtremeRange, armorValue: effectiveArmorValue,
      toughnessBonus: defenses.toughnessBonus,
      unnaturalToughnessMultiplier: defenses.unnaturalToughnessMultiplier, isMeltaRange
    });

    if (damageResult.woundsTaken > 0) {
      const { newWounds: baseNewWounds, isCritical, criticalDamage: baseCriticalDamage } = CombatDialogHelper.calculateCriticalDamage(
        this.wounds.value || 0, damageResult.woundsTaken, this.wounds.max || 0
      );
      const criticalDamage = baseCriticalDamage + (isCritical ? criticalDamageBonus : 0);
      const newWounds = baseNewWounds + (isCritical ? criticalDamageBonus : 0);

      await FoundryAdapter.updateDocument(actor, { "system.wounds.value": newWounds });

      const drainLifeMessage = (hasDrainLife && attackerActor)
        ? `<button class="drain-life-test-btn" data-attacker-id="${attackerActor.id}" data-target-id="${actor.id}">Drain Life: Opposed Willpower Test</button>`
        : '';
      const message = CombatDialogHelper.buildDamageMessage(
        actor.name, damageResult.woundsTaken, location, damage, defenses.armorValue, penetration,
        damageResult.effectiveArmor, damageResult.effectiveTB, isCritical, criticalDamage, actor.id,
        damageType, isShocking, isToxic, drainLifeMessage, charDamageEffect, forceWeaponData, tokenInfo, criticalDamageBonus
      );

      const safeActorName = Sanitizer.escape(actor.name);
      FoundryAdapter.showNotification(
        isCritical ? 'warn' : 'info',
        isCritical ? `${safeActorName} is taking CRITICAL DAMAGE!` : `${safeActorName} takes ${damageResult.woundsTaken} wounds!`
      );
      await FoundryAdapter.createChatMessage({
        content: message,
        speaker: FoundryAdapter.getChatSpeaker(actor)
      });
    } else {
      const safeActorName = Sanitizer.escape(actor.name);
      FoundryAdapter.showNotification('info', `${safeActorName}'s armor absorbs all damage!`);
      const message = CombatDialogHelper.buildArmorAbsorbMessage(
        actor.name, location, damage, defenses.armorValue, penetration, damageResult.effectiveTB
      );
      await FoundryAdapter.createChatMessage({
        content: message,
        speaker: FoundryAdapter.getChatSpeaker(actor)
      });
    }
  }
}
