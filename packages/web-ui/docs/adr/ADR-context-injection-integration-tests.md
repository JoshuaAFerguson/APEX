# ADR: KanbanBoard Context Injection Integration Tests in TasksPage

## Status
Proposed

## Context
We need to write integration tests that verify the context injection feature works correctly when KanbanBoard cards are rendered within the TasksPage context. The acceptance criteria requires:
1. Context injection button appears on KanbanBoard cards when rendered in TasksPage context
2. Modal opens on click
3. Context can be submitted
4. UI updates correctly
5. Tests pass

## Analysis of Existing Code

### Current Test Coverage
1. **`KanbanCard-context-injection.test.tsx`** (524 lines) - Tests KanbanBoard in isolation with:
   - Button visibility for different task statuses (in-progress, pending, planning, etc.)
   - Modal opening/closing behavior
   - Context submission and API integration
   - Error handling

2. **`TaskCard.context-injection.test.tsx`** (646 lines) - Tests TaskCard component with:
   - Button visibility by task status
   - Button interactions and event propagation
   - Loading states
   - Accessibility

3. **`ContextInjectionModal.test.tsx`** (693 lines) - Tests modal component with:
   - Form behavior and validation
   - API integration
   - Callbacks and error handling

### Gap Identified
The existing tests focus on components in isolation. There is no test that verifies the integration when:
- TasksPage renders KanbanBoard
- The full data flow from TasksPage → KanbanBoard → KanbanCard → ContextInjectionModal
- Context injection callbacks properly integrate with TasksPage's error/success handling
- The `onSuccess` and `onError` callbacks passed from TasksPage work correctly

## Technical Design

### Test File Location
```
packages/web-ui/src/components/tasks/__tests__/KanbanBoard-context-injection-taskspage.integration.test.tsx
```

### Test Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     Integration Test Layer                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                    Test Wrapper                          │   │
│  │  - Provides routing context (next/navigation mock)       │   │
│  │  - Sets up API client mocks                              │   │
│  │  - Simulates TasksPage environment                       │   │
│  └─────────────────────────────────────────────────────────┘   │
│                              │                                   │
│                              ▼                                   │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                    KanbanBoard                           │   │
│  │  - Receives callbacks from TasksPage                     │   │
│  │  - onCancel, onRetry, onError, onSuccess                 │   │
│  │  - actionLoading state                                   │   │
│  └─────────────────────────────────────────────────────────┘   │
│                              │                                   │
│                              ▼                                   │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                    KanbanCard                            │   │
│  │  - Renders context injection button                      │   │
│  │  - Manages contextModalOpen state                        │   │
│  │  - Handles contextLoading state                          │   │
│  └─────────────────────────────────────────────────────────┘   │
│                              │                                   │
│                              ▼                                   │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │              ContextInjectionModal                       │   │
│  │  - Form validation and submission                        │   │
│  │  - API integration                                       │   │
│  │  - Success/error callbacks                               │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Mock Strategy

```typescript
// 1. API Client Mocks
vi.mock('@/lib/api-client', () => ({
  apiClient: {
    getTaskStats: vi.fn(),
    listTasks: vi.fn(),
    injectContext: vi.fn(),
  },
}))

// 2. Next.js Navigation Mock
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    refresh: vi.fn(),
  }),
}))

// 3. Drag-and-drop Mock (to simplify tests)
vi.mock('../hooks/useKanbanDragDrop', () => ({
  useKanbanDragDrop: () => ({
    draggedTask: null,
    isUpdating: false,
    canUndo: false,
    handleDragStart: vi.fn(),
    handleDragOver: vi.fn(),
    handleDragEnd: vi.fn(),
    undoLastOperation: vi.fn(),
  }),
}))
```

### Test Categories

#### 1. Context Injection Button Visibility in TasksPage Context
```typescript
describe('Context Injection in TasksPage Context', () => {
  describe('Button Visibility', () => {
    it('shows context injection button for in-progress tasks in kanban view')
    it('shows context injection button for pending tasks in kanban view')
    it('shows context injection button for planning tasks in kanban view')
    it('shows context injection button for waiting-approval tasks')
    it('shows context injection button for paused tasks')
    it('hides context injection button for completed tasks')
    it('hides context injection button for failed tasks')
    it('hides context injection button for cancelled tasks')
  })
})
```

#### 2. Modal Integration Flow
```typescript
describe('Modal Integration', () => {
  it('opens context injection modal when button clicked')
  it('closes modal on cancel button click')
  it('closes modal on backdrop click')
  it('closes modal on successful submission')
  it('keeps modal open on submission error')
  it('prevents navigation when modal button clicked')
})
```

