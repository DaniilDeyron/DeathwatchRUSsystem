import { onManageActiveEffect, prepareActiveEffectCategories } from "../helpers/effects.mjs";
import { DWConfig } from "../helpers/config.mjs";
import { CombatHelper } from "../helpers/combat/combat.mjs";
import { ModifierHelper } from "../helpers/character/modifiers.mjs";
import { RollExecutor } from "../helpers/roll-executor.mjs";
import { ItemHandlers } from "../helpers/ui/item-handlers.mjs";
import { ChatMessageBuilder } from "../helpers/ui/chat-message-builder.mjs";
import { ModeHelper } from "../helpers/mode-helper.mjs";
import { CohesionPanel } from "../ui/cohesion-panel.mjs";
import { CharacterDataPreparer } from "./shared/data-preparers/character-data-preparer.mjs";
import { NPCDataPreparer } from "./shared/data-preparers/npc-data-preparer.mjs";
import { EnemyDataPreparer } from "./shared/data-preparers/enemy-data-preparer.mjs";
import { ItemListPreparer } from "./shared/data-preparers/item-list-preparer.mjs";
import { InsanityHelper } from "../helpers/insanity/insanity-helper.mjs";
import { CorruptionHelper } from "../helpers/corruption/corruption-helper.mjs";
import { XPCalculator } from "../helpers/character/xp-calculator.mjs";
import { ScrollPositionManager } from "./shared/utils/scroll-position-manager.mjs";
import { TabManager } from "./shared/utils/tab-manager.mjs";
import { EnrichmentHelper } from "./shared/utils/enrichment-helper.mjs";
import { TemplateCompiler } from "./shared/utils/template-compiler.mjs";
import { HistoryDialogBuilder } from "./shared/utils/history-dialog-builder.mjs";
import { AdjustmentDialog } from "./shared/utils/adjustment-dialog.mjs";

const { HandlebarsApplicationMixin, DialogV2 } = foundry.applications.api;

/**
 * ApplicationV2 actor sheet for the Deathwatch system.
 * Handles all 4 actor types: character, npc, enemy, horde.
 * @extends {ActorSheetV2}
 */
