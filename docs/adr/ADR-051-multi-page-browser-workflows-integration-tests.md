# ADR-051: Multi-Page Browser Workflows Integration Tests

## Status

Accepted

## Date

2025-02-06

## Context

APEX requires comprehensive integration tests for multi-page browser workflows to validate the browser automation capabilities that AI agents rely on for complex testing scenarios. Browser-based tasks often involve navigating through multiple pages, maintaining state, handling redirects, and simulating realistic user journeys.

The acceptance criteria require tests covering:
1. Multi-step navigation flows
2. State persistence across pages (localStorage, sessionStorage, cookies)
3. Handling redirects (301/302)
4. Back/forward navigation
5. Complex user journey simulations

## Decision

We have designed and implemented a comprehensive integration test architecture for multi-page browser workflows with the following structure:

### Test Architecture

```
tests/integration/
├── multi-page-browser-workflows.integration.test.ts   # Primary integration tests
├── setup.ts                                           # Shared test utilities
└── ...

packages/browser/src/__tests__/
├── multi-page-workflows.integration.test.ts           # Package-level tests
└── ...
```

### Test Categories

#### 1. Multi-Step Navigation Flows
- **Linear Navigation Workflow**: Tests sequential page navigation through a multi-step process (e.g., Step 1 → Step 2 → Step 3)
- **Branching Navigation Flows**: Tests conditional navigation paths with user-selected routes (e.g., Admin Portal vs User Portal)
- **Form-Based Navigation**: Tests form submission triggering page navigation

#### 2. State Persistence Across Pages
- **localStorage Persistence**: Validates data stored in localStorage survives navigation
- **sessionStorage Persistence**: Validates session data persists during same-tab navigation
- **Cookie Persistence**: Tests cookie creation, modification, and deletion across pages

#### 3. Redirect Handling (301/302)
- **301 Permanent Redirects**: Tests `window.location.replace()` behavior simulating permanent redirects
- **302 Temporary Redirects**: Tests `window.location.href` behavior for temporary redirects
- **Redirect Chains**: Tests multi-hop redirect scenarios (3+ redirects in sequence)

#### 4. Back/Forward Navigation
- **Browser History Navigation**: Tests `goBack()` and `goForward()` methods
- **State Preservation**: Validates form data and input values persist during history navigation
- **Multi-Level Navigation**: Tests navigation back multiple levels in history

#### 5. Complex User Journey Simulations
- **E-commerce Flow**: Complete shopping journey (browse → add to cart → checkout → confirmation)
- **Authentication Flow**: Login, dashboard access, profile navigation, and logout
- **Form Wizard Flow**: Multi-step form with validation and back navigation

### Key Architectural Components

#### BrowserSession Interface
The tests utilize the `BrowserSession` class from `@apexcli/browser` package which provides:

```typescript
interface BrowserSession {
  // Navigation
  navigate(url: string, options?: NavigationOptions): Promise<BrowserActionResult<string>>;
  goBack(options?: NavigationOptions): Promise<BrowserActionResult<string | null>>;
  goForward(options?: NavigationOptions): Promise<BrowserActionResult<string | null>>;
  waitForNavigation(options?: WaitForNavigationOptions): Promise<BrowserActionResult<string>>;

  // Interaction
  click(selector: string | ElementSelector, options?: ClickOptions): Promise<BrowserActionResult<void>>;
  type(selector: string | ElementSelector, text: string, options?: TypeOptions): Promise<BrowserActionResult<void>>;

  // State Access
  evaluate<T>(script: string | (() => T)): Promise<BrowserActionResult<T>>;
  getText(selector: string | ElementSelector): Promise<BrowserActionResult<string>>;
  getTitle(): Promise<BrowserActionResult<string>>;
}
```

#### BrowserTool Integration
For orchestrator-level integration tests, the `BrowserTool` class wraps `BrowserSession` with:
- Permission management integration
- Task context binding
- Event emission for orchestration

### Test Infrastructure

#### Setup Utilities (tests/integration/setup.ts)
- `createTempDir()`: Creates isolated temporary directories for test databases
- `cleanupApexDir()`: Cleans up APEX configuration directories
- `cleanupDatabaseFiles()`: Removes SQLite database files
- Global test context management for resource cleanup

#### Test Isolation
Each test suite:
1. Creates fresh temporary directories
2. Initializes isolated TaskStore and PermissionStore
3. Configures BrowserTool with test-specific permissions
4. Cleans up all resources in afterEach/afterAll hooks

### Data URI Test Strategy

Tests use `data:text/html` URIs to create self-contained test pages, enabling:
- No external server dependencies
- Deterministic test behavior
- Fast test execution
- Full control over page content and scripts

Example:
```typescript
const testHtml = `
  <html>
  <head><title>Test Page</title></head>
  <body>
    <button id="action" onclick="handleClick()">Click Me</button>
    <script>
      function handleClick() {
        localStorage.setItem('clicked', 'true');
        window.location.href = 'data:text/html,...';
      }
    </script>
  </body>
  </html>
`;
await session.navigate(`data:text/html,${encodeURIComponent(testHtml)}`);
```

## Consequences

### Positive
- Comprehensive coverage of all acceptance criteria
- Isolated tests that don't depend on external services
- Validates real browser automation behavior via Playwright
- Supports both package-level and integration-level testing
- Tests can run in parallel with proper isolation

### Negative
- Data URI approach doesn't test real HTTP redirect status codes
- Complex nested template strings in test HTML can be hard to maintain
- Browser tests have longer execution times than unit tests

### Neutral
- Tests require Playwright browser binaries to be installed
- Test files are relatively large due to embedded HTML templates

## Implementation Notes

### Test Timeout Configuration
Complex user journey tests require extended timeouts:
```typescript
it('should handle complete e-commerce workflow', async () => {
  // Test implementation
}, 40000); // 40 second timeout
```

### Permission Configuration
Browser operations require explicit permission grants:
```typescript
await permissionManager.grantPermission(testTaskId, 'browser', 'navigate');
await permissionManager.grantPermission(testTaskId, 'browser', 'click');
await permissionManager.grantPermission(testTaskId, 'browser', 'type');
// ... additional permissions
```

### Acceptance Criteria Validation

| Criterion | Test Coverage |
|-----------|--------------|
| Multi-step navigation flows | `describe('Multi-Step Navigation Flows')` |
| State persistence across pages | `describe('State Persistence Across Pages')` |
| Handling redirects (301/302) | `describe('Redirect Handling (301/302)')` |
| Back/forward navigation | `describe('Back/Forward Navigation')` |
| Complex user journey simulations | `describe('Complex User Journey Simulations')` |

## Related ADRs

- ADR-042: Agent Panel Visualization Technical Design
- ADR-045: Error Recovery Integration Tests

## References

- [Playwright Documentation](https://playwright.dev/docs/intro)
- [APEX Browser Package](../packages/browser/README.md)
- [Integration Test Setup](../tests/integration/setup.ts)
