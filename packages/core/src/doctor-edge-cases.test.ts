import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  satisfiesVersion,
  compareVersionStrings,
  parseVersionOutput,
  queryNpmRegistry,
  isPackageVersionAvailable,
  getLatestPackageVersion,
  createDoctorCheckResult,
  createHealthReport,
} from './doctor-utils';
import type { DoctorCheckResult, ToolchainCheck } from './types';

describe('Doctor Utils Edge Cases', () => {
  describe('Version Comparison Edge Cases', () => {
    it('should handle exotic version formats', () => {
      // Real-world exotic version formats
      expect(parseVersionOutput('1.2.3+build.456')).toBe('1.2.3+build.456');
      expect(parseVersionOutput('v2.0.0-alpha.1+beta')).toBe('2.0.0-alpha.1+beta');
      expect(parseVersionOutput('3.0.0-rc.1-hotfix.2')).toBe('3.0.0-rc.1-hotfix.2');

      // Version with unusual separators (should not match)
      expect(parseVersionOutput('1_2_3')).toBe(null);
      expect(parseVersionOutput('1-2-3')).toBe(null);
      expect(parseVersionOutput('1,2,3')).toBe(null);
    });

    it('should handle versions with leading zeros', () => {
      expect(parseVersionOutput('v01.02.03')).toBe('01.02.03');
      expect(parseVersionOutput('version 10.01.00')).toBe('10.01.00');

      // These should still work with comparison
      expect(satisfiesVersion('01.02.03', '1.0.0')).toBe(true);
      expect(compareVersionStrings('01.02.03', '1.2.3')).toBe(0);
    });

    it('should handle very long version strings', () => {
      const longVersion = '1.0.0-alpha.beta.gamma.delta.epsilon.zeta.eta.theta';
      expect(parseVersionOutput(`v${longVersion}`)).toBe(longVersion);
      expect(satisfiesVersion(longVersion, '1.0.0')).toBe(false); // prerelease < release
    });

    it('should handle unicode and special characters in version context', () => {
      // Version should be extracted despite surrounding special characters
      expect(parseVersionOutput('📦 package v1.2.3 ✨')).toBe('1.2.3');
      expect(parseVersionOutput('Version: 2.1.0 (x86_64-apple-darwin)')).toBe('2.1.0');
      expect(parseVersionOutput('npm 版本 8.19.2')).toBe('8.19.2');
    });

    it('should handle timestamp-like version numbers', () => {
      // These look like versions but have too many segments
      expect(parseVersionOutput('20240115.123456.789')).toBe('20240115.123456.789');
      expect(satisfiesVersion('20240115.123456.789', '1.0.0')).toBe(true); // Large numbers
    });

    it('should handle boundary version numbers', () => {
      // Very large version numbers
      expect(satisfiesVersion('999999.999999.999999', '1.0.0')).toBe(true);
      expect(compareVersionStrings('0.0.0', '999999.999999.999999')).toBe(-1);

      // Zero versions
      expect(satisfiesVersion('0.0.1', '0.0.0')).toBe(true);
      expect(compareVersionStrings('0.0.0', '0.0.0')).toBe(0);
    });
  });

  describe('NPM Registry Edge Cases', () => {
    const mockFetch = vi.fn();
    global.fetch = mockFetch as any;

    beforeEach(() => {
      vi.clearAllMocks();
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should handle malformed package names gracefully', async () => {
      const malformedNames = [
        '/', '@/', '@scope/', '@/package', '//package',
        'UPPERCASE-PACKAGE', 'package with spaces', 'package@version'
      ];

      for (const name of malformedNames) {
        mockFetch.mockResolvedValueOnce({
          ok: false,
          status: 400,
          statusText: 'Bad Request'
        });

        const result = await queryNpmRegistry(name);
        expect(result?.error).toBeDefined();
      }
    });

    it('should handle responses with missing or malformed data', async () => {
      const malformedResponses = [
        {}, // Empty object
        { name: 'test' }, // Missing dist-tags
        { 'dist-tags': {} }, // Missing name
        { name: 'test', 'dist-tags': { latest: 'invalid-version' } },
        { name: 'test', 'dist-tags': null }, // Null dist-tags
        { name: 123, 'dist-tags': { latest: '1.0.0' } }, // Wrong type
      ];

      for (const response of malformedResponses) {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(response)
        });

        const result = await queryNpmRegistry('test-package');
        expect(result).toBeDefined();
        // Should handle gracefully without throwing
      }
    });

    it('should handle very large package version lists', async () => {
      // Simulate a package with many versions
      const versions: Record<string, any> = {};
      for (let major = 0; major < 10; major++) {
        for (let minor = 0; minor < 10; minor++) {
          for (let patch = 0; patch < 10; patch++) {
            versions[`${major}.${minor}.${patch}`] = {};
          }
        }
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          name: 'big-package',
          'dist-tags': { latest: '9.9.9' },
          versions
        })
      });

      const result = await queryNpmRegistry('big-package');
      expect(result?.versions).toHaveLength(1000);
      expect(result?.latestVersion).toBe('9.9.9');
    });

    it('should handle network timeouts correctly with various timeout values', async () => {
      const timeouts = [0, 1, 100, 5000, 10000];

      for (const timeout of timeouts) {
        mockFetch.mockImplementation(() =>
          new Promise((resolve) => {
            setTimeout(() => resolve({
              ok: true,
              json: () => Promise.resolve({ name: 'test', 'dist-tags': { latest: '1.0.0' } })
            }), timeout + 1000); // Always longer than timeout
          })
        );

        const result = await queryNpmRegistry('test-package', { timeout });
        vi.runAllTimers();

        if (timeout > 0) {
          expect(result?.error).toMatch(/timeout|abort/i);
        }
      }
    });

    it('should handle fetch API unavailability', async () => {
      // Temporarily remove fetch
      const originalFetch = global.fetch;
      delete (global as any).fetch;

      const result = await queryNpmRegistry('test-package');
      expect(result?.error).toBe('Fetch API not available');

      // Restore fetch
      global.fetch = originalFetch;
    });

    it('should handle various HTTP error codes', async () => {
      const errorCodes = [
        { code: 401, text: 'Unauthorized' },
        { code: 403, text: 'Forbidden' },
        { code: 429, text: 'Too Many Requests' },
        { code: 500, text: 'Internal Server Error' },
        { code: 502, text: 'Bad Gateway' },
        { code: 503, text: 'Service Unavailable' },
      ];

      for (const error of errorCodes) {
        mockFetch.mockResolvedValueOnce({
          ok: false,
          status: error.code,
          statusText: error.text
        });

        const result = await queryNpmRegistry('test-package');
        expect(result?.error).toBe(`HTTP ${error.code}: ${error.text}`);
      }
    });

    it('should handle JSON parsing errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.reject(new Error('Invalid JSON'))
      });

      const result = await queryNpmRegistry('test-package');
      expect(result?.error).toBe('Invalid JSON');
    });

    it('should handle repository field variations', async () => {
      const repositoryVariations = [
        { repository: 'git://github.com/user/repo.git' },
        { repository: { url: 'https://github.com/user/repo' } },
        { repository: { type: 'git', url: 'git+ssh://git@github.com/user/repo.git' } },
        { repository: null },
        { repository: [] }, // Invalid type
        {}, // No repository field
      ];

      for (const repoData of repositoryVariations) {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            name: 'test-package',
            'dist-tags': { latest: '1.0.0' },
            versions: { '1.0.0': {} },
            ...repoData
          })
        });

        const result = await queryNpmRegistry('test-package');
        expect(result).toBeDefined();
        // Should handle all variations without error
      }
    });
  });

  describe('Health Check Factory Edge Cases', () => {
    it('should handle extreme timestamp values', () => {
      const extremeDates = [
        new Date('1970-01-01T00:00:00.000Z'), // Unix epoch
        new Date('2038-01-19T03:14:07.999Z'), // Near 32-bit limit
        new Date('1900-01-01T00:00:00.000Z'), // Very old date
        new Date('2100-12-31T23:59:59.999Z'), // Future date
      ];

      extremeDates.forEach(date => {
        const result = createDoctorCheckResult({
          id: 'timestamp-test',
          name: 'Timestamp Test',
          category: 'test',
          timestamp: date
        });

        expect(result.timestamp).toBe(date);
      });
    });

    it('should handle very long strings in check result fields', () => {
      const longString = 'A'.repeat(10000);
      const longMessage = 'Error message: ' + 'X'.repeat(5000);

      const result = createDoctorCheckResult({
        id: longString,
        name: longString,
        category: 'test',
        description: longString,
        message: longMessage,
        suggestion: longString
      });

      expect(result.id).toHaveLength(10000);
      expect(result.name).toHaveLength(10000);
      expect(result.message).toHaveLength(5014); // 'Error message: ' + 5000 chars
    });

    it('should handle complex toolchain metadata', () => {
      const complexMetadata = {
        nested: {
          deeply: {
            nested: {
              value: 'test',
              array: [1, 2, 3, { inner: 'object' }],
              date: new Date().toISOString(),
              boolean: true,
              nullValue: null,
              undefinedValue: undefined
            }
          }
        },
        largeArray: Array.from({ length: 1000 }, (_, i) => i),
        specialChars: '!@#$%^&*()_+-=[]{}|;:,.<>?',
        unicode: '🚀 🌟 💻 🔧 ⚡ 🎯',
        multiline: 'Line 1\nLine 2\nLine 3'
      };

      const toolchain: ToolchainCheck = {
        name: 'complex-tool',
        currentVersion: '1.0.0',
        requiredVersion: '1.0.0',
        required: true,
        metadata: complexMetadata
      };

      const result = createDoctorCheckResult({
        id: 'complex-toolchain',
        name: 'Complex Toolchain Test',
        category: 'toolchain',
        toolchain
      });

      expect(result.toolchain?.metadata).toEqual(complexMetadata);
    });

    it('should handle extreme duration values', () => {
      const extremeDurations = [
        0,
        -1, // Negative duration (invalid but should be handled)
        0.001, // Microsecond precision
        Number.MAX_SAFE_INTEGER,
        Number.POSITIVE_INFINITY,
        NaN
      ];

      extremeDurations.forEach(duration => {
        const result = createDoctorCheckResult({
          id: 'duration-test',
          name: 'Duration Test',
          category: 'test',
          durationMs: duration
        });

        expect(result.durationMs).toBe(duration);
      });
    });
  });

  describe('Health Report Generation Edge Cases', () => {
    it('should handle empty and null checks array', () => {
      expect(() => createHealthReport([])).not.toThrow();

      const emptyReport = createHealthReport([]);
      expect(emptyReport.summary.total).toBe(0);
      expect(emptyReport.overallStatus).toBe('unknown');
      expect(emptyReport.durationMs).toBe(0);
    });

    it('should handle mixed status combinations correctly', () => {
      const mixedChecks: DoctorCheckResult[] = [
        createDoctorCheckResult({
          id: 'pass-info',
          name: 'Pass Info',
          category: 'test',
          status: 'pass',
          severity: 'info'
        }),
        createDoctorCheckResult({
          id: 'pass-warning',
          name: 'Pass Warning',
          category: 'test',
          status: 'pass',
          severity: 'warning' // Should NOT count as warning
        }),
        createDoctorCheckResult({
          id: 'fail-warning',
          name: 'Fail Warning',
          category: 'test',
          status: 'fail',
          severity: 'warning' // Should count as warning
        }),
        createDoctorCheckResult({
          id: 'skip-error',
          name: 'Skip Error',
          category: 'test',
          status: 'skip',
          severity: 'error' // Should NOT count as warning (skipped)
        }),
        createDoctorCheckResult({
          id: 'unknown-warning',
          name: 'Unknown Warning',
          category: 'test',
          status: 'unknown',
          severity: 'warning' // Should count as warning (not passed)
        })
      ];

      const report = createHealthReport(mixedChecks);

      expect(report.summary.passed).toBe(2); // pass-info, pass-warning
      expect(report.summary.failed).toBe(1); // fail-warning
      expect(report.summary.skipped).toBe(1); // skip-error
      expect(report.summary.warnings).toBe(2); // fail-warning, unknown-warning
      expect(report.overallStatus).toBe('fail'); // Has failures
    });

    it('should handle checks with missing or undefined duration', () => {
      const checksWithMissingDuration: DoctorCheckResult[] = [
        {
          ...createDoctorCheckResult({
            id: 'no-duration',
            name: 'No Duration',
            category: 'test'
          }),
          durationMs: undefined as any // Simulate missing duration
        },
        createDoctorCheckResult({
          id: 'zero-duration',
          name: 'Zero Duration',
          category: 'test',
          durationMs: 0
        }),
        createDoctorCheckResult({
          id: 'normal-duration',
          name: 'Normal Duration',
          category: 'test',
          durationMs: 100
        })
      ];

      const report = createHealthReport(checksWithMissingDuration);

      // Should handle undefined duration as 0
      expect(report.durationMs).toBe(100); // 0 + 0 + 100
    });

    it('should generate unique report IDs consistently', () => {
      const reports = Array.from({ length: 100 }, () => createHealthReport([]));
      const ids = reports.map(r => r.id);
      const uniqueIds = new Set(ids);

      // All IDs should be unique
      expect(uniqueIds.size).toBe(100);

      // All IDs should match the expected format
      ids.forEach(id => {
        expect(id).toMatch(/^health-\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}$/);
      });
    });

    it('should handle system information edge cases', () => {
      // Mock process properties
      const originalPlatform = process.platform;
      const originalArch = process.arch;
      const originalVersion = process.version;
      const originalCwd = process.cwd;

      try {
        // Test with unusual system values
        Object.defineProperty(process, 'platform', { value: 'unknown-os' });
        Object.defineProperty(process, 'arch', { value: 'exotic-arch' });
        Object.defineProperty(process, 'version', { value: 'v999.999.999-custom' });
        Object.defineProperty(process, 'cwd', {
          value: () => '/very/long/path/that/goes/on/and/on/and/on/and/never/seems/to/end'
        });

        const report = createHealthReport([]);

        expect(report.system.platform).toBe('unknown-os');
        expect(report.system.arch).toBe('exotic-arch');
        expect(report.system.nodeVersion).toBe('v999.999.999-custom');
        expect(report.system.cwd).toMatch(/very.*long.*path/);
      } finally {
        // Restore original values
        Object.defineProperty(process, 'platform', { value: originalPlatform });
        Object.defineProperty(process, 'arch', { value: originalArch });
        Object.defineProperty(process, 'version', { value: originalVersion });
        Object.defineProperty(process, 'cwd', { value: originalCwd });
      }
    });
  });

  describe('Cross-function Integration Edge Cases', () => {
    it('should handle complete workflow with all edge cases', () => {
      // Parse exotic version formats
      const versions = [
        parseVersionOutput('Node.js v18.17.0+custom-build'),
        parseVersionOutput('npm 8.19.2-enterprise-edition'),
        parseVersionOutput('git version 2.34.1.windows.1')
      ];

      // Compare with requirements including edge cases
      const requirements = ['16.0.0', '7.0.0', '2.0.0'];
      const satisfiesRequirements = versions.map((version, index) =>
        version ? satisfiesVersion(version, requirements[index]) : false
      );

      // Create check results with edge case data
      const checks: DoctorCheckResult[] = versions.map((version, index) => {
        const toolNames = ['node', 'npm', 'git'];
        return createDoctorCheckResult({
          id: `${toolNames[index]}-check`,
          name: `${toolNames[index].toUpperCase()} Check`,
          category: 'toolchain',
          status: satisfiesRequirements[index] ? 'pass' : 'fail',
          severity: satisfiesRequirements[index] ? 'info' : 'error',
          message: `${toolNames[index]} ${version || 'not found'}`,
          toolchain: {
            name: toolNames[index],
            currentVersion: version,
            requiredVersion: requirements[index],
            required: true,
            metadata: {
              exotic: true,
              customBuild: version?.includes('custom') || version?.includes('enterprise'),
              platform: version?.includes('windows') ? 'windows' : 'unix'
            }
          },
          durationMs: Math.random() * 1000 // Random duration
        });
      });

      // Generate report with edge case configuration
      const report = createHealthReport(checks, {
        apexVersion: '0.6.0-beta.1+build.12345'
      });

      // Verify all components work together
      expect(report.checks).toHaveLength(3);
      expect(report.apexVersion).toBe('0.6.0-beta.1+build.12345');
      expect(report.summary.total).toBe(3);
      expect(typeof report.durationMs).toBe('number');
      expect(report.id).toMatch(/^health-/);

      // Verify toolchain metadata was preserved
      report.checks.forEach(check => {
        expect(check.toolchain?.metadata?.exotic).toBe(true);
      });
    });
  });
});