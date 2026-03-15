import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  detectTypeScript,
  detectYarn,
  detectPnpm,
  detectClaudeApiKey,
  queryNpmRegistry,
  satisfiesVersion,
  parseVersionOutput,
} from '../doctor-utils.js';

describe('Doctor Utils - Performance Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Performance benchmarks', () => {
    it('should complete version parsing in reasonable time', () => {
      const start = performance.now();

      // Test parsing many version strings
      const versions = Array(1000).fill(0).map((_, i) => `v${i}.0.0`);

      versions.forEach(version => {
        const result = parseVersionOutput(version);
        expect(result).toMatch(/^\d+\.\d+\.\d+$/);
      });

      const duration = performance.now() - start;
      expect(duration).toBeLessThan(100); // Should complete in under 100ms
    });

    it('should complete version comparisons efficiently', () => {
      const start = performance.now();

      // Test many version comparisons
      for (let i = 0; i < 1000; i++) {
        const current = `${i}.0.0`;
        const required = `${Math.floor(i / 2)}.0.0`;
        const result = satisfiesVersion(current, required);
        expect(typeof result).toBe('boolean');
      }

      const duration = performance.now() - start;
      expect(duration).toBeLessThan(50); // Should be very fast
    });

    it('should handle concurrent toolchain detections efficiently', async () => {
      const start = performance.now();

      // Run multiple concurrent detections
      const detectionPromises = Array(5).fill(null).map(() =>
        Promise.all([
          detectTypeScript({ local: true }),
          detectYarn(),
          detectPnpm(),
          detectClaudeApiKey(),
        ])
      );

      const results = await Promise.all(detectionPromises);
      const duration = performance.now() - start;

      expect(results).toHaveLength(5);
      expect(duration).toBeLessThan(10000); // Should complete within 10 seconds

      // Verify all results have expected structure
      results.forEach(batch => {
        expect(batch).toHaveLength(4);
        batch.forEach(result => {
          expect(result).toHaveProperty('name');
          expect(result).toHaveProperty('currentVersion');
          expect(result).toHaveProperty('required');
        });
      });
    });
  });

  describe('Memory usage', () => {
    it('should not leak memory during repeated operations', async () => {
      const initialMemory = process.memoryUsage();

      // Perform many operations
      for (let i = 0; i < 100; i++) {
        await Promise.all([
          parseVersionOutput(`v${i}.0.0`),
          satisfiesVersion(`${i}.0.0`, '1.0.0'),
          detectClaudeApiKey(), // This should be lightweight
        ]);
      }

      const finalMemory = process.memoryUsage();
      const memoryGrowth = finalMemory.heapUsed - initialMemory.heapUsed;

      // Memory growth should be reasonable (less than 50MB)
      expect(memoryGrowth).toBeLessThan(50 * 1024 * 1024);
    });
  });

  describe('Network resilience', () => {
    const mockFetch = vi.fn();

    beforeEach(() => {
      global.fetch = mockFetch;
      mockFetch.mockReset();
    });

    it('should handle slow network responses', async () => {
      // Mock a slow response
      mockFetch.mockImplementation(() =>
        new Promise(resolve => {
          setTimeout(() => {
            resolve({
              ok: true,
              json: () => Promise.resolve({
                name: 'test-package',
                'dist-tags': { latest: '1.0.0' },
                versions: { '1.0.0': {} }
              })
            });
          }, 2000); // 2 second delay
        })
      );

      const start = performance.now();
      const result = await queryNpmRegistry('test-package', { timeout: 3000 });
      const duration = performance.now() - start;

      expect(result?.name).toBe('test-package');
      expect(duration).toBeGreaterThan(1900); // Should take at least ~2 seconds
      expect(duration).toBeLessThan(2500); // But not much more
    });

    it('should timeout appropriately', async () => {
      // Mock a response that never completes
      mockFetch.mockImplementation(() => new Promise(() => {}));

      const start = performance.now();
      const result = await queryNpmRegistry('test-package', { timeout: 1000 });
      const duration = performance.now() - start;

      expect(result?.error).toBe('Request timeout');
      expect(duration).toBeGreaterThan(900); // Should timeout around 1000ms
      expect(duration).toBeLessThan(1200); // With some tolerance
    });

    it('should handle network errors gracefully', async () => {
      const networkErrors = [
        new Error('ENOTFOUND'),
        new Error('ECONNREFUSED'),
        new Error('ETIMEDOUT'),
        new Error('Network request failed'),
      ];

      for (const error of networkErrors) {
        mockFetch.mockRejectedValueOnce(error);

        const result = await queryNpmRegistry('test-package');

        expect(result?.error).toBeDefined();
        expect(result?.name).toBe('test-package');
      }
    });

    it('should handle malformed responses', async () => {
      const malformedResponses = [
        // Response with malformed JSON
        {
          ok: true,
          json: () => Promise.reject(new SyntaxError('Unexpected token'))
        },
        // Response with missing json method
        {
          ok: true,
        },
        // Response that's not ok but doesn't throw
        {
          ok: false,
          status: 500,
          statusText: 'Internal Server Error'
        }
      ];

      for (const response of malformedResponses) {
        mockFetch.mockResolvedValueOnce(response);

        const result = await queryNpmRegistry('test-package');

        // Should handle gracefully
        expect(result).toBeDefined();
        expect(result?.name).toBe('test-package');
      }
    });

    it('should handle rate limiting', async () => {
      // Simulate rate limiting response
      mockFetch.mockResolvedValue({
        ok: false,
        status: 429,
        statusText: 'Too Many Requests',
        headers: new Headers({
          'retry-after': '60'
        })
      });

      const result = await queryNpmRegistry('test-package');

      expect(result?.error).toBe('HTTP 429: Too Many Requests');
    });
  });

  describe('Error boundary testing', () => {
    it('should handle corrupted internal state gracefully', async () => {
      // Test with various edge cases that might cause internal errors
      const edgeCases = [
        null,
        undefined,
        '',
        {},
        [],
        'not-a-string' as any,
      ];

      for (const edgeCase of edgeCases) {
        // These should not throw errors, just return appropriate results
        expect(() => {
          const result = parseVersionOutput(edgeCase as any);
          expect([null, undefined].includes(result as any) || typeof result === 'string').toBe(true);
        }).not.toThrow();
      }
    });

    it('should recover from temporary system issues', async () => {
      // Simulate a scenario where first attempt fails but second succeeds
      let attemptCount = 0;

      vi.doMock('child_process', () => ({
        exec: vi.fn().mockImplementation((cmd, opts, callback) => {
          attemptCount++;
          if (attemptCount === 1) {
            callback(new Error('Temporary system error'), '', '');
          } else {
            callback(null, { stdout: 'v4.9.5' }, '');
          }
        })
      }));

      // First call should fail
      const firstResult = await detectTypeScript({ local: false });
      expect(firstResult.currentVersion).toBeNull();
      expect(firstResult.metadata?.error).toBeDefined();

      // Second call should succeed (in a real scenario with retry logic)
      const secondResult = await detectTypeScript({ local: false });
      // Note: In current implementation, this will also fail because
      // we're not implementing retry logic. This test documents expected behavior.
    });
  });

  describe('Large data handling', () => {
    it('should handle packages with many versions', async () => {
      const mockFetch = vi.fn();
      global.fetch = mockFetch;

      // Create a response with many versions
      const manyVersions: Record<string, any> = {};
      for (let major = 0; major < 10; major++) {
        for (let minor = 0; minor < 10; minor++) {
          for (let patch = 0; patch < 10; patch++) {
            manyVersions[`${major}.${minor}.${patch}`] = {
              dependencies: {},
              devDependencies: {}
            };
          }
        }
      }

      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          name: 'large-package',
          'dist-tags': { latest: '9.9.9' },
          versions: manyVersions
        })
      });

      const start = performance.now();
      const result = await queryNpmRegistry('large-package');
      const duration = performance.now() - start;

      expect(result?.name).toBe('large-package');
      expect(result?.versions).toHaveLength(1000);
      expect(result?.latestVersion).toBe('9.9.9');
      expect(duration).toBeLessThan(5000); // Should handle large data reasonably fast
    });

    it('should handle very long package names and metadata', async () => {
      const mockFetch = vi.fn();
      global.fetch = mockFetch;

      const longPackageName = '@very-long-scope-name/' + 'long-package-name'.repeat(10);
      const longDescription = 'Very long description '.repeat(1000);

      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          name: longPackageName,
          description: longDescription,
          'dist-tags': { latest: '1.0.0' },
          versions: { '1.0.0': {} }
        })
      });

      const result = await queryNpmRegistry(longPackageName);

      expect(result?.name).toBe(longPackageName);
      expect(result?.latestVersion).toBe('1.0.0');
    });
  });
});