# Technical Design: ParallelAgentGrid Integration Tests

## ADR-0044: Integration Test Architecture for Grid Layout Functionality

**Status**: Approved
**Date**: 2025-01-16
**Authors**: Architect Agent

## Context

The acceptance criteria require integration tests for `ParallelAgentGrid` and `AgentTerminalPanel` that verify grid layout behavior:

1. **Maximized panel col-span-full class** - When a panel is maximized, it should receive the `col-span-full` class
2. **Non-maximized panels hidden** - When one panel is maximized, other panels should be hidden with `hidden` class
3. **Grid layout class changes** - Grid container classes should change correctly based on panel count and maximize state
4. **Smooth transitions** - CSS transitions should be applied during state changes

## Component Analysis

### Current Architecture

Based on the codebase analysis:

1. **There is NO dedicated `ParallelAgentGrid` component** - The grid functionality is provided through:
   - Utility functions: `getPanelGridClasses()` and `getGridLayoutClasses()` in `packages/web-ui/src/lib/utils.ts`
   - Constants: `GRID_CONFIGS`, `PANEL_WIDTHS`, `PANEL_TRANSITIONS` in `packages/web-ui/src/components/agents/constants.ts`
   - Panel component: `AgentTerminalPanel.tsx` which uses these utilities

2. **Grid Layout System**:
   ```typescript
   // Container grid classes based on panel count
   GRID_CONFIGS = {
     1: 'grid grid-cols-1 gap-2',
     2: 'grid grid-cols-1 sm:grid-cols-2 gap-2',
     3: 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2',
     // ... up to 6 columns
   }

   // Individual panel classes based on maximize state
   getPanelGridClasses(isMaximized, isThisMaximized):
     - Returns 'col-span-full' for maximized panel
     - Returns 'hidden' for non-maximized panels when another is maximized
     - Returns '' for normal state

   // Container layout classes
   getGridLayoutClasses(panelCount, isMaximized):
     - Returns 'grid grid-cols-1 gap-2' when maximized
     - Returns appropriate GRID_CONFIGS based on count otherwise
   ```

3. **AgentTerminalPanel Grid Integration**:
   - Uses `PANEL_WIDTHS.maximized = 'col-span-full'` for maximized state
   - Uses `PANEL_TRANSITIONS.height = 'transition-[height] duration-300 ease-out'` for animations

## Test Architecture Design

### Test File Structure

```
packages/web-ui/src/components/agents/__tests__/
├── ParallelAgentGrid.integration.test.tsx  # NEW - Grid layout integration tests
└── (existing tests)
```

### Test Strategy

Since there's no dedicated `ParallelAgentGrid` component, we need to test:

1. **Unit tests for utility functions** (already exist in `utils.test.ts`)
2. **Integration tests** showing how `AgentTerminalPanel` uses grid classes in a multi-panel scenario
3. **CSS class application verification** through rendered DOM inspection

### Integration Test Design

```typescript
/**
 * @vitest-environment jsdom
 *
 * ParallelAgentGrid Integration Tests
 *
 * Tests grid layout behavior when multiple AgentTerminalPanel components
 * are rendered together in a grid container, verifying:
 * - AC1: Maximized panel gets col-span-full class
 * - AC2: Non-maximized panels are hidden when one is maximized
 * - AC3: Grid layout classes change based on panel count and maximize state
 * - AC4: Smooth transitions are applied
 */

describe('ParallelAgentGrid Integration', () => {
  describe('AC1: Maximized Panel Col-Span-Full', () => {
    // Test that maximized panel receives 'col-span-full' class
  })

  describe('AC2: Non-Maximized Panels Hidden', () => {
    // Test that other panels get 'hidden' class when one maximizes
  })

  describe('AC3: Grid Layout Class Changes', () => {
    // Test container classes based on panel count
    // Test container classes change when maximize state changes
  })

  describe('AC4: Smooth Transitions', () => {
    // Test transition classes are applied
    // Test performance optimization classes
  })

  describe('Multi-Panel Scenarios', () => {
    // Integration tests with multiple panels
  })
})
```

### Test Implementation Approach

#### Approach 1: Create Test Wrapper Component (Recommended)

Create a test wrapper that simulates a grid container with multiple panels:

```typescript
const TestParallelAgentGrid: React.FC<{
  panels: Array<{
    id: string;
    agentId: string;
    title: string;
    panelState: PanelDisplayState;
  }>;
  onPanelStateChange: (panelId: string, newState: PanelDisplayState) => void;
}> = ({ panels, onPanelStateChange }) => {
  const hasMaximizedPanel = panels.some(p => p.panelState === 'maximized')

  return (
    <div
      className={getGridLayoutClasses(panels.length, hasMaximizedPanel)}
      data-testid="grid-container"
    >
      {panels.map(panel => (
        <div
          key={panel.id}
          className={getPanelGridClasses(
            hasMaximizedPanel,
            panel.panelState === 'maximized'
          )}
          data-testid={`panel-wrapper-${panel.id}`}
        >
          <AgentTerminalPanel
            panelId={panel.id}
            agentId={panel.agentId}
            title={panel.title}
            panelState={panel.panelState}
            onMaximize={() => onPanelStateChange(panel.id, 'maximized')}
            onMinimize={() => onPanelStateChange(panel.id, 'minimized')}
            onRestore={() => onPanelStateChange(panel.id, 'normal')}
          />
        </div>
      ))}
    </div>
  )
}
```

