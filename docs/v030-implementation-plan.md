# APEX v0.3.0 Implementation Plan

This document provides a detailed, actionable implementation plan for the v0.3.0 release features.

## Overview

v0.3.0 transforms APEX into a "Claude Code-like Interactive Experience" with:
- Rich Terminal UI with streaming, markdown, and syntax highlighting
- Session Management with persistence, branching, and export
- Natural Language Interface with intent classification
- Comprehensive Keyboard Shortcuts

## Pre-Implementation Checklist

- [ ] Review ADRs 001-005 in `docs/adr/`
- [ ] Ensure development environment is set up (`npm install && npm run build`)
- [ ] Run existing tests to establish baseline (`npm test`)
- [ ] Create feature branch from `main`

---

## Phase 1: Foundation (Week 1-2)

### 1.1 Theme System

**Files to create:**
- `packages/cli/src/types/theme.ts`
- `packages/cli/src/ui/themes/dark.ts`
- `packages/cli/src/ui/themes/light.ts`
- `packages/cli/src/ui/themes/index.ts`
- `packages/cli/src/ui/context/ThemeContext.tsx`
- `packages/cli/src/ui/hooks/useTheme.ts`

**Implementation:**
```typescript
// packages/cli/src/types/theme.ts
export interface Theme {
  name: string;
  colors: {
    primary: string;      // Main accent color
    secondary: string;    // Secondary accent
    success: string;      // Success states
    warning: string;      // Warning states
    error: string;        // Error states
    info: string;         // Informational
    muted: string;        // De-emphasized text
    border: string;       // Borders and separators
    syntax: SyntaxColors;
    agents: AgentColors;
  };
}
```

**Tasks:**
- [ ] Define Theme interface with all color slots
- [ ] Create dark theme preset (default)
- [ ] Create light theme preset
- [ ] Implement ThemeContext with React Context API
- [ ] Create useTheme hook for component access
- [ ] Add `theme` config option to `.apex/config.yaml` schema

**Tests:**
- [ ] Theme context provides correct theme
- [ ] Theme switching updates all consumers
- [ ] Invalid theme name falls back to dark

### 1.2 Enhanced StatusBar

**Files to modify:**
- `packages/cli/src/ui/components/StatusBar.tsx`

**Files to create:**
- `packages/cli/src/ui/components/status/TokenCounter.tsx`
- `packages/cli/src/ui/components/status/CostTracker.tsx`
- `packages/cli/src/ui/components/status/SessionTimer.tsx`

**Implementation:**
- Add session duration timer (updates every second)
- Add workflow stage indicator
- Make status bar sticky at bottom of terminal
- Use theme colors for all elements

**Tasks:**
- [ ] Extract TokenCounter as separate component
- [ ] Extract CostTracker as separate component
- [ ] Add SessionTimer with elapsed time display
- [ ] Add workflow stage display (▶stagename)
- [ ] Implement responsive layout (hide elements if terminal too narrow)
- [ ] Use theme colors throughout

**Tests:**
- [ ] Timer updates correctly
- [ ] Token/cost formatting handles edge cases
- [ ] Layout adapts to terminal width

### 1.3 Streaming Text Implementation

**Files to create:**
- `packages/cli/src/ui/hooks/useStreaming.ts`
- `packages/cli/src/ui/components/output/StreamingText.tsx`

**Implementation:**
```typescript
// Core streaming hook
export function useStreaming(content: string, options: StreamingOptions) {
  // Use requestAnimationFrame for smooth 60fps rendering
  // Support configurable speeds: slow (1 char), normal (3), fast (8), instant
  // Track completion state for cursor display
}
```

**Tasks:**
- [ ] Implement useStreaming hook with RAF-based animation
- [ ] Create StreamingText component wrapper
- [ ] Add streaming configuration to CLI options
- [ ] Integrate with ResponseStream component
- [ ] Add skip functionality (press any key to complete)

**Tests:**
- [ ] Streaming completes at expected rates
- [ ] Skip functionality works correctly
- [ ] Memory cleanup on unmount

### 1.4 Shortcut Manager Infrastructure

