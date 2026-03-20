# Architecture Decision Record: QuickActionsBar Component

## Status
**Implemented** ✅

## Date
2025-03-20 (Architecture validated)

## Context

The APEX dashboard needs a `QuickActionsBar` component that allows users to quickly create tasks from templates marked as `isQuickAction=true`. This provides a streamlined workflow for common task patterns without navigating to the full task creation flow.

### Requirements
1. Display templates with `isQuickAction=true` as clickable buttons
2. For templates with NO variables: Create task immediately on click
3. For templates WITH variables: Open a minimal variable input form
4. Style consistently with dashboard theme (using existing design system)
5. Handle loading, error, and empty states gracefully

## Decision

### Component Architecture

```
packages/web-ui/src/components/dashboard/
├── QuickActionsBar.tsx           # Main component
├── QuickActionButton.tsx         # Individual action button
├── QuickActionVariableModal.tsx  # Modal for variable input
├── __tests__/
│   ├── QuickActionsBar.test.tsx
│   ├── QuickActionsBar.integration.test.tsx
│   └── QuickActionButton.test.tsx
└── index.ts                      # Updated exports
```

### Component Design

#### 1. QuickActionsBar (Main Component)

**Responsibilities:**
- Fetch templates with `isQuickAction=true` filter
- Render a horizontal bar of QuickActionButton components
- Manage loading/error/empty states
- Handle template selection and modal state

**Props Interface:**
```typescript
export interface QuickActionsBarProps {
  /** Callback when a task is created successfully */
  onTaskCreated?: (taskId: string, templateId: string) => void
  /** Callback when task creation fails */
  onError?: (error: Error, templateId: string) => void
  /** Maximum number of quick actions to display */
  maxActions?: number
  /** Whether to show action icons */
  showIcons?: boolean
  /** Whether component is in compact mode */
  compact?: boolean
  /** Custom className */
  className?: string
}
```

#### 2. QuickActionButton (Sub-Component)

**Responsibilities:**
- Render individual template as a button
- Show template icon, name, and category badge
- Handle click behavior (immediate create vs. open modal)
- Show loading state during task creation

**Props Interface:**
```typescript
export interface QuickActionButtonProps {
  /** The template to render */
  template: TaskTemplate
  /** Callback when button is clicked */
  onClick: (template: TaskTemplate) => void
  /** Whether the button is in loading state */
  loading?: boolean
  /** Whether to show the template icon */
  showIcon?: boolean
  /** Whether in compact mode */
  compact?: boolean
  /** Custom className */
  className?: string
}
```

#### 3. QuickActionVariableModal (Modal Component)

**Responsibilities:**
- Display a minimal form for required template variables
- Render appropriate input controls based on variable type
- Validate variable values before submission
- Create task with interpolated template values

**Props Interface:**
```typescript
export interface QuickActionVariableModalProps {
  /** Whether the modal is open */
  isOpen: boolean
  /** The template to create task from */
  template: TaskTemplate
  /** Callback when modal is closed */
  onClose: () => void
  /** Callback when task is created successfully */
  onTaskCreated: (taskId: string) => void
  /** Callback when task creation fails */
  onError?: (error: Error) => void
}
```

