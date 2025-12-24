// Validation for ProjectAnalysis with enhanced complexity metrics
// This file verifies the integration works correctly

import { ProjectAnalysis } from './idle-processor';
import { ComplexityHotspot, CodeSmell, DuplicatePattern } from '@apex/core';

// Test that ProjectAnalysis works with enhanced types
function createTestAnalysis(): ProjectAnalysis {
  const complexityHotspot: ComplexityHotspot = {
    file: 'src/complex-service.ts',
    cyclomaticComplexity: 25,
    cognitiveComplexity: 30,
    lineCount: 250,
  };

  const codeSmell: CodeSmell = {
    file: 'src/large-controller.ts',
    type: 'large-class',
    severity: 'critical',
    details: 'Controller has 40 methods and violates SRP',
  };

  const duplicatePattern: DuplicatePattern = {
    pattern: 'async function fetchData() { return await api.get("/data"); }',
    locations: ['src/user-service.ts', 'src/product-service.ts', 'src/order-service.ts'],
    similarity: 0.98,
  };

  return {
    codebaseSize: {
      files: 100,
      lines: 15000,
      languages: { ts: 80, js: 20 },
    },
    testCoverage: {
      percentage: 75,
      uncoveredFiles: ['src/legacy.ts'],
    },
    dependencies: {
      outdated: [],
      security: [],
      outdatedPackages: [],
      securityIssues: [],
      deprecatedPackages: [],
    },
    codeQuality: {
      lintIssues: 15,
      duplicatedCode: [duplicatePattern],
      complexityHotspots: [complexityHotspot],
      codeSmells: [codeSmell],
    },
    documentation: {
      coverage: 60,
      missingDocs: [],
      undocumentedExports: [],
      outdatedDocs: [],
      missingReadmeSections: [],
      apiCompleteness: {
        percentage: 60,
        details: {
          totalEndpoints: 20,
          documentedEndpoints: 12,
          undocumentedItems: [],
          wellDocumentedExamples: [],
          commonIssues: [],
        },
      },
    },
    performance: {
      slowTests: [],
      bottlenecks: [],
    },
    testAnalysis: {
      branchCoverage: { percentage: 75, uncoveredBranches: [] },
      untestedExports: [],
      missingIntegrationTests: [],
      antiPatterns: []
    },
  };
}

// Validate that analyzers can access enhanced data
export function validateAnalyzerIntegration(analysis: ProjectAnalysis): boolean {
  const { codeQuality } = analysis;

  // Verify complexityHotspots structure
  const hasComplexityData = codeQuality.complexityHotspots.every(
    (hotspot) =>
      typeof hotspot.file === 'string' &&
      typeof hotspot.cyclomaticComplexity === 'number' &&
      typeof hotspot.cognitiveComplexity === 'number' &&
      typeof hotspot.lineCount === 'number'
  );

  // Verify codeSmells structure
  const hasCodeSmellData = codeQuality.codeSmells.every(
    (smell) =>
      typeof smell.file === 'string' &&
      typeof smell.type === 'string' &&
      typeof smell.severity === 'string' &&
      typeof smell.details === 'string'
  );

  // Verify duplicatedCode structure
  const hasDuplicatePatternData = codeQuality.duplicatedCode.every(
    (pattern) =>
      typeof pattern.pattern === 'string' &&
      Array.isArray(pattern.locations) &&
      typeof pattern.similarity === 'number' &&
      pattern.similarity >= 0 &&
      pattern.similarity <= 1
  );

  return hasComplexityData && hasCodeSmellData && hasDuplicatePatternData;
}

// Test the validation
const testAnalysis = createTestAnalysis();
const isValid = validateAnalyzerIntegration(testAnalysis);

export { testAnalysis, isValid };