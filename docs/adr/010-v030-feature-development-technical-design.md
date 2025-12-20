# ADR-010: v0.3.0 Feature Development Technical Design

## Status
**Implemented** (v0.3.0 Complete - December 2024)

_Previously: Accepted (Architecture Stage - December 2024)_

## Executive Summary

This document provides the **comprehensive technical design** for completing APEX v0.3.0 "Claude Code-like Interactive Experience". It analyzes the current implementation state against ROADMAP.md requirements and provides detailed technical specifications for each remaining feature.

**Goal**: Transform APEX into a world-class AI coding assistant CLI on par with Claude Code, Codex CLI, and Gemini CLI, while maintaining APEX's unique multi-agent orchestration capabilities.

**Estimated Remaining Work**: 2-3 weeks (10-15 days of development)

---

## 1. Architecture Overview

### 1.1 Current System Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           APEX v0.3.0 CLI Architecture                       │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │                        User Interface Layer                           │  │
│  │  ┌─────────────┐ ┌──────────────┐ ┌─────────────┐ ┌───────────────┐  │  │
│  │  │   App.tsx   │ │ StatusBar.tsx│ │AdvancedInput│ │ AgentPanel.tsx│  │  │
│  │  └──────┬──────┘ └──────────────┘ └──────┬──────┘ └───────────────┘  │  │
│  │         │                                │                            │  │
│  │  ┌──────▼──────────────────────────────────────────────────────────┐  │  │
│  │  │              UI Components (Ink-based React)                    │  │  │
│  │  │  StreamingText | MarkdownRenderer | DiffViewer | SyntaxHighlight│  │  │
│  │  │  ProgressIndicators | ActivityLog | ErrorDisplay | SuccessCeleb │  │  │
│  │  │  IntentDetector | SubtaskTree | InputPrompt | HistorySearch     │  │  │
│  │  └──────────────────────────────────────────────────────────────────┘  │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                      │                                      │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │                         Services Layer                                │  │
│  │  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌─────────────┐  │  │
│  │  │ SessionStore │ │ Completion   │ │  Shortcut    │ │Conversation │  │  │
│  │  │ + AutoSaver  │ │   Engine     │ │   Manager    │ │  Manager    │  │  │
│  │  └──────────────┘ └──────────────┘ └──────────────┘ └─────────────┘  │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                      │                                      │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │                           REPL Layer                                  │  │
│  │                         (repl.tsx)                                    │  │
│  │  Command Routing | Task Execution | Session Management | Events      │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                      │                                      │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │                      Orchestrator Layer                               │  │
│  │              (@apexcli/orchestrator - ApexOrchestrator)                  │  │
│  │  Task Management | Agent Execution | Claude SDK | Event Emission     │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                      │                                      │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │                         Core Layer                                    │  │
│  │                    (@apexcli/core - Types & Config)                      │  │
│  │  Zod Schemas | Config Loading | Agent/Workflow Parsing | Utilities   │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 1.2 Package Structure

| Package | Purpose | Key Files |
|---------|---------|-----------|
| `@apexcli/core` | Shared types, config, utilities | `types.ts`, `config.ts`, `utils.ts` |
| `@apexcli/orchestrator` | Task execution, Claude SDK | `index.ts`, `store.ts`, `context.ts` |
| `@apexcli/cli` | CLI, UI, Services | `repl.tsx`, `ui/`, `services/` |
| `@apexcli/api` | REST API, WebSocket | `index.ts` |

---

## 2. Implementation Status Analysis

### 2.1 Completed Features (Green Status - 🟢)

| Feature Category | Feature | Implementation | Status |
|------------------|---------|----------------|--------|
| **Rich Terminal UI** | Ink-based framework | `cli/src/ui/App.tsx` | 🟢 Complete |
| | Streaming responses | `StreamingText.tsx` | 🟢 Complete |
| | Markdown rendering | `MarkdownRenderer.tsx` | 🟢 Complete |
| | Syntax highlighting | `SyntaxHighlighter.tsx` | 🟢 Complete |
| | Diff views | `DiffViewer.tsx` | 🟢 Complete |
| | Progress indicators | `ProgressIndicators.tsx` | 🟢 Complete |
| | Error display | `ErrorDisplay.tsx` | 🟢 Complete |
| | Activity log | `ActivityLog.tsx` | 🟢 Complete |
| | Theme support | `ThemeContext.tsx`, `themes/` | 🟢 Complete |
| **Status Bar** | Persistent display | `StatusBar.tsx` | 🟢 Complete |
| | Token usage | `TokenCounter.tsx` | 🟢 Complete |
| | Cost tracker | `CostTracker.tsx` | 🟢 Complete |
| | Model indicator | StatusBar props | 🟢 Complete |
| | Git branch | StatusBar props | 🟢 Complete |
| | Agent indicator | StatusBar props | 🟢 Complete |
| **Natural Language** | NL-first input | `repl.tsx` | 🟢 Complete |
| | Intent detection | `IntentDetector.tsx`, `ConversationManager.ts` | 🟢 Complete |
| | Task refinement | `ConversationManager.ts` | 🟢 Complete |
| **Input Experience** | History navigation | `AdvancedInput.tsx` | 🟢 Complete |
| | Inline editing | `AdvancedInput.tsx` | 🟢 Complete |
| **Keyboard Shortcuts** | Ctrl+C/D | `ShortcutManager.ts` | 🟢 Complete |
| | Ctrl+U/W/A/E/P/N | `ShortcutManager.ts` | 🟢 Complete |
| | Tab/Escape | `ShortcutManager.ts` | 🟢 Complete |
| **Session Management** | Session persistence | `SessionStore.ts` | 🟢 Complete |
| | Session export | `SessionStore.ts` | 🟢 Complete |
| | Session branching | `SessionStore.ts` | 🟢 Complete |
| | Named sessions | `SessionStore.ts` | 🟢 Complete |
| | Session search | `SessionStore.ts` | 🟢 Complete |
| | Auto-save | `SessionAutoSaver.ts` | 🟢 Complete |
| | Session commands | `repl.tsx` | 🟢 Complete |

