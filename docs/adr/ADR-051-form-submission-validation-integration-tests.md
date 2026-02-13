# ADR-051: Integration Tests for Form Submission and Validation States

## Status
Proposed

## Context

The APEX web-ui package contains form components (`FormField`, `Input`, `Select`, `Checkbox`, `RadioGroup`) and forms (`CreateTaskDialog`) that require comprehensive integration testing for submission and validation behaviors. While basic form validation tests exist in `form-validation.integration.test.tsx`, the acceptance criteria require full coverage of all validation scenarios.

### Acceptance Criteria Requirements

1. **AC1**: Form submission with valid data - forms submit successfully when all fields are valid
2. **AC2**: Form submission prevention with invalid data - forms are blocked when validation fails
3. **AC3**: Field-level validation display - individual field errors shown inline
4. **AC4**: Form-level validation - aggregate validation errors and form-wide error states
5. **AC5**: Required field validation - required fields properly marked and validated
6. **AC6**: Async validation - server-side or delayed validation (e.g., email uniqueness checks)

### Current Test Coverage Analysis

The existing `form-validation.integration.test.tsx` file provides a solid foundation with:
- Basic form submission with valid/invalid data
- Field blur validation
- Async email validation simulation
- Required field asterisk display

However, comprehensive coverage gaps exist for:
- Multiple form component types (Select, Checkbox, RadioGroup)
- Complex multi-field form-level validation rules
- Validation state transitions and timing
- CreateTaskDialog integration testing
- Error message accessibility (ARIA)

## Decision

### 1. Test Architecture Overview

Extend and enhance the existing test suite with comprehensive form validation integration tests:

```
packages/web-ui/src/components/forms/__tests__/
├── form-validation.integration.test.tsx        # Existing - enhance
├── form-submission.integration.test.tsx        # NEW - dedicated submission tests
├── form-field-validation.integration.test.tsx  # NEW - field-level validation
└── async-validation.integration.test.tsx       # NEW - async validation patterns
```

### 2. Design Principles

#### 2.1 Component Integration Strategy

| Component | Validation Type | Test Coverage |
|-----------|-----------------|---------------|
| Input | Sync + Async | Required, format, length, custom rules |
| Select | Sync | Required, valid option selection |
| Checkbox | Sync | Required, group constraints |
| RadioGroup | Sync | Required, valid option selection |
| FormField | Display | Error/hint display, accessibility |

#### 2.2 Test Categories

1. **Form Submission Tests**: End-to-end submission flows with valid/invalid data
2. **Field Validation Tests**: Individual field validation behavior
3. **Form-Level Validation Tests**: Cross-field and aggregate validation
4. **Async Validation Tests**: Server-simulated validation patterns
5. **Accessibility Tests**: ARIA compliance for validation states

### 3. Technical Implementation

#### 3.1 Test Utilities

```typescript
// packages/web-ui/src/components/forms/__tests__/test-utils.ts

import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

export interface FormTestContext {
  user: ReturnType<typeof userEvent.setup>
  fillField: (testId: string, value: string) => Promise<void>
  blurField: (testId: string) => Promise<void>
  submitForm: () => Promise<void>
  expectFieldError: (testId: string, message: string) => void
  expectNoFieldError: (testId: string) => void
  expectFormError: (message: string) => void
  expectSubmitDisabled: () => void
  expectSubmitEnabled: () => void
}

export function createFormTestContext(): FormTestContext {
  const user = userEvent.setup()

  return {
    user,

    async fillField(testId: string, value: string) {
      const input = screen.getByTestId(testId)
      await user.clear(input)
      await user.type(input, value)
    },

    async blurField(testId: string) {
      const input = screen.getByTestId(testId)
      await user.click(input)
      await user.tab()
    },

    async submitForm() {
      const submitButton = screen.getByTestId('submit-button')
      await user.click(submitButton)
    },

    expectFieldError(testId: string, message: string) {
      const errorElement = screen.getByTestId(`${testId}-error`)
      expect(errorElement).toHaveTextContent(message)
      expect(errorElement).toHaveAttribute('role', 'alert')
    },

    expectNoFieldError(testId: string) {
      expect(screen.queryByTestId(`${testId}-error`)).not.toBeInTheDocument()
    },

    expectFormError(message: string) {
      const formError = screen.getByTestId('form-error')
      expect(formError).toHaveTextContent(message)
      expect(formError).toHaveAttribute('role', 'alert')
    },

    expectSubmitDisabled() {
      expect(screen.getByTestId('submit-button')).toBeDisabled()
    },

    expectSubmitEnabled() {
      expect(screen.getByTestId('submit-button')).toBeEnabled()
    },
  }
}

/**
 * Creates a mock async validator with configurable delay and failure conditions
 */
export function createAsyncValidator(config: {
  delayMs?: number
  failValues?: string[]
  failMessage?: string
}): (value: string) => Promise<string | undefined> {
  const { delayMs = 500, failValues = [], failMessage = 'Validation failed' } = config

  return async (value: string): Promise<string | undefined> => {
    await new Promise(resolve => setTimeout(resolve, delayMs))
    if (failValues.includes(value)) {
      return failMessage
    }
    return undefined
  }
}
```

#### 3.2 Form Submission Tests (AC1 & AC2)

