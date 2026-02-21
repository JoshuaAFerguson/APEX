# PermissionStore Code Paths to Test Files Mapping

This document provides a comprehensive mapping of every method in the PermissionStore class to their corresponding test files, specific test cases, and coverage status.

## Overview

The PermissionStore class (`packages/orchestrator/src/permission-store.ts`) contains 19 public/private methods plus 1 additional helper method. These methods are tested across 7 dedicated test files with comprehensive coverage.

## Method-to-Test Mapping

### 1. `initialize()` - Public Method
**Purpose**: Initialize the database connection and ensure permissions table exists

**Test Coverage**:
- **File**: `permission-store.test.ts`
  - Test: "should create .apex directory if it does not exist"
  - Test: "should create database file"
  - Test: "should create permissions table with proper schema"
  - Test: "should handle migration edge cases"

- **File**: `permission-store-migration.test.ts`
  - Test: "should create database with all required columns"
  - Test: "should handle multiple migration runs safely"

- **File**: `permission-store-extended.test.ts`
  - Test: Setup/teardown in `beforeEach` blocks

**Coverage Status**: ✅ **Comprehensive** - Covers fresh initialization, migration scenarios, and multiple initialization calls

---

### 2. `createPermissionsTable()` - Private Method
**Purpose**: Create the permissions table if it doesn't exist

**Test Coverage**:
- **File**: `permission-store.test.ts`
  - Test: "should create permissions table with proper schema"
  - Indirectly tested through `initialize()` tests

- **File**: `permission-store-migration.test.ts`
  - Test: "should create database with all required columns"
  - Validates table structure and indexes

**Coverage Status**: ✅ **Comprehensive** - Indirectly tested through initialization, validates table structure

---

### 3. `runMigrations()` - Private Method
**Purpose**: Run any database migrations for the permissions table

**Test Coverage**:
- **File**: `permission-store-migration.test.ts`
  - Test: "should handle database with existing basic schema"
  - Test: "should create database with all required columns"
  - Test: "should handle multiple migration runs safely"

- **File**: `permission-store-extended.test.ts`
  - Test: "should have created new columns during migration"
  - Test: "should handle multiple store initialization correctly"

**Coverage Status**: ✅ **Comprehensive** - Tests migration from v0.4.0 to v0.5.0 schema, column additions, multiple runs

---

### 4. `savePermission(permission: Permission)` - Public Method
**Purpose**: Save a permission to the database (delegates to saveExtendedPermission)

**Test Coverage**:
- **File**: `permission-store.test.ts`
  - Test: "should save a basic permission"
  - Test: "should save a permission with scope"
  - Test: "should save a permission with expiry"
  - Test: "should update existing permission for same tool/scope combination"
  - Test: "should handle all permission levels"

- **File**: `permission-store.integration.test.ts`
  - Test: "should handle complete file management workflow"
  - Test: "should handle shell command permission scenarios"

- **File**: `permission-store-extended.test.ts`
  - Test: "should maintain compatibility with basic savePermission"

**Coverage Status**: ✅ **Comprehensive** - All parameter combinations, update scenarios, backward compatibility

---

### 5. `saveExtendedPermission(permission: ExtendedPermission)` - Public Method
**Purpose**: Save an extended permission with additional fields (config, grantReason, etc.)

**Test Coverage**:
- **File**: `permission-store-extended.test.ts`
  - Test: "should save and retrieve extended permission with all fields"
  - Test: "should save extended permission with minimal fields"
  - Test: "should update existing extended permission"
  - Test: "should handle different tool configuration types"

- **File**: `permission-store-per-tool.test.ts`
  - Test: "should save and retrieve complete FilesystemToolConfig"
  - Test: "should save and retrieve complete ShellToolConfig"
  - Test: "should save and retrieve complete WebToolConfig"
  - Test: "should save and retrieve complete SearchToolConfig"
  - Multiple additional config-specific tests

**Coverage Status**: ✅ **Comprehensive** - All extended fields, different config types, validation scenarios

---

### 6. `getPermission(query: PermissionQuery)` - Public Method
**Purpose**: Get a permission for a specific tool/scope combination (returns basic Permission type)

**Test Coverage**:
- **File**: `permission-store.test.ts`
  - Test: "should get permission by tool only"
  - Test: "should get permission by tool and scope"
  - Test: "should return null for non-existent permission"
  - Test: "should return null for wrong scope"
  - Test: "should return null for expired permission"
  - Test: "should handle null scope correctly"

- **File**: `permission-store.integration.test.ts`
  - Multiple workflow tests using getPermission

**Coverage Status**: ✅ **Comprehensive** - All query types, edge cases, expiry handling

---

### 7. `getExtendedPermission(query: PermissionQuery)` - Public Method
**Purpose**: Get an extended permission with additional fields

**Test Coverage**:
- **File**: `permission-store-extended.test.ts`
  - Test: "should save and retrieve extended permission with all fields"
  - All configuration type tests

