# ADR 0011: KanbanCard Context Injection Button

## Status
Proposed

## Date
2026-03-16

## Context

Following ADR-0010 (Context Injection API Endpoint), we need to add a user interface element to allow users to inject context into running tasks directly from the Kanban board. This feature enables real-time guidance and supplementary information injection during task execution.

### Requirements (from acceptance criteria)

1. Context injection button visible on task cards
2. Clicking opens ContextInjectionModal
3. Button shows loading state during submission
4. Modal submits via API client and closes on success

## Decision

### Component Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│ KanbanBoard.tsx                                                     │
│  └── KanbanColumn                                                   │
│       └── KanbanCard                                                │
│            ├── [existing content]                                   │
│            └── Action Buttons                                       │
│                 ├── Cancel Button (existing)                        │
│                 ├── Retry Button (existing)                         │
│                 └── ContextInjectionButton ← NEW (internal to card) │
│                                                                     │
├─────────────────────────────────────────────────────────────────────┤
│ ContextInjectionModal.tsx ← NEW (separate file)                     │
│  ├── Modal backdrop & dialog                                        │
│  ├── Context textarea input                                         │
│  ├── Priority selector (optional)                                   │
│  ├── Source identifier (auto: 'web-ui')                             │
│  ├── Loading state management                                       │
│  └── Error handling & display                                       │
├─────────────────────────────────────────────────────────────────────┤
│ api-client.ts                                                       │
│  └── injectContext(taskId, request) ← NEW METHOD                    │
└─────────────────────────────────────────────────────────────────────┘
```

### Design Decisions

#### 1. Button Placement Strategy

**Decision**: Add the context injection button inline with existing action buttons (cancel, retry) in the KanbanCard footer.

**Rationale**:
- Consistent with existing button patterns
- Only visible on hover (like existing action buttons)
- Maintains compact card design
- Natural location for task actions

**Visibility Rules**:
- Button visible when task is in "actionable" status: `in-progress`, `planning`, `pending`, `queued`, `waiting-approval`, `paused`
- Hidden for terminal states: `completed`, `failed`, `cancelled`

#### 2. Modal Pattern

**Decision**: Create a standalone `ContextInjectionModal` component following the `CreateTaskDialog` pattern.

**Pattern Elements** (from `CreateTaskDialog.tsx`):
- Fixed positioning with backdrop
- Form-based submission
- Loading state with Spinner
- Error display in styled alert box
- Close on backdrop click
- Keyboard accessibility (Escape to close)

**Props Interface**:
```typescript
interface ContextInjectionModalProps {
  isOpen: boolean;
  taskId: string;
  taskDescription: string;  // For display context
  onClose: () => void;
  onSuccess?: () => void;   // Optional callback after successful injection
}
```

#### 3. API Client Extension

**Decision**: Add `injectContext` method to `ApexApiClient` class.

```typescript
// In api-client.ts
import type { InjectContextRequest, InjectContextResponse } from '@apexcli/core';

async injectContext(
  taskId: string,
  request: InjectContextRequest
): Promise<InjectContextResponse> {
  const response = await this.fetch(`/tasks/${taskId}/context`, {
    method: 'POST',
    body: JSON.stringify(request),
  });
  return response.json();
}
```

**Request/Response Types** (from `@apexcli/core`):
```typescript
interface InjectContextRequest {
  context: string;           // Required: The context string
  source?: string;           // Optional: defaults to 'web-ui'
  priority?: 'low' | 'normal' | 'high';  // Optional: defaults to 'normal'
}

interface InjectContextResponse {
  ok: true;
  taskId: string;
  contextInjected: boolean;
  timestamp: Date;
}
```

#### 4. State Management

**Decision**: Use local component state (useState) for modal visibility and submission state.

**State Flow**:
```
User clicks button → setState(isOpen: true) → Modal renders
↓
User fills form → Local form state
↓
User submits → setState(isLoading: true) → API call
↓
Success → onSuccess callback → setState(isOpen: false)
  OR
Error → setState(error: message) → Display error
```

#### 5. Icon Selection

**Decision**: Use `MessageSquarePlus` from lucide-react for the context injection button.

**Alternatives Considered**:
- `Syringe` - Too medical/injection connotation
- `Plus` - Too generic, conflicts with existing usage
- `FileInput` - File-specific
- `MessageSquarePlus` ✓ - Represents adding context/message to task

#### 6. Loading State Handling

**Decision**: Dual loading state - button shows spinner while modal displays full loading overlay.

**Button Loading**:
- Replace icon with `Spinner` component
- Disable button interaction
- Uses same pattern as cancel/retry buttons

**Modal Loading**:
- Form inputs disabled
- Submit button shows `Spinner` + "Injecting..."
- Cancel button disabled

### File Changes Required

#### New Files

| File | Purpose |
|------|---------|
| `packages/web-ui/src/components/tasks/ContextInjectionModal.tsx` | Modal dialog component |
| `packages/web-ui/src/components/tasks/__tests__/ContextInjectionModal.test.tsx` | Unit tests |
| `packages/web-ui/src/components/tasks/__tests__/KanbanCard-context-injection.test.tsx` | Integration tests |

#### Modified Files

| File | Changes |
|------|---------|
| `packages/web-ui/src/components/tasks/KanbanBoard.tsx` | Add button to KanbanCard, import modal, state management |
| `packages/web-ui/src/lib/api-client.ts` | Add `injectContext` method |

### Component Interfaces

#### KanbanCard Props Extension

No change needed - button state managed internally. Modal state lifted to KanbanCard component.

```typescript
// Inside KanbanCard function component
const [contextModalOpen, setContextModalOpen] = useState(false);
const [contextLoading, setContextLoading] = useState(false);
```

#### ContextInjectionModal Implementation

```typescript
'use client'

