# AgentConfigEditor - Technical Architecture Design

## Overview

The `AgentConfigEditor` is a full-featured editor component that combines the `AgentForm` and `AgentPreview` components in a responsive split-pane layout. It provides a complete editing experience for creating new agents and editing existing ones, with real-time preview, save/cancel actions, and success/error feedback.

## Architecture Decision Record (ADR)

### ADR-001: Component Composition Pattern

**Decision**: Use a composition pattern with a main orchestrator component (`AgentConfigEditor`) that coordinates existing components (`AgentForm`, `AgentPreview`) rather than creating a monolithic component.

**Rationale**:
- Follows the Single Responsibility Principle
- Reuses existing, tested components
- Enables easier testing of individual parts
- Maintains consistency with existing codebase patterns (e.g., `WorkflowEditor`)

### ADR-002: Layout Approach - Responsive Side-by-Side with Mobile Tabs

**Decision**: Implement a responsive layout that shows:
- **Desktop (lg+)**: Side-by-side split-pane layout with form on left, preview on right
- **Mobile/Tablet (<lg)**: Tab-based layout allowing toggle between form and preview

**Rationale**:
- Side-by-side provides immediate visual feedback during editing
- Tab layout on mobile preserves usability on smaller screens
- Follows patterns established in `WorkflowEditor` and `TaskDetailPage`
- No need for third-party resizable panel library (keeps bundle size small)

### ADR-003: State Management

**Decision**: Use local component state with lifted state pattern, leveraging the existing form state from `AgentForm` via controlled form data prop.

**Rationale**:
- Component is self-contained (no global state needed)
- Form validation already handled by `AgentForm` and Zod schema
- Parent page controls data fetching and API calls
- Follows patterns used in `CreateTaskDialog`

## Component Structure

```
packages/web-ui/src/
├── components/
│   └── agent-editor/
│       ├── AgentConfigEditor.tsx          # Main orchestrator component (NEW)
│       ├── AgentConfigEditorLayout.tsx    # Layout wrapper with responsive behavior (NEW)
│       ├── AgentConfigEditorHeader.tsx    # Header with title and actions (NEW)
│       ├── AgentForm.tsx                  # Existing - moved here for colocation
│       ├── AgentPreview.tsx               # Existing
│       ├── AgentPreviewHeader.tsx         # Existing
│       ├── AgentPreviewContent.tsx        # Existing
│       ├── hooks/
│       │   ├── useAgentMarkdown.ts        # Existing
│       │   └── useAgentEditor.ts          # NEW - encapsulates editor state logic
│       ├── utils/
│       │   └── agent-serializer.ts        # Existing
│       ├── types.ts                       # Existing - extend with new types
│       └── index.ts                       # Re-export all public components
├── app/
│   └── agents/
│       ├── page.tsx                       # Existing - agents list (add edit links)
│       ├── new/
│       │   └── page.tsx                   # NEW - Create new agent page
│       └── [name]/
│           └── edit/
│               └── page.tsx               # NEW - Edit existing agent page
```

## Type Definitions

```typescript
// types.ts additions

/**
 * Editor mode - determines behavior and API calls
 */
export type AgentEditorMode = 'create' | 'edit'

/**
 * Props for AgentConfigEditor component
 */
export interface AgentConfigEditorProps {
  /** Mode: create new or edit existing agent */
  mode: AgentEditorMode
  /** Agent name when editing (required for edit mode) */
  agentName?: string
  /** Initial form data (optional, will fetch if not provided in edit mode) */
  initialData?: AgentFormData
  /** Callback on successful save */
  onSaveSuccess?: (agent: AgentFormData) => void
  /** Callback on cancel */
  onCancel?: () => void
  /** Optional class name */
  className?: string
}

/**
 * State for the agent editor
 */
export interface AgentEditorState {
  /** Current form data */
  formData: AgentFormData
  /** Whether form data is valid */
  isValid: boolean
  /** Whether form has been modified */
  isDirty: boolean
  /** Current active tab (mobile) */
  activeTab: 'form' | 'preview'
  /** Loading state */
  isLoading: boolean
  /** Submitting state */
  isSubmitting: boolean
  /** Error message if any */
  error: string | null
  /** Success message if any */
  successMessage: string | null
}

/**
 * Actions for the agent editor
 */
export interface AgentEditorActions {
  /** Update form data */
  updateFormData: (data: Partial<AgentFormData>) => void
  /** Set active tab */
  setActiveTab: (tab: 'form' | 'preview') => void
  /** Save agent */
  save: () => Promise<void>
  /** Cancel editing */
  cancel: () => void
  /** Clear error */
  clearError: () => void
}
```

## useAgentEditor Hook

A custom hook to encapsulate all editor state management logic:

```typescript
// hooks/useAgentEditor.ts

export interface UseAgentEditorOptions {
  mode: AgentEditorMode
  agentName?: string
  initialData?: AgentFormData
  onSaveSuccess?: (agent: AgentFormData) => void
  onCancel?: () => void
}

export interface UseAgentEditorResult {
  state: AgentEditorState
  actions: AgentEditorActions
}

export function useAgentEditor(options: UseAgentEditorOptions): UseAgentEditorResult {
  // Manages:
  // - Form data state
  // - Validation state (using validateAgentForm from schema)
  // - Dirty tracking
  // - Loading/submitting states
  // - Error/success messages
  // - API calls (createAgent, updateAgent)
  // - Navigation after save/cancel
}
```

