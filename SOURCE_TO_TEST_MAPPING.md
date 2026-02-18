# Source-to-Test Mapping Documentation

This document provides a comprehensive mapping of source files to their corresponding test files with detailed coverage analysis.

## DirectoryAccessValidator (`packages/core/src/directory-access-validator.ts`)

### Source File Analysis

**File Path:** `packages/core/src/directory-access-validator.ts`

#### Exported Classes

##### DirectoryAccessValidator Class
- `isPathAllowed(filePath: string, config: DirectoryAccessConfig, options?: ValidationOptions): PathValidationResult`
- `matchesAllowlist(filePath: string, patterns: string[]): boolean`
- `matchesBlocklist(filePath: string, patterns: string[]): boolean`

#### Private Methods
- `normalizeAndValidatePath(filePath: string, baseDir?: string): string`
- `normalizePath(filePath: string): string`
- `validatePathSecurity(filePath: string): void`
- `matchesAnyPattern(filePath: string, patterns: string[]): boolean`
- `matchesPattern(filePath: string, pattern: string): boolean`

#### Exported Functions
- `isPathAllowed(filePath: string, config: DirectoryAccessConfig, options?: ValidationOptions): PathValidationResult`
- `matchesAllowlist(filePath: string, patterns: string[]): boolean`
- `matchesBlocklist(filePath: string, patterns: string[]): boolean`

#### Exported Constants/Instances
- `directoryAccessValidator: DirectoryAccessValidator` (default instance)

#### Exported Interfaces
- `PathValidationResult`
- `ValidationOptions`

### Test File Mapping

#### Primary Test File
**File:** `packages/core/src/directory-access-validator.test.ts`

**Coverage Status:** ✅ **COMPREHENSIVE** - All public methods and edge cases covered

**Test Categories:**
- Constructor tests ✅
- `isPathAllowed` method:
  - Basic functionality (allowlist, blocklist, defaultAllow behavior) ✅
  - Allowlist matching with glob patterns ✅
  - Blocklist precedence over allowlist ✅
  - Path normalization ✅
  - Error handling (empty paths, null bytes, long paths) ✅
  - Edge cases (undefined arrays, invalid glob patterns) ✅
- `matchesAllowlist` method:
  - Pattern matching ✅
  - Multiple patterns ✅
  - Empty/null pattern arrays ✅
  - Error handling ✅
- `matchesBlocklist` method:
  - Pattern matching ✅
  - Multiple patterns ✅
  - Empty/null pattern arrays ✅
  - Error handling ✅
- Private method coverage (through public API) ✅
- Convenience functions (`isPathAllowed`, `matchesAllowlist`, `matchesBlocklist`) ✅
- Default instance (`directoryAccessValidator`) ✅
- Integration with `DirectoryAccessConfig` types ✅

#### Edge Cases Test File
**File:** `packages/core/src/__tests__/directory-access-validator.edge-cases.test.ts`

**Coverage Status:** ✅ **COMPREHENSIVE** - Advanced scenarios and edge cases

**Test Categories:**
- Nested paths (10+ levels, 20+ levels, intermediate patterns) ✅
- Parent/child directory relationships ✅
- Symlink resolution with `ValidationOptions` ✅
- Complex glob patterns:
  - Negation patterns ✅
  - Extglob patterns (@, +, ?, *, !) ✅
  - Brace expansion ({a,b,c}) ✅
  - Combined patterns ✅
- Path security edge cases:
  - Directory traversal attacks ✅
  - Null byte injection ✅
  - Path length attacks ✅
  - Special characters and escape sequences ✅
  - Unicode and encoding attacks ✅
- Platform-specific path handling:
  - Windows paths ✅
  - Unix paths ✅
  - Cross-platform compatibility ✅
- Additional edge cases:
  - Pattern edge cases ✅
  - Config edge cases ✅
  - Convenience function edge cases ✅

#### Windows-Specific Test File
**File:** `test_artifacts/directory-access-validator-windows.test.ts`

**Coverage Status:** ✅ **SPECIALIZED** - Windows-specific path scenarios

**Test Categories:**
- Windows drive letter paths ✅
- UNC network paths ✅
- Path separator handling (forward/backward slashes) ✅
- Windows special directories (System32, Program Files, etc.) ✅
- Symlink and junction handling ✅
- Path length limits and extended path syntax ✅
- Windows file system edge cases:
  - Reserved names (CON, PRN, AUX, etc.) ✅
  - Paths with spaces ✅
  - 8.3 short names ✅
- Windows security considerations:
  - Directory traversal ✅
  - Alternate data streams ✅
  - Device namespace paths ✅
- Path normalization ✅
- Cross-platform compatibility ✅

### Overall Coverage Assessment
**Status:** ✅ **COMPLETE** - 100% method coverage with comprehensive edge case testing

---

## BrowserPermissionDeniedError (`packages/core/src/tools/browser/browser-permission-denied-error.ts`)

### Source File Analysis

**File Path:** `packages/core/src/tools/browser/browser-permission-denied-error.ts`

#### Exported Classes

##### BrowserPermissionDeniedError Class
- `constructor(message: string, context?: BrowserPermissionDeniedContext, cause?: Error)`
- `isPermissionType(permissionType: BrowserPermissionDeniedContext['permissionType']): boolean`
- `isOperation(operation: string): boolean`
- `getUserFriendlyMessage(): string`
- `getResolutionSuggestions(): string[]`

#### Static Factory Methods
- `fromBrowserPermissionError(permissionName: string, operation: string, target?: string, originalError?: Error): BrowserPermissionDeniedError`
- `forDomainRestriction(domain: string, operation: string, reason: string): BrowserPermissionDeniedError`
- `forDisabledFeature(feature: 'javascript' | 'form' | 'screenshots', operation: string): BrowserPermissionDeniedError`

