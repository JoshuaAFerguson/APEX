# ADR-046: Error Recovery Integration Tests - Technical Architecture

## Status
Proposed

## Context

Following ADR-045 which proposed the error recovery integration tests, this ADR provides the detailed technical architecture for implementing these tests. The design ensures comprehensive coverage of all five acceptance criteria while following established testing patterns in the codebase.

## Technical Design

### 1. Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    Error Recovery Integration Test Suite                     │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────────┐    ┌─────────────────────┐    ┌─────────────────┐ │
│  │   Test Harness      │    │   Error Simulators   │    │  Verification   │ │
│  │                     │    │                     │    │   Utilities     │ │
│  │  - beforeEach/      │    │  - corruptFile()    │    │                 │ │
│  │    afterEach hooks  │───▶│  - removeDir()      │───▶│  - verifyData() │ │
│  │  - Fake timers      │    │  - chmod()          │    │  - verifyStore()│ │
│  │  - Temp directory   │    │  - truncateFile()   │    │  - verifyMem()  │ │
│  └─────────────────────┘    └─────────────────────┘    └─────────────────┘ │
│           │                          │                          │           │
│           ▼                          ▼                          ▼           │
│  ┌─────────────────────────────────────────────────────────────────────────┐│
│  │                         SessionAutoSaver                                ││
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐                  ││
│  │  │ In-Memory    │  │ Unsaved      │  │ Timer-based  │                  ││
│  │  │ Session      │  │ Changes      │  │ Auto-save    │                  ││
│  │  │ Data         │  │ Counter      │  │ Mechanism    │                  ││
│  │  └──────────────┘  └──────────────┘  └──────────────┘                  ││
│  └─────────────────────────────────────────────────────────────────────────┘│
│           │                          │                          │           │
│           ▼                          ▼                          ▼           │
│  ┌─────────────────────────────────────────────────────────────────────────┐│
│  │                            SessionStore                                 ││
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌─────────────┐ ││
│  │  │ Session      │  │ Index        │  │ Archive      │  │ Active      │ ││
│  │  │ Files        │  │ File         │  │ Directory    │  │ Session     │ ││
│  │  │ {id}.json    │  │ index.json   │  │ archive/*.gz │  │ active.json │ ││
│  │  └──────────────┘  └──────────────┘  └──────────────┘  └─────────────┘ ││
│  └─────────────────────────────────────────────────────────────────────────┘│
│                                                                             │
│                              File System                                    │
│  ┌─────────────────────────────────────────────────────────────────────────┐│
│  │  /tmp/apex-error-recovery-test-XXXXX/                                   ││
│  │  └── .apex/                                                             ││
│  │      └── sessions/                                                      ││
│  │          ├── index.json                                                 ││
│  │          ├── active.json                                                ││
│  │          ├── sess_*.json                                                ││
│  │          └── archive/                                                   ││
│  │              └── sess_*.json.gz                                         ││
│  └─────────────────────────────────────────────────────────────────────────┘│
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 2. Test File Structure

```typescript
// packages/cli/src/services/__tests__/SessionAutoSaver.error-recovery.integration.test.ts

/**
 * Error Recovery Integration Tests for SessionAutoSaver
 *
 * Test Organization:
 *
 * 1. AC1: Write Failure Recovery (3 tests)
 *    - Preserve unsaved changes on failure
 *    - Retry after failure
 *    - Accumulate changes during failures
 *
 * 2. AC2: Corruption Recovery (4 tests)
 *    - Detect corrupted session file
 *    - Handle truncated file (partial write)
 *    - Recover corrupted index
 *    - Don't crash on corrupted load
 *
 * 3. AC3: Archive Directory Recovery (3 tests)
 *    - Recreate archive directory
 *    - Handle missing archive on load
 *    - Restore archive on initialize
 *
 * 4. AC4: Unsaved Changes Preservation (3 tests)
 *    - Preserve through multiple failures
 *    - Save accumulated on retry
 *    - Manual save after failure
 *
 * 5. AC5: Permission Graceful Degradation (4 tests)
 *    - Read-only directory (Unix only)
 *    - Recover when restored
 *    - Read-only session file
 *    - Transient permission errors
 *
 * 6. Edge Cases (4 tests)
 *    - Stop during failure
 *    - Rapid error-recovery cycles
 *    - Error during creation
 *    - Max consecutive failures
 *
 * Total: 21 tests
 */
