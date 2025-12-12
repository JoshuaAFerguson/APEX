/**
 * Notification System Types
 *
 * Types for the notification context, toast components, and WebSocket integration.
 */

/**
 * Notification severity types
 */
export type NotificationType = 'success' | 'error' | 'warning' | 'info'

/**
 * Notification action button configuration
 */
export interface NotificationAction {
  label: string
  onClick: () => void
}

/**
 * Full notification data structure
 */
export interface Notification {
  /** Unique identifier */
  id: string
  /** Notification severity/type */
  type: NotificationType
  /** Main notification title */
  title: string
  /** Optional detailed message */
  message?: string
  /** Auto-dismiss duration in ms, 0 = persistent */
  duration: number
  /** Whether user can dismiss the notification */
  dismissible: boolean
  /** Optional action button */
  action?: NotificationAction
  /** When the notification was created */
  createdAt: Date
}

/**
 * Input for creating a new notification (id and createdAt are auto-generated)
 */
export type CreateNotificationInput = Omit<Notification, 'id' | 'createdAt'> & {
  duration?: number
  dismissible?: boolean
}

/**
 * Notification context value exposed by useNotifications hook
 */
export interface NotificationContextValue {
  /** Current list of active notifications */
  notifications: Notification[]
  /** Add a new notification, returns its ID */
  addNotification: (notification: CreateNotificationInput) => string
  /** Remove a notification by ID */
  removeNotification: (id: string) => void
  /** Clear all notifications */
  clearAll: () => void
}

/**
 * Convenience methods for common notification types
 */
export interface NotificationHelpers {
  success: (title: string, message?: string) => string
  error: (title: string, message?: string) => string
  warning: (title: string, message?: string) => string
  info: (title: string, message?: string) => string
}

/**
 * Full notification hook return type
 */
export type UseNotificationsReturn = NotificationContextValue & NotificationHelpers

/**
 * Toast position options
 */
export type ToastPosition =
  | 'top-right'
  | 'top-left'
  | 'top-center'
  | 'bottom-right'
  | 'bottom-left'
  | 'bottom-center'

/**
 * Props for individual Toast component
 */
export interface ToastProps {
  notification: Notification
  onDismiss: () => void
  /** Animation state for enter/exit */
  isExiting?: boolean
}

/**
 * Props for ToastContainer component
 */
export interface ToastContainerProps {
  /** Position of the toast stack */
  position?: ToastPosition
  /** Maximum number of toasts to show at once */
  maxVisible?: number
  /** Custom class name */
  className?: string
}

/**
 * Props for NotificationProvider component
 */
export interface NotificationProviderProps {
  children: React.ReactNode
  /** Default duration for auto-dismiss (ms) */
  defaultDuration?: number
  /** Maximum notifications to keep in state */
  maxNotifications?: number
  /** Position for toast display */
  position?: ToastPosition
}

/**
 * Reducer state for notification management
 */
export interface NotificationState {
  notifications: Notification[]
}

/**
 * Reducer action types
 */
export type NotificationReducerAction =
  | { type: 'ADD'; payload: Notification }
  | { type: 'REMOVE'; payload: string }
  | { type: 'CLEAR_ALL' }

/**
 * Default configuration values
 */
export const NOTIFICATION_DEFAULTS = {
  /** Default auto-dismiss duration (5 seconds) */
  DEFAULT_DURATION: 5000,
  /** Error notifications persist by default */
  ERROR_DURATION: 0,
  /** Maximum notifications to display */
  MAX_NOTIFICATIONS: 5,
  /** Default toast position */
  DEFAULT_POSITION: 'top-right' as ToastPosition,
} as const

/**
 * Icons mapping for notification types
 */
export const NOTIFICATION_ICONS = {
  success: 'CheckCircle',
  error: 'XCircle',
  warning: 'AlertTriangle',
  info: 'Info',
} as const

/**
 * Color classes for notification types (Tailwind)
 */
export const NOTIFICATION_COLORS = {
  success: {
    bg: 'bg-green-500/10',
    border: 'border-green-500/20',
    text: 'text-green-500',
    icon: 'text-green-500',
  },
  error: {
    bg: 'bg-red-500/10',
    border: 'border-red-500/20',
    text: 'text-red-500',
    icon: 'text-red-500',
  },
  warning: {
    bg: 'bg-yellow-500/10',
    border: 'border-yellow-500/20',
    text: 'text-yellow-500',
    icon: 'text-yellow-500',
  },
  info: {
    bg: 'bg-blue-500/10',
    border: 'border-blue-500/20',
    text: 'text-blue-500',
    icon: 'text-blue-500',
  },
} as const
