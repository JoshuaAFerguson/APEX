// Type validation for enhanced complexity metrics
// This file verifies that the interfaces compile correctly

import { ComplexityHotspot, CodeSmell, DuplicatePattern } from './types';

// Validate ComplexityHotspot interface
const testHotspot: ComplexityHotspot = {
  file: 'src/test.ts',
  cyclomaticComplexity: 15,
  cognitiveComplexity: 20,
  lineCount: 150,
};

// Validate CodeSmell interface
const testCodeSmell: CodeSmell = {
  file: 'src/smelly.ts',
  type: 'long-method',
  severity: 'high',
  details: 'Method has too many lines',
};

// Validate DuplicatePattern interface
const testDuplicatePattern: DuplicatePattern = {
  pattern: 'if (condition) { return true; }',
  locations: ['file1.ts', 'file2.ts'],
  similarity: 0.95,
};

// Compile-time verification that types work
export function validateTypes(): boolean {
  // Test ComplexityHotspot properties
  const hotspotFile: string = testHotspot.file;
  const cyclomaticValue: number = testHotspot.cyclomaticComplexity;
  const cognitiveValue: number = testHotspot.cognitiveComplexity;
  const lineCountValue: number = testHotspot.lineCount;

  // Test CodeSmell properties
  const smellFile: string = testCodeSmell.file;
  const smellType: 'long-method' | 'large-class' | 'duplicate-code' | 'dead-code' | 'magic-numbers' | 'feature-envy' | 'data-clumps' = testCodeSmell.type;
  const severity: 'low' | 'medium' | 'high' | 'critical' = testCodeSmell.severity;
  const details: string = testCodeSmell.details;

  // Test DuplicatePattern properties
  const pattern: string = testDuplicatePattern.pattern;
  const locations: string[] = testDuplicatePattern.locations;
  const similarity: number = testDuplicatePattern.similarity;

  // All types compile successfully
  return (
    typeof hotspotFile === 'string' &&
    typeof cyclomaticValue === 'number' &&
    typeof cognitiveValue === 'number' &&
    typeof lineCountValue === 'number' &&
    typeof smellFile === 'string' &&
    typeof smellType === 'string' &&
    typeof severity === 'string' &&
    typeof details === 'string' &&
    typeof pattern === 'string' &&
    Array.isArray(locations) &&
    typeof similarity === 'number'
  );
}

// Test array compatibility
const complexityHotspots: ComplexityHotspot[] = [testHotspot];
const codeSmells: CodeSmell[] = [testCodeSmell];
const duplicatePatterns: DuplicatePattern[] = [testDuplicatePattern];

// Mock codeQuality structure matching ProjectAnalysis
const mockCodeQuality = {
  lintIssues: 0,
  duplicatedCode: duplicatePatterns,
  complexityHotspots: complexityHotspots,
  codeSmells: codeSmells,
};

export { mockCodeQuality, complexityHotspots, codeSmells, duplicatePatterns };