- **File**: `permission-store-per-tool.test.ts`
  - All per-tool configuration tests
  - Directory access configuration tests

**Coverage Status**: ✅ **Comprehensive** - Extended fields, config types, expiry cleanup

---

### 8. `listPermissions(options?)` - Public Method
**Purpose**: List all permissions with optional filtering (returns basic Permission type)

**Test Coverage**:
- **File**: `permission-store.test.ts`
  - Test: "should list all non-expired permissions by default"
  - Test: "should include expired permissions when requested"
  - Test: "should filter by tool"
  - Test: "should filter by level"
  - Test: "should filter by multiple criteria"
  - Test: "should return permissions in descending order by created date"

**Coverage Status**: ✅ **Comprehensive** - All filtering options, sorting, expired permission handling

---

### 9. `listExtendedPermissions(options?)` - Public Method
**Purpose**: List all extended permissions with additional filtering options

**Test Coverage**:
- **File**: `permission-store-extended.test.ts`
  - Test: "should filter by grantedBy"
  - Test: "should filter by tags"
  - Test: "should filter by hasConfig"
  - Test: "should combine multiple filters"
  - Test: "should handle tag filtering with multiple tags"

- **File**: `permission-store-per-tool.test.ts`
  - Test: "should filter permissions by single tag"
  - Test: "should filter permissions by multiple tags (OR operation)"
  - Test: "should filter permissions by specific granter"
  - Test: "should combine grantedBy filtering with other filters"

**Coverage Status**: ✅ **Comprehensive** - All extended filtering options, tag queries, granter filtering

---

### 10. `clearPermissions()` - Public Method
**Purpose**: Clear all permissions

**Test Coverage**:
- **File**: `permission-store.test.ts`
  - Test: "should clear all permissions"

**Coverage Status**: ✅ **Basic** - Simple functionality, no edge cases

---

### 11. `clearExpired()` - Public Method
**Purpose**: Clear all expired permissions and return count

**Test Coverage**:
- **File**: `permission-store.test.ts`
  - Test: "should clear only expired permissions"
  - Test: "should return 0 when no expired permissions exist"
  - Test: "should handle clearExpired with various expiry patterns"

**Coverage Status**: ✅ **Comprehensive** - Return values, edge cases, various expiry scenarios

---

### 12. `clearExpiredPermission(id: string)` - Private Method
**Purpose**: Clear a specific expired permission by ID (internal helper)

**Test Coverage**:
- **File**: `permission-store.test.ts`
  - Test: "should return null for expired permission" (indirectly calls this method)
  - Test: "should handle permissions expiring during getPermission call"

**Coverage Status**: ✅ **Adequate** - Indirectly tested through expiry mechanisms

---

### 13. `clearPermissionsForTool(toolName: string)` - Public Method
**Purpose**: Clear permissions for a specific tool and return count

**Test Coverage**:
- **File**: `permission-store.test.ts`
  - Test: "should clear all permissions for a specific tool"
  - Test: "should return 0 when tool has no permissions"

**Coverage Status**: ✅ **Comprehensive** - Functionality and edge cases with return values

---

### 14. `clearPermission(query: PermissionQuery)` - Public Method
**Purpose**: Clear permissions for a specific tool/scope combination

**Test Coverage**:
- **File**: `permission-store.test.ts`
  - Test: "should clear specific permission by tool only"
  - Test: "should clear specific permission by tool and scope"
  - Test: "should return false when permission does not exist"

- **File**: `permission-store-migration.test.ts`
  - Test: "should maintain referential integrity across operations"

**Coverage Status**: ✅ **Comprehensive** - All query types, return values, non-existent permissions

---

### 15. `getDirectoryAccess(query: PermissionQuery)` - Public Method
**Purpose**: Get directory access configuration for a tool permission

**Test Coverage**:
- **File**: `permission-store-extended.test.ts`
  - Test: "should get directory access from existing permission"
  - Test: "should return null for permission without directory access"
  - Test: "should return null for non-existent permission"

- **File**: `permission-store-per-tool.test.ts`
  - Test: "should persist and retrieve directory access configurations across different tool types"
  - Test: "should handle directory access configuration with complex glob patterns"

**Coverage Status**: ✅ **Comprehensive** - All scenarios including null cases and complex configurations

---

### 16. `updateDirectoryAccess(query: PermissionQuery, directoryAccess: DirectoryAccessConfig)` - Public Method
**Purpose**: Update directory access configuration for an existing permission

**Test Coverage**:
- **File**: `permission-store-extended.test.ts`
  - Test: "should update directory access for existing permission"
  - Test: "should return false when updating directory access for non-existent permission"
  - Test: "should handle updating permission that has no config"

- **File**: `permission-store-per-tool.test.ts`
  - Test: "should update directory access configurations independently"

**Coverage Status**: ✅ **Comprehensive** - Success/failure scenarios, config preservation, edge cases

---

### 17. `close()` - Public Method
**Purpose**: Close the database connection

