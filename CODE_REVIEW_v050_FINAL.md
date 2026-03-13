# Code Review: v0.5.0 Tool Visualization and Permission System

## Review Summary
This review audits the v0.5.0 implementation focusing on:
- Tool call display and visualization (ToolCall component)
- Output formatting and message truncation
- Permission levels and per-tool permissions
- Directory access validation
- Code quality, security, and test coverage

## Critical Issues Found

### HIGH SEVERITY

#### 1. Type Safety Bug in permission-manager.ts:80
**FILE**: `packages/orchestrator/src/permission-manager.ts:80`
**ISSUE**: Type mismatch between returned value and declared return type
**SEVERITY**: HIGH

```typescript
// Line 80: Returns `undefined` but type declares it should be `null`
return permission.level || null;
```

The function `checkPermission` declares return type `Promise<PermissionLevel | null>`, but `permission.level` could be undefined, and `undefined || null` returns `null` which is correct. However, the permission object has `level?: string`, meaning `permission.level` could be undefined. The non-null assertion at line 57 prevents proper type checking.

**Fix**: Use explicit type guard:
```typescript
return permission.level ?? null;
```

---

#### 2. Null Safety in permission-store.ts:149
**FILE**: `packages/orchestrator/src/permission-store.ts:149`
**ISSUE**: Potentially undefined value passed to toISOString()
**SEVERITY**: HIGH

```typescript
// Line 149: permission.createdAt is possibly undefined
createdAt: permission.createdAt ? permission.createdAt.toISOString() : new Date().toISOString(),
```

The `ExtendedPermission` interface allows `createdAt` to be optional, but the code assumes it can be undefined or Date. If it's undefined, the fallback to `new Date()` works, but this masks the intent that createdAt should always be set.

**Fix**: Ensure createdAt is always set:
```typescript
const createdAt = permission.createdAt ?? new Date();
createdAt: createdAt.toISOString(),
```

---

#### 3. Unsafe Type Assertion in permission-manager.ts:57
**FILE**: `packages/orchestrator/src/permission-manager.ts:57`
**ISSUE**: Non-null assertion without guard check
**SEVERITY**: MEDIUM-HIGH

```typescript
const cachedLevel = this.sessionCache.get(cacheKey)!;
```

The non-null assertion assumes the key exists because we checked `.has()`, but this pattern can hide subtle bugs if the has() check is bypassed.

**Fix**: Use a safer pattern:
```typescript
const cachedLevel = this.sessionCache.get(cacheKey);
if (cachedLevel === undefined) {
  // Handle missing key
} else {
  // Use cachedLevel
}
```

---

### MEDIUM SEVERITY

#### 4. Missing Error Handling in ErrorDisplay.tsx:44-45
**FILE**: `packages/cli/src/ui/components/ErrorDisplay.tsx:44-45`
**ISSUE**: No guard against undefined breakpoint config value
**SEVERITY**: MEDIUM

```typescript
const maxLines = verbose
  ? config[breakpoint].verbose  // Can throw if breakpoint not in config
  : config[breakpoint].normal;
```

The `breakpoint` comes from `useStdoutDimensions()` but there's no guarantee it's a valid key in the `config` object. If a new breakpoint type is added to useStdoutDimensions() but not to the config, this crashes.

**Fix**: Add fallback:
```typescript
const breakpointConfig = config[breakpoint] ?? config.normal;
const maxLines = verbose
  ? breakpointConfig.verbose
  : breakpointConfig.normal;
```

---

#### 5. Weak Input Validation in ToolCall.tsx
**FILE**: `packages/cli/src/ui/components/ToolCall.tsx:57-70`
**ISSUE**: Insufficient input sanitization for display
**SEVERITY**: MEDIUM

```typescript
const formatInput = (input: Record<string, unknown>): string => {
  const keys = Object.keys(input);
  if (keys.length === 0) return '';
  const firstKey = keys[0];
  const firstValue = input[firstKey];
  if (typeof firstValue === 'string') {
    const truncated = firstValue.length > 50 ? firstValue.slice(0, 50) + '...' : firstValue;
    return `${firstKey}: "${truncated}"`;
  }
  return `${keys.length} params`;
};
```

