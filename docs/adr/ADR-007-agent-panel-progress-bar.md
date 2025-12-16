# ADR-007: Add Progress Bar to Active Agents in AgentPanel

## Status
Proposed

## Date
2024-12-12

## Context

The `AgentPanel` component currently displays agent status information including:
- Agent name with status icon (⚡ active, ✓ completed, ○ waiting, · idle, ⟂ parallel)
- Stage information in parentheses (e.g., "(implementation)")
- Progress as text percentage (e.g., "75%")
- Elapsed time for active agents with `startedAt` (e.g., "[42s]")

The current progress display is text-only (`75%`), which is not as visually intuitive as a progress bar. The acceptance criteria require:
1. Active agents show progress bar when progress is defined
2. Elapsed time shown for active agents with startedAt timestamp (**already implemented**)
3. AgentInfo interface extended with startedAt optional field (**already implemented**)
4. Tests cover progress bar and elapsed time display

### Current State Analysis

| Feature | Status | Location |
|---------|--------|----------|
| `AgentInfo.startedAt` field | ✅ Implemented | `AgentPanel.tsx:12` |
| `useElapsedTime` hook | ✅ Implemented | `useElapsedTime.ts` |
| Elapsed time display | ✅ Implemented | `AgentRow` and compact mode |
| Progress percentage text | ✅ Implemented | `AgentRow` lines 158-162 |
| Visual progress bar | ❌ **Missing** | Needs implementation |

## Decision

We will enhance `AgentPanel` to display a visual progress bar for active agents using the existing `ProgressBar` component from `ProgressIndicators.tsx`.

### Design Approach

#### 1. Component Integration Strategy

**Option A: Inline Mini Progress Bar (Recommended)**
- Add a compact, inline progress bar next to the agent row
- Use a narrow width (e.g., 20 characters) to fit within the panel
- Maintain the existing layout pattern

**Option B: Full-Width Progress Bar Below Agent Name**
- Add progress bar on a new line below the agent info
- More visible but takes more vertical space

**Recommendation**: Use Option A for `AgentRow` (full mode) and a simplified text-based indicator for compact mode.

#### 2. Technical Design

```typescript
// AgentRow component enhancement
function AgentRow({ agent, isActive }: { agent: AgentInfo; isActive: boolean }): React.ReactElement {
  // ... existing code ...

  // Show progress bar for active agents with defined progress (0 < progress < 100)
  const showProgressBar =
    (agent.status === 'active' || agent.status === 'parallel') &&
    agent.progress !== undefined &&
    agent.progress > 0 &&
    agent.progress < 100;

  return (
    <Box flexDirection="column">
      <Box>
        {/* Existing agent name, icon, stage, elapsed time */}
      </Box>
      {showProgressBar && (
        <Box marginLeft={2}>
          <ProgressBar
            progress={agent.progress!}
            width={20}
            showPercentage={true}
            color={finalColor}
            animated={false}  // No animation to avoid performance issues
          />
        </Box>
      )}
    </Box>
  );
}
```

#### 3. Compact Mode Design

For compact mode, we'll maintain the existing text-based percentage display since:
- Compact mode is meant for minimal space usage
- The current `75%` text is appropriate for inline display
- Adding a progress bar would defeat the "compact" purpose

#### 4. ParallelSection Enhancement

Apply the same pattern to `ParallelSection` for parallel agents.

### Interface Changes

**No changes required** - `AgentInfo` already has all needed fields:

```typescript
export interface AgentInfo {
  name: string;
  status: 'active' | 'waiting' | 'completed' | 'idle' | 'parallel';
  stage?: string;
  progress?: number; // 0-100 - already exists
  startedAt?: Date;  // already exists
}
```

### Visibility Rules

| Condition | Progress Bar | Percentage Text |
|-----------|--------------|-----------------|
| `progress` undefined | Hidden | Hidden |
| `progress === 0` | Hidden | Hidden |
| `progress === 100` | Hidden | Hidden |
| `0 < progress < 100` AND full mode | **Shown** | Hidden (bar has %) |
| `0 < progress < 100` AND compact mode | Hidden | Shown |

### Import Requirements

Add to `AgentPanel.tsx`:
```typescript
import { ProgressBar } from '../../components/ProgressIndicators.js';
```

## Consequences

### Positive
- More intuitive visual representation of agent progress
- Leverages existing `ProgressBar` component (no new component needed)
- Consistent with project's terminal UI patterns
- Minimal code changes required
- Backward compatible (no interface changes)

### Negative
- Slightly increased vertical space in full mode when progress is shown
- Additional import in AgentPanel

### Risks
- Performance: Using `animated={false}` mitigates animation performance concerns
- Terminal compatibility: `ProgressBar` already uses terminal-safe characters (`█` and `░`)

## Test Plan

1. **Unit Tests**: Verify progress bar renders when `progress` is between 0-100
2. **Edge Cases**: Test progress at 0, 50, 100, undefined
3. **Mode Tests**: Verify full mode shows bar, compact mode shows text percentage
4. **Integration Tests**: Verify with actual agent state transitions
5. **Parallel Agent Tests**: Verify progress bars in parallel section

## Implementation Notes for Developer Stage

1. Import `ProgressBar` from `../ProgressIndicators.js`
2. Modify `AgentRow` to render progress bar conditionally
3. Modify `ParallelSection` similarly
4. Remove the text percentage display in `AgentRow` when showing progress bar (avoid duplication)
5. Keep text percentage in compact mode
6. Add comprehensive tests for new progress bar display

## Files to Modify

| File | Changes |
|------|---------|
| `packages/cli/src/ui/components/agents/AgentPanel.tsx` | Add ProgressBar import, update AgentRow and ParallelSection |
| `packages/cli/src/ui/components/agents/__tests__/AgentPanel.test.tsx` | Add progress bar tests |

## Related

- `packages/cli/src/ui/components/ProgressIndicators.tsx` - Existing ProgressBar component
- `packages/cli/src/ui/hooks/useElapsedTime.ts` - Already integrated elapsed time hook
- ADR-001 through ADR-006 - Previous architectural decisions
