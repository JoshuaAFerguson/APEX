# ADR-051: Special Key Combinations Integration Tests

**Status**: Proposed
**Date**: 2025-02-06
**Author**: Architect Agent

## Context

APEX's CLI provides comprehensive keyboard handling through the `ShortcutManager` service and the `AdvancedInput` component. While unit tests exist for individual components, integration tests are needed to verify the end-to-end behavior of special key combinations:

- **Enter key**: Submission vs newline behavior in different contexts
- **Tab key**: Focus navigation and completion
- **Escape key**: Dismissal and cancellation behavior
- **Shift+Enter**: Multi-line input newlines
- **Ctrl/Cmd+A**: Select all functionality

### Current Architecture

The keyboard handling follows this event flow:

```
User Keypress
    │
    ▼
┌───────────────────┐
│  Ink useInput()   │
└─────────┬─────────┘
          │
    ┌─────┴─────┐
    │           │
    ▼           ▼
┌───────────┐ ┌─────────────────┐
│  App.tsx  │ │ AdvancedInput   │
│ (Global)  │ │ (Input Context) │
└─────┬─────┘ └────────┬────────┘
      │                │
      ▼                ▼
┌─────────────┐  ┌─────────────┐
│ ShortcutMgr │  │ Local State │
│ handleKey() │  │  Handlers   │
└─────┬───────┘  └──────┬──────┘
      │                 │
      ▼                 ▼
┌─────────────────────────────┐
│    Event Handlers / State   │
│    Updates / UI Changes     │
└─────────────────────────────┘
```

### Key Components

1. **ShortcutManager** (`packages/cli/src/services/ShortcutManager.ts`)
   - Manages keyboard shortcut registration
   - Context-aware shortcut resolution
   - Emits events for matched shortcuts

2. **AdvancedInput** (`packages/cli/src/ui/components/AdvancedInput.tsx`)
   - Handles Enter for submission and Shift+Enter for newlines
   - Tab for completion
   - Escape for dismissing suggestions
   - Arrow keys for navigation

3. **App.tsx** (`packages/cli/src/ui/App.tsx`)
   - Preview mode navigation (Enter confirm, Escape cancel)
   - Global shortcut handling via ShortcutManager

### Acceptance Criteria

Tests must cover:
1. **Enter key submission/newline behavior**
   - Enter submits input in normal mode
   - Enter confirms preview in preview mode
   - Enter accepts selected suggestion when suggestions visible

2. **Tab key focus navigation**
   - Tab triggers autocompletion
   - Tab applies selected suggestion
   - Tab navigates suggestions list

3. **Escape key behavior**
   - Escape dismisses suggestions
   - Escape cancels history search mode
   - Escape cancels preview mode

4. **Shift+Enter for newlines**
   - Shift+Enter inserts newline in multiline mode
   - Shift+Enter doesn't submit

5. **Ctrl/Cmd+A for select all**
   - Ctrl+A moves cursor to beginning of line (current behavior)
   - Note: "Select all" is a text selection feature that may not apply in terminal contexts

## Decision

### Test Architecture

We will create a comprehensive integration test file:
- **File**: `packages/cli/src/ui/__tests__/special-key-combinations.integration.test.ts`

### Test Categories

#### 1. Enter Key Behavior Tests

| Context | Expected Behavior |
|---------|-------------------|
| Normal input | Submits input, calls onSubmit |
| With selected suggestion | Submits selected suggestion |
| Preview mode | Confirms pending preview |
| Multiline mode (no shift) | Submits multiline content |

