# ADR-036: Responsive Layout Integration Test Foundation

## Status
**Proposed**

## Context

The APEX CLI uses Ink (React for CLIs) with a comprehensive responsive design system built on the `useStdoutDimensions` hook. This hook provides:
- Terminal width/height detection
- 4-tier breakpoint system: `narrow` (<60), `compact` (60-99), `normal` (100-159), `wide` (>=160)
- Boolean helpers: `isNarrow`, `isCompact`, `isNormal`, `isWide`

Current test infrastructure includes:
- Individual responsive tests per component (e.g., `TaskProgress.responsive.test.tsx`)
- Ad-hoc mocking patterns for `useStdoutDimensions` hook
- No shared utilities for terminal width mocking or responsive assertions

The task requires creating a **foundation test file** with:
1. `mockTerminalWidth` helper supporting 40/60/80/120/160 columns
2. Shared component composition wrapper
3. Responsive assertion helpers for overflow/truncation detection

## Decision

Create a new integration test foundation file at:
```
packages/cli/src/__tests__/responsive-layout-foundation.integration.test.tsx
```

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│          responsive-layout-foundation.integration.test.tsx          │
├─────────────────────────────────────────────────────────────────────┤
│  SECTION 1: Terminal Width Mock Helper                              │
│  ─────────────────────────────────────────────────────────────────  │
│  mockTerminalWidth(cols: TerminalWidth)                             │
│    - TerminalWidth = 40 | 60 | 80 | 120 | 160                       │
│    - Auto-calculates breakpoint from width                          │
│    - Auto-sets boolean helpers (isNarrow, isCompact, etc.)          │
│    - Returns mock object for chaining                               │
├─────────────────────────────────────────────────────────────────────┤
│  SECTION 2: Component Composition Wrapper                           │
│  ─────────────────────────────────────────────────────────────────  │
│  ResponsiveTestWrapper                                              │
│    - Wraps children with ThemeProvider                              │
│    - Provides consistent test context                               │
│    - Handles Ink component mocking consistently                     │
│                                                                     │
│  renderResponsive(ui, options?)                                     │
│    - Custom render using ResponsiveTestWrapper                      │
│    - Integrates with mockTerminalWidth                              │
│    - Returns enhanced render result with helpers                    │
├─────────────────────────────────────────────────────────────────────┤
│  SECTION 3: Responsive Assertion Helpers                            │
│  ─────────────────────────────────────────────────────────────────  │
│  expectNoOverflow(element, maxWidth)                                │
│    - Verifies text content <= maxWidth chars                        │
│                                                                     │
│  expectTruncated(element, originalText)                             │
│    - Verifies text ends with "..." or is shorter than original      │
│                                                                     │
│  expectNotTruncated(element, originalText)                          │
│    - Verifies full text is displayed                                │
│                                                                     │
│  expectBreakpointBehavior(config)                                   │
│    - Tests component across all breakpoints                         │
│    - Validates presence/absence of elements per breakpoint          │
├─────────────────────────────────────────────────────────────────────┤
│  SECTION 4: Integration Test Suite                                  │
│  ─────────────────────────────────────────────────────────────────  │
│  - Tests validating the utilities work correctly                    │
│  - Example patterns for future tests                                │
└─────────────────────────────────────────────────────────────────────┘
```

### 1. Terminal Width Mock Helper

```typescript
/**
 * Standard terminal widths for responsive testing
 * Maps to breakpoints: 40→narrow, 60→compact, 80→compact, 120→normal, 160→wide
 */
export type TerminalWidth = 40 | 60 | 80 | 120 | 160;

/**
 * Terminal width to breakpoint mapping with full dimension context
 */
const TERMINAL_CONFIGS: Record<TerminalWidth, StdoutDimensions> = {
  40: { width: 40, height: 24, breakpoint: 'narrow', isNarrow: true, isCompact: false, isNormal: false, isWide: false, isAvailable: true },
  60: { width: 60, height: 24, breakpoint: 'compact', isNarrow: false, isCompact: true, isNormal: false, isWide: false, isAvailable: true },
  80: { width: 80, height: 24, breakpoint: 'compact', isNarrow: false, isCompact: true, isNormal: false, isWide: false, isAvailable: true },
  120: { width: 120, height: 30, breakpoint: 'normal', isNarrow: false, isCompact: false, isNormal: true, isWide: false, isAvailable: true },
  160: { width: 160, height: 40, breakpoint: 'wide', isNarrow: false, isCompact: false, isNormal: false, isWide: true, isAvailable: true },
};

/**
 * Helper to mock terminal width for responsive testing
 *
 * @param cols - Terminal width in columns (40, 60, 80, 120, or 160)
 * @param overrides - Optional overrides for specific dimension properties
 * @returns The mock return value for verification
 *
 * @example
 * beforeEach(() => {
 *   mockTerminalWidth(80); // Sets up compact breakpoint
 * });
 *
 * it('adapts to narrow terminals', () => {
 *   mockTerminalWidth(40); // Switch to narrow
 *   // ... test narrow behavior
 * });
 */
