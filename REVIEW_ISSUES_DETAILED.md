# SQLite Large Volume Load Tests - Detailed Issues

**File**: `packages/orchestrator/src/__tests__/sqlite-large-volume-load.test.ts`
**Date**: 2026-03-14
**Total Issues**: 12 (3 HIGH, 6 MEDIUM, 3 LOW)

---

## HIGH SEVERITY ISSUES (MUST FIX)

### 1. Metrics Calculation Error - Line 101-116, 147

**Type**: Logic Error / Calculation
**Severity**: 🔴 HIGH

The `calculateMetrics()` function divides by batch count (100) instead of task count (10000), reporting metrics 100x smaller than actual.

**Problem Code**:
```typescript
const calculateMetrics = (
  operation: string,
  count: number,  // This is task count (10000)
  times: number[]  // But length of times = 100 (batch count!)
): PerformanceMetrics => {
  const totalTimeMs = times.reduce((sum, t) => sum + t, 0);
  return {
    avgTimeMs: totalTimeMs / count,  // WRONG: dividing by tasks, but times has only batches
  };
};
```

**Impact**:
- If actual batch takes 180ms (18ms per task × 10 tasks per batch)
- Calculates: 180ms / 100 batches = 1.8ms (should be 18ms)
- Metrics off by 100x - performance degradation undetected

**Fix**:
```typescript
const calculateMetrics = (
  operation: string,
  taskCount: number,
  batchTimes: number[]
): PerformanceMetrics => {
  const totalTimeMs = batchTimes.reduce((sum, t) => sum + t, 0);
  return {
    avgTimeMs: totalTimeMs / taskCount,  // Divide by actual task count
    opsPerSecond: taskCount / (totalTimeMs / 1000),
  };
};
```

---

### 2. Performance Threshold Multiplied - Line 182

**Type**: Logic Error / Threshold
**Severity**: 🔴 HIGH

Threshold assertion multiplies per-task average by batch size, allowing 100x performance degradation.

**Problem Code**:
```typescript
expect(metrics.avgTimeMs).toBeLessThan(
  THRESHOLDS.taskCreation.avgPerTaskMs * BATCH_SIZE  // 18 * 100 = 1800
);
// Allows 1800ms per task instead of 18ms
```

**Impact**: Task creation can take 1800ms per task and still pass

**Fix**:
```typescript
const avgPerTask = totalTime / LARGE_VOLUME_COUNT;
expect(avgPerTask).toBeLessThan(
  THRESHOLDS.taskCreation.avgPerTaskMs
);
```

---

### 3. Memory Threshold Too Permissive - Line 824

**Type**: Weak Assertion / Performance
**Severity**: 🔴 HIGH

Allows 500MB growth for 10k tasks (50KB per task), which is 25-50x too loose.

**Problem Code**:
```typescript
expect(totalGrowthMB).toBeLessThan(500);
// 500MB / 10k tasks = 50KB per task
// Typical object: 1-2KB
// Expected realistic: ~20MB + 50MB overhead = ~75MB total
```

**Impact**: Memory leaks up to 400MB would go undetected

**Fix**:
```typescript
expect(totalGrowthMB).toBeLessThan(100);  // ~75MB expected + buffer
```

---

## MEDIUM SEVERITY ISSUES (SHOULD FIX)

### 4. Missing Error Handling - Lines 344, 362

**Type**: Error Handling
**Severity**: 🟠 MEDIUM

Query operations lack try-catch blocks, making API failures indistinguishable from timeouts.

**Problem**: No context on query failures

**Fix**:
```typescript
try {
  const allTasks = await store.listTasks();
} catch (error) {
  throw new Error(`listTasks() failed: ${error}`);
}
```

---

### 5. listTasks() Without Limit - Line 326

**Type**: Resource Management
**Severity**: 🟠 MEDIUM

Loads all 10k records unnecessarily, causing memory spike and confounding pagination metrics.

**Problem Code**:
```typescript
const allTasks = await store.listTasks();  // No limit
```

**Fix**:
```typescript
const allTasks = await store.listTasks({ limit: LARGE_VOLUME_COUNT });
```

---

### 6. Query Timeout Too Generous - Line 376

**Type**: Weak Assertion
**Severity**: 🟠 MEDIUM

30-second timeout for indexed SQLite queries is 60x too loose.

**Problem Code**:
```typescript
expect(result.timeMs).toBeLessThan(30000);  // Should be <1s for indexed
```

**Fix**:
```typescript
if (result.query.includes('status') || result.query.includes('priority')) {
  expect(result.timeMs).toBeLessThan(1000);  // Indexed queries
} else {
  expect(result.timeMs).toBeLessThan(5000);  // Complex queries
}
```

---

### 7. API Methods Not Verified - Lines 754, 760

**Type**: API Contract Verification
**Severity**: 🟠 MEDIUM

Assumes methods exist but doesn't verify, causing failure after 20+ minutes.

**Problem Code**:
```typescript
await store.addDependency(tasks[i].id, tasks[i - 10].id);
const readyChecks = await Promise.all(
  tasks.slice(0, 100).map((t) => store.isTaskReady(t.id))
);
// If methods removed, test fails after creating 2000 tasks
```

**Fix**: Verify in beforeEach:
```typescript
beforeEach(async () => {
  // ...
  const api = store as any;
  if (typeof api.addDependency !== 'function') {
    throw new Error('TaskStore.addDependency() not found');
  }
  if (typeof api.isTaskReady !== 'function') {
    throw new Error('TaskStore.isTaskReady() not found');
  }
});
```

---

### 8. Race Condition in Random Selection - Lines 708-711

**Type**: Test Isolation / Non-determinism
**Severity**: 🟠 MEDIUM

Random task selection assumes all tasks exist, causing non-deterministic failures.

**Problem Code**:
```typescript
const randomTaskId = tasks[Math.floor(Math.random() * tasks.length)].id;
await store.getTask(randomTaskId);  // May not exist if deleted
```

**Fix**:
```typescript
const randomTask = tasks[Math.floor(Math.random() * tasks.length)];
const retrieved = await store.getTask(randomTask.id);
expect(retrieved).not.toBeNull();
```

---

## LOW SEVERITY ISSUES (NICE TO HAVE)

### 9. Missing Assertion Messages - Lines 179-186

**Type**: Testability / Documentation
**Severity**: 🟡 LOW

Assertions lack context messages.

**Fix**: Add descriptive messages:
```typescript
expect(tasks, `Should create exactly ${LARGE_VOLUME_COUNT} tasks`)
  .toHaveLength(LARGE_VOLUME_COUNT);
```

### 10. Missing Percentile Metrics - Lines 474-478

**Type**: Statistics
**Severity**: 🟡 LOW

Only uses average, hiding outliers that impact user experience.

### 11. Missing Schema Verification - beforeEach

**Type**: Verification
**Severity**: 🟡 LOW

Doesn't verify database schema created correctly.

### 12. Import Path Not Validated - Line 26

**Type**: Type Safety
**Severity**: 🟡 LOW

TypeScript handles this - no fix needed.

---

## Summary Statistics

| Severity | Count | Total Issues |
|----------|-------|--------------|
| 🔴 HIGH | 3 | 3 |
| 🟠 MEDIUM | 6 | 6 |
| 🟡 LOW | 3 | 3 |
| **TOTAL** | **12** | **12** |

**Build Status**: ✅ PASS
**Test Execution**: ⚠️ BLOCKED (pre-existing @apexcli/core issue)
**Test File Syntax**: ✅ VALID
**Code Quality**: 🟡 FAIR (requires fixes)
