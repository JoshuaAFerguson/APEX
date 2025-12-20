# ADR-005: v0.3.0 Implementation Architecture - Master Technical Design

## Status
Proposed

## Context
This ADR serves as the master technical design document for APEX v0.3.0, consolidating and expanding upon the previous ADRs (001-004) to provide a complete implementation blueprint. The v0.3.0 release aims to transform APEX into a "Claude Code-like Interactive Experience" with rich terminal UI, natural language interface, session management, and comprehensive keyboard shortcuts.

### Current State Analysis

**Existing Foundation (v0.2.0)**:
- Ink-based React CLI with components: `Banner`, `InputPrompt`, `ResponseStream`, `StatusBar`, `TaskProgress`, `ToolCall`, `ServicesPanel`, `CodeBlock`
- Basic markdown rendering with syntax highlighting (via `ink-syntax-highlight`)
- Command history and suggestion system (basic)
- Orchestrator with multi-agent workflow execution
- WebSocket streaming for real-time updates
- SQLite task persistence

**Gap Analysis**:
| Feature | Current | Target | Gap |
|---------|---------|--------|-----|
| Streaming | Batch output | Character-by-character | High |
| Markdown | Basic parsing | Full CommonMark | Medium |
| Diff view | None | Side-by-side + inline | High |
| Tab completion | Command-only | Files, agents, workflows | Medium |
| History search | Up/down arrows | Ctrl+R reverse search | Medium |
| Multi-line input | None | Shift+Enter, heredoc | Medium |
| Session persistence | None | Full persistence + branching | High |
| Natural language | Basic | Intent classification + clarification | Medium |
| Theme support | Hardcoded colors | Configurable themes | Medium |
| Agent visualization | Basic status | Parallel view + handoff animation | Medium |

## Decision

### 1. Package Structure for v0.3.0

Extend `@apexcli/cli` with a clear module structure:

```
packages/cli/src/
├── index.ts                    # Entry point, CLI setup
├── repl.ts                     # REPL orchestration
├── ui/
│   ├── App.tsx                 # Main app container (enhanced)
│   ├── context/
│   │   ├── ThemeContext.tsx    # Theme provider
│   │   ├── SessionContext.tsx  # Session state
│   │   ├── ShortcutContext.tsx # Keyboard shortcuts
│   │   └── OrchestratorContext.tsx
│   ├── hooks/
│   │   ├── useStreaming.ts     # Character-by-character streaming
│   │   ├── useCompletion.ts    # Tab completion logic
│   │   ├── useHistory.ts       # Command history with search
│   │   ├── useTheme.ts         # Theme management
│   │   ├── useSession.ts       # Session operations
│   │   └── useShortcuts.ts     # Keyboard shortcut handling
│   ├── components/
│   │   ├── core/
│   │   │   ├── Panel.tsx       # Boxed UI element
│   │   │   ├── ScrollArea.tsx  # Scrollable content area
│   │   │   └── Spinner.tsx     # Loading indicators
│   │   ├── input/
│   │   │   ├── InputPrompt.tsx # Enhanced with multi-line
│   │   │   ├── Completion.tsx  # Tab completion dropdown
│   │   │   ├── HistorySearch.tsx # Ctrl+R reverse search
│   │   │   └── MultiLineEditor.tsx
│   │   ├── output/
│   │   │   ├── StreamingText.tsx
│   │   │   ├── MarkdownRenderer.tsx
│   │   │   ├── DiffView.tsx
│   │   │   ├── ResponseStream.tsx # Enhanced
│   │   │   └── CodeBlock.tsx   # Enhanced with line numbers
│   │   ├── status/
│   │   │   ├── StatusBar.tsx   # Enhanced persistent bar
│   │   │   ├── TokenCounter.tsx
│   │   │   ├── CostTracker.tsx
│   │   │   └── SessionTimer.tsx
│   │   ├── agents/
│   │   │   ├── AgentPanel.tsx
│   │   │   ├── AgentHandoff.tsx
│   │   │   ├── ParallelView.tsx
│   │   │   └── SubtaskTree.tsx
│   │   ├── session/
│   │   │   ├── SessionManager.tsx
│   │   │   ├── SessionList.tsx
│   │   │   └── SessionInfo.tsx
│   │   └── index.ts            # Re-exports
│   └── themes/
│       ├── dark.ts
│       ├── light.ts
│       └── index.ts
├── services/
│   ├── IntentClassifier.ts     # Natural language intent detection
│   ├── ConversationManager.ts  # Conversation context tracking
│   ├── CompletionEngine.ts     # Tab completion providers
│   ├── SessionStore.ts         # Session persistence
│   ├── ShortcutManager.ts      # Keyboard shortcuts
│   └── ProjectStateTracker.ts  # Git/project awareness
└── types/
    ├── session.ts
    ├── completion.ts
    ├── shortcuts.ts
    └── theme.ts
```