export function mockTerminalWidth(
  cols: TerminalWidth,
  overrides?: Partial<StdoutDimensions>
): StdoutDimensions;
```

**Rationale**:
- The 5 standard widths (40/60/80/120/160) cover all 4 breakpoints plus the most common 80-column default
- Auto-calculating breakpoint and boolean helpers eliminates boilerplate and prevents misconfiguration
- Height is auto-scaled (24 for narrow/compact, 30 for normal, 40 for wide) to simulate realistic terminals

### 2. Component Composition Wrapper

```typescript
/**
 * Configuration for responsive test wrapper
 */
export interface ResponsiveTestWrapperProps {
  children: React.ReactNode;
  /** Initial terminal width (default: 80) */
  initialWidth?: TerminalWidth;
  /** Theme overrides */
  theme?: Partial<typeof mockTheme>;
}

/**
 * Wrapper component providing consistent test context for responsive components
 *
 * Features:
 * - ThemeProvider with test theme
 * - Consistent Ink component mocking
 * - Pre-configured terminal dimensions
 */
export const ResponsiveTestWrapper: React.FC<ResponsiveTestWrapperProps>;

/**
 * Custom render function for responsive component testing
 *
 * @param ui - React element to render
 * @param options - Render options including terminal width
 * @returns Enhanced render result with responsive helpers
 *
 * @example
 * const { rerender, setWidth } = renderResponsive(
 *   <TaskProgress {...props} />,
 *   { width: 80 }
 * );
 *
 * // Test at different widths
 * setWidth(40);
 * rerender(<TaskProgress {...props} />);
 */
export function renderResponsive(
  ui: React.ReactElement,
  options?: {
    width?: TerminalWidth;
    theme?: Partial<typeof mockTheme>;
  }
): RenderResult & {
  setWidth: (width: TerminalWidth) => void;
};
```

**Rationale**:
- Centralizes provider wrapping to ensure consistent test context
- The `setWidth` helper simplifies testing resize behavior without manual mock reconfiguration
- Extends existing `test-utils.tsx` patterns for familiarity

### 3. Responsive Assertion Helpers

```typescript
/**
 * Assert that text content does not overflow the specified width
 *
 * @param element - DOM element to check
 * @param maxWidth - Maximum allowed character width
 * @throws AssertionError if content exceeds maxWidth
 *
 * @example
 * expectNoOverflow(screen.getByTestId('description'), 80);
 */
export function expectNoOverflow(
  element: HTMLElement,
  maxWidth: number
): void;

/**
 * Assert that text has been truncated (contains "..." or is shorter than original)
 *
 * @param element - DOM element containing potentially truncated text
 * @param originalText - The full untruncated text
 *
 * @example
 * const longDescription = 'This is a very long description...';
 * expectTruncated(screen.getByTestId('desc'), longDescription);
 */
export function expectTruncated(
  element: HTMLElement,
  originalText: string
): void;

/**
 * Assert that text is NOT truncated
 *
 * @param element - DOM element that should contain full text
 * @param originalText - The expected full text
 */
export function expectNotTruncated(
  element: HTMLElement,
  originalText: string
): void;

/**
 * Configuration for breakpoint behavior testing
 */
export interface BreakpointBehaviorConfig {
  component: React.ReactElement;
  /** Elements expected to be visible at each breakpoint */
  visible?: {
    narrow?: string[];
    compact?: string[];
    normal?: string[];
    wide?: string[];
  };
  /** Elements expected to be hidden at each breakpoint */
  hidden?: {
    narrow?: string[];
    compact?: string[];
    normal?: string[];
    wide?: string[];
  };
}

/**
 * Comprehensively test component behavior across all breakpoints
 *
 * @param config - Breakpoint behavior configuration
 *
 * @example
 * expectBreakpointBehavior({
 *   component: <Banner version="1.0.0" />,
 *   visible: {
 *     wide: ['ASCII art', 'Full tagline'],
 *     normal: ['ASCII art', 'Full tagline'],
 *     compact: ['Compact box', 'Full tagline'],
 *     narrow: ['APEX', 'Version'],
 *   },
 *   hidden: {
 *     narrow: ['ASCII art', 'Compact box'],
 *     compact: ['ASCII art'],
 *   }
 * });
 */
export function expectBreakpointBehavior(
  config: BreakpointBehaviorConfig
): void;
```

**Rationale**:
- `expectNoOverflow` directly addresses terminal overflow concerns - critical for CLI UX
- `expectTruncated`/`expectNotTruncated` pair simplifies asserting text truncation state
- `expectBreakpointBehavior` enables declarative multi-breakpoint testing, reducing test boilerplate

### 4. File Structure

```typescript
// packages/cli/src/__tests__/responsive-layout-foundation.integration.test.tsx

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from 'vitest';
import { render, screen, RenderResult } from '@testing-library/react';
import type { StdoutDimensions, Breakpoint } from '../ui/hooks/useStdoutDimensions';
import { mockTheme, ThemeProvider } from './test-utils';

