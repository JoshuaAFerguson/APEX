/**
 * Represents a key combination for a keyboard shortcut.
 */
export interface KeyCombination {
  /** The key pressed. */
  key: string;
  /** Whether the Ctrl key is pressed. */
  ctrl?: boolean;
  /** Whether the Alt key is pressed. */
  alt?: boolean;
  /** Whether the Shift key is pressed. */
  shift?: boolean;
  /** Whether the Meta/Command key is pressed. */
  meta?: boolean;
}

/**
 * Defines a keyboard shortcut with its configuration and behavior.
 */
export interface KeyboardShortcut {
  /** Unique identifier for the shortcut. */
  id: string;
  /** Human-readable description of the shortcut's function. */
  description: string;
  /** The key combination that triggers the shortcut. */
  keys: KeyCombination;
  /** The action to perform when the shortcut is triggered. */
  action: ShortcutAction;
  /** The context in which this shortcut is active. */
  context?: ShortcutContext;
  /** Optional function to dynamically determine if the shortcut is enabled. */
  enabled?: () => boolean;
}

/**
 * Represents the type of action a shortcut can perform.
 */
export type ShortcutAction =
  /** Trigger a command. */
  | { type: 'command'; command: string }
  /** Execute a function handler. */
  | { type: 'function'; handler: () => void | Promise<void> }
  /** Emit an event with an optional payload. */
  | { type: 'emit'; event: string; payload?: unknown };

/**
 * Defines the different contexts where a shortcut can be active.
 */
export type ShortcutContext =
  | 'global'      // Always active
  | 'input'       // Active during text input
  | 'processing'  // Active during task processing
  | 'idle'        // Active when no active task
  | 'suggestions' // Active when suggestions are displayed
  | 'history'     // Active in history navigation
  | 'modal';      // Active when a modal is open

/**
 * Represents a keyboard event for shortcut matching.
 */
export interface ShortcutEvent {
  /** The key pressed. */
  key: string;
  /** Whether the Ctrl key was pressed. */
  ctrl: boolean;
  /** Whether the Alt key was pressed. */
  alt: boolean;
  /** Whether the Shift key was pressed. */
  shift: boolean;
  /** Whether the Meta/Command key was pressed. */
  meta: boolean;
}

/**
 * Manages keyboard shortcuts across different application contexts.
 *
 * This class provides a flexible system for registering, tracking, and executing
 * keyboard shortcuts with support for context-aware activation and various
 * types of actions (function calls, event emissions, command triggers).
 */
export class ShortcutManager {
  /**
   * Internal map storing registered keyboard shortcuts, keyed by their unique ID.
   * @private
   */
  private shortcuts: Map<string, KeyboardShortcut> = new Map();

  /**
   * Stack tracking the current shortcut context, with 'global' as the default bottom context.
   * @private
   */
  private contextStack: ShortcutContext[] = ['global'];

  /**
   * Map of registered event handlers, allowing dynamic event-based shortcut actions.
   * @private
   */
  private eventHandlers: Map<string, Set<(payload?: unknown) => void>> = new Map();

  /**
   * Initializes the ShortcutManager by registering default keyboard shortcuts.
   */
  constructor() {
    this.registerDefaultShortcuts();
  }

  /**
   * Registers a new keyboard shortcut.
   *
   * @param {KeyboardShortcut} shortcut - The keyboard shortcut to register
   */
  register(shortcut: KeyboardShortcut): void {
    this.shortcuts.set(shortcut.id, shortcut);
  }

  /**
   * Removes a registered shortcut by its unique identifier.
   *
   * @param {string} id - The unique ID of the shortcut to unregister
   */
  unregister(id: string): void {
    this.shortcuts.delete(id);
  }

  /**
   * Adds a new context to the context stack, affecting shortcut availability.
   *
   * @param {ShortcutContext} ctx - The context to push onto the stack
   */
  pushContext(ctx: ShortcutContext): void {
    this.contextStack.push(ctx);
  }

  /**
   * Removes and returns the top context from the context stack.
   * Ensures at least the global context remains.
   *
   * @returns {ShortcutContext | undefined} The removed context, or undefined if only global context remains
   */
  popContext(): ShortcutContext | undefined {
    if (this.contextStack.length > 1) {
      return this.contextStack.pop();
    }
    return undefined;
  }

