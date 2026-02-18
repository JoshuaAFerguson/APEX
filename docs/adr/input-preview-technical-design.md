# Input Preview Feature - Technical Design

## Feature Summary

The input preview feature allows users to see what will happen before their input is executed. When enabled, the system shows a preview panel with:
- The detected intent (command, task, question, clarification)
- Confidence score with color coding
- Workflow information for task intents
- Confirm/Cancel/Edit options

## Implementation Status

### Acceptance Criteria Status

| Criterion | Status | Notes |
|-----------|--------|-------|
| `/preview` command toggles preview mode | IMPLEMENTED | Handler in `repl.tsx`, alias `/p` |
| Shows formatted preview before sending | IMPLEMENTED | `PreviewPanel.tsx` component |
| Preview includes intent detection result | IMPLEMENTED | Via `ConversationManager.detectIntent()` |
| User can confirm or cancel from preview | IMPLEMENTED | Enter/Escape keyboard handling |

### Bug Fixes Needed

1. **StatusBar indicator not showing** (Priority: High)
   - File: `packages/cli/src/ui/components/StatusBar.tsx`
   - Line: 289
   - Issue: `previewMode` should be `props.previewMode`

2. **Edit mode not implemented** (Priority: Medium)
   - Currently shows "Edit mode not yet implemented"
   - Need to return input text to InputPrompt for editing

3. **Dependency array issue** (Priority: Low)
   - File: `packages/cli/src/ui/App.tsx`
   - `handleInput` useCallback missing `state.previewMode` dependency

## Component Architecture

```
packages/cli/src/
├── repl.tsx                    # handlePreview() command handler
├── services/
│   └── ConversationManager.ts  # detectIntent() method
└── ui/
    ├── App.tsx                 # State management, keyboard handling
    └── components/
        ├── PreviewPanel.tsx    # Preview display component
        └── StatusBar.tsx       # Preview mode indicator
```

## Interface Contracts

### PreviewPanelProps

```typescript
interface PreviewPanelProps {
  input: string;                        // Raw user input
  intent: {
    type: 'command' | 'task' | 'question' | 'clarification';
    confidence: number;                 // 0.0 - 1.0
    command?: string;                   // For command intents
    args?: string[];                    // Command arguments
    metadata?: Record<string, unknown>; // Additional context
  };
  workflow?: string;                    // Suggested workflow name
  onConfirm: () => void;               // Called on Enter
  onCancel: () => void;                // Called on Escape
  onEdit: () => void;                  // Called on 'e'
}
```

### AppState Preview Fields

```typescript
interface AppState {
  // ... other fields
  previewMode: boolean;                 // Toggle state
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
}
```

### Intent Detection Return Type

```typescript
interface IntentResult {
  type: 'command' | 'task' | 'question' | 'clarification';
  confidence: number;
  metadata?: {
    matchedPattern?: string;
    suggestedWorkflow?: string;
    estimatedComplexity?: string;
    command?: string;
    args?: string[];
  };
}
```

## User Interaction Flow

```
1. User enables preview mode:
   > /preview
   System: "Preview mode enabled."

2. User enters input:
   > create a login form

3. Preview panel appears:
   ┌──────────────────────────────────────────┐
   │ 📋 Input Preview                    [on] │
   ├──────────────────────────────────────────┤
   │ Input: "create a login form"             │
   │                                          │
   │ Detected Intent:                         │
   │ ┌────────────────────────────────────┐   │
   │ │ 📝 Task Intent     Confidence: 70% │   │
   │ │ Action: Create task (feature)      │   │
   │ │ Agent Flow: planner → architect... │   │
   │ └────────────────────────────────────┘   │
   │                                          │
   │ [Enter] Confirm  [Esc] Cancel  [e] Edit  │
   └──────────────────────────────────────────┘

4. User presses Enter → Task executes
   Or presses Escape → Preview cleared, back to input
   Or presses 'e' → Returns to input for editing
```

## Keyboard Shortcuts

| Key | Action | Context |
|-----|--------|---------|
| Enter | Confirm and execute | When preview is shown |
| Escape | Cancel preview | When preview is shown |
| e | Edit input | When preview is shown |

## Confidence Color Mapping

| Range | Color | Meaning |
|-------|-------|---------|
| >= 80% | Green | High confidence |
| >= 60% | Yellow | Medium confidence |
| < 60% | Red | Low confidence |

## Intent Type Icons

| Intent | Icon | Description |
|--------|------|-------------|
| command | ⚡ | Slash command detected |
| task | 📝 | Task/feature request |
| question | ❓ | Question/inquiry |
| clarification | 💬 | Response to clarification |

## Testing Coverage

Tests are located in:
- `packages/cli/src/ui/components/__tests__/PreviewPanel.test.tsx`
- `packages/cli/src/ui/__tests__/preview-mode.integration.test.tsx`
- `packages/cli/src/ui/__tests__/preview-edge-cases.test.tsx`
- `packages/cli/src/__tests__/preview-feature-validation.test.ts`

Total: 79 tests covering:
- Basic rendering
- Intent type display
- Confidence color coding
- Workflow display
- Command intent details
- Edge cases (XSS, injection, performance)
- Accessibility

## Notes for Developer Stage

### Priority Order for Bug Fixes

1. Fix StatusBar `previewMode` reference (immediate visual feedback)
2. Implement Edit mode functionality (user-requested feature)
3. Fix dependency array warning (code quality)

### Implementation Guidance

For Edit mode implementation:
1. Store current input in a ref or state
2. On 'e' key, clear `pendingPreview` and set input back to InputPrompt
3. Consider using `useImperativeHandle` on InputPrompt for programmatic focus

### Performance Notes

- Intent detection is already debounced (300ms) in IntentDetector
- Preview state is ephemeral - no persistence needed
- Consider memoizing PreviewPanel if rendering becomes slow