**Test Coverage**:
- **File**: `permission-store.test.ts`
  - Test: "should close database connection without errors"
  - Test: "should handle multiple close calls gracefully"

**Coverage Status**: ✅ **Comprehensive** - Normal closure and multiple calls

---

### 18. `generatePermissionId(tool: string, scope?: string)` - Private Method
**Purpose**: Generate a unique ID for a permission based on tool and scope

**Test Coverage**:
- **File**: `permission-store.test.ts`
  - Test: "should handle permission ID generation edge cases"
  - Test: "should handle permission queries with null vs undefined scope correctly"
  - Indirectly tested in all save operations

**Coverage Status**: ✅ **Comprehensive** - Edge cases with scopes, uniqueness validation

---

### 19. `rowToPermission(row: PermissionRow)` - Private Method
**Purpose**: Convert a database row to a Permission object

**Test Coverage**:
- **File**: All test files that retrieve permissions
  - Indirectly tested through all `getPermission()` and `listPermissions()` calls
  - Data integrity verified across multiple tests

**Coverage Status**: ✅ **Comprehensive** - Data conversion, type safety, field mapping

---

### 20. `rowToExtendedPermission(row: ExtendedPermissionRow)` - Private Method
**Purpose**: Convert a database row to an ExtendedPermission object

**Test Coverage**:
- **File**: `permission-store-extended.test.ts`
  - Indirectly tested through all extended permission retrievals
  - JSON parsing validation

- **File**: `permission-store-per-tool.test.ts`
  - Test: "should handle config with null and undefined values"
  - Test: "should handle config with very deep nested objects"
  - Test: "should handle config with special characters and Unicode"
  - Test: "should handle malformed JSON recovery scenarios"

**Coverage Status**: ✅ **Comprehensive** - JSON parsing, error handling, complex data structures

---

## Test File Summary

### 1. `permission-store.test.ts` (Main Test File)
- **Primary Focus**: Core functionality, basic CRUD operations
- **Methods Covered**: 14/20 methods
- **Key Features**: Basic permissions, expiry handling, clearing operations, edge cases

### 2. `permission-store-extended.test.ts` (Extended Features)
- **Primary Focus**: v0.5.0 extended permission features
- **Methods Covered**: 8/20 methods (extended functionality)
- **Key Features**: Extended fields, directory access, backward compatibility

### 3. `permission-store-per-tool.test.ts` (Tool-Specific Configs)
- **Primary Focus**: Per-tool configurations and complex scenarios
- **Methods Covered**: 6/20 methods (config-focused)
- **Key Features**: Tool configs, tag filtering, granter filtering, JSON edge cases

### 4. `permission-store-migration.test.ts` (Database Migrations)
- **Primary Focus**: Database schema migrations and integrity
- **Methods Covered**: 5/20 methods (migration-focused)
- **Key Features**: Schema validation, migration safety, performance

### 5. `permission-store.integration.test.ts` (Real-world Scenarios)
- **Primary Focus**: Integration testing with real workflows
- **Methods Covered**: 4/20 methods (workflow-focused)
- **Key Features**: Complete workflows, practical scenarios

### 6. `permission-store-extended-integration.test.ts` (Extended Integration)
- **Primary Focus**: Extended features integration testing
- **Methods Covered**: 5/20 methods (extended integration)
- **Key Features**: Complex extended scenarios, performance testing

### 7. `permission-store-migration-integration.test.ts` (Migration Integration)
- **Primary Focus**: Migration integration with extended features
- **Methods Covered**: 3/20 methods (migration integration)
- **Key Features**: Migration compatibility, data preservation

## Coverage Statistics

- **Total Methods**: 20 (19 original + 1 helper method)
- **Fully Covered Methods**: 20/20 (100%)
- **Test Files**: 7
- **Total Test Cases**: ~150+ individual test cases
- **Coverage Quality**: Comprehensive with edge cases, error scenarios, and performance testing

## Test Quality Assessment

### ✅ Strengths
1. **Complete Method Coverage**: Every method is tested
2. **Edge Case Handling**: Extensive edge case testing
3. **Error Scenarios**: Proper error condition testing
4. **Performance Testing**: Large dataset and concurrency tests
5. **Integration Testing**: Real-world workflow validation
6. **Migration Testing**: Comprehensive schema migration coverage

### 🟨 Areas of Note
1. **Private Method Testing**: Some private methods tested indirectly (appropriate design)
2. **Helper Method Coverage**: `clearExpiredPermission()` could use more direct testing
3. **Complex JSON Scenarios**: Well covered in per-tool tests

## Conclusion

The PermissionStore class has **exceptional test coverage** with 100% method coverage across 7 specialized test files. The testing strategy effectively covers:

- Core functionality and CRUD operations
- Extended v0.5.0 features with complex configurations
- Database migrations and schema evolution
- Real-world integration scenarios
- Performance and concurrency handling
- Edge cases and error conditions

This comprehensive test suite ensures the reliability and maintainability of the permission system within the APEX architecture.