```typescript
// packages/web-ui/src/components/forms/__tests__/form-submission.integration.test.tsx

import React, { useState } from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { createFormTestContext } from './test-utils'
import { FormField } from '../FormField'
import { Input } from '../../ui/Input'
import { Select } from '../../ui/Select'
import { Button } from '../../ui/Button'

describe('AC1: Form Submission with Valid Data', () => {
  const ctx = createFormTestContext()
  let mockSubmit: ReturnType<typeof vi.fn>

  beforeEach(() => {
    mockSubmit = vi.fn()
  })

  it('should submit form successfully with all valid required fields', async () => {
    render(<CompleteForm onSubmit={mockSubmit} />)

    await ctx.fillField('name-input', 'John Doe')
    await ctx.fillField('email-input', 'john@example.com')
    await ctx.fillField('age-input', '25')
    await ctx.fillField('description-input', 'Valid description with enough characters')

    await ctx.submitForm()

    await waitFor(() => {
      expect(mockSubmit).toHaveBeenCalledWith({
        name: 'John Doe',
        email: 'john@example.com',
        age: '25',
        description: 'Valid description with enough characters',
      })
    })
  })

  it('should enable submit button when all required fields are valid', async () => {
    render(<CompleteForm onSubmit={mockSubmit} />)

    // Initially disabled
    ctx.expectSubmitDisabled()

    // Fill all required fields with valid data
    await ctx.fillField('name-input', 'Jane Smith')
    await ctx.fillField('email-input', 'jane@example.com')
    await ctx.fillField('age-input', '30')
    await ctx.fillField('description-input', 'Description that meets minimum length')

    // Should now be enabled
    await waitFor(() => {
      ctx.expectSubmitEnabled()
    })
  })

  it('should submit form with Select component selection', async () => {
    render(<FormWithSelect onSubmit={mockSubmit} />)

    await ctx.fillField('name-input', 'Test User')

    // Select an option
    const selectButton = screen.getByTestId('workflow-select')
    await ctx.user.click(selectButton)
    await ctx.user.click(screen.getByTestId('workflow-select-option-feature'))

    await ctx.submitForm()

    await waitFor(() => {
      expect(mockSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Test User',
          workflow: 'feature',
        })
      )
    })
  })

  it('should submit form with Checkbox selection', async () => {
    render(<FormWithCheckbox onSubmit={mockSubmit} />)

    await ctx.fillField('name-input', 'Test User')

    // Check the checkbox
    const checkbox = screen.getByTestId('agree-checkbox')
    await ctx.user.click(checkbox)

    await ctx.submitForm()

    await waitFor(() => {
      expect(mockSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Test User',
          agreed: true,
        })
      )
    })
  })

  it('should submit form with RadioGroup selection', async () => {
    render(<FormWithRadioGroup onSubmit={mockSubmit} />)

    await ctx.fillField('name-input', 'Test User')

    // Select a radio option
    await ctx.user.click(screen.getByTestId('priority-radio-option-high'))

    await ctx.submitForm()

    await waitFor(() => {
      expect(mockSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Test User',
          priority: 'high',
        })
      )
    })
  })

  it('should show loading state during submission', async () => {
    const slowSubmit = vi.fn().mockImplementation(
      () => new Promise(resolve => setTimeout(resolve, 1000))
    )

    render(<CompleteForm onSubmit={slowSubmit} />)

    // Fill with valid data
    await ctx.fillField('name-input', 'John')
    await ctx.fillField('email-input', 'john@example.com')
    await ctx.fillField('age-input', '25')
    await ctx.fillField('description-input', 'Valid description here')

    await ctx.submitForm()

    // Button should show loading state
    expect(screen.getByTestId('submit-button')).toHaveTextContent('Submitting...')
    expect(screen.getByTestId('submit-button')).toBeDisabled()
  })

  it('should reset form after successful submission if configured', async () => {
    render(<CompleteForm onSubmit={mockSubmit} resetOnSubmit />)

    await ctx.fillField('name-input', 'Test User')
    await ctx.fillField('email-input', 'test@example.com')
    await ctx.fillField('age-input', '28')
    await ctx.fillField('description-input', 'Description to reset')

    await ctx.submitForm()

    await waitFor(() => {
      expect(screen.getByTestId('name-input')).toHaveValue('')
      expect(screen.getByTestId('email-input')).toHaveValue('')
      expect(screen.getByTestId('age-input')).toHaveValue('')
      expect(screen.getByTestId('description-input')).toHaveValue('')
    })
  })
})

describe('AC2: Form Submission Prevention with Invalid Data', () => {
  const ctx = createFormTestContext()
  let mockSubmit: ReturnType<typeof vi.fn>

  beforeEach(() => {
    mockSubmit = vi.fn()
  })

  it('should prevent submission when required fields are empty', async () => {
    render(<CompleteForm onSubmit={mockSubmit} />)

    await ctx.submitForm()

    expect(mockSubmit).not.toHaveBeenCalled()
    expect(screen.getByText('Name is required')).toBeInTheDocument()
    expect(screen.getByText('Email is required')).toBeInTheDocument()
  })

  it('should prevent submission with invalid email format', async () => {
    render(<CompleteForm onSubmit={mockSubmit} />)

    await ctx.fillField('name-input', 'Test User')
    await ctx.fillField('email-input', 'not-an-email')
    await ctx.fillField('age-input', '25')
    await ctx.fillField('description-input', 'Valid description here')

    await ctx.submitForm()

    expect(mockSubmit).not.toHaveBeenCalled()
    expect(screen.getByText('Please enter a valid email address')).toBeInTheDocument()
  })

  it('should prevent submission when age is out of range', async () => {
    render(<CompleteForm onSubmit={mockSubmit} />)

    await ctx.fillField('name-input', 'Test User')
    await ctx.fillField('email-input', 'test@example.com')
    await ctx.fillField('age-input', '15') // Below minimum
    await ctx.fillField('description-input', 'Valid description here')

    await ctx.submitForm()

    expect(mockSubmit).not.toHaveBeenCalled()
    expect(screen.getByText('Age must be between 18 and 120')).toBeInTheDocument()
  })

  it('should prevent submission when description is too short', async () => {
    render(<CompleteForm onSubmit={mockSubmit} />)

    await ctx.fillField('name-input', 'Test User')
    await ctx.fillField('email-input', 'test@example.com')
    await ctx.fillField('age-input', '25')
    await ctx.fillField('description-input', 'Short') // Too short

    await ctx.submitForm()

    expect(mockSubmit).not.toHaveBeenCalled()
    expect(screen.getByText('Description must be at least 10 characters')).toBeInTheDocument()
  })

  it('should prevent submission when Select has no selection and is required', async () => {
    render(<FormWithSelect onSubmit={mockSubmit} selectRequired />)

    await ctx.fillField('name-input', 'Test User')
    // Don't select anything

    await ctx.submitForm()

    expect(mockSubmit).not.toHaveBeenCalled()
    expect(screen.getByText('Workflow selection is required')).toBeInTheDocument()
  })

  it('should prevent submission when required Checkbox is not checked', async () => {
    render(<FormWithCheckbox onSubmit={mockSubmit} checkboxRequired />)

    await ctx.fillField('name-input', 'Test User')
    // Don't check the checkbox

    await ctx.submitForm()

    expect(mockSubmit).not.toHaveBeenCalled()
    expect(screen.getByText('You must agree to continue')).toBeInTheDocument()
  })

  it('should prevent submission when required RadioGroup has no selection', async () => {
    render(<FormWithRadioGroup onSubmit={mockSubmit} radioRequired />)

    await ctx.fillField('name-input', 'Test User')
    // Don't select a radio

    await ctx.submitForm()

    expect(mockSubmit).not.toHaveBeenCalled()
    expect(screen.getByText('Priority selection is required')).toBeInTheDocument()
  })

  it('should keep submit button disabled when any field is invalid', async () => {
    render(<CompleteForm onSubmit={mockSubmit} />)

    // Fill some but not all required fields
    await ctx.fillField('name-input', 'Test User')
    await ctx.fillField('email-input', 'test@example.com')
    // Leave age and description empty

    ctx.expectSubmitDisabled()
  })

  it('should display all validation errors simultaneously on submission attempt', async () => {
    render(<CompleteForm onSubmit={mockSubmit} />)

    // Fill with multiple invalid values
    await ctx.fillField('name-input', 'A') // Too short
    await ctx.fillField('email-input', 'bad-email') // Invalid format
    await ctx.fillField('age-input', '10') // Too young
    await ctx.fillField('description-input', 'Short') // Too short

    await ctx.submitForm()

    expect(mockSubmit).not.toHaveBeenCalled()

    // All errors should be visible
    expect(screen.getByText('Name must be at least 2 characters')).toBeInTheDocument()
    expect(screen.getByText('Please enter a valid email address')).toBeInTheDocument()
    expect(screen.getByText('Age must be between 18 and 120')).toBeInTheDocument()
    expect(screen.getByText('Description must be at least 10 characters')).toBeInTheDocument()
  })
})
```

