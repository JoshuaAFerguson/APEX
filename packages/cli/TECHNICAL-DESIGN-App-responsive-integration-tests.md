# Technical Design: App.tsx Responsive Layout Integration Tests

## Overview

This document provides the technical specification for implementing comprehensive integration tests that verify `App.tsx` responsive layout behavior across various terminal widths.

## Acceptance Criteria Mapping

| Requirement | Test Category | Implementation |
|-------------|--------------|----------------|
| Test at widths 40, 60, 100, 160, 200 | Width Breakpoint Tests | Parameterized test suite |
| Verify no overflow/truncation | Content Adaptation Tests | Explicit content assertions |
| Confirm components adapt together | Component Integration Tests | Multi-component verification |
| Test resize scenarios | Transition Tests | rerender() with mock updates |

## File Structure

### Location
```
packages/cli/src/ui/__tests__/App.responsive.integration.test.tsx
```

### Estimated Size
- ~500-700 lines of test code
- ~25-35 test cases
- ~6-8 describe blocks

## Test Architecture

### 1. Module Setup

```typescript
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '../../__tests__/test-utils';
import { App, type AppProps, type AppState } from '../App';
import type { DisplayMode } from '@apexcli/core';
import type { StdoutDimensions } from '../hooks/useStdoutDimensions.js';

// ============================================
// MOCKS
// ============================================

// Mock useStdoutDimensions hook (CRITICAL for responsive testing)
const mockUseStdoutDimensions = vi.fn();
vi.mock('../hooks/useStdoutDimensions.js', () => ({
  useStdoutDimensions: () => mockUseStdoutDimensions(),
}));

// Mock ink framework
vi.mock('ink', async () => {
  const actual = await vi.importActual('ink');
  return {
    ...actual,
    useInput: vi.fn(),
    useApp: () => ({ exit: vi.fn() }),
    useStdout: () => ({ stdout: { columns: 80 } }),
  };
});

// Mock services
vi.mock('../../services/ConversationManager.js', () => ({
  ConversationManager: vi.fn().mockImplementation(() => ({
    addMessage: vi.fn(),
    getSuggestions: vi.fn(() => []),
    hasPendingClarification: vi.fn(() => false),
    detectIntent: vi.fn(() => ({ type: 'command', confidence: 0.9, metadata: {} })),
    clearContext: vi.fn(),
    setTask: vi.fn(),
    setAgent: vi.fn(),
    clearTask: vi.fn(),
    clearAgent: vi.fn(),
    provideClarification: vi.fn(),
  })),
}));

vi.mock('../../services/ShortcutManager.js', () => ({
  ShortcutManager: vi.fn().mockImplementation(() => ({
    on: vi.fn(),
    handleKey: vi.fn(() => false),
    pushContext: vi.fn(),
    popContext: vi.fn(),
  })),
}));

vi.mock('../../services/CompletionEngine.js', () => ({
  CompletionEngine: vi.fn().mockImplementation(() => ({})),
}));
```

### 2. Helper Functions

```typescript
// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Mock terminal dimensions with proper breakpoint calculation
 */
function mockDimensions(width: number, height: number = 24): StdoutDimensions {
  const breakpoint: 'narrow' | 'compact' | 'normal' | 'wide' =
    width < 60 ? 'narrow'
    : width < 100 ? 'compact'
    : width < 160 ? 'normal'
    : 'wide';

  const dims: StdoutDimensions = {
    width,
    height,
    breakpoint,
    isNarrow: width < 60,
    isCompact: width >= 60 && width < 100,
    isNormal: width >= 100 && width < 160,
    isWide: width >= 160,
    isAvailable: true,
  };

  mockUseStdoutDimensions.mockReturnValue(dims);
  return dims;
}

/**
 * Create base app state for testing
 */
function createBaseState(overrides: Partial<AppState> = {}): AppState {
  return {
    initialized: true,
    projectPath: '/test/project',
    config: null,
    orchestrator: null,
    gitBranch: 'main',
    currentTask: {
      id: 'task-123456',
      description: 'Test task with a moderately long description for testing',
      status: 'in-progress',
      workflow: 'feature',
      createdAt: new Date(),
    },
    activeAgent: 'developer',
    messages: [
      {
        id: 'msg1',
        type: 'user',
        content: 'User message',
        timestamp: new Date(),
      },
      {
        id: 'msg2',
        type: 'assistant',
        content: 'Assistant response with some content',
        agent: 'developer',
        timestamp: new Date(),
      },
    ],
    inputHistory: [],
    isProcessing: false,
    tokens: { input: 100, output: 150 },
    cost: 0.05,
    model: 'sonnet',
    displayMode: 'normal' as DisplayMode,
    previewMode: false,
    showThoughts: false,
    ...overrides,
  };
}

/**
 * Create app props with handlers
 */
function createProps(stateOverrides: Partial<AppState> = {}): AppProps {
  return {
    initialState: createBaseState(stateOverrides),
    onCommand: vi.fn().mockResolvedValue(undefined),
    onTask: vi.fn().mockResolvedValue(undefined),
    onExit: vi.fn(),
  };
}

/**
 * Width test configurations
 */
const WIDTH_TEST_CASES = [
  { width: 40, breakpoint: 'narrow', description: 'Narrow terminal (40 cols)' },
  { width: 60, breakpoint: 'compact', description: 'Compact terminal (60 cols)' },
  { width: 100, breakpoint: 'normal', description: 'Normal terminal (100 cols)' },
  { width: 160, breakpoint: 'wide', description: 'Wide terminal (160 cols)' },
  { width: 200, breakpoint: 'wide', description: 'Very wide terminal (200 cols)' },
] as const;
```

