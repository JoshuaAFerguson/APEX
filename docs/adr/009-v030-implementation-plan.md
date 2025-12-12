# ADR-009: v0.3.0 Implementation Plan - Architecture Stage Output

## Status
Accepted (Architecture Stage)

## Executive Summary

This document provides the **detailed implementation plan** for completing APEX v0.3.0 "Claude Code-like Interactive Experience". It builds upon ADR-008 (Comprehensive Technical Design) and analyzes the **current implementation state** to identify **exact remaining work** with prioritized feature development tasks.

**Goal**: Complete the transformation of APEX into a world-class AI coding assistant CLI on par with Claude Code, Codex CLI, and Gemini CLI, while maintaining APEX's unique multi-agent orchestration capabilities.

---

## 1. Current Implementation Analysis

### 1.1 Fully Implemented Components (Ready for Production)

The following components have been **fully implemented** and match the ADR-008 specifications:

| Component | Status | Location | Notes |
|-----------|--------|----------|-------|
| **SessionStore** | Complete | `cli/src/services/SessionStore.ts` | Full CRUD, archiving, branching, export |
| **SessionAutoSaver** | Complete | `cli/src/services/SessionAutoSaver.ts` | Auto-save with configurable intervals |
| **CompletionEngine** | Complete | `cli/src/services/CompletionEngine.ts` | Commands, paths, agents, workflows, history |
| **ShortcutManager** | Complete | `cli/src/services/ShortcutManager.ts` | Context-aware shortcuts with events |
| **ConversationManager** | Complete | `cli/src/services/ConversationManager.ts` | Clarification flow, intent detection |
| **Session Commands** | Complete | `cli/src/repl.tsx` | list, load, save, branch, export, delete, info |
| **Theme System** | Complete | `cli/src/types/theme.ts`, `cli/src/ui/themes/` | Dark/light themes |
| **StreamingText** | Complete | `cli/src/ui/components/StreamingText.tsx` | Character-by-character rendering |
| **MarkdownRenderer** | Complete | `cli/src/ui/components/MarkdownRenderer.tsx` | Full CommonMark support |
| **DiffViewer** | Complete | `cli/src/ui/components/DiffViewer.tsx` | Unified, split, inline modes |
| **SyntaxHighlighter** | Complete | `cli/src/ui/components/SyntaxHighlighter.tsx` | Language-aware highlighting |
| **ProgressIndicators** | Complete | `cli/src/ui/components/ProgressIndicators.tsx` | Spinners, progress bars |
| **ActivityLog** | Complete | `cli/src/ui/components/ActivityLog.tsx` | Collapsible action log |
| **ErrorDisplay** | Complete | `cli/src/ui/components/ErrorDisplay.tsx` | Clear, actionable errors |
| **SuccessCelebration** | Complete | `cli/src/ui/components/SuccessCelebration.tsx` | Visual feedback |
| **IntentDetector** | Complete | `cli/src/ui/components/IntentDetector.tsx` | Smart intent detection |
| **StatusBar** | Complete | `cli/src/ui/components/StatusBar.tsx` | Status display |
| **Status Components** | Complete | `cli/src/ui/components/status/` | TokenCounter, CostTracker, SessionTimer |

### 1.2 Implementation Gaps Analysis

Based on the ROADMAP.md and ADR-008, the following features have **implementation gaps**:

#### Category A: Integration Gaps (Services exist but not fully integrated)

| Feature | Service Ready? | Integration Status | Remaining Work |
|---------|----------------|-------------------|----------------|
| Tab Completion | CompletionEngine ready | Partial in AdvancedInput | Wire CompletionEngine to AdvancedInput |
| History Search (Ctrl+R) | ShortcutManager ready | Event defined, UI missing | Create HistorySearch.tsx component |
| Conversation Context | ConversationManager ready | Not integrated to REPL | Integrate with repl.tsx task execution |
| Session Timer | SessionTimer.tsx ready | Not in StatusBar | Add to StatusBar props |
| Subtask Progress | Logic exists | StatusBar doesn't display | Add progress indicator to StatusBar |

