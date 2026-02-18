# Hover and Focus Test Infrastructure

This directory contains comprehensive testing infrastructure for hover and focus interactions in browser automation tests.

## 🎯 Overview

The hover and focus test infrastructure provides advanced capabilities for testing complex user interactions in web applications. It's built on top of Playwright and Vitest, offering precise control over mouse movements, focus management, and accessibility validation.

## 🚀 Quick Start

### Running Tests

```bash
# Run all browser integration tests
npm run test:browser-integration

# Run specific hover/focus validation test
npm run test:browser-integration hover-focus-validation.integration.test.ts

# Run with coverage
npm run test:browser-integration:coverage

# Watch mode for development
npm run test:browser-integration:watch
```

### Basic Usage Example

```typescript
import { createHoverFocusHelpers } from './utils/hover-focus-test-helpers';
import { createMouseEventSimulator } from './utils/mouse-event-simulator';
import { createFocusEventHelpers } from './utils/focus-event-helpers';

// In your test
const { hover, focus } = createHoverFocusHelpers(page);
const mouseSimulator = createMouseEventSimulator(page);
const focusHelpers = createFocusEventHelpers(page);

// Test hover interactions
await hover.hover('#my-button', { delay: 200 });

// Test focus management
await focus.focusSequence(['#input1', '#input2', '#input3']);

// Test tooltip
await hover.testTooltipInteraction('#trigger', '#tooltip');

// Test accessibility
const result = await focusHelpers.validateFocusAccessibility('#form-field');
```

## 📁 Infrastructure Components

### Core Files

- **`setup.ts`** - Browser test configuration and global setup
- **`vitest.config.ts`** - Test framework configuration
- **`hover-focus-validation.integration.test.ts`** - Comprehensive validation test

### Utility Modules

#### `utils/hover-focus-test-helpers.ts`
Advanced hover and focus utilities with precise control:
- Hover event simulation with customizable positioning
- Focus management for complex form interactions
- Event tracking and state validation
- Tooltip and dropdown interaction testing

#### `utils/mouse-event-simulator.ts`
Complex mouse interaction patterns:
- Smooth mouse movement with easing functions
- Drag and drop simulation
- Geometric patterns (circles, squares, spirals, zigzags)
- Multi-element hover sequences
- Click accuracy testing

#### `utils/focus-event-helpers.ts`
Comprehensive focus management and accessibility testing:
- Focus accessibility validation with WCAG compliance
- Tab order and keyboard navigation testing
- Focus trapping for modals and containers
- Focus-within and focus-visible state testing
- Screen reader simulation support

### Support Files

- **`utils/test-helpers.ts`** - Common test utilities
- **`utils/element-interaction-helpers.ts`** - Element interaction utilities
- **`fixtures/`** - Test data and common scenarios

## 🛠 Testing Capabilities

### Hover Interactions

```typescript
// Basic hover with options
await hover.hover('#element', {
  position: { x: 0.5, y: 0.5 },  // Center of element
  delay: 300,
  triggerEvents: true
});

// Validate hover state changes
const result = await hover.validateHoverStateChanges('#button', {
  background: {
    initial: 'rgb(0, 122, 204)',
    hover: 'rgb(0, 90, 158)'
  },
  transform: {
    initial: 'none',
    hover: 'scale(1.05)'
  }
});

// Test tooltip interactions
const tooltipResult = await hover.testTooltipInteraction(
  '#trigger',
  '#tooltip',
  {
    showDelay: 300,
    hideDelay: 200,
    position: 'top'
  }
);
```

### Mouse Event Patterns

```typescript
// Circular hover pattern
await mouseSimulator.hoverPattern('#element', {
  pattern: 'circle',
  size: 60,
  steps: 8,
  stepDelay: 100
});

// Drag and drop
await mouseSimulator.dragAndDrop('#source', '#target', {
  startDelay: 100,
  dragDelay: 200,
  modifiers: { ctrl: true }
});

// Hover sequence across elements
await mouseSimulator.hoverSequence([
  '#element1',
  '#element2',
  '#element3'
], {
  delay: 200,
  smoothTransition: true
});
```

### Focus Management

```typescript
// Focus sequence with validation
await focus.focusSequence(['#input1', '#input2'], {
  delay: 200,
  validate: true
});

// Accessibility validation
const validation = await focusHelpers.validateFocusAccessibility('#input', {
  mustHaveLabel: true,
  mustBeKeyboardAccessible: true,
  mustHaveFocusIndicator: true
});

// Tab order validation
const tabResult = await focusHelpers.validateTabOrder(
  '#form',
  ['input1', 'input2', 'button'],
  { testReverse: true }
);
```

### Focus Trapping

```typescript
// Test modal focus trapping
const trapResult = await focusHelpers.testFocusTrap('#modal', {
  testEscapeAttempts: true,
  expectedFirstFocus: 'modal-input'
});

// Keyboard navigation testing
const navResult = await focusHelpers.testKeyboardNavigation('#container', {
  keys: ['Tab', 'Tab', 'Shift+Tab'],
  expectedBehavior: {
    'Tab': 'second-input',
    'Shift+Tab': 'first-input'
  }
});
```

