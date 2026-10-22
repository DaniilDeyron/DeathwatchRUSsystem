import DeathwatchActorBase from './base-actor.mjs';
import { ModifierCollector } from '../../helpers/character/modifier-collector.mjs';
import { XPCalculator } from '../../helpers/character/xp-calculator.mjs';
import { SkillLoader } from '../../helpers/character/skill-loader.mjs';
import { INSANITY_TRACK } from '../../helpers/constants/index.mjs';

const { fields } = foundry.data;

/**
 * Character DataModel for player characters and allied Space Marines.
 *
 * Manages full character data including:
 * - **Characteristics**: WS, BS, STR, TGH, AG, INT, PER, WIL, FS with bonuses and advances
 * - **Skills**: Full skill list with modifiers and computed totals
 * - **Wounds & Fatigue**: Max wounds (SB + 2×TB + advances), fatigue system
 * - **XP & Rank**: XP tracking, rank progression (Initiate → Battle-Brother → Veteran → etc.)
 * - **Chapter & Specialty**: Chapter benefits and Specialty abilities
 * - **Psy Rating**: For Librarians (psyker characters)
 * - **Movement**: Half/Full/Charge/Run movement rates from AG Bonus
 * - **Combat Mode**: Solo/Squad Mode tracking
 * - **Insanity & Corruption**: Insanity Points, Corruption Points, Battle Traumas, Primarch's Curse
 *
 * Computed properties (updated in prepareDerivedData):
 * - `characteristics.*.value`: Final characteristic values after modifiers
 * - `characteristics.*.mod`: Final characteristic bonus (value ÷ 10)
 * - `skills.*.total`: Final skill test target numbers
 * - `wounds.max`: Maximum wounds from SB + 2×TB + advances + modifiers
 * - `movement.half/full/charge/run`: Movement rates from AG Bonus
 * - `xp.spent/available`: XP spent on advances, XP available for spending
 * - `rank`: Character rank (1-8) based on total XP
 * - `insanityTrackLevel`: Insanity track level (0-3) based on insanity points
 * - `activeCurse`: Active Primarch's Curse level data (if chapter has curse and IP threshold met)
 *
 * @extends {DeathwatchActorBase}
 * @example
 * // Access computed character data
 * const actor = game.actors.getName("Brother Corvus");
 * const bs = actor.system.characteristics.bs.value; // 50
 * const bsBonus = actor.system.characteristics.bs.mod; // 5
 * const maxWounds = actor.system.wounds.max; // 22
 * const insanityLevel = actor.system.insanityTrackLevel; // 1 (31-60 IP)
 * const curse = actor.system.activeCurse; // { level: 1, name: "The Red Thirst", ... }
 */
export default class DeathwatchCharacter extends DeathwatchActorBase {

  // Note: _characteristicFields() now inherited from DeathwatchActorBase
  // Character actors do not track characteristic damage

  static defineSchema() {
    const schema = super.defineSchema();

    // Biography
    schema.chapterId = new fields.StringField({ initial: "", blank: true });
    schema.gender = new fields.StringField({ initial: "", blank: true });
    schema.age = new fields.StringField({ initial: "", blank: true });
    schema.complexion = new fields.StringField({ initial: "", blank: true });
    schema.hair = new fields.StringField({ initial: "", blank: true });
    schema.description = new fields.HTMLField({ initial: "" });
    schema.pastEvents = new fields.HTMLField({ initial: "" });
    schema.specialty = new fields.StringField({ initial: "", blank: true });
    schema.specialtyId = new fields.StringField({ initial: "", blank: true });

    // Progression
    schema.rank = new fields.NumberField({ initial: 1, min: 1, max: 8, integer: true });
    schema.xp = new fields.SchemaField({
      total: new fields.NumberField({ initial: 13000, min: 0, integer: true }),
      spent: new fields.NumberField({ initial: 0, min: 0, integer: true })
    });
    schema.fatePoints = new fields.SchemaField({
      value: new fields.NumberField({ initial: 0, min: 0, integer: true }),
      max: new fields.NumberField({ initial: 0, min: 0, integer: true })
    });
    schema.renown = new fields.NumberField({ initial: 0, min: 0, integer: true });

    // Mental State (Insanity & Corruption)
    schema.corruption = new fields.NumberField({ initial: 0, min: 0, integer: true });
    schema.corruptionHistory = new fields.ArrayField(
      new fields.SchemaField({
        timestamp: new fields.NumberField({ initial: 0, integer: true }),
        source: new fields.StringField({ initial: "", blank: true }),
        points: new fields.NumberField({ initial: 0, integer: true }),
        missionId: new fields.StringField({ initial: "", blank: true })
      }),
      { initial: [] }
    );
    schema.insanity = new fields.NumberField({ initial: 0, min: 0, integer: true });
    schema.insanityHistory = new fields.ArrayField(
      new fields.SchemaField({
        timestamp: new fields.NumberField({ initial: 0, integer: true }),
        source: new fields.StringField({ initial: "", blank: true }),
        points: new fields.NumberField({ initial: 0, integer: true }),
        missionId: new fields.StringField({ initial: "", blank: true }),
        testRolled: new fields.BooleanField({ initial: false }),
        testResult: new fields.StringField({ initial: "", blank: true }),
        testModifiers: new fields.NumberField({ initial: 0, integer: true }),
        xpSpent: new fields.NumberField({ initial: 0, min: 0, integer: true })
      }),
      { initial: [] }
    );
    schema.lastInsanityTestAt = new fields.NumberField({ initial: 0, integer: true });

    // Modifiers
    schema.modifiers = new fields.ArrayField(new fields.ObjectField(), { initial: [] });

    // Conditions
    schema.conditions = new fields.ObjectField({ initial: {} });

    // Combat Mode (Solo/Squad)
    schema.mode = new fields.StringField({ initial: "solo" });

    // Characteristics (all 9)
    schema.characteristics = new fields.SchemaField({
      ws: DeathwatchCharacter._characteristicFields(),
      bs: DeathwatchCharacter._characteristicFields(),
      str: DeathwatchCharacter._characteristicFields(),
      tg: DeathwatchCharacter._characteristicFields(),
      ag: DeathwatchCharacter._characteristicFields(),
      int: DeathwatchCharacter._characteristicFields(),
      per: DeathwatchCharacter._characteristicFields(),
      wil: DeathwatchCharacter._characteristicFields(),
      fs: DeathwatchCharacter._characteristicFields()
    });

    // Psy Rating
    schema.psyRating = new fields.SchemaField({
      value: new fields.NumberField({ initial: 0, min: 0, integer: true }),
      base: new fields.NumberField({ initial: 0, min: 0, integer: true })
    });

    // Skills (dynamic, loaded from skills.json at runtime)
    schema.skills = new fields.ObjectField({ initial: {} });

    // Legacy fields (kept for backward compatibility)
    schema.health = new fields.SchemaField({
      value: new fields.NumberField({ initial: 10, min: 0, integer: true }),
      max: new fields.NumberField({ initial: 10, min: 0, integer: true })
    });
    schema.power = new fields.SchemaField({
      value: new fields.NumberField({ initial: 5, min: 0, integer: true }),
      max: new fields.NumberField({ initial: 5, min: 0, integer: true })
    });
    schema.attributes = new fields.SchemaField({
      level: new fields.SchemaField({
        value: new fields.NumberField({ initial: 1, min: 1, integer: true })
      })
    });

    return schema;
  }

