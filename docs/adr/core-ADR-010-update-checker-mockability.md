# ADR-010: Update Checker Mockability and Non-blocking Behavior

## Status
Proposed

## Date
2026-03-14

## Context

The v0.6.0 update checker tests (`tests/v060-update-checker.test.ts`) have 10 failing tests due to architectural mismatches between the test expectations and the actual implementation in `packages/core/src/doctor-utils.ts`.

### Current Issues Identified

1. **Fetch Mockability**: The `queryNpmRegistry` function uses a captured reference to `fetch` at module load time, making it difficult to mock with `vi.stubGlobal`:
   ```typescript
   const fetchImpl = (() => {
     try {
       return globalThis.fetch;
     } catch {
       // fallback
     }
   })();
   ```
   The tests use `vi.stubGlobal('fetch', mockFetch)` but the function captures `fetch` before tests run.

2. **Return Type Mismatch**: Tests expect `queryNpmRegistry` to return raw npm registry response format, but the implementation transforms it into `NpmPackageInfo` format:
   - Tests expect: `{ 'dist-tags': {...}, versions: {...} }`
   - Implementation returns: `{ name, version, latestVersion, versions: string[] }`

3. **Error Handling Mismatch**: Tests expect `null` for 404 errors, but implementation returns an object with `error` property.

4. **URL Encoding**: Tests expect unencoded scoped package names (`@apexcli/core`), but implementation URL-encodes them (`@apexcli%2Fcore`).

5. **`satisfiesVersion` Limited Functionality**: Tests expect semver range support (`>=`, `^`, `~`), but implementation only does simple version comparison.

6. **`parseVersionOutput` Limited Patterns**: Regex doesn't capture full semver with build metadata.

## Decision

### 1. Make Fetch Mockable via `globalThis.fetch`

**Current Approach** (Problematic):
```typescript
const fetchImpl = (() => { return globalThis.fetch; })();
// fetchImpl is captured at module load time

const response = await fetchImpl(url, options);
```

**New Approach** (Mockable):
```typescript
// Check globalThis.fetch at call time, not module load time
const response = await globalThis.fetch(url, options);
```

This allows tests to use `vi.stubGlobal('fetch', mockFetch)` effectively since the actual `globalThis.fetch` is looked up at invocation time.

### 2. Update Test Expectations to Match Implementation

Instead of changing the implementation's return type (which would break existing consumers), update tests to expect the transformed `NpmPackageInfo` format:

**Current Test** (Incorrect):
```typescript
expect(result).toEqual(mockPackageInfo); // raw npm format
```

**Updated Test** (Correct):
```typescript
expect(result).toMatchObject({
  name: '@apexcli/core',
  latestVersion: '0.6.1',
  versions: expect.arrayContaining(['0.6.1', '0.6.0', '0.5.0']),
});
```

### 3. Update Error Handling Expectations

For HTTP 404 errors, tests should expect the actual behavior:
- Return `{ error: 'Package not found', ... }` instead of `null`

OR update implementation to return `null` for consistency (simpler for consumers).

**Decision**: Return `null` for network/HTTP errors since that's what consumers expect and handle.

### 4. Enhanced `satisfiesVersion` with Semver Ranges

Add support for common semver range operators:
- `>=X.Y.Z` - greater than or equal
- `>X.Y.Z` - greater than
- `<=X.Y.Z` - less than or equal
- `<X.Y.Z` - less than
- `^X.Y.Z` - caret (compatible with major)
- `~X.Y.Z` - tilde (compatible with minor)
- `X.Y.Z` - exact match

### 5. Improved `parseVersionOutput` Pattern

Update regex to capture full semver including build metadata:
```typescript
/v?(\d+\.\d+\.\d+(?:[-+][\w.-]+)*)/i
```

## Architecture Design

### Component Relationships

```
┌──────────────────────────────────────────────────────────────┐
│                      Test Environment                         │
│  vi.stubGlobal('fetch', mockFetch) ────────────────────────┐ │
└──────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌──────────────────────────────────────────────────────────────┐
│                    doctor-utils.ts                            │
│                                                               │
│  queryNpmRegistry(packageName, options)                       │
│     │                                                         │
│     ├─► Uses globalThis.fetch (mockable via vi.stubGlobal)   │
│     │                                                         │
│     └─► Returns NpmPackageInfo or null                       │
│                                                               │
│  satisfiesVersion(range, version)                             │
│     │                                                         │
│     └─► Supports >=, >, <=, <, ^, ~, exact match             │
│                                                               │
│  parseVersionOutput(output)                                   │
│     │                                                         │
│     └─► Captures full semver including build metadata         │
│                                                               │
│  compareVersionStrings(a, b)                                  │
│     │                                                         │
│     └─► Returns 0 for invalid/empty versions (graceful)      │
└──────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌──────────────────────────────────────────────────────────────┐
│                    update-checker.ts                          │
│                                                               │
│  checkForUpdates(options)                                     │
│     │                                                         │
│     ├─► Non-blocking with configurable timeout                │
│     │                                                         │
│     └─► Uses queryNpmRegistry from doctor-utils               │
└──────────────────────────────────────────────────────────────┘
```

