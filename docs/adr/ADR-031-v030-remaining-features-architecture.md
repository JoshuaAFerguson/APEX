# ADR-031: v0.3.0 Remaining Features - Architecture Design

## Status
Accepted (Architecture Stage)

## Date
2024-12-18

## Context

This document provides the **technical architecture design** for completing the remaining v0.3.0 features in APEX. Based on analysis of the ROADMAP.md, existing ADRs (especially ADR-030), and current implementation state, the following features require completion:

### Remaining Features Per ROADMAP.md (v0.3.0 Section)

1. **Input Preview** - `⚪ Input preview - Show what will be sent before execution`
2. **Compact Mode** - `⚪ Compact mode - Condensed output for experienced users`
3. **Verbose Mode** - `⚪ Verbose mode - Detailed output for debugging`
4. **Integration Tests** - Phase 3 item in Development Plan
5. **Documentation Updates** - Phase 3 item in Development Plan

## Executive Summary

After thorough codebase analysis, the **core features are already substantially implemented**:

| Feature | Implementation Status | Remaining Work |
|---------|----------------------|----------------|
| Input Preview | ✅ Complete | Minor StatusBar fix |
| Compact Mode | ✅ Complete | Documentation |
| Verbose Mode | ✅ Complete | Documentation |
| Integration Tests | 🟡 Partial | Comprehensive test suite |
| Documentation | 🟡 Partial | User guides |

The primary remaining work is **verification, testing, and documentation** rather than new feature development.

---

## Technical Architecture Analysis

### 1. Input Preview Feature

#### 1.1 Current Implementation Status: ✅ COMPLETE

**Evidence**:
- `PreviewPanel.tsx` component exists at `packages/cli/src/ui/components/PreviewPanel.tsx`
- Full `/preview` command handler in `repl.tsx` (lines 1254-1300)
- Complete keyboard navigation: Enter (confirm), Escape (cancel), E (edit)
- `AppState` contains `previewMode: boolean` and `pendingPreview` state object
- `App.tsx` renders `PreviewPanel` conditionally when `state.pendingPreview` exists
- StatusBar displays preview mode indicator (`📋 PREVIEW` in cyan)

**Architecture Flow**:
```
User types input
       │
       ▼
┌──────────────────────────────┐
│   handleInput() in App.tsx   │
│   - Checks state.previewMode │
└──────────────┬───────────────┘
               │
    ┌──────────┴──────────┐
    │                     │
Preview OFF          Preview ON
    │                     │
    ▼                     ▼
Direct Execute    detectIntent(input)
                         │
                         ▼
                Store pendingPreview
                         │
                         ▼
                ┌────────────────────────────┐
                │     PreviewPanel renders   │
                │ - Shows input text         │
                │ - Shows detected intent    │
                │ - Shows confidence %       │
                │ - Shows action buttons     │
                └────────────┬───────────────┘
                             │
              ┌──────────────┼──────────────┐
              │              │              │
           Enter          Escape           E
              │              │              │
              ▼              ▼              ▼
          Execute        Cancel         Return to
           input        preview        edit mode
```

**Component Interface**:
```typescript
// PreviewPanel.tsx
export interface PreviewPanelProps {
  input: string;
  intent: {
    type: 'command' | 'task' | 'question' | 'clarification';
    confidence: number;
    command?: string;
    args?: string[];
    metadata?: Record<string, unknown>;
  };
  workflow?: string;
  onConfirm: () => void;
  onCancel: () => void;
  onEdit: () => void;
}
```

**State Management** (in AppState):
```typescript
export interface AppState {
  // Preview mode state
  previewMode: boolean;
  pendingPreview?: {
    input: string;
    intent: {
      type: 'command' | 'task' | 'question' | 'clarification';
      confidence: number;
      command?: string;
      args?: string[];
      metadata?: Record<string, unknown>;
    };
    timestamp: Date;
  };
  // Edit mode support
  editModeInput?: string;
}
```

#### 1.2 Remaining Work: Minor Polish

1. **StatusBar Preview Indicator**: Verify `previewMode` prop is properly passed from App.tsx to StatusBar.tsx (confirmed in code analysis)
2. **Documentation**: Create user guide for preview feature

---

### 2. Compact Mode

#### 2.1 Current Implementation Status: ✅ COMPLETE

