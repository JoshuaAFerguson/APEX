# ADR 0004: Input Preview Feature Architecture

## Status

**Accepted** - Feature substantially implemented

## Context

Users requested the ability to preview their input before execution to:
1. Verify the system correctly understands their intent
2. Review what action will be taken (command vs task execution)
3. Confirm or cancel before execution begins
4. Reduce accidental task submissions

## Decision

### Architecture Overview

The input preview feature is implemented as a **state-driven modal pattern** integrated into the existing CLI architecture. The implementation follows a clean separation of concerns:

```
                    +------------------+
                    |    User Input    |
                    +--------+---------+
                             |
                             v
                    +------------------+
                    |  Preview Mode    |
                    |    Check         |
                    +--------+---------+
                             |
            +----------------+----------------+
            |                                 |
            v                                 v
     Preview Enabled              Preview Disabled
            |                                 |
            v                                 v
     +-------------+                 +----------------+
     |  Intent     |                 | Direct Execute |
     |  Detection  |                 +----------------+
     +------+------+
            |
            v
     +-------------+
     |  Preview    |
     |  Panel      |
     +------+------+
            |
     User Confirmation
     (Enter/Esc/e)
            |
     +------+------+
     |   Execute   |
     |  or Cancel  |
     +-------------+
```

### Components

#### 1. PreviewPanel Component (`packages/cli/src/ui/components/PreviewPanel.tsx`)

**Responsibility**: Visual display of preview information

