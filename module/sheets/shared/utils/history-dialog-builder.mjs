/**
 * Utility for building history dialogs (Corruption, Insanity, XP).
 * Consolidates history dialog patterns from actor-sheet-v2.
 */
export class HistoryDialogBuilder {

  /**
   * Show a history dialog with configurable columns and data formatting.
   *
   * @param {Object} config - Dialog configuration
   * @param {Actor} config.actor - Actor document
   * @param {string} config.title - Dialog window title
   * @param {Array} config.history - History entries array
   * @param {Array<{key: string, label: string}>} config.columns - Column definitions
   * @param {Function} config.formatRow - Row formatter: (entry, index, runningTotal) => Object mapping column keys to HTML
   * @param {string} config.summaryHTML - HTML for summary section below table
   * @param {string} config.emptyMessage - Message shown when history is empty
   * @param {boolean} [config.allowDelete=false] - Show delete buttons
   * @param {string} [config.historyField] - Field path for deletion (e.g., 'system.corruptionHistory')
   * @param {Function} [config.onDelete] - Callback after deletion: (actor, deletedEntry) => void
   *
   * @example
   * // Corruption History
   * await HistoryDialogBuilder.show({
   *   actor,
   *   title: `Corruption History - ${actor.name}`,
   *   history: actor.system.corruptionHistory || [],
   *   columns: [
   *     { key: 'date', label: 'Date/Time' },
   *     { key: 'points', label: 'Points' },
   *     { key: 'source', label: 'Source' },
   *     { key: 'total', label: 'Total' }
   *   ],
   *   formatRow: (entry, index, runningTotal) => ({
   *     date: new Date(entry.timestamp).toLocaleString(),
   *     points: `+${entry.points} CP`,
   *     source: entry.source,
   *     total: `${runningTotal} CP`
   *   }),
   *   summaryHTML: `Total Corruption: <strong>${actor.system.corruption || 0} CP</strong>`,
   *   emptyMessage: 'No corruption history',
   *   allowDelete: true,
   *   historyField: 'system.corruptionHistory'
   * });
   */
  static async show(config) {
    const {
      actor,
      title,
      history,
      columns,
      formatRow,
      summaryHTML,
      emptyMessage,
      allowDelete = false,
      historyField,
      onDelete
    } = config;

    let tableRows = '';
    let runningTotal = 0;

    for (let i = 0; i < history.length; i++) {
      const entry = history[i];

      // Update running total if entry has points field
      if (entry.points !== undefined) {
        runningTotal += entry.points;
      } else if (entry.cost !== undefined) {
        runningTotal += entry.cost;
      }

      const rowData = formatRow(entry, i, runningTotal);

      tableRows += '<tr>';
      for (const col of columns) {
        const cellValue = rowData[col.key] || '';
        const cellClass = rowData[`${col.key}Class`] || '';
        tableRows += `<td class="${cellClass}">${cellValue}</td>`;
      }

      // Add delete button column if enabled
      if (allowDelete) {
        tableRows += `
          <td class="delete-cell">
            <button class="delete-history-btn" data-index="${i}" title="Delete Entry">
              <i class="fas fa-trash"></i>
            </button>
          </td>
        `;
      }

      tableRows += '</tr>';
    }

    // Build column headers
    let headerRow = '';
    for (const col of columns) {
      const width = col.width ? `style="width: ${col.width};"` : '';
      headerRow += `<th ${width}>${col.label}</th>`;
    }
    if (allowDelete) {
      headerRow += '<th style="width: 60px;">Delete</th>';
    }

    const colspan = columns.length + (allowDelete ? 1 : 0);
    const emptyRow = `<tr><td colspan="${colspan}" style="text-align: center;">${emptyMessage}</td></tr>`;

    const content = `
      <div class="history-dialog">
        <div class="history-table-wrapper">
          <table class="history-table">
            <thead>
              <tr>${headerRow}</tr>
            </thead>
            <tbody>
              ${tableRows || emptyRow}
            </tbody>
          </table>
        </div>
        <div class="history-summary">
          ${summaryHTML}
        </div>
      </div>
    `;

    const dialogConfig = {
      window: { title },
      content,
      buttons: [{
        action: 'close',
        icon: 'fas fa-times',
        label: 'Close',
        callback: () => {}
      }],
      default: 'close'
    };

    // Add render callback for delete buttons
    if (allowDelete && historyField) {
      dialogConfig.render = (event, dialog) => {
        dialog.element.querySelectorAll('.delete-history-btn').forEach(btn => {
          btn.addEventListener('click', async () => {
            const index = parseInt(btn.dataset.index);
            const updatedHistory = [...history];
            const deletedEntry = updatedHistory.splice(index, 1)[0];

            await actor.update({ [historyField]: updatedHistory });

            // Call onDelete callback if provided
            if (onDelete) {
              onDelete(actor, deletedEntry);
            }

            dialog.close();

            // Reopen the dialog with updated history
            await HistoryDialogBuilder.show({
              ...config,
              history: updatedHistory
            });
          });
        });
      };
    }

    await foundry.applications.api.DialogV2.wait(dialogConfig);
  }
}
