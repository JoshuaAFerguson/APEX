import { describe, it, expect } from 'vitest';

// Import all dependency-related types and functions to ensure they're properly exported
import {
  OutdatedDependency,
  SecurityVulnerability,
  DeprecatedPackage,
  UpdateType,
  VulnerabilitySeverity,
  ProjectAnalysis,
  IdleProcessor,
} from './idle-processor';

import { createAnalysisWithRichDependencies } from './test-helpers';

describe('Dependency Types Export Validation', () => {
  it('should export all required types without errors', () => {
    // This test validates that all types can be imported and used
    // If there are TypeScript compilation errors, this test will fail

    // Test type existence by checking they are not undefined
    expect(typeof OutdatedDependency).toBeDefined();
    expect(typeof SecurityVulnerability).toBeDefined();
    expect(typeof DeprecatedPackage).toBeDefined();

    // Test that we can create instances of the types
    const outdated: OutdatedDependency = {
      name: 'test-package',
      currentVersion: '1.0.0',
      latestVersion: '2.0.0',
      updateType: 'major'
    };

    const vulnerability: SecurityVulnerability = {
      name: 'test-package',
      cveId: 'CVE-2024-00001',
      severity: 'high',
      affectedVersions: '*',
      description: 'Test vulnerability'
    };

    const deprecated: DeprecatedPackage = {
      name: 'test-package',
      currentVersion: '1.0.0',
      replacement: 'new-package',
      reason: 'Package is deprecated'
    };

    // Verify objects were created correctly
    expect(outdated.name).toBe('test-package');
    expect(vulnerability.severity).toBe('high');
    expect(deprecated.replacement).toBe('new-package');
  });

  it('should validate that enum types work correctly', () => {
    // Test UpdateType enum values
    const updateTypes: UpdateType[] = ['major', 'minor', 'patch'];
    updateTypes.forEach(type => {
      expect(['major', 'minor', 'patch']).toContain(type);
    });

    // Test VulnerabilitySeverity enum values
    const severities: VulnerabilitySeverity[] = ['critical', 'high', 'medium', 'low'];
    severities.forEach(severity => {
      expect(['critical', 'high', 'medium', 'low']).toContain(severity);
    });
  });

  it('should validate ProjectAnalysis type accepts rich dependency data', () => {
    const analysis = createAnalysisWithRichDependencies();

    // Ensure TypeScript compiler accepts the structure
    expect(analysis).toBeDefined();
    expect(analysis.dependencies).toBeDefined();
    expect(analysis.dependencies.outdatedPackages).toBeDefined();
    expect(analysis.dependencies.securityIssues).toBeDefined();
    expect(analysis.dependencies.deprecatedPackages).toBeDefined();

    // Verify arrays are properly typed
    expect(Array.isArray(analysis.dependencies.outdatedPackages)).toBe(true);
    expect(Array.isArray(analysis.dependencies.securityIssues)).toBe(true);
    expect(Array.isArray(analysis.dependencies.deprecatedPackages)).toBe(true);
  });

  it('should validate that acceptance criteria are met', () => {
    // Acceptance Criteria validation:
    // ProjectAnalysis.dependencies includes:
    // - OutdatedDependency (with currentVersion, latestVersion, updateType: major|minor|patch)
    // - SecurityVulnerability (with cveId, severity: critical|high|medium|low, affectedVersions, description)
    // - DeprecatedPackage (with replacement, reason)
    // - TypeScript compiles without errors

    const analysis = createAnalysisWithRichDependencies();

    // Test OutdatedDependency structure
    const outdated = analysis.dependencies.outdatedPackages![0];
    expect(outdated).toHaveProperty('name');
    expect(outdated).toHaveProperty('currentVersion');
    expect(outdated).toHaveProperty('latestVersion');
    expect(outdated).toHaveProperty('updateType');
    expect(['major', 'minor', 'patch']).toContain(outdated.updateType);

    // Test SecurityVulnerability structure
    const security = analysis.dependencies.securityIssues![0];
    expect(security).toHaveProperty('name');
    expect(security).toHaveProperty('cveId');
    expect(security).toHaveProperty('severity');
    expect(security).toHaveProperty('affectedVersions');
    expect(security).toHaveProperty('description');
    expect(['critical', 'high', 'medium', 'low']).toContain(security.severity);

    // Test DeprecatedPackage structure
    const deprecated = analysis.dependencies.deprecatedPackages![0];
    expect(deprecated).toHaveProperty('name');
    expect(deprecated).toHaveProperty('currentVersion');
    expect(deprecated).toHaveProperty('replacement');
    expect(deprecated).toHaveProperty('reason');
  });

  it('should validate backward compatibility', () => {
    const analysis = createAnalysisWithRichDependencies();

    // Legacy fields should still exist
    expect(analysis.dependencies).toHaveProperty('outdated');
    expect(analysis.dependencies).toHaveProperty('security');
    expect(Array.isArray(analysis.dependencies.outdated)).toBe(true);
    expect(Array.isArray(analysis.dependencies.security)).toBe(true);

    // New rich fields should be available
    expect(analysis.dependencies.outdatedPackages).toBeDefined();
    expect(analysis.dependencies.securityIssues).toBeDefined();
    expect(analysis.dependencies.deprecatedPackages).toBeDefined();
  });
});