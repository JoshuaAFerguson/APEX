# ADR-0027: TemplateSelectionModal Component Architecture

## Status
Approved (2026-03-16)

## Context

The APEX web UI requires a **TemplateSelectionModal** component that allows users to browse, search, and select task templates when creating tasks. This modal integrates with the existing `CreateTaskDialog` via a "Create from Template" option, providing an alternative workflow to manual task creation.

### Requirements
- Display available templates organized by categories
- Support search/filter by name and tags
- Show template preview (description, workflow, autonomy level)
- Return selected template to the caller
- Integrate with CreateTaskDialog via 'Create from Template' option

### Existing Infrastructure
- **Template Types**: Full type system exists in `packages/web-ui/src/types/task-template.ts`
  - `TaskTemplate` interface with all required fields
  - `TemplateCategory` type: `feature`, `bugfix`, `refactoring`, `testing`, `documentation`, `maintenance`, `deployment`, `custom`
  - `TemplateFilters` interface for querying
  - `TEMPLATE_CATEGORY_CONFIG` constant with labels, icons, and colors
- **API Client**: `apiClient.getTemplates(filters)` already exists
- **Hooks**: `useQuickActionTemplates` hook exists for quick actions (can be extended)
- **Related Components**:
  - `QuickActionVariableModal` - handles variable input after template selection
  - `CreateTaskDialog` - manual task creation dialog
  - `ActivityEventFilters` - pattern for filter chip UI
- **UI Components**: Dialog, Button, Input, Checkbox, Label, Alert, Spinner, Card components exist

## Decision

### 1. Component Architecture

```
packages/web-ui/src/
├── components/
│   └── templates/                           # NEW folder for template components
│       ├── TemplateSelectionModal.tsx       # Main modal component
│       ├── TemplateCategoryFilter.tsx       # Category filter chips
│       ├── TemplateSearchInput.tsx          # Search input with icon
│       ├── TemplateCard.tsx                 # Individual template card
│       ├── TemplatePreviewPanel.tsx         # Detailed template preview
│       └── index.ts                         # Barrel exports
├── hooks/
│   └── useTemplates.ts                      # Hook for fetching/filtering templates
└── components/tasks/
    └── CreateTaskDialog.tsx                 # MODIFY: Add "Create from Template" button
```

### 2. TemplateSelectionModal Component

```typescript
// packages/web-ui/src/components/templates/TemplateSelectionModal.tsx

export interface TemplateSelectionModalProps {
  /** Whether the modal is open */
  isOpen: boolean

  /** Callback when modal is closed */
  onClose: () => void

  /** Callback when a template is selected and confirmed */
  onTemplateSelected: (template: TaskTemplate) => void

  /** Initial filters to apply */
  initialFilters?: TemplateFilters

  /** Whether to auto-confirm on selection (skip preview) */
  quickSelect?: boolean

  /** Custom className for styling */
  className?: string
}
```

### 3. useTemplates Hook

```typescript
// packages/web-ui/src/hooks/useTemplates.ts

export interface UseTemplatesOptions {
  /** Initial filters to apply */
  initialFilters?: TemplateFilters

  /** Whether to include archived templates */
  includeArchived?: boolean

  /** Auto-fetch on mount (default: true) */
  autoFetch?: boolean
}

export interface UseTemplatesReturn {
  /** All fetched templates */
  templates: TaskTemplate[]

  /** Templates after applying local filters */
  filteredTemplates: TaskTemplate[]

  /** Templates grouped by category */
  templatesByCategory: Record<TemplateCategory | 'all', TaskTemplate[]>

  /** Loading state */
  isLoading: boolean

  /** Error state */
  error: string | null

  /** Current active filters */
  filters: TemplateFilters

  /** Update filters */
  setFilters: (filters: TemplateFilters) => void

  /** Set search query (convenience method) */
  setSearchQuery: (query: string) => void

  /** Set category filter (convenience method) */
  setCategoryFilter: (category: TemplateCategory | 'all') => void

  /** Refresh templates from API */
  refresh: () => Promise<void>

  /** Category counts for filter badges */
  categoryCounts: Record<TemplateCategory | 'all', number>
}
```

