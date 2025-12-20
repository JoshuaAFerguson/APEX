# ADR-001: Rich Terminal UI Architecture for v0.3.0

## Status
Proposed

## Context
APEX v0.3.0 aims to provide a Claude Code-like interactive CLI experience. The roadmap specifies a comprehensive list of terminal UI features including:
- Streaming response rendering
- Markdown rendering with syntax highlighting
- Persistent status bar
- Tab completion and history navigation
- Multi-agent visualization
- Session management

The current CLI (`@apexcli/cli`) already uses Ink (React for CLI) with several existing components:
- `StatusBar` - Shows git branch, tokens, cost, model, agent, workflow stage
- `InputPrompt` - Command input with history and suggestions
- `ResponseStream` - Markdown and code block rendering with syntax highlighting
- `CodeBlock` - Syntax-highlighted code display
- `TaskProgress` - Task execution status
- `ToolCall` - Tool invocation display
- `ServicesPanel` - API/Web UI status

## Decision

### 1. Enhanced Component Architecture

We will extend the existing Ink-based architecture with the following new components and enhancements:

```
packages/cli/src/ui/
├── components/
│   ├── core/                    # Foundation components
│   │   ├── Box.tsx              # Enhanced layout primitives
│   │   ├── Panel.tsx            # Boxed UI elements with borders
│   │   └── Theme.tsx            # Theme context and provider
│   ├── input/
│   │   ├── InputPrompt.tsx      # (Enhanced) Multi-line support
│   │   ├── Completion.tsx       # Tab completion dropdown
│   │   └── HistorySearch.tsx    # Ctrl+R reverse search
│   ├── output/
│   │   ├── StreamingText.tsx    # Character-by-character streaming
│   │   ├── MarkdownRenderer.tsx # Full markdown support
│   │   ├── DiffView.tsx         # Side-by-side and inline diffs
│   │   └── ResponseStream.tsx   # (Enhanced) Better streaming
│   ├── agents/
│   │   ├── AgentPanel.tsx       # Active agent display
│   │   ├── AgentHandoff.tsx     # Transition animation
│   │   ├── ParallelView.tsx     # Multi-agent execution
│   │   └── SubtaskTree.tsx      # Hierarchical task view
│   ├── status/
│   │   ├── StatusBar.tsx        # (Enhanced) Persistent bottom bar
│   │   ├── TokenCounter.tsx     # Real-time token display
│   │   ├── CostTracker.tsx      # Running cost
│   │   └── SessionTimer.tsx     # Session duration
│   └── session/
│       ├── SessionManager.tsx   # Session persistence UI
│       └── SessionList.tsx      # Named sessions browser
├── hooks/
│   ├── useTheme.ts              # Theme management
│   ├── useHistory.ts            # Command history
│   ├── useCompletion.ts         # Tab completion logic
│   ├── useStreaming.ts          # Streaming text state
│   └── useSession.ts            # Session management
├── context/
│   ├── ThemeContext.tsx         # Theme provider
│   ├── SessionContext.tsx       # Session state
│   └── OrchestratorContext.tsx  # Orchestrator access
└── App.tsx                      # (Enhanced) Main app container
```

### 2. Streaming Response Architecture

```typescript
// Streaming state machine
interface StreamingState {
  mode: 'idle' | 'streaming' | 'complete';
  buffer: string;
  displayedChars: number;
  streamRate: number; // chars per frame
}

// Character-by-character rendering hook
function useStreamingText(content: string, options: StreamingOptions) {
  const [displayed, setDisplayed] = useState('');
  const frameRef = useRef<number>();

  useEffect(() => {
    if (!options.enabled) {
      setDisplayed(content);
      return;
    }

    let charIndex = 0;
    const stream = () => {
      if (charIndex < content.length) {
        const charsPerFrame = options.speed === 'fast' ? 5 : 2;
        charIndex += charsPerFrame;
        setDisplayed(content.slice(0, charIndex));
        frameRef.current = requestAnimationFrame(stream);
      }
    };

    frameRef.current = requestAnimationFrame(stream);
    return () => cancelAnimationFrame(frameRef.current!);
  }, [content, options]);

  return displayed;
}
```

### 3. Theme System

```typescript
interface Theme {
  name: 'dark' | 'light' | string;
  colors: {
    primary: string;
    secondary: string;
    success: string;
    warning: string;
    error: string;
    info: string;
    background: string;
    foreground: string;
    muted: string;
    border: string;
    // Syntax highlighting
    syntax: {
      keyword: string;
      string: string;
      number: string;
      function: string;
      comment: string;
      variable: string;
    };
    // Agent colors
    agents: {
      planner: string;
      architect: string;
      developer: string;
      reviewer: string;
      tester: string;
      devops: string;
    };
  };
}

const darkTheme: Theme = {
  name: 'dark',
  colors: {
    primary: 'cyan',
    secondary: 'blue',
    success: 'green',
    warning: 'yellow',
    error: 'red',
    info: 'blue',
    background: '#1a1a2e',
    foreground: 'white',
    muted: 'gray',
    border: 'gray',
    syntax: { /* ... */ },
    agents: {
      planner: 'magenta',
      architect: 'cyan',
      developer: 'green',
      reviewer: 'yellow',
      tester: 'blue',
      devops: 'red',
    },
  },
};
```