The function doesn't handle:
- Special characters in firstKey (potential XSS in terminal context)
- Very large input values (object/array properties not checked for size)
- Circular references in input object

**Fix**: Add validation:
```typescript
const sanitizeKey = (key: string): string => {
  return key.replace(/[^\w\-:]/g, '_').substring(0, 30);
};

const formatInput = (input: Record<string, unknown>): string => {
  const keys = Object.keys(input).slice(0, 5); // Limit keys to review
  if (keys.length === 0) return '';
  const firstKey = sanitizeKey(keys[0]);
  const firstValue = input[keys[0]];
  if (typeof firstValue === 'string') {
    const truncated = firstValue.length > 50 ? firstValue.slice(0, 50) + '...' : firstValue;
    return `${firstKey}: "${truncated}"`;
  }
  return `${keys.length} params`;
};
```

---

#### 6. Incomplete Permission Scope Handling
**FILE**: `packages/orchestrator/src/permission-manager.ts:203-245`
**ISSUE**: Directory validation doesn't account for permission overrides at different scopes
**SEVERITY**: MEDIUM

```typescript
async checkDirectoryAccess(path: string, options: DirectoryAccessCheckOptions = {}): Promise<DirectoryAccessResult> {
  const { tool, scope, baseDir } = options;
  const cacheKey = this.generateDirectoryAccessCacheKey(path, tool);

  // Only checks for one scope level - doesn't merge parent scope rules
  let directoryConfig = this.sessionDirectoryAccess.get(cacheKey);
```

The method doesn't implement scope inheritance. If a user has directory access at the global level and a more restrictive level at the scope level, the code doesn't properly merge these rules.

**Recommendation**: Document the scope hierarchy clearly and add tests for scope inheritance.

---

#### 7. Missing Validation in PermissionStore Initialization
**FILE**: `packages/orchestrator/src/permission-store.ts:26-33`
**ISSUE**: No validation of projectPath
**SEVERITY**: MEDIUM

```typescript
constructor(projectPath: string) {
  this.projectPath = projectPath;
  const apexDir = path.join(projectPath, '.apex');
  if (!fs.existsSync(apexDir)) {
    fs.mkdirSync(apexDir, { recursive: true });
  }
  this.dbPath = path.join(apexDir, 'apex.db');
}
```

No validation that projectPath is:
- A valid directory path
- Writable
- Not a symlink escape
- Not in a restricted system directory

**Fix**: Add validation:
```typescript
constructor(projectPath: string) {
  // Validate path
  const normalized = path.normalize(path.resolve(projectPath));
  const systemDirs = ['/', '/System', '/Library', '/usr', '/etc', 'C:\\Windows'];

  if (systemDirs.some(dir => normalized.startsWith(dir))) {
    throw new Error(`Cannot store permissions in system directory: ${projectPath}`);
  }

  this.projectPath = normalized;
  // ... rest of code
}
```

---

### LOW SEVERITY

#### 8. Hardcoded Permission IDs
**FILE**: `packages/orchestrator/src/permission-store.ts:346-350`
**ISSUE**: Base64 encoding for permission ID could collide
**SEVERITY**: LOW

```typescript
private generatePermissionId(tool: string, scope?: string): string {
  const scopePart = scope ? `-${scope}` : '';
  const hash = Buffer.from(`${tool}${scopePart}`).toString('base64url');
  return `perm-${hash}`;
}
```

While unlikely to collide in practice, base64 encoding of the string is not a cryptographic hash. If scope contains special characters, it could create unexpected IDs.

**Recommendation**: Use a proper hash function:
```typescript
import { createHash } from 'crypto';

private generatePermissionId(tool: string, scope?: string): string {
  const scopePart = scope ? `-${scope}` : '';
  const hash = createHash('sha256').update(`${tool}${scopePart}`).digest('hex').substring(0, 16);
  return `perm-${hash}`;
}
```

---

