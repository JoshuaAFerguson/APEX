# ADR-0028: SaveTemplateModal Component Architecture

## Status
Proposed

## Context

APEX needs a **SaveTemplateModal** component that allows users to save existing tasks as reusable templates. This enables users to:
1. Create templates from successful task configurations
2. Standardize common task patterns across their projects
3. Share task configurations within their team

### Requirements
- Modal can be triggered from task detail page via "Save as Template" button
- Modal can be triggered from CreateTaskDialog (save current task config as template)
- Collects required template data: name, description, category, tags
- Pre-populates template fields from existing task context
- Follows existing modal patterns (backdrop blur, z-50 positioning)
- Accessible with proper ARIA attributes and form labels
- Calls `apiClient.createTemplate()` to persist template

### Existing Infrastructure
- **API Endpoint**: `/templates` with POST support exists (packages/api/src/index.ts)
- **Type Definitions**: `CreateTemplateRequest`, `TaskTemplate`, `TemplateCategory` types exist (packages/web-ui/src/types/task-template.ts)
- **API Client**: `apiClient.createTemplate()` method exists (packages/web-ui/src/lib/api-client.ts)
- **Modal Patterns**: `CreateTaskDialog`, `QuickActionVariableModal` serve as reference implementations
- **Form Components**: `FormField`, `Input`, `Textarea`, `Button`, `Checkbox`, `Label` available

## Decision

### 1. Component Architecture

```
packages/web-ui/src/
├── components/
│   └── templates/
│       ├── SaveTemplateModal.tsx        # NEW: Main modal component
│       ├── TemplateFormFields.tsx       # NEW: Reusable form fields (optional extraction)
│       └── __tests__/
│           └── SaveTemplateModal.test.tsx  # NEW: Component tests
├── hooks/
│   └── useSaveTemplateForm.ts           # NEW: Form state management hook
│   └── __tests__/
│       └── useSaveTemplateForm.test.ts  # NEW: Hook tests
└── types/
    └── task-template.ts                 # EXISTS: Add SaveTemplateModalProps interface
```

### 2. Interface Definitions

```typescript
// packages/web-ui/src/types/task-template.ts (additions)

/**
 * Props for SaveTemplateModal component
 */
export interface SaveTemplateModalProps {
  /** Whether the modal is open */
  isOpen: boolean

  /** Callback when modal is closed */
  onClose: () => void

  /** Callback when template is saved successfully */
  onSaved: (template: TaskTemplate) => void

  /** Callback when save fails */
  onError?: (error: Error) => void

  /** Initial values to pre-populate the form */
  initialValues?: SaveTemplateInitialValues
}

/**
 * Initial values for pre-populating the save template form
 * Typically derived from an existing task's data
 */
export interface SaveTemplateInitialValues {
  /** Pre-filled description template (from task.description) */
  descriptionTemplate?: string

  /** Pre-filled acceptance criteria template (from task.acceptanceCriteria) */
  acceptanceCriteriaTemplate?: string

  /** Pre-selected workflow (from task.workflow) */
  workflow?: string

  /** Pre-selected autonomy level (from task.autonomy) */
  autonomy?: AutonomyLevel

  /** Pre-selected priority (from task.priority) */
  priority?: TaskPriority

  /** Pre-selected effort (from task.effort) */
  effort?: TaskEffort

  /** Suggested category based on workflow */
  category?: TemplateCategory
}
```

### 3. useSaveTemplateForm Hook

```typescript
// packages/web-ui/src/hooks/useSaveTemplateForm.ts

interface UseSaveTemplateFormOptions {
  initialValues?: SaveTemplateInitialValues
  onSuccess?: (template: TaskTemplate) => void
  onError?: (error: Error) => void
}

interface UseSaveTemplateFormReturn {
  /** Form field values */
  values: Partial<CreateTemplateRequest>

  /** Field validation errors */
  errors: Record<string, string>

  /** Set a single field value */
  setField: <K extends keyof CreateTemplateRequest>(field: K, value: CreateTemplateRequest[K]) => void

  /** Whether form is valid for submission */
  isValid: boolean

  /** Whether form is currently submitting */
  isSubmitting: boolean

  /** Submit error message */
  submitError: string | null

  /** Handle form submission */
  submit: () => Promise<void>

  /** Reset form to initial state */
  reset: () => void

  /** Add a tag to the tags array */
  addTag: (tag: string) => void

  /** Remove a tag from the tags array */
  removeTag: (tag: string) => void
}

export function useSaveTemplateForm(options?: UseSaveTemplateFormOptions): UseSaveTemplateFormReturn
```

