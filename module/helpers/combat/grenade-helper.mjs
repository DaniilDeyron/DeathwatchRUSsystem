import { CanvasTargeting } from '../ui/canvas-targeting.mjs';
import { RangedCombatHelper } from './ranged-combat.mjs';
import { AnimationHelper } from '../ui/animation-helper.mjs';

/**
 * Orchestrator for the grenade throw flow.
 * Coordinates: canvas targeting → attack roll → scatter → animation → Region creation.
 */
export class GrenadeHelper {
  static _mocks = null;

  /**
   * Internal: Inject mocks for testing.
   * @param {Object|null} mocks - Mock implementations or null to clear
   * @private
   */
  static _setMocks(mocks) {
    this._mocks = mocks;
  }

  /**
   * Get dependency (use mock if available, otherwise use real implementation).
   * @param {string} name - Dependency name
   * @returns {Object} Dependency object
   * @private
   */
  static _get(name) {
    if (this._mocks) return this._mocks[name];
    switch (name) {
      case 'CanvasTargeting': return CanvasTargeting;
      case 'RangedCombatHelper': return RangedCombatHelper;
      case 'AnimationHelper': return AnimationHelper;
      default: throw new Error(`Unknown dependency: ${name}`);
    }
  }

  /**
   * Execute a grenade throw: targeting → attack → scatter → animation → Region.
   * @param {Actor} actor - Throwing actor
   * @param {Item} weapon - Grenade weapon item
   * @returns {Promise<void>}
   */
  static async executeGrenadeThrow(actor, weapon) {
    const token = actor.getActiveTokens()[0];
    if (!token) {
      ui.notifications.warn('You must have a token on the scene to throw a grenade.');
      return;
    }

    const Targeting = this._get('CanvasTargeting');
    const targetLocation = await Targeting.selectLocation({
      prompt: `Click canvas to throw ${weapon.name}`
    });
    if (!targetLocation) return;

    const RCH = this._get('RangedCombatHelper');
    const result = await RCH.attackDialog(actor, weapon, { targetLocation });
    if (!result) return;

    let finalLocation = { ...targetLocation };

    if (result.hitsTotal === 0) {
      const scatter = await RCH.rollScatter(actor, weapon);
      if (scatter) {
        const offset = RCH.scatterToPixelOffset(scatter.direction, scatter.distance, {
          gridDistance: canvas.grid.distance || 3,
          gridSize: canvas.grid.size || 100
        });
        finalLocation = {
          x: targetLocation.x + offset.dx,
          y: targetLocation.y + offset.dy
        };
      }
    }

    const Anim = this._get('AnimationHelper');
    if (Anim.areAnimationLibrariesAvailable()) {
      await Anim.playGrenadeAnimation(token, finalLocation, weapon);
    }

    await this._createBlastRegion(finalLocation, weapon);
  }

  /**
   * Create blast Region at impact location if weapon has blast quality.
   * @param {{x: number, y: number}} location - Impact coordinates
   * @param {Object} weapon - Weapon item
   * @returns {Promise<void>}
   * @private
   */
  static async _createBlastRegion(location, weapon) {
    const blastQuality = weapon.system.attachedQualities?.find(q => q.id === 'blast');
    if (!blastQuality) return;

    const radiusMeters = parseInt(blastQuality.value);
    const radiusPixels = (radiusMeters / (canvas.grid.distance || 3)) * (canvas.grid.size || 100);

    const regionData = {
      name: `${weapon.name} Blast`,
      shapes: [{
        type: 'circle',
        x: location.x,
        y: location.y,
        radius: radiusPixels
      }],
      color: '#FFAA00',
      elevation: { bottom: 0, top: 5 },
      visibility: 2,
      locked: false,
      ownership: {
        default: 0,
        [game.user.id]: 3
      },
      flags: {
        deathwatch: {
          isAttackTemplate: true,
          createdByTurn: game.combat?.current?.turn,
          createdInRound: game.combat?.current?.round,
          weaponType: weapon.system.key || 'grenade'
        }
      }
    };

    await canvas.scene.createEmbeddedDocuments('Region', [regionData]);
    ui.notifications.info(`${weapon.name} blast template placed — GM determines affected tokens.`);
  }
}