#### Private Static Methods
- `createEnhancedMessage(baseMessage: string, context: BrowserPermissionDeniedContext): string`
- `mapPermissionName(permissionName: string): BrowserPermissionDeniedContext['permissionType']`

#### Exported Functions
- `isBrowserPermissionDeniedError(error: unknown): error is BrowserPermissionDeniedError`
- `toBrowserPermissionDeniedError(error: Error, context?: BrowserPermissionDeniedContext): BrowserPermissionDeniedError`

#### Exported Types/Interfaces
- `BrowserLifecycleState` type
- `BrowserLifecycleAware` interface
- `BrowserResourceState` interface
- `BrowserPermissionDeniedContext` interface

#### Inherited Methods (from ApexError)
- `getDetails()`
- `toJSON()`
- `toString()`
- `isCategory()`
- `isCode()`

### Test File Mapping

#### Primary Unit Test File
**File:** `packages/core/src/tools/browser/__tests__/browser-permission-denied-error.test.ts`

**Coverage Status:** ✅ **COMPREHENSIVE** - All methods and factory functions covered

**Test Categories:**
- Constructor tests:
  - Minimal parameters ✅
  - With operation context ✅
  - With cause error ✅
  - Prototype chain validation ✅
- Enhanced message creation:
  - Operation inclusion ✅
  - Target inclusion ✅
  - Denial reason inclusion ✅
  - Combined context elements ✅
- Permission type checking:
  - `isPermissionType()` with valid types ✅
  - Undefined permission type handling ✅
- Operation checking:
  - `isOperation()` validation ✅
  - Undefined operation handling ✅
- User-friendly messages:
  - All permission types (geolocation, camera, domain, etc.) ✅
  - Generic messages with operation/reason ✅
  - Fallback messages ✅
- Resolution suggestions:
  - All permission types ✅
  - Custom denial reasons ✅
- Static factory methods:
  - `fromBrowserPermissionError()` ✅
  - `forDomainRestriction()` ✅
  - `forDisabledFeature()` ✅
- Type guards and utilities:
  - `isBrowserPermissionDeniedError()` ✅
  - `toBrowserPermissionDeniedError()` ✅
- Inheritance and error properties:
  - ApexError inheritance ✅
  - Serialization ✅
  - Detailed error information ✅
- Permission type mapping:
  - Standard browser permission names ✅
  - Case insensitive mapping ✅

#### Integration Test File
**File:** `packages/core/src/tools/browser/__tests__/browser-permission-denied-error.integration.test.ts`

**Coverage Status:** ✅ **COMPREHENSIVE** - APEX ecosystem integration

**Test Categories:**
- APEX error system integration:
  - ApexError recognition ✅
  - Safe error response ✅
  - Error context structure ✅
- Error categorization and filtering:
  - Browser error categorization ✅
  - Type guard functionality ✅
- Error chains and causality:
  - Error chain preservation ✅
  - toString with cause information ✅
- Serialization and JSON handling:
  - JSON serialization ✅
  - toJSON method ✅
- Real-world usage scenarios:
  - Domain restriction scenario ✅
  - Disabled feature scenario ✅
  - Browser API permission scenario ✅
- Error code validation:
  - Correct error code range ✅
  - Proper categorization ✅

#### Edge Cases Test File
**File:** `packages/core/src/tools/browser/__tests__/browser-permission-denied-error.edge-cases.test.ts`

**Coverage Status:** ✅ **COMPREHENSIVE** - Boundary conditions and edge cases

**Test Categories:**
- Message enhancement edge cases:
  - Empty strings in context ✅
  - Whitespace-only strings ✅
  - Very long context strings ✅
  - Special characters ✅
  - Unicode characters ✅
- Permission type boundary cases:
  - All defined permission types ✅
  - Undefined permission type ✅
  - Case-sensitive type checking ✅
- Static factory method edge cases:
  - `fromBrowserPermissionError()` with null/undefined errors ✅
  - Error without message ✅
  - Very long permission names ✅
  - Case-insensitive permission mapping ✅
  - `forDomainRestriction()` with empty/malformed domains ✅
  - `forDisabledFeature()` with all feature types ✅
- User-friendly message edge cases:
  - Unknown permission types ✅
  - Operation without reason/permission type ✅
  - Various combinations ✅
- Resolution suggestions edge cases:
  - Unknown permission types with custom reasons ✅
  - Default suggestions ✅
  - All permission types provide suggestions ✅
- Type guard edge cases:
  - Falsy values ✅
  - Fake error objects ✅
  - Subclasses ✅
- Utility function edge cases:
  - Stack trace preservation ✅
  - Error without message ✅
  - Context merging ✅
- Inheritance chain validation:
  - Prototype chain ✅
  - Name property ✅
  - toString method ✅
- BrowserResourceState interface validation ✅
- Concurrent error creation scenarios ✅

### Overall Coverage Assessment
**Status:** ✅ **COMPLETE** - 100% method coverage with comprehensive edge case testing and integration validation

---

## Summary

Both source files have **complete test coverage** with the following characteristics:

### DirectoryAccessValidator
- **3 test files** covering all aspects
- **Complete method coverage** (public and private via public API)
- **Extensive edge case testing** including security scenarios
- **Platform-specific testing** for Windows paths
- **Complex glob pattern testing**

### BrowserPermissionDeniedError
- **3 test files** covering all aspects
- **Complete method coverage** including inherited methods
- **Comprehensive factory method testing**
- **Integration testing** with APEX error system
- **Edge case testing** for boundary conditions
- **Type safety and inheritance validation**

Both implementations demonstrate excellent test discipline with thorough coverage of normal operations, error conditions, edge cases, and integration scenarios.