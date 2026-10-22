/**
 * Utility for enriching HTML content in non-editable sheet views.
 * Consolidates enrichment patterns from actor-sheet-v2 and item-sheet-v2.
 */
export class EnrichmentHelper {

  /**
   * Enrich HTML fields for non-editable sheet contexts.
   * Only processes enrichment if the sheet is not editable.
   * Enriched content is stored in context.enriched[fieldName].
   *
   * @param {Object} context - Sheet context object (will be modified)
   * @param {Actor|Item} document - Document to enrich content from
   * @param {string[]} [fields=['description']] - Field names to enrich from document.system
   *
   * @example
   * // In _prepareContext():
   * await EnrichmentHelper.enrichForContext(context, this.document);
   * // Now context.enriched.description contains enriched HTML
   *
   * @example
   * // Enrich multiple fields:
   * await EnrichmentHelper.enrichForContext(context, this.document, ['description', 'notes', 'effect']);
   */
  static async enrichForContext(context, document, fields = ['description']) {
    // Only enrich for non-editable views
    if (context.editable) return;

    const enrichmentOptions = {
      secrets: document.isOwner,
      relativeTo: document,
      rollData: context.rollData
    };

    context.enriched = context.enriched || {};

    for (const field of fields) {
      const content = document.system[field] || '';
      context.enriched[field] = await foundry.applications.ux.TextEditor.enrichHTML(
        content,
        enrichmentOptions
      );
    }
  }
}
