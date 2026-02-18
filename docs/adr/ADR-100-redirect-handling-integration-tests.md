# ADR-100: Integration Tests for Redirect Handling

## Status
Proposed

## Date
2025-02-14

## Context

The APEX platform needs comprehensive integration tests for redirect handling to ensure the WebFetch tool and browser automation correctly handle various redirect scenarios. Redirects are critical for proper web navigation and scraping operations.

### Current State

1. **WebFetch Tool** (`packages/orchestrator/src/tools/webfetch.ts`):
   - Already tracks redirects via native Fetch API's `response.redirected` property
   - Records `finalUrl` in metadata when redirect occurs
   - Has a single basic redirect test using `httpbin.org/redirect/3`

2. **Mock Server Infrastructure** (`packages/core/src/test-utils/mock-server.ts`):
   - Supports HTTP redirects (301, 302, 307, 308)
   - Has redirect chain routes (`/redirect-chain-start` → `/redirect-chain-middle` → `/redirect-chain-end`)
   - Dynamic redirect endpoint (`/redirect?status=XXX&target=YYY`)

3. **Page Navigation Tests** (`tests/page-navigation/`):
   - Basic redirect tests for 301/302 with Playwright
   - Uses MockNavigationServer with limited redirect scenarios

### Gap Analysis

**Missing test coverage:**
- HTTP 307 (Temporary Redirect - preserves method)
- HTTP 308 (Permanent Redirect - preserves method)
- JavaScript-based redirects (`window.location`)
- Meta refresh redirects (`<meta http-equiv="refresh">`)
- Redirect chain tracking with exact hop count
- Cross-origin redirect handling
- Redirect loop detection
- Method preservation verification (POST → redirect → POST)
- Redirect timing/performance metrics

## Decision

Create a comprehensive redirect handling integration test suite that covers:

### 1. Test Architecture

```
packages/orchestrator/src/tools/
├── webfetch.redirect.integration.test.ts   # WebFetch redirect tests
└── webfetch.ts                              # Existing implementation

tests/integration/
└── redirect-handling.integration.test.ts   # Cross-cutting redirect tests

packages/core/src/test-utils/
└── mock-server.ts                          # Enhanced with new redirect routes
```

### 2. Test Categories

#### A. HTTP Redirect Status Codes

| Status Code | Name | Behavior | Test Focus |
|-------------|------|----------|------------|
| 301 | Moved Permanently | Method may change to GET | Final URL, cache headers |
| 302 | Found | Method may change to GET | Temporary redirect tracking |
| 307 | Temporary Redirect | Method preserved | POST body preservation |
| 308 | Permanent Redirect | Method preserved | POST body preservation |

#### B. JavaScript Redirects

```javascript
// Types to test:
window.location.href = 'url';
window.location.assign('url');
window.location.replace('url');
document.location = 'url';
```

#### C. Meta Refresh Redirects

```html
<meta http-equiv="refresh" content="0;url=https://example.com">
<meta http-equiv="refresh" content="5;url=https://example.com">  <!-- Delayed -->
```

#### D. Redirect Chains

```
Start URL → 301 → 302 → 307 → Final URL
           hop1   hop2   hop3

Verify: Chain length, intermediate URLs, final URL
```

### 3. Mock Server Enhancements

Add the following routes to `packages/core/src/test-utils/mock-server.ts`:

