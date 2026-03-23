'use client'

import React, { useEffect, useState } from 'react'
import { X, CheckCircle, XCircle, AlertTriangle, Info } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/Button'
import type { ToastProps } from '@/types/notifications'
import { NOTIFICATION_COLORS, NOTIFICATION_ICONS } from '@/types/notifications'

/**
 * Icon mapping for notification types using Lucide React icons
 */
const IconComponents = {
  CheckCircle,
  XCircle,
  AlertTriangle,
  Info,
} as const

/**
 * Individual toast notification component
 */
export function Toast({ notification, onDismiss, isExiting = false }: ToastProps) {
  const [isVisible, setIsVisible] = useState(false)

  // Animation: show toast on mount
  useEffect(() => {
    const timer = setTimeout(() => setIsVisible(true), 10)
    return () => clearTimeout(timer)
  }, [])

  // Handle exit animation
  useEffect(() => {
    if (isExiting) {
      setIsVisible(false)
      // Allow time for exit animation before calling onDismiss
      const timer = setTimeout(onDismiss, 200)
      return () => clearTimeout(timer)
    }
  }, [isExiting, onDismiss])

  const colors = NOTIFICATION_COLORS[notification.type]
  const iconName = NOTIFICATION_ICONS[notification.type]
  const IconComponent = IconComponents[iconName]

  return (
    <div
      role="alert"
      aria-live={notification.type === 'error' ? 'assertive' : 'polite'}
      className={cn(
        'relative flex w-full max-w-md items-start gap-3 rounded-lg border p-4 shadow-lg transition-all duration-200 ease-in-out',
        'bg-background-secondary backdrop-blur-sm',
        colors.bg,
        colors.border,
        // Animation states
        isVisible && !isExiting
          ? 'translate-x-0 opacity-100 scale-100'
          : 'translate-x-full opacity-0 scale-95',
        // Hover effect
        'hover:shadow-xl hover:scale-[1.02]'
      )}
    >
      {/* Icon */}
      <div className={cn('flex-shrink-0 mt-0.5', colors.icon)}>
        <IconComponent className="h-5 w-5" />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className={cn('font-medium text-sm', colors.text)}>
          {notification.title}
        </div>

        {notification.message && (
          <div className={cn('mt-1 text-sm text-foreground-secondary')}>
            {notification.message}
          </div>
        )}

        {/* Action button */}
        {notification.action && (
          <div className="mt-3">
            <Button
              size="sm"
              variant="ghost"
              onClick={notification.action.onClick}
              className={cn('h-8 px-3 text-xs', colors.text, 'hover:bg-background-tertiary')}
            >
              {notification.action.label}
            </Button>
          </div>
        )}
      </div>

      {/* Dismiss button */}
      {notification.dismissible && (
        <Button
          size="sm"
          variant="ghost"
          onClick={onDismiss}
          className={cn(
            'flex-shrink-0 h-6 w-6 p-0 rounded-md text-foreground-secondary',
            'hover:bg-background-tertiary hover:text-foreground',
            'focus:ring-1 focus:ring-apex-500 focus:ring-offset-0'
          )}
          aria-label="Dismiss notification"
        >
          <X className="h-4 w-4" />
        </Button>
      )}

      {/* Progress bar for auto-dismiss */}
      {notification.duration > 0 && (
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-background-tertiary rounded-b-lg overflow-hidden">
          <div
            className={cn('h-full transition-all ease-linear', colors.text.replace('text-', 'bg-'))}
            style={{
              animation: `toast-progress ${notification.duration}ms linear`,
              animationFillMode: 'forwards'
            }}
          />
        </div>
      )}

      <style jsx>{`
        @keyframes toast-progress {
          from {
            width: 100%;
          }
          to {
            width: 0%;
          }
        }
      `}</style>
    </div>
  )
}