### Event Tracking

```typescript
// Track focus events during actions
const events = await focus.trackFocusEvents(async () => {
  await page.fill('#input1', 'test');
  await page.keyboard.press('Tab');
  await page.fill('#input2', 'data');
}, {
  includeRelatedTarget: true,
  captureStyles: true
});

// Track mouse events
const mouseTracker = await trackMouseEvents(page);
await mouseTracker.startTracking();
// ... perform mouse actions
const events = await mouseTracker.stopTracking();
```

## 🔧 Configuration

### Browser Configuration

The infrastructure supports multiple browsers and configurations:

```typescript
const config: BrowserTestConfig = {
  backend: 'playwright',
  browserType: 'chromium',  // 'firefox' | 'webkit'
  headless: false,          // for debugging
  viewport: { width: 1280, height: 720 },
  slowMo: 100              // slow down for observation
};
```

### Test Environment Variables

```bash
# Run tests in headless mode
BROWSER_TEST_HEADLESS=true npm run test:browser-integration

# Use specific browser
BROWSER_TYPE=firefox npm run test:browser-integration

# Enable debug mode
DEBUG=true npm run test:browser-integration
```

## 📋 Acceptance Criteria Validation

The infrastructure validates the following acceptance criteria:

✅ **Test Configuration**: Comprehensive Vitest + Playwright setup
✅ **Testing Framework**: Production-ready framework with proper tooling
✅ **Mouse Event Utilities**: Advanced hover, click, and pattern simulation
✅ **Focus Event Utilities**: Complete focus management and navigation testing
✅ **Sample Tests**: Working examples and validation tests
✅ **Accessibility Support**: WCAG compliance validation utilities
✅ **Event Tracking**: Real-time interaction monitoring
✅ **Cross-browser Support**: Multi-browser compatibility testing

## 🧪 Test Examples

### Basic Hover Test
```typescript
it('should handle hover interactions', async () => {
  await page.setContent(`<button id="btn">Hover me</button>`);
  const { hover } = createHoverFocusHelpers(page);

  await hover.hover('#btn', { delay: 200 });
  // Button is now hovered, test state changes
});
```

### Focus Accessibility Test
```typescript
it('should validate form accessibility', async () => {
  await page.setContent(`
    <label for="email">Email</label>
    <input id="email" type="email" required>
  `);

  const focusHelpers = createFocusEventHelpers(page);
  const result = await focusHelpers.validateFocusAccessibility('#email');

  expect(result.isValid).toBe(true);
  expect(result.accessibilityScore).toBeGreaterThan(75);
});
```

### Modal Focus Trap Test
```typescript
it('should trap focus in modal', async () => {
  // Setup modal HTML
  await page.setContent(modalHTML);

  const focusHelpers = createFocusEventHelpers(page);

  // Open modal
  await page.click('#open-modal');

  // Test focus trapping
  const result = await focusHelpers.testFocusTrap('#modal');

  expect(result.isTrapped).toBe(true);
  expect(result.trapBoundaries.forward).toBe(true);
  expect(result.trapBoundaries.backward).toBe(true);
});
```

## 🐛 Debugging

### Screenshot Capture
Screenshots are automatically captured on test failures and saved to the temp directory.

### Console Logging
The infrastructure provides detailed console output for debugging:
- Event tracking with timestamps
- State changes and transitions
- Accessibility validation results
- Performance metrics

### Debug Mode
Run tests with debug mode for slower execution and detailed logging:
```bash
DEBUG=true npm run test:browser-integration
```

## 🔮 Advanced Features

### Custom Event Patterns
Create custom mouse movement patterns:
```typescript
await mouseSimulator.hoverPattern('#element', {
  pattern: 'custom',
  customPoints: [
    { x: 0, y: 0 },
    { x: 50, y: 25 },
    { x: 0, y: 50 }
  ]
});
```

### Performance Testing
The infrastructure includes performance metrics for all interactions:
```typescript
const result = await hover.hover('#element');
console.log(`Hover completed in ${result.duration}ms`);
```

### Multi-browser Testing
Run tests across different browsers:
```typescript
const browsers = ['chromium', 'firefox', 'webkit'];
for (const browserType of browsers) {
  const browser = await createBrowser({ browserType });
  // Run tests
}
```

## 📚 Best Practices

1. **Use proper selectors**: Prefer IDs and data attributes over classes
2. **Wait for stability**: Use appropriate delays for animations
3. **Test incrementally**: Break complex interactions into smaller tests
4. **Validate accessibility**: Always test keyboard navigation and screen reader support
5. **Clean up state**: Use beforeEach hooks to reset browser state
6. **Capture screenshots**: Enable automatic screenshot capture for debugging

## 🤝 Contributing

When adding new test utilities:

1. Follow the existing naming conventions
2. Include TypeScript types for all parameters
3. Add JSDoc comments for public APIs
4. Write comprehensive tests for new utilities
5. Update this README with new capabilities

## 📄 License

This testing infrastructure is part of the APEX project and follows the same MIT license.