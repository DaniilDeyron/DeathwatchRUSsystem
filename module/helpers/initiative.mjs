import { Sanitizer } from "./sanitizer.mjs";

export class InitiativeHelper {
  static async rollInitiativeDialog(combatant) {
    const actor = combatant.actor;
    const rollData = actor.getRollData();
    const defaultBonus = (rollData.agBonus || 0) + (rollData.initiativeBonus || 0);

    const safeActorName = Sanitizer.escape(actor.name);
    const result = await foundry.applications.api.DialogV2.wait({
      window: { title: `Initiative: ${safeActorName}` },
      content: `
        <form>
          <div class="form-group">
            <label>Roll Formula:</label>
            <input type="text" name="formula" value="1d10" />
          </div>
          <div class="form-group">
            <label>Bonus:</label>
            <input type="number" name="bonus" value="${defaultBonus}" />
          </div>
        </form>
      `,
      buttons: [
        {
          label: "Roll",
          action: "roll",
          callback: (event, button, dialog) => {
            const el = dialog.element;
            const formula = el.querySelector('[name="formula"]').value;
            const bonus = parseInt(el.querySelector('[name="bonus"]').value) || 0;
            return bonus !== 0 ? `${formula} + ${bonus}` : formula;
          }
        },
        { label: "Cancel", action: "cancel" }
      ]
    });

    return result === "cancel" ? null : result;
  }
}
