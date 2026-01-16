# ADR-0012: Visual Comparison Event Types

## Status
Proposed

## Context
The browser automation system in APEX includes a `compareScreenshot()` operation for visual regression testing. Currently, the comparison results are returned but not emitted as events. To enable real-time monitoring, test dashboards, and CI/CD integration, we need to emit events when visual comparisons fail.

## Decision

### 1. Zod Schema for VisualComparisonEvent

Add a new Zod schema in `packages/core/src/types.ts`:

```typescript
/**
 * Event data for visual comparison results
 * Emitted when compareScreenshot() completes with comparison result
 */
export const VisualComparisonEventSchema = z.object({
  /** Unique test/comparison identifier */
  testId: z.string().min(1),
  /** Path to baseline image */
  baseline: z.string().min(1),
  /** Path to actual (current) image or base64 data URI */
  actual: z.string().min(1),
  /** Path to diff image (if generated) */
  diffImage: z.string().optional(),
  /** Percentage of pixels that differ (0-100) */
  diffPercentage: z.number().min(0).max(100),
  /** Threshold percentage for acceptable difference (0-100) */
  threshold: z.number().min(0).max(100),
  /** Whether the comparison passed (diffPercentage <= threshold) */
  passed: z.boolean(),
  /** Task ID associated with this comparison */
  taskId: z.string().optional(),
  /** Timestamp when comparison occurred */
  timestamp: z.date(),
  /** URL of the page being compared (if applicable) */
  pageUrl: z.string().optional(),
  /** Selector if element-specific comparison */
  selector: z.string().optional(),
});
export type VisualComparisonEvent = z.infer<typeof VisualComparisonEventSchema>;
```

### 2. Event Type Addition to ApexEventType

Add the new event type to the `ApexEventType` union in `packages/core/src/types.ts`:

```typescript
export type ApexEventType =
  // ... existing types ...
  | 'visual:comparison:failed'
  | 'visual:comparison:passed'; // Optional: for completeness
```

### 3. OrchestratorEvents Interface Update

Add to the `OrchestratorEvents` interface in `packages/orchestrator/src/index.ts`:

```typescript
export interface OrchestratorEvents {
  // ... existing events ...

  // Visual comparison events (v0.5.0)
  'visual:comparison:failed': (event: VisualComparisonEvent) => void;
  'visual:comparison:passed': (event: VisualComparisonEvent) => void;
}
```

### 4. BrowserTool Modifications

Modify `compareScreenshot()` in `packages/orchestrator/src/tools/browser-tool.ts` to:

1. Accept an optional `testId` parameter in `BrowserCompareScreenshotParams`
2. Accept an optional `eventEmitter` in the BrowserTool constructor or execute method
3. Emit `visual:comparison:failed` event when `match === false`
4. Optionally emit `visual:comparison:passed` when comparison succeeds

The event emission should happen after the comparison is computed but before the result is returned.

## Architecture Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│                          BrowserTool                                │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  compareScreenshot(params)                                   │   │
│  │    1. Capture current screenshot                             │   │
│  │    2. Load baseline                                          │   │
│  │    3. Compute diff with pixelmatch                           │   │
│  │    4. Calculate diffPercentage = (diffPixels/total) * 100    │   │
│  │    5. Determine passed = diffPercentage <= threshold         │   │
│  │    6. If !passed: emit('visual:comparison:failed', event)    │   │
│  │    7. Return result                                          │   │
│  └─────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      ApexOrchestrator                               │
│    (EventEmitter<OrchestratorEvents>)                              │
│                                                                     │
│    Listeners:                                                       │
│      - CLI: Display visual regression alerts                        │
│      - API: Stream to WebSocket clients                             │
│      - Test Dashboard: Track regression history                     │
└─────────────────────────────────────────────────────────────────────┘
```

## Implementation Details

### BrowserCompareScreenshotParams Enhancement

```typescript
export interface BrowserCompareScreenshotParams {
  // ... existing fields ...
  /** Unique test identifier for event correlation */
  testId?: string;
}
```

### Event Emission in compareScreenshot()

```typescript
// After computing diffRatio and match
const diffPercentage = diffRatio * 100;
const passed = diffRatio <= (compareParams.threshold ?? 0.1);

if (!passed && this.eventEmitter) {
  const event: VisualComparisonEvent = {
    testId: compareParams.testId || `visual-${Date.now()}`,
    baseline: compareParams.baselinePath,
    actual: compareParams.diffPath || 'in-memory',
    diffImage: compareParams.diffPath,
    diffPercentage,
    threshold: (compareParams.threshold ?? 0.1) * 100,
    passed: false,
    taskId: this.taskId,
    timestamp: new Date(),
    pageUrl: this.getCurrentUrl(),
    selector: compareParams.selector,
  };
  this.eventEmitter.emit('visual:comparison:failed', event);
}
```

## Consequences

### Positive
- Enables real-time visual regression monitoring
- Supports CI/CD integration via event streaming
- Provides structured data for test reporting dashboards
- Follows existing event patterns in the codebase
- Type-safe with Zod validation

### Negative
- Adds dependency on eventEmitter being passed to BrowserTool
- Slight increase in types.ts file size
- Requires import of VisualComparisonEvent in orchestrator

### Neutral
- Consistent with existing event architecture
- No breaking changes to existing API

## Files to Modify

1. `packages/core/src/types.ts` - Add VisualComparisonEventSchema and update ApexEventType
2. `packages/orchestrator/src/index.ts` - Add event to OrchestratorEvents interface
3. `packages/orchestrator/src/tools/browser-tool.ts` - Emit event on comparison failure

## Testing Strategy

1. **Unit Tests**: Verify event emission with correct payload structure
2. **Integration Tests**: Verify event flows through orchestrator
3. **Type Tests**: Verify TypeScript compilation with new types

## References

- Existing browser events in OrchestratorEvents (lines 352-368)
- BrowserCompareScreenshotParams (browser-tool.ts lines 122-137)
- compareScreenshot implementation (browser-tool.ts lines 1057-1140)
