import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  cn,
  formatDate,
  truncateId,
  formatCost,
  getStatusVariant,
  formatStatus,
  getRelativeTime,
} from '../utils';
import type { TaskStatus } from '@apex/core';

describe('cn', () => {
  it('should merge class names', () => {
    const result = cn('class1', 'class2');
    expect(result).toBe('class1 class2');
  });

  it('should handle conditional classes', () => {
    const result = cn('base', true && 'conditional', false && 'skipped');
    expect(result).toBe('base conditional');
  });

  it('should merge Tailwind conflicting classes', () => {
    // twMerge should deduplicate conflicting classes
    const result = cn('px-4 py-2', 'px-6');
    expect(result).toBe('py-2 px-6');
  });

  it('should handle arrays of classes', () => {
    const result = cn(['class1', 'class2'], 'class3');
    expect(result).toBe('class1 class2 class3');
  });

  it('should handle objects with boolean values', () => {
    const result = cn({
      'class1': true,
      'class2': false,
      'class3': true,
    });
    expect(result).toBe('class1 class3');
  });

  it('should handle empty or null values', () => {
    const result = cn('base', null, undefined, '', 'end');
    expect(result).toBe('base end');
  });
});

describe('formatDate', () => {
  beforeEach(() => {
    // Mock the timezone to ensure consistent test results
    vi.useFakeTimers();
  });

  it('should format a Date object', () => {
    const date = new Date('2025-01-15T10:30:00Z');
    const result = formatDate(date);

    // Result should contain date parts (exact format depends on locale)
    expect(result).toMatch(/Jan|15|2025/);
  });

  it('should format a date string', () => {
    const dateString = '2025-01-15T10:30:00Z';
    const result = formatDate(dateString);

    expect(result).toMatch(/Jan|15|2025/);
  });

  it('should apply custom format options', () => {
    const date = new Date('2025-01-15T10:30:00Z');
    const result = formatDate(date, {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });

    expect(result).toContain('January');
    expect(result).toContain('15');
    expect(result).toContain('2025');
  });

  it('should include time by default', () => {
    const date = new Date('2025-01-15T10:30:00Z');
    const result = formatDate(date);

    // Should include time components
    expect(result).toMatch(/\d{1,2}:\d{2}/);
  });

  it('should override default options with custom ones', () => {
    const date = new Date('2025-01-15T10:30:00Z');
    const result = formatDate(date, {
      month: 'numeric',
      day: 'numeric',
      year: '2-digit',
    });

    expect(result).toMatch(/\d{1,2}\/\d{1,2}\/\d{2}/);
  });
});

describe('truncateId', () => {
  it('should truncate long IDs to default length', () => {
    const id = 'task_1234567890_abcdefghij';
    const result = truncateId(id);

    expect(result).toBe('task_123...');
    expect(result.length).toBe(11); // 8 chars + '...'
  });

  it('should truncate to custom length', () => {
    const id = 'task_1234567890_abcdefghij';
    const result = truncateId(id, 12);

    expect(result).toBe('task_1234567...');
    expect(result.length).toBe(15); // 12 chars + '...'
  });

  it('should not truncate short IDs', () => {
    const id = 'task_12';
    const result = truncateId(id, 10);

    expect(result).toBe('task_12');
  });

  it('should handle IDs exactly at length limit', () => {
    const id = 'task_123';
    const result = truncateId(id, 8);

    expect(result).toBe('task_123');
  });

  it('should handle empty strings', () => {
    const result = truncateId('');
    expect(result).toBe('');
  });
});

describe('formatCost', () => {
  it('should format cost as USD currency', () => {
    const result = formatCost(1.2345);
    expect(result).toBe('$1.2345');
  });

  it('should show up to 4 decimal places', () => {
    const result = formatCost(0.123456789);
    expect(result).toBe('$0.1235'); // Rounded to 4 decimals
  });

  it('should show minimum 2 decimal places', () => {
    const result = formatCost(5);
    expect(result).toBe('$5.00');
  });

  it('should handle small costs', () => {
    const result = formatCost(0.0001);
    expect(result).toBe('$0.0001');
  });

  it('should handle zero cost', () => {
    const result = formatCost(0);
    expect(result).toBe('$0.00');
  });

  it('should handle large costs', () => {
    const result = formatCost(1234.5678);
    expect(result).toBe('$1,234.5678');
  });

  it('should include thousands separator', () => {
    const result = formatCost(10000.12);
    expect(result).toBe('$10,000.12');
  });
});