### 4. Modal Layout Structure

```
┌─────────────────────────────────────────────────────────────────┐
│ ⚡ Select Template                                          [X] │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  🔍 [Search templates by name or tags...            ]          │
│                                                                 │
│  [All] [Feature] [Bug Fix] [Refactoring] [Testing] [Docs] ...  │
│                                                                 │
├────────────────────────────────┬────────────────────────────────┤
│                                │                                │
│  ┌─────────────────────────┐   │  Template Preview              │
│  │ 📦 Create Component     │   │                                │
│  │ Feature • react, ui     │   │  Name: Create Component        │
│  │ Create a new React...   │   │  Category: Feature             │
│  └─────────────────────────┘   │  Workflow: feature             │
│                                │  Autonomy: review-before-commit│
│  ┌─────────────────────────┐   │                                │
│  │ 🐛 Fix Bug              │   │  Description:                  │
│  │ Bug Fix • maintenance   │   │  Create a new React component  │
│  │ Fix an existing bug...  │   │  with proper TypeScript types  │
│  └─────────────────────────┘   │  and tests.                    │
│                                │                                │
│  ┌─────────────────────────┐   │  Tags: react, component, ui    │
│  │ 📝 Add Documentation    │   │                                │
│  │ Documentation • docs    │   │  Variables:                    │
│  │ Add documentation...    │   │  • componentName (required)    │
│  └─────────────────────────┘   │  • componentType (optional)    │
│                                │                                │
│  [No more templates]           │                                │
│                                │                                │
├────────────────────────────────┴────────────────────────────────┤
│                                      [Cancel]  [Use Template]   │
└─────────────────────────────────────────────────────────────────┘
```

### 5. Sub-Component Specifications

#### 5.1 TemplateCategoryFilter

```typescript
interface TemplateCategoryFilterProps {
  /** Currently selected category */
  selectedCategory: TemplateCategory | 'all'

  /** Category counts for badges */
  categoryCounts: Record<TemplateCategory | 'all', number>

  /** Callback when category changes */
  onCategoryChange: (category: TemplateCategory | 'all') => void

  /** Hide categories with zero count */
  hideEmpty?: boolean

  /** Compact mode for smaller screens */
  compact?: boolean

  className?: string
}
```

Pattern: Based on `ActivityEventFilters` component - horizontal chip bar with icons, counts, and selected state.

#### 5.2 TemplateSearchInput

```typescript
interface TemplateSearchInputProps {
  /** Current search value */
  value: string

  /** Callback when search changes */
  onChange: (value: string) => void

  /** Placeholder text */
  placeholder?: string

  /** Debounce delay in ms (default: 300) */
  debounceMs?: number

  className?: string
}
```

Features:
- Search icon on left (magnifying glass from lucide-react)
- Clear button on right when value exists
- Debounced onChange to avoid excessive filtering
- Auto-focus when modal opens

#### 5.3 TemplateCard

```typescript
interface TemplateCardProps {
  /** Template to display */
  template: TaskTemplate

  /** Whether this card is selected */
  isSelected?: boolean

  /** Callback when card is clicked */
  onClick: (template: TaskTemplate) => void

  /** Callback when card is double-clicked (quick select) */
  onDoubleClick?: (template: TaskTemplate) => void

  /** Compact mode */
  compact?: boolean

  className?: string
}
```

Visual elements:
- Category icon (from `TEMPLATE_CATEGORY_CONFIG`)
- Template name (primary text)
- Category label (badge)
- Tags (secondary badges, max 3)
- Truncated description (2 lines)
- Selected state with border highlight

#### 5.4 TemplatePreviewPanel

