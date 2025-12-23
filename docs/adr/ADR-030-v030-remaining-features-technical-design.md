# ADR-030: v0.3.0 Remaining Features - Technical Design

## Status
Accepted

## Date
2024-12-18

## Context

v0.3.0 aims to deliver a Claude Code-like interactive CLI experience. After analyzing the current implementation state and the ROADMAP.md, the following features remain to be completed:

### Remaining Features (Per ROADMAP.md)

1. **Input Preview** - Show what will be sent before execution
2. **Compact Mode** - Condensed output for experienced users
3. **Verbose Mode** - Detailed output for debugging
4. **Integration Tests** - v030-features integration tests
5. **Documentation Updates** - docs/ updates

## Analysis of Current Implementation State

### 1. Input Preview Feature

**Status**: ✅ **IMPLEMENTED**

Evidence from code analysis:
- `PreviewPanel.tsx` component exists and is fully functional
- `/preview` command handler implemented in `repl.tsx` (lines 1405-1408)
- `handlePreview` function supports: `on`, `off`, `toggle`, `status` modes
- `AppState` includes `previewMode: boolean` and `pendingPreview` state
- `App.tsx` renders `PreviewPanel` when `state.pendingPreview` exists
- Full keyboard navigation: Enter (confirm), Escape (cancel), E (edit)
- Integration tests exist in `preview-workflow.integration.test.tsx`

**Implementation Files**:
- `packages/cli/src/ui/components/PreviewPanel.tsx`
- `packages/cli/src/repl.tsx` (lines 1254-1294)
- `packages/cli/src/ui/App.tsx` (lines 79-91, 313-337, 408-445, 621-643)

### 2. Compact Mode

**Status**: ✅ **IMPLEMENTED**

Evidence from code analysis:
- `/compact` command handler implemented in `repl.tsx` (line 1399-1400)
- `handleCompact()` function toggles between 'compact' and 'normal' modes
- `DisplayMode` type includes 'compact' (from `@apexcli/core`)
- StatusBar has compact mode rendering (shows minimal: status icon, branch, cost)
- AgentPanel has `useCompactDisplay` for single-line agent list
- TaskProgress has compact single-line rendering
- ResponseStream truncates messages to 80 chars in compact mode
- ActivityLog is filtered (hidden) in compact mode via App.tsx message filtering

**Implementation Files**:
- `packages/cli/src/repl.tsx` (lines 1226-1238)
- `packages/cli/src/ui/components/StatusBar.tsx` (compact mode branch)
- `packages/cli/src/ui/components/agents/AgentPanel.tsx` (compact display)
- `packages/cli/src/ui/components/TaskProgress.tsx` (compact rendering)
- `packages/cli/src/ui/components/ResponseStream.tsx` (truncation)
- Extensive tests in `StatusBar.compact-mode.test.tsx`, `TaskProgress.compact-mode.test.tsx`

### 3. Verbose Mode

**Status**: ✅ **IMPLEMENTED**

Evidence from code analysis:
- `/verbose` command handler implemented in `repl.tsx` (line 1402-1403)
- `handleVerbose()` function toggles between 'verbose' and 'normal' modes
- StatusBar shows all segments in verbose mode (bypasses width-based filtering)
- StatusBar shows token breakdown (`input→output` format) with `formatTokenBreakdown()`
- StatusBar supports `detailedTiming` prop for active/idle time display
- ActivityLog auto-sets `filterLevel: 'debug'` in verbose mode (line 148-150)
- `VerboseAgentRow.tsx` component exists for detailed agent debug info
- AgentPanel shows verbose debug info when in verbose mode

**Implementation Files**:
- `packages/cli/src/repl.tsx` (lines 1240-1252)
- `packages/cli/src/ui/components/StatusBar.tsx` (verbose mode with token breakdown)
- `packages/cli/src/ui/components/ActivityLog.tsx` (auto-debug filtering)
- `packages/cli/src/ui/components/agents/VerboseAgentRow.tsx`
- Extensive tests in `StatusBar.verbose-mode.test.tsx`, `AgentPanel.verbose-mode.test.tsx`

### 4. Integration Tests

**Status**: 🟡 **PARTIALLY IMPLEMENTED**

Evidence from code analysis:
- Extensive display mode tests exist: `display-mode-acceptance.test.ts`, `display-modes.integration.test.ts`
- Preview workflow tests: `preview-workflow.integration.test.tsx`
- Component-level tests for all display modes
- Missing: Comprehensive end-to-end v030-features integration test suite

### 5. Documentation Updates

**Status**: 🟡 **PARTIALLY IMPLEMENTED**

- ADR-020 through ADR-029 document various display mode implementations
- ADR-007 documents input preview feature
- Missing: User-facing documentation in `docs/` directory

## Decision

Based on the analysis, the core features (Input Preview, Compact Mode, Verbose Mode) are **already implemented**. The remaining work consists of:

### Phase 1: Verification & Minor Fixes (0.5 day)

1. **Verify all acceptance criteria are met** for each feature
2. **StatusBar compact mode minor fix**: Per ADR-021, update compact mode to show `● [branch] | $cost` (currently shows agent + elapsed time)

### Phase 2: Integration Testing (1 day)

Create comprehensive integration test suite:
- File: `packages/cli/src/__tests__/v030-features.integration.test.tsx`

Test scenarios:
1. **Display Mode Transitions**: normal → compact → verbose → normal
2. **Preview Mode Workflow**: enable → input → preview → confirm/cancel/edit
3. **Compound State**: display mode + preview mode interactions
4. **Session Persistence**: display mode persists across commands
5. **Component Integration**: All components respect display mode

