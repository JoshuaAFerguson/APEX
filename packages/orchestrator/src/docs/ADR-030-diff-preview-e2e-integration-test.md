# ADR-030: End-to-End Diff Preview Workflow Integration Test

## Status
Proposed

## Context
The diff preview feature (v0.5.0) emits `diff:preview` events when file-modifying tools (Write, Edit, MultiEdit, NotebookEdit) are about to make changes. We need an integration test to verify the complete end-to-end workflow in non-interactive mode.

## Decision

### Test File Location
```
packages/orchestrator/src/__tests__/diff-preview-e2e.integration.test.ts
```

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    Integration Test Structure                            │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌─────────────────┐    ┌──────────────────┐    ┌──────────────────┐   │
│  │   Test Setup    │───▶│  Event Capture   │───▶│   Assertions     │   │
│  │                 │    │                  │    │                  │   │
│  │ - Temp directory│    │ - EventEmitter   │    │ - Event order    │   │
│  │ - Mock store    │    │ - diff:preview   │    │ - Event data     │   │
│  │ - Hook context  │    │   listener       │    │ - Task status    │   │
│  │ - Config setup  │    │ - Event array    │    │                  │   │
│  └─────────────────┘    └──────────────────┘    └──────────────────┘   │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                     Test Workflow Flow                           │   │
│  │                                                                  │   │
│  │   1. Initialize   2. Simulate Tool   3. Verify Events   4. Verify│   │
│  │      Config          Execution           Emitted           State │   │
│  │                                                                  │   │
│  │   ┌──────────┐    ┌──────────────┐   ┌──────────────┐   ┌──────┐│   │
│  │   │ diffPreview│──▶│captureSnapshot│──▶│generateDiff │──▶│emit  ││   │
│  │   │ = true    │   │  hook        │   │  + emit event│   │check ││   │
│  │   └──────────┘    └──────────────┘   └──────────────┘   └──────┘│   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### Key Interfaces

#### DiffPreviewEvent (from packages/orchestrator/src/index.ts)
```typescript
export interface DiffPreviewEvent {
  taskId: string;
  toolName: string;     // 'Write' | 'Edit' | 'MultiEdit' | 'NotebookEdit'
  callId: string;
  filePath: string;
  diff: string;         // Unified diff format
  addedLines: number;
  removedLines: number;
  timestamp: Date;
}
```

#### HookContext (from packages/orchestrator/src/hooks.ts)
```typescript
export interface HookContext {
  taskId: string;
  store: TaskStore;
  eventEmitter?: {
    emit: (event: string, data: unknown) => void;
  };
  fileSnapshots?: Map<string, string>;
  config?: {
    ui?: {
      diffPreview?: boolean;  // Default: true (enabled)
    };
  };
}
```

### Test Categories

#### 1. Non-Interactive Mode Configuration
- Test with `config.ui.diffPreview = true` (events should emit)
- Test with `config.ui.diffPreview = false` (events should NOT emit)
- Test with no config (default enabled, events should emit)

#### 2. Complete Workflow Verification
```typescript
describe('End-to-End Non-Interactive Diff Preview Workflow', () => {
  // Setup: Create temp directory, mock store, event emitter
  // 1. Initialize task with diff preview enabled
  // 2. Simulate tool execution (Write/Edit)
  // 3. Verify diff:preview event emitted with correct data
  // 4. Verify event order and timing
  // 5. Verify task completes successfully
});
```

#### 3. Event Order Verification
```
Expected Event Sequence:
1. task:created (optional, if testing full lifecycle)
2. task:started (optional, if testing full lifecycle)
3. diff:preview (for each file-modifying tool call)
4. task:completed (optional, if testing full lifecycle)
```

#### 4. Multi-Tool Workflow
Test that multiple diff:preview events are emitted correctly:
- Write tool creates new file → diff:preview event
- Edit tool modifies file → diff:preview event
- Verify events are independent and ordered correctly

### Implementation Blueprint

```typescript
// packages/orchestrator/src/__tests__/diff-preview-e2e.integration.test.ts

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs';
import * as fsPromises from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { EventEmitter } from 'events';
import type { HookContext } from '../hooks';
import type { DiffPreviewEvent } from '../index';
import { generateFileDiff, generateDiff } from '../utils/diff';

describe('Diff Preview End-to-End Non-Interactive Workflow', () => {
  let tempDir: string;
  let mockEventEmitter: EventEmitter;
  let capturedEvents: DiffPreviewEvent[];
  let mockStore: {
    addLog: ReturnType<typeof vi.fn>;
  };
  let mockFileSnapshots: Map<string, string>;

  beforeEach(async () => {
    // Create isolated test environment
    tempDir = await fsPromises.mkdtemp(
      path.join(os.tmpdir(), 'apex-diff-e2e-')
    );

    // Setup event capture
    mockEventEmitter = new EventEmitter();
    capturedEvents = [];
    mockEventEmitter.on('diff:preview', (event: DiffPreviewEvent) => {
      capturedEvents.push(event);
    });

    // Mock store
    mockStore = {
      addLog: vi.fn().mockResolvedValue(undefined),
    };

    // File snapshots map
    mockFileSnapshots = new Map();

    vi.clearAllMocks();
  });

  afterEach(async () => {
    mockEventEmitter.removeAllListeners();
    await fsPromises.rm(tempDir, { recursive: true, force: true });
  });

  // Helper to create HookContext for non-interactive mode
  const createNonInteractiveContext = (
    options?: { diffPreviewEnabled?: boolean }
  ): HookContext => ({
    taskId: `e2e-test-${Date.now()}`,
    store: mockStore as any,
    eventEmitter: mockEventEmitter,
    fileSnapshots: mockFileSnapshots,
    config: {
      ui: {
        diffPreview: options?.diffPreviewEnabled ?? true,
      },
    },
  });

  describe('Complete Non-Interactive Flow', () => {
    it('should emit diff:preview for Write tool in correct order', async () => {
      // Test implementation
    });

    it('should emit diff:preview for Edit tool using file snapshots', async () => {
      // Test implementation
    });

    it('should emit multiple diff:preview events in sequence', async () => {
      // Test implementation
    });

    it('should complete task successfully after emitting events', async () => {
      // Test implementation
    });
  });

  describe('Non-Interactive Configuration Behavior', () => {
    it('should respect diffPreview=false and not emit events', async () => {
      // Test with diffPreview: false
    });

    it('should default to enabled when no config provided', async () => {
      // Test default behavior
    });
  });

  describe('Event Data Validation', () => {
    it('should emit events with complete DiffPreviewEvent structure', async () => {
      // Validate all required fields
    });

    it('should include accurate diff statistics', async () => {
      // Verify addedLines, removedLines accuracy
    });
  });
});
```

