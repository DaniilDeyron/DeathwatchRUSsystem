export class CanvasTargeting {
  /**
   * Prompt the user to click a canvas location.
   * Uses a fullscreen overlay to intercept clicks before Foundry's token/canvas layers.
   * @param {Object} [options={}] - Configuration options
   * @param {string} [options.prompt] - Notification message shown to user
   * @returns {Promise<{x: number, y: number}|null>} Pixel coordinates or null if cancelled
   */
  static selectLocation(options = {}) {
    return new Promise((resolve) => {
      const prompt = options.prompt || 'Click canvas to select target location';
      ui.notifications.info(prompt);

      const overlay = document.createElement('div');
      overlay.id = 'dw-canvas-targeting-overlay';
      overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;z-index:69;cursor:crosshair;';
      document.body.appendChild(overlay);

      const cleanup = () => {
        overlay.remove();
        document.removeEventListener('keydown', escHandler);
      };

      const clickHandler = (event) => {
        if (event.button === 0) {
          const point = canvas.canvasCoordinatesFromClient({ x: event.clientX, y: event.clientY });
          cleanup();
          resolve({ x: point.x, y: point.y });
        } else if (event.button === 2) {
          event.preventDefault();
          cleanup();
          resolve(null);
        }
      };

      const escHandler = (event) => {
        if (event.key === 'Escape') {
          cleanup();
          resolve(null);
        }
      };

      overlay.addEventListener('pointerdown', clickHandler);
      overlay.addEventListener('contextmenu', (e) => e.preventDefault());
      document.addEventListener('keydown', escHandler);
    });
  }
}
