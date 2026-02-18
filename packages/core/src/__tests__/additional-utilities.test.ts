import { describe, it, expect, vi } from 'vitest';
import {
  // Additional utilities that may need more comprehensive tests
  slugify,
  generateBranchName,
  calculateCost,
  deepMerge,
  safeJsonParse,
  extractCodeBlocks,
  retry,
  createDeferred,
} from '../utils.js';

describe('Additional Utility Coverage', () => {
  describe('slugify edge cases', () => {
    it('handles unicode characters', () => {
      expect(slugify('Café & Résumé')).toBe('caf-rsum');
      expect(slugify('测试文字')).toBe(''); // Non-ASCII chars removed
    });

    it('handles numbers and underscores', () => {
      expect(slugify('Feature_123_Test')).toBe('feature-123-test');
      expect(slugify('v2.1.0-alpha')).toBe('v210-alpha');
    });

    it('removes leading and trailing special chars', () => {
      expect(slugify('!!!Hello World!!!')).toBe('hello-world');
      expect(slugify('---test---')).toBe('test');
    });

    it('handles empty and whitespace strings', () => {
      expect(slugify('')).toBe('');
      expect(slugify('   ')).toBe('');
      expect(slugify('!!!')).toBe('');
    });

    it('normalizes multiple consecutive special chars', () => {
      expect(slugify('hello...world???test')).toBe('hello-world-test');
      expect(slugify('test___with___underscores')).toBe('test-with-underscores');
    });
  });

  describe('generateBranchName edge cases', () => {
    it('handles various prefix formats', () => {
      expect(generateBranchName('feature/', 'task_123_abc', 'Test')).toMatch(/^feature\/123-test$/);
      expect(generateBranchName('hotfix/', 'task_456_def', 'Fix Bug')).toMatch(/^hotfix\/456-fix-bug$/);
      expect(generateBranchName('', 'task_789_ghi', 'No Prefix')).toMatch(/^789-no-prefix$/);
    });

    it('handles task IDs without underscores', () => {
      expect(generateBranchName('feature/', 'shortid', 'Test Feature')).toMatch(/^feature\/shortid-test-feature$/);
      expect(generateBranchName('fix/', 'bug123', 'Quick Fix')).toMatch(/^fix\/bug123-quick-fix$/);
    });

    it('truncates long descriptions appropriately', () => {
      const longDescription = 'This is a very long description that should be truncated to fit within reasonable branch name limits';
      const result = generateBranchName('feature/', 'task_123_abc', longDescription);
      expect(result.length).toBeLessThan(80); // Reasonable branch name length
      expect(result).toMatch(/^feature\/123-this-is-a-very-long-description-that-should-be$/);
    });

    it('handles special characters in descriptions', () => {
      expect(generateBranchName('feature/', 'task_123_abc', 'Fix (critical) bug!')).toMatch(/^feature\/123-fix-critical-bug$/);
      expect(generateBranchName('chore/', 'task_456_def', 'Update package.json & README')).toMatch(/^chore\/456-update-packagejson-readme$/);
    });
  });

  describe('calculateCost precision and edge cases', () => {
    it('handles very small token counts', () => {
      expect(calculateCost(1, 1)).toBe(0.0000); // Rounded to 4 decimal places
      expect(calculateCost(10, 10)).toBe(0.0002); // Should be 0.00018, rounded to 0.0002
    });

    it('handles large token counts', () => {
      const cost = calculateCost(10_000_000, 5_000_000); // 10M input, 5M output
      expect(cost).toBe(105.0000); // (10 * 3) + (5 * 15) = 105
    });

    it('handles asymmetric token usage', () => {
      expect(calculateCost(1_000_000, 0)).toBe(3.0000); // Only input cost
      expect(calculateCost(0, 1_000_000)).toBe(15.0000); // Only output cost
    });

    it('maintains precision for edge cases', () => {
      const cost = calculateCost(333, 333); // Should result in fractional cost
      expect(typeof cost).toBe('number');
      expect(cost).toBeGreaterThan(0);
      expect(cost.toString().split('.')[1]?.length || 0).toBeLessThanOrEqual(4);
    });
  });

  describe('deepMerge advanced scenarios', () => {
    it('handles null and undefined values', () => {
      expect(deepMerge({ a: null }, { a: undefined })).toEqual({ a: undefined });
      expect(deepMerge({ a: 1 }, { a: null })).toEqual({ a: null });
      expect(deepMerge({ a: 1 }, { a: undefined })).toEqual({ a: 1 });
    });

    it('handles mixed data types', () => {
      const target = { a: 1, b: 'string', c: true };
      const source = { a: 'replaced', d: false };
      expect(deepMerge(target, source)).toEqual({
        a: 'replaced',
        b: 'string',
        c: true,
        d: false
      });
    });

    it('handles deeply nested structures', () => {
      const target = {
        level1: {
          level2: {
            level3: {
              value: 'original'
            }
          }
        }
      };
      const source = {
        level1: {
          level2: {
            level3: {
              newValue: 'added'
            },
            newLevel2: 'added'
          }
        }
      };

      const result = deepMerge(target, source);
      expect(result).toEqual({
        level1: {
          level2: {
            level3: {
              value: 'original',
              newValue: 'added'
            },
            newLevel2: 'added'
          }
        }
      });
    });

    it('replaces arrays instead of merging', () => {
      const target = {
        items: [1, 2, 3],
        nested: {
          arr: ['a', 'b']
        }
      };
      const source = {
        items: [4, 5],
        nested: {
          arr: ['c']
        }
      };

      const result = deepMerge(target, source);
      expect(result.items).toEqual([4, 5]);
      expect(result.nested.arr).toEqual(['c']);
    });

    it('preserves object references correctly', () => {
      const original = { nested: { value: 1 } };
      const source = { other: 2 };
      const result = deepMerge(original, source);

      // Should not mutate original
      expect(original.nested.value).toBe(1);
      expect(result.nested).not.toBe(original.nested); // Should be a copy
      expect(result).toEqual({ nested: { value: 1 }, other: 2 });
    });
  });

  describe('safeJsonParse edge cases', () => {
    it('handles various JSON types', () => {
      expect(safeJsonParse('null', 'fallback')).toBeNull();
      expect(safeJsonParse('true', false)).toBe(true);
      expect(safeJsonParse('123', 0)).toBe(123);
      expect(safeJsonParse('"string"', 'fallback')).toBe('string');
      expect(safeJsonParse('[]', null)).toEqual([]);
    });

    it('handles complex valid JSON', () => {
      const complexJson = JSON.stringify({
        users: [
          { id: 1, name: 'Alice', settings: { theme: 'dark' } },
          { id: 2, name: 'Bob', settings: { theme: 'light' } }
        ],
        metadata: { version: '1.0', lastUpdated: '2024-01-01T00:00:00Z' }
      });

      const result = safeJsonParse(complexJson, {});
      expect(result.users).toHaveLength(2);
      expect(result.metadata.version).toBe('1.0');
    });

    it('handles various malformed JSON', () => {
      const malformedCases = [
        '{"key": value}', // unquoted value
        '{"key": "value",}', // trailing comma
        '{key: "value"}', // unquoted key
        '{"key": "value"', // missing closing brace
        'undefined',
        'function() {}',
        'new Date()',
      ];

      malformedCases.forEach(json => {
        expect(safeJsonParse(json, 'fallback')).toBe('fallback');
      });
    });

    it('preserves fallback object references', () => {
      const fallback = { default: true };
      const result = safeJsonParse('invalid', fallback);
      expect(result).toBe(fallback); // Should be same reference
    });
  });

  describe('extractCodeBlocks advanced cases', () => {
    it('handles nested code blocks in markdown', () => {
      const markdown = `
# Example

\`\`\`markdown
This is markdown with code:
\\\`\\\`\\\`javascript
console.log('nested');
\\\`\\\`\\\`
\`\`\`

\`\`\`typescript
interface User {
  name: string;
}
\`\`\`
      `;

      const blocks = extractCodeBlocks(markdown);
      expect(blocks).toHaveLength(2);
      expect(blocks[0].language).toBe('markdown');
      expect(blocks[0].code).toContain('```javascript');
      expect(blocks[1].language).toBe('typescript');
      expect(blocks[1].code).toContain('interface User');
    });

    it('handles various language identifiers', () => {
      const markdown = `
\`\`\`js
console.log('js');
\`\`\`

\`\`\`ts
const x: number = 1;
\`\`\`

\`\`\`bash
echo "hello"
\`\`\`

\`\`\`
no language specified
\`\`\`
      `;

      const blocks = extractCodeBlocks(markdown);
      expect(blocks).toHaveLength(4);
      expect(blocks.map(b => b.language)).toEqual(['js', 'ts', 'bash', 'plaintext']);
    });

    it('handles empty and whitespace-only code blocks', () => {
      const markdown = `
\`\`\`javascript

\`\`\`

\`\`\`python

\`\`\`

\`\`\`
\`\`\`
      `;

      const blocks = extractCodeBlocks(markdown);
      expect(blocks).toHaveLength(3);
      expect(blocks[0].code).toBe('');
      expect(blocks[1].code).toBe('');
      expect(blocks[2].code).toBe('');
    });

    it('preserves indentation and formatting', () => {
      const markdown = `
\`\`\`javascript
function example() {
  if (true) {
    console.log('indented');
  }
}
\`\`\`
      `;

      const blocks = extractCodeBlocks(markdown);
      expect(blocks[0].code).toContain('  if (true) {');
      expect(blocks[0].code).toContain('    console.log(\'indented\');');
    });
  });

  describe('retry advanced scenarios', () => {
    it('respects exponential backoff', async () => {
      let attempts = 0;
      const timestamps: number[] = [];

      const fn = () => {
        timestamps.push(Date.now());
        attempts++;
        return Promise.reject(new Error('fail'));
      };

      const startTime = Date.now();
      await expect(retry(fn, {
        maxAttempts: 3,
        initialDelay: 50,
        backoffFactor: 2
      })).rejects.toThrow();

      const totalTime = Date.now() - startTime;
      expect(attempts).toBe(3);
      expect(totalTime).toBeGreaterThan(100); // Should have delays: 50 + 100 ≈ 150ms
    });

    it('respects maxDelay limit', async () => {
      let attempts = 0;
      const fn = () => {
        attempts++;
        return Promise.reject(new Error('fail'));
      };

      const startTime = Date.now();
      await expect(retry(fn, {
        maxAttempts: 4,
        initialDelay: 1000,
        maxDelay: 100, // Lower than what exponential backoff would produce
        backoffFactor: 10
      })).rejects.toThrow();

      const totalTime = Date.now() - startTime;
      expect(attempts).toBe(4);
      // Even with high backoff factor, should be limited by maxDelay
      expect(totalTime).toBeLessThan(1000); // Should not take too long due to maxDelay
    });

    it('handles different error types', async () => {
      const customError = new Error('Custom error');
      customError.name = 'CustomError';

      const fn = vi.fn().mockRejectedValue(customError);

      await expect(retry(fn, { maxAttempts: 2 })).rejects.toThrow('Custom error');
      expect(fn).toHaveBeenCalledTimes(2);
    });

    it('preserves error stack traces', async () => {
      const originalError = new Error('Original error');
      const fn = vi.fn().mockRejectedValue(originalError);

      try {
        await retry(fn, { maxAttempts: 1 });
      } catch (error) {
        expect(error).toBe(originalError);
        expect(error.stack).toBeDefined();
      }
    });
  });

  describe('createDeferred advanced usage', () => {
    it('can be used for timeout patterns', async () => {
      const deferred = createDeferred<string>();

      // Simulate timeout
      const timeout = setTimeout(() => {
        deferred.reject(new Error('Timeout'));
      }, 100);

      // Simulate resolution before timeout
      setTimeout(() => {
        clearTimeout(timeout);
        deferred.resolve('success');
      }, 50);

      const result = await deferred.promise;
      expect(result).toBe('success');
    });

    it('can be used multiple times in sequence', async () => {
      const results: string[] = [];

      for (let i = 0; i < 3; i++) {
        const deferred = createDeferred<string>();
        setTimeout(() => deferred.resolve(`result${i}`), 10);
        const result = await deferred.promise;
        results.push(result);
      }

      expect(results).toEqual(['result0', 'result1', 'result2']);
    });

    it('handles promise chains correctly', async () => {
      const deferred = createDeferred<number>();

      setTimeout(() => deferred.resolve(42), 10);

      const result = await deferred.promise
        .then(x => x * 2)
        .then(x => x.toString());

      expect(result).toBe('84');
    });

    it('properly handles async/await patterns', async () => {
      const deferred = createDeferred<{ data: string }>();

      // Simulate async operation
      (async () => {
        await new Promise(resolve => setTimeout(resolve, 10));
        deferred.resolve({ data: 'async result' });
      })();

      const result = await deferred.promise;
      expect(result.data).toBe('async result');
    });
  });

  describe('Integration scenarios', () => {
    it('utilities work together for branch creation workflow', () => {
      const taskDescription = 'Implement OAuth 2.0 Authentication!!!';
      const taskId = 'task_1234567890_abcdef12';

      // Slugify description
      const slug = slugify(taskDescription);
      expect(slug).toBe('implement-oauth-20-authentication');

      // Generate branch name
      const branchName = generateBranchName('feature/', taskId, taskDescription);
      expect(branchName).toMatch(/^feature\/1234567890-implement-oauth-20-authentication$/);
    });

    it('utilities handle error scenarios gracefully', async () => {
      // Test error handling across utilities
      expect(safeJsonParse('invalid', null)).toBeNull();

      const deferred = createDeferred<string>();
      deferred.reject(new Error('Test error'));
      await expect(deferred.promise).rejects.toThrow('Test error');

      const failingFn = () => Promise.reject(new Error('Always fails'));
      await expect(retry(failingFn, { maxAttempts: 1 })).rejects.toThrow('Always fails');
    });

    it('utilities preserve data integrity through transformations', () => {
      const originalData = {
        config: {
          features: ['auth', 'api'],
          settings: { theme: 'dark' }
        }
      };

      // Deep merge preserves structure
      const updatedData = deepMerge(originalData, {
        config: {
          settings: { language: 'en' }
        }
      });

      expect(updatedData.config.features).toEqual(['auth', 'api']);
      expect(updatedData.config.settings).toEqual({ theme: 'dark', language: 'en' });

      // Original is not mutated
      expect(originalData.config.settings).toEqual({ theme: 'dark' });
    });
  });
});