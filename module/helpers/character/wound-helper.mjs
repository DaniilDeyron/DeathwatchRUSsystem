/**
 * Helper for calculating wound status
 */
export class WoundHelper {
  /**
   * Calculate the CSS class for wound status based on current/max wounds
   * @param {number} current Current wounds taken
   * @param {number} max Maximum wounds
   * @returns {string} CSS class name ('', 'wounds-warning', or 'wounds-danger')
   */
  static getWoundColorClass(current, max) {
    if (!max || max <= 0) return '';
    
    const percent = current / max;
    
    if (percent >= 0.75) {
      return 'wounds-danger';
    } else if (percent >= 0.26) {
      return 'wounds-warning';
    }
    
    return '';
  }
}
