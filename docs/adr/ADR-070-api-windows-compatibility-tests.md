# ADR-070: Windows Compatibility Tests for @apex/api Package

## Status

**Proposed**

## Context

The @apex/api package requires Windows compatibility testing to ensure the REST API and WebSocket server work correctly on Windows. The current test suite (`windows-ci-integration.test.ts`) validates CI workflow and environment configuration but lacks:

1. **Server startup tests on Windows** - Validating Fastify server port binding and lifecycle
2. **API endpoint path handling** - Ensuring any path-related data in API responses works cross-platform
3. **WebSocket connectivity** - Validating WebSocket connections work on Windows
4. **Temporary directory operations** - Tests using `os.tmpdir()` and `fs.mkdtemp()` on Windows

### Current State Analysis

After comprehensive codebase analysis:

1. **Existing Windows Tests** (`packages/api/src/__tests__/windows-ci-integration.test.ts`):
   - Environment compatibility (Node.js version, platform detection)
   - Package dependencies Windows compatibility
   - CI workflow validation (GitHub Actions matrix)
   - Build tool compatibility (TypeScript, Turbo, Vitest)
   - SQLite path handling
   - Cross-platform file operations (line endings, path resolution, environment variables)

2. **API Architecture Findings**:
   - The @apex/api package is **inherently cross-platform** - it uses:
     - Fastify (cross-platform HTTP server)
     - `ws` package (cross-platform WebSocket)
     - JSON serialization (cross-platform)
     - Node.js event emitters (cross-platform)
   - **No direct file system operations** in the API layer - all path handling delegated to orchestrator
   - **No hardcoded paths** in the API code
   - Path handling uses `projectPath` string parameter passed to orchestrator

3. **Project Test Utilities** (`packages/core/src/test-utils.ts`):
   - `skipOnWindows()`, `skipOnUnix()` - Skip tests on specific platforms
   - `describeWindows()`, `describeUnix()` - Platform-specific test suites
   - `isWindows()`, `isUnix()` - Platform detection
   - `mockPlatform()` - Platform mocking for cross-platform testing
   - `testOnAllPlatforms()` - Run same test on all platforms

4. **Other Tests Using Windows Patterns**:
   - Health endpoint tests (`health-endpoint.test.ts`) use `os.tmpdir()` and `path.join()` correctly
   - All tests use `path.join()` instead of string concatenation
   - Mock orchestrator pattern avoids SQLite issues on Windows

## Decision

### Three-Tier Testing Architecture for API Windows Compatibility

We will implement Windows compatibility testing following the established project patterns:

#### Tier 1: Extend Existing Integration Test

Extend `windows-ci-integration.test.ts` with API-specific validations:

```typescript
describe('API Server Windows Compatibility', () => {
  describe('Server Port Binding', () => {
    it('should bind to localhost on Windows', async () => {
      // Validate server startup works on Windows
      // Test dynamic port allocation
    });

    it('should handle IPv4 and IPv6 localhost correctly', async () => {
      // Windows may handle localhost differently
    });
  });

  describe('WebSocket Compatibility', () => {
    it('should accept WebSocket connections on Windows', async () => {
      // Validate ws package works correctly
    });

    it('should handle WebSocket close events properly', async () => {
      // Windows may have different socket cleanup
    });
  });
});
```

#### Tier 2: Platform-Specific API Test File

Create a new dedicated test file `windows-api-compatibility.test.ts`:

```typescript
// packages/api/src/__tests__/windows-api-compatibility.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createServer } from '../index';
import { isWindows, describeWindows } from '@apexcli/core';
import { WebSocket } from 'ws';
import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs/promises';

describe('Windows API Compatibility Tests', () => {
  // Tests that run on ALL platforms to validate cross-platform behavior

  describe('Temporary Directory Handling', () => {
    it('should create temp directory using os.tmpdir()', async () => {
      const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'apex-api-test-'));
      expect(tempDir).toBeTruthy();
      // Validate path format is correct for current platform
      if (isWindows()) {
        expect(tempDir).toMatch(/^[A-Z]:\\/); // Windows path format
      } else {
        expect(tempDir).toMatch(/^\//); // Unix path format
      }
      await fs.rm(tempDir, { recursive: true, force: true });
    });
  });

  describe('Server Startup', () => {
    it('should start server with dynamic port on any platform', async () => {
      const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'apex-server-test-'));
      await fs.mkdir(path.join(tempDir, '.apex'), { recursive: true });

      const app = await createServer({
        projectPath: tempDir,
        port: 0, // Dynamic port
        silent: true,
      });

      expect(app).toBeDefined();
      await app.close();
      await fs.rm(tempDir, { recursive: true, force: true });
    });
  });

  describe('Health Endpoint Cross-Platform', () => {
    it('should return health response on any platform', async () => {
      const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'apex-health-test-'));
      await fs.mkdir(path.join(tempDir, '.apex'), { recursive: true });

      const app = await createServer({
        projectPath: tempDir,
        port: 0,
        silent: true,
      });

      const response = await app.inject({
        method: 'GET',
        url: '/health',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.status).toBe('ok');

      await app.close();
      await fs.rm(tempDir, { recursive: true, force: true });
    });
  });
});

// Windows-specific test suite
describeWindows('Windows-Only API Tests', () => {
  it('should handle Windows environment variables', () => {
    // USERPROFILE instead of HOME on Windows
    const home = process.env.USERPROFILE || process.env.HOME;
    expect(home).toBeTruthy();
  });

  it('should handle Windows temp path format', () => {
    const tempDir = os.tmpdir();
    // Windows temp paths typically contain backslashes and drive letter
    expect(tempDir).toMatch(/^[A-Z]:/i);
  });
});
```