```

### 3. Helper Utilities Design

#### 3.1 Path Utilities

```typescript
/**
 * Get the absolute path to a session file
 */
function getSessionFilePath(tempDir: string, sessionId: string): string {
  return path.join(tempDir, '.apex', 'sessions', `${sessionId}.json`);
}

/**
 * Get the archive directory path
 */
function getArchiveDir(tempDir: string): string {
  return path.join(tempDir, '.apex', 'sessions', 'archive');
}

/**
 * Get the sessions directory path
 */
function getSessionsDir(tempDir: string): string {
  return path.join(tempDir, '.apex', 'sessions');
}

/**
 * Get the index file path
 */
function getIndexPath(tempDir: string): string {
  return path.join(tempDir, '.apex', 'sessions', 'index.json');
}
```

#### 3.2 Error Simulation Utilities

```typescript
/**
 * Corrupt a session file with invalid JSON
 */
async function corruptSessionFile(tempDir: string, sessionId: string): Promise<void> {
  const sessionPath = getSessionFilePath(tempDir, sessionId);
  await fs.writeFile(sessionPath, '{ invalid json content %%%');
}

/**
 * Truncate a session file to simulate partial write
 */
async function truncateSessionFile(tempDir: string, sessionId: string): Promise<void> {
  const sessionPath = getSessionFilePath(tempDir, sessionId);
  const content = await fs.readFile(sessionPath, 'utf-8');
  await fs.writeFile(sessionPath, content.substring(0, content.length / 2));
}

/**
 * Corrupt the index file
 */
async function corruptIndexFile(tempDir: string): Promise<void> {
  const indexPath = getIndexPath(tempDir);
  await fs.writeFile(indexPath, '{ broken index');
}

/**
 * Remove the sessions directory to simulate disk failure
 */
async function removeSessionsDir(tempDir: string): Promise<void> {
  const sessionsDir = getSessionsDir(tempDir);
  await fs.rm(sessionsDir, { recursive: true, force: true });
}

/**
 * Remove the archive directory
 */
async function removeArchiveDir(tempDir: string): Promise<void> {
  const archiveDir = getArchiveDir(tempDir);
  await fs.rm(archiveDir, { recursive: true, force: true });
}
```

#### 3.3 Verification Utilities

```typescript
/**
 * Verify a store can be initialized and create sessions
 */
async function verifyStoreOperational(tempDir: string): Promise<boolean> {
  try {
    const newStore = new SessionStore(tempDir);
    await newStore.initialize();
    const session = await newStore.createSession('Recovery Test');
    return session.id !== undefined;
  } catch {
    return false;
  }
}

/**
 * Verify session data persisted correctly
 */
async function verifySessionPersisted(
  tempDir: string,
  sessionId: string,
  expectedMessageCount: number
): Promise<Session> {
  const freshStore = new SessionStore(tempDir);
  await freshStore.initialize();
  const session = await freshStore.getSession(sessionId);
  expect(session).not.toBeNull();
  expect(session!.messages).toHaveLength(expectedMessageCount);
  return session!;
}

/**
 * Verify in-memory session data
 */
function verifyInMemorySession(
  autoSaver: SessionAutoSaver,
  expectedMessageCount: number,
  expectedUnsavedCount: number
): void {
  const session = autoSaver.getSession();
  expect(session).not.toBeNull();
  expect(session!.messages).toHaveLength(expectedMessageCount);
  expect(autoSaver.getUnsavedChangesCount()).toBe(expectedUnsavedCount);
}
```

#### 3.4 Test Helper Functions

```typescript
/**
 * Add a test message to the auto-saver
 */
async function addTestMessage(
  autoSaver: SessionAutoSaver,
  content: string,
  role: 'user' | 'assistant' = 'user'
): Promise<void> {
  await autoSaver.addMessage({ role, content });
}

/**
 * Suppress and capture console.error calls
 */
function suppressConsoleErrors(): () => void {
  const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  return () => consoleSpy.mockRestore();
}

/**
 * Trigger auto-save by advancing timers
 */
