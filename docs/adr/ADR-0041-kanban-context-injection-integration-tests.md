# ADR 0041: KanbanBoard Context Injection Integration Tests Technical Design

## Status
Accepted

## Date
2026-03-22

## Context

The KanbanBoard context injection feature allows users to inject additional context into running tasks directly from the Kanban board UI. Integration tests are needed to verify that this feature works correctly when the KanbanBoard component is rendered within the TasksPage context.

### Acceptance Criteria

1. Context injection button appears on KanbanBoard cards when rendered in TasksPage context
2. Modal opens on button click
3. Context can be submitted via the modal form
4. UI updates correctly after submission (modal closes, states reset)
5. All integration tests pass

### Current State Analysis

The following components already exist:
- `KanbanBoard.tsx` - Main board component with context injection button integrated into KanbanCard
- `ContextInjectionModal.tsx` - Modal for entering and submitting context
- `api-client.ts` - Has `injectContext()` method for API calls
- Existing test file: `KanbanBoard-context-injection-taskspage.integration.test.tsx` (has 6 failing tests)

### Identified Issues in Existing Tests

1. **Incorrect mock assertions** - Some tests expect a different call signature than what the code produces
2. **Missing `modal` variable** - Test at line 400 references `modal` but it's not defined in scope
3. **Button disabled state** - Tests expect button to be disabled during loading, but the implementation doesn't sync modal loading state to button
4. **Timeout on character limit test** - Typing 100,001 characters is too slow
5. **Wrong API call format** - Tests expect `{taskId, context, priority}` but API sends `(taskId, {context, priority})`

## Decision

### Test Architecture

```
┌──────────────────────────────────────────────────────────────────────────┐
│ KanbanBoard-context-injection-taskspage.integration.test.tsx             │
│                                                                          │
│  ┌────────────────────────────────────────────────────────────────────┐  │
│  │ Test Setup                                                         │  │
│  │  - Mock API client (vi.mock)                                       │  │
│  │  - Mock Next.js navigation                                         │  │
│  │  - Mock drag-and-drop hook (simplify tests)                        │  │
│  │  - Standard mock tasks for all statuses                            │  │
│  │  - TasksPage-like props configuration                              │  │
│  └────────────────────────────────────────────────────────────────────┘  │
│                                                                          │
│  ┌────────────────────────────────────────────────────────────────────┐  │
│  │ Test Suites                                                        │  │
│  │                                                                    │  │
│  │  1. Button Visibility (by task status)                             │  │
│  │     - in-progress, pending, planning, waiting-approval, paused     │  │
│  │     - completed, failed, cancelled (should NOT show button)        │  │
│  │                                                                    │  │
│  │  2. Modal Integration Flow                                         │  │
│  │     - Opens modal on button click                                  │  │
│  │     - Closes on cancel button                                      │  │
│  │     - Closes on backdrop click                                     │  │
│  │     - Closes on successful submission                              │  │
│  │     - Stays open on error                                          │  │
│  │     - Prevents navigation on button click                          │  │
│  │                                                                    │  │
│  │  3. Context Submission Flow                                        │  │
│  │     - Submits with required fields                                 │  │
│  │     - Submits with optional source field                           │  │
│  │     - Submits with different priority levels                       │  │
│  │     - Shows loading state during submission                        │  │
│  │     - Displays error message on failure                            │  │
│  │     - Resets form after successful submission                      │  │
│  │                                                                    │  │
│  │  4. UI State Updates                                               │  │
│  │     - Disables submit when context empty                           │  │
│  │     - Enables submit when context has value                        │  │
│  │     - Updates character count                                      │  │
│  │     - Validates character limit                                    │  │
│  │                                                                    │  │
│  │  5. TasksPage Callbacks Integration                                │  │
│  │     - Verify API calls have correct format                         │  │
│  │     - Error handling integration                                   │  │
│  │     - Success flow integration                                     │  │
│  └────────────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────────────┘
```

### Component Integration Flow

```
┌─────────────────────────────────────────────────────────────────────────┐
│ TasksPage (simulated via props)                                         │
│                                                                         │
│   Props passed to KanbanBoard:                                          │
│   - onCancel: (taskId, event) => void                                   │
│   - onRetry: (taskId, event) => void                                    │
│   - actionLoading: string | null                                        │
│   - refreshKey: number                                                  │
│   - onError: (error: string) => void                                    │
│   - onSuccess: (message: string) => void                                │
│                                                                         │
└────────────────────────────────┬────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ KanbanBoard                                                             │
│                                                                         │
│   ┌──────────────┐  ┌──────────────┐  ┌──────────────┐                  │
│   │ KanbanColumn │  │ KanbanColumn │  │ KanbanColumn │                  │
│   │   (pending)  │  │ (in-progress)│  │  (completed) │                  │
│   │              │  │              │  │              │                  │
│   │ ┌──────────┐ │  │ ┌──────────┐ │  │ ┌──────────┐ │                  │
│   │ │KanbanCard│ │  │ │KanbanCard│ │  │ │KanbanCard│ │                  │
│   │ │ [✓ ctx]  │ │  │ │ [✓ ctx]  │ │  │ │ [✗ ctx]  │ │                  │
│   │ └──────────┘ │  │ └──────────┘ │  │ └──────────┘ │                  │
│   └──────────────┘  └──────────────┘  └──────────────┘                  │
│                                                                         │
│   Context injection button visible for:                                 │
│   - in-progress, pending, planning, waiting-approval, paused            │
│                                                                         │
│   Context injection button hidden for:                                  │
│   - completed, failed, cancelled                                        │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### API Call Contract

```typescript
// API Client Method Signature
apiClient.injectContext(
  taskId: string,
  request: InjectContextRequest
): Promise<InjectContextResponse>

