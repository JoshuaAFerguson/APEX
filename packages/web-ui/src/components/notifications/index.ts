/**
 * Notification System Components and Hooks
 *
 * Provides a complete notification system with toast notifications and a notification center.
 */

// Core provider and hooks
export { NotificationProvider, useNotifications } from './NotificationProvider'

// UI components
export { Toast } from './Toast'
export { ToastContainer } from './ToastContainer'
export { NotificationCenter } from './NotificationCenter'

// Re-export types for convenience
export type {
  Notification,
  NotificationType,
  NotificationAction,
  CreateNotificationInput,
  NotificationContextValue,
  NotificationHelpers,
  UseNotificationsReturn,
  ToastPosition,
  ToastProps,
  ToastContainerProps,
  NotificationProviderProps,
} from '@/types/notifications'

// Re-export constants
export {
  NOTIFICATION_DEFAULTS,
  NOTIFICATION_ICONS,
  NOTIFICATION_COLORS,
} from '@/types/notifications'