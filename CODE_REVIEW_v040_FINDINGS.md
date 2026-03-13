# Code Review: v0.4.0 Time-Based Usage Management and Session Recovery

## Summary
Review of v0.4.0 implementation identified **8 critical/high priority issues** and **5 medium priority issues** that need addressing before feature deployment. The implementation provides good architectural foundation but has logic errors, race conditions, and error handling gaps that could cause data loss and session recovery failures.

---

## Critical Issues

### 1. Session-Manager: Race Condition in Checkpoint File Naming
**FILE**: `packages/orchestrator/src/session-manager.ts` (Lines 58, 75)
**SEVERITY**: HIGH
**ISSUE**: Checkpoint creation uses `Date.now()` twice - once for checkpointId generation (line 58) and again for filename (line 75). These are different timestamps due to execution time gap. This creates two separate files with different timestamps:
```typescript
const checkpointId = `${task.id}-${Date.now()}`; // e.g., "task-1000"
const checkpointPath = join(this.checkpointDir, `${task.id}-${Date.now()}.json`); // e.g., "task-1001.json"
```
When `getLatestCheckpoint()` extracts timestamp from filename (line 284), it won't match the checkpointId, leading to inconsistent state.
**FIX**: Use single timestamp value for both:
```typescript
const timestamp = Date.now();
const checkpointId = `${task.id}-${timestamp}`;
const checkpointPath = join(this.checkpointDir, `${task.id}-${timestamp}.json`);
```

### 2. Usage-Manager: Integer Division Precision Loss
**FILE**: `packages/orchestrator/src/usage-manager.ts` (Line 208)
**SEVERITY**: HIGH
**ISSUE**: Daily cost projection calculation will truncate or lose precision:
```typescript
const projectedDailyCost = currentHour > 0
  ? (this.currentDayStats.totalCost / currentHour) * hoursInDay
  : this.currentDayStats.totalCost;
```
When `currentHour` is 0.5 (30 minutes), the division loses precision in floating point. More critically, if `currentHour` is 0 (edge case at midnight), the conditional returns raw totalCost without proper projection.
**FIX**: Add proper rounding and handle edge cases:
```typescript
const hoursElapsed = Math.max(currentHour, 0.083); // minimum 5 minutes
const projectedDailyCost = currentHour > 0
  ? Math.round((this.currentDayStats.totalCost / hoursElapsed) * 24 * 100) / 100
  : this.currentDayStats.totalCost;
```

### 3. Session-Manager: Unsafe JSON Parsing Without Error Recovery
**FILE**: `packages/orchestrator/src/session-manager.ts` (Line 301)
**SEVERITY**: HIGH
**ISSUE**: JSON parsing with type assertion but no validation:
```typescript
const checkpoint = JSON.parse(checkpointData) as TaskCheckpoint;
```
If checkpoint file is corrupted, JSON.parse() throws an error that's caught generically. The corrupted checkpoint is silently ignored, but the function returns null without logging details.
**FIX**: Add validation and detailed error logging:
```typescript
try {
  const parsed = JSON.parse(checkpointData);
  // Validate required fields
  if (!parsed.taskId || !parsed.conversationState || !parsed.createdAt) {
    throw new Error('Invalid checkpoint structure: missing required fields');
  }
  const checkpoint = parsed as TaskCheckpoint;
  checkpoint.createdAt = new Date(checkpoint.createdAt);
  return checkpoint;
} catch (error) {
  console.error(`Failed to parse checkpoint ${latestCheckpointFile}:`, error instanceof Error ? error.message : error);
  return null;
}
```

### 4. Session-Manager: Missing Directory Initialization Check
**FILE**: `packages/orchestrator/src/session-manager.ts` (Line 287)
**SEVERITY**: HIGH
**ISSUE**: `getLatestCheckpoint()` assumes `checkpointDir` exists. If `initialize()` was never called or failed silently, `fs.readdir()` will throw ENOENT, caught and logged but returns null. No way to distinguish "no checkpoints" from "initialization failed".
**FIX**: Add defensive initialization in getLatestCheckpoint():
```typescript
private async getLatestCheckpoint(taskId: string): Promise<TaskCheckpoint | null> {
  try {
    // Ensure directory exists
    try {
      await fs.access(this.checkpointDir);
    } catch {
      console.warn(`Checkpoint directory does not exist: ${this.checkpointDir}`);
      return null;
    }
    const files = await fs.readdir(this.checkpointDir);
    // ... rest of implementation
```