#### Category B: Missing Components

| Feature | ADR Spec | Current Status | Required Implementation |
|---------|----------|----------------|-------------------------|
| AgentPanel | ADR-008 Sec 4.1 | Placeholder exists | Implement visual agent status panel |
| SubtaskTree | ADR-008 Sec 4.2 | Placeholder exists | Implement hierarchical subtask view |
| HistorySearch | ADR-008 Sec 2.2 | Not implemented | Ctrl+R reverse incremental search |
| Multi-line Heredoc | ADR-008 Sec 2.2 | Partial | Visual indicator, `<<EOF` syntax |
| Compact/Verbose Mode | ROADMAP | Not implemented | Display mode toggles |
| Screen Clear (Ctrl+L) | ROADMAP | Shortcut defined, no handler | Wire to clear event |

#### Category C: Test Coverage Gaps

| Service | Test File | Coverage | Status |
|---------|-----------|----------|--------|
| SessionStore | `SessionStore.test.ts` | Exists | Needs review |
| SessionAutoSaver | `SessionAutoSaver.test.ts` | Exists | Needs review |
| CompletionEngine | `CompletionEngine.test.ts` | Exists | Needs review |
| ShortcutManager | `ShortcutManager.test.ts` | Exists | Needs review |
| ConversationManager | `ConversationManager.test.ts` | Exists | Needs review |

---

## 2. Prioritized Implementation Plan

### Phase 1: Integration Work (3-4 days) - **HIGH PRIORITY**

Complete the integration of existing services with the REPL and UI.

#### Task 1.1: Wire CompletionEngine to AdvancedInput (1 day)
**Files to modify:**
- `packages/cli/src/ui/components/AdvancedInput.tsx`
- `packages/cli/src/repl.tsx`

**Implementation:**
```typescript
// In AdvancedInput.tsx - Add CompletionEngine integration
const completionEngine = useRef(new CompletionEngine());

// Create completion context from props
const completionContext: CompletionContext = {
  projectPath,
  agents: availableAgents,
  workflows: availableWorkflows,
  recentTasks,
  inputHistory,
};

// On Tab press, get completions
const handleTab = async () => {
  const suggestions = await completionEngine.current.getCompletions(
    input,
    cursorPosition,
    completionContext
  );
  setSuggestions(suggestions);
};
```

#### Task 1.2: Integrate ConversationManager with REPL (1 day)
**Files to modify:**
- `packages/cli/src/repl.tsx`

**Implementation:**
```typescript
// Add ConversationManager to context
const conversationManager = new ConversationManager();

// Track messages
async function executeTask(description: string): Promise<void> {
  conversationManager.addMessage({ role: 'user', content: description });
  // ... existing logic
  conversationManager.setTask(task.id);
}

// Use intent detection
const handleInput = async (input: string) => {
  const intent = conversationManager.detectIntent(input);

  if (intent.type === 'clarification' && conversationManager.hasPendingClarification()) {
    const result = conversationManager.provideClarification(input);
    // Handle clarification response
  }
  // ... existing routing
};
```

#### Task 1.3: Add Session Timer and Subtask Progress to StatusBar (0.5 day)
**Files to modify:**
- `packages/cli/src/ui/components/StatusBar.tsx`
- `packages/cli/src/ui/App.tsx`

**Implementation:**
- StatusBar already supports `sessionStartTime` and `subtaskProgress` props (per ADR-008)
- Need to pass these props from App.tsx based on orchestrator events

#### Task 1.4: Wire ShortcutManager Events (0.5 day)
**Files to modify:**
- `packages/cli/src/repl.tsx`
- `packages/cli/src/ui/App.tsx`

**Implementation:**
```typescript
// Create ShortcutManager instance
const shortcutManager = new ShortcutManager();

// Wire event handlers
shortcutManager.on('clear', () => {
  ctx.app?.clearMessages();
});

shortcutManager.on('historySearch', () => {
  setShowHistorySearch(true);
});
```