#### Tier 3: Validate Path Handling in API Responses

Ensure any paths returned in API responses are handled correctly:

```typescript
describe('API Response Path Handling', () => {
  it('should handle projectPath in task responses cross-platform', async () => {
    // Create task via API
    // Validate projectPath in response uses platform-appropriate format
  });

  it('should normalize paths in configuration endpoint', async () => {
    // GET /config should return paths that work on current platform
  });
});
```

### Test Categories and Coverage

| Test Category | Location | Coverage |
|--------------|----------|----------|
| CI/Build Compatibility | `windows-ci-integration.test.ts` | Existing |
| Server Startup | `windows-api-compatibility.test.ts` | New |
| Port Binding | `windows-api-compatibility.test.ts` | New |
| Temp Directory | `windows-api-compatibility.test.ts` | New |
| WebSocket Connectivity | `windows-api-compatibility.test.ts` | New |
| Health Endpoint | `windows-api-compatibility.test.ts` | New |
| Path Format Validation | `windows-api-compatibility.test.ts` | New |
| Environment Variables | `windows-api-compatibility.test.ts` | New |

### File Structure

```
packages/api/src/
├── __tests__/
│   ├── windows-ci-integration.test.ts      # Existing: CI workflow validation
│   ├── windows-api-compatibility.test.ts   # NEW: API server Windows tests
│   ├── health-endpoint.test.ts             # Existing: Uses cross-platform patterns
│   ├── health-integration.test.ts          # Existing
│   └── health-websocket.test.ts            # Existing
├── index.ts                                # API server (no changes needed)
└── index.test.ts                           # Main API tests (already cross-platform)
```

### Implementation Guidelines

1. **Use Project Test Utilities**:
   ```typescript
   import { isWindows, describeWindows, skipOnWindows } from '@apexcli/core';
   ```

2. **Always Use Path Module**:
   ```typescript
   import * as path from 'path';
   const filePath = path.join(tempDir, '.apex', 'config.yaml');
   ```

3. **Use os.tmpdir() for Temp Directories**:
   ```typescript
   import * as os from 'os';
   const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'apex-test-'));
   ```

4. **Handle Environment Variables Cross-Platform**:
   ```typescript
   const home = process.env.HOME || process.env.USERPROFILE;
   ```

5. **Test Server with Dynamic Ports**:
   ```typescript
   const app = await createServer({ projectPath, port: 0, silent: true });
   ```

### No Changes Required to API Source Code

The analysis confirms that `packages/api/src/index.ts`:
- Uses no hardcoded paths
- Uses no platform-specific APIs
- Delegates all file operations to orchestrator
- Uses Fastify (cross-platform)
- Uses ws package (cross-platform)

Therefore, **no source code changes are required** - only additional tests to validate cross-platform behavior.

## Consequences

### Positive

- **Comprehensive Windows CI coverage** for API package
- **Tests validate actual Windows behavior** when run on Windows CI
- **Follows established project patterns** using `@apexcli/core` test utilities
- **No API source code changes required** - API is already cross-platform

### Negative

- **Additional test maintenance** for new test file
- **Some tests may be redundant** with existing cross-platform tests

### Neutral

- **Test runs on all CI platforms** - Windows-specific assertions only activate on Windows
- **Minimal CI time impact** - Tests are lightweight

## Implementation Plan

1. **Create `windows-api-compatibility.test.ts`** with:
   - Server startup tests
   - Temp directory handling tests
   - Health endpoint cross-platform tests
   - WebSocket connectivity tests
   - Windows-specific tests using `describeWindows()`

2. **Extend `windows-ci-integration.test.ts`** (optional) with:
   - API server dependency validation
   - Port binding validation tests

3. **Validate all API tests pass on Windows CI**:
   - Run `npm test --workspace=@apex/api` on Windows
   - Verify no failures in GitHub Actions Windows matrix

## Related Documents

- ADR-0001: Windows Test Compatibility Architecture
- `packages/core/src/test-utils.ts` - Platform test utilities
- `.github/workflows/ci.yml` - CI configuration with Windows matrix

## References

- Existing test: `packages/api/src/__tests__/windows-ci-integration.test.ts`
- Test patterns: `packages/orchestrator/src/daemon-cross-platform.test.ts`
- Test utilities: `packages/core/src/test-utils.ts`
