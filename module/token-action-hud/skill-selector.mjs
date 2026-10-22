/**
 * Configuration UI for Token Action HUD skill selection.
 * Allows players to choose which skills appear in their TAH.
 * @module token-action-hud/skill-selector
 */

const { HandlebarsApplicationMixin } = foundry.applications.api;

/**
 * Default skill keys to display (common quick-use skills)
 */
export const DEFAULT_TAH_SKILLS = [
  'awareness',
  'climb',
  'dodge',
  'search',
  'silent_move',
  'medicae',
  'tech_use'
];

/**
 * Skill selection UI for Token Action HUD
 * @extends {ApplicationV2}
 */
export class TAHSkillSelector extends HandlebarsApplicationMixin(
  foundry.applications.api.ApplicationV2
) {
  static DEFAULT_OPTIONS = {
    id: 'tah-skill-selector',
    window: {
      title: 'Token Action HUD - Skill Selection',
      minimizable: false,
      resizable: true
    },
    position: { width: 600, height: 700 },
    classes: ['tah-skill-selector'],
    actions: {
      reset: TAHSkillSelector._onReset,
      save: TAHSkillSelector._onSave,
      toggleSkill: TAHSkillSelector._onToggleSkill,
      selectDefaults: TAHSkillSelector._onSelectDefaults
    }
  };

  static PARTS = {
    form: { template: 'systems/deathwatch/templates/token-action-hud/skill-selector.hbs' }
  };

  /**
   * Prepare context data for template rendering.
   * Groups skills by Basic/Advanced with selection state.
   */
  async _prepareContext(options) {
    const selectedSkills = game.settings.get('deathwatch', 'tahSkillList') || DEFAULT_TAH_SKILLS;
    const selectedSet = new Set(selectedSkills);

    // Get skill definitions from config
    const skillConfig = game.deathwatch.config.Skills;

    // We need to load skill metadata to determine basic vs advanced
    // Since skills.json isn't directly accessible here, we'll fetch it
    const response = await fetch('systems/deathwatch/module/data/skills.json', { cache: 'no-store' });
    const skillDefinitions = await response.json();

    const basicSkills = [];
    const advancedSkills = [];

    Object.entries(skillConfig).forEach(([key, label]) => {
      const definition = skillDefinitions[key];
      if (!definition) return; // Skip if not found

      const skillData = {
        key,
        label,
        checked: selectedSet.has(key)
      };

      if (definition.isBasic) {
        basicSkills.push(skillData);
      } else {
        advancedSkills.push(skillData);
      }
    });

    // Sort alphabetically by label
    basicSkills.sort((a, b) => a.label.localeCompare(b.label));
    advancedSkills.sort((a, b) => a.label.localeCompare(b.label));

    return {
      basicSkills,
      advancedSkills,
      hasSelection: selectedSkills.length > 0
    };
  }

  /**
   * Handle reset button - clear all selections
   * @private
   */
  static async _onReset(event, target) {
    await game.settings.set('deathwatch', 'tahSkillList', []);
    this.render();
  }

  /**
   * Handle "Use Defaults" button - restore default skill list
   * @private
   */
  static async _onSelectDefaults(event, target) {
    await game.settings.set('deathwatch', 'tahSkillList', DEFAULT_TAH_SKILLS);
    this.render();
  }

  /**
   * Handle save button - close the form
   * @private
   */
  static async _onSave(event, target) {
    this.close();
  }

  /**
   * Handle skill checkbox toggle
   * @private
   */
  static async _onToggleSkill(event, target) {
    const skillKey = target.dataset.skill;
    const checked = target.checked;

    const selectedSkills = game.settings.get('deathwatch', 'tahSkillList') || [];
    const selectedSet = new Set(selectedSkills);

    if (checked) {
      selectedSet.add(skillKey);
    } else {
      selectedSet.delete(skillKey);
    }

    await game.settings.set('deathwatch', 'tahSkillList', Array.from(selectedSet));
    this.render();
  }
}
