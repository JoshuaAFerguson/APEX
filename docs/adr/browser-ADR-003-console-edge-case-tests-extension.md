# ADR-003: Console Edge Case Tests Extension - Technical Design

## Status
Proposed

## Date
2025-01-16

## Context

The task requires adding additional tests for malformed and edge case console outputs beyond what's currently covered in the existing test suite. After thorough analysis of the current test coverage, specific gaps have been identified that need to be addressed.

### Current State - Existing Test Coverage Analysis

The existing `malformed-console-edge-cases.test.ts` already covers:

| Category | Coverage Status | Details |
|----------|----------------|---------|
| Circular reference objects | ✅ Covered | Lines 43-67 |
| Objects with throwing getters | ✅ Covered | Lines 69-98 |
| Objects with Symbol properties | ✅ Covered | Lines 100-128 |
| Prototype pollution attempts | ✅ Covered | Lines 130-159 |
| Extremely large strings (1MB+) | ✅ Covered | Lines 175-203 |
| Deeply nested structures | ✅ Covered | Lines 206-234 |
| Sparse/holey arrays | ✅ Covered | Lines 236-263 |
| Unicode characters & emojis | ✅ Covered | Lines 278-311 |
| Control characters & escapes | ✅ Covered | Lines 314-343 |
| Malformed Unicode sequences | ✅ Covered | Lines 345-376 |
| Console method overrides | ✅ Covered | Lines 392-435 |
| Deleted console methods | ✅ Covered | Lines 438-480 |
| Throwing toString/valueOf | ✅ Covered | Lines 482-533 |
| Buffer overflow handling | ✅ Covered | Lines 549-574 |
| Rapid message generation | ✅ Covered | Lines 577-609 |
| Concurrent access/race conditions | ✅ Covered | Lines 625-675 |
| Config changes during capture | ✅ Covered | Lines 677-719 |

### Identified Gaps

Based on acceptance criteria requirements, the following edge cases need **additional test coverage**:

| Edge Case | Gap Status | Priority |
|-----------|------------|----------|
| **Empty messages** | ❌ Missing | High |
| **Very long messages** | ⚠️ Partial (only 1MB, need more variations) | Medium |
| **Undefined/null values as arguments** | ❌ Missing explicit tests | High |
| **Non-string arguments** | ⚠️ Partial coverage | Medium |
| **Multiple arguments to console methods** | ⚠️ Partial (needs edge cases) | Medium |
| **BigInt values** | ❌ Missing | Medium |
| **Proxy objects** | ❌ Missing | Medium |
| **WeakMap/WeakSet** | ❌ Missing | Low |
| **Generator functions** | ❌ Missing | Low |
| **Async iterables** | ❌ Missing | Low |

## Decision

### Technical Design for Additional Edge Case Tests

Create a new test file `console-primitive-edge-cases.test.ts` to complement the existing malformed test file, focusing specifically on the acceptance criteria gaps.

#### 1. Test File Structure

```
packages/browser/src/__tests__/
├── malformed-console-edge-cases.test.ts     # Existing - complex objects/serialization
├── console-primitive-edge-cases.test.ts     # NEW - primitive values/argument patterns
├── console-capture.test.ts                   # Existing - basic functionality
└── console-integration-enhanced.test.ts      # Existing - advanced features
```

#### 2. New Test Categories

The new test file will contain the following test suites:

```typescript
describe('Console Primitive Edge Cases Tests', () => {
  describe('Empty and Null Message Handling', () => {
    // Test: Empty string console.log('')
    // Test: console.log() with no arguments
    // Test: console.log(null)
    // Test: console.log(undefined)
    // Test: console.log(null, undefined, '')
  });

  describe('Undefined and Null Value Arguments', () => {
    // Test: Explicit null values
    // Test: Explicit undefined values
    // Test: Mixed null/undefined with other types
    // Test: Array with null holes [1, , 3, null, undefined]
  });

  describe('Non-String Arguments', () => {
    // Test: Pure number arguments console.log(42)
    // Test: BigInt arguments console.log(123n)
    // Test: Boolean arguments console.log(true, false)
    // Test: Symbol arguments console.log(Symbol('test'))
    // Test: Mixed type arguments
  });

  describe('Multiple Arguments Edge Cases', () => {
    // Test: Large number of arguments (50+)
    // Test: Mixed primitive and object arguments
    // Test: Alternating null/undefined arguments
    // Test: Repeated same argument
  });

  describe('Special JavaScript Objects', () => {
    // Test: Proxy objects
    // Test: Generator functions and iterators
    // Test: WeakMap and WeakSet
    // Test: Promise objects (pending, resolved, rejected)
  });

  describe('String Length Variations', () => {
    // Test: Single character message
    // Test: Maximum safe string (near 256MB JS string limit)
    // Test: Unicode-heavy strings at various lengths
    // Test: Whitespace-only strings (spaces, tabs, newlines)
  });
});
```

#### 3. Implementation Pattern

Follow the existing test pattern established in `malformed-console-edge-cases.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { BrowserManager } from '../browser-manager.js';
import { BrowserSession } from '../browser-session.js';
import type { CapturedConsoleMessage } from '../types.js';

describe('Console Primitive Edge Cases Tests', () => {
  let manager: BrowserManager;
  let session: BrowserSession;

  beforeEach(() => {
    manager = new BrowserManager();
  });

  afterEach(async () => {
    if (session) await session.close();
    if (manager) await manager.shutdown();
  });

  // Test implementation follows pattern:
  // 1. Create BrowserSession with captureConsole: true
  // 2. Launch session
  // 3. Navigate to data:text/html with <script> tag
  // 4. Wait for messages to be captured
  // 5. Assert on getCapturedConsoleMessages()
});
```

