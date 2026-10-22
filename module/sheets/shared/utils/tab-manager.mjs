/**
 * Utility for initializing and managing tabs in ApplicationV2 sheets.
 * Consolidates tab management patterns from actor-sheet-v2 and item-sheet-v2.
 */
export class TabManager {

  /**
   * Initialize Foundry tabs with automatic state persistence.
   * Binds tab navigation and stores active tab on the sheet instance.
   *
   * @param {HTMLElement} html - Rendered sheet HTML
   * @param {Object} sheet - Sheet instance (for storing active tab state)
   * @param {Object} [options={}] - Configuration options
   * @param {string} [options.navSelector='.sheet-tabs'] - Tab navigation selector
   * @param {string} [options.contentSelector='.sheet-body'] - Tab content selector
   * @param {string} [options.defaultTab='description'] - Default active tab
   * @param {string} [options.storageKey='_activeTab'] - Property name for storing active tab on sheet
   * @returns {foundry.applications.ux.Tabs} Initialized Tabs instance
   *
   * @example
   * // In _onRender():
   * TabManager.initialize(html, this, { defaultTab: 'main' });
   */
  static initialize(html, sheet, options = {}) {
    const {
      navSelector = '.sheet-tabs',
      contentSelector = '.sheet-body',
      defaultTab = 'description',
      storageKey = '_activeTab'
    } = options;

    // Get initial tab from sheet state or use default
    const initialTab = sheet[storageKey] || defaultTab;

    // Create and bind Foundry tabs
    const tabs = new foundry.applications.ux.Tabs({
      navSelector,
      contentSelector,
      initial: initialTab
    });

    tabs.bind(html);
    tabs.activate(initialTab);

    // Attach click handlers to persist tab selection
    html.querySelectorAll(`${navSelector} .item`).forEach(tab => {
      tab.addEventListener('click', () => {
        sheet[storageKey] = tab.dataset.tab;
      });
    });

    return tabs;
  }
}
