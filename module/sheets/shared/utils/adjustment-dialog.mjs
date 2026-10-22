/**
 * Utility for building adjustment dialogs (Corruption, Insanity).
 * Consolidates adjustment dialog patterns from actor-sheet-v2.
 */
export class AdjustmentDialog {

  /**
   * Show a points adjustment dialog with live preview.
   *
   * @param {Object} config - Dialog configuration
   * @param {Actor} config.actor - Actor document
   * @param {string} config.title - Dialog window title (e.g., 'Adjust Corruption')
   * @param {string} config.fieldLabel - Field label (e.g., 'Corruption', 'Insanity')
   * @param {number} config.currentValue - Current point value
   * @param {string} config.suffix - Points suffix (e.g., 'CP', 'IP')
   * @param {Function} config.onApply - Callback: async (actor, points, reason) => void
   *
   * @example
   * // Corruption adjustment
   * await AdjustmentDialog.show({
   *   actor,
   *   title: 'Adjust Corruption',
   *   fieldLabel: 'Corruption',
   *   currentValue: actor.system.corruption || 0,
   *   suffix: 'CP',
   *   onApply: async (actor, points, reason) => {
   *     await CorruptionHelper.addCorruption(actor, points, reason);
   *   }
   * });
   */
  static async show(config) {
    const {
      actor,
      title,
      fieldLabel,
      currentValue,
      suffix,
      onApply
    } = config;

    const content = `
      <form class="gm-adjustment-dialog deathwatch-dialog">
        <div class="form-group">
          <p>Adjust <strong>${actor.name}</strong>'s ${fieldLabel}</p>
          <p>Current ${fieldLabel}: <strong>${currentValue}</strong></p>
        </div>

        <div class="form-group">
          <label>Points to Add/Remove:</label>
          <input type="number" name="points" value="0" autofocus />
          <p class="hint">Positive to add, negative to remove</p>
        </div>

        <div class="form-group">
          <label>Reason:</label>
          <input type="text" name="reason" value="Manual adjustment" />
        </div>

        <div class="form-group preview">
          <label>New Total:</label>
          <input type="number" name="preview" value="${currentValue}" readonly class="preview-field" />
        </div>
      </form>
    `;

    await foundry.applications.api.DialogV2.wait({
      window: { title },
      content,
      buttons: [
        {
          action: 'apply',
          icon: 'fas fa-check',
          label: 'Apply',
          callback: async (event, button, dialog) => {
            const el = dialog.element;
            const points = parseInt(el.querySelector('[name="points"]').value) || 0;
            const reason = el.querySelector('[name="reason"]').value || 'Manual adjustment';

            if (points === 0) {
              ui.notifications.info('No points to adjust.');
              return;
            }

            await onApply(actor, points, reason);
          }
        },
        {
          action: 'cancel',
          icon: 'fas fa-times',
          label: 'Cancel'
        }
      ],
      default: 'apply',
      render: (event, dialog) => {
        const el = dialog.element;
        el.querySelector('[name="points"]').addEventListener('input', (e) => {
          const points = parseInt(e.target.value) || 0;
          const newTotal = Math.max(0, currentValue + points);
          el.querySelector('.preview-field').value = newTotal;
        });
      }
    });
  }
}
