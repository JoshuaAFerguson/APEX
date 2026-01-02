import { truncateToolOutput, TruncateOptions, TruncateResult } from '../utils.js';

describe('truncateToolOutput', () => {
  describe('basic functionality', () => {
    it('returns input unchanged when within maxLength limit', () => {
      const input = 'This is a short string';
      const result = truncateToolOutput(input, { maxLength: 100 });

      expect(result).toEqual({
        output: input,
        truncated: false,
        originalLength: input.length,
        truncatedLength: input.length,
      });
    });

    it('truncates long text with default suffix', () => {
      const input = 'A'.repeat(100);
      const result = truncateToolOutput(input, { maxLength: 50 });

      expect(result.output).toBe('A'.repeat(35) + '... [truncated]');
      expect(result.truncated).toBe(true);
      expect(result.originalLength).toBe(100);
      expect(result.truncatedLength).toBe(50);
    });

    it('truncates with custom suffix', () => {
      const input = 'Hello world this is a long string';
      const suffix = '...more';
      const result = truncateToolOutput(input, { maxLength: 20, suffix });

      expect(result.output).toBe('Hello world t...more');
      expect(result.truncated).toBe(true);
      expect(result.truncatedLength).toBe(20);
    });

    it('uses default options when no options provided', () => {
      const input = 'A'.repeat(15000); // Longer than default 10000
      const result = truncateToolOutput(input);

      expect(result.truncated).toBe(true);
      expect(result.output.endsWith('... [truncated]')).toBe(true);
      expect(result.truncatedLength).toBe(10000);
    });
  });

  describe('null and undefined input handling', () => {
    it('handles null input gracefully', () => {
      const result = truncateToolOutput(null as any);

      expect(result).toEqual({
        output: '',
        truncated: false,
        originalLength: 0,
        truncatedLength: 0,
      });
    });

    it('handles undefined input gracefully', () => {
      const result = truncateToolOutput(undefined as any);

      expect(result).toEqual({
        output: '',
        truncated: false,
        originalLength: 0,
        truncatedLength: 0,
      });
    });

    it('handles empty string input', () => {
      const result = truncateToolOutput('');

      expect(result).toEqual({
        output: '',
        truncated: false,
        originalLength: 0,
        truncatedLength: 0,
      });
    });
  });

  describe('word boundary truncation', () => {
    it('truncates at word boundaries when wordBoundary is true', () => {
      const input = 'The quick brown fox jumps over the lazy dog';
      const result = truncateToolOutput(input, { maxLength: 25, wordBoundary: true, suffix: '...' });

      // Should truncate at "fox" (word boundary) rather than mid-word
      expect(result.output).toBe('The quick brown fox...');
      expect(result.truncated).toBe(true);
    });

    it('truncates at newline boundaries when available', () => {
      const input = 'Line one\nLine two\nLine three\nLine four';
      const result = truncateToolOutput(input, { maxLength: 20, wordBoundary: true, suffix: '...' });

      // Should prefer newline boundary over space boundary
      expect(result.output).toBe('Line one\nLine two...');
      expect(result.truncated).toBe(true);
    });

    it('falls back to character truncation when word boundary is too far back', () => {
      const input = 'Supercalifragilisticexpialidocious_and_more_text_here';
      const result = truncateToolOutput(input, { maxLength: 25, wordBoundary: true, suffix: '...' });

      // Word boundary is too far back (no spaces within 90% of target), should use character truncation
      expect(result.output.length).toBe(25);
      expect(result.output.endsWith('...')).toBe(true);
      expect(result.truncated).toBe(true);
    });

    it('ignores word boundaries when wordBoundary is false', () => {
      const input = 'The quick brown fox jumps over the lazy dog';
      const result = truncateToolOutput(input, { maxLength: 25, wordBoundary: false, suffix: '...' });

      // Should truncate exactly at character limit
      expect(result.output).toBe('The quick brown fox ju...');
      expect(result.truncated).toBe(true);
    });
  });

  describe('JSON structure preservation', () => {
    it('preserves JSON structure for valid JSON arrays', () => {
      const jsonArray = JSON.stringify([
        { id: 1, name: 'Item 1', description: 'A long description that makes this JSON quite large' },
        { id: 2, name: 'Item 2', description: 'Another long description for this item' },
        { id: 3, name: 'Item 3', description: 'Yet another description' },
        { id: 4, name: 'Item 4', description: 'And one more description' },
      ], null, 2);

      const result = truncateToolOutput(jsonArray, { maxLength: 200, preserveJson: true });

      expect(result.truncated).toBe(true);
      expect(() => JSON.parse(result.output)).not.toThrow();

      const parsed = JSON.parse(result.output);
      expect(Array.isArray(parsed)).toBe(true);
      expect(parsed.length).toBeLessThan(4); // Should have truncated some items
      expect(parsed[parsed.length - 1]).toContain('more items'); // Should have truncation indicator
    });

    it('preserves JSON structure for valid JSON objects', () => {
      const jsonObject = JSON.stringify({
        users: [{ name: 'John' }, { name: 'Jane' }],
        metadata: { created: '2023-01-01', version: '1.0' },
        settings: { theme: 'dark', language: 'en' },
        longProperty: 'A very long string that takes up a lot of space in the JSON',
        anotherLongProperty: 'Another long string that makes the JSON even larger',
      }, null, 2);

      const result = truncateToolOutput(jsonObject, { maxLength: 150, preserveJson: true });

      expect(result.truncated).toBe(true);
      expect(() => JSON.parse(result.output)).not.toThrow();

      const parsed = JSON.parse(result.output);
      expect(typeof parsed).toBe('object');
      expect(Object.keys(parsed).length).toBeLessThan(5); // Should have truncated some properties
    });

    it('handles malformed JSON by falling back to text truncation', () => {
      const malformedJson = '{"name": "test", "value": unclosed string';
      const result = truncateToolOutput(malformedJson, { maxLength: 20, preserveJson: true, suffix: '...' });

      expect(result.truncated).toBe(true);
      expect(result.output).toBe('{"name": "test",...');
    });

    it('handles JSON primitives correctly', () => {
      const primitiveJson = '"This is a very long string that should be truncated properly"';
      const result = truncateToolOutput(primitiveJson, { maxLength: 30, preserveJson: true, suffix: '...' });

      expect(result.truncated).toBe(true);
      expect(result.output.endsWith('...')).toBe(true);
    });

    it('disables JSON preservation when preserveJson is false', () => {
      const jsonArray = JSON.stringify([
        { name: 'Item 1', description: 'Long description' },
        { name: 'Item 2', description: 'Another long description' },
      ], null, 2);

      const result = truncateToolOutput(jsonArray, { maxLength: 50, preserveJson: false, suffix: '...' });

      expect(result.truncated).toBe(true);
      expect(result.output.length).toBe(50);
      expect(result.output.endsWith('...')).toBe(true);
    });

    it('handles JSON that becomes too large even after intelligent truncation', () => {
      // Create a JSON with many short properties that can't be easily truncated
      const manyProperties: Record<string, string> = {};
      for (let i = 0; i < 100; i++) {
        manyProperties[`key${i}`] = 'value';
      }
      const largeJson = JSON.stringify(manyProperties, null, 2);

      const result = truncateToolOutput(largeJson, { maxLength: 100, preserveJson: true });

      expect(result.truncated).toBe(true);
      expect(result.output.length).toBeLessThanOrEqual(100);
    });
  });

  describe('edge cases and error conditions', () => {
    it('handles very small maxLength values', () => {
      const input = 'Hello world';
      const result = truncateToolOutput(input, { maxLength: 5, suffix: '...' });

      expect(result.output).toBe('He...');
      expect(result.truncated).toBe(true);
      expect(result.truncatedLength).toBe(5);
    });

    it('handles maxLength smaller than suffix', () => {
      const input = 'Hello world';
      const result = truncateToolOutput(input, { maxLength: 2, suffix: '...' });

      // Should still try to honor maxLength even if suffix is longer
      expect(result.output.length).toBeLessThanOrEqual(5); // At most suffix length
      expect(result.truncated).toBe(true);
    });

    it('handles empty suffix', () => {
      const input = 'Hello world this is a long string';
      const result = truncateToolOutput(input, { maxLength: 20, suffix: '' });

      expect(result.output).toBe('Hello world this is ');
      expect(result.truncated).toBe(true);
      expect(result.truncatedLength).toBe(20);
    });

    it('handles zero maxLength', () => {
      const input = 'Hello world';
      const result = truncateToolOutput(input, { maxLength: 0 });

      expect(result.output).toBe('... [truncated]');
      expect(result.truncated).toBe(true);
    });

    it('handles negative maxLength', () => {
      const input = 'Hello world';
      const result = truncateToolOutput(input, { maxLength: -10 });

      expect(result.output).toBe('... [truncated]');
      expect(result.truncated).toBe(true);
    });

    it('handles whitespace-only input', () => {
      const input = '   \n\t   \n   ';
      const result = truncateToolOutput(input, { maxLength: 5 });

      expect(result.output.length).toBeLessThanOrEqual(5);
      if (result.truncated) {
        expect(result.output.endsWith('... [truncated]')).toBe(true);
      }
    });
  });

  describe('configuration combinations', () => {
    it('handles all options disabled/minimal', () => {
      const input = 'The quick brown fox jumps over the lazy dog';
      const result = truncateToolOutput(input, {
        maxLength: 25,
        suffix: '',
        preserveJson: false,
        wordBoundary: false,
      });

      expect(result.output).toBe(input.substring(0, 25));
      expect(result.truncated).toBe(true);
    });

    it('handles all options enabled/maximal', () => {
      const jsonInput = JSON.stringify({
        message: 'The quick brown fox jumps over the lazy dog',
        data: [1, 2, 3, 4, 5],
      });

      const result = truncateToolOutput(jsonInput, {
        maxLength: 80,
        suffix: ' [MORE]',
        preserveJson: true,
        wordBoundary: true,
      });

      expect(result.truncated).toBe(true);
      // Should be valid JSON (preserve structure)
      if (!result.output.includes('[MORE]')) {
        expect(() => JSON.parse(result.output)).not.toThrow();
      }
    });

    it('ensures output length never exceeds maxLength (within reason)', () => {
      const inputs = [
        'Short text',
        'A'.repeat(1000),
        JSON.stringify({ key: 'A'.repeat(500) }),
        'Word boundary test with many words that should be truncated nicely',
      ];

      inputs.forEach(input => {
        const maxLength = 50;
        const result = truncateToolOutput(input, { maxLength });

        // Allow small buffer for edge cases in JSON processing
        expect(result.output.length).toBeLessThanOrEqual(maxLength + 10);
      });
    });
  });

  describe('real-world scenarios', () => {
    it('handles typical API response', () => {
      const apiResponse = JSON.stringify({
        status: 'success',
        data: [
          { id: 1, name: 'User 1', email: 'user1@example.com', profile: { age: 25, city: 'New York' }},
          { id: 2, name: 'User 2', email: 'user2@example.com', profile: { age: 30, city: 'San Francisco' }},
          { id: 3, name: 'User 3', email: 'user3@example.com', profile: { age: 28, city: 'Chicago' }},
        ],
        pagination: { total: 100, page: 1, limit: 10 },
      }, null, 2);

      const result = truncateToolOutput(apiResponse, { maxLength: 200 });

      expect(result.truncated).toBe(true);
      expect(() => JSON.parse(result.output)).not.toThrow();
    });

    it('handles log output with timestamps', () => {
      const logOutput = `
2024-01-01 10:00:00 INFO Starting application
2024-01-01 10:00:01 DEBUG Loading configuration
2024-01-01 10:00:02 INFO Database connection established
2024-01-01 10:00:03 WARN Cache miss for key: user_profile_12345
2024-01-01 10:00:04 ERROR Failed to process request: timeout after 30 seconds
2024-01-01 10:00:05 INFO Retrying request with exponential backoff
2024-01-01 10:00:10 INFO Request completed successfully
      `.trim();

      const result = truncateToolOutput(logOutput, { maxLength: 200, wordBoundary: true });

      expect(result.truncated).toBe(true);
      expect(result.output.includes('2024-01-01')).toBe(true);
    });

    it('handles code snippet with syntax', () => {
      const codeSnippet = `
function calculateTotal(items) {
  let total = 0;
  for (const item of items) {
    total += item.price * item.quantity;
    if (item.discount) {
      total -= item.discount;
    }
  }
  return Math.round(total * 100) / 100;
}

const cart = [
  { price: 10.99, quantity: 2 },
  { price: 5.50, quantity: 1, discount: 1.00 },
];

console.log('Total:', calculateTotal(cart));
      `.trim();

      const result = truncateToolOutput(codeSnippet, { maxLength: 150, wordBoundary: true });

      expect(result.truncated).toBe(true);
      // Should try to break at reasonable points (newlines/spaces)
      expect(result.output.includes('function')).toBe(true);
    });

    it('handles mixed content (JSON with embedded text)', () => {
      const mixedContent = JSON.stringify({
        type: 'chat_message',
        content: 'This is a very long chat message that contains a lot of text and should be truncated properly while maintaining the JSON structure integrity',
        metadata: {
          timestamp: '2024-01-01T10:00:00Z',
          user: 'john_doe',
          channel: 'general',
        },
        attachments: [
          { type: 'image', url: 'https://example.com/image1.jpg' },
          { type: 'file', url: 'https://example.com/document.pdf', name: 'report.pdf' },
        ],
      }, null, 2);

      const result = truncateToolOutput(mixedContent, { maxLength: 200, preserveJson: true });

      expect(result.truncated).toBe(true);
      expect(() => JSON.parse(result.output)).not.toThrow();
    });
  });
});