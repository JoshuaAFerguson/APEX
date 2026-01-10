# ADR-119: ResourceUsageDisplay CLI Component

## Status

Accepted

## Context

The APEX CLI needs a component to display real-time resource usage information in the terminal. This includes:
- Token usage (input/output/total)
- Cost (formatted as currency)
- API call count

The component must update in-place without scrolling, matching the patterns established by existing status components (TokenCounter, CostTracker, SessionTimer).

## Decision

### Component Architecture

Create a new `ResourceUsageDisplay` component in `packages/cli/src/ui/components/status/` that follows the established Ink.js React component patterns.

#### Component Interface

```typescript
// File: packages/cli/src/ui/components/status/ResourceUsageDisplay.tsx

export interface ResourceUsageDisplayProps {
  // Token metrics
  inputTokens: number;
  outputTokens: number;

  // Cost tracking
  cost: number;
  currency?: string;           // Default: '$'

  // API calls count
  apiCalls: number;

  // Display configuration
  showBreakdown?: boolean;     // Show input→output tokens (default: auto based on total > 1000)
  compact?: boolean;           // Compact mode for narrow terminals (default: false)
  label?: string;              // Custom label prefix (default: 'usage')
}
```

#### Key Design Decisions

1. **Composition over Monolith**: The component will internally use existing formatting logic patterns from TokenCounter and CostTracker rather than reimplementing them. This ensures consistency and reduces code duplication.

2. **Ink.js Framework**: Use Ink.js `<Text>` and `<Box>` components for terminal rendering. No direct terminal control sequences needed - Ink handles in-place updates automatically through React reconciliation.

3. **Theme Integration**: Use `useThemeColors()` hook for consistent color coding across the CLI.

4. **Smart Formatting**:
   - Tokens: Use adaptive units (M for millions, k for thousands, raw for < 1000)
   - Cost: Use precision based on magnitude (4 decimals < $0.01, 3 decimals < $1, 2 decimals >= $1)
   - API Calls: Simple comma-formatted numbers with locale support

5. **Color Coding for Cost**:
   - `muted` (gray): $0
   - `success` (green): < $0.10
   - `info` (blue): < $1.00
   - `warning` (yellow): < $5.00
   - `error` (red): >= $5.00

6. **No Real-time Updates via Intervals**: Unlike SessionTimer, this component displays static data passed via props. The parent component is responsible for updating props when new data is available. This follows the React principle of "props down, events up".

### Helper Functions

Export standalone helper functions for reuse across the codebase:

```typescript
// Token formatting with smart units
export function formatTokenCount(count: number): string {
  if (count >= 1_000_000) {
    return `${(count / 1_000_000).toFixed(1)}M`;
  }
  if (count >= 1_000) {
    return `${(count / 1_000).toFixed(1)}k`;
  }
  return count.toString();
}

// Cost formatting with adaptive precision
export function formatCurrency(amount: number, currency: string = '$'): string {
  if (amount === 0) {
    return `${currency}0.00`;
  }
  if (amount < 0.01) {
    return `${currency}${amount.toFixed(4)}`;
  }
  if (amount < 1) {
    return `${currency}${amount.toFixed(3)}`;
  }
  return `${currency}${amount.toFixed(2)}`;
}

// API calls formatting with locale commas
export function formatApiCalls(count: number): string {
  return count.toLocaleString();
}
```

### Rendering Layout

```
usage: 1.2k→800 (2k total) | $0.0034 | 5 calls
       ^tokens breakdown^    ^cost^   ^api calls^
```

Compact mode:
```
2k tok | $0.00 | 5
```

### File Structure

```
packages/cli/src/ui/components/status/
├── TokenCounter.tsx         # Existing
├── CostTracker.tsx          # Existing
├── SessionTimer.tsx         # Existing
├── ResourceUsageDisplay.tsx # NEW
├── index.ts                 # Export barrel (create if not exists)
└── __tests__/
    ├── TokenCounter.test.tsx
    ├── CostTracker.test.tsx
    ├── SessionTimer.test.tsx
    └── ResourceUsageDisplay.test.tsx  # NEW
```

### Integration with Types

Use the existing `TaskUsage` type from `@apex/core`:

```typescript
// From packages/core/src/types.ts
interface TaskUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  estimatedCost: number;
  totalCostCents: number;
  executionTimeMs: number;
}
```

The component can be used with TaskUsage data:
```tsx
<ResourceUsageDisplay
  inputTokens={usage.inputTokens}
  outputTokens={usage.outputTokens}
  cost={usage.estimatedCost}
  apiCalls={apiCallCount}
/>
```

### Export Strategy

Add to `packages/cli/src/ui/components/index.ts`:
```typescript
export {
  ResourceUsageDisplay,
  type ResourceUsageDisplayProps,
  formatTokenCount,
  formatCurrency,
  formatApiCalls
} from './status/ResourceUsageDisplay.js';
```

## Alternatives Considered

1. **Direct Terminal Control Sequences**: Rejected. Ink.js abstracts terminal rendering and provides better cross-platform compatibility and testing support.

2. **Single Monolithic Formatter Function**: Rejected. Exporting individual helper functions provides more flexibility for consumers who may only need specific formatting.

3. **Inheriting from a Base Component**: Rejected. React favors composition over inheritance. The component is simple enough that a base class adds unnecessary complexity.

4. **Including Execution Time**: Considered but excluded from initial implementation. Execution time is already handled by SessionTimer component. Can be added later if needed.

## Consequences

### Positive

- Consistent with existing component patterns
- Reusable formatting functions
- Easy to test with React Testing Library
- Theme-aware for dark/light mode support
- No terminal flicker due to Ink.js reconciliation

### Negative

- Requires parent component to manage API call count (not available in TaskUsage)
- Additional file to maintain

### Risks

- API call count is not currently tracked in `TaskUsage` type. The developer stage should verify how to source this data or propose a type enhancement.

## Implementation Notes for Developer Stage

1. Create `ResourceUsageDisplay.tsx` following the patterns in TokenCounter.tsx and CostTracker.tsx
2. Export helper functions at module level for reuse
3. Add component and helpers to the components index.ts barrel export
4. Write unit tests covering:
   - Token formatting at various scales (0, 100, 1000, 1M)
   - Cost formatting at various precision levels
   - Color coding thresholds
   - Compact mode rendering
   - Breakdown visibility toggle
5. Ensure `npm run build` and `npm run test` pass

## References

- Existing components: `packages/cli/src/ui/components/status/`
- Theme types: `packages/cli/src/types/theme.ts`
- Task usage types: `packages/core/src/types.ts`
- Ink.js documentation: https://github.com/vadimdemedes/ink
