# ADR-059: Form Control Integration Tests Technical Design

## Status
Proposed

## Context
APEX requires comprehensive integration tests for form control interactions to ensure the UI components handling user input work correctly across the CLI (Ink-based) and web UI (React-based) packages.

### Scope of Form Controls
Based on analysis of the existing codebase:

1. **Web UI (packages/web-ui)** - Uses React with TailwindCSS:
   - `CreateTaskDialog.tsx` - Contains workflow selection buttons (radio-like), autonomy level selection, text areas, and form submission
   - Button components with different variants
   - No existing dedicated Select, Checkbox, or MultiSelect components

2. **CLI (packages/cli)** - Uses Ink for terminal UI:
   - `AdvancedInput.tsx` - Tab completion, history search, suggestions
   - `InputPrompt.tsx` - Command line input with completion
   - `PermissionPrompt` - Approval/denial buttons with keyboard shortcuts

### Current Testing Infrastructure
- Vitest as the test runner
- `@testing-library/react` for React component testing
- `@testing-library/jest-dom` for DOM assertions
- jsdom environment for browser simulation
- Existing test setup files in both packages

## Decision

### 1. Test Architecture

We will create two test files:

#### 1.1 Web UI Form Controls Integration Tests
Location: `packages/web-ui/src/components/__tests__/form-controls.integration.test.tsx`

Tests will cover:
- Single select dropdown behavior (using button-based selection from CreateTaskDialog)
- Multi-select capability (for workflow tags or features)
- Checkbox toggle states
- Radio button selection (autonomy levels)
- Form submission with validation
- Validation state display
- Keyboard navigation and accessibility

#### 1.2 CLI Form Controls Integration Tests
Location: `packages/cli/src/ui/components/__tests__/form-controls.integration.test.tsx`

Tests will cover:
- Input prompt interactions
- Suggestion selection via keyboard
- Tab completion behavior
- Permission prompt button interactions
- Form-like workflows with approval gates

### 2. Test Components Required

#### 2.1 New UI Components (Web UI)
To properly test form controls, we need to create these components:

```typescript
// packages/web-ui/src/components/ui/Select.tsx
interface SelectProps {
  options: Array<{ value: string; label: string; description?: string }>;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  error?: string;
}

// packages/web-ui/src/components/ui/MultiSelect.tsx
interface MultiSelectProps {
  options: Array<{ value: string; label: string }>;
  value: string[];
  onChange: (values: string[]) => void;
  placeholder?: string;
  maxSelections?: number;
}

// packages/web-ui/src/components/ui/Checkbox.tsx
interface CheckboxProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  disabled?: boolean;
  indeterminate?: boolean;
}

// packages/web-ui/src/components/ui/RadioGroup.tsx
interface RadioGroupProps {
  options: Array<{ value: string; label: string; description?: string }>;
  value: string;
  onChange: (value: string) => void;
  name: string;
  disabled?: boolean;
}

// packages/web-ui/src/components/forms/FormField.tsx
interface FormFieldProps {
  label: string;
  required?: boolean;
  error?: string;
  hint?: string;
  children: React.ReactNode;
}
```

### 3. Test Structure

#### 3.1 Web UI Test Structure

