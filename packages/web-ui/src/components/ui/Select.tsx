'use client'

import React, { useState, useRef, useEffect, forwardRef } from 'react'
import { cn } from '@/lib/utils'
import { ChevronDown } from 'lucide-react'

export interface SelectOption {
  value: string
  label: string
  description?: string
  disabled?: boolean
}

export interface SelectProps {
  options: SelectOption[]
  value: string
  onChange: (value: string) => void
  placeholder?: string
  disabled?: boolean
  error?: string
  className?: string
  'data-testid'?: string
}

const Select = forwardRef<HTMLButtonElement, SelectProps>(
  ({
    options,
    value,
    onChange,
    placeholder = 'Select an option...',
    disabled = false,
    error,
    className,
    'data-testid': testId,
    ...props
  }, ref) => {
    const [isOpen, setIsOpen] = useState(false)
    const [focusedIndex, setFocusedIndex] = useState(-1)
    const containerRef = useRef<HTMLDivElement>(null)
    const optionsRef = useRef<HTMLDivElement>(null)

    // Find selected option
    const selectedOption = options.find(option => option.value === value)

    // Close dropdown when clicking outside
    useEffect(() => {
      const handleClickOutside = (event: MouseEvent) => {
        if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
          setIsOpen(false)
          setFocusedIndex(-1)
        }
      }

      if (isOpen) {
        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
      }
    }, [isOpen])

    // Handle keyboard navigation
    const handleKeyDown = (event: React.KeyboardEvent) => {
      if (disabled) return

      switch (event.key) {
        case 'Enter':
        case ' ':
          event.preventDefault()
          if (!isOpen) {
            setIsOpen(true)
            setFocusedIndex(0)
          } else if (focusedIndex >= 0) {
            const option = options[focusedIndex]
            if (!option.disabled) {
              onChange(option.value)
              setIsOpen(false)
              setFocusedIndex(-1)
            }
          }
          break
        case 'Escape':
          setIsOpen(false)
          setFocusedIndex(-1)
          break
        case 'ArrowDown':
          event.preventDefault()
          if (!isOpen) {
            setIsOpen(true)
            setFocusedIndex(0)
          } else {
            const nextIndex = Math.min(options.length - 1, focusedIndex + 1)
            setFocusedIndex(nextIndex)
          }
          break
        case 'ArrowUp':
          event.preventDefault()
          if (isOpen) {
            const prevIndex = Math.max(0, focusedIndex - 1)
            setFocusedIndex(prevIndex)
          }
          break
        case 'Tab':
          setIsOpen(false)
          setFocusedIndex(-1)
          break
      }
    }

    const handleOptionClick = (option: SelectOption) => {
      if (!option.disabled) {
        onChange(option.value)
        setIsOpen(false)
        setFocusedIndex(-1)
      }
    }

    const toggleDropdown = () => {
      if (!disabled) {
        setIsOpen(!isOpen)
        if (!isOpen) {
          setFocusedIndex(0)
        } else {
          setFocusedIndex(-1)
        }
      }
    }

    return (
      <div ref={containerRef} className={cn('relative', className)}>
        <button
          ref={ref}
          type="button"
          onClick={toggleDropdown}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          data-testid={testId}
          aria-haspopup="listbox"
          aria-expanded={isOpen}
          aria-invalid={error ? 'true' : 'false'}
          aria-describedby={error ? `${testId}-error` : undefined}
          className={cn(
            'flex w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm',
            'focus:outline-none focus:ring-2 focus:ring-apex-500 focus:ring-offset-2 focus:ring-offset-background',
            'disabled:cursor-not-allowed disabled:opacity-50',
            error && 'border-red-500 focus:ring-red-500',
            className
          )}
          {...props}
        >
          <span className={cn('block truncate', !selectedOption && 'text-muted-foreground')}>
            {selectedOption ? selectedOption.label : placeholder}
          </span>
          <ChevronDown
            className={cn(
              'ml-2 h-4 w-4 shrink-0 transition-transform duration-200',
              isOpen && 'rotate-180'
            )}
          />
        </button>

        {/* Error message */}
        {error && (
          <p
            id={`${testId}-error`}
            className="mt-1 text-sm text-red-600"
            role="alert"
          >
            {error}
          </p>
        )}

        {/* Dropdown */}
        {isOpen && (
          <div
            ref={optionsRef}
            role="listbox"
            aria-label="Options"
            className={cn(
              'absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-md border',
              'bg-popover shadow-md animate-in fade-in-0 zoom-in-95'
            )}
          >
            {options.map((option, index) => (
              <div
                key={option.value}
                role="option"
                aria-selected={option.value === value}
                aria-disabled={option.disabled}
                onClick={() => handleOptionClick(option)}
                className={cn(
                  'relative cursor-pointer select-none py-2 pl-3 pr-9 text-sm',
                  'hover:bg-accent hover:text-accent-foreground',
                  'focus:bg-accent focus:text-accent-foreground',
                  option.disabled && 'cursor-not-allowed opacity-50',
                  index === focusedIndex && 'bg-accent text-accent-foreground',
                  option.value === value && 'bg-primary/10 font-medium'
                )}
                data-testid={`${testId}-option-${option.value}`}
              >
                <div className="flex flex-col">
                  <span className="block truncate">{option.label}</span>
                  {option.description && (
                    <span className="text-xs text-muted-foreground">
                      {option.description}
                    </span>
                  )}
                </div>

                {/* Selected indicator */}
                {option.value === value && (
                  <span className="absolute inset-y-0 right-0 flex items-center pr-4">
                    <svg
                      className="h-4 w-4"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fillRule="evenodd"
                        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </span>
                )}
              </div>
            ))}

            {options.length === 0 && (
              <div className="py-2 px-3 text-sm text-muted-foreground">
                No options available
              </div>
            )}
          </div>
        )}
      </div>
    )
  }
)

Select.displayName = 'Select'

export { Select }