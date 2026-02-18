# ADR-051: Custom Wait Conditions Integration Tests (waitForFunction)

## Status
Proposed

## Context

The APEX browser automation infrastructure requires comprehensive integration tests for custom wait conditions using `waitForFunction` and equivalent predicate-based waiting mechanisms. The acceptance criteria specify:

> Tests pass for custom wait conditions using waitForFunction or equivalent. Tests cover polling intervals, return value evaluation, and complex DOM condition checking.

### Existing Infrastructure Analysis

Based on thorough analysis of the codebase, we have identified:

#### 1. BrowserSession.waitForFunction Implementation
Located in `/packages/browser/src/browser-session.ts` (lines 1043-1080):

```typescript
async waitForFunction(
  fn: string | (() => unknown),
  options?: {
    timeout?: number;
    polling?: number | 'raf';  // Polling interval or request animation frame
  }
): Promise<BrowserActionResult<unknown>> {
  // Implementation wraps Playwright's page.waitForFunction
  // Returns the evaluated value via result.jsonValue()
}
```

Key features:
- Supports both string expressions and function references
- Configurable polling intervals (milliseconds or 'raf' for animation frames)
- Configurable timeouts
- Returns evaluated result via `BrowserActionResult<unknown>`

#### 2. Existing waitForConditions Utility
Located in `/tests/browser-integration/utils/element-interaction-helpers.ts` (lines 272-346):

```typescript
async function waitForConditions(
  page: Page,
  selector: string,
  conditions: WaitCondition[]
): Promise<boolean>
```

Supports condition types:
- `visible`, `hidden`, `enabled`, `disabled`, `focused`
- `stable` (element position stability check)
- `text-contains`, `attribute-equals`
- `custom` (custom predicate function)

#### 3. Test Infrastructure
- `BrowserTestBase` class in `/tests/test-utils/browser-test-base.ts`
- `BrowserAutomationTestManager` in `/tests/browser-integration/utils/browser-automation-test-helpers.ts`
- Existing patterns in `/tests/browser-integration/waitForSelector.integration.test.ts`

### Gap Analysis

Current test coverage gaps for custom wait conditions:

| Feature | Coverage Status | Priority |
|---------|----------------|----------|
| Basic `waitForFunction` with expression string | Missing | High |
| `waitForFunction` with function reference | Missing | High |
| Polling interval configurations (numeric) | Missing | High |
| Polling with `raf` mode | Missing | Medium |
| Return value evaluation (primitives) | Missing | High |
| Return value evaluation (objects/arrays) | Missing | Medium |
| Complex DOM condition predicates | Missing | High |
| Multi-element aggregate conditions | Missing | Medium |
| Asynchronous condition resolution | Missing | Medium |
| Timeout behavior for custom conditions | Missing | High |
| Error handling for malformed predicates | Missing | Medium |

## Decision

### 1. Test Architecture Overview

Create a new dedicated integration test file:

```
tests/browser-integration/
└── custom-wait-conditions.integration.test.ts   # NEW
```

### 2. Test Categories and Structure

#### 2.1 Basic waitForFunction Tests

Tests for fundamental `page.waitForFunction` behavior:

```typescript
describe('Basic waitForFunction', () => {
  it('should wait for string expression to evaluate to truthy value');
  it('should wait for function reference to return truthy value');
  it('should return the evaluated result value');
  it('should handle primitive return values (boolean, number, string)');
  it('should handle complex return values (objects, arrays)');
  it('should timeout when condition is never met');
});
```

#### 2.2 Polling Configuration Tests

Tests for different polling strategies:

```typescript
describe('Polling Configurations', () => {
  it('should poll at specified interval (100ms)');
  it('should poll at specified interval (500ms)');
  it('should poll at specified interval (50ms - high frequency)');
  it('should use requestAnimationFrame polling with raf mode');
  it('should detect rapid state changes with appropriate polling');
  it('should respect minimum polling interval');
});
```

#### 2.3 Return Value Evaluation Tests

Tests for various return value scenarios:

```typescript
describe('Return Value Evaluation', () => {
  it('should evaluate boolean true as passing condition');
  it('should evaluate non-zero numbers as truthy');
  it('should evaluate non-empty strings as truthy');
  it('should evaluate objects/arrays as truthy');
  it('should evaluate null/undefined/0/empty-string as falsy');
  it('should return numeric computed values');
  it('should return DOM element properties');
  it('should return aggregated collection statistics');
});
```

#### 2.4 Complex DOM Condition Tests

Tests for sophisticated DOM predicates:

