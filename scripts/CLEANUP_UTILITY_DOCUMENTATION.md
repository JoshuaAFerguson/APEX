# APEX Test Directory Cleanup Utility Documentation

This document provides comprehensive information about the APEX test directory cleanup utilities and how to resolve common issues including permission restrictions.

## Overview

The APEX project includes multiple cleanup utilities for removing `.apex-test` directories that are created during testing. These utilities provide cross-platform compatibility and robust error handling.

## Available Cleanup Methods

### 1. Node.js Script (Primary Method)

**File:** `scripts/cleanup-test-directory.mjs`

**Usage:**
```bash
# Clean up all .apex-test directories
npm run cleanup:test
# or
node scripts/cleanup-test-directory.mjs

# Clean up specific directory
node scripts/cleanup-test-directory.mjs /path/to/.apex-test

# Show help
node scripts/cleanup-test-directory.mjs --help
```

**Features:**
- ✅ Cross-platform (Windows, macOS, Linux)
- ✅ Recursive directory search
- ✅ Enhanced permission error handling
- ✅ Force removal with permission recovery
- ✅ Detailed logging and error reporting

### 2. Shell Script (Unix/Linux/macOS Alternative)

**File:** `scripts/cleanup-test-directory.sh`

**Usage:**
```bash
# Clean up all .apex-test directories
npm run cleanup:test:shell
# or
./scripts/cleanup-test-directory.sh

# Clean up specific directory
./scripts/cleanup-test-directory.sh /path/to/.apex-test

# Show help
./scripts/cleanup-test-directory.sh --help
```

**Features:**
- ✅ Native shell performance
- ✅ Works when Node.js is restricted
- ✅ Color-coded output
- ✅ Permission error recovery
- ✅ No Node.js dependencies

### 3. Windows Batch Script

**File:** `scripts/cleanup-test-directory.bat`

**Usage:**
```cmd
REM Clean up all .apex-test directories
npm run cleanup:test:windows
REM or
scripts\cleanup-test-directory.bat

REM Clean up specific directory
scripts\cleanup-test-directory.bat "C:\path\to\.apex-test"

REM Show help
scripts\cleanup-test-directory.bat --help
```

**Features:**
- ✅ Native Windows batch support
- ✅ Works when Node.js is restricted
- ✅ Windows-specific permission handling
- ✅ Attribute clearing for stubborn files

## Troubleshooting Permission Issues

### Common Permission Errors

1. **EPERM (Operation not permitted)**
2. **EACCES (Permission denied)**
3. **File/directory in use**
4. **Read-only attributes (Windows)**

### Resolution Strategies

#### Automatic Resolution (Built-in)

All cleanup utilities now include automatic permission resolution:

1. **Permission Detection:** Identifies permission-related errors
2. **Permission Recovery:** Attempts to fix permissions before removal
3. **Graceful Fallback:** Continues with other directories if one fails
4. **Manual Guidance:** Provides clear instructions for manual cleanup

#### Manual Resolution

If automatic resolution fails:

**Unix/Linux/macOS:**
```bash
# Fix permissions manually
chmod -R u+w .apex-test
rm -rf .apex-test
```

**Windows:**
```cmd
REM Remove read-only attributes
attrib -r -h -s .apex-test\*.* /s /d
rd /s /q .apex-test
```

### Advanced Troubleshooting

#### Issue: Node.js Execution Restricted

**Symptoms:**
- `node` commands require approval
- Permission denied when running scripts

**Solutions:**
1. Use shell script alternative: `./scripts/cleanup-test-directory.sh`
2. Use batch script on Windows: `scripts\cleanup-test-directory.bat`
3. Manual cleanup using OS commands

#### Issue: Directory in Use

**Symptoms:**
- Cannot remove directory because it's in use
- "Resource busy" errors

**Solutions:**
1. Close any applications using the directory
2. Wait a moment and retry
3. Use force removal options in the scripts

#### Issue: Nested Permission Problems

**Symptoms:**
- Some subdirectories cannot be removed
- Partial cleanup success

**Solutions:**
1. The scripts automatically handle nested permissions
2. Run the cleanup multiple times if needed
3. Check for running processes holding file locks

## Integration with Testing Framework

### Vitest Integration

The cleanup utilities are integrated with Vitest tests:

```typescript
import { cleanupTestDirectories } from '../scripts/cleanup-test-directory.mjs';

beforeEach(async () => {
  await cleanupTestDirectories();
});
```

### Test Isolation

Each test gets a clean environment:
- No leftover test data
- Fresh SQLite databases
- Clean file system state

### Continuous Integration

The cleanup utilities work in CI environments:
- GitHub Actions compatibility
- Windows CI support
- Automatic permission handling

## Performance Characteristics

### Node.js Script
- **Speed:** Fast (uses Node.js fs APIs)
- **Memory:** Low memory usage
- **Compatibility:** Highest compatibility

### Shell Script
- **Speed:** Very fast (native shell commands)
- **Memory:** Minimal memory usage
- **Compatibility:** Unix-like systems only

### Batch Script
- **Speed:** Fast (native Windows commands)
- **Memory:** Minimal memory usage
- **Compatibility:** Windows only

## Security Considerations

### Safe Operations
- Only removes `.apex-test` directories
- Skips system directories (`.git`, `node_modules`)
- Uses safe recursive removal
- Never removes files outside project

### Permission Handling
- Attempts minimal permission changes
- Only modifies permissions for cleanup
- Graceful fallback on permission failures
- Clear logging of all operations

## Examples

### Basic Cleanup
```bash
npm run cleanup:test
```

### Force Cleanup with Shell Script
```bash
# Make script executable first (if needed)
chmod +x scripts/cleanup-test-directory.sh

# Run cleanup
./scripts/cleanup-test-directory.sh
```

### Cleanup Specific Directory
```bash
node scripts/cleanup-test-directory.mjs /Users/username/project/.apex-test
```

### Windows Cleanup
```cmd
scripts\cleanup-test-directory.bat
```

### Integration in Tests
```typescript
import { removeDirectory } from '../scripts/cleanup-test-directory.mjs';

afterEach(async () => {
  await removeDirectory('.apex-test');
});
```

## File Structure

```
scripts/
├── cleanup-test-directory.mjs    # Node.js cleanup utility
├── cleanup-test-directory.sh     # Unix/Linux/macOS shell script
├── cleanup-test-directory.bat    # Windows batch script
└── CLEANUP_UTILITY_DOCUMENTATION.md  # This documentation

tests/integration/
├── cleanup-test-directory.test.ts           # Integration tests
├── cleanup-utilities.integration.test.ts    # Comprehensive tests
└── cleanup-utilities-minimal.test.ts        # Focused tests
```

## Best Practices

1. **Run cleanup between tests** to ensure test isolation
2. **Use the Node.js script by default** for best compatibility
3. **Fall back to shell/batch scripts** if Node.js is restricted
4. **Monitor cleanup logs** for permission issues
5. **Clean up regularly** to prevent disk space issues

## Future Enhancements

- [ ] PowerShell script for enhanced Windows support
- [ ] Integration with test runners
- [ ] Automatic cleanup scheduling
- [ ] Enhanced logging and metrics

## Support

If you encounter issues with the cleanup utilities:

1. Check the troubleshooting section above
2. Review the test integration examples
3. Run with verbose logging to diagnose issues
4. Consider using alternative cleanup methods if one fails

The cleanup utilities are designed to be robust and handle edge cases gracefully, ensuring reliable test environment management across all platforms.