#### 3.3 Field-Level Validation Tests (AC3)

```typescript
// packages/web-ui/src/components/forms/__tests__/form-field-validation.integration.test.tsx

describe('AC3: Field-Level Validation Display', () => {
  const ctx = createFormTestContext()
  let mockSubmit: ReturnType<typeof vi.fn>

  beforeEach(() => {
    mockSubmit = vi.fn()
  })

  describe('Validation on Blur', () => {
    it('should show error when field loses focus with invalid value', async () => {
      render(<CompleteForm onSubmit={mockSubmit} />)

      const nameInput = screen.getByTestId('name-input')
      await ctx.user.click(nameInput)
      await ctx.user.tab() // Blur without entering value

      ctx.expectFieldError('name-field', 'Name is required')
    })

    it('should show error for minimum length on blur', async () => {
      render(<CompleteForm onSubmit={mockSubmit} />)

      await ctx.fillField('name-input', 'A')
      await ctx.blurField('name-input')

      ctx.expectFieldError('name-field', 'Name must be at least 2 characters')
    })

    it('should not show error before field is touched', async () => {
      render(<CompleteForm onSubmit={mockSubmit} />)

      // Field hasn't been interacted with yet
      ctx.expectNoFieldError('name-field')
      ctx.expectNoFieldError('email-field')
      ctx.expectNoFieldError('age-field')
      ctx.expectNoFieldError('description-field')
    })

    it('should clear error when field becomes valid', async () => {
      render(<CompleteForm onSubmit={mockSubmit} />)

      // Trigger error first
      await ctx.blurField('name-input')
      ctx.expectFieldError('name-field', 'Name is required')

      // Fix the error
      await ctx.fillField('name-input', 'Valid Name')

      await waitFor(() => {
        ctx.expectNoFieldError('name-field')
      })
    })
  })

  describe('Validation on Input Change (after touched)', () => {
    it('should validate on each keystroke after field is touched', async () => {
      render(<CompleteForm onSubmit={mockSubmit} />)

      // Touch the field first
      await ctx.blurField('name-input')
      ctx.expectFieldError('name-field', 'Name is required')

      // Type a single character - still invalid
      await ctx.fillField('name-input', 'A')
      ctx.expectFieldError('name-field', 'Name must be at least 2 characters')

      // Type enough characters - becomes valid
      await ctx.fillField('name-input', 'AB')
      await waitFor(() => {
        ctx.expectNoFieldError('name-field')
      })
    })

    it('should show email format error as user types invalid email', async () => {
      render(<CompleteForm onSubmit={mockSubmit} />)

      // Touch the field first
      await ctx.blurField('email-input')
      ctx.expectFieldError('email-field', 'Email is required')

      // Type invalid email format
      await ctx.fillField('email-input', 'not-an-email')
      ctx.expectFieldError('email-field', 'Please enter a valid email address')

      // Complete valid email
      await ctx.fillField('email-input', 'valid@example.com')
      await waitFor(() => {
        ctx.expectNoFieldError('email-field')
      })
    })
  })

  describe('Error Display Location', () => {
    it('should display error within the same FormField container', async () => {
      render(<CompleteForm onSubmit={mockSubmit} />)

      await ctx.blurField('name-input')

      const nameField = screen.getByTestId('name-field')
      expect(nameField).toContainElement(screen.getByText('Name is required'))
    })

    it('should display error with role="alert" for accessibility', async () => {
      render(<CompleteForm onSubmit={mockSubmit} />)

      await ctx.blurField('email-input')

      const errorElement = screen.getByTestId('email-field-error')
      expect(errorElement).toHaveAttribute('role', 'alert')
    })

    it('should hide hint when error is displayed', async () => {
      render(<FormWithHint onSubmit={mockSubmit} />)

      // Initially hint is visible
      expect(screen.getByTestId('email-field-hint')).toBeInTheDocument()

      // Trigger error
      await ctx.blurField('email-input')

      // Hint should be hidden, error should be visible
      expect(screen.queryByTestId('email-field-hint')).not.toBeInTheDocument()
      expect(screen.getByTestId('email-field-error')).toBeInTheDocument()
    })
  })

  describe('Input Visual Error State', () => {
    it('should apply error styling to input when validation fails', async () => {
      render(<CompleteForm onSubmit={mockSubmit} />)

      await ctx.blurField('name-input')

      const input = screen.getByTestId('name-input')
      expect(input).toHaveClass('border-red-500')
    })

    it('should remove error styling when validation passes', async () => {
      render(<CompleteForm onSubmit={mockSubmit} />)

      // Trigger error
      await ctx.blurField('name-input')
      expect(screen.getByTestId('name-input')).toHaveClass('border-red-500')

      // Fix error
      await ctx.fillField('name-input', 'Valid Name')

      await waitFor(() => {
        expect(screen.getByTestId('name-input')).not.toHaveClass('border-red-500')
      })
    })
  })
})
```