### 2.2 Partially Implemented Features (Yellow Status - 🟡)

| Feature | Current State | Gap Analysis | Remaining Work |
|---------|---------------|--------------|----------------|
| **Responsive layouts** | Basic width calculation in StatusBar | Missing adaptive component resizing | Implement responsive segment filtering |
| **Tab completion** | CompletionEngine implemented | Not wired to AdvancedInput | Wire `getCompletions()` to Tab handler |
| **History search (Ctrl+R)** | ShortcutManager event defined | No UI component | Create `HistorySearch.tsx` |
| **Multi-line input** | Shift+Enter defined | No heredoc-style support | Add `<<EOF` syntax support |
| **Subtask progress** | StatusBar supports props | Not receiving orchestrator events | Wire orchestrator events to StatusBar |
| **Agent handoff animation** | AgentPanel exists | No transition effects | Add handoff visual indicator |
| **AgentPanel enhancements** | Basic implementation | Missing parallel view | Add parallel execution display |
| **SubtaskTree enhancements** | Basic implementation | Missing collapse/expand | Add interactive tree |

### 2.3 Not Implemented Features (White Status - ⚪)

| Feature | ADR Reference | Priority | Estimated Effort |
|---------|---------------|----------|------------------|
| **Input preview** | ADR-008 Sec 2.2 | Low | 0.5 day |
| **Compact mode** | ROADMAP | Medium | 0.5 day |
| **Verbose mode** | ROADMAP | Medium | 0.5 day |
| **Parallel execution view** | ADR-008 Sec 4.1 | Medium | 1 day |
| **Agent thought display** | ROADMAP | Low | 1 day |

---

## 3. Technical Design: Remaining Features

### 3.1 Phase 1: Integration Work (HIGH PRIORITY - 3-4 days)

#### 3.1.1 Wire CompletionEngine to AdvancedInput

**Current State**:
- `CompletionEngine` class exists with command, path, agent, workflow, task, and history providers
- `AdvancedInput` has basic input handling but doesn't call CompletionEngine

**Technical Design**:

```typescript
// File: packages/cli/src/ui/components/AdvancedInput.tsx

// Add imports
import { CompletionEngine, CompletionSuggestion, CompletionContext } from '../../services/CompletionEngine.js';

// Add props
interface AdvancedInputProps {
  // ... existing props
  projectPath: string;
  agents: string[];
  workflows: string[];
  recentTasks: Array<{ id: string; description: string }>;
  inputHistory: string[];
}

// Add state and ref
const completionEngineRef = useRef(new CompletionEngine());
const [suggestions, setSuggestions] = useState<CompletionSuggestion[]>([]);
const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState(0);

// Create completion context
const completionContext: CompletionContext = useMemo(() => ({
  projectPath,
  agents,
  workflows,
  recentTasks,
  inputHistory,
}), [projectPath, agents, workflows, recentTasks, inputHistory]);

// Tab handler
const handleTab = useCallback(async () => {
  if (suggestions.length > 0) {
    // Accept current suggestion
    const suggestion = suggestions[selectedSuggestionIndex];
    applyCompletion(suggestion);
    setSuggestions([]);
  } else {
    // Get new suggestions
    const newSuggestions = await completionEngineRef.current.getCompletions(
      input,
      cursorPosition,
      completionContext
    );
    setSuggestions(newSuggestions);
    setSelectedSuggestionIndex(0);
  }
}, [input, cursorPosition, suggestions, selectedSuggestionIndex, completionContext]);

// Apply completion
const applyCompletion = (suggestion: CompletionSuggestion) => {
  // Find the prefix being completed and replace
  const beforeCursor = input.slice(0, cursorPosition);
  const afterCursor = input.slice(cursorPosition);

  // Determine replacement range based on suggestion type
  let replaceStart = cursorPosition;
  if (suggestion.type === 'command') {
    replaceStart = beforeCursor.lastIndexOf('/');
  } else if (suggestion.type === 'agent') {
    replaceStart = beforeCursor.lastIndexOf('@');
  } else {
    // Path or other - find last word boundary
    const match = beforeCursor.match(/[\w.\/~-]+$/);
    if (match) {
      replaceStart = cursorPosition - match[0].length;
    }
  }

  const newInput = beforeCursor.slice(0, replaceStart) + suggestion.value + afterCursor;
  setInput(newInput);
  setCursorPosition(replaceStart + suggestion.value.length);
};

// Render suggestions dropdown
{suggestions.length > 0 && (
  <Box flexDirection="column" marginTop={1}>
    {suggestions.slice(0, 8).map((s, i) => (
      <Text
        key={s.value}
        color={i === selectedSuggestionIndex ? 'green' : 'gray'}
        inverse={i === selectedSuggestionIndex}
      >
        {s.icon && `${s.icon} `}{s.displayValue || s.value}
        {s.description && <Text dimColor> - {s.description}</Text>}
      </Text>
    ))}
  </Box>
)}
```