### 2. Core Data Structures

```typescript
// packages/cli/src/types/theme.ts
export interface Theme {
  name: string;
  colors: {
    primary: string;
    secondary: string;
    success: string;
    warning: string;
    error: string;
    info: string;
    muted: string;
    border: string;
    syntax: SyntaxColors;
    agents: AgentColors;
  };
}

export interface SyntaxColors {
  keyword: string;
  string: string;
  number: string;
  function: string;
  comment: string;
  variable: string;
  operator: string;
  type: string;
}

export interface AgentColors {
  planner: string;
  architect: string;
  developer: string;
  reviewer: string;
  tester: string;
  devops: string;
}

// packages/cli/src/types/session.ts
export interface Session {
  id: string;
  name?: string;
  projectPath: string;
  createdAt: Date;
  updatedAt: Date;
  lastAccessedAt: Date;
  messages: SessionMessage[];
  inputHistory: string[];
  state: SessionState;
  parentSessionId?: string;
  branchPoint?: number;
  childSessionIds?: string[];
  tags?: string[];
}

export interface SessionMessage {
  id: string;
  index: number;
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  timestamp: Date;
  agent?: string;
  stage?: string;
  taskId?: string;
  tokens?: { input: number; output: number };
  toolCalls?: ToolCallRecord[];
  codeBlocks?: CodeBlock[];
}

export interface SessionState {
  totalTokens: { input: number; output: number };
  totalCost: number;
  tasksCreated: string[];
  tasksCompleted: string[];
  currentTaskId?: string;
  lastGitBranch?: string;
}

// packages/cli/src/types/completion.ts
export interface CompletionProvider {
  type: 'command' | 'path' | 'agent' | 'workflow' | 'task' | 'file';
  trigger: RegExp;
  priority: number;
  getSuggestions: (
    input: string,
    cursorPos: number,
    context: CompletionContext
  ) => Promise<CompletionSuggestion[]>;
}

export interface CompletionSuggestion {
  value: string;
  displayValue?: string;
  description?: string;
  type: string;
  score: number;
}

export interface CompletionContext {
  projectPath: string;
  agents: string[];
  workflows: string[];
  recentFiles: string[];
  recentTasks: string[];
}

// packages/cli/src/types/shortcuts.ts
export interface KeyboardShortcut {
  id: string;
  description: string;
  keys: KeyCombination;
  action: ShortcutAction;
  context?: ShortcutContext;
  enabled?: () => boolean;
}

export interface KeyCombination {
  key: string;
  ctrl?: boolean;
  alt?: boolean;
  shift?: boolean;
  meta?: boolean;
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
  | 'history';
```

### 3. Component Implementation Priority

**Phase 1: Foundation (Week 1-2)**
1. **Theme System** - ThemeContext, dark/light themes, color utilities
2. **Enhanced StatusBar** - Persistent bottom bar with all indicators
3. **Streaming Text** - Character-by-character rendering hook and component
4. **Shortcut Manager** - Core shortcut handling infrastructure

**Phase 2: Input Enhancement (Week 3-4)**
5. **Multi-line Input** - Shift+Enter detection, heredoc support
6. **History Search** - Ctrl+R reverse search implementation
7. **Tab Completion Engine** - Provider-based completion system
8. **File Path Completion** - Glob-based file suggestions

**Phase 3: Output Enhancement (Week 5-6)**
9. **Markdown Renderer** - Full CommonMark support with ink
10. **Diff View** - Side-by-side and inline diff display
11. **Enhanced Code Blocks** - Line numbers, copy support, fold/unfold

**Phase 4: Session Management (Week 7-8)**
12. **Session Store** - JSON-based session persistence
13. **Session Commands** - /session list, load, save, branch, export
14. **Auto-save** - Automatic session persistence with recovery

**Phase 5: Natural Language & Agents (Week 9-10)**
15. **Intent Classifier** - Rule-based + heuristic classification
16. **Conversation Manager** - Context tracking, clarification flow
17. **Agent Panel** - Multi-agent visualization
18. **Subtask Tree** - Hierarchical task view

