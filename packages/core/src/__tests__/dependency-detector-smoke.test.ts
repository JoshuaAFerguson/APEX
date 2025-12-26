/**
 * Smoke test to verify DependencyDetector can be imported and instantiated
 */

import { describe, it, expect } from 'vitest';
import {
  DependencyDetector,
  dependencyDetector,
  detectDependencies,
  getProjectInstallCommand,
  hasProjectPackageManager,
  type PackageManagerType,
  type DependencyDetectionResult,
  type PackageManagerDetectionResult,
  type PackageManagerConfig
} from '../dependency-detector';

describe('DependencyDetector Smoke Test', () => {
  it('should import DependencyDetector class', () => {
    expect(DependencyDetector).toBeDefined();
    expect(typeof DependencyDetector).toBe('function');
  });

  it('should import global instance', () => {
    expect(dependencyDetector).toBeDefined();
    expect(dependencyDetector).toBeInstanceOf(DependencyDetector);
  });

  it('should import convenience functions', () => {
    expect(detectDependencies).toBeDefined();
    expect(typeof detectDependencies).toBe('function');

    expect(getProjectInstallCommand).toBeDefined();
    expect(typeof getProjectInstallCommand).toBe('function');

    expect(hasProjectPackageManager).toBeDefined();
    expect(typeof hasProjectPackageManager).toBe('function');
  });

  it('should import types', () => {
    // Type imports should be available at compile time
    const testType: PackageManagerType = 'npm';
    expect(testType).toBe('npm');

    // Test that all expected package manager types are valid
    const allTypes: PackageManagerType[] = [
      'npm', 'yarn', 'pnpm', 'pip', 'poetry', 'cargo', 'unknown'
    ];
    expect(allTypes).toContain('npm');
    expect(allTypes).toContain('yarn');
    expect(allTypes).toContain('pnpm');
    expect(allTypes).toContain('pip');
    expect(allTypes).toContain('poetry');
    expect(allTypes).toContain('cargo');
    expect(allTypes).toContain('unknown');
  });

  it('should create new DependencyDetector instance', () => {
    const detector = new DependencyDetector();
    expect(detector).toBeInstanceOf(DependencyDetector);

    // Verify public methods exist
    expect(typeof detector.detectPackageManagers).toBe('function');
    expect(typeof detector.getInstallCommand).toBe('function');
    expect(typeof detector.hasPackageManager).toBe('function');
    expect(typeof detector.getAllInstallCommands).toBe('function');
    expect(typeof detector.clearCache).toBe('function');
  });

  it('should have proper method signatures', () => {
    const detector = new DependencyDetector();

    // These should not throw TypeScript errors
    expect(() => {
      detector.detectPackageManagers('/test/path');
      detector.getInstallCommand('/test/path');
      detector.hasPackageManager('/test/path', 'npm');
      detector.getAllInstallCommands('/test/path');
      detector.clearCache();
    }).not.toThrow();
  });

  it('should support all expected package manager types', () => {
    const detector = new DependencyDetector();

    // All package manager types should be valid for hasPackageManager
    const types: PackageManagerType[] = [
      'npm', 'yarn', 'pnpm', 'pip', 'poetry', 'cargo'
    ];

    types.forEach(type => {
      expect(() => {
        detector.hasPackageManager('/test', type);
      }).not.toThrow();
    });
  });
});