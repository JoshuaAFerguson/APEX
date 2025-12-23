# Agent Handoff Animation - Test Coverage Guide

## Overview

This document provides comprehensive information about the test suite for the AgentPanel handoff animation feature, including test coverage, how to run tests, and what is being tested.

## Quick Start - Running Tests

### Run All Tests
```bash
# From project root
npm test

# Or specifically for CLI package
npm test --workspace=@apexcli/cli
```

### Run Tests with Coverage
```bash
# From project root - generate full coverage report
npm run test:coverage

# Or specifically for CLI package with coverage
npm run test:coverage --workspace=@apexcli/cli
```

### Run Tests in Watch Mode (for development)
```bash
# From project root
npm run test:watch

# Or specifically for CLI package
npm test:watch --workspace=@apexcli/cli
```

### Run Specific Test Files
```bash
# Run only HandoffIndicator tests
npm test --workspace=@apexcli/cli -- HandoffIndicator.test.tsx

# Run only integration tests
npm test --workspace=@apexcli/cli -- AgentPanel.integration.test.tsx

# Run only edge case tests
npm test --workspace=@apexcli/cli -- HandoffIndicator.edge-cases.test.tsx
```

## Coverage Reports Location

After running tests with coverage, reports are available at:
- **HTML Report**: `packages/cli/coverage/index.html` (open in browser)
- **JSON Report**: `packages/cli/coverage/coverage-final.json`
- **Text Summary**: Displayed in terminal output

## Test Files and Coverage

### 1. HandoffIndicator.test.tsx (616 lines)
**Location**: `/Users/s0v3r1gn/APEX/packages/cli/src/ui/components/agents/__tests__/HandoffIndicator.test.tsx`

**Purpose**: Core functionality testing for the HandoffIndicator component

**Test Coverage**:
- **Rendering Conditions** (4 tests)
  - Returns null when not animating
  - Returns null when missing previousAgent
  - Returns null when missing currentAgent
  - Renders when all conditions are met

- **Compact Mode** (3 tests)
  - Renders in compact layout
  - Applies correct styling during fade phase
  - Applies correct styling during normal phase

- **Full Mode** (3 tests)
  - Renders in full layout with "Handoff:" prefix and lightning bolt
  - Applies correct styling during fade phase
  - Applies correct styling during normal phase

- **Fade Threshold Behavior** (2 tests)
  - Correctly identifies fade phase based on progress (0.75 threshold)
  - Handles progress exactly at fade threshold

- **Agent Color Handling** (4 tests)
  - Applies colors for known agents
  - Falls back to white for unknown agents
  - Handles mixed known and unknown agents
  - Handles empty agent colors object

- **Progress Edge Cases** (3 tests)
  - Handles progress of 0
  - Handles progress of 1
  - Handles progress values above 1

- **Agent Name Edge Cases** (4 tests)
  - Handles agents with special characters
  - Handles agents with numbers
  - Handles very long agent names
  - Handles empty string agent names

- **Accessibility** (2 tests)
  - Provides accessible text content in full mode
  - Provides accessible text content in compact mode

- **Default Prop Behavior** (2 tests)
  - Defaults to full mode when compact not specified
  - Explicitly sets compact to false

**Total Tests**: 27

---

### 2. HandoffIndicator.edge-cases.test.tsx (611 lines)
**Location**: `/Users/s0v3r1gn/APEX/packages/cli/src/ui/components/agents/__tests__/HandoffIndicator.edge-cases.test.tsx`

**Purpose**: Edge case and stress testing for unusual scenarios and boundary conditions

**Test Coverage**:
- **Extreme Animation States** (4 tests)
  - Handles progress values far beyond normal range (999.99)
  - Handles negative progress values (-5.5)
  - Handles NaN progress values
  - Handles Infinity progress values

- **Unusual Agent Names** (5 tests)
  - Handles extremely long agent names (1000 characters)
  - Handles agent names with unicode characters (emoji, Chinese, Cyrillic, etc.)
  - Handles agent names with control characters and whitespace
  - Handles agent names that look like HTML/markup (XSS prevention)
  - Handles identical agent names (same-agent transitions)

- **Corrupted or Invalid Agent Colors** (5 tests)
  - Handles null agent colors object
  - Handles undefined agent colors object
  - Handles agent colors with non-string values
  - Handles agent colors with invalid color names
  - Tests color fallback mechanisms

- **Extreme Rendering Scenarios** (3 tests)
  - Handles rapid re-renders with changing states (stress test)
  - Handles switching between compact and full mode rapidly
  - Handles animation state with conflicting flags

- **Boundary Conditions** (3 tests)
  - Handles exact fade threshold boundary (0.75)
  - Handles progress just below and above fade threshold
  - Handles zero and one progress values