async function triggerAutoSave(intervalMs: number): Promise<void> {
  vi.advanceTimersByTime(intervalMs);
  await vi.runAllTimersAsync();
}
```

### 4. Error Simulation Strategy Matrix

| Acceptance Criteria | Error Type | Simulation Technique | Recovery Verification |
|---------------------|------------|---------------------|----------------------|
| AC1: Write Failure | ENOENT | Remove sessions directory | Restore dir, trigger save |
| AC1: Write Failure | ENOSPC (disk full) | Could use mock, but dir removal simpler | Restore dir, verify data |
| AC2: Corruption | Invalid JSON | Write malformed JSON to file | getSession returns null |
| AC2: Corruption | Truncated file | Write partial JSON content | getSession returns null |
| AC2: Corruption | Index corruption | Write malformed JSON to index | Fresh index created |
| AC3: Missing Dir | Archive missing | Remove archive directory | Verify recreated on init |
| AC4: Preservation | Multiple failures | Repeated save attempts | Counter preserved |
| AC5: Permissions | EACCES | `chmod 444` on directory/file | `chmod 755`, retry save |

### 5. Platform Considerations

```typescript
// Platform detection constant
const isWindows = process.platform === 'win32';

// Permission tests should skip on Windows
describe('AC5: Permission Tests', () => {
  it.skipIf(isWindows)('should handle read-only directory', async () => {
    // Unix-only test
  });
});

// Cleanup must restore permissions before deletion
afterEach(async () => {
  vi.useRealTimers();
  autoSaver?.stop();

  try {
    // Restore permissions for cleanup
    if (!isWindows) {
      await fs.chmod(tempDir, 0o755);
      const sessionsDir = getSessionsDir(tempDir);
      try {
        await fs.chmod(sessionsDir, 0o755);
      } catch {}
    }
    await fs.rm(tempDir, { recursive: true, force: true });
  } catch {
    // Best effort cleanup
  }
});
```

### 6. Timing Strategy

```typescript
// Use fake timers for deterministic testing
beforeEach(async () => {
  vi.useFakeTimers();
  // ... setup
});

afterEach(async () => {
  vi.useRealTimers();
  // ... cleanup
});

// Pattern for testing auto-save intervals
it('should retry after failure', async () => {
  autoSaver = new SessionAutoSaver(store, {
    enabled: true,
    intervalMs: 3000
  });

  // Add data
  await addTestMessage(autoSaver, 'Test');

  // Cause failure
  await removeSessionsDir(tempDir);

  // First save fails
  await triggerAutoSave(3000);
  expect(autoSaver.hasUnsavedChanges()).toBe(true);

  // Restore and retry
  await fs.mkdir(getSessionsDir(tempDir), { recursive: true });
  await triggerAutoSave(3000);
  expect(autoSaver.hasUnsavedChanges()).toBe(false);
});
```

### 7. Test Isolation Architecture

Each test operates in complete isolation:

```
Test 1                    Test 2                    Test 3
   │                         │                         │
   ▼                         ▼                         ▼
┌──────────────────┐   ┌──────────────────┐   ┌──────────────────┐
│ /tmp/apex-err-   │   │ /tmp/apex-err-   │   │ /tmp/apex-err-   │
│ test-abc123/     │   │ test-def456/     │   │ test-ghi789/     │
│  └── .apex/      │   │  └── .apex/      │   │  └── .apex/      │
│      └── ...     │   │      └── ...     │   │      └── ...     │
└──────────────────┘   └──────────────────┘   └──────────────────┘
        │                      │                      │
        ▼                      ▼                      ▼
   [Cleaned up]           [Cleaned up]           [Cleaned up]
```

Benefits:
- No cross-test contamination
- Parallel test execution safe
- Failed test cleanup doesn't affect others

### 8. Error Logging Verification

```typescript
// Pattern for verifying error behavior
it('should log errors but not crash', async () => {
  const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

  // ... cause error ...
  await triggerAutoSave(5000);

  // Verify error was logged
  expect(consoleSpy).toHaveBeenCalled();

  // Verify system didn't crash
  expect(autoSaver.getSession()).not.toBeNull();
  expect(autoSaver.hasUnsavedChanges()).toBe(true);

  consoleSpy.mockRestore();
});
```

### 9. Data Integrity Validation

For each test, verify:

1. **In-Memory State**:
   - Session object exists
   - Messages array has expected count
   - State properties preserved
   - Unsaved changes counter accurate

2. **Persisted State** (after recovery):
   - Fresh store can load session
   - All messages recovered
   - Timestamps are Date objects
   - Tool calls restored with nested data

```typescript
// Comprehensive verification example
async function verifyDataIntegrity(
  autoSaver: SessionAutoSaver,
  tempDir: string,
  sessionId: string
): Promise<void> {
  // 1. Memory state
  const memSession = autoSaver.getSession();
  expect(memSession).not.toBeNull();

  // 2. Persistence (after successful save)
  if (!autoSaver.hasUnsavedChanges()) {
    const freshStore = new SessionStore(tempDir);
    await freshStore.initialize();
    const persisted = await freshStore.getSession(sessionId);

    expect(persisted).not.toBeNull();
    expect(persisted!.messages.length).toBe(memSession!.messages.length);

    // Verify timestamps are restored as Date objects
    persisted!.messages.forEach(msg => {
      expect(msg.timestamp instanceof Date).toBe(true);
    });
  }
}
```

### 10. Test Execution Order

Tests are designed to be independent and can run in any order. However, the logical grouping follows the acceptance criteria:

```
1. AC1: Write Failures (Foundation - basic error handling)
   └── Dependencies: None

