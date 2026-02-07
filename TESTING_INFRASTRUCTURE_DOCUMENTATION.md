# APEX Element Interaction Test Infrastructure Documentation

## Overview

The APEX Element Interaction Test Infrastructure provides comprehensive DOM element testing capabilities for browser automation scenarios. This infrastructure enables automated testing of web application interfaces with full lifecycle management, state validation, and visual verification.

## Architecture

```
tests/
├── browser-integration/
│   ├── element-interaction-infrastructure-complete.test.ts  (Main Test Suite)
│   ├── utils/
│   │   ├── element-interaction-helpers.ts                  (Core Utilities)
│   │   └── test-helpers.ts                                 (Browser Utilities)
│   ├── fixtures/
│   │   └── dom-element-test-fixtures.ts                    (Test Fixtures)
│   └── vitest.config.ts                                    (Test Configuration)
└── test-utils/
    └── browser-test-base.ts                                (Browser Infrastructure)
```

## Core Components

### 1. Element Interaction Helpers (`element-interaction-helpers.ts`)

#### Element Creation Functions
```typescript
// Create individual DOM elements
createElement(page, config)

// Create collections of elements
createElementCollection(page, template)

// Create complex forms with multiple fields
createTestForm(page, formConfig)
```

#### Interaction Functions
```typescript
// Enhanced click with validation
performClick(page, selector, options)

// Advanced text input with verification
performTextInput(page, selector, text, options)

// Comprehensive form filling
fillForm(page, formSelector, fields, options)
```

#### State Management Functions
```typescript
// Capture element state
getElementState(page, selector)

// Compare element states
compareElementStates(state1, state2, options)

// Wait for complex conditions
waitForConditions(page, selector, conditions)
```

#### Assertion Functions
```typescript
// Assert single element properties
assertElement(page, assertion)

// Assert multiple elements
assertElements(page, assertions)
```

### 2. Test Fixtures (`dom-element-test-fixtures.ts`)

#### Standard Element Fixtures
- `BUTTON_FIXTURES` - Various button types (primary, secondary, disabled)
- `INPUT_FIXTURES` - Input field types (text, email, number, checkbox)
- `FORM_FIXTURES` - Pre-configured forms (simple, contact)
- `NAVIGATION_FIXTURE` - Navigation menu structure
- `TABLE_FIXTURE` - Data table with interactive elements

#### Collection Templates
- `createButtonCollectionTemplate()` - Generate multiple buttons
- `createInputCollectionTemplate()` - Generate multiple inputs

#### Wait and Assertion Templates
- `WAIT_CONDITIONS` - Common wait patterns
- `ASSERTION_TEMPLATES` - Reusable assertion patterns

### 3. Browser Test Base (`browser-test-base.ts`)

#### BrowserTestBase Class
```typescript
class BrowserTestBase {
  async setup()      // Initialize browser environment
  async teardown()   // Clean up resources
  async takeScreenshot(name) // Capture screenshots
  async navigateTo(url) // Navigate with retry logic
  async waitForElement(selector) // Wait for elements
}
```

#### Utility Functions
```typescript
createBrowserTest(config) // Factory function
BrowserTestUtils.createTestPage() // Standard test page
```

## Usage Examples

### Basic Element Interaction Test

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createBrowserTest, BrowserTestUtils } from '../test-utils/browser-test-base.js';
import { createElement, performClick, BUTTON_FIXTURES } from './utils/element-interaction-helpers.js';

describe('Element Interaction Example', () => {
  let browserTest;

  beforeEach(async () => {
    browserTest = createBrowserTest({ headless: true });
    await browserTest.setup();
    await BrowserTestUtils.createTestPage(browserTest);
  });

  afterEach(async () => {
    await browserTest.teardown();
  });

  it('should create and interact with a button', async () => {
    // Create a button using fixtures
    const button = await createElement(browserTest.context.page, {
      ...BUTTON_FIXTURES.primary,
      id: 'test-button',
      text: 'Click Me',
      parent: '.container'
    });

    // Perform click interaction with validation
    const result = await performClick(
      browserTest.context.page,
      '#test-button',
      { captureBeforeState: true, waitForStable: true }
    );

    expect(result.success).toBe(true);
  });
});
```

### Form Testing Example

```typescript
import { createTestForm, fillForm, FORM_FIXTURES } from './utils/element-interaction-helpers.js';

it('should create and fill a form', async () => {
  // Create a form using fixtures
  const { form, fields } = await createTestForm(browserTest.context.page, {
    ...FORM_FIXTURES.contactForm,
    parent: '.container'
  });

  // Fill the form
  const formData = {
    '#contact-form-name': 'John Doe',
    '#contact-form-subject': 'Test Subject',
    '#contact-form-message': 'This is a test message'
  };

  const result = await fillForm(
    browserTest.context.page,
    '#contact-form',
    formData,
    { validateEach: true }
  );

  expect(result.success).toBe(true);
});
```

### State Management Example

```typescript
import { getElementState, compareElementStates } from './utils/element-interaction-helpers.js';

it('should track element state changes', async () => {
  // Get initial state
  const initialState = await getElementState(browserTest.context.page, '#test-element');

  // Perform some interaction that changes the element
  await performClick(browserTest.context.page, '#modify-button');

  // Get updated state
  const updatedState = await getElementState(browserTest.context.page, '#test-element');

  // Compare states
  const comparison = compareElementStates(initialState, updatedState);

  expect(comparison.changed).toBe(true);
  expect(comparison.differences).toContain('text:');
});
```

### Visual Testing Example

```typescript
import { takeScreenshot } from './utils/test-helpers.js';

