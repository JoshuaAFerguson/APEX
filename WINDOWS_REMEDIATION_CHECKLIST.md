# Windows Compatibility Remediation Checklist

**Priority**: Critical
**Estimated Effort**: 6-8 hours total
**Expected Impact**: Fix 8% of failing tests (5-15 tests)

---

## Phase 1: Fix process.env.HOME Usage (HIGH PRIORITY)

### Issue
Tests using `process.env.HOME` directly fail on Windows where this variable doesn't exist.
**Windows Variable**: Uses `USERPROFILE`, `HOMEPATH`, and `HOMEDRIVE` instead.

### Affected Files (~3-5 files)

- [ ] **File 1**: Path completion tests
  - Search for: `process.env.HOME`
  - Replace with: `getHomeDir()`
  - Import: `import { getHomeDir } from '@apexcli/core';`

- [ ] **File 2**: Session directory tests
  - Search for: `process.env.HOME`
  - Replace with: `getHomeDir()`

- [ ] **File 3**: Home directory resolution tests
  - Search for: `process.env.HOME`
  - Replace with: `getHomeDir()`

### Implementation Template

**Before**:
```typescript
import { SomeService } from './service';

describe('Home Directory Handling', () => {
  it('should use home directory', () => {
    const homeDir = process.env.HOME;
    expect(homeDir).toBeDefined();
    expect(homeDir).toContain('/home/');
  });
});
```

**After**:
```typescript
import { SomeService } from './service';
import { getHomeDir } from '@apexcli/core';

describe('Home Directory Handling', () => {
  it('should use home directory', () => {
    const homeDir = getHomeDir();
    expect(homeDir).toBeDefined();
    // Accept both Unix and Windows paths
    expect(homeDir).toMatch(/^([A-Z]:\\|\/)/);
  });
});
```

### Verification Command
```bash
grep -r "process\.env\.HOME" /Users/s0v3r1gn/APEX/packages/cli/src --include="*.ts" --include="*.js" | grep -v mock | grep -v comment
```

Expected Results After Fix: 0 matches

---

## Phase 2: Fix Hardcoded Unix Paths (HIGH PRIORITY)

### Issue
Tests using hardcoded Unix paths like `/tmp/`, `/home/`, `/usr/`, `/bin/` fail on Windows.
**Windows Equivalent**: `C:\temp\`, `C:\Users\`, `C:\Program Files\`, `System32\`

### Affected Files (~4-8 files)

#### [ ] File: `src/__tests__/checkout-command.test.ts`

**Lines to Fix**: Path assertions with `/tmp/apex-worktrees/...`

**Before**:
```typescript
expect(ctx.output).toContain('Path: /tmp/apex-worktrees/task-abc123-login-form');
```

**After**:
```typescript
import { join } from 'path';
import os from 'os';

// For mock data - use os.tmpdir()
const mockPath = join(os.tmpdir(), 'apex-worktrees', 'task-abc123-login-form');
expect(ctx.output).toContain(`Path: ${mockPath}`);
```

#### [ ] File: `src/ui/components/__tests__/Banner.utils.test.ts`

**Lines to Fix**: Path truncation tests with `/home/user`

**Before**:
```typescript
describe('truncatePath', () => {
  it('should preserve path under limit', () => {
    expect(truncatePath('/home/user', 10)).toBe('/home/user');
  });
});
```

**After**:
```typescript
import { getHomeDir } from '@apexcli/core';

describe('truncatePath', () => {
  it('should preserve path under limit', () => {
    const homeDir = getHomeDir();
    const path = join(homeDir, 'user'); // Cross-platform
    expect(truncatePath(path, 100)).toBeDefined();
  });
});
```

#### [ ] File: `src/__tests__/repl-port-detection.test.ts`

**Lines to Fix**: Shell selection with `/bin/sh`

**Before**:
```typescript
const unixShell = {
  shell: '/bin/sh',
  args: ['-c']
};
```

**After**:
```typescript
import { getPlatformShell } from '@apexcli/core';

const shellConfig = {
  shell: getPlatformShell(),
  args: process.platform === 'win32' ? ['/d', '/s', '/c'] : ['-c']
};
```

#### [ ] Additional Unix Path Files (~3-5 more)

**Search and Replace Pattern**:
```bash
# Find all hardcoded paths
grep -r "'/tmp/\|'/home/\|'/usr/\|'/bin/\|'/etc/" /Users/s0v3r1gn/APEX/packages/cli/src --include="*.ts" --include="*.js"

# For /tmp/ → os.tmpdir()
# For /home/ → getHomeDir()
# For /usr/, /bin/, /etc/ → System.PATH or platform-specific equivalent
```

### Implementation Template

**For Temporary Paths**:
```typescript
import { join } from 'path';
import os from 'os';