**Evidence**:
- `/compact` command handler in `repl.tsx` (lines 1226-1238)
- Toggle behavior: `normal` ↔ `compact`
- StatusBar has compact mode filtering (shows only: connection, gitBranch, cost)
- Message filtering in App.tsx hides system messages and tool calls in compact mode
- `DisplayMode` type exported from `@apexcli/core`

**Architecture**:
```typescript
// Type definition in @apexcli/core
export type DisplayMode = 'normal' | 'compact' | 'verbose';

// State management
interface AppState {
  displayMode: DisplayMode;  // Default: 'normal'
}

// Command handler (repl.tsx)
async function handleCompact(): Promise<void> {
  const currentState = ctx.app?.getState();
  const newMode = currentState?.displayMode === 'compact' ? 'normal' : 'compact';
  ctx.app?.updateState({ displayMode: newMode });
  // ... feedback message
}
```

**Component Behavior by Mode**:

| Component | Normal | Compact |
|-----------|--------|---------|
| StatusBar | All segments by priority | Only: connection, branch, cost |
| Messages | All types shown | Hides system & tool messages |
| AgentPanel | Full agent list | Single-line current agent |
| TaskProgress | Full progress | Single-line status |
| ResponseStream | Full content | Truncated content |

**StatusBar Compact Implementation** (StatusBar.tsx lines 666-677):
```typescript
function filterByDisplayMode(
  segments: ResponsiveSegment[],
  displayMode: 'normal' | 'compact' | 'verbose'
): ResponsiveSegment[] {
  if (displayMode === 'compact') {
    // In compact mode, show only connection, git branch, and cost
    return segments.filter(s =>
      s.id === 'connection' ||
      s.id === 'gitBranch' ||
      s.id === 'cost'
    );
  }
  // ...
}
```

#### 2.2 Remaining Work: Documentation

- Create user guide explaining compact mode behavior
- Update getting-started docs

---

### 3. Verbose Mode

#### 3.1 Current Implementation Status: ✅ COMPLETE

**Evidence**:
- `/verbose` command handler in `repl.tsx` (lines 1240-1252)
- Toggle behavior: `normal` ↔ `verbose`
- StatusBar shows all segments including token breakdown
- Detailed timing information support (`detailedTiming` prop)
- VerboseAgentRow component exists for debug info

**Architecture**:
```typescript
// Command handler (repl.tsx)
async function handleVerbose(): Promise<void> {
  const currentState = ctx.app?.getState();
  const newMode = currentState?.displayMode === 'verbose' ? 'normal' : 'verbose';
  ctx.app?.updateState({ displayMode: newMode });
  // ... feedback message
}
```

**Verbose Mode Enhancements**:

| Component | Normal | Verbose |
|-----------|--------|---------|
| StatusBar | Standard metrics | + token breakdown (input→output), timing details |
| Messages | Standard content | + timestamps, message IDs |
| ActivityLog | Filter by level | Auto-sets debug level |
| AgentPanel | Basic info | + debug info via VerboseAgentRow |
| ToolCall | Summary | Full input/output JSON |

**StatusBar Verbose Features** (StatusBar.tsx):
```typescript
// Token breakdown in verbose mode (lines 503-535)
if (props.displayMode === 'verbose') {
  // Show input→output breakdown
  segments.push({
    id: 'tokensBreakdown',
    label: 'tokens:',
    value: formatTokenBreakdown(props.tokens.input, props.tokens.output),
    // ...
  });
  // Also show total
  segments.push({
    id: 'tokensTotal',
    label: 'total:',
    value: formatTokens(props.tokens.input, props.tokens.output),
    // ...
  });
}

// Detailed timing (lines 449-500)
if (props.displayMode === 'verbose' && props.detailedTiming) {
  // Active time, idle time, stage time segments
}
```

#### 3.2 Remaining Work: Documentation

- Create user guide explaining verbose mode features
- Document all verbose-only information available

---

### 4. Integration Tests

#### 4.1 Current Implementation Status: 🟡 PARTIAL

**Existing Test Coverage**:
- Display mode tests: `display-mode-acceptance.test.ts`, `display-modes.integration.test.ts`
- Preview workflow tests: `preview-workflow.integration.test.tsx` (referenced)
- Component-level tests for StatusBar, AgentPanel, etc.
- Service tests: SessionStore, CompletionEngine, ShortcutManager, ConversationManager

