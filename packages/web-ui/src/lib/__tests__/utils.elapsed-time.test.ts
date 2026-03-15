import { describe, it, expect, vi } from 'vitest'
import { getElapsedTime, isTaskRunning, getProgressVariant } from '../utils'
import type { TaskStatus } from '@apexcli/core'

describe('getElapsedTime', () => {
  it('formats seconds correctly', () => {
    const start = new Date('2024-01-01T10:00:00Z')
    const now = new Date('2024-01-01T10:00:30Z')
    vi.setSystemTime(now)

    expect(getElapsedTime(start)).toBe('30s')

    vi.useRealTimers()
  })

  it('formats minutes and seconds correctly', () => {
    const start = new Date('2024-01-01T10:00:00Z')
    const now = new Date('2024-01-01T10:02:30Z')
    vi.setSystemTime(now)

    expect(getElapsedTime(start)).toBe('2m 30s')

    vi.useRealTimers()
  })

  it('formats just minutes when seconds are 0', () => {
    const start = new Date('2024-01-01T10:00:00Z')
    const now = new Date('2024-01-01T10:02:00Z')
    vi.setSystemTime(now)

    expect(getElapsedTime(start)).toBe('2m')

    vi.useRealTimers()
  })

  it('formats hours and minutes correctly', () => {
    const start = new Date('2024-01-01T10:00:00Z')
    const now = new Date('2024-01-01T12:30:00Z')
    vi.setSystemTime(now)

    expect(getElapsedTime(start)).toBe('2h 30m')

    vi.useRealTimers()
  })

  it('formats just hours when minutes are 0', () => {
    const start = new Date('2024-01-01T10:00:00Z')
    const now = new Date('2024-01-01T12:00:00Z')
    vi.setSystemTime(now)

    expect(getElapsedTime(start)).toBe('2h')

    vi.useRealTimers()
  })

  it('formats days and hours correctly', () => {
    const start = new Date('2024-01-01T10:00:00Z')
    const now = new Date('2024-01-03T14:00:00Z')
    vi.setSystemTime(now)

    expect(getElapsedTime(start)).toBe('2d 4h')

    vi.useRealTimers()
  })

  it('formats just days when hours are 0', () => {
    const start = new Date('2024-01-01T10:00:00Z')
    const now = new Date('2024-01-03T10:00:00Z')
    vi.setSystemTime(now)

    expect(getElapsedTime(start)).toBe('2d')

    vi.useRealTimers()
  })

  it('handles string dates', () => {
    const start = '2024-01-01T10:00:00Z'
    const now = new Date('2024-01-01T10:00:30Z')
    vi.setSystemTime(now)

    expect(getElapsedTime(start)).toBe('30s')

    vi.useRealTimers()
  })

  it('handles future dates gracefully', () => {
    const start = new Date('2024-01-01T12:00:00Z')
    const now = new Date('2024-01-01T10:00:00Z')
    vi.setSystemTime(now)

    expect(getElapsedTime(start)).toBe('0s')

    vi.useRealTimers()
  })
})

describe('isTaskRunning', () => {
  it('returns true for running statuses', () => {
    expect(isTaskRunning('in-progress')).toBe(true)
    expect(isTaskRunning('planning')).toBe(true)
  })

  it('returns false for non-running statuses', () => {
    const nonRunningStatuses: TaskStatus[] = [
      'pending',
      'queued',
      'completed',
      'failed',
      'cancelled',
      'paused',
      'waiting-approval',
      'awaiting-approval',
    ]

    nonRunningStatuses.forEach(status => {
      expect(isTaskRunning(status)).toBe(false)
    })
  })
})

describe('getProgressVariant', () => {
  it('returns correct variants for each status', () => {
    expect(getProgressVariant('completed')).toBe('success')
    expect(getProgressVariant('failed')).toBe('error')
    expect(getProgressVariant('cancelled')).toBe('error')
    expect(getProgressVariant('awaiting-approval')).toBe('warning')
    expect(getProgressVariant('waiting-approval')).toBe('warning')
    expect(getProgressVariant('paused')).toBe('warning')
    expect(getProgressVariant('planning')).toBe('info')
    expect(getProgressVariant('in-progress')).toBe('info')
    expect(getProgressVariant('pending')).toBe('default')
    expect(getProgressVariant('queued')).toBe('default')
  })
})