#### 3.4 Form-Level Validation Tests (AC4)

```typescript
// packages/web-ui/src/components/forms/__tests__/form-level-validation.integration.test.tsx

describe('AC4: Form-Level Validation', () => {
  const ctx = createFormTestContext()
  let mockSubmit: ReturnType<typeof vi.fn>

  beforeEach(() => {
    mockSubmit = vi.fn()
  })

  describe('Aggregate Validation on Submit', () => {
    it('should mark all fields as touched on submit attempt', async () => {
      render(<CompleteForm onSubmit={mockSubmit} />)

      await ctx.submitForm()

      // All field errors should be visible after submit attempt
      expect(screen.getByText('Name is required')).toBeInTheDocument()
      expect(screen.getByText('Email is required')).toBeInTheDocument()
      expect(screen.getByText('Age is required')).toBeInTheDocument()
      expect(screen.getByText('Description is required')).toBeInTheDocument()
    })

    it('should show form-level error on submission failure', async () => {
      const failingSubmit = vi.fn().mockRejectedValue(new Error('Server error'))
      render(<CompleteForm onSubmit={failingSubmit} />)

      // Fill with valid data
      await ctx.fillField('name-input', 'Test User')
      await ctx.fillField('email-input', 'test@example.com')
      await ctx.fillField('age-input', '25')
      await ctx.fillField('description-input', 'Valid description text')

      await ctx.submitForm()

      await waitFor(() => {
        ctx.expectFormError('Submission failed. Please try again.')
      })
    })

    it('should clear form-level error when user modifies a field', async () => {
      const failingSubmit = vi.fn().mockRejectedValue(new Error('Server error'))
      render(<CompleteForm onSubmit={failingSubmit} />)

      // Fill and fail
      await ctx.fillField('name-input', 'Test User')
      await ctx.fillField('email-input', 'test@example.com')
      await ctx.fillField('age-input', '25')
      await ctx.fillField('description-input', 'Valid description text')
      await ctx.submitForm()

      await waitFor(() => {
        expect(screen.getByTestId('form-error')).toBeInTheDocument()
      })

      // Modify a field
      await ctx.fillField('name-input', 'New Name')

      await waitFor(() => {
        expect(screen.queryByTestId('form-error')).not.toBeInTheDocument()
      })
    })
  })

  describe('Cross-Field Validation', () => {
    it('should validate password confirmation matches password', async () => {
      render(<PasswordForm onSubmit={mockSubmit} />)

      await ctx.fillField('password-input', 'SecurePass123!')
      await ctx.fillField('confirm-password-input', 'DifferentPass123!')

      await ctx.submitForm()

      expect(mockSubmit).not.toHaveBeenCalled()
      expect(screen.getByText('Passwords do not match')).toBeInTheDocument()
    })

    it('should validate date range (end date after start date)', async () => {
      render(<DateRangeForm onSubmit={mockSubmit} />)

      await ctx.fillField('start-date-input', '2025-01-15')
      await ctx.fillField('end-date-input', '2025-01-10') // Before start

      await ctx.submitForm()

      expect(mockSubmit).not.toHaveBeenCalled()
      expect(screen.getByText('End date must be after start date')).toBeInTheDocument()
    })
  })

  describe('Form Validation State', () => {
    it('should track overall form validity', async () => {
      render(<CompleteForm onSubmit={mockSubmit} showFormValidity />)

      // Initially invalid
      expect(screen.getByTestId('form-validity-indicator')).toHaveTextContent('Invalid')

      // Fill all fields correctly
      await ctx.fillField('name-input', 'Test User')
      await ctx.fillField('email-input', 'test@example.com')
      await ctx.fillField('age-input', '25')
      await ctx.fillField('description-input', 'Valid description text')

      await waitFor(() => {
        expect(screen.getByTestId('form-validity-indicator')).toHaveTextContent('Valid')
      })
    })

    it('should update validity when any field becomes invalid', async () => {
      render(<CompleteForm onSubmit={mockSubmit} showFormValidity />)

      // Fill all fields correctly first
      await ctx.fillField('name-input', 'Test User')
      await ctx.fillField('email-input', 'test@example.com')
      await ctx.fillField('age-input', '25')
      await ctx.fillField('description-input', 'Valid description text')

      await waitFor(() => {
        expect(screen.getByTestId('form-validity-indicator')).toHaveTextContent('Valid')
      })

      // Make one field invalid
      await ctx.fillField('email-input', 'invalid')

      await waitFor(() => {
        expect(screen.getByTestId('form-validity-indicator')).toHaveTextContent('Invalid')
      })
    })
  })
})
```

