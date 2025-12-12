# ADR-004: Keyboard Shortcuts System for v0.3.0

## Status
Proposed

## Context
The v0.3.0 roadmap specifies comprehensive keyboard shortcuts matching Claude Code functionality:
- Ctrl+C - Cancel current operation
- Ctrl+D - Exit REPL
- Ctrl+L - Clear screen
- Ctrl+U - Clear current line
- Ctrl+W - Delete word
- Ctrl+A/E - Beginning/end of line
- Ctrl+P/N - Previous/next history
- Tab - Auto-complete
- Escape - Cancel current input

The current CLI already handles some shortcuts through Ink's `useInput` hook, but lacks a unified shortcut system.

## Decision

### 1. Keyboard Shortcut Architecture

```typescript
// Shortcut definition
interface KeyboardShortcut {
  id: string;
  description: string;
  keys: KeyCombination;
  action: ShortcutAction;
  context?: ShortcutContext;
  enabled?: () => boolean;
}

interface KeyCombination {
  key: string;
  ctrl?: boolean;
  alt?: boolean;
  shift?: boolean;
  meta?: boolean; // Cmd on macOS
}

type ShortcutAction =
  | { type: 'command'; command: string }
  | { type: 'function'; handler: () => void | Promise<void> }
  | { type: 'emit'; event: string; payload?: unknown };

type ShortcutContext =
  | 'global'           // Always available
  | 'input'            // When input is focused
  | 'processing'       // When a task is running
  | 'idle'             // When no task is running
  | 'suggestions'      // When suggestions are visible
  | 'history';         // When browsing history

// Built-in shortcuts
const defaultShortcuts: KeyboardShortcut[] = [
  // Global shortcuts
  {
    id: 'cancel-operation',
    description: 'Cancel current operation',
    keys: { key: 'c', ctrl: true },
    action: { type: 'emit', event: 'cancel' },
    context: 'processing',
  },
  {
    id: 'exit-repl',
    description: 'Exit APEX',
    keys: { key: 'd', ctrl: true },
    action: { type: 'command', command: '/exit' },
    context: 'global',
  },
  {
    id: 'clear-screen',
    description: 'Clear screen',
    keys: { key: 'l', ctrl: true },
    action: { type: 'command', command: '/clear' },
    context: 'global',
  },
  {
    id: 'show-help',
    description: 'Show help',
    keys: { key: '?', shift: true },
    action: { type: 'command', command: '/help' },
    context: 'idle',
  },

  // Input shortcuts
  {
    id: 'clear-line',
    description: 'Clear current line',
    keys: { key: 'u', ctrl: true },
    action: { type: 'emit', event: 'input:clear-line' },
    context: 'input',
  },
  {
    id: 'delete-word',
    description: 'Delete word before cursor',
    keys: { key: 'w', ctrl: true },
    action: { type: 'emit', event: 'input:delete-word' },
    context: 'input',
  },
  {
    id: 'cursor-start',
    description: 'Move cursor to start of line',
    keys: { key: 'a', ctrl: true },
    action: { type: 'emit', event: 'input:cursor-start' },
    context: 'input',
  },
  {
    id: 'cursor-end',
    description: 'Move cursor to end of line',
    keys: { key: 'e', ctrl: true },
    action: { type: 'emit', event: 'input:cursor-end' },
    context: 'input',
  },

  // History shortcuts
  {
    id: 'history-prev',
    description: 'Previous history item',
    keys: { key: 'p', ctrl: true },
    action: { type: 'emit', event: 'history:prev' },
    context: 'input',
  },
  {
    id: 'history-next',
    description: 'Next history item',
    keys: { key: 'n', ctrl: true },
    action: { type: 'emit', event: 'history:next' },
    context: 'input',
  },
  {
    id: 'history-search',
    description: 'Search history (reverse)',
    keys: { key: 'r', ctrl: true },
    action: { type: 'emit', event: 'history:search' },
    context: 'input',
  },

  // Completion shortcuts
  {
    id: 'complete',
    description: 'Auto-complete',
    keys: { key: '\t' }, // Tab
    action: { type: 'emit', event: 'completion:complete' },
    context: 'input',
  },
  {
    id: 'complete-next',
    description: 'Next completion suggestion',
    keys: { key: 'Tab', shift: false },
    action: { type: 'emit', event: 'completion:next' },
    context: 'suggestions',
  },
  {
    id: 'complete-prev',
    description: 'Previous completion suggestion',
    keys: { key: 'Tab', shift: true },
    action: { type: 'emit', event: 'completion:prev' },
    context: 'suggestions',
  },

  // Cancel/escape
  {
    id: 'cancel-input',
    description: 'Cancel current input',
    keys: { key: 'escape' },
    action: { type: 'emit', event: 'input:cancel' },
    context: 'input',
  },
  {
    id: 'dismiss-suggestions',
    description: 'Dismiss suggestions',
    keys: { key: 'escape' },
    action: { type: 'emit', event: 'suggestions:dismiss' },
    context: 'suggestions',
  },
];
```

