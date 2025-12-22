# Architecture Decision Record: Dynamic Auto-save Enable/Disable Integration Tests

## ADR-001: Technical Design for Dynamic Auto-save Toggle Integration Tests

**Status**: Proposed
**Date**: 2024-12-19
**Author**: Architect Agent
**Stage**: architecture

---

## Context

The task requires creating integration tests for dynamic auto-save enable/disable functionality in the `SessionAutoSaver` class. While existing tests cover basic enable/disable behavior, they do not comprehensively test the specific acceptance criteria:

1. **AC1**: Test enabling auto-save starts timer and triggers saves
2. **AC2**: Test disabling auto-save stops timer but doesn't lose unsaved changes
3. **AC3**: Test toggling enable/disable multiple times preserves session state
4. **AC4**: Test `updateOptions()` runtime reconfiguration

### Current Implementation Analysis

The `SessionAutoSaver` class (`packages/cli/src/services/SessionAutoSaver.ts`) implements:

```typescript
updateOptions(options: Partial<AutoSaveOptions>): void {
  const wasEnabled = this.options.enabled;
  this.options = { ...this.options, ...options };

  if (wasEnabled !== this.options.enabled) {
    if (this.options.enabled && this.currentSession) {
      this.startTimer();
    } else {
      this.stopTimer();
    }
  }
}
```

Key behaviors:
- Timer management is handled when `enabled` state changes
- `startTimer()` clears existing timer before creating new one
- `stopTimer()` clears interval and sets timer to null
- Unsaved changes count is NOT affected by enable/disable toggle

---

## Decision

### Test File Structure

Create a **new focused integration test file** dedicated to dynamic enable/disable scenarios:

**File**: `packages/cli/src/services/__tests__/SessionAutoSaver.dynamic-toggle.integration.test.ts`

This separation provides:
- Clear focus on dynamic behavior testing
- No pollution of existing comprehensive tests
- Easy traceability to acceptance criteria
- Simpler maintenance

### Test Architecture

#### Test Categories

```
SessionAutoSaver Dynamic Enable/Disable Integration Tests
├── AC1: Enabling auto-save starts timer and triggers saves
│   ├── Test initial enable on start
│   ├── Test dynamic enable via updateOptions
│   └── Test enable after changes accumulated
├── AC2: Disabling auto-save stops timer but preserves unsaved changes
│   ├── Test disable preserves unsaved count
│   ├── Test disable during active session
│   └── Test manual save still works when disabled
├── AC3: Multiple toggle cycles preserve session state
│   ├── Test enable-disable-enable cycle
│   ├── Test multiple toggle cycles with state accumulation
│   └── Test rapid toggle stability
└── AC4: updateOptions() runtime reconfiguration
    ├── Test interval changes at runtime
    ├── Test threshold changes at runtime
    └── Test combined option changes
```

#### Test Infrastructure Pattern

Follow established patterns from existing tests:

```typescript
describe('SessionAutoSaver Dynamic Enable/Disable Integration Tests', () => {
  let tempDir: string;
  let store: SessionStore;
  let autoSaver: SessionAutoSaver;

  beforeEach(async () => {
    vi.useFakeTimers();
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'apex-dynamic-test-'));
    store = new SessionStore(tempDir);
    await store.initialize();
  });

  afterEach(async () => {
    vi.useRealTimers();
    autoSaver?.stop();
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  // Helper functions...
});
```

### Detailed Test Specifications

#### AC1: Enabling Auto-save Starts Timer and Triggers Saves

**Test 1.1**: Initial enable on start
```typescript
it('should start timer immediately when enabled on session start', async () => {
  autoSaver = new SessionAutoSaver(store, { enabled: true, intervalMs: 5000 });
  await autoSaver.start();

  // Add changes
  await autoSaver.addMessage({ role: 'user', content: 'Test' });
  expect(autoSaver.hasUnsavedChanges()).toBe(true);

  // Timer should trigger save at interval
  vi.advanceTimersByTime(5000);
  await vi.runAllTimersAsync();

  expect(autoSaver.hasUnsavedChanges()).toBe(false);
  // Verify persistence
});
```

**Test 1.2**: Dynamic enable via updateOptions
```typescript
it('should start timer when enabling auto-save via updateOptions', async () => {
  // Start disabled
  autoSaver = new SessionAutoSaver(store, { enabled: false, intervalMs: 3000 });
  await autoSaver.start();

  await autoSaver.addMessage({ role: 'user', content: 'Before enable' });

  // Enable via updateOptions
  autoSaver.updateOptions({ enabled: true });

  // Timer should now be active
  vi.advanceTimersByTime(3000);
  await vi.runAllTimersAsync();

  expect(autoSaver.hasUnsavedChanges()).toBe(false);
});
```

