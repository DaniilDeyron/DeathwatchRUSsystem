import DeathwatchActorBase from './base-actor.mjs';
import { ModifierCollector } from '../../helpers/character/modifier-collector.mjs';
import { SkillLoader } from '../../helpers/character/skill-loader.mjs';

const { fields } = foundry.data;

/**
 * Enemy DataModel for individual hostile NPCs (xenos, daemons, heretics).
 *
 * Simplified character model without Space Marine-specific features:
 * - **Has**: Characteristics, skills, wounds, fatigue, armor, weapons, traits
 * - **No**: Chapters, Specialties, Rank, XP progression, Fate Points, Renown
 *
 * Use this for named enemies, bosses, and important adversaries with full
 * stats. For groups of weaker enemies, use Horde instead.
 *
 * Computed properties (updated in prepareDerivedData):
 * - `characteristics.*.value`: Final characteristic values after modifiers
 * - `characteristics.*.mod`: Final characteristic bonus
 * - `skills.*.total`: Final skill test target numbers
 * - `wounds.max`: Maximum wounds from SB + 2×TB + modifiers
 * - `movement.half/full/charge/run`: Movement rates from AG Bonus
 *
 * @extends {DeathwatchActorBase}
 * @example
 * // Ork Nob with full stats
 * const orkNob = game.actors.getName("Warboss Grognak");
 * const ws = orkNob.system.characteristics.ws.value; // 45
 * const maxWounds = orkNob.system.wounds.max; // 30
 */
export default class DeathwatchEnemy extends DeathwatchActorBase {

  // Note: Overrides base _characteristicFields() to include damage tracking
  static _characteristicFields() {
    return super._characteristicFields(true); // includeDamage = true for Enemies
  }

  static defineSchema() {
    const schema = super.defineSchema();

    schema.characteristics = new fields.SchemaField({
      ws: DeathwatchEnemy._characteristicFields(),
      bs: DeathwatchEnemy._characteristicFields(),
      str: DeathwatchEnemy._characteristicFields(),
      tg: DeathwatchEnemy._characteristicFields(),
      ag: DeathwatchEnemy._characteristicFields(),
      int: DeathwatchEnemy._characteristicFields(),
      per: DeathwatchEnemy._characteristicFields(),
      wil: DeathwatchEnemy._characteristicFields(),
      fs: DeathwatchEnemy._characteristicFields()
    });

    schema.skills = new fields.ObjectField({ initial: {} });
    schema.modifiers = new fields.ArrayField(new fields.ObjectField(), { initial: [] });
    schema.conditions = new fields.ObjectField({ initial: {} });
    schema.description = new fields.HTMLField({ initial: "" });
    schema.gender = new fields.StringField({ initial: "", blank: true });
    schema.age = new fields.StringField({ initial: "", blank: true });
    schema.complexion = new fields.StringField({ initial: "", blank: true });
    schema.hair = new fields.StringField({ initial: "", blank: true });

    // Psy Rating
    schema.psyRating = new fields.SchemaField({
      value: new fields.NumberField({ initial: 0, min: 0, integer: true }),
      base: new fields.NumberField({ initial: 0, min: 0, integer: true })
    });

    // Enemy classification (human, xenos, chaos)
    schema.classification = new fields.StringField({ initial: "xenos", blank: false });

    return schema;
  }

  prepareDerivedData() {
    // Use base preparation, then add psyker-specific modifiers
    const { itemsArray, allModifiers } = this._prepareBaseCharacteristics();

    // Apply psyker modifiers (base method)
    this._applyPsykerModifiers(itemsArray, allModifiers);
  }
}
