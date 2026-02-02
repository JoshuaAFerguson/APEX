# APEX Testing Architecture Analysis

## Executive Summary

This document provides a comprehensive analysis of the APEX codebase testing architecture, patterns, permission schemas, browser automation interfaces, and recommendations for integration test placement.

## Testing Framework & Configuration

### Testing Stack
- **Framework**: Vitest v4.0.15 (Jest-compatible)
- **Environment**: Node.js with jsdom support for UI components
- **Coverage**: V8 provider with text, HTML, JSON, and LCOV reporters
- **Browser Automation**: Playwright v1.47.0 and Puppeteer v24.34.0
- **Mocking**: Vitest built-in mocking with vi.mock()

### Configuration Architecture

The project uses a sophisticated multi-tier configuration system:

#### Root Configuration (`vitest.config.ts`)
- **Environment Matching**: Different environments for different package types
  - `packages/orchestrator/src/**` → Node environment
  - `packages/core/src/**` → Node environment
  - `packages/api/src/**` → Node environment
  - `packages/cli/src/__tests__/**` → Node environment
  - UI components → jsdom environment

- **Coverage Thresholds**: 50% across all metrics (lines, functions, branches, statements)
- **Coverage Exclusions**: CLI package excluded (tested via integration), Web UI excluded (requires browser environment)

#### Shared Configuration (`vitest.shared.config.ts`)
- **Factory Functions**: `createUnitTestConfig()`, `createIntegrationTestConfig()`, `createE2ETestConfig()`, `createBrowserTestConfig()`
- **Timeout Configuration**: 5s unit, 30s integration, 60s E2E
- **Path Aliases**: `@`, `@tests`, `@fixtures` for clean imports

#### Specialized Configurations
- **Browser Integration** (`tests/browser-integration/vitest.config.ts`): 60s timeout, sequential execution, fork pool with max 2 concurrent tests
- **Package-Specific**: Each package can override with specific needs

## Test Organization & Patterns

### Directory Structure
```
packages/
├── core/src/__tests__/           # Core functionality unit tests
├── orchestrator/src/__tests__/   # Orchestrator integration tests
├── cli/src/__tests__/           # CLI feature tests
├── cli/src/ui/__tests__/        # UI component tests
├── cli/src/services/__tests__/  # Service layer tests
├── api/src/__tests__/           # API endpoint tests
└── browser/src/__tests__/       # Browser package tests

tests/
├── integration/                 # Cross-package integration tests
├── browser-integration/         # Browser automation tests
└── test-utils/                 # Shared test utilities
```

### Test Naming Conventions
- `*.test.ts/tsx` - Unit tests
- `*.integration.test.ts` - Integration tests
- `*.e2e.test.ts` - End-to-end tests
- `*.edge.test.ts` - Edge case tests
- `*.stress.test.ts` - Performance/stress tests
- `*.browser.test.ts` - Browser-specific tests

### Common Test Patterns

#### 1. Browser Test Setup Pattern
```typescript
// Global setup with browser lifecycle management
beforeAll(async () => {
  globalThis.browserTestContext = {
    tempDir: await createTempDir(),
    screenshots: [],
  };
});

// Per-test isolation
beforeEach(async () => {
  // Clear browser state (cookies, storage)
  await page.context().clearCookies();
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
});
```

#### 2. Permission Testing Pattern
```typescript
describe('Permission Integration', () => {
  let permissionStore: PermissionStore;
  let permissionManager: PermissionManager;

  beforeEach(async () => {
    permissionStore = new PermissionStore(testDir);
    permissionManager = new PermissionManager(permissionStore, eventEmitter);
    await permissionStore.initialize();
  });

  it('should enforce browser domain restrictions', async () => {
    await permissionStore.setPermission('Browser', 'blocked-domain.com', 'deny');
    const result = await browserTool.navigate('https://blocked-domain.com');
    expect(result.success).toBe(false);
    expect(result.error).toContain('Permission denied');
  });
});
```

#### 3. Mock Pattern for Browser Dependencies
```typescript
export function mockBrowserDependencies() {
  vi.mock('playwright', () => ({
    chromium: {
      launch: vi.fn().mockResolvedValue({
        newContext: vi.fn().mockResolvedValue({
          newPage: vi.fn().mockResolvedValue({
            goto: vi.fn(),
            screenshot: vi.fn(),
            close: vi.fn(),
          }),
        }),
      }),
    },
  }));
}
```

## Permission System Architecture

### Schema Structure (Zod-based)

#### Core Permission Types
```typescript
// Permission levels
type PermissionLevel = 'allow-always' | 'allow-once' | 'deny';

// Permission record
interface Permission {
  tool: string;           // Tool name (e.g., 'Browser', 'Read')
  scope?: string;         // Optional scope (e.g., domain, file pattern)
  level: PermissionLevel; // Permission granted
  expiry?: Date;         // Optional expiration
  createdAt: Date;       // Creation timestamp
}

// Permission query interface
interface PermissionQuery {
  tool: string;
  scope?: string;
}
```

