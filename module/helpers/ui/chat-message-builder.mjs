import { Sanitizer } from '../sanitizer.mjs';

export class ChatMessageBuilder {
  static createItemCard(item, actor) {
    const speaker = ChatMessage.getSpeaker({ actor });
    const { title, content } = this._buildItemCardContent(item, actor);

    return ChatMessage.create({
      speaker,
      content: `<div class="${item.type}-card">${title}${content}</div>`
    });
  }

  static _buildItemCardContent(item, actor) {
    const safeName = Sanitizer.escape(item.name);
    const book = item.system.book ? `<p style="font-size: 0.85em; color: #666; margin-top: 10px;"><em>${Sanitizer.escape(item.system.book)}, p${item.system.page}</em></p>` : '';

    switch (item.type) {
      case 'armor-history':
        return {
          title: `<h3>${safeName}</h3>`,
          content: `${item.system.description}${book}`
        };

      case 'critical-effect':
        return {
          title: `<div style="display: flex; align-items: start; gap: 10px;">
            <img src="${item.img}" style="width: 36px; height: 36px; flex-shrink: 0;" />
            <div>
              <h3 style="font-size: 1em; margin: 0 0 5px 0;">${safeName}</h3>
              <p style="margin: 0 0 8px 0;"><strong>Location:</strong> ${Sanitizer.escape(item.system.location)} | <strong>Type:</strong> ${Sanitizer.escape(item.system.damageType)}</p>`,
          content: `${item.system.description}</div></div>`
        };

      case 'characteristic':
        return {
          title: `<h3>${safeName}</h3>`,
          content: `<p style="margin: 5px 0;"><strong>Chapter:</strong> ${Sanitizer.escape(item.system.chapter)}</p>${item.system.description}${book}`
        };

      case 'talent':
        const prereq = item.system.prerequisite ? `<p style="margin: 5px 0;"><strong>Prerequisite:</strong> ${Sanitizer.escape(item.system.prerequisite)}</p>` : '';
        const benefit = item.system.benefit ? `<p style="margin: 5px 0;"><strong>Benefit:</strong> ${Sanitizer.escape(item.system.benefit)}</p>` : '';
        return {
          title: `<h3>${safeName}</h3>`,
          content: `${prereq}${benefit}${item.system.description}${book}`
        };

      case 'trait':
        return {
          title: `<h3>${safeName}</h3>`,
          content: `${item.system.description}${book}`
        };

      case 'special-ability':
        const specialty = item.system.specialty ? `<p style="margin: 5px 0;"><strong>Specialty:</strong> ${Sanitizer.escape(item.system.specialty)}</p>` : '';
        return {
          title: `<h3>${safeName}</h3>`,
          content: `${specialty}${item.system.description}${book}`
        };

      case 'weapon':
        return {
          title: `<h3>${safeName}</h3>`,
          content: `${item.system.description || ''}${book}`
        };

      case 'psychic-power':
        return {
          title: `<h3>${safeName}</h3>`,
          content: `${item.system.description || ''}${book}`
        };

      default:
        return {
          title: `<h3>${safeName}</h3>`,
          content: item.system.description || ''
        };
    }
  }

  static createRollMessage(roll, actor, flavor) {
    return roll.toMessage({
      speaker: ChatMessage.getSpeaker({ actor }),
      flavor,
      rollMode: game.settings.get('core', 'rollMode')
    });
  }