```typescript
// packages/web-ui/src/components/__tests__/form-controls.integration.test.tsx

describe('Form Control Integration Tests', () => {
  describe('Select Component', () => {
    describe('Single Select Dropdown', () => {
      it('should open dropdown on click');
      it('should close dropdown when clicking outside');
      it('should select option and close dropdown');
      it('should support keyboard navigation');
      it('should display selected value');
      it('should show validation error when required and empty');
    });
  });

  describe('MultiSelect Component', () => {
    it('should toggle option selection');
    it('should display all selected values');
    it('should enforce max selections limit');
    it('should support select all / clear all');
    it('should filter options with search');
  });

  describe('Checkbox Component', () => {
    it('should toggle checked state on click');
    it('should toggle with Space key');
    it('should show indeterminate state');
    it('should propagate change event');
    it('should be disabled when prop is set');
  });

  describe('RadioGroup Component', () => {
    it('should select only one option at a time');
    it('should support keyboard navigation between options');
    it('should show descriptions for each option');
    it('should be focusable and accessible');
  });

  describe('Form Submission', () => {
    it('should validate required fields before submission');
    it('should display field-level errors');
    it('should clear errors on valid input');
    it('should prevent submission with validation errors');
    it('should call onSubmit with form data when valid');
    it('should show loading state during submission');
    it('should handle submission errors gracefully');
  });

  describe('Validation States', () => {
    it('should show error state styling');
    it('should show success state after valid input');
    it('should show warning state for partial validity');
    it('should clear validation on blur if valid');
  });

  describe('Keyboard Accessibility', () => {
    it('should support Tab navigation through form fields');
    it('should support Enter to submit form');
    it('should support Escape to cancel/close');
    it('should trap focus within modal dialogs');
  });
});
```

#### 3.2 CLI Test Structure

```typescript
// packages/cli/src/ui/components/__tests__/form-controls.integration.test.tsx

describe('CLI Form Control Integration Tests', () => {
  describe('AdvancedInput Component', () => {
    it('should accept text input');
    it('should show suggestions based on input');
    it('should select suggestion with Tab key');
    it('should navigate suggestions with arrow keys');
    it('should submit on Enter');
    it('should cancel on Escape');
    it('should support Ctrl+C to cancel');
  });

  describe('Permission Prompt', () => {
    it('should display all action buttons');
    it('should call onApprove for Allow Always');
    it('should call onApprove for Allow Once');
    it('should call onDeny for Deny action');
    it('should support keyboard shortcuts');
    it('should handle Enter key on focused button');
  });

  describe('Input Prompt with Completion', () => {
    it('should show placeholder when empty');
    it('should filter suggestions as user types');
    it('should complete command with Tab');
    it('should navigate history with Up/Down arrows');
    it('should search history with Ctrl+R');
  });
});
```

### 4. Test Utilities

#### 4.1 Form Test Helpers

```typescript
// packages/web-ui/src/__tests__/form-test-utils.ts

export const formTestUtils = {
  /**
   * Fills a form field by label
   */
  fillField: async (label: string, value: string) => {
    const field = screen.getByLabelText(label);
    await userEvent.clear(field);
    await userEvent.type(field, value);
    return field;
  },

  /**
   * Selects an option from a select dropdown
   */
  selectOption: async (label: string, optionText: string) => {
    const select = screen.getByLabelText(label);
    await userEvent.click(select);
    const option = screen.getByText(optionText);
    await userEvent.click(option);
  },

  /**
   * Toggles a checkbox
   */
  toggleCheckbox: async (label: string) => {
    const checkbox = screen.getByLabelText(label);
    await userEvent.click(checkbox);
    return checkbox;
  },

  /**
   * Selects a radio option
   */
  selectRadio: async (groupLabel: string, optionLabel: string) => {
    const option = screen.getByRole('radio', { name: optionLabel });
    await userEvent.click(option);
    return option;
  },

  /**
   * Submits a form and waits for submission to complete
   */
  submitForm: async (submitButtonText = 'Submit') => {
    const button = screen.getByRole('button', { name: submitButtonText });
    await userEvent.click(button);
  },

  /**
   * Checks if form has validation error
   */
  hasValidationError: (fieldLabel: string) => {
    const field = screen.getByLabelText(fieldLabel);
    return field.getAttribute('aria-invalid') === 'true';
  },

  /**
   * Gets validation error message for a field
   */
  getValidationError: (fieldLabel: string) => {
    const field = screen.getByLabelText(fieldLabel);
    const errorId = field.getAttribute('aria-describedby');
    if (!errorId) return null;
    const errorElement = document.getElementById(errorId);
    return errorElement?.textContent || null;
  },
};
```

### 5. Mock Implementations

#### 5.1 API Mock for Form Submission