### 3. Test Categories

#### Category A: Basic Rendering at Each Width

```typescript
describe('App.tsx - Responsive Integration Tests', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  describe('Basic Rendering at Target Widths', () => {
    WIDTH_TEST_CASES.forEach(({ width, breakpoint, description }) => {
      describe(description, () => {
        beforeEach(() => {
          mockDimensions(width);
        });

        it('renders without errors', () => {
          const props = createProps();
          expect(() => render(<App {...props} />)).not.toThrow();
        });

        it('renders all core components', () => {
          const props = createProps();
          render(<App {...props} />);

          // Banner should always render
          expect(screen.getByText(/APEX/i)).toBeInTheDocument();

          // StatusBar should always render
          // (Implementation will check for actual StatusBar content)

          // InputPrompt should always render
          expect(screen.getByText(/apex>/i)).toBeInTheDocument();
        });

        it(`uses ${breakpoint} breakpoint layout`, () => {
          const props = createProps();
          render(<App {...props} />);

          // Verify breakpoint-specific behavior
          // (Assertions depend on actual component behavior)
        });
      });
    });
  });
```

#### Category B: Component Adaptation Tests

```typescript
  describe('Component Adaptation by Width', () => {
    describe('Banner Adaptation', () => {
      it('shows ASCII art at width >= 60', () => {
        mockDimensions(80);
        render(<App {...createProps()} />);
        expect(screen.getByText(/█████╗/)).toBeInTheDocument();
      });

      it('shows compact box at width 40-59', () => {
        mockDimensions(50);
        render(<App {...createProps()} />);
        expect(screen.getByText(/◆ APEX ◆/)).toBeInTheDocument();
      });

      it('shows text-only at width < 40', () => {
        mockDimensions(35);
        render(<App {...createProps()} />);
        expect(screen.getByText(/◆ APEX/)).toBeInTheDocument();
        expect(screen.queryByText(/█████╗/)).not.toBeInTheDocument();
      });
    });

    describe('StatusBar Adaptation', () => {
      it('shows full metrics at wide width', () => {
        mockDimensions(160);
        render(<App {...createProps()} />);
        // Verify full labels visible
      });

      it('shows abbreviated metrics at narrow width', () => {
        mockDimensions(50);
        render(<App {...createProps()} />);
        // Verify abbreviated labels
      });
    });

    describe('TaskProgress Adaptation', () => {
      it('shows full task info at normal+ width', () => {
        mockDimensions(100);
        const props = createProps();
        render(<App {...props} />);
        // Verify task ID and description visible
      });

      it('truncates task info at narrow width', () => {
        mockDimensions(40);
        const props = createProps();
        render(<App {...props} />);
        // Verify truncation
      });
    });
  });
```

#### Category C: Transition Tests