2. AC2: Corruption (Build on read/write understanding)
   └── Dependencies: Understanding of file operations

3. AC3: Archive Directory (Specific subsystem)
   └── Dependencies: Basic store operations

4. AC4: Preservation (Combines all above)
   └── Dependencies: AC1 patterns

5. AC5: Permissions (Platform-specific)
   └── Dependencies: AC1 patterns, Unix knowledge

6. Edge Cases (Stress tests)
   └── Dependencies: All above
```

## Interfaces

### Test Configuration Interface

```typescript
interface ErrorRecoveryTestConfig {
  intervalMs: number;
  maxUnsavedMessages: number;
  enabled: boolean;
}

// Standard configurations for different test scenarios
const CONFIGS = {
  FAST_INTERVAL: { intervalMs: 1000, enabled: true, maxUnsavedMessages: 10 },
  MEDIUM_INTERVAL: { intervalMs: 3000, enabled: true, maxUnsavedMessages: 5 },
  THRESHOLD_FOCUS: { intervalMs: 60000, enabled: true, maxUnsavedMessages: 2 },
};
```

### Error Types Tested

```typescript
type SimulatedError =
  | 'ENOENT'      // File/directory not found
  | 'EACCES'      // Permission denied
  | 'EINVAL'      // Invalid JSON (corruption)
  | 'ETRUNC'      // Truncated file
  | 'ENOSPC';     // Disk full (simulated via ENOENT)
```

## Consequences

### Positive
- Comprehensive coverage of all 5 acceptance criteria
- Platform-aware testing (Windows/Unix)
- Isolated tests prevent cross-contamination
- Real file system operations for accurate validation
- Documents expected system behavior under failure

### Negative
- Longer execution time than unit tests
- Permission tests skip on Windows
- Complex cleanup in afterEach hooks
- Some edge cases may be flaky on very fast I/O systems

### Mitigations
- Use `vi.useFakeTimers()` for deterministic timing
- `it.skipIf(isWindows)` for platform-specific tests
- Robust cleanup with permission restoration
- Console spy to suppress expected error output

## Implementation Checklist for Developer

- [ ] Create `SessionAutoSaver.error-recovery.integration.test.ts`
- [ ] Implement path utility functions
- [ ] Implement error simulation utilities
- [ ] Implement verification utilities
- [ ] Implement AC1 tests (3 tests)
- [ ] Implement AC2 tests (4 tests)
- [ ] Implement AC3 tests (3 tests)
- [ ] Implement AC4 tests (3 tests)
- [ ] Implement AC5 tests with platform guards (4 tests)
- [ ] Implement edge case tests (4 tests)
- [ ] Run full test suite and verify all pass
- [ ] Verify cleanup doesn't leave temp directories

## Related ADRs

- ADR-045: Error Recovery Integration Tests for Auto-Save Failures (Proposed spec)
- ADR-044: Session Persistence Integration Tests with Real File System Operations
- ADR-003: Session Management for v0.3.0

## Files to Create

- `packages/cli/src/services/__tests__/SessionAutoSaver.error-recovery.integration.test.ts`

## Files to Reference

- `packages/cli/src/services/SessionAutoSaver.ts` (implementation under test)
- `packages/cli/src/services/SessionStore.ts` (dependency)
- `packages/cli/src/services/__tests__/SessionAutoSaver.integration.test.ts` (pattern reference)
- `packages/cli/src/services/__tests__/SessionStore.persistence.integration.test.ts` (pattern reference)