### 2. Shortcut Manager

```typescript
class ShortcutManager {
  private shortcuts: Map<string, KeyboardShortcut> = new Map();
  private contextStack: ShortcutContext[] = ['global'];
  private eventEmitter: EventEmitter;

  constructor() {
    this.eventEmitter = new EventEmitter();

    // Register default shortcuts
    for (const shortcut of defaultShortcuts) {
      this.register(shortcut);
    }
  }

  register(shortcut: KeyboardShortcut): void {
    this.shortcuts.set(shortcut.id, shortcut);
  }

  unregister(id: string): void {
    this.shortcuts.delete(id);
  }

  pushContext(context: ShortcutContext): void {
    this.contextStack.push(context);
  }

  popContext(): ShortcutContext | undefined {
    if (this.contextStack.length > 1) {
      return this.contextStack.pop();
    }
    return undefined;
  }

  getCurrentContext(): ShortcutContext {
    return this.contextStack[this.contextStack.length - 1];
  }

  handleKeyPress(input: string, key: KeyInput): boolean {
    const currentContext = this.getCurrentContext();

    for (const shortcut of this.shortcuts.values()) {
      // Check context
      if (shortcut.context && shortcut.context !== 'global' && shortcut.context !== currentContext) {
        continue;
      }

      // Check enabled
      if (shortcut.enabled && !shortcut.enabled()) {
        continue;
      }

      // Check key match
      if (!this.matchesKey(shortcut.keys, input, key)) {
        continue;
      }

      // Execute action
      this.executeAction(shortcut.action);
      return true; // Consumed
    }

    return false; // Not consumed
  }

  private matchesKey(combo: KeyCombination, input: string, key: KeyInput): boolean {
    // Handle special keys
    if (combo.key === 'escape' && key.escape) return true;
    if (combo.key === 'Tab' && key.tab) return true;
    if (combo.key === '\t' && key.tab) return true;

    // Handle regular keys
    const keyMatch = input.toLowerCase() === combo.key.toLowerCase() ||
                     (key.return && combo.key === 'return') ||
                     (key.upArrow && combo.key === 'up') ||
                     (key.downArrow && combo.key === 'down') ||
                     (key.leftArrow && combo.key === 'left') ||
                     (key.rightArrow && combo.key === 'right');

    if (!keyMatch) return false;

    // Check modifiers
    if (combo.ctrl !== undefined && combo.ctrl !== key.ctrl) return false;
    if (combo.alt !== undefined && combo.alt !== key.meta) return false;
    if (combo.shift !== undefined && combo.shift !== key.shift) return false;
    if (combo.meta !== undefined && combo.meta !== key.meta) return false;

    return true;
  }

  private executeAction(action: ShortcutAction): void {
    switch (action.type) {
      case 'command':
        this.eventEmitter.emit('execute-command', action.command);
        break;
      case 'function':
        action.handler();
        break;
      case 'emit':
        this.eventEmitter.emit(action.event, action.payload);
        break;
    }
  }

  on(event: string, handler: (...args: unknown[]) => void): void {
    this.eventEmitter.on(event, handler);
  }

  off(event: string, handler: (...args: unknown[]) => void): void {
    this.eventEmitter.off(event, handler);
  }

  // Get all shortcuts for help display
  getAllShortcuts(): KeyboardShortcut[] {
    return Array.from(this.shortcuts.values());
  }

  // Get shortcuts for specific context
  getContextShortcuts(context: ShortcutContext): KeyboardShortcut[] {
    return Array.from(this.shortcuts.values()).filter(
      s => s.context === context || s.context === 'global' || !s.context
    );
  }
}
```

