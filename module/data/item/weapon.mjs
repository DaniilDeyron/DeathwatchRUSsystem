import DeathwatchItemBase from './base-item.mjs';
import { WeaponModifierCollector } from '../../helpers/combat/weapon-modifier-collector.mjs';

const { fields } = foundry.data;

/**
 * DataModel for weapon items.
 * @extends {DeathwatchItemBase}
 */
export default class DeathwatchWeapon extends DeathwatchItemBase {
  static defineSchema() {
    const schema = super.defineSchema();
    foundry.utils.mergeObject(schema, {
      ...DeathwatchItemBase.equippedTemplate(),
      ...DeathwatchItemBase.requisitionTemplate()
    });
    schema.damage = new fields.StringField({ initial: "1d10", blank: true });
    schema.dmgType = new fields.StringField({ initial: "", blank: true });
    schema.weaponType = new fields.StringField({ initial: "", blank: true });
    schema.range = new fields.StringField({ initial: "", blank: true });
    schema.rof = new fields.StringField({ initial: "S/-/-", blank: true });
    schema.dmg = new fields.StringField({ initial: "1d10", blank: true });
    schema.penetration = new fields.NumberField({ initial: 0, min: 0, integer: true });
    schema.class = new fields.StringField({ initial: "", blank: true });
    schema.clip = new fields.StringField({ initial: "", blank: true });
    schema.reload = new fields.StringField({ initial: "", blank: true });
    schema.jammed = new fields.BooleanField({ initial: false });
    schema.loadedAmmo = new fields.StringField({ initial: null, nullable: true });
    schema.attachedQualities = new fields.ArrayField(new fields.ObjectField(), { initial: [] });
    schema.attachedUpgrades = new fields.ArrayField(new fields.ObjectField(), { initial: [] });
    schema.doublesStrengthBonus = new fields.BooleanField({ initial: false });
    schema.wt = new fields.NumberField({ initial: 0, min: 0 });
    // Cybernetic weapon source (e.g., servo-arm uses cybernetic's Str, not character's)
    schema.cyberneticSource = new fields.StringField({ initial: "", blank: true });
    schema.animationKey = new fields.StringField({
      blank: true,
      initial: "",
      label: "Animation Key",
      hint: "Override animation type (e.g., 'bolt', 'las', 'plasma', 'melta', 'flame'). Leave blank for automatic detection."
    });
    return schema;
  }

  static migrateData(source) {
    if (!source.clip && source.capacity?.max) {
      source.clip = String(source.capacity.max);
    }
    return super.migrateData(source);
  }

  prepareDerivedData() {
    const actor = this.parent?.actor;
    if (!actor) return;

    // Weapon modifiers applied by _applyOwnModifiers() via WeaponModifierCollector
  }

  static CHAR_KEYS = ['ws', 'bs', 'str', 'tg', 'ag', 'int', 'per', 'wil', 'fs'];

  _resolveCharBonus(formula) {
    const actor = this.parent?.actor;
    if (!actor) return parseInt(formula) || 0;

    const match = formula.match(/^([a-z]+)b(x(\d+))?([+-]\d+)?$/);
    if (!match) return parseInt(formula) || 0;

    const charKey = match[1];
    if (!DeathwatchWeapon.CHAR_KEYS.includes(charKey)) return parseInt(formula) || 0;

    const bonus = actor.system?.characteristics?.[charKey]?.mod || 0;
    const multiplier = match[3] ? parseInt(match[3]) : 1;
    const offset = match[4] ? parseInt(match[4]) : 0;
    return (bonus * multiplier) + offset;
  }