**Features**:
- Manages all form state with validation
- Pre-populates from `initialValues`
- Validates required fields (name, description, category, workflow, autonomy, descriptionTemplate)
- Handles tags as array with add/remove helpers
- Tracks submission state and errors
- Calls `apiClient.createTemplate()` on submit

### 4. SaveTemplateModal Component

```typescript
// packages/web-ui/src/components/templates/SaveTemplateModal.tsx

export function SaveTemplateModal({
  isOpen,
  onClose,
  onSaved,
  onError,
  initialValues,
}: SaveTemplateModalProps): React.ReactElement | null
```

**UI Structure**:
```
┌─────────────────────────────────────────────────────────────────┐
│ [Icon] Save as Template                                     [X] │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Template Name *                                                │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ My Feature Template                                      │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  Description *                                                  │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ Template for creating feature tasks...                   │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  Category *                       Workflow *                    │
│  ┌─────────────────┐              ┌─────────────────┐          │
│  │ Feature      ▼ │              │ feature       ▼ │          │
│  └─────────────────┘              └─────────────────┘          │
│                                                                 │
│  Autonomy Level *                                               │
│  ○ Review All  ○ Review Before Commit  ○ Full Autonomy         │
│                                                                 │
│  Tags                                                           │
│  ┌─────────────────┐  [react] [frontend] [component]           │
│  │ Add tag...     │                                            │
│  └─────────────────┘                                           │
│                                                                 │
│  ☐ Mark as Quick Action (show in dashboard)                    │
│                                                                 │
│  ─────────────────────────────────────────────────────────     │
│  Advanced (collapsed)                                           │
│  ─────────────────────────────────────────────────────────     │
│                                                                 │
│  Description Template (pre-filled from task)                    │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ Create a new {{componentName}} component...              │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  Acceptance Criteria Template (optional)                        │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ - Component renders correctly                            │   │
│  │ - Props are properly typed                               │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│                           [Cancel]  [Save Template]             │
└─────────────────────────────────────────────────────────────────┘
```

**Styling Pattern** (following CreateTaskDialog):
```tsx
<div className="fixed inset-0 z-50 flex items-center justify-center">
  {/* Backdrop */}
  <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

  {/* Dialog */}
  <div className="relative bg-background-secondary border border-border rounded-lg shadow-xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
    {/* Header */}
    <div className="flex items-center justify-between p-4 border-b border-border">
      ...
    </div>

    {/* Form */}
    <form onSubmit={handleSubmit} className="p-4 space-y-4">
      ...
    </form>
  </div>
</div>
```

### 5. Integration Points

#### Task Detail Page Integration
```tsx
// packages/web-ui/src/app/tasks/[id]/page.tsx

import { SaveTemplateModal } from '@/components/templates/SaveTemplateModal'

function TaskDetailPage() {
  const [showSaveTemplate, setShowSaveTemplate] = useState(false)
  const task = useTask(taskId)

  return (
    <>
      {/* Header with Save as Template button */}
      <header>
        <Button onClick={() => setShowSaveTemplate(true)}>
          <Save className="w-4 h-4 mr-2" />
          Save as Template
        </Button>
      </header>

      {/* Modal */}
      <SaveTemplateModal
        isOpen={showSaveTemplate}
        onClose={() => setShowSaveTemplate(false)}
        onSaved={(template) => {
          toast.success(`Template "${template.name}" created`)
          setShowSaveTemplate(false)
        }}
        initialValues={{
          descriptionTemplate: task.description,
          acceptanceCriteriaTemplate: task.acceptanceCriteria,
          workflow: task.workflow,
          autonomy: task.autonomy,
          priority: task.priority,
          effort: task.effort,
          category: mapWorkflowToCategory(task.workflow),
        }}
      />
    </>
  )
}
```