#### 3.5 Required Field Validation Tests (AC5)

```typescript
// packages/web-ui/src/components/forms/__tests__/required-field-validation.integration.test.tsx

describe('AC5: Required Field Validation', () => {
  const ctx = createFormTestContext()
  let mockSubmit: ReturnType<typeof vi.fn>

  beforeEach(() => {
    mockSubmit = vi.fn()
  })

  describe('Required Field Indicators', () => {
    it('should mark required fields with asterisk', () => {
      render(<CompleteForm onSubmit={mockSubmit} />)

      const nameLabel = screen.getByText('Name')
      expect(nameLabel.parentElement).toContainElement(screen.getAllByText('*')[0])
    })

    it('should have aria-required on required input fields', () => {
      render(<CompleteForm onSubmit={mockSubmit} />)

      expect(screen.getByTestId('name-input')).toHaveAttribute('aria-required', 'true')
      expect(screen.getByTestId('email-input')).toHaveAttribute('aria-required', 'true')
    })

    it('should not mark optional fields with asterisk', () => {
      render(<FormWithOptionalFields onSubmit={mockSubmit} />)

      const optionalLabel = screen.getByText('Optional Field')
      expect(optionalLabel.parentElement).not.toContainElement(screen.queryByText('*'))
    })
  })

  describe('Required Field Validation Behavior', () => {
    it('should validate required Input field on blur when empty', async () => {
      render(<CompleteForm onSubmit={mockSubmit} />)

      await ctx.blurField('name-input')
      ctx.expectFieldError('name-field', 'Name is required')
    })

    it('should validate required Select field when no option selected', async () => {
      render(<FormWithSelect onSubmit={mockSubmit} selectRequired />)

      // Submit without selecting
      await ctx.fillField('name-input', 'Test User')
      await ctx.submitForm()

      expect(screen.getByText('Workflow selection is required')).toBeInTheDocument()
    })

    it('should validate required Checkbox field when not checked', async () => {
      render(<FormWithCheckbox onSubmit={mockSubmit} checkboxRequired />)

      await ctx.fillField('name-input', 'Test User')
      await ctx.submitForm()

      expect(screen.getByText('You must agree to continue')).toBeInTheDocument()
    })

    it('should validate required RadioGroup field when no option selected', async () => {
      render(<FormWithRadioGroup onSubmit={mockSubmit} radioRequired />)

      await ctx.fillField('name-input', 'Test User')
      await ctx.submitForm()

      expect(screen.getByText('Priority selection is required')).toBeInTheDocument()
    })

    it('should allow submission when required fields are filled', async () => {
      render(<CompleteForm onSubmit={mockSubmit} />)

      await ctx.fillField('name-input', 'Test User')
      await ctx.fillField('email-input', 'test@example.com')
      await ctx.fillField('age-input', '25')
      await ctx.fillField('description-input', 'Valid description text')

      await ctx.submitForm()

      await waitFor(() => {
        expect(mockSubmit).toHaveBeenCalled()
      })
    })
  })

  describe('Whitespace-Only Values', () => {
    it('should treat whitespace-only as empty for required text fields', async () => {
      render(<CompleteForm onSubmit={mockSubmit} />)

      await ctx.fillField('name-input', '   ') // Spaces only
      await ctx.blurField('name-input')

      ctx.expectFieldError('name-field', 'Name is required')
    })
  })
})
```

#### 3.6 Async Validation Tests (AC6)