  _applyOwnModifiers() {
    const actor = this.parent?.actor;
    const weapon = this.parent;

    // Require proper Item/Actor context
    if (!actor || !weapon || !weapon.system) {
      return;
    }

    // Use WeaponModifierCollector to get all weapon modifiers (weapon + upgrades + ammo)
    const weaponMods = WeaponModifierCollector.collectWeaponModifiers(weapon, actor, {});

    const baseDmg = this.dmg || this.damage;

    // Apply damage override FIRST (replaces base damage completely)
    // Only apply if weapon has base damage (legacy behavior)
    if (weaponMods.damageOverride && weaponMods.damageOverride.formula && String(weaponMods.damageOverride.formula).trim() && baseDmg) {
      this.effectiveDamage = weaponMods.damageOverride.formula;
    }

    // Apply additive damage modifiers (on top of override OR base damage)
    // Sum all damage modifiers first, then apply once
    let totalDamageMod = 0;
    for (const mod of weaponMods.damage) {
      // Skip if quality exception exists and weapon has that quality
      if (mod.qualityException && this.attachedQualities?.some(q => (typeof q === 'string' ? q : q.id) === mod.qualityException)) {
        continue;
      }
      totalDamageMod += this._resolveCharBonus(mod.modifier);
    }
    if (totalDamageMod !== 0) {
      const currentDmg = this.effectiveDamage || baseDmg;
      if (currentDmg) {
        this.effectiveDamage = `${currentDmg} ${totalDamageMod >= 0 ? '+' : ''}${totalDamageMod}`;
      }
    }

    // Apply rate of fire modifiers (check weaponClass if specified)
    const weaponClass = (this.class || '').toLowerCase();
    for (const mod of weaponMods.rof) {
      const requiredClass = (mod.weaponClass || '').toLowerCase();
      if (!requiredClass || weaponClass.includes(requiredClass)) {
        this.effectiveRof = mod.modifier;
        break; // First match wins
      }
    }

    // Apply blast modifiers (check weaponClass if specified)
    for (const mod of weaponMods.blast) {
      const requiredClass = (mod.weaponClass || '').toLowerCase();
      if (!requiredClass || weaponClass.includes(requiredClass)) {
        this.effectiveBlast = parseInt(mod.modifier) || 0;
        break; // First match wins
      }
    }

    // Apply felling modifiers
    if (weaponMods.felling.length > 0) {
      this.effectiveFelling = parseInt(weaponMods.felling[0].modifier) || 0;
    }

    // Apply penetration modifiers
    for (const mod of weaponMods.penetration) {
      const basePen = parseInt(this.effectivePenetration ?? this.pen ?? this.penetration ?? 0);
      if (mod.effectType === 'weapon-penetration') {
        this.effectivePenetration = Math.max(basePen, parseInt(mod.modifier) || 0);
      } else if (mod.effectType === 'weapon-penetration-modifier') {
        this.effectivePenetration = Math.max(0, basePen + (parseInt(mod.modifier) || 0));
      }
    }

    // Apply range modifiers (additive and multiplier)
    const baseRange = parseInt(this.range) || 0;
    if (baseRange === 0) {
      this.effectiveRange = this.range; // Preserve non-numeric or zero range
    } else if (weaponMods.range.length > 0) {
      let rangeAdditive = 0;
      let rangeMultiplier = 1;

      for (const mod of weaponMods.range) {
        const modStr = String(mod.modifier);
        if (modStr.startsWith('x')) {
          rangeMultiplier *= parseFloat(modStr.substring(1)) || 1;
        } else {
          rangeAdditive += parseInt(mod.modifier) || 0;
        }
      }

      if (rangeAdditive !== 0 || rangeMultiplier !== 1) {
        this.effectiveRange = Math.floor((baseRange + rangeAdditive) * rangeMultiplier);
      } else {
        this.effectiveRange = baseRange;
      }
    } else {
      this.effectiveRange = baseRange; // No modifiers, set to base
    }

    // Apply weight modifiers (additive and multiplier)
    const baseWeight = parseFloat(this.wt) || 0;
    if (baseWeight > 0 && weaponMods.weight.length > 0) {
      let weightAdditive = 0;
      let weightMultiplier = 1;

      for (const mod of weaponMods.weight) {
        const modStr = String(mod.modifier);
        if (modStr.startsWith('x')) {
          weightMultiplier *= parseFloat(modStr.substring(1)) || 1;
        } else {
          weightAdditive += parseFloat(mod.modifier) || 0;
        }
      }

      if (weightAdditive !== 0 || weightMultiplier !== 1) {
        this.effectiveWeight = Math.max(0, (baseWeight + weightAdditive) * weightMultiplier);
      } else {
        this.effectiveWeight = baseWeight;
      }
    } else if (baseWeight > 0) {
      this.effectiveWeight = baseWeight;
    } else {
      delete this.effectiveWeight;
    }
  }


  /**
   * Called from actor _prepareCharacterData() after psy rating is computed.
   */
  applyForceWeaponModifiers() {
    if (!this.attachedQualities?.some(q => (typeof q === 'string' ? q : q.id) === 'force')) return;

    const psyRating = this.parent?.actor?.system?.psyRating?.value || 0;
    if (psyRating <= 0) return;

    const baseDmg = this.effectiveDamage || this.dmg;
    const basePen = parseInt(this.effectivePenetration ?? this.penetration ?? this.pen ?? 0);

    if (baseDmg) {
      this.effectiveDamage = `${baseDmg} +${psyRating}`;
    }
    this.effectivePenetration = basePen + psyRating;
  }

}
