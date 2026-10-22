import { ModifierHelper } from "../helpers/character/modifiers.mjs";
import { MODIFIER_TYPES } from '../helpers/constants/modifier-constants.mjs';
import { ScrollPositionManager } from "./shared/utils/scroll-position-manager.mjs";
import { TabManager } from "./shared/utils/tab-manager.mjs";
import { EnrichmentHelper } from "./shared/utils/enrichment-helper.mjs";
import { TemplateCompiler } from "./shared/utils/template-compiler.mjs";

const { HandlebarsApplicationMixin, DialogV2 } = foundry.applications.api;

/**
 * ApplicationV2 item sheet for the Deathwatch system.
 * Handles all 17 item types.
 * @extends {ItemSheetV2}
 */
export class DeathwatchItemSheetV2 extends HandlebarsApplicationMixin(
  foundry.applications.sheets.ItemSheetV2
) {

  static DEFAULT_OPTIONS = {
    classes: ["deathwatch", "sheet", "item"],
    position: { width: 520, height: 480 },
    window: { resizable: true },
    form: { submitOnChange: true, closeOnSubmit: false },
    actions: {
      createModifier: DeathwatchItemSheetV2._onModifierCreate,
      editModifier: DeathwatchItemSheetV2._onModifierEdit,
      deleteModifier: DeathwatchItemSheetV2._onModifierDelete,
      toggleModifier: DeathwatchItemSheetV2._onToggleModifierEnabled,
      weaponAttack: DeathwatchItemSheetV2._onWeaponAttack,
      weaponDamage: DeathwatchItemSheetV2._onWeaponDamage,
      removeHistory: DeathwatchItemSheetV2._onHistoryRemove,
      removeQuality: DeathwatchItemSheetV2._onQualityRemove,
      toggleBadgeDropdown: DeathwatchItemSheetV2._onToggleBadgeDropdown
    }
  };

  static PARTS = {
    sheet: {
      template: "systems/deathwatch/templates/item/item-weapon-sheet.html"
    }
  };

  /** Return the correct template for this item's type. */
  get _itemTemplate() {
    return `systems/deathwatch/templates/item/item-${this.document.type}-sheet.html`;
  }

  /** @override */
  get title() {
    return this.document.name;
  }

  /** @override — render using per-instance template to avoid static PARTS sharing */
  async _renderHTML(context, options) {
    // Save scroll position before re-render
    if (this.element) {
      this._scrollPositions = ScrollPositionManager.save(this.element);
    }

    return await TemplateCompiler.compile(this._itemTemplate, context);
  }

  _onFirstRender(context, options) {
    if (this.document.type === 'psychic-power' || this.document.type === 'special-ability') {
      this.setPosition({ width: 780, height: 624 });
    }
    if (this.document.type === 'specialty') {
      this.setPosition({ width: 910, height: 624 });
    }
    if (this.document.type === 'gear' || this.document.type === 'armor-history' || this.document.type === 'cybernetic') {
      this.setPosition({ width: 620 });
    }
  }

  /* -------------------------------------------- */
  /*  Data Preparation                            */
  /* -------------------------------------------- */

  async _prepareContext(options) {
    const context = await super._prepareContext(options);

    const itemData = this.item;
    context.item = itemData;
    context.cssClass = this.isEditable ? "editable" : "locked";
    context.editable = this.isEditable;
    context.owner = this.item.isOwner;

    context.rollData = {};
    let actor = this.item?.parent ?? null;
    if (actor) {
      context.rollData = actor.getRollData();
    }

    context.system = itemData.system;
    context.flags = itemData.flags;

    // Provide source data for prose-mirror value attribute
    context.source = this.item._source.system;

    // Enrich HTML for non-editable views (compendium items)
    // Enrich HTML for non-editable views
    context.editable = this.isEditable;
    await EnrichmentHelper.enrichForContext(context, this.item, ['description']);

    if (itemData.type === 'specialty') {
      this._prepareSpecialtyData(context);
    }
    if (itemData.type === 'armor') {
      this._prepareArmorData(context, actor);
    }
    if (itemData.type === 'weapon') {
      this._prepareWeaponData(context, actor);
    }

    // Special ability context preparation
    if (this.item.type === 'special-ability') {
      // Determine background image based on Category
      let backgroundImage = this.item.img;
      if (context.system.abilityCategory === 'chapter' && context.system.chapterImg) {
        backgroundImage = context.system.chapterImg;
      } else if (context.system.abilityCategory === 'specialty' && context.system.specialtyImg) {
        backgroundImage = context.system.specialtyImg;
      }
      context.backgroundImage = backgroundImage;

      // Determine glow color based on Mode
      const mode = context.system.modeRequirement;
      context.glowColor = mode === 'solo' ? 'solo' : mode === 'squad' ? 'squad' : 'none';

      // Note: chapterImg and specialtyImg lookup would go here if needed
      // For now, these fields need to be manually populated on the item
    }

    return context;
  }

  _prepareSpecialtyData(context) {
    context.characteristics = {
      ws: 'Weapon Skill', bs: 'Ballistic Skill', str: 'Strength',
      tg: 'Toughness', ag: 'Agility', int: 'Intelligence',
      per: 'Perception', wil: 'Willpower', fs: 'Fellowship'
    };
    if (!context.system.rankCosts) {
      context.system.rankCosts = {};
      for (let i = 1; i <= 8; i++) {
        context.system.rankCosts[i.toString()] = { skills: {}, talents: {} };
      }
    }
    context.skillNames = {};
    context.talentNames = {};
    if (game.deathwatch?.config?.Skills) {
      context.skillNames = game.deathwatch.config.Skills;
    }
    const talentIds = new Set();
    for (const rankData of Object.values(context.system.rankCosts)) {
      if (rankData.talents) {
        Object.keys(rankData.talents).forEach(id => talentIds.add(id));
      }
    }
    const talentPack = game.packs.get('deathwatch.talents');
    if (talentPack) {
      for (const talentId of talentIds) {
        const talent = talentPack.index.get(talentId);
        if (talent) context.talentNames[talentId] = talent.name;
      }
    }
  }

  _prepareArmorData(context, actor) {
    if (actor) {
      const historyIds = Array.isArray(this.item.system.attachedHistories) ? this.item.system.attachedHistories : [];
      context.system.attachedHistories = historyIds.map(histId => {
        const hist = actor.items.get(histId);
        return hist ? { _id: hist.id, name: hist.name, img: hist.img } : null;
      }).filter(h => h);
    } else {
      context.system.attachedHistories = [];
    }
  }

  _prepareWeaponData(context, actor) {
    const qualityIds = Array.isArray(this.item.system.attachedQualities) ? this.item.system.attachedQualities : [];
    const pack = game.packs.get('deathwatch.weapon-qualities');
    context.attachedQualities = qualityIds.map(q => {
      const qualityId = typeof q === 'string' ? q : q.id;
      let quality = actor?.items.get(qualityId);
      if (!quality && pack) quality = pack.index.get(qualityId);
      if (!quality) return null;
      return {
        _id: quality._id || quality.id,
        name: quality.name,
        system: {
          key: quality.system?.key,
          value: (typeof q === 'object' && q.value !== undefined) ? q.value : quality.system?.value
        }
      };
    }).filter(q => q);
    if (this.item.system.effectiveBlast) {
      context.attachedQualities.push({
        _id: 'effective-blast', name: 'Blast',
        system: { key: 'blast', value: this.item.system.effectiveBlast },
        isEffective: true
      });
    }
    if (this.item.system.effectiveFelling) {
      context.attachedQualities.push({
        _id: 'effective-felling', name: 'Felling',
        system: { key: 'felling', value: this.item.system.effectiveFelling },
        isEffective: true
      });
    }
  }

  /* -------------------------------------------- */
  /*  Action Handlers                             */
  /* -------------------------------------------- */

  /**
   * Determine the default modifier type for a new modifier based on item type.
   * @returns {string} The appropriate MODIFIER_TYPES constant
   */
  getDefaultModifierType() {
    const itemType = this.item.type;

    switch (itemType) {
      case 'talent':
        return MODIFIER_TYPES.TALENT;
      case 'trait':
        return MODIFIER_TYPES.TRAIT;
      case 'armor':
        return MODIFIER_TYPES.EQUIPMENT;
      case 'gear':
        // Check if this is a chapter trapping (key contains 'chapter-')
        const key = this.item.system?.key || '';
        if (key.includes('chapter-')) {
          return MODIFIER_TYPES.CHAPTER;
        }
        return MODIFIER_TYPES.EQUIPMENT;
      default:
        return MODIFIER_TYPES.CIRCUMSTANCE;
    }
  }

  static async _onModifierCreate(event, target) {
    const modifiers = Array.isArray(this.item.system.modifiers) ? [...this.item.system.modifiers] : [];
    modifiers.push({
      _id: foundry.utils.randomID(),
      name: "New Modifier", modifier: "0", type: this.getDefaultModifierType(),
      effectType: "characteristic", valueAffected: "", enabled: true
    });
    await this.item.update({ "system.modifiers": modifiers });
    this.render();
  }

  static async _onModifierEdit(event, target) {
    const modifierId = target.dataset.modifierId || target.closest('.modifier')?.dataset.modifierId;
    const modifier = this.item.system.modifiers?.find(m => m._id === modifierId);
    if (!modifier) return;
    ModifierHelper._showEditDialog(modifier, async (updated) => {
      const modifiers = [...this.item.system.modifiers];
      const index = modifiers.findIndex(m => m._id === modifierId);
      if (index >= 0) {
        modifiers[index] = { ...modifiers[index], ...updated };
        await this.item.update({ "system.modifiers": modifiers });
      }
    });
  }

  static async _onModifierDelete(event, target) {
    const modifierId = target.dataset.modifierId || target.closest('.modifier')?.dataset.modifierId;
    const modifiers = Array.isArray(this.item.system.modifiers) ? this.item.system.modifiers.filter(m => m._id !== modifierId) : [];
    await this.item.update({ "system.modifiers": modifiers });
    this.render();
  }

  static async _onToggleModifierEnabled(event, target) {
    const modifierId = target.dataset.modifierId || target.closest('.modifier')?.dataset.modifierId;
    const modifiers = [...this.item.system.modifiers];
    const index = modifiers.findIndex(m => m._id === modifierId);
    if (index >= 0) {
      modifiers[index].enabled = !modifiers[index].enabled;
      await this.item.update({ "system.modifiers": modifiers });
      this.render();
    }
  }

  /* istanbul ignore next */
  static async _onWeaponAttack(event, target) {
    const actor = this.item.actor;
    if (!actor) return ui.notifications.warn("This weapon must be owned by an actor to roll attacks.");
    await game.deathwatch.CombatRouter.executeAttack(actor, this.item);
  }

  /* istanbul ignore next */
  static async _onWeaponDamage(event, target) {
    const actor = this.item.actor;
    if (!actor) return ui.notifications.warn("This weapon must be owned by an actor to roll damage.");
    await game.deathwatch.CombatRouter.executeDamage(actor, this.item);
  }

  static async _onHistoryRemove(event, target) {
    const historyId = target.dataset.historyId;
    const attachedHistories = (this.item.system.attachedHistories || []).filter(id => id !== historyId);
    await this.item.update({ "system.attachedHistories": attachedHistories });
    this.render();
  }

  static async _onQualityRemove(event, target) {
    const qualityId = target.dataset.qualityId;
    const attachedQualities = (this.item.system.attachedQualities || []).filter(q => {
      const id = typeof q === 'string' ? q : q.id;
      return id !== qualityId;
    });
    await this.item.update({ "system.attachedQualities": attachedQualities });
    this.render();
  }

  /* -------------------------------------------- */
  /*  Post-Render & Drop Handlers                 */
  /* -------------------------------------------- */

  /* istanbul ignore next */
  _onRender(context, options) {
    super._onRender?.(context, options);
    const html = this.element;
    if (!html) return;

    // V1-style tab activation
    if (html.querySelector('.sheet-tabs')) {
      TabManager.initialize(html, this, {
        defaultTab: 'description',
        storageKey: '_activeTab'
      });
    }

    // Restore scroll position
    ScrollPositionManager.restore(html, this._scrollPositions);

    // Quality value change
    html.querySelectorAll('.quality-value').forEach(input => {
      input.addEventListener('change', async (ev) => {
        const qualityId = ev.currentTarget.dataset.qualityId;
        const newValue = ev.currentTarget.value;
        const attachedQualities = (this.item.system.attachedQualities || []).map(q => {
          const id = typeof q === 'string' ? q : q.id;
          if (id === qualityId) return { id: qualityId, value: newValue };
          return q;
        });
        await this.item.update({ "system.attachedQualities": attachedQualities });
      });
    });
  }

  /* istanbul ignore next */
  async _onDrop(event) {
    const data = foundry.applications.ux.TextEditor.implementation.getDragEventData(event);
    if (data.type !== 'Item') return super._onDrop?.(event);
    const droppedItem = await Item.implementation.fromDropData(data);
    if (!droppedItem) return super._onDrop?.(event);

    if (this.item.type === 'armor' && droppedItem.type === 'armor-history') {
      event.preventDefault();
      event.stopPropagation();
      const currentHistories = this.item.system.attachedHistories || [];
      if (!currentHistories.includes(droppedItem.id)) {
        await this.item.update({ "system.attachedHistories": [...currentHistories, droppedItem.id] });
        ui.notifications.info(`${droppedItem.name} attached to ${this.item.name}.`);
      } else {
        ui.notifications.warn(`${droppedItem.name} is already attached to ${this.item.name}.`);
      }
      return false;
    }

    if (this.item.type === 'weapon' && droppedItem.type === 'weapon-quality') {
      event.preventDefault();
      event.stopPropagation();
      const currentQualities = this.item.system.attachedQualities || [];
      const qualityExists = currentQualities.some(q => {
        const id = typeof q === 'string' ? q : q.id;
        return id === droppedItem.id;
      });
      if (!qualityExists) {
        const newQuality = droppedItem.system.value
          ? { id: droppedItem.id, value: droppedItem.system.value }
          : droppedItem.id;
        await this.item.update({ "system.attachedQualities": [...currentQualities, newQuality] });
        ui.notifications.info(`${droppedItem.name} attached to ${this.item.name}.`);
      } else {
        ui.notifications.warn(`${droppedItem.name} is already attached to ${this.item.name}.`);
      }
      return false;
    }

    return super._onDrop?.(event);
  }

  /**
   * Toggle badge dropdown for Mode/Category/Type fields.
   * @param {Event} event - The click event
   * @param {HTMLElement} target - The badge element
   */
  static async _onToggleBadgeDropdown(event, target) {
    const field = target.dataset.field;

    // Close any existing dropdowns
    this.element.querySelectorAll('.badge-dropdown').forEach(d => d.remove());

    // Define options for each field
    const optionSets = {
      modeRequirement: [
        { value: '', label: 'None' },
        { value: 'solo', label: 'Solo Mode' },
        { value: 'squad', label: 'Squad Mode' }
      ],
      abilityCategory: [
        { value: '', label: 'Specialty' },
        { value: 'codex', label: 'Codex' },
        { value: 'chapter', label: 'Chapter' }
      ],
      abilityType: [
        { value: '', label: '—' },
        { value: 'attack-pattern', label: 'Attack Pattern' },
        { value: 'defensive-stance', label: 'Defensive Stance' }
      ]
    };

    const options = optionSets[field];
    if (!options) return;

    // Create dropdown
    const dropdown = document.createElement('div');
    dropdown.className = 'badge-dropdown';
    dropdown.style.position = 'absolute';
    dropdown.style.top = `${target.offsetHeight + 4}px`;
    dropdown.style.left = '0';

    options.forEach(opt => {
      const option = document.createElement('div');
      option.className = 'badge-dropdown-option';
      option.textContent = opt.label;
      option.dataset.value = opt.value;

      option.addEventListener('click', async () => {
        try {
          await this.item.update({ [`system.${field}`]: opt.value });
          dropdown.remove();
        } catch (error) {
          console.error(`Failed to update ${field}:`, error);
          ui.notifications.error(`Failed to update ${field}`);
        }
      });

      dropdown.appendChild(option);
    });

    // Ensure target has position context for absolute dropdown
    if (!target.style.position && getComputedStyle(target).position === 'static') {
      target.style.position = 'relative';
    }
    target.appendChild(dropdown);

    // Close on outside click (use requestAnimationFrame for better timing)
    const outsideClickHandler = (e) => {
      if (!dropdown.contains(e.target) && e.target !== target) {
        dropdown.remove();
        document.removeEventListener('click', outsideClickHandler);
      }
    };

    requestAnimationFrame(() => {
      document.addEventListener('click', outsideClickHandler);
    });
  }
}
