import { Sanitizer } from "../sanitizer.mjs";

export class CriticalEffectsHelper {
  static LOCATION_MAP = {
    "Head": "head",
    "Body": "body",
    "Right Arm": "arm",
    "Left Arm": "arm",
    "Right Leg": "leg",
    "Left Leg": "leg"
  };

  static async applyCriticalEffect(actor, location, damageType, preCalculatedCriticalDamage) {
    const critLocation = this.LOCATION_MAP[location] || 'body';
    const pack = game.packs.get('deathwatch.critical-effects');
    if (!pack) {
      ui.notifications.warn('Critical effects compendium not found!');
      return;
    }

    const index = await pack.getIndex();
    const totalCriticalDamage = preCalculatedCriticalDamage !== undefined
      ? preCalculatedCriticalDamage
      : Math.max(0, actor.system.wounds.value - actor.system.wounds.max);
    const effectLevel = Math.min(totalCriticalDamage, 10);

    if (effectLevel < 1) {
      ui.notifications.warn('No critical damage to apply!');
      return;
    }

    const existingCriticals = actor.items.filter(i => i.type === 'critical-effect');
    const levelStr = effectLevel.toString().padStart(4, '0');
    const effectId = `${damageType.toLowerCase()}-${critLocation}${levelStr}`;

    const alreadyHas = existingCriticals.some(i => {
      const sourceId = i.flags?.core?.sourceId?.split('.').pop() || i._id;
      return sourceId === effectId;
    });

    if (alreadyHas) {
      const safeActorName = Sanitizer.escape(actor.name);
      ui.notifications.warn(`${safeActorName} already has this critical effect!`);
      return;
    }

    const entry = index.find(e => e._id === effectId);
    if (!entry) {
      ui.notifications.warn(`Critical effect not found for level ${effectLevel}!`);
      return;
    }

    const criticalEffect = await pack.getDocument(entry._id);
    let description = criticalEffect.system.description;
    let itemsToAdd = [criticalEffect.toObject()];

    // Check if description contains "As above" and fetch previous level
    if (description.toLowerCase().includes('as above') && effectLevel > 1) {
      const prevLevelStr = (effectLevel - 1).toString().padStart(4, '0');
      const prevEffectId = `${damageType.toLowerCase()}-${critLocation}${prevLevelStr}`;
      const prevEntry = index.find(e => e._id === prevEffectId);
      if (prevEntry) {
        const prevEffect = await pack.getDocument(prevEntry._id);
        description = `${prevEffect.system.description}<br><br><strong>Additionally:</strong> ${description}`;

        // Check if previous effect already exists
        const hasPrevEffect = existingCriticals.some(i => {
          const sourceId = i.flags?.core?.sourceId?.split('.').pop() || i._id;
          return sourceId === prevEffectId;
        });
        if (!hasPrevEffect) {
          itemsToAdd.unshift(prevEffect.toObject());
        }
      }
    }

    await Item.createDocuments(itemsToAdd, { parent: actor });
    const safeActorName = Sanitizer.escape(actor.name);
    ui.notifications.info(`Critical effect Level ${effectLevel} added to ${safeActorName}`);

    await ChatMessage.create({
      speaker: ChatMessage.getSpeaker(),
      content: `<strong>${safeActorName}</strong> suffers <strong style="color: darkred;">Level ${effectLevel} Critical Damage</strong> to ${location}<br><strong>${critLocation} (${damageType})</strong><br><div style="margin-top: 8px;">${description}</div>`
    });
  }
}
