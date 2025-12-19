# ADR 040: Any-Keypress Cancellation of Auto-Execute Countdown

## Status

**Proposed** - Ready for implementation

## Context

The current preview mode with auto-execute countdown has a limited set of keyboard handlers:
- **Enter**: Confirms and immediately executes the pending action
- **Escape**: Cancels the preview entirely (clears `pendingPreview`)
- **'e'**: Enters edit mode (returns input to text field)

Any other keypress during preview mode is silently ignored (the code returns early at line 471 of App.tsx). This creates a usability issue:
- Users may want to stop the countdown to think without canceling the entire preview
- There's no way to "pause" and read the preview content at leisure
- The only options are to commit (Enter), fully cancel (Esc), or edit (e)

## Decision

### Behavior Specification

Implement "any-keypress cancellation" that:

1. **Cancels only the countdown** - Stops the auto-execute timer
2. **Preserves the preview** - The `pendingPreview` state remains intact
3. **Shows confirmation** - Displays system message: `'Auto-execute cancelled.'`
4. **Maintains existing shortcuts** - Enter, Escape, and 'e' retain their current behavior

#### Key Behaviors by Keypress

| Key | Action | Result |
|-----|--------|--------|
| Enter | Confirm | Execute immediately, clear preview |
| Escape | Cancel | Clear preview entirely |
| 'e' | Edit | Return to edit mode with input |
| **Any other key** | **Cancel countdown only** | **Stop timer, keep preview visible** |

### Technical Design

#### 1. State Changes

No new state properties are required. The existing `remainingMs` state already controls the countdown display:
- When `remainingMs` is `undefined`, no countdown is shown
- Setting `remainingMs` to `undefined` while keeping `pendingPreview` stops the countdown but keeps the preview

```typescript
// Current AppState (no changes needed)
interface AppState {
  // ...
  remainingMs?: number;           // Already controls countdown display
  pendingPreview?: {...};         // Already controls preview visibility
}
```

#### 2. Keyboard Handler Modification

**Location**: `packages/cli/src/ui/App.tsx`, lines 443-472

**Current Code** (lines 469-471):
```typescript
      // Don't process other shortcuts in preview mode
      return;
```

**Modified Code**:
```typescript
      // Any other key cancels the countdown but keeps preview visible
      if (state.remainingMs !== undefined) {
        setState(prev => ({ ...prev, remainingMs: undefined }));
        addMessage({ type: 'system', content: 'Auto-execute cancelled.' });
      }
      return;
```

#### 3. Countdown Timer Logic

**Location**: `packages/cli/src/ui/App.tsx`, lines 756-809

The existing countdown useEffect already handles `remainingMs` correctly:
- When `remainingMs` is undefined, no countdown updates occur
- The interval only decrements when `remainingMs` is defined
- Setting `remainingMs` to `undefined` effectively "pauses" the countdown permanently

**No changes required** to the countdown logic itself.

#### 4. PreviewPanel Display Updates

**Location**: `packages/cli/src/ui/components/PreviewPanel.tsx`, lines 247-254

The existing PreviewPanel already conditionally renders the countdown:
```typescript
{remainingMs !== undefined && (
  <Box>
    <Text color="gray">Auto-execute in </Text>
    <Text color={getCountdownColor(remainingMs / 1000)} bold>
      {formatCountdown(remainingMs)}
    </Text>
  </Box>
)}
```

When `remainingMs` is `undefined`, the countdown display disappears naturally, which is the desired UX.

**Optional Enhancement**: Add visual hint that countdown was cancelled:
```typescript
{remainingMs === undefined && state.pendingPreview && (
  <Text color="gray" dimColor>(Auto-execute paused)</Text>
)}
```

This requires passing additional state to PreviewPanel to differentiate between:
- Preview with active countdown (`remainingMs !== undefined`)
- Preview with cancelled countdown (`remainingMs === undefined` but was previously set)
- Preview that never had countdown (high confidence immediate preview)

**Decision**: For simplicity, skip this enhancement in initial implementation. The system message provides sufficient feedback.

### Architecture Diagram

```
User presses key during preview mode
            │
            ▼
    ┌───────────────────┐
    │  Key = Enter?     │──Yes──▶ Execute action, clear preview
    └───────────────────┘
            │ No
            ▼
    ┌───────────────────┐
    │  Key = Escape?    │──Yes──▶ Clear preview entirely
    └───────────────────┘
            │ No
            ▼
    ┌───────────────────┐
    │  Key = 'e'?       │──Yes──▶ Edit mode, return input
    └───────────────────┘
            │ No
            ▼
    ┌───────────────────────────┐
    │  remainingMs defined?     │──No──▶ Return (already cancelled)
    └───────────────────────────┘
            │ Yes
            ▼
    ┌───────────────────────────┐
    │ Set remainingMs = undefined│
    │ Show 'Auto-execute cancelled'│
    └───────────────────────────┘
            │
            ▼
        Return (preview still visible)
```

### Edge Cases

1. **Multiple keypresses**: Only first keypress triggers the message; subsequent keypresses do nothing (idempotent)
2. **High confidence auto-execute**: High confidence (>=0.95) previews still auto-execute immediately, so there's no countdown to cancel
3. **Key with modifiers (Ctrl, Alt)**: These are passed to ShortcutManager first. If unhandled, they would cancel countdown. This is acceptable behavior.
4. **Non-printable keys (arrows, function keys)**: These also cancel the countdown, which is the desired behavior for "any key"

### Testing Strategy

1. **Unit Tests** (`App.countdown.test.tsx`):
   - Keypress other than Enter/Esc/e cancels countdown
   - `remainingMs` becomes `undefined` after cancellation
   - `pendingPreview` remains defined after cancellation
   - System message is displayed
   - Multiple keypresses don't show multiple messages

2. **Integration Tests**:
   - Full flow: Start preview → countdown begins → press key → countdown stops → preview visible → confirm with Enter
   - Full flow: Start preview → countdown begins → press key → countdown stops → cancel with Esc

### Files to Modify

| File | Change |
|------|--------|
| `packages/cli/src/ui/App.tsx` | Add any-key handler in `useInput` callback (lines 469-471) |
| `packages/cli/src/ui/__tests__/App.countdown.test.tsx` | Add tests for any-key cancellation |
| `packages/cli/src/ui/__tests__/App.auto-execute.test.ts` | Add edge case tests |

### Implementation Estimate

- **Complexity**: Low
- **Lines of Code**: ~10 lines (implementation) + ~100 lines (tests)
- **Risk**: Low - Additive change with no breaking modifications

## Consequences

### Positive
- Users have more control over the preview experience
- Reduces accidental auto-execution when user needs more time to review
- Intuitive "press any key to stop" behavior familiar from many CLI tools
- Minimal implementation complexity

### Negative
- Users might accidentally stop countdown when not intended (mitigated by the preview remaining visible)
- Slightly more complex mental model (3 specific actions + 1 generic action)

### Neutral
- No changes to existing keyboard shortcut behavior
- No changes to countdown timer implementation
- PreviewPanel component unchanged (uses existing conditional rendering)

## Alternatives Considered

### 1. Add explicit "Pause" shortcut (e.g., 'p' or Space)
**Rejected**: Adds complexity. "Any key" is more intuitive and discoverable.

### 2. Allow resuming countdown after cancellation
**Rejected**: Adds complexity without clear use case. Users can simply wait for next input and re-submit.

### 3. Change 'any key' to confirm instead of cancel
**Rejected**: Dangerous UX - accidental keypresses would trigger actions.

### 4. Add visual indicator for "paused" state
**Deferred**: Can be added as enhancement if user feedback indicates need.
