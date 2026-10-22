import { FireHelper } from '../helpers/combat/fire-helper.mjs';

/**
 * Apply On Fire effects to an actor: 1d10 Energy damage (ignores armor),
 * +1 Fatigue, Willpower test to act normally, and extinguish button.
 * @param {Actor} actor - Actor document
 */
export async function applyOnFireEffects(actor) {
    const name = actor.name;
    const speaker = ChatMessage.getSpeaker({ actor });

    // Resolve token info for unlinked token support
    const token = actor.getActiveTokens?.()?.[0];
    const sceneId = token?.document?.parent?.id || '';
    const tokenId = token?.document?.id || '';

    // 1d10 Energy damage to Body (ignores armor)
    const damageRoll = await new Roll('1d10').evaluate();
    const damage = damageRoll.total;
    const currentWounds = actor.system.wounds?.value || 0;
    const maxWounds = actor.system.wounds?.max || 0;
    await actor.update({ 'system.wounds.value': currentWounds + damage });

    // +1 Fatigue
    const currentFatigue = actor.system.fatigue?.value || 0;
    const newFatigue = currentFatigue + 1;
    await actor.update({ 'system.fatigue.value': newFatigue });

    // Willpower test
    const wp = actor.system.characteristics?.wil?.value || 0;
    let wpResult;
    if (FireHelper.hasPowerArmor(actor)) {
        wpResult = { autoPass: true };
    } else {
        const wpRoll = await new Roll('1d100').evaluate();
        wpResult = { roll: wpRoll.total, success: wpRoll.total <= wp, wp };
    }

    const content = FireHelper.buildOnFireMessage(name, damage, currentWounds, maxWounds, newFatigue, wpResult, actor.id, sceneId, tokenId);
    await ChatMessage.create({ content, speaker });
}
