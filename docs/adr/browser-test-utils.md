# Browser Permission Test Utilities

Comprehensive testing utilities for browser permission and automation testing in APEX. This documentation covers installation, setup, and usage of all browser test utility categories.

## Table of Contents

1. [Installation & Setup](#installation--setup)
2. [API Reference](#api-reference)
   - [Mock Page Objects](#mock-page-objects)
   - [DOM Builders](#dom-builders)
   - [URL Generators](#url-generators)
   - [Assertions](#assertions)
   - [Test Pages](#test-pages)
   - [Validators](#validators)
   - [Performance](#performance)
   - [Mock Scenarios](#mock-scenarios)
3. [Usage Examples](#usage-examples)
4. [Common Testing Patterns](#common-testing-patterns)
5. [Troubleshooting](#troubleshooting)

## Installation & Setup

### Prerequisites

- Node.js 18+
- TypeScript 5+
- Vitest (for running tests)
- Playwright (for browser automation)

### Installation

```bash
# Install the APEX browser package
npm install @apexcli/browser

# For development/testing dependencies
npm install -D vitest playwright @types/node
```

### Basic Setup

```typescript
import {
  createMockPage,
  assertNavigationState,
  buildFormHtml,
  generateTestUrl
} from '@apexcli/browser/test-utils';

// In your test files
import { describe, it, expect } from 'vitest';
```

### TypeScript Configuration

Ensure your `tsconfig.json` includes:

```json
{
  "compilerOptions": {
    "moduleResolution": "NodeNext",
    "module": "NodeNext",
    "target": "ES2022",
    "strict": true
  },
  "include": ["src/**/*", "tests/**/*"]
}
```

## API Reference

### Mock Page Objects

Lightweight mock page factories for unit tests (simpler than full MockBrowserSession).

#### Core Types

```typescript
interface MockPageObject {
  url: string;
  title: string;
  content: string;
  elements: Map<string, MockElementState>;
  consoleMessages: Array<{ level: string; text: string }>;
  errors: string[];
  cookies: Array<{ name: string; value: string; domain?: string }>;
  localStorage: Map<string, string>;
}

interface MockElementState {
  selector: string;
  visible: boolean;
  enabled: boolean;
  text: string;
  value: string;
  attributes: Record<string, string>;
  tagName: string;
  children: MockElementState[];
}
```

#### Functions

##### `createMockPage(overrides?: Partial<MockPageObject>): MockPageObject`

Creates a basic mock page object with defaults.

```typescript
// Basic page
const page = createMockPage();

// Custom page
const page = createMockPage({
  url: 'https://example.com',
  title: 'My Test Page',
  content: '<div>Custom content</div>'
});
```

##### `createMockElement(selector: string, overrides?: Partial<MockElementState>): MockElementState`

Creates a mock DOM element with default properties.

```typescript
const button = createMockElement('#submit-btn', {
  tagName: 'BUTTON',
  text: 'Submit',
  enabled: true
});
```

##### `createMockPageWithForm(config: FormConfig): MockPageObject`

Creates a mock page containing a form.

```typescript
const formPage = createMockPageWithForm({
  action: '/submit',
  method: 'POST',
  fields: [
    { name: 'email', type: 'email', label: 'Email', required: true },
    { name: 'password', type: 'password', label: 'Password', required: true }
  ]
});
```

##### `createMockPageWithNavigation(links: NavLink[]): MockPageObject`

Creates a mock page with navigation links.

```typescript
const navPage = createMockPageWithNavigation([
  { href: '/home', text: 'Home' },
  { href: '/about', text: 'About' },
  { href: '/contact', text: 'Contact' }
]);
```

##### Utility Functions

```typescript
// Add element to existing page
addElementToMockPage(page, element);

// Add console messages
addConsoleMessage(page, 'info', 'Page loaded successfully');

// Add errors
addError(page, 'Network request failed');

// Set cookies
setCookie(page, { name: 'session', value: 'abc123' });

// Set localStorage
setLocalStorage(page, 'theme', 'dark');
```

### DOM Builders

Build HTML strings representing common DOM structures for testing.

#### Core Types

```typescript
interface TableConfig {
  headers: string[];
  rows: string[][];
  caption?: string;
  className?: string;
  striped?: boolean;
}

interface ModalConfig {
  id?: string;
  title: string;
  content: string;
  hasCloseButton?: boolean;
  hasOverlay?: boolean;
  className?: string;
}

interface CardConfig {
  title: string;
  content: string;
  imageUrl?: string;
  actions?: Array<{ text: string; href?: string; className?: string }>;
  className?: string;
}
```

#### Functions

##### `buildFormHtml(config: FormConfig): string`

Builds a complete HTML form.

```typescript
const formHtml = buildFormHtml({
  action: '/login',
  method: 'POST',
  fields: [
    { name: 'username', type: 'text', label: 'Username', required: true },
    { name: 'password', type: 'password', label: 'Password', required: true }
  ],
  submitLabel: 'Log In'
});
```

##### `buildTableHtml(config: TableConfig): string`

Builds an HTML table with headers and rows.

```typescript
const tableHtml = buildTableHtml({
  headers: ['Name', 'Email', 'Role'],
  rows: [
    ['John Doe', 'john@example.com', 'Admin'],
    ['Jane Smith', 'jane@example.com', 'User']
  ],
  caption: 'User List',
  striped: true
});
```

##### `buildModalHtml(config: ModalConfig): string`

Builds a modal dialog structure.

```typescript
const modalHtml = buildModalHtml({
  id: 'confirmation-modal',
  title: 'Confirm Action',
  content: 'Are you sure you want to delete this item?',
  hasCloseButton: true,
  hasOverlay: true
});
```

##### `buildCardHtml(config: CardConfig): string`

Builds a card component.

```typescript
const cardHtml = buildCardHtml({
  title: 'Product Card',
  content: 'This is a great product with amazing features.',
  imageUrl: '/images/product.jpg',
  actions: [
    { text: 'Buy Now', href: '/purchase', className: 'btn-primary' },
    { text: 'Learn More', href: '/details', className: 'btn-secondary' }
  ]
});
```

##### Other Builder Functions

```typescript
// Navigation menu
buildNavigationHtml(links: NavLink[]): string

// Lists (ul/ol)
buildListHtml(items: string[], type: 'ul' | 'ol'): string

// Complete page layout
buildCompletePage(config: { title: string; body: string; head?: string }): string

// Layout structures
buildLayoutHtml(config: { header?: string; main: string; footer?: string }): string

// Breadcrumbs
buildBreadcrumbHtml(items: Array<{ text: string; href?: string }>): string

// Pagination
buildPaginationHtml(config: { currentPage: number; totalPages: number; baseUrl: string }): string

// Card grid
buildCardGridHtml(cards: CardConfig[]): string
```

### URL Generators

Generate test URLs and patterns for browser navigation testing.

#### Types

```typescript
interface TestUrlOptions {
  protocol?: 'http' | 'https';
  domain?: string;
  port?: number;
  path?: string;
  query?: Record<string, string>;
  fragment?: string;
}
```

#### Functions

##### `generateTestUrl(options?: TestUrlOptions): string`

Generates a test URL with specified options.

```typescript
// Basic URL
const url1 = generateTestUrl(); // 'https://test.example.com'

// Custom URL
const url2 = generateTestUrl({
  protocol: 'http',
  domain: 'localhost',
  port: 3000,
  path: '/api/users',
  query: { page: '1', limit: '10' },
  fragment: 'section1'
}); // 'http://localhost:3000/api/users?page=1&limit=10#section1'
```

##### `generateTestUrls(count: number, options?: TestUrlOptions): string[]`

Generates multiple test URLs.

```typescript
const urls = generateTestUrls(5, { path: '/page' });
// Returns 5 URLs with paths like '/page/1', '/page/2', etc.
```

##### `createUrlPattern(template: string): (params: Record<string, string>) => string`

Creates a URL pattern function.

```typescript
const urlBuilder = createUrlPattern('/users/:id/posts/:postId');
const url = urlBuilder({ id: '123', postId: '456' }); // '/users/123/posts/456'
```

##### Predefined URL Sets

```typescript
// Common test URLs
testUrls.simple        // Basic test URLs
testUrls.withPaths     // URLs with various paths
testUrls.withQuery     // URLs with query parameters
testUrls.localhost     // Localhost URLs for dev testing

// URL validation helpers
urlValidators.isValidUrl(url: string): boolean
urlValidators.hasHttps(url: string): boolean
urlValidators.hasLocalhost(url: string): boolean

// URL utility functions
urlUtils.addQuery(url: string, params: Record<string, string>): string
urlUtils.removeQuery(url: string, keys: string[]): string
urlUtils.getBaseDomain(url: string): string

// Common URL scenarios
urlScenarios.ecommerce  // E-commerce site URLs
urlScenarios.blog       // Blog/CMS URLs
urlScenarios.dashboard  // Dashboard/admin URLs
urlScenarios.api        // REST API endpoints
```

### Assertions

Framework-agnostic assertion helpers for verifying browser state.

#### Types

```typescript
interface AssertionResult {
  pass: boolean;
  message: string;
  actual?: unknown;
  expected?: unknown;
}

interface NavigationState {
  url: string | RegExp;
  title: string | RegExp;
  loaded: boolean;
}

interface BrowserStateExpectation {
  url?: string | RegExp;
  title?: string | RegExp;
  hasErrors?: boolean;
  elementExists?: string[];
  elementVisible?: string[];
  consoleMessages?: Array<{ level: string; text: string | RegExp }>;
}
```

#### Functions

##### `assertNavigationState(page: MockPageObject, expected: Partial<NavigationState>): AssertionResult`

Asserts that navigation state matches expectations.

```typescript
const result = assertNavigationState(page, {
  url: 'https://example.com/dashboard',
  title: /Dashboard/,
  loaded: true
});

if (!result.pass) {
  throw new Error(result.message);
}
```

##### `assertPageContent(page: MockPageObject, expectedContent: string | RegExp): AssertionResult`

Asserts that page content contains expected text or matches pattern.

```typescript
assertPageContent(page, 'Welcome to our site');
assertPageContent(page, /Welcome .+ our site/);
```

##### Element Assertions

```typescript
// Check if element exists
assertElementExists(page: MockPageObject, selector: string): AssertionResult

// Check if element is visible
assertElementVisible(page: MockPageObject, selector: string): AssertionResult

// Check element text content
assertElementText(page: MockPageObject, selector: string, expected: string | RegExp): AssertionResult

// Check element attributes
assertElementAttributes(page: MockPageObject, selector: string, attributes: Record<string, string>): AssertionResult

// Check element tag name
assertElementTagName(page: MockPageObject, selector: string, expected: string): AssertionResult

// Check if element is enabled
assertElementEnabled(page: MockPageObject, selector: string, expected: boolean): AssertionResult
```

##### Browser State Assertions

```typescript
// Assert no JavaScript errors occurred
assertNoErrors(page: MockPageObject): AssertionResult

// Assert console contains specific messages
assertConsoleContains(page: MockPageObject, level: string, text: string | RegExp): AssertionResult

// Assert overall browser state
assertBrowserState(page: MockPageObject, expectations: BrowserStateExpectation): AssertionResult

// Assert cookie values
assertCookie(page: MockPageObject, name: string, expectedValue?: string): AssertionResult

// Assert localStorage values
assertLocalStorage(page: MockPageObject, key: string, expectedValue?: string): AssertionResult
```

### Test Pages

Migrated utilities for creating complete test page scenarios.

```typescript
class TestPages {
  // Create common page types
  static createLoginPage(): MockPageObject
  static createDashboardPage(): MockPageObject
  static createFormPage(fields: FormField[]): MockPageObject
  static createErrorPage(errorCode: number): MockPageObject
  static createLoadingPage(): MockPageObject

  // Create pages with specific features
  static createPageWithModal(modalConfig: ModalConfig): MockPageObject
  static createPageWithTable(tableConfig: TableConfig): MockPageObject
  static createPageWithNavigation(links: NavLink[]): MockPageObject
}

class TestDataGenerators {
  // Generate test data
  static generateUserData(count: number): Array<{ name: string; email: string; role: string }>
  static generateFormData(fields: FormField[]): Record<string, string>
  static generateTableData(headers: string[], rows: number): { headers: string[]; rows: string[][] }
}
```

### Validators

Screenshot and visual validation utilities.

```typescript
class ScreenshotValidators {
  // Validate screenshot properties
  static validateScreenshot(buffer: Buffer): { isValid: boolean; width?: number; height?: number; format?: string }

  // Compare screenshots (if comparison library available)
  static compareScreenshots(buffer1: Buffer, buffer2: Buffer): { similar: boolean; difference: number }

  // Validate screenshot dimensions
  static validateDimensions(buffer: Buffer, expected: { width: number; height: number }): boolean
}
```

### Performance

Performance monitoring utilities for browser tests.

```typescript
class PerformanceMonitor {
  // Monitor page load performance
  static measurePageLoad(page: MockPageObject): { loadTime: number; resourceCount: number }

  // Monitor element interaction performance
  static measureInteraction(action: () => Promise<void>): Promise<{ duration: number; success: boolean }>

  // Memory usage tracking
  static trackMemoryUsage(): { used: number; total: number; percentage: number }
}
```

### Mock Scenarios

Pre-built mock scenarios for common testing situations.

```typescript
class MockScenarios {
  // E-commerce scenarios
  static createShoppingCartScenario(): { page: MockPageObject; actions: Array<() => void> }
  static createCheckoutScenario(): { pages: MockPageObject[]; flow: Array<() => void> }

  // Authentication scenarios
  static createLoginScenario(credentials: { username: string; password: string }): MockPageObject
  static createLogoutScenario(): MockPageObject

  // Form submission scenarios
  static createFormSubmissionScenario(formData: Record<string, string>): { page: MockPageObject; submitAction: () => void }

  // Error scenarios
  static create404Scenario(): MockPageObject
  static create500Scenario(): MockPageObject
  static createNetworkErrorScenario(): MockPageObject
}
```

## Usage Examples

### Basic Page Testing

```typescript
import { describe, it, expect } from 'vitest';
import {
  createMockPage,
  assertNavigationState,
  assertPageContent,
  assertElementExists
} from '@apexcli/browser/test-utils';

describe('Page Testing', () => {
  it('should verify page navigation', () => {
    const page = createMockPage({
      url: 'https://example.com/dashboard',
      title: 'Dashboard - Example App',
      content: '<div id="dashboard"><h1>Dashboard</h1></div>'
    });

    const navResult = assertNavigationState(page, {
      url: /example\.com\/dashboard/,
      title: /Dashboard/
    });

    expect(navResult.pass).toBe(true);

    const contentResult = assertPageContent(page, '<h1>Dashboard</h1>');
    expect(contentResult.pass).toBe(true);
  });
});
```

### Form Testing

```typescript
import { createMockPageWithForm, buildFormHtml, assertElementExists } from '@apexcli/browser/test-utils';

describe('Form Testing', () => {
  it('should create and validate form page', () => {
    const formPage = createMockPageWithForm({
      action: '/login',
      method: 'POST',
      fields: [
        { name: 'username', type: 'text', label: 'Username', required: true },
        { name: 'password', type: 'password', label: 'Password', required: true }
      ],
      submitLabel: 'Login'
    });

    // Verify form elements exist
    const usernameExists = assertElementExists(formPage, 'input[name="username"]');
    const passwordExists = assertElementExists(formPage, 'input[name="password"]');
    const submitExists = assertElementExists(formPage, 'button[type="submit"]');

    expect(usernameExists.pass).toBe(true);
    expect(passwordExists.pass).toBe(true);
    expect(submitExists.pass).toBe(true);
  });
});
```

### URL Testing

```typescript
import { generateTestUrl, generateTestUrls, urlValidators } from '@apexcli/browser/test-utils';

describe('URL Testing', () => {
  it('should generate valid test URLs', () => {
    const baseUrl = generateTestUrl();
    expect(urlValidators.isValidUrl(baseUrl)).toBe(true);

    const apiUrl = generateTestUrl({
      path: '/api/v1/users',
      query: { limit: '10', offset: '20' }
    });

    expect(apiUrl).toContain('/api/v1/users');
    expect(apiUrl).toContain('limit=10');
    expect(apiUrl).toContain('offset=20');
  });

  it('should generate multiple URLs', () => {
    const urls = generateTestUrls(5, { path: '/page' });
    expect(urls).toHaveLength(5);
    expect(urls[0]).toContain('/page');
  });
});
```

### Complete Browser Testing Workflow

```typescript
import {
  createMockPage,
  createMockElement,
  addElementToMockPage,
  assertBrowserState,
  TestPages,
  MockScenarios
} from '@apexcli/browser/test-utils';

describe('Complete Browser Workflow', () => {
  it('should test login flow', () => {
    // Start with login page
    const loginPage = TestPages.createLoginPage();

    // Verify initial state
    const initialState = assertBrowserState(loginPage, {
      url: /login/,
      hasErrors: false,
      elementExists: ['#username', '#password', '#submit']
    });
    expect(initialState.pass).toBe(true);

    // Create dashboard page after "login"
    const dashboardPage = TestPages.createDashboardPage();

    // Verify navigation
    const dashboardState = assertBrowserState(dashboardPage, {
      url: /dashboard/,
      title: /Dashboard/,
      elementVisible: ['#sidebar', '#main-content']
    });
    expect(dashboardState.pass).toBe(true);
  });

  it('should test error scenarios', () => {
    const errorPage = MockScenarios.create404Scenario();

    const errorState = assertBrowserState(errorPage, {
      title: /404/,
      elementExists: ['#error-message']
    });
    expect(errorState.pass).toBe(true);
  });
});
```

## Common Testing Patterns

### 1. Page Object Pattern

Create reusable page objects for consistent testing:

```typescript
class LoginPageObject {
  private page: MockPageObject;

  constructor() {
    this.page = TestPages.createLoginPage();
  }

  fillUsername(username: string): this {
    const element = this.page.elements.get('#username');
    if (element) {
      element.value = username;
    }
    return this;
  }

  fillPassword(password: string): this {
    const element = this.page.elements.get('#password');
    if (element) {
      element.value = password;
    }
    return this;
  }

  submit(): MockPageObject {
    // Return "next page" after form submission
    return TestPages.createDashboardPage();
  }

  assertValid(): void {
    const result = assertBrowserState(this.page, {
      url: /login/,
      elementExists: ['#username', '#password', '#submit']
    });
    expect(result.pass).toBe(true);
  }
}
```

### 2. Assertion Helpers

Create custom assertion functions for your domain:

```typescript
function assertFormIsValid(page: MockPageObject, formSelector: string = 'form') {
  const formExists = assertElementExists(page, formSelector);
  const submitExists = assertElementExists(page, `${formSelector} button[type="submit"]`);
  const noErrors = assertNoErrors(page);

  expect(formExists.pass).toBe(true);
  expect(submitExists.pass).toBe(true);
  expect(noErrors.pass).toBe(true);
}

function assertUserIsLoggedIn(page: MockPageObject) {
  const dashboardState = assertBrowserState(page, {
    url: /dashboard|home/,
    elementExists: ['#user-menu', '#logout-btn'],
    consoleMessages: [{ level: 'info', text: /logged in/i }]
  });
  expect(dashboardState.pass).toBe(true);
}
```

### 3. Data-Driven Testing

Use generated data for comprehensive testing:

```typescript
describe('Form Validation', () => {
  const formFields = [
    { name: 'email', type: 'email', label: 'Email', required: true },
    { name: 'phone', type: 'text', label: 'Phone', required: false },
    { name: 'age', type: 'number', label: 'Age', required: true }
  ];

  it.each([
    { email: 'test@example.com', phone: '123-456-7890', age: '25', valid: true },
    { email: 'invalid-email', phone: '', age: '25', valid: false },
    { email: 'test@example.com', phone: '', age: '', valid: false },
  ])('should validate form data: %o', ({ email, phone, age, valid }) => {
    const formPage = createMockPageWithForm({ fields: formFields });

    // Fill form
    const emailEl = formPage.elements.get('input[name="email"]');
    const phoneEl = formPage.elements.get('input[name="phone"]');
    const ageEl = formPage.elements.get('input[name="age"]');

    if (emailEl) emailEl.value = email;
    if (phoneEl) phoneEl.value = phone;
    if (ageEl) ageEl.value = age;

    // Validate
    const isFormValid = valid; // In real test, this would check form validation logic
    expect(isFormValid).toBe(valid);
  });
});
```

### 4. Scenario-Based Testing

Test complete user journeys:

```typescript
describe('E-commerce User Journey', () => {
  it('should complete purchase flow', () => {
    // 1. Start on home page
    const homePage = createMockPage({
      url: 'https://shop.example.com',
      title: 'Online Shop'
    });

    // 2. Navigate to product page
    const productPage = createMockPage({
      url: 'https://shop.example.com/products/widget',
      title: 'Amazing Widget'
    });

    assertNavigationState(productPage, {
      url: /products\/widget/,
      title: /Amazing Widget/
    });

    // 3. Add to cart
    const cartPage = MockScenarios.createShoppingCartScenario().page;

    // 4. Checkout
    const checkoutScenario = MockScenarios.createCheckoutScenario();
    checkoutScenario.pages.forEach((page, index) => {
      const stepResult = assertBrowserState(page, {
        hasErrors: false,
        url: new RegExp(`checkout/step-${index + 1}`)
      });
      expect(stepResult.pass).toBe(true);
    });
  });
});
```

### 5. Performance Testing

Monitor page performance during tests:

```typescript
describe('Performance Testing', () => {
  it('should load page within performance budget', async () => {
    const page = TestPages.createDashboardPage();

    const loadMetrics = PerformanceMonitor.measurePageLoad(page);

    expect(loadMetrics.loadTime).toBeLessThan(2000); // 2 seconds
    expect(loadMetrics.resourceCount).toBeLessThan(50);

    const memoryUsage = PerformanceMonitor.trackMemoryUsage();
    expect(memoryUsage.percentage).toBeLessThan(80); // 80% memory usage
  });

  it('should handle multiple interactions efficiently', async () => {
    const page = createMockPage();

    const interactions = Array.from({ length: 10 }, (_, i) =>
      async () => {
        // Simulate click interaction
        addElementToMockPage(page, createMockElement(`#button-${i}`, {
          tagName: 'BUTTON',
          text: `Button ${i}`
        }));
      }
    );

    for (const interaction of interactions) {
      const metrics = await PerformanceMonitor.measureInteraction(interaction);
      expect(metrics.duration).toBeLessThan(100); // 100ms per interaction
      expect(metrics.success).toBe(true);
    }
  });
});
```

## Troubleshooting

### Common Issues

#### 1. TypeScript Compilation Errors

**Problem**: Cannot resolve test utility imports
```typescript
// ❌ This might fail
import { createMockPage } from '@apexcli/browser';
```

**Solution**: Use the correct import path
```typescript
// ✅ Correct import
import { createMockPage } from '@apexcli/browser/test-utils';
```

**Configuration**: Ensure your `tsconfig.json` has correct module resolution:
```json
{
  "compilerOptions": {
    "moduleResolution": "NodeNext",
    "allowSyntheticDefaultImports": true,
    "esModuleInterop": true
  }
}
```

#### 2. Mock Element State Issues

**Problem**: Element assertions fail unexpectedly
```typescript
// ❌ Element state may not be set correctly
const element = createMockElement('#button');
const result = assertElementVisible(page, '#button'); // Fails
```

**Solution**: Ensure element is properly added to page
```typescript
// ✅ Add element to page before assertions
const page = createMockPage();
const element = createMockElement('#button', { visible: true });
addElementToMockPage(page, element);

const result = assertElementVisible(page, '#button'); // Passes
```

#### 3. URL Generation Issues

**Problem**: Generated URLs don't match expected format
```typescript
// ❌ May produce unexpected results
const url = generateTestUrl({ path: 'api/users' }); // Missing leading slash
```

**Solution**: Use proper path formatting
```typescript
// ✅ Proper path formatting
const url = generateTestUrl({ path: '/api/users' }); // With leading slash
```

#### 4. Assertion Result Handling

**Problem**: Assertions don't fail tests properly
```typescript
// ❌ Assertion result ignored
const result = assertPageContent(page, 'Expected content');
// Test continues even if assertion failed
```

**Solution**: Check assertion results and throw errors
```typescript
// ✅ Proper assertion handling
const result = assertPageContent(page, 'Expected content');
if (!result.pass) {
  throw new Error(`Assertion failed: ${result.message}`);
}

// Or use with test framework
expect(result.pass).toBe(true);
```

#### 5. Memory Issues with Large Test Suites

**Problem**: Tests consume too much memory with many mock objects
```typescript
// ❌ Creating too many mock objects
const pages = Array.from({ length: 1000 }, () => createMockPage());
```

**Solution**: Use test setup/teardown to manage memory
```typescript
// ✅ Proper resource management
describe('Large Test Suite', () => {
  let currentPage: MockPageObject;

  beforeEach(() => {
    currentPage = createMockPage();
  });

  afterEach(() => {
    // Clear references
    currentPage = null as any;
  });

  // Tests use currentPage...
});
```

### Performance Optimization

#### 1. Reduce DOM Builder Complexity

For simple tests, use basic HTML strings instead of complex builders:

```typescript
// ❌ Overkill for simple tests
const complexHtml = buildCompletePage({
  title: 'Test',
  body: buildFormHtml({
    fields: [{ name: 'input', type: 'text', label: 'Input' }]
  })
});

// ✅ Simple HTML for basic tests
const simpleHtml = '<form><input name="input" type="text"></form>';
```

#### 2. Reuse Mock Objects

Create factory functions for commonly used mock objects:

```typescript
// ✅ Reusable factory
function createBasicLoginPage() {
  return createMockPage({
    url: 'https://example.com/login',
    title: 'Login',
    content: buildFormHtml({
      fields: [
        { name: 'username', type: 'text', label: 'Username' },
        { name: 'password', type: 'password', label: 'Password' }
      ]
    })
  });
}
```

#### 3. Selective URL Generation

Only generate URLs you actually need:

```typescript
// ❌ Generating unnecessary URLs
const allUrls = generateTestUrls(100);

// ✅ Generate only what you need
const requiredUrls = generateTestUrls(5, { path: '/api' });
```

### Debugging Tips

#### 1. Use Console Logging

Add debug logging to understand test flow:

```typescript
const page = createMockPage();
console.log('Page created:', page.url, page.title);

const result = assertPageContent(page, 'test');
console.log('Assertion result:', result);
```

#### 2. Inspect Mock Object State

Check the internal state of mock objects:

```typescript
const page = createMockPageWithForm({ fields: [...] });
console.log('Page elements:', Array.from(page.elements.keys()));
console.log('Page content:', page.content);
console.log('Console messages:', page.consoleMessages);
```

#### 3. Test Assertions Individually

Break down complex assertions:

```typescript
// ❌ Complex assertion that's hard to debug
const complexResult = assertBrowserState(page, {
  url: /dashboard/,
  title: /Dashboard/,
  hasErrors: false,
  elementExists: ['#nav', '#main', '#footer'],
  elementVisible: ['#nav', '#main']
});

// ✅ Individual assertions for easier debugging
const urlResult = assertNavigationState(page, { url: /dashboard/ });
const titleResult = assertNavigationState(page, { title: /Dashboard/ });
const errorsResult = assertNoErrors(page);
const navExists = assertElementExists(page, '#nav');
const mainExists = assertElementExists(page, '#main');

console.log('URL:', urlResult.pass, urlResult.message);
console.log('Title:', titleResult.pass, titleResult.message);
// ... etc
```

### Getting Help

#### Documentation Resources

- [APEX Core Documentation](../core/README.md)
- [Browser Package API Reference](./api-reference.md)
- [Testing Best Practices](./testing-guide.md)

#### Community Support

- GitHub Issues: [APEX Repository](https://github.com/apex-labs/apex)
- Discussions: [GitHub Discussions](https://github.com/apex-labs/apex/discussions)

#### Common Patterns Repository

Check the [examples directory](./examples/) for:
- Real-world test scenarios
- Integration test examples
- Performance testing patterns
- Advanced usage examples

---

This documentation covers the comprehensive set of browser permission test utilities available in APEX. For additional examples and advanced usage patterns, refer to the test files in the `__tests__` directory of each utility category.