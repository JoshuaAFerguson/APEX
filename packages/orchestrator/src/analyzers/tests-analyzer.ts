/**
 * Tests Strategy Analyzer
 *
 * Analyzes test coverage and identifies testing opportunities such as:
 * - Critical code paths without test coverage
 * - Low overall test coverage
 * - Slow or flaky tests that need attention
 */

import { BaseAnalyzer, TaskCandidate } from './index';
import type { ProjectAnalysis } from '../idle-processor';

export class TestsAnalyzer extends BaseAnalyzer {
  readonly type = 'tests' as const;

  analyze(analysis: ProjectAnalysis): TaskCandidate[] {
    const candidates: TaskCandidate[] = [];

    const testCoverage = analysis.testCoverage;
    const performance = analysis.performance;

    // Priority 1: Critically low test coverage
    if (testCoverage && testCoverage.percentage < 30) {
      candidates.push(
        this.createCandidate(
          'critical-coverage',
          'Add Critical Test Coverage',
          `Increase test coverage from ${testCoverage.percentage.toFixed(1)}% to at least 50% for core functionality`,
          {
            priority: 'high',
            effort: 'high',
            workflow: 'testing',
            rationale: 'Low test coverage increases the risk of bugs and makes refactoring dangerous',
            score: 0.9,
          }
        )
      );
    }

    // Priority 2: Specific uncovered files (critical paths first)
    if (testCoverage && testCoverage.uncoveredFiles.length > 0) {
      const uncoveredFiles = testCoverage.uncoveredFiles;

      // Identify critical files that need tests
      const criticalUncovered = uncoveredFiles.filter(
        (file) =>
          file.includes('service') ||
          file.includes('controller') ||
          file.includes('api') ||
          file.includes('core') ||
          file.includes('handler') ||
          file.includes('middleware')
      );

      if (criticalUncovered.length > 0) {
        candidates.push(
          this.createCandidate(
            'critical-paths',
            'Test Critical Code Paths',
            `Add tests for ${criticalUncovered.length} critical ${criticalUncovered.length === 1 ? 'file' : 'files'}: ${criticalUncovered.slice(0, 3).join(', ')}${criticalUncovered.length > 3 ? '...' : ''}`,
            {
              priority: 'high',
              effort: 'medium',
              workflow: 'testing',
              rationale: 'Critical code paths (services, controllers, APIs) should have test coverage to prevent regressions',
              score: 0.85,
            }
          )
        );
      }

      // General uncovered files
      const nonCriticalCount = uncoveredFiles.length - criticalUncovered.length;
      if (nonCriticalCount > 0) {
        candidates.push(
          this.createCandidate(
            'uncovered-files',
            'Add Tests for Uncovered Files',
            `Add test coverage for ${nonCriticalCount} untested ${nonCriticalCount === 1 ? 'file' : 'files'}`,
            {
              priority: 'normal',
              effort: nonCriticalCount > 10 ? 'high' : 'medium',
              workflow: 'testing',
              rationale: 'Improving test coverage reduces the risk of bugs making it to production',
              score: 0.5,
            }
          )
        );
      }
    }

    // Priority 3: Moderate test coverage improvement
    if (testCoverage && testCoverage.percentage >= 30 && testCoverage.percentage < 70) {
      candidates.push(
        this.createCandidate(
          'improve-coverage',
          'Improve Test Coverage',
          `Increase test coverage from ${testCoverage.percentage.toFixed(1)}% to at least 70%`,
          {
            priority: 'normal',
            effort: 'medium',
            workflow: 'testing',
            rationale: 'Higher test coverage provides better protection against regressions',
            score: 0.6,
          }
        )
      );
    }

    // Priority 4: Slow tests (performance issue)
    if (performance.slowTests.length > 0) {
      candidates.push(
        this.createCandidate(
          'slow-tests',
          'Optimize Slow Tests',
          `Investigate and optimize ${performance.slowTests.length} slow ${performance.slowTests.length === 1 ? 'test' : 'tests'}`,
          {
            priority: 'low',
            effort: 'medium',
            workflow: 'testing',
            rationale: 'Slow tests reduce developer productivity and may indicate issues with test isolation',
            score: 0.4,
          }
        )
      );
    }

    // Priority 5: High coverage maintenance (edge case)
    if (testCoverage && testCoverage.percentage >= 70 && testCoverage.percentage < 80) {
      candidates.push(
        this.createCandidate(
          'maintain-coverage',
          'Maintain High Test Coverage',
          `Push test coverage from ${testCoverage.percentage.toFixed(1)}% to 80%+ for comprehensive protection`,
          {
            priority: 'low',
            effort: 'low',
            workflow: 'testing',
            rationale: 'Maintaining high test coverage ensures continued protection as the codebase grows',
            score: 0.3,
          }
        )
      );
    }

    return candidates;
  }
}
