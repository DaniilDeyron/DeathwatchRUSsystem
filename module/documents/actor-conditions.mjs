export const ActorConditionsMixin = (superclass) => class extends superclass {

  /**
   * Override Foundry's native toggleStatusEffect to add Deathwatch modifier logic
   * @override
   */
  async toggleStatusEffect(statusId, options = {}) {
    const effect = CONFIG.statusEffects?.find(e => e.id === statusId);
    if (!effect) return super.toggleStatusEffect(statusId, options);

    const hadEffect = this.statuses.has(statusId);

    // Apply overlay flag for DEFEATED status before native creation
    if (!hadEffect && effect.special === "DEFEATED") {
      options = foundry.utils.mergeObject(options, {
        overlay: true
      });
    }

    // Call Foundry's native status effect toggle (creates/deletes ActiveEffect)
    const created = await super.toggleStatusEffect(statusId, options);

    // Apply or remove Deathwatch-specific modifiers
    if (created && typeof created === 'object' && !hadEffect) {
      // Effect was created - apply modifiers
      await this._applyStatusModifiers(statusId, effect);
    } else if (hadEffect) {
      // Effect was removed - remove modifiers
      await this._removeStatusModifiers(statusId);
    }

    return created;
  }

  /**
   * Apply Deathwatch modifier logic for a status effect
   * @param {string} statusId - The status effect ID
   * @param {object} effect - The status effect config
   * @private
   */
  async _applyStatusModifiers(statusId, effect) {
    let modifiersToApply = [];

    if (effect.dynamicModifiers) {
      // Compute dynamic WS/BS reduction to 10 (Paroxysm)
      const ws = this.system.characteristics?.ws?.value || 0;
      const bs = this.system.characteristics?.bs?.value || 0;
      const wsMod = Math.min(0, -(ws - 10));
      const bsMod = Math.min(0, -(bs - 10));
      if (wsMod !== 0) modifiersToApply.push({ name: `${effect.name} (WS)`, modifier: wsMod, effectType: "characteristic", valueAffected: "ws" });
      if (bsMod !== 0) modifiersToApply.push({ name: `${effect.name} (BS)`, modifier: bsMod, effectType: "characteristic", valueAffected: "bs" });
      if (effect.staticModifiers) {
        modifiersToApply.push(...effect.staticModifiers);
      }
    } else if (effect.modifiers?.length > 0) {
      modifiersToApply = [...effect.modifiers];
    }

    if (modifiersToApply.length > 0) {
      const currentModifiers = this.system.modifiers || [];
      const newModifiers = modifiersToApply.map(m => ({
        ...m,
        _statusId: statusId,
        source: effect.name,
        enabled: true
      }));
      await this.update({ 'system.modifiers': [...currentModifiers, ...newModifiers] });
    }
  }

  /**
   * Remove Deathwatch modifiers associated with a status effect
   * @param {string} statusId - The status effect ID
   * @private
   */
  async _removeStatusModifiers(statusId) {
    const currentModifiers = this.system.modifiers || [];
    const filteredModifiers = currentModifiers.filter(m => m._statusId !== statusId);
    if (filteredModifiers.length !== currentModifiers.length) {
      await this.update({ 'system.modifiers': filteredModifiers });
    }
  }

  /**
   * Legacy method for backward compatibility - delegates to toggleStatusEffect
   * @deprecated Use toggleStatusEffect or native hasStatusEffect instead
   */
  hasCondition(conditionId) {
    return this.statuses?.has(conditionId) || this.effects?.some(e => e.statuses?.has(conditionId)) || false;
  }

  /**
   * Legacy method for backward compatibility - delegates to toggleStatusEffect
   * @deprecated Use toggleStatusEffect instead
   */
  async setCondition(conditionId, enabled) {
    const hasEffect = this.statuses?.has(conditionId) || this.effects?.some(e => e.statuses?.has(conditionId)) || false;
    if ((enabled && hasEffect) || (!enabled && !hasEffect)) {
      return enabled; // Already in desired state
    }
    await this.toggleStatusEffect(conditionId);
    return enabled;
  }
};
