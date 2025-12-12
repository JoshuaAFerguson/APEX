export interface KeyCombination {
  key: string;
  ctrl?: boolean;
  alt?: boolean;
  shift?: boolean;
  meta?: boolean;
}

export interface KeyboardShortcut {
  id: string;
  description: string;
  keys: KeyCombination;
  action: ShortcutAction;
  context?: ShortcutContext;
  enabled?: () => boolean;
}

export type ShortcutAction =
  | { type: 'command'; command: string }
  | { type: 'function'; handler: () => void | Promise<void> }
  | { type: 'emit'; event: string; payload?: unknown };

export type ShortcutContext =
  | 'global'
  | 'input'
  | 'processing'
  | 'idle'
  | 'suggestions'
  | 'history'
  | 'modal';

export interface ShortcutEvent {
  key: string;
  ctrl: boolean;
  alt: boolean;
  shift: boolean;
  meta: boolean;
}

export class ShortcutManager {
  private shortcuts: Map<string, KeyboardShortcut> = new Map();
  private contextStack: ShortcutContext[] = ['global'];
  private eventHandlers: Map<string, Set<(payload?: unknown) => void>> = new Map();

  constructor() {
    this.registerDefaultShortcuts();
  }

  register(shortcut: KeyboardShortcut): void {
    this.shortcuts.set(shortcut.id, shortcut);
  }

  unregister(id: string): void {
    this.shortcuts.delete(id);
  }

  pushContext(ctx: ShortcutContext): void {
    this.contextStack.push(ctx);
  }

  popContext(): ShortcutContext | undefined {
    if (this.contextStack.length > 1) {
      return this.contextStack.pop();
    }
    return undefined;
  }

  getCurrentContext(): ShortcutContext {
    return this.contextStack[this.contextStack.length - 1] || 'global';
  }

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

  on(event: string, handler: (payload?: unknown) => void): void {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, new Set());
    }
    this.eventHandlers.get(event)!.add(handler);
  }

  off(event: string, handler: (payload?: unknown) => void): void {
    this.eventHandlers.get(event)?.delete(handler);
  }

  getShortcuts(): KeyboardShortcut[] {
    return Array.from(this.shortcuts.values());
  }

  getShortcutsForContext(ctx: ShortcutContext): KeyboardShortcut[] {
    return this.getShortcuts().filter(
      s => !s.context || s.context === 'global' || s.context === ctx
    );
  }

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
    return (
      event.key.toLowerCase() === keys.key.toLowerCase() &&
      !!event.ctrl === !!keys.ctrl &&
      !!event.alt === !!keys.alt &&
      !!event.shift === !!keys.shift &&
      !!event.meta === !!keys.meta
    );
  }

  private executeAction(action: ShortcutAction): void {
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
  }

  private emit(event: string, payload?: unknown): void {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      for (const handler of handlers) {
        handler(payload);
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
    ];

    for (const shortcut of defaults) {
      this.register(shortcut);
    }
  }
}