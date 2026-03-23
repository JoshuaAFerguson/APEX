'use client'

import React, { useState, useRef, useEffect } from 'react'
import { Bell, BellRing, Check, X, Settings, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Card, CardContent, CardHeader } from '@/components/ui/Card'
import { useNotifications } from './NotificationProvider'
import { getRelativeTime } from '@/lib/utils'
import type { Notification } from '@/types/notifications'
import { NOTIFICATION_COLORS, NOTIFICATION_ICONS } from '@/types/notifications'
import { CheckCircle, XCircle, AlertTriangle, Info } from 'lucide-react'

/**
 * Icon mapping for notification types
 */
const IconComponents = {
  CheckCircle,
  XCircle,
  AlertTriangle,
  Info,
} as const

/**
 * Individual notification item in the center panel
 */
function NotificationItem({
  notification,
  onDismiss,
  onMarkRead
}: {
  notification: Notification
  onDismiss: () => void
  onMarkRead: () => void
}) {
  const colors = NOTIFICATION_COLORS[notification.type]
  const iconName = NOTIFICATION_ICONS[notification.type]
  const IconComponent = IconComponents[iconName]

  return (
    <div className="group flex items-start gap-3 p-3 rounded-lg border border-transparent hover:border-border hover:bg-background-tertiary transition-colors">
      {/* Icon */}
      <div className={cn('flex-shrink-0 mt-1', colors.icon)}>
        <IconComponent className="h-4 w-4" />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className={cn('font-medium text-sm', colors.text)}>
              {notification.title}
            </div>
            {notification.message && (
              <div className="text-sm text-foreground-secondary mt-1 line-clamp-2">
                {notification.message}
              </div>
            )}
            <div className="text-xs text-foreground-tertiary mt-1">
              {getRelativeTime(notification.createdAt)}
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <Button
              size="sm"
              variant="ghost"
              onClick={onMarkRead}
              className="h-6 w-6 p-0 text-foreground-secondary hover:text-foreground"
              title="Mark as read"
            >
              <Check className="h-3 w-3" />
            </Button>
            {notification.dismissible && (
              <Button
                size="sm"
                variant="ghost"
                onClick={onDismiss}
                className="h-6 w-6 p-0 text-foreground-secondary hover:text-foreground"
                title="Dismiss"
              >
                <X className="h-3 w-3" />
              </Button>
            )}
          </div>
        </div>

        {/* Action button */}
        {notification.action && (
          <div className="mt-2">
            <Button
              size="sm"
              variant="ghost"
              onClick={notification.action.onClick}
              className={cn('h-7 px-2 text-xs', colors.text)}
            >
              {notification.action.label}
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}

/**
 * Notification Center component with bell icon and dropdown panel
 */
export function NotificationCenter() {
  const { notifications, removeNotification, clearAll } = useNotifications()
  const [isOpen, setIsOpen] = useState(false)
  const [readNotifications, setReadNotifications] = useState<Set<string>>(new Set())
  const containerRef = useRef<HTMLDivElement>(null)

  // Get unread count
  const unreadCount = notifications.filter(n => !readNotifications.has(n.id)).length

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  // Handle keyboard navigation
  useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape' && isOpen) {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener('keydown', handleEscape)
      return () => document.removeEventListener('keydown', handleEscape)
    }
  }, [isOpen])

  /**
   * Mark a notification as read
   */
  const markAsRead = (id: string) => {
    setReadNotifications(prev => new Set([...prev, id]))
  }

  /**
   * Mark all notifications as read
   */
  const markAllAsRead = () => {
    const allIds = notifications.map(n => n.id)
    setReadNotifications(new Set(allIds))
  }

  /**
   * Handle notification dismiss with read state cleanup
   */
  const handleDismiss = (id: string) => {
    removeNotification(id)
    setReadNotifications(prev => {
      const next = new Set(prev)
      next.delete(id)
      return next
    })
  }

  /**
   * Handle clear all with read state cleanup
   */
  const handleClearAll = () => {
    clearAll()
    setReadNotifications(new Set())
    setIsOpen(false)
  }

  return (
    <div ref={containerRef} className="relative">
      {/* Bell Icon Button */}
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 h-auto"
        aria-label={`Notifications (${unreadCount} unread)`}
        aria-expanded={isOpen}
        aria-haspopup="true"
      >
        {unreadCount > 0 ? (
          <BellRing className="h-5 w-5" />
        ) : (
          <Bell className="h-5 w-5" />
        )}

        {/* Unread badge */}
        {unreadCount > 0 && (
          <Badge
            variant="error"
            className="absolute -top-1 -right-1 h-5 w-5 p-0 flex items-center justify-center text-xs font-medium"
          >
            {unreadCount > 99 ? '99+' : unreadCount}
          </Badge>
        )}
      </Button>

      {/* Dropdown Panel */}
      {isOpen && (
        <Card className="absolute right-0 top-full mt-2 w-96 max-w-[calc(100vw-2rem)] z-50 shadow-xl border-border bg-background-secondary">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-base">Notifications</h3>
                {unreadCount > 0 && (
                  <Badge variant="secondary" className="text-xs">
                    {unreadCount} unread
                  </Badge>
                )}
              </div>

              <div className="flex items-center gap-1">
                {/* Mark all as read */}
                {unreadCount > 0 && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={markAllAsRead}
                    className="h-7 px-2 text-xs text-foreground-secondary hover:text-foreground"
                    title="Mark all as read"
                  >
                    <Check className="h-3 w-3 mr-1" />
                    Mark all read
                  </Button>
                )}

                {/* Settings placeholder */}
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 w-7 p-0 text-foreground-secondary hover:text-foreground"
                  title="Notification preferences"
                >
                  <Settings className="h-3 w-3" />
                </Button>
              </div>
            </div>
          </CardHeader>

          <CardContent className="p-0">
            {notifications.length === 0 ? (
              <div className="px-4 py-8 text-center text-foreground-secondary">
                <Bell className="h-8 w-8 mx-auto mb-2 text-foreground-tertiary" />
                <p className="text-sm">No notifications</p>
              </div>
            ) : (
              <>
                {/* Notifications list */}
                <div className="max-h-96 overflow-y-auto">
                  {notifications.map((notification) => (
                    <NotificationItem
                      key={notification.id}
                      notification={notification}
                      onDismiss={() => handleDismiss(notification.id)}
                      onMarkRead={() => markAsRead(notification.id)}
                    />
                  ))}
                </div>

                {/* Clear all button */}
                <div className="border-t border-border p-3">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={handleClearAll}
                    className="w-full justify-center text-foreground-secondary hover:text-foreground"
                  >
                    <Trash2 className="h-3 w-3 mr-2" />
                    Clear all notifications
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}