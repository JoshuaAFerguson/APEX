import React, { useState } from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { FormField } from '../FormField'
import { Input } from '../../ui/Input'
import { Button } from '../../ui/Button'

// Test form component with comprehensive validation
interface FormData {
  name: string
  email: string
  age: string
  description: string
}

interface FormErrors {
  name?: string
  email?: string
  age?: string
  description?: string
  form?: string
}

const TestForm: React.FC<{
  onSubmit?: (data: FormData) => Promise<void> | void
  enableAsyncValidation?: boolean
  initialData?: Partial<FormData>
}> = ({ onSubmit, enableAsyncValidation = false, initialData = {} }) => {
  const [formData, setFormData] = useState<FormData>({
    name: '',
    email: '',
    age: '',
    description: '',
    ...initialData,
  })

  const [errors, setErrors] = useState<FormErrors>({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [touchedFields, setTouchedFields] = useState<Set<keyof FormData>>(new Set())

  // Validation functions
  const validateName = (name: string): string | undefined => {
    if (!name.trim()) return 'Name is required'
    if (name.length < 2) return 'Name must be at least 2 characters'
    return undefined
  }

  const validateEmail = (email: string): string | undefined => {
    if (!email.trim()) return 'Email is required'
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) return 'Please enter a valid email address'
    return undefined
  }

  const validateAge = (age: string): string | undefined => {
    if (!age.trim()) return 'Age is required'
    const ageNum = parseInt(age, 10)
    if (isNaN(ageNum)) return 'Age must be a number'
    if (ageNum < 18 || ageNum > 120) return 'Age must be between 18 and 120'
    return undefined
  }

  const validateDescription = (description: string): string | undefined => {
    if (!description.trim()) return 'Description is required'
    if (description.length < 10) return 'Description must be at least 10 characters'
    return undefined
  }

  // Async email validation (simulates checking if email exists)
  const validateEmailAsync = async (email: string): Promise<string | undefined> => {
    if (!enableAsyncValidation) return undefined

    // Simulate API call delay
    await new Promise(resolve => setTimeout(resolve, 500))

    // Simulate email already exists error for specific emails
    if (email === 'taken@example.com') {
      return 'This email is already in use'
    }

    return undefined
  }

  // Handle field changes and validation
  const handleFieldChange = async (field: keyof FormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))

    // Clear previous errors for this field
    setErrors(prev => ({ ...prev, [field]: undefined, form: undefined }))

    // Validate field immediately after change (if field has been touched)
    if (touchedFields.has(field)) {
      let error: string | undefined

      switch (field) {
        case 'name':
          error = validateName(value)
          break
        case 'email':
          error = validateEmail(value)
          // Also run async validation for email
          if (!error && enableAsyncValidation) {
            try {
              const asyncError = await validateEmailAsync(value)
              if (asyncError) {
                setErrors(prev => ({ ...prev, email: asyncError }))
              }
            } catch (err) {
              // Handle async validation errors silently
            }
          }
          break
        case 'age':
          error = validateAge(value)
          break
        case 'description':
          error = validateDescription(value)
          break
      }

      if (error) {
        setErrors(prev => ({ ...prev, [field]: error }))
      }
    }
  }

  // Handle field blur (mark as touched)
  const handleFieldBlur = (field: keyof FormData) => {
    setTouchedFields(prev => new Set([...prev, field]))

    // Validate field on blur
    let error: string | undefined
    const value = formData[field]

    switch (field) {
      case 'name':
        error = validateName(value)
        break
      case 'email':
        error = validateEmail(value)
        break
      case 'age':
        error = validateAge(value)
        break
      case 'description':
        error = validateDescription(value)
        break
    }

    if (error) {
      setErrors(prev => ({ ...prev, [field]: error }))
    }
  }

  // Validate entire form
  const validateForm = (): FormErrors => {
    const newErrors: FormErrors = {}

    const nameError = validateName(formData.name)
    if (nameError) newErrors.name = nameError

    const emailError = validateEmail(formData.email)
    if (emailError) newErrors.email = emailError

    const ageError = validateAge(formData.age)
    if (ageError) newErrors.age = ageError

    const descriptionError = validateDescription(formData.description)
    if (descriptionError) newErrors.description = descriptionError

    return newErrors
  }

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // Mark all fields as touched
    setTouchedFields(new Set(['name', 'email', 'age', 'description']))

    // Validate form
    const formErrors = validateForm()

    // Run async validation for email if enabled
    if (enableAsyncValidation && !formErrors.email) {
      try {
        const asyncEmailError = await validateEmailAsync(formData.email)
        if (asyncEmailError) {
          formErrors.email = asyncEmailError
        }
      } catch (err) {
        formErrors.form = 'Validation failed. Please try again.'
      }
    }

    if (Object.keys(formErrors).length > 0) {
      setErrors(formErrors)
      return
    }

    // Clear any previous errors
    setErrors({})

    if (!onSubmit) return

    setIsSubmitting(true)

    try {
      await onSubmit(formData)
    } catch (error) {
      setErrors({ form: 'Submission failed. Please try again.' })
    } finally {
      setIsSubmitting(false)
    }
  }

  const isFormValid = Object.keys(validateForm()).length === 0

  return (
    <form onSubmit={handleSubmit} data-testid="test-form">
      <FormField
        label="Name"
        required
        error={errors.name}
        data-testid="name-field"
      >
        <Input
          data-testid="name-input"
          value={formData.name}
          onChange={(e) => handleFieldChange('name', e.target.value)}
          onBlur={() => handleFieldBlur('name')}
          error={!!errors.name}
          placeholder="Enter your name"
        />
      </FormField>

      <FormField
        label="Email"
        required
        error={errors.email}
        data-testid="email-field"
      >
        <Input
          data-testid="email-input"
          type="email"
          value={formData.email}
          onChange={(e) => handleFieldChange('email', e.target.value)}
          onBlur={() => handleFieldBlur('email')}
          error={!!errors.email}
          placeholder="Enter your email"
        />
      </FormField>

      <FormField
        label="Age"
        required
        error={errors.age}
        data-testid="age-field"
      >
        <Input
          data-testid="age-input"
          type="number"
          value={formData.age}
          onChange={(e) => handleFieldChange('age', e.target.value)}
          onBlur={() => handleFieldBlur('age')}
          error={!!errors.age}
          placeholder="Enter your age"
          min="18"
          max="120"
        />
      </FormField>

      <FormField
        label="Description"
        required
        error={errors.description}
        data-testid="description-field"
      >
        <Input
          data-testid="description-input"
          value={formData.description}
          onChange={(e) => handleFieldChange('description', e.target.value)}
          onBlur={() => handleFieldBlur('description')}
          error={!!errors.description}
          placeholder="Enter a description"
        />
      </FormField>

      {errors.form && (
        <div
          className="text-red-600 text-sm mt-2"
          role="alert"
          data-testid="form-error"
        >
          {errors.form}
        </div>
      )}

      <div className="mt-6">
        <Button
          type="submit"
          loading={isSubmitting}
          disabled={!isFormValid || isSubmitting}
          data-testid="submit-button"
        >
          {isSubmitting ? 'Submitting...' : 'Submit'}
        </Button>
      </div>
    </form>
  )
}