**Files to create:**
- `packages/cli/src/types/shortcuts.ts`
- `packages/cli/src/services/ShortcutManager.ts`
- `packages/cli/src/ui/context/ShortcutContext.tsx`
- `packages/cli/src/ui/hooks/useShortcuts.ts`

**Implementation:**
- Define all default shortcuts (see ADR-004)
- Context-aware shortcut activation
- Event-based action system

**Tasks:**
- [ ] Define KeyboardShortcut and KeyCombination types
- [ ] Implement ShortcutManager class with registration
- [ ] Implement key matching with modifier support
- [ ] Create context stack for contextual shortcuts
- [ ] Create ShortcutContext and useShortcuts hook
- [ ] Register all default shortcuts

**Default Shortcuts:**
| Shortcut | Action | Context |
|----------|--------|---------|
| Ctrl+C | Cancel operation | processing |
| Ctrl+D | Exit | global |
| Ctrl+L | Clear screen | global |
| Ctrl+U | Clear line | input |
| Ctrl+W | Delete word | input |
| Ctrl+R | History search | input |
| Tab | Complete | input |
| Escape | Cancel/dismiss | input |

**Tests:**
- [ ] Key matching handles modifiers correctly
- [ ] Context stack enables/disables appropriate shortcuts
- [ ] Action execution works for all types

---

## Phase 2: Input Enhancement (Week 3-4)

### 2.1 Multi-line Input

**Files to modify:**
- `packages/cli/src/ui/components/InputPrompt.tsx`

**Files to create:**
- `packages/cli/src/ui/components/input/MultiLineEditor.tsx`

**Implementation:**
- Detect multi-line triggers: Shift+Enter, unclosed backticks
- Support heredoc-style input (`<<EOF`)
- Visual indicator for multi-line mode

