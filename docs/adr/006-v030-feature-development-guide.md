# ADR-006: v0.3.0 Feature Development Guide

## Status
Proposed

## Context

This ADR provides detailed development guidance for each v0.3.0 feature, building upon ADR-005's master architecture. It serves as the actionable blueprint for developers implementing the Claude Code-like Interactive Experience features.

### Reference Documents
- ADR-001: Rich Terminal UI Architecture
- ADR-002: Natural Language Interface
- ADR-003: Session Management
- ADR-004: Keyboard Shortcuts System
- ADR-005: Implementation Architecture (Master Design)
- `docs/v030-implementation-plan.md`

---

## Feature Category 1: Rich Terminal UI (`@apex/cli`)

### 1.1 Ink-based UI Framework

**Current State**: Already implemented with basic Ink components in `packages/cli/src/ui/`

**Enhancements Required**:

| Component | Current | Enhancement |
|-----------|---------|-------------|
| `App.tsx` | Basic layout | Add responsive layout, theme context |
| `Banner.tsx` | Static | Add animation on startup |
| `CodeBlock.tsx` | Basic syntax highlighting | Add line numbers, folding, copy |
| `ResponseStream.tsx` | Batch rendering | Character-by-character streaming |
| `StatusBar.tsx` | Basic info | Persistent bottom bar with all indicators |
| `TaskProgress.tsx` | Basic progress | Subtask tree, parallel visualization |

**New Components to Create**:
```
packages/cli/src/ui/components/
├── core/
│   ├── Panel.tsx           # Boxed UI container
│   ├── ScrollArea.tsx      # Scrollable content area
│   └── Responsive.tsx      # Terminal-width aware wrapper
├── output/
│   ├── StreamingText.tsx   # Character streaming component
│   ├── MarkdownRenderer.tsx # Full CommonMark renderer
│   └── DiffView.tsx        # Side-by-side/inline diff
└── session/
    ├── SessionList.tsx     # Session browser
    └── SessionInfo.tsx     # Session details panel
```

**Implementation Priority**: HIGH
**Estimated Effort**: 3-4 days per component

---

### 1.2 Streaming Response Rendering

**Technical Approach**:
```typescript
// packages/cli/src/ui/hooks/useStreaming.ts
export interface StreamingConfig {
  enabled: boolean;
  speed: 'slow' | 'normal' | 'fast' | 'instant';
  charsPerFrame: Record<string, number>; // slow=1, normal=3, fast=8
  skipOnKeyPress: boolean;
}

// Use requestAnimationFrame for 60fps smooth rendering
// Integrate with Ink's render cycle
```

**Integration Points**:
1. `ResponseStream.tsx` - Wrap content with streaming
2. `ToolCall.tsx` - Stream tool output
3. Config option in `.apex/config.yaml`

**Edge Cases**:
- Very long messages (>10k chars) - auto-switch to fast
- Code blocks - show complete or stream by line
- Markdown - stream raw, render on complete

---

### 1.3 Markdown Rendering

**Supported Elements**:
- Headers (H1-H6) with hierarchical colors
- **Bold**, *italic*, ~~strikethrough~~
- `inline code` with background
- Code blocks with syntax highlighting (existing)
- - Bullet lists
- 1. Numbered lists
- > Blockquotes
- --- Horizontal rules
- [Links](url) with clickable indication

**Technical Approach**:
```typescript
// Use simple regex-based parsing (no heavy deps)
// For complex cases, consider marked-terminal or ink-markdown

// packages/cli/src/ui/components/output/MarkdownRenderer.tsx
interface MarkdownProps {
  content: string;
  maxWidth?: number;
  syntax?: boolean; // Enable syntax highlighting in code blocks
}
```

---

### 1.4 Syntax-highlighted Code Blocks

**Current**: Using `ink-syntax-highlight`

**Enhancements**:
```typescript
// packages/cli/src/ui/components/CodeBlock.tsx
interface CodeBlockProps {
  code: string;
  language?: string;
  lineNumbers?: boolean;      // Show line numbers
  highlightLines?: number[];  // Highlight specific lines
  startLine?: number;         // Starting line number
  maxLines?: number;          // Collapse if exceeds
  showCopyHint?: boolean;     // "Press 'c' to copy"
}
```

**Supported Languages** (via Prism/Shiki):
TypeScript, JavaScript, Python, Go, Rust, Java, C++, Shell, YAML, JSON, Markdown, SQL, HTML, CSS

---

### 1.5 Diff Views