import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { apiClient } from '@/lib/api-client';
import { X, MessageSquarePlus } from 'lucide-react';

interface ContextInjectionModalProps {
  isOpen: boolean;
  taskId: string;
  taskDescription: string;
  onClose: () => void;
  onSuccess?: () => void;
}

export function ContextInjectionModal({
  isOpen,
  taskId,
  taskDescription,
  onClose,
  onSuccess
}: ContextInjectionModalProps) {
  const [context, setContext] = useState('');
  const [priority, setPriority] = useState<'low' | 'normal' | 'high'>('normal');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!context.trim()) {
      setError('Context is required');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      await apiClient.injectContext(taskId, {
        context: context.trim(),
        source: 'web-ui',
        priority,
      });
      // Reset and close
      setContext('');
      setPriority('normal');
      onSuccess?.();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to inject context');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    // Modal JSX following CreateTaskDialog pattern
  );
}
```

### UX Flow

```
┌─────────────────────────────────────────────────────────────────┐
│ 1. User hovers over task card in Kanban board                   │
│    → Action buttons appear (including new context button)       │
├─────────────────────────────────────────────────────────────────┤
│ 2. User clicks context injection button (MessageSquarePlus)     │
│    → Modal opens with task info displayed                       │
├─────────────────────────────────────────────────────────────────┤
│ 3. User enters context text                                     │
│    → Optionally selects priority (low/normal/high)              │
├─────────────────────────────────────────────────────────────────┤
│ 4. User clicks "Inject Context" button                          │
│    → Loading state shown                                        │
│    → API call to POST /tasks/:id/context                        │
├─────────────────────────────────────────────────────────────────┤
│ 5a. Success                                                     │
│    → Modal closes                                               │
│    → Optional: Toast notification (if implemented)              │
├─────────────────────────────────────────────────────────────────┤
│ 5b. Error                                                       │
│    → Error message displayed in modal                           │
│    → User can fix and retry                                     │
└─────────────────────────────────────────────────────────────────┘
```

### Error Handling

| Error Scenario | Handling |
|----------------|----------|
| Network failure | Display "Failed to inject context" message |
| 404 Task not found | Display "Task not found" (unlikely in UI) |
| 400 Empty context | Validation prevents submission |
| 400 Context too long | Display "Context exceeds maximum length" |
| 500 Server error | Display "Server error, please try again" |

### Accessibility Requirements

- Button has `aria-label="Inject context"`
- Modal has `role="dialog"` and `aria-modal="true"`
- Focus trapped within modal when open
- Escape key closes modal
- Form labels properly associated with inputs
- Loading states announced to screen readers

## Consequences

### Positive

- Users can inject context without leaving the Kanban view
- Consistent with existing UI patterns (CreateTaskDialog)
- Minimal changes to existing components
- Clear separation of concerns (button in card, modal separate)
- Reuses existing types from `@apexcli/core`

### Negative

- Adds complexity to KanbanCard component (state management)
- Modal is task-specific, not reusable for other injection targets
- No visual feedback after successful injection (could add toast later)

### Risks

- Large context text could cause layout issues (mitigated by max-height on textarea)
- Rapid clicking could cause multiple submissions (mitigated by loading state)

## Testing Strategy

### Unit Tests

1. `ContextInjectionModal.test.tsx`
   - Renders when isOpen is true
   - Doesn't render when isOpen is false
   - Displays task description
   - Validates empty context
   - Calls API on submit
   - Shows loading state during submission
   - Displays error messages
   - Closes on success
   - Calls onSuccess callback
   - Closes on backdrop click
   - Priority selection works

2. `KanbanCard-context-injection.test.tsx`
   - Button renders for active tasks
   - Button hidden for terminal states
   - Button click opens modal
   - Loading state displays correctly

### Integration Tests

1. `KanbanBoard-context-injection.test.tsx`
   - Full flow: hover → click → fill form → submit → modal closes
   - Error handling flow
   - Multiple cards can open their own modals

## Implementation Order

1. **API Client** - Add `injectContext` method (low risk, isolated change)
2. **Modal Component** - Create `ContextInjectionModal` (new file, no regression risk)
3. **Modal Tests** - Write unit tests for modal
4. **KanbanCard Integration** - Add button and state management
5. **Integration Tests** - End-to-end testing
6. **Build & Test Verification** - Run `npm run build` and `npm run test`

## Related

- ADR 0010: Context Injection API Endpoint
- `packages/web-ui/src/components/tasks/CreateTaskDialog.tsx` (pattern reference)
- `packages/web-ui/src/lib/api-client.ts` (API client)
- `packages/web-ui/src/types/context-injection.ts` (type definitions)