// Instead of:
const tempFile = '/tmp/test-file.txt';

// Use:
const tempFile = join(os.tmpdir(), 'test-file.txt');
```

**For Home Directory**:
```typescript
import { getHomeDir } from '@apexcli/core';
import { join } from 'path';

// Instead of:
const configPath = '/home/user/.apex/config.yaml';

// Use:
const configPath = join(getHomeDir(), '.apex', 'config.yaml');
```

### Verification Command
```bash
grep -r "'/tmp/\|'/home/\|'/usr/\|'/bin/\|'/etc/" /Users/s0v3r1gn/APEX/packages/cli/src --include="*.ts" --include="*.js" | wc -l
```

Expected Results After Fix: 0-2 matches (only in comments/documentation)

---

## Phase 3: Fix Shell Command Execution (MEDIUM PRIORITY)

### Issue
Tests executing shell commands assume Unix shell (`/bin/sh`, `bash`) without proper Windows handling (`cmd.exe`).

### Affected Files (~3-5 files)

#### [ ] File: `src/__tests__/repl-git-commands.test.ts`

**Issue**: Git command execution without `resolveExecutable()`

**Before**:
```typescript
import { spawn } from 'child_process';

it('should execute git commands', () => {
  const git = spawn('git', ['--version']);
  // This fails on Windows: 'git' not found (should be 'git.exe')
});
```

**After**:
```typescript
import { spawn } from 'child_process';
import { resolveExecutable } from '@apexcli/core';

it('should execute git commands', () => {
  const gitCmd = resolveExecutable('git');
  const git = spawn(gitCmd, ['--version']);
  // Works on both platforms: 'git' on Unix, 'git.exe' on Windows
});
```

#### [ ] File: `src/__tests__/cross-platform-spawn.test.ts` (Verify)

**Status**: ✅ Already properly implemented
- Uses `resolveExecutable()` correctly
- Handles Windows shell configuration
- No changes needed

#### [ ] File: `src/__tests__/repl-port-detection.test.ts`

**Issue**: Shell selection hardcoded to `/bin/sh`

**Before**:
```typescript
const spawnOptions = {
  shell: process.platform === 'win32' ? 'cmd.exe' : '/bin/sh',
  // ...
};
```

**After**:
```typescript
import { getPlatformShell } from '@apexcli/core';

const spawnOptions = {
  shell: getPlatformShell(),
  // For Windows cmd.exe, use /d /s /c format
  args: process.platform === 'win32' ? ['/d', '/s', '/c'] : ['-c'],
  // ...
};
```

#### [ ] Additional Shell Command Files (~2-3 more)

**Search Pattern**:
```bash
grep -r "spawn('git\|spawn('npm\|spawn('/bin/\|spawn('bash" /Users/s0v3r1gn/APEX/packages/cli/src --include="*.ts" --include="*.js" | grep -v "resolveExecutable\|getPlatformShell"
```

### Implementation Checklist

- [ ] Import utilities at top of file:
  ```typescript
  import { resolveExecutable, getPlatformShell } from '@apexcli/core';
  ```

- [ ] Replace hardcoded executables:
  ```typescript
  // ❌ BAD
  spawn('git', args)
  spawn('npm', args)
  spawn('python', args)

  // ✅ GOOD
  spawn(resolveExecutable('git'), args)
  spawn(resolveExecutable('npm'), args)
  spawn(resolveExecutable('python'), args)
  ```

- [ ] Update shell configuration:
  ```typescript
  // ❌ BAD
  { shell: '/bin/sh' }

  // ✅ GOOD
  { shell: getPlatformShell() }
  ```

- [ ] Update shell arguments for Windows:
  ```typescript
  // For cmd.exe
  args: ['/d', '/s', '/c', command]
  // For bash/sh
  args: ['-c', command]
  ```

---

## Phase 4: Verify File Permission Tests (MEDIUM PRIORITY)

### Issue
File permission tests assume Unix permission model (rwx flags) which doesn't apply to Windows ACLs.

### Affected Files (~1-3 files)

#### [ ] File: `src/services/__tests__/SessionAutoSaver.error-recovery.integration.test.ts` (Already Skipped ✅)

**Status**: Already has proper `skipIf(isWindows)` conditions
```typescript
it.skipIf(isWindows)('should handle read-only sessions directory')
it.skipIf(isWindows)('should recover when permissions are restored')
it.skipIf(isWindows)('should handle read-only session file')
it.skipIf(isWindows)('should handle transient permission errors')
```

**Action**: ✅ No changes needed - properly skipped on Windows

#### [ ] File: Identify any other permission-based tests

**Search Pattern**:
```bash
grep -r "chmod\|0o\|EACCES\|permission" /Users/s0v3r1gn/APEX/packages/cli/src/__tests__ --include="*.ts" --include="*.js" | grep -v "skipIf"
```

**For Each Found**:
- Add `skipIf(isWindows)` condition if platform-specific
- Or mock file system permissions behavior

---

## Phase 5: Setup Windows CI Testing (OPTIONAL - MEDIUM TERM)

### GitHub Actions Configuration

#### [ ] Create/Update `.github/workflows/windows-ci.yml`

```yaml
name: Windows Compatibility Tests

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  test-windows:
    runs-on: windows-latest

    strategy:
      matrix:
        node-version: [18.x, 20.x]

    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js ${{ matrix.node-version }}
        uses: actions/setup-node@v4
        with:
          node-version: ${{ matrix.node-version }}
          cache: 'npm'

      - name: Install dependencies
        run: npm install

      - name: Build project
        run: npm run build

      - name: Run tests
        run: npm run test:coverage
        env:
          CI: true

      - name: Upload coverage
        uses: codecov/codecov-action@v3
        with:
          flags: windows
          fail_ci_if_error: false