### Mock Patterns

#### EventEmitter Mock with Capture
```typescript
const mockEventEmitter = new EventEmitter();
const capturedEvents: Array<{ event: string; data: unknown }> = [];

// Intercept all events
const originalEmit = mockEventEmitter.emit.bind(mockEventEmitter);
mockEventEmitter.emit = function(event: string, data?: unknown) {
  capturedEvents.push({ event, data });
  return originalEmit(event, data);
};
```

#### Store Mock
```typescript
const mockStore = {
  addLog: vi.fn().mockResolvedValue(undefined),
  saveTask: vi.fn().mockResolvedValue(undefined),
  getTask: vi.fn().mockResolvedValue(mockTask),
  updateTask: vi.fn().mockResolvedValue(undefined),
};
```

#### File System Mock (when needed)
```typescript
vi.mock('fs', () => ({
  existsSync: vi.fn(),
  readFileSync: vi.fn(),
}));

const mockedFs = vi.mocked(fs);
mockedFs.existsSync.mockReturnValue(true);
mockedFs.readFileSync.mockReturnValue('original content');
```

### Acceptance Criteria Verification

| Requirement | Test Coverage |
|-------------|---------------|
| Initialize task with diff preview workflow | `createNonInteractiveContext()` with `diffPreview: true` |
| Run in non-interactive mode | No approval gates, `autoApprove: true` equivalent |
| Verify diff is generated | `expect(diffResult.hasDifferences).toBe(true)` |
| Events emitted in correct order | `expect(capturedEvents[0].event).toBe('diff:preview')` |
| Task completes successfully | Verify no errors, mock store updates |
| Test passes with npm run test | vitest integration test |

### File Dependencies

**Source Files:**
- `packages/orchestrator/src/hooks.ts` - HookContext, generateDiffPreview
- `packages/orchestrator/src/index.ts` - DiffPreviewEvent, OrchestratorEvents
- `packages/orchestrator/src/utils/diff.ts` - generateFileDiff, generateDiff

**Reference Tests:**
- `packages/orchestrator/src/diff-preview-integration.test.ts` - Existing patterns
- `packages/orchestrator/src/__tests__/approval-gate-controller.integration.test.ts` - Integration test structure

### Test Isolation Strategy

1. **Temp Directory**: Each test creates isolated temp directory
2. **Fresh Mocks**: `vi.clearAllMocks()` in beforeEach
3. **Event Listener Cleanup**: `removeAllListeners()` in afterEach
4. **No Shared State**: Each test creates its own context

### Event Order Verification Pattern

```typescript
it('should emit events in correct order for multi-file workflow', async () => {
  const eventOrder: string[] = [];

  mockEventEmitter.on('diff:preview', () => eventOrder.push('diff:preview'));

  // Simulate Write tool for file1
  mockEventEmitter.emit('diff:preview', { /* file1 event data */ });

  // Simulate Edit tool for file2
  mockEventEmitter.emit('diff:preview', { /* file2 event data */ });

  expect(eventOrder).toEqual(['diff:preview', 'diff:preview']);
  expect(capturedEvents).toHaveLength(2);
  expect(capturedEvents[0].toolName).toBe('Write');
  expect(capturedEvents[1].toolName).toBe('Edit');
});
```

## Consequences

### Positive
- Comprehensive coverage of diff preview workflow in non-interactive mode
- Clear verification of event emission and ordering
- Reusable patterns for future integration tests
- Follows established codebase patterns

### Negative
- Integration tests may be slower than unit tests
- Requires temp directory management
- Mock complexity for full workflow simulation

### Neutral
- Uses existing testing infrastructure (vitest)
- Follows ADR format for documentation

## Notes for Developer Stage

1. Create test file at `packages/orchestrator/src/__tests__/diff-preview-e2e.integration.test.ts`
2. Follow mock patterns from existing integration tests
3. Use `generateFileDiff` and `generateDiff` utilities directly
4. Ensure all events are captured and verified
5. Clean up temp directories in afterEach
6. Run `npm run build` and `npm run test` to verify