#### 3. Context Submission Flow
```typescript
describe('Context Submission', () => {
  it('submits context with required fields')
  it('submits context with optional source field')
  it('submits context with different priority levels')
  it('shows loading state during submission')
  it('displays error message on submission failure')
  it('resets form after successful submission')
})
```

#### 4. UI State Updates
```typescript
describe('UI State Updates', () => {
  it('shows loading spinner on context button during submission')
  it('disables submit button when context is empty')
  it('enables submit button when context has value')
  it('updates character count as user types')
  it('shows error styling when exceeding character limit')
})
```

#### 5. TasksPage Callbacks Integration
```typescript
describe('TasksPage Callbacks', () => {
  it('calls onSuccess callback after successful context injection')
  it('calls onError callback on context injection failure')
  it('integrates with TasksPage error notification display')
  it('integrates with TasksPage success notification display')
})
```

### Test Data Structure

```typescript
// Standard mock tasks for consistent testing
const mockTasks = {
  inProgress: {
    id: 'task-in-progress-001',
    description: 'In progress task for testing',
    status: 'in-progress',
    workflow: 'feature',
    // ... other fields
  },
  pending: {
    id: 'task-pending-001',
    description: 'Pending task for testing',
    status: 'pending',
    workflow: 'bugfix',
    // ... other fields
  },
  completed: {
    id: 'task-completed-001',
    description: 'Completed task for testing',
    status: 'completed',
    workflow: 'feature',
    // ... other fields
  },
  // ... other statuses
}

// Standard mock response
const mockContextResponse = {
  ok: true,
  taskId: 'task-in-progress-001',
  contextInjected: true,
  timestamp: new Date(),
}
```

### Interaction Patterns

```typescript
// Standard pattern for testing context injection flow
async function testContextInjectionFlow(taskDescription: string, contextText: string) {
  const user = userEvent.setup()

  // 1. Wait for task to appear
  await waitFor(() => {
    expect(screen.getByText(taskDescription)).toBeInTheDocument()
  })

  // 2. Hover to reveal button
  const taskCard = screen.getByText(taskDescription).closest('.group')!
  fireEvent.mouseEnter(taskCard)

  // 3. Click context injection button
  const contextButton = screen.getByTitle('Inject context')
  await user.click(contextButton)

  // 4. Verify modal opened
  expect(screen.getByRole('heading', { name: 'Inject Context' })).toBeInTheDocument()

  // 5. Fill and submit form
  const modal = screen.getByRole('dialog')
  const textarea = within(modal).getByLabelText(/context/i)
  await user.type(textarea, contextText)

  const submitButton = within(modal).getByRole('button', { name: /inject context/i })
  await user.click(submitButton)

  return { modal, textarea, submitButton }
}
```

## Decision

### Approach: Create New Integration Test File

Create a dedicated integration test file that:
1. Tests the full flow from KanbanBoard rendering to context injection completion
2. Uses the same mock patterns established in existing tests
3. Focuses on integration points rather than duplicating unit test coverage
4. Verifies the callback chain from ContextInjectionModal → KanbanCard → KanbanBoard

### File Structure
```
__tests__/
├── KanbanCard-context-injection.test.tsx     # Existing - KanbanBoard isolation
├── TaskCard.context-injection.test.tsx       # Existing - TaskCard isolation
├── ContextInjectionModal.test.tsx            # Existing - Modal isolation
└── KanbanBoard-context-injection-taskspage.integration.test.tsx  # NEW
```

### Key Design Decisions

1. **Don't test TasksPage directly** - Instead, test KanbanBoard with the same props that TasksPage passes to it. This avoids the complexity of mocking Next.js 'use client' components.

2. **Use the established mock patterns** - Leverage the same API client mocks and data structures from existing tests for consistency.

3. **Focus on integration gaps** - Don't duplicate unit test coverage. Focus on:
   - Props passing from parent to child
   - Callback chain execution
   - State synchronization across components

4. **Keep tests maintainable** - Use helper functions and shared mock data to reduce duplication.

## Consequences

### Positive
- Comprehensive integration test coverage for context injection feature
- Tests verify the feature works in the TasksPage context (kanban view)
- Consistent with existing test patterns in the codebase
- Clear separation between unit and integration tests

### Negative
- Some test scenarios may overlap with existing unit tests
- Integration tests are inherently more fragile than unit tests

### Risks
- Mock setup complexity could lead to false positives
- Changes to component interfaces will require test updates

## Implementation Notes for Next Stage

1. Create the new test file following the structure above
2. Fix any failing tests in existing `KanbanCard-context-injection.test.tsx` (current issues with API mock calls)
3. Ensure all tests pass before marking complete
4. Run `npm run build` to verify no TypeScript errors
