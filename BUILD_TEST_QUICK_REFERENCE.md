# Build & Test Quick Reference - Checkout Command

Quick commands for verifying the checkout command implementation.

---

## Quick Start

### Run Everything
```bash
# Full verification pipeline
npm run build && npm test && npm run typecheck && npm run lint
```

---

## Build Commands

### Build All Packages
```bash
npm run build
```
**Expected**: Turbo builds core → orchestrator → cli in dependency order

### Build Specific Package
```bash
# Build CLI only
npm run build --workspace=@apexcli/cli

# Build orchestrator only
npm run build --workspace=@apexcli/orchestrator
```

### Clean Build
```bash
# Clean and rebuild
npm run clean
npm install
npm run build
```

### Type Check Only
```bash
npm run typecheck
```
**Expected**: No TypeScript errors

---

## Test Commands

### Run All Tests
```bash
npm test
```
**Expected**: 58 tests passing across 3 test suites

### Run CLI Tests Only
```bash
npm test --workspace=@apexcli/cli
```

### Run Specific Test File
```bash
# Unit tests
npx vitest run packages/cli/src/__tests__/checkout-command.test.ts

# Integration tests
npx vitest run packages/cli/src/__tests__/checkout-command.integration.test.ts

# Edge case tests
npx vitest run packages/cli/src/__tests__/checkout-command.edge-cases.test.ts
```

### Run Tests in Watch Mode
```bash
npm run test:watch

# Or specific file in watch mode
npx vitest packages/cli/src/__tests__/checkout-command.test.ts
```

### Run Tests with Coverage
```bash
npm run test:coverage
```
**Expected**: Coverage report in `coverage/` directory

### Run Tests Verbosely
```bash
npx vitest run --reporter=verbose
```

---

## Verification Steps

### 1. Pre-Commit Verification
```bash
# Quick check before committing
npm run typecheck && npm test
```

### 2. Full Verification
```bash
# Complete check
npm run build
npm run typecheck
npm run lint
npm test
```

### 3. Coverage Verification
```bash
# Check test coverage
npm run test:coverage

# View coverage report
open coverage/index.html  # macOS
xdg-open coverage/index.html  # Linux
start coverage/index.html  # Windows
```

---

## Debugging

### Run Single Test
```bash
# Run one specific test
npx vitest run checkout-command.test.ts -t "should switch to task worktree"
```

### Enable Debug Output
```bash
# Run with debug logging
DEBUG=* npx vitest run checkout-command.test.ts
```

### Check Mock Calls
Add to test:
```typescript
console.log('Mock calls:', mockOrchestrator.listTasks.mock.calls);
```

---

## Expected Results

### Build Success
```
✓ @apexcli/core:build
✓ @apexcli/orchestrator:build
✓ @apexcli/cli:build

Tasks:    3 successful, 3 total
```

### Test Success
```
Test Files  3 passed (3)
     Tests  58 passed (58)
  Start at  XX:XX:XX
  Duration  XXXms
```

### Type Check Success
```
No errors found
```

---

## File Locations

### Implementation Files
- `/Users/s0v3r1gn/APEX/packages/cli/src/index.ts` (lines 1496-1612)
- `/Users/s0v3r1gn/APEX/packages/orchestrator/src/index.ts` (lines 1693-1738)

### Test Files
- `/Users/s0v3r1gn/APEX/packages/cli/src/__tests__/checkout-command.test.ts` (621 lines)
- `/Users/s0v3r1gn/APEX/packages/cli/src/__tests__/checkout-command.integration.test.ts` (500 lines)
- `/Users/s0v3r1gn/APEX/packages/cli/src/__tests__/checkout-command.edge-cases.test.ts` (602 lines)

### Configuration Files
- `/Users/s0v3r1gn/APEX/vitest.config.ts` (root)
- `/Users/s0v3r1gn/APEX/packages/cli/vitest.config.ts` (package)
- `/Users/s0v3r1gn/APEX/packages/cli/tsconfig.json` (TypeScript)

---

## Common Issues

### Build Fails
```bash
# Clean and rebuild
npm run clean
npm install
npm run build
```

### Tests Fail
```bash
# Run tests in isolation
npx vitest run checkout-command.test.ts --reporter=verbose

# Check for mock issues
# Verify mocks are cleared: vi.clearAllMocks() in afterEach
```

### Type Errors
```bash
# Check TypeScript errors
npm run typecheck

# Build core and orchestrator first
npm run build --workspace=@apexcli/core
npm run build --workspace=@apexcli/orchestrator
```

---

## Test Breakdown

### checkout-command.test.ts (20 tests)
- Command registration (2)
- Task worktree switching (5)
- List worktrees (2)
- Cleanup operations (2)
- Error handling (4)
- Partial ID matching (2)
- Integration scenarios (3)

### checkout-command.integration.test.ts (14 tests)
- Real worktree management (5)
- Command parsing (3)
- Performance tests (3)
- User experience (3)

### checkout-command.edge-cases.test.ts (24 tests)
- Null/undefined handling (3)
- Extreme values (5)
- I/O errors (4)
- Malformed data (3)
- Race conditions (3)
- Resource constraints (2)
- Date handling (2)
- Configuration edge cases (2)

**Total: 58 tests**

---

## CI/CD Pipeline

### Recommended Pipeline Steps
```yaml
# Example CI pipeline
steps:
  - name: Install
    run: npm install

  - name: Type Check
    run: npm run typecheck

  - name: Lint
    run: npm run lint

  - name: Build
    run: npm run build

  - name: Test
    run: npm test

  - name: Coverage
    run: npm run test:coverage

  - name: Upload Coverage
    run: # Upload to coverage service
```

---

## Performance Expectations

### Build Time
- **Full build**: ~10-30 seconds (depends on system)
- **Incremental build**: ~2-5 seconds

### Test Time
- **All CLI tests**: ~2-5 seconds
- **Checkout tests only**: ~1-2 seconds
- **Coverage generation**: +2-3 seconds

### Type Check Time
- **Full type check**: ~3-5 seconds

---

## Package Scripts Reference

From `/Users/s0v3r1gn/APEX/package.json`:
```json
{
  "scripts": {
    "build": "turbo run build",
    "dev": "turbo run dev",
    "lint": "turbo run lint",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage",
    "clean": "turbo run clean && rm -rf node_modules",
    "typecheck": "turbo run typecheck",
    "format": "prettier --write \"**/*.{ts,tsx,md,json}\"",
    "apex": "node packages/cli/dist/index.js"
  }
}
```

---

## Quick Checks

### Check Git Status
```bash
git status
```
**Expected**:
- Modified: `packages/cli/src/index.ts`
- Modified: `packages/orchestrator/src/index.ts`
- Untracked: Test files in `packages/cli/src/__tests__/`

### Check Test Files Exist
```bash
ls -la packages/cli/src/__tests__/checkout-command*.test.ts
```
**Expected**: 3 test files listed

### Check Build Output
```bash
ls -la packages/cli/dist/index.js
```
**Expected**: File exists after successful build

---

## Manual Testing

After build succeeds, test the command manually:

```bash
# Run APEX CLI
npm run apex

# In APEX REPL:
/checkout --help
/checkout --list
/checkout <task-id>
/checkout --cleanup
```

---

**Last Updated**: 2025-12-24
**Status**: Ready for verification
