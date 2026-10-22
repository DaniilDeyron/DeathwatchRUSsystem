/**
 * Canvas helper for measuring distances and getting tokens.
 * Wraps Foundry canvas API for testability.
 */
export class CanvasHelper {
  /* istanbul ignore next */
  static measureDistance(token1, token2) {
    return canvas.grid.measurePath([token1.center, token2.center]).distance;
  }
}

/**
 * Foundry API adapter for testability and version migration.
 * All Foundry API calls should go through this adapter to enable:
 * 1. Unit testing without a running Foundry instance
 * 2. Centralized error handling
 * 3. Easy migration when Foundry APIs change
 * 4. Type safety through JSDoc
 */
export class FoundryAdapter {
  // ===== Rolls =====

  /**
   * Evaluate a dice roll formula.
   * @param {string} formula - Dice formula (e.g., "1d100", "2d10+5")
   * @returns {Promise<Roll>} Evaluated Roll object
   */
  /* istanbul ignore next */
  static async evaluateRoll(formula) {
    return await new Roll(formula).evaluate();
  }

  /**
   * Send a roll result to chat.
   * @param {Roll} roll - Evaluated Roll object
   * @param {Object} options - Message options
   * @param {Object} options.speaker - Chat speaker data
   * @param {string} [options.flavor] - Flavor text for the roll
   * @returns {Promise<ChatMessage>}
   */
  /* istanbul ignore next */
  static async sendRollToChat(roll, options) {
    return await roll.toMessage(options);
  }

  // ===== Chat Messages =====

  /**
   * Create a chat message.
   * @param {Object} messageData - Message data object
   * @param {string} messageData.content - HTML content for the message
   * @param {Object} [messageData.speaker] - Chat speaker data
   * @param {string} [messageData.flavor] - Flavor text for the message
   * @param {string} [messageData.type] - Message type (e.g., CHAT_MESSAGE_TYPES.OTHER)
   * @returns {Promise<ChatMessage>}
   */
  /* istanbul ignore next */
  static async createChatMessage(messageData) {
    return await ChatMessage.create(messageData);
  }

  /**
   * Get chat speaker data for an actor.
   * @param {Actor} actor - Actor document
   * @returns {Object} Speaker data object
   */
  /* istanbul ignore next */
  static getChatSpeaker(actor) {
    return ChatMessage.getSpeaker({ actor });
  }

  // ===== Notifications =====

  /**
   * Show a UI notification to the user.
   * @param {string} type - Notification type: "info", "warn", "error"
   * @param {string} message - Notification message
   */
  /* istanbul ignore next */
  static showNotification(type, message) {
    ui.notifications[type](message);
  }

  // ===== Documents =====

  /**
   * Update a document with new data.
   * @param {Document} document - Document to update
   * @param {Object} data - Update data
   * @returns {Promise<Document>} Updated document
   */
  /* istanbul ignore next */
  static async updateDocument(document, data) {
    return await document.update(data);
  }

  /**
   * Create embedded documents (items, effects, etc.) on a parent document.
   * @param {Document} parent - Parent document (Actor, Item, etc.)
   * @param {string} type - Embedded document type (e.g., "Item", "ActiveEffect")
   * @param {Object[]} data - Array of document data objects
   * @returns {Promise<Document[]>} Created documents
   */
  /* istanbul ignore next */
  static async createEmbeddedDocuments(parent, type, data) {
    return await parent.createEmbeddedDocuments(type, data);
  }

  /**
   * Delete embedded documents by ID.
   * @param {Document} parent - Parent document
   * @param {string} type - Embedded document type
   * @param {string[]} ids - Array of document IDs to delete
   * @returns {Promise<Document[]>} Deleted documents
   */
  /* istanbul ignore next */
  static async deleteEmbeddedDocuments(parent, type, ids) {
    return await parent.deleteEmbeddedDocuments(type, ids);
  }

  /**
   * Delete a document.
   * @param {Document} document - Document to delete
   * @returns {Promise<Document>} Deleted document
   */
  /* istanbul ignore next */
  static async deleteDocument(document) {
    return await document.delete();
  }

  // ===== Settings =====

  /**
   * Get a world or client setting value.
   * @param {string} module - Module namespace (e.g., "deathwatch")
   * @param {string} key - Setting key
   * @returns {*} Setting value
   */
  /* istanbul ignore next */
  static getSetting(module, key) {
    return game.settings.get(module, key);
  }

  /**
   * Set a world or client setting value.
   * @param {string} module - Module namespace
   * @param {string} key - Setting key
   * @param {*} value - New value
   * @returns {Promise<*>} Set value
   */
  /* istanbul ignore next */
  static async setSetting(module, key, value) {
    return await game.settings.set(module, key, value);
  }

  /**
   * Register a new setting.
   * @param {string} module - Module namespace
   * @param {string} key - Setting key
   * @param {Object} config - Setting configuration
   * @returns {void}
   */
  /* istanbul ignore next */
  static registerSetting(module, key, config) {
    game.settings.register(module, key, config);
  }

  // ===== Dialogs =====

