# Code Review: v0.6.0 Conversation Memory and Cross-Task Context Features
**Date**: March 10, 2026
**Reviewer**: Code Review Agent
**Status**: ⚠️ CRITICAL ISSUES IDENTIFIED
**Build Status**: ✅ PASSED (npm run build)
**Test Status**: ❌ FAILED (npm test - 14+ test failures)

---

## Executive Summary

The v0.6.0 implementation includes three main code changes:
1. **DaemonConfig process resource limits** in `packages/core/src/types.ts`
2. **Process priority management** in `packages/orchestrator/src/runner.ts`
3. **SubtaskTree test updates** in `packages/cli/src/ui/components/agents/__tests__/SubtaskTree.test.tsx`

The code **builds successfully** but **has 14+ failing tests** that must be fixed. Multiple critical and medium-severity issues were identified.

---

## FINDINGS - Direct Format

### packages/orchestrator/src/runner.ts:156
**ISSUE**: Invalid test assertion using `.toBeDefined()` on array result
**SEVERITY**: MEDIUM
**DESCRIPTION**: `screen.getAllByText(/├──/)` returns an array that is ALWAYS defined. This assertion will always pass even if no tree connectors exist. Use `.toBeDefined()` only for values that could be null/undefined.

### packages/orchestrator/src/runner.ts:2198-2199
**ISSUE**: Missing validation for niceLevel range
**SEVERITY**: MEDIUM
**DESCRIPTION**: Configuration allows any numeric value for `niceLevel`, but `os.setPriority()` only accepts -20 to 19. Invalid values will cause runtime errors.

### packages/orchestrator/src/runner.ts:1329-1335
**ISSUE**: No fallback if `nice` command is missing
**SEVERITY**: MEDIUM
**DESCRIPTION**: Code attempts to spawn `nice` command without checking if it exists. On minimal Unix systems (Alpine, etc.), spawn will fail with ENOENT. Need try/catch with fallback to direct node spawn.

### Multiple test files (orchestrator/src/*.test.ts)
**ISSUE**: 14+ test failures across suite
**SEVERITY**: HIGH
**DESCRIPTION**: Tests failing in enhanced-daemon-runner-resource-limits.test.ts, fix-attempt-tracker.test.ts, health-monitor-restart-tracking.test.ts. Examples: "should throw when total count does not match", "should calculate error similarity correctly", "should prevent fix attempts when loop is detected".

### packages/core/src/types.ts:2865
**ISSUE**: Zod schema min bound incorrect for niceLevel
**SEVERITY**: MEDIUM
**DESCRIPTION**: Schema defines `niceLevel: z.number().min(0).max(19)` but valid range is -20 to 19. Rejects legitimate configurations like `niceLevel: -5` for higher process priority.

### packages/orchestrator/src/runner.ts:2223-2235
**ISSUE**: O(n²) process tree traversal algorithm
**SEVERITY**: LOW
**DESCRIPTION**: Repeated linear scans to find all descendants. On systems with 1000+ processes, could cause significant CPU usage. Suggests O(n) BFS alternative.

### packages/orchestrator/src/runner.ts:2202
**ISSUE**: Platform-dependent ps command output parsing
**SEVERITY**: LOW
**DESCRIPTION**: `ps -eo pid,ppid,nice` format varies between Linux, macOS, BSD. Parsing with `/\s+/` could fail on edge cases. Already mitigated with error handling but fragile.

### packages/orchestrator/src/runner.ts:1329 & 1392
**ISSUE**: Inconsistent variable naming for same purpose
**SEVERITY**: LOW
**DESCRIPTION**: Both API and WebUI startup use `serviceNice` and `webuiNice` for the same config value. Duplicated logic violates DRY principle.

### packages/orchestrator/src/runner.ts:2268-2272
**ISSUE**: Immediate renice call could race with service startup
**SEVERITY**: LOW
**DESCRIPTION**: `reniceDaemonDescendants()` called immediately without delay, but API/WebUI might not have started. Adds 5-second startup delay due to ps command timeout.

---

## Test Run Summary

**Command**: `npm test`
**Result**: ❌ FAILED with exit code 1
**Failures Observed**:
- enhanced-daemon-runner-resource-limits.test.ts: 7+ failures
- fix-attempt-tracker.test.ts: 7 failures  
- health-monitor-restart-tracking.test.ts: 4 failures
- health-monitor.comprehensive.test.ts: 2 failures

**Total**: 14+ test failures

---

## Blocking Issues (Must Fix)

1. **Fix all 14+ failing tests** - Cannot complete review with failing tests
2. **Add niceLevel validation** - Prevent out-of-range values causing crashes
3. **Add fallback for missing `nice` command** - Graceful degradation
4. **Fix test assertion at line 156** - Use `expect().length` not `.toBeDefined()`
5. **Update Zod schema bounds** - Change `min(0)` to `min(-20)`

---

## Files Modified

- `packages/core/src/types.ts` - Added processLimits schema
- `packages/orchestrator/src/runner.ts` - Added reniceDaemonDescendants() and process limit application
- `packages/cli/src/ui/components/agents/__tests__/SubtaskTree.test.tsx` - Test updates

---

## Recommendation

**CANNOT COMPLETE REVIEW STAGE** due to test failures and unresolved issues. All blocking issues must be fixed before this code can be approved for production.

