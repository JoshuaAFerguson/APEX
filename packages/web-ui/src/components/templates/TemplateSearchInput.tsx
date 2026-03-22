'use client'

import { useState, useEffect, useRef, forwardRef, useImperativeHandle } from 'react'
import { Search, X } from 'lucide-react'

export interface TemplateSearchInputProps {
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

/**
 * Search input component with debouncing for template filtering
 * Features search icon, clear button, and keyboard shortcuts
 */
export const TemplateSearchInput = forwardRef<HTMLInputElement, TemplateSearchInputProps>(
  function TemplateSearchInput({
    value,
    onChange,
    placeholder = 'Search templates by name or tags...',
    debounceMs = 300,
    className = ''
  }, ref) {
  const [localValue, setLocalValue] = useState(value)
  const inputRef = useRef<HTMLInputElement>(null)

  // Forward ref to internal input
  useImperativeHandle(ref, () => inputRef.current as HTMLInputElement)
  const debounceRef = useRef<NodeJS.Timeout>()

  // Sync external value changes
  useEffect(() => {
    setLocalValue(value)
  }, [value])

  // Debounced onChange
  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
    }

    debounceRef.current = setTimeout(() => {
      if (localValue !== value) {
        onChange(localValue)
      }
    }, debounceMs)

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current)
      }
    }
  }, [localValue, value, onChange, debounceMs])

  // Handle input change
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setLocalValue(e.target.value)
  }

  // Clear search
  const handleClear = () => {
    setLocalValue('')
    onChange('')
    inputRef.current?.focus()
  }

  // Keyboard shortcuts
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // Escape to clear
    if (e.key === 'Escape') {
      handleClear()
    }
  }

  return (
    <div className={`relative ${className}`}>
      <div className="relative">
        {/* Search Icon */}
        <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">
          <Search className="w-4 h-4 text-foreground-secondary" />
        </div>

        {/* Input */}
        <input
          ref={inputRef}
          type="text"
          value={localValue}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="w-full pl-10 pr-10 py-2 bg-background-tertiary border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-apex-500 focus:border-apex-500 text-sm"
          autoComplete="off"
          spellCheck="false"
        />

        {/* Clear Button */}
        {localValue && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 rounded hover:bg-background-secondary transition-colors"
            title="Clear search"
          >
            <X className="w-4 h-4 text-foreground-secondary hover:text-foreground" />
          </button>
        )}
      </div>

      {/* Keyboard hint */}
      <div className="sr-only">
        Press / to focus search, Escape to clear
      </div>
    </div>
  )
})