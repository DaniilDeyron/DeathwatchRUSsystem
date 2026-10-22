import { CombatRouter } from '../helpers/combat/combat-router.mjs';
import { Sanitizer } from '../helpers/sanitizer.mjs';

/**
 * Create a Macro from an Item drop.
 * Get an existing item macro if one exists, otherwise create a new one.
 * @param {Object} data - The dropped data
 * @param {number} slot - The hotbar slot to use
 * @returns {Promise<boolean>}
 */
export async function createItemMacro(data, slot) {
    // First, determine if this is a valid owned item.
    if (data.type !== "Item") return;
    if (!data.uuid.includes('Actor.') && !data.uuid.includes('Token.')) {
        return ui.notifications.warn("You can only create macro buttons for owned Items");
    }
    // If it is, retrieve it based on the uuid.
    const item = await Item.fromDropData(data);

    // Create the macro command using the uuid.
    const command = `game.deathwatch.rollItemMacro("${data.uuid}");`;
    let macro = game.macros.find(m => (m.name === item.name) && (m.command === command));
    if (!macro) {
        macro = await Macro.create({
            name: item.name,
            type: "script",
            img: item.img,
            command: command,
            flags: { "deathwatch.itemMacro": true }
        });
    }
    game.user.assignHotbarMacro(macro, slot);
    return false;
}

/**
 * Execute a macro for an owned item. Weapons show Attack/Damage dialog,
 * psychic powers open Focus Power Test, other items use generic roll.
 * When options are provided for weapons, skips the Attack/Damage choice dialog.
 * @param {string} itemUuid - UUID of the item
 * @param {Object} [options={}] - Preset attack options (see docs/hotbar-macros.md)
 */
export async function rollItemMacro(itemUuid, options = {}) {
    const dropData = { type: 'Item', uuid: itemUuid };
    const item = await Item.fromDropData(dropData);

    if (!item || !item.parent) {
        const itemName = item?.name ?? itemUuid;
        ui.notifications.warn(`Could not find item ${itemName}. You may need to delete and recreate this macro.`);
        return;
    }

    if (item.type === 'weapon') {
        const hasOptions = Object.keys(options).length > 0;

        // action: "damage" goes straight to damage roll
        if (hasOptions && options.action === 'damage') {
            CombatRouter.executeDamage(item.parent, item);
            return;
        }

        // With options: skip Attack/Damage choice, go straight to attack
        if (hasOptions) {
            CombatRouter.executeAttack(item.parent, item, options);
            return;
        }

        // No options: show Attack/Damage choice dialog (original behavior)
        const safeItemName = Sanitizer.escape(item.name);
        foundry.applications.api.DialogV2.wait({
            window: { title: safeItemName },
            content: `<p style="text-align: center;"><img src="${item.img}" width="50" height="50" style="border: none;" /><br><strong>${safeItemName}</strong></p>`,
            buttons: [
                {
                    icon: '<i class="fas fa-crosshairs"></i>',
                    label: "Attack", action: "attack",
                    callback: () => CombatRouter.executeAttack(item.parent, item)
                },
                {
                    icon: '<i class="fas fa-burst"></i>',
                    label: "Damage", action: "damage",
                    callback: () => CombatRouter.executeDamage(item.parent, item)
                }
            ]
        });
        return;
    }

    if (item.type === 'psychic-power') {
        CombatRouter.executeDamage(item.parent, item);
        return;
    }

    item.roll();
}