```typescript
describe('Enter Key Behavior', () => {
  describe('Normal Input Context', () => {
    it('should submit input on Enter', () => {
      // Type input, press Enter, verify onSubmit called
    });

    it('should submit empty string on Enter with no input', () => {
      // Press Enter with empty input, verify behavior
    });

    it('should clear input after submission', () => {
      // Submit and verify input is reset
    });
  });

  describe('Suggestion Context', () => {
    it('should submit selected suggestion on Enter', () => {
      // Show suggestions, navigate to one, press Enter
    });

    it('should submit first suggestion when none selected', () => {
      // Show suggestions, press Enter without navigation
    });
  });

  describe('Preview Mode Context', () => {
    it('should confirm and execute pending preview on Enter', () => {
      // Set up pending preview, press Enter, verify execution
    });

    it('should not add Enter to input when confirming preview', () => {
      // Verify Enter doesn't modify the pending input
    });
  });
});
```

#### 2. Tab Key Behavior Tests

| Context | Expected Behavior |
|---------|-------------------|
| With suggestions visible | Applies selected suggestion |
| With partial input | Triggers completion engine |
| No suggestions | No effect |
| In input context | Emits 'complete' event |

```typescript
describe('Tab Key Behavior', () => {
  describe('Completion Trigger', () => {
    it('should trigger tab completion with partial command', () => {
      // Type "/hel", press Tab, verify "/help" is completed
    });

    it('should apply selected suggestion on Tab', () => {
      // Show suggestions, press Tab, verify completion
    });

    it('should do nothing when no suggestions available', () => {
      // Clear input, press Tab, verify no change
    });
  });

  describe('Smart Completion', () => {
    it('should replace word at cursor position', () => {
      // Type partial word, Tab completes it
    });

    it('should handle command completion specially', () => {
      // Commands starting with "/" are replaced from "/"
    });
  });

  describe('ShortcutManager Integration', () => {
    it('should emit complete event in input context', () => {
      // Verify ShortcutManager receives Tab and emits event
    });

    it('should not trigger in non-input contexts', () => {
      // Global context should not trigger completion
    });
  });
});
```

#### 3. Escape Key Behavior Tests

| Context | Expected Behavior |
|---------|-------------------|
| Suggestions visible | Dismisses suggestions |
| History search mode | Exits history search |
| Preview mode | Cancels preview |
| Modal visible | Dismisses modal |
| Global | Emits 'dismiss' event |

```typescript
describe('Escape Key Behavior', () => {
  describe('Suggestions Context', () => {
    it('should dismiss suggestions on Escape', () => {
      // Show suggestions, press Escape, verify hidden
    });

    it('should reset selection index after dismiss', () => {
      // Navigate suggestions, Escape, verify index reset
    });
  });

  describe('History Search Context', () => {
    it('should exit history search mode on Escape', () => {
      // Enter Ctrl+R search mode, press Escape, verify exit
    });

    it('should preserve current input when exiting search', () => {
      // Verify input is not cleared
    });
  });

  describe('Preview Mode Context', () => {
    it('should cancel preview on Escape', () => {
      // Set up preview, press Escape, verify cancelled
    });

    it('should add system message on preview cancel', () => {
      // Verify "Preview cancelled." message
    });
  });

  describe('Global Context', () => {
    it('should emit dismiss event from any context', () => {
      // Verify ShortcutManager emits dismiss globally
    });
  });
});
```

#### 4. Shift+Enter Newline Tests

| Context | Expected Behavior |
|---------|-------------------|
| Multiline mode enabled | Inserts newline, continues editing |
| Multiline mode disabled | Ignored or submits |
| Multiple newlines | Maintains multiline content |

```typescript
describe('Shift+Enter Newline Behavior', () => {
  describe('Multiline Mode Enabled', () => {
    it('should insert newline on Shift+Enter', () => {
      // Type line1, Shift+Enter, type line2, verify multiline
    });

    it('should not submit on Shift+Enter', () => {
      // Press Shift+Enter, verify onSubmit not called
    });

    it('should enter multiline mode after first Shift+Enter', () => {
      // Verify internal state changes
    });

    it('should handle multiple newlines correctly', () => {
      // Create 3+ line input, verify all preserved
    });

    it('should submit multiline content on regular Enter', () => {
      // Create multiline, press Enter, verify joined content
    });
  });

  describe('Multiline Mode Disabled', () => {
    it('should not insert newline when multiline is false', () => {
      // Configure multiline: false, Shift+Enter has no effect
    });
  });
});
```

