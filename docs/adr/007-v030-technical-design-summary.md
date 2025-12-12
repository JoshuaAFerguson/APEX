# ADR-007: v0.3.0 Technical Design Summary

## Status
Proposed

## Overview

This document consolidates the complete technical design for APEX v0.3.0 "Claude Code-like Interactive Experience". It provides the technical blueprint for developers and serves as the output of the architecture stage.

---

## 1. Architecture Overview

### 1.1 Package Structure

```
packages/
├── core/           # No v0.3.0 changes - types and config
├── orchestrator/   # Minor enhancements for agent events
├── cli/            # MAJOR v0.3.0 enhancements
│   └── src/
│       ├── index.ts          # Entry point
│       ├── repl.tsx          # REPL orchestration
│       ├── ui/               # React/Ink components
│       │   ├── App.tsx       # Main container
│       │   ├── context/      # React contexts
│       │   ├── hooks/        # Custom hooks
│       │   ├── components/   # UI components
│       │   └── themes/       # Theme definitions
│       ├── services/         # Business logic
│       └── types/            # TypeScript types
└── api/            # No v0.3.0 changes
```

### 1.2 Component Architecture

```
                    ┌──────────────────────────┐
                    │         App.tsx          │
                    │  (Main Container)        │
                    └──────────┬───────────────┘
                               │
         ┌─────────────────────┼─────────────────────┐
         │                     │                     │
    ┌────▼────┐          ┌────▼────┐          ┌────▼────┐
    │ Banner  │          │ Content │          │ Status  │
    │ Header  │          │  Area   │          │   Bar   │
    └─────────┘          └────┬────┘          └─────────┘
                              │
         ┌────────────────────┼────────────────────┐
         │                    │                    │
    ┌────▼─────┐       ┌─────▼─────┐       ┌─────▼─────┐
    │ Response │       │   Agent   │       │  Session  │
    │  Stream  │       │   Panel   │       │   Info    │
    └──────────┘       └───────────┘       └───────────┘
```

### 1.3 Data Flow

```
User Input
    │
    ▼
┌────────────────┐     ┌──────────────────┐
│ IntentClassifier│────▶│ Command Handler  │
└───────┬────────┘     └──────────────────┘
        │
        │ (task intent)
        ▼
┌────────────────┐     ┌──────────────────┐
│ Conversation   │────▶│  Orchestrator    │
│   Manager      │     │  (execute task)  │
└───────┬────────┘     └────────┬─────────┘
        │                       │
        ▼                       ▼
┌────────────────┐     ┌──────────────────┐
│ Session Store  │     │ Agent Events     │
│ (persistence)  │     │ (streaming)      │
└────────────────┘     └──────────────────┘
```

---

## 2. Core Components Design

### 2.1 Streaming Text System

**Hook**: `useStreaming.ts`
```typescript
interface StreamingState {
  displayedContent: string;
  isComplete: boolean;
  isStreaming: boolean;
  skip: () => void;
}

function useStreaming(content: string, options: StreamingOptions): StreamingState
```

**Performance**: 60fps via requestAnimationFrame, ~3 chars/frame for normal speed

### 2.2 Tab Completion Engine

**Service**: `CompletionEngine.ts`
```typescript
class CompletionEngine {
  registerProvider(provider: CompletionProvider): void;
  getCompletions(input: string, cursor: number, ctx: Context): Suggestion[];
}
```

**Providers**:
1. Commands (`/help`, `/status`)
2. File paths (`./src/`, `~/`)
3. Agents (`@planner`, `@developer`)
4. Workflows (`--workflow feature`)
5. Task IDs (recent tasks)

### 2.3 Session Management

**Service**: `SessionStore.ts`
```typescript
class SessionStore {
  createSession(name?: string): Session;
  getSession(id: string): Session | null;
  updateSession(id: string, updates: Partial<Session>): void;
  listSessions(query?: SearchQuery): SessionSummary[];
  exportSession(id: string, format: ExportFormat): string;
  branchSession(id: string, fromIndex: number, name?: string): Session;
}
```

