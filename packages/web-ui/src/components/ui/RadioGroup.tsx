'use client'

import React, { forwardRef, createContext, useContext } from 'react'
import { cn } from '@/lib/utils'

export interface RadioOption {
  value: string
  label: string
  description?: string
  disabled?: boolean
}

export interface RadioGroupProps {
  options: RadioOption[]
  value: string
  onChange: (value: string) => void
  name: string
  disabled?: boolean
  error?: string
  className?: string
  'data-testid'?: string
}

// Context for radio group
interface RadioGroupContextValue {
  name: string
  value: string
  onChange: (value: string) => void
  disabled?: boolean
}

const RadioGroupContext = createContext<RadioGroupContextValue | null>(null)

const useRadioGroup = () => {
  const context = useContext(RadioGroupContext)
  if (!context) {
    throw new Error('Radio components must be used within a RadioGroup')
  }
  return context
}

// Individual Radio component
export interface RadioProps {
  value: string
  label: string
  description?: string
  disabled?: boolean
  className?: string
  'data-testid'?: string
}

const Radio = forwardRef<HTMLInputElement, RadioProps>(
  ({
    value,
    label,
    description,
    disabled: radioDisabled = false,
    className,
    'data-testid': testId,
    ...props
  }, ref) => {
    const { name, value: groupValue, onChange, disabled: groupDisabled } = useRadioGroup()
    const isChecked = groupValue === value
    const isDisabled = groupDisabled || radioDisabled

    const handleChange = () => {
      if (!isDisabled) {
        onChange(value)
      }
    }

    const handleKeyDown = (event: React.KeyboardEvent) => {
      if (event.key === ' ') {
        event.preventDefault()
        handleChange()
      }
    }

    return (
      <div className={cn('flex items-start space-x-3', className)}>
        <div className="relative">
          <input
            ref={ref}
            type="radio"
            name={name}
            value={value}
            checked={isChecked}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            disabled={isDisabled}
            data-testid={testId}
            className={cn(
              'peer h-4 w-4 rounded-full border border-input bg-background',
              'focus:outline-none focus:ring-2 focus:ring-apex-500 focus:ring-offset-2 focus:ring-offset-background',
              'checked:bg-primary checked:border-primary',
              'disabled:cursor-not-allowed disabled:opacity-50',
              'sr-only' // Hide native radio, use custom styling
            )}
            {...props}
          />

          {/* Custom radio visual */}
          <div
            className={cn(
              'absolute inset-0 flex h-4 w-4 items-center justify-center rounded-full border border-input bg-background',
              'peer-focus:ring-2 peer-focus:ring-apex-500 peer-focus:ring-offset-2 peer-focus:ring-offset-background',
              'peer-checked:bg-primary peer-checked:border-primary',
              'peer-disabled:cursor-not-allowed peer-disabled:opacity-50',
              'transition-colors duration-200',
              isDisabled ? 'cursor-not-allowed' : 'cursor-pointer'
            )}
            onClick={handleChange}
            role="presentation"
          >
            {/* Radio dot */}
            {isChecked && (
              <div className="h-2 w-2 rounded-full bg-primary-foreground" />
            )}
          </div>
        </div>

        <div className="flex-1">
          <label
            htmlFor={testId}
            onClick={handleChange}
            className={cn(
              'text-sm font-medium leading-none',
              isDisabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer',
              'select-none'
            )}
          >
            {label}
          </label>

          {description && (
            <p className="mt-1 text-sm text-muted-foreground">
              {description}
            </p>
          )}
        </div>
      </div>
    )
  }
)

Radio.displayName = 'Radio'

// Main RadioGroup component
const RadioGroup = forwardRef<HTMLDivElement, RadioGroupProps>(
  ({
    options,
    value,
    onChange,
    name,
    disabled = false,
    error,
    className,
    'data-testid': testId,
    ...props
  }, ref) => {
    const contextValue: RadioGroupContextValue = {
      name,
      value,
      onChange,
      disabled,
    }

    const handleKeyDown = (event: React.KeyboardEvent) => {
      const currentIndex = options.findIndex(option => option.value === value)
      let nextIndex = currentIndex

      switch (event.key) {
        case 'ArrowDown':
        case 'ArrowRight':
          event.preventDefault()
          do {
            nextIndex = (nextIndex + 1) % options.length
          } while (options[nextIndex]?.disabled && nextIndex !== currentIndex)
          break
        case 'ArrowUp':
        case 'ArrowLeft':
          event.preventDefault()
          do {
            nextIndex = (nextIndex - 1 + options.length) % options.length
          } while (options[nextIndex]?.disabled && nextIndex !== currentIndex)
          break
        default:
          return
      }

      if (nextIndex !== currentIndex && !options[nextIndex]?.disabled) {
        onChange(options[nextIndex].value)
      }
    }

    return (
      <RadioGroupContext.Provider value={contextValue}>
        <div
          ref={ref}
          role="radiogroup"
          onKeyDown={handleKeyDown}
          aria-invalid={error ? 'true' : 'false'}
          aria-describedby={error ? `${testId}-error` : undefined}
          data-testid={testId}
          className={cn('space-y-3', className)}
          {...props}
        >
          {options.map((option) => (
            <Radio
              key={option.value}
              value={option.value}
              label={option.label}
              description={option.description}
              disabled={option.disabled}
              data-testid={`${testId}-option-${option.value}`}
            />
          ))}

          {error && (
            <p
              id={`${testId}-error`}
              className="mt-2 text-sm text-red-600"
              role="alert"
            >
              {error}
            </p>
          )}
        </div>
      </RadioGroupContext.Provider>
    )
  }
)

RadioGroup.displayName = 'RadioGroup'

export { RadioGroup, Radio }