**Test 1.3**: Enable after changes accumulated
```typescript
it('should trigger save for accumulated changes after enabling', async () => {
  autoSaver = new SessionAutoSaver(store, { enabled: false, intervalMs: 2000 });
  await autoSaver.start();

  // Accumulate changes while disabled
  await autoSaver.addMessage({ role: 'user', content: 'Message 1' });
  await autoSaver.updateState({ totalCost: 0.5 });
  expect(autoSaver.getUnsavedChangesCount()).toBe(2);

  // Enable auto-save
  autoSaver.updateOptions({ enabled: true });

  // Timer should save accumulated changes
  vi.advanceTimersByTime(2000);
  await vi.runAllTimersAsync();

  expect(autoSaver.getUnsavedChangesCount()).toBe(0);
});
```

#### AC2: Disabling Auto-save Stops Timer but Preserves Unsaved Changes

**Test 2.1**: Disable preserves unsaved count
```typescript
it('should preserve unsaved changes count when disabling auto-save', async () => {
  autoSaver = new SessionAutoSaver(store, { enabled: true, intervalMs: 10000 });
  await autoSaver.start();

  await autoSaver.addMessage({ role: 'user', content: 'Test message' });
  await autoSaver.updateState({ totalCost: 1.0 });

  const unsavedBefore = autoSaver.getUnsavedChangesCount();
  expect(unsavedBefore).toBe(2);

  // Disable auto-save
  autoSaver.updateOptions({ enabled: false });

  // Unsaved changes should be preserved
  expect(autoSaver.getUnsavedChangesCount()).toBe(2);
  expect(autoSaver.hasUnsavedChanges()).toBe(true);
});
```

**Test 2.2**: Timer stops on disable
```typescript
it('should stop timer when disabling auto-save', async () => {
  autoSaver = new SessionAutoSaver(store, { enabled: true, intervalMs: 3000 });
  await autoSaver.start();

  await autoSaver.addMessage({ role: 'user', content: 'Test' });

  // Disable before timer triggers
  autoSaver.updateOptions({ enabled: false });

  // Advance past interval - should NOT save
  vi.advanceTimersByTime(5000);
  await vi.runAllTimersAsync();

  expect(autoSaver.hasUnsavedChanges()).toBe(true);
});
```

**Test 2.3**: Manual save works when disabled
```typescript
it('should allow manual save when auto-save is disabled', async () => {
  autoSaver = new SessionAutoSaver(store, { enabled: false });
  await autoSaver.start();

  await autoSaver.addMessage({ role: 'user', content: 'Manual save test' });
  expect(autoSaver.hasUnsavedChanges()).toBe(true);

  // Manual save should work
  await autoSaver.save();

  expect(autoSaver.hasUnsavedChanges()).toBe(false);
  // Verify persistence with fresh store
});
```

#### AC3: Multiple Toggle Cycles Preserve Session State

**Test 3.1**: Enable-disable-enable cycle
```typescript
it('should preserve session state through enable-disable-enable cycle', async () => {
  autoSaver = new SessionAutoSaver(store, { enabled: true, intervalMs: 2000 });
  const session = await autoSaver.start();

  // Add state during enabled phase
  await autoSaver.addMessage({ role: 'user', content: 'Phase 1' });
  vi.advanceTimersByTime(2000);
  await vi.runAllTimersAsync();

  // Disable
  autoSaver.updateOptions({ enabled: false });
  await autoSaver.addMessage({ role: 'assistant', content: 'Phase 2' });

  // Re-enable
  autoSaver.updateOptions({ enabled: true });
  await autoSaver.addMessage({ role: 'user', content: 'Phase 3' });

  vi.advanceTimersByTime(2000);
  await vi.runAllTimersAsync();

  // All messages should be preserved
  const persistedSession = await verifySessionPersisted(session.id);
  expect(persistedSession.messages).toHaveLength(3);
  expect(persistedSession.messages.map(m => m.content)).toEqual([
    'Phase 1', 'Phase 2', 'Phase 3'
  ]);
});
```

**Test 3.2**: Multiple toggle cycles
```typescript
it('should handle multiple toggle cycles with cumulative state', async () => {
  autoSaver = new SessionAutoSaver(store, { enabled: true, intervalMs: 1000 });
  const session = await autoSaver.start();

  const phases = [
    { enabled: true, message: 'Enabled 1' },
    { enabled: false, message: 'Disabled 1' },
    { enabled: true, message: 'Enabled 2' },
    { enabled: false, message: 'Disabled 2' },
    { enabled: true, message: 'Enabled 3' },
  ];

  for (const phase of phases) {
    autoSaver.updateOptions({ enabled: phase.enabled });
    await autoSaver.addMessage({ role: 'user', content: phase.message });
    if (phase.enabled) {
      vi.advanceTimersByTime(1000);
      await vi.runAllTimersAsync();
    }
  }

  // Final save to capture disabled phase messages
  await autoSaver.save();

  // Verify all state preserved
  const persistedSession = await verifySessionPersisted(session.id);
  expect(persistedSession.messages).toHaveLength(5);
});
```

