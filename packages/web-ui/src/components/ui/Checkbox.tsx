'use client'

import React, { forwardRef, useEffect, useRef } from 'react'
import { cn } from '@/lib/utils'

export interface CheckboxProps {
  checked: boolean
  onChange: (checked: boolean) => void
  label: string
  disabled?: boolean
  indeterminate?: boolean
  error?: string
  className?: string
  'data-testid'?: string
}

const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(
  ({
    checked,
    onChange,
    label,
    disabled = false,
    indeterminate = false,
    error,
    className,
    'data-testid': testId,
    ...props
  }, ref) => {
    const inputRef = useRef<HTMLInputElement>(null)

    // Handle indeterminate state
    useEffect(() => {
      const input = inputRef.current || (ref as React.MutableRefObject<HTMLInputElement>)?.current
      if (input) {
        input.indeterminate = indeterminate
      }
    }, [indeterminate, ref])

    const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
      if (!disabled) {
        onChange(event.target.checked)
      }
    }

    const handleKeyDown = (event: React.KeyboardEvent) => {
      if (event.key === ' ') {
        event.preventDefault()
        if (!disabled) {
          onChange(!checked)
        }
      }
    }

    const handleLabelClick = () => {
      if (!disabled) {
        onChange(!checked)
      }
    }

    return (
      <div className={cn('flex items-start space-x-3', className)}>
        <div className="relative">
          <input
            ref={ref || inputRef}
            type="checkbox"
            checked={checked}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            disabled={disabled}
            aria-invalid={error ? 'true' : 'false'}
            aria-describedby={error ? `${testId}-error` : undefined}
            data-testid={testId}
            className={cn(
              'peer h-4 w-4 rounded border border-input bg-background',
              'focus:outline-none focus:ring-2 focus:ring-apex-500 focus:ring-offset-2 focus:ring-offset-background',
              'checked:bg-primary checked:border-primary',
              'disabled:cursor-not-allowed disabled:opacity-50',
              'sr-only' // Hide native checkbox, use custom styling
            )}
            {...props}
          />

          {/* Custom checkbox visual */}
          <div
            className={cn(
              'absolute inset-0 flex h-4 w-4 items-center justify-center rounded border border-input bg-background',
              'peer-focus:ring-2 peer-focus:ring-apex-500 peer-focus:ring-offset-2 peer-focus:ring-offset-background',
              'peer-checked:bg-primary peer-checked:border-primary peer-checked:text-primary-foreground',
              'peer-disabled:cursor-not-allowed peer-disabled:opacity-50',
              'transition-colors duration-200',
              error && 'border-red-500 peer-focus:ring-red-500',
              disabled ? 'cursor-not-allowed' : 'cursor-pointer'
            )}
            onClick={handleLabelClick}
            role="presentation"
          >
            {/* Checkmark or indeterminate indicator */}
            {indeterminate ? (
              <svg
                className="h-3 w-3"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M3 10a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z"
                  clipRule="evenodd"
                />
              </svg>
            ) : checked ? (
              <svg
                className="h-3 w-3"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                  clipRule="evenodd"
                />
              </svg>
            ) : null}
          </div>
        </div>

        <div className="flex-1">
          <label
            htmlFor={testId}
            onClick={handleLabelClick}
            className={cn(
              'text-sm font-medium leading-none',
              disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer',
              'select-none'
            )}
          >
            {label}
          </label>

          {error && (
            <p
              id={`${testId}-error`}
              className="mt-1 text-sm text-red-600"
              role="alert"
            >
              {error}
            </p>
          )}
        </div>
      </div>
    )
  }
)

Checkbox.displayName = 'Checkbox'

export { Checkbox }