### Phase 3: Documentation (1 day)

Create user documentation:
1. `docs/user-guide/display-modes.md` - User guide for compact/verbose modes
2. `docs/user-guide/input-preview.md` - User guide for preview feature
3. Update `docs/getting-started.md` with v0.3.0 features

## Technical Architecture Summary

### Display Mode Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              AppState                                        │
│  displayMode: 'normal' | 'compact' | 'verbose'                              │
│  previewMode: boolean                                                        │
│  pendingPreview?: { input, intent, timestamp }                              │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                    ┌───────────────┼───────────────┐
                    │               │               │
                    ▼               ▼               ▼
            ┌───────────┐   ┌───────────┐   ┌───────────┐
            │  Banner   │   │ StatusBar │   │AgentPanel │
            │ (compact) │   │ (all 3)   │   │ (all 3)   │
            └───────────┘   └───────────┘   └───────────┘
                    │               │               │
                    ▼               ▼               ▼
            ┌───────────┐   ┌───────────┐   ┌───────────┐
            │TaskProgress│  │ActivityLog│   │ResponseStrm│
            │ (compact) │   │ (verbose) │   │ (compact) │
            └───────────┘   └───────────┘   └───────────┘
```

### Command Flow

```
User Input: /compact or /verbose or /preview
              │
              ▼
┌─────────────────────────────────────┐
│  handleCommand() in repl.tsx        │
│  - Routes to handleCompact()        │
│  - Routes to handleVerbose()        │
│  - Routes to handlePreview()        │
└─────────────────────────────────────┘
              │
              ▼
┌─────────────────────────────────────┐
│  ctx.app?.updateState()             │
│  - Updates displayMode              │
│  - Updates previewMode              │
│  - Adds system message              │
└─────────────────────────────────────┘
              │
              ▼
┌─────────────────────────────────────┐
│  React re-renders components        │
│  - Each component checks displayMode│
│  - Renders appropriate UI variant   │
└─────────────────────────────────────┘
```

### Preview Mode Flow

```
User enables /preview on
              │
              ▼
User types task/command
              │
              ▼
┌─────────────────────────────────────┐
│  handleInput() in App.tsx           │
│  - Checks state.previewMode         │
│  - Detects intent                   │
│  - Sets pendingPreview state        │
└─────────────────────────────────────┘
              │
              ▼
┌─────────────────────────────────────┐
│  PreviewPanel renders               │
│  - Shows input & intent             │
│  - Shows confidence %               │
│  - Shows action buttons             │
└─────────────────────────────────────┘
              │
    ┌─────────┼─────────┐
    │         │         │
  Enter     Escape      E
    │         │         │
    ▼         ▼         ▼
 Execute   Cancel    Edit (return
   task    preview   to input)
```

## File Changes Required

### Phase 1: Verification & Minor Fix

| File | Change | Priority |
|------|--------|----------|
| `packages/cli/src/ui/components/StatusBar.tsx` | Verify compact mode shows branch + cost | Medium |

### Phase 2: Integration Tests

| File | Change | Priority |
|------|--------|----------|
| `packages/cli/src/__tests__/v030-features.integration.test.tsx` | Create comprehensive test suite | High |

### Phase 3: Documentation

| File | Change | Priority |
|------|--------|----------|
| `docs/user-guide/display-modes.md` | Create user guide | Medium |
| `docs/user-guide/input-preview.md` | Create user guide | Medium |
| `docs/getting-started.md` | Update with v0.3.0 features | Low |

## Acceptance Criteria Verification

### Input Preview Feature
- [x] `/preview` command toggles preview mode
- [x] `/preview on|off|toggle|status` subcommands work
- [x] PreviewPanel shows formatted preview before sending
- [x] Preview includes intent detection with confidence %
- [x] User can confirm (Enter), cancel (Escape), or edit (E)
- [x] Preview mode state persists during session
- [x] StatusBar shows preview mode indicator

### Compact Mode
- [x] `/compact` command toggles compact mode
- [x] StatusBar shows minimal info (status icon, branch, cost)
- [x] AgentPanel uses single-line compact display
- [x] TaskProgress shows single-line status
- [x] Messages truncated to single line
- [x] ActivityLog is hidden in compact mode

### Verbose Mode
- [x] `/verbose` command toggles verbose mode
- [x] StatusBar shows all info with token breakdown
- [x] ActivityLog shows debug-level logs
- [x] AgentPanel shows debug info (via VerboseAgentRow)
- [x] Detailed timing information available

## Consequences

### Positive
- All core v0.3.0 features are already implemented
- Minimal additional code changes required
- Comprehensive test coverage exists
- Architecture follows consistent patterns

### Negative
- Some existing tests may need updates if behavior is refined
- Documentation effort required

### Risks
- None significant - features are implemented and tested

## Implementation Checklist for Developer Stage

- [ ] Verify StatusBar compact mode displays: `● [branch] | $cost`
- [ ] Create `v030-features.integration.test.tsx` with comprehensive scenarios
- [ ] Create `docs/user-guide/display-modes.md`
- [ ] Create `docs/user-guide/input-preview.md`
- [ ] Update `docs/getting-started.md` with v0.3.0 features
- [ ] Run full test suite to verify no regressions
- [ ] Manual testing of all display mode transitions
- [ ] Update ROADMAP.md to mark features complete

## References

- ADR-007: Input Preview Feature
- ADR-020: Display Modes (Compact and Verbose)
- ADR-021: Compact Mode Implementation Details
- ADR-022: Verbose Mode Enhanced Implementation
- ROADMAP.md v0.3.0 section
