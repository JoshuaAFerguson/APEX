# Permission Handling Code Paths Audit - @apex/core Package

## Executive Summary

This audit provides a comprehensive analysis of all permission-handling code paths in the `@apex/core` package. The permission system in APEX is multi-layered, covering tool access control, file system permissions, dangerous operation detection, secret scanning, and policy enforcement.

## Core Permission-Related Files and Locations

### 1. Permission Types and Schemas (`packages/core/src/types.ts`)

**Location**: Lines 6743-6986

**Key Components**:
- `PermissionPresetSchema` - Enum for preset configurations ('autonomous', 'review-all', 'read-only')
- `ToolPermissionBehaviorSchema` - Enum for tool behaviors ('allow', 'confirm', 'deny')
- `ToolPermissionRuleSchema` - Schema for defining per-tool permission rules
- `PermissionsConfigSchema` - Main permissions configuration schema
- `PERMISSION_PRESET_CONFIGS` - Predefined preset configurations
- `READ_ONLY_TOOLS` array - List of safe, read-only tools

**Purpose**: Defines the foundational type system for all permission handling, including presets that control tool access levels.

### 2. Directory Access Validation (`packages/core/src/directory-access-validator.ts`)

**Location**: Complete file (364 lines)

**Key Components**:
- `DirectoryAccessValidator` class - Main validation logic
- `PathValidationResult` interface - Validation result structure
- `isPathAllowed()` method - Core path checking logic
- `matchesAllowlist()` and `matchesBlocklist()` methods - Pattern matching
- Glob pattern support using minimatch library
- Path normalization and security validation

**Purpose**: Controls file system access through allowlist/blocklist patterns. Validates all file paths against configured access policies before allowing operations.

### 3. Dangerous Operation Detection (`packages/core/src/dangerous-operation-detector.ts`)

**Location**: Complete file (543 lines)

**Key Components**:
- `DangerousOperationDetector` class - Main detection engine
- Built-in dangerous patterns for filesystem, network, and shell operations
- Severity levels ('low', 'medium', 'high', 'critical')
- Integration with shell command blocklist
- Confirmation requirement generation
- Pattern matching for credential files, system directories, suspicious domains

**Purpose**: Identifies potentially dangerous operations before execution and determines appropriate confirmation requirements.

### 4. Secret Scanning (`packages/core/src/secret-scanner.ts`)

**Location**: Complete file (378 lines)

**Key Components**:
- `SecretScanner` class - Main scanning engine
- Built-in patterns for AWS keys, GitHub tokens, JWT tokens, private keys, etc.
- Secret detection and masking functionality
- Configurable pattern matching
- Support for custom patterns

**Purpose**: Scans content for sensitive information like API keys, passwords, and tokens to prevent accidental exposure.

### 5. Configuration Management (`packages/core/src/config.ts`)

**Location**: Lines 1181-1185, 877-909, 1432-1464

**Key Components**:
- `loadConfig()` function - Loads and validates APEX configuration
- Permission configuration loading and defaults
- Policy configuration integration
- Container workspace validation
- Default permission preset application ('review-all')

**Purpose**: Manages loading and validation of permission configurations from project config files.

### 6. Policy Configuration Types (`packages/core/src/types.ts`)

**Location**: Lines 6990-7464

**Key Components**:
- `PolicyConfigSchema` - Complete policy configuration
- `AllowedPathsConfigSchema` - File path access control
- `ApprovalRulesConfigSchema` - User approval requirements
- `RequiredTestsConfigSchema` - Test enforcement policies
- Path access modes ('allowlist', 'blocklist')
- Sensitive pattern detection

**Purpose**: Defines policy-as-code structures for governance, compliance, and access control.

### 7. Autonomy Configuration (`packages/core/src/types.ts`)

**Location**: Lines 1641-1671

**Key Components**:
- `AutonomyConfigSchema` - Autonomy level configuration
- `AutonomyLevelSchema` - Different autonomy levels
- Stage and agent-specific autonomy overrides
- Approval gate integration
- Resource limits

**Purpose**: Controls the level of autonomy agents have and when human approval is required.

## Permission Flow Architecture

