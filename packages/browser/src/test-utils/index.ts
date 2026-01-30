/**
 * @apexcli/browser - Test Utils Barrel Export
 *
 * Re-exports all test utilities from sub-modules
 */

// Mock Page Objects
export {
  createMockPage,
  createMockElement,
  createMockPageWithForm,
  createMockPageWithNavigation,
  addElementToMockPage,
  addConsoleMessage,
  addError,
  setCookie,
  setLocalStorage
} from './mock-page-objects.js';

export type {
  MockElementState,
  MockPageObject,
  FormConfig,
  FormField,
  NavLink
} from './mock-page-objects.js';

// DOM Builders
export {
  buildFormHtml,
  buildTableHtml,
  buildNavigationHtml,
  buildListHtml,
  buildModalHtml,
  buildCardGridHtml,
  buildCardHtml,
  buildCompletePage,
  buildLayoutHtml,
  buildBreadcrumbHtml,
  buildPaginationHtml
} from './dom-builders.js';

export type {
  TableConfig,
  ModalConfig,
  CardConfig
} from './dom-builders.js';

// URL Generators
export {
  generateTestUrl,
  generateTestUrls,
  createUrlPattern,
  testUrls,
  urlValidators,
  urlUtils,
  urlScenarios
} from './url-generators.js';

export type {
  TestUrlOptions
} from './url-generators.js';

// Assertions
export {
  assertNavigationState,
  assertPageContent,
  assertElementExists,
  assertElementVisible,
  assertElementText,
  assertNoErrors,
  assertConsoleContains,
  assertBrowserState,
  assertElementAttributes,
  assertElementTagName,
  assertElementEnabled,
  assertCookie,
  assertLocalStorage
} from './assertions.js';

export type {
  AssertionResult,
  NavigationState,
  BrowserStateExpectation
} from './assertions.js';

// Test Pages (migrated utilities)
export {
  TestPages,
  TestDataGenerators
} from './test-pages.js';

// Validators (migrated utilities)
export {
  ScreenshotValidators
} from './validators.js';

// Performance (migrated utilities)
export {
  PerformanceMonitor
} from './performance.js';

// Mock Scenarios (migrated utilities)
export {
  MockScenarios
} from './mock-scenarios.js';