describe('getStatusVariant', () => {
  it('should return "default" for pending status', () => {
    expect(getStatusVariant('pending')).toBe('default');
  });

  it('should return "default" for queued status', () => {
    expect(getStatusVariant('queued')).toBe('default');
  });

  it('should return "info" for planning status', () => {
    expect(getStatusVariant('planning')).toBe('info');
  });

  it('should return "info" for in-progress status', () => {
    expect(getStatusVariant('in-progress')).toBe('info');
  });

  it('should return "warning" for waiting-approval status', () => {
    expect(getStatusVariant('waiting-approval')).toBe('warning');
  });

  it('should return "warning" for paused status', () => {
    expect(getStatusVariant('paused')).toBe('warning');
  });

  it('should return "success" for completed status', () => {
    expect(getStatusVariant('completed')).toBe('success');
  });

  it('should return "error" for failed status', () => {
    expect(getStatusVariant('failed')).toBe('error');
  });

  it('should return "error" for cancelled status', () => {
    expect(getStatusVariant('cancelled')).toBe('error');
  });

  it('should handle all valid task statuses', () => {
    const statuses: TaskStatus[] = [
      'pending',
      'queued',
      'planning',
      'in-progress',
      'waiting-approval',
      'paused',
      'completed',
      'failed',
      'cancelled',
    ];

    statuses.forEach((status) => {
      const variant = getStatusVariant(status);
      expect(['default', 'success', 'warning', 'error', 'info']).toContain(variant);
    });
  });
});

describe('formatStatus', () => {
  it('should capitalize first letter of single-word status', () => {
    expect(formatStatus('pending')).toBe('Pending');
    expect(formatStatus('completed')).toBe('Completed');
    expect(formatStatus('failed')).toBe('Failed');
  });

  it('should capitalize and space multi-word statuses', () => {
    expect(formatStatus('in-progress')).toBe('In Progress');
    expect(formatStatus('waiting-approval')).toBe('Waiting Approval');
  });

  it('should handle queued status', () => {
    expect(formatStatus('queued')).toBe('Queued');
  });

  it('should handle paused status', () => {
    expect(formatStatus('paused')).toBe('Paused');
  });

  it('should handle cancelled status', () => {
    expect(formatStatus('cancelled')).toBe('Cancelled');
  });

  it('should handle planning status', () => {
    expect(formatStatus('planning')).toBe('Planning');
  });
});

describe('getRelativeTime', () => {
  let now: Date;

  beforeEach(() => {
    // Fix the current time for consistent testing
    now = new Date('2025-01-15T12:00:00Z');
    vi.setSystemTime(now);
  });

  it('should return "just now" for recent times (< 60 seconds)', () => {
    const date = new Date(now.getTime() - 30 * 1000); // 30 seconds ago
    expect(getRelativeTime(date)).toBe('just now');
  });

  it('should return minutes ago for times within an hour', () => {
    const date = new Date(now.getTime() - 5 * 60 * 1000); // 5 minutes ago
    expect(getRelativeTime(date)).toBe('5m ago');
  });

  it('should return hours ago for times within a day', () => {
    const date = new Date(now.getTime() - 3 * 60 * 60 * 1000); // 3 hours ago
    expect(getRelativeTime(date)).toBe('3h ago');
  });

  it('should return days ago for times within a week', () => {
    const date = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000); // 2 days ago
    expect(getRelativeTime(date)).toBe('2d ago');
  });

  it('should return formatted date for times over a week', () => {
    const date = new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000); // 10 days ago
    const result = getRelativeTime(date);

    expect(result).toMatch(/Jan|5/); // Should show the date
    expect(result).not.toContain('ago');
  });

  it('should handle date strings', () => {
    const dateString = new Date(now.getTime() - 2 * 60 * 1000).toISOString(); // 2 minutes ago
    expect(getRelativeTime(dateString)).toBe('2m ago');
  });

  it('should handle edge case of exactly 1 minute', () => {
    const date = new Date(now.getTime() - 60 * 1000); // 1 minute ago
    expect(getRelativeTime(date)).toBe('1m ago');
  });

  it('should handle edge case of exactly 1 hour', () => {
    const date = new Date(now.getTime() - 60 * 60 * 1000); // 1 hour ago
    expect(getRelativeTime(date)).toBe('1h ago');
  });

  it('should handle edge case of exactly 1 day', () => {
    const date = new Date(now.getTime() - 24 * 60 * 60 * 1000); // 1 day ago
    expect(getRelativeTime(date)).toBe('1d ago');
  });

  it('should handle edge case of exactly 7 days', () => {
    const date = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000); // 7 days ago
    const result = getRelativeTime(date);

    // Should show formatted date, not "7d ago"
    expect(result).not.toContain('7d ago');
  });

  it('should round down for partial intervals', () => {
    const date = new Date(now.getTime() - 90 * 1000); // 1.5 minutes ago
    expect(getRelativeTime(date)).toBe('1m ago');
  });

  it('should handle very recent times', () => {
    const date = new Date(now.getTime() - 1000); // 1 second ago
    expect(getRelativeTime(date)).toBe('just now');
  });
});
