# ADR-010: Graceful Shutdown Integration Tests

## Status
Proposed

## Context

The APEX daemon system requires robust graceful shutdown handling to ensure:
1. Running tasks complete before the daemon exits
2. State files are properly written during shutdown
3. Orphan recovery processes handle shutdown gracefully
4. Signal handlers (SIGTERM/SIGINT) work correctly
5. Timeout-based force kill fallback works when graceful shutdown fails

Currently, we have:
- Basic lifecycle tests in `daemon-lifecycle.integration.test.ts`
- One graceful shutdown test in `runner.integration.test.ts` (line 381-434)
- Orphan recovery tests in `orphan-task-recovery.integration.test.ts`
- Signal handling tests in `daemon.test.ts` (unit tests with mocks)

However, we lack comprehensive integration tests for the 5 specific scenarios outlined in the acceptance criteria.

## Decision

Create a new dedicated integration test file: `graceful-shutdown.integration.test.ts` that covers:

### Test Scenarios

#### 1. Shutdown During Active Task Execution
**Purpose**: Verify that running tasks complete before daemon exits

**Test Cases**:
- Single running task completes before shutdown finishes
- Multiple concurrent running tasks complete before shutdown
- Task completion is awaited with proper timeout
- Metrics show correct task counts after shutdown

**Implementation Approach**:
```typescript
// Create daemon with mocked orchestrator
// Start a long-running task
// Initiate shutdown while task is running
// Verify task completes before stop() resolves
// Verify metrics show task as succeeded
```

#### 2. Shutdown During Orphan Recovery
**Purpose**: Verify shutdown handles concurrent orphan detection/recovery gracefully

**Test Cases**:
- Shutdown initiated during orphan detection phase
- Shutdown initiated while orphan recovery is in progress
- Orphan check interval is properly cleared
- No orphan events emitted after isShuttingDown is set

**Implementation Approach**:
```typescript
// Create stale in-progress tasks
// Start daemon (triggers orphan detection)
// Immediately initiate shutdown
// Verify orphan detection does not interfere with shutdown
// Verify intervals are cleared
```

#### 3. Shutdown with Pending State File Writes
**Purpose**: Verify state file is written correctly during shutdown

**Test Cases**:
- Final state file written with `running: false`
- State file write failures don't block shutdown
- State file contains correct timestamp and capacity info
- Health information is preserved in final state

**Implementation Approach**:
```typescript
// Start daemon and run some tasks
// Initiate shutdown
// Read state file after shutdown completes
// Verify running: false in state file
// Verify other state data is preserved
```

#### 4. Timeout-Based Force Kill Fallback
**Purpose**: Verify force kill occurs when graceful shutdown times out

**Test Cases**:
- Tasks exceeding grace period trigger timeout
- Timeout warning is logged
- Shutdown completes even with hung tasks
- Cleanup is still performed after timeout

**Implementation Approach**:
```typescript
// Create task that runs longer than grace period
// Initiate shutdown
// Verify timeout warning is logged
// Verify daemon stops despite hung task
// Verify cleanup occurs
```

#### 5. Signal Handling (SIGTERM/SIGINT)
**Purpose**: Verify signal handlers trigger graceful shutdown

**Test Cases**:
- SIGTERM triggers stop() method
- SIGINT triggers stop() method
- Signal handling logs the received signal
- Multiple signals don't cause issues

**Implementation Approach**:
```typescript
// This is tricky for integration tests because process.exit() is called
// Options:
// 1. Mock process.exit() and process.on()
// 2. Test via DaemonManager.stopDaemon() which sends SIGTERM
// 3. Use child_process to spawn actual daemon and send signals
```

## Technical Design

### File Structure

```
packages/orchestrator/src/
  graceful-shutdown.integration.test.ts    # New test file
```

### Test Infrastructure

Reuse existing patterns from `orphan-task-recovery.integration.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { join } from 'path';
import { mkdirSync, rmSync, readFileSync, existsSync } from 'fs';
import { TaskStore } from './store';
import { ApexOrchestrator } from './index';
import { DaemonRunner } from './runner';
import type { ApexConfig, Task } from '@apexcli/core';

// Test configuration
const TEST_CONFIG: ApexConfig = { /* ... */ };

// Test variables
let testProjectPath: string;
let store: TaskStore;
let orchestrator: ApexOrchestrator;
let daemonRunner: DaemonRunner;

// Helper functions
async function createTestTask(options): Promise<string>
async function createLongRunningTask(): Promise<string>
async function waitForCondition(predicate, timeout): Promise<boolean>
function readStateFile(): DaemonStateFile | null
```

