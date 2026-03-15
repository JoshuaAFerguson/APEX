/**
 * Manual Test Runner for TechnicalDebtAnalyzer
 *
 * This file can be run directly to validate the implementation
 * without needing the full test suite infrastructure.
 */

import { TechnicalDebtAnalyzer } from '../technical-debt-analyzer';
import { TechnicalDebtAnalysisSchema } from '@apexcli/core';
import type { ProjectAnalysis } from '../../idle-processor';

function createTestAnalysis(): ProjectAnalysis {
  return {
    codebaseSize: {
      files: 50,
      lines: 5000,
      languages: { typescript: 4000, javascript: 1000 }
    },
    testCoverage: {
      percentage: 60,
      uncoveredFiles: ['uncovered1.ts', 'uncovered2.ts']
    },
    dependencies: {
      outdated: [],
      security: [],
      outdatedPackages: [
        {
          name: 'test-package',
          currentVersion: '1.0.0',
          latestVersion: '2.0.0',
          updateType: 'major' as const
        }
      ],
      securityIssues: [
        {
          name: 'vulnerable-package',
          cveId: 'CVE-2023-12345',
          severity: 'high' as const,
          affectedVersions: '<2.0.0',
          description: 'Test security vulnerability'
        }
      ],
      deprecatedPackages: []
    },
    codeQuality: {
      lintIssues: 25,
      duplicatedCode: [
        {
          pattern: 'validation logic',
          locations: ['user.ts', 'admin.ts', 'guest.ts'],
          similarity: 0.9
        }
      ],
      complexityHotspots: [
        {
          file: 'complex.ts',
          cyclomaticComplexity: 45,
          cognitiveComplexity: 55,
          lineCount: 800,
          functionName: 'complexFunction'
        }
      ],
      codeSmells: [
        {
          file: 'smelly.ts',
          type: 'large-class',
          severity: 'medium' as const,
          details: 'Class with too many responsibilities. Suggestion: Break into smaller classes'
        }
      ]
    },
    documentation: {
      coveragePercentage: 70,
      undocumentedExports: [],
      outdatedDocumentation: [],
      missingReadmeSections: [],
      apiCompleteness: {
        documented: 70,
        total: 100,
        coveragePercentage: 70
      }
    } as any,
    performance: {
      bundleSize: 2048,
      slowTests: [],
      bottlenecks: []
    },
    testAnalysis: {
      branchCoverage: {
        percentage: 65,
        uncoveredBranches: []
      },
      antiPatterns: [],
      untestedExports: [],
      missingIntegrationTests: []
    }
  };
}