#### 4. Key Test Scenarios

##### 4.1 Empty Messages Test

```typescript
it('should handle empty string messages', async () => {
  const html = `
    <script>
      console.log('');
      console.log('non-empty');
      console.log('');
    </script>
  `;
  await session.navigate(`data:text/html,${encodeURIComponent(html)}`);
  await new Promise(resolve => setTimeout(resolve, 100));

  const messages = session.getCapturedConsoleMessages();
  const emptyMessages = messages.filter(m => m.text === '');

  expect(emptyMessages.length).toBe(2);
  emptyMessages.forEach(m => {
    expect(m.type).toBe('log');
    expect(m.args).toEqual(['']);
    expect(m.timestamp).toBeGreaterThan(0);
  });
});
```

##### 4.2 Null/Undefined Arguments Test

```typescript
it('should handle null and undefined arguments explicitly', async () => {
  const html = `
    <script>
      console.log(null);
      console.log(undefined);
      console.log(null, undefined);
      console.warn(undefined);
      console.error(null);
    </script>
  `;
  await session.navigate(`data:text/html,${encodeURIComponent(html)}`);
  await new Promise(resolve => setTimeout(resolve, 100));

  const messages = session.getCapturedConsoleMessages();

  expect(messages.length).toBeGreaterThanOrEqual(5);

  const nullLog = messages.find(m =>
    m.type === 'log' &&
    m.args.length === 1 &&
    m.args[0] === null
  );
  expect(nullLog).toBeDefined();

  const undefinedLog = messages.find(m =>
    m.type === 'log' &&
    m.args.length === 1 &&
    m.args[0] === undefined
  );
  expect(undefinedLog).toBeDefined();
});
```

##### 4.3 Multiple Arguments Edge Cases Test

```typescript
it('should handle large number of arguments', async () => {
  const html = `
    <script>
      const args = [];
      for (let i = 0; i < 100; i++) {
        args.push('arg' + i);
      }
      console.log(...args);
    </script>
  `;
  await session.navigate(`data:text/html,${encodeURIComponent(html)}`);
  await new Promise(resolve => setTimeout(resolve, 100));

  const messages = session.getCapturedConsoleMessages();
  const manyArgsMessage = messages.find(m =>
    m.args && m.args.length >= 100
  );

  expect(manyArgsMessage).toBeDefined();
  expect(manyArgsMessage!.args.length).toBe(100);
});
```

#### 5. Test Data Flow

```
Test Runner (Vitest)
       ↓
BrowserSession.launch()
       ↓
Playwright Chromium (headless)
       ↓
Navigate to data:text/html
       ↓
Execute <script> with console.* calls
       ↓
page.on('console') event handler
       ↓
processConsoleMessage() → consoleBuffer
       ↓
session.getCapturedConsoleMessages()
       ↓
Test assertions (expect)
```

#### 6. Error Handling Strategy

All tests must handle these scenarios gracefully:
- Console capture may truncate extremely long messages
- Serialization of complex objects may lose some information
- Timing-sensitive tests need appropriate wait times
- Browser-specific differences (Chromium vs Firefox vs WebKit)

### File Naming and Location

```
packages/browser/src/__tests__/console-primitive-edge-cases.test.ts
```

### Dependencies

No new dependencies required. Uses existing:
- `vitest` for test framework
- `playwright` for browser automation
- `eventemitter3` for event handling (internal)

## Consequences

### Positive

1. **Complete acceptance criteria coverage**: All specified edge cases will be tested
2. **Follows established patterns**: Uses existing test infrastructure
3. **No architectural changes**: Purely additive test coverage
4. **Type-safe**: Full TypeScript support in tests
5. **Real browser testing**: Uses actual Playwright browser instances

### Negative

1. **Increased test execution time**: Additional browser launches
2. **Potential flakiness**: Some edge cases may be timing-sensitive

### Mitigation

- Tests should use appropriate `setTimeout` delays for message capture
- Add retry logic for flaky tests if needed
- Consider test parallelization at the suite level

## Implementation Checklist

1. [ ] Create `console-primitive-edge-cases.test.ts`
2. [ ] Implement empty message handling tests
3. [ ] Implement null/undefined argument tests
4. [ ] Implement non-string argument tests
5. [ ] Implement multiple arguments edge case tests
6. [ ] Implement special JavaScript object tests
7. [ ] Implement string length variation tests
8. [ ] Run `npm run build` to verify TypeScript compilation
9. [ ] Run `npm run test` to verify all tests pass
10. [ ] Update test coverage documentation

## Related Files

| File | Purpose |
|------|---------|
| `packages/browser/src/__tests__/console-primitive-edge-cases.test.ts` | NEW - Additional edge case tests |
| `packages/browser/src/__tests__/malformed-console-edge-cases.test.ts` | Existing - Complex object tests |
| `packages/browser/src/browser-session.ts` | Console capture implementation |
| `packages/browser/src/types.ts` | Type definitions |

## Conclusion

This architectural design provides a clear path forward for implementing the additional console edge case tests. The design:

1. **Complements** the existing `malformed-console-edge-cases.test.ts` rather than duplicating
2. **Focuses on gaps** identified through acceptance criteria analysis
3. **Maintains consistency** with established test patterns
4. **Requires no changes** to the core implementation

The developer agent should create the new test file following this specification.
