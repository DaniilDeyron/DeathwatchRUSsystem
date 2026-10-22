/**
 * HTML sanitization utilities to prevent XSS attacks in chat messages.
 * All user-provided strings (actor names, item names, etc.) should be
 * escaped before being inserted into HTML.
 */
export class Sanitizer {
  /**
   * Escape HTML special characters to prevent XSS.
   * Uses Foundry's built-in escapeHTML utility.
   * @param {*} text - User-provided text (will be converted to string)
   * @returns {string} - Escaped text safe for HTML insertion
   * @example
   * Sanitizer.escape('<script>alert("XSS")</script>')
   * // Returns: '&lt;script&gt;alert(&quot;XSS&quot;)&lt;/script&gt;'
   */
  static escape(text) {
    if (text === null || text === undefined) return '';
    if (typeof text !== 'string') text = String(text);
    return foundry.utils.escapeHTML(text);
  }

  /**
   * Tagged template literal for building HTML with auto-escaping.
   * All interpolated values are automatically escaped.
   * @param {TemplateStringsArray} strings - Template string parts
   * @param {...any} values - Values to interpolate
   * @returns {string} - HTML string with escaped values
   * @example
   * const name = '<img src=x onerror="alert(1)">';
   * const html = Sanitizer.html`<strong>${name}</strong> takes damage`;
   * // Returns: '<strong>&lt;img src=x onerror=&quot;alert(1)&quot;&gt;</strong> takes damage'
   */
  static html(strings, ...values) {
    return strings.reduce((result, str, i) => {
      const value = values[i];
      const escaped = value !== undefined ? Sanitizer.escape(value) : '';
      return result + str + escaped;
    }, '');
  }
}
