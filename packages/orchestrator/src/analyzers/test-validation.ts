/**
 * Quick validation script to ensure all test imports are correct
 */

// Validate imports used in the new test files
import { RefactoringAnalyzer } from './refactoring-analyzer';
import type { ProjectAnalysis } from '../idle-processor';
import type { ComplexityHotspot, CodeSmell } from '@apexcli/core';

// Basic validation that types are accessible
const analyzer = new RefactoringAnalyzer();
console.log('RefactoringAnalyzer type:', analyzer.type);

// Type validation
const sampleHotspot: ComplexityHotspot = {
  file: 'test.ts',
  functionName: 'testFunction',
  cyclomaticComplexity: 10,
  cognitiveComplexity: 12,
  lineCount: 200
};

const sampleSmell: CodeSmell = {
  file: 'test.ts',
  type: 'long-method',
  severity: 'medium',
  details: 'Test smell'
};

const sampleAnalysis: ProjectAnalysis = {
  codebaseSize: {
    files: 10,
    lines: 1000,
    languages: { 'ts': 10 }
  },
  dependencies: {
    outdated: [],
    security: []
  },
  codeQuality: {
    lintIssues: 0,
    duplicatedCode: [],
    complexityHotspots: [sampleHotspot],
    codeSmells: [sampleSmell]
  },
  documentation: {
    coverage: 50,
    missingDocs: [],
    undocumentedExports: [],
    outdatedDocs: [],
    missingReadmeSections: [],
    apiCompleteness: {
      percentage: 70,
      details: {
        totalEndpoints: 10,
        documentedEndpoints: 7,
        undocumentedItems: [],
        wellDocumentedExamples: [],
        commonIssues: []
      }
    }
  },
  performance: {
    slowTests: [],
    bottlenecks: []
  },
  testAnalysis: {
    branchCoverage: {
      percentage: 85,
      uncoveredBranches: []
    },
    untestedExports: [],
    testAntiPatterns: [],
    missedAssertions: []
  }
};

// Test that analyzer can process the data
const candidates = analyzer.analyze(sampleAnalysis);
console.log('Generated candidates:', candidates.length);

console.log('✅ All imports and types are valid');
export { sampleAnalysis, sampleHotspot, sampleSmell };