**Storage**: JSON files in `.apex/sessions/`

### 2.4 Intent Classification

**Service**: `IntentClassifier.ts`
```typescript
class IntentClassifier {
  classify(input: string, context: ConversationContext): Intent;
}

type Intent =
  | { type: 'command'; command: string; args: string[] }
  | { type: 'task'; description: string; workflow?: string; confidence: number }
  | { type: 'question'; query: string }
  | { type: 'confirmation'; affirmative: boolean }
  | { type: 'clarification'; response: string };
```

**Classification Rules**:
- `/` prefix → command (100%)
- Action verbs (add, create, fix) → task (95%)
- Question marks → question (90%)
- Default → task (75%)

### 2.5 Keyboard Shortcuts

**Service**: `ShortcutManager.ts`
```typescript
class ShortcutManager {
  register(shortcut: KeyboardShortcut): void;
  unregister(id: string): void;
  pushContext(ctx: ShortcutContext): void;
  popContext(): void;
  handleKey(key: string, modifiers: Modifiers): boolean;
}
```

**Default Shortcuts**:
| Shortcut | Action | Context |
|----------|--------|---------|
| Ctrl+C | Cancel | processing |
| Ctrl+D | Exit | global |
| Ctrl+L | Clear | global |
| Ctrl+R | History search | input |
| Tab | Complete | input |
| Escape | Dismiss | modal |

---

## 3. UI Components Design

### 3.1 StatusBar (Enhanced)

**Layout**:
```
┌───────────────────────────────────────────────────────────────────────┐
│ ● main │ ⚡developer │ ▶impl │ [2/5] │ api:3000 │ 12.5k │ $0.42 │ sonnet│
└───────────────────────────────────────────────────────────────────────┘
```

**Segments**:
1. Git branch + status
2. Active agent
3. Workflow stage
4. Subtask progress
5. Services (API/Web)
6. Token count
7. Cost
8. Model

### 3.2 Markdown Renderer

**Supported Elements**:
- Headers (H1-H6)
- Bold, italic, strikethrough
- Inline code, code blocks
- Lists (bullet, numbered)
- Blockquotes
- Links
- Horizontal rules

### 3.3 Diff View

**Modes**:
- Inline: `+/-` prefixes with colors
- Side-by-side: Split columns

**Colors**:
- Added: Green
- Removed: Red
- Context: Gray

### 3.4 Agent Panel

```
┌─ Active Agents ──────────────────┐
│ ⚡ developer (implementation)    │
│ ○ tester (waiting)               │
│ ○ reviewer (waiting)             │
└──────────────────────────────────┘
```

### 3.5 Subtask Tree

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

## 4. New CLI Commands

### 4.1 Session Commands
```bash
/session list [--all] [--search <query>]
/session load <id|name>
/session save <name> [--tags <tags>]
/session branch [<name>] [--from <index>]
/session export [--format md|json|html] [--output <file>]
/session delete <id>
/session info
```

### 4.2 UI Commands
```bash
/theme [dark|light|<name>]
/shortcuts [--list] [--reset]
/compact       # Toggle compact mode
/verbose       # Toggle verbose mode
```

### 4.3 Enhanced Existing
```bash
/status [taskId] [--verbose] [--follow]
/logs <taskId> [--level <level>] [--follow]
/config [get|set] [--json]
```

---

## 5. Configuration Schema

```yaml
# .apex/config.yaml v0.3.0 additions
cli:
  theme: dark                    # dark | light | custom
  streaming:
    enabled: true
    speed: normal                # slow | normal | fast | instant
  session:
    persistence: true
    autoSave: true
    autoSaveInterval: 30000      # ms
    maxMessages: 1000
  completion:
    enabled: true
    debounceMs: 150
    maxSuggestions: 10
  shortcuts: {}                  # Custom shortcut overrides
  display:
    compact: false
    verbose: false
    showThinking: true
```

---

## 6. File Storage Structure