**Modes**:
1. **Inline** (default): +/- prefixes with colors
2. **Side-by-side**: Split view with line alignment

```typescript
// packages/cli/src/ui/components/output/DiffView.tsx
interface DiffViewProps {
  diff: string;              // Unified diff format
  mode: 'inline' | 'side-by-side';
  contextLines?: number;     // Lines around changes
  maxHeight?: number;        // Scroll if exceeds
  showLineNumbers?: boolean;
}

// Colors:
// Added: green background or green text
// Removed: red background or red text
// Changed: yellow for context
```

---

### 1.6 Boxed UI Elements

**Panel Component**:
```typescript
// packages/cli/src/ui/components/core/Panel.tsx
interface PanelProps {
  title?: string;
  borderStyle?: 'single' | 'double' | 'round' | 'bold' | 'classic';
  borderColor?: string;
  padding?: number;
  children: React.ReactNode;
  collapsible?: boolean;
  collapsed?: boolean;
}
```

**Usage Examples**:
- Task status cards
- Agent activity panels
- Help overlays
- Session info displays

---

### 1.7 Responsive Layouts

**Terminal Width Detection**:
```typescript
// packages/cli/src/ui/hooks/useTerminalSize.ts
export function useTerminalSize() {
  const [size, setSize] = useState({
    columns: process.stdout.columns || 80,
    rows: process.stdout.rows || 24,
  });

  useEffect(() => {
    const handler = () => {
      setSize({
        columns: process.stdout.columns || 80,
        rows: process.stdout.rows || 24,
      });
    };
    process.stdout.on('resize', handler);
    return () => process.stdout.off('resize', handler);
  }, []);

  return size;
}
```

**Layout Breakpoints**:
- `< 60 cols`: Compact mode (hide secondary info)
- `60-100 cols`: Normal mode
- `> 100 cols`: Wide mode (side panels, expanded info)

---

### 1.8 Theme Support

**Theme Files** (already created):
- `packages/cli/src/ui/themes/dark.ts`
- `packages/cli/src/ui/themes/light.ts`

**Configuration**:
```yaml
# .apex/config.yaml
cli:
  theme: dark  # dark | light | <custom-theme-name>
```

**Theme Interface**:
```typescript
interface Theme {
  name: string;
  colors: {
    primary: string;      // Accent color (cyan for dark)
    secondary: string;    // Secondary accent
    success: string;      // Green
    warning: string;      // Yellow
    error: string;        // Red
    info: string;         // Blue
    muted: string;        // Gray
    border: string;       // Border color
    background?: string;  // For terminals that support it
  };
  syntax: SyntaxColors;   // Code highlighting
  agents: AgentColors;    // Per-agent colors
}
```

---

## Feature Category 2: Status Bar & Information Display

### 2.1 Persistent Status Bar

**Current Implementation**: `packages/cli/src/ui/components/StatusBar.tsx`

**Enhanced Layout**:
```
┌─────────────────────────────────────────────────────────────────────────┐
│ ● main  ⚡developer  ▶impl  [2/5]  api:3000 web:3001  12.5k  $0.42  sonnet│
└─────────────────────────────────────────────────────────────────────────┘
```

**Segments**:
1. **Connection + Branch**: `●` (green) + branch name
2. **Active Agent**: `⚡` + agent name
3. **Workflow Stage**: `▶` + stage name
4. **Subtask Progress**: `[completed/total]`
5. **Services**: `api:port web:port` (if running)
6. **Token Counter**: Input+Output formatted
7. **Cost Tracker**: Running cost
8. **Model Indicator**: Current model
9. **Session Timer**: Duration (optional)

**Sub-components** (already created):
- `TokenCounter.tsx`
- `CostTracker.tsx`
- `SessionTimer.tsx`

---

### 2.2 Token Usage Counter

**Format**:
- `< 1K`: Show raw number (e.g., "847")
- `1K-999K`: Show K format (e.g., "12.5k")
- `> 1M`: Show M format (e.g., "1.2M")

**Display**: `tokens: 12.5k` or split `↑5.2k ↓7.3k`

---

### 2.3 Cost Tracker

**Display Formats**:
- Task cost: `$0.0542`
- Session cost: `$1.23` (cumulative)
- Budget warning: Yellow when >80% of limit, Red when exceeded

---

### 2.4 Model Indicator

**Display**: `model: sonnet` (abbreviated)

**Full Names**:
- `sonnet` → claude-sonnet-4
- `opus` → claude-opus-4.5
- `haiku` → claude-haiku-3.5

