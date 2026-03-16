# ADR 0023: Context Injection Modal Component

## Status
Proposed

## Date
2026-03-16

## Context

The APEX Visual Kanban board needs a `ContextInjectionModal` component to allow users to inject additional context into running tasks. This component complements the existing `/tasks/:id/context` API endpoint (ADR-0010) by providing a user-friendly interface for context injection.

### Requirements from Acceptance Criteria
1. Modal component follows CreateTaskDialog pattern
2. Has text input/textarea for context entry
3. Submit button for injection
4. Cancel button to dismiss
5. Loading state during submission
6. Error display for failures

## Decision

### Component Architecture

**File Location**: `packages/web-ui/src/components/tasks/ContextInjectionModal.tsx`

The component will follow the established `CreateTaskDialog` pattern:

```typescript
interface ContextInjectionModalProps {
  isOpen: boolean
  taskId: string
  onClose: () => void
  onInjected?: (response: InjectContextResponse) => void
}
```

### Component Structure

```
ContextInjectionModal
├── Backdrop (overlay with click-to-close)
├── Dialog Container
│   ├── Header
│   │   ├── Icon (MessageSquarePlus from lucide-react)
│   │   ├── Title ("Inject Context")
│   │   └── Close Button (X icon)
│   ├── Form
│   │   ├── Context Textarea (required, autofocus)
│   │   ├── Source Input (optional)
│   │   ├── Priority Selector (optional, default: normal)
│   │   ├── Error Display (conditional)
│   │   └── Actions Bar
│   │       ├── Cancel Button
│   │       └── Submit Button (with loading state)
```

### State Management

```typescript
// Internal state
const [context, setContext] = useState('')
const [source, setSource] = useState('')
const [priority, setPriority] = useState<'low' | 'normal' | 'high'>('normal')
const [loading, setLoading] = useState(false)
const [error, setError] = useState<string | null>(null)
```

### API Integration

Add new method to `ApexApiClient`:

```typescript
async injectContext(
  taskId: string,
  request: InjectContextRequest
): Promise<InjectContextResponse> {
  const response = await this.fetch(`/tasks/${taskId}/context`, {
    method: 'POST',
    body: JSON.stringify(request),
  })
  return response.json()
}
```

### UI/UX Patterns

1. **Modal Pattern**: Same as `CreateTaskDialog`
   - Fixed overlay with backdrop blur
   - Centered dialog with max-width
   - Click-outside-to-close behavior
   - ESC key support (future enhancement)

2. **Form Validation**:
   - Context is required (trim whitespace)
   - Real-time validation state
   - Submit button disabled when empty or loading

3. **Loading State**:
   - Use `Spinner` component with "Injecting..." text
   - Disable all inputs during submission
   - Disable cancel/close during submission

4. **Error Handling**:
   - Display error messages in red banner
   - Clear error on new input
   - Preserve form state on error (allow retry)

5. **Success Flow**:
   - Call `onInjected` callback with response
   - Reset form state
   - Close modal

### Styling

Follow existing design tokens:
- `bg-background-secondary` for dialog
- `border-border` for borders
- `bg-apex-500/10` for accent backgrounds
- `text-apex-500` for accent text
- `text-foreground-secondary` for secondary text
- `bg-red-500/10` for error backgrounds

### Priority Options

```typescript
const PRIORITY_OPTIONS = [
  { value: 'low', label: 'Low', description: 'Background context' },
  { value: 'normal', label: 'Normal', description: 'Standard priority (default)' },
  { value: 'high', label: 'High', description: 'Important context' },
]
```

## Implementation Plan

### Files to Create/Modify

1. **Create**: `packages/web-ui/src/components/tasks/ContextInjectionModal.tsx`
   - Main modal component
   - Props interface
   - Form handling logic
   - Loading/error states

2. **Modify**: `packages/web-ui/src/lib/api-client.ts`
   - Add `injectContext` method to `ApexApiClient`

3. **Create**: `packages/web-ui/src/components/tasks/__tests__/ContextInjectionModal.test.tsx`
   - Unit tests for component rendering
   - Form validation tests
   - Loading state tests
   - Error handling tests
   - Callback invocation tests

### Dependencies

- Existing UI components: `Button`, `Spinner`
- Icons: `X`, `MessageSquarePlus`, `Send` from `lucide-react`
- API client: `apiClient` from `@/lib/api-client`
- Types: `InjectContextRequest`, `InjectContextResponse` from `@apexcli/core`

### Component Interface

```typescript
'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Spinner } from '@/components/ui/Spinner'
import { apiClient } from '@/lib/api-client'
import { X, MessageSquarePlus, Send } from 'lucide-react'
import type { InjectContextResponse } from '@apexcli/core'

interface ContextInjectionModalProps {
  /** Whether the modal is visible */
  isOpen: boolean
  /** The task ID to inject context into */
  taskId: string
  /** Callback when modal is closed */
  onClose: () => void
  /** Callback when context is successfully injected */
  onInjected?: (response: InjectContextResponse) => void
}

export function ContextInjectionModal({
  isOpen,
  taskId,
  onClose,
  onInjected,
}: ContextInjectionModalProps) {
  // Implementation follows CreateTaskDialog pattern
}
```

## Test Strategy

### Unit Tests

1. **Rendering**
   - Should not render when `isOpen` is false
   - Should render modal when `isOpen` is true
   - Should display task ID in context

2. **Form Behavior**
   - Should disable submit when context is empty
   - Should enable submit when context has value
   - Should show loading state during submission

3. **Validation**
   - Should show error for empty submission attempt
   - Should trim whitespace from context

4. **Callbacks**
   - Should call `onClose` when cancel clicked
   - Should call `onClose` when backdrop clicked
   - Should call `onInjected` on successful submission
   - Should call `onClose` after successful submission

5. **Error Handling**
   - Should display API error messages
   - Should preserve form state on error
   - Should clear error on new input

### Integration Tests

- Test with mocked API client
- Verify WebSocket event is received after injection

## Consequences

### Positive
- Consistent UX with existing dialogs (CreateTaskDialog)
- Reuses existing UI components and patterns
- Simple, focused interface for single task
- Supports all context injection options (source, priority)

### Negative
- No multi-task batch injection (single task only)
- No context preview/formatting
- No recent context history

### Future Enhancements
- ESC key to close
- Context templates/presets
- Character count display
- Markdown preview
- Recent injections history

## Related

- ADR-0010: Context Injection API Endpoint
- `CreateTaskDialog` component (pattern reference)
- `/tasks/:id/context` API endpoint
