# Browser State Fixtures API Reference

This document provides a comprehensive API reference for the browser state fixtures module in APEX. The browser state fixtures provide predefined browser states for common testing scenarios, enabling consistent and reliable browser automation testing.

## Overview

The browser state fixtures module exports a collection of factory functions and utilities to create consistent browser state objects for testing purposes. These fixtures simulate various browser scenarios including authentication states, error conditions, loading states, and network conditions.

## Table of Contents

- [Installation](#installation)
- [Basic Usage](#basic-usage)
- [API Reference](#api-reference)
  - [browserFixtures](#browserfixtures)
    - [cleanState()](#cleanstate)
    - [loggedInPage()](#loggedinpage)
    - [errorPage()](#errorpage)
    - [loadingPage()](#loadingpage)
    - [offlinePage()](#offlinepage)
    - [permissionDeniedPage()](#permissiondeniedpage)
    - [fromScenario()](#fromscenario)
  - [BrowserState Interface](#browserstate-interface)
  - [TestScenario Type](#testscenario-type)
  - [browserHelpers](#browserhelpers)
    - [addConsoleMessage()](#addconsolemessage)
    - [addNetworkRequest()](#addnetworkrequest)
    - [setLocalStorage()](#setlocalstorage)
    - [setSessionStorage()](#setsessionstorage)
    - [addCookie()](#addcookie)
    - [navigateTo()](#navigateto)
    - [startLoading()](#startloading)
    - [finishLoading()](#finishloading)
    - [setError()](#seterror)
    - [setAuthenticated()](#setauthenticated)
    - [clearBrowserData()](#clearbrowserdata)
  - [BrowserStateBuilder Class](#browserstatebuilder-class)
    - [constructor()](#constructor)
    - [withUrl()](#withurl)
    - [withTitle()](#withtitle)
    - [withLoading()](#withloading)
    - [withError()](#witherror)
    - [withAuth()](#withauth)
    - [withLocalStorage()](#withlocalstorage-1)
    - [withSessionStorage()](#withsessionstorage-1)
    - [withConsoleMessages()](#withconsolemessages)
    - [withNetworkRequests()](#withnetworkrequests)
    - [build()](#build)
  - [createBrowserState()](#createbrowserstate)
  - [Comparison: Helpers vs Builder](#comparison-helpers-vs-builder)
- [Examples](#examples)

## Installation

The browser state fixtures are part of the `@apex/core` package:

```typescript
import { browserFixtures, BrowserState, TestScenario } from '@apex/core/test-fixtures';
```

## Basic Usage

```typescript
import { browserFixtures } from '@apex/core/test-fixtures';

// Create a clean initial state
const cleanState = browserFixtures.cleanState();

// Create a logged-in user state
const loggedInState = browserFixtures.loggedInPage();

// Create a state with custom overrides
const customState = browserFixtures.loggedInPage({
  url: 'https://custom.example.com',
  localStorage: { theme: 'dark' }
});
```

## API Reference

### browserFixtures

A collection of factory functions that create predefined browser state objects for common testing scenarios.

#### cleanState()

Creates a clean initial browser state with no user data, representing a fresh browser start.

**Signature:**
```typescript
cleanState(overrides?: Partial<BrowserState>): BrowserState
```

**Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `overrides` | `Partial<BrowserState>` | `{}` | Optional properties to override in the default clean state |

**Return Type:** `BrowserState`

**Default Values:**
- `url`: `'about:blank'`
- `title`: `''`
- `isLoading`: `false`
- `hasError`: `false`
- `isAuthenticated`: `false`
- `localStorage`: `{}`
- `sessionStorage`: `{}`
- `cookies`: `[]`
- `consoleMessages`: `[]`
- `networkRequests`: `[]`

**Usage Example:**
```typescript
import { browserFixtures } from '@apex/core/test-fixtures';

// Basic clean state
const state = browserFixtures.cleanState();
expect(state.isAuthenticated).toBe(false);
expect(state.url).toBe('about:blank');

// Clean state with custom URL
const customState = browserFixtures.cleanState({
  url: 'https://example.com',
  title: 'Example Page'
});
```

#### loggedInPage()

Creates a browser state representing a logged-in user with authentication data and session information.

**Signature:**
```typescript
loggedInPage(overrides?: Partial<BrowserState>): BrowserState
```

**Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `overrides` | `Partial<BrowserState>` | `{}` | Optional properties to override in the default logged-in state |

**Return Type:** `BrowserState`

**Default Values:**
- `url`: `'https://app.apex.dev/dashboard'`
- `title`: `'APEX Dashboard'`
- `isLoading`: `false`
- `hasError`: `false`
- `isAuthenticated`: `true`
- `localStorage`: Contains auth token, user preferences, and session ID
- `sessionStorage`: Contains current project and active agents
- `cookies`: Contains authentication and CSRF tokens
- `consoleMessages`: Contains successful authentication logs
- `networkRequests`: Contains API calls for user profile and projects

**Usage Example:**
```typescript
import { browserFixtures } from '@apex/core/test-fixtures';

// Basic logged-in state
const state = browserFixtures.loggedInPage();
expect(state.isAuthenticated).toBe(true);
expect(state.localStorage['auth-token']).toBe('mock-jwt-token');

// Logged-in state with custom project
const customState = browserFixtures.loggedInPage({
  sessionStorage: {
    'current-project': '/users/john/my-custom-project'
  }
});
```

#### errorPage()

Creates a browser state representing an error condition (network error, 500 error, etc.).

**Signature:**
```typescript
errorPage(overrides?: Partial<BrowserState>): BrowserState
```

**Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `overrides` | `Partial<BrowserState>` | `{}` | Optional properties to override in the default error state |

**Return Type:** `BrowserState`

**Default Values:**
- `url`: `'https://app.apex.dev/error'`
- `title`: `'Error - APEX'`
- `isLoading`: `false`
- `hasError`: `true`
- `isAuthenticated`: `false` (errors often clear auth state)
- `localStorage`: Contains last error information
- `sessionStorage`: `{}`
- `cookies`: `[]`
- `consoleMessages`: Contains error messages and warnings
- `networkRequests`: Contains failed API requests with 500 status

**Usage Example:**
```typescript
import { browserFixtures } from '@apex/core/test-fixtures';

// Basic error state
const state = browserFixtures.errorPage();
expect(state.hasError).toBe(true);
expect(state.isAuthenticated).toBe(false);

// Custom error with specific error code
const customErrorState = browserFixtures.errorPage({
  localStorage: {
    'last-error': JSON.stringify({
      code: 404,
      message: 'Page Not Found'
    })
  }
});
```

#### loadingPage()

Creates a browser state representing a loading condition (initial load, navigation in progress).

**Signature:**
```typescript
loadingPage(overrides?: Partial<BrowserState>): BrowserState
```

**Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `overrides` | `Partial<BrowserState>` | `{}` | Optional properties to override in the default loading state |

**Return Type:** `BrowserState`

**Default Values:**
- `url`: `'https://app.apex.dev/loading'`
- `title`: `'Loading... - APEX'`
- `isLoading`: `true`
- `hasError`: `false`
- `isAuthenticated`: `false` (unknown during loading)
- `localStorage`: Contains loading start time
- `sessionStorage`: Contains navigation state
- `cookies`: `[]`
- `consoleMessages`: Contains loading progress messages
- `networkRequests`: Contains resource loading requests (bundle.js, styles.css)

**Usage Example:**
```typescript
import { browserFixtures } from '@apex/core/test-fixtures';

// Basic loading state
const state = browserFixtures.loadingPage();
expect(state.isLoading).toBe(true);
expect(state.title).toBe('Loading... - APEX');

// Loading state with custom progress
const customLoadingState = browserFixtures.loadingPage({
  sessionStorage: {
    'loading-progress': '75%'
  }
});
```

#### offlinePage()

Creates a browser state representing a network offline condition.

**Signature:**
```typescript
offlinePage(overrides?: Partial<BrowserState>): BrowserState
```

**Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `overrides` | `Partial<BrowserState>` | `{}` | Optional properties to override in the default offline state |

**Return Type:** `BrowserState`

**Default Values:**
- `url`: `'https://app.apex.dev/offline'`
- `title`: `'Offline - APEX'`
- `isLoading`: `false`
- `hasError`: `false` (not exactly an error, just offline)
- `isAuthenticated`: `false` (cannot verify when offline)
- `localStorage`: Contains offline mode flag, last online time, and cached data
- `sessionStorage`: `{}`
- `cookies`: `[]`
- `consoleMessages`: Contains network loss warnings and offline mode notifications
- `networkRequests`: `[]` (no requests when offline)

**Usage Example:**
```typescript
import { browserFixtures } from '@apex/core/test-fixtures';

// Basic offline state
const state = browserFixtures.offlinePage();
expect(state.localStorage['offline-mode']).toBe('true');
expect(state.networkRequests.length).toBe(0);

// Offline state with cached content
const customOfflineState = browserFixtures.offlinePage({
  localStorage: {
    'cached-content': JSON.stringify({
      lastSyncedProjects: ['project1', 'project2']
    })
  }
});
```

#### permissionDeniedPage()

Creates a browser state representing a permission denied condition (user lacks access to a resource).

**Signature:**
```typescript
permissionDeniedPage(overrides?: Partial<BrowserState>): BrowserState
```

**Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `overrides` | `Partial<BrowserState>` | `{}` | Optional properties to override in the default permission denied state |

**Return Type:** `BrowserState`

**Default Values:**
- `url`: `'https://app.apex.dev/access-denied'`
- `title`: `'Access Denied - APEX'`
- `isLoading`: `false`
- `hasError`: `false` (not a system error, just access denied)
- `isAuthenticated`: `true` (user is logged in but lacks permissions)
- `localStorage`: Contains auth token and access level information
- `sessionStorage`: Contains attempted resource path
- `cookies`: Contains authentication session cookie
- `consoleMessages`: Contains permission warnings and role information
- `networkRequests`: Contains failed API request with 403 status

**Usage Example:**
```typescript
import { browserFixtures } from '@apex/core/test-fixtures';

// Basic permission denied state
const state = browserFixtures.permissionDeniedPage();
expect(state.isAuthenticated).toBe(true);
expect(state.networkRequests[0].status).toBe(403);

// Permission denied for specific resource
const customPermissionState = browserFixtures.permissionDeniedPage({
  sessionStorage: {
    'attempted-resource': '/api/admin/users'
  },
  localStorage: {
    'user-role': 'editor'
  }
});
```

#### fromScenario()

Creates a browser state based on a predefined test scenario.

**Signature:**
```typescript
fromScenario(scenario: TestScenario, overrides?: Partial<BrowserState>): BrowserState
```

**Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `scenario` | `TestScenario` | N/A | The test scenario to create a state for |
| `overrides` | `Partial<BrowserState>` | `{}` | Optional properties to override in the scenario state |

**Return Type:** `BrowserState`

**Supported Scenarios:**
- `'clean-state'`: Creates a clean state (calls `cleanState()`)
- `'logged-in-user'`: Creates a logged-in state (calls `loggedInPage()`)
- `'error-state'`: Creates an error state (calls `errorPage()`)
- `'loading-state'`: Creates a loading state (calls `loadingPage()`)
- `'network-offline'`: Creates an offline state (calls `offlinePage()`)
- `'permission-denied'`: Creates a permission denied state (calls `permissionDeniedPage()`)

**Usage Example:**
```typescript
import { browserFixtures } from '@apex/core/test-fixtures';

// Create state from scenario
const state = browserFixtures.fromScenario('logged-in-user');
expect(state.isAuthenticated).toBe(true);

// Create state from scenario with overrides
const customState = browserFixtures.fromScenario('error-state', {
  url: 'https://custom.example.com/error'
});

// Use in parameterized tests
const scenarios: TestScenario[] = ['clean-state', 'logged-in-user', 'error-state'];
scenarios.forEach(scenario => {
  test(`should handle ${scenario}`, () => {
    const state = browserFixtures.fromScenario(scenario);
    // Test logic here
  });
});
```

### BrowserState Interface

Represents the complete state of a browser during testing.

```typescript
interface BrowserState {
  /** Current page URL */
  url: string;
  /** Page title */
  title: string;
  /** Loading state */
  isLoading: boolean;
  /** Error state */
  hasError: boolean;
  /** Authentication status */
  isAuthenticated: boolean;
  /** Local storage data */
  localStorage: Record<string, string>;
  /** Session storage data */
  sessionStorage: Record<string, string>;
  /** Cookies */
  cookies: Array<{
    name: string;
    value: string;
    domain?: string;
    path?: string;
  }>;
  /** Console messages */
  consoleMessages: Array<{
    type: 'log' | 'warn' | 'error' | 'info';
    message: string;
    timestamp: Date;
  }>;
  /** Network requests */
  networkRequests: Array<{
    url: string;
    method: string;
    status?: number;
    headers?: Record<string, string>;
  }>;
}
```

### TestScenario Type

Represents predefined test scenarios for browser state creation.

```typescript
type TestScenario =
  | 'clean-state'
  | 'logged-in-user'
  | 'error-state'
  | 'loading-state'
  | 'network-offline'
  | 'permission-denied'
  | 'file-not-found'
  | 'invalid-config';
```

### browserHelpers

The `browserHelpers` object provides pure, immutable utility functions for manipulating `BrowserState` objects. Each method returns a **new** `BrowserState` instance — the original state is never mutated.

**Import:**
```typescript
import { browserHelpers } from '@apex/core/test-fixtures';
```

#### addConsoleMessage()

Adds a console message entry (with auto-generated timestamp) to the browser state.

**Signature:**
```typescript
addConsoleMessage(state: BrowserState, type: 'log' | 'warn' | 'error' | 'info', message: string): BrowserState
```

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `state` | `BrowserState` | Yes | The current browser state |
| `type` | `'log' \| 'warn' \| 'error' \| 'info'` | Yes | Console message severity level |
| `message` | `string` | Yes | The console message text |

**Returns:** `BrowserState` — A new state with the message appended to `consoleMessages`

**Usage Example:**
```typescript
import { browserHelpers, browserFixtures } from '@apex/core/test-fixtures';

const state = browserHelpers.addConsoleMessage(
  browserFixtures.cleanState(),
  'error',
  'Uncaught TypeError: Cannot read property of undefined'
);

expect(state.consoleMessages).toHaveLength(1);
expect(state.consoleMessages[0].type).toBe('error');
expect(state.consoleMessages[0].timestamp).toBeInstanceOf(Date);
```

#### addNetworkRequest()

Adds a network request entry to the browser state.

**Signature:**
```typescript
addNetworkRequest(state: BrowserState, url: string, method?: string, status?: number, headers?: Record<string, string>): BrowserState
```

**Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `state` | `BrowserState` | — | The current browser state |
| `url` | `string` | — | The request URL |
| `method` | `string` | `'GET'` | HTTP method |
| `status` | `number` | `undefined` | Response status code |
| `headers` | `Record<string, string>` | `undefined` | Request headers |

**Returns:** `BrowserState` — A new state with the request appended to `networkRequests`

**Usage Example:**
```typescript
let state = browserFixtures.cleanState();

// Add a successful GET request
state = browserHelpers.addNetworkRequest(
  state,
  'https://api.example.com/users',
  'GET',
  200,
  { 'Content-Type': 'application/json' }
);

// Add a failed POST request
state = browserHelpers.addNetworkRequest(
  state,
  'https://api.example.com/login',
  'POST',
  401
);

expect(state.networkRequests).toHaveLength(2);
expect(state.networkRequests[0].status).toBe(200);
expect(state.networkRequests[1].status).toBe(401);
```

#### setLocalStorage()

Sets local storage data in the browser state.

**Signature:**
```typescript
setLocalStorage(state: BrowserState, key: string, value: string): BrowserState
```

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `state` | `BrowserState` | Yes | The current browser state |
| `key` | `string` | Yes | Local storage key |
| `value` | `string` | Yes | Local storage value |

**Returns:** `BrowserState` — A new state with the local storage data updated

**Usage Example:**
```typescript
let state = browserFixtures.cleanState();

state = browserHelpers.setLocalStorage(state, 'theme', 'dark');
state = browserHelpers.setLocalStorage(state, 'auth-token', 'jwt-token-123');

expect(state.localStorage['theme']).toBe('dark');
expect(state.localStorage['auth-token']).toBe('jwt-token-123');
```

#### setSessionStorage()

Sets session storage data in the browser state.

**Signature:**
```typescript
setSessionStorage(state: BrowserState, key: string, value: string): BrowserState
```

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `state` | `BrowserState` | Yes | The current browser state |
| `key` | `string` | Yes | Session storage key |
| `value` | `string` | Yes | Session storage value |

**Returns:** `BrowserState` — A new state with the session storage data updated

**Usage Example:**
```typescript
let state = browserFixtures.cleanState();

state = browserHelpers.setSessionStorage(state, 'current-tab', 'dashboard');
state = browserHelpers.setSessionStorage(state, 'temp-data', 'temp-value');

expect(state.sessionStorage['current-tab']).toBe('dashboard');
expect(state.sessionStorage['temp-data']).toBe('temp-value');
```

#### addCookie()

Adds a cookie to the browser state.

**Signature:**
```typescript
addCookie(state: BrowserState, name: string, value: string, options?: { domain?: string; path?: string }): BrowserState
```

**Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `state` | `BrowserState` | — | The current browser state |
| `name` | `string` | — | Cookie name |
| `value` | `string` | — | Cookie value |
| `options` | `{ domain?: string; path?: string }` | `{}` | Cookie options |
| `options.domain` | `string` | `'localhost'` | Cookie domain |
| `options.path` | `string` | `'/'` | Cookie path |

**Returns:** `BrowserState` — A new state with the cookie added to `cookies`

**Usage Example:**
```typescript
let state = browserFixtures.cleanState();

// Add a basic cookie
state = browserHelpers.addCookie(state, 'session-id', 'sess_123');

// Add a cookie with custom domain and path
state = browserHelpers.addCookie(
  state,
  'tracking-id',
  'track_456',
  { domain: 'example.com', path: '/analytics' }
);

expect(state.cookies).toHaveLength(2);
expect(state.cookies[0].name).toBe('session-id');
expect(state.cookies[1].domain).toBe('example.com');
```

#### navigateTo()

Simulates navigation to a new page by updating URL and optionally title.

**Signature:**
```typescript
navigateTo(state: BrowserState, url: string, title?: string): BrowserState
```

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `state` | `BrowserState` | Yes | The current browser state |
| `url` | `string` | Yes | The new page URL |
| `title` | `string` | No | The new page title (keeps current title if not provided) |

**Returns:** `BrowserState` — A new state with updated URL, title, and `isLoading: false`

**Usage Example:**
```typescript
let state = browserFixtures.cleanState();

// Navigate to a new page
state = browserHelpers.navigateTo(
  state,
  'https://app.example.com/dashboard',
  'Dashboard - Example App'
);

expect(state.url).toBe('https://app.example.com/dashboard');
expect(state.title).toBe('Dashboard - Example App');
expect(state.isLoading).toBe(false);
```

#### startLoading()

Simulates the start of a page load by setting `isLoading` to `true`.

**Signature:**
```typescript
startLoading(state: BrowserState): BrowserState
```

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `state` | `BrowserState` | Yes | The current browser state |

**Returns:** `BrowserState` — A new state with `isLoading: true`

**Usage Example:**
```typescript
let state = browserFixtures.cleanState();

state = browserHelpers.startLoading(state);
expect(state.isLoading).toBe(true);

// Simulate loading completion
state = browserHelpers.finishLoading(state);
expect(state.isLoading).toBe(false);
```

#### finishLoading()

Simulates the completion of a page load by setting `isLoading` to `false`.

**Signature:**
```typescript
finishLoading(state: BrowserState): BrowserState
```

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `state` | `BrowserState` | Yes | The current browser state |

**Returns:** `BrowserState` — A new state with `isLoading: false`

**Usage Example:**
```typescript
let state = browserFixtures.loadingPage(); // isLoading: true

state = browserHelpers.finishLoading(state);
expect(state.isLoading).toBe(false);
```

#### setError()

Simulates an error occurring by setting the error state.

**Signature:**
```typescript
setError(state: BrowserState, hasError?: boolean): BrowserState
```

**Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `state` | `BrowserState` | — | The current browser state |
| `hasError` | `boolean` | `true` | Whether an error has occurred |

**Returns:** `BrowserState` — A new state with updated error status

**Usage Example:**
```typescript
let state = browserFixtures.cleanState();

// Set error state
state = browserHelpers.setError(state, true);
expect(state.hasError).toBe(true);

// Clear error state
state = browserHelpers.setError(state, false);
expect(state.hasError).toBe(false);
```

#### setAuthenticated()

Simulates user authentication status change.

**Signature:**
```typescript
setAuthenticated(state: BrowserState, isAuthenticated: boolean): BrowserState
```

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `state` | `BrowserState` | Yes | The current browser state |
| `isAuthenticated` | `boolean` | Yes | The new authentication status |

**Returns:** `BrowserState` — A new state with updated authentication status

**Usage Example:**
```typescript
let state = browserFixtures.cleanState(); // isAuthenticated: false

// Simulate user login
state = browserHelpers.setAuthenticated(state, true);
expect(state.isAuthenticated).toBe(true);

// Simulate user logout
state = browserHelpers.setAuthenticated(state, false);
expect(state.isAuthenticated).toBe(false);
```

#### clearBrowserData()

Clears all browser data (localStorage, sessionStorage, cookies, console messages, network requests).

**Signature:**
```typescript
clearBrowserData(state: BrowserState): BrowserState
```

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `state` | `BrowserState` | Yes | The current browser state |

**Returns:** `BrowserState` — A new state with all browser data cleared

**Usage Example:**
```typescript
let state = browserFixtures.loggedInPage(); // Has auth data, cookies, etc.

state = browserHelpers.clearBrowserData(state);

expect(state.localStorage).toEqual({});
expect(state.sessionStorage).toEqual({});
expect(state.cookies).toEqual([]);
expect(state.consoleMessages).toEqual([]);
expect(state.networkRequests).toEqual([]);
```

### BrowserStateBuilder Class

The `BrowserStateBuilder` class provides a fluent API for creating complex browser states using method chaining. It's ideal for building states with multiple properties or when constructing states dynamically.

**Import:**
```typescript
import { BrowserStateBuilder, createBrowserState } from '@apex/core/test-fixtures';
```

#### constructor()

Creates a new browser state builder with optional initial state.

**Signature:**
```typescript
constructor(initialState?: Partial<BrowserState>): BrowserStateBuilder
```

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `initialState` | `Partial<BrowserState>` | No | Initial state properties |

**Usage Example:**
```typescript
// Start with clean state
const builder1 = new BrowserStateBuilder();

// Start with custom initial state
const builder2 = new BrowserStateBuilder({
  url: 'https://example.com',
  isAuthenticated: true
});
```

#### withUrl()

Sets the page URL.

**Signature:**
```typescript
withUrl(url: string): this
```

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `url` | `string` | Yes | The page URL |

**Returns:** `this` — The builder instance for method chaining

**Usage Example:**
```typescript
const state = new BrowserStateBuilder()
  .withUrl('https://app.example.com/dashboard')
  .build();

expect(state.url).toBe('https://app.example.com/dashboard');
```

#### withTitle()

Sets the page title.

**Signature:**
```typescript
withTitle(title: string): this
```

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `title` | `string` | Yes | The page title |

**Returns:** `this` — The builder instance for method chaining

**Usage Example:**
```typescript
const state = new BrowserStateBuilder()
  .withTitle('My Dashboard')
  .build();

expect(state.title).toBe('My Dashboard');
```

#### withLoading()

Sets the loading state.

**Signature:**
```typescript
withLoading(isLoading: boolean): this
```

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `isLoading` | `boolean` | Yes | Whether the page is loading |

**Returns:** `this` — The builder instance for method chaining

**Usage Example:**
```typescript
const state = new BrowserStateBuilder()
  .withLoading(true)
  .build();

expect(state.isLoading).toBe(true);
```

#### withError()

Sets the error state.

**Signature:**
```typescript
withError(hasError: boolean): this
```

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `hasError` | `boolean` | Yes | Whether there is an error |

**Returns:** `this` — The builder instance for method chaining

**Usage Example:**
```typescript
const state = new BrowserStateBuilder()
  .withError(true)
  .build();

expect(state.hasError).toBe(true);
```

#### withAuth()

Sets the authentication status.

**Signature:**
```typescript
withAuth(isAuthenticated: boolean): this
```

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `isAuthenticated` | `boolean` | Yes | Whether the user is authenticated |

**Returns:** `this` — The builder instance for method chaining

**Usage Example:**
```typescript
const state = new BrowserStateBuilder()
  .withAuth(true)
  .build();

expect(state.isAuthenticated).toBe(true);
```

#### withLocalStorage()

Adds local storage data (merges with existing data).

**Signature:**
```typescript
withLocalStorage(data: Record<string, string>): this
```

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `data` | `Record<string, string>` | Yes | Local storage key-value pairs |

**Returns:** `this` — The builder instance for method chaining

**Usage Example:**
```typescript
const state = new BrowserStateBuilder()
  .withLocalStorage({ 'auth-token': 'jwt-123', 'theme': 'dark' })
  .withLocalStorage({ 'lang': 'en' }) // Merges with previous data
  .build();

expect(state.localStorage['auth-token']).toBe('jwt-123');
expect(state.localStorage['theme']).toBe('dark');
expect(state.localStorage['lang']).toBe('en');
```

#### withSessionStorage()

Adds session storage data (merges with existing data).

**Signature:**
```typescript
withSessionStorage(data: Record<string, string>): this
```

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `data` | `Record<string, string>` | Yes | Session storage key-value pairs |

**Returns:** `this` — The builder instance for method chaining

**Usage Example:**
```typescript
const state = new BrowserStateBuilder()
  .withSessionStorage({ 'current-tab': 'dashboard' })
  .build();

expect(state.sessionStorage['current-tab']).toBe('dashboard');
```

#### withConsoleMessages()

Adds console messages (appends to existing messages).

**Signature:**
```typescript
withConsoleMessages(messages: Array<{
  type: 'log' | 'warn' | 'error' | 'info';
  message: string;
  timestamp?: Date;
}>): this
```

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `messages` | `Array<ConsoleMessage>` | Yes | Array of console messages |
| `messages[].type` | `'log' \| 'warn' \| 'error' \| 'info'` | Yes | Message type |
| `messages[].message` | `string` | Yes | Message content |
| `messages[].timestamp` | `Date` | No | Message timestamp (auto-generated if not provided) |

**Returns:** `this` — The builder instance for method chaining

**Usage Example:**
```typescript
const state = new BrowserStateBuilder()
  .withConsoleMessages([
    { type: 'info', message: 'App initialized' },
    { type: 'error', message: 'Failed to load config', timestamp: new Date('2024-01-15T10:00:00Z') }
  ])
  .build();

expect(state.consoleMessages).toHaveLength(2);
expect(state.consoleMessages[0].type).toBe('info');
expect(state.consoleMessages[1].timestamp).toEqual(new Date('2024-01-15T10:00:00Z'));
```

#### withNetworkRequests()

Adds network requests (appends to existing requests).

**Signature:**
```typescript
withNetworkRequests(requests: Array<{
  url: string;
  method: string;
  status?: number;
  headers?: Record<string, string>;
}>): this
```

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `requests` | `Array<NetworkRequest>` | Yes | Array of network requests |
| `requests[].url` | `string` | Yes | Request URL |
| `requests[].method` | `string` | Yes | HTTP method |
| `requests[].status` | `number` | No | Response status code |
| `requests[].headers` | `Record<string, string>` | No | Request headers |

**Returns:** `this` — The builder instance for method chaining

**Usage Example:**
```typescript
const state = new BrowserStateBuilder()
  .withNetworkRequests([
    { url: 'https://api.example.com/users', method: 'GET', status: 200 },
    { url: 'https://api.example.com/login', method: 'POST', status: 401 }
  ])
  .build();

expect(state.networkRequests).toHaveLength(2);
expect(state.networkRequests[0].status).toBe(200);
```

#### build()

Builds and returns the final browser state.

**Signature:**
```typescript
build(): BrowserState
```

**Returns:** `BrowserState` — The constructed browser state

**Usage Example:**
```typescript
const state = new BrowserStateBuilder()
  .withUrl('https://app.example.com')
  .withTitle('My App')
  .withAuth(true)
  .build();

expect(state.url).toBe('https://app.example.com');
expect(state.title).toBe('My App');
expect(state.isAuthenticated).toBe(true);
```

### createBrowserState()

Factory function that creates a new `BrowserStateBuilder` instance.

**Signature:**
```typescript
createBrowserState(initialState?: Partial<BrowserState>): BrowserStateBuilder
```

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `initialState` | `Partial<BrowserState>` | No | Initial state properties |

**Returns:** `BrowserStateBuilder` — A new builder instance

**Usage Example:**
```typescript
import { createBrowserState } from '@apex/core/test-fixtures';

// Using the factory function
const state = createBrowserState()
  .withUrl('https://example.com')
  .withAuth(true)
  .build();

// With initial state
const state2 = createBrowserState({ isLoading: true })
  .withUrl('https://loading.example.com')
  .build();

expect(state2.isLoading).toBe(true);
expect(state2.url).toBe('https://loading.example.com');
```

### Comparison: Helpers vs Builder

| Aspect | browserHelpers | BrowserStateBuilder |
|--------|----------------|-------------------|
| **API Style** | Functional (pure functions) | Object-oriented (method chaining) |
| **Mutability** | Immutable (returns new state) | Mutable internally, builds final state |
| **Use Case** | Single property changes | Complex multi-property construction |
| **Composability** | Requires explicit chaining | Fluent chaining built-in |
| **Performance** | Creates new object per operation | Single object creation at end |
| **Readability** | Explicit about each operation | Clean fluent interface |

**When to use browserHelpers:**
- Making single property changes
- Functional programming style preferred
- Testing specific state transitions
- Need maximum clarity about each operation

**When to use BrowserStateBuilder:**
- Building complex states with many properties
- Constructing states dynamically in loops
- Prefer fluent/chainable API
- Building states from scratch rather than modifying existing ones

**Example comparison:**
```typescript
// Using browserHelpers - functional style
let state = browserFixtures.cleanState();
state = browserHelpers.setAuthenticated(state, true);
state = browserHelpers.setLocalStorage(state, 'theme', 'dark');
state = browserHelpers.addConsoleMessage(state, 'info', 'User logged in');

// Using BrowserStateBuilder - fluent style
const state2 = createBrowserState()
  .withAuth(true)
  .withLocalStorage({ 'theme': 'dark' })
  .withConsoleMessages([{ type: 'info', message: 'User logged in' }])
  .build();

// Both produce equivalent results
expect(state).toEqual(state2);
```

## Examples

### Testing Authentication Flow

```typescript
import { browserFixtures } from '@apex/core/test-fixtures';

describe('Authentication Flow', () => {
  test('should handle login transition', () => {
    // Start with clean state
    const initialState = browserFixtures.cleanState({
      url: 'https://app.apex.dev/login'
    });

    expect(initialState.isAuthenticated).toBe(false);

    // Simulate successful login
    const loggedInState = browserFixtures.loggedInPage();
    expect(loggedInState.isAuthenticated).toBe(true);
    expect(loggedInState.localStorage['auth-token']).toBeTruthy();
  });

  test('should handle logout', () => {
    // Start with logged-in state
    const loggedInState = browserFixtures.loggedInPage();

    // Simulate logout (clear auth data)
    const loggedOutState = browserFixtures.cleanState({
      url: 'https://app.apex.dev/login',
      consoleMessages: [{
        type: 'info',
        message: 'User logged out successfully',
        timestamp: new Date()
      }]
    });

    expect(loggedOutState.isAuthenticated).toBe(false);
  });
});
```

### Testing Error Handling

```typescript
import { browserFixtures } from '@apex/core/test-fixtures';

describe('Error Handling', () => {
  test('should handle network errors', () => {
    const errorState = browserFixtures.errorPage({
      localStorage: {
        'last-error': JSON.stringify({
          code: 'NETWORK_ERROR',
          message: 'Failed to connect to server'
        })
      }
    });

    expect(errorState.hasError).toBe(true);
    expect(errorState.consoleMessages.some(msg =>
      msg.type === 'error' && msg.message.includes('NetworkError')
    )).toBe(true);
  });

  test('should handle permission errors', () => {
    const permissionState = browserFixtures.permissionDeniedPage();

    expect(permissionState.isAuthenticated).toBe(true); // User is logged in
    expect(permissionState.networkRequests[0].status).toBe(403); // But lacks permission
  });
});
```

### Testing Loading States

```typescript
import { browserFixtures } from '@apex/core/test-fixtures';

describe('Loading States', () => {
  test('should handle page loading', () => {
    const loadingState = browserFixtures.loadingPage();

    expect(loadingState.isLoading).toBe(true);
    expect(loadingState.title).toContain('Loading...');

    // Simulate loading completion
    const loadedState = browserFixtures.loggedInPage({
      url: loadingState.url.replace('/loading', '/dashboard')
    });

    expect(loadedState.isLoading).toBe(false);
  });
});
```

### Testing Offline Scenarios

```typescript
import { browserFixtures } from '@apex/core/test-fixtures';

describe('Offline Scenarios', () => {
  test('should handle offline mode', () => {
    const offlineState = browserFixtures.offlinePage();

    expect(offlineState.localStorage['offline-mode']).toBe('true');
    expect(offlineState.networkRequests.length).toBe(0);

    // Check cached data is available
    const cachedData = JSON.parse(offlineState.localStorage['cached-data']);
    expect(cachedData).toHaveProperty('projects');
    expect(cachedData).toHaveProperty('profile');
  });
});
```

### Parameterized Testing with Scenarios

```typescript
import { browserFixtures, TestScenario } from '@apex/core/test-fixtures';

describe('Cross-scenario Testing', () => {
  const scenarios: TestScenario[] = [
    'clean-state',
    'logged-in-user',
    'error-state',
    'loading-state',
    'network-offline',
    'permission-denied'
  ];

  test.each(scenarios)('should validate state structure in %s', (scenario) => {
    const state = browserFixtures.fromScenario(scenario);

    // Validate all states have required properties
    expect(state).toHaveProperty('url');
    expect(state).toHaveProperty('title');
    expect(state).toHaveProperty('isLoading');
    expect(state).toHaveProperty('hasError');
    expect(state).toHaveProperty('isAuthenticated');
    expect(state).toHaveProperty('localStorage');
    expect(state).toHaveProperty('sessionStorage');
    expect(state).toHaveProperty('cookies');
    expect(state).toHaveProperty('consoleMessages');
    expect(state).toHaveProperty('networkRequests');
  });
});
```

## Best Practices

1. **Use Appropriate Fixtures**: Choose the fixture that best matches your test scenario rather than modifying a generic one extensively.

2. **Override Selectively**: Use the `overrides` parameter to customize only the properties you need for your specific test case.

3. **Combine with Helpers**: Use the provided helper utilities for complex state manipulations rather than manually modifying state objects.

4. **Validate State Structure**: Always validate that your browser state has the expected structure before using it in tests.

5. **Test State Transitions**: Use fixtures to test transitions between different browser states (e.g., login → logout, online → offline).

6. **Mock Realistic Data**: When overriding default values, ensure your test data is realistic and representative of actual browser behavior.

## Related Documentation

- [Mock Helpers API](./mock-helpers-api.md) - Complete mock helpers API reference for testing
- [Test Utilities](./test-utilities.md) - Additional testing utilities and helpers
- [Browser Automation](./browser-automation.md) - Browser automation testing guide
- [System APIs Reference](./system-apis-reference.md) - Complete system API documentation