**Test 3.3**: Rapid toggle stability
```typescript
it('should remain stable during rapid toggle sequences', async () => {
  autoSaver = new SessionAutoSaver(store, { enabled: true, intervalMs: 500 });
  const session = await autoSaver.start();

  await autoSaver.addMessage({ role: 'user', content: 'Initial' });

  // Rapid toggles
  for (let i = 0; i < 10; i++) {
    autoSaver.updateOptions({ enabled: i % 2 === 0 });
  }

  // Final state should be disabled (10 % 2 === 0)
  vi.advanceTimersByTime(1000);
  await vi.runAllTimersAsync();

  // Message should still exist (not lost)
  expect(autoSaver.getSession()?.messages).toHaveLength(1);
  expect(autoSaver.hasUnsavedChanges()).toBe(true);
});
```

#### AC4: updateOptions() Runtime Reconfiguration

**Test 4.1**: Interval changes at runtime
```typescript
it('should apply new interval immediately when changed via updateOptions', async () => {
  autoSaver = new SessionAutoSaver(store, { enabled: true, intervalMs: 10000 });
  await autoSaver.start();

  await autoSaver.addMessage({ role: 'user', content: 'Test' });

  // Change interval to shorter
  autoSaver.updateOptions({ intervalMs: 2000 });

  // Should NOT save at old interval timing
  vi.advanceTimersByTime(2000);
  await vi.runAllTimersAsync();

  // Note: Due to timer restart, first save is at new interval from restart
  expect(autoSaver.hasUnsavedChanges()).toBe(false);
});
```

**Test 4.2**: Threshold changes at runtime
```typescript
it('should apply new threshold immediately when changed via updateOptions', async () => {
  autoSaver = new SessionAutoSaver(store, { enabled: true, maxUnsavedMessages: 10 });
  await autoSaver.start();

  await autoSaver.addMessage({ role: 'user', content: 'Msg 1' });
  await autoSaver.addMessage({ role: 'user', content: 'Msg 2' });

  // Lower threshold below current unsaved count
  autoSaver.updateOptions({ maxUnsavedMessages: 2 });

  // Should NOT immediately trigger (threshold checked on add)
  expect(autoSaver.hasUnsavedChanges()).toBe(true);

  // Next message should trigger with new threshold
  await autoSaver.addMessage({ role: 'user', content: 'Trigger' });
  expect(autoSaver.getUnsavedChangesCount()).toBe(0);
});
```

**Test 4.3**: Combined option changes
```typescript
it('should handle combined interval, threshold, and enabled changes', async () => {
  autoSaver = new SessionAutoSaver(store, {
    enabled: false,
    intervalMs: 30000,
    maxUnsavedMessages: 10
  });
  const session = await autoSaver.start();

  // Accumulate changes
  await autoSaver.addMessage({ role: 'user', content: 'Accumulated' });

  // Apply multiple changes at once
  autoSaver.updateOptions({
    enabled: true,
    intervalMs: 1000,
    maxUnsavedMessages: 2
  });

  // Timer should now be active with new interval
  vi.advanceTimersByTime(1000);
  await vi.runAllTimersAsync();

  expect(autoSaver.hasUnsavedChanges()).toBe(false);
  await verifySessionPersisted(session.id);
});
```

---

## Implementation Notes

### File Placement
- Location: `packages/cli/src/services/__tests__/SessionAutoSaver.dynamic-toggle.integration.test.ts`
- Follows existing naming convention: `*.integration.test.ts`

### Dependencies
```typescript
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { SessionAutoSaver, AutoSaveOptions } from '../SessionAutoSaver.js';
import { SessionStore, Session } from '../SessionStore.js';
```

### Helper Functions

```typescript
// Verify persistence with fresh store instance
async function verifySessionPersisted(sessionId: string): Promise<Session> {
  const freshStore = new SessionStore(tempDir);
  await freshStore.initialize();
  const session = await freshStore.getSession(sessionId);
  expect(session).not.toBeNull();
  return session!;
}

// Helper to add test messages
async function addTestMessage(
  autoSaver: SessionAutoSaver,
  content: string,
  role: 'user' | 'assistant' = 'user'
): Promise<void> {
  await autoSaver.addMessage({ role, content });
}
```

### Test Execution
```bash
npm test --workspace=@apexcli/cli -- --testPathPattern="dynamic-toggle"
```

---

## Consequences

### Positive
- **Clear traceability**: Each test maps directly to acceptance criteria
- **Focused testing**: Dedicated file for dynamic toggle behavior
- **Real integration**: No mocking of file system operations
- **Comprehensive coverage**: All edge cases covered
- **Maintainable**: Isolated from other test concerns

### Negative
- **Additional test file**: Adds to test maintenance
- **Some overlap**: Minor overlap with existing enable/disable tests

### Risks
- **Timer behavior**: Need to ensure fake timers properly simulate real timing
- **Race conditions**: Concurrent operations during toggle need careful testing

---

## Test Execution Plan

1. Create new test file with all specified tests
2. Run tests in isolation to verify correctness
3. Run full test suite to ensure no regressions
4. Generate coverage report to verify AC coverage

---

## References

- Existing test file: `SessionAutoSaver.integration.test.ts`
- Implementation: `SessionAutoSaver.ts`
- Test patterns: Vitest fake timers, real file system integration