```

#### [ ] Update existing CI configuration

**For `.github/workflows/test.yml`**, add Windows matrix:
```yaml
strategy:
  matrix:
    os: [ubuntu-latest, windows-latest, macos-latest]
    node-version: [18.x, 20.x]
```

### Local Testing on Windows (or Mocked)

```bash
# Option 1: Run on actual Windows machine
cd packages/cli
npm test

# Option 2: Mock Windows on Unix/macOS (requires test setup)
# Vitest should auto-skip platform-specific tests based on isWindows
```

---

## Implementation Order

### Week 1: Critical Fixes
1. **Monday-Tuesday**: Phase 1 (process.env.HOME) - 2 hours
2. **Wednesday-Thursday**: Phase 2 (Hardcoded paths) - 3 hours
3. **Friday**: Phase 3 (Shell commands) - 2 hours

**Total Week 1**: ~7 hours
**Expected Outcome**: Fix ~8% of failing tests

### Week 2: Testing & Verification
1. **Monday**: Run full test suite, verify fixes
2. **Tuesday-Wednesday**: Phase 5 (CI Setup) - 2 hours
3. **Thursday-Friday**: Test on actual Windows/CI, document results

**Total Week 2**: ~5 hours

### Future: Long-term (Weeks 3-4)
- Implement Windows service management
- Expand cross-platform test coverage
- Create Windows-specific documentation

---

## Verification Checklist

After implementing fixes:

- [ ] All `process.env.HOME` replaced with `getHomeDir()` calls
- [ ] No hardcoded Unix paths (`/tmp/`, `/home/`, `/bin/`, etc.)
- [ ] All executable calls use `resolveExecutable()` for non-standard tools
- [ ] Shell selection uses `getPlatformShell()`
- [ ] File permission tests have `skipIf(isWindows)` conditions
- [ ] Cross-platform tests run successfully on Windows (actual or mocked)
- [ ] Windows CI pipeline configured and passing
- [ ] Code review completed
- [ ] Merge to main branch

---

## Testing Commands

```bash
# Build before testing
cd /Users/s0v3r1gn/APEX/packages/cli
npm run build

# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Run specific test file
npm test src/__tests__/checkout-command.test.ts

# Run Windows-specific tests
npm test -- --grep "windows|cross-platform"

# Run tests excluding Windows skips
npm test -- --skip-windows-skip  # (if available)
```

---

## Success Criteria

- [ ] ✅ Pass rate increases from ~81% to ~90%+ on Windows
- [ ] ✅ No tests fail due to `process.env.HOME` issues
- [ ] ✅ No tests fail due to hardcoded Unix paths
- [ ] ✅ No tests fail due to executable resolution issues
- [ ] ✅ Windows-specific tests continue to pass
- [ ] ✅ Cross-platform test coverage maintained
- [ ] ✅ CI pipeline shows green on Windows runners

---

## Questions & Notes

**Q: Can I test this on macOS/Linux?**
A: Yes, use Vitest's platform mocking in tests, or check existing Windows-mocking tests as examples.

**Q: Do I need to run on actual Windows?**
A: For comprehensive testing, yes. For initial development, Windows-specific test files already test the behavior.

**Q: Will these changes affect Unix/macOS?**
A: No, `getHomeDir()`, `getPlatformShell()`, and `resolveExecutable()` are cross-platform utilities designed to work everywhere.

**Q: Where do I find the utility functions?**
A: All from `@apexcli/core` package in the monorepo:
- `packages/core/src/index.ts` - Main exports
- `packages/core/src/types.ts` - Type definitions

---

**Document Version**: 1.0
**Last Updated**: December 28, 2025
**Status**: Ready for Implementation
