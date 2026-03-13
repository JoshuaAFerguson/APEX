================================================================================
CODE REVIEW FINDINGS: v0.4.0 Time-Based Usage Management and Session Recovery
================================================================================

REVIEW STATUS: COMPLETED
OVERALL VERDICT: 🔴 NOT READY FOR MERGE - Critical issues and build failures

================================================================================
CRITICAL FINDINGS (Must Fix Before Merge)
================================================================================

FILE: packages/orchestrator/src/session-manager.ts
LINE: 58, 75
ISSUE: Race Condition in Checkpoint File Naming
SEVERITY: HIGH
DESCRIPTION:
  The function uses Date.now() at two different points in time:
  - Line 58: checkpointId = `${task.id}-${Date.now()}` (e.g., "task-1000")
  - Line 75: checkpointPath = `${task.id}-${Date.now()}.json` (e.g., "task-1005")
  This creates inconsistency where the checkpoint ID doesn't match the filename
  timestamp, breaking session recovery lookup logic.
IMPACT: Session recovery fails, data loss on resume
ACTION: Use single timestamp for both ID and filename generation
---

FILE: packages/orchestrator/src/usage-manager.ts
LINE: 208
ISSUE: Daily Cost Projection Floating-Point Error
SEVERITY: HIGH
DESCRIPTION:
  Cost calculation: (totalCost / currentHour) * 24
  Problems:
  1. Floating-point precision loss in division
  2. Midnight edge case (currentHour=0) returns wrong value
  3. No rounding, results in unlimited decimal places
IMPACT: Spending alerts trigger at wrong thresholds, budget calculations fail
ACTION: Add proper rounding and edge-case handling
---

FILE: packages/orchestrator/src/session-manager.ts
LINE: 301
ISSUE: Unsafe JSON Parsing Without Validation
SEVERITY: HIGH
DESCRIPTION:
  JSON.parse() result is type-asserted without validation:
  - No check for required fields (taskId, conversationState, createdAt)
  - No error recovery for corrupted files
  - Silent failure, no distinction between "no checkpoint" and "corrupt file"
IMPACT: Data loss, unclear error states, session recovery fails silently
ACTION: Add field validation and detailed error logging
---

FILE: packages/orchestrator/src/session-manager.ts
LINE: 287
ISSUE: Missing Directory Initialization Check
SEVERITY: HIGH
DESCRIPTION:
  getLatestCheckpoint() assumes checkpointDir exists without verification.
  If initialize() was never called or failed, fs.readdir() throws ENOENT
  but error is caught and silently converted to "no checkpoints found".
IMPACT: Initialization failures are undetectable, recovery fails silently
ACTION: Check directory access before reading, provide clear error message
---

FILE: packages/orchestrator/src/permission-store.ts
LINE: 122
ISSUE: TypeScript Compilation Error - Undefined String Parameter
SEVERITY: HIGH
DESCRIPTION:
  saveExtendedPermission() passes permission.scope (which can be undefined)
  to generatePermissionId() which expects a non-undefined string.
IMPACT: Code will not compile/build, blocking all testing
ACTION: Handle undefined scope: this.generatePermissionId(permission.tool, permission.scope || '')
---

FILE: packages/orchestrator/src/permission-store.ts
LINE: 149
ISSUE: TypeScript Compilation Error - Possibly Undefined Property
SEVERITY: HIGH
DESCRIPTION:
  createdAt property access without null check assertion.
  Schema allows createdAt to be optional but code assumes it exists.
IMPACT: Code will not compile/build
ACTION: Ensure createdAt is always defined or handle undefined case explicitly
---

FILE: packages/orchestrator/src/permission-manager.ts
LINE: 81
ISSUE: TypeScript Compilation Error - Type Mismatch
SEVERITY: HIGH
DESCRIPTION:
  Return statement has type 'PermissionLevel | null' but function signature
  may expect 'PermissionLevel | null' with different null/undefined semantics.
IMPACT: Code will not compile/build
ACTION: Verify type compatibility between permission.level and return type
---

================================================================================
HIGH PRIORITY FINDINGS
================================================================================