#### 5. Ctrl/Cmd+A Behavior Tests

| Context | Expected Behavior |
|---------|-------------------|
| Input context | Moves cursor to beginning of line |
| Global context | Triggers /agents command (current default) |
| With Shift | Triggers /agents command |

```typescript
describe('Ctrl+A Behavior', () => {
  describe('Input Context', () => {
    it('should move cursor to beginning of line on Ctrl+A', () => {
      // Type text, press Ctrl+A, verify cursor at position 0
    });

    it('should emit moveCursor(home) event', () => {
      // Verify ShortcutManager emits correct event
    });
  });

  describe('Global Context', () => {
    it('should not trigger cursor movement outside input', () => {
      // In processing context, Ctrl+A should not affect cursor
    });
  });

  describe('Ctrl+Shift+A', () => {
    it('should trigger /agents command', () => {
      // Verify Ctrl+Shift+A emits agents command
    });
  });
});
```

### Mock Strategy

```typescript
// Minimal mocking - keep real implementations where possible
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';

// Mock Ink's useInput to capture handlers
const mockUseInput = vi.fn();
vi.mock('ink', async () => {
  const actual = await vi.importActual('ink');
  return {
    ...actual,
    useInput: mockUseInput,
  };
});

// Helper to simulate key events
interface KeyEvent {
  return?: boolean;
  escape?: boolean;
  tab?: boolean;
  ctrl?: boolean;
  shift?: boolean;
  meta?: boolean;
  upArrow?: boolean;
  downArrow?: boolean;
  leftArrow?: boolean;
  rightArrow?: boolean;
  backspace?: boolean;
  delete?: boolean;
}

function createKeyEvent(input: string, modifiers: KeyEvent = {}): [string, KeyEvent] {
  return [input, modifiers];
}

// Helper to capture and invoke useInput handler
function captureInputHandler(): (input: string, key: KeyEvent) => void {
  const calls = mockUseInput.mock.calls;
  return calls[calls.length - 1]?.[0] ?? (() => {});
}
```

### Test Structure

```typescript
describe('Special Key Combinations Integration Tests', () => {
  let inputHandler: (input: string, key: KeyEvent) => void;

  beforeEach(() => {
    vi.clearAllMocks();
    mockUseInput.mockImplementation((handler) => {
      inputHandler = handler;
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Enter Key Behavior', () => {
    // See Enter Key tests above
  });

  describe('Tab Key Behavior', () => {
    // See Tab Key tests above
  });

  describe('Escape Key Behavior', () => {
    // See Escape Key tests above
  });

  describe('Shift+Enter Newline Behavior', () => {
    // See Shift+Enter tests above
  });

  describe('Ctrl+A Behavior', () => {
    // See Ctrl+A tests above
  });

  describe('Edge Cases and Interactions', () => {
    it('should handle rapid key sequences correctly', () => {
      // Tab → Enter rapid sequence
    });

    it('should handle modifier key releases', () => {
      // Shift released mid-Enter
    });

    it('should handle concurrent key events', () => {
      // Multiple keys pressed simultaneously
    });
  });

  describe('Context Transitions', () => {
    it('should handle context switch during key processing', () => {
      // Context changes between key down and up
    });

    it('should maintain proper context stack', () => {
      // Multiple pushes and pops
    });
  });
});
```

### Coverage Requirements

- Branch coverage: >= 70%
- Function coverage: >= 70%
- Line coverage: >= 70%
- Statement coverage: >= 70%

### File Locations

| File | Purpose |
|------|---------|
| `packages/cli/src/ui/__tests__/special-key-combinations.integration.test.ts` | Main integration test file |
| `packages/cli/src/ui/__tests__/test-utils.tsx` | Existing test utilities (extend if needed) |

### Dependencies

- `vitest` - Test framework
- `@testing-library/react` - React testing utilities
- `ShortcutManager` - Keyboard shortcut management
- `AdvancedInput` - Input component under test
- `App` - Application component for context testing

