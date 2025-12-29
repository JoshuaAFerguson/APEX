# Windows Compatibility Tests for TaskStore

## Overview

The `store.windows-compatibility.test.ts` file contains comprehensive tests to ensure the TaskStore module works correctly on Windows systems. These tests are essential for cross-platform compatibility.

## Test Coverage

### Windows Path Handling
- **Windows path separators**: Verifies correct handling of backslashes vs forward slashes
- **Paths with spaces**: Tests database creation in directories with spaces (common on Windows)
- **Drive letter paths**: Validates Windows drive letter format (C:, D:, etc.)
- **Mixed path separators**: Ensures proper normalization of mixed separators

### Windows Config Directory Resolution
- **%APPDATA% directory**: Tests Windows application data directory resolution
- **USERPROFILE vs HOME**: Verifies preference for USERPROFILE environment variable on Windows

### SQLite Database Windows Integration
- **Database creation**: Ensures SQLite database creates successfully on Windows file system
- **WAL mode file locking**: Tests concurrent access using SQLite's WAL journaling mode
- **Invalid characters**: Validates paths don't contain Windows-invalid characters
- **Long path names**: Tests handling of Windows long path limitations

### better-sqlite3 Windows Compatibility
- **Native module**: Verifies the compiled native module works on Windows
- **File permissions**: Tests Windows file system permission handling
- **Database backup**: Ensures database backup operations work correctly

### Windows-specific Edge Cases
- **Case-insensitive file system**: Tests Windows case-insensitive behavior
- **Environment variables**: Validates case-insensitive environment variable handling
- **Line endings**: Ensures CRLF line endings are preserved correctly
- **Unicode characters**: Tests Unicode support in paths and data

### Additional Tests
- **UNC path validation**: Basic validation of network path formats
- **Performance**: Ensures reasonable performance on Windows file system

## Running the Tests

```bash
# Run all orchestrator tests (includes Windows compatibility)
npm test --workspace=@apex/orchestrator

# Run just the Windows compatibility tests
npm test --workspace=@apex/orchestrator -- store.windows-compatibility.test.ts
```

## Platform Detection

The tests automatically detect the current platform using `os.platform()` and adjust behavior accordingly:
- On actual Windows systems, tests use real Windows APIs and paths
- On non-Windows systems, tests mock Windows-specific behavior for validation

## Key Dependencies

- **better-sqlite3**: Native SQLite module that must be properly compiled for Windows
- **Node.js path module**: For cross-platform path handling
- **Node.js os module**: For platform detection

## Notes

These tests ensure that APEX works seamlessly on Windows systems, which is crucial for enterprise adoption where Windows is commonly used for development.