```typescript
  describe('Width Resize Transitions', () => {
    describe('Narrow to Wide Transition', () => {
      it('transitions components correctly from 40 to 160 cols', () => {
        mockDimensions(40);
        const props = createProps();
        const { rerender } = render(<App {...props} />);

        // Verify narrow layout
        expect(screen.queryByText(/█████╗/)).not.toBeInTheDocument();

        // Simulate resize to wide
        mockDimensions(160);
        rerender(<App {...props} />);

        // Verify wide layout
        expect(screen.getByText(/█████╗/)).toBeInTheDocument();
      });
    });

    describe('Wide to Narrow Transition', () => {
      it('transitions components correctly from 160 to 40 cols', () => {
        mockDimensions(160);
        const props = createProps();
        const { rerender } = render(<App {...props} />);

        // Verify wide layout
        expect(screen.getByText(/█████╗/)).toBeInTheDocument();

        // Simulate resize to narrow
        mockDimensions(40);
        rerender(<App {...props} />);

        // Verify narrow layout
        expect(screen.queryByText(/█████╗/)).not.toBeInTheDocument();
      });
    });

    describe('Breakpoint Boundary Transitions', () => {
      const boundaryTests = [
        { from: 59, to: 60, boundary: 'narrow/compact' },
        { from: 99, to: 100, boundary: 'compact/normal' },
        { from: 159, to: 160, boundary: 'normal/wide' },
      ];

      boundaryTests.forEach(({ from, to, boundary }) => {
        it(`transitions correctly across ${boundary} boundary`, () => {
          mockDimensions(from);
          const props = createProps();
          const { rerender } = render(<App {...props} />);

          const initialBreakpoint = mockUseStdoutDimensions().breakpoint;

          mockDimensions(to);
          rerender(<App {...props} />);

          const newBreakpoint = mockUseStdoutDimensions().breakpoint;

          expect(initialBreakpoint).not.toBe(newBreakpoint);
        });
      });
    });

    describe('Sequential Resize Tests', () => {
      it('handles multiple sequential resizes', () => {
        const props = createProps();
        const { rerender } = render(<App {...props} />);

        const widths = [40, 80, 120, 80, 40, 160, 100];

        widths.forEach((width) => {
          mockDimensions(width);
          rerender(<App {...props} />);
          // Component should not throw
        });
      });
    });
  });
```

#### Category D: Edge Cases

```typescript
  describe('Edge Cases', () => {
    describe('Extreme Widths', () => {
      it('handles zero width gracefully', () => {
        mockDimensions(0);
        expect(() => render(<App {...createProps()} />)).not.toThrow();
      });

      it('handles very narrow width (10 cols)', () => {
        mockDimensions(10);
        expect(() => render(<App {...createProps()} />)).not.toThrow();
      });

      it('handles very wide width (300 cols)', () => {
        mockDimensions(300);
        expect(() => render(<App {...createProps()} />)).not.toThrow();
      });
    });

    describe('Unavailable Dimensions', () => {
      it('handles unavailable dimensions with fallback', () => {
        mockUseStdoutDimensions.mockReturnValue({
          width: 80,
          height: 24,
          breakpoint: 'compact',
          isNarrow: false,
          isCompact: true,
          isNormal: false,
          isWide: false,
          isAvailable: false, // Dimensions unavailable
        });

        expect(() => render(<App {...createProps()} />)).not.toThrow();
      });
    });

    describe('Height Variations', () => {
      it('handles short terminal (12 rows)', () => {
        mockDimensions(80, 12);
        expect(() => render(<App {...createProps()} />)).not.toThrow();
      });

      it('handles tall terminal (50 rows)', () => {
        mockDimensions(80, 50);
        expect(() => render(<App {...createProps()} />)).not.toThrow();
      });
    });
  });
```

#### Category E: DisplayMode + Width Interaction

```typescript
  describe('DisplayMode and Width Interaction', () => {
    const displayModes: DisplayMode[] = ['normal', 'compact', 'verbose'];

    displayModes.forEach((displayMode) => {
      describe(`${displayMode} mode`, () => {
        WIDTH_TEST_CASES.forEach(({ width, description }) => {
          it(`renders correctly at ${width} cols in ${displayMode} mode`, () => {
            mockDimensions(width);
            const props = createProps({ displayMode });
            expect(() => render(<App {...props} />)).not.toThrow();
          });
        });
      });
    });

    describe('Auto-Compact Behavior', () => {
      it('forces compact layout in narrow terminals regardless of displayMode', () => {
        mockDimensions(40);
        const props = createProps({ displayMode: 'normal' });
        render(<App {...props} />);

        // TaskProgress should use compact layout at narrow width
        // even when displayMode is 'normal'
      });
    });
  });
```

#### Category F: No Overflow Verification

```typescript
  describe('No Overflow Verification', () => {
    WIDTH_TEST_CASES.forEach(({ width, description }) => {
      describe(description, () => {
        it('banner content fits within width', () => {
          mockDimensions(width);
          render(<App {...createProps()} />);
          // Banner should render appropriate version for width
        });

        it('status bar adapts to width constraints', () => {
          mockDimensions(width);
          render(<App {...createProps()} />);
          // StatusBar should not overflow
        });

        it('task progress adapts to width constraints', () => {
          mockDimensions(width);
          render(<App {...createProps()} />);
          // TaskProgress should truncate as needed
        });

        it('message content handles width constraints', () => {
          mockDimensions(width);
          const props = createProps({
            messages: [
              {
                id: 'msg-long',
                type: 'assistant',
                content: 'A'.repeat(200), // Long content
                agent: 'developer',
                timestamp: new Date(),
              },
            ],
          });
          render(<App {...props} />);
          // Content should wrap or truncate, not overflow
        });
      });
    });
  });
```