// InjectContextRequest interface
interface InjectContextRequest {
  context: string;           // Required - the context to inject
  source?: string;           // Optional - e.g., 'user feedback', 'documentation'
  priority?: 'low' | 'normal' | 'high';  // Optional, defaults to 'normal'
}

// InjectContextResponse interface
interface InjectContextResponse {
  ok: true;
  taskId: string;
  contextInjected: boolean;
  timestamp: Date;
}
```

### Test Helper Functions

```typescript
// Helper to test the full context injection flow
async function testContextInjectionFlow(
  taskDescription: string,
  contextText: string
): Promise<{ modal: HTMLElement; textarea: HTMLElement; submitButton: HTMLElement }>

// Standard mock tasks covering all statuses
const mockTasks = {
  inProgress: Task,    // status: 'in-progress'
  pending: Task,       // status: 'pending'
  planning: Task,      // status: 'planning'
  waitingApproval: Task, // status: 'waiting-approval'
  paused: Task,        // status: 'paused'
  completed: Task,     // status: 'completed'
  failed: Task,        // status: 'failed'
  cancelled: Task,     // status: 'cancelled'
}
```

### Key Test Patterns

1. **Render Pattern**: Always render with TasksPage-like props
   ```typescript
   render(<KanbanBoard {...tasksPageProps} />)
   ```

2. **Card Selection Pattern**: Use task description to find the card
   ```typescript
   const taskCard = screen.getByText('Task description').closest('.group')!
   ```

3. **Hover for Button Visibility**: Use fireEvent.mouseEnter
   ```typescript
   fireEvent.mouseEnter(taskCard)
   const contextButton = within(taskCard).getByTitle('Inject context')
   ```

4. **Modal Context Pattern**: Always use `within(modal)` for modal elements
   ```typescript
   const modal = screen.getByRole('dialog')
   const textarea = within(modal).getByLabelText(/^Context/)
   ```

5. **API Mock Pattern**: Verify correct call signature
   ```typescript
   expect(mockApiClient.injectContext).toHaveBeenCalledWith(
     'task-id',
     { context: 'text', priority: 'normal' }
   )
   ```

### Fixes Required for Existing Tests

| Issue | Fix |
|-------|-----|
| Line 400 - undefined `modal` | Define `modal = screen.getByRole('dialog')` before using |
| Wrong API call assertion format | Change `toHaveBeenCalledWith({ taskId, context })` to `toHaveBeenCalledWith(taskId, { context })` |
| Button disabled during loading | Either update component or adjust test expectation |
| Character limit timeout | Use `fireEvent.change()` instead of `user.type()` for large content |
| Duplicate within references | Use fresh `modal` reference after re-opening |

### Test File Structure

```
packages/web-ui/src/components/tasks/__tests__/
├── KanbanBoard-context-injection-taskspage.integration.test.tsx  # Integration tests
├── KanbanCard-context-injection.test.tsx                         # Unit tests (existing)
├── ContextInjectionModal.test.tsx                                # Modal unit tests (if exists)
└── KanbanBoard-integration.test.tsx                              # Other integration tests
```

## Consequences

### Positive

- Comprehensive test coverage for context injection feature in TasksPage context
- Tests verify the complete user flow from button visibility to submission
- Mock patterns are reusable for other KanbanBoard tests
- Clear documentation of expected behavior

### Negative

- Tests are dependent on specific DOM structure (.group class, etc.)
- React act() warnings for Link component updates (harmless but noisy)

### Risks

- DOM structure changes could break tests
- API contract changes would require test updates

## Implementation Plan

1. **Fix existing test issues** (architecture stage)
   - Fix undefined `modal` variable
   - Fix API assertion format
   - Optimize character limit test

2. **Verify all tests pass** (implementation stage)
   - Run `npm run build`
   - Run `npm run test` for the specific test file
   - Ensure all 29 tests pass

## Related

- ADR 0011: KanbanCard Context Injection Button
- ADR 0010: Context Injection API Endpoint
- `packages/web-ui/src/components/tasks/KanbanBoard.tsx`
- `packages/web-ui/src/components/tasks/ContextInjectionModal.tsx`