#### CreateTaskDialog Integration
```tsx
// packages/web-ui/src/components/tasks/CreateTaskDialog.tsx

// Add "Save as Template" button in footer, before Create Task button
<Button
  type="button"
  variant="secondary"
  onClick={() => setShowSaveTemplate(true)}
  disabled={!description.trim() || loading}
>
  <BookmarkPlus className="w-4 h-4 mr-2" />
  Save as Template
</Button>
```

### 6. Workflow-to-Category Mapping

```typescript
// packages/web-ui/src/lib/template-utils.ts

export function mapWorkflowToCategory(workflow: string): TemplateCategory {
  const mapping: Record<string, TemplateCategory> = {
    'feature': 'feature',
    'bugfix': 'bugfix',
    'refactor': 'refactoring',
    'docs': 'documentation',
    'test': 'testing',
    'deploy': 'deployment',
    'maintenance': 'maintenance',
  }
  return mapping[workflow] || 'custom'
}
```

## Design Decisions

### D1: Modal vs Dialog Component Usage

**Decision**: Use custom modal pattern (like CreateTaskDialog) instead of Dialog composition pattern

**Rationale**:
- CreateTaskDialog uses direct fixed positioning which provides more control
- Consistent with existing task creation flow
- Easier to manage form state with conditional rendering
- QuickActionVariableModal uses Dialog but for simpler forms

### D2: Form State Management

**Decision**: Custom `useSaveTemplateForm` hook with internal state management

**Rationale**:
- Follows existing pattern from `useTemplateVariables` hook
- Provides reusability if template editing is added later
- Keeps component clean and testable
- No external form library dependency (consistent with codebase)

### D3: Tag Input Implementation

**Decision**: Simple input field + displayed tags with remove buttons

**Rationale**:
- Matches simplicity of existing form components
- No need for complex autocomplete initially
- Can enhance later with tag suggestions
- Consistent with the codebase style

### D4: Variable Detection

**Decision**: Do NOT automatically detect/extract variables from templates in initial implementation

**Rationale**:
- Reduces complexity for MVP
- Users can add variables manually if editing templates later
- `{{variableName}}` syntax is documented in existing templates
- Future enhancement: Add variable extraction preview

### D5: Pre-population Strategy

**Decision**: Accept `initialValues` prop to pre-fill form from task context

**Rationale**:
- Calling component has task context and can map appropriately
- Keeps SaveTemplateModal generic and reusable
- Category can be suggested from workflow mapping
- Allows flexibility in what gets pre-filled

## Implementation Plan

### Phase 1: Types & Hook (Low Risk)
1. Add `SaveTemplateModalProps` and `SaveTemplateInitialValues` to task-template.ts
2. Create `useSaveTemplateForm` hook with validation logic
3. Add hook tests

### Phase 2: Component Implementation (Medium Risk)
1. Create `SaveTemplateModal` component following CreateTaskDialog pattern
2. Implement all form fields with validation
3. Connect to `apiClient.createTemplate()`
4. Add component tests

### Phase 3: Integration (Low Risk)
1. Add "Save as Template" button to task detail page header
2. Add "Save as Template" button to CreateTaskDialog footer
3. Wire up initial values from task context
4. Add success toast/notification

### Phase 4: Polish (Low Risk)
1. Add collapsible "Advanced" section for templates
2. Add form field hints/descriptions
3. Ensure keyboard navigation works
4. Verify accessibility (ARIA, labels)

## File Changes Summary

