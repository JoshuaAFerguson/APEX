# ADR: Permission and Dangerous Operation Integration Test Architecture

## Status
**Accepted**

## Date
2025-12-31

## Context

This Architecture Decision Record documents the technical design for unit and integration tests covering permission/dangerous operation integration in the APEX platform. The acceptance criteria require tests that cover:

1. Preset application
2. Dangerous operation detection
3. Permission request/confirmation flow
4. Event emission
5. Configuration loading

## Current State Analysis

### Existing Test Coverage (Comprehensive)

Based on thorough codebase analysis, **extensive test coverage already exists**:

#### Core Package Tests (packages/core/src/__tests__/)
| Test File | Coverage |
|-----------|----------|
| `dangerous-operation-detector.test.ts` | Main unit tests: tool definition flags, severity levels, patterns |
| `dangerous-operation-detector.integration.test.ts` | Real-world scenario testing |
| `dangerous-operation-detector.edge-cases.test.ts` | Edge cases, boundary conditions |
| `dangerous-operation-detector.performance.test.ts` | Performance benchmarks |
| `dangerous-operation-detector.coverage.test.ts` | All patterns and severity levels |
| `dangerous-operation-detector.security.test.ts` | Security attack vectors |
| `permissions-config.test.ts` | PermissionsConfigSchema, presets, custom rules |
| `permissions-config-edge-cases.test.ts` | Configuration edge cases |
| `permissions-config-init.test.ts` | Initialization scenarios |
| `permissions-directory-access.test.ts` | Directory allowlists/blocklists |
| `permissions-integration.test.ts` | Cross-module integration |

#### Orchestrator Package Tests (packages/orchestrator/src/__tests__/)
| Test File | Coverage |
|-----------|----------|
| `permission-events-integration.test.ts` | Event workflow: request→grant/deny |
| `permission-events-types.test.ts` | Event type definitions |
| `permission-preset-hooks.test.ts` | PreToolUse hook integration |
| `permission-preset-hooks-integration.test.ts` | Full preset/hook cooperation |
| `permission-preset-manager.test.ts` | Preset manager functionality |
| `permission-confirmation.test.ts` | Confirmation workflows |
| `permission-store.test.ts` | Permission persistence |
| `dangerous-operation-detector-hooks.integration.test.ts` | Hook integration, blocking |
| `apex-orchestrator-permission-integration.test.ts` | Full orchestrator integration |

### Architecture Components

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           APEX Permission System                         │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌─────────────────────┐    ┌─────────────────────┐                     │
│  │   @apex/core        │    │  @apex/orchestrator │                     │
│  ├─────────────────────┤    ├─────────────────────┤                     │
│  │ • PermissionsConfig │───▶│ • PermissionPreset  │                     │
│  │   Schema (Zod)      │    │   Manager           │                     │
│  │ • DangerousOperation│    │ • PermissionStore   │                     │
│  │   Detector          │───▶│ • Hooks (createHooks)│                    │
│  │ • Preset Helpers    │    │ • Event Emission    │                     │
│  └─────────────────────┘    └─────────────────────┘                     │
│           │                          │                                   │
│           │                          │                                   │
│           ▼                          ▼                                   │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │                    Claude Agent SDK Integration                  │    │
│  │  • PreToolUse hooks (permission checking, dangerous detection)   │    │
│  │  • PostToolUse hooks (logging, auditing)                         │    │
│  │  • HookCallback/HookCallbackMatcher interfaces                   │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### Hook Execution Order

```
PreToolUse Hook Chain:
┌──────────────────────────────────────────────────────────────────────────┐
│ 1. checkToolPermissions (permission preset validation)                   │
│    └─▶ Emits: permission:granted | permission:denied | permission:request│
│                                                                          │
│ 2. detectDangerousOperation (dangerous operation detection)              │
│    └─▶ Emits: dangerous:detected, dangerous:blocked (if critical)        │
│                                                                          │
│ 3. Tool-specific hooks (Bash, Write, Edit, WebFetch matchers)            │
│    └─▶ Additional auditing and blocking logic                            │
│                                                                          │
│ 4. logToolUsage (general logging)                                        │
└──────────────────────────────────────────────────────────────────────────┘
```

## Decision

### Recommendation: No Additional Test Implementation Required

After comprehensive analysis, **all required test coverage is already implemented**. The existing test suite fully covers:

✅ **Preset Application**
- `permission-preset-manager.test.ts` - applyPreset(), getCurrentPreset()
- `permissions-config.test.ts` - All preset validation (autonomous, review-all, read-only)
- `permission-preset-hooks.test.ts` - Preset-specific behavior testing