```typescript
interface TemplatePreviewPanelProps {
  /** Template to preview (null when none selected) */
  template: TaskTemplate | null

  /** Loading state */
  isLoading?: boolean

  className?: string
}
```

Displays when a template is selected:
- Full template name
- Category with icon and color
- Workflow type
- Autonomy level with explanation
- Full description
- All tags
- Variables list (if any) with required indicators
- Usage count (if available)

### 6. Integration with CreateTaskDialog

```typescript
// Modify CreateTaskDialog to add "Create from Template" option

export function CreateTaskDialog({ isOpen, onClose, onCreated }: CreateTaskDialogProps) {
  const [showTemplateModal, setShowTemplateModal] = useState(false)
  const [selectedTemplate, setSelectedTemplate] = useState<TaskTemplate | null>(null)

  const handleTemplateSelected = (template: TaskTemplate) => {
    setSelectedTemplate(template)
    setShowTemplateModal(false)

    // Check if template has required variables
    if (templateHasRequiredVariables(template)) {
      // Open QuickActionVariableModal instead
      setShowVariableModal(true)
    } else {
      // Pre-fill form with template data
      setDescription(template.descriptionTemplate)
      setAcceptanceCriteria(template.acceptanceCriteriaTemplate || '')
      setWorkflow(template.workflow)
      setAutonomy(template.autonomy)
    }
  }

  return (
    <>
      {/* Existing dialog content */}
      <div className="...">
        {/* Add "Create from Template" button in header area */}
        <Button variant="secondary" onClick={() => setShowTemplateModal(true)}>
          <FileText className="w-4 h-4 mr-2" />
          Create from Template
        </Button>

        {/* ... rest of form ... */}
      </div>

      {/* Template Selection Modal */}
      <TemplateSelectionModal
        isOpen={showTemplateModal}
        onClose={() => setShowTemplateModal(false)}
        onTemplateSelected={handleTemplateSelected}
      />

      {/* Variable Modal for templates with required variables */}
      {selectedTemplate && showVariableModal && (
        <QuickActionVariableModal
          isOpen={showVariableModal}
          template={selectedTemplate}
          onClose={() => setShowVariableModal(false)}
          onTaskCreated={onCreated}
        />
      )}
    </>
  )
}
```

### 7. State Management

```typescript
// Local state within TemplateSelectionModal
const [searchQuery, setSearchQuery] = useState('')
const [selectedCategory, setSelectedCategory] = useState<TemplateCategory | 'all'>('all')
const [selectedTemplate, setSelectedTemplate] = useState<TaskTemplate | null>(null)

// Derived from hook
const {
  filteredTemplates,
  isLoading,
  error,
  categoryCounts,
  setFilters
} = useTemplates({
  initialFilters: initialFilters
})

// Combined filtering (search + category)
useEffect(() => {
  setFilters({
    search: searchQuery || undefined,
    category: selectedCategory === 'all' ? undefined : selectedCategory
  })
}, [searchQuery, selectedCategory, setFilters])
```

### 8. Keyboard Navigation

| Key | Action |
|-----|--------|
| `Escape` | Close modal |
| `Enter` | Confirm selection (when template selected) |
| `ArrowUp/Down` | Navigate template list |
| `Tab` | Move focus between sections |
| `/` | Focus search input |

### 9. Responsive Design

| Breakpoint | Layout |
|------------|--------|
| `< 640px` (mobile) | Full-width, stacked layout (list above preview), compact cards |
| `640px - 1024px` (tablet) | Side-by-side but narrower panels, medium cards |
| `> 1024px` (desktop) | Full side-by-side layout as shown in diagram |

## Design Decisions

### D1: Separate Template Components Folder
**Decision**: Create new `components/templates/` folder instead of placing in `components/tasks/`

**Rationale**:
- Templates are a distinct domain concept, not just task-related
- Allows for future template management features (CRUD)
- Keeps task components focused on task display/interaction
- Follows existing pattern of domain-focused component folders