```typescript
// Mock API client for form submission tests
const mockApiClient = {
  createTask: vi.fn().mockResolvedValue({ taskId: 'test-task-123' }),
  updateTask: vi.fn().mockResolvedValue({ success: true }),
};

vi.mock('@/lib/api-client', () => ({
  apiClient: mockApiClient,
}));
```

### 6. Implementation Plan

#### Phase 1: Component Development (if needed)
1. Create `Select` component with dropdown behavior
2. Create `MultiSelect` component with multi-selection support
3. Create `Checkbox` component with proper accessibility
4. Create `RadioGroup` component
5. Create `FormField` wrapper component

#### Phase 2: Test Development
1. Write unit tests for each new component
2. Write integration tests for form workflows
3. Write accessibility tests for keyboard navigation
4. Write validation state tests

#### Phase 3: Integration
1. Integrate new components into CreateTaskDialog
2. Update existing tests to use new components
3. Run full test suite

### 7. Test File Locations

```
packages/
├── web-ui/
│   └── src/
│       └── components/
│           ├── ui/
│           │   ├── Select.tsx
│           │   ├── MultiSelect.tsx
│           │   ├── Checkbox.tsx
│           │   └── RadioGroup.tsx
│           ├── forms/
│           │   └── FormField.tsx
│           └── __tests__/
│               └── form-controls.integration.test.tsx
└── cli/
    └── src/
        └── ui/
            └── components/
                └── __tests__/
                    └── form-controls.integration.test.tsx
```

### 8. Acceptance Criteria Mapping

| Criteria | Test Location | Test Description |
|----------|---------------|------------------|
| Single select dropdowns | `web-ui/.../form-controls.integration.test.tsx` | `Select Component` suite |
| Multi-select | `web-ui/.../form-controls.integration.test.tsx` | `MultiSelect Component` suite |
| Checkbox toggle | `web-ui/.../form-controls.integration.test.tsx` | `Checkbox Component` suite |
| Radio button selection | `web-ui/.../form-controls.integration.test.tsx` | `RadioGroup Component` suite |
| Form submission | `web-ui/.../form-controls.integration.test.tsx` | `Form Submission` suite |
| Validation states | `web-ui/.../form-controls.integration.test.tsx` | `Validation States` suite |

### 9. Testing Strategy

#### 9.1 User Event Simulation
Use `@testing-library/user-event` for realistic user interaction simulation:

```typescript
import userEvent from '@testing-library/user-event';

// Setup user event instance
const user = userEvent.setup();

// Click actions
await user.click(element);

// Type in input
await user.type(input, 'text');

// Keyboard navigation
await user.keyboard('{Tab}');
await user.keyboard('{Enter}');
await user.keyboard('{ArrowDown}');
```

#### 9.2 Async Handling
Use `waitFor` and `findBy` queries for async operations:

```typescript
// Wait for element to appear
await waitFor(() => {
  expect(screen.getByText('Success')).toBeInTheDocument();
});

// Find element that may appear asynchronously
const successMessage = await screen.findByText('Task created');
```

#### 9.3 Accessibility Testing
Include ARIA attribute verification:

```typescript
// Check ARIA attributes
expect(select).toHaveAttribute('role', 'listbox');
expect(option).toHaveAttribute('aria-selected', 'true');
expect(checkbox).toHaveAttribute('aria-checked', 'true');
expect(input).toHaveAttribute('aria-invalid', 'false');
```

## Consequences

### Positive
- Comprehensive test coverage for form interactions
- Reusable form components across the web UI
- Better accessibility through proper ARIA implementation
- Consistent testing patterns across packages

### Negative
- Initial development time for new components
- Additional maintenance burden for form components
- Test execution time may increase

### Neutral
- Establishes patterns for future form development
- May influence CLI component design for consistency

## References
- [Testing Library Documentation](https://testing-library.com/docs/)
- [WAI-ARIA Practices](https://www.w3.org/WAI/ARIA/apg/)
- [Vitest Documentation](https://vitest.dev/)
- Existing test patterns in `packages/cli/src/ui/components/permissions/__tests__/PermissionPrompt.comprehensive.test.ts`
