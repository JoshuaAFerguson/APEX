import { formatElapsed, truncateToolOutput, type TruncateOptions } from '../utils.js';

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
});

describe('truncateToolOutput', () => {
  describe('basic truncation functionality', () => {
    it('returns content as-is when under the limit', () => {
      const content = 'Short content that is under the limit';
      const result = truncateToolOutput(content, { maxLength: 100 });

      expect(result.output).toBe(content);
      expect(result.truncated).toBe(false);
      expect(result.originalLength).toBe(content.length);
      expect(result.truncatedLength).toBe(content.length);
    });

    it('truncates content when over the limit', () => {
      const content = 'This is a very long piece of content that exceeds the maximum length limit and should be truncated';
      const maxLength = 50;
      const result = truncateToolOutput(content, { maxLength });

      expect(result.output.length).toBeLessThanOrEqual(maxLength);
      expect(result.truncated).toBe(true);
      expect(result.originalLength).toBe(content.length);
      expect(result.truncatedLength).toBe(result.output.length);
      expect(result.output).toContain('... [truncated]');
    });

    it('uses default maxLength of 10,000 when not specified', () => {
      const content = 'A'.repeat(20000);
      const result = truncateToolOutput(content);

      expect(result.truncated).toBe(true);
      expect(result.output.length).toBeLessThanOrEqual(10000);
    });

    it('uses custom suffix when provided', () => {
      const content = 'This is a long piece of content that needs truncation';
      const customSuffix = ' ...MORE...';
      const result = truncateToolOutput(content, { maxLength: 30, suffix: customSuffix });

      expect(result.output).toContain(customSuffix);
      expect(result.truncated).toBe(true);
    });
  });

  describe('edge cases and error handling', () => {
    it('handles null input gracefully', () => {
      // @ts-expect-error Testing null input
      const result = truncateToolOutput(null);

      expect(result.output).toBe('');
      expect(result.truncated).toBe(false);
      expect(result.originalLength).toBe(0);
      expect(result.truncatedLength).toBe(0);
    });

    it('handles undefined input gracefully', () => {
      // @ts-expect-error Testing undefined input
      const result = truncateToolOutput(undefined);

      expect(result.output).toBe('');
      expect(result.truncated).toBe(false);
      expect(result.originalLength).toBe(0);
      expect(result.truncatedLength).toBe(0);
    });

    it('handles empty string', () => {
      const result = truncateToolOutput('');

      expect(result.output).toBe('');
      expect(result.truncated).toBe(false);
      expect(result.originalLength).toBe(0);
      expect(result.truncatedLength).toBe(0);
    });

    it('handles content exactly at the limit', () => {
      const content = 'A'.repeat(100);
      const result = truncateToolOutput(content, { maxLength: 100 });

      expect(result.output).toBe(content);
      expect(result.truncated).toBe(false);
      expect(result.originalLength).toBe(100);
      expect(result.truncatedLength).toBe(100);
    });

    it('handles very small maxLength values', () => {
      const content = 'This is some content';
      const result = truncateToolOutput(content, { maxLength: 5, suffix: '...' });

      expect(result.output.length).toBeLessThanOrEqual(5);
      expect(result.truncated).toBe(true);
      expect(result.output).toBe('..'); // Should be 'AA...' but limited by maxLength
    });
  });

  describe('word boundary truncation', () => {
    it('truncates at word boundaries when enabled', () => {
      const content = 'This is a sentence with multiple words that needs truncation';
      const result = truncateToolOutput(content, {
        maxLength: 30,
        wordBoundary: true,
        suffix: '...'
      });

      expect(result.truncated).toBe(true);
      // Should not end in the middle of a word
      const outputWithoutSuffix = result.output.replace('...', '');
      expect(outputWithoutSuffix).toMatch(/\s$/);
    });

    it('falls back to character truncation if word boundary is too far back', () => {
      const content = 'Averylongwordwithoutspaces' + ' short words after';
      const result = truncateToolOutput(content, {
        maxLength: 35,
        wordBoundary: true,
        suffix: '...'
      });

      expect(result.truncated).toBe(true);
      // Should have fallen back to character truncation
      expect(result.output.length).toBeLessThanOrEqual(35);
    });

    it('prefers newlines over spaces for word boundaries', () => {
      const content = 'First line with words\nSecond line with more words that continue';
      const result = truncateToolOutput(content, {
        maxLength: 40,
        wordBoundary: true,
        suffix: '...'
      });

      expect(result.truncated).toBe(true);
      // Should prefer breaking at newline
      expect(result.output).toContain('\n');
    });

    it('disables word boundary truncation when wordBoundary is false', () => {
      const content = 'This is a sentence with multiple words';
      const result = truncateToolOutput(content, {
        maxLength: 20,
        wordBoundary: false,
        suffix: '...'
      });

      expect(result.truncated).toBe(true);
      expect(result.output.length).toBeLessThanOrEqual(20);
    });
  });

  describe('JSON preservation', () => {
    it('preserves JSON structure when truncating valid JSON', () => {
      const jsonContent = JSON.stringify({
        users: [
          { id: 1, name: 'John Doe', email: 'john@example.com' },
          { id: 2, name: 'Jane Smith', email: 'jane@example.com' },
          { id: 3, name: 'Bob Johnson', email: 'bob@example.com' }
        ]
      }, null, 2);

      const result = truncateToolOutput(jsonContent, {
        maxLength: 150,
        preserveJson: true
      });

      expect(result.truncated).toBe(true);
      expect(() => JSON.parse(result.output.replace('... [truncated]', ''))).not.toThrow();
    });

    it('preserves JSON object structure when truncating', () => {
      const jsonContent = JSON.stringify({
        prop1: 'value1',
        prop2: 'value2',
        prop3: 'value3',
        prop4: 'value4',
        prop5: 'very long value that makes this JSON quite large'
      }, null, 2);

      const result = truncateToolOutput(jsonContent, {
        maxLength: 100,
        preserveJson: true
      });

      expect(result.truncated).toBe(true);

      const outputWithoutSuffix = result.output.replace('... [truncated]', '');
      let parsed;
      expect(() => {
        parsed = JSON.parse(outputWithoutSuffix);
      }).not.toThrow();

      // Should contain some original properties
      expect(typeof parsed).toBe('object');
    });

    it('preserves JSON array structure when truncating', () => {
      const longArray = Array.from({ length: 100 }, (_, i) => ({
        id: i,
        name: `Item ${i}`,
        description: `This is item number ${i} with a longer description`
      }));

      const jsonContent = JSON.stringify(longArray, null, 2);
      const result = truncateToolOutput(jsonContent, {
        maxLength: 500,
        preserveJson: true
      });

      expect(result.truncated).toBe(true);

      const outputWithoutSuffix = result.output.replace('... [truncated]', '');
      let parsed;
      expect(() => {
        parsed = JSON.parse(outputWithoutSuffix);
      }).not.toThrow();

      expect(Array.isArray(parsed)).toBe(true);
      expect(parsed.length).toBeGreaterThan(0);
      expect(parsed.length).toBeLessThan(longArray.length);
    });

    it('falls back to regular truncation when JSON preservation fails', () => {
      const invalidJson = '{ "key": "value", "incomplete": ';
      const result = truncateToolOutput(invalidJson, {
        maxLength: 20,
        preserveJson: true
      });

      expect(result.truncated).toBe(true);
      expect(result.output.length).toBeLessThanOrEqual(20);
      expect(result.output).toContain('... [truncated]');
    });

    it('disables JSON preservation when preserveJson is false', () => {
      const jsonContent = JSON.stringify({
        prop1: 'value1',
        prop2: 'value2 with a very long value that would cause truncation'
      });

      const result = truncateToolOutput(jsonContent, {
        maxLength: 50,
        preserveJson: false
      });

      expect(result.truncated).toBe(true);
      expect(result.output.length).toBeLessThanOrEqual(50);
      // Should be simple character truncation
      expect(result.output).toContain('... [truncated]');
    });

    it('handles JSON with primitive values correctly', () => {
      const jsonContent = '"This is a simple JSON string that is quite long and needs truncation"';
      const result = truncateToolOutput(jsonContent, {
        maxLength: 30,
        preserveJson: true
      });

      expect(result.truncated).toBe(true);
      expect(result.output.length).toBeLessThanOrEqual(30);
      expect(result.output).toContain('... [truncated]');
    });
  });

  describe('comprehensive integration scenarios', () => {
    it('handles large tool output with mixed content', () => {
      const content = `
Command executed successfully.

Output:
${JSON.stringify({
  results: Array.from({ length: 50 }, (_, i) => `Result ${i}`),
  metadata: {
    timestamp: '2024-01-01T00:00:00Z',
    duration: '5.23s',
    status: 'completed'
  }
}, null, 2)}

Additional notes and information that comes after the JSON content.
This might include error messages, warnings, or other contextual information.
      `.trim();

      const result = truncateToolOutput(content, { maxLength: 1000 });

      expect(result.truncated).toBe(true);
      expect(result.output.length).toBeLessThanOrEqual(1000);
      expect(result.originalLength).toBe(content.length);
    });

    it('handles multiline text with various content types', () => {
      const content = `
=== Test Results ===

Unit Tests: ✓ 45 passed, ✗ 3 failed
Integration Tests: ✓ 12 passed
Coverage: 87.5%

Failed Tests:
- test_user_authentication.py::test_invalid_credentials
- test_database.py::test_connection_timeout
- test_api.py::test_rate_limiting

Detailed Error Messages:
${JSON.stringify({
  errors: [
    { test: 'test_invalid_credentials', message: 'Expected 401, got 500' },
    { test: 'test_connection_timeout', message: 'Connection did not timeout as expected' }
  ]
}, null, 2)}

Next steps:
1. Fix the authentication validation
2. Review database timeout configuration
3. Check rate limiting implementation
      `.trim();

      const result = truncateToolOutput(content, {
        maxLength: 500,
        wordBoundary: true,
        preserveJson: true
      });

      expect(result.truncated).toBe(true);
      expect(result.output.length).toBeLessThanOrEqual(500);
    });

    it('preserves important context when truncating at boundaries', () => {
      const content = 'Error occurred while processing request. Details: ' +
                     JSON.stringify({
                       error: 'Database connection failed',
                       code: 'DB_CONNECTION_ERROR',
                       timestamp: '2024-01-01T00:00:00Z',
                       stack: 'Very long stack trace here...'.repeat(20)
                     }, null, 2);

      const result = truncateToolOutput(content, {
        maxLength: 200,
        preserveJson: true,
        wordBoundary: true
      });

      expect(result.truncated).toBe(true);
      expect(result.output).toContain('Error occurred');
      expect(result.output.length).toBeLessThanOrEqual(200);
    });
  });

  describe('performance and edge cases', () => {
    it('handles very large input efficiently', () => {
      const largeContent = 'A'.repeat(100000);
      const startTime = Date.now();

      const result = truncateToolOutput(largeContent, { maxLength: 1000 });

      const endTime = Date.now();
      const executionTime = endTime - startTime;

      expect(result.truncated).toBe(true);
      expect(result.output.length).toBeLessThanOrEqual(1000);
      expect(executionTime).toBeLessThan(100); // Should execute quickly
    });

    it('handles content with special characters and unicode', () => {
      const content = 'Unicode content: 🚀 🎉 🌟 • Special chars: @#$%^&*() • Accents: café naïve résumé';
      const result = truncateToolOutput(content, { maxLength: 40 });

      expect(result.truncated).toBe(true);
      expect(result.output.length).toBeLessThanOrEqual(40);
      // Should handle unicode characters properly
      expect(result.output).toMatch(/[🚀🎉🌟]/);
    });

    it('respects suffix length in final output', () => {
      const content = 'Content that needs truncation';
      const customSuffix = ' [VERY_LONG_TRUNCATION_INDICATOR]';
      const maxLength = 50;

      const result = truncateToolOutput(content, {
        maxLength,
        suffix: customSuffix
      });

      expect(result.output.length).toBeLessThanOrEqual(maxLength);
      expect(result.output).toContain(customSuffix);
    });
  });

  describe('configuration edge cases', () => {
    it('handles all options set to false/minimal values', () => {
      const content = 'Some content that will be truncated';
      const result = truncateToolOutput(content, {
        maxLength: 15,
        suffix: '',
        preserveJson: false,
        wordBoundary: false
      });

      expect(result.truncated).toBe(true);
      expect(result.output.length).toBeLessThanOrEqual(15);
      expect(result.output).not.toContain('truncated');
    });

    it('handles zero maxLength gracefully', () => {
      const content = 'Some content';
      const result = truncateToolOutput(content, { maxLength: 0 });

      expect(result.truncated).toBe(true);
      expect(result.output).toBe('... [truncated]'); // Just the suffix
    });

    it('handles negative maxLength gracefully', () => {
      const content = 'Some content';
      const result = truncateToolOutput(content, { maxLength: -10 });

      expect(result.truncated).toBe(true);
      // Should handle this gracefully, likely treating as 0 or very small value
    });
  });
});