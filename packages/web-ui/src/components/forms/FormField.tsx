'use client'

import React, { forwardRef } from 'react'
import { cn } from '@/lib/utils'

export interface FormFieldProps {
  label: string
  required?: boolean
  error?: string
  hint?: string
  children: React.ReactNode
  className?: string
  'data-testid'?: string
}

const FormField = forwardRef<HTMLDivElement, FormFieldProps>(
  ({
    label,
    required = false,
    error,
    hint,
    children,
    className,
    'data-testid': testId,
    ...props
  }, ref) => {
    return (
      <div
        ref={ref}
        className={cn('space-y-2', className)}
        data-testid={testId}
        {...props}
      >
        <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
          {label}
          {required && (
            <span className="ml-1 text-red-500" aria-label="Required">
              *
            </span>
          )}
        </label>

        <div className="relative">
          {children}
        </div>

        {(hint || error) && (
          <div className="space-y-1">
            {error && (
              <p
                className="text-sm text-red-600"
                role="alert"
                data-testid={`${testId}-error`}
              >
                {error}
              </p>
            )}

            {hint && !error && (
              <p
                className="text-sm text-muted-foreground"
                data-testid={`${testId}-hint`}
              >
                {hint}
              </p>
            )}
          </div>
        )}
      </div>
    )
  }
)

FormField.displayName = 'FormField'

export { FormField }