# ADR-0010: Comprehensive Windows Path Handling Tests

## Status
Proposed

## Context

The APEX project requires comprehensive Windows path handling tests to ensure cross-platform compatibility. The acceptance criteria specify testing for:

1. Windows drive letter paths (C:\)
2. UNC paths (\\server\share)
3. Paths with spaces
4. Mixed separator handling
5. `path.join`/`path.resolve` behavior on Windows

### Current State Analysis

The codebase already has several Windows-related test files:

| File | Purpose | Approach |
|------|---------|----------|
| `path-utils-windows.test.ts` | Integration tests for path-utils on actual Windows | Skips on non-Windows platforms |
| `config-windows.test.ts` | Config loading/saving on Windows | Skips on non-Windows platforms |
| `shell-utils-windows.test.ts` | Shell utilities on Windows | Skips on non-Windows platforms |
| `windows-cross-module.integration.test.ts` | Cross-module integration | Uses `describe.skipIf` |
| `config-cross-platform-paths.test.ts` | Cross-platform path testing | Uses `mockPlatform()` helper |
| `test-utils.ts` | Platform mocking utilities | Provides `mockPlatform()`, `isWindows()`, etc. |

### Gap Analysis

While existing tests cover many Windows scenarios, they have gaps:

1. **Drive Letter Paths**: Partially covered but needs more edge cases (network drives, relative from drive root)
2. **UNC Paths**: Basic coverage exists but needs comprehensive testing of:
   - Long UNC paths
   - UNC with special characters
   - UNC path normalization
3. **Paths with Spaces**: Some coverage but needs systematic testing across all path functions
4. **Mixed Separators**: Partially covered, needs more comprehensive cross-platform mocking tests
5. **`path.join`/`path.resolve` Behavior**: Not explicitly tested - relies on Node.js behavior

## Decision

### Architecture Approach

We will create a **new comprehensive test file** that focuses specifically on the acceptance criteria while leveraging existing test utilities. The test file will use a **dual testing strategy**:

1. **Mock-based tests**: Run on all platforms using `mockPlatform()` to simulate Windows behavior
2. **Integration tests**: Run only on actual Windows systems for real-world validation

### Test File Structure

```
packages/core/src/__tests__/
├── windows-path-handling-comprehensive.test.ts  # NEW - Main comprehensive test suite
├── path-utils-windows.test.ts                   # Existing - Windows integration only
├── config-cross-platform-paths.test.ts          # Existing - Cross-platform mock tests
└── test-utils.ts                                # Existing - Platform mocking utilities
```

### Test Categories

#### 1. Windows Drive Letter Paths (C:\)
```typescript
describe('Windows Drive Letter Paths', () => {
  // Standard drive letters: C:\, D:\, E:\, etc.
  // Network-mapped drives: Z:\
  // Drive root references: C:\ vs C:
  // Relative paths from drive root: C:relative\path
  // Case sensitivity: C:\ vs c:\
});
```

#### 2. UNC Paths (\\server\share)
```typescript
describe('UNC Paths', () => {
  // Basic UNC: \\server\share
  // UNC with nested paths: \\server\share\folder\file.txt
  // UNC with IP addresses: \\192.168.1.1\share
  // UNC with IPv6: \\[::1]\share
  // Long UNC prefix: \\?\UNC\server\share
  // UNC with special characters: \\server\sha re (spaces)
});
```

#### 3. Paths with Spaces
```typescript
describe('Paths with Spaces', () => {
  // Directory names with spaces: C:\Program Files\App
  // File names with spaces: document file.txt
  // Multiple spaces: C:\folder  with   spaces\file.txt
  // Leading/trailing spaces: C:\ folder \file.txt
  // Spaces in UNC paths: \\server\sha re\file.txt
});
```

#### 4. Mixed Separator Handling
```typescript
describe('Mixed Separator Handling', () => {
  // Forward slashes: C:/Users/test/file.txt
  // Mixed slashes: C:\Users/test\file.txt
  // Multiple consecutive slashes: C:\\\\Users\\\\test
  // Trailing slashes: C:\Users\test\ vs C:\Users\test
  // UNC with forward slashes: //server/share
});
```

