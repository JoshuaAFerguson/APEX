# @apex/cli Package Permission Handling Audit Report

## Overview

This document provides a comprehensive audit of all permission-handling code paths in the `@apex/cli` package. The audit covers command authorization, user prompts for dangerous operations, approval workflows, and security mechanisms.

## Summary

The APEX CLI implements a multi-layered permission and authorization system with the following key components:

1. **Dangerous Operation Confirmation System** - Protects against destructive actions
2. **Approval Gate System** - Workflow-based approval for autonomous operations
3. **Permission Prompt System** - Fine-grained permission requests for tool operations
4. **Autonomy Level Configuration** - Controls automation vs. manual oversight
5. **System-level Permission Handling** - File system and service management permissions

## 1. Dangerous Operation Confirmation System

### Location: `src/utils/confirmation.ts`

**Purpose**: Prevents accidental execution of destructive operations by requiring user confirmation based on autonomy level.

**Key Components**:

- **DangerousOperation Enum**: Defines categories of dangerous operations
  - `CANCEL_TASK` - Terminate running tasks (medium risk)
  - `TRASH_TASK` - Move tasks to trash (low risk, reversible)
  - `EMPTY_TRASH` - Permanently delete tasks (high risk, irreversible)
  - `MERGE_TASK` - Merge task branch (medium risk)
  - `DELETE_TEMPLATE` - Delete task templates (high risk, irreversible)
  - `UNARCHIVE_TASK` - Restore archived tasks (low risk)

- **shouldShowConfirmation()**: Determines if confirmation is needed based on:
  - Operation risk level (low/medium/high)
  - Autonomy level (full-auto/review-before-commit/review-all)
  - Whether operation is irreversible

- **confirmDangerousOperation()**: Interactive confirmation prompt with:
  - Color-coded warnings based on risk level
  - Context and resource information
  - Safety-first defaults (defaults to "no")

- **requestConfirmation()**: Convenience wrapper combining autonomy checking and prompting

**Usage Locations**:
- `src/index.ts:784` - Task cancellation confirmation
- `src/index.ts:2378` - Task merge confirmation
- `src/index.ts:3944` - Task trash confirmation
- `src/index.ts:4052` - Empty trash confirmation (forced confirmation)

## 2. Approval Gate System

### Location: `src/ui/components/autonomy/ApprovalGate.tsx`

**Purpose**: Provides workflow-based approval gates for autonomous operations during task execution.

**Key Components**:

- **ApprovalGateRequest Interface**: Defines approval requests with:
  - Gate type (before-commit, before-destructive, before-network, etc.)
  - Task context and metadata
  - Optional timeout for auto-denial
  - Agent and stage information

- **ApprovalGate Component**: Interactive React component with:
  - Visual indicators for different gate types
  - Keyboard navigation (A/D for approve/deny)
  - Timeout countdown display
  - Context-rich information display

- **ApprovalQueue Component**: Manages multiple pending approvals with:
  - Queue navigation
  - Batch approval capabilities
  - Priority-based ordering

**Gate Types**:
- `before-commit` - Code commit approval (📤)
- `before-destructive` - Destructive operation approval (⚠️)
- `before-network` - Network operation approval (🌐)
- `before-file-write` - File modification approval (📝)
- `review-all` - General operation approval (👀)

### Location: `src/utils/approval-prompt.ts`

**Purpose**: Command-line approval prompts for orchestrator events.

**Key Components**:

- **showApprovalPrompt()**: Terminal-based approval interface with:
  - Rich event data display (task info, affected files, changes summary)
  - Three response options: Approve, Deny, Request More Info
  - Timeout handling and expiration warnings
  - Context metadata display

- **promptForAdditionalInfo()**: Handles info-requested responses with follow-up prompts

**Integration**: Connected to ApprovalRequiredEventData from orchestrator events

## 3. Permission Prompt System

### Location: `src/ui/components/permissions/PermissionPrompt.tsx`

**Purpose**: Fine-grained permission system for individual tool operations.

**Key Components**:

- **PermissionRequest Interface**: Defines permission requests with:
  - Tool name and operation type
  - Scope (file path, command, etc.)
  - Danger level assessment (low/medium/high/critical)
  - Operation parameters and context

- **PermissionLevel Enum**: Three response levels:
  - `allow-always` - Permanent permission
  - `allow-once` - Single-use permission
  - `deny` - Block operation

- **PermissionPrompt Component**: Interactive permission UI with:
  - Risk-based color coding
  - Detailed parameter display
  - Direct key selection (A/O/D)
  - Safety warnings for high-risk operations

- **PermissionHistory Component**: Tracks and displays past permission decisions

**Danger Level Assessment**:
- **Critical** (🚨): May cause irreversible damage
- **High** (⚠️): Destructive operation
- **Medium** (⚡): May modify important files
- **Low** (⚠️): Minor security concern

