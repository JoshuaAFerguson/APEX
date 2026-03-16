# ADR-012: AgentForm Component Architecture

## Status
Accepted

## Context
We need to create an `AgentForm` component for the APEX web UI that allows users to create and edit agent definitions. The form must support all 6 agent fields (name, description, prompt, model, tools, skills) with proper validation, inline error display, and both create and edit modes.

## Decision

### Component Architecture

We will create a controlled form component that follows existing patterns in the codebase:

```
packages/web-ui/src/components/forms/
├── AgentForm.tsx           # Main form component
├── FormField.tsx           # Existing wrapper component
├── __tests__/
│   └── AgentForm.test.tsx  # Unit and integration tests
└── index.ts                # Updated exports
```

### Design Principles

1. **Controlled Component Pattern**: All form inputs will be controlled via React state with `useState` hook, following the pattern established in `form-validation.integration.test.tsx`.

2. **Zod Schema Integration**: Leverage the existing `AgentFormSchema` from `@/lib/schemas/agent-schema.ts` for validation, using `validateAgentForm` and `getFormErrors` helper functions.

3. **FormField Wrapper**: Use the existing `FormField` component for consistent label rendering, required indicators, and error display.

4. **Dual Mode Support**: Support both create (empty initial state) and edit (pre-filled via `initialData` prop) modes through optional `initialData` prop.

### Component Interface

```typescript
export interface AgentFormProps {
  /** Initial data for edit mode - if provided, form is in edit mode */
  initialData?: AgentFormData
  /** Callback when form is successfully submitted with validated data */
  onSubmit: (data: AgentFormData) => void | Promise<void>
  /** Callback when form is cancelled */
  onCancel: () => void
  /** Available tools for selection */
  availableTools?: MultiSelectOption[]
  /** Available skills for selection */
  availableSkills?: MultiSelectOption[]
  /** Whether form is in loading/submitting state */
  isSubmitting?: boolean
  /** Additional CSS class names */
  className?: string
}
```

### Form Fields Implementation

| Field | Component | Validation |
|-------|-----------|------------|
| Name | `<Input>` | Required, lowercase, hyphens, regex pattern |
| Description | `<textarea>` | Required, max 500 chars |
| Prompt | `<textarea>` | Required, min 10 chars, max 50000 chars |
| Model | `<Select>` | Enum: opus, sonnet, haiku, inherit |
| Tools | `<MultiSelect>` | Optional, max 50 items |
| Skills | `<MultiSelect>` | Optional, max 100 items |

### State Management

```typescript
// Form data state
const [formData, setFormData] = useState<AgentFormData>(
  initialData ?? getDefaultFormData()
)

// Validation errors state
const [errors, setErrors] = useState<Partial<Record<keyof AgentFormData, string>>>({})

// Touched fields for on-blur validation
const [touchedFields, setTouchedFields] = useState<Set<keyof AgentFormData>>(new Set())
```

### Validation Strategy

1. **On Change**: Clear field error when user starts typing
2. **On Blur**: Validate individual field using zod schema
3. **On Submit**: Full form validation, prevent submission if invalid

### Component Features

1. **Inline Error Display**: Use `FormField` error prop with validation messages from `AGENT_VALIDATION_MESSAGES`
2. **Character Counters**: Show for description and prompt textareas
3. **Submit Button State**: Disabled during submission, shows loading indicator
4. **Cancel Button**: Secondary button to trigger `onCancel` callback

## Consequences

### Positive
- Consistent with existing form patterns in codebase
- Reuses existing zod schema with comprehensive validation
- Type-safe with full TypeScript support
- Accessible with proper ARIA attributes via FormField
- Testable with data-testid attributes

### Negative
- Requires consumers to provide availableTools/availableSkills options
- Form state is local (not integrated with global state management)

### Neutral
- Textarea is used directly (no separate Textarea component in UI library)
- Validation happens client-side only

## Technical Details

### Dependencies
- React 18.3+ (hooks, controlled components)
- Zod 3.25+ (schema validation)
- Existing UI components: Input, Select, MultiSelect, Button, FormField

### File Locations
- Component: `packages/web-ui/src/components/forms/AgentForm.tsx`
- Tests: `packages/web-ui/src/components/forms/__tests__/AgentForm.test.tsx`
- Schema: `packages/web-ui/src/lib/schemas/agent-schema.ts` (existing)

### Test Strategy
1. Unit tests for rendering all 6 fields
2. Integration tests for validation flow
3. Tests for create mode (empty) and edit mode (pre-filled)
4. Form submission tests with valid/invalid data
5. Accessibility tests for form labels and error announcements
