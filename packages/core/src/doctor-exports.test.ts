import { describe, it, expect } from 'vitest';

describe('Doctor Functionality Exports - Acceptance Criteria Verification', () => {
  it('should export all required types from @apexcli/core', async () => {
    // This test verifies the acceptance criteria:
    // "New types for DoctorCheckResult, HealthReport, ToolchainCheck exported from core"

    const coreModule = await import('./index');

    // Verify type schemas are exported (Zod schemas)
    expect(coreModule.DoctorCheckResultSchema).toBeDefined();
    expect(coreModule.HealthReportSchema).toBeDefined();
    expect(coreModule.ToolchainCheckSchema).toBeDefined();

    // Verify the schemas are Zod objects with validation methods
    expect(typeof coreModule.DoctorCheckResultSchema.parse).toBe('function');
    expect(typeof coreModule.HealthReportSchema.parse).toBe('function');
    expect(typeof coreModule.ToolchainCheckSchema.parse).toBe('function');

    // Verify schemas have safeParse for validation
    expect(typeof coreModule.DoctorCheckResultSchema.safeParse).toBe('function');
    expect(typeof coreModule.HealthReportSchema.safeParse).toBe('function');
    expect(typeof coreModule.ToolchainCheckSchema.safeParse).toBe('function');
  });

  it('should export all required utility functions from @apexcli/core', async () => {
    // This test verifies the acceptance criteria:
    // "Utility functions for version comparison and npm registry queries implemented with proper error handling"

    const coreModule = await import('./index');

    // Version comparison utilities
    expect(typeof coreModule.satisfiesVersion).toBe('function');
    expect(typeof coreModule.compareVersionStrings).toBe('function');
    expect(typeof coreModule.parseVersionOutput).toBe('function');

    // NPM registry query utilities
    expect(typeof coreModule.queryNpmRegistry).toBe('function');
    expect(typeof coreModule.isPackageVersionAvailable).toBe('function');
    expect(typeof coreModule.getLatestPackageVersion).toBe('function');

    // Health check factory functions
    expect(typeof coreModule.createDoctorCheckResult).toBe('function');
    expect(typeof coreModule.createHealthReport).toBe('function');
  });

  it('should have proper error handling in version comparison functions', () => {
    const { satisfiesVersion, parseVersionOutput } = require('./doctor-utils');

    // Test error handling as specified in acceptance criteria
    expect(satisfiesVersion('', '1.0.0')).toBe(false); // Empty current version
    expect(satisfiesVersion('1.0.0', '')).toBe(false); // Empty required version
    expect(satisfiesVersion('invalid', '1.0.0')).toBe(false); // Invalid current version

    expect(parseVersionOutput(null as any)).toBe(null); // Null input
    expect(parseVersionOutput('')).toBe(null); // Empty string
    expect(parseVersionOutput('invalid output')).toBe(null); // Invalid format
  });

  it('should have proper error handling in npm registry queries', async () => {
    const { queryNpmRegistry } = require('./doctor-utils');

    // Test error handling as specified in acceptance criteria
    const result = await queryNpmRegistry(''); // Empty package name
    expect(result).toBe(null);

    // The queryNpmRegistry function handles network errors, timeouts, and HTTP errors
    // as verified by the comprehensive unit tests in doctor-utils.test.ts
  });

  it('should validate type schemas correctly', () => {
    const { ToolchainCheckSchema, DoctorCheckResultSchema, HealthReportSchema } = require('./types');

    // Test that schemas reject invalid data (proper validation)
    expect(ToolchainCheckSchema.safeParse({}).success).toBe(false);
    expect(DoctorCheckResultSchema.safeParse({}).success).toBe(false);
    expect(HealthReportSchema.safeParse({}).success).toBe(false);

    // Test that schemas accept valid data
    const validToolchain = {
      name: 'node',
      currentVersion: '18.17.0',
      requiredVersion: '16.0.0'
    };
    expect(ToolchainCheckSchema.safeParse(validToolchain).success).toBe(true);
  });
});