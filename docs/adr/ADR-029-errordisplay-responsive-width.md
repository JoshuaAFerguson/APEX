# ADR-029: ErrorDisplay Component Responsive Width

## Status
Proposed

## Context

The APEX CLI requires responsive components that adapt to terminal width. The `ErrorDisplay.tsx` file contains three components:
1. `ErrorDisplay` - Main error display with suggestions
2. `ErrorSummary` - Compact error summary for multiple errors
3. `ValidationError` - Field validation error display

### Current State

**ActivityLog.tsx** - Already fully implemented with responsive features:
- Uses `useStdoutDimensions` hook
- Has `formatTimestamp` with abbreviated mode
- Has `calculateMessageMaxLength`, `truncateMessage`, and `getResponsiveConfig` helpers
- All three components (`ActivityLog`, `LogStream`, `CompactLog`) use responsive configuration

**ErrorDisplay.tsx** - Needs responsive implementation:
- Uses hardcoded `width = 80` default
- No `useStdoutDimensions` import
- No timestamp abbreviation
- Hardcoded message truncation (`message.length > 60`)
- No responsive behavior for suggestions or context display

### Acceptance Criteria
- ErrorDisplay uses `useStdoutDimensions`
- Error messages truncate/wrap appropriately for narrow terminals
- Timestamps abbreviated in narrow mode

## Decision

Implement responsive width handling in `ErrorDisplay.tsx` following the established patterns from `ActivityLog.tsx`.

### Technical Design

#### 1. Shared Responsive Utilities

Extract and reuse the responsive utilities from ActivityLog or create a shared module:

```typescript
// Timestamp formatting (matches ActivityLog pattern)
const formatTimestamp = (date: Date, abbreviated: boolean = false): string => {
  if (abbreviated) {
    return date.toLocaleTimeString('en-US', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
    });
  }
  return date.toLocaleTimeString('en-US', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
};

// Message truncation
const truncateMessage = (message: string, maxLength: number): string => {
  if (message.length <= maxLength) return message;
  return message.substring(0, maxLength - 3) + '...';
};
```

#### 2. ErrorDisplay Component Changes

```typescript
import { useStdoutDimensions } from '../hooks/index.js';

export interface ErrorDisplayProps {
  error: Error | string;
  title?: string;
  suggestions?: ErrorSuggestion[];
  showStack?: boolean;
  showSuggestions?: boolean;
  context?: Record<string, unknown>;
  width?: number;  // Optional explicit width (for testing/fixed containers)
  onRetry?: () => void;
  onDismiss?: () => void;
}

export function ErrorDisplay({
  error,
  // ... other props
  width: explicitWidth,
}: ErrorDisplayProps): React.ReactElement {
  // Use responsive dimensions when explicit values aren't provided
  const { width: terminalWidth, breakpoint, isNarrow } = useStdoutDimensions();
  const width = explicitWidth ?? terminalWidth;

  // Calculate responsive configuration
  const messageMaxLength = Math.max(30, width - 10); // Reserve for borders/padding
  const suggestionDescMaxLength = Math.max(25, width - 16); // Indent + icon
  const contextValueMaxLength = Math.max(20, width - 20);

  // ... render with truncation applied
}
```

#### 3. ErrorSummary Component Changes

```typescript
export interface ErrorSummaryProps {
  errors: Array<{
    id: string;
    message: string;
    timestamp: Date;
    severity: 'error' | 'warning' | 'info';
    resolved?: boolean;
  }>;
  title?: string;
  maxErrors?: number;
  showTimestamps?: boolean;
  width?: number;  // New: optional explicit width
}

export function ErrorSummary({
  errors,
  title = 'Recent Issues',
  maxErrors = 5,
  showTimestamps = true,
  width: explicitWidth,
}: ErrorSummaryProps): React.ReactElement {
  // Use responsive dimensions
  const { width: terminalWidth, breakpoint, isNarrow } = useStdoutDimensions();
  const width = explicitWidth ?? terminalWidth;

  // Responsive configuration
  const abbreviateTimestamp = isNarrow;
  const messageMaxLength = Math.max(20, width - (showTimestamps ? 20 : 8));

  // ... render with truncation and abbreviated timestamps
}
```

#### 4. ValidationError Component Changes

```typescript
export interface ValidationErrorProps {
  field: string;
  value: unknown;
  errors: string[];
  suggestions?: string[];
  width?: number;  // New: optional explicit width
  onFix?: (field: string, value: unknown) => void;
}

export function ValidationError({
  field,
  value,
  errors,
  suggestions = [],
  width: explicitWidth,
  onFix,
}: ValidationErrorProps): React.ReactElement {
  const { width: terminalWidth, isNarrow } = useStdoutDimensions();
  const width = explicitWidth ?? terminalWidth;

  // Responsive truncation
  const valueMaxLength = isNarrow ? 20 : 40;
  const errorMaxLength = Math.max(30, width - 8);

  // ... render with truncation
}
```

### Responsive Behavior Matrix

| Breakpoint | Width | Timestamp Format | Message Max | Suggestions |
|------------|-------|------------------|-------------|-------------|
| narrow     | <60   | HH:MM           | width - 10  | Truncated heavily |
| compact    | 60-100| HH:MM:SS        | width - 10  | Truncated moderately |
| normal     | 100-160| HH:MM:SS       | width - 10  | Full or light truncation |
| wide       | ≥160  | HH:MM:SS        | Full        | Full |

### Implementation Notes

1. **Consistent with ActivityLog**: Follow the same patterns for:
   - Timestamp abbreviation in narrow mode
   - Message truncation with `...` suffix
   - Reserved space calculations

2. **Error Message Wrapping**: Use Ink's `wrap="wrap"` for error messages when truncation isn't appropriate (main error message should wrap, not truncate)

3. **Priority**: In narrow terminals:
   - Main error message: wrap (not truncate)
   - Suggestions: truncate with priority icons preserved
   - Context values: truncate
   - Stack traces: limit lines shown

4. **Testing Considerations**:
   - Add `width` prop for explicit width testing
   - Test narrow (<60), compact (60-100), normal (100-160), and wide (≥160) scenarios

## Consequences

### Positive
- Consistent responsive behavior across CLI components
- Better UX in narrow terminals
- Follows established patterns from ActivityLog
- Maintains explicit width override for testing

### Negative
- Slightly more complex rendering logic
- Potential for truncated information loss (mitigated by wrap on critical content)

### Risks
- Truncation could hide important error context (mitigated by wrapping main error message)

## Files to Modify

| File | Changes |
|------|---------|
| `packages/cli/src/ui/components/ErrorDisplay.tsx` | Add responsive width handling to all three components |

## Implementation Plan

1. **Phase 1**: Add `useStdoutDimensions` import and width detection to `ErrorDisplay`
2. **Phase 2**: Update `ErrorSummary` with timestamp abbreviation and message truncation
3. **Phase 3**: Update `ValidationError` with responsive truncation
4. **Phase 4**: Add unit tests for responsive behavior

## Related Decisions
- ADR-023: useStdoutDimensions Hook Breakpoint System
- ADR-016: Responsive Width for StreamingText/Markdown

## References
- ActivityLog.tsx implementation patterns
- useStdoutDimensions hook documentation