### 4. Streaming Architecture

```typescript
// packages/cli/src/ui/hooks/useStreaming.ts
interface StreamingOptions {
  enabled: boolean;
  speed: 'slow' | 'normal' | 'fast' | 'instant';
  charsPerFrame: number;
}

interface StreamingState {
  displayedContent: string;
  isComplete: boolean;
  isStreaming: boolean;
}

export function useStreaming(
  content: string,
  options: StreamingOptions
): StreamingState {
  const [displayed, setDisplayed] = useState('');
  const [isComplete, setIsComplete] = useState(false);
  const frameRef = useRef<number>(0);
  const charIndexRef = useRef(0);

  const speedToChars: Record<string, number> = {
    slow: 1,
    normal: 3,
    fast: 8,
    instant: Infinity,
  };

  useEffect(() => {
    if (!options.enabled || options.speed === 'instant') {
      setDisplayed(content);
      setIsComplete(true);
      return;
    }

    charIndexRef.current = 0;
    setIsComplete(false);

    const charsPerFrame = options.charsPerFrame || speedToChars[options.speed];

    const animate = () => {
      if (charIndexRef.current < content.length) {
        charIndexRef.current = Math.min(
          charIndexRef.current + charsPerFrame,
          content.length
        );
        setDisplayed(content.slice(0, charIndexRef.current));
        frameRef.current = requestAnimationFrame(animate);
      } else {
        setIsComplete(true);
      }
    };

    frameRef.current = requestAnimationFrame(animate);

    return () => {
      if (frameRef.current) {
        cancelAnimationFrame(frameRef.current);
      }
    };
  }, [content, options.enabled, options.speed, options.charsPerFrame]);

  return {
    displayedContent: displayed,
    isComplete,
    isStreaming: !isComplete && options.enabled,
  };
}
```

### 5. Tab Completion Architecture

```typescript
// packages/cli/src/services/CompletionEngine.ts
export class CompletionEngine {
  private providers: CompletionProvider[] = [];

  constructor() {
    // Register default providers
    this.registerProvider(commandCompletionProvider);
    this.registerProvider(pathCompletionProvider);
    this.registerProvider(agentCompletionProvider);
    this.registerProvider(workflowCompletionProvider);
  }

  registerProvider(provider: CompletionProvider): void {
    this.providers.push(provider);
    this.providers.sort((a, b) => b.priority - a.priority);
  }

  async getCompletions(
    input: string,
    cursorPos: number,
    context: CompletionContext
  ): Promise<CompletionSuggestion[]> {
    const results: CompletionSuggestion[] = [];

    for (const provider of this.providers) {
      if (provider.trigger.test(input)) {
        const suggestions = await provider.getSuggestions(
          input,
          cursorPos,
          context
        );
        results.push(...suggestions);
      }
    }

    // Sort by score and deduplicate
    return results
      .sort((a, b) => b.score - a.score)
      .filter((s, i, arr) => arr.findIndex(x => x.value === s.value) === i)
      .slice(0, 20);
  }
}

// Built-in providers
const commandCompletionProvider: CompletionProvider = {
  type: 'command',
  trigger: /^\//,
  priority: 100,
  async getSuggestions(input) {
    const commands = [
      { name: '/help', desc: 'Show help' },
      { name: '/status', desc: 'Task status' },
      { name: '/agents', desc: 'List agents' },
      { name: '/workflows', desc: 'List workflows' },
      { name: '/config', desc: 'Configuration' },
      { name: '/session', desc: 'Session management' },
      { name: '/logs', desc: 'Task logs' },
      { name: '/cancel', desc: 'Cancel task' },
      { name: '/retry', desc: 'Retry task' },
      { name: '/serve', desc: 'Start API' },
      { name: '/web', desc: 'Start Web UI' },
      { name: '/clear', desc: 'Clear screen' },
      { name: '/exit', desc: 'Exit APEX' },
    ];

    return commands
      .filter(c => c.name.startsWith(input.toLowerCase()))
      .map(c => ({
        value: c.name,
        description: c.desc,
        type: 'command',
        score: c.name === input ? 100 : 80,
      }));
  },
};

const pathCompletionProvider: CompletionProvider = {
  type: 'path',
  trigger: /(\s|^)(\.\/|\/|~\/|\w+\/)/,
  priority: 80,
  async getSuggestions(input, cursorPos, context) {
    const match = input.slice(0, cursorPos).match(/([\w.\/~-]+)$/);
    if (!match) return [];

    const prefix = match[1];
    const dir = path.dirname(prefix);
    const base = path.basename(prefix);

    try {
      const resolvedDir = dir.startsWith('~')
        ? dir.replace('~', os.homedir())
        : path.resolve(context.projectPath, dir);

      const entries = await fs.readdir(resolvedDir, { withFileTypes: true });

      return entries
        .filter(e => e.name.startsWith(base) && !e.name.startsWith('.'))
        .map(e => ({
          value: path.join(dir, e.name) + (e.isDirectory() ? '/' : ''),
          displayValue: e.name + (e.isDirectory() ? '/' : ''),
          type: e.isDirectory() ? 'directory' : 'file',
          score: e.name === base ? 100 : 70,
        }));
    } catch {
      return [];
    }
  },
};

const agentCompletionProvider: CompletionProvider = {
  type: 'agent',
  trigger: /@\w*/,
  priority: 90,
  async getSuggestions(input, cursorPos, context) {
    const match = input.slice(0, cursorPos).match(/@(\w*)$/);
    if (!match) return [];

    const prefix = match[1].toLowerCase();

    return context.agents
      .filter(a => a.toLowerCase().startsWith(prefix))
      .map(a => ({
        value: `@${a}`,
        description: `Agent: ${a}`,
        type: 'agent',
        score: 85,
      }));
  },
};
```

