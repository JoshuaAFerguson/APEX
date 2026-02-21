import { describe, it, expect } from 'vitest';
import {
  ToolchainCheckSchema,
  DoctorCheckResultSchema,
  HealthReportSchema,
  type ToolchainCheck,
  type DoctorCheckResult,
  type HealthReport,
  type CheckStatus,
} from './types';

describe('Doctor Types Integration Tests', () => {
  describe('ToolchainCheckSchema', () => {
    it('should validate complete toolchain check', () => {
      const validToolchain: ToolchainCheck = {
        name: 'node',
        currentVersion: '18.17.0',
        requiredVersion: '16.0.0',
        required: true,
        path: '/usr/local/bin/node',
        metadata: {
          installMethod: 'nvm',
          supportedUntil: '2025-04-30'
        }
      };

      const result = ToolchainCheckSchema.safeParse(validToolchain);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual(validToolchain);
      }
    });

    it('should validate minimal toolchain check', () => {
      const minimalToolchain = {
        name: 'npm',
        currentVersion: null,
        requiredVersion: '8.0.0',
        required: false
      };

      const result = ToolchainCheckSchema.safeParse(minimalToolchain);
      expect(result.success).toBe(true);
    });

    it('should reject invalid toolchain check', () => {
      const invalidToolchain = {
        name: 123, // should be string
        currentVersion: '1.0.0',
        requiredVersion: '2.0.0',
        required: true
      };

      const result = ToolchainCheckSchema.safeParse(invalidToolchain);
      expect(result.success).toBe(false);
    });

    it('should require essential fields', () => {
      const missingName = {
        currentVersion: '1.0.0',
        requiredVersion: '2.0.0',
        required: true
      };

      const result = ToolchainCheckSchema.safeParse(missingName);
      expect(result.success).toBe(false);
    });

    it('should handle null current version (not installed)', () => {
      const notInstalled = {
        name: 'docker',
        currentVersion: null,
        requiredVersion: '20.0.0',
        required: true
      };

      const result = ToolchainCheckSchema.safeParse(notInstalled);
      expect(result.success).toBe(true);
    });
  });

  describe('DoctorCheckResultSchema', () => {
    it('should validate complete check result', () => {
      const validCheckResult: DoctorCheckResult = {
        id: 'node-version-check',
        name: 'Node.js Version Check',
        category: 'toolchain',
        description: 'Verify Node.js meets minimum version requirements',
        status: 'pass',
        severity: 'info',
        message: 'Node.js version 18.17.0 meets requirement >=16.0.0',
        suggestion: 'Consider updating to latest LTS version',
        toolchain: {
          name: 'node',
          currentVersion: '18.17.0',
          requiredVersion: '16.0.0',
          required: true,
          path: '/usr/local/bin/node'
        },
        timestamp: new Date('2024-01-15T10:30:00Z'),
        durationMs: 125,
        details: {
          installPath: '/usr/local/bin/node',
          version: '18.17.0',
          isLts: true
        }
      };

      const result = DoctorCheckResultSchema.safeParse(validCheckResult);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual(validCheckResult);
      }
    });

    it('should validate minimal check result', () => {
      const minimalCheck = {
        id: 'basic-check',
        name: 'Basic Check',
        category: 'environment',
        description: 'A basic check',
        status: 'fail',
        severity: 'error',
        message: 'Check failed',
        timestamp: new Date(),
        durationMs: 0
      };

      const result = DoctorCheckResultSchema.safeParse(minimalCheck);
      expect(result.success).toBe(true);
    });

    it('should reject invalid status values', () => {
      const invalidStatus = {
        id: 'test',
        name: 'Test',
        category: 'test',
        description: 'Test',
        status: 'invalid-status', // not a valid CheckStatus
        severity: 'info',
        message: 'Test',
        timestamp: new Date(),
        durationMs: 0
      };

      const result = DoctorCheckResultSchema.safeParse(invalidStatus);
      expect(result.success).toBe(false);
    });

    it('should reject invalid severity values', () => {
      const invalidSeverity = {
        id: 'test',
        name: 'Test',
        category: 'test',
        description: 'Test',
        status: 'pass',
        severity: 'critical', // not a valid severity
        message: 'Test',
        timestamp: new Date(),
        durationMs: 0
      };

      const result = DoctorCheckResultSchema.safeParse(invalidSeverity);
      expect(result.success).toBe(false);
    });

    it('should require all essential fields', () => {
      const missingFields = {
        id: 'test',
        // missing name, category, description, etc.
        status: 'pass',
        timestamp: new Date()
      };

      const result = DoctorCheckResultSchema.safeParse(missingFields);
      expect(result.success).toBe(false);
    });

    it('should validate date timestamp', () => {
      const withStringTimestamp = {
        id: 'test',
        name: 'Test',
        category: 'test',
        description: 'Test',
        status: 'pass',
        severity: 'info',
        message: 'Test',
        timestamp: '2024-01-15T10:30:00Z', // string instead of Date
        durationMs: 0
      };

      const result = DoctorCheckResultSchema.safeParse(withStringTimestamp);
      expect(result.success).toBe(false);
    });
  });

  describe('HealthReportSchema', () => {
    it('should validate complete health report', () => {
      const checkResult: DoctorCheckResult = {
        id: 'node-check',
        name: 'Node.js Check',
        category: 'toolchain',
        description: 'Node.js version check',
        status: 'pass',
        severity: 'info',
        message: 'Node.js is installed and up to date',
        timestamp: new Date('2024-01-15T10:30:00Z'),
        durationMs: 100
      };

      const validReport: HealthReport = {
        id: 'health-2024-01-15-103000',
        timestamp: new Date('2024-01-15T10:30:00Z'),
        overallStatus: 'pass',
        summary: {
          total: 1,
          passed: 1,
          failed: 0,
          warnings: 0,
          skipped: 0
        },
        checks: [checkResult],
        system: {
          platform: 'darwin',
          arch: 'x64',
          nodeVersion: 'v18.17.0',
          cwd: '/Users/test/project'
        },
        durationMs: 100,
        apexVersion: '0.6.0'
      };

      const result = HealthReportSchema.safeParse(validReport);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual(validReport);
      }
    });

    it('should validate report with multiple checks', () => {
      const checks: DoctorCheckResult[] = [
        {
          id: 'node-check',
          name: 'Node.js',
          category: 'toolchain',
          description: 'Node.js check',
          status: 'pass',
          severity: 'info',
          message: 'OK',
          timestamp: new Date(),
          durationMs: 50
        },
        {
          id: 'npm-check',
          name: 'NPM',
          category: 'toolchain',
          description: 'NPM check',
          status: 'fail',
          severity: 'error',
          message: 'Version too old',
          timestamp: new Date(),
          durationMs: 75
        }
      ];

      const report = {
        id: 'health-report',
        timestamp: new Date(),
        overallStatus: 'fail' as CheckStatus,
        summary: {
          total: 2,
          passed: 1,
          failed: 1,
          warnings: 0,
          skipped: 0
        },
        checks,
        system: {
          platform: 'linux',
          arch: 'x64',
          nodeVersion: 'v16.14.0',
          cwd: '/home/user/project'
        },
        durationMs: 125,
        apexVersion: '0.6.0'
      };

      const result = HealthReportSchema.safeParse(report);
      expect(result.success).toBe(true);
    });

    it('should require all essential fields', () => {
      const incomplete = {
        id: 'test-report',
        timestamp: new Date(),
        // missing overallStatus, summary, checks, system, etc.
      };

      const result = HealthReportSchema.safeParse(incomplete);
      expect(result.success).toBe(false);
    });

    it('should validate summary structure', () => {
      const invalidSummary = {
        id: 'test-report',
        timestamp: new Date(),
        overallStatus: 'pass',
        summary: {
          total: 'five', // should be number
          passed: 3,
          failed: 1,
          warnings: 1,
          skipped: 0
        },
        checks: [],
        system: {
          platform: 'darwin',
          arch: 'x64',
          nodeVersion: 'v18.17.0',
          cwd: '/test'
        },
        durationMs: 0,
        apexVersion: '0.6.0'
      };

      const result = HealthReportSchema.safeParse(invalidSummary);
      expect(result.success).toBe(false);
    });

    it('should validate system information structure', () => {
      const invalidSystem = {
        id: 'test-report',
        timestamp: new Date(),
        overallStatus: 'pass',
        summary: {
          total: 0,
          passed: 0,
          failed: 0,
          warnings: 0,
          skipped: 0
        },
        checks: [],
        system: {
          platform: 'darwin',
          arch: 'x64',
          // missing nodeVersion and cwd
        },
        durationMs: 0,
        apexVersion: '0.6.0'
      };

      const result = HealthReportSchema.safeParse(invalidSystem);
      expect(result.success).toBe(false);
    });

    it('should validate checks array contains valid DoctorCheckResults', () => {
      const invalidCheck = {
        id: 'test-report',
        timestamp: new Date(),
        overallStatus: 'pass',
        summary: {
          total: 1,
          passed: 1,
          failed: 0,
          warnings: 0,
          skipped: 0
        },
        checks: [
          {
            id: 'invalid-check',
            // missing required fields
            status: 'pass'
          }
        ],
        system: {
          platform: 'darwin',
          arch: 'x64',
          nodeVersion: 'v18.17.0',
          cwd: '/test'
        },
        durationMs: 0,
        apexVersion: '0.6.0'
      };

      const result = HealthReportSchema.safeParse(invalidCheck);
      expect(result.success).toBe(false);
    });
  });

  describe('Type Exports Integration', () => {
    it('should export all required types from main index', async () => {
      // Import from the main index to ensure exports work
      const coreExports = await import('./index');

      // Check that the types are exported (TypeScript will catch missing exports)
      expect(typeof coreExports.ToolchainCheckSchema).toBe('object');
      expect(typeof coreExports.DoctorCheckResultSchema).toBe('object');
      expect(typeof coreExports.HealthReportSchema).toBe('object');
    });

    it('should export utility functions from main index', async () => {
      const coreExports = await import('./index');

      expect(typeof coreExports.satisfiesVersion).toBe('function');
      expect(typeof coreExports.compareVersionStrings).toBe('function');
      expect(typeof coreExports.parseVersionOutput).toBe('function');
      expect(typeof coreExports.queryNpmRegistry).toBe('function');
      expect(typeof coreExports.isPackageVersionAvailable).toBe('function');
      expect(typeof coreExports.getLatestPackageVersion).toBe('function');
      expect(typeof coreExports.createDoctorCheckResult).toBe('function');
      expect(typeof coreExports.createHealthReport).toBe('function');
    });
  });
});