### 5. Permission-Store: Type Mismatch on Undefined Values
**FILE**: `packages/orchestrator/src/permission-store.ts` (Line 122)
**SEVERITY**: HIGH
**ISSUE**: TypeScript compilation error - parameter accepts `string | undefined` but function expects `string`:
```typescript
async saveExtendedPermission(permission: ExtendedPermission): Promise<void> {
  const id = this.generatePermissionId(permission.tool, permission.scope);
  // permission.scope can be undefined here
```
The `scope` field may be undefined per schema, but `generatePermissionId()` expects non-undefined string.
**FIX**: Add null handling:
```typescript
const id = this.generatePermissionId(permission.tool, permission.scope || '');
```

### 6. Permission-Store: Possible Undefined Property Access
**FILE**: `packages/orchestrator/src/permission-store.ts` (Line 149)
**SEVERITY**: HIGH
**ISSUE**: Property access on possibly undefined value:
```typescript
createdAt: (permission.createdAt ?? new Date()).toISOString(),
```
If `permission.createdAt` is undefined (which is valid per schema), the nullish coalesce creates new Date(). However, schema allows createdAt to be optional. The `??` operator should handle this correctly, but this relies on optional field always being set. Consider if this is intentional.

---

## Medium Priority Issues

### 7. Session-Manager: Incomplete Conversation History Truncation
**FILE**: `packages/orchestrator/src/session-manager.ts` (Line 322)
**SEVERITY**: MEDIUM
**ISSUE**: Conversation history is unconditionally truncated to last 20 messages:
```typescript
conversationHistory: conversationHistory.slice(-20), // Keep last 20 messages
```
This loses context for long conversations. Combined with summarization threshold of 50 messages (line 150), there's inconsistency:
- When history > 50, summarization happens (lines 152-194)
- But only last 20 messages are kept in session data (line 322)
- The summary is created but older messages are dropped without being incorporated into summary

**FIX**: Use the summary in session data:
```typescript
const sessionData: TaskSessionData = {
  lastCheckpoint: new Date(),
  contextSummary: sessionSummary.currentContext, // This is good
  conversationHistory: conversationHistory.slice(-10), // Reduce to 10
  // ... but ensure contextSummary captures the truncated messages
```

### 8. Usage-Manager: Mode Change Detection Not Thread-Safe
**FILE**: `packages/orchestrator/src/usage-manager.ts` (Lines 57-60)
**SEVERITY**: MEDIUM
**ISSUE**: Mode change detection uses instance state without locking:
```typescript
const currentMode = this.getCurrentMode(now);
if (this.lastMode && this.lastMode !== currentMode) {
  this.emit('mode-changed', currentMode);
}
this.lastMode = currentMode;
```
In concurrent scenarios, multiple calls to `getCurrentUsage()` can emit duplicate 'mode-changed' events if called simultaneously from different tasks.
**FIX**: Use a flag to prevent duplicate emissions:
```typescript
private modeChangeEmitted = false;

getCurrentUsage(): TimeBasedUsage {
  const now = new Date();
  const currentMode = this.getCurrentMode(now);

  if (this.lastMode && this.lastMode !== currentMode && !this.modeChangeEmitted) {
    this.emit('mode-changed', currentMode);
    this.modeChangeEmitted = true;
  }

  // Reset flag when actual hour changes
  this.lastMode = currentMode;

  return {
    currentMode,
    thresholds: this.getThresholds(currentMode),
    dailyUsage: this.currentDayStats,
    nextModeSwitch: this.getNextModeSwitch(now),
  };
}
```

### 9. Usage-Manager: Missing Timezone Handling
**FILE**: `packages/orchestrator/src/usage-manager.ts` (Lines 245, 297)
**SEVERITY**: MEDIUM
**ISSUE**: Mode transitions use local hour only:
```typescript
const hour = now.getHours(); // Always in local timezone
```
If code runs in different timezones or timezone changes occur (DST), mode thresholds will be inconsistent. Behavior depends on server timezone, not user/project timezone.
**FIX**: Add timezone-aware configuration option:
```typescript
private getUserTimezoneHour(now: Date): number {
  const timezoneOffset = this.config.timeBasedUsage?.timezoneOffset || 0;
  const utcHour = now.getUTCHours();
  return (utcHour + timezoneOffset + 24) % 24;
}
```