**Props Interface**:
```typescript
interface PreviewPanelProps {
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

**Design Decisions**:
- Uses Ink's `Box` and `Text` for terminal-native rendering
- Color-coded confidence indicator (green >= 80%, yellow >= 60%, red < 60%)
- Intent-specific icons for visual identification
- Keyboard shortcut hints displayed inline

#### 2. State Management (`packages/cli/src/ui/App.tsx`)

**AppState Extensions**:
```typescript
interface AppState {
  // ... existing state
  previewMode: boolean;           // Toggle for feature
  pendingPreview?: {              // Current preview data
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
}
```

**State Flow**:
1. `/preview` command toggles `previewMode`
2. When enabled, input creates `pendingPreview` instead of executing
3. User action (Enter/Esc/e) clears `pendingPreview` and either executes or cancels

#### 3. Command Handler (`packages/cli/src/repl.tsx`)

**Handler Function**: `handlePreview(args: string[])`

**Supported Arguments**:
- `on` - Enable preview mode
- `off` - Disable preview mode
- `toggle` (default) - Toggle current state
- `status` - Show current state

**Command Alias**: `/p` for quick access

#### 4. Intent Detection (`packages/cli/src/services/ConversationManager.ts`)

**Detection Method**: `detectIntent(input: string)`

**Classification Logic**:
```typescript
function detectIntent(input: string): IntentResult {
  // Priority order:
  // 1. Slash commands (100% confidence)
  // 2. Pending clarification responses (90% confidence)
  // 3. Question patterns (80% confidence)
  // 4. Task patterns (70% confidence)
  // 5. Default task (50% confidence)
}
```

**Pattern Matching**:
- Commands: `/^\//` (starts with slash)
- Questions: Interrogative words, question mark ending
- Tasks: Action verbs (create, fix, update, etc.)

### Data Flow

```
1. User types input
   |
2. handleInput() in App.tsx
   |
3. Check: state.previewMode && !input.startsWith('/preview')
   |
4. If true:
   a. Call conversationManager.detectIntent(input)
   b. Parse command details if slash command
   c. Set state.pendingPreview with intent data
   d. Return early (no execution)
   |
5. PreviewPanel renders with pendingPreview data
   |
6. useInput() listens for:
   - Enter -> Execute pending input
   - Escape -> Cancel and clear preview
   - 'e' -> Edit mode (return to input)
```

### Status Bar Integration

The StatusBar component displays a preview mode indicator when enabled:

```typescript
// In StatusBar.tsx
if (previewMode) {
  right.push({
    label: '',
    value: '  PREVIEW',
    valueColor: 'cyan',
    minWidth: 9,
  });
}
```

**Note**: Current implementation has a bug where `previewMode` is referenced from `props` but used as local variable. This should be fixed to use `props.previewMode`.

## Technical Decisions

### 1. Modal vs Inline Preview

**Decision**: Modal pattern (blocking input until confirmed)

**Rationale**:
- Clearer user mental model
- Prevents accidental executions
- Matches user expectations for "preview before action"
- Simpler state management

### 2. Intent Detection Location

**Decision**: ConversationManager service

**Rationale**:
- Centralized intent logic
- Reusable across components
- Access to conversation context for better detection
- Testable in isolation

### 3. Preview State Storage

**Decision**: AppState (React state)

**Rationale**:
- Ephemeral by nature (cleared on action)
- No persistence needed
- Simple to manage with React patterns
- Immediate UI updates on change

### 4. Keyboard Navigation

**Decision**: Enter/Escape/e shortcuts

**Rationale**:
- Familiar patterns (Enter = confirm, Escape = cancel)
- 'e' for edit is memorable
- Single-key actions for efficiency
- Consistent with terminal conventions

## Performance Considerations

### Intent Detection Debouncing

The IntentDetector component includes a 300ms debounce:
```typescript
const timer = setTimeout(() => {
  const intent = detectIntent(input);
  // ...
}, 300);
```

### State Updates

Preview state updates are minimal:
- Only one `pendingPreview` object at a time
- Timestamp for potential debouncing/staleness checks
- No deep object nesting

## Security Considerations

### Input Sanitization

- Input is treated as data, not executable
- No eval() or dynamic code execution
- XSS concerns mitigated by terminal context
- SQL injection not applicable (no database queries in preview)

### Metadata Boundaries

- Preview metadata is read-only display
- No user-controllable code execution paths
- Intent confidence is bounded (0.0 - 1.0)

## Testing Strategy

### Unit Tests
- `PreviewPanel.test.tsx` - Component rendering
- `ConversationManager.test.ts` - Intent detection

### Integration Tests
- `preview-mode.integration.test.tsx` - Full workflow testing
- `preview-edge-cases.test.tsx` - Edge case coverage

### Coverage Areas
- 79 tests across preview functionality
- Security patterns (XSS, injection)
- Performance (rapid input, debouncing)
- Accessibility (screen reader support)

## Known Issues

1. **StatusBar previewMode Bug**: In `buildSegments()` at line 289, `previewMode` is referenced without the `props.` prefix, causing the preview mode indicator to never display. Should be `props.previewMode`.
2. **Edit Mode Stub**: "Edit mode not yet implemented" message shown - need to implement returning focus to input with current text preserved
3. **handleInput Dependency Array**: The `handleInput` callback in App.tsx doesn't include `state.previewMode` in its dependency array, which could cause stale closure issues

## Future Enhancements

1. **Edit Mode Implementation**: Return input to text field for modification
2. **Workflow Preview**: Expand to show full agent sequence
3. **Cost Estimation**: Preview estimated token/cost before execution
4. **Custom Confidence Threshold**: User-configurable threshold for preview trigger

## Consequences

### Positive
- Users can verify intent before execution
- Reduced accidental task submissions
- Clear visual feedback on system interpretation
- Toggleable feature for power users

### Negative
- Additional keystroke required to confirm
- Slight latency from intent detection
- Learning curve for preview workflow

### Neutral
- State complexity increased marginally
- New UI component to maintain

## References

- Acceptance Criteria: v0.3.0 feature spec
- Related ADRs: ADR-0002 (Display Modes), ADR-0003 (Session Management)
- Test Coverage: `packages/cli/src/ui/components/__tests__/PreviewPanel.coverage.md`