---

### Phase 2: Missing Components (4-5 days) - **HIGH PRIORITY**

#### Task 2.1: Create HistorySearch Component (1.5 days)
**File:** `packages/cli/src/ui/components/input/HistorySearch.tsx`

**Technical Design:**
```typescript
import React, { useState, useEffect } from 'react';
import { Box, Text, useInput } from 'ink';
import TextInput from 'ink-text-input';

interface HistorySearchProps {
  history: string[];
  onSelect: (item: string) => void;
  onCancel: () => void;
}

export function HistorySearch({ history, onSelect, onCancel }: HistorySearchProps): React.ReactElement {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [matches, setMatches] = useState<string[]>([]);

  useEffect(() => {
    if (query) {
      const filtered = history
        .filter(h => h.toLowerCase().includes(query.toLowerCase()))
        .reverse()
        .slice(0, 10);
      setMatches(filtered);
      setSelectedIndex(0);
    } else {
      setMatches([]);
    }
  }, [query, history]);

  useInput((input, key) => {
    if (key.escape) {
      onCancel();
    } else if (key.return) {
      if (matches[selectedIndex]) {
        onSelect(matches[selectedIndex]);
      }
    } else if (key.upArrow) {
      setSelectedIndex(Math.max(0, selectedIndex - 1));
    } else if (key.downArrow) {
      setSelectedIndex(Math.min(matches.length - 1, selectedIndex + 1));
    }
  });

  return (
    <Box flexDirection="column" borderStyle="round" borderColor="yellow" padding={1}>
      <Box>
        <Text color="yellow">(reverse-i-search)`</Text>
        <TextInput value={query} onChange={setQuery} focus />
        <Text color="yellow">':</Text>
      </Box>
      <Box flexDirection="column" marginTop={1}>
        {matches.map((match, index) => (
          <Text
            key={index}
            color={index === selectedIndex ? 'green' : 'gray'}
            inverse={index === selectedIndex}
          >
            {match.length > 70 ? match.slice(0, 67) + '...' : match}
          </Text>
        ))}
      </Box>
    </Box>
  );
}
```

**Test file:** `packages/cli/src/ui/components/input/__tests__/HistorySearch.test.tsx`

#### Task 2.2: Enhance AgentPanel Component (1 day)
**File:** `packages/cli/src/ui/components/agents/AgentPanel.tsx`

Current file exists but needs enhancement per ADR-008 Section 4.1:

**Enhancements needed:**
1. Add agent handoff animation (transition between agents)
2. Add parallel execution view
3. Improve compact mode display

```typescript
// Add handoff animation
interface AgentPanelProps {
  agents: AgentInfo[];
  currentAgent?: string;
  previousAgent?: string;  // For handoff animation
  compact?: boolean;
  showParallel?: boolean;  // Show parallel execution
}

// Handoff indicator
{previousAgent && currentAgent && previousAgent !== currentAgent && (
  <Box>
    <Text color="gray">{previousAgent}</Text>
    <Text color="yellow"> -> </Text>
    <Text color="green">{currentAgent}</Text>
  </Box>
)}
```

#### Task 2.3: Enhance SubtaskTree Component (1 day)
**File:** `packages/cli/src/ui/components/agents/SubtaskTree.tsx`

Current file exists but needs enhancements:

**Enhancements needed:**
1. Add collapse/expand functionality
2. Add time estimates per subtask
3. Add progress percentage

```typescript
interface SubtaskNode {
  id: string;
  description: string;
  status: 'pending' | 'in-progress' | 'completed' | 'failed';
  children?: SubtaskNode[];
  estimatedTime?: number;  // in seconds
  elapsedTime?: number;    // in seconds
  progress?: number;       // 0-100
}

