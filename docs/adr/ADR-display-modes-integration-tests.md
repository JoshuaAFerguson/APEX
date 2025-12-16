# ADR: Display Modes Integration Tests for v030-features.integration.test.tsx

## Status
Proposed

## Context
The v030-features.integration.test.tsx file has existing display modes tests (lines 1117-1336) but they are shallow and don't adequately test the acceptance criteria:
- Compact mode (minimal StatusBar)
- Verbose mode (full StatusBar)
- Normal mode responsive filtering
- Mode switching behavior

The existing tests primarily check that components render without errors but don't verify mode-specific behavior in an integration context.

## Decision

### Test Architecture

We will add comprehensive integration tests to the existing `describe('Display Modes Integration')` block in `v030-features.integration.test.tsx`. The tests will follow the existing patterns in the file while providing deeper coverage.

### Test Structure

```
describe('Display Modes Integration', () => {
  // Existing tests (keep)

  // NEW: Compact Mode - Minimal StatusBar Tests
  describe('Compact Mode - Minimal StatusBar', () => {
    - should show only connection indicator in compact mode
    - should show only active agent name in compact mode
    - should show only elapsed timer in compact mode
    - should hide git branch in compact mode
    - should hide workflow stage in compact mode
    - should hide token/cost details in compact mode
    - should hide API/web URLs in compact mode
    - should hide session name in compact mode
    - should handle compact mode with all props provided
  })

  // NEW: Verbose Mode - Full StatusBar Tests
  describe('Verbose Mode - Full StatusBar', () => {
    - should show all available segments in verbose mode
    - should ignore terminal width constraints in verbose mode
    - should show git branch, agent, stage, tokens, cost, model
    - should show session name and progress in verbose mode
    - should show API and web URLs in verbose mode
    - should show all info even in narrow terminal (no filtering)
  })

  // NEW: Normal Mode - Responsive Filtering Tests
  describe('Normal Mode - Responsive Filtering', () => {
    - should show all info in wide terminal
    - should progressively hide low-priority info in narrow terminal
    - should always keep connection, branch, agent visible
    - should filter based on segment minWidth calculations
    - should adapt layout dynamically based on terminalWidth
  })

  // NEW: Mode Switching Tests
  describe('Mode Switching', () => {
    - should transition from normal to compact correctly
    - should transition from compact to verbose correctly
    - should transition from verbose to normal correctly
    - should handle rapid mode switching without errors
    - should preserve timer accuracy across mode changes
    - should maintain data integrity during transitions
  })
})
```

### Technical Approach

1. **Mock Configuration**:
   - Use existing `vi.mock('ink')` pattern
   - Mock `useStdout` to control terminal width
   - Use ThemeProvider wrapper consistently

2. **Test Data**:
   - Create comprehensive `mockSessionData` with all StatusBar props
   - Test both minimal and maximal prop scenarios
   - Include edge cases (missing props, zero values)

3. **Assertions**:
   - Use `screen.getByText()` for positive assertions
   - Use `screen.queryByText()` with `not.toBeInTheDocument()` for negative assertions
   - Verify specific UI elements per mode

4. **Integration Points**:
   - Test StatusBar within ThemeProvider context
   - Test with realistic session data scenarios
   - Verify component behavior matches StatusBar implementation

### Key Implementation Details

Based on StatusBar.tsx analysis:

**Compact Mode (lines 146-171)**:
- Shows only: connection indicator (●/○), agent name, timer
- Hides: git branch icon/text, workflow stage, subtask progress, session name, API/web URLs, tokens, cost, model

**Verbose Mode (lines 313-315)**:
- Returns all left/right segments without filtering
- Ignores terminal width constraints

**Normal Mode (lines 317-335)**:
- Applies responsive filtering based on `terminalWidth`
- Removes lower-priority segments when `minLeftWidth + minRightWidth + padding > terminalWidth`
- Keeps first 3 left segments (connection, branch, agent) as priority

### Dependencies

- Existing test utilities from `./test-utils.tsx`
- ThemeProvider from `../ui/context/ThemeContext`
- StatusBar component from `../ui/components/StatusBar`
- vitest for test framework

### Files to Modify

1. `packages/cli/src/__tests__/v030-features.integration.test.tsx`
   - Add new describe blocks after existing display modes tests
   - Approximately 200-300 lines of new test code

## Consequences

### Positive
- Comprehensive coverage of all three display modes
- Tests verify actual behavior, not just render success
- Follows existing codebase patterns
- Clear test organization by mode type

### Negative
- Increases test file size
- Some duplication with StatusBar.display-modes.test.tsx (but integration vs unit focus differs)

### Risks
- Mock complexity for terminal width scenarios
- Timer tests require careful fake timer handling

## Test Implementation Checklist

- [ ] Compact mode minimal StatusBar tests (connection, agent, timer only)
- [ ] Verbose mode full StatusBar tests (all segments, no filtering)
- [ ] Normal mode responsive filtering tests (width-based segment removal)
- [ ] Mode switching tests (transitions and state consistency)
- [ ] All new tests pass