- **Memory and Performance Edge Cases** (2 tests)
  - Handles many rapid state changes without memory issues (100 iterations)
  - Handles very large agent colors object (1000 entries)

**Total Tests**: 22

---

### 3. AgentPanel.integration.test.tsx (426 lines)
**Location**: `/Users/s0v3r1gn/APEX/packages/cli/src/ui/components/agents/__tests__/AgentPanel.integration.test.tsx`

**Purpose**: Integration testing for AgentPanel with HandoffIndicator, testing complete workflows

**Test Coverage**:
- **Agent Transition Workflow** (5 tests)
  - Displays smooth transition animation from planner to developer in full mode
  - Displays smooth transition animation from architect to tester in compact mode
  - Handles rapid agent transitions gracefully
  - Maintains agent list functionality during animation
  - Handles agent changes to undefined correctly

- **Color Consistency** (2 tests)
  - Uses consistent colors between agent list and handoff animation
  - Handles unknown agents with fallback colors

- **Mode Switching During Animation** (2 tests)
  - Handles switching from full to compact mode during animation
  - Handles switching from compact to full mode during animation

- **Performance and Memory** (2 tests)
  - Cleans up animation properly on unmount
  - Handles multiple rapid unmounts and mounts (stress test)

- **Accessibility During Animation** (2 tests)
  - Maintains accessible content during animation in full mode
  - Maintains accessible content during animation in compact mode

**Total Tests**: 13

---

### 4. AgentPanel.test.tsx (existing)
**Location**: `/Users/s0v3r1gn/APEX/packages/cli/src/ui/components/agents/__tests__/AgentPanel.test.tsx`

**Purpose**: Core AgentPanel component testing (pre-existing tests)

**Coverage**: Tests for basic AgentPanel rendering, status display, and agent list functionality

---

## Component Files Being Tested

### 1. HandoffIndicator.tsx (85 lines)
**Location**: `/Users/s0v3r1gn/APEX/packages/cli/src/ui/components/agents/HandoffIndicator.tsx`

**Features**:
- Displays animated agent transition with "previousAgent → currentAgent" format
- Supports two display modes:
  - **Full mode**: Bordered box with "⚡ Handoff:" prefix
  - **Compact mode**: Inline display for status bars
- Fade-out animation (dimming after 75% progress)
- Color-coded agent names with fallback to white
- Terminal-compatible rendering using Ink components

**Props**:
- `animationState`: Animation state from useAgentHandoff hook
- `agentColors`: Color mapping for agents
- `compact`: Boolean flag for compact/full mode

---

### 2. useAgentHandoff.ts (129 lines)
**Location**: `/Users/s0v3r1gn/APEX/packages/cli/src/ui/hooks/useAgentHandoff.ts`

**Features**:
- Custom React hook for managing agent handoff animations
- Tracks transitions between agents
- Provides animation progress (0-1)
- Configurable timing:
  - Default duration: 2000ms (2 seconds)
  - Default fade duration: 500ms (0.5 seconds)
  - Default frame rate: 30 fps
- Uses setInterval for terminal compatibility
- Automatic cleanup on unmount
- Prevents overlapping animations

**Returns**: HandoffAnimationState object containing:
- `isAnimating`: Whether animation is active
- `previousAgent`: Previous agent name
- `currentAgent`: Current agent name
- `progress`: Animation progress (0-1)
- `isFading`: Whether in fade-out phase

---

## Test Configuration

### Vitest Configuration
**Location**: `/Users/s0v3r1gn/APEX/packages/cli/vitest.config.ts`

**Settings**:
- Environment: jsdom (for React component testing)
- Test pattern: `src/**/*.test.{ts,tsx}`
- Coverage provider: v8
- Coverage reporters: text, html, json
- Coverage thresholds:
  - Branches: 70%
  - Functions: 70%
  - Lines: 70%
  - Statements: 70%

### Test Setup
**Location**: `/Users/s0v3r1gn/APEX/packages/cli/src/__tests__/setup.ts`

**Mocked Dependencies**:
- Ink components (Box, Text, useInput, useStdout)
- React hooks (useState, useEffect, useCallback)
- Fuse.js (search functionality)
- ResizeObserver (for responsive layouts)

---

## Test Statistics Summary

| Test File | Test Count | Lines of Code | Coverage Area |
|-----------|------------|---------------|---------------|
| HandoffIndicator.test.tsx | 27 | 616 | Core functionality |
| HandoffIndicator.edge-cases.test.tsx | 22 | 611 | Edge cases & stress |
| AgentPanel.integration.test.tsx | 13 | 426 | Integration workflows |
| **Total** | **62** | **1,653** | **Comprehensive** |

---

## Coverage Thresholds