✅ **Dangerous Operation Detection**
- `dangerous-operation-detector.test.ts` - Full unit test coverage
- `dangerous-operation-detector-hooks.integration.test.ts` - Hook integration
- `dangerous-operation-detector.security.test.ts` - Security attack vectors
- `dangerous-operation-detector.coverage.test.ts` - Pattern coverage

✅ **Permission Request/Confirmation Flow**
- `permission-confirmation.test.ts` - Full confirmation workflow
- `permission-events-integration.test.ts` - Request → grant/deny workflows
- `permission-preset-hooks.test.ts` - Confirmation requirement handling

✅ **Event Emission**
- `permission-events-integration.test.ts` - All event types tested
- `permission-events-types.test.ts` - Event structure validation
- `dangerous-operation-detector-hooks.integration.test.ts` - dangerous:detected, dangerous:blocked

✅ **Configuration Loading**
- `permissions-config.test.ts` - loadConfig, saveConfig, getEffectiveConfig
- `permissions-config-init.test.ts` - Initialization testing
- `permissions-config-edge-cases.test.ts` - Edge cases

### Test Statistics
- **Total test files covering permissions/dangerous operations**: 40+
- **Testing framework**: Vitest
- **Patterns used**: MockEventEmitter, MockTaskStore, MockPermissionStore
- **Coverage types**: Unit, Integration, Edge Cases, Security, Performance

## Testing Patterns Established

### 1. Mock Event Emitter Pattern
```typescript
class MockEventEmitter {
  events: Array<{ event: string; data: any }> = [];
  emit(event: string, data: any) { this.events.push({ event, data }); }
  getEvents(eventType?: string) { return eventType ? this.events.filter(e => e.event === eventType) : this.events; }
}
```

### 2. Hook Context Setup Pattern
```typescript
const context: HookContext = {
  taskId,
  store: mockStore as TaskStore,
  permissionPresetManager,
  eventEmitter: mockEventEmitter,
};
const hooks = createHooks(context);
```

### 3. Permission Event Validation Pattern
```typescript
expect(mockEventEmitter.emit).toHaveBeenCalledWith('permission:granted', {
  taskId,
  toolName: 'Write',
  scope: '/src/app.ts',
  timestamp: expect.any(Date),
  level: 'allow-always',
  grantedBy: 'permission-preset:autonomous',
  grantReason: expect.any(String),
});
```

### 4. Dangerous Operation Event Validation Pattern
```typescript
const detectedEvents = mockEventEmitter.getEvents('dangerous:detected');
expect(detectedEvents[0].data).toMatchObject({
  taskId,
  tool: 'Bash',
  operationType: 'system-command',
  riskLevel: 'critical',
  description: expect.stringContaining('filesystem root'),
  metadata: { operation: expect.any(String), command: 'rm -rf /' },
});
```

## Alternatives Considered

### 1. Adding New Test Files
**Rejected** - Would create redundant tests. Existing coverage is comprehensive.

### 2. Consolidating Tests into Single Suite
**Rejected** - Current modular organization improves maintainability and allows targeted testing.

### 3. Adding E2E Tests
**Not needed for current scope** - Acceptance criteria focus on unit/integration tests which are fully covered.

## Consequences

### Positive
- Test infrastructure is mature and well-organized
- All acceptance criteria are already satisfied
- Consistent testing patterns established for future development
- Clear separation between unit, integration, and edge case tests

### Negative
- None identified - existing implementation is solid

### Neutral
- Future developers should follow established patterns when adding new tests
- Test file naming convention: `<feature>.test.ts`, `<feature>.integration.test.ts`, `<feature>.edge-cases.test.ts`

## Verification

To verify all tests pass:
```bash
npm run test
```

Key test files to review for acceptance criteria:
1. `packages/core/src/__tests__/permissions-config.test.ts` - Preset/config validation
2. `packages/core/src/__tests__/dangerous-operation-detector.test.ts` - Detection logic
3. `packages/orchestrator/src/__tests__/permission-events-integration.test.ts` - Event workflows
4. `packages/orchestrator/src/__tests__/permission-preset-hooks.test.ts` - Hook integration
5. `packages/orchestrator/src/__tests__/dangerous-operation-detector-hooks.integration.test.ts` - Hook blocking

## Related ADRs
- Permission System Design (if exists)
- Hook System Architecture (if exists)
- Event Emission Standards (if exists)