### 3. React Hook for Shortcuts

```typescript
// Custom hook for handling keyboard shortcuts
function useKeyboardShortcuts(manager: ShortcutManager): void {
  useInput((input, key) => {
    manager.handleKeyPress(input, key);
  });
}

// Hook with context management
function useShortcutContext(
  manager: ShortcutManager,
  context: ShortcutContext,
  deps: unknown[] = []
): void {
  useEffect(() => {
    manager.pushContext(context);
    return () => {
      manager.popContext();
    };
  }, deps);
}

// Example usage in InputPrompt component
function InputPrompt({ manager, ...props }: InputPromptProps) {
  const [value, setValue] = useState('');
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [showSuggestions, setShowSuggestions] = useState(false);

  // Set context based on state
  useShortcutContext(
    manager,
    showSuggestions ? 'suggestions' : 'input',
    [showSuggestions]
  );

  // Handle shortcut events
  useEffect(() => {
    const handlers = {
      'input:clear-line': () => setValue(''),
      'input:delete-word': () => {
        const words = value.trimEnd().split(/\s+/);
        words.pop();
        setValue(words.length > 0 ? words.join(' ') + ' ' : '');
      },
      'input:cursor-start': () => {
        // Handled by TextInput
      },
      'input:cursor-end': () => {
        // Handled by TextInput
      },
      'input:cancel': () => {
        setValue('');
        setShowSuggestions(false);
      },
      'history:prev': () => {
        const newIndex = Math.min(historyIndex + 1, props.history.length - 1);
        setHistoryIndex(newIndex);
        setValue(props.history[props.history.length - 1 - newIndex] || '');
      },
      'history:next': () => {
        const newIndex = Math.max(historyIndex - 1, -1);
        setHistoryIndex(newIndex);
        setValue(newIndex === -1 ? '' : props.history[props.history.length - 1 - newIndex] || '');
      },
      'history:search': () => {
        // Open history search modal
        props.onHistorySearch?.();
      },
      'completion:complete': () => {
        if (showSuggestions && props.suggestions.length > 0) {
          setValue(props.suggestions[0]);
          setShowSuggestions(false);
        }
      },
      'suggestions:dismiss': () => {
        setShowSuggestions(false);
      },
    };

    for (const [event, handler] of Object.entries(handlers)) {
      manager.on(event, handler);
    }

    return () => {
      for (const [event, handler] of Object.entries(handlers)) {
        manager.off(event, handler);
      }
    };
  }, [manager, value, historyIndex, showSuggestions, props]);

  // ... rest of component
}
```

### 4. History Search Implementation

```typescript
interface HistorySearchState {
  isActive: boolean;
  query: string;
  results: string[];
  selectedIndex: number;
}

function HistorySearch({
  history,
  onSelect,
  onCancel,
}: {
  history: string[];
  onSelect: (item: string) => void;
  onCancel: () => void;
}) {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);

  const results = useMemo(() => {
    if (!query) return history.slice(-20);
    return history
      .filter(h => h.toLowerCase().includes(query.toLowerCase()))
      .slice(-20);
  }, [history, query]);

  useInput((input, key) => {
    if (key.escape) {
      onCancel();
      return;
    }
    if (key.return && results.length > 0) {
      onSelect(results[results.length - 1 - selectedIndex]);
      return;
    }
    if (key.upArrow) {
      setSelectedIndex(prev => Math.min(prev + 1, results.length - 1));
      return;
    }
    if (key.downArrow) {
      setSelectedIndex(prev => Math.max(prev - 1, 0));
      return;
    }
  });

  return (
    <Box flexDirection="column" borderStyle="round" borderColor="cyan" padding={1}>
      <Box>
        <Text color="cyan">(reverse-i-search): </Text>
        <TextInput value={query} onChange={setQuery} />
      </Box>
      <Box flexDirection="column" marginTop={1}>
        {results.slice().reverse().map((item, index) => (
          <Text
            key={index}
            color={index === selectedIndex ? 'cyan' : 'gray'}
            bold={index === selectedIndex}
          >
            {index === selectedIndex ? '→ ' : '  '}
            {item.slice(0, 60)}
            {item.length > 60 ? '...' : ''}
          </Text>
        ))}
      </Box>
    </Box>
  );
}
```

