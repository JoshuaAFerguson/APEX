# ADR-0044: AgentTerminalPanel Comprehensive Test Architecture

## Status
**Proposed** - Architecture Stage

## Date
2024-12-19

## Context

The AgentTerminalPanel component is a critical UI component in the APEX web-ui package that provides a terminal-like interface for viewing agent logs. Based on analysis of the existing codebase, there is already significant test coverage across multiple test files, but gaps exist according to the acceptance criteria:

### Acceptance Criteria
1. Unit tests cover all panel states and callback props
2. Integration tests verify multi-panel interactions
3. Accessibility tests confirm screen reader support and keyboard navigation
4. Animation tests verify transition timing and content visibility sync

### Existing Test Coverage Analysis

The following test files currently exist in `packages/web-ui/src/components/agents/__tests__/`:

| Test File | Coverage Focus | Gap Analysis |
|-----------|---------------|--------------|
| `AgentTerminalPanel.unit.test.tsx` | Basic rendering, props, themes, controls | Needs additional callback props coverage |
| `AgentTerminalPanel.integration.test.tsx` | Streaming lifecycle, filtering, auto-scroll | Multi-panel interaction gaps |
| `AgentTerminalPanel.keyboard-accessibility.test.tsx` | Keyboard shortcuts, ARIA attributes | Good coverage, minor gaps in focus trap |
| `AgentTerminalPanel.animations.fixed.test.tsx` | CSS transitions, ADR-0043 compliance | Animation timing verification gaps |
| `AgentTerminalPanel.three-state.test.tsx` | Three-state architecture (ADR-0032) | Good coverage |
| `AgentTerminalPanel.transitions.integration.test.tsx` | Transition workflows | Good coverage |
| `ParallelAgentGrid.integration.test.tsx` | Multi-panel grid interactions | Good foundation |
| `ParallelAgentTerminalView.maximize-hide.test.tsx` | Maximize/hide behavior | Partial coverage |

## Decision

### Test Architecture Strategy

We will implement a **layered testing approach** with clear separation of concerns:

```
┌────────────────────────────────────────────────────────────────────┐
│                    E2E Tests (Playwright - optional)               │
│         Real browser verification of complete user flows           │
├────────────────────────────────────────────────────────────────────┤
│                    Integration Tests (Vitest + RTL)                │
│    Multi-panel interactions, state coordination, transitions       │
├────────────────────────────────────────────────────────────────────┤
│                    Component Tests (Vitest + RTL)                  │
│   Individual component behavior with mocked dependencies           │
├────────────────────────────────────────────────────────────────────┤
│                     Unit Tests (Vitest)                            │
│       Utility functions, constants, type guards                    │
└────────────────────────────────────────────────────────────────────┘
```

### Test File Organization

```
packages/web-ui/src/components/agents/__tests__/
├── AgentTerminalPanel.test.tsx                    # Main test file (existing)
├── AgentTerminalPanel.unit.test.tsx               # Unit tests (existing, enhance)
├── AgentTerminalPanel.integration.test.tsx        # Integration tests (existing, enhance)
├── AgentTerminalPanel.accessibility.test.tsx      # NEW: Screen reader tests
├── AgentTerminalPanel.keyboard-accessibility.test.tsx  # Keyboard nav (existing, enhance)
├── AgentTerminalPanel.animations.comprehensive.test.tsx  # NEW: Animation timing
├── AgentTerminalPanel.callback-props.test.tsx     # NEW: All callback props
├── AgentTerminalPanel.multi-panel.test.tsx        # NEW: Multi-panel interactions
├── AgentTerminalPanel.three-state.test.tsx        # Three-state tests (existing)
├── AgentTerminalPanel.transitions.integration.test.tsx  # Transitions (existing)
├── ParallelAgentGrid.integration.test.tsx         # Grid integration (existing)
└── test-utils/
    ├── AgentTerminalPanel.fixtures.ts             # Shared test fixtures
    ├── AgentTerminalPanel.mocks.ts                # Centralized mocks
    └── AgentTerminalPanel.helpers.ts              # Test utility functions
```

## Detailed Implementation Plan

### 1. Unit Tests - Callback Props Coverage

**File: `AgentTerminalPanel.callback-props.test.tsx`**