// =============================================================================
// SECTION 1: Terminal Width Mock Helper
// =============================================================================

export type TerminalWidth = 40 | 60 | 80 | 120 | 160;

const TERMINAL_CONFIGS: Record<TerminalWidth, StdoutDimensions> = { /* ... */ };

let mockUseStdoutDimensions: Mock;

export function setupResponsiveMocks(): void { /* ... */ }
export function mockTerminalWidth(cols: TerminalWidth, overrides?: Partial<StdoutDimensions>): StdoutDimensions { /* ... */ }

// =============================================================================
// SECTION 2: Component Composition Wrapper
// =============================================================================

export interface ResponsiveTestWrapperProps { /* ... */ }
export const ResponsiveTestWrapper: React.FC<ResponsiveTestWrapperProps> = ({ /* ... */ }) => { /* ... */ };
export function renderResponsive(ui: React.ReactElement, options?: RenderOptions): EnhancedRenderResult { /* ... */ }

// =============================================================================
// SECTION 3: Responsive Assertion Helpers
// =============================================================================

export function expectNoOverflow(element: HTMLElement, maxWidth: number): void { /* ... */ }
export function expectTruncated(element: HTMLElement, originalText: string): void { /* ... */ }
export function expectNotTruncated(element: HTMLElement, originalText: string): void { /* ... */ }
export interface BreakpointBehaviorConfig { /* ... */ }
export function expectBreakpointBehavior(config: BreakpointBehaviorConfig): void { /* ... */ }

// =============================================================================
// SECTION 4: Integration Tests - Foundation Validation
// =============================================================================

describe('Responsive Layout Integration Test Foundation', () => {
  describe('mockTerminalWidth helper', () => { /* ... */ });
  describe('ResponsiveTestWrapper', () => { /* ... */ });
  describe('Responsive assertion helpers', () => { /* ... */ });
  describe('Integration examples', () => { /* ... */ });
});
```

## Consequences

### Positive
- **Standardized terminal width mocking**: Single source of truth for width configurations
- **Reduced boilerplate**: Declarative breakpoint behavior testing
- **Consistent patterns**: All responsive tests use same utilities
- **Better overflow detection**: Direct assertion helpers for overflow/truncation
- **Self-documenting**: Integration tests serve as usage examples

### Negative
- **Additional file to maintain**: New test utility file
- **Migration effort**: Existing responsive tests should eventually adopt these utilities (not required)

### Neutral
- **Coexists with existing patterns**: Doesn't break existing responsive tests
- **Optional adoption**: Teams can gradually migrate existing tests

## Implementation Notes

### Mock Setup Pattern

The `useStdoutDimensions` hook mock must be configured before component import. The foundation uses a setup function:

```typescript
// In the test file:
vi.mock('../ui/hooks/index', () => ({
  useStdoutDimensions: vi.fn(() => TERMINAL_CONFIGS[80]),
}));

// Import after mock
import { useStdoutDimensions } from '../ui/hooks/index';
const mockHook = useStdoutDimensions as Mock;

// In helper:
export function mockTerminalWidth(cols: TerminalWidth) {
  const config = { ...TERMINAL_CONFIGS[cols] };
  mockHook.mockReturnValue(config);
  return config;
}
```

### Breakpoint Width Mappings

| Width | Breakpoint | Height | Use Case |
|-------|------------|--------|----------|
| 40    | narrow     | 24     | Very narrow terminals, minimal UI |
| 60    | compact    | 24     | Small terminals, reduced elements |
| 80    | compact    | 24     | Standard terminal default |
| 120   | normal     | 30     | Modern widescreen terminals |
| 160   | wide       | 40     | Ultra-wide monitors |

### Test File Naming Convention

Integration tests using this foundation should use the `.integration.test.tsx` suffix to distinguish from unit tests and be included in the Vitest configuration's include patterns.

## Related Decisions

- Uses `useStdoutDimensions` hook from `packages/cli/src/ui/hooks/useStdoutDimensions.ts`
- Extends test utilities from `packages/cli/src/__tests__/test-utils.tsx`
- Follows existing responsive test patterns from `*.responsive.test.tsx` files

## References

- Existing responsive tests: `TaskProgress.responsive.test.tsx`, `Banner.responsive.test.tsx`, `MarkdownRenderer.responsive.test.tsx`
- Hook implementation: `packages/cli/src/ui/hooks/useStdoutDimensions.ts`
- Test utilities: `packages/cli/src/__tests__/test-utils.tsx`
