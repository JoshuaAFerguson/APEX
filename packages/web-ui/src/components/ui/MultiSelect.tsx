'use client'

import React, { useState, useRef, useEffect, forwardRef } from 'react'
import { cn } from '@/lib/utils'
import { ChevronDown, X } from 'lucide-react'

export interface MultiSelectOption {
  value: string
  label: string
  disabled?: boolean
}

export interface MultiSelectProps {
  options: MultiSelectOption[]
  value: string[]
  onChange: (values: string[]) => void
  placeholder?: string
  disabled?: boolean
  error?: string
  maxSelections?: number
  className?: string
  'data-testid'?: string
}

const MultiSelect = forwardRef<HTMLButtonElement, MultiSelectProps>(
  ({
    options,
    value,
    onChange,
    placeholder = 'Select options...',
    disabled = false,
    error,
    maxSelections,
    className,
    'data-testid': testId,
    ...props
  }, ref) => {
    const [isOpen, setIsOpen] = useState(false)
    const [searchTerm, setSearchTerm] = useState('')
    const containerRef = useRef<HTMLDivElement>(null)
    const searchInputRef = useRef<HTMLInputElement>(null)

    // Filter options based on search term
    const filteredOptions = options.filter(option =>
      option.label.toLowerCase().includes(searchTerm.toLowerCase())
    )

    // Get selected options
    const selectedOptions = options.filter(option => value.includes(option.value))

    // Close dropdown when clicking outside
    useEffect(() => {
      const handleClickOutside = (event: MouseEvent) => {
        if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
          setIsOpen(false)
          setSearchTerm('')
        }
      }

      if (isOpen) {
        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
      }
    }, [isOpen])

    // Focus search input when dropdown opens
    useEffect(() => {
      if (isOpen && searchInputRef.current) {
        searchInputRef.current.focus()
      }
    }, [isOpen])

    const handleToggleOption = (optionValue: string) => {
      if (disabled) return

      const option = options.find(opt => opt.value === optionValue)
      if (option?.disabled) return

      const isSelected = value.includes(optionValue)

      if (isSelected) {
        // Remove option
        onChange(value.filter(v => v !== optionValue))
      } else {
        // Add option if not at max
        if (!maxSelections || value.length < maxSelections) {
          onChange([...value, optionValue])
        }
      }
    }

    const handleRemoveOption = (optionValue: string, event: React.MouseEvent) => {
      event.preventDefault()
      event.stopPropagation()
      onChange(value.filter(v => v !== optionValue))
    }

    const handleSelectAll = () => {
      const selectableOptions = options.filter(opt => !opt.disabled)
      const allValues = selectableOptions.map(opt => opt.value)
      onChange(allValues)
    }

    const handleClearAll = () => {
      onChange([])
    }

    const toggleDropdown = () => {
      if (!disabled) {
        setIsOpen(!isOpen)
        if (!isOpen) {
          setSearchTerm('')
        }
      }
    }

    const handleKeyDown = (event: React.KeyboardEvent) => {
      if (disabled) return

      switch (event.key) {
        case 'Enter':
        case ' ':
          if (event.target === event.currentTarget) {
            event.preventDefault()
            toggleDropdown()
          }
          break
        case 'Escape':
          setIsOpen(false)
          setSearchTerm('')
          break
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
            'flex min-h-[40px] w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm',
            'focus:outline-none focus:ring-2 focus:ring-apex-500 focus:ring-offset-2 focus:ring-offset-background',
            'disabled:cursor-not-allowed disabled:opacity-50',
            error && 'border-red-500 focus:ring-red-500',
            className
          )}
          {...props}
        >
          <div className="flex flex-wrap gap-1 flex-1 min-w-0">
            {selectedOptions.length > 0 ? (
              selectedOptions.map((option) => (
                <span
                  key={option.value}
                  className="inline-flex items-center gap-1 rounded bg-primary/10 px-2 py-1 text-xs font-medium"
                  data-testid={`${testId}-selected-${option.value}`}
                >
                  {option.label}
                  <button
                    type="button"
                    onClick={(e) => handleRemoveOption(option.value, e)}
                    className="inline-flex items-center justify-center rounded-full hover:bg-primary/20"
                    aria-label={`Remove ${option.label}`}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))
            ) : (
              <span className="text-muted-foreground">{placeholder}</span>
            )}
          </div>
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
            role="listbox"
            aria-label="Options"
            aria-multiselectable="true"
            className={cn(
              'absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-md border',
              'bg-popover shadow-md animate-in fade-in-0 zoom-in-95'
            )}
          >
            {/* Search input */}
            <div className="sticky top-0 bg-background border-b px-3 py-2">
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Search options..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-transparent border-none outline-none text-sm"
                data-testid={`${testId}-search`}
              />
            </div>

            {/* Select All / Clear All */}
            {!searchTerm && (
              <div className="border-b px-3 py-2 space-y-1">
                <button
                  type="button"
                  onClick={handleSelectAll}
                  disabled={maxSelections && value.length >= maxSelections}
                  className="text-xs text-blue-600 hover:text-blue-800 disabled:opacity-50 disabled:cursor-not-allowed"
                  data-testid={`${testId}-select-all`}
                >
                  Select All
                </button>
                <span className="mx-2 text-xs text-muted-foreground">•</span>
                <button
                  type="button"
                  onClick={handleClearAll}
                  disabled={value.length === 0}
                  className="text-xs text-red-600 hover:text-red-800 disabled:opacity-50 disabled:cursor-not-allowed"
                  data-testid={`${testId}-clear-all`}
                >
                  Clear All
                </button>
                {maxSelections && (
                  <div className="text-xs text-muted-foreground mt-1">
                    {value.length} / {maxSelections} selected
                  </div>
                )}
              </div>
            )}

            {/* Options */}
            {filteredOptions.map((option) => {
              const isSelected = value.includes(option.value)
              const isDisabled = option.disabled || (maxSelections && !isSelected && value.length >= maxSelections)

              return (
                <div
                  key={option.value}
                  role="option"
                  aria-selected={isSelected}
                  aria-disabled={isDisabled}
                  onClick={() => handleToggleOption(option.value)}
                  className={cn(
                    'relative cursor-pointer select-none py-2 pl-8 pr-4 text-sm',
                    'hover:bg-accent hover:text-accent-foreground',
                    isDisabled && 'cursor-not-allowed opacity-50',
                    isSelected && 'bg-primary/5 font-medium'
                  )}
                  data-testid={`${testId}-option-${option.value}`}
                >
                  {/* Checkbox */}
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3">
                    <div
                      className={cn(
                        'flex h-4 w-4 items-center justify-center rounded border',
                        isSelected
                          ? 'bg-primary border-primary text-primary-foreground'
                          : 'border-input'
                      )}
                    >
                      {isSelected && (
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
                      )}
                    </div>
                  </span>

                  <span className="block truncate">{option.label}</span>
                </div>
              )
            })}

            {filteredOptions.length === 0 && searchTerm && (
              <div className="py-2 px-3 text-sm text-muted-foreground">
                No options found for "{searchTerm}"
              </div>
            )}

            {filteredOptions.length === 0 && !searchTerm && (
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

MultiSelect.displayName = 'MultiSelect'

export { MultiSelect }