# PermissionStore Code Paths to Test Files Mapping

This document provides a comprehensive mapping of every method in the `PermissionStore` class to their corresponding test files and test cases.

## PermissionStore Class Methods Overview

### Public Methods
1. `initialize()` - Initialize database connection and setup tables
2. `savePermission()` - Save basic permission
3. `saveExtendedPermission()` - Save extended permission with additional metadata
4. `getPermission()` - Get basic permission by query
5. `getExtendedPermission()` - Get extended permission by query
6. `listPermissions()` - List basic permissions with optional filtering
7. `listExtendedPermissions()` - List extended permissions with advanced filtering
8. `clearPermissions()` - Clear all permissions
9. `clearExpired()` - Clear expired permissions
10. `clearPermissionsForTool()` - Clear all permissions for specific tool
11. `clearPermission()` - Clear specific permission by tool/scope
12. `getDirectoryAccess()` - Get directory access config for permission
13. `updateDirectoryAccess()` - Update directory access for existing permission
14. `close()` - Close database connection

### Private Methods
15. `createPermissionsTable()` - Create permissions table if not exists
16. `runMigrations()` - Run database migrations
17. `generatePermissionId()` - Generate unique permission ID
18. `rowToPermission()` - Convert database row to Permission object
19. `rowToExtendedPermission()` - Convert database row to ExtendedPermission object

## Method-to-Test File Mapping

### 1. `initialize()`
**Test Files:**
- `packages/orchestrator/src/__tests__/permission-store.test.ts`
  - Test cases:
    - Line 31-47: "initialization" describe block
    - Line 32-35: "should create .apex directory if it does not exist"
    - Line 37-40: "should create database file"
    - Line 42-46: "should create permissions table with proper schema"
    - Line 18: Called in `beforeEach` setup
- `packages/orchestrator/src/__tests__/permission-store-extended.test.ts`
  - Test cases:
    - Line 29: Called in `beforeEach` setup
- `packages/orchestrator/src/__tests__/permission-store.integration.test.ts`
  - Test cases:
    - Line 20: Called in `beforeEach` setup
- `packages/orchestrator/src/__tests__/permission-store-migration.test.ts`
  - Test cases:
    - Line 30: "should create database with all required columns"
    - Line 95: "should migrate from v0.4.x schema to v0.5.0 schema"

**Coverage Status:** ✅ **FULLY COVERED**

### 2. `savePermission()`
**Test Files:**
- `packages/orchestrator/src/__tests__/permission-store.test.ts`
  - Test cases:
    - Line 49-154: "savePermission" describe block
    - Line 50-69: "should save a basic permission"
    - Line 71-89: "should save a permission with scope"
    - Line 91-110: "should save a permission with expiry"
    - Line 112-134: "should update existing permission for same tool/scope combination"
    - Line 136-153: "should handle all permission levels"
- `packages/orchestrator/src/__tests__/permission-store-extended.test.ts`
  - Test cases:
    - Line 519-544: "should maintain compatibility with basic savePermission"

**Coverage Status:** ✅ **FULLY COVERED**

### 3. `saveExtendedPermission()`
**Test Files:**
- `packages/orchestrator/src/__tests__/permission-store-extended.test.ts`
  - Test cases:
    - Line 41-148: "ExtendedPermission CRUD Operations" describe block
    - Line 42-94: "should save and retrieve extended permission with all fields"
    - Line 96-115: "should save extended permission with minimal fields"
    - Line 117-147: "should update existing extended permission"
    - Line 149-233: "should handle different tool configuration types"
- `packages/orchestrator/src/__tests__/permission-store-per-tool.test.ts`
  - Test cases:
    - Line 50+: Various tool-specific configuration tests

**Coverage Status:** ✅ **FULLY COVERED**

### 4. `getPermission()`
**Test Files:**
- `packages/orchestrator/src/__tests__/permission-store.test.ts`
  - Test cases:
    - Line 156-255: "getPermission" describe block
    - Line 184-192: "should get permission by tool only"
    - Line 194-203: "should get permission by tool and scope"
    - Line 205-210: "should return null for non-existent permission"
    - Line 212-217: "should return null for wrong scope"
    - Line 219-234: "should return null for expired permission"
    - Line 236-254: "should handle null scope correctly"
- `packages/orchestrator/src/__tests__/permission-store-extended.test.ts`
  - Test cases:
    - Line 505-516: "should maintain compatibility with basic Permission interface"

**Coverage Status:** ✅ **FULLY COVERED**

### 5. `getExtendedPermission()`
**Test Files:**
- `packages/orchestrator/src/__tests__/permission-store-extended.test.ts`
  - Test cases:
    - Line 70-94: Retrieved and verified in "should save and retrieve extended permission with all fields"
    - Line 106-114: Retrieved and verified in "should save extended permission with minimal fields"
    - Line 140-146: Retrieved and verified in "should update existing extended permission"
    - Line 345-376: "should get directory access from existing permission"
    - Line 532-543: Retrieved in backward compatibility test

**Coverage Status:** ✅ **FULLY COVERED**