---

### 2.5 Session Timer

**Format**: `HH:MM:SS` or `MM:SS` if < 1 hour

**Implementation**: Track `sessionStartTime` in app state, update every second

---

### 2.6 Git Branch Display

**Format**: ` main` (git icon + branch name)

**Implementation**: Execute `git branch --show-current` on startup and after task completion

---

### 2.7 Agent Indicator

**Format**: `⚡developer` with agent-specific color

**Agent Colors** (from theme):
- planner: magenta
- architect: blue
- developer: green
- reviewer: yellow
- tester: cyan
- devops: orange

---

### 2.8 Workflow Stage Display

**Format**: `▶implementation` or `▶stage 3/5`

**Stage Names**: From workflow YAML `stages[].name`

---

## Feature Category 3: Natural Language Interface

### 3.1 Natural Language First

**Flow**:
```
User Input → Intent Classifier → Handler
                 ↓
         ┌──────────────────┐
         │ command → /cmd   │
         │ task → createTask │
         │ question → answer │
         │ confirm → respond │
         └──────────────────┘
```

**Default Behavior**: If input doesn't start with `/`, treat as task description

---

### 3.2 Smart Intent Detection

**IntentClassifier** (from ADR-005):

```typescript
// packages/cli/src/services/IntentClassifier.ts
type IntentType = 'command' | 'task' | 'question' | 'confirmation' | 'clarification';

interface Intent {
  type: IntentType;
  confidence: number;
  // Type-specific fields
}

// Classification Rules:
// 1. Starts with `/` → command (100% confidence)
// 2. Starts with action verb → task (95%)
// 3. Ends with `?` → question (90%)
// 4. In clarification context + short response → clarification
// 5. "yes/no/y/n" in confirmation context → confirmation
// 6. Default → task (75%)
```

---

### 3.3 Conversational Context

**ConversationManager**:
```typescript
// packages/cli/src/services/ConversationManager.ts
interface ConversationContext {
  messages: Message[];
  pendingClarification?: ClarificationRequest;
  lastTaskId?: string;
  lastAgent?: string;
  projectState: ProjectState;
}

// Clarification Flow:
// 1. Ambiguous input detected
// 2. Request clarification from user
// 3. Wait for clarification response
// 4. Incorporate into original intent
```

---

### 3.4 Task Refinement

**Ambiguity Detection**:
- Too vague: "fix it", "update the code"
- Missing context: "add a button" (where?)
- Multiple interpretations: "improve performance"

**Clarification Prompts**:
```
Your request is a bit ambiguous. Could you clarify:
1. Which component should the button be added to?
2. What should the button do when clicked?

Or type the full description again.
```

---

### 3.5 Suggested Actions

**SuggestionEngine** triggers:
- Git uncommitted changes → "Review and commit changes?"
- Recent failed task → "Retry task X?"
- End of successful task → "Create PR?"
- Long idle time → "Continue with task Y?"

**Display**: Show 1-3 suggestions below prompt
```
💡 Suggestions:
  1. Create PR for task abc123
  2. Run tests
  [1/2/Enter to dismiss]
```

---

## Feature Category 4: Input Experience

### 4.1 Tab Completion

**CompletionEngine Architecture**:
```typescript
// packages/cli/src/services/CompletionEngine.ts
interface CompletionProvider {
  type: string;
  trigger: RegExp;
  priority: number;
  getSuggestions(input: string, cursor: number, ctx: Context): Suggestion[];
}

// Built-in Providers:
// 1. CommandProvider - /commands
// 2. PathProvider - file/directory paths
// 3. AgentProvider - @agent mentions
// 4. WorkflowProvider - --workflow names
// 5. TaskProvider - task IDs
```

**Completion UI**:
```typescript
// packages/cli/src/ui/components/input/Completion.tsx
// Dropdown overlay showing 5-10 suggestions
// Tab cycles, Enter selects, Escape dismisses
```

---

### 4.2 History Navigation

**Current**: Basic up/down with `inputHistory` in state

**Enhancements**:
- Persist history to `~/.apex/history` (max 1000 entries)
- Prefix-filtered search (type, then up/down)
- Timestamps for recent command ordering

---

### 4.3 History Search (Ctrl+R)

**HistorySearch Component**:
```typescript
// packages/cli/src/ui/components/input/HistorySearch.tsx
// Modal overlay with:
// - Search input
// - Filtered results list
// - Match highlighting
// - Up/down navigation
// - Enter to select
// - Escape to cancel
```