  static createDamageApplyButton(options = {}) {
    const { damage, penetration, location, targetId, damageType = 'Impact',
      isPrimitive = false, isRazorSharp = false, degreesOfSuccess = 0,
      isScatter = false, isLongOrExtremeRange = false, isShocking = false,
      isToxic = false, isMeltaRange = false, charDamageEffect = null,
      forceWeaponData = null, tokenInfo = null, magnitudeBonusDamage = 0,
      ignoresNaturalArmour = false, criticalDamageBonus = 0, weaponQualities = [] } = options;
    // Sanitize string values that go into data attributes
    const safeLocation = Sanitizer.escape(location);
    const safeDamageType = Sanitizer.escape(damageType);
    const charDamageData = charDamageEffect ? ` data-char-damage-formula="${Sanitizer.escape(charDamageEffect.formula)}" data-char-damage-char="${Sanitizer.escape(charDamageEffect.characteristic)}" data-char-damage-name="${Sanitizer.escape(charDamageEffect.name)}"` : '';
    const forceData = forceWeaponData ? ` data-is-force="true" data-force-attacker-id="${Sanitizer.escape(forceWeaponData.attackerId)}" data-force-psy-rating="${forceWeaponData.psyRating}"` : '';
    const tokenData = tokenInfo ? ` data-scene-id="${Sanitizer.escape(tokenInfo.sceneId)}" data-token-id="${Sanitizer.escape(tokenInfo.tokenId)}"` : '';
    const magnitudeData = magnitudeBonusDamage > 0 ? ` data-magnitude-bonus-damage="${magnitudeBonusDamage}"` : '';
    const naturalArmourData = ignoresNaturalArmour ? ` data-ignores-natural-armour="true"` : '';
    const critBonusData = criticalDamageBonus > 0 ? ` data-critical-damage-bonus="${criticalDamageBonus}"` : '';
    const qualitiesData = weaponQualities.length > 0 ? ` data-weapon-qualities='${JSON.stringify(weaponQualities)}'` : '';
    return `<button class="apply-damage-btn" data-damage="${damage}" data-penetration="${penetration}" data-location="${safeLocation}" data-target-id="${targetId}" data-damage-type="${safeDamageType}" data-is-primitive="${isPrimitive}" data-is-razor-sharp="${isRazorSharp}" data-degrees-of-success="${degreesOfSuccess}" data-is-scatter="${isScatter}" data-is-long-or-extreme-range="${isLongOrExtremeRange}" data-is-shocking="${isShocking}" data-is-toxic="${isToxic}" data-is-melta-range="${isMeltaRange}"${charDamageData}${forceData}${tokenData}${magnitudeData}${naturalArmourData}${critBonusData}${qualitiesData}>Apply Damage</button>`;
  }

  static createDamageFlavor(weapon, hitNumber, totalHits, location, degreesOfSuccess, penetration, isMelee, strBonus, applyButton = '') {
    const safeWeapon = Sanitizer.escape(weapon);
    const safeLocation = Sanitizer.escape(location);
    const hitInfo = totalHits > 1 ? ` (${hitNumber}/${totalHits})` : '';
    const dosInfo = hitNumber === 1 && degreesOfSuccess > 0 ? `<br><strong>DoS:</strong> ${degreesOfSuccess}` : '';
    const strInfo = isMelee && strBonus !== 0 && hitNumber === 1 ? `<br><em>Includes STR Bonus: ${strBonus}</em>` : '';
    const applyInfo = applyButton ? `<br>${applyButton}` : '';

    return `<strong style="font-size: 1.1em;">${safeWeapon}${hitInfo}</strong><br><strong>Hit ${hitNumber}:</strong> ${safeLocation}${dosInfo}<br><strong>Penetration:</strong> ${penetration}${strInfo}${applyInfo}`;
  }

  static createVolatileAutoConfirmFlavor() {
    return `<strong style="background: #8b4513; color: gold; padding: 2px 6px; border-radius: 3px;">⚡ RIGHTEOUS FURY CONFIRMATION ⚡</strong><br><em style="color: orange;">Volatile weapon — auto-confirmed!</em>`;
  }

  static createDeathwatchTrainingAutoConfirmFlavor() {
    return `<strong style="background: #8b4513; color: gold; padding: 2px 6px; border-radius: 3px;">⚡ RIGHTEOUS FURY CONFIRMATION ⚡</strong><br><em style="color: #cc7000;">Deathwatch Training — auto-confirmed vs Xenos!</em>`;
  }

  static createRighteousFuryFlavor(targetNumber, confirmed) {
    return `<strong style="background: #8b4513; color: gold; padding: 2px 6px; border-radius: 3px;">⚡ RIGHTEOUS FURY CONFIRMATION ⚡</strong><br>Target: ${targetNumber} - ${confirmed ? '<strong style="color: green;">CONFIRMED!</strong>' : '<strong style="color: red;">Failed</strong>'}`;
  }

  static createRighteousFuryDamageFlavor(furyCount) {
    return `<strong style="background: #8b4513; color: gold; padding: 2px 6px; border-radius: 3px;">⚡ RIGHTEOUS FURY DAMAGE ${furyCount} ⚡</strong>`;
  }

  static createRighteousFurySummary(furyCount, location, totalDamage, applyButton = '') {
    const applyInfo = applyButton ? `<br>${applyButton}` : '';
    return `<strong style="background: #8b4513; color: gold; padding: 2px 6px; border-radius: 3px;">⚡ Righteous Fury x${furyCount} ⚡</strong><br><strong>Location:</strong> ${location}<br><strong>Total Damage: ${totalDamage}</strong>${applyInfo}`;
  }
}