interface SubtaskTreeProps {
  task: SubtaskNode;
  maxDepth?: number;
  collapsed?: boolean;
  onToggleCollapse?: (nodeId: string) => void;
}
```

#### Task 2.4: Add Display Modes (0.5 day)
**Files to modify:**
- `packages/cli/src/repl.tsx` (add /compact and /verbose commands)
- `packages/cli/src/ui/App.tsx` (add displayMode state)

```typescript
// Display modes
type DisplayMode = 'normal' | 'compact' | 'verbose';

// Compact mode: Condensed output, single-line status
// Verbose mode: Full debug output, expanded logs
// Normal mode: Default balanced view
```

#### Task 2.5: Multi-line Heredoc Input (1 day)
**File:** `packages/cli/src/ui/components/AdvancedInput.tsx`

**Technical Design:**
```typescript
// Detect heredoc start
const heredocRegex = /<<(\w+)$/;

// Multi-line mode state
const [multiLineMode, setMultiLineMode] = useState(false);
const [heredocDelimiter, setHeredocDelimiter] = useState<string | null>(null);
const [multiLineBuffer, setMultiLineBuffer] = useState<string[]>([]);

// On input, check for heredoc
const handleInput = (value: string) => {
  const match = value.match(heredocRegex);
  if (match) {
    setHeredocDelimiter(match[1]);
    setMultiLineMode(true);
    return;
  }
  // ...
};

// In multi-line mode, collect lines until delimiter
const handleMultiLineInput = (line: string) => {
  if (line.trim() === heredocDelimiter) {
    const fullInput = multiLineBuffer.join('\n');
    setMultiLineMode(false);
    setHeredocDelimiter(null);
    setMultiLineBuffer([]);
    onSubmit(fullInput);
  } else {
    setMultiLineBuffer([...multiLineBuffer, line]);
  }
};