function runManualTests() {
  console.log('🧪 Running TechnicalDebtAnalyzer Manual Tests...\n');

  const analyzer = new TechnicalDebtAnalyzer();
  const testAnalysis = createTestAnalysis();

  try {
    // Test 1: Basic functionality
    console.log('✅ Test 1: Basic instantiation and type verification');
    console.log(`   Analyzer type: ${analyzer.type}`);

    // Test 2: Task candidate generation
    console.log('\n✅ Test 2: Task candidate generation');
    const candidates = analyzer.analyze(testAnalysis);
    console.log(`   Generated ${candidates.length} candidates`);

    candidates.forEach((candidate, index) => {
      console.log(`   ${index + 1}. ${candidate.candidateId} (${candidate.priority})`);
    });

    // Test 3: Technical debt analysis creation
    console.log('\n✅ Test 3: TechnicalDebtAnalysis creation');
    const debtAnalysis = analyzer.createTechnicalDebtAnalysis(testAnalysis);
    console.log(`   Total Score: ${debtAnalysis.totalScore}`);
    console.log(`   Categories: ${debtAnalysis.categories.length}`);
    console.log(`   Hotspots: ${debtAnalysis.hotspots.length}`);

    // Test 4: Metrics validation
    console.log('\n✅ Test 4: Metrics validation');
    if (debtAnalysis.metrics) {
      console.log(`   Code Complexity: ${debtAnalysis.metrics.codeComplexity}`);
      console.log(`   Test Coverage: ${debtAnalysis.metrics.testCoverage}%`);
      console.log(`   Duplicated Lines: ${debtAnalysis.metrics.duplicatedLinesPercent}%`);
      console.log(`   Maintainability Index: ${debtAnalysis.metrics.maintainabilityIndex}`);
    } else {
      throw new Error('Metrics object is missing');
    }

    // Test 5: Schema validation
    console.log('\n✅ Test 5: Schema validation');
    const validatedAnalysis = TechnicalDebtAnalysisSchema.parse(debtAnalysis);
    console.log('   ✓ Analysis passes schema validation');

    // Test 6: Bounds checking
    console.log('\n✅ Test 6: Bounds checking');
    console.log(`   Total score bounds: 0 ≤ ${debtAnalysis.totalScore} ≤ 100`);

    if (debtAnalysis.totalScore < 0 || debtAnalysis.totalScore > 100) {
      throw new Error(`Total score ${debtAnalysis.totalScore} is out of bounds`);
    }

    debtAnalysis.hotspots.forEach((hotspot, index) => {
      if (hotspot.score < 0 || hotspot.score > 100) {
        throw new Error(`Hotspot ${index + 1} score ${hotspot.score} is out of bounds`);
      }
    });

    if (debtAnalysis.metrics?.testCoverage !== undefined) {
      if (debtAnalysis.metrics.testCoverage < 0 || debtAnalysis.metrics.testCoverage > 100) {
        throw new Error(`Test coverage ${debtAnalysis.metrics.testCoverage} is out of bounds`);
      }
    }

    console.log('   ✓ All bounds checks passed');

    // Test 7: Consistency check
    console.log('\n✅ Test 7: Consistency check');
    const analysis2 = analyzer.createTechnicalDebtAnalysis(testAnalysis);
    if (analysis2.totalScore !== debtAnalysis.totalScore) {
      throw new Error('Analysis results are not consistent across multiple runs');
    }
    console.log('   ✓ Multiple runs produce consistent results');

    // Test 8: Edge case handling
    console.log('\n✅ Test 8: Edge case handling');
    const emptyAnalysis: ProjectAnalysis = {
      codebaseSize: { files: 0, lines: 0, languages: {} },
      testCoverage: null,
      dependencies: {
        outdated: [],
        security: [],
        outdatedPackages: [],
        securityIssues: [],
        deprecatedPackages: []
      },
      codeQuality: {
        lintIssues: 0,
        duplicatedCode: [],
        complexityHotspots: [],
        codeSmells: []
      },
      documentation: null as any,
      performance: null as any,
      testAnalysis: null as any
    };

    const emptyResult = analyzer.createTechnicalDebtAnalysis(emptyAnalysis);
    TechnicalDebtAnalysisSchema.parse(emptyResult);
    console.log('   ✓ Handles empty/null analysis gracefully');

    console.log('\n🎉 All manual tests passed!');
    console.log('\n📊 Final Analysis Summary:');
    console.log('─'.repeat(50));
    console.log(`Total Debt Score: ${debtAnalysis.totalScore}/100`);
    console.log(`Task Candidates: ${candidates.length}`);
    console.log(`Debt Categories: ${debtAnalysis.categories.length}`);
    console.log(`Technical Debt Hotspots: ${debtAnalysis.hotspots.length}`);
    console.log('─'.repeat(50));

    // Display categories
    if (debtAnalysis.categories.length > 0) {
      console.log('\n📋 Debt Categories:');
      debtAnalysis.categories.forEach(category => {
        console.log(`  • ${category.category}: ${category.count} issues (${category.severity})`);
      });
    }

    // Display top hotspots
    if (debtAnalysis.hotspots.length > 0) {
      console.log('\n🔥 Top Hotspots:');
      debtAnalysis.hotspots.slice(0, 3).forEach((hotspot, index) => {
        console.log(`  ${index + 1}. ${hotspot.path} (score: ${hotspot.score})`);
        console.log(`     Issues: ${hotspot.issues.join(', ')}`);
      });
    }

    return true;

  } catch (error) {
    console.error('\n❌ Test failed:', error);
    console.error('Stack trace:', (error as Error).stack);
    return false;
  }
}

// Export for potential use in other test files
export { runManualTests };

// Run tests if this file is executed directly
if (require.main === module) {
  const success = runManualTests();
  process.exit(success ? 0 : 1);
}