---

### 4.4 Multi-line Input

**Triggers**:
1. `Shift+Enter` - Add newline
2. Unclosed ``` - Continue until closed
3. `<<EOF` - Heredoc style until EOF

**Visual Indicator**:
```
apex> Add a new component
...   that handles user auth
...   with email/password
```

---

### 4.5 Inline Editing

**Readline-like Shortcuts**:
- `Ctrl+A` - Beginning of line
- `Ctrl+E` - End of line
- `Ctrl+W` - Delete word backward
- `Ctrl+U` - Clear line
- `Ctrl+K` - Kill to end of line

---

### 4.6 Input Preview

**For Commands**: Show command description
```
apex> /status
      ^ Show task status [taskId]
```

**For Tasks**: Show detected intent
```
apex> add login form
      ^ Task: feature workflow, developer agent
```

---

## Feature Category 5: Output & Feedback

### 5.1 Streaming Output

See Section 1.2

---

### 5.2 Progress Indicators

**Spinner Types**:
- Default: `⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏` (dots)
- Agent: `◐◓◑◒` (pie)
- Stage: `▏▎▍▌▋▊▉█` (bar)

**Progress Bar** (for known-length operations):
```
Building... [████████░░░░░░░░] 52% (26/50 files)
```

---

### 5.3 Activity Log

**Collapsible Log Panel**:
```typescript
// packages/cli/src/ui/components/ActivityLog.tsx
// Shows last N actions with timestamps
// Expandable for full details
// Filter by level (debug/info/warn/error)
```

---

### 5.4 Error Formatting

**Error Display**:
```
❌ Error: Failed to create file

   Location: src/components/Button.tsx
   Reason: EACCES permission denied

   💡 Try: Check file permissions or run with sudo
```

---

### 5.5 Success Celebration

**On Task Completion**:
```
✅ Task completed successfully!

   Duration: 2m 34s
   Tokens: 12,543 ($0.38)
   Files: 3 created, 2 modified

   Next: /pr to create pull request
```

---

### 5.6 Compact Mode

**Toggle**: `/compact` or config `cli.compact: true`

**Changes**:
- Single-line tool calls
- Abbreviated agent names
- No borders on panels
- Minimal status bar

---

### 5.7 Verbose Mode

**Toggle**: `/verbose` or `--verbose` flag

**Changes**:
- Full tool inputs/outputs
- Debug-level logs
- Token breakdown per message
- Timing information

---

## Feature Category 6: Keyboard Shortcuts

### 6.1 Core Shortcuts

| Shortcut | Action | Context |
|----------|--------|---------|
| `Ctrl+C` | Cancel current operation | processing |
| `Ctrl+D` | Exit APEX | global |
| `Ctrl+L` | Clear screen | global |
| `Ctrl+U` | Clear input line | input |
| `Ctrl+W` | Delete word | input |
| `Ctrl+A` | Go to line start | input |
| `Ctrl+E` | Go to line end | input |
| `Ctrl+R` | History search | input |
| `Tab` | Auto-complete | input |
| `Escape` | Cancel/dismiss | any modal |
| `Up/Down` | Navigate history | input |

---

### 6.2 ShortcutManager Implementation

```typescript
// packages/cli/src/services/ShortcutManager.ts
class ShortcutManager {
  private shortcuts: Map<string, KeyboardShortcut>;
  private contextStack: ShortcutContext[];

  register(shortcut: KeyboardShortcut): void;
  unregister(id: string): void;
  pushContext(ctx: ShortcutContext): void;
  popContext(): void;
  handleKey(key: string, modifiers: Modifiers): boolean;
}
```

---

## Feature Category 7: Multi-Agent Visualization

### 7.1 Agent Activity Panel

```
┌─ Active Agents ──────────────────┐
│ ⚡ developer (implementation)    │
│ ○ tester (waiting)               │
│ ○ reviewer (waiting)             │
└──────────────────────────────────┘
```

---

### 7.2 Agent Handoff Animation

**Visual Transition**:
```
planner ──→ architect ──→ developer
   ✓           ●            ○
```

---

### 7.3 Parallel Execution View

```
┌─ Parallel Execution ─────────────┐
│ [████████░░] developer (80%)     │
│ [██████░░░░] tester (60%)        │
└──────────────────────────────────┘
```

---

### 7.4 Subtask Tree

```
Task: Implement authentication
├── [✓] Plan implementation
├── [●] Create user model
│   ├── [✓] Define schema
│   └── [●] Add validation
├── [○] Create auth service
└── [○] Add login endpoint
```

---

### 7.5 Workflow Progress

```
planning → architecture → implementation → testing → review
   ✓           ✓              ●              ○         ○