export class DeathwatchActorSheetV2 extends HandlebarsApplicationMixin(
  foundry.applications.sheets.ActorSheetV2
) {

  static DEFAULT_OPTIONS = {
    classes: ["deathwatch", "sheet", "actor"],
    position: { width: 1000, height: 800 },
    window: { resizable: true },
    form: { submitOnChange: true, closeOnSubmit: false },
    actions: {
      // Step 1: actor document handlers
      editImage: DeathwatchActorSheetV2._onEditImage,
      // Step 2: show-item-in-chat handlers
      showTalent: DeathwatchActorSheetV2._onShowItem,
      showTrait: DeathwatchActorSheetV2._onShowItem,
      showImplant: DeathwatchActorSheetV2._onShowItem,
      showPsychicPower: DeathwatchActorSheetV2._onShowItem,
      showHistory: DeathwatchActorSheetV2._onShowItem,
      showCritical: DeathwatchActorSheetV2._onShowItem,
      showDemeanour: DeathwatchActorSheetV2._onShowItem,
      showSpecialAbility: DeathwatchActorSheetV2._onShowSpecialAbility,
      usePsychicPower: DeathwatchActorSheetV2._onUsePsychicPower,
      activateSquadAbility: DeathwatchActorSheetV2._onActivateSquadAbility,
      // Step 3: item CRUD handlers
      editItem: DeathwatchActorSheetV2._onEditItem,
      deleteItem: DeathwatchActorSheetV2._onDeleteItem,
      createItem: DeathwatchActorSheetV2._onCreateItem,
      toggleEquip: DeathwatchActorSheetV2._onToggleEquip,
      // Step 4: combat handlers
      weaponAttack: DeathwatchActorSheetV2._onWeaponAttack,
      weaponDamage: DeathwatchActorSheetV2._onWeaponDamage,
      weaponUnjam: DeathwatchActorSheetV2._onWeaponUnjam,
      removeAmmo: DeathwatchActorSheetV2._onRemoveAmmo,
      editAmmo: DeathwatchActorSheetV2._onEditAmmo,
      removeUpgrade: DeathwatchActorSheetV2._onRemoveUpgrade,
      // Step 5: roll handlers
      rollCharacteristic: DeathwatchActorSheetV2._onRollCharacteristic,
      rollSkill: DeathwatchActorSheetV2._onRollSkill,
      // Step 6: modifier + effects + misc handlers
      createModifier: DeathwatchActorSheetV2._onCreateModifier,
      editModifier: DeathwatchActorSheetV2._onEditModifier,
      deleteModifier: DeathwatchActorSheetV2._onDeleteModifier,
      toggleModifier: DeathwatchActorSheetV2._onToggleModifier,
      removeChapter: DeathwatchActorSheetV2._onRemoveChapter,
      removeSpecialty: DeathwatchActorSheetV2._onRemoveSpecialty,
      removeHistory: DeathwatchActorSheetV2._onRemoveHistory,
      toggleSection: DeathwatchActorSheetV2._onToggleSection,
      // Step 8: mental state handlers
      viewCorruptionHistory: DeathwatchActorSheetV2._onViewCorruptionHistory,
      viewInsanityHistory: DeathwatchActorSheetV2._onViewInsanityHistory,
      viewXPHistory: DeathwatchActorSheetV2._onViewXPHistory,
      adjustCorruption: DeathwatchActorSheetV2._onAdjustCorruption,
      adjustInsanity: DeathwatchActorSheetV2._onAdjustInsanity,
      manualInsanityTest: DeathwatchActorSheetV2._onManualInsanityTest,
      purchaseInsanityReduction: DeathwatchActorSheetV2._onPurchaseInsanityReduction,
      showTrauma: DeathwatchActorSheetV2._onShowItem,
      viewCurse: DeathwatchActorSheetV2._onViewCurse,
      // Step 9: drag-and-drop (gear stacking handled via _onDropItem override)
    }
  };

  static PARTS = {
    sheet: {
      template: "systems/deathwatch/templates/actor/actor-character-sheet.html",
      scrollable: [".skills-container", ".items-list", ".tab"]
    }
  };

  /** @override — select template by actor type */
  _getHeaderControls() {
    return super._getHeaderControls?.() || [];
  }

  /**
   * Override to return the correct template per actor type.
   * V2 uses _configureRenderParts but we can override the PARTS template dynamically.
   */
  async _preparePartContext(partId, context) {
    context.tab = context.tabs?.[partId];
    return context;
  }

  /** @override — render using per-instance template */
  async _renderHTML(context, options) {
    // Save scroll positions before re-render
    if (this.element) {
      this._scrollPositions = ScrollPositionManager.save(this.element);
    }

    const template = `systems/deathwatch/templates/actor/actor-${this.document.type}-sheet.html`;
    return await TemplateCompiler.compile(template, context);
  }

  tabGroups = {
    primary: "characteristics",
    character: "bio"
  };

  /** @override */
  get title() {
    return this.document.name;
  }

  /* -------------------------------------------- */
  /*  Data Preparation                            */
  /* -------------------------------------------- */

  /** @override */
  async _prepareContext(options) {
    const context = await super._prepareContext(options);

    // Provide actor reference for template compatibility with V1
    context.actor = this.actor;
    // Live system data (preserves derived DataModel properties)
    context.system = { ...this.actor.system };
    context.flags = this.actor.flags;
    context.cssClass = this.isEditable ? "editable" : "locked";
    context.editable = this.isEditable;
    context.owner = this.actor.isOwner;
    context.isGM = game.user.isGM;

    // Provide source data for prose-mirror value attribute
    context.source = this.actor._source.system;

    // Enrich HTML for non-editable views
    context.editable = this.isEditable;
    await EnrichmentHelper.enrichForContext(context, this.actor, ['description', 'pastEvents']);

    // Prepare type-specific data using data preparers
    if (this.actor.type === 'character') {
      await CharacterDataPreparer.prepare(context, this.actor);
      ItemListPreparer.prepare(context, this.actor);

      // Split demeanours into personal and chapter
      const demeanours = this.actor.items.filter(i => i.type === 'demeanour');
      context.personalDemeanour = demeanours.find(d => !d.system.chapter || d.system.chapter.toLowerCase() === 'all');
      context.chapterDemeanour = demeanours.find(d => d.system.chapter && d.system.chapter.toLowerCase() !== 'all');
    } else if (this.actor.type === 'npc') {
      NPCDataPreparer.prepare(context, this.actor);
      ItemListPreparer.prepare(context, this.actor);
    } else if (this.actor.type === 'enemy' || this.actor.type === 'horde') {
      EnemyDataPreparer.prepare(context, this.actor);
      ItemListPreparer.prepare(context, this.actor);
    }

    context.rollData = this.actor.getRollData();
    context.effects = prepareActiveEffectCategories(this.actor.effects);
    // Sort modifiers alphabetically by name
    const modifiers = this.actor.system.modifiers || [];
    context.modifiers = modifiers.sort((a, b) => (a.name || '').localeCompare(b.name || '', undefined, { numeric: true }));
    context.statusEffects = CONFIG.statusEffects.map(effect => ({
      ...effect,
      active: this.actor.hasCondition?.(effect.id) || false
    }));

    return context;
  }

  /* -------------------------------------------- */
  /*  Action Handlers                             */
  /* -------------------------------------------- */

  /**
   * Edit actor profile image.
   * Opens FilePicker to allow users to select a new portrait for their character.
   * Adapted from DND5e's ApplicationV2 implementation.
   * @param {Event} event - Triggering click event
   * @param {HTMLElement} target - Image element that was clicked
   */
  static async _onEditImage(event, target) {
    const attr = target.dataset.edit;
    const current = foundry.utils.getProperty(this.document._source, attr);
    const defaultArtwork = this.document.constructor.getDefaultArtwork?.(this.document._source) ?? {};
    const defaultImage = foundry.utils.getProperty(defaultArtwork, attr);
    const fp = new foundry.applications.apps.FilePicker.implementation({
      current,
      type: target.dataset.type || "image",
      redirectToRoot: defaultImage ? [defaultImage] : [],
      callback: path => {
        const isVideo = foundry.helpers.media.VideoHelper.hasVideoExtension(path);
        if ( ((target instanceof HTMLVideoElement) && isVideo)
          || ((target instanceof HTMLImageElement) && !isVideo) ) target.src = path;
        else {
          const repl = document.createElement(isVideo ? "video" : "img");
          Object.assign(repl.dataset, target.dataset);
          if ( isVideo ) Object.assign(repl, {
            autoplay: true, muted: true, disablePictureInPicture: true, loop: true, playsInline: true
          });
          repl.src = path;
          target.replaceWith(repl);
        }

        if ( this.options.form.submitOnChange ) {
          if ( attr.startsWith("token.") ) this.token.update({ [attr.slice(6)]: path });
          else {
            const submit = new Event("submit", { cancelable: true });
            this.form.dispatchEvent(submit);
          }
        }
      },
      position: {
        top: this.position.top + 40,
        left: this.position.left + 10
      },
      document: this.document
    });
    await fp.browse();
  }

  /**
   * Generic show-item-in-chat handler. Works for talents, traits, implants,
   * psychic powers, armor histories, critical effects, and demeanours.
   */
  static _onShowItem(event, target) {
    const itemId = target.dataset.itemId || target.closest('[data-item-id]')?.dataset.itemId;
    const item = this.actor.items.get(itemId);
    if (item) ChatMessageBuilder.createItemCard(item, this.actor);
  }

  /**
   * Show special ability — posts mode activation message if applicable,
   * otherwise falls back to generic item card.
   */
  static _onShowSpecialAbility(event, target) {
    const itemId = target.dataset.itemId || target.closest('[data-item-id]')?.dataset.itemId;
    const ability = this.actor.items.get(itemId);
    if (!ability) return;

    const sys = ability.system;
    if (sys.effect && sys.modeRequirement) {
      const msg = ModeHelper.buildAbilityActivationMessage(
        this.actor.name, ability.name, sys.modeRequirement,
        sys.effect, sys.improvements || [], this.actor.system.rank || 1
      );
      if (msg) {
        ChatMessage.create({ content: msg, speaker: ChatMessage.getSpeaker({ actor: this.actor }) });
        return;
      }
    }
    ChatMessageBuilder.createItemCard(ability, this.actor);
  }

  /**
   * Use psychic power — opens Focus Power Test dialog.
   */
  static _onUsePsychicPower(event, target) {
    const itemId = target.dataset.itemId || target.closest('[data-item-id]')?.dataset.itemId;
    const power = this.actor.items.get(itemId);
    if (power) game.deathwatch.CombatRouter.executeDamage(this.actor, power);
  }

  /**
   * Activate a Squad Mode ability.
   */
  static _onActivateSquadAbility(event, target) {
    const itemId = target.dataset.itemId;
    const ability = this.actor.items.get(itemId);
    if (ability) CohesionPanel.activateSquadAbility(this.actor, ability);
  }

  /* -------------------------------------------- */
  /*  Item CRUD Handlers                          */
  /* -------------------------------------------- */

  static _onEditItem(event, target) {
    const itemId = target.dataset.itemId || target.closest('[data-item-id]')?.dataset.itemId;
    const item = this.actor.items.get(itemId);
    item?.sheet.render(true);
  }

  static async _onDeleteItem(event, target) {
    const itemId = target.dataset.itemId || target.closest('[data-item-id]')?.dataset.itemId;
    const item = this.actor.items.get(itemId);
    await item?.delete();
    this.render();
  }

  static async _onCreateItem(event, target) {
    const type = target.dataset.type;
    const name = `New ${type.charAt(0).toUpperCase() + type.slice(1)}`;
    await Item.create({ name, type, system: {} }, { parent: this.actor });
    this.render();
  }

  static async _onToggleEquip(event, target) {
    event.preventDefault();
    const itemId = target.dataset.itemId || target.closest('[data-item-id]')?.dataset.itemId;
    const item = this.actor.items.get(itemId);
    if (item) await item.update({ "system.equipped": !item.system.equipped });
    this.render();
  }

  /* -------------------------------------------- */
  /*  Combat Handlers                             */
  /* -------------------------------------------- */

  static _onWeaponAttack(event, target) {
    const itemId = target.dataset.itemId || target.closest('[data-item-id]')?.dataset.itemId;
    const weapon = this.actor.items.get(itemId);
    if (weapon) game.deathwatch.CombatRouter.executeAttack(this.actor, weapon);
  }

  static _onWeaponDamage(event, target) {
    const itemId = target.dataset.itemId;
    const weapon = this.actor.items.get(itemId);
    if (weapon) game.deathwatch.CombatRouter.executeDamage(this.actor, weapon);
  }

  static _onWeaponUnjam(event, target) {
    const itemId = target.dataset.itemId;
    const weapon = this.actor.items.get(itemId);
    if (weapon) game.deathwatch.CombatHelper.clearJam(this.actor, weapon);
  }

  static async _onRemoveAmmo(event, target) {
    const weaponId = target.dataset.weaponId;
    const weapon = this.actor.items.get(weaponId);
    if (!weapon) return;
    await weapon.update({ "system.loadedAmmo": null });
    ui.notifications.info('Ammunition removed.');
    this.render();
  }

  static _onEditAmmo(event, target) {
    event.stopPropagation();
    const itemId = target.dataset.itemId;
    const item = this.actor.items.get(itemId);
    if (item) item.sheet.render(true);
  }

  static async _onRemoveUpgrade(event, target) {
    const upgradeId = target.dataset.upgradeId;
    const weaponId = target.dataset.weaponId;
    const weapon = this.actor.items.get(weaponId);
    if (!weapon) return;
    const currentUpgrades = weapon.system.attachedUpgrades || [];
    const updatedUpgrades = currentUpgrades.filter(u => u.id !== upgradeId);
    await weapon.update({ "system.attachedUpgrades": updatedUpgrades });
    ui.notifications.info('Weapon upgrade removed.');
    this.render();
  }

  /* -------------------------------------------- */
  /*  Roll Handlers                               */
  /* -------------------------------------------- */

  /* istanbul ignore next */
  static async _onRollCharacteristic(event, target) {
    const charKey = target.dataset.characteristic;
    const label = target.dataset.label || charKey;
    const characteristic = this.actor.system.characteristics[charKey];

    return RollExecutor.showCharacteristicDialog(this.actor, charKey, label, characteristic);
  }

  /* istanbul ignore next */
  static async _onRollSkill(event, target) {
    const skillKey = target.dataset.skill;
    const label = target.dataset.label || skillKey;
    const skill = this.actor.system.skills[skillKey];

    if (!skill) {
      ui.notifications.warn(`Skill ${skillKey} not found`);
      return;
    }
    if (!skill.isBasic && !skill.trained) {
      ui.notifications.warn(`${label} is an advanced skill and must be trained to use.`);
      return;
    }

    const characteristic = this.actor.system.characteristics[skill.characteristic];
    const baseCharValue = characteristic ? characteristic.value : 0;
    const effectiveChar = skill.trained ? baseCharValue : Math.floor(baseCharValue / 2);
    const skillBonus = skill.expert ? 20 : (skill.mastered ? 10 : 0);
    const skillTotal = effectiveChar + skillBonus + (skill.modifier || 0) + (skill.modifierTotal || 0);

    return RollExecutor.showSkillDialog(this.actor, skill, label, skillTotal);
  }

  /* -------------------------------------------- */
  /*  Modifier, Effect & Misc Handlers            */
  /* -------------------------------------------- */

  static _onCreateModifier(event, target) {
    ModifierHelper.createModifier(this.actor);
  }

  static _onEditModifier(event, target) {
    const modifierId = target.dataset.modifierId || target.closest('.modifier')?.dataset.modifierId;
    ModifierHelper.editModifierDialog(this.actor, modifierId);
  }

  static _onDeleteModifier(event, target) {
    const modifierId = target.dataset.modifierId || target.closest('.modifier')?.dataset.modifierId;
    ModifierHelper.deleteModifier(this.actor, modifierId);
  }

  static _onToggleModifier(event, target) {
    const modifierId = target.dataset.modifierId || target.closest('.modifier')?.dataset.modifierId;
    ModifierHelper.toggleModifierEnabled(this.actor, modifierId);
  }

  static async _onRemoveChapter(event, target) {
    const chapterId = this.actor.system.chapterId;
    if (chapterId) {
      const chapter = this.actor.items.get(chapterId);
      if (chapter) await chapter.delete();
    }
    await this.actor.update({ "system.chapterId": "" });
    ui.notifications.info('Chapter removed.');
    this.render();
  }

  static async _onRemoveSpecialty(event, target) {
    const specialtyId = this.actor.system.specialtyId;
    if (specialtyId) {
      const specialty = this.actor.items.get(specialtyId);
      if (specialty) await specialty.delete();
    }
    await this.actor.update({ "system.specialtyId": "" });
    ui.notifications.info('Specialty removed.');
    this.render();
  }

  static async _onRemoveHistory(event, target) {
    const historyId = target.dataset.historyId;
    const armorId = target.dataset.armorId;
    const armor = this.actor.items.get(armorId);
    if (!armor) return;
    const currentHistories = armor.system.attachedHistories || [];
    const updatedHistories = currentHistories.filter(id => id !== historyId);
    await armor.update({ "system.attachedHistories": updatedHistories });
    ui.notifications.info('Armor history removed.');
    this.render();
  }

  /* istanbul ignore next */
  static async _onToggleSection(event, target) {
    const section = target.closest('.gear-section');
    const sectionKey = section?.dataset.section;
    if (!section || !sectionKey) return;
    section.classList.toggle('collapsed');
    const current = this.actor.getFlag('deathwatch', 'collapsedGearSections') || {};
    current[sectionKey] = section.classList.contains('collapsed');
    await this.actor.setFlag('deathwatch', 'collapsedGearSections', current);
  }

  /* -------------------------------------------- */
  /*  Post-Render Setup                           */
  /* -------------------------------------------- */

  /* istanbul ignore next */
  _onRender(context, options) {
    super._onRender?.(context, options);
    const html = this.element;
    if (!html) return;

    // V1-style tab activation (V2 doesn't auto-manage these)
    this._tabs = TabManager.initialize(html, this, {
      defaultTab: 'characteristics',
      storageKey: '_activeTab'
    });

    // Character sub-tabs
    const characterTab = html.querySelector('.tab[data-tab="description"]');
    if (characterTab && characterTab.querySelector('.character-subtabs')) {
      this._characterSubTabs = TabManager.initialize(characterTab, this, {
        navSelector: '.character-subtabs',
        contentSelector: '.tab[data-tab="description"]',
        defaultTab: 'bio',
        storageKey: '_activeCharacterSubTab'
      });
    }

    // Select all text on focus
    html.querySelectorAll('input[type="text"], input[type="number"]').forEach(input => {
      input.addEventListener('focus', () => input.select());
    });

    // Trigger section header scan animations ONLY on first render
    if (!this._hasAnimatedHeaders) {
      this._hasAnimatedHeaders = true;
      requestAnimationFrame(() => {
        html.querySelectorAll('.section-header').forEach(header => {
          header.classList.add('animate-on-load');
        });

        // Remove animate-on-load class after animations complete (longest delay + animation duration)
        setTimeout(() => {
          html.querySelectorAll('.section-header').forEach(header => {
            header.classList.remove('animate-on-load');
          });
        }, 3000); // 1.0s max delay + 1.8s animation + 0.2s buffer
      });
    }

    // Status effect toggle (checkbox change — can't use data-action)
    html.querySelectorAll('.effect-toggle').forEach(cb => {
      cb.addEventListener('change', async (ev) => {
        const effectId = ev.currentTarget.dataset.effectId;
        await this.actor.setCondition(effectId, ev.currentTarget.checked);
      });
    });

    // Skill checkbox cascade
    html.querySelectorAll('input[type="checkbox"][name*="system.skills."][name*=".trained"]').forEach(cb => {
      cb.addEventListener('change', (ev) => {
        const match = ev.target.name.match(/system\.skills\.(\w+)\.trained/);
        if (!match) return;
        const skillKey = match[1];
        if (!ev.target.checked) {
          const mastered = html.querySelector(`input[name="system.skills.${skillKey}.mastered"]`);
          const expert = html.querySelector(`input[name="system.skills.${skillKey}.expert"]`);
          if (mastered) mastered.checked = false;
          if (expert) expert.checked = false;
        }
      });
    });

    html.querySelectorAll('input[type="checkbox"][name*="system.skills."][name*=".mastered"]').forEach(cb => {
      cb.addEventListener('change', (ev) => {
        const match = ev.target.name.match(/system\.skills\.(\w+)\.mastered/);
        if (!match) return;
        const skillKey = match[1];
        if (!ev.target.checked) {
          const expert = html.querySelector(`input[name="system.skills.${skillKey}.expert"]`);
          if (expert) expert.checked = false;
        }
      });
    });

    // Restore collapsed gear sections
    const collapsedSections = this.actor.getFlag?.('deathwatch', 'collapsedGearSections') || {};
    html.querySelectorAll('.gear-section').forEach(el => {
      if (collapsedSections[el.dataset.section]) el.classList.add('collapsed');
    });

    // Item-on-item drop zones (ammo→weapon, upgrade→weapon, history→armor)
    html.querySelectorAll('.inventory .items-list li.item').forEach(li => {
      li.addEventListener('drop', (ev) => this._onDropItemOnItem(ev), false);
      li.addEventListener('dragover', (ev) => ev.preventDefault(), false);
    });

    // Chapter drop zone
    html.querySelectorAll('.chapter-drop-zone').forEach(el => {
      el.addEventListener('drop', (ev) => this._onDropChapter(ev), false);
      el.addEventListener('dragover', (ev) => ev.preventDefault(), false);
    });

    // Specialty drop zone
    html.querySelectorAll('.specialty-drop-zone').forEach(el => {
      el.addEventListener('drop', (ev) => this._onDropSpecialty(ev), false);
      el.addEventListener('dragover', (ev) => ev.preventDefault(), false);
    });

    // Demeanour drop zones (both empty and filled slots)
    html.querySelectorAll('.demeanour-drop-zone-wrapper').forEach((wrapper, index) => {
      const slotType = index === 0 ? 'personal' : 'chapter';
      wrapper.addEventListener('drop', (ev) => this._onDropDemeanour(ev, slotType), false);
      wrapper.addEventListener('dragover', (ev) => ev.preventDefault(), false);
    });

    // Restore scroll positions after re-render
    ScrollPositionManager.restore(html, this._scrollPositions);

    // Drag events for macros
    if (this.actor.isOwner) {
      html.querySelectorAll('li.item').forEach(li => {
        if (li.classList.contains('inventory-header')) return;
        li.setAttribute('draggable', 'true');
        li.addEventListener('dragstart', (ev) => this._onDragStart?.(ev), false);
      });
    }

  }

  /* -------------------------------------------- */
  /*  Drop Handlers                               */
  /* -------------------------------------------- */

  /**
   * Override _onDropItem to intercept gear drops for stacking logic.
   * Uses the Foundry V2 pattern: _onDrop resolves the item, then calls _onDropItem.
   * This avoids async/DataTransfer timing issues that occur when awaiting in _onDrop.
   * @param {DragEvent} event - The originating drop event
   * @param {Item} item - The resolved dropped item document
   * @returns {Promise<void>}
   * @override
   */
  async _onDropItem(event, item) {
    // Only intercept gear items
    if (!item || item.type !== 'gear') return super._onDropItem(event, item);

    // Only intercept stackable gear
    if (!item.system.stackable) return super._onDropItem(event, item);

    // Search for existing stackable gear with same key on this actor
    const existingItem = this.actor.items.find(i =>
      i.type === 'gear' &&
      i.name === item.name &&
      i.system.stackable === true
    );

    if (existingItem) {
      // Stack it - increment quantity instead of creating duplicate
      const newQuantity = (existingItem.system.quantity || 1) + (item.system.quantity || 1);
      await existingItem.update({ 'system.quantity': newQuantity });
      ui.notifications.info(`${item.name} quantity increased to ${newQuantity}.`);
      return; // Don't call super - we handled the stacking
    }

    // No existing match - use default behavior to create the item
    return super._onDropItem(event, item);
  }

  /* istanbul ignore next */
  async _onDropItemOnItem(event) {
    event.preventDefault();

    const data = foundry.applications.ux.TextEditor.implementation.getDragEventData(event);
    if (data.type !== 'Item') return;

    const droppedItem = await Item.implementation.fromDropData(data);
    if (!droppedItem) return;

    // Handle armor history drops
    if (droppedItem.type === 'armor-history') {
      event.stopPropagation();

      // Extract currentTarget reference BEFORE any await operations
      // (event.currentTarget becomes null after event dispatch completes)
      const targetItemId = event.currentTarget?.dataset?.itemId;

      let historyItem = droppedItem;
      if (!droppedItem.parent) {
        const imported = await Item.create(droppedItem.toObject(), { parent: this.actor });
        historyItem = imported;
      }

      let targetItem = this.actor.items.get(targetItemId);

      if (!targetItem || targetItem.type !== 'armor') {
        const armorItems = this.actor.items.filter(i => i.type === 'armor');
        if (armorItems.length === 1) targetItem = armorItems[0];
        else {
          ui.notifications.warn(armorItems.length > 1 ? 'Multiple armor items found. Please drop directly on the armor item.' : 'No armor items found.');
          return;
        }
      }

      const currentHistories = targetItem.system.attachedHistories || [];
      const existingHistory = currentHistories.find(histId => {
        const existing = this.actor.items.get(histId);
        if (!existing) return false;
        const sourceId = historyItem.flags?.core?.sourceId || historyItem.name;
        const existingSourceId = existing.flags?.core?.sourceId || existing.name;
        return sourceId === existingSourceId;
      });

      if (existingHistory) {
        ui.notifications.warn(`${historyItem.name} is already attached to ${targetItem.name}.`);
        return;
      }

      let maxHistories = targetItem.name.toLowerCase().includes('artificer') ? 2 : 1;
      if (currentHistories.length >= maxHistories) {
        ui.notifications.warn(`${targetItem.name} can only have ${maxHistories} armor ${maxHistories === 1 ? 'history' : 'histories'}.`);
        return;
      }

      await targetItem.update({ "system.attachedHistories": [...currentHistories, historyItem.id] });
      ui.notifications.info(`${historyItem.name} attached to ${targetItem.name}.`);
    }
    // Handle ammunition drops on weapons
    else if (droppedItem.type === 'ammunition') {
      let targetItemId = event.currentTarget.dataset.itemId;
      let targetItem = this.actor.items.get(targetItemId);

      if (!targetItem || targetItem.type !== 'weapon') return;
      event.stopPropagation();

      const weaponClass = targetItem.system.class?.toLowerCase();
      if (weaponClass?.includes('melee')) {
        ui.notifications.warn('Ammunition cannot be loaded into melee weapons.');
        return;
      }

      if (targetItem.system.loadedAmmo) {
        ui.notifications.warn(`${targetItem.name} already has ammunition loaded.`);
        return;
      }

      if (!droppedItem.parent || droppedItem.parent.id !== this.actor.id) {
        ui.notifications.warn('Ammunition must be in your inventory to load it.');
        return;
      }

      await targetItem.update({ "system.loadedAmmo": droppedItem.id });
      ui.notifications.info(`${droppedItem.name} loaded into ${targetItem.name}.`);
    }
    // Handle weapon upgrade drops
    else if (droppedItem.type === 'weapon-upgrade') {
      event.stopPropagation();

      // Extract currentTarget reference BEFORE any await operations
      // (event.currentTarget becomes null after event dispatch completes)
      const targetItemId = event.currentTarget?.dataset?.itemId;

      let upgradeItem = droppedItem;
      if (!droppedItem.parent || droppedItem.parent.id !== this.actor.id) {
        const imported = await Item.create(droppedItem.toObject(), { parent: this.actor });
        upgradeItem = imported;
      }

      let targetItem = this.actor.items.get(targetItemId);

      if (!targetItem || targetItem.type !== 'weapon') {
        ui.notifications.warn('Weapon upgrades can only be attached to weapons.');
        return;
      }

      const currentUpgrades = targetItem.system.attachedUpgrades || [];
      if (currentUpgrades.find(u => u.id === upgradeItem.id)) {
        ui.notifications.warn(`${upgradeItem.name} is already attached to ${targetItem.name}.`);
        return;
      }

      await targetItem.update({ "system.attachedUpgrades": [...currentUpgrades, { id: upgradeItem.id }] });
      ui.notifications.info(`${upgradeItem.name} attached to ${targetItem.name}.`);
    }
  }

  /* istanbul ignore next */
  async _onDropChapter(event) {
    event.preventDefault();
    event.stopPropagation();

    const data = foundry.applications.ux.TextEditor.implementation.getDragEventData(event);
    if (data.type !== 'Item') return;

    const droppedItem = await Item.implementation.fromDropData(data);
    if (!droppedItem || droppedItem.type !== 'chapter') {
      ui.notifications.warn('Only chapter items can be dropped here.');
      return;
    }

    if (this.actor.system.chapterId) {
      const existingChapter = this.actor.items.get(this.actor.system.chapterId);
      if (existingChapter) await existingChapter.delete();
    }

    const chapterItem = await Item.create(droppedItem.toObject(), { parent: this.actor });
    await this.actor.update({ "system.chapterId": chapterItem.id });
    ui.notifications.info(`Chapter set to ${chapterItem.name}.`);
  }

  /* istanbul ignore next */
  async _onDropSpecialty(event) {
    event.preventDefault();
    event.stopPropagation();

    const data = foundry.applications.ux.TextEditor.implementation.getDragEventData(event);
    if (data.type !== 'Item') return;

    const droppedItem = await Item.implementation.fromDropData(data);
    if (!droppedItem || droppedItem.type !== 'specialty') {
      ui.notifications.warn('Only specialty items can be dropped here.');
      return;
    }

    if (this.actor.system.specialtyId) {
      const existingSpecialty = this.actor.items.get(this.actor.system.specialtyId);
      if (existingSpecialty) await existingSpecialty.delete();
    }

    const specialtyItem = await Item.create(droppedItem.toObject(), { parent: this.actor });
    await this.actor.update({ "system.specialtyId": specialtyItem.id });
    ui.notifications.info(`Specialty set to ${specialtyItem.name}.`);
  }

  /* istanbul ignore next */
  async _onDropDemeanour(event, slotType) {
    event.preventDefault();
    event.stopPropagation();

    const data = foundry.applications.ux.TextEditor.implementation.getDragEventData(event);
    if (data.type !== 'Item') return;

    const droppedItem = await Item.implementation.fromDropData(data);
    if (!droppedItem || droppedItem.type !== 'demeanour') {
      ui.notifications.warn('Only Demeanour items can be dropped here.');
      return;
    }

    // Check if slot is already occupied
    const existingDemeanours = this.actor.items.filter(i => i.type === 'demeanour');
    const personalDemeanour = existingDemeanours.find(d => !d.system.chapter || d.system.chapter.toLowerCase() === 'all');
    const chapterDemeanour = existingDemeanours.find(d => d.system.chapter && d.system.chapter.toLowerCase() !== 'all');

    if (slotType === 'personal' && personalDemeanour) {
      ui.notifications.warn('Personal Demeanour slot is already occupied. Remove the existing demeanour first.');
      return;
    }

    if (slotType === 'chapter' && chapterDemeanour) {
      ui.notifications.warn('Chapter Demeanour slot is already occupied. Remove the existing demeanour first.');
      return;
    }

    // Validate dropped demeanour matches slot type
    const isPersonalDemeanour = !droppedItem.system.chapter || droppedItem.system.chapter.toLowerCase() === 'all';
    if (slotType === 'personal' && !isPersonalDemeanour) {
      ui.notifications.warn('This is a Chapter-specific demeanour. Drop it in the Chapter Demeanour slot instead.');
      return;
    }
    if (slotType === 'chapter' && isPersonalDemeanour) {
      ui.notifications.warn('This is a Personal demeanour. Drop it in the Personal Demeanour slot instead.');
      return;
    }

    // Add demeanour to actor
    await Item.create(droppedItem.toObject(), { parent: this.actor });
    ui.notifications.info(`${droppedItem.name} added as ${slotType === 'personal' ? 'Personal' : 'Chapter'} Demeanour.`);
  }

  /* -------------------------------------------- */
  /*  Mental State Action Handlers                */
  /* -------------------------------------------- */

  static async _onViewCorruptionHistory(event, target) {
    const actor = this.actor;

    await HistoryDialogBuilder.show({
      actor,
      title: `Corruption History - ${actor.name}`,
      history: actor.system.corruptionHistory || [],
      columns: [
        { key: 'date', label: 'Date/Time' },
        { key: 'points', label: 'Points' },
        { key: 'source', label: 'Source' },
        { key: 'total', label: 'Total' }
      ],
      formatRow: (entry, index, runningTotal) => ({
        date: new Date(entry.timestamp).toLocaleString(),
        points: `+${entry.points} CP`,
        pointsClass: 'points-cell',
        source: entry.source,
        total: `${runningTotal} CP`
      }),
      summaryHTML: `Total Corruption: <strong>${actor.system.corruption || 0} CP</strong>`,
      emptyMessage: 'No corruption history',
      allowDelete: true,
      historyField: 'system.corruptionHistory',
      onDelete: (actor, deletedEntry) => {
        ui.notifications.info(`Deleted corruption history entry from ${new Date(deletedEntry.timestamp).toLocaleString()}`);
      }
    });
  }

  static async _onViewInsanityHistory(event, target) {
    const actor = this.actor;
    const history = actor.system.insanityHistory || [];

    // Calculate total XP spent for summary
    let totalXPSpent = 0;
    for (const entry of history) {
      if (entry.xpSpent > 0) totalXPSpent += entry.xpSpent;
    }

    await HistoryDialogBuilder.show({
      actor,
      title: `Insanity History - ${actor.name}`,
      history,
      columns: [
        { key: 'date', label: 'Date/Time' },
        { key: 'points', label: 'Points' },
        { key: 'source', label: 'Source' },
        { key: 'total', label: 'Total' },
        { key: 'testRolled', label: 'Test?' },
        { key: 'testResult', label: 'Result' },
        { key: 'xpCost', label: 'XP Cost' }
      ],
      formatRow: (entry, index, runningTotal) => {
        const pointsDisplay = entry.points >= 0 ? `+${entry.points}` : `${entry.points}`;
        const pointsClass = entry.points < 0 ? 'points-cell points-negative' : 'points-cell';
        const testResultClass = entry.testResult?.includes('Success') ? 'test-success' : 'test-failure';

        return {
          date: new Date(entry.timestamp).toLocaleString(),
          points: `${pointsDisplay} IP`,
          pointsClass,
          source: entry.source,
          total: `${runningTotal} IP`,
          testRolled: entry.testRolled ? 'Yes' : 'No',
          testResult: entry.testResult || 'N/A',
          testResultClass,
          xpCost: entry.xpSpent > 0 ? `${entry.xpSpent} XP` : '-'
        };
      },
      summaryHTML: `
        Total Insanity: <strong>${actor.system.insanity || 0} IP</strong>
        ${totalXPSpent > 0 ? ` | Total XP Spent: <strong>${totalXPSpent} XP</strong>` : ''}
      `,
      emptyMessage: 'No insanity history',
      allowDelete: true,
      historyField: 'system.insanityHistory',
      onDelete: (actor, deletedEntry) => {
        ui.notifications.info(`Deleted insanity history entry from ${new Date(deletedEntry.timestamp).toLocaleString()}`);
      }
    });
  }

  static async _onViewXPHistory(event, target) {
    const actor = this.actor;
    const breakdown = XPCalculator.calculateXPBreakdown(actor);

    await HistoryDialogBuilder.show({
      actor,
      title: `Experience Points Breakdown - ${actor.name}`,
      history: breakdown,
      columns: [
        { key: 'category', label: 'Category' },
        { key: 'source', label: 'Purchase' },
        { key: 'cost', label: 'Cost' },
        { key: 'total', label: 'Total Spent' }
      ],
      formatRow: (entry, index, runningTotal) => ({
        category: entry.category,
        source: entry.source,
        cost: `${entry.cost} XP`,
        costClass: 'points-cell',
        total: `${runningTotal} XP`
      }),
      summaryHTML: `
        Total XP Spent: <strong>${actor.system.xp.spent || 0} XP</strong>
        ${breakdown.length > 0 ? ` | Total Purchases: <strong>${breakdown.length}</strong>` : ''}
      `,
      emptyMessage: 'No XP expenditures',
      allowDelete: false
    });
  }

  static async _onAdjustCorruption(event, target) {
    const actor = this.actor;

    await AdjustmentDialog.show({
      actor,
      title: 'Adjust Corruption',
      fieldLabel: 'Corruption',
      currentValue: actor.system.corruption || 0,
      suffix: 'CP',
      onApply: async (actor, points, reason) => {
        await CorruptionHelper.addCorruption(actor, points, reason);
      }
    });
  }

  static async _onAdjustInsanity(event, target) {
    const actor = this.actor;

    await AdjustmentDialog.show({
      actor,
      title: 'Adjust Insanity',
      fieldLabel: 'Insanity',
      currentValue: actor.system.insanity || 0,
      suffix: 'IP',
      onApply: async (actor, points, reason) => {
        await InsanityHelper.addInsanity(actor, points, reason);
      }
    });
  }

  static async _onManualInsanityTest(event, target) {
    if (!game.user.isGM) {
      ui.notifications.warn('Only the GM can trigger insanity tests.');
      return;
    }

    const actor = this.actor;
    const threshold = Math.floor((actor.system.insanity || 0) / 10);
    await InsanityHelper.promptInsanityTest(actor, threshold);
  }

  static async _onPurchaseInsanityReduction(event, target) {
    const actor = this.actor;
    await InsanityHelper.purchaseInsanityReduction(actor);
  }

  static async _onViewCurse(event, target) {
    const actor = this.actor;
    const chapterItem = actor.items.find(i => i.type === 'chapter' && i.system.hasCurse?.());
    if (chapterItem) {
      chapterItem.sheet.render(true);
    }
  }
}
