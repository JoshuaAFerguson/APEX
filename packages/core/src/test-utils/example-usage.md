# Test Utilities - Usage Examples

This document demonstrates how to use the various test utilities available in this package, including sensitive pattern detection and browser test utilities.

## Basic Usage

```typescript
import { containsSensitiveInfo } from '@apexcli/core/test-utils';

// Test that error messages don't leak sensitive information
describe('Error handling', () => {
  it('should not expose sensitive information in error messages', () => {
    const errorMessage = getErrorMessage();

    // Verify no sensitive info is exposed
    expect(containsSensitiveInfo(errorMessage)).toBe(false);
  });
});
```

## Category-specific Checks

```typescript
import {
  containsFilePaths,
  containsApiKeys,
  containsDbConnectionStrings,
  containsTokenPatterns
} from '@apexcli/core/test-utils';

describe('Specific pattern detection', () => {
  it('should not expose file paths', () => {
    const message = getFileErrorMessage();
    expect(containsFilePaths(message)).toBe(false);
  });

  it('should not expose API keys', () => {
    const message = getAuthErrorMessage();
    expect(containsApiKeys(message)).toBe(false);
  });
});
```

## Pattern Analysis

```typescript
import { detectSensitivePatterns } from '@apexcli/core/test-utils';

describe('Pattern analysis', () => {
  it('should provide detailed pattern breakdown', () => {
    const message = getSomeErrorMessage();
    const patterns = detectSensitivePatterns(message);

    // Check each category
    expect(patterns.filePaths).toEqual([]);
    expect(patterns.apiKeys).toEqual([]);
    expect(patterns.dbConnectionStrings).toEqual([]);
    expect(patterns.tokens).toEqual([]);
  });
});
```

## Direct Pattern Access

```typescript
import { SENSITIVE_PATTERNS } from '@apexcli/core/test-utils';

// Use regex patterns directly
const hasFilePath = SENSITIVE_PATTERNS.FILE_PATHS.unix.test(message);
const hasApiKey = SENSITIVE_PATTERNS.API_KEYS.openai.test(message);
```

# Browser Test Utilities

## Importing Browser Utilities

```typescript
import {
  // Mock page utilities
  createMockPage,
  createMockElement,
  createMockPageWithForm,

  // DOM building utilities
  buildFormHtml,
  buildTableHtml,

  // URL generation
  generateTestUrl,
  testUrls,

  // Assertions
  assertNavigationState,
  assertElementExists,
  assertBrowserState
} from '@apexcli/core/test-utils';
```

## Creating Mock Page Objects

### Basic page
```typescript
const page = createMockPage({
  url: 'https://example.com/test',
  title: 'Test Page'
});
```

### Page with form
```typescript
const formPage = createMockPageWithForm({
  id: 'login-form',
  fields: [
    { name: 'email', type: 'email', label: 'Email', required: true },
    { name: 'password', type: 'password', label: 'Password', required: true }
  ],
  submitLabel: 'Log In'
});
```

## Generating Test URLs

```typescript
// Basic URL
const url = generateTestUrl(); // http://localhost:3000/

// Custom URL
const apiUrl = generateTestUrl({
  protocol: 'https',
  hostname: 'api.example.com',
  path: '/v1/users',
  query: { limit: '10', page: '1' }
});

// Predefined URLs
const validUrls = testUrls.valid;
const errorUrls = testUrls.invalid;
```

## Building DOM Structures

```typescript
// Form HTML
const formHtml = buildFormHtml({
  action: '/submit',
  method: 'POST',
  fields: [
    { name: 'name', type: 'text', label: 'Name', required: true }
  ]
});

// Table HTML
const tableHtml = buildTableHtml({
  headers: ['Name', 'Email', 'Role'],
  rows: [
    ['John Doe', 'john@example.com', 'Admin'],
    ['Jane Smith', 'jane@example.com', 'User']
  ]
});
```

## Making Assertions

```typescript
// Assert navigation state
const result = assertNavigationState(page, {
  url: 'https://example.com/expected-page',
  title: /Test Page/,
  loaded: true
});

if (!result.pass) {
  console.error(result.message);
}

// Assert element exists and is visible
const elementResult = assertElementVisible(page, '#submit-button');

// Comprehensive browser state assertion
const stateResult = assertBrowserState(page, {
  url: 'https://example.com',
  hasErrors: false,
  elementExists: ['#header', '#main-content'],
  elementVisible: ['#welcome-message'],
  localStorage: { 'user_id': '123' }
});
```