| File | Change Type | Description |
|------|-------------|-------------|
| `packages/web-ui/src/types/task-template.ts` | MODIFY | Add SaveTemplateModalProps, SaveTemplateInitialValues interfaces |
| `packages/web-ui/src/hooks/useSaveTemplateForm.ts` | CREATE | Form state management hook |
| `packages/web-ui/src/hooks/__tests__/useSaveTemplateForm.test.ts` | CREATE | Hook tests |
| `packages/web-ui/src/components/templates/SaveTemplateModal.tsx` | CREATE | Main modal component |
| `packages/web-ui/src/components/templates/__tests__/SaveTemplateModal.test.tsx` | CREATE | Component tests |
| `packages/web-ui/src/lib/template-utils.ts` | CREATE | Utility functions (workflow-to-category mapping) |
| `packages/web-ui/src/app/tasks/[id]/page.tsx` | MODIFY | Add Save as Template button + modal |
| `packages/web-ui/src/components/tasks/CreateTaskDialog.tsx` | MODIFY | Add Save as Template button |

## Component Props API

### SaveTemplateModal

```typescript
interface SaveTemplateModalProps {
  isOpen: boolean                              // Required: controls visibility
  onClose: () => void                          // Required: close handler
  onSaved: (template: TaskTemplate) => void    // Required: success callback
  onError?: (error: Error) => void             // Optional: error callback
  initialValues?: SaveTemplateInitialValues    // Optional: pre-fill form
}
```

### SaveTemplateInitialValues

```typescript
interface SaveTemplateInitialValues {
  descriptionTemplate?: string       // Pre-fill from task.description
  acceptanceCriteriaTemplate?: string // Pre-fill from task.acceptanceCriteria
  workflow?: string                  // Pre-select workflow
  autonomy?: AutonomyLevel           // Pre-select autonomy level
  priority?: TaskPriority            // Pre-select priority
  effort?: TaskEffort                // Pre-select effort
  category?: TemplateCategory        // Suggested category
}
```

## Testing Strategy

### Unit Tests - Hook
```typescript
describe('useSaveTemplateForm', () => {
  it('initializes with default values')
  it('applies initial values when provided')
  it('validates required fields')
  it('adds and removes tags correctly')
  it('submits form and calls API')
  it('handles API errors')
  it('resets form to initial state')
})
```

### Unit Tests - Component
```typescript
describe('SaveTemplateModal', () => {
  it('renders when isOpen is true')
  it('does not render when isOpen is false')
  it('pre-fills form from initialValues')
  it('validates and shows errors on invalid submission')
  it('calls onSaved with template on successful submission')
  it('calls onError on API failure')
  it('disables form during submission')
  it('closes modal on backdrop click')
  it('closes modal on cancel button click')
  it('has proper accessibility attributes')
})
```

### Integration Tests
```typescript
describe('SaveTemplateModal Integration', () => {
  it('creates template from task detail page')
  it('creates template from CreateTaskDialog')
  it('template appears in quick actions if marked')
})
```

## Accessibility Requirements

1. **ARIA Labels**: Modal has `role="dialog"` and `aria-modal="true"`
2. **Focus Management**: Focus trapped within modal, returns on close
3. **Keyboard Navigation**: Escape closes modal, Tab cycles through fields
4. **Form Labels**: All inputs have associated labels via `htmlFor`
5. **Error Announcements**: Form errors use `role="alert"`
6. **Required Fields**: Marked with aria-required and visual indicator

## Risks and Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| API createTemplate fails silently | Low | High | Robust error handling and user feedback |
| Form validation too strict | Medium | Medium | Clear error messages, reasonable defaults |
| Modal conflicts with other modals | Low | Medium | z-50 stacking, only one modal at a time |
| Performance with many tags | Low | Low | Limit tag count, virtualize if needed |

## Consequences

### Positive
- Users can easily save successful task patterns as templates
- Reduces repetitive task configuration
- Enables workflow standardization across projects
- Consistent with existing modal and form patterns

### Negative
- Adds another modal to manage
- Requires two integration points (task detail + create dialog)
- Form complexity with multiple fields and validation

## Related Documents
- `packages/web-ui/src/types/task-template.ts` - Template type definitions
- `packages/web-ui/src/components/tasks/CreateTaskDialog.tsx` - Reference modal pattern
- `packages/web-ui/src/components/dashboard/QuickActionVariableModal.tsx` - Another modal reference
- `packages/web-ui/src/lib/api-client.ts` - API client with createTemplate method
- `ADR-012-quick-actions-bar-architecture.md` - Related quick actions architecture