## 4. Autonomy Level Configuration

**Purpose**: Controls the balance between automation and manual oversight throughout the CLI.

**Autonomy Levels**:

1. **full-auto**:
   - Only shows confirmation for irreversible high-consequence operations
   - Maximum automation, minimal interruption

2. **review-before-commit**:
   - Shows confirmation for medium and high consequence operations
   - Balances automation with safety

3. **review-all**:
   - Always shows confirmation prompts
   - Maximum oversight, minimal automation

**Integration**: Used by `shouldShowConfirmation()` to determine when to interrupt workflow for user input.

## 5. System-level Permission Handling

### Location: `src/handlers/service-handlers.ts`, `src/handlers/daemon-handlers.ts`

**Purpose**: Handles file system and service management permissions.

**Key Components**:

- **Permission Error Detection**: Recognizes EACCES and permission-related errors
- **Platform-specific Guidance**: Provides helpful suggestions for:
  - systemd user directory permissions (`~/.config/systemd/user/`)
  - launchd agent permissions (`~/Library/LaunchAgents/`)
  - .apex directory permissions

- **Error Codes**:
  - `PERMISSION_DENIED` - Generic permission error
  - Platform-specific error messaging and resolution guidance

**Usage Locations**:
- Service installation/removal operations
- Daemon start/stop operations
- Configuration file access

## 6. Command Authorization Matrix

| Command Type | Confirmation Required | Permission Level | Risk Assessment |
|--------------|----------------------|------------------|-----------------|
| Task cancellation | Yes (if running) | Medium | Progress loss |
| Task trash | Autonomy-dependent | Low | Reversible |
| Empty trash | Always | High | Irreversible |
| Task merge | Autonomy-dependent | Medium | Git history |
| Template delete | Autonomy-dependent | High | Irreversible |
| Service install | System-level | Medium | System modification |
| Daemon operations | System-level | Low | Process management |
| File operations | Tool-dependent | Variable | Context-dependent |

## 7. Security Features

### Input Validation
- All confirmation prompts validate user input
- Default to safe options (deny/cancel)
- Timeout handling prevents hanging prompts

### Error Handling
- Graceful degradation when permission denied
- Helpful error messages with resolution guidance
- Platform-specific permission diagnostics

### Audit Trail
- Permission decisions can be logged
- Permission history tracking available
- Approval responses include timestamps and approver info

## 8. Testing Coverage

The permission system has comprehensive test coverage including:

- **Unit tests**: Individual function behavior
- **Integration tests**: Cross-component workflows
- **Edge case tests**: Timeout handling, invalid input
- **Platform tests**: Windows/Linux/macOS specific scenarios
- **E2E tests**: Complete user flows

**Test Locations**:
- `src/utils/__tests__/confirmation.*` - Confirmation system tests
- `src/utils/__tests__/approval-prompt.*` - Approval prompt tests
- `src/ui/components/permissions/__tests__/` - Permission component tests
- `src/__tests__/cli-confirmation-*` - End-to-end confirmation flows

## 9. Key Files and Locations

| File Path | Purpose | Key Exports |
|-----------|---------|-------------|
| `src/utils/confirmation.ts` | Dangerous operation confirmation | `requestConfirmation`, `DangerousOperation` |
| `src/utils/approval-prompt.ts` | Orchestrator approval prompts | `showApprovalPrompt` |
| `src/ui/components/permissions/PermissionPrompt.tsx` | Tool permission prompts | `PermissionPrompt`, `PermissionRequest` |
| `src/ui/components/autonomy/ApprovalGate.tsx` | Workflow approval gates | `ApprovalGate`, `ApprovalQueue` |
| `src/handlers/service-handlers.ts` | Service permission handling | Permission error handling |
| `src/handlers/daemon-handlers.ts` | Daemon permission handling | Permission error handling |
| `src/index.ts` | Command integration | CLI command confirmation usage |

## 10. Recommendations

1. **Security**: The permission system is well-designed with appropriate safety defaults
2. **User Experience**: Multiple interaction modes (CLI, React UI) provide good flexibility
3. **Maintainability**: Clear separation of concerns between different permission types
4. **Documentation**: Comprehensive test coverage demonstrates expected behaviors

## 11. Conclusion

The @apex/cli package implements a robust, multi-layered permission and authorization system that appropriately balances automation capabilities with user control and safety. The system covers:

- **Destructive operation protection** through confirmation workflows
- **Fine-grained tool permissions** with risk assessment
- **Workflow-based approval gates** for autonomous operations
- **System-level permission handling** with helpful diagnostics
- **Configurable autonomy levels** to match user preferences

The implementation demonstrates security-first design principles with comprehensive testing and good separation of concerns.