### 6. Session Storage Architecture

```
.apex/
├── sessions/
│   ├── index.json          # Quick lookup index
│   │   {
│   │     "version": 1,
│   │     "sessions": [
│   │       { "id": "...", "name": "...", "messageCount": 42, ... }
│   │     ]
│   │   }
│   ├── active.json         # Current active session reference
│   │   { "projectPath": "/path", "sessionId": "..." }
│   ├── sess_abc123.json    # Individual session files
│   └── archive/
│       └── sess_old.json.gz  # Compressed archived sessions
```

### 7. Intent Classification System

```typescript
// packages/cli/src/services/IntentClassifier.ts
export class IntentClassifier {
  classify(input: string, context: ConversationContext): Intent {
    // Fast path: explicit commands
    if (input.startsWith('/')) {
      return this.parseCommand(input);
    }

    // Fast path: confirmation responses
    if (context.pendingClarification) {
      const confirmation = this.parseConfirmation(input);
      if (confirmation !== null) {
        return { type: 'confirmation', affirmative: confirmation };
      }
    }

    // Task indicators (high confidence)
    const taskPatterns = [
      /^(add|create|implement|build|make|fix|update|refactor|delete|remove)\b/i,
      /^(i want|i need|please|can you|could you)\b/i,
    ];

    for (const pattern of taskPatterns) {
      if (pattern.test(input)) {
        return this.classifyAsTask(input, 0.95);
      }
    }

    // Question indicators
    const questionPatterns = [
      /^(what|how|why|when|where|who|which)\b/i,
      /^(can|could|would|is|are|do|does|did)\b.*\?$/i,
      /\?$/,
    ];

    for (const pattern of questionPatterns) {
      if (pattern.test(input)) {
        return { type: 'question', query: input };
      }
    }

    // Default: task with moderate confidence
    return this.classifyAsTask(input, 0.75);
  }

  private classifyAsTask(input: string, confidence: number): TaskIntent {
    // Detect workflow type
    const workflowHints: Record<string, RegExp[]> = {
      bugfix: [/bug/i, /fix/i, /broken/i, /error/i, /issue/i, /failing/i],
      refactor: [/refactor/i, /clean/i, /restructure/i, /reorganize/i],
      feature: [/add/i, /create/i, /implement/i, /build/i, /new/i],
    };

    let detectedWorkflow: string | undefined;
    for (const [workflow, patterns] of Object.entries(workflowHints)) {
      if (patterns.some(p => p.test(input))) {
        detectedWorkflow = workflow;
        break;
      }
    }

    return {
      type: 'task',
      description: input,
      workflow: detectedWorkflow,
      confidence,
    };
  }

  private parseCommand(input: string): CommandIntent {
    const parts = input.slice(1).split(/\s+/);
    return {
      type: 'command',
      command: parts[0].toLowerCase(),
      args: parts.slice(1),
    };
  }

  private parseConfirmation(input: string): boolean | null {
    const normalized = input.toLowerCase().trim();
    const affirmative = ['yes', 'y', 'yeah', 'yep', 'sure', 'ok', 'okay'];
    const negative = ['no', 'n', 'nope', 'nah', 'cancel', 'abort'];

    if (affirmative.includes(normalized)) return true;
    if (negative.includes(normalized)) return false;
    return null;
  }
}
```