## API Integration

### New API Methods (to be added to api-client.ts)

```typescript
/**
 * Create a new agent
 */
async createAgent(agent: AgentFormData): Promise<{ ok: boolean; agent: AgentDefinition }> {
  const response = await this.fetch('/agents', {
    method: 'POST',
    body: JSON.stringify(agent),
  })
  return response.json()
}

/**
 * Update an existing agent
 */
async updateAgent(name: string, agent: Partial<AgentFormData>): Promise<{ ok: boolean; agent: AgentDefinition }> {
  const response = await this.fetch(`/agents/${name}`, {
    method: 'PUT',
    body: JSON.stringify(agent),
  })
  return response.json()
}
```

## Component Behavior

### Create Mode Flow
1. User navigates to `/agents/new`
2. `AgentConfigEditor` renders with empty form
3. User fills in form fields
4. Preview updates in real-time
5. User clicks "Create Agent"
6. API call to create agent
7. On success: Show toast, redirect to agents list
8. On error: Show error message inline

### Edit Mode Flow
1. User navigates to `/agents/[name]/edit`
2. Page fetches agent data
3. `AgentConfigEditor` renders with populated form
4. User modifies fields
5. Preview updates in real-time
6. User clicks "Save Changes"
7. API call to update agent
8. On success: Show toast, redirect to agents list
9. On error: Show error message inline

### Cancel Flow
1. If form is dirty, show confirmation dialog
2. If confirmed or not dirty, redirect to agents list

## Layout Structure

### Desktop Layout (lg+)
```
┌────────────────────────────────────────────────────────────────┐
│ Header: [Agent Title] [Save] [Cancel]                          │
├─────────────────────────────┬──────────────────────────────────┤
│                             │                                  │
│     AgentForm               │      AgentPreview                │
│     (60% width)             │      (40% width)                 │
│                             │                                  │
│     - Name                  │      [agent-name.md]             │
│     - Description           │      ---                         │
│     - System Prompt         │      name: agent-name            │
│     - Model                 │      description: ...            │
│     - Tools                 │      model: sonnet               │
│     - Skills                │      tools: [...]                │
│                             │      ---                         │
│                             │      <prompt content>            │
│                             │                                  │
└─────────────────────────────┴──────────────────────────────────┘
```

### Mobile Layout (<lg)
```
┌────────────────────────────────────────┐
│ Header: [Title]        [Save] [Cancel] │
├────────────────────────────────────────┤
│ [Form Tab] [Preview Tab]               │
├────────────────────────────────────────┤
│                                        │
│   <Active Tab Content>                 │
│                                        │
│                                        │
│                                        │
└────────────────────────────────────────┘
```

## Feedback Mechanisms

### Success Feedback
- Green checkmark icon with message
- Auto-dismiss after 3 seconds
- Message: "Agent created successfully!" or "Agent updated successfully!"

### Error Feedback
- Red error banner with message
- Dismiss button
- Persists until dismissed or retry

### Loading States
- Save button shows spinner when submitting
- Form fields disabled during submission
- Loading skeleton when fetching agent data in edit mode

## Testing Strategy

### Unit Tests
- `AgentConfigEditor.test.tsx` - Component rendering, state management
- `useAgentEditor.test.tsx` - Hook behavior, state transitions

### Integration Tests
- `AgentConfigEditor.integration.test.tsx` - Full flow with mocked API
- Form validation integration
- Save/cancel navigation

### Edge Cases
- Network errors during save
- Invalid agent name in edit mode (404)
- Unsaved changes confirmation
- Very long agent names/descriptions

## Implementation Order

1. **Phase 1**: Types and hook
   - Add new types to `types.ts`
   - Implement `useAgentEditor` hook
   - Add API methods to `api-client.ts`

2. **Phase 2**: Core components
   - `AgentConfigEditorHeader.tsx`
   - `AgentConfigEditorLayout.tsx`
   - `AgentConfigEditor.tsx`

3. **Phase 3**: Page integration
   - `/agents/new/page.tsx`
   - `/agents/[name]/edit/page.tsx`
   - Update `/agents/page.tsx` with edit links

4. **Phase 4**: Polish
   - Unsaved changes confirmation
   - Loading skeletons
   - Success/error toasts
   - Keyboard shortcuts (Ctrl+S to save)

## Dependencies

### Existing (no new packages needed)
- `@/components/forms/AgentForm`
- `@/components/agent-editor/AgentPreview`
- `@/components/ui/Button`
- `@/components/ui/Card`
- `@/components/ui/Spinner`
- `@/lib/api-client`
- `@/lib/schemas/agent-schema`
- `lucide-react` icons
- `next/navigation` for routing

## Accessibility

- Proper heading hierarchy (h1 for title)
- Form labels associated with inputs (handled by AgentForm)
- Focus management on error
- Keyboard navigation between tabs
- Screen reader announcements for success/error states
- Escape key to cancel (with confirmation if dirty)