```typescript
describe('Complex DOM Condition Checking', () => {
  describe('Multi-Element Conditions', () => {
    it('should wait for all elements in collection to be visible');
    it('should wait for element count to reach threshold');
    it('should wait for sum of element values to exceed target');
  });

  describe('Computed Style Conditions', () => {
    it('should wait for element to reach target opacity');
    it('should wait for animation to complete (transform change)');
    it('should wait for CSS transition to finish');
  });

  describe('DOM Hierarchy Conditions', () => {
    it('should wait for element to become child of specific parent');
    it('should wait for shadow DOM element to be available');
    it('should wait for nested iframe content to load');
  });

  describe('Attribute and Data Conditions', () => {
    it('should wait for data attribute to match complex pattern');
    it('should wait for multiple attributes to all be set');
    it('should wait for attribute to be removed');
  });

  describe('Form State Conditions', () => {
    it('should wait for form validity state to become valid');
    it('should wait for all required fields to be filled');
    it('should wait for async validation to complete');
  });

  describe('Layout Conditions', () => {
    it('should wait for element to be within viewport');
    it('should wait for element to reach minimum dimensions');
    it('should wait for element overlap to be resolved');
  });
});
```

#### 2.5 Advanced Scenarios

Tests for edge cases and advanced usage:

```typescript
describe('Advanced Wait Scenarios', () => {
  it('should handle conditions that fluctuate before stabilizing');
  it('should handle conditions involving async operations');
  it('should handle conditions with DOM mutations during evaluation');
  it('should combine multiple waitForFunction calls sequentially');
  it('should race multiple conditions with Promise.race pattern');
});
```

### 3. Technical Implementation Details

#### 3.1 Test File Structure

```typescript
/**
 * @fileoverview Custom Wait Conditions Integration Tests
 *
 * Comprehensive tests for waitForFunction and custom predicate-based waiting:
 * - Polling interval configurations
 * - Return value evaluation
 * - Complex DOM condition checking
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Browser, BrowserContext, Page } from 'playwright';
import { chromium } from 'playwright';

describe('Custom Wait Conditions Integration Tests', () => {
  let browser: Browser;
  let context: BrowserContext;
  let page: Page;

  beforeEach(async () => {
    browser = await chromium.launch({
      headless: process.env.CI === 'true' || process.env.BROWSER_TEST_HEADLESS === 'true',
    });
    context = await browser.newContext();
    page = await context.newPage();
    page.setDefaultTimeout(30000);
  });

  afterEach(async () => {
    if (page) await page.close();
    if (context) await context.close();
    if (browser) await browser.close();
  });

  // Test implementations...
});
```

#### 3.2 Test Page Templates

**Dynamic Counter Page:**
```html
<!DOCTYPE html>
<html>
<head><title>Counter Test</title></head>
<body>
  <div id="counter" data-value="0">0</div>
  <script>
    let count = 0;
    const interval = setInterval(() => {
      count++;
      const el = document.getElementById('counter');
      el.textContent = count;
      el.dataset.value = count;
      if (count >= 10) clearInterval(interval);
    }, 100);
  </script>
</body>
</html>
```

**Multi-Element Loading Page:**
```html
<!DOCTYPE html>
<html>
<head><title>Multi-Element Test</title></head>
<body>
  <div id="container"></div>
  <script>
    let loaded = 0;
    const target = 5;
    const container = document.getElementById('container');

    function addElement() {
      const el = document.createElement('div');
      el.className = 'loaded-item';
      el.textContent = `Item ${loaded + 1}`;
      container.appendChild(el);
      loaded++;
      if (loaded < target) {
        setTimeout(addElement, 200);
      }
    }

    setTimeout(addElement, 100);
  </script>
</body>
</html>
```

**Computed Style Transition Page:**
```html
<!DOCTYPE html>
<html>
<head>
  <title>Style Transition Test</title>
  <style>
    #transitioning {
      opacity: 0;
      transition: opacity 0.5s ease-in-out;
    }
    #transitioning.visible {
      opacity: 1;
    }
  </style>
</head>
<body>
  <div id="transitioning">Transitioning Element</div>
  <script>
    setTimeout(() => {
      document.getElementById('transitioning').classList.add('visible');
    }, 200);
  </script>
</body>
</html>
```

#### 3.3 Key Test Patterns

**Pattern 1: Polling Interval Verification**
```typescript
it('should poll at specified interval (100ms)', async () => {
  await page.setContent(`
    <div id="target">0</div>
    <script>
      window.pollCount = 0;
      window.getValue = () => {
        window.pollCount++;
        return parseInt(document.getElementById('target').textContent);
      };
      setInterval(() => {
        const el = document.getElementById('target');
        el.textContent = parseInt(el.textContent) + 1;
      }, 50);
    </script>
  `);

  const startTime = Date.now();

  await page.waitForFunction(
    () => (window as any).getValue() >= 5,
    { polling: 100 }
  );

  const elapsed = Date.now() - startTime;
  const pollCount = await page.evaluate(() => (window as any).pollCount);

  // With 100ms polling, should take approximately 5 polls to detect value >= 5
  expect(pollCount).toBeGreaterThanOrEqual(3);
  expect(pollCount).toBeLessThanOrEqual(10);
  expect(elapsed).toBeGreaterThanOrEqual(200);
});
```

**Pattern 2: Return Value Evaluation**
```typescript
it('should return computed numeric values', async () => {
  await page.setContent(`
    <div class="item" data-value="10">10</div>
    <div class="item" data-value="20">20</div>
    <div class="item" data-value="15">15</div>
  `);

  const result = await page.waitForFunction(() => {
    const items = document.querySelectorAll('.item');
    const sum = Array.from(items).reduce((acc, el) => {
      return acc + parseInt(el.getAttribute('data-value') || '0');
    }, 0);
    return sum > 40 ? sum : false;
  });

  const value = await result.jsonValue();
  expect(value).toBe(45);
});
```