### 5. Shortcut Help Display

```typescript
function ShortcutHelp({ manager }: { manager: ShortcutManager }) {
  const shortcuts = manager.getAllShortcuts();

  const groupedShortcuts = useMemo(() => {
    const groups: Record<string, KeyboardShortcut[]> = {
      'Global': [],
      'Input': [],
      'Navigation': [],
      'Completion': [],
    };

    for (const shortcut of shortcuts) {
      if (shortcut.context === 'global' || !shortcut.context) {
        groups['Global'].push(shortcut);
      } else if (shortcut.context === 'suggestions') {
        groups['Completion'].push(shortcut);
      } else if (shortcut.id.includes('history')) {
        groups['Navigation'].push(shortcut);
      } else {
        groups['Input'].push(shortcut);
      }
    }

    return groups;
  }, [shortcuts]);

  const formatKey = (combo: KeyCombination): string => {
    const parts: string[] = [];
    if (combo.ctrl) parts.push('Ctrl');
    if (combo.alt) parts.push('Alt');
    if (combo.shift) parts.push('Shift');
    if (combo.meta) parts.push('Cmd');

    let key = combo.key;
    if (key === '\t') key = 'Tab';
    if (key === 'escape') key = 'Esc';
    if (key === 'return') key = 'Enter';

    parts.push(key.toUpperCase());
    return parts.join('+');
  };

  return (
    <Box flexDirection="column" borderStyle="round" borderColor="cyan" padding={2}>
      <Text bold color="cyan">Keyboard Shortcuts</Text>
      {Object.entries(groupedShortcuts).map(([group, items]) =>
        items.length > 0 && (
          <Box key={group} flexDirection="column" marginTop={1}>
            <Text bold color="yellow">{group}</Text>
            {items.map(shortcut => (
              <Box key={shortcut.id}>
                <Text color="green">{formatKey(shortcut.keys).padEnd(15)}</Text>
                <Text color="gray">{shortcut.description}</Text>
              </Box>
            ))}
          </Box>
        )
      )}
    </Box>
  );
}
```

### 6. Customizable Shortcuts

```typescript
// User can customize shortcuts in .apex/config.yaml
interface ShortcutConfig {
  shortcuts?: {
    [id: string]: {
      keys?: KeyCombination;
      enabled?: boolean;
    };
  };
  customShortcuts?: {
    id: string;
    description: string;
    keys: KeyCombination;
    command: string;
  }[];
}

// Loading custom shortcuts
function loadCustomShortcuts(
  manager: ShortcutManager,
  config: ShortcutConfig
): void {
  // Apply overrides
  if (config.shortcuts) {
    for (const [id, override] of Object.entries(config.shortcuts)) {
      const existing = manager.shortcuts.get(id);
      if (existing) {
        if (override.keys) {
          existing.keys = override.keys;
        }
        if (override.enabled !== undefined) {
          existing.enabled = () => override.enabled!;
        }
      }
    }
  }

  // Add custom shortcuts
  if (config.customShortcuts) {
    for (const custom of config.customShortcuts) {
      manager.register({
        id: custom.id,
        description: custom.description,
        keys: custom.keys,
        action: { type: 'command', command: custom.command },
        context: 'global',
      });
    }
  }
}
```

## Consequences

### Positive
- Familiar shortcuts for users coming from other CLI tools
- Faster interaction for power users
- Consistent behavior across all input contexts
- Customizable for individual preferences

### Negative
- Some shortcuts may conflict with terminal emulators
- Learning curve for all available shortcuts
- Platform differences (Ctrl vs Cmd)

### Risks
- Terminal compatibility issues across platforms
- Shortcut conflicts with accessibility tools
- User confusion with context-dependent shortcuts

## Implementation Notes

1. **Phase 1**: Core shortcut manager with default shortcuts
2. **Phase 2**: Input-related shortcuts (clear, cursor movement)
3. **Phase 3**: History navigation and search
4. **Phase 4**: Help display and discoverability
5. **Phase 5**: Custom shortcuts from config

### Platform Considerations
- On macOS, some Ctrl combinations should also work with Cmd
- Windows terminal may intercept certain shortcuts
- SSH connections may have different key codes

## Related ADRs
- ADR-001: Rich Terminal UI Architecture
- ADR-002: Natural Language Interface
- ADR-003: Session Management
