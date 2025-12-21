/**
 * Manual validation script for RefactoringAnalyzer
 * Tests core functionality without requiring vitest execution
 */

import { RefactoringAnalyzer } from './refactoring-analyzer';
import type { ProjectAnalysis } from '../idle-processor';
import type { ComplexityHotspot } from '@apexcli/core';

// Helper function to validate test expectations
function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
  console.log(`✓ ${message}`);
}

// Test data setup
function createBaseProjectAnalysis(): ProjectAnalysis {
  return {
    codebaseSize: {
      files: 50,
      lines: 5000,
      languages: { 'ts': 40, 'js': 10 }
    },
    dependencies: {
      outdated: [],
      security: []
    },
    codeQuality: {
      lintIssues: 0,
      duplicatedCode: [],
      complexityHotspots: [],
      codeSmells: []
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
          totalEndpoints: 20,
          documentedEndpoints: 14,
          undocumentedItems: [],
          wellDocumentedExamples: [],
          commonIssues: []
        }
      }
    },
    performance: {
      slowTests: [],
      bottlenecks: []
    }
  };
}

// Run validation tests
function runValidationTests(): void {
  console.log('🧪 Running RefactoringAnalyzer validation tests...\n');

  const analyzer = new RefactoringAnalyzer();

  // Test 1: Type property
  assert(analyzer.type === 'refactoring', 'Analyzer type should be "refactoring"');

  // Test 2: Duplicated code analysis
  console.log('\n📋 Testing duplicated code analysis...');
  const duplicateAnalysis = createBaseProjectAnalysis();
  duplicateAnalysis.codeQuality.duplicatedCode = ['src/dup1.ts', 'src/dup2.ts', 'src/dup3.ts'];

  const duplicateCandidates = analyzer.analyze(duplicateAnalysis);
  const duplicateTask = duplicateCandidates.find(c => c.title.includes('Duplicated Code'));

  assert(duplicateTask !== undefined, 'Should generate duplicated code task');
  assert(duplicateTask!.priority === 'high', 'Duplicated code task should have high priority');
  assert(duplicateTask!.score === 0.9, 'Duplicated code task should have score 0.9');
  assert(duplicateTask!.description.includes('3 instances'), 'Should mention 3 instances');

  // Test 3: Complex hotspot analysis
  console.log('\n🔥 Testing complexity hotspot analysis...');
  const complexityAnalysis = createBaseProjectAnalysis();
  const criticalHotspot: ComplexityHotspot = {
    file: 'src/critical.ts',
    cyclomaticComplexity: 55, // Critical
    cognitiveComplexity: 65, // Critical
    lineCount: 2500 // Critical
  };
  complexityAnalysis.codeQuality.complexityHotspots = [criticalHotspot];

  const complexityCandidates = analyzer.analyze(complexityAnalysis);
  const hotspotTask = complexityCandidates.find(c => c.candidateId === 'refactoring-complexity-hotspot-0');

  assert(hotspotTask !== undefined, 'Should generate complexity hotspot task');
  assert(hotspotTask!.priority === 'urgent', 'Critical complexity should have urgent priority');
  assert(hotspotTask!.description.includes('critical.ts'), 'Should mention the critical file');
  assert(hotspotTask!.description.includes('(critical'), 'Should classify as critical');

  // Test 4: Prioritization scoring
  console.log('\n📊 Testing prioritization scoring...');
  const multiHotspotAnalysis = createBaseProjectAnalysis();
  const hotspots: ComplexityHotspot[] = [
    {
      file: 'src/low.ts',
      cyclomaticComplexity: 10,
      cognitiveComplexity: 15,
      lineCount: 200
    },
    {
      file: 'src/high.ts',
      cyclomaticComplexity: 40,
      cognitiveComplexity: 50,
      lineCount: 1500
    }
  ];
  multiHotspotAnalysis.codeQuality.complexityHotspots = hotspots;

  const multiCandidates = analyzer.analyze(multiHotspotAnalysis);
  const hotspotTasks = multiCandidates.filter(c => c.candidateId.includes('complexity-hotspot-'));

  assert(hotspotTasks.length === 2, 'Should generate 2 hotspot tasks');
  assert(hotspotTasks[0].description.includes('high.ts'), 'First task should be highest scoring');
  assert(hotspotTasks[0].score > hotspotTasks[1].score, 'Tasks should be sorted by score');

  // Test 5: Lint issues analysis
  console.log('\n🔍 Testing lint issues analysis...');
  const lintAnalysis = createBaseProjectAnalysis();
  lintAnalysis.codeQuality.lintIssues = 300; // Should be high priority

  const lintCandidates = analyzer.analyze(lintAnalysis);
  const lintTask = lintCandidates.find(c => c.candidateId === 'refactoring-lint-issues');

  assert(lintTask !== undefined, 'Should generate lint issues task');
  assert(lintTask!.priority === 'high', 'Many lint issues should have high priority');
  assert(lintTask!.description.includes('300 linting issues'), 'Should mention issue count');

  // Test 6: Mixed scenario prioritization
  console.log('\n🎯 Testing mixed scenario prioritization...');
  const mixedAnalysis = createBaseProjectAnalysis();
  mixedAnalysis.codeQuality.duplicatedCode = ['src/dup.ts']; // Score 0.9
  mixedAnalysis.codeQuality.lintIssues = 50; // Lower score

  const mixedCandidates = analyzer.analyze(mixedAnalysis);
  const prioritized = analyzer.prioritize(mixedCandidates);

  assert(prioritized !== null, 'Should return a prioritized task');
  assert(prioritized!.title.includes('Duplicated Code'), 'Should prioritize duplicated code');

  // Test 7: Empty project
  console.log('\n🏛️ Testing well-maintained project...');
  const cleanAnalysis = createBaseProjectAnalysis();
  // All default values (no issues)

  const cleanCandidates = analyzer.analyze(cleanAnalysis);
  assert(cleanCandidates.length === 0, 'Clean project should generate no candidates');

  // Test 8: Legacy string format support
  console.log('\n📜 Testing legacy string format support...');
  const legacyAnalysis = createBaseProjectAnalysis();
  legacyAnalysis.codeQuality.complexityHotspots = ['src/legacy.ts'] as any;

  const legacyCandidates = analyzer.analyze(legacyAnalysis);
  const legacyTask = legacyCandidates.find(c => c.candidateId === 'refactoring-complexity-hotspot-0');

  assert(legacyTask !== undefined, 'Should handle legacy string format');
  assert(legacyTask!.description.includes('Cyclomatic Complexity: 15 (medium)'), 'Should assign default values');

  // Test 9: Aggregate complexity sweep
  console.log('\n🧹 Testing complexity sweep for many hotspots...');
  const manyHotspotsAnalysis = createBaseProjectAnalysis();
  const manyHotspots: ComplexityHotspot[] = Array.from({ length: 5 }, (_, i) => ({
    file: `src/file${i}.ts`,
    cyclomaticComplexity: 20,
    cognitiveComplexity: 25,
    lineCount: 400
  }));
  manyHotspotsAnalysis.codeQuality.complexityHotspots = manyHotspots;

  const sweepCandidates = analyzer.analyze(manyHotspotsAnalysis);
  const sweepTask = sweepCandidates.find(c => c.candidateId === 'refactoring-complexity-sweep');

  assert(sweepTask !== undefined, 'Should generate aggregate complexity sweep task');
  assert(sweepTask!.description.includes('5 complexity hotspots'), 'Should mention total count');

  console.log('\n🎉 All validation tests passed successfully!');
  console.log('RefactoringAnalyzer implementation is working correctly.');
}

// Export for potential use in other contexts
export { runValidationTests };

// Run if this file is executed directly
if (require.main === module) {
  try {
    runValidationTests();
  } catch (error) {
    console.error('\n❌ Validation failed:', error);
    process.exit(1);
  }
}