#### 5. path.join/path.resolve Behavior
```typescript
describe('Node.js Path Module Behavior', () => {
  // path.join with drive letters
  // path.resolve with relative paths
  // path.normalize edge cases
  // path.dirname/path.basename on Windows paths
  // path.isAbsolute detection
});
```

### Mock-Based Testing Strategy

For cross-platform testing, we will use the existing `mockPlatform()` utility from `test-utils.ts`:

```typescript
import { mockPlatform, PLATFORMS } from '../test-utils.js';

describe('Windows path handling (mocked)', () => {
  let restorePlatform: () => void;

  beforeEach(() => {
    restorePlatform = mockPlatform(PLATFORMS.WINDOWS);
  });

  afterEach(() => {
    restorePlatform();
  });

  it('should handle Windows paths correctly', () => {
    // Tests run on any platform but simulate Windows
  });
});
```

### Integration with Existing Code

The tests will validate the following existing functions:

- `normalizePath()` from `path-utils.ts`
- `getHomeDir()` from `path-utils.ts`
- `getConfigDir()` from `path-utils.ts`
- Path handling in `config.ts` functions
- Shell command escaping in `shell-utils.ts`

### Test Data Organization

Create a shared test data file for consistent test cases:

```typescript
// windows-path-test-data.ts
export const WINDOWS_PATH_TEST_CASES = {
  driveLetters: [
    { input: 'C:\\Users\\test', expected: 'C:\\Users\\test', description: 'Standard drive path' },
    { input: 'D:\\', expected: 'D:\\', description: 'Drive root' },
    // ... more cases
  ],
  uncPaths: [
    { input: '\\\\server\\share', expected: '\\\\server\\share', description: 'Basic UNC' },
    // ... more cases
  ],
  pathsWithSpaces: [
    { input: 'C:\\Program Files\\App', expected: 'C:\\Program Files\\App', description: 'Standard spaces' },
    // ... more cases
  ],
  mixedSeparators: [
    { input: 'C:/Users/test', expectedNormalized: 'C:\\Users\\test', description: 'Forward slashes' },
    // ... more cases
  ],
};
```

## Consequences

### Positive

1. **Comprehensive coverage**: All acceptance criteria are systematically tested
2. **Cross-platform validation**: Mock tests run on CI across all platforms
3. **Real-world validation**: Integration tests validate actual Windows behavior
4. **Maintainability**: Shared test data reduces duplication
5. **Documentation**: Test cases serve as documentation for Windows path handling

### Negative

1. **Test execution time**: Additional tests increase CI time slightly
2. **Maintenance burden**: Windows-specific edge cases may need updates as Node.js evolves

### Risks

1. **Mock fidelity**: Mock-based tests may not catch all real Windows quirks
   - Mitigation: Also run integration tests on actual Windows CI

2. **Node.js version differences**: Path handling may vary across Node.js versions
   - Mitigation: Test on multiple Node.js versions in CI

## Implementation Plan

### Phase 1: Test Data and Utilities
1. Create `windows-path-test-data.ts` with comprehensive test cases
2. Enhance `test-utils.ts` if needed for Windows-specific mocking

### Phase 2: Comprehensive Test Suite
1. Create `windows-path-handling-comprehensive.test.ts`
2. Implement all five test categories
3. Use both mock and integration approaches

### Phase 3: Validation
1. Run tests on macOS/Linux with mocks
2. Run tests on Windows CI
3. Verify all acceptance criteria are met

## References

- [Node.js Path Module Documentation](https://nodejs.org/api/path.html)
- [Windows File Path Formats](https://docs.microsoft.com/en-us/windows/win32/fileio/naming-a-file)
- [UNC Path Format](https://docs.microsoft.com/en-us/openspecs/windows_protocols/ms-dtyp/62e862f4-2a51-452e-8eeb-dc4ff5ee33cc)
- Existing test files:
  - `packages/core/src/__tests__/path-utils-windows.test.ts`
  - `packages/core/src/__tests__/config-cross-platform-paths.test.ts`
  - `packages/core/src/test-utils.ts`