### 10. Session-Manager: Stale Checkpoint Cleanup Has No Effect on Active Sessions
**FILE**: `packages/orchestrator/src/session-manager.ts` (Line 199)
**SEVERITY**: MEDIUM
**ISSUE**: `cleanupCheckpoints()` is never called in the implementation. Default maxAge is 7 days:
```typescript
async cleanupCheckpoints(maxAge: number = 7 * 24 * 60 * 60 * 1000): Promise<void>
```
If a task runs for 30 days without checkpoints being cleaned up, disk usage grows unbounded. No mechanism exists to trigger cleanup or set max disk usage limits.
**FIX**:
1. Add automatic cleanup trigger in `createCheckpoint()`:
```typescript
async createCheckpoint(...) {
  // ... existing code ...
  // Trigger cleanup every 100 checkpoints
  const files = await fs.readdir(this.checkpointDir);
  if (files.length > 100) {
    await this.cleanupCheckpoints();
  }
  return checkpoint;
}
```

---

## Test Coverage Issues

### Test Import Path Issues
**FILE**: `tests/v040-time-based-usage-session-recovery-comprehensive.test.ts` (Lines 17-28)
**SEVERITY**: MEDIUM
**ISSUE**: Tests import from relative source paths which may not work with all build configurations:
```typescript
import { UsageManager } from '../packages/orchestrator/src/usage-manager';
import { SessionManager } from '../packages/orchestrator/src/session-manager';
```
Should use module resolution from package.json:
```typescript
import { UsageManager } from '@apexcli/orchestrator';
import { SessionManager } from '@apexcli/orchestrator';
```

---

## Security Concerns

### Session Data Exposure
**FILE**: `packages/orchestrator/src/session-manager.ts` (Lines 335-336)
**SEVERITY**: LOW
**ISSUE**: Session data and checkpoints are saved to disk without encryption:
```typescript
const sessionPath = join(this.checkpointDir, `${taskId}-session.json`);
await fs.writeFile(sessionPath, JSON.stringify(sessionData, null, 2), 'utf-8');
```
Contains conversation history and context which may include sensitive information. File permissions are inherited from umask.
**FIX**: Add file encryption or at minimum restrict permissions:
```typescript
await fs.writeFile(sessionPath, JSON.stringify(sessionData, null, 2), 'utf-8');
// Set restrictive permissions (owner read/write only)
await fs.chmod(sessionPath, 0o600);
```

---

## Code Quality Issues

### 1. Inconsistent Error Handling
Multiple functions catch errors and log to console instead of returning proper error states:
- `cleanupCheckpoints()` (line 215)
- `getCheckpointStats()` (line 264)
- `getLatestCheckpoint()` (line 308)

**Recommendation**: Use structured logging or custom error types.

### 2. Missing Input Validation
- `createCheckpoint()` doesn't validate task object has required fields
- `summarizeContext()` doesn't validate conversationHistory is array
- `canStartTask()` doesn't validate estimatedUsage structure

### 3. Magic Numbers Without Constants
- Conversation history truncation: 20 messages (line 322)
- Daily budget default: 100.0 (line 92)
- Summarization threshold: 50 messages (line 150)
- Checkpoint max age: 7 days (line 199)

---

## Recommendations

### Priority 1 (Critical - Fix Before Merge)
1. ✅ Fix checkpoint filename race condition (#1)
2. ✅ Fix cost projection calculation (#2)
3. ✅ Add JSON parsing validation (#3)
4. ✅ Add directory initialization check (#4)
5. ✅ Fix permission-store type issues (#5-6)

### Priority 2 (High - Fix in Next Release)
1. Fix mode change event emission thread safety (#8)
2. Add timezone-aware hour calculation (#9)
3. Add automatic checkpoint cleanup (#10)
4. Fix test import paths

### Priority 3 (Medium - Improve Quality)
1. Add input validation to all public methods
2. Replace console.warn with structured logging
3. Extract magic numbers to named constants
4. Add file encryption for sensitive session data

---

## Build Status

**Current Status**: ❌ BUILD FAILING
**Root Cause**: TypeScript compilation errors in permission-store.ts and related files
**Blocking Issues**:
- Type mismatches on undefined/null values
- Missing field initializations

**Tests**: Tests cannot run until build is fixed.