**Gap Analysis**:
- Missing: Comprehensive end-to-end v0.3.0 feature integration test suite
- Missing: Cross-feature interaction tests (e.g., preview + compact mode)

#### 4.2 Technical Design for Integration Tests

**File**: `packages/cli/src/__tests__/v030-features.integration.test.tsx`

**Test Architecture**:
```typescript
describe('v0.3.0 Feature Integration', () => {
  // Test fixtures
  let app: InkAppInstance;
  let orchestrator: MockOrchestrator;

  describe('Display Mode Transitions', () => {
    it('should toggle compact mode via /compact command', async () => {
      // Initial state: normal
      expect(app.getState().displayMode).toBe('normal');

      // Execute /compact
      await app.handleInput('/compact');

      // Verify state change
      expect(app.getState().displayMode).toBe('compact');

      // Verify StatusBar shows only essential segments
      // Verify messages are filtered
    });

    it('should toggle verbose mode via /verbose command', async () => {
      // Similar pattern
    });

    it('should return to normal from compact via /compact', async () => {
      app.updateState({ displayMode: 'compact' });
      await app.handleInput('/compact');
      expect(app.getState().displayMode).toBe('normal');
    });

    it('should return to normal from verbose via /verbose', async () => {
      // Similar pattern
    });
  });

  describe('Preview Mode Workflow', () => {
    it('should enable preview mode via /preview on', async () => {
      await app.handleInput('/preview on');
      expect(app.getState().previewMode).toBe(true);
    });

    it('should show preview panel when input is entered in preview mode', async () => {
      app.updateState({ previewMode: true });
      await app.handleInput('create a new feature');
      expect(app.getState().pendingPreview).toBeDefined();
      expect(app.getState().pendingPreview?.input).toBe('create a new feature');
    });

    it('should execute input on Enter confirmation', async () => {
      // Setup preview state
      // Simulate Enter key
      // Verify execution
    });

    it('should cancel preview on Escape', async () => {
      // Setup preview state
      // Simulate Escape key
      // Verify pendingPreview is cleared
    });

    it('should return to edit mode on E key', async () => {
      // Setup preview state
      // Simulate E key
      // Verify editModeInput is set
    });
  });

  describe('Compound State Interactions', () => {
    it('should respect display mode in preview panel', async () => {
      // Enable compact mode + preview mode
      // Verify preview panel renders appropriately
    });

    it('should persist display mode across commands', async () => {
      await app.handleInput('/compact');
      await app.handleInput('/status');
      expect(app.getState().displayMode).toBe('compact');
    });
  });

  describe('Session State Persistence', () => {
    it('should maintain display mode within session', async () => {
      // Verify mode is in-memory only (per ADR-020)
    });
  });

  describe('StatusBar Integration', () => {
    it('should show preview indicator when previewMode is true', async () => {
      app.updateState({ previewMode: true });
      // Verify StatusBar renders preview indicator
    });

    it('should show thoughts indicator when showThoughts is true', async () => {
      app.updateState({ showThoughts: true });
      // Verify StatusBar renders thoughts indicator
    });
  });
});
```

**Test Utilities Required**:
```typescript
// Test helpers
function createTestApp(options?: Partial<AppProps>): {
  app: InkAppInstance;
  getState: () => AppState;
  handleInput: (input: string) => Promise<void>;
  simulateKey: (key: ShortcutEvent) => void;
}

// Mock orchestrator for testing
class MockOrchestrator {
  events = new EventEmitter();
  emit(event: string, ...args: any[]) { this.events.emit(event, ...args); }
  on(event: string, handler: (...args: any[]) => void) { this.events.on(event, handler); }
}
```

---

### 5. Documentation Updates

#### 5.1 Current Documentation Status: 🟡 PARTIAL

**Existing Documentation**:
- ADRs (001-030) - Technical implementation details
- ROADMAP.md - Feature status tracking
- CLAUDE.md - Project overview

**Missing Documentation**:
- User-facing guides in `docs/` directory
- Feature-specific usage documentation

#### 5.2 Documentation Architecture

**Required Files**:

