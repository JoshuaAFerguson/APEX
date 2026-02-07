# APEX Scripts

This directory contains utility scripts for the APEX project.

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