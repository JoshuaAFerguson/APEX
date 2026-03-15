import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
import type { TaskStatus } from '@apexcli/core'

/**
 * Merge Tailwind CSS classes with clsx
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Format a date string to a human-readable format
 */
export function formatDate(date: string | Date, options?: Intl.DateTimeFormatOptions): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date

  return dateObj.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    ...options,
  })
}

/**
 * Truncate a task ID for display
 */
export function truncateId(id: string, length: number = 8): string {
  if (id.length <= length) return id
  return `${id.slice(0, length)}...`
}

/**
 * Format a cost value as currency
 */
export function formatCost(cost: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  }).format(cost)
}

/**
 * Get badge variant from task status
 */
export function getStatusVariant(
  status: TaskStatus
): 'default' | 'success' | 'warning' | 'error' | 'info' {
  switch (status) {
    case 'pending':
    case 'queued':
      return 'default'
    case 'planning':
    case 'in-progress':
      return 'info'
    case 'waiting-approval':
    case 'awaiting-approval':
    case 'paused':
      return 'warning'
    case 'completed':
      return 'success'
    case 'failed':
    case 'cancelled':
      return 'error'
    default:
      return 'default'
  }
}

/**
 * Format task status for display
 */
export function formatStatus(status: TaskStatus): string {
  return status
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

/**
 * Calculate relative time from a date
 */
export function getRelativeTime(date: string | Date): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date
  const now = new Date()
  const diffMs = now.getTime() - dateObj.getTime()
  const diffSec = Math.floor(diffMs / 1000)
  const diffMin = Math.floor(diffSec / 60)
  const diffHour = Math.floor(diffMin / 60)
  const diffDay = Math.floor(diffHour / 24)

  if (diffSec < 60) return 'just now'
  if (diffMin < 60) return `${diffMin}m ago`
  if (diffHour < 24) return `${diffHour}h ago`
  if (diffDay < 7) return `${diffDay}d ago`

  return formatDate(dateObj, { month: 'short', day: 'numeric' })
}

/**
 * Format elapsed time from a start date to now in a human-readable format
 * Used for showing how long a task has been running
 */
export function getElapsedTime(startDate: string | Date): string {
  const start = typeof startDate === 'string' ? new Date(startDate) : startDate
  const now = new Date()
  const diffMs = now.getTime() - start.getTime()

  // Handle edge case where start date is in the future
  if (diffMs < 0) return '0s'

  const diffSec = Math.floor(diffMs / 1000)
  const diffMin = Math.floor(diffSec / 60)
  const diffHour = Math.floor(diffMin / 60)
  const diffDay = Math.floor(diffHour / 24)

  if (diffDay > 0) {
    const hours = diffHour % 24
    return hours > 0 ? `${diffDay}d ${hours}h` : `${diffDay}d`
  }
  if (diffHour > 0) {
    const minutes = diffMin % 60
    return minutes > 0 ? `${diffHour}h ${minutes}m` : `${diffHour}h`
  }
  if (diffMin > 0) {
    const seconds = diffSec % 60
    return seconds > 0 ? `${diffMin}m ${seconds}s` : `${diffMin}m`
  }

  return `${diffSec}s`
}

/**
 * Check if a task is currently running (in active states)
 */
export function isTaskRunning(status: TaskStatus): boolean {
  return status === 'in-progress' || status === 'planning'
}

/**
 * Get appropriate progress indicator variant for task status
 */
export function getProgressVariant(status: TaskStatus): 'default' | 'success' | 'warning' | 'error' | 'info' {
  switch (status) {
    case 'completed':
      return 'success'
    case 'failed':
    case 'cancelled':
      return 'error'
    case 'awaiting-approval':
    case 'waiting-approval':
    case 'paused':
      return 'warning'
    case 'planning':
    case 'in-progress':
      return 'info'
    default:
      return 'default'
  }
}

/**
 * Format a number as a percentage string
 */
export function formatPercentage(value: number, precision: number = 1): string {
  return `${(value * 100).toFixed(precision)}%`
}