The project enforces the following minimum coverage thresholds:
- **Branches**: 70%
- **Functions**: 70%
- **Lines**: 70%
- **Statements**: 70%

Tests will fail if coverage drops below these thresholds.

---

## Key Test Scenarios

### Animation Lifecycle
1. **Initialization**: Animation starts when currentAgent changes
2. **Active Phase**: Progress 0-0.75 (full brightness, 1.5 seconds)
3. **Fade Phase**: Progress 0.75-1.0 (dimmed, 0.5 seconds)
4. **Completion**: Animation clears, components return to normal

### Display Modes
1. **Full Mode**: Bordered box with "⚡ Handoff:" prefix, bold agent names
2. **Compact Mode**: Inline display, no border, no prefix

### Edge Cases Covered
- Invalid/extreme progress values (negative, NaN, Infinity, >1)
- Unusual agent names (unicode, HTML-like, very long, empty)
- Corrupted color data (null, undefined, non-string values)
- Rapid state changes (stress testing)
- Mode switching during animation
- Memory cleanup (unmount during animation)

---

## Running Tests - Detailed Instructions

### Step 1: Install Dependencies
```bash
npm install
```

### Step 2: Build Project (if needed)
```bash
npm run build
```

### Step 3: Run Tests
```bash
# All tests
npm test --workspace=@apexcli/cli

# With coverage
npm run test:coverage --workspace=@apexcli/cli

# Watch mode (for development)
npm run test:watch --workspace=@apexcli/cli
```

### Step 4: View Coverage Report
```bash
# Open HTML coverage report in browser
open packages/cli/coverage/index.html  # macOS
xdg-open packages/cli/coverage/index.html  # Linux
start packages/cli/coverage/index.html  # Windows
```

---

## Continuous Integration

Tests run automatically on:
- Pull requests
- Commits to main branch
- Pre-commit hooks (if configured)

CI will fail if:
- Any test fails
- Coverage drops below thresholds
- Type checking fails
- Linting errors occur

---

## Development Workflow

### When Making Changes

1. **Start watch mode**:
   ```bash
   npm run test:watch --workspace=@apexcli/cli
   ```

2. **Make your changes** to component or hook files

3. **Watch tests auto-run** and verify they pass

4. **Add new tests** for new functionality

5. **Run coverage check** before committing:
   ```bash
   npm run test:coverage --workspace=@apexcli/cli
   ```

6. **Verify thresholds are met** (70% minimum)

### Adding New Tests

1. Create test file following naming convention: `*.test.tsx` or `*.test.ts`
2. Place in `__tests__` directory alongside component
3. Follow existing test structure and patterns
4. Use descriptive test names that explain what's being tested
5. Group related tests using `describe` blocks
6. Include edge cases and error scenarios

---

## Troubleshooting

### Tests Not Running
- Ensure you're in the correct directory
- Verify dependencies are installed: `npm install`
- Check Node version (requires >= 18.0.0)

### Coverage Report Not Generated
- Ensure `@vitest/coverage-v8` is installed
- Check vitest.config.ts has coverage configuration
- Try clearing coverage cache: `rm -rf packages/cli/coverage`

### Tests Timing Out
- Increase timeout in test file: `it('test', async () => {...}, 10000)`
- Check for missing `await` statements
- Verify timer mocks are being used correctly

### Failing Tests After Changes
- Check if component props have changed
- Verify animation timing constants match test expectations
- Review console output for specific error messages
- Use `screen.debug()` to see rendered output

---

## Additional Resources

### Project Documentation
- Main README: `/Users/s0v3r1gn/APEX/README.md`
- ADR for handoff animation: `/Users/s0v3r1gn/APEX/docs/adr/011-agent-handoff-animation.md`
- CLAUDE.md instructions: `/Users/s0v3r1gn/APEX/CLAUDE.md`

### Testing Libraries
- Vitest: https://vitest.dev/
- React Testing Library: https://testing-library.com/react
- Ink Testing: https://github.com/vadimdemedes/ink#testing

---

## Test Execution Script

A convenience script has been created at `/Users/s0v3r1gn/APEX/run-handoff-tests.sh` that:
- Runs all tests to verify they pass
- Generates coverage report
- Displays summary of results
- Shows locations of coverage reports

To use:
```bash
chmod +x run-handoff-tests.sh
./run-handoff-tests.sh
```

---

## Summary

The AgentPanel handoff animation feature has **62 comprehensive tests** covering:
- ✅ Core functionality (27 tests)
- ✅ Edge cases and stress scenarios (22 tests)
- ✅ Integration workflows (13 tests)
- ✅ Accessibility
- ✅ Performance and memory management
- ✅ Terminal compatibility

All tests are configured to run automatically with CI/CD and include coverage reporting to ensure code quality standards are maintained.