**Files to modify**:
- `packages/cli/src/ui/components/AdvancedInput.tsx`
- `packages/cli/src/ui/App.tsx` (pass props)
- `packages/cli/src/repl.tsx` (provide context data)

**Test scenarios**:
1. Type `/` and press Tab - should show command suggestions
2. Type `@` and press Tab - should show agent suggestions
3. Type `./` and press Tab - should show file path suggestions
4. Arrow keys navigate suggestions
5. Enter/Tab accepts selection
6. Escape dismisses suggestions

---

#### 3.1.2 Integrate ConversationManager with REPL

**Current State**:
- `ConversationManager` class exists with intent detection, clarification flow, and context tracking
- `repl.tsx` doesn't use ConversationManager for context-aware processing

**Technical Design**:

```typescript
// File: packages/cli/src/repl.tsx

// Add to context
interface ApexContext {
  // ... existing
  conversationManager: ConversationManager | null;
}

const ctx: ApexContext = {
  // ... existing
  conversationManager: null,
};

// Initialize in startInkREPL
if (ctx.initialized) {
  ctx.conversationManager = new ConversationManager();
}

// Modify input handling in handleCommand/executeTask
async function handleInput(input: string): Promise<void> {
  if (!ctx.conversationManager) return;

  // Check for pending clarification first
  if (ctx.conversationManager.hasPendingClarification()) {
    const result = ctx.conversationManager.provideClarification(input);
    if (result.matched) {
      // Handle clarification response
      ctx.app?.addMessage({
        type: 'system',
        content: `Got it: ${result.value}`,
      });
      // Continue with clarified task
      return;
    }
  }

  // Detect intent
  const intent = ctx.conversationManager.detectIntent(input);

  switch (intent.type) {
    case 'command':
      // Handle as slash command
      const [cmd, ...args] = input.slice(1).split(/\s+/);
      await handleCommand(cmd, args);
      break;
    case 'question':
      // Could be routed to Q&A mode in future
      await executeTask(input);
      break;
    case 'task':
      await executeTask(input);
      break;
  }

  // Track in conversation context
  ctx.conversationManager.addMessage({ role: 'user', content: input });
}

// Add smart suggestions to App
const getSuggestions = (): string[] => {
  if (ctx.conversationManager) {
    return ctx.conversationManager.getSuggestions();
  }
  return [];
};
```

**Files to modify**:
- `packages/cli/src/repl.tsx`
- `packages/cli/src/ui/App.tsx` (display suggestions)

---

#### 3.1.3 StatusBar Session Timer and Subtask Progress

**Current State**:
- `StatusBar` component accepts `sessionStartTime` and `subtaskProgress` props
- `SessionTimer.tsx` component exists
- Props not being passed from App/REPL

**Technical Design**:

```typescript
// File: packages/cli/src/ui/App.tsx

// Add to AppState
interface AppState {
  // ... existing
  sessionStartTime?: Date;
  subtaskProgress?: { completed: number; total: number };
}

// In StatusBar render
<StatusBar
  // ... existing props
  sessionStartTime={state.sessionStartTime}
  subtaskProgress={state.subtaskProgress}
/>

// File: packages/cli/src/repl.tsx

// When session starts
await ctx.sessionAutoSaver.start(activeSessionId || undefined);
const session = ctx.sessionAutoSaver.getSession();
ctx.app?.updateState({
  sessionStartTime: session?.createdAt || new Date(),
});

// Subscribe to orchestrator subtask events
ctx.orchestrator.on('subtask:created', (data) => {
  const currentProgress = ctx.app?.getState().subtaskProgress || { completed: 0, total: 0 };
  ctx.app?.updateState({
    subtaskProgress: { completed: currentProgress.completed, total: currentProgress.total + 1 },
  });
});

ctx.orchestrator.on('subtask:completed', (data) => {
  const currentProgress = ctx.app?.getState().subtaskProgress || { completed: 0, total: 0 };
  ctx.app?.updateState({
    subtaskProgress: { completed: currentProgress.completed + 1, total: currentProgress.total },
  });
});
```

**Files to modify**:
- `packages/cli/src/ui/App.tsx`
- `packages/cli/src/repl.tsx`

---

#### 3.1.4 Wire ShortcutManager Event Handlers

**Current State**:
- `ShortcutManager` registers all shortcuts and emits events
- Events not connected to actual handlers

**Technical Design**:

```typescript
// File: packages/cli/src/repl.tsx

import { ShortcutManager } from './services/ShortcutManager.js';

// Add to context
interface ApexContext {
  // ... existing
  shortcutManager: ShortcutManager | null;
}

// Initialize
ctx.shortcutManager = new ShortcutManager();

// Wire handlers
ctx.shortcutManager.on('clear', () => {
  ctx.app?.clearMessages();
  clearConsole();
});

ctx.shortcutManager.on('cancel', () => {
  if (ctx.orchestrator && ctx.app?.getState().currentTask) {
    const taskId = ctx.app.getState().currentTask.id;
    ctx.orchestrator.cancelTask(taskId);
    ctx.app?.addMessage({ type: 'system', content: 'Task cancelled.' });
  }
});

ctx.shortcutManager.on('historySearch', () => {
  ctx.app?.setHistorySearchMode(true);
});

ctx.shortcutManager.on('command', (command: string) => {
  // Execute slash command
  const [cmd, ...args] = command.slice(1).split(/\s+/);
  handleCommand(cmd, args);
});

// In App.tsx - forward key events to ShortcutManager
useInput((input, key) => {
  const event: ShortcutEvent = {
    key: key.escape ? 'Escape' : key.return ? 'Enter' : key.tab ? 'Tab' : input,
    ctrl: key.ctrl || false,
    alt: key.meta || false,
    shift: key.shift || false,
    meta: false,
  };

  const handled = shortcutManager?.handleKey(event);
  if (!handled) {
    // Default input handling
  }
});
```