describe('Form Validation Integration Tests', () => {
  const user = userEvent.setup()
  let mockSubmit: ReturnType<typeof vi.fn>

  beforeEach(() => {
    mockSubmit = vi.fn()
  })

  describe('Form submission with valid data', () => {
    it('should successfully submit form with all valid data', async () => {
      render(<TestForm onSubmit={mockSubmit} />)

      // Fill in all fields with valid data
      await user.type(screen.getByTestId('name-input'), 'John Doe')
      await user.type(screen.getByTestId('email-input'), 'john@example.com')
      await user.type(screen.getByTestId('age-input'), '25')
      await user.type(screen.getByTestId('description-input'), 'This is a test description that meets requirements')

      // Submit form
      await user.click(screen.getByTestId('submit-button'))

      // Verify submission was called with correct data
      await waitFor(() => {
        expect(mockSubmit).toHaveBeenCalledWith({
          name: 'John Doe',
          email: 'john@example.com',
          age: '25',
          description: 'This is a test description that meets requirements',
        })
      })
    })

    it('should enable submit button when all fields are valid', async () => {
      render(<TestForm onSubmit={mockSubmit} />)

      const submitButton = screen.getByTestId('submit-button')

      // Initially disabled
      expect(submitButton).toBeDisabled()

      // Fill in valid data
      await user.type(screen.getByTestId('name-input'), 'Jane Smith')
      await user.type(screen.getByTestId('email-input'), 'jane@example.com')
      await user.type(screen.getByTestId('age-input'), '30')
      await user.type(screen.getByTestId('description-input'), 'Valid description for testing purposes')

      // Should be enabled after all fields are filled correctly
      await waitFor(() => {
        expect(submitButton).toBeEnabled()
      })
    })
  })

  describe('Form submission prevention with invalid data', () => {
    it('should prevent submission with empty required fields', async () => {
      render(<TestForm onSubmit={mockSubmit} />)

      // Try to submit empty form
      await user.click(screen.getByTestId('submit-button'))

      // Should not call submit function
      expect(mockSubmit).not.toHaveBeenCalled()

      // Should show validation errors
      expect(screen.getByText('Name is required')).toBeInTheDocument()
      expect(screen.getByText('Email is required')).toBeInTheDocument()
      expect(screen.getByText('Age is required')).toBeInTheDocument()
      expect(screen.getByText('Description is required')).toBeInTheDocument()
    })

    it('should prevent submission with invalid email format', async () => {
      render(<TestForm onSubmit={mockSubmit} />)

      await user.type(screen.getByTestId('name-input'), 'Test User')
      await user.type(screen.getByTestId('email-input'), 'invalid-email')
      await user.type(screen.getByTestId('age-input'), '25')
      await user.type(screen.getByTestId('description-input'), 'Valid description for testing')

      await user.click(screen.getByTestId('submit-button'))

      expect(mockSubmit).not.toHaveBeenCalled()
      expect(screen.getByText('Please enter a valid email address')).toBeInTheDocument()
    })
  })

  describe('Field-level validation display', () => {
    it('should show field validation errors on blur', async () => {
      render(<TestForm onSubmit={mockSubmit} />)

      const nameInput = screen.getByTestId('name-input')

      // Focus and blur without entering anything
      await user.click(nameInput)
      await user.tab()

      expect(screen.getByText('Name is required')).toBeInTheDocument()
      expect(screen.getByTestId('name-field')).toContainElement(
        screen.getByText('Name is required')
      )
    })

    it('should clear validation errors when field becomes valid', async () => {
      render(<TestForm onSubmit={mockSubmit} />)

      const nameInput = screen.getByTestId('name-input')

      // Trigger error
      await user.click(nameInput)
      await user.tab()
      expect(screen.getByText('Name is required')).toBeInTheDocument()

      // Fix the error
      await user.click(nameInput)
      await user.type(nameInput, 'Valid Name')

      await waitFor(() => {
        expect(screen.queryByText('Name is required')).not.toBeInTheDocument()
      })
    })
  })

  describe('Form-level validation', () => {
    it('should show form-level error on submission failure', async () => {
      const failingSubmit = vi.fn().mockRejectedValue(new Error('Server error'))

      render(<TestForm onSubmit={failingSubmit} />)

      // Fill with valid data
      await user.type(screen.getByTestId('name-input'), 'Test User')
      await user.type(screen.getByTestId('email-input'), 'test@example.com')
      await user.type(screen.getByTestId('age-input'), '25')
      await user.type(screen.getByTestId('description-input'), 'Valid description for testing purposes')

      await user.click(screen.getByTestId('submit-button'))

      await waitFor(() => {
        expect(screen.getByTestId('form-error')).toHaveTextContent('Submission failed. Please try again.')
      })
    })
  })

  describe('Required field validation', () => {
    it('should mark required fields with asterisk', () => {
      render(<TestForm onSubmit={mockSubmit} />)

      // All fields should be marked as required
      expect(screen.getAllByText('*')).toHaveLength(4)
    })

    it('should validate specific field requirements', async () => {
      render(<TestForm onSubmit={mockSubmit} />)

      // Test name length requirement
      const nameInput = screen.getByTestId('name-input')
      await user.click(nameInput)
      await user.type(nameInput, 'A')
      await user.tab()

      expect(screen.getByText('Name must be at least 2 characters')).toBeInTheDocument()

      // Test age range requirement
      const ageInput = screen.getByTestId('age-input')
      await user.click(ageInput)
      await user.type(ageInput, '15')
      await user.tab()

      expect(screen.getByText('Age must be between 18 and 120')).toBeInTheDocument()
    })
  })

  describe('Async validation', () => {
    it('should perform async email validation', async () => {
      render(<TestForm onSubmit={mockSubmit} enableAsyncValidation />)

      const emailInput = screen.getByTestId('email-input')

      // Type an email that should fail async validation
      await user.click(emailInput)
      await user.type(emailInput, 'taken@example.com')
      await user.tab()

      // Wait for async validation
      await waitFor(() => {
        expect(screen.getByText('This email is already in use')).toBeInTheDocument()
      }, { timeout: 1000 })
    })

    it('should prevent submission when async validation fails', async () => {
      render(<TestForm onSubmit={mockSubmit} enableAsyncValidation />)

      // Fill form with data that will fail async validation
      await user.type(screen.getByTestId('name-input'), 'Test User')
      await user.type(screen.getByTestId('email-input'), 'taken@example.com')
      await user.type(screen.getByTestId('age-input'), '25')
      await user.type(screen.getByTestId('description-input'), 'Valid description for testing')

      await user.click(screen.getByTestId('submit-button'))

      // Should not call submit due to async validation failure
      await waitFor(() => {
        expect(screen.getByText('This email is already in use')).toBeInTheDocument()
      })

      expect(mockSubmit).not.toHaveBeenCalled()
    })
  })
})