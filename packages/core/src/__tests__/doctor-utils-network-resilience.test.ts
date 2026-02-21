/**
 * @fileoverview Doctor Utils Network Resilience Tests
 *
 * Tests specifically focused on network resilience and real-world failure modes
 * that may occur when querying npm registry or performing network operations.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  queryNpmRegistry,
  getLatestPackageVersion,
  isPackageVersionAvailable,
  type NpmPackageInfo,
} from '../doctor-utils.js';

describe('Doctor Utils Network Resilience', () => {
  const mockFetch = vi.fn();
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    globalThis.fetch = mockFetch;
  });

  afterEach(() => {
    vi.useRealTimers();
    globalThis.fetch = originalFetch;
  });

  describe('Network Timeout and Retry Scenarios', () => {
    it('should handle AbortController timeout correctly', async () => {
      // Mock a slow response that exceeds timeout
      mockFetch.mockImplementation(() => {
        return new Promise((resolve) => {
          setTimeout(() => {
            resolve({
              ok: true,
              json: () => Promise.resolve({ name: 'test', 'dist-tags': { latest: '1.0.0' } })
            });
          }, 10000); // 10 seconds - longer than default timeout
        });
      });

      const resultPromise = queryNpmRegistry('test-package', { timeout: 1000 });

      // Advance timers to trigger timeout
      vi.advanceTimersByTime(1000);

      const result = await resultPromise;

      expect(result).toEqual({
        name: 'test-package',
        version: '',
        latestVersion: '',
        versions: [],
        error: 'Request timeout',
      });
    });

    it('should handle DNS resolution failures', async () => {
      const dnsError = new Error('ENOTFOUND');
      dnsError.code = 'ENOTFOUND';
      mockFetch.mockRejectedValue(dnsError);

      const result = await queryNpmRegistry('@apexcli/core');

      expect(result).toEqual({
        name: '@apexcli/core',
        version: '',
        latestVersion: '',
        versions: [],
        error: 'ENOTFOUND',
      });
    });

    it('should handle connection refused errors', async () => {
      const connError = new Error('ECONNREFUSED');
      connError.code = 'ECONNREFUSED';
      mockFetch.mockRejectedValue(connError);

      const result = await queryNpmRegistry('test-package');

      expect(result).toEqual({
        name: 'test-package',
        version: '',
        latestVersion: '',
        versions: [],
        error: 'ECONNREFUSED',
      });
    });

    it('should handle SSL/TLS certificate errors', async () => {
      const sslError = new Error('certificate has expired');
      mockFetch.mockRejectedValue(sslError);

      const result = await queryNpmRegistry('test-package');

      expect(result).toEqual({
        name: 'test-package',
        version: '',
        latestVersion: '',
        versions: [],
        error: 'certificate has expired',
      });
    });
  });

  describe('HTTP Error Response Handling', () => {
    it('should handle 429 Too Many Requests with proper error message', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 429,
        statusText: 'Too Many Requests',
      });

      const result = await queryNpmRegistry('@apexcli/core');

      expect(result).toEqual({
        name: '@apexcli/core',
        version: '',
        latestVersion: '',
        versions: [],
        error: 'HTTP 429: Too Many Requests',
      });
    });

    it('should handle 503 Service Unavailable gracefully', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 503,
        statusText: 'Service Unavailable',
      });

      const result = await queryNpmRegistry('test-package');

      expect(result).toEqual({
        name: 'test-package',
        version: '',
        latestVersion: '',
        versions: [],
        error: 'HTTP 503: Service Unavailable',
      });
    });

    it('should handle 500 Internal Server Error', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      });

      const result = await queryNpmRegistry('test-package');

      expect(result).toEqual({
        name: 'test-package',
        version: '',
        latestVersion: '',
        versions: [],
        error: 'HTTP 500: Internal Server Error',
      });
    });

    it('should handle malformed JSON responses', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.reject(new Error('Unexpected token < in JSON at position 0')),
      });

      const result = await queryNpmRegistry('test-package');

      expect(result).toEqual({
        name: 'test-package',
        version: '',
        latestVersion: '',
        versions: [],
        error: 'Unexpected token < in JSON at position 0',
      });
    });

    it('should handle empty response body', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(null),
      });

      const result = await queryNpmRegistry('test-package');

      expect(result).toEqual({
        name: 'test-package',
        version: '',
        latestVersion: '',
        versions: {},
        deprecated: undefined,
        homepage: undefined,
        repository: undefined,
      });
    });
  });

  describe('Private Registry and Custom Scenarios', () => {
    it('should handle private registry authentication errors', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
      });

      const result = await queryNpmRegistry('@company/private-package', {
        registry: 'https://private-npm.company.com',
      });

      expect(result).toEqual({
        name: '@company/private-package',
        version: '',
        latestVersion: '',
        versions: [],
        error: 'HTTP 401: Unauthorized',
      });

      expect(mockFetch).toHaveBeenCalledWith(
        'https://private-npm.company.com/@company%2Fprivate-package',
        expect.objectContaining({
          headers: expect.objectContaining({
            'Accept': 'application/json',
            'User-Agent': 'APEX-doctor/0.6.0',
          }),
        })
      );
    });

    it('should handle registry with unusual response format', async () => {
      // Some registries might return slightly different formats
      const unusualResponse = {
        name: 'test-package',
        'dist-tags': { latest: '1.0.0' },
        versions: {
          '1.0.0': { version: '1.0.0' }
        },
        // Unusual fields that shouldn't break parsing
        _id: 'test-package',
        _rev: '1-abc123',
        maintainers: [{ name: 'test', email: 'test@example.com' }],
      };

      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(unusualResponse),
      });

      const result = await queryNpmRegistry('test-package');

      expect(result?.name).toBe('test-package');
      expect(result?.latestVersion).toBe('1.0.0');
      expect(result?.versions).toEqual(['1.0.0']);
    });

    it('should handle concurrent requests with rate limiting', async () => {
      let requestCount = 0;

      mockFetch.mockImplementation(() => {
        requestCount++;
        if (requestCount > 3) {
          return Promise.resolve({
            ok: false,
            status: 429,
            statusText: 'Too Many Requests',
          });
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            name: 'test-package',
            'dist-tags': { latest: '1.0.0' },
            versions: { '1.0.0': {} }
          }),
        });
      });

      // Make multiple concurrent requests
      const promises = Array.from({ length: 5 }, () =>
        queryNpmRegistry('test-package')
      );

      const results = await Promise.all(promises);

      // First 3 should succeed, rest should fail with rate limiting
      expect(results.slice(0, 3).every(r => r?.latestVersion === '1.0.0')).toBe(true);
      expect(results.slice(3).every(r => r?.error === 'HTTP 429: Too Many Requests')).toBe(true);
    });
  });

  describe('Recovery and Fallback Behavior', () => {
    it('should handle fetch API unavailability', async () => {
      // Temporarily remove fetch
      globalThis.fetch = undefined as any;

      const result = await queryNpmRegistry('test-package');

      expect(result).toEqual({
        name: 'test-package',
        version: '',
        latestVersion: '',
        versions: [],
        error: 'Fetch API not available',
      });
    });

    it('should handle AbortController unavailability', async () => {
      // Mock environment where AbortController is not available
      const originalAbortController = globalThis.AbortController;
      globalThis.AbortController = undefined as any;

      // Mock successful response
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          name: 'test-package',
          'dist-tags': { latest: '1.0.0' },
          versions: { '1.0.0': {} }
        }),
      });

      const result = await queryNpmRegistry('test-package');

      // Should still work without timeout control
      expect(result?.name).toBe('test-package');
      expect(result?.latestVersion).toBe('1.0.0');

      // Restore AbortController
      globalThis.AbortController = originalAbortController;
    });
  });

  describe('Integration with Higher-Level Functions', () => {
    it('should propagate network errors through getLatestPackageVersion', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      const result = await getLatestPackageVersion('@apexcli/core');

      expect(result).toBeNull();
    });

    it('should propagate network errors through isPackageVersionAvailable', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      const result = await isPackageVersionAvailable('@apexcli/core', '0.6.0');

      expect(result).toBe(false);
    });

    it('should handle partial success in package availability checks', async () => {
      // Mock scenario where package exists but version check fails
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          name: '@apexcli/core',
          'dist-tags': { latest: '0.6.0' },
          // Missing versions object (malformed response)
          versions: undefined,
        }),
      });

      const result = await isPackageVersionAvailable('@apexcli/core', '0.6.0');

      expect(result).toBe(false); // Should handle missing versions gracefully
    });
  });

  describe('Real-world Edge Cases', () => {
    it('should handle APEX package detection in offline mode', async () => {
      // Simulate completely offline scenario
      const offlineError = new Error('Failed to fetch');
      mockFetch.mockRejectedValue(offlineError);

      const apexPackages = [
        '@apexcli/core',
        '@apexcli/cli',
        '@apexcli/orchestrator'
      ];

      const results = await Promise.all(
        apexPackages.map(pkg => queryNpmRegistry(pkg))
      );

      // All should fail gracefully with error information
      results.forEach((result, index) => {
        expect(result).toEqual({
          name: apexPackages[index],
          version: '',
          latestVersion: '',
          versions: [],
          error: 'Failed to fetch',
        });
      });
    });

    it('should handle slow network conditions gracefully', async () => {
      // Mock slow but successful responses
      mockFetch.mockImplementation(() => {
        return new Promise((resolve) => {
          setTimeout(() => {
            resolve({
              ok: true,
              json: () => Promise.resolve({
                name: 'test-package',
                'dist-tags': { latest: '1.0.0' },
                versions: { '1.0.0': {} }
              }),
            });
          }, 2000); // 2 second delay
        });
      });

      // Use a longer timeout for slow networks
      const resultPromise = queryNpmRegistry('test-package', { timeout: 3000 });

      // Advance time to allow the response
      vi.advanceTimersByTime(2000);

      const result = await resultPromise;

      expect(result?.name).toBe('test-package');
      expect(result?.latestVersion).toBe('1.0.0');
    });

    it('should handle registry redirection', async () => {
      // First response is a redirect
      mockFetch
        .mockResolvedValueOnce({
          ok: false,
          status: 302,
          statusText: 'Found',
          headers: {
            location: 'https://registry.npmjs.org/new-package-name'
          }
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            name: 'new-package-name',
            'dist-tags': { latest: '1.0.0' },
            versions: { '1.0.0': {} }
          }),
        });

      const result = await queryNpmRegistry('old-package-name');

      // Should handle redirect as an error (our implementation doesn't follow redirects)
      expect(result?.error).toBe('HTTP 302: Found');
    });
  });
});