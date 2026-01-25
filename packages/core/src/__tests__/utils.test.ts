import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  formatDuration,
  formatElapsed,
  formatTokens,
  formatCost,
  truncate,
  truncateToolOutput,
  generateTaskId,
  generateIdleTaskId,
  generateTaskTemplateId,
  generateApprovalId,
} from '../utils.js';

describe('Utility Functions', () => {
  // ============================================================================
  // Formatting Functions Tests
  // ============================================================================

  describe('formatDuration', () => {
    it('formats milliseconds correctly', () => {
      expect(formatDuration(500)).toBe('500ms');
      expect(formatDuration(999)).toBe('999ms');
      expect(formatDuration(0)).toBe('0ms');
      expect(formatDuration(1)).toBe('1ms');
    });

    it('formats seconds correctly', () => {
      expect(formatDuration(1000)).toBe('1.0s');
      expect(formatDuration(1500)).toBe('1.5s');
      expect(formatDuration(2500)).toBe('2.5s');
      expect(formatDuration(59999)).toBe('60.0s');
    });

    it('formats minutes and seconds correctly', () => {
      expect(formatDuration(60000)).toBe('1m 0s'); // 1 minute
      expect(formatDuration(65000)).toBe('1m 5s'); // 1 minute 5 seconds
      expect(formatDuration(125000)).toBe('2m 5s'); // 2 minutes 5 seconds
      expect(formatDuration(3599000)).toBe('59m 59s'); // 59 minutes 59 seconds
    });

    it('formats hours and minutes correctly', () => {
      expect(formatDuration(3600000)).toBe('1h 0m'); // 1 hour
      expect(formatDuration(3725000)).toBe('1h 2m'); // 1 hour 2 minutes
      expect(formatDuration(7320000)).toBe('2h 2m'); // 2 hours 2 minutes
      expect(formatDuration(36000000)).toBe('10h 0m'); // 10 hours
    });

    it('handles edge cases', () => {
      // Very large durations
      expect(formatDuration(86400000)).toBe('24h 0m'); // 24 hours
      expect(formatDuration(90061000)).toBe('25h 1m'); // 25 hours 1 minute

      // Fractional seconds
      expect(formatDuration(1001)).toBe('1.0s');
      expect(formatDuration(1999)).toBe('2.0s');
    });
  });

  describe('formatElapsed', () => {
    it('formats sub-second durations as "0s"', () => {
      const startTime = new Date('2023-01-01T00:00:00.000Z');
      const currentTime = new Date('2023-01-01T00:00:00.500Z'); // 500ms later

      expect(formatElapsed(startTime, currentTime)).toBe('0s');
    });

    it('formats seconds only', () => {
      const startTime = new Date('2023-01-01T00:00:00Z');
      const currentTime = new Date('2023-01-01T00:00:42Z'); // 42 seconds later

      expect(formatElapsed(startTime, currentTime)).toBe('42s');
    });

    it('formats minutes and seconds', () => {
      const startTime = new Date('2023-01-01T00:00:00Z');
      const currentTime = new Date('2023-01-01T00:02:30Z'); // 2 minutes 30 seconds later

      expect(formatElapsed(startTime, currentTime)).toBe('2m 30s');
    });

    it('formats minutes only (no remaining seconds)', () => {
      const startTime = new Date('2023-01-01T00:00:00Z');
      const currentTime = new Date('2023-01-01T00:05:00Z'); // 5 minutes exactly

      expect(formatElapsed(startTime, currentTime)).toBe('5m');
    });

    it('formats hours and minutes', () => {
      const startTime = new Date('2023-01-01T00:00:00Z');
      const currentTime = new Date('2023-01-01T01:15:00Z'); // 1 hour 15 minutes later

      expect(formatElapsed(startTime, currentTime)).toBe('1h 15m');
    });

    it('formats hours only (no remaining minutes)', () => {
      const startTime = new Date('2023-01-01T00:00:00Z');
      const currentTime = new Date('2023-01-01T03:00:00Z'); // 3 hours exactly

      expect(formatElapsed(startTime, currentTime)).toBe('3h');
    });

    it('handles negative elapsed time (future start time)', () => {
      const startTime = new Date('2023-01-01T00:05:00Z'); // 5 minutes in future
      const currentTime = new Date('2023-01-01T00:00:00Z');

      expect(formatElapsed(startTime, currentTime)).toBe('0s');
    });

    it('uses current time by default', () => {
      const startTime = new Date(Date.now() - 5000); // 5 seconds ago

      const result = formatElapsed(startTime);

      // Should be approximately 5 seconds, allowing for execution time
      expect(result).toMatch(/^[45]s$/);
    });

    it('handles complex durations', () => {
      const startTime = new Date('2023-01-01T00:00:00Z');
      const currentTime = new Date('2023-01-01T02:30:45Z'); // 2 hours 30 minutes 45 seconds

      expect(formatElapsed(startTime, currentTime)).toBe('2h 30m');
    });

    it('handles edge case at exactly 1 second', () => {
      const startTime = new Date('2023-01-01T00:00:00Z');
      const currentTime = new Date('2023-01-01T00:00:01Z'); // exactly 1 second

      expect(formatElapsed(startTime, currentTime)).toBe('1s');
    });

    it('handles edge case at exactly 1 minute', () => {
      const startTime = new Date('2023-01-01T00:00:00Z');
      const currentTime = new Date('2023-01-01T00:01:00Z'); // exactly 1 minute

      expect(formatElapsed(startTime, currentTime)).toBe('1m');
    });

    it('handles edge case at exactly 1 hour', () => {
      const startTime = new Date('2023-01-01T00:00:00Z');
      const currentTime = new Date('2023-01-01T01:00:00Z'); // exactly 1 hour

      expect(formatElapsed(startTime, currentTime)).toBe('1h');
    });

    it('formats basic time differences correctly', () => {
      const startTime = new Date('2024-01-01T10:00:00Z');

      // Seconds
      expect(formatElapsed(startTime, new Date('2024-01-01T10:00:05Z'))).toBe('5s');
      expect(formatElapsed(startTime, new Date('2024-01-01T10:00:30Z'))).toBe('30s');

      // Minutes
      expect(formatElapsed(startTime, new Date('2024-01-01T10:02:00Z'))).toBe('2m');
      expect(formatElapsed(startTime, new Date('2024-01-01T10:02:30Z'))).toBe('2m 30s');

      // Hours
      expect(formatElapsed(startTime, new Date('2024-01-01T12:00:00Z'))).toBe('2h');
      expect(formatElapsed(startTime, new Date('2024-01-01T12:05:00Z'))).toBe('2h 5m');
    });
  });

  describe('formatTokens', () => {
    it('formats numbers with commas', () => {
      expect(formatTokens(42)).toBe('42');
      expect(formatTokens(1234)).toBe('1,234');
      expect(formatTokens(5678901)).toBe('5,678,901');
      expect(formatTokens(1000000)).toBe('1,000,000');
    });

    it('handles zero and negative numbers', () => {
      expect(formatTokens(0)).toBe('0');
      expect(formatTokens(-1234)).toBe('-1,234');
    });

    it('handles large numbers', () => {
      expect(formatTokens(999999999)).toBe('999,999,999');
      expect(formatTokens(1000000000)).toBe('1,000,000,000');
    });
  });

  describe('formatCost', () => {
    it('formats cost with 4 decimal places', () => {
      expect(formatCost(0.0042)).toBe('$0.0042');
      expect(formatCost(1.2345)).toBe('$1.2345');
      expect(formatCost(10)).toBe('$10.0000');
      expect(formatCost(0)).toBe('$0.0000');
    });

    it('handles various cost values', () => {
      expect(formatCost(0.0001)).toBe('$0.0001');
      expect(formatCost(999.9999)).toBe('$999.9999');
      expect(formatCost(1000)).toBe('$1000.0000');
    });

    it('handles fractional costs', () => {
      expect(formatCost(0.00001)).toBe('$0.0000');
      expect(formatCost(0.00005)).toBe('$0.0000');
      expect(formatCost(0.12345678)).toBe('$0.1235');
    });
  });

  // ============================================================================
  // Truncation Functions Tests
  // ============================================================================

  describe('truncate', () => {
    it('truncates strings longer than maxLength', () => {
      expect(truncate('This is a long string', 10)).toBe('This is...');
      expect(truncate('Hello world!', 8)).toBe('Hello...');
    });

    it('returns strings shorter than maxLength unchanged', () => {
      expect(truncate('Short', 10)).toBe('Short');
      expect(truncate('', 5)).toBe('');
    });

    it('uses custom suffix', () => {
      expect(truncate('Long content here', 8, ' [more]')).toBe('Lo [more]');
      expect(truncate('Test string', 6, '…')).toBe('Test …');
    });

    it('handles edge cases', () => {
      // Empty string
      expect(truncate('', 0)).toBe('');

      // MaxLength exactly equals string length
      expect(truncate('Hello', 5)).toBe('Hello');

      // MaxLength equals suffix length
      expect(truncate('Hello world', 3)).toBe('...');

      // MaxLength less than suffix length
      expect(truncate('Hello', 2)).toBe('He');
    });
  });

  describe('truncateToolOutput', () => {
    it('returns short content unchanged', () => {
      const shortContent = 'This is short content';
      const result = truncateToolOutput(shortContent);

      expect(result.output).toBe(shortContent);
      expect(result.truncated).toBe(false);
      expect(result.originalLength).toBe(shortContent.length);
      expect(result.truncatedLength).toBe(shortContent.length);
    });

    it('truncates long content', () => {
      const longContent = 'A'.repeat(15000);
      const result = truncateToolOutput(longContent, { maxLength: 100 });

      expect(result.output.length).toBeLessThanOrEqual(100);
      expect(result.truncated).toBe(true);
      expect(result.originalLength).toBe(15000);
      expect(result.output).toContain('... [truncated]');
    });

    it('handles JSON content with preserveJson option', () => {
      const jsonContent = JSON.stringify({
        items: [1, 2, 3, 4, 5],
        data: { name: 'test', value: 'example' },
        moreData: 'additional content'
      });

      const result = truncateToolOutput(jsonContent, {
        maxLength: 100,
        preserveJson: true
      });

      expect(result.truncated).toBe(true);
      expect(() => JSON.parse(result.output.replace('... [truncated]', ''))).not.toThrow();
    });

    it('truncates arrays in JSON', () => {
      const largeArray = JSON.stringify(Array.from({ length: 100 }, (_, i) => i));

      const result = truncateToolOutput(largeArray, {
        maxLength: 100,
        preserveJson: true
      });

      expect(result.truncated).toBe(true);
      expect(result.output).toContain('more items');
    });

    it('truncates objects in JSON', () => {
      const largeObject = JSON.stringify(
        Object.fromEntries(Array.from({ length: 50 }, (_, i) => [`prop${i}`, `value${i}`]))
      );

      const result = truncateToolOutput(largeObject, {
        maxLength: 200,
        preserveJson: true
      });

      expect(result.truncated).toBe(true);
      expect(result.output).toContain('more properties');
    });

    it('respects wordBoundary option', () => {
      const content = 'This is a very long sentence that should be truncated at word boundaries when possible.';

      const resultWithBoundary = truncateToolOutput(content, {
        maxLength: 50,
        wordBoundary: true
      });

      const resultWithoutBoundary = truncateToolOutput(content, {
        maxLength: 50,
        wordBoundary: false
      });

      expect(resultWithBoundary.output).not.toMatch(/\S\.\.\./); // Shouldn't cut mid-word
      expect(resultWithoutBoundary.output).toMatch(/\S\.\.\./); // May cut mid-word
    });

    it('uses custom suffix', () => {
      const longContent = 'A'.repeat(1000);
      const result = truncateToolOutput(longContent, {
        maxLength: 50,
        suffix: ' [CUTOFF]'
      });

      expect(result.output).toContain('[CUTOFF]');
      expect(result.output).not.toContain('[truncated]');
    });

    it('handles null and undefined input', () => {
      expect(truncateToolOutput(null as any)).toEqual({
        output: '',
        truncated: false,
        originalLength: 0,
        truncatedLength: 0
      });

      expect(truncateToolOutput(undefined as any)).toEqual({
        output: '',
        truncated: false,
        originalLength: 0,
        truncatedLength: 0
      });
    });

    it('handles invalid JSON gracefully', () => {
      const invalidJson = '{"invalid": json content}';
      const result = truncateToolOutput(invalidJson, {
        maxLength: 20,
        preserveJson: true
      });

      expect(result.truncated).toBe(true);
      expect(result.output).toContain('... [truncated]');
    });
  });

  // ============================================================================
  // ID Generation Functions Tests
  // ============================================================================

  describe('ID Generation Functions', () => {
    describe('generateTaskId', () => {
      it('generates ID with correct format', () => {
        const id = generateTaskId();
        expect(id).toMatch(/^task_[a-z0-9]+_[a-f0-9]{8}$/);
      });

      it('contains timestamp component', () => {
        const before = Date.now();
        const id = generateTaskId();
        const after = Date.now();

        const timestampPart = id.split('_')[1];
        const timestamp = parseInt(timestampPart, 36);

        expect(timestamp).toBeGreaterThanOrEqual(before);
        expect(timestamp).toBeLessThanOrEqual(after);
      });

      it('generates unique IDs', () => {
        const ids = new Set();
        for (let i = 0; i < 100; i++) {
          ids.add(generateTaskId());
        }
        expect(ids.size).toBe(100);
      });

      it('has consistent structure', () => {
        const id = generateTaskId();
        const parts = id.split('_');

        expect(parts).toHaveLength(3);
        expect(parts[0]).toBe('task');
        expect(parts[1]).toMatch(/^[a-z0-9]+$/);
        expect(parts[2]).toMatch(/^[a-f0-9]{8}$/);
      });
    });

    describe('generateIdleTaskId', () => {
      it('generates ID with correct format', () => {
        const id = generateIdleTaskId();
        expect(id).toMatch(/^idle_[a-z0-9]+_[a-f0-9]{8}$/);
      });

      it('starts with "idle_" prefix', () => {
        const id = generateIdleTaskId();
        expect(id).toMatch(/^idle_/);
      });

      it('generates unique IDs', () => {
        const ids = new Set();
        for (let i = 0; i < 50; i++) {
          ids.add(generateIdleTaskId());
        }
        expect(ids.size).toBe(50);
      });
    });

    describe('generateTaskTemplateId', () => {
      it('generates ID with correct format', () => {
        const id = generateTaskTemplateId();
        expect(id).toMatch(/^template_[a-z0-9]+_[a-f0-9]{8}$/);
      });

      it('starts with "template_" prefix', () => {
        const id = generateTaskTemplateId();
        expect(id).toMatch(/^template_/);
      });

      it('generates unique IDs', () => {
        const ids = new Set();
        for (let i = 0; i < 50; i++) {
          ids.add(generateTaskTemplateId());
        }
        expect(ids.size).toBe(50);
      });
    });

    describe('generateApprovalId', () => {
      it('generates ID with correct format', () => {
        const id = generateApprovalId();
        expect(id).toMatch(/^apr_[a-z0-9]+_[a-f0-9]{8}$/);
      });

      it('starts with "apr_" prefix', () => {
        const id = generateApprovalId();
        expect(id).toMatch(/^apr_/);
      });

      it('generates unique IDs', () => {
        const ids = new Set();
        for (let i = 0; i < 50; i++) {
          ids.add(generateApprovalId());
        }
        expect(ids.size).toBe(50);
      });
    });

    describe('ID generation collision resistance', () => {
      it('generates unique IDs across all functions', () => {
        const allIds = new Set();

        for (let i = 0; i < 25; i++) {
          allIds.add(generateTaskId());
          allIds.add(generateIdleTaskId());
          allIds.add(generateTaskTemplateId());
          allIds.add(generateApprovalId());
        }

        expect(allIds.size).toBe(100); // 25 * 4 functions
      });

      it('handles rapid generation without collisions', () => {
        const ids = new Set();

        // Generate IDs rapidly
        for (let i = 0; i < 1000; i++) {
          ids.add(generateTaskId());
        }

        expect(ids.size).toBe(1000);
      });
    });

    describe('ID component validation', () => {
      it('timestamp component is reasonable', () => {
        const id = generateTaskId();
        const timestampPart = id.split('_')[1];
        const timestamp = parseInt(timestampPart, 36);

        // Should be a reasonable timestamp (after year 2000, before year 2100)
        const year2000 = new Date('2000-01-01').getTime();
        const year2100 = new Date('2100-01-01').getTime();

        expect(timestamp).toBeGreaterThan(year2000);
        expect(timestamp).toBeLessThan(year2100);
      });

      it('random component has correct length', () => {
        const id = generateTaskId();
        const randomPart = id.split('_')[2];

        expect(randomPart).toHaveLength(8);
        expect(randomPart).toMatch(/^[a-f0-9]{8}$/);
      });
    });
  });

  // ============================================================================
  // Integration Tests
  // ============================================================================

  describe('Integration Tests', () => {
    it('formatting functions work together consistently', () => {
      const duration = 125000; // 2m 5s
      const tokens = 1234;
      const cost = 0.0042;

      expect(formatDuration(duration)).toBe('2m 5s');
      expect(formatTokens(tokens)).toBe('1,234');
      expect(formatCost(cost)).toBe('$0.0042');
    });

    it('truncation preserves important information', () => {
      const data = {
        duration: formatDuration(125000),
        tokens: formatTokens(1234),
        cost: formatCost(0.0042)
      };

      const jsonString = JSON.stringify(data, null, 2);
      const result = truncateToolOutput(jsonString, {
        maxLength: 100,
        preserveJson: true
      });

      expect(result.output).toContain('2m 5s');
    });

    it('ID generation is consistent across functions', () => {
      const taskId = generateTaskId();
      const idleId = generateIdleTaskId();
      const templateId = generateTaskTemplateId();
      const approvalId = generateApprovalId();

      // All should have timestamp components from similar time
      const extractTimestamp = (id: string) => parseInt(id.split('_')[1], 36);

      const taskTime = extractTimestamp(taskId);
      const idleTime = extractTimestamp(idleId);
      const templateTime = extractTimestamp(templateId);
      const approvalTime = extractTimestamp(approvalId);

      // All timestamps should be within 1 second of each other
      const maxDiff = Math.max(taskTime, idleTime, templateTime, approvalTime);
      const minDiff = Math.min(taskTime, idleTime, templateTime, approvalTime);

      expect(maxDiff - minDiff).toBeLessThan(1000);
    });
  });
});