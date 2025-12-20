# ADR-033: PreviewPanel Responsive Terminal Width Adaptation

## Status

**Approved** - Architecture complete, ready for implementation

## Context

The PreviewPanel component displays input preview information including detected intent, confidence scores, workflow details, and action buttons. As part of the v0.3.0 feature set, the component must adapt to various terminal widths to ensure a good user experience across different terminal configurations.

### Current State Analysis

**The PreviewPanel component already has substantial responsive implementation:**

1. **Hook Integration**: Uses `useStdoutDimensions` hook (lines 3, 136) with 80-column fallback
2. **4-Tier Breakpoint System**: Implements `RESPONSIVE_CONFIGS` for all breakpoints:
   - `narrow` (<60 columns)
   - `compact` (60-99 columns)
   - `normal` (100-159 columns)
   - `wide` (>=160 columns)
3. **Content Adaptation**: Truncates input and action descriptions based on breakpoint
4. **Progressive UI Hiding**: Decorative elements hidden progressively as width decreases
5. **Width Override**: Supports explicit `width` prop for testing scenarios

### Existing Responsive Configuration

```typescript
const RESPONSIVE_CONFIGS: Record<Breakpoint, ResponsivePreviewConfig> = {
  narrow: {
    showBorder: false,
    showTitle: false,
    showStatusIndicator: false,
    maxInputLength: 30,
    showConfidencePercentage: false,
    showWorkflowDetails: false,
    maxActionDescriptionLength: 20,
    showButtonLabels: false,
    compactButtons: true,
  },
  compact: {
    showBorder: true,
    showTitle: true,
    showStatusIndicator: false,
    maxInputLength: 60,
    showConfidencePercentage: true,
    showWorkflowDetails: false,
    maxActionDescriptionLength: 40,
    showButtonLabels: true,
    compactButtons: true,
  },
  normal: {
    showBorder: true,
    showTitle: true,
    showStatusIndicator: true,
    maxInputLength: 100,
    showConfidencePercentage: true,
    showWorkflowDetails: true,
    maxActionDescriptionLength: 80,
    showButtonLabels: true,
    compactButtons: false,
  },
  wide: {
    showBorder: true,
    showTitle: true,
    showStatusIndicator: true,
    maxInputLength: 150,
    showConfidencePercentage: true,
    showWorkflowDetails: true,
    maxActionDescriptionLength: 120,
    showButtonLabels: true,
    compactButtons: false,
  },
};
```

### Acceptance Criteria Assessment

| Criterion | Status | Notes |
|-----------|--------|-------|
| PreviewPanel uses useStdoutDimensions hook | ✅ Complete | Line 136 |
| Abbreviates intent details in narrow terminals | ✅ Complete | `maxInputLength: 30`, `maxActionDescriptionLength: 20` |
| Shows full confidence percentage in wide terminals | ✅ Complete | `showConfidencePercentage: true` for compact/normal/wide |
| Shows agent flow in wide terminals | ✅ Complete | `showWorkflowDetails: true` for normal/wide |
| No horizontal overflow | ✅ Complete | Content truncation with ellipsis |
| Tests cover all breakpoints | ⚠️ Needs Verification | Multiple test files exist |

## Decision

**The responsive width adaptation feature is architecturally complete.** The implementation follows a well-designed pattern using:

1. **Configuration-driven responsiveness**: A `ResponsivePreviewConfig` interface defines all responsive properties
2. **Breakpoint-based configuration lookup**: `RESPONSIVE_CONFIGS` map provides per-breakpoint settings
3. **Memoized configuration selection**: `useMemo` prevents unnecessary recalculations
4. **Progressive enhancement**: Content degrades gracefully from wide to narrow

### Architecture Diagram