  /**
   * Characters can trigger Righteous Fury.
   * @returns {boolean}
   */
  canRighteousFury() {
    return true;
  }

  /**
   * Get current insanity track level based on insanity points.
   *
   * @returns {number} Insanity track level (0-3)
   * @private
   */
  _getInsanityTrackLevel() {
    const ip = this.insanity || 0;
    if (ip <= INSANITY_TRACK.THRESHOLD_1) return 0;
    if (ip <= INSANITY_TRACK.THRESHOLD_2) return 1;
    if (ip <= INSANITY_TRACK.THRESHOLD_3) return 2;
    if (ip < INSANITY_TRACK.REMOVAL) return 3;
    return 0; // Character removed from play at 100 IP
  }

  /**
   * Get active Primarch's Curse data from equipped chapter item.
   *
   * @param {Array} itemsArray - Character's items
   * @returns {Object|null} Active curse level data or null if no curse active
   * @private
   */
  _getActiveCurse(itemsArray) {
    // Find chapter item (just having it assigned means it's active, no "equipped" field)
    const chapterItem = itemsArray.find(i => i.type === 'chapter');

    if (!chapterItem) {
      return null;
    }

    // Check if chapter has curse (defensive - works with both DataModel and test mocks)
    const hasCurse = typeof chapterItem.system.hasCurse === 'function'
      ? chapterItem.system.hasCurse()
      : chapterItem.system.curse?.enabled;

    if (!hasCurse) {
      return null;
    }

    // Get active curse level (defensive - works with both DataModel and test mocks)
    if (typeof chapterItem.system.getActiveCurseLevel === 'function') {
      return chapterItem.system.getActiveCurseLevel(this.insanity || 0);
    }

    return null;
  }

  /**
   * Compute all character derived data.
   * Moved from actor.mjs _prepareCharacterData().
   */
  /**
   * Compute all character derived data.
   *
   * Called automatically by Foundry when actor data changes (characteristics,
   * items, effects, etc.). Recomputes all derived properties from base values
   * and modifiers.
   *
   * **Order of operations:**
   * 1. Load skills from JSON (if not already loaded)
   * 2. Calculate rank from total XP
   * 3. Calculate spent XP from item costs
   * 4. Convert items Map to Array (performance optimization)
   * 5. Compute insanity track level and active Primarch's Curse
   * 6. Collect modifiers from items/effects/chapter/specialty/battle traumas
   * 7. Apply modifiers to characteristics → compute final values and bonuses
   * 8. Apply modifiers to skills → compute final target numbers
   * 9. Apply modifiers to initiative, wounds, fatigue, armor, Psy Rating
   * 10. Apply force weapon modifiers (for Librarians)
   * 11. Calculate movement rates from AG Bonus
   *
   * **Performance note:** Items are converted from Map to Array once at the
   * start and passed to all modifier methods, eliminating redundant conversions.
   *
   * @override
   * @returns {void}
   * @example
   * // Manually trigger derived data recalculation (usually automatic)
   * actor.system.prepareDerivedData();
   */
  prepareDerivedData() {
    const actor = this.parent;

    if (!this.fatePoints) this.fatePoints = { value: 0, max: 0 };
    if (this.renown === undefined) this.renown = 0;

    // Load skills dynamically from JSON
    // Calculate rank and XP (Character-specific)
    this.rank = XPCalculator.calculateRank(this.xp?.total || this.xp);
    const spentXP = XPCalculator.calculateSpentXP(actor);

    if (typeof this.xp === 'object') {
      this.xp.spent = spentXP;
      this.xp.available = (this.xp.total || XPCalculator.STARTING_XP) - spentXP;
    }

    // Use base preparation
    const { itemsArray, allModifiers } = this._prepareBaseCharacteristics();

    // Compute insanity/corruption derived data (Character-specific)
    this.insanityTrackLevel = this._getInsanityTrackLevel();
    this.activeCurse = this._getActiveCurse(itemsArray);

    // Apply psyker modifiers (base method)
    this._applyPsykerModifiers(itemsArray, allModifiers);
  }
}
