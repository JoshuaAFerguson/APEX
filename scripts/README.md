# APEX Scripts

This directory contains utility scripts for the APEX project, including test runners, validation tools, and build utilities.

## cleanup-test-directory.mjs

A cross-platform utility that removes `.apex-test` directories from the project.

### Features

- ✅ Cross-platform compatibility (Windows, macOS, Linux)
- ✅ Handles cases where directory doesn't exist gracefully
- ✅ Recursive directory removal
- ✅ Safe error handling
- ✅ Detailed logging
- ✅ Can clean specific paths or search entire project

### Usage

#### Clean all .apex-test directories in project:
```bash
npm run cleanup:test
```

#### Clean specific directory:
```bash
node scripts/cleanup-test-directory.mjs /path/to/.apex-test
```

#### Show help:
```bash
node scripts/cleanup-test-directory.mjs --help
```

### Implementation Details

The utility:

1. **Searches recursively** through the project starting from the project root
2. **Finds all `.apex-test` directories** (skips hidden directories and node_modules for performance)
3. **Removes each directory** using Node.js `fs.rm()` with `recursive: true` and `force: true`
4. **Handles errors gracefully** - missing directories are reported as info, not errors
5. **Provides detailed output** showing what's being removed and the results
6. **Supports both automated and manual cleanup** via different usage patterns

### Error Handling

- **Directory doesn't exist**: Reports as informational message, continues execution
- **Permission errors**: Reports as error, continues with other directories
- **Other filesystem errors**: Reports as error, continues with other directories
- **Script errors**: Exits with non-zero status code for CI/CD integration

### Cross-Platform Notes

- Uses Node.js built-in `fs.rm()` for reliable cross-platform directory removal
- Uses `path` module for cross-platform path handling
- Handles Windows, macOS, and Linux filesystem differences automatically
- Works with both forward and backward slashes in paths

## Test Management Scripts

### `unified-test-runner.js`
**Comprehensive test runner for all test types**

The unified test runner provides a single entry point for running tests with support for filtering, validation, and specialized test configurations.

```bash
# Run all E2E tests
node scripts/unified-test-runner.js --type=e2e

# Run tests for specific package
node scripts/unified-test-runner.js --package=cli

# Run marketplace tests
node scripts/unified-test-runner.js --type=e2e --pattern=marketplace

# Validate test discovery
node scripts/unified-test-runner.js --type=e2e --validate

# List all discovered tests
node scripts/unified-test-runner.js --list
```

**Features:**
- Test type selection (unit, integration, e2e, browser)
- Package filtering
- Pattern matching
- Watch mode support
- Coverage reporting
- Test discovery validation

### `validate-e2e-test-discovery.js`
**Validates E2E test discovery configuration**

Ensures that the vitest.e2e.config.ts properly discovers all E2E tests across the monorepo.

```bash
node scripts/validate-e2e-test-discovery.js
npm run validate:e2e-discovery
```

**Checks:**
- Manual test file discovery using glob patterns
- Vitest configuration validation
- Test runner discovery comparison
- Configuration pattern verification

### `validate-unified-test-runner.js`
**Validates unified test runner setup**

Verifies that all test configurations and unified test runner components are properly installed and configured.

```bash
node scripts/validate-unified-test-runner.js
```

**Validation:**
- Configuration file existence
- Package.json script validation
- Test directory structure
- E2E configuration content validation

### `verify-implementation.js`
**Comprehensive implementation verification**

Final verification script that checks all components of the consolidated E2E test configuration.

```bash
node scripts/verify-implementation.js
```

**Verification:**
- All implementation files present
- npm scripts properly configured
- Test directories accessible
- Configuration content validation
- Test discovery functionality

## Usage in npm Scripts

The unified test runner is integrated into package.json with these commands:

### Primary Commands
```json
{
  "test:unified": "node scripts/unified-test-runner.js",
  "test:unified:e2e": "node scripts/unified-test-runner.js --type=e2e",
  "test:unified:unit": "node scripts/unified-test-runner.js --type=unit",
  "test:unified:integration": "node scripts/unified-test-runner.js --type=integration"
}
```

### Package-Specific Commands
```json
{
  "test:unified:marketplace": "node scripts/unified-test-runner.js --type=e2e --pattern=marketplace",
  "test:unified:cli": "node scripts/unified-test-runner.js --package=cli",
  "test:unified:orchestrator": "node scripts/unified-test-runner.js --package=orchestrator"
}
```

### Validation Commands
```json
{
  "validate:unified-tests": "node scripts/unified-test-runner.js --type=e2e --validate && node scripts/unified-test-runner.js --type=unit --validate",
  "validate:e2e-discovery": "node scripts/validate-e2e-test-discovery.js"
}
```

## Test Configuration Architecture

The scripts work with the following test configuration files:

- **`vitest.e2e.config.ts`** - Primary E2E test configuration with comprehensive discovery
- **`vitest.shared.config.ts`** - Configuration factory for standardized test setups
- **`vitest.unit.config.ts`** - Unit test configuration
- **`vitest.integration.config.ts`** - Integration test configuration
- **`vitest.browser.config.ts`** - Browser automation test configuration

## Implementation Benefits

### Before Consolidation
- Multiple scattered test configurations
- Inconsistent test discovery patterns
- Complex test execution requiring knowledge of specific configs
- No unified validation or monitoring

### After Consolidation
- Single unified E2E test configuration with comprehensive discovery (53+ E2E tests)
- Unified test runner with filtering and validation capabilities
- Consistent execution patterns across all test types
- Comprehensive validation and monitoring tools
- Simplified commands for common testing workflows

## Related Documentation

- [Unified Test Configuration](../docs/UNIFIED_TEST_CONFIGURATION.md) - Complete documentation
- [E2E Test Configuration](../docs/E2E_TEST_CONFIGURATION.md) - E2E-specific details
- [Test README](../tests/README.md) - Test infrastructure overview

## Troubleshooting

### Common Issues

1. **Tests not discovered**: Run `npm run validate:e2e-discovery` to check patterns
2. **Configuration errors**: Run `node scripts/validate-unified-test-runner.js`
3. **Missing dependencies**: Ensure `vitest` and test dependencies are installed
4. **Permission issues**: Make sure scripts are executable: `chmod +x scripts/*.js`

### Debug Commands

```bash
# List all E2E tests without running them
npm run test:unified:list:e2e

# Validate specific test type discovery
node scripts/unified-test-runner.js --type=e2e --validate

# Check implementation completeness
node scripts/verify-implementation.js
```