#### Test Cases Detail

| AC | Test Case | Description | Expected |
|----|-----------|-------------|----------|
| AC1 | `maximized panel has col-span-full class` | Render 3 panels, maximize one | Maximized panel wrapper has `col-span-full` |
| AC1 | `normal panels have no col-span-full` | Render 3 panels, none maximized | No panel has `col-span-full` |
| AC2 | `non-maximized panels are hidden` | Render 3 panels, maximize one | Other 2 panels have `hidden` class |
| AC2 | `panels visible when none maximized` | Render 3 panels, none maximized | No panel has `hidden` class |
| AC3 | `grid uses correct column config for panel count` | Render 1-6 panels | Container has correct `grid-cols-X` class |
| AC3 | `grid changes to single column when maximized` | Render 3 panels, maximize one | Container has `grid-cols-1` |
| AC4 | `panels have transition classes` | Render panel, check classes | Has `transition-[height]`, `duration-300`, `ease-out` |
| AC4 | `panels have performance optimization classes` | Render panel | Has `will-change-[height,opacity]` |

### Mock Strategy

```typescript
// Minimal mocks - focus on testing grid behavior, not internal panel functionality
vi.mock('@/hooks/useAgentLogStream', () => ({
  useAgentLogStream: vi.fn(() => ({
    filteredLogs: [],
    filter: { levels: new Set(), searchText: '', stage: null, agent: null },
    streamState: { state: 'idle', connectionStatus: 'disconnected' },
    stats: { totalLogs: 0, logsPerSecond: 0, errorCount: 0, ... },
    isConnecting: false,
    isStreaming: false,
    isPaused: false,
    error: null,
    connect: vi.fn(),
    disconnect: vi.fn(),
    // ... other methods
  })),
}))

vi.mock('@/hooks/useAutoScroll', () => ({
  useAutoScroll: vi.fn(() => ({
    containerRef: { current: null },
    handleScroll: vi.fn(),
    scrollToBottom: vi.fn(),
    autoScroll: true,
    newItemsSinceScroll: 0,
    isAtBottom: true,
    setAutoScroll: vi.fn(),
    resetNewItemsCounter: vi.fn(),
    notifyNewItems: vi.fn(),
  })),
}))
```

## Implementation Plan

### Phase 1: Test Infrastructure
1. Create test file with proper setup/teardown
2. Implement mock configurations
3. Create test wrapper component

### Phase 2: Core Acceptance Criteria Tests
1. Implement AC1 tests (col-span-full)
2. Implement AC2 tests (hidden panels)
3. Implement AC3 tests (grid layout changes)
4. Implement AC4 tests (smooth transitions)

### Phase 3: Integration Scenarios
1. Multi-panel workflows
2. State transition sequences
3. Edge cases (0 panels, many panels)

## File Deliverables

| File | Purpose |
|------|---------|
| `ParallelAgentGrid.integration.test.tsx` | Main integration test file |
| `ParallelAgentGrid.integration.test.architecture.md` | This ADR document |

## Dependencies

### Runtime Dependencies
- `@/lib/utils` - `getPanelGridClasses`, `getGridLayoutClasses`, `GRID_CONFIGS`
- `@/components/agents/constants` - `PANEL_WIDTHS`, `PANEL_TRANSITIONS`
- `@/components/agents/AgentTerminalPanel` - Panel component under test

### Test Dependencies
- `vitest` - Test framework
- `@testing-library/react` - Component testing
- `@testing-library/user-event` - User interactions
- `@testing-library/jest-dom/vitest` - DOM assertions

## Success Criteria

1. All tests pass with `npm test`
2. Build succeeds with `npm run build`
3. All acceptance criteria verified:
   - ✅ AC1: Maximized panel gets col-span-full class
   - ✅ AC2: Non-maximized panels are hidden when one is maximized
   - ✅ AC3: Grid layout classes change correctly based on panel count and maximize state
   - ✅ AC4: Smooth transitions are applied

## Critical Implementation Notes

1. **React Import**: Always import React explicitly: `import React from 'react'`
2. **Test Isolation**: Each test should start with fresh panel state
3. **DOM Class Inspection**: Use `toHaveClass()` assertions for CSS class verification
4. **State Management**: Use controlled components with explicit panelState prop
5. **Transition Testing**: Verify presence of transition classes, not actual CSS animations (JSDOM limitation)

## Risks and Mitigations

| Risk | Mitigation |
|------|------------|
| No dedicated grid component | Test wrapper simulates grid container behavior |
| CSS transitions in JSDOM | Test class presence, not actual animations |
| Complex mock setup | Reuse existing mock patterns from other tests |
| State coordination | Use controlled components with explicit state |

## References

- Existing tests: `AgentTerminalPanel.three-state.test.tsx`, `AgentTerminalPanel.transitions.integration.test.tsx`
- Utility tests: `packages/web-ui/src/lib/__tests__/utils.test.ts`
- Constants: `packages/web-ui/src/components/agents/constants.ts`
- ADR-0032: Three-state panel architecture
- ADR-0043: Animation timing specifications