  /**
   * Show a dialog and wait for user response.
   *
   * Supports both old Dialog API (buttons as object) and new DialogV2 API (buttons as array).
   * Automatically converts old format to new format.
   *
   * @param {Object} config - Dialog configuration
   * @param {string|Object} config.title - Dialog title (or config.window.title for DialogV2)
   * @param {string} config.content - HTML content
   * @param {Object|Array<Object>} config.buttons - Button definitions (object for old API, array for new)
   * @param {string} [config.default] - Default button action
   * @param {Function} [config.render] - Render callback (old API signature: (html) => {})
   * @returns {Promise<*>} Button action result
   */
  /* istanbul ignore next */
  static async showDialog(config) {
    // Convert old Dialog API format to DialogV2 format
    const dialogConfig = { ...config };

    // Handle title (old API uses "title", new uses "window.title")
    if (dialogConfig.title && !dialogConfig.window) {
      dialogConfig.window = { title: dialogConfig.title };
      delete dialogConfig.title;
    }

    // Convert buttons from object format to array format if needed
    if (dialogConfig.buttons && !Array.isArray(dialogConfig.buttons)) {
      dialogConfig.buttons = Object.entries(dialogConfig.buttons).map(([action, button]) => {
        // Convert button callback to DialogV2 signature
        // Old API: callback(html) where html is jQuery object
        // New API: callback(event, button, dialog) where dialog.element is HTMLElement
        let callback = button.callback;
        if (callback && typeof callback === 'function') {
          const oldCallback = callback;
          callback = async (event, btn, dialog) => {
            const $html = $(dialog.element);
            return await oldCallback($html);
          };
        }

        return {
          action,
          icon: button.icon,
          label: button.label,
          callback,
          default: action === dialogConfig.default
        };
      });
      delete dialogConfig.default;
    }

    // Convert render callback to DialogV2 signature
    // Old API: render(html) where html is jQuery object
    // New API: render(event, dialog) where dialog.element is the HTMLElement
    if (dialogConfig.render && typeof dialogConfig.render === 'function') {
      const oldRender = dialogConfig.render;
      dialogConfig.render = (event, dialog) => {
        // Wrap dialog.element in jQuery for compatibility
        const $html = $(dialog.element);
        oldRender($html);
      };
    }

    return await foundry.applications.api.DialogV2.wait(dialogConfig);
  }

  /**
   * Show a confirmation dialog.
   * @param {Object} config - Dialog configuration
   * @param {Object} config.window - Window options (title, etc.)
   * @param {string} config.content - HTML content
   * @returns {Promise<boolean>} True if confirmed, false if cancelled
   */
  /* istanbul ignore next */
  static async showConfirmDialog(config) {
    return await foundry.applications.api.DialogV2.confirm(config);
  }

  /**
   * Show a prompt dialog for text input.
   * @param {Object} config - Dialog configuration
   * @param {Object} config.window - Window options (title, etc.)
   * @param {string} config.content - HTML content
   * @returns {Promise<string|null>} Input value or null if cancelled
   */
  /* istanbul ignore next */
  static async showPromptDialog(config) {
    return await foundry.applications.api.DialogV2.prompt(config);
  }

  // ===== Actors & Items =====

  /**
   * Get an actor by ID.
   * @param {string} id - Actor ID
   * @returns {Actor|undefined} Actor document or undefined
   */
  /* istanbul ignore next */
  static getActor(id) {
    return game.actors.get(id);
  }

  /**
   * Get an item by ID from the world collection.
   * @param {string} id - Item ID
   * @returns {Item|undefined} Item document or undefined
   */
  /* istanbul ignore next */
  static getItem(id) {
    return game.items?.get(id);
  }

  /**
   * Create a new actor.
   * @param {Object} data - Actor data
   * @param {Object} [options] - Creation options
   * @returns {Promise<Actor>} Created actor
   */
  /* istanbul ignore next */
  static async createActor(data, options) {
    return await Actor.create(data, options);
  }

  /**
   * Create a new item.
   * @param {Object} data - Item data
   * @param {Object} [options] - Creation options
   * @returns {Promise<Item>} Created item
   */
  /* istanbul ignore next */
  static async createItem(data, options) {
    return await Item.create(data, options);
  }

  // ===== User =====

  /**
   * Check if current user is a GM.
   * @returns {boolean} True if user is GM
   */
  /* istanbul ignore next */
  static isGM() {
    return game.user.isGM;
  }

  /**
   * Get the current user.
   * @returns {User} Current user document
   */
  /* istanbul ignore next */
  static getUser() {
    return game.user;
  }

  // ===== Socket =====

  /**
   * Register a socket event listener.
   * @param {string} eventName - Event name (e.g., "system.deathwatch")
   * @param {Function} callback - Event handler function
   * @returns {void}
   */
  /* istanbul ignore next */
  static onSocketMessage(eventName, callback) {
    game.socket.on(eventName, callback);
  }

  /**
   * Emit a socket event.
   * @param {string} eventName - Event name
   * @param {*} data - Data to send
   * @returns {void}
   */
  /* istanbul ignore next */
  static emitSocketMessage(eventName, data) {
    game.socket.emit(eventName, data);
  }
}
