# E2E Test Debugging & Troubleshooting Guide

> Comprehensive guide for debugging E2E test failures, performance issues, and environment problems in APEX.

## Table of Contents

- [Quick Debugging Checklist](#quick-debugging-checklist)
- [Debug Mode & Logging](#debug-mode--logging)
- [Common Failure Patterns](#common-failure-patterns)
- [Environment Issues](#environment-issues)
- [Test Isolation Problems](#test-isolation-problems)
- [Performance Debugging](#performance-debugging)
- [CI/CD Debugging](#cicd-debugging)
- [Advanced Debugging Techniques](#advanced-debugging-techniques)
- [Tools & Commands](#tools--commands)
- [Prevention Strategies](#prevention-strategies)

---

## Quick Debugging Checklist

When an E2E test fails, go through this checklist in order:

### ✅ Basic Checks (2 minutes)

```bash
# 1. Check if CLI is built
ls packages/cli/dist/index.js  # Should exist

# 2. Check git availability
git --version  # Should work

# 3. Check Node.js version
node --version  # Should be 18+ or 20+

# 4. Run build if needed
npm run build

# 5. Try running the failing test in isolation
npm test -- tests/e2e/failing-test.e2e.test.ts --reporter=verbose
```

### ✅ Environment Checks (3 minutes)

```bash
# 1. Check for orphaned processes
ps aux | grep apex
ps aux | grep node | grep cli

# 2. Check port conflicts
lsof -i :3000  # API default port
lsof -i :8080  # Alternative port

# 3. Clean up temporary directories
npm run cleanup:test

# 4. Check disk space
df -h  # Unix/Linux/macOS
dir C:\  # Windows

# 5. Check permissions
ls -la /tmp  # Unix/Linux/macOS - should be writable
```

### ✅ Debug Mode (5 minutes)

```bash
# Enable debug output and run the failing test
DEBUG=1 npm test -- tests/e2e/failing-test.e2e.test.ts --reporter=verbose

# Look for specific patterns in output:
# - "Command failed:" (CLI execution issues)
# - "Timeout:" (timing issues)
# - "Permission denied:" (filesystem issues)
# - "EADDRINUSE:" (port conflicts)
# - "git:" (git command issues)
```

---

## Debug Mode & Logging

### Enable Debug Mode

APEX E2E tests support multiple levels of debug output:

```bash
# Basic debug mode (recommended first step)
DEBUG=1 npm run test:e2e

# Specific test with debug
DEBUG=1 npm test -- tests/e2e/specific.test.ts

# Verbose reporter for detailed output
npm test -- tests/e2e/specific.test.ts --reporter=verbose

# Combined debug and verbose
DEBUG=1 npm test -- tests/e2e/specific.test.ts --reporter=verbose
```

### Debug Output Sections

When `DEBUG=1` is set, you'll see:

#### 1. Test Environment Creation

```bash
[DEBUG test-environment] Creating temp directory: /tmp/apex-e2e-xyz123
[DEBUG test-environment] Initializing git repository
[DEBUG test-environment] Creating APEX project structure
[DEBUG test-environment] Seeding test data: full scenario
```

#### 2. CLI Command Execution

```bash
[DEBUG cli-execution] Running: apex init --yes
[DEBUG cli-execution] Working directory: /tmp/apex-e2e-xyz123
[DEBUG cli-execution] Command completed in 2.3s
[DEBUG cli-execution] Exit code: 0
[DEBUG cli-execution] stdout: Project initialized successfully
[DEBUG cli-execution] stderr: (empty)
```

#### 3. Resource Management

```bash
[DEBUG resource-cleanup] Registering orchestrator for cleanup
[DEBUG resource-cleanup] Registering server for cleanup
[DEBUG resource-cleanup] Starting cleanup process
[DEBUG resource-cleanup] Cleaning orchestrators: 1 found
[DEBUG resource-cleanup] Cleaning servers: 1 found
[DEBUG resource-cleanup] Cleaning temp directories: 3 found
```

#### 4. Git Operations

```bash
[DEBUG git-operations] Creating branch: feature/test-123
[DEBUG git-operations] Switching to branch: main
[DEBUG git-operations] Merging branch: feature/test-123
[DEBUG git-operations] Branch merge completed
```

### Custom Debug Helpers

Add custom debug output to your tests:

```typescript
function debugLog(category: string, message: string, data?: any) {
  if (process.env.DEBUG) {
    const timestamp = new Date().toISOString();
    console.log(`[DEBUG ${category}] ${timestamp}: ${message}`);
    if (data) {
      console.log(JSON.stringify(data, null, 2));
    }
  }
}

// Usage in tests
it('should debug test execution', async () => {
  debugLog('test-start', 'Beginning test execution');

  const result = await runCLI('init --yes', env.path);
  debugLog('cli-result', 'CLI execution completed', {
    success: result.success,
    exitCode: result.exitCode,
    duration: result.duration
  });

  expect(result.success).toBe(true);
});
```

---

## Common Failure Patterns

### Pattern 1: CLI Binary Not Found

**Symptoms**:
```bash
Error: spawn ENOENT
Command not found: /path/to/packages/cli/dist/index.js
```

**Debugging Steps**:
```bash
# 1. Check if CLI binary exists
ls -la packages/cli/dist/index.js

# 2. Check if it's executable
ls -la packages/cli/dist/index.js | grep 'x'

# 3. Try running directly
node packages/cli/dist/index.js --version

# 4. Check build output
npm run build 2>&1 | grep -i error

# 5. Check TypeScript compilation
npm run typecheck
```

**Solutions**:
```bash
# Rebuild the project
npm run clean && npm run build

# Check for TypeScript errors
npm run typecheck

# Verify package.json scripts
grep -A5 -B5 '"build"' package.json
```

### Pattern 2: Git Command Failures

**Symptoms**:
```bash
git: command not found
fatal: not a git repository
error: pathspec 'branch-name' did not match any file(s) known to git
```

**Debugging Steps**:
```bash
# 1. Check git availability
git --version

# 2. Check git configuration
git config --list

# 3. Verify repository state
cd /tmp/apex-e2e-xyz123  # Test environment path
git status
git branch -a
git remote -v

# 4. Check git identity (required for commits)
git config user.name
git config user.email
```

**Solutions**:
```bash
# Set git identity if missing
git config --global user.name "Test User"
git config --global user.email "test@example.com"

# Verify repository initialization
if [ ! -d .git ]; then
  git init
  git add .
  git commit -m "Initial commit"
fi

# Check branch creation
git checkout -b test-branch || echo "Branch already exists"
```

### Pattern 3: Timeout Issues

**Symptoms**:
```bash
Test timed out after 30000ms
Operation took longer than expected
Command did not complete within timeout
```

**Debugging Steps**:
```bash
# 1. Run with extended timeout
DEBUG=1 timeout 120s npm test -- tests/e2e/slow-test.ts

# 2. Profile test execution
time npm test -- tests/e2e/slow-test.ts

# 3. Check system resources during test
# In another terminal while test runs:
top  # or htop
iostat 1  # Check disk I/O
free -h  # Check memory usage
```

**Solutions**:
```typescript
// Increase timeout for specific tests
it('should handle slow operation', { timeout: 60000 }, async () => {
  // Test logic
});

// Add timeout to describe block
describe('Slow Operations', { timeout: 90000 }, () => {
  // All tests in this block get 90s timeout
});

// Use waitFor with proper timeout
await waitFor(
  () => checkCondition(),
  { timeout: 45000, interval: 2000 }
);
```

### Pattern 4: Permission Errors

**Symptoms**:
```bash
EACCES: permission denied, mkdir '/tmp/apex-e2e-xyz123'
EPERM: operation not permitted, rmdir '/tmp/apex-e2e-xyz123'
```

**Debugging Steps**:
```bash
# 1. Check temporary directory permissions
ls -la /tmp | grep apex-e2e

# 2. Check if files are still in use
lsof +D /tmp/apex-e2e-xyz123

# 3. Check process ownership
ps aux | grep apex

# 4. Check filesystem
df -h
mount | grep tmp
```

**Solutions**:
```bash
# Fix permissions (Unix/Linux/macOS)
sudo chown -R $USER /tmp/apex-e2e-*
chmod -R 755 /tmp/apex-e2e-*

# Kill processes using the directories
lsof +D /tmp/apex-e2e-xyz123 | awk 'NR>1 {print $2}' | xargs -r kill

# Clean up manually
rm -rf /tmp/apex-e2e-*

# On Windows (run as Administrator)
takeown /r /d y /f C:\temp\apex-e2e-*
icacls C:\temp\apex-e2e-* /grant %username%:F /t
rmdir /s C:\temp\apex-e2e-*
```

### Pattern 5: Database Lock Issues

**Symptoms**:
```bash
Error: SQLITE_BUSY: database is locked
Cannot create table: database is locked
SQLITE_CANTOPEN: unable to open database file
```

**Debugging Steps**:
```bash
# 1. Check for running orchestrator processes
ps aux | grep orchestrator
ps aux | grep apex

# 2. Check database files and locks
ls -la .apex/apex.db*
lsof .apex/apex.db

# 3. Check database integrity
sqlite3 .apex/apex.db "PRAGMA integrity_check;"
sqlite3 .apex/apex.db "PRAGMA journal_mode;"
```

**Solutions**:
```bash
# Close all connections first
pkill -f orchestrator
pkill -f apex

# Remove lock files
rm -f .apex/apex.db-wal
rm -f .apex/apex.db-shm

# If corrupted, remove and recreate
rm -f .apex/apex.db
# Test will recreate database automatically

# In tests, ensure proper cleanup
afterEach(async () => {
  if (orchestrator) {
    await orchestrator.shutdown();  // This closes DB connection
    orchestrator = null;
  }
  await env.cleanup();
});
```

---

## Environment Issues

### Node.js Version Issues

**Problem**: Tests failing with Node.js version mismatches.

**Detection**:
```bash
# Check Node.js version
node --version

# Check package.json requirements
grep -A5 -B5 '"engines"' package.json

# Check npm version compatibility
npm --version
```

**Solutions**:
```bash
# Use nvm to switch versions
nvm install 20
nvm use 20

# Or install specific version
# macOS: brew install node@20
# Ubuntu: sudo apt-get install nodejs npm
```

### Platform-Specific Issues

#### Windows-Specific Problems

**Common Issues**:
- Path separators (`\` vs `/`)
- Command execution differences
- Permission model differences
- Line ending issues (CRLF vs LF)

**Debugging**:
```bash
# Check line endings
git config core.autocrlf

# Check path handling in tests
echo $PATH  # PowerShell: $env:PATH

# Check command execution
where node  # PowerShell: Get-Command node
where git   # PowerShell: Get-Command git
```

**Solutions**:
```typescript
// Use cross-platform path handling
import * as path from 'path';
const configPath = path.join(env.path, '.apex', 'config.yaml');

// Use cross-platform command execution
const isWindows = process.platform === 'win32';
const command = isWindows ? 'dir' : 'ls';
```

#### macOS-Specific Problems

**Common Issues**:
- Case-sensitive filesystem differences
- Permission differences with System Integrity Protection

**Solutions**:
```bash
# Check filesystem case sensitivity
diskutil info / | grep "File System"

# Handle case sensitivity in tests
# Always use consistent casing for filenames
```

#### Linux-Specific Problems

**Common Issues**:
- Permission differences
- Missing dependencies
- Different temporary directory locations

**Solutions**:
```bash
# Check temp directory
echo $TMPDIR
ls -la /tmp

# Install missing dependencies
sudo apt-get update
sudo apt-get install git nodejs npm
```

---

## Test Isolation Problems

### Shared State Issues

**Problem**: Tests affecting each other due to shared state.

**Detection**:
```bash
# Run tests individually (should pass)
npm test -- tests/e2e/test1.test.ts
npm test -- tests/e2e/test2.test.ts

# Run tests together (might fail)
npm test -- tests/e2e/test1.test.ts tests/e2e/test2.test.ts
```

**Solutions**:
```typescript
// Ensure each test gets fresh environment
describe('E2E: Feature Tests', () => {
  let env: TestEnvironment;

  beforeEach(async () => {
    // Fresh environment for EACH test
    env = await createTestEnvironment({
      initGit: true,
      initApexProject: true,
      apexOptions: {
        projectName: `test-${Date.now()}-${Math.random()}`
      }
    });
  });

  afterEach(async () => {
    // Clean up EVERY time
    try {
      await env.cleanup();
    } catch (error) {
      console.warn('Cleanup warning:', error.message);
    }
  });
});
```

### Resource Cleanup Issues

**Problem**: Resources not properly cleaned up between tests.

**Detection**:
```bash
# Check for orphaned processes
ps aux | grep apex | grep -v grep

# Check for leftover directories
find /tmp -name "apex-e2e-*" -type d

# Check for open database connections
lsof | grep apex.db
```

**Solutions**:
```typescript
// Comprehensive cleanup pattern
describe('E2E: Resource Management', () => {
  const resources: {
    orchestrators: ApexOrchestrator[];
    servers: FastifyInstance[];
    stores: TaskStore[];
  } = {
    orchestrators: [],
    servers: [],
    stores: []
  };

  afterEach(async () => {
    // Clean up in reverse order
    for (const server of resources.servers) {
      try {
        await server.close();
      } catch (error) {
        console.warn('Server cleanup error:', error);
      }
    }

    for (const orchestrator of resources.orchestrators) {
      try {
        await orchestrator.shutdown();
      } catch (error) {
        console.warn('Orchestrator cleanup error:', error);
      }
    }

    for (const store of resources.stores) {
      try {
        await store.close();
      } catch (error) {
        console.warn('Store cleanup error:', error);
      }
    }

    // Reset arrays
    resources.orchestrators.length = 0;
    resources.servers.length = 0;
    resources.stores.length = 0;
  });

  it('should track and clean up resources', async () => {
    const orchestrator = new ApexOrchestrator({ projectRoot: env.path });
    resources.orchestrators.push(orchestrator);

    // Test logic...
  });
});
```

---

## Performance Debugging

### Slow Test Execution

**Problem**: Tests taking too long to execute.

**Diagnosis**:
```bash
# Profile test execution
time npm test -- tests/e2e/slow-test.ts

# Run with performance monitoring
NODE_ENV=test npm test -- tests/e2e/slow-test.ts --reporter=verbose

# Check system resources during test
# In separate terminal:
htop  # or top
iostat 1  # Check disk I/O
netstat -i  # Check network
```

**Solutions**:
```typescript
// Add performance monitoring to tests
function withPerformanceMonitoring<T>(
  testFn: () => Promise<T>,
  testName: string
): Promise<T> {
  const startTime = process.hrtime.bigint();
  const startMemory = process.memoryUsage().heapUsed;

  return testFn().then(result => {
    const endTime = process.hrtime.bigint();
    const endMemory = process.memoryUsage().heapUsed;

    const duration = Number(endTime - startTime) / 1_000_000; // Convert to ms
    const memoryDelta = endMemory - startMemory;

    console.log(`[PERF ${testName}] Duration: ${duration.toFixed(2)}ms, Memory: ${memoryDelta} bytes`);

    return result;
  });
}

// Usage
it('should complete operation efficiently', async () => {
  await withPerformanceMonitoring(async () => {
    const result = await runCLI('complex-operation', env.path);
    expect(result.success).toBe(true);
  }, 'complex-operation');
});
```

### Memory Leaks

**Problem**: Memory usage growing during test execution.

**Diagnosis**:
```typescript
// Add memory monitoring
function monitorMemory() {
  const usage = process.memoryUsage();
  console.log({
    rss: `${Math.round(usage.rss / 1024 / 1024)}MB`,
    heapTotal: `${Math.round(usage.heapTotal / 1024 / 1024)}MB`,
    heapUsed: `${Math.round(usage.heapUsed / 1024 / 1024)}MB`,
    external: `${Math.round(usage.external / 1024 / 1024)}MB`
  });
}

// Add to test hooks
beforeEach(() => {
  console.log('Memory before test:');
  monitorMemory();
});

afterEach(() => {
  console.log('Memory after test:');
  monitorMemory();
});
```

**Solutions**:
```typescript
// Force garbage collection between tests (for debugging only)
if (global.gc) {
  afterEach(() => {
    global.gc();
  });
}

// Check for common leak sources
afterEach(async () => {
  // Close all event emitters
  orchestrator.removeAllListeners();

  // Close database connections
  await store.close();

  // Close HTTP servers
  await server.close();

  // Clear intervals/timeouts
  clearInterval(someInterval);
  clearTimeout(someTimeout);
});
```

---

## CI/CD Debugging

### GitHub Actions Failures

**Problem**: Tests pass locally but fail in CI.

**Local Reproduction**:
```bash
# Simulate CI environment
CI=true npm run test:e2e
NODE_ENV=test CI=true NO_COLOR=1 npm run test:e2e

# Use same Node version as CI
nvm use 20  # Match CI version

# Use same timeout settings
timeout 15m npm run test:e2e  # Match CI timeout
```

**Common CI Issues**:

#### 1. Environment Differences

```yaml
# Check CI environment variables in .github/workflows/ci.yml
env:
  CI: true
  APEX_TEST_MODE: e2e
  NO_COLOR: 1
  GIT_AUTHOR_NAME: GitHub Actions
  GIT_AUTHOR_EMAIL: actions@github.com
```

#### 2. Timing Differences

```typescript
// CI often runs slower - increase timeouts
const timeout = process.env.CI ? 90000 : 30000;

it('should handle CI timing differences', { timeout }, async () => {
  // Test logic
});
```

#### 3. Resource Constraints

```bash
# CI has limited resources - reduce concurrency
# In vitest.e2e.config.ts
export default defineConfig({
  test: {
    maxConcurrency: process.env.CI ? 1 : 4,
    // ...
  }
});
```

### Debugging CI Failures

**Steps**:
1. **Check CI logs** for specific error patterns
2. **Look for timing issues** (increase timeouts)
3. **Check resource usage** (reduce concurrency)
4. **Verify environment setup** (git, Node.js, dependencies)
5. **Test locally with CI settings** (`CI=true`)

**Common Fixes**:
```bash
# Add retry logic for flaky operations
export default defineConfig({
  test: {
    retry: process.env.CI ? 2 : 0,
    // ...
  }
});

# Use proper cleanup in CI
- name: Cleanup
  if: always()  # Run even if tests fail
  run: |
    pkill -f "apex" || true
    pkill -f "node.*packages/cli" || true
    rm -rf /tmp/apex-e2e-* || true
```

---

## Advanced Debugging Techniques

### Using Node.js Debugger

**Setup**:
```bash
# Run test with debugger
node --inspect-brk node_modules/.bin/vitest run tests/e2e/debug-test.ts

# Or with npm script
npm test -- tests/e2e/debug-test.ts --no-coverage --reporter=verbose
```

**In Chrome**:
1. Open `chrome://inspect`
2. Click "Open dedicated DevTools for Node"
3. Set breakpoints in test code
4. Step through execution

### Network Request Debugging

**For MCP/API tests**:
```typescript
// Add request logging
import { createProxyMiddleware } from 'http-proxy-middleware';

const debugProxy = createProxyMiddleware({
  target: 'http://localhost:3000',
  changeOrigin: true,
  onProxyReq: (proxyReq, req, res) => {
    console.log(`[PROXY] ${req.method} ${req.url}`);
  },
  onProxyRes: (proxyRes, req, res) => {
    console.log(`[PROXY] ${proxyRes.statusCode} ${req.url}`);
  }
});
```

### Database Query Debugging

**For SQLite operations**:
```typescript
// Enable SQLite logging
import Database from 'better-sqlite3';

const db = new Database('test.db', {
  verbose: console.log  // Log all SQL statements
});

// Or add query timing
const originalPrepare = db.prepare;
db.prepare = function(sql) {
  console.log(`[SQL] Preparing: ${sql}`);
  const stmt = originalPrepare.call(this, sql);

  const originalRun = stmt.run;
  stmt.run = function(...args) {
    const start = Date.now();
    const result = originalRun.apply(this, args);
    console.log(`[SQL] Executed in ${Date.now() - start}ms`);
    return result;
  };

  return stmt;
};
```

### File System Debugging

**For file operation issues**:
```typescript
// Monitor file system changes
import { watch } from 'fs';

const watcher = watch(env.path, { recursive: true }, (eventType, filename) => {
  console.log(`[FS] ${eventType}: ${filename}`);
});

// Clean up watcher
afterEach(() => {
  watcher.close();
});

// Log file operations
const originalWriteFile = fs.writeFile;
fs.writeFile = async function(path, data, options) {
  console.log(`[FS] Writing file: ${path} (${data.length} bytes)`);
  return originalWriteFile.call(this, path, data, options);
};
```

---

## Tools & Commands

### Essential Debug Commands

```bash
# Basic system information
uname -a                    # System info
node --version             # Node.js version
npm --version              # npm version
git --version              # Git version

# Process monitoring
ps aux | grep apex         # APEX processes
ps aux | grep node         # Node processes
lsof -i                    # Open network connections
lsof +D /tmp              # Files open in /tmp

# Resource monitoring
top                        # Real-time process monitor
htop                       # Enhanced process monitor
iostat 1                   # Disk I/O monitoring
free -h                    # Memory usage

# Network debugging
netstat -tuln             # Network connections
ss -tuln                  # Socket statistics
ping localhost            # Local connectivity
curl http://localhost:3000/health  # API health check

# File system debugging
df -h                     # Disk space
du -sh /tmp/apex-e2e-*   # Directory sizes
find /tmp -name "apex-e2e-*" -type d  # Find test directories
ls -la /tmp | grep apex  # List APEX temp files

# Git debugging
git status               # Repository status
git branch -a            # All branches
git remote -v            # Remote repositories
git log --oneline -5     # Recent commits
```

### Test-Specific Debug Commands

```bash
# Run single test with maximum verbosity
DEBUG=1 npm test -- tests/e2e/specific.test.ts --reporter=verbose --no-coverage

# Run test with timing information
time npm test -- tests/e2e/specific.test.ts

# Run test with memory monitoring
NODE_OPTIONS="--max-old-space-size=2048" npm test -- tests/e2e/specific.test.ts

# Run test with specific timeout
timeout 60s npm test -- tests/e2e/specific.test.ts

# Run test in CI mode
CI=true npm test -- tests/e2e/specific.test.ts

# Validate test discovery
npm run validate:e2e-discovery

# List all E2E tests
npm run test:unified:list:e2e
```

### Cleanup Commands

```bash
# Clean build artifacts
npm run clean

# Clean test artifacts
npm run cleanup:test

# Manual cleanup (Unix/Linux/macOS)
pkill -f apex
pkill -f "node.*packages/cli"
rm -rf /tmp/apex-e2e-*
rm -rf .apex-test

# Manual cleanup (Windows)
taskkill /f /im node.exe
for /d /r . %d in (.apex-test) do @if exist "%d" rmdir /s /q "%d"
rmdir /s C:\temp\apex-e2e-*

# Database cleanup
rm -f .apex/apex.db*

# Git cleanup (if needed)
git clean -fdx
git reset --hard HEAD
```

---

## Prevention Strategies

### Writing Debuggable Tests

#### 1. Add Descriptive Test Names

```typescript
// ✅ GOOD: Clear, specific test names
it('should create feature branch when task type is "feature"')
it('should retry git operations up to 3 times on network failure')
it('should cleanup database connections when orchestrator shuts down')

// ❌ BAD: Vague test names
it('should work with branches')
it('should handle retries')
it('should cleanup properly')
```

#### 2. Use Helpful Error Messages

```typescript
// ✅ GOOD: Descriptive assertions
expect(result.success, `CLI command failed: ${result.stderr}`).toBe(true);
expect(files).toContain(expectedFile, `Expected file ${expectedFile} not found in: ${files.join(', ')}`);

// ❌ BAD: Generic assertions
expect(result.success).toBe(true);
expect(files).toContain(expectedFile);
```

#### 3. Add Debug Hooks

```typescript
describe('E2E: Feature Tests', () => {
  let env: TestEnvironment;

  beforeEach(async () => {
    const testName = expect.getState().currentTestName;
    console.log(`[DEBUG] Starting test: ${testName}`);

    env = await createTestEnvironment({
      initGit: true,
      initApexProject: true
    });

    console.log(`[DEBUG] Test environment created: ${env.path}`);
  });

  afterEach(async () => {
    const testName = expect.getState().currentTestName;
    console.log(`[DEBUG] Cleaning up test: ${testName}`);

    try {
      await env.cleanup();
      console.log(`[DEBUG] Cleanup successful for: ${testName}`);
    } catch (error) {
      console.error(`[DEBUG] Cleanup failed for ${testName}:`, error);
      throw error;
    }
  });
});
```

### Monitoring and Alerts

#### 1. Performance Monitoring

```typescript
// Add performance baseline tests
describe('Performance Baselines', () => {
  it('should initialize project within 10 seconds', async () => {
    const start = Date.now();

    const result = await runCLI('init --yes', env.path);

    const duration = Date.now() - start;
    expect(result.success).toBe(true);
    expect(duration).toBeLessThan(10000);

    // Log for monitoring
    console.log(`[PERF] Project initialization: ${duration}ms`);
  });
});
```

#### 2. Environment Validation

```typescript
// Add environment validation tests
describe('Environment Validation', () => {
  it('should have all required tools available', async () => {
    // Check Node.js
    const nodeVersion = process.version;
    expect(nodeVersion).toMatch(/^v(18|20)\./);

    // Check git
    expect(() => execSync('git --version')).not.toThrow();

    // Check CLI build
    const cliPath = 'packages/cli/dist/index.js';
    expect(fs.existsSync(cliPath)).toBe(true);

    console.log(`[ENV] Validation passed - Node: ${nodeVersion}, Git: available, CLI: built`);
  });
});
```

---

## Summary

Effective E2E test debugging in APEX involves:

1. **Quick systematic diagnosis** using the debugging checklist
2. **Proper debug mode usage** to get detailed execution information
3. **Pattern recognition** for common failure types
4. **Environment validation** to catch setup issues early
5. **Resource management** to prevent test isolation problems
6. **Performance monitoring** to catch regression issues
7. **CI-specific debugging** for deployment pipeline issues

The key is to approach debugging systematically, starting with the most common issues and progressively diving deeper into specific problems. Always use debug mode first, and leverage the comprehensive logging and monitoring tools available in the APEX E2E test infrastructure.

For additional help:
- [E2E Testing Guide](./e2e.md)
- [E2E Best Practices](./e2e-best-practices.md)
- [Contributing E2E Tests](./contributing-e2e-tests.md)
- [GitHub Issues](https://github.com/apex/apex/issues) for specific problems