### D2: Split Panel Layout (List + Preview)
**Decision**: Two-panel layout with template list on left and preview on right

**Rationale**:
- Users can quickly scan templates while seeing details
- Reduces clicks compared to modal-within-modal pattern
- Familiar pattern from email clients, file managers
- Preview panel can show full details without truncation
- Alternative considered: Full-width cards with expandable details

### D3: Local Filtering vs API Filtering
**Decision**: Fetch all templates once, filter locally

**Rationale**:
- Templates dataset is small (typically < 50)
- Instant filtering without network latency
- Search/category changes don't trigger API calls
- API `getTemplates()` already supports filters for initial load optimization
- Can add pagination if template count grows significantly

### D4: Category as Primary Filter, Tags as Search
**Decision**: Category filter chips with tag-inclusive search

**Rationale**:
- Categories are mutually exclusive and limited (8 options)
- Tags are numerous and better suited for text search
- Matches existing `TemplateFilters` interface
- Search box can find by name, description, AND tags

### D5: Preview Panel vs Quick Details Tooltip
**Decision**: Dedicated preview panel instead of hover tooltips

**Rationale**:
- More information can be displayed
- Works on touch devices
- Accessible (no hover dependency)
- Users can compare templates by selecting different ones
- Trade-off: Uses more screen space

### D6: Single Selection Model
**Decision**: Only allow selecting one template at a time

**Rationale**:
- User creates one task at a time
- Multi-select adds complexity without clear benefit
- Can batch create tasks from dashboard (existing flow)

## Implementation Plan

### Phase 1: Hook Implementation
1. Create `useTemplates` hook in `packages/web-ui/src/hooks/useTemplates.ts`
2. Implement filtering, grouping, and count calculations
3. Add hook tests

### Phase 2: Sub-Components
1. Create `TemplateCategoryFilter` based on `ActivityEventFilters` pattern
2. Create `TemplateSearchInput` with debouncing
3. Create `TemplateCard` with selection state
4. Create `TemplatePreviewPanel` for details display
5. Add tests for each component

### Phase 3: Main Modal Component
1. Create `TemplateSelectionModal` composing sub-components
2. Implement keyboard navigation
3. Add responsive layout
4. Add comprehensive tests

### Phase 4: CreateTaskDialog Integration
1. Add "Create from Template" button to `CreateTaskDialog`
2. Wire up template selection to form pre-filling
3. Handle variable modal flow for templates with required variables
4. Add integration tests

## File Changes Summary

| File | Change Type | Description |
|------|-------------|-------------|
| `packages/web-ui/src/hooks/useTemplates.ts` | CREATE | Hook for template fetching and filtering |
| `packages/web-ui/src/hooks/index.ts` | MODIFY | Export new hook |
| `packages/web-ui/src/components/templates/TemplateSelectionModal.tsx` | CREATE | Main modal component |
| `packages/web-ui/src/components/templates/TemplateCategoryFilter.tsx` | CREATE | Category filter chip bar |
| `packages/web-ui/src/components/templates/TemplateSearchInput.tsx` | CREATE | Search input with debouncing |
| `packages/web-ui/src/components/templates/TemplateCard.tsx` | CREATE | Template list item card |
| `packages/web-ui/src/components/templates/TemplatePreviewPanel.tsx` | CREATE | Template detail preview |
| `packages/web-ui/src/components/templates/index.ts` | CREATE | Barrel exports |
| `packages/web-ui/src/components/tasks/CreateTaskDialog.tsx` | MODIFY | Add "Create from Template" integration |
| `packages/web-ui/src/components/templates/__tests__/*.test.tsx` | CREATE | Component tests |
| `packages/web-ui/src/hooks/__tests__/useTemplates.test.ts` | CREATE | Hook tests |

## Testing Strategy