#### Tool-Specific Permission Configs

##### Browser Tool Config
```typescript
interface BrowserToolConfig extends BaseToolPermissionConfig {
  allowedDomains: string[];          // Domain whitelist
  blockedDomains: string[];          // Domain blacklist
  allowJavaScriptExecution?: boolean; // JS execution permission
  allowFormSubmission?: boolean;      // Form submission permission
  pageLoadTimeout?: number;           // Timeout in ms
  allowDownloads?: boolean;           // File download permission
  allowScreenshots?: boolean;         // Screenshot permission
  blockPopups?: boolean;              // Popup blocking
  engine: 'chromium' | 'firefox' | 'webkit';
  backend: 'playwright' | 'puppeteer';
  headless?: boolean;
  viewport?: { width: number; height: number };
}
```

##### Filesystem Tool Config
```typescript
interface FilesystemToolConfig extends BaseToolPermissionConfig {
  directoryAccess: {
    allowlist: string[];     // Allowed paths (glob patterns)
    blocklist: string[];     // Blocked paths (glob patterns)
    defaultAllow?: boolean;  // Default behavior
    resolveSymlinks: boolean; // Follow symlinks
    maxDepth: number;        // Max recursion depth
  };
  maxFileSize: number;       // Max file size in bytes
  allowedExtensions: string[]; // Allowed file extensions
  blockedExtensions: string[]; // Blocked file extensions
}
```

##### Shell Tool Config
```typescript
interface ShellToolConfig extends BaseToolPermissionConfig {
  directoryAccess: DirectoryAccessConfig;
  blockedCommands: string[];        // Regex patterns for blocked commands
  allowElevatedPrivileges: boolean; // Allow sudo/root
  environment: Record<string, string>; // Env vars to inject
  workingDirectory?: string;        // Override working directory
}
```

### Permission Flow Integration

1. **Request**: Agent requests tool usage
2. **Query**: PermissionManager queries PermissionStore
3. **Check**: Validate against tool-specific config
4. **Decision**: Allow/deny/prompt based on stored permissions
5. **Execute**: Tool executes if allowed
6. **Event**: Permission events emitted for audit

## Browser Automation Architecture

### Browser Tool Interface
- **Operations**: navigate, click, type, hover, screenshot, evaluate, waitFor, extractText, extractHTML
- **Backends**: Playwright (primary), Puppeteer (secondary)
- **Browsers**: Chromium, Firefox, WebKit support
- **Features**: Screenshot comparison, console message capture, error handling

### Browser Session Management
```typescript
interface BrowserSession {
  id: string;
  browser: Browser;
  context: BrowserContext;
  page: Page;
  config: BrowserSessionConfig;
  startTime: Date;
  lastActivity: Date;
}

interface BrowserSessionConfig {
  backend: 'playwright' | 'puppeteer';
  browserType: 'chromium' | 'firefox' | 'webkit';
  headless: boolean;
  viewport: { width: number; height: number };
  userAgent?: string;
  permissions: BrowserToolConfig;
}
```

### Console & Error Capture
```typescript
interface ConsoleMessage {
  severity: 'log' | 'info' | 'warn' | 'error' | 'debug' | 'trace';
  message: string;
  timestamp: Date;
  sourceUrl?: string;
  lineNumber?: number;
  columnNumber?: number;
  stackTrace?: StackFrame[];
}

interface BrowserError {
  name: string;        // Error type
  message: string;     // Error message
  stack?: string;      // Stack trace
  sourceUrl?: string;  // Source file
  lineNumber?: number; // Line number
  timestamp: Date;     // When error occurred
}
```

## Integration Test Placement Strategy

### Current Integration Test Locations

#### 1. Cross-Package Integration (`tests/integration/`)
- **Purpose**: Tests that span multiple packages
- **Examples**:
  - `browser-automation-permissions.integration.test.ts` - Browser + Permission system
  - `permission-policy-browser.integration.test.ts` - Permission policies with browser
  - `workflow.integration.test.ts` - End-to-end workflow testing

#### 2. Browser-Specific Integration (`tests/browser-integration/`)
- **Purpose**: Browser automation with real browser instances
- **Features**: Playwright/Puppeteer testing, screenshot validation, console monitoring
- **Examples**:
  - `screenshot-capture-integration.test.ts` - Screenshot functionality
  - `apex-orchestrator-integration.test.ts` - Orchestrator + Browser integration
  - `infrastructure-verification.test.ts` - Browser infrastructure validation

