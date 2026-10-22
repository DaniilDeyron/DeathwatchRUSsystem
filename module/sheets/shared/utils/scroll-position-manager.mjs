/**
 * Utility for saving and restoring scroll positions in sheet re-renders.
 * Consolidates scroll management patterns from actor-sheet-v2 and item-sheet-v2.
 */
export class ScrollPositionManager {

  /**
   * Save scroll positions for all scrollable elements in a sheet.
   * Checks common selectors used across actor and item sheets.
   *
   * @param {HTMLElement} element - Root sheet element
   * @returns {Object} Map of selector -> scrollTop value
   *
   * @example
   * // In _renderHTML():
   * this._scrollPositions = ScrollPositionManager.save(el);
   */
  static save(element) {
    if (!element) return {};

    const positions = {};

    // Common scrollable selectors in Deathwatch sheets
    const selectors = [
      '.sheet-body',
      '.window-content',
      '.skills-section',
      '.items-list',
      '.tab-content'
    ];

    for (const selector of selectors) {
      const el = element.querySelector(selector);
      if (el && el.scrollTop !== undefined) {
        positions[selector] = el.scrollTop;
      }

      // Also check parent element for skills-section (actor sheet pattern)
      if (selector === '.skills-section') {
        const parent = el?.parentElement;
        if (parent && parent.scrollTop !== undefined) {
          positions[`${selector}-parent`] = parent.scrollTop;
        }
      }
    }

    return positions;
  }

  /**
   * Restore scroll positions to elements.
   * Silently ignores positions for elements that no longer exist.
   *
   * @param {HTMLElement} element - Root sheet element
   * @param {Object} positions - Map of selector -> scrollTop value (from save())
   *
   * @example
   * // In _onRender():
   * ScrollPositionManager.restore(el, this._scrollPositions);
   */
  static restore(element, positions) {
    if (!element || !positions) return;

    for (const [selector, scrollTop] of Object.entries(positions)) {
      // Handle special parent selector
      if (selector.endsWith('-parent')) {
        const baseSelector = selector.replace('-parent', '');
        const childEl = element.querySelector(baseSelector);
        const parentEl = childEl?.parentElement;
        if (parentEl) {
          parentEl.scrollTop = scrollTop;
        }
      } else {
        const el = element.querySelector(selector);
        if (el) {
          el.scrollTop = scrollTop;
        }
      }
    }
  }
}