**Tasks:**
- [ ] Add multi-line state to InputPrompt
- [ ] Detect Shift+Enter for line continuation
- [ ] Detect unclosed code blocks (```)
- [ ] Implement heredoc parsing
- [ ] Create MultiLineEditor component
- [ ] Add visual mode indicator

**Tests:**
- [ ] Shift+Enter adds newline without submit
- [ ] Unclosed backticks enter multi-line mode
- [ ] Heredoc syntax works correctly
- [ ] Submit on final Enter in single-line mode

### 2.2 History Search (Ctrl+R)

**Files to create:**
- `packages/cli/src/ui/components/input/HistorySearch.tsx`
- `packages/cli/src/ui/hooks/useHistory.ts`

**Implementation:**
- Reverse incremental search through history
- Real-time filtering as user types
- Up/down to navigate results
- Enter to select, Escape to cancel

**Tasks:**
- [ ] Create HistorySearch overlay component
- [ ] Implement incremental search filtering
- [ ] Add keyboard navigation (up/down/enter/escape)
- [ ] Highlight matching text in results
- [ ] Integrate with InputPrompt via shortcut

**Tests:**
- [ ] Search filters history correctly
- [ ] Navigation works as expected
- [ ] Selection populates input

### 2.3 Tab Completion Engine

**Files to create:**
- `packages/cli/src/types/completion.ts`
- `packages/cli/src/services/CompletionEngine.ts`
- `packages/cli/src/ui/components/input/Completion.tsx`

**Completion Providers to implement:**
1. **Commands** - `/help`, `/status`, etc.
2. **File paths** - `./src/`, `~/Documents/`
3. **Agents** - `@planner`, `@developer`
4. **Workflows** - `--workflow feature`
5. **Task IDs** - Recent task references

**Tasks:**
- [ ] Define CompletionProvider interface
- [ ] Implement CompletionEngine with provider registration
- [ ] Create command completion provider
- [ ] Create file path completion provider (with glob)
- [ ] Create agent completion provider
- [ ] Create workflow completion provider
- [ ] Create Completion dropdown component
- [ ] Integrate with InputPrompt

**Tests:**
- [ ] Each provider returns correct suggestions
- [ ] Suggestions are sorted by relevance
- [ ] Tab cycles through suggestions
- [ ] Escape dismisses suggestions

---

## Phase 3: Output Enhancement (Week 5-6)

### 3.1 Enhanced Markdown Renderer

**Files to modify:**
- `packages/cli/src/ui/components/ResponseStream.tsx`

**Files to create:**
- `packages/cli/src/ui/components/output/MarkdownRenderer.tsx`

**Supported Markdown:**
- Headers (H1-H6) with colors
- Bold, italic, strikethrough
- Inline code with background
- Code blocks with syntax highlighting
- Lists (bullet and numbered)
- Blockquotes
- Horizontal rules
- Links (display text, dim URL)

**Tasks:**
- [ ] Create MarkdownRenderer component
- [ ] Implement header rendering with hierarchy colors
- [ ] Implement inline formatting (bold, italic, code)
- [ ] Improve list rendering with proper indentation
- [ ] Add blockquote styling
- [ ] Handle links gracefully in terminal
- [ ] Integrate with ResponseStream

**Tests:**
- [ ] All markdown elements render correctly
- [ ] Nested elements work (bold inside list)
- [ ] Long content wraps appropriately

### 3.2 Diff View Component

**Files to create:**
- `packages/cli/src/ui/components/output/DiffView.tsx`

**Features:**
- Inline diff view (default): +/- with colors
- Side-by-side view (optional)
- Line numbers
- Context lines around changes

**Tasks:**
- [ ] Create DiffView component
- [ ] Implement inline diff rendering
- [ ] Implement side-by-side rendering
- [ ] Add line numbers
- [ ] Support unified diff format parsing
- [ ] Add expand/collapse for large diffs

**Tests:**
- [ ] Inline diff displays correctly
- [ ] Side-by-side handles varying line lengths
- [ ] Large diffs can be collapsed

### 3.3 Enhanced Code Blocks

**Files to modify:**
- `packages/cli/src/ui/components/CodeBlock.tsx`

**Features:**
- Line numbers (toggleable)
- Language label
- Syntax highlighting (existing)
- Line highlighting for specific lines
- Fold/unfold for long blocks

**Tasks:**
- [ ] Add line numbers column
- [ ] Add language label header
- [ ] Implement line highlighting
- [ ] Add fold/unfold for >20 lines
- [ ] Improve color scheme with theme

**Tests:**
- [ ] Line numbers display correctly
- [ ] Folding works for long blocks
- [ ] Highlighting specific lines works

---

## Phase 4: Session Management (Week 7-8)

### 4.1 Session Store

**Files to create:**
- `packages/cli/src/types/session.ts`
- `packages/cli/src/services/SessionStore.ts`

**Storage Structure:**
```
.apex/sessions/
├── index.json        # Session index
├── active.json       # Current session reference
├── sess_*.json       # Individual sessions
└── archive/          # Compressed old sessions
```

**Tasks:**
- [ ] Define Session and related interfaces
- [ ] Implement SessionStore class
- [ ] Implement createSession
- [ ] Implement getSession / listSessions
- [ ] Implement updateSession / deleteSession
- [ ] Implement session index management
- [ ] Implement archiveSession with compression

**Tests:**
- [ ] CRUD operations work correctly
- [ ] Index stays in sync with sessions
- [ ] Archival compresses files

### 4.2 Session Commands

**Files to modify:**
- `packages/cli/src/index.ts` (add commands)

**New commands:**
```
/session list [--all] [--search <query>]
/session load <id|name>
/session save <name> [--tags <tags>]
/session branch [<name>] [--from <index>]
/session export [--format md|json|html] [--output <file>]
/session delete <id>
/session info
```

**Tasks:**
- [ ] Implement `/session list` command
- [ ] Implement `/session load` command
- [ ] Implement `/session save` command
- [ ] Implement `/session branch` command
- [ ] Implement `/session export` command
- [ ] Implement `/session delete` command
- [ ] Implement `/session info` command

**Tests:**
- [ ] Each command works correctly
- [ ] Error handling for invalid inputs
- [ ] Export formats generate valid output

### 4.3 Auto-save and Recovery

**Files to create:**
- `packages/cli/src/services/SessionAutoSaver.ts`

**Features:**
- Auto-save every 30 seconds (configurable)
- Force save after N unsaved messages
- Crash recovery on startup

**Tasks:**
- [ ] Implement SessionAutoSaver class
- [ ] Add interval-based saving
- [ ] Add message-count triggered saving
- [ ] Implement crash recovery detection
- [ ] Add recovery prompt on startup
- [ ] Add configuration options

**Tests:**
- [ ] Auto-save triggers at correct intervals
- [ ] Recovery detects incomplete sessions
- [ ] Configuration options work

### 4.4 Session UI Components

**Files to create:**
- `packages/cli/src/ui/components/session/SessionList.tsx`
- `packages/cli/src/ui/components/session/SessionInfo.tsx`
- `packages/cli/src/ui/context/SessionContext.tsx`

**Tasks:**
- [ ] Create SessionList component for `/session list`
- [ ] Create SessionInfo component for status display
- [ ] Create SessionContext for session state
- [ ] Add session indicator to StatusBar

---

## Phase 5: Natural Language & Agents (Week 9-10)

### 5.1 Intent Classifier

**Files to create:**
- `packages/cli/src/services/IntentClassifier.ts`

**Intent types:**
- Command: `/help`, `/status`
- Task: "Add a login form"
- Question: "How does authentication work?"
- Clarification response: "Yes", "The first one"
- Confirmation: "Yes", "No"

**Tasks:**
- [ ] Define Intent types
- [ ] Implement command detection (starts with `/`)
- [ ] Implement task detection (action verbs)
- [ ] Implement question detection
- [ ] Implement confirmation parsing
- [ ] Detect workflow type from keywords
- [ ] Calculate confidence scores

**Tests:**
- [ ] Commands detected with 100% accuracy
- [ ] Tasks detected with >90% accuracy
- [ ] Questions detected correctly
- [ ] Ambiguous inputs handled gracefully

### 5.2 Conversation Manager

**Files to create:**
- `packages/cli/src/services/ConversationManager.ts`

**Features:**
- Track message history
- Maintain conversation context
- Support clarification flows
- Context summarization for long conversations

**Tasks:**
- [ ] Implement ConversationManager class
- [ ] Track messages with metadata
- [ ] Implement context window management
- [ ] Implement clarification request/response flow
- [ ] Add context summarization for >50 messages

**Tests:**
- [ ] Messages tracked correctly
- [ ] Context doesn't exceed limits
- [ ] Clarification flow works

### 5.3 Agent Visualization

**Files to create:**
- `packages/cli/src/ui/components/agents/AgentPanel.tsx`
- `packages/cli/src/ui/components/agents/AgentHandoff.tsx`
- `packages/cli/src/ui/components/agents/ParallelView.tsx`
- `packages/cli/src/ui/components/agents/SubtaskTree.tsx`

**Tasks:**
- [ ] Create AgentPanel showing active agent
- [ ] Create AgentHandoff transition animation
- [ ] Create ParallelView for concurrent agents
- [ ] Create SubtaskTree for task decomposition
- [ ] Integrate with orchestrator events

**Tests:**
- [ ] Agent status updates in real-time
- [ ] Handoff animation smooth
- [ ] Subtask tree reflects actual structure

### 5.4 Contextual Suggestions

**Files to create:**
- `packages/cli/src/services/SuggestionEngine.ts`

**Suggestion sources:**
- Git status (uncommitted changes)
- Recent tasks
- Time-based (end of day = review)
- Project state

**Tasks:**
- [ ] Implement SuggestionEngine
- [ ] Add Git-based suggestions
- [ ] Add task-based suggestions
- [ ] Add time-based suggestions
- [ ] Display suggestions in UI

---

## Testing Requirements

### Unit Test Coverage Targets
- Services: 90%+
- Hooks: 85%+
- Components: 80%+

### Integration Tests
- [ ] Full session lifecycle
- [ ] Task execution with streaming
- [ ] Completion with file system

### E2E Tests
- [ ] REPL startup sequence
- [ ] Session save/load
- [ ] Natural language task execution

---

## Documentation Updates

- [ ] Update `docs/getting-started.md` with v0.3.0 features
- [ ] Add `docs/cli-reference.md` with all commands and shortcuts
- [ ] Add `docs/session-management.md` guide
- [ ] Update `CHANGELOG.md`
- [ ] Update `README.md` feature list

---

## Release Checklist

- [ ] All phases complete
- [ ] Test coverage targets met
- [ ] Documentation updated
- [ ] CHANGELOG updated
- [ ] Version bumped to 0.3.0
- [ ] Release notes drafted
- [ ] Beta testing complete