```typescript
// packages/web-ui/src/components/forms/__tests__/async-validation.integration.test.tsx

describe('AC6: Async Validation', () => {
  const ctx = createFormTestContext()
  let mockSubmit: ReturnType<typeof vi.fn>

  beforeEach(() => {
    mockSubmit = vi.fn()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('Async Email Validation', () => {
    it('should show loading indicator during async validation', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
      render(<FormWithAsyncEmailValidation onSubmit={mockSubmit} />)

      const emailInput = screen.getByTestId('email-input')
      await user.type(emailInput, 'test@example.com')
      await user.tab() // Blur to trigger validation

      // Should show loading indicator
      expect(screen.getByTestId('email-validating-indicator')).toBeInTheDocument()

      // Advance timers to complete async validation
      await vi.advanceTimersByTimeAsync(600)

      // Loading indicator should disappear
      expect(screen.queryByTestId('email-validating-indicator')).not.toBeInTheDocument()
    })

    it('should show error for email already in use', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
      render(<FormWithAsyncEmailValidation onSubmit={mockSubmit} />)

      const emailInput = screen.getByTestId('email-input')
      await user.type(emailInput, 'taken@example.com')
      await user.tab()

      // Wait for async validation
      await vi.advanceTimersByTimeAsync(600)

      await waitFor(() => {
        expect(screen.getByText('This email is already in use')).toBeInTheDocument()
      })
    })

    it('should clear async validation error when email changes', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
      render(<FormWithAsyncEmailValidation onSubmit={mockSubmit} />)

      const emailInput = screen.getByTestId('email-input')
      await user.type(emailInput, 'taken@example.com')
      await user.tab()

      await vi.advanceTimersByTimeAsync(600)
      expect(screen.getByText('This email is already in use')).toBeInTheDocument()

      // Change the email
      await user.clear(emailInput)
      await user.type(emailInput, 'different@example.com')

      // Error should be cleared
      expect(screen.queryByText('This email is already in use')).not.toBeInTheDocument()
    })
  })

  describe('Async Validation on Submit', () => {
    it('should run async validation on form submit', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
      render(<FormWithAsyncEmailValidation onSubmit={mockSubmit} />)

      // Fill form with taken email
      await user.type(screen.getByTestId('name-input'), 'Test User')
      await user.type(screen.getByTestId('email-input'), 'taken@example.com')
      await user.type(screen.getByTestId('age-input'), '25')
      await user.type(screen.getByTestId('description-input'), 'Valid description text')

      await user.click(screen.getByTestId('submit-button'))

      // Wait for async validation
      await vi.advanceTimersByTimeAsync(600)

      // Should not submit due to async validation failure
      expect(mockSubmit).not.toHaveBeenCalled()
      expect(screen.getByText('This email is already in use')).toBeInTheDocument()
    })

    it('should submit when async validation passes', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
      render(<FormWithAsyncEmailValidation onSubmit={mockSubmit} />)

      await user.type(screen.getByTestId('name-input'), 'Test User')
      await user.type(screen.getByTestId('email-input'), 'available@example.com')
      await user.type(screen.getByTestId('age-input'), '25')
      await user.type(screen.getByTestId('description-input'), 'Valid description text')

      await user.click(screen.getByTestId('submit-button'))
      await vi.advanceTimersByTimeAsync(600)

      await waitFor(() => {
        expect(mockSubmit).toHaveBeenCalled()
      })
    })
  })

  describe('Async Validation Debouncing', () => {
    it('should debounce rapid input changes', async () => {
      const asyncValidator = vi.fn().mockResolvedValue(undefined)
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })

      render(<FormWithDebouncedAsyncValidation onSubmit={mockSubmit} asyncValidator={asyncValidator} />)

      const emailInput = screen.getByTestId('email-input')

      // Type rapidly
      await user.type(emailInput, 't')
      await vi.advanceTimersByTime(100)
      await user.type(emailInput, 'e')
      await vi.advanceTimersByTime(100)
      await user.type(emailInput, 's')
      await vi.advanceTimersByTime(100)
      await user.type(emailInput, 't')

      // Should not have called validator yet (debounce period)
      expect(asyncValidator).not.toHaveBeenCalled()

      // Wait for debounce to complete
      await vi.advanceTimersByTimeAsync(400)

      // Should have called validator only once with final value
      expect(asyncValidator).toHaveBeenCalledTimes(1)
      expect(asyncValidator).toHaveBeenCalledWith('test')
    })
  })

  describe('Async Validation Error States', () => {
    it('should handle async validation network errors gracefully', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
      const failingValidator = vi.fn().mockRejectedValue(new Error('Network error'))

      render(
        <FormWithAsyncEmailValidation
          onSubmit={mockSubmit}
          asyncValidator={failingValidator}
        />
      )

      await user.type(screen.getByTestId('email-input'), 'test@example.com')
      await user.tab()

      await vi.advanceTimersByTimeAsync(600)

      // Should show generic validation error
      expect(screen.getByText('Validation failed. Please try again.')).toBeInTheDocument()
    })

    it('should allow retry after async validation network error', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
      let callCount = 0
      const retryableValidator = vi.fn().mockImplementation(async () => {
        callCount++
        if (callCount === 1) {
          throw new Error('Network error')
        }
        return undefined
      })

      render(
        <FormWithAsyncEmailValidation
          onSubmit={mockSubmit}
          asyncValidator={retryableValidator}
        />
      )

      const emailInput = screen.getByTestId('email-input')
      await user.type(emailInput, 'test@example.com')
      await user.tab()
      await vi.advanceTimersByTimeAsync(600)

      // First attempt failed
      expect(screen.getByText('Validation failed. Please try again.')).toBeInTheDocument()

      // Clear and retype to retry
      await user.clear(emailInput)
      await user.type(emailInput, 'test@example.com')
      await user.tab()
      await vi.advanceTimersByTimeAsync(600)

      // Second attempt should succeed
      expect(screen.queryByText('Validation failed. Please try again.')).not.toBeInTheDocument()
    })
  })
})
```

### 4. CreateTaskDialog Integration Tests

