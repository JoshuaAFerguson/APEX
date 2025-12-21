/**
 * Refactoring Strategy Analyzer
 *
 * Analyzes code quality metrics and identifies refactoring opportunities such as:
 * - High complexity files that need simplification
 * - Duplicated code that should be consolidated
 * - Linting issues that indicate code quality problems
 */

import { BaseAnalyzer, TaskCandidate } from './index';
import type { ProjectAnalysis } from '../idle-processor';
import type { ComplexityHotspot, TaskPriority } from '@apexcli/core';

export class RefactoringAnalyzer extends BaseAnalyzer {
  readonly type = 'refactoring' as const;

  // Complexity thresholds for severity classification
  private static readonly CYCLOMATIC_THRESHOLDS = {
    low: 10,
    medium: 20,
    high: 30,
    critical: 50,
  };

  private static readonly COGNITIVE_THRESHOLDS = {
    low: 15,
    medium: 25,
    high: 40,
    critical: 60,
  };

  private static readonly LINE_COUNT_THRESHOLDS = {
    low: 200,
    medium: 500,
    high: 1000,
    critical: 2000,
  };

  // Prioritization weights for scoring algorithm
  private static readonly PRIORITY_WEIGHTS = {
    cyclomatic: 0.40,
    cognitive: 0.35,
    lineCount: 0.25,
  };

  private static readonly COMBINED_HIGH_COMPLEXITY_BONUS = 0.15;

  analyze(analysis: ProjectAnalysis): TaskCandidate[] {
    const candidates: TaskCandidate[] = [];

    // Priority 1: Duplicated code (architectural issue)
    if (analysis.codeQuality.duplicatedCode.length > 0) {
      const duplicateCount = analysis.codeQuality.duplicatedCode.length;
      candidates.push(
        this.createCandidate(
          'duplicated-code',
          'Eliminate Duplicated Code',
          `Refactor ${duplicateCount} ${duplicateCount === 1 ? 'instance' : 'instances'} of duplicated code`,
          {
            priority: 'high',
            effort: 'high',
            workflow: 'refactoring',
            rationale: 'Duplicated code increases maintenance burden and bug risk when changes are needed',
            score: 0.9,
          }
        )
      );
    }

    // Priority 2: Complexity hotspots (large files)
    if (analysis.codeQuality.complexityHotspots.length > 0) {
      const hotspots = analysis.codeQuality.complexityHotspots;
      const hotspotCount = hotspots.length;

      // Create task for each major hotspot (up to 3)
      for (let i = 0; i < Math.min(3, hotspotCount); i++) {
        const file = hotspots[i];
        const fileName = file.split('/').pop() || file;

        candidates.push(
          this.createCandidate(
            `complexity-${i}`,
            `Simplify ${fileName}`,
            `Reduce complexity in ${file} by extracting functions or splitting into modules`,
            {
              priority: 'normal',
              effort: 'high',
              workflow: 'refactoring',
              rationale: 'Large, complex files are harder to understand, test, and maintain',
              score: 0.7 - i * 0.1, // Decreasing priority for subsequent hotspots
            }
          )
        );
      }

      // If many hotspots, also suggest a comprehensive refactoring task
      if (hotspotCount > 3) {
        candidates.push(
          this.createCandidate(
            'complexity-sweep',
            'Address Complexity Hotspots',
            `Review and refactor ${hotspotCount} high-complexity files identified in the codebase`,
            {
              priority: 'normal',
              effort: 'high',
              workflow: 'refactoring',
              rationale: 'Multiple high-complexity files indicate a systemic issue that needs attention',
              score: 0.6,
            }
          )
        );
      }
    }

    // Priority 3: Linting issues (code style and potential bugs)
    if (analysis.codeQuality.lintIssues > 0) {
      const issueCount = analysis.codeQuality.lintIssues;
      const severity = this.calculateLintSeverity(issueCount);

      candidates.push(
        this.createCandidate(
          'lint-issues',
          'Fix Linting Issues',
          `Address ${issueCount} linting ${issueCount === 1 ? 'issue' : 'issues'} in the codebase`,
          {
            priority: severity.priority,
            effort: severity.effort,
            workflow: 'refactoring',
            rationale: 'Linting issues indicate code quality problems that could lead to bugs',
            score: severity.score,
          }
        )
      );
    }

    return candidates;
  }

  /**
   * Calculate severity based on number of lint issues.
   */
  private calculateLintSeverity(issueCount: number): {
    priority: 'low' | 'normal' | 'high' | 'urgent';
    effort: 'low' | 'medium' | 'high';
    score: number;
  } {
    if (issueCount > 200) {
      return { priority: 'high', effort: 'high', score: 0.7 };
    }
    if (issueCount > 50) {
      return { priority: 'normal', effort: 'medium', score: 0.5 };
    }
    if (issueCount > 10) {
      return { priority: 'low', effort: 'low', score: 0.3 };
    }
    return { priority: 'low', effort: 'low', score: 0.2 };
  }
}
