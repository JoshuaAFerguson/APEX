# ADR 0005: PreviewPanel Component Wiring Architecture

## Status

**Proposed** - Technical design for wiring PreviewPanel to intent detection

## Context

This ADR documents the architectural design for wiring the PreviewPanel component to display intent detection results and processed input before submission. The feature enables users to review what the system detected before execution.

### Task Requirements

1. **PreviewPanel displays**: original input, detected intent type, confidence score, suggested workflow
2. **Conditional visibility**: Panel only appears when `previewMode` is enabled in config
3. **Keyboard navigation**: Enter=confirm, Esc=cancel, e=edit

## Current Implementation Analysis

### Already Implemented Components

The PreviewPanel feature is **substantially implemented**. Key components exist and are wired:

| Component | Location | Status |
|-----------|----------|--------|
| `PreviewPanel.tsx` | `packages/cli/src/ui/components/PreviewPanel.tsx` | ✅ Complete |
| `ConversationManager.detectIntent()` | `packages/cli/src/services/ConversationManager.ts` | ✅ Complete |
| `AppState.previewMode` | `packages/cli/src/ui/App.tsx` | ✅ Complete |
| `AppState.pendingPreview` | `packages/cli/src/ui/App.tsx` | ✅ Complete |
| Keyboard shortcuts (Enter/Esc/e) | `packages/cli/src/ui/App.tsx:311-340` | ✅ Complete |
| `/preview` command handler | `packages/cli/src/repl.tsx:1254-1300` | ✅ Complete |
| StatusBar indicator | `packages/cli/src/ui/components/StatusBar.tsx:497` | ✅ Complete |
| Config schema (`UIConfigSchema`) | `packages/core/src/types.ts:125-131` | ✅ Complete |

## Architecture Overview

### Component Hierarchy

```
┌─────────────────────────────────────────────────────────────┐
│                           App.tsx                           │
│  ┌─────────────────────────────────────────────────────────┐│
│  │                    AppState                             ││
│  │  • previewMode: boolean                                 ││
│  │  • pendingPreview?: { input, intent, timestamp }        ││
│  │  • editModeInput?: string                               ││
│  └─────────────────────────────────────────────────────────┘│
│                            │                                │
│  ┌─────────────────────────┼─────────────────────────────┐ │
│  │         useInput()      │    Keyboard Handler         │ │
│  │  - Enter → confirm      ▼                             │ │
│  │  - Esc → cancel     ┌───────────────────┐            │ │
│  │  - 'e' → edit       │  PreviewPanel     │            │ │
│  └─────────────────────│  (conditionally   │────────────┘ │
│                        │   rendered)        │              │
│                        └───────────────────┘              │
│                                                            │
│  ┌─────────────────────────────────────────────────────────┐│
│  │              ConversationManager                        ││
│  │              • detectIntent(input)                      ││
│  └─────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
```

### Data Flow Diagram

```
User Input
    │
    ▼
┌──────────────────────┐
│    handleInput()     │
│    (App.tsx:373)     │
└──────────┬───────────┘
           │
           ▼
┌──────────────────────┐
│  detectIntent(input) │ ──► Returns: { type, confidence, metadata }
│  (ConversationMgr)   │
└──────────┬───────────┘
           │
           ▼
┌──────────────────────────────────┐
│  Check: state.previewMode &&     │
│  !input.startsWith('/preview')   │
└──────────┬───────────────────────┘
           │
    ┌──────┴──────┐
    │             │
    ▼ YES         ▼ NO
┌────────────┐ ┌────────────┐
│ Store in   │ │ Execute    │
│ pending-   │ │ directly   │
│ Preview    │ └────────────┘
└─────┬──────┘
      │
      ▼
┌──────────────────────────────┐
│      PreviewPanel renders    │
│  • Shows input               │
│  • Shows intent type + icon  │
│  • Shows confidence (color)  │
│  • Shows workflow if task    │
│  • Action buttons            │
└──────────┬───────────────────┘
           │
           ▼ User Action
    ┌──────┴──────┬──────────────┐
    │             │              │
    ▼ Enter       ▼ Esc          ▼ 'e'
┌────────────┐ ┌────────────┐ ┌────────────┐
│ Clear      │ │ Clear      │ │ Set        │
│ pending    │ │ pending    │ │ editMode-  │
│ + Execute  │ │ + Message  │ │ Input      │
└────────────┘ └────────────┘ └────────────┘
```

## Interface Contracts

### PreviewPanelProps (Already Defined)

```typescript
interface PreviewPanelProps {
  input: string;                        // Raw user input text
  intent: {
    type: 'command' | 'task' | 'question' | 'clarification';
    confidence: number;                 // 0.0 - 1.0
    command?: string;                   // For command intents
    args?: string[];                    // Command arguments
    metadata?: Record<string, unknown>; // Additional context
  };
  workflow?: string;                    // Suggested workflow name
  onConfirm: () => void;               // Enter key callback
  onCancel: () => void;                // Escape key callback
  onEdit: () => void;                  // 'e' key callback
}
```

### Intent Detection Return Type