### Data Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                        QuickActionsBar                          │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  useQuickActionTemplates() hook                          │   │
│  │  - Fetches templates with isQuickAction=true             │   │
│  │  - Caches results                                        │   │
│  │  - Handles refresh                                       │   │
│  └──────────────────────────────────────────────────────────┘   │
│                              │                                   │
│              ┌───────────────┼───────────────┐                  │
│              ▼               ▼               ▼                  │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐            │
│  │QuickAction   │ │QuickAction   │ │QuickAction   │            │
│  │Button        │ │Button        │ │Button        │            │
│  │(no vars)     │ │(has vars)    │ │(no vars)     │            │
│  └──────────────┘ └──────────────┘ └──────────────┘            │
│         │                │                │                     │
│         ▼                ▼                ▼                     │
│   [Direct Create]  [Open Modal]    [Direct Create]             │
│         │                │                │                     │
│         │                ▼                │                     │
│         │  ┌─────────────────────────┐   │                     │
│         │  │QuickActionVariableModal │   │                     │
│         │  │  - Variable inputs      │   │                     │
│         │  │  - Validation           │   │                     │
│         │  │  - Submit creates task  │   │                     │
│         │  └─────────────────────────┘   │                     │
│         │                │                │                     │
│         └────────────────┼────────────────┘                    │
│                          ▼                                      │
│                   apiClient.createTask()                        │
│                          │                                      │
│                          ▼                                      │
│                  onTaskCreated callback                         │
└─────────────────────────────────────────────────────────────────┘
```

### API Integration

#### Template Fetching

The API client needs a new method to fetch quick action templates:

```typescript
// In api-client.ts - New method to add
async getQuickActionTemplates(): Promise<TaskTemplate[]> {
  const response = await this.fetch('/templates?isQuickAction=true')
  return response.json()
}
```

**Note:** If the templates API endpoint doesn't exist yet, we'll need to implement mock data for development and document the expected API contract.

#### Task Creation

Use existing `apiClient.createTask()` with template interpolation:

```typescript
// Template interpolation utility
function interpolateTemplate(
  template: string,
  values: TemplateVariableValues
): string {
  return template.replace(/\{\{(\w+)\}\}/g, (match, varName) => {
    const value = values[varName]
    if (value === undefined) return match
    return String(value)
  })
}

// Create task from template
const description = interpolateTemplate(
  template.descriptionTemplate,
  variableValues
)
const acceptanceCriteria = template.acceptanceCriteriaTemplate
  ? interpolateTemplate(template.acceptanceCriteriaTemplate, variableValues)
  : undefined

await apiClient.createTask({
  description,
  acceptanceCriteria,
  workflow: template.workflow,
  autonomy: template.autonomy,
})
```

### Custom Hook: useQuickActionTemplates

```typescript
export interface UseQuickActionTemplatesReturn {
  /** Quick action templates */
  templates: TaskTemplate[]
  /** Loading state */
  isLoading: boolean
  /** Error state */
  error: string | null
  /** Refresh templates */
  refresh: () => Promise<void>
  /** Create task from template (handles no-variable case) */
  createTaskFromTemplate: (
    template: TaskTemplate,
    variables?: TemplateVariableValues
  ) => Promise<string>
  /** Check if template requires variable input */
  hasRequiredVariables: (template: TaskTemplate) => boolean
}
```

### Styling Strategy

Follow existing dashboard component patterns:

1. **Card-based Layout**: Use `Card` component for the bar container
2. **Button Styling**: Use existing `Button` variants with template colors
3. **Category Badges**: Use `Badge` component with category-appropriate colors
4. **Modal Styling**: Follow `ContextInjectionModal` and `CreateTaskDialog` patterns
5. **Color Palette**: Use `TEMPLATE_CATEGORY_CONFIG` colors from task-template.ts
6. **Responsive Design**: Horizontal scroll on mobile, grid on larger screens

```tsx
// Button styling example using existing patterns
<Button
  variant="ghost"
  size="sm"
  className={cn(
    'flex items-center gap-2 px-3 py-2',
    'border border-border hover:border-apex-500/50',
    'hover:bg-background-tertiary transition-colors',
    loading && 'opacity-50 cursor-not-allowed'
  )}
  onClick={() => handleClick(template)}
  disabled={loading}
>
  {/* Icon from template.icon or category default */}
  <TemplateIcon icon={template.icon} category={template.category} />
  <span className="font-medium">{template.name}</span>
  <Badge variant="secondary" size="sm">
    {TEMPLATE_CATEGORY_CONFIG[template.category].label}
  </Badge>