```
.apex/
├── config.yaml              # Project config
├── agents/                  # Agent definitions
├── workflows/               # Workflow definitions
├── apex.db                  # SQLite task store
└── sessions/                # NEW: Session storage
    ├── index.json           # Session index
    ├── active.json          # Current session ref
    ├── sess_*.json          # Session files
    └── archive/             # Compressed old sessions
        └── sess_*.json.gz
```

---

## 7. Theme System

### 7.1 Theme Interface
```typescript
interface Theme {
  name: string;
  colors: {
    primary: string;    // Main accent
    secondary: string;  // Secondary accent
    success: string;    // Green
    warning: string;    // Yellow
    error: string;      // Red
    info: string;       // Blue
    muted: string;      // Gray
    border: string;     // Border color
  };
  syntax: SyntaxColors;
  agents: AgentColors;
}
```

### 7.2 Default Themes
- **Dark** (default): Cyan primary, dark background
- **Light**: Blue primary, light background

---

## 8. Implementation Phases

| Phase | Weeks | Features |
|-------|-------|----------|
| 1. Foundation | 1-2 | Theme, StatusBar, Streaming, Shortcuts |
| 2. Input | 3-4 | Multi-line, History search, Completion |
| 3. Output | 5-6 | Markdown, Diff, Code blocks |
| 4. Session | 7-8 | Session store, commands, auto-save |
| 5. NL & Agents | 9-10 | Intent classifier, agent visualization |

---

## 9. Dependencies

### 9.1 Existing (No Changes)
- `ink` (React for CLI)
- `ink-syntax-highlight` (Code highlighting)
- `ink-text-input` (Text input)
- `ink-spinner` (Loading spinners)
- `chalk` (Colors)
- `boxen` (Boxes)

### 9.2 Potential Additions
- None required for core features
- Consider `marked` for complex markdown if needed

---

## 10. Testing Strategy

### 10.1 Unit Tests
- Services: 90%+ coverage
- Hooks: 85%+ coverage
- Components: 80%+ coverage

### 10.2 Integration Tests
- Session lifecycle
- Completion integration
- Multi-component shortcuts

### 10.3 E2E Tests
- REPL startup/recovery
- Natural language flow
- Session export

---

## 11. Performance Targets

| Metric | Target |
|--------|--------|
| Startup time | < 500ms |
| Input latency | < 50ms |
| Streaming FPS | 60fps |
| Completion latency | < 200ms |
| Memory (idle) | < 100MB |
| Memory (active) | < 300MB |

---

## 12. Migration & Compatibility

### 12.1 Backward Compatible
- All existing commands work unchanged
- Classic mode (`apex --classic`) preserved
- Configuration format unchanged (new options additive)

### 12.2 No Data Migration
- Sessions are new (no migration needed)
- `.apex/` directory structure preserved
- Task database unchanged

---

## 13. Risk Mitigation

| Risk | Mitigation |
|------|------------|
| Streaming performance | Skip option, speed settings |
| Large session files | Compression, archival |
| Intent misclassification | Confidence scores, clarification |
| Cross-platform shortcuts | Configurable keybindings |
| Terminal compatibility | Fallback classic mode |

---

## Summary

APEX v0.3.0 introduces a world-class CLI experience through:

1. **Rich Terminal UI**: Streaming output, markdown, syntax highlighting, themes
2. **Status Bar**: Real-time tokens, cost, model, agent, workflow stage
3. **Natural Language**: Intent classification, conversational context
4. **Session Management**: Persistence, branching, export
5. **Keyboard Shortcuts**: Comprehensive shortcut system
6. **Agent Visualization**: Parallel execution, subtask trees

The implementation follows a phased approach over 10 weeks, with clear component boundaries and comprehensive testing requirements.

---

## References

- ADR-001: Rich Terminal UI Architecture
- ADR-002: Natural Language Interface
- ADR-003: Session Management
- ADR-004: Keyboard Shortcuts System
- ADR-005: Implementation Architecture
- ADR-006: Feature Development Guide
- `docs/v030-implementation-plan.md`
- `ROADMAP.md`