FILE: packages/orchestrator/src/usage-manager.ts
LINE: 57-60
ISSUE: Mode Change Event Race Condition
SEVERITY: HIGH
DESCRIPTION:
  In concurrent scenarios, getCurrentUsage() can emit duplicate 'mode-changed'
  events if called simultaneously from different tasks. The mode comparison
  and emission are not atomic.
IMPACT: Event listeners receive duplicates, cache inconsistencies
ACTION: Use atomic compare-and-swap or guard flag
---

FILE: packages/orchestrator/src/session-manager.ts
LINE: 322
ISSUE: Inconsistent Conversation History Truncation
SEVERITY: HIGH
DESCRIPTION:
  Conversation history is truncated to 20 messages in session data, but
  summarization only happens at 50+ messages. Middle messages are lost
  without being incorporated into the summary.
IMPACT: Context loss in long-running sessions, worse recovery quality
ACTION: Align truncation limit with summarization threshold (50+)
---

FILE: packages/orchestrator/src/usage-manager.ts
LINE: 245, 297
ISSUE: Missing Timezone Support
SEVERITY: MEDIUM
DESCRIPTION:
  Mode transitions use local hour (now.getHours()) without timezone awareness.
  Behavior depends on server timezone, not user/project timezone.
IMPACT: Inconsistent thresholds across different deployments
ACTION: Add timezone offset configuration parameter
---

FILE: packages/orchestrator/src/session-manager.ts
LINE: 199
ISSUE: Automatic Checkpoint Cleanup Not Implemented
SEVERITY: MEDIUM
DESCRIPTION:
  cleanupCheckpoints() method exists but is never called. Default retention
  is 7 days, but disk usage grows unbounded for long-running projects.
IMPACT: Disk space exhaustion after weeks/months of operation
ACTION: Add automatic cleanup trigger (e.g., every 100 checkpoints)
---

================================================================================
MEDIUM PRIORITY FINDINGS
================================================================================

FILE: packages/orchestrator/src/session-manager.ts
LINE: 335-336
ISSUE: Unencrypted Session Storage
SEVERITY: MEDIUM
DESCRIPTION:
  Session files containing conversation history saved without encryption
  or restrictive file permissions. May contain sensitive information.
IMPACT: Potential information disclosure if file permissions are too open
ACTION: Add file permission restriction (chmod 0o600) or encryption
---

FILE: tests/v040-time-based-usage-session-recovery-comprehensive.test.ts
LINE: 17-28
ISSUE: Test Import Paths Use Relative Paths Instead of Module Exports
SEVERITY: MEDIUM
DESCRIPTION:
  Tests import from relative source paths instead of module exports.
  Should use @apexcli/orchestrator package exports.
IMPACT: Tests not compatible with all build configurations
ACTION: Update imports to use module resolution
---

================================================================================
LOW PRIORITY FINDINGS (Code Quality)
================================================================================

FILE: packages/orchestrator/src/session-manager.ts
ISSUE: Missing Input Validation
SEVERITY: LOW
DESCRIPTION:
  Public methods don't validate input parameters thoroughly.
ACTION: Add defensive input validation to all public methods
---

FILE: packages/orchestrator/src
ISSUE: Inconsistent Error Handling
SEVERITY: LOW
DESCRIPTION:
  Multiple functions catch errors and log to console instead of structured logging.
ACTION: Implement structured logging or custom error types
---

FILE: packages/orchestrator/src
ISSUE: Magic Numbers Without Constants
SEVERITY: LOW
DESCRIPTION:
  Hard-coded values throughout code (20, 50, 100, 7 days, etc).
ACTION: Extract to named constants at top of class
---

================================================================================
BUILD STATUS
================================================================================

Current Build: ❌ FAILING

Compilation Errors:
  error TS2345 in permission-store.ts:122
  error TS18048 in permission-store.ts:149
  error TS2322 in permission-manager.ts:80

Test Execution: ❌ BLOCKED (cannot run until build succeeds)

================================================================================
SUMMARY STATISTICS
================================================================================

Total Issues Found: 15
- Critical/High: 7
- Medium: 4
- Low: 3

Code Quality Score: 65/100
Build Status: FAILING
Test Status: BLOCKED

Recommended Action: DO NOT MERGE - Fix critical issues first
Estimated Fix Time: 4-6 hours

================================================================================