```typescript
interface IntentResult {
  type: 'command' | 'task' | 'question' | 'clarification';
  confidence: number;
  metadata?: {
    matchedPattern?: string;           // Pattern that matched
    suggestedWorkflow?: string;        // e.g., 'feature', 'bugfix', 'question'
    estimatedComplexity?: string;      // 'simple' | 'moderate' | 'complex'
    command?: string;                  // For commands
    args?: string[];                   // For commands
  };
}
```

### UIConfig Schema (Config File)

```typescript
const UIConfigSchema = z.object({
  previewMode: z.boolean().optional().default(true),
  previewConfidence: z.number().min(0).max(1).optional().default(0.7),
  autoExecuteHighConfidence: z.boolean().optional().default(false),
  previewTimeout: z.number().min(1000).optional().default(5000),
});
```

## Key Integration Points

### 1. Config to Initial State

**Current Issue**: `previewMode` defaults to `false` in `index.tsx:53`, not reading from config.

**Location**: `packages/cli/src/ui/index.tsx`

```typescript
// Line 53: Should read from config
previewMode: config?.ui?.previewMode ?? false,
```

### 2. PreviewPanel Rendering

**Location**: `packages/cli/src/ui/App.tsx:621-646`

```typescript
{state.pendingPreview && (
  <PreviewPanel
    input={state.pendingPreview.input}
    intent={state.pendingPreview.intent}
    workflow={state.pendingPreview.intent.metadata?.suggestedWorkflow as string}
    onConfirm={...}
    onCancel={...}
    onEdit={...}
  />
)}
```

### 3. Keyboard Shortcut Handling

**Location**: `packages/cli/src/ui/App.tsx:311-340`

- Priority-based handling when `pendingPreview` exists
- Returns early to prevent other shortcuts from firing
- Properly clears preview state on each action

### 4. Intent Detection Integration

**Location**: `packages/cli/src/ui/App.tsx:406-438`

```typescript
// Detect intent
const intent = conversationManager.detectIntent(input);

// Check preview mode
if (state.previewMode && !input.startsWith('/preview')) {
  setState(prev => ({
    ...prev,
    pendingPreview: {
      input,
      intent: { type, confidence, command, args, metadata },
      timestamp: new Date(),
    },
  }));
  return; // Don't execute
}
```

## Visual Design

### PreviewPanel Layout

```
┌──────────────────────────────────────────────────────────────┐
│ 📋 Input Preview                                       [on] │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│ Input: "create a login form with email and password"        │
│                                                              │
│ Detected Intent:                                             │
│ ┌────────────────────────────────────────────────────────┐  │
│ │ 📝 Task Intent                        Confidence: 70%  │  │
│ │ Action: Create task (feature workflow)                 │  │
│ │ Agent Flow: planner → architect → developer → tester   │  │
│ └────────────────────────────────────────────────────────┘  │
│                                                              │
│ [Enter] Confirm    [Esc] Cancel    [e] Edit                 │
└──────────────────────────────────────────────────────────────┘
```

### Confidence Color Coding

| Range | Color | Visual |
|-------|-------|--------|
| >= 80% | Green | High confidence - safe to proceed |
| >= 60% | Yellow | Medium confidence - review recommended |
| < 60% | Red | Low confidence - may need clarification |

### Intent Icons

| Intent Type | Icon | Description |
|-------------|------|-------------|
| Command | ⚡ | Slash command (100% confidence) |
| Task | 📝 | Feature/bugfix/modification request |
| Question | ❓ | Information query |
| Clarification | 💬 | Response to pending clarification |

## Minor Issues to Address

### 1. Config Initialization (Low Priority)

The initial state doesn't read `previewMode` from the config file.

**Fix**: Update `packages/cli/src/ui/index.tsx`:
```typescript
previewMode: config?.ui?.previewMode ?? false,
```

### 2. handleInput Dependency Array (Code Quality)

**Location**: `packages/cli/src/ui/App.tsx`

The `handleInput` useCallback doesn't include `state.previewMode` in dependencies, which could cause stale closures.

**Note**: This appears to work correctly because the state check uses the current state value from the closure, but it's a potential issue for future refactoring.

## Testing Considerations

### Unit Tests

- `PreviewPanel.test.tsx` - Component rendering for all intent types
- Confidence color coding tests
- Workflow display tests

### Integration Tests

- Preview mode toggle via `/preview` command
- End-to-end flow: input → preview → confirm/cancel
- Keyboard shortcut handling
- Edit mode return flow

### Edge Cases

- Empty input handling
- Very long input text truncation
- Rapid input changes
- Preview timeout behavior

## Security Considerations

1. **Input Sanitization**: Input is displayed as-is but treated as data, not code
2. **No XSS Concerns**: Terminal context doesn't execute JavaScript
3. **Confidence Bounds**: Always 0.0-1.0, enforced by detection logic

## Conclusion

The PreviewPanel wiring is **already substantially complete**. The architecture is sound with:

- Clear separation between detection, state management, and rendering
- Priority-based keyboard handling for modal behavior
- Proper data flow from input through detection to display
- Config-driven feature toggle support

The only minor enhancement needed is to initialize `previewMode` from the config file rather than defaulting to `false`.

## References

- ADR-0004: Input Preview Feature Architecture
- `docs/designs/input-preview-technical-design.md`
- Acceptance Criteria: v0.3.0 feature specification
