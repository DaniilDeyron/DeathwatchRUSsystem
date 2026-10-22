import { Logger } from "../helpers/logger.mjs";

const { HandlebarsApplicationMixin } = foundry.applications.api;

/**
 * Configuration UI for category-based logging.
 * Hierarchical checkbox interface for enabling/disabling log categories.
 * @extends {ApplicationV2}
 */
export class CategoryLoggingConfig extends HandlebarsApplicationMixin(
  foundry.applications.api.ApplicationV2
) {
  static DEFAULT_OPTIONS = {
    id: 'category-logging-config',
    window: {
      title: 'Category Logging Configuration',
      minimizable: false,
      resizable: false
    },
    position: { width: 500, height: 600 },
    classes: ['category-logging-config'],
    actions: {
      reset: CategoryLoggingConfig._onReset,
      save: CategoryLoggingConfig._onSave,
      toggleGroup: CategoryLoggingConfig._onToggleGroup,
      toggleCategory: CategoryLoggingConfig._onToggleCategory
    }
  };

  static PARTS = {
    form: { template: 'systems/deathwatch/templates/ui/category-logging-config.hbs' }
  };

  /**
   * Prepare context data for template rendering.
   * Builds hierarchical structure from Logger.CATEGORY_REGISTRY.
   */
  async _prepareContext(options) {
    const enabledCategories = game.settings.get('deathwatch', 'enabledLogCategories') || [];
    const enabledSet = new Set(enabledCategories);

    // Build hierarchical structure: groups -> categories
    const groups = {};
    Object.entries(Logger.CATEGORY_REGISTRY).forEach(([context, meta]) => {
      if (!groups[meta.group]) {
        groups[meta.group] = {
          name: meta.group,
          label: this._capitalizeGroup(meta.group),
          categories: [],
          allChecked: true
        };
      }

      const isChecked = enabledSet.has(meta.key);
      groups[meta.group].categories.push({
        key: meta.key,
        label: meta.label,
        context: context,
        checked: isChecked
      });

      if (!isChecked) {
        groups[meta.group].allChecked = false;
      }
    });

    return {
      groups: Object.values(groups),
      hasEnabledCategories: enabledCategories.length > 0
    };
  }

  /**
   * Capitalize group name for display.
   * @param {string} group - Group name (e.g., 'combat')
   * @returns {string} Capitalized name (e.g., 'Combat')
   * @private
   */
  _capitalizeGroup(group) {
    return group.charAt(0).toUpperCase() + group.slice(1);
  }

  /**
   * Handle reset button click - disable all categories.
   * @private
   */
  static async _onReset(event, target) {
    await game.settings.set('deathwatch', 'enabledLogCategories', []);
    this.render();
  }

  /**
   * Handle save button click - close the form.
   * Settings are already saved via toggleCategory/toggleGroup actions.
   * @private
   */
  static async _onSave(event, target) {
    this.close();
  }

  /**
   * Handle group checkbox toggle - enable/disable all categories in group.
   * @private
   */
  static async _onToggleGroup(event, target) {
    const groupName = target.dataset.group;
    const checked = target.checked;

    const enabledCategories = game.settings.get('deathwatch', 'enabledLogCategories') || [];
    const enabledSet = new Set(enabledCategories);

    // Find all categories in this group
    Object.entries(Logger.CATEGORY_REGISTRY).forEach(([context, meta]) => {
      if (meta.group === groupName) {
        if (checked) {
          enabledSet.add(meta.key);
        } else {
          enabledSet.delete(meta.key);
        }
      }
    });

    await game.settings.set('deathwatch', 'enabledLogCategories', Array.from(enabledSet));
    this.render();
  }

  /**
   * Handle category checkbox toggle - enable/disable single category.
   * @private
   */
  static async _onToggleCategory(event, target) {
    const categoryKey = target.dataset.key;
    const checked = target.checked;

    const enabledCategories = game.settings.get('deathwatch', 'enabledLogCategories') || [];
    const enabledSet = new Set(enabledCategories);

    if (checked) {
      enabledSet.add(categoryKey);
    } else {
      enabledSet.delete(categoryKey);
    }

    await game.settings.set('deathwatch', 'enabledLogCategories', Array.from(enabledSet));
    this.render();
  }
}