  /**
   * Retrieves the current active shortcut context.
   *
   * @returns {ShortcutContext} The current context, defaulting to 'global'
   */
  getCurrentContext(): ShortcutContext {
    return this.contextStack[this.contextStack.length - 1] || 'global';
  }

  /**
   * Processes a keyboard event and executes the first matching registered shortcut.
   *
   * @param {ShortcutEvent} event - The keyboard event to process
   * @returns {boolean} Whether a matching shortcut was found and executed
   */
  handleKey(event: ShortcutEvent): boolean {
    const currentContext = this.getCurrentContext();

    for (const shortcut of this.shortcuts.values()) {
      // Check if enabled
      if (shortcut.enabled && !shortcut.enabled()) continue;

      // Check context
      if (shortcut.context &&
          shortcut.context !== 'global' &&
          shortcut.context !== currentContext) {
        continue;
      }

      // Check key combination
      if (this.matchesKey(event, shortcut.keys)) {
        this.executeAction(shortcut.action);
        return true;
      }
    }

    return false;
  }

  /**
   * Registers an event handler for a specific event.
   *
   * @param {string} event - The event to listen for
   * @param {Function} handler - The callback function to invoke when the event occurs
   */
  on(event: string, handler: (payload?: unknown) => void): void {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, new Set());
    }
    this.eventHandlers.get(event)!.add(handler);
  }

  /**
   * Removes a specific event handler for an event.
   *
   * @param {string} event - The event to remove the handler from
   * @param {Function} handler - The specific handler to remove
   */
  off(event: string, handler: (payload?: unknown) => void): void {
    this.eventHandlers.get(event)?.delete(handler);
  }

  /**
   * Retrieves all registered keyboard shortcuts.
   *
   * @returns {KeyboardShortcut[]} An array of all registered shortcuts
   */
  getShortcuts(): KeyboardShortcut[] {
    return Array.from(this.shortcuts.values());
  }

  /**
   * Retrieves shortcuts applicable to a specific context.
   *
   * @param {ShortcutContext} ctx - The context to filter shortcuts for
   * @returns {KeyboardShortcut[]} Shortcuts valid in the given context
   */
  getShortcutsForContext(ctx: ShortcutContext): KeyboardShortcut[] {
    return this.getShortcuts().filter(
      s => !s.context || s.context === 'global' || s.context === ctx
    );
  }

  /**
   * Formats a key combination into a human-readable string.
   *
   * @param {KeyCombination} keys - The key combination to format
   * @returns {string} A formatted string representation of the key combination
   * @example
   * // Returns 'Ctrl+Shift+A'
   * formatKey({ key: 'a', ctrl: true, shift: true })
   */
  formatKey(keys: KeyCombination): string {
    const parts: string[] = [];
    if (keys.ctrl) parts.push('Ctrl');
    if (keys.alt) parts.push('Alt');
    if (keys.shift) parts.push('Shift');
    if (keys.meta) parts.push('Cmd');
    parts.push(keys.key.toUpperCase());
    return parts.join('+');
  }

  private matchesKey(event: ShortcutEvent, keys: KeyCombination): boolean {
    if (!event || typeof event.key !== 'string' || event.key.length === 0) {
      return false;
    }

    return (
      event.key.toLowerCase() === keys.key.toLowerCase() &&
      !!event.ctrl === !!keys.ctrl &&
      !!event.alt === !!keys.alt &&
      !!event.shift === !!keys.shift &&
      !!event.meta === !!keys.meta
    );
  }

  private executeAction(action: ShortcutAction): void {
    try {
      switch (action.type) {
        case 'function':
          action.handler();
          break;
        case 'emit':
          this.emit(action.event, action.payload);
          break;
        case 'command':
          this.emit('command', action.command);
          break;
      }
    } catch {
      // Ignore shortcut handler errors to avoid breaking the main loop.
    }
  }

  private emit(event: string, payload?: unknown): void {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      for (const handler of handlers) {
        try {
          handler(payload);
        } catch {
          // Ignore handler errors to keep other listeners running.
        }
      }
    }
  }

  private registerDefaultShortcuts(): void {
    const defaults: KeyboardShortcut[] = [
      {
        id: 'cancel',
        description: 'Cancel current operation',
        keys: { key: 'c', ctrl: true },
        action: { type: 'emit', event: 'cancel' },
        context: 'processing',
      },
      {
        id: 'exit',
        description: 'Exit APEX',
        keys: { key: 'd', ctrl: true },
        action: { type: 'emit', event: 'exit' },
        context: 'global',
      },
      {
        id: 'clear',
        description: 'Clear screen',
        keys: { key: 'l', ctrl: true },
        action: { type: 'emit', event: 'clear' },
        context: 'global',
      },
      {
        id: 'clearLine',
        description: 'Clear current line',
        keys: { key: 'u', ctrl: true },
        action: { type: 'emit', event: 'clearLine' },
        context: 'input',
      },
      {
        id: 'deleteWord',
        description: 'Delete word',
        keys: { key: 'w', ctrl: true },
        action: { type: 'emit', event: 'deleteWord' },
        context: 'input',
      },
      {
        id: 'historySearch',
        description: 'Search history',
        keys: { key: 'r', ctrl: true },
        action: { type: 'emit', event: 'historySearch' },
        context: 'input',
      },
      {
        id: 'previousHistory',
        description: 'Previous history entry',
        keys: { key: 'p', ctrl: true },
        action: { type: 'emit', event: 'historyPrev' },
        context: 'input',
      },
      {
        id: 'nextHistory',
        description: 'Next history entry',
        keys: { key: 'n', ctrl: true },
        action: { type: 'emit', event: 'historyNext' },
        context: 'input',
      },
      {
        id: 'complete',
        description: 'Complete suggestion',
        keys: { key: 'Tab' },
        action: { type: 'emit', event: 'complete' },
        context: 'input',
      },
      {
        id: 'dismiss',
        description: 'Dismiss suggestions/modal',
        keys: { key: 'Escape' },
        action: { type: 'emit', event: 'dismiss' },
        context: 'global',
      },
      {
        id: 'newline',
        description: 'Insert newline (multi-line mode)',
        keys: { key: 'Enter', shift: true },
        action: { type: 'emit', event: 'newline' },
        context: 'input',
      },
      {
        id: 'submit',
        description: 'Submit input',
        keys: { key: 'Enter' },
        action: { type: 'emit', event: 'submit' },
        context: 'input',
      },
      {
        id: 'beginningOfLine',
        description: 'Move to beginning of line',
        keys: { key: 'a', ctrl: true },
        action: { type: 'emit', event: 'moveCursor', payload: 'home' },
        context: 'input',
      },
      {
        id: 'endOfLine',
        description: 'Move to end of line',
        keys: { key: 'e', ctrl: true },
        action: { type: 'emit', event: 'moveCursor', payload: 'end' },
        context: 'input',
      },
      // Session shortcuts
      {
        id: 'quickSave',
        description: 'Quick save session',
        keys: { key: 's', ctrl: true },
        action: { type: 'command', command: '/session save quick-save' },
        context: 'global',
      },
      {
        id: 'sessionInfo',
        description: 'Show session info',
        keys: { key: 'i', ctrl: true, shift: true },
        action: { type: 'command', command: '/session info' },
        context: 'global',
      },
      {
        id: 'sessionList',
        description: 'List sessions',
        keys: { key: 'l', ctrl: true, shift: true },
        action: { type: 'command', command: '/session list' },
        context: 'global',
      },
      // Help
      {
        id: 'help',
        description: 'Show help',
        keys: { key: 'h', ctrl: true },
        action: { type: 'command', command: '/help' },
        context: 'global',
      },
      // Quick commands
      {
        id: 'status',
        description: 'Show status',
        keys: { key: 's', ctrl: true, shift: true },
        action: { type: 'command', command: '/status' },
        context: 'global',
      },
      {
        id: 'agents',
        description: 'List agents',
        keys: { key: 'a', ctrl: true, shift: true },
        action: { type: 'command', command: '/agents' },
        context: 'global',
      },
      {
        id: 'workflows',
        description: 'List workflows',
        keys: { key: 'w', ctrl: true, shift: true },
        action: { type: 'command', command: '/workflows' },
        context: 'global',
      },
      // Toggle thoughts display
      {
        id: 'toggleThoughts',
        description: 'Toggle thoughts display',
        keys: { key: 't', ctrl: true },
        action: { type: 'command', command: '/thoughts' },
        context: 'global',
      },
    ];

    for (const shortcut of defaults) {
      this.register(shortcut);
    }
  }
}