```typescript
// Test Categories:
describe('AgentTerminalPanel - Callback Props')
  ├── describe('Panel State Callbacks')
  │   ├── it('calls onMinimize when minimize action triggered')
  │   ├── it('calls onMaximize when maximize action triggered')
  │   ├── it('calls onRestore when restore action triggered')
  │   └── it('calls onClose and disconnects stream')
  │
  ├── describe('Streaming Callbacks')
  │   ├── it('calls onStreamStateChange when state changes')
  │   ├── it('calls onPause when pause action triggered')
  │   ├── it('calls onResume when resume action triggered')
  │   ├── it('calls onError when stream error occurs')
  │   └── it('calls onClear when logs cleared')
  │
  ├── describe('Log Interaction Callbacks')
  │   ├── it('calls onLogSelect with log when entry clicked')
  │   └── it('calls onFilterChange when filter updated')
  │
  └── describe('Callback Edge Cases')
      ├── it('handles undefined callbacks gracefully')
      ├── it('handles multiple rapid callback invocations')
      └── it('preserves callback identity across renders')
```

### 2. Integration Tests - Multi-Panel Interactions

**File: `AgentTerminalPanel.multi-panel.test.tsx`**

```typescript
// Test Categories:
describe('AgentTerminalPanel - Multi-Panel Integration')
  ├── describe('Panel Coordination')
  │   ├── it('only one panel can be maximized at a time')
  │   ├── it('maximizing one panel hides others')
  │   ├── it('restoring maximized panel shows all panels')
  │   └── it('minimized panels maintain state during maximize')
  │
  ├── describe('Grid Layout Interactions')
  │   ├── it('applies correct grid classes for panel count')
  │   ├── it('updates grid layout when panel added/removed')
  │   └── it('handles dynamic panel configuration changes')
  │
  ├── describe('State Synchronization')
  │   ├── it('syncs panel states through parent component')
  │   ├── it('handles controlled state pattern correctly')
  │   └── it('handles uncontrolled state pattern correctly')
  │
  └── describe('Cross-Panel Events')
      ├── it('keyboard shortcuts work with multiple panels')
      ├── it('focus management across panels')
      └── it('handles rapid panel state changes')
```

### 3. Accessibility Tests - Screen Reader Support

**File: `AgentTerminalPanel.accessibility.test.tsx`**

```typescript
// Test Categories:
describe('AgentTerminalPanel - Accessibility')
  ├── describe('ARIA Attributes')
  │   ├── it('has correct role="region" on container')
  │   ├── it('has aria-label with panel title')
  │   ├── it('updates aria-expanded based on panel state')
  │   ├── it('content has aria-hidden when minimized')
  │   └── it('interactive elements have accessible names')
  │
  ├── describe('Screen Reader Announcements')
  │   ├── it('announces state changes via live regions')
  │   ├── it('announces new log count when scrolled up')
  │   ├── it('announces connection status changes')
  │   └── it('announces error states')
  │
  ├── describe('Focus Management')
  │   ├── it('panel container is focusable with tabIndex=0')
  │   ├── it('focus trap works in maximized state')
  │   ├── it('returns focus after modal/dialog interactions')
  │   └── it('focus order is logical within panel')
  │
  └── describe('Reduced Motion Support')
      ├── it('respects prefers-reduced-motion preference')
      └── it('disables animations for reduced motion')
```

### 4. Animation Tests - Timing and Visibility Sync

**File: `AgentTerminalPanel.animations.comprehensive.test.tsx`**

```typescript
// Test Categories:
describe('AgentTerminalPanel - Animation Timing')
  ├── describe('ADR-0043 Compliance - Timing Values')
  │   ├── it('height transitions use 300ms ease-out')
  │   ├── it('opacity transitions use 200ms ease-in-out')
  │   ├── it('transform transitions use 200ms ease-out')
  │   └── it('ANIMATION_DURATIONS constants match CSS classes')
  │
  ├── describe('Content Visibility Synchronization')
  │   ├── it('content opacity syncs with panel height')
  │   ├── it('content hidden attribute set when minimized')
  │   ├── it('content visible attribute set when expanded')
  │   └── it('no content flash during rapid transitions')
  │
  ├── describe('Transition Class Application')
  │   ├── it('applies PANEL_TRANSITIONS.height class')
  │   ├── it('applies PANEL_CONTENT_CLASSES.animate class')
  │   ├── it('applies PANEL_PERFORMANCE.willChange class')
  │   └── it('classes persist during state changes')
  │
  ├── describe('Rapid State Change Handling')
  │   ├── it('handles rapid minimize/restore cycles')
  │   ├── it('handles rapid maximize/restore cycles')
  │   ├── it('debounces state changes within threshold')
  │   └── it('animation completes cleanly after interruption')
  │
  └── describe('Visual Glitch Prevention')
      ├── it('no height jump during transition start')
      ├── it('no opacity flash during expansion')
      └── it('chevron rotation is smooth')
```

### 5. Shared Test Utilities

**File: `test-utils/AgentTerminalPanel.fixtures.ts`**

