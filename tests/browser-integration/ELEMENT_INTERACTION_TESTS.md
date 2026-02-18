# Element Interaction Integration Tests

This directory contains comprehensive integration tests for element interaction functionality using real browser automation via Playwright.

## Test Files

### `comprehensive-element-interaction.integration.test.ts`
The main comprehensive test suite covering all element interaction scenarios:

#### Click Interactions
- Basic button clicks with event tracking
- Clicks with modifier keys (Ctrl, Shift, Alt)
- Double-click interactions
- Right-click (context menu) interactions
- Disabled element click handling
- Nested element click propagation
- Coordinate-based clicking

#### Type and Input Interactions
- Text input typing with validation
- Email input with format validation
- Number input with constraint validation
- Textarea multi-line input
- Keyboard event handling during typing
- Input clearing and replacement

#### Hover and Focus Interactions
- Hover state changes (mouseenter/mouseleave)
- Focus and blur event handling
- Tab navigation between focusable elements
- Nested element hover effects

#### Select Dropdown Interactions
- Single select dropdown selection
- Multi-select dropdown selection with multiple options
- Keyboard navigation in select dropdowns
- Option deselection in multi-select

#### Checkbox and Radio Button Interactions
- Checkbox toggle interactions
- Multiple independent checkboxes
- Radio button group mutual exclusivity
- Keyboard interaction with form controls

#### Dynamic Element Interactions
- Interaction with dynamically created elements
- Elements that change visibility state
- Handling elements that move or change position
- Waiting for elements to become interactable

#### Error Handling and Edge Cases
- Invalid selector handling
- Rapid sequential interactions
- Elements that become detached from DOM
- Timeout scenarios
- Overlapping elements and z-index issues
- Elements outside viewport

#### Accessibility and Keyboard Navigation
- Full keyboard navigation support
- Enter and Space key activation
- Arrow key navigation in radio groups
- Skip links and landmark navigation

### `element-interaction-validation.test.ts`
A simplified validation test to ensure the test infrastructure works correctly:
- Basic browser automation setup
- Simple click and input interactions
- Test page loading verification

## Test Infrastructure

### Browser Configuration
- Uses Playwright Chromium for browser automation
- Headless mode in CI, visible mode in development
- Consistent viewport size (1280x720)
- Reduced motion for consistent interactions

### Test Page
Each test uses a dynamically generated HTML page with:
- All necessary interactive elements (buttons, inputs, selects, etc.)
- Event logging infrastructure to track interactions
- CSS styling for hover effects and visual states
- JavaScript event handlers for comprehensive interaction tracking

### Key Testing Features

#### Interaction Logging
- Global `window.interactionLog` array tracks all interactions
- Detailed event information including modifier keys
- Real-time log display for debugging

#### Element State Tracking
- Click counters on interactive elements
- Dynamic element creation and removal
- State changes (visibility, position, enabled/disabled)

#### Comprehensive Coverage
- **25+ test scenarios** covering all major interaction types
- Real browser events (not just mocked interactions)
- Error conditions and edge cases
- Accessibility compliance verification

## Running the Tests

```bash
# Run all browser integration tests
npm run test:browser-integration

# Run with watch mode for development
npm run test:browser-integration:watch

# Run with coverage reporting
npm run test:browser-integration:coverage

# Run just the validation test
vitest run tests/browser-integration/element-interaction-validation.test.ts
```

## Test Configuration

The tests use the browser integration vitest config located at `tests/browser-integration/vitest.config.ts` which provides:
- Node environment for browser automation
- Extended timeouts for browser operations
- Sequential test execution to avoid resource conflicts
- Coverage reporting for browser automation code

## Acceptance Criteria Verification

These tests verify all acceptance criteria for element interaction:

✅ **Click Interactions**
- Basic clicks on buttons, links, and custom elements
- Modified clicks (Ctrl+click, Shift+click, etc.)
- Double-click and right-click handling
- Disabled and hidden element interaction

✅ **Type Interactions**
- All input types (text, email, number, password, date, etc.)
- Textarea multi-line input
- Keyboard event handling
- Input validation and constraints

✅ **Hover and Focus**
- Hover state changes with proper event firing
- Focus management and blur events
- Tab navigation between elements
- Nested element hover handling

✅ **Form Elements**
- Select dropdown interactions (single and multi-select)
- Checkbox independent toggling
- Radio button group mutual exclusivity
- Keyboard navigation in form controls

✅ **Dynamic Elements**
- Interaction with elements created at runtime
- Elements that change state or position
- Waiting for elements to become available
- Handling of removed/detached elements

✅ **Error Handling**
- Graceful handling of invalid selectors
- Timeout scenarios
- Rapid interaction sequences
- Edge cases like overlapping elements

✅ **Accessibility**
- Full keyboard navigation support
- ARIA compliance and screen reader support
- Skip links and landmark navigation
- Proper focus management

## Browser Compatibility

Currently tested with:
- Chromium (via Playwright)

Future expansion planned for:
- Firefox
- WebKit/Safari

## Debugging

Tests capture screenshots on failure and store them in the `test-artifacts` directory for debugging failed interactions.

## Implementation Notes

- Tests use real browser automation, not jsdom simulation
- All interactions are verified through actual DOM events
- Comprehensive error handling ensures reliable test execution
- Event logging provides detailed debugging information
- Tests are designed to be deterministic and reliable in CI environments