#### Category G: All Components Together

```typescript
  describe('All Components Render Together', () => {
    it('renders complete UI at narrow width (40 cols)', () => {
      mockDimensions(40);
      const props = createProps();
      render(<App {...props} />);

      // All major components should be present
      expect(screen.getByText(/APEX/i)).toBeInTheDocument();
      expect(screen.getByText(/apex>/i)).toBeInTheDocument();
      // Verify other components as needed
    });

    it('renders complete UI at wide width (200 cols)', () => {
      mockDimensions(200);
      const props = createProps();
      render(<App {...props} />);

      // All major components should be present with full content
      expect(screen.getByText(/█████╗/)).toBeInTheDocument();
      expect(screen.getByText(/apex>/i)).toBeInTheDocument();
      // Verify full content visibility
    });

    it('renders complete UI without active task', () => {
      mockDimensions(100);
      const props = createProps({
        currentTask: undefined,
        activeAgent: undefined,
      });
      render(<App {...props} />);

      // Core UI should still render
      expect(screen.getByText(/APEX/i)).toBeInTheDocument();
      expect(screen.getByText(/apex>/i)).toBeInTheDocument();
    });

    it('renders complete UI with all optional features enabled', () => {
      mockDimensions(120);
      const props = createProps({
        showThoughts: true,
        previewMode: true,
        apiUrl: 'http://localhost:3000',
        webUrl: 'http://localhost:3001',
        parallelAgents: [
          { name: 'developer', role: 'Developer', status: 'active' },
          { name: 'tester', role: 'Tester', status: 'pending' },
        ],
        showParallelPanel: true,
      });
      render(<App {...props} />);

      // All optional components should render
      expect(screen.getByText(/APEX/i)).toBeInTheDocument();
    });
  });
});
```

## Implementation Checklist

### Phase 1: Setup (~30 min)
- [ ] Create test file with imports
- [ ] Set up all module mocks
- [ ] Create helper functions
- [ ] Define test constants

### Phase 2: Basic Rendering Tests (~45 min)
- [ ] Implement width breakpoint tests
- [ ] Verify no-throw rendering at each width
- [ ] Add component presence assertions

### Phase 3: Component Adaptation Tests (~60 min)
- [ ] Banner adaptation tests
- [ ] StatusBar adaptation tests
- [ ] TaskProgress adaptation tests
- [ ] Message rendering tests

### Phase 4: Transition Tests (~45 min)
- [ ] Narrow to wide transitions
- [ ] Wide to narrow transitions
- [ ] Breakpoint boundary tests
- [ ] Sequential resize tests

### Phase 5: Edge Cases (~30 min)
- [ ] Extreme width handling
- [ ] Unavailable dimensions
- [ ] Height variations

### Phase 6: DisplayMode Interaction (~30 min)
- [ ] All displayMode + width combinations
- [ ] Auto-compact behavior
- [ ] Override scenarios

### Phase 7: No Overflow Verification (~30 min)
- [ ] Width constraint tests
- [ ] Long content handling
- [ ] Truncation verification

### Phase 8: Integration Verification (~30 min)
- [ ] All components together
- [ ] Various state combinations
- [ ] Optional features enabled

## Test Execution

```bash
# Run all responsive integration tests
npm test --workspace=@apexcli/cli -- App.responsive

# Run with verbose output
npm test --workspace=@apexcli/cli -- App.responsive --reporter=verbose

# Run with coverage
npm test --workspace=@apexcli/cli -- --coverage App.responsive
```

## Success Criteria

1. All tests pass at widths 40, 60, 100, 160, 200
2. No render errors at any tested width
3. Components adapt appropriately to breakpoints
4. Resize transitions work correctly
5. Edge cases handled gracefully
6. DisplayMode interacts correctly with width
7. No visual overflow detected (via content assertions)

## Dependencies

- vitest
- @testing-library/react
- Existing test utilities (`test-utils.tsx`)
- Mock implementations for services

## Notes for Developer Stage

1. **Mock Component Strategy**: If mocking individual components (like in `App.displayMode.integration.test.tsx`), use `vi.fn()` components that capture props for assertion.

2. **Testing Content Width**: Since we can't measure actual terminal output width in unit tests, use proxy assertions like:
   - Presence/absence of abbreviated vs full labels
   - Presence/absence of ASCII art
   - Truncation indicators (`...`)

3. **Timing Considerations**: Use `vi.useFakeTimers()` for any tests involving animations or timeouts.

4. **State Updates**: When testing state changes from resize, use `rerender()` rather than trying to simulate actual events.
