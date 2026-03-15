import { describe, it, expect } from 'vitest';
import {
  CodebaseAnalysisSchema,
  StackAnalysisSchema,
  ArchitectureAnalysisSchema,
  ConventionAnalysisSchema,
  TechnicalDebtAnalysisSchema,
} from '../types';

describe('CodebaseAnalysis Schema Validation', () => {
  it('should validate all schemas are properly exported', () => {
    // This test verifies that all schemas are accessible and have parse methods
    expect(typeof StackAnalysisSchema.parse).toBe('function');
    expect(typeof ArchitectureAnalysisSchema.parse).toBe('function');
    expect(typeof ConventionAnalysisSchema.parse).toBe('function');
    expect(typeof TechnicalDebtAnalysisSchema.parse).toBe('function');
    expect(typeof CodebaseAnalysisSchema.parse).toBe('function');
  });

  it('should create minimal valid objects for each schema', () => {
    // Test minimal valid objects to ensure schema constraints work
    const minimalStack = {
      primaryLanguage: 'JavaScript',
      languages: [{ name: 'JavaScript', percentage: 100, files: 1 }],
      frameworks: [],
      buildTools: [],
      packageManagers: ['npm' as const],
    };

    const minimalArchitecture = {
      pattern: 'monolithic' as const,
      components: [],
      layers: [],
      dependencies: { external: 0, internal: 0, circular: 0 },
    };

    const minimalConventions = {
      fileNaming: 'camelCase' as const,
      functionNaming: 'camelCase' as const,
      variableNaming: 'camelCase' as const,
      indentation: { type: 'spaces' as const },
      imports: { style: 'es6' as const },
      documentation: { style: 'none' as const, coverage: 0 },
    };

    const minimalDebt = {
      totalScore: 0,
      categories: [],
      hotspots: [],
    };

    const minimalAnalysis = {
      timestamp: new Date(),
      projectPath: '/test',
      stack: minimalStack,
      architecture: minimalArchitecture,
      conventions: minimalConventions,
      technicalDebt: minimalDebt,
      summary: {
        totalFiles: 1,
        totalLines: 10,
        analysisVersion: '1.0.0',
      },
    };

    // Should not throw
    expect(() => StackAnalysisSchema.parse(minimalStack)).not.toThrow();
    expect(() => ArchitectureAnalysisSchema.parse(minimalArchitecture)).not.toThrow();
    expect(() => ConventionAnalysisSchema.parse(minimalConventions)).not.toThrow();
    expect(() => TechnicalDebtAnalysisSchema.parse(minimalDebt)).not.toThrow();
    expect(() => CodebaseAnalysisSchema.parse(minimalAnalysis)).not.toThrow();
  });

  it('should reject invalid data', () => {
    // Test that schemas properly reject invalid data
    expect(() => StackAnalysisSchema.parse({})).toThrow();
    expect(() => ArchitectureAnalysisSchema.parse({})).toThrow();
    expect(() => ConventionAnalysisSchema.parse({})).toThrow();
    expect(() => TechnicalDebtAnalysisSchema.parse({})).toThrow();
    expect(() => CodebaseAnalysisSchema.parse({})).toThrow();
  });
});