```
                    ┌─────────────────────────────────────────┐
                    │          Terminal Environment          │
                    │         (stdout dimensions)            │
                    └─────────────────┬───────────────────────┘
                                      │
                                      ▼
                    ┌─────────────────────────────────────────┐
                    │        useStdoutDimensions Hook        │
                    │  - width, height, breakpoint           │
                    │  - isNarrow, isCompact, isNormal, isWide│
                    │  - resize event listener               │
                    └─────────────────┬───────────────────────┘
                                      │
                       ┌──────────────┴──────────────┐
                       │                             │
                       ▼                             ▼
          ┌────────────────────┐        ┌────────────────────┐
          │  Hook returns      │        │  Explicit width    │
          │  breakpoint        │        │  prop override     │
          └─────────┬──────────┘        └─────────┬──────────┘
                    │                             │
                    └───────────┬─────────────────┘
                                │
                                ▼
                    ┌─────────────────────────────────────────┐
                    │      Breakpoint Calculation Logic      │
                    │  if (explicitWidth) {                  │
                    │    calculate breakpoint from width     │
                    │  } else {                              │
                    │    use hook's breakpoint               │
                    │  }                                     │
                    └─────────────────┬───────────────────────┘
                                      │
                                      ▼
                    ┌─────────────────────────────────────────┐
                    │     RESPONSIVE_CONFIGS[breakpoint]     │
                    │                                         │
                    │  narrow   │ compact │ normal  │ wide   │
                    │  ─────────│─────────│─────────│─────── │
                    │  minimal  │ basic   │ full    │ full   │
                    │  no title │ title   │ all     │ all    │
                    │  no conf% │ conf%   │ agent   │ agent  │
                    │  keys only│ labels  │ flow    │ flow   │
                    └─────────────────┬───────────────────────┘
                                      │
                                      ▼
                    ┌─────────────────────────────────────────┐
                    │          PreviewPanel Render           │
                    │                                         │
                    │  Conditional rendering based on config: │
                    │  - showBorder → border style            │
                    │  - showTitle → header section           │
                    │  - showConfidencePercentage → conf%     │
                    │  - showWorkflowDetails → agent flow     │
                    │  - maxInputLength → truncation          │
                    │  - showButtonLabels → labels            │
                    └─────────────────────────────────────────┘
```

### Content Adaptation Strategy

#### Narrow Mode (<60 columns) - Minimal Display
```
Detected Intent:
📝 Task Intent
Action: Create task (f...

[Enter] [Esc] [e]
```

#### Compact Mode (60-99 columns) - Basic Display
```
┌──────────────────────────────────────────────────────────┐
│📋 Input Preview                                          │
│                                                          │
│Input: "Create a new React component with TypeScript..."  │
│                                                          │
│Detected Intent:                                          │
│📝 Task Intent                      Confidence: 85%       │
│Action: Create task (feature workflow)                    │
│                                                          │
│[Enter] Confirm  [Esc] Cancel  [e] Edit                  │
└──────────────────────────────────────────────────────────┘
```

#### Normal/Wide Mode (>=100 columns) - Full Display
```
╭────────────────────────────────────────────────────────────────────────────────╮
│📋 Input Preview                                                        [on]    │
│                                                                                │
│Input: "Create a new React component with TypeScript support and tests"        │
│                                                                                │
│Detected Intent:                                                                │
│┌──────────────────────────────────────────────────────────────────────────────┐│
││📝 Task Intent                                              Confidence: 85%  ││
││Action: Create task (feature workflow)                                       ││
││Agent Flow: planner → architect → developer → tester                         ││
│└──────────────────────────────────────────────────────────────────────────────┘│
│                                                                                │
│[Enter] Confirm      [Esc] Cancel      [e] Edit                                │
╰────────────────────────────────────────────────────────────────────────────────╯
```

### Interface Design

```typescript
interface ResponsivePreviewConfig {
  // Border and layout
  showBorder: boolean;
  borderStyle: 'round' | 'single' | 'none';
  paddingX: number;
  paddingY: number;
  marginBottom: number;

  // Content display
  showTitle: boolean;
  showStatusIndicator: boolean;
  maxInputLength: number;
  truncateInput: boolean;

  // Intent section
  showIntentBorder: boolean;
  showConfidencePercentage: boolean;
  showWorkflowDetails: boolean;
  maxActionDescriptionLength: number;

  // Action buttons
  showButtonLabels: boolean;
  compactButtons: boolean;
}
```

## Test Coverage Analysis