### 4. Input Enhancement Strategy

#### Multi-line Input
```typescript
// Support Shift+Enter or heredoc-style for multi-line
interface MultiLineInputState {
  mode: 'single' | 'multi';
  lines: string[];
  cursorLine: number;
  cursorCol: number;
}

// Detection logic
function detectMultiLineIntent(input: string, key: KeyInput): boolean {
  // Shift+Enter starts multi-line mode
  if (key.shift && key.return) return true;
  // Triple backtick for code blocks
  if (input.includes('```') && !input.match(/```.*```/)) return true;
  // Heredoc style
  if (input.match(/<<\s*\w+/)) return true;
  return false;
}
```

#### Tab Completion Engine
```typescript
interface CompletionProvider {
  type: 'command' | 'path' | 'agent' | 'workflow' | 'task';
  trigger: RegExp;
  getSuggestions: (input: string, context: CompletionContext) => Promise<Suggestion[]>;
}

const completionProviders: CompletionProvider[] = [
  {
    type: 'command',
    trigger: /^\//,
    getSuggestions: (input) => commands.filter(c => c.startsWith(input)),
  },
  {
    type: 'path',
    trigger: /\s(\.\/|\/|\~\/)/,
    getSuggestions: async (input, ctx) => {
      const prefix = input.match(/\s([\w\/\.\~]+)$/)?.[1] || '';
      return glob(prefix + '*', { cwd: ctx.projectPath });
    },
  },
  {
    type: 'agent',
    trigger: /@\w*/,
    getSuggestions: (input, ctx) => {
      const prefix = input.match(/@(\w*)$/)?.[1] || '';
      return Object.keys(ctx.agents).filter(a => a.startsWith(prefix));
    },
  },
  // ... more providers
];
```

### 5. Status Bar Architecture

The status bar will be a persistent element at the terminal bottom:

```typescript
interface StatusBarState {
  // Left section
  connectionStatus: 'connected' | 'disconnected' | 'error';
  gitBranch?: string;
  activeAgent?: string;
  workflowStage?: string;

  // Center section (optional)
  notification?: {
    message: string;
    type: 'info' | 'warning' | 'error';
    timeout?: number;
  };

  // Right section
  tokens: { input: number; output: number };
  cost: number;
  model: string;
  sessionDuration: number; // seconds
}

// Layout: fixed at bottom using Ink's flexbox
<Box flexDirection="column" height={terminalHeight}>
  <Box flexGrow={1}>
    {/* Main content area */}
  </Box>
  <StatusBar {...statusBarState} />
</Box>
```

### 6. Multi-Agent Visualization

```typescript
// Agent execution panel
interface AgentPanelProps {
  agents: AgentState[];
  layout: 'sequential' | 'parallel';
}

interface AgentState {
  name: string;
  status: 'idle' | 'active' | 'completed' | 'failed';
  currentAction?: string;
  progress?: number;
  tokens?: { input: number; output: number };
}

// Visual representation
function AgentPanel({ agents, layout }: AgentPanelProps) {
  if (layout === 'parallel') {
    return (
      <Box flexDirection="row" gap={2}>
        {agents.map(agent => (
          <AgentCard key={agent.name} agent={agent} />
        ))}
      </Box>
    );
  }

  return (
    <Box flexDirection="column">
      {agents.map((agent, i) => (
        <Box key={agent.name}>
          <AgentCard agent={agent} />
          {i < agents.length - 1 && <Text color="gray">│</Text>}
        </Box>
      ))}
    </Box>
  );
}
```

### 7. Session Management

```typescript
interface Session {
  id: string;
  name?: string;
  projectPath: string;
  createdAt: Date;
  updatedAt: Date;
  messages: Message[];
  inputHistory: string[];
  state: SessionState;
}

interface SessionState {
  tokens: { input: number; output: number };
  cost: number;
  tasksCompleted: number;
  activeTaskId?: string;
}

// Session storage location: .apex/sessions/
// Format: JSON with optional compression for large sessions
```

## Consequences

### Positive
- Professional, polished CLI experience matching Claude Code quality
- Reusable component library for terminal UIs
- Improved developer experience with completions and history
- Real-time feedback during long-running operations
- Session persistence enables resumable workflows

### Negative
- Increased complexity in CLI package
- More dependencies (though Ink is already used)
- Terminal compatibility concerns across platforms
- Performance overhead from React reconciliation

### Risks
- Some terminals may not support all visual features
- Character-by-character streaming adds latency perception
- Session files could grow large with long conversations

## Implementation Notes

1. **Phase 1**: Enhance existing components (StatusBar, InputPrompt, ResponseStream)
2. **Phase 2**: Add streaming text and multi-line input
3. **Phase 3**: Implement tab completion engine with providers
4. **Phase 4**: Add agent visualization and diff views
5. **Phase 5**: Implement session management

## Related ADRs
- ADR-002: Natural Language Interface
- ADR-003: Keyboard Shortcuts System