// Visual indicator for multi-line mode
{multiLineMode && (
  <Box>
    <Text color="yellow">... </Text>
    <Text color="gray">(heredoc: {heredocDelimiter})</Text>
  </Box>
)}
```

---

### Phase 3: Polish & Testing (3-4 days) - **MEDIUM PRIORITY**

#### Task 3.1: Review and Enhance Test Coverage (2 days)

**Test files to review/enhance:**
1. `packages/cli/src/services/__tests__/SessionStore.test.ts`
2. `packages/cli/src/services/__tests__/SessionAutoSaver.test.ts`
3. `packages/cli/src/services/__tests__/CompletionEngine.test.ts`
4. `packages/cli/src/services/__tests__/ShortcutManager.test.ts`
5. `packages/cli/src/services/__tests__/ConversationManager.test.ts`

**Coverage targets:**
- Services: 90%+
- Components: 80%+
- Integration: Add REPL integration tests

**New test files needed:**
- `packages/cli/src/ui/components/input/__tests__/HistorySearch.test.tsx`
- `packages/cli/src/__tests__/session.integration.test.tsx`

#### Task 3.2: Integration Tests (1 day)
**File:** `packages/cli/src/__tests__/v030-features.integration.test.tsx`

```typescript
describe('v0.3.0 Feature Integration', () => {
  describe('Session Management', () => {
    it('should create and persist sessions');
    it('should auto-save on message threshold');
    it('should restore previous session on startup');
    it('should support branching');
    it('should export to all formats');
  });

  describe('Completion System', () => {
    it('should complete commands');
    it('should complete file paths');
    it('should complete agent names');
    it('should complete workflow names');
    it('should show history suggestions');
  });

  describe('Keyboard Shortcuts', () => {
    it('should handle Ctrl+C to cancel');
    it('should handle Ctrl+R for history search');
    it('should handle Ctrl+L to clear');
    it('should support context-aware shortcuts');
  });

  describe('Conversation Context', () => {
    it('should detect intent correctly');
    it('should handle clarification flow');
    it('should provide smart suggestions');
  });
});
```

#### Task 3.3: Documentation Updates (1 day)

**Files to update:**
1. `docs/getting-started.md` - Add v0.3.0 features
2. `ROADMAP.md` - Update status icons
3. Create `docs/cli-guide.md` - Comprehensive CLI usage guide

---

## 3. Feature Implementation Details

### 3.1 Session Management Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                     Session Lifecycle                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Start REPL                                                      │
│      │                                                           │
│      ▼                                                           │
│  ┌──────────────────────┐                                       │
│  │ Check Active Session │                                       │
│  └──────────────────────┘                                       │
│      │                                                           │
│      ├── Session exists ──► Load Session ──► Resume              │
│      │                                                           │
│      └── No session ──► Create New Session                       │
│                                                                  │
│  During Session                                                  │
│      │                                                           │
│      ├── User input ──► addInputToHistory()                      │
│      ├── Message ──► addMessage()                                │
│      ├── 5 unsaved changes ──► Auto-save                         │
│      └── 30 second interval ──► Auto-save                        │
│                                                                  │
│  Session Commands                                                │
│      │                                                           │
│      ├── /session list ──► listSessions()                        │
│      ├── /session load <id> ──► getSession() + start()           │
│      ├── /session save <name> ──► updateSessionInfo() + save()   │
│      ├── /session branch ──► branchSession()                     │
│      ├── /session export ──► exportSession()                     │
│      ├── /session delete ──► deleteSession()                     │
│      └── /session info ──► getSession()                          │
│                                                                  │
│  Exit REPL                                                       │
│      │                                                           │
│      ▼                                                           │
│  ┌────────────────────┐                                         │
│  │ Auto-save Session │                                          │
│  └────────────────────┘                                         │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 3.2 Completion System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    Completion System                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  User types input                                                │
│      │                                                           │
│      ▼                                                           │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                  CompletionEngine                         │   │
│  │                                                           │   │
│  │  Providers (by priority):                                 │   │
│  │  ┌─────────────────────────────────────────────────────┐ │   │
│  │  │ 100: Command Provider    /help, /status, /session   │ │   │
│  │  │  95: Session Subcommands /session list, load, save  │ │   │
│  │  │  90: Agent Provider      @planner, @developer       │ │   │
│  │  │  85: Workflow Provider   --workflow feature         │ │   │
│  │  │  80: Path Provider       ./src/, ~/Documents/       │ │   │
│  │  │  75: Task ID Provider    task_abc123                │ │   │
│  │  │  65: Task Pattern        fix, add, implement        │ │   │
│  │  │  60: History Provider    Previous inputs            │ │   │
│  │  └─────────────────────────────────────────────────────┘ │   │
│  │                                                           │   │
│  │  getCompletions(input, cursor, context)                   │   │
│  │      │                                                    │   │
│  │      ├── Match triggers against input                     │   │
│  │      ├── Get suggestions from matching providers          │   │
│  │      ├── Deduplicate results                              │   │
│  │      └── Sort by score, limit to 15                       │   │
│  │                                                           │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
│  Display suggestions in AdvancedInput                            │
│      │                                                           │
│      ├── Tab ──► Select first/next suggestion                    │
│      ├── Up/Down ──► Navigate suggestions                        │
│      ├── Enter ──► Accept suggestion                             │
│      └── Escape ──► Dismiss suggestions                          │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 3.3 Shortcut Context System

```
┌─────────────────────────────────────────────────────────────────┐
│                    Shortcut Context Stack                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Context Stack: [global, input]                                  │
│                                                                  │
│  Global Context (always active):                                 │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ Ctrl+D     Exit APEX                                        ││
│  │ Ctrl+L     Clear screen                                     ││
│  │ Escape     Dismiss suggestions/modal                        ││
│  │ Ctrl+S     Quick save session                               ││
│  │ Ctrl+H     Show help                                        ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                  │
│  Input Context (when typing):                                    │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ Tab        Complete suggestion                              ││
│  │ Ctrl+R     History search                                   ││
│  │ Ctrl+U     Clear line                                       ││
│  │ Ctrl+W     Delete word                                      ││
│  │ Ctrl+A     Beginning of line                                ││
│  │ Ctrl+E     End of line                                      ││
│  │ Ctrl+P     Previous history                                 ││
│  │ Ctrl+N     Next history                                     ││
│  │ Shift+Enter Insert newline                                  ││
│  │ Enter      Submit                                           ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                  │
│  Processing Context (task running):                              │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ Ctrl+C     Cancel operation                                 ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                  │
│  History Context (Ctrl+R active):                                │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ Up/Down    Navigate matches                                 ││
│  │ Enter      Select match                                     ││
│  │ Escape     Cancel search                                    ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 4. Implementation Schedule