### 8. New CLI Commands for v0.3.0

```typescript
// Session management commands
/session list [--all] [--search <query>]
/session load <id|name>
/session save <name> [--tags <tags>]
/session branch [<name>] [--from <index>]
/session export [--format md|json|html] [--output <file>]
/session delete <id>
/session info

// Enhanced existing commands
/status [taskId] [--verbose] [--follow]
/logs <taskId> [--level <level>] [--follow]
/config [get|set] [--json]

// New utility commands
/theme [dark|light|<name>]
/shortcuts [--list] [--reset]
/compact                    // Toggle compact output mode
/verbose                    // Toggle verbose output mode
```

### 9. Enhanced StatusBar Layout

```
┌─────────────────────────────────────────────────────────────────────────┐
│ ● main │ ⚡developer │ ▶implementation │ api:3000 web:3001 │ 12.5k│$0.42│sonnet │
└─────────────────────────────────────────────────────────────────────────┘
  ^        ^            ^                  ^                   ^     ^      ^
  │        │            │                  │                   │     │      │
  │        │            │                  │                   │     │      └── Model
  │        │            │                  │                   │     └── Cost
  │        │            │                  │                   └── Tokens
  │        │            │                  └── Services (if running)
  │        │            └── Workflow stage
  │        └── Active agent
  └── Git branch + connection status (● connected, ○ disconnected)
```

### 10. Migration Strategy

**Backward Compatibility**:
- Existing commands continue to work unchanged
- Classic mode (`apex --classic`) remains available
- Configuration format unchanged, new options additive

**Data Migration**:
- No data migration needed (sessions are new)
- Existing `.apex/` directory structure preserved

**Feature Flags**:
```typescript
// In .apex/config.yaml
cli:
  theme: dark
  streaming: true
  streamingSpeed: normal  # slow | normal | fast | instant
  sessionPersistence: true
  autoSave: true
  autoSaveInterval: 30000
  shortcuts:
    # Custom shortcut overrides
```

### 11. Testing Strategy

**Unit Tests**:
- IntentClassifier classification accuracy
- CompletionEngine suggestion generation
- SessionStore CRUD operations
- ShortcutManager key matching

**Integration Tests**:
- Full session lifecycle (create, save, load, branch, export)
- Completion provider integration with file system
- Multi-component keyboard shortcut handling

**E2E Tests**:
- REPL startup with session recovery
- Natural language task execution flow
- Session export to markdown

### 12. Performance Considerations

**Memory Management**:
- Limit in-memory messages to 100 (older messages summarized)
- Lazy load session files (index for listing)
- Compress sessions > 1000 messages

**Rendering Optimization**:
- Use React.memo for static components
- Debounce completion suggestions (150ms)
- Throttle streaming updates (16ms for 60fps)

**Startup Time**:
- Lazy load session index
- Parallel initialization of services
- Cache compiled themes

## Consequences

### Positive
- World-class CLI experience matching Claude Code quality
- Session persistence enables long-running workflows
- Natural language reduces learning curve
- Keyboard shortcuts improve power user efficiency
- Theme support improves accessibility

### Negative
- Increased CLI package complexity (~3x code)
- More dependencies for advanced features
- Higher memory usage for sessions
- Potential terminal compatibility issues

### Risks
- Streaming may feel laggy on slow connections
- Session files could grow large
- Cross-platform shortcut inconsistencies
- Intent classification errors may frustrate users

## Implementation Notes

### Phase Timeline
| Phase | Duration | Features |
|-------|----------|----------|
| 1 | 2 weeks | Theme, StatusBar, Streaming, Shortcuts |
| 2 | 2 weeks | Multi-line, History Search, Completion |
| 3 | 2 weeks | Markdown, Diff, Code Blocks |
| 4 | 2 weeks | Session Management |
| 5 | 2 weeks | NL Interface, Agent Visualization |

### Dependencies
- No new major dependencies required
- Existing Ink ecosystem sufficient
- May add `unified` for full markdown if needed

### Breaking Changes
- None planned
- All new features opt-in or non-breaking defaults

## Related ADRs
- ADR-001: Rich Terminal UI Architecture
- ADR-002: Natural Language Interface
- ADR-003: Session Management
- ADR-004: Keyboard Shortcuts System