```typescript
// packages/web-ui/src/components/tasks/__tests__/CreateTaskDialog.integration.test.tsx

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CreateTaskDialog } from '../CreateTaskDialog'
import { apiClient } from '@/lib/api-client'

vi.mock('@/lib/api-client', () => ({
  apiClient: {
    createTask: vi.fn(),
  },
}))

describe('CreateTaskDialog Integration Tests', () => {
  const user = userEvent.setup()
  let mockOnClose: ReturnType<typeof vi.fn>
  let mockOnCreated: ReturnType<typeof vi.fn>

  beforeEach(() => {
    vi.clearAllMocks()
    mockOnClose = vi.fn()
    mockOnCreated = vi.fn()
  })

  describe('Form Submission with Valid Data', () => {
    it('should create task with valid description', async () => {
      (apiClient.createTask as ReturnType<typeof vi.fn>).mockResolvedValue({ taskId: 'task-123' })

      render(
        <CreateTaskDialog
          isOpen={true}
          onClose={mockOnClose}
          onCreated={mockOnCreated}
        />
      )

      await user.type(
        screen.getByPlaceholderText('Describe what you want to accomplish...'),
        'Add user authentication feature'
      )

      await user.click(screen.getByRole('button', { name: /create task/i }))

      await waitFor(() => {
        expect(apiClient.createTask).toHaveBeenCalledWith({
          description: 'Add user authentication feature',
          acceptanceCriteria: undefined,
          workflow: 'feature',
          autonomy: 'review-before-commit',
        })
        expect(mockOnCreated).toHaveBeenCalledWith('task-123')
        expect(mockOnClose).toHaveBeenCalled()
      })
    })

    it('should include acceptance criteria when provided', async () => {
      (apiClient.createTask as ReturnType<typeof vi.fn>).mockResolvedValue({ taskId: 'task-456' })

      render(
        <CreateTaskDialog
          isOpen={true}
          onClose={mockOnClose}
          onCreated={mockOnCreated}
        />
      )

      await user.type(
        screen.getByPlaceholderText('Describe what you want to accomplish...'),
        'Fix login bug'
      )

      await user.type(
        screen.getByPlaceholderText('Define when the task is complete...'),
        'Users can successfully log in with valid credentials'
      )

      await user.click(screen.getByRole('button', { name: /create task/i }))

      await waitFor(() => {
        expect(apiClient.createTask).toHaveBeenCalledWith(
          expect.objectContaining({
            acceptanceCriteria: 'Users can successfully log in with valid credentials',
          })
        )
      })
    })
  })

  describe('Form Submission Prevention with Invalid Data', () => {
    it('should prevent submission with empty description', async () => {
      render(
        <CreateTaskDialog
          isOpen={true}
          onClose={mockOnClose}
          onCreated={mockOnCreated}
        />
      )

      // Submit without entering description
      await user.click(screen.getByRole('button', { name: /create task/i }))

      expect(screen.getByText('Task description is required')).toBeInTheDocument()
      expect(apiClient.createTask).not.toHaveBeenCalled()
    })

    it('should disable submit button when description is empty', () => {
      render(
        <CreateTaskDialog
          isOpen={true}
          onClose={mockOnClose}
          onCreated={mockOnCreated}
        />
      )

      expect(screen.getByRole('button', { name: /create task/i })).toBeDisabled()
    })
  })

  describe('Workflow Selection', () => {
    it('should submit with selected workflow', async () => {
      (apiClient.createTask as ReturnType<typeof vi.fn>).mockResolvedValue({ taskId: 'task-789' })

      render(
        <CreateTaskDialog
          isOpen={true}
          onClose={mockOnClose}
          onCreated={mockOnCreated}
        />
      )

      await user.type(
        screen.getByPlaceholderText('Describe what you want to accomplish...'),
        'Refactor authentication module'
      )

      // Select different workflow
      await user.click(screen.getByText('Refactor'))

      await user.click(screen.getByRole('button', { name: /create task/i }))

      await waitFor(() => {
        expect(apiClient.createTask).toHaveBeenCalledWith(
          expect.objectContaining({
            workflow: 'refactor',
          })
        )
      })
    })
  })

  describe('Autonomy Level Selection', () => {
    it('should submit with selected autonomy level', async () => {
      (apiClient.createTask as ReturnType<typeof vi.fn>).mockResolvedValue({ taskId: 'task-aaa' })

      render(
        <CreateTaskDialog
          isOpen={true}
          onClose={mockOnClose}
          onCreated={mockOnCreated}
        />
      )

      await user.type(
        screen.getByPlaceholderText('Describe what you want to accomplish...'),
        'Add unit tests'
      )

      // Select different autonomy level
      await user.click(screen.getByText('Full Autonomy'))

      await user.click(screen.getByRole('button', { name: /create task/i }))

      await waitFor(() => {
        expect(apiClient.createTask).toHaveBeenCalledWith(
          expect.objectContaining({
            autonomy: 'full-auto',
          })
        )
      })
    })
  })

  describe('Error Handling', () => {
    it('should display API error message', async () => {
      (apiClient.createTask as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error('API rate limit exceeded')
      )

      render(
        <CreateTaskDialog
          isOpen={true}
          onClose={mockOnClose}
          onCreated={mockOnCreated}
        />
      )

      await user.type(
        screen.getByPlaceholderText('Describe what you want to accomplish...'),
        'Test error handling'
      )

      await user.click(screen.getByRole('button', { name: /create task/i }))

      await waitFor(() => {
        expect(screen.getByText('API rate limit exceeded')).toBeInTheDocument()
      })

      expect(mockOnCreated).not.toHaveBeenCalled()
      expect(mockOnClose).not.toHaveBeenCalled()
    })

    it('should display generic error for unknown errors', async () => {
      (apiClient.createTask as ReturnType<typeof vi.fn>).mockRejectedValue('Unknown error')

      render(
        <CreateTaskDialog
          isOpen={true}
          onClose={mockOnClose}
          onCreated={mockOnCreated}
        />
      )

      await user.type(
        screen.getByPlaceholderText('Describe what you want to accomplish...'),
        'Test error handling'
      )

      await user.click(screen.getByRole('button', { name: /create task/i }))

      await waitFor(() => {
        expect(screen.getByText('Failed to create task')).toBeInTheDocument()
      })
    })
  })

  describe('Loading State', () => {
    it('should show loading state during submission', async () => {
      (apiClient.createTask as ReturnType<typeof vi.fn>).mockImplementation(
        () => new Promise(resolve => setTimeout(() => resolve({ taskId: 'task-bbb' }), 1000))
      )

      render(
        <CreateTaskDialog
          isOpen={true}
          onClose={mockOnClose}
          onCreated={mockOnCreated}
        />
      )

      await user.type(
        screen.getByPlaceholderText('Describe what you want to accomplish...'),
        'Test loading state'
      )

      await user.click(screen.getByRole('button', { name: /create task/i }))

      expect(screen.getByText('Creating...')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /creating/i })).toBeDisabled()
    })
  })

  describe('Form Reset', () => {
    it('should reset form on successful submission', async () => {
      (apiClient.createTask as ReturnType<typeof vi.fn>).mockResolvedValue({ taskId: 'task-ccc' })

      const { rerender } = render(
        <CreateTaskDialog
          isOpen={true}
          onClose={mockOnClose}
          onCreated={mockOnCreated}
        />
      )

      await user.type(
        screen.getByPlaceholderText('Describe what you want to accomplish...'),
        'Test form reset'
      )

      await user.click(screen.getByRole('button', { name: /create task/i }))

      await waitFor(() => {
        expect(mockOnClose).toHaveBeenCalled()
      })

      // Reopen dialog
      rerender(
        <CreateTaskDialog
          isOpen={true}
          onClose={mockOnClose}
          onCreated={mockOnCreated}
        />
      )

      // Form should be reset
      expect(screen.getByPlaceholderText('Describe what you want to accomplish...')).toHaveValue('')
    })
  })
})
```