### 1. Tool Access Control Flow
```
User Request → Permission Preset Check → Custom Rules Check → Tool Behavior Determination (allow/confirm/deny)
```

**Implementation**:
- Presets defined in `PERMISSION_PRESET_CONFIGS`
- Checked via `getToolBehaviorForPreset()`
- Custom rules can override preset defaults

### 2. File System Access Flow
```
File Path Request → Path Normalization → Security Validation → Pattern Matching → Allow/Deny Decision
```

**Implementation**:
- `DirectoryAccessValidator.isPathAllowed()`
- Blocklist patterns checked first (highest priority)
- Allowlist patterns checked second
- Default behavior applied if no patterns match

### 3. Dangerous Operation Flow
```
Tool Invocation → Tool Definition Check → Pattern Analysis → Severity Assessment → Confirmation Requirements
```

**Implementation**:
- `DangerousOperationDetector.detectDangerousOperation()`
- Integrates with shell blocklist from tools package
- Returns severity and confirmation requirements

### 4. Secret Detection Flow
```
Content → Pattern Matching → Secret Identification → Masking → Detection Report
```

**Implementation**:
- `SecretScanner.scan()` method
- Built-in patterns for common secret types
- Configurable enforcement modes

## Key Permission Presets and Behaviors

### 1. Autonomous Preset
- **Behavior**: All tools allowed without confirmation
- **File Creation**: Allowed
- **Shell Execution**: Allowed
- **Network Access**: Allowed
- **Use Case**: Full autonomy scenarios

### 2. Review-All Preset (Default)
- **Behavior**: All tools require confirmation
- **File Creation**: Requires confirmation
- **Shell Execution**: Requires confirmation
- **Network Access**: Requires confirmation
- **Use Case**: Human oversight required

### 3. Read-Only Preset
- **Behavior**: Only safe read operations allowed
- **Allowed Tools**: Read, Grep, Glob, WebFetch, WebSearch
- **File Creation**: Denied
- **Shell Execution**: Denied
- **Use Case**: Safe exploration without modifications

## Integration Points

### 1. Configuration System Integration
- Permission settings loaded via `loadConfig()` in config.ts
- Applied as defaults during project initialization
- Merged with user customizations

### 2. Tool Hook Integration
- Pre/post tool execution hooks can enforce additional checks
- Configured in `toolHooks` section of config

### 3. Policy Enforcement Integration
- File access policies enforced through allowlist/blocklist
- Test requirements enforced through policy rules
- Approval workflows triggered by policy configuration

### 4. MCP Server Integration
- Permission checks applied to MCP tool invocations
- Server-specific access controls possible

## Security Considerations

### 1. Path Traversal Protection
- Path normalization prevents directory traversal attacks
- Security validation checks for null bytes and excessive lengths
- Symlink following can be disabled

### 2. Privilege Escalation Prevention
- Dangerous operation detection for system directories
- Credential file access monitoring
- Shell command blocklist enforcement

### 3. Secret Exposure Prevention
- Comprehensive secret pattern matching
- Automatic masking of detected secrets
- Configurable enforcement modes

## Configuration Examples

### Basic Permission Configuration
```yaml
permissions:
  preset: "review-all"
  customRules:
    - tool: "Read"
      behavior: "allow"
    - tool: "Bash"
      behavior: "deny"
```

### Policy Configuration
```yaml
policy:
  enforcement: "warn"
  allowedPaths:
    mode: "allowlist"
    allow:
      - "src/**"
      - "docs/**"
    block:
      - "node_modules/**"
      - ".env*"
  enabled: true
```

## Testing and Validation

The permission system includes comprehensive test coverage:
- `permission-coverage.test.ts` - Coverage validation
- `permission-integration.test.ts` - Integration testing
- `permission-types.test.ts` - Type validation
- `permission-validation.test.ts` - Validation logic testing
- `directory-access-validator.test.ts` - Path validation testing

## Conclusion

The @apex/core package implements a robust, multi-layered permission system that provides:
- Fine-grained tool access control
- File system access protection
- Dangerous operation detection
- Secret exposure prevention
- Policy-based governance
- Flexible configuration options

The permission handling is well-architected with clear separation of concerns, comprehensive validation, and extensive configurability to support different security postures and use cases.