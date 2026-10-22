import { AnimationHelper } from '../helpers/ui/animation-helper.mjs';
import { Logger } from '../helpers/logger.mjs';

const logger = Logger.category('HOOKS.ANIMATION');

/**
 * Hook handler for ranged weapon animations.
 * Listens to chat message creation and triggers weapon animations when ranged attacks are made.
 */
export class AnimationHook {
  /**
   * Register the animation hook.
   */
  static register() {
    Hooks.on('createChatMessage', this.onCreateChatMessage.bind(this));
    logger.debug('Animation hook registered');
  }

  /**
   * Handle chat message creation to trigger weapon animations.
   *
   * @param {ChatMessage} message - The created chat message
   * @returns {Promise<void>}
   */
  static async onCreateChatMessage(message) {
    // Validate animation libraries available
    if (!AnimationHelper.areAnimationLibrariesAvailable()) {
      return;
    }

    // Parse message content for attack data
    const parser = new DOMParser();
    const doc = parser.parseFromString(message.content, 'text/html');
    const attackDiv = doc.querySelector('.dw-attack-roll');

    if (!attackDiv) {
      return; // Not a ranged attack message
    }

    // Extract metadata
    const actorId = attackDiv.dataset.actorId;
    const itemId = attackDiv.dataset.itemId;
    const roundsFired = parseInt(attackDiv.dataset.roundsFired) || 1;
    const animationKey = attackDiv.dataset.animationKey || '';
    const attackType = attackDiv.dataset.attackType || ''; // 'ranged', 'melee', 'psychic', or 'grenade'
    const sourceTokenId = attackDiv.dataset.sourceTokenId || '';
    const targetTokenId = attackDiv.dataset.targetTokenId || '';

    // Only handle explicit 'ranged' attacks
    // - melee/psychic use Automated Animations directly
    // - grenades use GrenadeHelper animation
    // - missing attackType: no default, exit early (requires explicit type)
    if (attackType !== 'ranged') {
      return;
    }

    // Get source token (prioritize stored token ID, fall back to actor's active tokens)
    let sourceToken;
    if (sourceTokenId) {
      sourceToken = canvas.tokens.get(sourceTokenId);
      if (!sourceToken) {
        logger.debug(`Source token ${sourceTokenId} not found on canvas`);
        return;
      }
    } else {
      // Backward compatibility: use actor's active tokens
      const actor = game.actors.get(actorId);
      if (!actor) {
        return;
      }
      sourceToken = actor.getActiveTokens()[0];
      if (!sourceToken) {
        logger.debug('No source token found for animation');
        return;
      }
    }

    // Get target token (prioritize stored token ID, fall back to current user targets)
    let targetToken;
    if (targetTokenId) {
      targetToken = canvas.tokens.get(targetTokenId);
      if (!targetToken) {
        logger.debug(`Target token ${targetTokenId} not found on canvas`);
        return;
      }
    } else {
      // Backward compatibility: use current user's targets
      targetToken = game.user.targets.first();
      if (!targetToken) {
        logger.debug('No target selected for animation');
        return;
      }
    }

    // Get weapon item
    const actor = game.actors.get(actorId);
    if (!actor) {
      return;
    }

    // Get weapon item
    const weapon = actor.items.get(itemId);
    if (!weapon) {
      return;
    }

    // Classify weapon and get animation config
    const weaponType = AnimationHelper.classifyWeapon(weapon, animationKey);
    const animConfig = AnimationHelper.getAnimationConfig(weaponType);

    // Play animation
    await AnimationHelper.playWeaponAnimation(sourceToken, targetToken, animConfig, roundsFired);

    logger.debug(`Played ${weaponType} ranged animation (${roundsFired} rounds)`);
  }
}