### Unit Tests
- `useTemplates`: Loading states, filtering, grouping, error handling
- `TemplateCategoryFilter`: Rendering, selection, counts, accessibility
- `TemplateSearchInput`: Debouncing, clear button, keyboard events
- `TemplateCard`: Rendering, selection states, click handlers
- `TemplatePreviewPanel`: Rendering all template fields, null state
- `TemplateSelectionModal`: Integration of all parts, keyboard nav

### Integration Tests
- Modal opens from CreateTaskDialog
- Search filters templates correctly
- Category filter updates results
- Template selection populates preview
- Confirmation triggers callback with correct template
- ESC closes modal
- Templates with variables open variable modal

### Accessibility Tests
- Focus management when modal opens/closes
- Keyboard navigation through template list
- Screen reader announcements for filter changes
- ARIA labels on all interactive elements

## Type Definitions

```typescript
// Additional props types to add to task-template.ts

/**
 * Props for TemplateSelectionModal component
 */
export interface TemplateSelectionModalProps {
  isOpen: boolean
  onClose: () => void
  onTemplateSelected: (template: TaskTemplate) => void
  initialFilters?: TemplateFilters
  quickSelect?: boolean
  className?: string
}

/**
 * Props for TemplateCategoryFilter component
 */
export interface TemplateCategoryFilterProps {
  selectedCategory: TemplateCategory | 'all'
  categoryCounts: Record<TemplateCategory | 'all', number>
  onCategoryChange: (category: TemplateCategory | 'all') => void
  hideEmpty?: boolean
  compact?: boolean
  className?: string
}

/**
 * Props for TemplateCard component
 */
export interface TemplateCardProps {
  template: TaskTemplate
  isSelected?: boolean
  onClick: (template: TaskTemplate) => void
  onDoubleClick?: (template: TaskTemplate) => void
  compact?: boolean
  className?: string
}
```

## Risks and Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Performance with many templates | Low | Medium | Implement virtualized list (react-window) if > 100 templates |
| Mobile UX complexity | Medium | Medium | Responsive design with collapsible preview panel |
| Template schema changes | Low | High | Use existing type definitions, version API |
| Category icon mapping incomplete | Low | Low | Fallback to generic icon for unknown categories |

## Consequences

### Positive
- Users can discover and use templates more easily
- Reduces friction in task creation workflow
- Consistent with existing modal patterns in codebase
- Reuses existing hooks and components where possible
- Clear separation of concerns with sub-components

### Negative
- Adds complexity to CreateTaskDialog
- Multiple network requests if templates aren't cached
- Additional bundle size for new components
- Requires maintaining template preview sync with template schema

## Acceptance Criteria Mapping

### AC1: CreateTaskDialog has a 'Use Template' button/tab that opens TemplateSelectionModal

**Implementation**:
- Add "Use Template" button in CreateTaskDialog header section (next to title)
- Button uses `FileText` icon from lucide-react
- Clicking button sets `showTemplateModal = true` state
- TemplateSelectionModal opens as overlay modal
- Button variant: `secondary` to distinguish from primary "Create Task" action

**UI Location**:
```
┌─────────────────────────────────────────────────────────────────┐
│ ⚡ Create New Task            [Use Template] [📋]           [X] │
├─────────────────────────────────────────────────────────────────┤
│ ... form fields ...                                              │
```

### AC2: When a template is selected, form fields are pre-populated with template values

**Field Mapping** (TaskTemplate → CreateTaskDialog form fields):

| Template Field | Form Field | Notes |
|----------------|------------|-------|
| `descriptionTemplate` | `description` | Interpolated if no variables OR raw if has variables |
| `acceptanceCriteriaTemplate` | `acceptanceCriteria` | Interpolated if no variables OR raw if has variables |
| `workflow` | `workflow` | Direct mapping |
| `autonomy` | `autonomy` | Direct mapping to autonomy select |