### Implementation Changes Required

#### 1. `doctor-utils.ts` - `queryNpmRegistry`

```typescript
export async function queryNpmRegistry(
  packageName: string,
  options: { registry?: string; timeout?: number } = {}
): Promise<NpmPackageInfo | null> {
  const { registry = 'https://registry.npmjs.org', timeout = 5000 } = options;

  if (!packageName) {
    return null;
  }

  try {
    // Use globalThis.fetch directly for mockability
    if (!globalThis.fetch) {
      return null;
    }

    // Use unencoded package name in URL for scoped packages
    const url = `${registry}/${packageName}`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    const response = await globalThis.fetch(url, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'APEX-doctor/0.6.0',
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      return null;  // Return null for HTTP errors
    }

    const data = await response.json();

    return {
      name: data.name || packageName,
      version: data.version || '',
      latestVersion: data['dist-tags']?.latest || '',
      versions: Object.keys(data.versions || {}),
      deprecated: data.deprecated,
      homepage: data.homepage,
      repository: typeof data.repository === 'string' ? data.repository : data.repository?.url,
    };

  } catch (error) {
    return null;  // Return null for any errors
  }
}
```

#### 2. `doctor-utils.ts` - `satisfiesVersion`

```typescript
export function satisfiesVersion(range: string, version: string): boolean {
  if (!range || !version) {
    return false;
  }

  // Parse range operator and base version
  let operator = '';
  let rangeVersion = range;

  if (range.startsWith('>=')) {
    operator = '>=';
    rangeVersion = range.slice(2);
  } else if (range.startsWith('>')) {
    operator = '>';
    rangeVersion = range.slice(1);
  } else if (range.startsWith('<=')) {
    operator = '<=';
    rangeVersion = range.slice(2);
  } else if (range.startsWith('<')) {
    operator = '<';
    rangeVersion = range.slice(1);
  } else if (range.startsWith('^')) {
    operator = '^';
    rangeVersion = range.slice(1);
  } else if (range.startsWith('~')) {
    operator = '~';
    rangeVersion = range.slice(1);
  }

  const parsedRange = parseSemver(rangeVersion);
  const parsedVersion = parseSemver(version);

  if (!parsedRange || !parsedVersion) {
    return false;
  }

  const comparison = compareVersions(parsedVersion, parsedRange);

  switch (operator) {
    case '>=':
      return comparison >= 0;
    case '>':
      return comparison > 0;
    case '<=':
      return comparison <= 0;
    case '<':
      return comparison < 0;
    case '^':
      // Compatible with major version
      return parsedVersion.major === parsedRange.major && comparison >= 0;
    case '~':
      // Compatible with minor version
      return parsedVersion.major === parsedRange.major &&
             parsedVersion.minor === parsedRange.minor &&
             comparison >= 0;
    default:
      // Exact match
      return comparison === 0;
  }
}
```

#### 3. `doctor-utils.ts` - `parseVersionOutput`

```typescript
export function parseVersionOutput(output: string): string | null {
  if (!output || typeof output !== 'string') {
    return null;
  }

  // Updated pattern to include build metadata
  const patterns = [
    /v?(\d+\.\d+\.\d+(?:[-+][\w.-]+)*)/i,
    /version\s+v?(\d+\.\d+\.\d+(?:[-+][\w.-]+)*)/i,
    /(?:node\.?js|npm|git|python|java)\s+v?(\d+\.\d+\.\d+(?:[-+][\w.-]+)*)/i,
  ];

  for (const pattern of patterns) {
    const match = output.match(pattern);
    if (match && match[1]) {
      return match[1];
    }
  }

  return null;
}
```

#### 4. Test Updates Required

Update test assertions to match actual implementation behavior:

```typescript
// Instead of:
expect(result).toEqual(mockPackageInfo);

// Use:
expect(result?.latestVersion).toBe('0.6.1');
expect(result?.versions).toContain('0.6.0');
```

## Consequences

### Positive
- Tests become reliable and mockable
- Clear separation of concerns
- `satisfiesVersion` becomes useful for actual semver range checking
- Non-breaking changes to existing consumers

### Negative
- Tests need updates to match implementation
- Minor behavior changes in edge cases

### Risks
- Consumers relying on error objects instead of null need updates
- URL encoding removal may affect private registries

## References

- [Vitest Stubbing Globals](https://vitest.dev/api/vi.html#vi-stubglobal)
- [Node.js 18+ fetch API](https://nodejs.org/docs/latest-v18.x/api/globals.html#fetch)
- [Semver Specification](https://semver.org/)
