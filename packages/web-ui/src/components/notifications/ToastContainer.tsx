'use client'

import React, { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { cn } from '@/lib/utils'
import { Toast } from './Toast'
import { useNotifications } from './NotificationProvider'
import type { ToastContainerProps, ToastPosition } from '@/types/notifications'
import { NOTIFICATION_DEFAULTS } from '@/types/notifications'

/**
 * Position-based styling for the toast container
 */
const positionStyles: Record<ToastPosition, string> = {
  'top-right': 'top-4 right-4 items-end',
  'top-left': 'top-4 left-4 items-start',
  'top-center': 'top-4 left-1/2 -translate-x-1/2 items-center',
  'bottom-right': 'bottom-4 right-4 items-end',
  'bottom-left': 'bottom-4 left-4 items-start',
  'bottom-center': 'bottom-4 left-1/2 -translate-x-1/2 items-center',
}

/**
 * Container component that manages the display of toast notifications
 */
export function ToastContainer({
  position = NOTIFICATION_DEFAULTS.DEFAULT_POSITION,
  maxVisible = NOTIFICATION_DEFAULTS.MAX_NOTIFICATIONS,
  className,
}: ToastContainerProps) {
  const { notifications, removeNotification } = useNotifications()
  const [exitingToasts, setExitingToasts] = useState<Set<string>>(new Set())
  const [isMounted, setIsMounted] = useState(false)

  // Ensure we only render on client side (for Next.js SSR compatibility)
  useEffect(() => {
    setIsMounted(true)
  }, [])

  /**
   * Handle toast dismissal with exit animation
   */
  const handleDismiss = (id: string) => {
    setExitingToasts(prev => new Set([...prev, id]))

    // Remove from exit state after animation completes
    setTimeout(() => {
      setExitingToasts(prev => {
        const next = new Set(prev)
        next.delete(id)
        return next
      })
      removeNotification(id)
    }, 200)
  }

  // Get visible notifications (respect maxVisible limit)
  const visibleNotifications = notifications.slice(0, maxVisible)

  // Don't render anything on server side or if no notifications
  if (!isMounted || visibleNotifications.length === 0) {
    return null
  }

  const containerContent = (
    <div
      className={cn(
        'fixed z-50 flex flex-col gap-2 pointer-events-none',
        positionStyles[position],
        className
      )}
      aria-live="polite"
      aria-label="Notifications"
    >
      {visibleNotifications.map((notification, index) => (
        <div
          key={notification.id}
          className="pointer-events-auto"
          style={{
            // Stagger animation delay for multiple toasts
            animationDelay: `${index * 100}ms`,
          }}
        >
          <Toast
            notification={notification}
            onDismiss={() => handleDismiss(notification.id)}
            isExiting={exitingToasts.has(notification.id)}
          />
        </div>
      ))}

      {/* Overflow indicator if there are more notifications */}
      {notifications.length > maxVisible && (
        <div className="pointer-events-auto">
          <div className={cn(
            'flex items-center justify-center rounded-lg border px-3 py-2 text-xs',
            'bg-background-secondary text-foreground-secondary border-border',
            'shadow-sm'
          )}>
            +{notifications.length - maxVisible} more notifications
          </div>
        </div>
      )}
    </div>
  )

  // Use portal to render toasts at document root level
  return createPortal(containerContent, document.body)
}