**Files to modify**:
- `packages/cli/src/repl.tsx`
- `packages/cli/src/ui/App.tsx`

---

### 3.2 Phase 2: Missing Components (HIGH PRIORITY - 4-5 days)

#### 3.2.1 HistorySearch Component

**File**: `packages/cli/src/ui/components/input/HistorySearch.tsx`

```typescript
import React, { useState, useEffect, useCallback } from 'react';
import { Box, Text, useInput, useFocus } from 'ink';

export interface HistorySearchProps {
  history: string[];
  onSelect: (item: string) => void;
  onCancel: () => void;
  isActive: boolean;
}

export function HistorySearch({
  history,
  onSelect,
  onCancel,
  isActive,
}: HistorySearchProps): React.ReactElement | null {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [matches, setMatches] = useState<string[]>([]);
  const { isFocused } = useFocus({ autoFocus: isActive });

  // Filter history based on query
  useEffect(() => {
    if (!isActive) {
      setQuery('');
      setMatches([]);
      return;
    }

    if (query.length === 0) {
      // Show recent history when no query
      setMatches(history.slice(-10).reverse());
    } else {
      const queryLower = query.toLowerCase();
      const filtered = history
        .filter(h => h.toLowerCase().includes(queryLower))
        .reverse()
        .slice(0, 10);
      setMatches(filtered);
    }
    setSelectedIndex(0);
  }, [query, history, isActive]);

  // Handle keyboard input
  useInput(
    (input, key) => {
      if (!isActive) return;

      if (key.escape) {
        onCancel();
      } else if (key.return) {
        if (matches[selectedIndex]) {
          onSelect(matches[selectedIndex]);
        }
      } else if (key.upArrow || (key.ctrl && input === 'p')) {
        setSelectedIndex(Math.max(0, selectedIndex - 1));
      } else if (key.downArrow || (key.ctrl && input === 'n')) {
        setSelectedIndex(Math.min(matches.length - 1, selectedIndex + 1));
      } else if (key.backspace || key.delete) {
        setQuery(q => q.slice(0, -1));
      } else if (input && input.length === 1 && !key.ctrl && !key.meta) {
        setQuery(q => q + input);
      }
    },
    { isActive }
  );

  if (!isActive) return null;

  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor="yellow"
      paddingX={1}
      marginBottom={1}
    >
      <Box>
        <Text color="yellow">(reverse-i-search)`</Text>
        <Text color="white">{query}</Text>
        <Text color="yellow">':</Text>
        {matches[selectedIndex] && (
          <Text color="gray"> {matches[selectedIndex].slice(0, 50)}</Text>
        )}
      </Box>

      {matches.length > 0 && (
        <Box flexDirection="column" marginTop={1}>
          {matches.slice(0, 5).map((match, index) => (
            <Box key={index}>
              <Text
                color={index === selectedIndex ? 'green' : 'gray'}
                inverse={index === selectedIndex}
              >
                {match.length > 70 ? match.slice(0, 67) + '...' : match}
              </Text>
            </Box>
          ))}
          {matches.length > 5 && (
            <Text color="gray" dimColor>
              ... and {matches.length - 5} more
            </Text>
          )}
        </Box>
      )}

      <Box marginTop={1}>
        <Text color="gray" dimColor>
          ↑↓ navigate | Enter select | Esc cancel
        </Text>
      </Box>
    </Box>
  );
}
```

**Test File**: `packages/cli/src/ui/components/input/__tests__/HistorySearch.test.tsx`

```typescript
import React from 'react';
import { render } from 'ink-testing-library';
import { HistorySearch } from '../HistorySearch.js';

describe('HistorySearch', () => {
  const mockHistory = [
    'fix the authentication bug',
    'add user profile feature',
    'implement dark mode',
    'refactor database queries',
    'update documentation',
  ];

  it('should render when active', () => {
    const { lastFrame } = render(
      <HistorySearch
        history={mockHistory}
        onSelect={() => {}}
        onCancel={() => {}}
        isActive={true}
      />
    );
    expect(lastFrame()).toContain('reverse-i-search');
  });

  it('should not render when inactive', () => {
    const { lastFrame } = render(
      <HistorySearch
        history={mockHistory}
        onSelect={() => {}}
        onCancel={() => {}}
        isActive={false}
      />
    );
    expect(lastFrame()).toBe('');
  });

  it('should filter history based on query', () => {
    const { lastFrame, stdin } = render(
      <HistorySearch
        history={mockHistory}
        onSelect={() => {}}
        onCancel={() => {}}
        isActive={true}
      />
    );

    stdin.write('auth');
    expect(lastFrame()).toContain('authentication');
  });

  it('should call onSelect when Enter pressed', () => {
    const onSelect = vi.fn();
    const { stdin } = render(
      <HistorySearch
        history={mockHistory}
        onSelect={onSelect}
        onCancel={() => {}}
        isActive={true}
      />
    );

    stdin.write('\r'); // Enter
    expect(onSelect).toHaveBeenCalled();
  });

  it('should call onCancel when Escape pressed', () => {
    const onCancel = vi.fn();
    const { stdin } = render(
      <HistorySearch
        history={mockHistory}
        onSelect={() => {}}
        onCancel={onCancel}
        isActive={true}
      />
    );

    stdin.write('\x1B'); // Escape
    expect(onCancel).toHaveBeenCalled();
  });
});
```

---

#### 3.2.2 AgentPanel Enhancements

**File**: `packages/cli/src/ui/components/agents/AgentPanel.tsx` (enhanced)

```typescript
import React, { useState, useEffect } from 'react';
import { Box, Text } from 'ink';