## Implementation Notes

### Priority Order

1. **Phase 1**: Enter key tests (most critical for UX)
2. **Phase 2**: Tab completion tests
3. **Phase 3**: Escape behavior tests
4. **Phase 4**: Shift+Enter multiline tests
5. **Phase 5**: Ctrl+A cursor movement tests
6. **Phase 6**: Edge cases and interactions

### Key Integration Points

1. **App.tsx (lines 443-510)**: Global useInput handler with preview mode logic
2. **AdvancedInput.tsx (lines 188-372)**: Component-level useInput handler
3. **ShortcutManager.ts (lines 72-94)**: handleKey method for shortcut resolution
4. **ShortcutManager.ts (lines 172-337)**: Default shortcut definitions

### Ink useInput Key Properties

The Ink library provides these key properties:
```typescript
interface Key {
  upArrow: boolean;
  downArrow: boolean;
  leftArrow: boolean;
  rightArrow: boolean;
  pageDown: boolean;
  pageUp: boolean;
  return: boolean;    // Enter key
  escape: boolean;
  ctrl: boolean;
  shift: boolean;
  tab: boolean;
  backspace: boolean;
  delete: boolean;
  meta: boolean;      // Cmd on macOS, Windows key on Windows
}
```

### Test Data Fixtures

```typescript
const mockSuggestions = [
  { value: '/help', description: 'Show help', type: 'command' },
  { value: '/status', description: 'Show status', type: 'command' },
  { value: '/agents', description: 'List agents', type: 'command' },
];

const mockHistory = [
  'previous command 1',
  'previous command 2',
  '/help',
  '/status',
];

const mockPreviewState = {
  input: 'test command',
  intent: { type: 'command', confidence: 0.95 },
  timestamp: new Date(),
};
```

## Consequences

### Positive

- Comprehensive verification of special key combinations
- Regression protection for critical UX interactions
- Documentation of expected keyboard behavior
- Clear test coverage for acceptance criteria

### Negative

- Additional test maintenance burden
- Mock complexity for Ink useInput testing
- Test execution time increase

### Risks

- Ink's useInput mock behavior may differ from real keyboard input
- Context state synchronization timing issues in tests
- Cross-platform keyboard differences (Ctrl vs Cmd)

## Alternatives Considered

### 1. Unit Tests Only

**Rejected**: Unit tests don't verify the full integration between components and the event flow through the system.

### 2. E2E Tests with Real Terminal

**Rejected**: Real terminal testing is slow, flaky, and difficult to automate across platforms.

### 3. Snapshot Testing for Key Handling

**Rejected**: Snapshots capture implementation details rather than behavior, making them fragile to refactoring.

## Related ADRs

- [ADR-004: Keyboard Shortcuts System](004-v030-keyboard-shortcuts.md)
- [ADR-0001: Keyboard Shortcuts Integration Tests](../packages/cli/docs/adr/0001-keyboard-shortcuts-integration-tests.md)
- [ADR-040: Any-Keypress Countdown Cancellation](ADR-040-any-keypress-countdown-cancellation.md)
- [ADR-011: Input Preview Test Architecture](ADR-011-input-preview-test-architecture.md)

## Appendix: Complete Test File Template

```typescript
/**
 * Integration tests for special key combinations
 *
 * Tests verify the end-to-end behavior of special keys:
 * - Enter key submission/newline behavior
 * - Tab key focus navigation
 * - Escape key behavior
 * - Shift+Enter for newlines
 * - Ctrl/Cmd+A for select all/cursor movement
 *
 * Acceptance Criteria Coverage:
 * 1. Enter key submission/newline behavior
 * 2. Tab key focus navigation
 * 3. Escape key behavior
 * 4. Shift+Enter for newlines
 * 5. Ctrl/Cmd+A for select all
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { ShortcutManager, ShortcutEvent, ShortcutContext } from '../../services/ShortcutManager';

// Test implementation follows the structure defined in this ADR
```