```

---

### 7.6 Agent Thought Display

**Collapsible reasoning panel**:
```
💭 Developer thinking...
├─ Analyzing existing code patterns
├─ Identified similar component: UserForm
└─ Planning to extend base form component
[Show more / Hide]
```

---

## Feature Category 8: Session Management

### 8.1 Session Persistence

**Storage Location**: `.apex/sessions/`

**Session File Format**:
```json
{
  "id": "sess_abc123",
  "name": "Feature: Auth implementation",
  "projectPath": "/path/to/project",
  "createdAt": "2025-01-15T10:00:00Z",
  "updatedAt": "2025-01-15T12:30:00Z",
  "messages": [...],
  "state": {
    "totalTokens": { "input": 5000, "output": 7000 },
    "totalCost": 0.42,
    "tasksCreated": ["task_xyz"],
    "currentTaskId": null
  }
}
```

---

### 8.2 Session Export

**Formats**:
- Markdown: Clean conversation transcript
- JSON: Full session data
- HTML: Styled readable format

**Command**: `/session export --format md --output ./session.md`

---

### 8.3 Session Branching

**Create branch from point in conversation**:
```
/session branch "experiment" --from 15
```

Creates new session starting from message 15, preserving parent reference.

---

### 8.4 Named Sessions

```
/session save "auth-feature"
/session load "auth-feature"
/session list --search "auth"
```

---

### 8.5 Session Search

**Search across sessions**:
```
/session list --search "login form"
```

Searches:
- Session names
- Message content
- Task descriptions
- Tags

---

## Implementation Phases

### Phase 1: Foundation (Week 1-2)
- [ ] Theme system complete
- [ ] Enhanced StatusBar
- [ ] Streaming text hook
- [ ] ShortcutManager infrastructure

### Phase 2: Input Enhancement (Week 3-4)
- [ ] Multi-line input
- [ ] History search (Ctrl+R)
- [ ] Tab completion engine
- [ ] All completion providers

### Phase 3: Output Enhancement (Week 5-6)
- [ ] Full markdown renderer
- [ ] Diff view component
- [ ] Enhanced code blocks
- [ ] Activity log

### Phase 4: Session Management (Week 7-8)
- [ ] SessionStore implementation
- [ ] All session commands
- [ ] Auto-save and recovery
- [ ] Session UI components

### Phase 5: Natural Language & Agents (Week 9-10)
- [ ] IntentClassifier
- [ ] ConversationManager
- [ ] Agent visualization components
- [ ] SuggestionEngine

---

## Testing Requirements

### Unit Tests (90%+ coverage for services)
- IntentClassifier: 100+ test cases
- CompletionEngine: All providers
- SessionStore: CRUD operations
- ShortcutManager: Key matching

### Integration Tests
- Full session lifecycle
- Completion with file system
- Multi-component shortcuts

### E2E Tests
- REPL startup with recovery
- Natural language task execution
- Session save/load/export

---

## Configuration Schema Extension

```yaml
# .apex/config.yaml additions for v0.3.0
cli:
  theme: dark                    # dark | light | custom
  streaming:
    enabled: true
    speed: normal                # slow | normal | fast | instant
  session:
    persistence: true
    autoSave: true
    autoSaveInterval: 30000      # ms
    maxMessages: 1000            # per session
  completion:
    enabled: true
    debounceMs: 150
    maxSuggestions: 10
  shortcuts:
    # Override default shortcuts
    # cancel: { key: 'c', ctrl: true }
  display:
    compact: false
    verbose: false
    showThinking: true           # Show agent reasoning
```

---

## Related Documentation
- ADR-001 through ADR-005: Architecture foundations
- `docs/v030-implementation-plan.md`: Task breakdown
- `ROADMAP.md`: Feature overview

## Decision

Implement v0.3.0 features in the five phases outlined above, following the component architecture defined in ADR-005 and the detailed specifications in this document.

## Consequences

### Positive
- Comprehensive development guide for all features
- Clear dependencies and integration points
- Testable implementation specifications
- Phased delivery reduces risk

### Negative
- Large scope (10 weeks estimated)
- Complex feature interactions
- Testing overhead significant

### Mitigations
- Continuous integration testing
- Feature flags for gradual rollout
- Documentation alongside implementation
