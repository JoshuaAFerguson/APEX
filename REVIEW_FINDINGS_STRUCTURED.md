# Code Review Findings - Structured Format

## Files with Issues

### packages/orchestrator/dist/index.js:9794
**CRITICAL** - Syntax Error - Orphaned await statement
```
Orphaned `await` statement outside async function context
This prevents all tests from running
Fix: Rebuild dist files after fixing source duplication issues
```

### packages/orchestrator/src/index.ts:11313,12697
**CRITICAL** - Duplicate method definition
```
pushTaskBranch() method defined twice
First at line 11313, duplicate at line 12697
Impact: Method shadowing, unpredictable behavior
Fix: Remove the duplicate definition at line 12697
```

### packages/orchestrator/src/index.ts:12713
**CRITICAL** - Command Injection Vulnerability (SECURITY)
```
git push command with unescaped branch name:
  await execAsync(`git push -u origin ${task.branchName}`)
Fix: Use simple-git library or proper escaping
Risk: Arbitrary command execution
```

### packages/orchestrator/src/store.ts:3000,3095
**CRITICAL** - Duplicate method definition
```
getAllTemplates() method defined twice
First at line 3000, duplicate at line 3095
Impact: Compilation warning "Duplicate member in class body"
Fix: Remove the duplicate definition at line 3095
```

### packages/orchestrator/src/permission-store.ts:122
**CRITICAL** - Type safety violation
```
Type mismatch: passing `undefined` to typed parameter
  generatePermissionId(permission.tool, permission.scope ?? undefined)
Fix: Use `generatePermissionId(permission.tool, permission.scope)` directly
Impact: TypeScript type safety violation
```

### tests/e2e/helpers/mcp-e2e-helpers.ts:832-833
**HIGH** - Module export conflicts
```
Export declaration conflicts:
  - 'FlowStep' redeclared (line 832)
  - 'FullFlowResult' redeclared (line 833)
Impact: Module loading failure
Fix: Remove duplicate export declarations
```

### tests/e2e/mocks/mock-marketplace-server.ts:619,632,796,816
**HIGH** - Duplicate function declarations
```
Functions declared multiple times:
  - createFailingServer: lines 619, 796
  - createSlowServer: lines 632, 816
Impact: Function shadowing, unpredictable test behavior
Fix: Remove duplicate declarations
```

### tests/e2e/mocks/mock-marketplace-server.ts:189+
**HIGH** - Invalid event type emissions
```
Events emitted with names not in BackgroundTaskManagerEvents:
  - 'state:change'
  - 'started'
  - 'disconnected'
  - 'server:error'
Impact: Events silently dropped, handlers never fire
Fix: Verify event names match type definitions
```

### tests/e2e/mocks/mock-marketplace-server.ts:169,171
**HIGH** - Type coercion issues
```
Type mismatch: undefined assigned to non-optional union types:
  - failureMode: undefined (expects "timeout"|"refused"|"reset")
  - responseMode: undefined (expects "malformed_json"|"incomplete"|"wrong_schema")
Impact: Type safety violations
Fix: Add | undefined to types or provide valid defaults
```

### tests/test-utils/autonomy-test-helpers.ts:24
**HIGH** - Missing type export
```
Import fails: Module has no exported member 'Agent'
  import { Agent } from '@apexcli/core/src/types.js'
Impact: Test utilities cannot be imported
Fix: Check if Agent is exported from core types
```

### packages/cli/src/ui/components/ErrorDisplay.tsx:22-24
**MEDIUM** - Missing null check
```
No validation before accessing string property:
  truncateMessage(message: string, maxLength: number)
  if (message.length <= maxLength) // Could be null/undefined
Impact: Potential runtime TypeError
Fix: Add null/undefined check at function entry
```

### packages/cli/src/ui/components/ErrorDisplay.tsx:248-250
**MEDIUM** - Unsafe priority sorting
```
No validation that priority exists in map:
  priorityOrder[b.priority] - priorityOrder[a.priority]
Could return NaN if priority is invalid
Impact: Incorrect sorting, unpredictable order
Fix: Add fallback values for missing priorities
```

### packages/cli/src/ui/components/ErrorDisplay.tsx:324
**MEDIUM** - Dead code (unused variable)
```
Variable destructured but never used:
  const { width: terminalWidth, breakpoint, isNarrow } = useStdoutDimensions();
  // breakpoint is never used
Impact: Misleading code suggests incomplete implementation
Fix: Remove unused `breakpoint` variable
```

### tests/e2e/helpers/mcp-e2e-helpers.ts:239-240
**MEDIUM** - Unsafe global context access
```
Type assertions bypass safety:
  globalThis[mcpServerName as any] = serverInstance;
  globalThis[`${mcpServerName}_config` as any] = serverConfig;
Impact: Global namespace pollution, hidden type violations
Fix: Use dedicated registry object instead of globalThis
```

### tests/e2e/utils/mcp-test-utils.ts:437
**MEDIUM** - Unchecked type casting
```
Type assertion without verification:
  const record = serverEntry as Record<string, unknown>;
Impact: Type safety violation
Fix: Add type guard before casting
```

### packages/cli/src/ui/components/ToolCall.tsx:64
**MEDIUM** - Weak input sanitization
```
Basic character replacement may not prevent all injection:
  sanitizedKey.replace(/[^\w\-:]/g, '_')
Impact: Potential terminal injection vulnerability
Fix: Use established sanitization library
```

### packages/orchestrator/src/index.ts:12738-12740
**MEDIUM** - Missing parameter validation
```
No validation of user-provided parameters:
  async mergeTaskBranch(taskId: string, options: {...})
taskId not validated before use in commands
Impact: Potential argument injection
Fix: Validate parameter format and content
```

### packages/orchestrator/src/merge-task-branch.test.ts
**LOW** - Empty test file
```
Test file exists but contains no tests (shows "0 test" in output)
Impact: No coverage for merge-task-branch functionality
Fix: Complete the test file or remove it
```

### packages/orchestrator/src/runner.ts
**LOW** - Missing test coverage
```
157 lines added/modified without clear test updates
Impact: Unknown test coverage for new functionality
Fix: Add corresponding test cases
```

### packages/orchestrator/src/index.ts (General)
**LOW** - Inconsistent error handling
```
Mixed error handling patterns:
  - Some methods return { success: boolean; error?: string }
  - Other methods throw errors directly
Impact: Unpredictable error handling
Fix: Standardize error handling across all methods
```

---

## Summary Statistics

| Severity | Count | Status |
|----------|-------|--------|
| CRITICAL | 5 | MUST FIX |
| HIGH | 5 | MUST FIX |
| MEDIUM | 6 | SHOULD FIX |
| LOW | 4 | CAN DEFER |
| **TOTAL** | **20** | |

---

## Test Execution Status

- Build: ✓ PASSED (with TypeScript warnings via `echo ok`)
- Tests: ✗ FAILED - Blocked by orphaned code in dist/index.js
- Test output: SyntaxError at line 9794 prevents test execution

---

## Stage Completion Status

**Stage Status**: BLOCKED ✗

Cannot mark review complete until:
1. ✗ All CRITICAL issues fixed
2. ✗ Build passes without forced `echo ok`
3. ✗ All tests pass successfully
4. ✗ Code quality acceptable

**Next Action**: Return code to developer stage for critical bug fixes
