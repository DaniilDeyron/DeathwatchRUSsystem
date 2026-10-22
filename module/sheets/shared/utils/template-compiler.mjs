/**
 * Utility for compiling Handlebars templates with standard options.
 * Consolidates template compilation pattern from actor-sheet-v2 and item-sheet-v2.
 */
export class TemplateCompiler {

  /**
   * Compile a Handlebars template and return it as a rendered HTMLElement.
   * Uses standard Foundry enrichment options (allowProtoMethodsByDefault, allowProtoPropertiesByDefault).
   *
   * @param {string} templatePath - Path to the Handlebars template
   * @param {Object} context - Context object for template rendering
   * @param {string} [partName='sheet'] - Name for dataset.applicationPart attribute
   * @returns {Promise<{[partName]: HTMLElement}>} Object with compiled HTML element
   *
   * @example
   * // In _renderHTML():
   * const template = `systems/deathwatch/templates/actor/actor-${this.document.type}-sheet.html`;
   * return await TemplateCompiler.compile(template, context);
   */
  static async compile(templatePath, context, partName = 'sheet') {
    const compiled = await foundry.applications.handlebars.getTemplate(templatePath);
    const htmlString = compiled(context, {
      allowProtoMethodsByDefault: true,
      allowProtoPropertiesByDefault: true
    });

    const temp = document.createElement("div");
    temp.innerHTML = htmlString;
    const content = temp.firstElementChild;
    content.dataset.applicationPart = partName;

    return { [partName]: content };
  }
}