### Week 1: Integration (Phase 1)
| Day | Task | Files | Estimated Hours |
|-----|------|-------|-----------------|
| 1 | Wire CompletionEngine to AdvancedInput | AdvancedInput.tsx, repl.tsx | 6-8h |
| 2 | Integrate ConversationManager | repl.tsx | 6-8h |
| 3 | StatusBar enhancements + ShortcutManager wiring | StatusBar.tsx, App.tsx, repl.tsx | 4-6h |

### Week 2: Missing Components (Phase 2)
| Day | Task | Files | Estimated Hours |
|-----|------|-------|-----------------|
| 1-2 | HistorySearch component + tests | HistorySearch.tsx, test file | 10-12h |
| 2-3 | AgentPanel enhancements | AgentPanel.tsx | 6-8h |
| 3-4 | SubtaskTree enhancements | SubtaskTree.tsx | 6-8h |
| 4 | Display modes + multi-line heredoc | repl.tsx, AdvancedInput.tsx | 6-8h |

### Week 3: Polish & Testing (Phase 3)
| Day | Task | Files | Estimated Hours |
|-----|------|-------|-----------------|
| 1-2 | Test coverage review + enhancements | All test files | 12-16h |
| 3 | Integration tests | v030-features.integration.test.tsx | 6-8h |
| 4 | Documentation updates | docs/*.md | 4-6h |

---

## 5. Risk Assessment

### Low Risk
- Session management (fully implemented, needs integration)
- Completion engine (fully implemented, needs wiring)
- Shortcut system (fully implemented, needs event handlers)

### Medium Risk
- HistorySearch component (new, but well-defined spec)
- Multi-line heredoc (partially implemented, clear requirements)
- Test coverage (existing tests, needs review)

### High Risk
- None identified - all major components already exist

---

## 6. Success Criteria

### Functional Requirements
- [ ] Tab completion shows suggestions for commands, paths, agents, workflows
- [ ] Ctrl+R opens history search with incremental filtering
- [ ] Sessions persist across REPL restarts
- [ ] All session commands work (/session list, load, save, branch, export, delete, info)
- [ ] StatusBar shows session timer and subtask progress
- [ ] Agent handoffs are visually indicated
- [ ] Multi-line input works with heredoc syntax

### Non-Functional Requirements
- [ ] Service test coverage >= 90%
- [ ] Component test coverage >= 80%
- [ ] No regression in existing functionality
- [ ] Response time for completions < 100ms
- [ ] Session auto-save doesn't block UI

### Documentation Requirements
- [ ] ROADMAP.md updated with v0.3.0 completion status
- [ ] CLI usage guide created
- [ ] Getting started guide updated

---

## 7. Dependencies

### Required Dependencies (Already Installed)
- `ink` - React for CLI
- `fuse.js` - Fuzzy search for completions
- `marked`, `marked-terminal` - Markdown rendering
- `diff` - Diff computation
- `zlib` - Session compression

### No New Dependencies Required
All functionality can be implemented with existing dependencies.

---

## 8. References

- ADR-001: Rich Terminal UI Architecture
- ADR-002: Natural Language Interface
- ADR-003: Session Management
- ADR-004: Keyboard Shortcuts System
- ADR-005: Implementation Architecture
- ADR-006: Feature Development Guide
- ADR-007: Technical Design Summary
- ADR-008: Comprehensive Technical Design
- ROADMAP.md
- CLAUDE.md