**Pre-fill Flow**:
```typescript
const handleTemplateSelected = (template: TaskTemplate) => {
  // Templates WITHOUT required variables: pre-fill directly
  if (!templateHasRequiredVariables(template)) {
    setDescription(template.descriptionTemplate)
    setAcceptanceCriteria(template.acceptanceCriteriaTemplate || '')
    setWorkflow(template.workflow)
    setAutonomy(template.autonomy)
    setShowTemplateModal(false)
    // User can now edit fields and submit
  } else {
    // Templates WITH required variables: show variable modal first
    setSelectedTemplate(template)
    setShowTemplateModal(false)
    setShowVariableModal(true)
  }
}
```

**Visual Indication**:
- After pre-fill, show subtle indicator that form was populated from template
- "Created from template: [Template Name]" info text below form header
- Clear button to reset form and remove template association

### AC3: Template variables (if any) can be filled in before creating task

**Variable Handling Flow**:

```
User clicks "Use Template"
        │
        ▼
┌───────────────────────┐
│ TemplateSelectionModal│
│   - Browse templates  │
│   - Search/Filter     │
│   - Select template   │
└───────────┬───────────┘
            │
            ▼
   Has required variables?
        │
    ┌───┴───┐
    No      Yes
    │       │
    ▼       ▼
┌─────────┐ ┌──────────────────────┐
│Pre-fill │ │QuickActionVariableModal│
│  form   │ │  - Fill in variables │
│directly │ │  - See preview       │
└────┬────┘ │  - Validate inputs   │
     │      └──────────┬───────────┘
     │                 │
     ▼                 ▼
┌─────────────────────────────────────┐
│      CreateTaskDialog Form          │
│  (fields pre-populated with         │
│   interpolated template values)     │
│                                     │
│  - User can still edit any field    │
│  - Submit creates task via API      │
└─────────────────────────────────────┘
```

**Variable Modal Integration**:

The existing `QuickActionVariableModal` component is reused with a slight modification:
- Add optional `onVariablesSubmitted` callback that returns interpolated values
- This allows returning to CreateTaskDialog with filled values instead of directly creating task

```typescript
interface QuickActionVariableModalProps {
  // ... existing props

  /**
   * Alternative callback for returning interpolated values
   * instead of creating task directly.
   * Used when modal is opened from CreateTaskDialog.
   */
  onVariablesSubmitted?: (interpolatedValues: {
    description: string
    acceptanceCriteria?: string
    workflow: string
    autonomy: AutonomyLevel
  }) => void
}
```

**Implementation in QuickActionVariableModal**:
```typescript
const handleSubmit = async (event: React.FormEvent) => {
  event.preventDefault()
  if (!validate()) return

  // If onVariablesSubmitted provided, return values instead of creating task
  if (onVariablesSubmitted) {
    const interpolatedDescription = interpolate(template.descriptionTemplate)
    const interpolatedCriteria = template.acceptanceCriteriaTemplate
      ? interpolate(template.acceptanceCriteriaTemplate)
      : undefined

    onVariablesSubmitted({
      description: interpolatedDescription,
      acceptanceCriteria: interpolatedCriteria,
      workflow: template.workflow,
      autonomy: template.autonomy,
    })
    onClose()
    return
  }

  // Original flow: create task directly
  try {
    setIsCreating(true)
    const response = await apiClient.createTaskFromTemplate({
      templateId: template.id,
      variables: values,
    })
    onTaskCreated(response.taskId)
  } catch (error) {
    // ... error handling
  }
}
```

## Data Flow Diagram