### Key Components to Test

#### DaemonRunner.stop() Method (runner.ts lines 298-353)

```typescript
async stop(): Promise<void> {
  if (!this.isRunning) return;

  this.isShuttingDown = true;
  this.log('info', 'Initiating graceful shutdown...');

  // Clear intervals
  if (this.pollInterval) { clearInterval(this.pollInterval); }
  if (this.stateUpdateInterval) { clearInterval(this.stateUpdateInterval); }
  if (this.orphanCheckInterval) { clearInterval(this.orphanCheckInterval); }

  // Write final state file
  await this.writeStateFile(false);

  // Wait for running tasks with timeout
  if (this.runningTasks.size > 0) {
    const gracePeriod = 30000; // 30 seconds
    const result = await Promise.race([
      Promise.allSettled(this.runningTasks.values()).then(() => 'completed'),
      new Promise(resolve => setTimeout(() => resolve('timeout'), gracePeriod))
    ]);

    if (result === 'timeout') {
      this.log('warn', `Timeout after ${gracePeriod}ms`);
    }
  }

  await this.cleanup();
  this.isRunning = false;
}
```

#### Signal Handlers (runner.ts lines 840-859)

```typescript
private setupSignalHandlers(): void {
  const handler = async (signal: string) => {
    this.log('info', `Received ${signal}`);
    await this.stop();
    process.exit(0);
  };

  process.on('SIGTERM', () => handler('SIGTERM'));
  process.on('SIGINT', () => handler('SIGINT'));
}
```

### Test Matrix

| Scenario | Test Type | Mocking Required | Estimated Complexity |
|----------|-----------|------------------|---------------------|
| Active task shutdown | Integration | Minimal (task execution) | Medium |
| Orphan recovery shutdown | Integration | None | Low |
| State file writes | Integration | None | Low |
| Timeout fallback | Integration | Time manipulation | Medium |
| Signal handling | Unit/Integration | process.on/exit | High |

### Mocking Strategy

1. **Task Execution**: Mock `orchestrator.executeTask()` to control task duration
2. **Time**: Use `vi.useFakeTimers()` for timeout tests
3. **Signals**: For unit tests, mock `process.on()` and `process.exit()`
4. **File System**: Use real file system (temp directories) for integration tests

### Expected Test Output

```typescript
describe('Graceful Shutdown Integration Tests', () => {
  describe('Scenario 1: Shutdown during active task execution', () => {
    it('should wait for running task to complete before stopping')
    it('should handle multiple concurrent tasks during shutdown')
    it('should track task completion in metrics')
    it('should not pick up new tasks after shutdown initiated')
  })

  describe('Scenario 2: Shutdown during orphan recovery', () => {
    it('should complete shutdown even during orphan detection')
    it('should clear orphan check interval during shutdown')
    it('should not emit orphan events after shutdown flag set')
  })

  describe('Scenario 3: Shutdown with pending state file writes', () => {
    it('should write final state file with running: false')
    it('should handle state file write failures gracefully')
    it('should preserve capacity and health info in final state')
  })

  describe('Scenario 4: Timeout-based force kill fallback', () => {
    it('should timeout after grace period with hung tasks')
    it('should log timeout warning')
    it('should complete cleanup after timeout')
  })

  describe('Scenario 5: Signal handling (SIGTERM/SIGINT)', () => {
    it('should trigger stop on SIGTERM')
    it('should trigger stop on SIGINT')
    it('should log received signal')
  })
})
```

## Consequences

### Positive
- Comprehensive coverage of graceful shutdown edge cases
- Confidence in daemon reliability during shutdown
- Documentation of expected shutdown behavior
- Regression prevention for shutdown-related bugs

### Negative
- Additional test execution time (~10-15 seconds for shutdown timeout tests)
- Some tests require careful timing/synchronization
- Signal handler tests may require mocking which reduces realism

### Risks
- Timeout tests may be flaky if CI environment is slow
- Signal handling tests may interfere with test runner

## Implementation Notes

### Test Timeouts
- Use generous timeouts (30s) for integration tests
- Use fake timers for timeout scenario tests when possible
- Mark slow tests with `{ timeout: 60000 }`

### Cleanup
- Always stop daemon in afterEach
- Remove temp directories
- Reset mocks
- Clear event listeners

### Parallel Execution
- Each test creates unique temp directory
- No shared state between tests
- Safe for parallel execution

## References

- Existing test patterns: `orphan-task-recovery.integration.test.ts`
- DaemonRunner implementation: `runner.ts`
- Signal handling: `runner.ts:840-859`
- State file handling: `runner.ts:905-969`