### 6. `listPermissions()`
**Test Files:**
- `packages/orchestrator/src/__tests__/permission-store.test.ts`
  - Test cases:
    - Line 257-344: "listPermissions" describe block
    - Line 290-298: "should list all non-expired permissions by default"
    - Line 300-307: "should include expired permissions when requested"
    - Line 309-314: "should filter by tool"
    - Line 316-321: "should filter by level"
    - Line 323-333: "should filter by multiple criteria"
    - Line 335-343: "should return permissions in descending order by created date"
- `packages/orchestrator/src/__tests__/permission-store-extended.test.ts`
  - Test cases:
    - Line 546-587: "should maintain compatibility with basic listPermissions"

**Coverage Status:** ✅ **FULLY COVERED**

### 7. `listExtendedPermissions()`
**Test Files:**
- `packages/orchestrator/src/__tests__/permission-store-extended.test.ts`
  - Test cases:
    - Line 236-342: "listExtendedPermissions filtering" describe block
    - Line 277-284: "should filter by grantedBy"
    - Line 286-302: "should filter by tags"
    - Line 304-316: "should filter by hasConfig"
    - Line 318-329: "should combine multiple filters"
    - Line 331-341: "should handle tag filtering with multiple tags"
    - Line 576-586: Advanced filtering in backward compatibility tests
    - Line 689-696: Large dataset filtering in "should handle very large permission datasets"

**Coverage Status:** ✅ **FULLY COVERED**

### 8. `clearPermissions()`
**Test Files:**
- `packages/orchestrator/src/__tests__/permission-store.test.ts`
  - Test cases:
    - Line 346-376: "clearPermissions" describe block
    - Line 367-375: "should clear all permissions"
    - Line 721-725: High volume clearing in "should handle high volume permission operations"

**Coverage Status:** ✅ **FULLY COVERED**

### 9. `clearExpired()`
**Test Files:**
- `packages/orchestrator/src/__tests__/permission-store.test.ts`
  - Test cases:
    - Line 378-433: "clearExpired" describe block
    - Line 412-422: "should clear only expired permissions"
    - Line 424-432: "should return 0 when no expired permissions exist"
    - Line 556-557: Called in edge cases testing
    - Line 820-871: Advanced expiry patterns in "should handle clearExpired with various expiry patterns"

**Coverage Status:** ✅ **FULLY COVERED**

### 10. `clearPermissionsForTool()`
**Test Files:**
- `packages/orchestrator/src/__tests__/permission-store.test.ts`
  - Test cases:
    - Line 435-480: "clearPermissionsForTool" describe block
    - Line 462-470: "should clear all permissions for a specific tool"
    - Line 472-479: "should return 0 when tool has no permissions"

**Coverage Status:** ✅ **FULLY COVERED**

### 11. `clearPermission()`
**Test Files:**
- `packages/orchestrator/src/__tests__/permission-store.test.ts`
  - Test cases:
    - Line 482-546: "clearPermission" describe block
    - Line 509-521: "should clear specific permission by tool only"
    - Line 523-535: "should clear specific permission by tool and scope"
    - Line 537-545: "should return false when permission does not exist"

**Coverage Status:** ✅ **FULLY COVERED**

### 12. `getDirectoryAccess()`
**Test Files:**
- `packages/orchestrator/src/__tests__/permission-store-extended.test.ts`
  - Test cases:
    - Line 344-403: "Directory Access Configuration" describe block
    - Line 345-376: "should get directory access from existing permission"
    - Line 378-394: "should return null for permission without directory access"
    - Line 396-402: "should return null for non-existent permission"
    - Line 436-437: Verified in directory access update test

**Coverage Status:** ✅ **FULLY COVERED**

### 13. `updateDirectoryAccess()`
**Test Files:**
- `packages/orchestrator/src/__tests__/permission-store-extended.test.ts`
  - Test cases:
    - Line 404-458: Directory access update tests
    - Line 404-444: "should update directory access for existing permission"
    - Line 446-458: "should return false when updating directory access for non-existent permission"
    - Line 460-488: "should handle updating permission that has no config"

**Coverage Status:** ✅ **FULLY COVERED**

### 14. `close()`
**Test Files:**
- `packages/orchestrator/src/__tests__/permission-store.test.ts`
  - Test cases:
    - Line 629-638: "close" describe block
    - Line 630-632: "should close database connection without errors"
    - Line 634-637: "should handle multiple close calls gracefully"
    - Line 23-25: Called in `afterEach` cleanup
- All other test files: Called in `afterEach` cleanup blocks

**Coverage Status:** ✅ **FULLY COVERED**

### 15. `createPermissionsTable()` (Private)
**Test Files:**
- `packages/orchestrator/src/__tests__/permission-store.test.ts`
  - Test cases:
    - Line 42-46: Indirectly tested through "should create permissions table with proper schema"
- `packages/orchestrator/src/__tests__/permission-store-migration.test.ts`
  - Test cases:
    - Line 28-50: "should create database with all required columns"
    - Line 46-50: Verifies table schema creation