it('should capture screenshots for visual verification', async () => {
  // Set up test page with elements
  await createElement(browserTest.context.page, NAVIGATION_FIXTURE);

  // Take screenshot
  const screenshotPath = await takeScreenshot(
    browserTest.context.page,
    'navigation-test',
    browserTest.context.tempDir
  );

  expect(screenshotPath).toBeDefined();
});
```

## Configuration

### Vitest Configuration (`vitest.config.ts`)

```typescript
export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['**/*.test.ts', '**/*.integration.test.ts'],
    testTimeout: 60000,
    hookTimeout: 30000,
    setupFiles: ['./setup.ts'],
    pool: 'forks',
    poolOptions: {
      forks: {
        maxForks: 2,
        minForks: 1,
      },
    },
  },
});
```

### Browser Configuration

```typescript
const DEFAULT_CONFIG = {
  backend: 'playwright',
  browserType: 'chromium',
  headless: process.env.CI === 'true',
  viewport: { width: 1280, height: 720 },
  timeout: 30000,
};
```

## Advanced Features

### Wait Conditions

```typescript
// Multiple wait conditions
await waitForConditions(page, '#element', [
  { condition: 'visible', timeout: 5000 },
  { condition: 'enabled', timeout: 5000 },
  { condition: 'stable', timeout: 2000 },
  { condition: 'text-contains', value: 'Expected Text' }
]);
```

### Element Assertions

```typescript
// Single element assertion
await assertElement(page, {
  selector: '#button',
  type: 'text',
  expected: 'Button Text'
});

// Multiple element assertions
await assertElements(page, [
  {
    selector: '#input1',
    type: 'attribute',
    attribute: 'value',
    expected: 'test value'
  },
  {
    selector: '#button1',
    type: 'state',
    property: 'visible',
    expected: true
  }
]);
```

### Performance Testing

```typescript
it('should handle large element collections efficiently', async () => {
  const startTime = Date.now();

  // Create 20 elements
  const buttons = await createElementCollection(page, {
    tag: 'button',
    baseId: 'perf-btn',
    count: 20,
    parent: '.container'
  });

  const duration = Date.now() - startTime;

  expect(buttons).toHaveLength(20);
  expect(duration).toBeLessThan(5000); // Complete within 5 seconds
});
```

## NPM Scripts

```bash
# Run all browser integration tests
npm run test:browser-integration

# Run with coverage reporting
npm run test:browser-integration:coverage

# Run in watch mode for development
npm run test:browser-integration:watch

# Run specific infrastructure tests
npm run test:browser-infrastructure

# Validate infrastructure
npm run validate:browser-infrastructure
```

## Error Handling

The infrastructure includes comprehensive error handling:

### Graceful Failures
- Non-existent elements return null states instead of throwing
- Timeout handling with configurable retry logic
- Network failure simulation and recovery
- Resource cleanup on test failures

### Debugging Support
- Detailed error messages with context
- Console message capture during tests
- Screenshot capture on failures
- Performance metrics for optimization

## Best Practices

### 1. Test Organization
```typescript
describe('Feature Name', () => {
  describe('Specific Scenario', () => {
    it('should perform specific action', async () => {
      // Test implementation
    });
  });
});
```

### 2. Resource Management
```typescript
beforeEach(async () => {
  browserTest = createBrowserTest({ headless: true });
  await browserTest.setup();
});

afterEach(async () => {
  await browserTest.teardown(); // Always cleanup
});
```

### 3. State Validation
```typescript
// Always capture state before and after interactions
const beforeState = await getElementState(page, selector);
await performAction();
const afterState = await getElementState(page, selector);
const changes = compareElementStates(beforeState, afterState);
```

### 4. Robust Interactions
```typescript
// Use options for reliable interactions
await performClick(page, selector, {
  waitForStable: true,
  scrollIntoView: true,
  timeout: 10000
});
```

## Troubleshooting

### Common Issues

1. **Element Not Found**
   ```typescript
   // Always wait for elements
   await waitForConditions(page, selector, [
     { condition: 'visible', timeout: 10000 }
   ]);
   ```

2. **Timing Issues**
   ```typescript
   // Use stable conditions for dynamic content
   await waitForConditions(page, selector, [
     { condition: 'stable', timeout: 5000 }
   ]);
   ```

3. **Flaky Tests**
   ```typescript
   // Add retry logic for unreliable operations
   await performClick(page, selector, {
     retries: 3,
     delay: 1000
   });
   ```

## Extension Points

### Custom Elements
```typescript
// Extend createElement for custom elements
const customElement = await createElement(page, {
  tag: 'custom-component',
  attributes: { 'data-test': 'custom' },
  styles: { customProperty: 'value' }
});
```

### Custom Fixtures
```typescript
// Create application-specific fixtures
export const CUSTOM_FIXTURES = {
  myComponent: {
    tag: 'div',
    className: 'my-component',
    // ... configuration
  }
};
```

### Custom Assertions
```typescript
// Extend assertion system
await assertElement(page, {
  selector: '#element',
  type: 'custom',
  customValidator: (element) => {
    // Custom validation logic
    return element.hasSpecialProperty();
  }
});
```

## Conclusion

The APEX Element Interaction Test Infrastructure provides a comprehensive, production-ready solution for DOM element testing. It combines robust browser automation with flexible utilities, comprehensive fixtures, and powerful assertion capabilities to enable thorough testing of web application interfaces.

Key benefits:
- **Complete Coverage**: All element interaction patterns supported
- **Type Safety**: Full TypeScript integration
- **Reliability**: Robust error handling and retry logic
- **Performance**: Optimized for large-scale testing
- **Maintainability**: Clean, documented, extensible code
- **CI/CD Ready**: Headless testing with artifact collection

The infrastructure is ready for immediate use and can be extended to meet specific application testing requirements.