export interface AgentInfo {
  name: string;
  status: 'active' | 'waiting' | 'completed' | 'idle' | 'parallel';
  stage?: string;
  progress?: number;
  startedAt?: Date;
}

export interface AgentPanelProps {
  agents: AgentInfo[];
  currentAgent?: string;
  previousAgent?: string; // For handoff animation
  compact?: boolean;
  showParallel?: boolean;
  parallelAgents?: string[]; // Agents running in parallel
}

const agentColors: Record<string, string> = {
  planner: 'magenta',
  architect: 'blue',
  developer: 'green',
  reviewer: 'yellow',
  tester: 'cyan',
  devops: 'red',
};

const statusIcons: Record<AgentInfo['status'], string> = {
  active: '⚡',
  waiting: '○',
  completed: '✓',
  idle: '·',
  parallel: '⟂',
};

export function AgentPanel({
  agents,
  currentAgent,
  previousAgent,
  compact = false,
  showParallel = false,
  parallelAgents = [],
}: AgentPanelProps): React.ReactElement {
  // Handoff animation state
  const [showHandoff, setShowHandoff] = useState(false);

  useEffect(() => {
    if (previousAgent && currentAgent && previousAgent !== currentAgent) {
      setShowHandoff(true);
      const timer = setTimeout(() => setShowHandoff(false), 2000);
      return () => clearTimeout(timer);
    }
  }, [previousAgent, currentAgent]);

  if (compact) {
    return (
      <Box>
        {showHandoff && previousAgent && (
          <Text color="yellow" dimColor>
            {previousAgent} →{' '}
          </Text>
        )}
        {agents.map((agent, index) => (
          <React.Fragment key={agent.name}>
            <Text
              color={
                parallelAgents.includes(agent.name)
                  ? 'cyan'
                  : agent.name === currentAgent
                  ? agentColors[agent.name] || 'white'
                  : 'gray'
              }
            >
              {parallelAgents.includes(agent.name) ? '⟂' : statusIcons[agent.status]}
              {agent.name}
            </Text>
            {index < agents.length - 1 && <Text color="gray"> │ </Text>}
          </React.Fragment>
        ))}
      </Box>
    );
  }

  return (
    <Box flexDirection="column" borderStyle="round" borderColor="gray" paddingX={1}>
      <Text color="cyan" bold>
        Active Agents
      </Text>

      {/* Handoff animation */}
      {showHandoff && previousAgent && currentAgent && (
        <Box marginY={1}>
          <Text color={agentColors[previousAgent] || 'gray'}>{previousAgent}</Text>
          <Text color="yellow"> → </Text>
          <Text color={agentColors[currentAgent] || 'green'}>{currentAgent}</Text>
        </Box>
      )}

      {/* Parallel execution view */}
      {showParallel && parallelAgents.length > 1 && (
        <Box marginY={1} flexDirection="column">
          <Text color="cyan" dimColor>
            ⟂ Parallel Execution:
          </Text>
          <Box>
            {parallelAgents.map((name, i) => (
              <React.Fragment key={name}>
                <Text color={agentColors[name] || 'white'}>{name}</Text>
                {i < parallelAgents.length - 1 && <Text color="gray"> | </Text>}
              </React.Fragment>
            ))}
          </Box>
        </Box>
      )}

      {/* Agent list */}
      <Box marginTop={1} flexDirection="column">
        {agents.map(agent => (
          <AgentRow
            key={agent.name}
            agent={agent}
            isActive={agent.name === currentAgent}
            isParallel={parallelAgents.includes(agent.name)}
          />
        ))}
      </Box>
    </Box>
  );
}

function AgentRow({
  agent,
  isActive,
  isParallel,
}: {
  agent: AgentInfo;
  isActive: boolean;
  isParallel: boolean;
}): React.ReactElement {
  const color = agentColors[agent.name] || 'white';

  return (
    <Box>
      <Text color={isParallel ? 'cyan' : isActive ? color : 'gray'}>
        {isParallel ? '⟂' : statusIcons[agent.status]}{' '}
      </Text>
      <Text color={isActive ? color : 'gray'} bold={isActive}>
        {agent.name}
      </Text>
      {agent.stage && (
        <Text color="gray" dimColor>
          {' '}
          ({agent.stage})
        </Text>
      )}
      {agent.progress !== undefined && agent.progress > 0 && agent.progress < 100 && (
        <Text color="gray"> {agent.progress}%</Text>
      )}
      {agent.startedAt && isActive && (
        <Text color="gray" dimColor>
          {' '}
          {formatElapsed(agent.startedAt)}
        </Text>
      )}
    </Box>
  );
}