**Coverage Status:** ✅ **COVERED** (Indirectly tested through `initialize()`)

### 16. `runMigrations()` (Private)
**Test Files:**
- `packages/orchestrator/src/__tests__/permission-store-migration.test.ts`
  - Test cases:
    - Line 90-120: "Migration from Old Schema" describe block
    - Line 95-119: "should migrate from v0.4.x schema to v0.5.0 schema"
    - Line 122-180: "Schema Validation After Migration"
- `packages/orchestrator/src/__tests__/permission-store-extended.test.ts`
  - Test cases:
    - Line 590-634: "Database Migration" describe block
    - Line 591-611: "should have created new columns during migration"
    - Line 613-633: "should handle multiple store initialization correctly"

**Coverage Status:** ✅ **FULLY COVERED**

### 17. `generatePermissionId()` (Private)
**Test Files:**
- `packages/orchestrator/src/__tests__/permission-store.test.ts`
  - Test cases:
    - Line 728-763: "should handle permission ID generation edge cases"
    - Indirectly tested through all save operations that verify unique permissions by tool/scope

**Coverage Status:** ✅ **COVERED** (Indirectly tested through save operations)

### 18. `rowToPermission()` (Private)
**Test Files:**
- `packages/orchestrator/src/__tests__/permission-store.test.ts`
  - Test cases:
    - Indirectly tested through all `getPermission()` and `listPermissions()` calls
    - Specifically validated in all retrieval test cases that verify data integrity

**Coverage Status:** ✅ **COVERED** (Indirectly tested through retrieval operations)

### 19. `rowToExtendedPermission()` (Private)
**Test Files:**
- `packages/orchestrator/src/__tests__/permission-store-extended.test.ts`
  - Test cases:
    - Indirectly tested through all `getExtendedPermission()` and `listExtendedPermissions()` calls
    - Line 70-94: Data integrity verification in "should save and retrieve extended permission with all fields"
    - Line 637-661: Edge case JSON handling in "should handle invalid JSON in config gracefully"

**Coverage Status:** ✅ **COVERED** (Indirectly tested through extended retrieval operations)

## Additional Test Coverage

### Integration Tests
- `packages/orchestrator/src/__tests__/permission-store.integration.test.ts` - Real-world workflow scenarios
- `packages/orchestrator/src/__tests__/permission-store-extended-integration.test.ts` - Extended feature integration
- `packages/orchestrator/src/__tests__/permission-store-migration-integration.test.ts` - Migration integration scenarios

### Specialized Tests
- `packages/orchestrator/src/__tests__/permission-store-per-tool.test.ts` - Per-tool configuration testing
- Edge cases and error handling across all test files
- Concurrent operation testing
- High-volume data testing
- Database robustness testing

## Coverage Summary

| Method | Coverage Status | Primary Test File | Coverage Type |
|--------|----------------|-------------------|---------------|
| `initialize()` | ✅ FULLY COVERED | permission-store.test.ts | Direct + Integration |
| `savePermission()` | ✅ FULLY COVERED | permission-store.test.ts | Direct |
| `saveExtendedPermission()` | ✅ FULLY COVERED | permission-store-extended.test.ts | Direct |
| `getPermission()` | ✅ FULLY COVERED | permission-store.test.ts | Direct |
| `getExtendedPermission()` | ✅ FULLY COVERED | permission-store-extended.test.ts | Direct |
| `listPermissions()` | ✅ FULLY COVERED | permission-store.test.ts | Direct |
| `listExtendedPermissions()` | ✅ FULLY COVERED | permission-store-extended.test.ts | Direct |
| `clearPermissions()` | ✅ FULLY COVERED | permission-store.test.ts | Direct |
| `clearExpired()` | ✅ FULLY COVERED | permission-store.test.ts | Direct |
| `clearPermissionsForTool()` | ✅ FULLY COVERED | permission-store.test.ts | Direct |
| `clearPermission()` | ✅ FULLY COVERED | permission-store.test.ts | Direct |
| `getDirectoryAccess()` | ✅ FULLY COVERED | permission-store-extended.test.ts | Direct |
| `updateDirectoryAccess()` | ✅ FULLY COVERED | permission-store-extended.test.ts | Direct |
| `close()` | ✅ FULLY COVERED | permission-store.test.ts | Direct |
| `createPermissionsTable()` | ✅ COVERED | permission-store-migration.test.ts | Indirect |
| `runMigrations()` | ✅ FULLY COVERED | permission-store-migration.test.ts | Direct |
| `generatePermissionId()` | ✅ COVERED | permission-store.test.ts | Indirect |
| `rowToPermission()` | ✅ COVERED | permission-store.test.ts | Indirect |
| `rowToExtendedPermission()` | ✅ COVERED | permission-store-extended.test.ts | Indirect |

**Overall Coverage: 100% of all PermissionStore methods are tested**

All 19 methods in the PermissionStore class have corresponding test coverage, with comprehensive test cases covering normal operations, edge cases, error conditions, and integration scenarios.