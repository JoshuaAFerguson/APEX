import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  satisfiesVersion,
  compareVersionStrings,
  parseVersionOutput,
  queryNpmRegistry,
  createDoctorCheckResult,
  createHealthReport,
} from './doctor-utils';
import type { DoctorCheckResult } from './types';

describe('Doctor Utils Performance Tests', () => {
  describe('Version Comparison Performance', () => {
    it('should handle large numbers of version comparisons efficiently', () => {
      const versions = [
        '1.0.0', '1.0.1', '1.1.0', '1.1.1', '2.0.0', '2.0.1',
        '10.0.0', '10.1.0', '11.0.0', '15.0.0', '16.0.0', '18.17.0',
        'v1.0.0', 'v2.1.0', 'v18.17.0', '1.0.0-alpha.1', '2.0.0-beta.2'
      ];

      const startTime = performance.now();

      // Perform 1000 comparisons
      for (let i = 0; i < 1000; i++) {
        const v1 = versions[i % versions.length];
        const v2 = versions[(i + 1) % versions.length];

        compareVersionStrings(v1, v2);
        satisfiesVersion(v1, v2);
      }

      const endTime = performance.now();
      const duration = endTime - startTime;

      // Should complete in reasonable time (< 100ms for 1000 comparisons)
      expect(duration).toBeLessThan(100);
    });

    it('should handle malformed versions without significant performance impact', () => {
      const malformedVersions = [
        'invalid', 'not.a.version', '1.2.invalid', '1.invalid.3',
        '', null, undefined, '1.2.3.4.5.6', 'version-string-here'
      ];

      const startTime = performance.now();

      // Test with many malformed versions
      for (let i = 0; i < 500; i++) {
        const version = malformedVersions[i % malformedVersions.length];
        parseVersionOutput(version as string);
        satisfiesVersion(version as string, '1.0.0');
      }

      const endTime = performance.now();
      const duration = endTime - startTime;

      // Should handle invalid versions gracefully without timeout
      expect(duration).toBeLessThan(50);
    });
  });

  describe('NPM Registry Query Performance', () => {
    const mockFetch = vi.fn();
    global.fetch = mockFetch as any;

    beforeEach(() => {
      vi.clearAllMocks();
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should respect timeout settings consistently', async () => {
      // Mock a slow response
      mockFetch.mockImplementation(() =>
        new Promise((resolve) => {
          setTimeout(() => resolve({
            ok: true,
            json: () => Promise.resolve({ name: 'test', 'dist-tags': { latest: '1.0.0' } })
          }), 2000);
        })
      );

      const timeouts = [500, 1000, 1500];
      const promises = timeouts.map(timeout =>
        queryNpmRegistry('test-package', { timeout })
      );

      // Fast-forward time
      vi.advanceTimersByTime(2000);

      const results = await Promise.all(promises);

      // All should timeout and return error results
      results.forEach(result => {
        expect(result?.error).toBeDefined();
        expect(result?.error).toMatch(/timeout|abort/i);
      });
    });

    it('should handle concurrent requests without interference', async () => {
      const packages = ['react', 'vue', 'angular', '@types/node', 'typescript'];

      mockFetch.mockImplementation((url: string) => {
        const packageName = url.split('/').pop()?.replace('%2F', '/');
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            name: packageName,
            'dist-tags': { latest: '1.0.0' },
            versions: { '1.0.0': {} }
          })
        });
      });

      const startTime = performance.now();

      // Make concurrent requests
      const promises = packages.map(pkg => queryNpmRegistry(pkg));
      const results = await Promise.all(promises);

      const endTime = performance.now();
      const duration = endTime - startTime;

      // All requests should succeed
      expect(results).toHaveLength(5);
      results.forEach((result, index) => {
        expect(result?.name).toBe(packages[index].replace('@', ''));
        expect(result?.error).toBeUndefined();
      });

      // Should complete efficiently
      expect(duration).toBeLessThan(200);
    });
  });

  describe('Health Report Generation Performance', () => {
    it('should handle large numbers of check results efficiently', () => {
      // Generate 1000 mock check results
      const checks: DoctorCheckResult[] = [];
      for (let i = 0; i < 1000; i++) {
        checks.push(createDoctorCheckResult({
          id: `check-${i}`,
          name: `Check ${i}`,
          category: i % 2 === 0 ? 'toolchain' : 'environment',
          status: i % 3 === 0 ? 'fail' : 'pass',
          severity: i % 4 === 0 ? 'error' : 'info',
          message: `Check ${i} completed`,
          durationMs: Math.floor(Math.random() * 1000)
        }));
      }

      const startTime = performance.now();

      const report = createHealthReport(checks, { apexVersion: '0.6.0' });

      const endTime = performance.now();
      const duration = endTime - startTime;

      // Should process 1000 checks efficiently
      expect(duration).toBeLessThan(100);
      expect(report.checks).toHaveLength(1000);
      expect(report.summary.total).toBe(1000);
      expect(typeof report.summary.passed).toBe('number');
      expect(typeof report.summary.failed).toBe('number');
    });

    it('should calculate summary statistics correctly for large datasets', () => {
      const checks: DoctorCheckResult[] = [];
      let expectedPassed = 0;
      let expectedFailed = 0;
      let expectedSkipped = 0;
      let expectedWarnings = 0;
      let expectedDuration = 0;

      // Generate predictable test data
      for (let i = 0; i < 500; i++) {
        const status = i < 200 ? 'pass' : i < 350 ? 'fail' : 'skip';
        const severity = i < 100 ? 'info' : i < 200 ? 'warning' : 'error';
        const duration = i + 10;

        checks.push(createDoctorCheckResult({
          id: `check-${i}`,
          name: `Check ${i}`,
          category: 'toolchain',
          status: status as any,
          severity: severity as any,
          message: `Check ${i}`,
          durationMs: duration
        }));

        if (status === 'pass') expectedPassed++;
        else if (status === 'fail') expectedFailed++;
        else if (status === 'skip') expectedSkipped++;

        if (severity === 'warning' && status !== 'pass') expectedWarnings++;
        expectedDuration += duration;
      }

      const report = createHealthReport(checks);

      expect(report.summary.passed).toBe(expectedPassed);
      expect(report.summary.failed).toBe(expectedFailed);
      expect(report.summary.skipped).toBe(expectedSkipped);
      expect(report.summary.warnings).toBe(expectedWarnings);
      expect(report.durationMs).toBe(expectedDuration);
    });
  });

  describe('Memory Usage Tests', () => {
    it('should not leak memory with repeated operations', () => {
      // Simulate repeated health check operations
      for (let i = 0; i < 100; i++) {
        const checks = Array.from({ length: 50 }, (_, j) =>
          createDoctorCheckResult({
            id: `check-${i}-${j}`,
            name: `Check ${i}-${j}`,
            category: 'toolchain',
            status: 'pass',
            message: 'Test check'
          })
        );

        const report = createHealthReport(checks);

        // Verify report was created correctly
        expect(report.checks).toHaveLength(50);
        expect(report.summary.total).toBe(50);
      }

      // If we reach here without out-of-memory errors, test passes
      expect(true).toBe(true);
    });

    it('should handle version parsing with large outputs efficiently', () => {
      // Test with large version output strings
      const largeOutputs = [
        'v18.17.0' + ' '.repeat(1000) + 'extra data',
        'npm version 8.19.2' + '\n'.repeat(100) + 'lots of newlines',
        'x'.repeat(5000) + 'v1.2.3' + 'y'.repeat(5000),
        'A'.repeat(10000) // No version in this one
      ];

      largeOutputs.forEach(output => {
        const result = parseVersionOutput(output);
        // Should either find version or return null, without hanging
        expect(typeof result === 'string' || result === null).toBe(true);
      });
    });
  });

  describe('Error Handling Stress Tests', () => {
    it('should handle rapid-fire invalid inputs gracefully', () => {
      const invalidInputs = [
        null, undefined, '', {}, [], NaN, Infinity, -Infinity,
        'invalid', '1.2.invalid', 'not.a.version', '1.2.3.4.5',
        '\n\t\r\0', '1.2.3\n\n\n', 'version\0\0\0'
      ];

      // Test all functions with invalid inputs rapidly
      for (let i = 0; i < 10; i++) {
        invalidInputs.forEach(input => {
          expect(() => {
            satisfiesVersion(input as any, '1.0.0');
            satisfiesVersion('1.0.0', input as any);
            compareVersionStrings(input as any, '1.0.0');
            parseVersionOutput(input as any);
          }).not.toThrow();
        });
      }
    });
  });

  describe('Real-world Scenario Performance', () => {
    it('should simulate a complete doctor check workflow efficiently', async () => {
      const startTime = performance.now();

      // Simulate parsing version outputs from various tools
      const nodeVersion = parseVersionOutput('Node.js v18.17.0');
      const npmVersion = parseVersionOutput('npm 8.19.2');
      const gitVersion = parseVersionOutput('git version 2.34.1');

      expect(nodeVersion).toBe('18.17.0');
      expect(npmVersion).toBe('8.19.2');
      expect(gitVersion).toBe('2.34.1');

      // Check versions against requirements
      const nodeOk = satisfiesVersion(nodeVersion!, '16.0.0');
      const npmOk = satisfiesVersion(npmVersion!, '7.0.0');
      const gitOk = satisfiesVersion(gitVersion!, '2.0.0');

      // Create check results
      const checks = [
        createDoctorCheckResult({
          id: 'node-check',
          name: 'Node.js Version',
          category: 'toolchain',
          status: nodeOk ? 'pass' : 'fail',
          message: `Node.js ${nodeVersion}`,
          toolchain: {
            name: 'node',
            currentVersion: nodeVersion,
            requiredVersion: '16.0.0',
            required: true
          },
          durationMs: 100
        }),
        createDoctorCheckResult({
          id: 'npm-check',
          name: 'npm Version',
          category: 'toolchain',
          status: npmOk ? 'pass' : 'fail',
          message: `npm ${npmVersion}`,
          toolchain: {
            name: 'npm',
            currentVersion: npmVersion,
            requiredVersion: '7.0.0',
            required: true
          },
          durationMs: 80
        }),
        createDoctorCheckResult({
          id: 'git-check',
          name: 'Git Version',
          category: 'toolchain',
          status: gitOk ? 'pass' : 'fail',
          message: `Git ${gitVersion}`,
          toolchain: {
            name: 'git',
            currentVersion: gitVersion,
            requiredVersion: '2.0.0',
            required: false
          },
          durationMs: 60
        })
      ];

      // Generate health report
      const report = createHealthReport(checks, { apexVersion: '0.6.0' });

      const endTime = performance.now();
      const duration = endTime - startTime;

      // Complete workflow should be very fast
      expect(duration).toBeLessThan(50);
      expect(report.summary.total).toBe(3);
      expect(report.summary.passed).toBe(3);
      expect(report.overallStatus).toBe('pass');
      expect(report.durationMs).toBe(240); // Sum of individual durations
    });
  });
});