function formatElapsed(startedAt: Date): string {
  const elapsed = Date.now() - startedAt.getTime();
  const seconds = Math.floor(elapsed / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  return `${minutes}m ${seconds % 60}s`;
}
```

---

#### 3.2.3 SubtaskTree Enhancements

**File**: `packages/cli/src/ui/components/agents/SubtaskTree.tsx` (enhanced)

```typescript
import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';

export interface SubtaskNode {
  id: string;
  description: string;
  status: 'pending' | 'in-progress' | 'completed' | 'failed';
  children?: SubtaskNode[];
  estimatedTime?: number; // seconds
  elapsedTime?: number; // seconds
  progress?: number; // 0-100
}

export interface SubtaskTreeProps {
  task: SubtaskNode;
  maxDepth?: number;
  interactive?: boolean;
  onToggleCollapse?: (nodeId: string) => void;
}

const statusIcons: Record<SubtaskNode['status'], { icon: string; color: string }> = {
  pending: { icon: '○', color: 'gray' },
  'in-progress': { icon: '●', color: 'blue' },
  completed: { icon: '✓', color: 'green' },
  failed: { icon: '✗', color: 'red' },
};

export function SubtaskTree({
  task,
  maxDepth = 3,
  interactive = false,
  onToggleCollapse,
}: SubtaskTreeProps): React.ReactElement {
  const [collapsedNodes, setCollapsedNodes] = useState<Set<string>>(new Set());
  const [selectedNode, setSelectedNode] = useState<string | null>(null);

  const toggleCollapse = (nodeId: string) => {
    setCollapsedNodes(prev => {
      const next = new Set(prev);
      if (next.has(nodeId)) {
        next.delete(nodeId);
      } else {
        next.add(nodeId);
      }
      return next;
    });
    onToggleCollapse?.(nodeId);
  };

  // Flatten tree for navigation
  const flattenedNodes = flattenTree(task, 0, maxDepth, collapsedNodes);

  useInput(
    (input, key) => {
      if (!interactive) return;

      if (key.upArrow) {
        const currentIndex = flattenedNodes.findIndex(n => n.id === selectedNode);
        if (currentIndex > 0) {
          setSelectedNode(flattenedNodes[currentIndex - 1].id);
        }
      } else if (key.downArrow) {
        const currentIndex = flattenedNodes.findIndex(n => n.id === selectedNode);
        if (currentIndex < flattenedNodes.length - 1) {
          setSelectedNode(flattenedNodes[currentIndex + 1].id);
        }
      } else if (input === ' ' || key.return) {
        if (selectedNode) {
          toggleCollapse(selectedNode);
        }
      }
    },
    { isActive: interactive }
  );

  return (
    <Box flexDirection="column">
      <SubtaskNodeRow
        node={task}
        depth={0}
        maxDepth={maxDepth}
        isLast={true}
        collapsedNodes={collapsedNodes}
        selectedNode={selectedNode}
        interactive={interactive}
        onSelect={setSelectedNode}
        onToggle={toggleCollapse}
      />
    </Box>
  );
}

interface SubtaskNodeRowProps {
  node: SubtaskNode;
  depth: number;
  maxDepth: number;
  isLast: boolean;
  prefix?: string;
  collapsedNodes: Set<string>;
  selectedNode: string | null;
  interactive: boolean;
  onSelect: (id: string) => void;
  onToggle: (id: string) => void;
}

function SubtaskNodeRow({
  node,
  depth,
  maxDepth,
  isLast,
  prefix = '',
  collapsedNodes,
  selectedNode,
  interactive,
  onSelect,
  onToggle,
}: SubtaskNodeRowProps): React.ReactElement {
  const { icon, color } = statusIcons[node.status];
  const connector = depth === 0 ? '' : isLast ? '└── ' : '├── ';
  const childPrefix = prefix + (isLast ? '    ' : '│   ');
  const isCollapsed = collapsedNodes.has(node.id);
  const isSelected = selectedNode === node.id;
  const hasChildren = node.children && node.children.length > 0;

  const truncatedDesc =
    node.description.length > 50 ? node.description.slice(0, 47) + '...' : node.description;

  // Progress bar for in-progress tasks
  const progressBar =
    node.progress !== undefined && node.status === 'in-progress'
      ? renderProgressBar(node.progress)
      : null;

  return (
    <>
      <Box>
        <Text color="gray">{prefix}{connector}</Text>

        {/* Collapse indicator */}
        {hasChildren && (
          <Text color="gray">{isCollapsed ? '▶ ' : '▼ '}</Text>
        )}

        {/* Status icon */}
        <Text color={color}>[{icon}]</Text>

        {/* Description */}
        <Text
          color={node.status === 'in-progress' ? 'white' : 'gray'}
          inverse={isSelected && interactive}
        >
          {' '}{truncatedDesc}
        </Text>

        {/* Progress */}
        {progressBar && <Text color="blue"> {progressBar}</Text>}

        {/* Time estimate */}
        {node.elapsedTime !== undefined && node.status === 'in-progress' && (
          <Text color="gray" dimColor>
            {' '}({formatDuration(node.elapsedTime)}
            {node.estimatedTime && ` / ${formatDuration(node.estimatedTime)}`})
          </Text>
        )}
      </Box>

      {/* Children */}
      {hasChildren && !isCollapsed && depth < maxDepth && (
        <>
          {node.children!.map((child, index) => (
            <SubtaskNodeRow
              key={child.id}
              node={child}
              depth={depth + 1}
              maxDepth={maxDepth}
              isLast={index === node.children!.length - 1}
              prefix={childPrefix}
              collapsedNodes={collapsedNodes}
              selectedNode={selectedNode}
              interactive={interactive}
              onSelect={onSelect}
              onToggle={onToggle}
            />
          ))}
        </>
      )}

      {/* Collapsed indicator */}
      {hasChildren && isCollapsed && (
        <Box>
          <Text color="gray">{childPrefix}└── </Text>
          <Text color="gray" italic>
            ... {countDescendants(node)} subtasks collapsed
          </Text>
        </Box>
      )}

      {/* Depth limit indicator */}
      {hasChildren && !isCollapsed && depth >= maxDepth && (
        <Box>
          <Text color="gray">{childPrefix}└── </Text>
          <Text color="gray" italic>
            ... {node.children!.length} more at depth {depth + 1}
          </Text>
        </Box>
      )}
    </>
  );
}

function flattenTree(
  node: SubtaskNode,
  depth: number,
  maxDepth: number,
  collapsed: Set<string>
): SubtaskNode[] {
  const result = [node];
  if (node.children && depth < maxDepth && !collapsed.has(node.id)) {
    for (const child of node.children) {
      result.push(...flattenTree(child, depth + 1, maxDepth, collapsed));
    }
  }
  return result;
}

function countDescendants(node: SubtaskNode): number {
  let count = 0;
  if (node.children) {
    count += node.children.length;
    for (const child of node.children) {
      count += countDescendants(child);
    }
  }
  return count;
}

function renderProgressBar(progress: number, width: number = 10): string {
  const filled = Math.round((progress / 100) * width);
  const empty = width - filled;
  return `[${'█'.repeat(filled)}${'░'.repeat(empty)}] ${progress}%`;
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${minutes}m${secs > 0 ? ` ${secs}s` : ''}`;
}
```

---

#### 3.2.4 Display Modes (Compact/Verbose)

**File**: `packages/cli/src/repl.tsx` (additions)

```typescript
// Add display mode type
type DisplayMode = 'normal' | 'compact' | 'verbose';

// Add to context
interface ApexContext {
  // ... existing
  displayMode: DisplayMode;
}

const ctx: ApexContext = {
  // ... existing
  displayMode: 'normal',
};

// Add commands
async function handleCompact(): Promise<void> {
  ctx.displayMode = ctx.displayMode === 'compact' ? 'normal' : 'compact';
  ctx.app?.updateState({ displayMode: ctx.displayMode });
  ctx.app?.addMessage({
    type: 'system',
    content: `Compact mode: ${ctx.displayMode === 'compact' ? 'enabled' : 'disabled'}`,
  });
}

async function handleVerbose(): Promise<void> {
  ctx.displayMode = ctx.displayMode === 'verbose' ? 'normal' : 'verbose';
  ctx.app?.updateState({ displayMode: ctx.displayMode });
  ctx.app?.addMessage({
    type: 'system',
    content: `Verbose mode: ${ctx.displayMode === 'verbose' ? 'enabled' : 'disabled'}`,
  });
}

// Add to command router
case 'compact':
  await handleCompact();
  break;
case 'verbose':
  await handleVerbose();
  break;
```

**File**: `packages/cli/src/ui/App.tsx` (modifications)

```typescript
// Add to AppState
interface AppState {
  // ... existing
  displayMode: DisplayMode;
}

// Conditional rendering based on display mode
{state.displayMode !== 'compact' && (
  <ActivityLog entries={state.activityLog} />
)}

{state.displayMode === 'verbose' && (
  <Box flexDirection="column" marginTop={1}>
    <Text color="gray" dimColor>
      [DEBUG] Orchestrator state: {JSON.stringify(state.orchestratorDebug)}
    </Text>
  </Box>
)}
```

---

#### 3.2.5 Multi-line Heredoc Input

**File**: `packages/cli/src/ui/components/AdvancedInput.tsx` (additions)

```typescript
// Add state for heredoc mode
const [heredocMode, setHeredocMode] = useState(false);
const [heredocDelimiter, setHeredocDelimiter] = useState<string | null>(null);
const [heredocLines, setHeredocLines] = useState<string[]>([]);

// Heredoc detection regex
const heredocStartRegex = /<<(\w+)\s*$/;
const heredocEndRegex = (delimiter: string) => new RegExp(`^${delimiter}\\s*$`);

// Handle input
const handleInputChange = (value: string) => {
  if (heredocMode && heredocDelimiter) {
    // Check for delimiter to end heredoc
    if (heredocEndRegex(heredocDelimiter).test(value)) {
      const fullContent = heredocLines.join('\n');
      setHeredocMode(false);
      setHeredocDelimiter(null);
      setHeredocLines([]);
      onSubmit(fullContent);
      setInput('');
      return;
    }

    // Add line to buffer
    setHeredocLines([...heredocLines, value]);
    setInput('');
    return;
  }

  // Check for heredoc start
  const match = value.match(heredocStartRegex);
  if (match) {
    setHeredocMode(true);
    setHeredocDelimiter(match[1]);
    setHeredocLines([]);
    setInput('');
    return;
  }

  setInput(value);
};

// Handle Enter key
const handleSubmit = () => {
  if (heredocMode) {
    // Add current line to buffer and continue
    setHeredocLines([...heredocLines, input]);
    setInput('');
    return;
  }

  // Normal submit
  onSubmit(input);
  setInput('');
};

// Render heredoc indicator
{heredocMode && (
  <Box flexDirection="column" marginBottom={1}>
    <Text color="yellow">
      Heredoc mode (end with '{heredocDelimiter}')
    </Text>
    {heredocLines.map((line, i) => (
      <Text key={i} color="gray">
        {i + 1}: {line}
      </Text>
    ))}
  </Box>
)}

// Render input prompt
<Box>
  <Text color={heredocMode ? 'yellow' : 'cyan'}>
    {heredocMode ? '... ' : '> '}
  </Text>
  <TextInput
    value={input}
    onChange={handleInputChange}
    onSubmit={handleSubmit}
  />
</Box>
```

---

### 3.3 Phase 3: Polish & Testing (MEDIUM PRIORITY - 3-4 days)

#### 3.3.1 Test Coverage Enhancement

**Test Files to Create/Update**:

1. `packages/cli/src/ui/components/input/__tests__/HistorySearch.test.tsx` - New
2. `packages/cli/src/__tests__/v030-integration.test.tsx` - New
3. Review existing service tests for completeness

**Integration Test Structure**:

```typescript
// File: packages/cli/src/__tests__/v030-integration.test.tsx

describe('v0.3.0 Feature Integration', () => {
  describe('Session Management', () => {
    it('should create sessions on REPL start');
    it('should auto-save sessions on message threshold');
    it('should restore last session on restart');
    it('should list sessions with /session list');
    it('should load sessions with /session load');
    it('should save named sessions with /session save');
    it('should branch sessions with /session branch');
    it('should export sessions to markdown/json/html');
  });

  describe('Completion System', () => {
    it('should complete slash commands');
    it('should complete file paths');
    it('should complete agent names with @');
    it('should complete workflow names');
    it('should show history suggestions');
  });

  describe('Keyboard Shortcuts', () => {
    it('should handle Ctrl+C to cancel');
    it('should handle Ctrl+D to exit');
    it('should handle Ctrl+L to clear');
    it('should handle Ctrl+R for history search');
  });

  describe('Display Modes', () => {
    it('should toggle compact mode');
    it('should toggle verbose mode');
  });
});
```

---

## 4. Implementation Schedule

### Week 1: Integration (Phase 1) - 3-4 days

| Day | Task | Files | Effort |
|-----|------|-------|--------|
| 1 | Wire CompletionEngine to AdvancedInput | `AdvancedInput.tsx`, `App.tsx`, `repl.tsx` | 6-8h |
| 2 | Integrate ConversationManager | `repl.tsx` | 6-8h |
| 3 | StatusBar + ShortcutManager wiring | `StatusBar.tsx`, `App.tsx`, `repl.tsx` | 4-6h |

### Week 2: Missing Components (Phase 2) - 4-5 days

| Day | Task | Files | Effort |
|-----|------|-------|--------|
| 1-2 | HistorySearch component + tests | `HistorySearch.tsx`, tests | 10-12h |
| 2-3 | AgentPanel enhancements | `AgentPanel.tsx` | 6-8h |
| 3-4 | SubtaskTree enhancements | `SubtaskTree.tsx` | 6-8h |
| 4 | Display modes + heredoc input | `repl.tsx`, `AdvancedInput.tsx` | 6-8h |

### Week 3: Polish & Testing (Phase 3) - 3-4 days

| Day | Task | Files | Effort |
|-----|------|-------|--------|
| 1-2 | Test coverage enhancement | All test files | 12-16h |
| 3 | Integration tests | `v030-integration.test.tsx` | 6-8h |
| 4 | Documentation + ROADMAP update | `docs/*.md`, `ROADMAP.md` | 4-6h |

---

## 5. Risk Assessment

### Low Risk
- **Session management integration** - Services complete, well-tested
- **Completion engine wiring** - Clear API, straightforward integration
- **Shortcut handling** - Event system already in place

### Medium Risk
- **HistorySearch UI** - New component, needs careful UX testing
- **Multi-line heredoc** - State management complexity
- **Display mode rendering** - Conditional rendering edge cases

### High Risk
- **None identified** - All major components exist

---

## 6. Success Criteria

### Functional Requirements
- [ ] Tab completion shows suggestions for commands, paths, agents, workflows
- [ ] Ctrl+R opens history search with incremental filtering
- [ ] Sessions persist across REPL restarts
- [ ] All session commands work: list, load, save, branch, export, delete, info
- [ ] StatusBar shows session timer and subtask progress
- [ ] Agent handoffs are visually indicated
- [ ] Multi-line input works with heredoc syntax
- [ ] Compact and verbose modes toggle correctly

### Non-Functional Requirements
- [ ] Service test coverage >= 90%
- [ ] Component test coverage >= 80%
- [ ] No regression in existing functionality
- [ ] Completion response time < 100ms
- [ ] Session auto-save doesn't block UI

### Documentation Requirements
- [ ] ROADMAP.md updated with v0.3.0 completion status
- [ ] CLI usage guide created
- [ ] Getting started guide updated

---

## 7. Architecture Decision Records Index

| ADR | Title | Status |
|-----|-------|--------|
| ADR-001 | Rich Terminal UI Architecture | Implemented ✅ |
| ADR-002 | Natural Language Interface | Implemented ✅ |
| ADR-003 | Session Management | Implemented ✅ |
| ADR-004 | Keyboard Shortcuts System | Implemented ✅ |
| ADR-005 | Implementation Architecture | Implemented ✅ |
| ADR-006 | Feature Development Guide | Implemented ✅ |
| ADR-007 | Technical Design Summary | Implemented ✅ |
| ADR-008 | Comprehensive Technical Design | **Implemented ✅** |
| ADR-009 | Implementation Plan | **Implemented ✅** |
| ADR-010 | Feature Development Technical Design | **Implemented ✅** |

---

## 8. References

- ROADMAP.md - Feature status tracking
- CLAUDE.md - Development guidelines
- packages/cli/src/services/ - Service implementations
- packages/cli/src/ui/components/ - UI components