### 5. Test Organization Summary

```
packages/web-ui/src/components/forms/__tests__/
├── form-validation.integration.test.tsx        # Enhanced existing tests
├── form-submission.integration.test.tsx        # AC1 & AC2 tests (16 tests)
├── form-field-validation.integration.test.tsx  # AC3 tests (12 tests)
├── form-level-validation.integration.test.tsx  # AC4 tests (8 tests)
├── required-field-validation.integration.test.tsx # AC5 tests (10 tests)
├── async-validation.integration.test.tsx       # AC6 tests (9 tests)
└── test-utils.ts                               # Shared test utilities

packages/web-ui/src/components/tasks/__tests__/
└── CreateTaskDialog.integration.test.tsx       # Dialog-specific tests (12 tests)
```

**Total: ~67 integration tests**

### 6. Implementation Considerations

#### 6.1 Test Fixture Components

Create reusable test form components that implement different validation patterns:

- `CompleteForm`: All field types with standard validation
- `FormWithSelect`: Input + Select component
- `FormWithCheckbox`: Input + required Checkbox
- `FormWithRadioGroup`: Input + RadioGroup
- `FormWithHint`: FormField with hints
- `FormWithOptionalFields`: Mix of required/optional
- `FormWithAsyncEmailValidation`: Async email validation
- `FormWithDebouncedAsyncValidation`: Debounced async validation
- `PasswordForm`: Password + confirmation validation
- `DateRangeForm`: Start/end date cross-field validation

#### 6.2 Testing Patterns

1. **User Event Setup**: Use `userEvent.setup()` for realistic user interactions
2. **Fake Timers**: Use `vi.useFakeTimers()` for async validation tests
3. **Wait For**: Use `waitFor()` for async state updates
4. **Test IDs**: Consistent `data-testid` naming convention
5. **ARIA Testing**: Verify accessibility attributes for errors

#### 6.3 Mock Setup

```typescript
// Mock API client for CreateTaskDialog tests
vi.mock('@/lib/api-client', () => ({
  apiClient: {
    createTask: vi.fn(),
  },
}))
```

## Consequences

### Positive

- Complete coverage of all acceptance criteria
- Comprehensive validation state testing
- Reusable test utilities reduce duplication
- Integration with existing form component architecture
- Accessibility testing ensures ARIA compliance
- Clear test organization by acceptance criteria

### Negative

- Large number of tests may increase CI time
- Test fixtures require maintenance
- Some tests require fake timer management

### Mitigations

- Organize tests by acceptance criteria for easy maintenance
- Share test utilities and fixtures
- Use vitest's concurrent execution for parallelism
- Document timer patterns for async tests

## Implementation Notes for Developer Stage

1. **File Locations**:
   - Create `test-utils.ts` in `packages/web-ui/src/components/forms/__tests__/`
   - Create new test files as outlined above

2. **Dependencies**:
   - `@testing-library/react`
   - `@testing-library/user-event`
   - `@testing-library/jest-dom`
   - `vitest`

3. **Test Fixture Components**:
   - Create in test files or separate fixtures file
   - Follow existing `TestForm` pattern from `form-validation.integration.test.tsx`

4. **Run Tests**:
   ```bash
   npm test --workspace=@apexcli/web-ui
   ```

5. **Coverage Requirements**:
   - All acceptance criteria must have corresponding tests
   - Each test should verify specific behavior
   - Tests should pass independently

## Related ADRs

- ADR-045: Error Recovery Integration Tests for Auto-Save Failures (similar test patterns)
- Existing form-validation.integration.test.tsx (foundation for enhancements)

## Files to Create/Modify

- **CREATE**: `packages/web-ui/src/components/forms/__tests__/test-utils.ts`
- **CREATE**: `packages/web-ui/src/components/forms/__tests__/form-submission.integration.test.tsx`
- **CREATE**: `packages/web-ui/src/components/forms/__tests__/form-field-validation.integration.test.tsx`
- **CREATE**: `packages/web-ui/src/components/forms/__tests__/form-level-validation.integration.test.tsx`
- **CREATE**: `packages/web-ui/src/components/forms/__tests__/required-field-validation.integration.test.tsx`
- **CREATE**: `packages/web-ui/src/components/forms/__tests__/async-validation.integration.test.tsx`
- **CREATE**: `packages/web-ui/src/components/tasks/__tests__/CreateTaskDialog.integration.test.tsx`
- **MODIFY**: `packages/web-ui/src/components/forms/__tests__/form-validation.integration.test.tsx` (enhance existing)