### Existing Test Files

| File | Coverage Area | Tests |
|------|--------------|-------|
| `PreviewPanel.responsive.test.tsx` | Breakpoint behavior | 20+ tests |
| `PreviewPanel.overflow.test.tsx` | Overflow prevention | 15+ tests |
| `PreviewPanel.hook-integration.test.tsx` | Hook integration | 25+ tests |
| `PreviewPanel.responsive.edge-cases.test.tsx` | Edge cases | TBD |
| `PreviewPanel.responsive.performance.test.tsx` | Performance | TBD |
| `PreviewPanel.responsive.accessibility.test.tsx` | A11y | TBD |

### Test Scenarios Covered

1. **Breakpoint transitions**: All four breakpoints tested
2. **Content truncation**: Input and action description limits
3. **Progressive hiding**: UI elements hidden/shown per breakpoint
4. **Width override**: Explicit width prop behavior
5. **Hook integration**: Fallback and override behavior
6. **Overflow prevention**: No horizontal overflow at any width
7. **Intent variations**: All intent types across breakpoints

### Test Verification Needed

The developer stage should verify:
1. All tests in `PreviewPanel.responsive.*.test.tsx` pass
2. Edge case tests cover boundary values (59, 60, 99, 100, 159, 160)
3. Performance tests validate render efficiency during breakpoint changes

## Implementation Status

### Completed

- [x] `useStdoutDimensions` hook with 4-tier breakpoints
- [x] `ResponsivePreviewConfig` interface
- [x] `RESPONSIVE_CONFIGS` for all breakpoints
- [x] Content truncation helpers (`formatInput`, `formatActionDescription`)
- [x] Conditional rendering logic
- [x] Responsive test suite
- [x] Hook integration tests
- [x] Overflow prevention tests

### Not Required (Architecture Phase)

- [ ] Test execution and verification (developer stage)
- [ ] Bug fixes if tests fail (developer stage)
- [ ] Performance optimization if needed (developer stage)

## Consequences

### Positive

1. **Complete implementation**: Feature is architecturally complete
2. **Comprehensive testing**: Multiple test files cover all scenarios
3. **Clean architecture**: Configuration-driven approach is maintainable
4. **Consistent with codebase**: Follows patterns established in other responsive components

### Negative

1. **Configuration complexity**: 4-tier system adds maintenance overhead
2. **Test volume**: Large number of tests to maintain

### Neutral

1. **No changes needed**: Architecture review confirms implementation is complete

## Related ADRs

- ADR-023: useStdoutDimensions Hook Breakpoint System
- ADR-0004: Input Preview Feature Architecture
- ADR-028: StatusBar Abbreviated Labels
- ADR-029: ErrorDisplay Responsive Width

## Files Involved

### Core Implementation (Complete)
- `packages/cli/src/ui/components/PreviewPanel.tsx`
- `packages/cli/src/ui/hooks/useStdoutDimensions.ts`

### Test Files (Complete)
- `packages/cli/src/ui/components/__tests__/PreviewPanel.responsive.test.tsx`
- `packages/cli/src/ui/components/__tests__/PreviewPanel.overflow.test.tsx`
- `packages/cli/src/ui/components/__tests__/PreviewPanel.hook-integration.test.tsx`
- `packages/cli/src/ui/components/__tests__/PreviewPanel.responsive.edge-cases.test.tsx`
- `packages/cli/src/ui/components/__tests__/PreviewPanel.responsive.performance.test.tsx`
- `packages/cli/src/ui/components/__tests__/PreviewPanel.responsive.accessibility.test.tsx`

## Recommendations for Next Stages

### Developer Stage
1. Run all PreviewPanel tests to verify implementation
2. Address any failing tests
3. Ensure test coverage is complete for all breakpoints

### Tester Stage
1. Manual testing across terminal widths (40, 80, 120, 180 columns)
2. Verify no horizontal overflow occurs
3. Test resize behavior (dynamic breakpoint changes)
4. Verify accessibility in narrow mode

### Reviewer Stage
1. Verify responsive configs match acceptance criteria
2. Ensure test coverage is sufficient
3. Review performance implications