#### 3. Package-Level Integration (`packages/*/src/__tests__/`)
- **Purpose**: Integration within package boundaries
- **Examples**:
  - `packages/core/src/__tests__/browser-tool-integration.test.ts`
  - `packages/orchestrator/src/__tests__/browser-automation-integration.test.ts`
  - `packages/cli/src/__tests__/cli-browser-automation-integration.test.ts`

### Recommended Integration Test Placement

#### New Integration Tests Should Go To:

1. **`tests/integration/`** - When testing:
   - Cross-package interactions
   - System-level workflows
   - Permission system integration
   - Multi-component scenarios

2. **`tests/browser-integration/`** - When testing:
   - Actual browser automation
   - Screenshot comparison
   - Browser-specific features
   - Performance with real browsers

3. **`packages/{package}/src/__tests__/`** - When testing:
   - Package-specific integration
   - Internal component interaction
   - Package API surface testing
   - Mock-based integration (no real browsers)

## Test Coverage Analysis

### Current Coverage Setup
- **Global Threshold**: 50% across all metrics
- **Excluded Areas**:
  - CLI package (integration tested)
  - Web UI components (browser environment required)
  - WebSocket client (requires browser WebSocket API)
  - All test files and build artifacts

### Coverage Reporting
- **Providers**: V8 (primary)
- **Formats**: Text, HTML, JSON, LCOV
- **Location**: `./coverage/` directory
- **Integration**: Works with CI/CD systems via LCOV format

### Coverage Gaps Identified
1. **Browser Tool Real Implementation**: Heavy mocking reduces real coverage
2. **Permission System Edge Cases**: Complex interaction scenarios
3. **Error Handling Paths**: Network failures, permission denied scenarios
4. **Concurrent Usage**: Multiple browser sessions, race conditions

## Test Utilities & Helpers

### Shared Test Utilities (`tests/test-utils/`)
```typescript
// Browser test base class
export class BrowserTestBase {
  protected browser: Browser;
  protected context: BrowserContext;
  protected page: Page;
  protected tempDir: string;

  async setUp(config: BrowserTestConfig) { /* ... */ }
  async tearDown() { /* ... */ }
  async captureScreenshot(name: string): Promise<string> { /* ... */ }
  async setupTestPage(): Promise<void> { /* ... */ }
}

// Permission test utilities
export function createTestPermissionStore(dir: string): PermissionStore { /* ... */ }
export function createTestTask(overrides?: Partial<Task>): Task { /* ... */ }
export class MockBrowserSession implements BrowserSession { /* ... */ }
```

### Common Test Fixtures
- **HTML Test Pages**: Pre-built pages for browser interaction testing
- **Permission Scenarios**: Common permission configurations
- **Mock Data**: Task definitions, agent configs, workflow templates

## Recommendations

### 1. Test Organization
- ✅ **Good**: Clear separation by test type and scope
- ✅ **Good**: Consistent naming conventions
- ✅ **Good**: Shared configuration with overrides
- 🔄 **Improve**: Consider consolidating some scattered browser tests

### 2. Browser Testing
- ✅ **Good**: Real browser integration with Playwright
- ✅ **Good**: Screenshot capture and comparison
- ✅ **Good**: Console message and error capture
- 🔄 **Improve**: Add visual regression testing framework
- 🔄 **Improve**: Cross-browser compatibility testing automation

### 3. Permission Testing
- ✅ **Good**: Comprehensive permission schema coverage
- ✅ **Good**: Integration with browser automation
- 🔄 **Improve**: Add property-based testing for permission edge cases
- 🔄 **Improve**: Performance testing for permission lookups

### 4. Coverage Strategy
- ✅ **Good**: Reasonable threshold (50%) for large codebase
- ✅ **Good**: Appropriate exclusions documented
- 🔄 **Improve**: Add integration coverage tracking
- 🔄 **Improve**: Measure real vs. mocked code coverage

### 5. Performance Testing
- 🔄 **Add**: Browser automation performance benchmarks
- 🔄 **Add**: Permission system performance tests
- 🔄 **Add**: Memory usage testing for long-running browser sessions
- 🔄 **Add**: Concurrent browser session limits testing

### 6. Future Integration Test Areas
- **Multi-Agent Workflows**: Tests for agent handoff scenarios
- **Real-Time Updates**: WebSocket integration with browser automation
- **Error Recovery**: System recovery after browser crashes
- **Security Testing**: Permission bypass attempts, XSS protection
- **Mobile Browser Testing**: Responsive design automation

## Conclusion

The APEX testing architecture demonstrates a mature, well-organized approach to testing a complex multi-package system. The combination of unit tests, integration tests, and browser automation provides comprehensive coverage. The permission system integration with browser automation is particularly well-designed, ensuring security while maintaining functionality.

Key strengths include the modular configuration system, comprehensive browser automation support, and robust permission testing. Areas for improvement include expanding visual regression testing, adding performance benchmarks, and increasing cross-browser test coverage.