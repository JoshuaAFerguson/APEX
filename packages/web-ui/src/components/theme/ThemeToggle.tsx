'use client'

import { useTheme } from 'next-themes'
import { useEffect, useState } from 'react'
import { Sun, Moon, Monitor } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ThemeToggleProps {
  className?: string
}

export function ThemeToggle({ className }: ThemeToggleProps) {
  const { theme, setTheme, resolvedTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  // Avoid hydration mismatch
  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return (
      <div className={cn('w-9 h-9 rounded-md bg-background-tertiary', className)} />
    )
  }

  const cycleTheme = () => {
    if (theme === 'dark') {
      setTheme('light')
    } else if (theme === 'light') {
      setTheme('system')
    } else {
      setTheme('dark')
    }
  }

  return (
    <button
      onClick={cycleTheme}
      className={cn(
        'p-2 rounded-md hover:bg-background-tertiary transition-colors',
        'focus:outline-none focus:ring-2 focus:ring-apex-500 focus:ring-offset-2 focus:ring-offset-background',
        className
      )}
      title={`Current theme: ${theme}. Click to change.`}
      aria-label={`Toggle theme. Current: ${theme}`}
    >
      {theme === 'dark' && <Moon className="w-5 h-5" />}
      {theme === 'light' && <Sun className="w-5 h-5" />}
      {theme === 'system' && <Monitor className="w-5 h-5" />}
    </button>
  )
}

/**
 * Dropdown variant of theme toggle for more explicit selection
 */
export function ThemeSelector({ className }: ThemeToggleProps) {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  const [isOpen, setIsOpen] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return (
      <div className={cn('w-32 h-9 rounded-md bg-background-tertiary', className)} />
    )
  }

  const themes = [
    { value: 'light', label: 'Light', icon: Sun },
    { value: 'dark', label: 'Dark', icon: Moon },
    { value: 'system', label: 'System', icon: Monitor },
  ]

  const currentTheme = themes.find(t => t.value === theme) || themes[1]
  const CurrentIcon = currentTheme.icon

  return (
    <div className={cn('relative', className)}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 rounded-md bg-background-tertiary hover:bg-background-tertiary/80 transition-colors"
      >
        <CurrentIcon className="w-4 h-4" />
        <span className="text-sm">{currentTheme.label}</span>
      </button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute right-0 mt-2 w-36 py-1 bg-background-secondary border border-border rounded-md shadow-lg z-20">
            {themes.map(({ value, label, icon: Icon }) => (
              <button
                key={value}
                onClick={() => {
                  setTheme(value)
                  setIsOpen(false)
                }}
                className={cn(
                  'flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-background-tertiary transition-colors',
                  theme === value && 'text-apex-500'
                )}
              >
                <Icon className="w-4 h-4" />
                {label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