```typescript
// Standard test fixtures
export const DEFAULT_TEST_PROPS: AgentTerminalPanelProps = {...}
export const MOCK_LOGS: AgentLogEntry[] = [...]
export const MOCK_STREAM_STATES = {...}
export const PANEL_STATE_COMBINATIONS = [...]

// Factory functions
export function createTestLog(overrides?: Partial<AgentLogEntry>): AgentLogEntry
export function createTestProps(overrides?: Partial<AgentTerminalPanelProps>): AgentTerminalPanelProps
export function createMockStreamState(state: StreamingState): MockStreamState
```

**File: `test-utils/AgentTerminalPanel.mocks.ts`**

```typescript
// Centralized hook mocks
export const createAgentLogStreamMock = (overrides?: Partial<UseAgentLogStreamReturn>) => {...}
export const createAutoScrollMock = (overrides?: Partial<UseAutoScrollReturn>) => {...}

// Component mocks
export const MockAgentTerminalPanelHeader = {...}
export const MockAgentTerminalPanelControls = {...}
export const MockAgentTerminalPanelLogEntry = {...}
```

**File: `test-utils/AgentTerminalPanel.helpers.ts`**

```typescript
// Assertion helpers
export function expectTransitionClasses(element: HTMLElement): void
export function expectPerformanceClasses(element: HTMLElement): void
export function expectContentAnimationClasses(element: HTMLElement, expanded: boolean): void
export function expectAriaAttributes(element: HTMLElement, state: PanelDisplayState): void

// Interaction helpers
export function fireKeyboardEvent(element: HTMLElement, key: string, options?: KeyboardEventInit): void
export function simulateStateTransition(panelState: PanelDisplayState): void
export function waitForAnimationComplete(): Promise<void>
```

## Test Coverage Matrix

| Feature Area | Unit | Integration | Accessibility | Animation |
|--------------|------|-------------|---------------|-----------|
| Panel States (normal/min/max) | ✓ | ✓ | ✓ | ✓ |
| Callback Props | ✓ | - | - | - |
| Multi-Panel Coordination | - | ✓ | - | - |
| Keyboard Navigation | ✓ | ✓ | ✓ | - |
| Screen Reader Support | - | - | ✓ | - |
| ARIA Attributes | ✓ | - | ✓ | - |
| Transition Timing | - | - | - | ✓ |
| Content Visibility | - | ✓ | ✓ | ✓ |
| Performance Classes | ✓ | - | - | ✓ |
| Grid Layout | - | ✓ | - | - |

## Technical Constraints

### Test Environment
- **Framework**: Vitest with @testing-library/react
- **DOM Environment**: jsdom
- **Setup**: `packages/web-ui/src/__tests__/setup.ts`

### Mock Strategy
1. **Hook Mocks**: Mock `useAgentLogStream` and `useAutoScroll` to control state
2. **Component Mocks**: Mock child components (Header, Controls, LogEntry) for isolation
3. **WebSocket Mock**: Use `@/lib/websocket-client` mock for streaming tests

### Timing Considerations
- Animation tests should use `waitFor` with appropriate timeouts
- Rapid state change tests should account for debounce (50ms per ADR-0043)
- Use `vi.useFakeTimers()` for precise timing control

## Implementation Priority

### Phase 1: Core Gaps (High Priority)
1. `AgentTerminalPanel.callback-props.test.tsx` - All callback props coverage
2. `AgentTerminalPanel.accessibility.test.tsx` - Screen reader tests
3. `AgentTerminalPanel.multi-panel.test.tsx` - Multi-panel interactions

### Phase 2: Enhancement (Medium Priority)
1. `AgentTerminalPanel.animations.comprehensive.test.tsx` - Full timing tests
2. Enhance existing keyboard accessibility tests with focus trap
3. Centralize test utilities in `test-utils/` directory

### Phase 3: Optimization (Lower Priority)
1. Extract and deduplicate mock setup across test files
2. Add performance benchmarks for large log sets
3. Add visual regression tests with Playwright

## Consequences

### Positive
- Comprehensive test coverage aligning with acceptance criteria
- Centralized test utilities reduce duplication
- Clear separation between test categories
- ADR compliance verification built into tests

### Negative
- Additional test files increase maintenance burden
- Some duplication in mock setup across files
- Test suite execution time will increase

### Mitigations
- Shared test utilities minimize code duplication
- Use `describe.skip` for slow tests in CI
- Parallel test execution via Vitest

## References
- ADR-0032: Three-State Panel Architecture
- ADR-0043: Animation Timing Specifications
- Existing test files in `packages/web-ui/src/components/agents/__tests__/`
- Vitest documentation: https://vitest.dev/
- Testing Library documentation: https://testing-library.com/