```
                                    ┌─────────────────────────┐
                                    │      apiClient          │
                                    │  getTemplates(filters)  │
                                    └───────────┬─────────────┘
                                                │
                                                ▼
┌───────────────────────────────────────────────────────────────────────────┐
│                           useTemplates Hook                               │
│  ┌────────────┐  ┌──────────────┐  ┌───────────────┐  ┌───────────────┐ │
│  │ templates  │  │filteredList  │  │ categoryCounts│  │  setFilters   │ │
│  └────────────┘  └──────────────┘  └───────────────┘  └───────────────┘ │
└───────────────────────────────────────┬───────────────────────────────────┘
                                        │
                    ┌───────────────────┴───────────────────┐
                    ▼                                       ▼
        ┌───────────────────────┐               ┌───────────────────────┐
        │TemplateCategoryFilter │               │   TemplateSearchInput │
        │  (category buttons)   │               │    (search box)       │
        └───────────────────────┘               └───────────────────────┘
                    │                                       │
                    └───────────────┬───────────────────────┘
                                    ▼
                    ┌───────────────────────────┐
                    │     Template List         │
                    │  ┌─────────────────────┐  │
                    │  │   TemplateCard      │◄─┼─── onClick
                    │  │   TemplateCard      │  │
                    │  │   TemplateCard      │  │
                    │  └─────────────────────┘  │
                    └───────────────────────────┘
                                    │
                                    │ selectedTemplate
                                    ▼
                    ┌───────────────────────────┐
                    │   TemplatePreviewPanel    │
                    │  - Name, description      │
                    │  - Workflow, autonomy     │
                    │  - Variables list         │
                    └───────────────────────────┘
                                    │
                                    │ "Use Template" clicked
                                    ▼
                    ┌───────────────────────────┐
                    │  onTemplateSelected()     │
                    └───────────────────────────┘
                                    │
                    ┌───────────────┴───────────────┐
                    │                               │
         No Variables                    Has Variables
                    │                               │
                    ▼                               ▼
        ┌───────────────────┐           ┌───────────────────────┐
        │   Pre-fill form   │           │QuickActionVariableModal│
        │   directly        │           │   Fill variables      │
        └───────────────────┘           └───────────────────────┘
                    │                               │
                    └───────────────┬───────────────┘
                                    ▼
                    ┌───────────────────────────────┐
                    │    CreateTaskDialog Form      │
                    │   (populated with template)   │
                    │                               │
                    │   [Submit] creates task       │
                    └───────────────────────────────┘
```

## Component Interface Contracts

### TemplateSelectionModal → CreateTaskDialog

```typescript
// Callback signature
type OnTemplateSelected = (template: TaskTemplate) => void

// CreateTaskDialog receives full template object and handles:
// 1. Checking for required variables
// 2. Pre-filling form OR opening variable modal
// 3. Tracking which template was used
```

### QuickActionVariableModal → CreateTaskDialog

```typescript
// New callback for integration mode
type OnVariablesSubmitted = (interpolatedValues: {
  description: string
  acceptanceCriteria?: string
  workflow: string
  autonomy: AutonomyLevel
}) => void

// CreateTaskDialog receives interpolated values and:
// 1. Pre-fills form fields
// 2. Allows user to edit before submission
// 3. Submits via normal createTask flow
```

### CreateTaskDialog State Extensions

```typescript
// New state needed in CreateTaskDialog
const [showTemplateModal, setShowTemplateModal] = useState(false)
const [showVariableModal, setShowVariableModal] = useState(false)
const [selectedTemplate, setSelectedTemplate] = useState<TaskTemplate | null>(null)
const [isFromTemplate, setIsFromTemplate] = useState(false)
```

## Related Documents
- `packages/web-ui/src/types/task-template.ts` - TaskTemplate type definitions
- `packages/web-ui/src/hooks/useQuickActionTemplates.ts` - Existing template hook
- `packages/web-ui/src/components/dashboard/QuickActionVariableModal.tsx` - Variable input modal
- `packages/web-ui/src/components/tasks/CreateTaskDialog.tsx` - Task creation dialog
- `packages/web-ui/src/components/activity/ActivityEventFilters.tsx` - Filter chip pattern
- `docs/adr/ADR-012-quick-actions-bar-architecture.md` - Related quick actions ADR