```typescript
// HTTP 307 redirect
app.get('/redirect/307/:target', async (request, reply) => {
  const target = (request.params as any).target;
  return reply.redirect(307, `/${target}`);
});

// HTTP 308 redirect
app.get('/redirect/308/:target', async (request, reply) => {
  const target = (request.params as any).target;
  return reply.redirect(308, `/${target}`);
});

// POST redirect test endpoints
app.post('/redirect/307/:target', async (request, reply) => {
  // Should preserve POST method
  return reply.redirect(307, `/${target}`);
});

// Multi-hop redirect chain
app.get('/redirect-chain/:hops', async (request, reply) => {
  const hops = parseInt((request.params as any).hops, 10);
  if (hops > 1) {
    return reply.redirect(302, `/redirect-chain/${hops - 1}`);
  }
  return { message: 'Redirect chain completed', hops: 0 };
});

// JavaScript redirect page
app.get('/js-redirect/:type/:target', async (request) => {
  const type = (request.params as any).type;
  const target = (request.params as any).target;
  const targetPath = target === 'home' ? '/' : `/${target}`;

  const jsCode = {
    'href': `window.location.href = '${targetPath}';`,
    'assign': `window.location.assign('${targetPath}');`,
    'replace': `window.location.replace('${targetPath}');`,
  };

  return `
    <!DOCTYPE html>
    <html>
    <head><title>JS Redirect</title></head>
    <body>
      <script>${jsCode[type] || jsCode['href']}</script>
    </body>
    </html>
  `;
});

// Meta refresh redirect page
app.get('/meta-redirect/:delay/:target', async (request) => {
  const delay = (request.params as any).delay;
  const target = (request.params as any).target;
  const targetPath = target === 'home' ? '/' : `/${target}`;

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta http-equiv="refresh" content="${delay};url=${targetPath}">
      <title>Meta Redirect</title>
    </head>
    <body>
      <p>Redirecting in ${delay} seconds...</p>
    </body>
    </html>
  `;
});
```

### 4. Test Structure

#### WebFetch Redirect Integration Tests

```typescript
// packages/orchestrator/src/tools/webfetch.redirect.integration.test.ts

describe('WebFetch Redirect Handling Integration Tests', () => {
  let tool: WebFetchTool;
  let mockServer: MockServer;
  let baseUrl: string;

  beforeAll(async () => {
    mockServer = new MockServer();
    await mockServer.start();
    baseUrl = mockServer.getUrl();
  });

  afterAll(async () => {
    await mockServer.stop();
  });

  describe('HTTP Redirect Status Codes', () => {
    describe('301 Moved Permanently', () => {
      it('should follow 301 redirects and track final URL');
      it('should report redirected=true in metadata');
      it('should preserve query parameters through redirect');
    });

    describe('302 Found', () => {
      it('should follow 302 redirects');
      it('should handle multiple 302 redirects');
    });

    describe('307 Temporary Redirect', () => {
      it('should preserve HTTP method for GET requests');
      it('should preserve HTTP method for POST requests');
      it('should preserve request body through redirect');
    });

    describe('308 Permanent Redirect', () => {
      it('should preserve HTTP method for all request types');
      it('should preserve custom headers through redirect');
    });
  });

  describe('Redirect Chains', () => {
    it('should handle redirect chains up to 5 hops');
    it('should handle redirect chains up to 10 hops');
    it('should detect and handle excessive redirect chains');
    it('should track intermediate URLs in redirect chain');
    it('should report correct hop count');
  });

  describe('Cross-Origin Redirects', () => {
    it('should handle same-origin redirects');
    it('should handle cross-origin redirects when allowed');
    it('should respect redirect policies');
  });

  describe('Edge Cases', () => {
    it('should handle redirect to same URL (redirect loop potential)');
    it('should handle redirect with empty location header');
    it('should handle redirect with relative URL');
    it('should handle redirect with protocol-relative URL');
  });
});
```

#### Browser Redirect Integration Tests

```typescript
// tests/integration/redirect-handling.integration.test.ts

describe('Browser Redirect Handling Integration Tests', () => {
  let browser: Browser;
  let page: Page;
  let mockServer: MockNavigationServer;

  describe('JavaScript Redirects', () => {
    it('should handle window.location.href redirect');
    it('should handle window.location.assign() redirect');
    it('should handle window.location.replace() redirect');
    it('should track navigation after JS redirect');
    it('should handle delayed JS redirect');
  });

  describe('Meta Refresh Redirects', () => {
    it('should handle immediate meta refresh (0 seconds)');
    it('should handle delayed meta refresh (configurable)');
    it('should detect meta refresh before completion');
    it('should track final URL after meta refresh');
  });

  describe('Combined Redirect Scenarios', () => {
    it('should handle HTTP redirect to JS redirect');
    it('should handle meta refresh to HTTP redirect');
    it('should track full redirect chain through different mechanisms');
  });
});
```

### 5. Expected Test Outputs

#### Redirect Metadata Interface

```typescript
interface RedirectMetadata {
  redirected: boolean;
  finalUrl?: string;
  redirectChain?: {
    url: string;
    statusCode: number;
    timestamp: number;
  }[];
  totalHops?: number;
  methodPreserved?: boolean;
}
```

### 6. Test Data & Fixtures

```typescript
// tests/integration/fixtures/redirect-scenarios.ts

