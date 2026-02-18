# APEX Core Permission Handling Audit Report

## Executive Summary

This document provides a comprehensive audit of all permission-related code paths in the `@apex/core` package. The audit identifies files, types, configurations, and validation logic related to permission management, autonomy levels, and security controls within the APEX system.

## Table of Contents

1. [Core Permission Types and Schemas](#core-permission-types-and-schemas)
2. [Autonomy Control System](#autonomy-control-system)
3. [Tool-Specific Permission Configurations](#tool-specific-permission-configurations)
4. [Directory Access Validation](#directory-access-validation)
5. [Dangerous Operation Detection](#dangerous-operation-detection)
6. [Permission Presets](#permission-presets)
7. [Configuration Loading and Validation](#configuration-loading-and-validation)
8. [Tool Integration](#tool-integration)
9. [Security and Command Blocklists](#security-and-command-blocklists)
10. [Test Coverage](#test-coverage)
11. [Summary of Findings](#summary-of-findings)

---

## Core Permission Types and Schemas

### Location: `packages/core/src/types.ts` (lines 86-142)

**Purpose**: Defines the foundational types for permission management

**Key Components**:

1. **ToolPermissionSchema** (lines 87-94)
   - Defines permission levels: `read`, `write`, `execute`, `network`, `admin`
   - Used to categorize tools by their required access level

2. **PermissionLevelSchema** (lines 106-111)
   - User-granted permission levels: `allow-always`, `allow-once`, `deny`
   - Controls how agents can access specific tools and scopes

3. **PermissionSchema** (lines 117-128)
   - Complete permission record structure
   - Fields: tool, scope, level, expiry, createdAt
   - Tracks user decisions about tool access

4. **PermissionQuerySchema** (lines 135-141)
   - Query parameters for permission lookups
   - Used to check if permission exists for tool/scope combination

---

## Autonomy Control System

### Location: `packages/core/src/types.ts` (lines 1482-1671)

**Purpose**: Controls the level of human oversight required for agent operations

**Key Components**:

1. **AutonomyLevelSchema** (lines 1491-1496)
   - Levels: `supervised`, `review-before-commit`, `autonomous`, `custom`
   - Controls when user approval is required

2. **AutonomyConfigSchema** (lines 1641-1671)
   - Complete autonomy configuration structure
   - Includes stage overrides, agent overrides, and approval gates
   - Resource limits and rejection behavior settings

3. **AgentAutonomyOverrideSchema** (lines 1625-1635)
   - Per-agent autonomy settings
   - Allows fine-grained control over individual agent behavior

**Legacy Support**:
- **LegacyAutonomyLevelSchema** (lines 1506-1512): Backward compatibility
- **migrateLegacyAutonomyLevel** function: Converts old format to new

---

## Tool-Specific Permission Configurations

### Location: `packages/core/src/types.ts` (lines 144-292)

**Purpose**: Granular permission controls for different tool categories

**Key Components**:

1. **DirectoryAccessConfigSchema** (lines 151-170)
   - File system access controls
   - Allowlist/blocklist patterns with glob support
   - Symlink resolution and depth limits

2. **BaseToolPermissionConfigSchema** (lines 176-192)
   - Common settings for all tools
   - Timeout, confirmation requirements, rate limiting
   - Enable/disable controls

3. **FilesystemToolConfigSchema** (lines 198-211)
   - File operation specific controls
   - File size limits, extension filtering
   - Directory access integration

4. **ShellToolConfigSchema** (lines 217-233)
   - Command execution controls
   - Blocked command patterns, elevated privileges
   - Environment variable injection

5. **WebToolConfigSchema** (lines 239-255)
   - Network access controls
   - Domain allowlists/blocklists, response size limits
   - Header customization

6. **BrowserToolConfigSchema** (lines 261-292)
   - Browser automation controls
   - JavaScript execution, form submission permissions
   - Download controls, screenshot permissions

---

## Directory Access Validation

### Location: `packages/core/src/directory-access-validator.ts`

**Purpose**: Path allowlist/blocklist checking with glob pattern support

**Key Components**:

1. **PathValidationResult** interface (lines 30-39)
   - Validation outcome with detailed reasoning
   - Pattern matching information

2. **ValidationOptions** interface (lines 44-49)
   - Base directory and symlink resolution options

**Key Functions**:
- Path normalization and security checks
- Glob pattern matching using minimatch
- Support for both relative and absolute paths

---

## Dangerous Operation Detection

### Location: `packages/core/src/dangerous-operation-detector.ts`

**Purpose**: Identifies dangerous tool operations and requires confirmation

**Key Components**:

1. **DangerousSeverity** type (line 30)
   - Severity levels: `low`, `medium`, `high`, `critical`

2. **ConfirmationRequirements** interface (lines 35-46)
   - Confirmation type and warning messages
   - Alternative action suggestions

**Integration**: Works with shell blocklist patterns for comprehensive security

---

## Permission Presets

### Location: `packages/core/src/types.ts` (lines 6821-7056)

**Purpose**: Predefined permission configurations for common use cases

**Key Components**:

1. **PermissionPresetSchema** (lines 6821-6826)
   - Presets: `locked-down`, `review-all`, `review-risky`, `autonomous`

2. **PERMISSION_PRESET_CONFIGS** (lines 6916-6973)
   - Complete configuration for each preset
   - Tool-specific settings and descriptions

**Helper Functions**:
- `getPresetConfig()`: Retrieves preset configuration
- `isPermissionPreset()`: Type guard for validation
- `validateToolsForPreset()`: Validates tool compatibility

---

## Configuration Loading and Validation

### Location: `packages/core/src/config.ts`

**Purpose**: Loads and validates permission configurations from YAML files

**Key Components**:

1. **Configuration Loading** (lines 1088-1094)
   - Autonomy level and behavior settings
   - Stage and agent override processing

2. **Policy Configuration** (lines 1185-1262)
   - Policy enforcement settings
   - Approval rules and audit logging
   - Path restrictions and test requirements

**Exported Functions**:
- Configuration parsing and validation
- Default value application
- Schema enforcement

---

## Tool Integration

### Location: `packages/core/src/tools/base-tool.ts`

**Purpose**: Base class for all tools with permission integration

**Key Components**:

1. **ToolInterface** definition
   - Permission requirement specification
   - Context-aware execution

2. **Permission Integration** (lines 39, 215-216, 344)
   - Tools declare required permissions
   - Runtime permission checking

---

## Security and Command Blocklists

### Location: `packages/core/src/tools/shell/blocklist.ts`

**Purpose**: Command security validation and dangerous pattern detection

**Key Components**:

1. **CommandValidationResult** interface (lines 18-29)
   - Allowed/blocked status with detailed reasoning
   - Violation type categorization

2. **BlocklistCategory** interface (lines 34-41)
   - Categorized dangerous command patterns
   - User-friendly error messages

**Security Features**:
- Path traversal prevention
- Directory escape detection
- Forbidden pattern matching

---

## Test Coverage

### Extensive Test Files

The following test files provide comprehensive coverage of permission functionality:

**Core Permission Tests**:
- `permission-types.test.ts`: Type validation
- `permission-validation.test.ts`: Validation logic
- `permission-integration.test.ts`: Integration testing
- `permission-coverage.test.ts`: Coverage analysis

**Configuration Tests**:
- `permissions-config.test.ts`: Config loading
- `permissions-config-edge-cases.test.ts`: Edge cases
- `permissions-config-coverage.test.ts`: Coverage metrics

**Autonomy Control Tests**:
- `autonomy-control-types.test.ts`: Type validation
- `autonomy-config-validation.test.ts`: Config validation
- `autonomy-enforcement-validation.test.ts`: Enforcement logic

**Tool-Specific Tests**:
- Browser permission error handling tests
- Shell command blocklist validation tests
- Filesystem access validation tests

**Security Tests**:
- `dangerous-operation-detector.test.ts`: Dangerous operation detection
- `directory-access-integration.test.ts`: Directory access validation

---

## Summary of Findings

### Permission Management Architecture

1. **Comprehensive Type System**: Well-defined Zod schemas for all permission-related configurations
2. **Multi-Level Controls**: Permission management at tool, scope, and operation levels
3. **Autonomy Integration**: Sophisticated autonomy level system with stage and agent overrides
4. **Security Focus**: Dangerous operation detection and command blocklists

### Key Code Paths

1. **Type Definitions**: `types.ts` - Central hub for all permission-related types
2. **Configuration Loading**: `config.ts` - YAML configuration parsing and validation
3. **Directory Access**: `directory-access-validator.ts` - Path-based access control
4. **Dangerous Operations**: `dangerous-operation-detector.ts` - Security risk assessment
5. **Tool Integration**: `tools/base-tool.ts` - Permission enforcement at tool level
6. **Security Blocklists**: `tools/shell/blocklist.ts` - Command security validation

### Coverage Assessment

- **Type Safety**: ✅ Comprehensive Zod schemas with validation
- **Configuration**: ✅ YAML loading with defaults and validation
- **Tool Integration**: ✅ Base class enforces permission requirements
- **Security**: ✅ Multi-layer security with blocklists and dangerous operation detection
- **Testing**: ✅ Extensive test coverage across all components
- **Documentation**: ✅ Well-documented interfaces and usage examples

### Recommendations

1. **Centralization**: All permission logic is properly centralized in core package
2. **Extensibility**: Architecture supports easy addition of new permission types
3. **Security**: Multiple layers of security controls with clear audit trails
4. **Testing**: Comprehensive test coverage provides confidence in the system

The permission handling system in `@apex/core` is well-architected, comprehensive, and provides multiple layers of security and control for agent operations.