</Button>
```

### Variable Input Form Design

For templates with variables, render a minimal modal:

```
┌─────────────────────────────────────────────┐
│  ⚡ Create from Template: "Bug Fix"    [X]  │
├─────────────────────────────────────────────┤
│                                             │
│  Bug Title *                                │
│  ┌─────────────────────────────────────┐   │
│  │ Enter the bug title...              │   │
│  └─────────────────────────────────────┘   │
│                                             │
│  Affected Component                         │
│  ┌─────────────────────────────────────┐   │
│  │ Select component...              ▼  │   │
│  └─────────────────────────────────────┘   │
│                                             │
│  Severity *                                 │
│  ○ Low    ● Medium    ○ High    ○ Critical │
│                                             │
├─────────────────────────────────────────────┤
│                     [Cancel]  [Create Task] │
└─────────────────────────────────────────────┘
```

Input types mapped from `TemplateVariableType`:
- `string` → `<Input type="text" />`
- `text` → `<textarea />`
- `number` → `<Input type="number" />`
- `boolean` → `<Checkbox />`
- `select` → `<Select />`
- `multiselect` → `<MultiSelect />`
- `file`, `directory` → `<Input type="text" />` with path validation

### Error Handling

1. **Template Fetch Errors**: Show error message with retry button
2. **Task Creation Errors**: Show error in toast/alert, keep modal open
3. **Validation Errors**: Show inline errors on form fields
4. **Network Errors**: Show generic error with retry option

### Accessibility

1. **Keyboard Navigation**: Tab through buttons, Enter/Space to activate
2. **Screen Reader Support**: Proper ARIA labels and live regions
3. **Focus Management**: Return focus to trigger button after modal closes
4. **Loading States**: Announce via aria-live regions

```tsx
<div
  role="toolbar"
  aria-label="Quick Actions"
  className="quick-actions-bar"
>
  {templates.map(template => (
    <QuickActionButton
      key={template.id}
      template={template}
      aria-label={`Create ${template.name} task`}
      aria-describedby={`${template.id}-description`}
    />
  ))}
</div>
```

### Performance Considerations

1. **Lazy Loading**: Load templates on component mount, not on page load
2. **Caching**: Cache templates in React Query or SWR with 5-minute stale time
3. **Debouncing**: Debounce rapid button clicks to prevent duplicate tasks
4. **Optimistic Updates**: Show loading state immediately, rollback on error

### Testing Strategy

#### Unit Tests (QuickActionsBar.test.tsx)
- Renders loading state
- Renders empty state when no quick actions
- Renders quick action buttons for each template
- Handles direct task creation for no-variable templates
- Opens modal for templates with variables
- Handles errors gracefully

#### Integration Tests (QuickActionsBar.integration.test.tsx)
- Full flow: click → modal → fill variables → create task
- API error handling
- Keyboard navigation
- Accessibility compliance

#### Component Tests (QuickActionButton.test.tsx)
- Renders template information correctly
- Shows loading state when creating task
- Calls onClick with correct template
- Applies category-specific styling

## File Structure Summary

```
packages/web-ui/src/
├── components/dashboard/
│   ├── QuickActionsBar.tsx
│   ├── QuickActionButton.tsx
│   ├── QuickActionVariableModal.tsx
│   ├── __tests__/
│   │   ├── QuickActionsBar.test.tsx
│   │   ├── QuickActionsBar.integration.test.tsx
│   │   └── QuickActionButton.test.tsx
│   └── index.ts (updated)
├── hooks/
│   ├── useQuickActionTemplates.ts
│   └── __tests__/
│       └── useQuickActionTemplates.test.ts
├── lib/
│   └── template-interpolation.ts (utility)
└── types/
    └── task-template.ts (already exists, may need QuickActionBarProps)
```

## Consequences

### Positive
- Streamlined task creation for common patterns
- Consistent with existing dashboard design
- Reusable components (modal, button) for other features
- Clear separation of concerns

### Negative
- Requires templates API endpoint (may need mock data initially)
- Additional complexity in state management
- Need to handle edge cases (templates changing, caching)

### Risks
- API endpoint may not exist yet → Mitigation: Use mock data, document API contract
- Template validation may be complex → Mitigation: Start with simple types only
- Performance with many templates → Mitigation: Limit display count, add pagination

## Implementation Order

1. **Phase 1**: Core components (QuickActionsBar, QuickActionButton) with mock data
2. **Phase 2**: useQuickActionTemplates hook with API integration
3. **Phase 3**: QuickActionVariableModal with form inputs
4. **Phase 4**: Integration with dashboard page
5. **Phase 5**: Tests and documentation

## Related ADRs
- Task Template System (existing types in task-template.ts)
- Dashboard Layout Architecture

## Notes for Implementation Stage
- Check if `/templates` API endpoint exists; if not, coordinate with backend
- Use existing form components (Input, Select, Checkbox) from ui/ directory
- Follow CreateTaskDialog and ContextInjectionModal patterns for modal
- Consider adding to dashboard page between metrics and ActiveTasksPanel