1. **`docs/user-guide/display-modes.md`**
   ```markdown
   # Display Modes

   APEX supports three display modes to customize your CLI experience.

   ## Normal Mode (Default)
   Standard display with all information visible.

   ## Compact Mode
   Use `/compact` to toggle condensed output for experienced users.

   Features:
   - Single-line status bar (connection, branch, cost only)
   - System messages hidden
   - Tool calls hidden
   - Truncated response content

   ## Verbose Mode
   Use `/verbose` to toggle detailed debug output.

   Features:
   - Full token breakdown (input→output)
   - Detailed timing information
   - Debug-level logs in Activity Log
   - Full tool input/output
   ```

2. **`docs/user-guide/input-preview.md`**
   ```markdown
   # Input Preview

   Preview your input before execution to verify intent detection.

   ## Enabling Preview Mode
   ```
   /preview on      # Enable preview mode
   /preview off     # Disable preview mode
   /preview toggle  # Toggle preview mode
   /preview status  # Check current status
   ```

   ## Using Preview Mode
   When enabled, your input shows:
   - Raw input text
   - Detected intent (command/task/question)
   - Confidence percentage
   - Planned action

   ## Keyboard Navigation
   - `Enter` - Confirm and execute
   - `Escape` - Cancel preview
   - `E` - Return to edit mode
   ```

3. **`docs/getting-started.md` Updates**
   - Add v0.3.0 feature highlights section
   - Reference display modes and preview guides

---

## Implementation Checklist

### Phase 1: Verification (0.5 day)
- [ ] Verify Input Preview feature works end-to-end
- [ ] Verify Compact Mode affects all components correctly
- [ ] Verify Verbose Mode shows all debug information
- [ ] Verify StatusBar indicators for preview/thoughts modes

### Phase 2: Integration Tests (1 day)
- [ ] Create `v030-features.integration.test.tsx`
- [ ] Test display mode transitions
- [ ] Test preview mode workflow
- [ ] Test compound state interactions
- [ ] Test session state persistence

### Phase 3: Documentation (1 day)
- [ ] Create `docs/user-guide/display-modes.md`
- [ ] Create `docs/user-guide/input-preview.md`
- [ ] Update `docs/getting-started.md` with v0.3.0 features
- [ ] Update ROADMAP.md to mark features complete

### Phase 4: Final Verification (0.5 day)
- [ ] Run full test suite
- [ ] Manual testing of all display mode transitions
- [ ] Manual testing of preview workflow

---

## Technical Decisions

### D1: Display Mode State Persistence

**Decision**: Display mode is stored in-memory only (not persisted to disk)

**Rationale**:
- Each new session starts with `normal` mode for consistent UX
- Avoids surprising behavior from previous session state
- Reduces configuration file complexity
- Can be easily changed later if user feedback requests persistence

### D2: Preview Mode Integration Point

**Decision**: Preview mode intercepts input in `handleInput()` before processing

**Rationale**:
- Single point of interception for all input types
- Clean separation between preview logic and execution logic
- Allows preview to show intent detection before any side effects

### D3: Component Display Mode Awareness

**Decision**: Each component receives `displayMode` as a prop and handles its own rendering

**Rationale**:
- Components are self-contained and testable in isolation
- No global state mutation during render
- Easy to add new components with display mode support

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Test coverage gaps | Low | Medium | Comprehensive integration test suite |
| Display mode inconsistency | Low | Low | All components already implemented consistently |
| Documentation accuracy | Medium | Low | Test examples in documentation |
| Preview mode edge cases | Low | Medium | Extensive keyboard event handling already implemented |

---

## Success Criteria

1. **Functional**
   - All `/preview`, `/compact`, `/verbose` commands work correctly
   - StatusBar shows appropriate indicators for each mode
   - All components respect display mode settings
   - Preview workflow supports confirm/cancel/edit actions

2. **Non-Functional**
   - Integration test coverage >= 80% for v0.3.0 features
   - No regression in existing functionality
   - Documentation is clear and accurate

3. **Acceptance**
   - ROADMAP.md shows all v0.3.0 items as 🟢 Complete
   - User guides are published in docs/

---

## References

- ADR-007: Input Preview Feature (`.apex/docs/adr/ADR-007-input-preview-feature.md`)
- ADR-020: Display Modes Compact and Verbose (`docs/adr/ADR-020-display-modes-compact-verbose.md`)
- ADR-030: v0.3.0 Remaining Features Technical Design (`docs/adr/ADR-030-v030-remaining-features-technical-design.md`)
- ROADMAP.md v0.3.0 section
