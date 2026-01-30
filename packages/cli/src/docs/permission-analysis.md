# APEX CLI Permission-Related Code Analysis

## Summary

The @apex/cli package contains **4 distinct permission/authorization subsystems** across **12 source files** (excluding tests):

## 1. **Permission System** (Interactive Tool Permission Requests)

### **Files:**
- `packages/cli/src/ui/components/permissions/PermissionPrompt.tsx` (351 lines)
- `packages/cli/src/ui/components/permissions/index.ts` (8 lines)

### **Core Components:**
- **PermissionPrompt**: Interactive UI component for requesting user authorization for tool operations
- **PermissionHistory**: Display component for reviewing past permission decisions

### **Key Types:**
```typescript
type PermissionLevel = 'allow-always' | 'allow-once' | 'deny';

interface PermissionRequest {
  id: string;
  tool: string;
  scope?: string;
  operation: string;
  isDangerous: boolean;
  dangerLevel?: 'low' | 'medium' | 'high' | 'critical';
  context?: string;
  parameters?: Record<string, unknown>;
  timestamp: Date;
}
```

### **Access Control Logic:**
- Risk-based authorization with 4 danger levels (low/medium/high/critical)
- Visual indicators with color-coded risk assessment
- Keyboard-driven permission granting with shortcuts (A/O/D keys)
- Parameter sanitization and display limiting
- Timeline tracking for permission requests

## 2. **Approval Gate System** (Workflow Stage Approval)

### **Files:**
- `packages/cli/src/ui/components/autonomy/ApprovalGate.tsx` (385 lines)
- `packages/cli/src/ui/components/autonomy/index.ts` (15 lines)
- `packages/cli/src/utils/approval-prompt.ts` (248 lines)

### **Core Components:**
- **ApprovalGate**: UI component for workflow stage approvals
- **ApprovalQueue**: Management interface for multiple pending approvals
- **showApprovalPrompt**: CLI prompt handler for approval requests

### **Gate Types:**
- `before-commit`: Code commit approval
- `before-destructive`: Destructive operation approval
- `before-network`: Network operation approval
- `before-file-write`: File modification approval
- `review-all`: General operation approval

### **Access Control Logic:**
- Timeout-based auto-denial system
- Queue management for multiple approvals
- Context-sensitive approval prompts
- Response tracking with timestamps

### **Integration Points:**
```typescript
// Main CLI integration (packages/cli/src/index.ts lines 4351-4405)
ctx.orchestrator.on('approval:required', approvalHandler);

// REPL integration (packages/cli/src/repl.tsx lines 1801-1877)
ctx.orchestrator.on('approval:required', async (eventData) => {...});
```

## 3. **Confirmation System** (Dangerous Operation Protection)

### **Files:**
- `packages/cli/src/utils/confirmation.ts` (201 lines)

### **Dangerous Operations Protected:**
```typescript
enum DangerousOperation {
  CANCEL_TASK = 'cancel_task',
  TRASH_TASK = 'trash_task',
  EMPTY_TRASH = 'empty_trash',
  MERGE_TASK = 'merge_task',
  DELETE_TEMPLATE = 'delete_template',
  UNARCHIVE_TASK = 'unarchive_task'
}
```

### **Access Control Logic:**
- **Autonomy Level Integration**: Confirmation requirements vary by autonomy level
  - `full-auto`: Only irreversible high-consequence operations require confirmation
  - `review-before-commit`: Medium and high consequence operations require confirmation
  - `review-all`: All operations require confirmation
- **Risk Assessment**: 3-tier consequence system (low/medium/high)
- **Irreversibility Tracking**: Special handling for operations that cannot be undone

### **Core Functions:**
- `shouldShowConfirmation()`: Determines if confirmation needed based on autonomy level
- `confirmDangerousOperation()`: Shows interactive confirmation prompt
- `requestConfirmation()`: Combined autonomy checking and prompting

## 4. **Resource Limit System** (Usage-Based Access Control)

### **Files:**
- `packages/cli/src/ui/components/autonomy/LimitWarning.tsx` (381 lines)
- `packages/cli/src/ui/components/status/useLimitColors.ts`
- `packages/cli/src/ui/components/status/ResourceLimitBar.tsx`

### **Resource Types Monitored:**
- **Tokens**: API token usage limits
- **Cost**: Financial spending limits
- **Time**: Execution time limits
- **Files**: File modification limits
- **Lines**: Code line change limits

### **Access Control Logic:**
- **Progressive Warning System**: Color-coded warnings at 60%, 75%, 85%, 95% thresholds
- **Hard Limits**: Task execution paused when limits exceeded
- **Visual Indicators**: Progress bars and usage dashboards
- **Resource Tracking**: Real-time monitoring of resource consumption

## Cross-Cutting Integration Points

### **Event System Integration:**
```typescript
// Approval events (index.ts & repl.tsx)
orchestrator.on('approval:required', handler);
orchestrator.respondToApproval(approvalId, response);

// Info request follow-ups
orchestrator.on('approval:info-requested', handler);
```

### **Configuration Integration:**
```typescript
// Autonomy levels affect confirmation behavior
type AutonomyLevel = 'full-auto' | 'review-before-commit' | 'review-all';
```

### **Display Mode Support:**
All permission components support 3 display modes:
- `normal`: Full interactive interface
- `compact`: Minimal space usage
- `verbose`: Maximum detail display

## Permission Flow Architecture

### **Tool Permission Flow:**
1. Tool requests permission → PermissionRequest created
2. Risk assessment → danger level assigned
3. UI prompt → PermissionPrompt component shown
4. User decision → PermissionLevel response
5. History tracking → PermissionHistory updated

### **Approval Gate Flow:**
1. Workflow stage triggers → ApprovalGateRequest created
2. Gate type identified → appropriate prompt shown
3. Queue management → multiple approvals handled
4. Timeout monitoring → auto-denial if expired
5. Response processing → workflow continues/blocks

### **Confirmation Flow:**
1. Dangerous operation detected → DangerousOperation enum matched
2. Autonomy check → shouldShowConfirmation() evaluated
3. Risk assessment → consequence level determined
4. User prompt → confirmation dialog shown
5. Operation control → proceed/cancel based on response

### **Resource Limit Flow:**
1. Resource usage monitored → real-time tracking
2. Warning thresholds → progressive alerts shown
3. Limit exceeded → hard stop enforcement
4. User notification → limit violation display
5. Acknowledgment → user must acknowledge to continue

## Security Considerations

### **Permission Escalation Prevention:**
- No automatic "allow-always" without explicit user consent
- Dangerous operations clearly marked with visual indicators
- Parameters sanitized and truncated for display
- Timeout mechanisms prevent indefinite privilege elevation

### **Audit Trail:**
- Permission decisions logged with timestamps
- Approval responses tracked with context
- Resource usage monitoring provides consumption audit
- Operation consequences clearly communicated before authorization

### **Risk Mitigation:**
- Multiple authorization layers (permissions, approvals, confirmations, limits)
- Context-sensitive security prompts
- Autonomy level configuration provides defense in depth
- Visual risk indicators help users make informed decisions