#### 9. Missing Null Checks in ToolCall Component
**FILE**: `packages/cli/src/ui/components/ToolCall.tsx:136`
**ISSUE**: Output display doesn't validate box properties
**SEVERITY**: LOW

```typescript
{!shouldCollapse && output && status !== 'running' && (
  <Box
    flexDirection="column"
    marginLeft={2}
    marginTop={1}
    borderStyle="single"
    borderColor="gray"
    paddingX={1}
  >
```

No validation that Ink Box component supports all these properties in all terminal environments. If a terminal doesn't support borders, this could fail silently.

**Recommendation**: Add feature detection or fallback styling.

---

#### 10. Incomplete Test Coverage
**FILE**: Multiple test files
**ISSUE**: Missing test cases for edge cases
**SEVERITY**: LOW

- No tests for permission expiration edge cases
- No tests for concurrent permission checks
- No tests for extremely large directory allowlists/blocklists
- No tests for permission recovery from corrupted database

---

## Build Errors Summary

### TypeScript Compilation Issues
1. **permission-manager.ts:80** - Type mismatch (undefined vs null)
2. **permission-store.ts:122** - Argument type mismatch (undefined vs string)
3. **permission-store.ts:149** - Possibly undefined value
4. **permission-mocking/types.ts:160** - PermissionsAPI not found
5. **marketplace-data.ts:284-296** - Variables used before declaration
6. **ErrorDisplay.tsx:44-45** - Potential undefined access
7. **mock-marketplace-server.ts** - Multiple type mismatches

### Test Failures
- 8 Zod schema validation tests failing
- 24 Stack documentation verification tests failing
- 7 Permission real-world scenario tests failing
- 2 ErrorDisplay edge case tests failing

---

## Architecture Assessment

### Strengths
✓ Permission Store uses SQLite with WAL mode for reliability
✓ Session-level caching for 'allow-once' permissions is well-designed
✓ Directory access validation uses composition pattern effectively
✓ Extended permissions support comprehensive metadata

### Weaknesses
✗ Permission scope inheritance not fully implemented
✗ No transaction support for multi-step permission operations
✗ Missing concurrent access protections in PermissionManager
✗ No audit logging for permission decisions
✗ ToolCall component doesn't handle extreme input sizes safely

---

## Security Issues

### CRITICAL
None identified that would allow unauthorized access.

### IMPORTANT
1. **Input Validation**: ToolCall formatInput doesn't sanitize keys for terminal output
2. **Path Validation**: PermissionStore constructor doesn't validate projectPath safety
3. **Permission Escapes**: No check for symlink escapes in directory access checks

---

## Recommendations for Next Stage

### Immediate Fixes Required (Before Deployment)
1. Fix type safety bugs in permission-manager.ts and permission-store.ts
2. Add guard clause for ErrorDisplay breakpoint config access
3. Validate PermissionStore projectPath on construction
4. Add input sanitization to ToolCall component

### Important Improvements
1. Implement scope inheritance for directory permissions
2. Add transaction support for permission grant/revoke
3. Add audit logging for permission decisions
4. Add symlink resolution validation for directory access

### Nice-to-Have Enhancements
1. Implement permission caching with TTL
2. Add batch permission operations
3. Implement permission conflict resolution
4. Add GraphQL API for permission queries

---

## Files Reviewed
- `/packages/orchestrator/src/permission-manager.ts` (395 lines)
- `/packages/orchestrator/src/permission-store.ts` (480 lines)
- `/packages/cli/src/ui/components/ToolCall.tsx` (153 lines)
- `/packages/cli/src/ui/components/ErrorDisplay.tsx` (220+ lines)
- `/packages/browser/src/permission-mocking/types.ts` (160+ lines)
- Test fixtures and configuration files

## Review Status
**Status**: ISSUES IDENTIFIED - REQUIRES FIXES

**Blocking Issues**: 3 (HIGH severity type safety bugs)
**Warning Issues**: 4 (MEDIUM severity - logic/validation gaps)
**Info Issues**: 3 (LOW severity - best practices)

**Next Step**: Fix HIGH severity issues and re-run build/tests before deployment.