export const HTTP_REDIRECT_SCENARIOS = [
  { name: '301-simple', path: '/redirect/301/page1', expectedFinalPath: '/page1', status: 301 },
  { name: '302-simple', path: '/redirect/302/page2', expectedFinalPath: '/page2', status: 302 },
  { name: '307-preserve-method', path: '/redirect/307/api', expectedFinalPath: '/api', status: 307 },
  { name: '308-preserve-method', path: '/redirect/308/api', expectedFinalPath: '/api', status: 308 },
  { name: 'chain-3-hops', path: '/redirect-chain/3', expectedFinalPath: '/redirect-chain-end', hops: 3 },
];

export const JS_REDIRECT_SCENARIOS = [
  { name: 'href', path: '/js-redirect/href/page1', type: 'window.location.href' },
  { name: 'assign', path: '/js-redirect/assign/page2', type: 'window.location.assign' },
  { name: 'replace', path: '/js-redirect/replace/page3', type: 'window.location.replace' },
];

export const META_REFRESH_SCENARIOS = [
  { name: 'immediate', path: '/meta-redirect/0/page1', delay: 0 },
  { name: 'delayed-2s', path: '/meta-redirect/2/page2', delay: 2 },
];
```

### 7. Verification Approach

Each test must verify:

1. **Final URL Verification**
   - `response.url` matches expected final destination
   - `metadata.finalUrl` is set correctly

2. **Redirect Flag Verification**
   - `metadata.redirected` is `true` when redirect occurred
   - `metadata.redirected` is `false` for direct requests

3. **Chain Tracking** (when applicable)
   - Number of hops matches expectation
   - Each intermediate URL is recorded

4. **Method Preservation** (for 307/308)
   - POST requests remain POST after redirect
   - Request body is preserved

5. **Performance Metrics**
   - Total redirect time is within acceptable bounds
   - Individual hop times are recorded

## Implementation Plan

### Phase 1: Mock Server Enhancement (Developer Stage)
- Add HTTP 307/308 redirect routes
- Add POST redirect test endpoints
- Add configurable redirect chain endpoint
- Add JavaScript redirect page generator
- Add meta refresh redirect page generator

### Phase 2: WebFetch Redirect Tests (Tester Stage)
- Create `webfetch.redirect.integration.test.ts`
- Test all HTTP redirect status codes
- Test redirect chains with varying hop counts
- Test method/body preservation
- Test edge cases

### Phase 3: Browser Redirect Tests (Tester Stage)
- Create browser redirect integration test file
- Test JavaScript redirect types
- Test meta refresh with various delays
- Test combined redirect scenarios

### Phase 4: Documentation & Coverage Report (Reviewer Stage)
- Generate test coverage report
- Document test scenarios
- Create troubleshooting guide

## Consequences

### Positive
- Comprehensive redirect test coverage ensures reliability
- Mock server allows deterministic testing without external dependencies
- Reusable test fixtures can be used for regression testing
- Clear separation of HTTP vs browser redirect tests

### Negative
- Additional mock server complexity
- Browser tests for JS/meta redirects require Playwright
- Some edge cases may require extended timeouts

### Neutral
- Tests add ~150-200 lines of mock server code
- Tests add ~400-500 lines of test code
- Test execution time increases by ~5-10 seconds

## References

- [MDN: HTTP Redirections](https://developer.mozilla.org/en-US/docs/Web/HTTP/Redirections)
- [RFC 7231: HTTP/1.1 Semantics](https://tools.ietf.org/html/rfc7231#section-6.4)
- [Playwright: Navigation](https://playwright.dev/docs/navigations)
- [Fetch API: Following Redirects](https://fetch.spec.whatwg.org/#concept-request-redirect-mode)
