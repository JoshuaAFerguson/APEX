'use client'

import React, { createContext, useContext, useReducer, useCallback, useEffect } from 'react'
import type {
  Notification,
  CreateNotificationInput,
  NotificationContextValue,
  NotificationProviderProps,
  NotificationState,
  NotificationReducerAction,
  UseNotificationsReturn,
  ToastPosition,
} from '@/types/notifications'
import { NOTIFICATION_DEFAULTS } from '@/types/notifications'

/**
 * Notification Context for sharing notification state across the app
 */
const NotificationContext = createContext<NotificationContextValue | null>(null)

/**
 * Notification reducer to manage notification state
 */
function notificationReducer(
  state: NotificationState,
  action: NotificationReducerAction
): NotificationState {
  switch (action.type) {
    case 'ADD':
      // Add new notification and enforce max limit
      const newNotifications = [action.payload, ...state.notifications]
      return {
        notifications: newNotifications.slice(0, NOTIFICATION_DEFAULTS.MAX_NOTIFICATIONS),
      }

    case 'REMOVE':
      return {
        notifications: state.notifications.filter(notification => notification.id !== action.payload),
      }

    case 'CLEAR_ALL':
      return {
        notifications: [],
      }

    default:
      return state
  }
}

/**
 * Generate a unique ID for notifications
 */
function generateId(): string {
  return `notification_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}

/**
 * Provider component that manages notification state and provides context
 */
export function NotificationProvider({
  children,
  defaultDuration = NOTIFICATION_DEFAULTS.DEFAULT_DURATION,
  maxNotifications = NOTIFICATION_DEFAULTS.MAX_NOTIFICATIONS,
  position = NOTIFICATION_DEFAULTS.DEFAULT_POSITION,
}: NotificationProviderProps) {
  const [state, dispatch] = useReducer(notificationReducer, { notifications: [] })
  const timeoutRefs = React.useRef<Map<string, NodeJS.Timeout>>(new Map())

  /**
   * Add a new notification with auto-dismiss logic
   */
  const addNotification = useCallback((input: CreateNotificationInput): string => {
    const id = generateId()

    const notification: Notification = {
      id,
      type: input.type,
      title: input.title,
      message: input.message,
      duration: input.duration ?? (input.type === 'error' ? NOTIFICATION_DEFAULTS.ERROR_DURATION : defaultDuration),
      dismissible: input.dismissible ?? true,
      action: input.action,
      createdAt: new Date(),
    }

    dispatch({ type: 'ADD', payload: notification })

    // Set up auto-dismiss if duration > 0
    if (notification.duration > 0) {
      const timeoutId = setTimeout(() => {
        removeNotification(id)
      }, notification.duration)

      timeoutRefs.current.set(id, timeoutId)
    }

    return id
  }, [defaultDuration])

  /**
   * Remove a notification by ID
   */
  const removeNotification = useCallback((id: string) => {
    // Clear any pending timeout
    const timeoutId = timeoutRefs.current.get(id)
    if (timeoutId) {
      clearTimeout(timeoutId)
      timeoutRefs.current.delete(id)
    }

    dispatch({ type: 'REMOVE', payload: id })
  }, [])

  /**
   * Clear all notifications
   */
  const clearAll = useCallback(() => {
    // Clear all timeouts
    timeoutRefs.current.forEach(timeoutId => clearTimeout(timeoutId))
    timeoutRefs.current.clear()

    dispatch({ type: 'CLEAR_ALL' })
  }, [])

  // Clean up timeouts on unmount
  useEffect(() => {
    return () => {
      timeoutRefs.current.forEach(timeoutId => clearTimeout(timeoutId))
      timeoutRefs.current.clear()
    }
  }, [])

  const contextValue: NotificationContextValue = {
    notifications: state.notifications,
    addNotification,
    removeNotification,
    clearAll,
  }

  return (
    <NotificationContext.Provider value={contextValue}>
      {children}
    </NotificationContext.Provider>
  )
}

/**
 * Hook to access notification context with convenience methods
 */
export function useNotifications(): UseNotificationsReturn {
  const context = useContext(NotificationContext)

  if (!context) {
    throw new Error('useNotifications must be used within a NotificationProvider')
  }

  // Get default duration from provider context - using the default since we can't access provider props
  const defaultDuration = NOTIFICATION_DEFAULTS.DEFAULT_DURATION

  // Convenience methods for common notification types
  const success = useCallback((title: string, message?: string): string => {
    return context.addNotification({
      type: 'success',
      title,
      message,
      duration: defaultDuration,
      dismissible: true
    })
  }, [context, defaultDuration])

  const error = useCallback((title: string, message?: string): string => {
    return context.addNotification({
      type: 'error',
      title,
      message,
      duration: NOTIFICATION_DEFAULTS.ERROR_DURATION, // Errors persist by default
      dismissible: true
    })
  }, [context])

  const warning = useCallback((title: string, message?: string): string => {
    return context.addNotification({
      type: 'warning',
      title,
      message,
      duration: defaultDuration,
      dismissible: true
    })
  }, [context, defaultDuration])

  const info = useCallback((title: string, message?: string): string => {
    return context.addNotification({
      type: 'info',
      title,
      message,
      duration: defaultDuration,
      dismissible: true
    })
  }, [context, defaultDuration])

  return {
    ...context,
    success,
    error,
    warning,
    info,
  }
}