**Pattern 3: Complex DOM Condition**
```typescript
it('should wait for all elements in collection to be visible', async () => {
  await page.setContent(`
    <div id="container">
      <div class="item" style="display: none;">Item 1</div>
      <div class="item" style="display: none;">Item 2</div>
      <div class="item" style="display: none;">Item 3</div>
    </div>
    <script>
      let shown = 0;
      const items = document.querySelectorAll('.item');
      const interval = setInterval(() => {
        if (shown < items.length) {
          items[shown].style.display = 'block';
          shown++;
        } else {
          clearInterval(interval);
        }
      }, 150);
    </script>
  `);

  await page.waitForFunction(() => {
    const items = document.querySelectorAll('.item');
    return Array.from(items).every(item => {
      const style = window.getComputedStyle(item);
      return style.display !== 'none' && style.visibility !== 'hidden';
    });
  }, { timeout: 5000 });

  const visibleCount = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('.item')).filter(item => {
      const style = window.getComputedStyle(item);
      return style.display !== 'none';
    }).length;
  });

  expect(visibleCount).toBe(3);
});
```

### 4. Acceptance Criteria Mapping

| Acceptance Criterion | Test Coverage |
|---------------------|---------------|
| Tests pass for custom wait conditions using waitForFunction | Basic waitForFunction tests |
| Tests cover polling intervals | Polling Configuration tests |
| Tests cover return value evaluation | Return Value Evaluation tests |
| Tests cover complex DOM condition checking | Complex DOM Condition tests |

### 5. Integration with Existing Infrastructure

#### 5.1 BrowserSession Integration

Tests will also verify `BrowserSession.waitForFunction()` integration:

```typescript
describe('BrowserSession.waitForFunction Integration', () => {
  let browserSession: BrowserSession;

  it('should integrate with BrowserSession wrapper', async () => {
    const result = await browserSession.waitForFunction(
      () => document.querySelector('#dynamic-element') !== null,
      { timeout: 5000, polling: 100 }
    );

    expect(result.success).toBe(true);
    expect(result.data).toBe(true);
    expect(result.duration).toBeLessThan(5000);
  });
});
```

#### 5.2 waitForConditions Utility Integration

Tests will verify compatibility with the existing `waitForConditions` utility's `custom` condition type:

```typescript
it('should work with waitForConditions custom condition', async () => {
  const result = await waitForConditions(page, '#target', [
    {
      condition: 'custom',
      timeout: 5000,
      customFn: async (element) => {
        const value = await element.evaluate(el =>
          parseInt(el.getAttribute('data-count') || '0')
        );
        return value >= 10;
      }
    }
  ]);

  expect(result).toBe(true);
});
```

### 6. Performance Considerations

#### 6.1 Polling Efficiency

- Tests should verify that appropriate polling intervals are used
- High-frequency polling (< 50ms) should only be used when necessary
- RAF polling should be tested for animation-related conditions

#### 6.2 Timeout Handling

- All tests should have explicit timeouts
- Timeout tests should verify proper cleanup
- Tests should not exceed 10 seconds for normal scenarios

### 7. Error Handling Tests

```typescript
describe('Error Handling', () => {
  it('should throw timeout error with descriptive message');
  it('should handle JavaScript errors in predicate function');
  it('should handle DOM changes during evaluation');
  it('should handle page navigation during wait');
});
```

## Consequences

### Positive

1. **Comprehensive Coverage**: All acceptance criteria will be addressed
2. **Regression Prevention**: Future changes to wait conditions will be caught
3. **Documentation**: Tests serve as usage examples
4. **Integration Verification**: Both Playwright and BrowserSession APIs verified

### Negative

1. **Test Duration**: Complex DOM tests may increase CI time
2. **Flakiness Risk**: Timing-dependent tests require careful design

### Mitigation

- Use appropriate polling intervals to balance speed and reliability
- Add retry logic for potentially flaky tests in CI
- Use deterministic timers where possible

## Implementation Plan

1. **Phase 1**: Create test file with basic structure and setup/teardown
2. **Phase 2**: Implement Basic waitForFunction tests
3. **Phase 3**: Implement Polling Configuration tests
4. **Phase 4**: Implement Return Value Evaluation tests
5. **Phase 5**: Implement Complex DOM Condition tests
6. **Phase 6**: Implement BrowserSession integration tests
7. **Phase 7**: Run full test suite and verify all acceptance criteria

## Related

- `/packages/browser/src/browser-session.ts` - BrowserSession.waitForFunction implementation
- `/tests/browser-integration/utils/element-interaction-helpers.ts` - waitForConditions utility
- `/tests/browser-integration/waitForSelector.integration.test.ts` - Related selector tests
- `/tests/browser-integration/tests/wait-conditions-state.test.ts` - Related state tests
