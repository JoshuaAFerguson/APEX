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

  /**
   * Calculate complexity severity for a hotspot across all dimensions.
   */
  private calculateSeverity(hotspot: ComplexityHotspot): {
    cyclomaticSeverity: 'low' | 'medium' | 'high' | 'critical';
    cognitiveSeverity: 'low' | 'medium' | 'high' | 'critical';
    lineSeverity: 'low' | 'medium' | 'high' | 'critical';
    overallSeverity: 'low' | 'medium' | 'high' | 'critical';
  } {
    const cyclomaticSeverity = this.classifyComplexity(
      hotspot.cyclomaticComplexity,
      RefactoringAnalyzer.CYCLOMATIC_THRESHOLDS
    );

    const cognitiveSeverity = this.classifyComplexity(
      hotspot.cognitiveComplexity,
      RefactoringAnalyzer.COGNITIVE_THRESHOLDS
    );

    const lineSeverity = this.classifyComplexity(
      hotspot.lineCount,
      RefactoringAnalyzer.LINE_COUNT_THRESHOLDS
    );

    // Overall severity is the maximum of all dimensions
    const severities = [cyclomaticSeverity, cognitiveSeverity, lineSeverity];
    const severityOrder = ['low', 'medium', 'high', 'critical'];
    const maxSeverityIndex = Math.max(
      ...severities.map(s => severityOrder.indexOf(s))
    );
    const overallSeverity = severityOrder[maxSeverityIndex] as 'low' | 'medium' | 'high' | 'critical';

    return {
      cyclomaticSeverity,
      cognitiveSeverity,
      lineSeverity,
      overallSeverity,
    };
  }

  /**
   * Classify a complexity value against thresholds.
   */
  private classifyComplexity(
    value: number,
    thresholds: { low: number; medium: number; high: number; critical: number }
  ): 'low' | 'medium' | 'high' | 'critical' {
    if (value > thresholds.critical) return 'critical';
    if (value > thresholds.high) return 'high';
    if (value > thresholds.medium) return 'medium';
    return 'low';
  }

  /**
   * Calculate prioritization score for a complexity hotspot using weighted formula.
   */
  private calculatePriorityScore(hotspot: ComplexityHotspot): number {
    // Normalize values against critical thresholds (cap at 1.0)
    const normalizedCyclomatic = Math.min(
      1.0,
      hotspot.cyclomaticComplexity / RefactoringAnalyzer.CYCLOMATIC_THRESHOLDS.critical
    );

    const normalizedCognitive = Math.min(
      1.0,
      hotspot.cognitiveComplexity / RefactoringAnalyzer.COGNITIVE_THRESHOLDS.critical
    );

    const normalizedLines = Math.min(
      1.0,
      hotspot.lineCount / RefactoringAnalyzer.LINE_COUNT_THRESHOLDS.critical
    );

    // Calculate weighted score
    const score =
      RefactoringAnalyzer.PRIORITY_WEIGHTS.cyclomatic * normalizedCyclomatic +
      RefactoringAnalyzer.PRIORITY_WEIGHTS.cognitive * normalizedCognitive +
      RefactoringAnalyzer.PRIORITY_WEIGHTS.lineCount * normalizedLines;

    // Apply bonus for combined high complexity
    const severity = this.calculateSeverity(hotspot);
    const hasCombinedHighComplexity =
      (severity.cyclomaticSeverity === 'high' || severity.cyclomaticSeverity === 'critical') &&
      (severity.cognitiveSeverity === 'high' || severity.cognitiveSeverity === 'critical');

    return hasCombinedHighComplexity
      ? score + RefactoringAnalyzer.COMBINED_HIGH_COMPLEXITY_BONUS
      : score;
  }

  /**
   * Get refactoring recommendations based on complexity profile.
   */
  private getRefactoringRecommendations(hotspot: ComplexityHotspot): string[] {
    const severity = this.calculateSeverity(hotspot);
    const recommendations: string[] = [];

    // Recommendations based on cyclomatic complexity
    if (severity.cyclomaticSeverity === 'high' || severity.cyclomaticSeverity === 'critical') {
      recommendations.push('Extract methods to reduce branching complexity');
      recommendations.push('Replace complex conditionals with polymorphism or strategy pattern');
      recommendations.push('Simplify nested control structures using early returns');
    }

    // Recommendations based on cognitive complexity
    if (severity.cognitiveSeverity === 'high' || severity.cognitiveSeverity === 'critical') {
      recommendations.push('Flatten control flow to improve readability');
      recommendations.push('Extract helper methods for complex logic blocks');
      recommendations.push('Add explanatory intermediate variables');
      recommendations.push('Improve variable and method naming for clarity');
    }

    // Recommendations for large files
    if (severity.lineSeverity === 'high' || severity.lineSeverity === 'critical') {
      recommendations.push('Split into multiple modules applying Single Responsibility Principle');
      recommendations.push('Extract related functionality into separate classes');
      recommendations.push('Consider using composition over inheritance');
    }

    // Special case: both cyclomatic and cognitive are high
    if (
      (severity.cyclomaticSeverity === 'high' || severity.cyclomaticSeverity === 'critical') &&
      (severity.cognitiveSeverity === 'high' || severity.cognitiveSeverity === 'critical')
    ) {
      recommendations.push('Consider major refactoring with design patterns');
      recommendations.push('Break down into smaller, focused modules');
      recommendations.push('Apply SOLID principles systematically');
    }

    // If no specific recommendations, provide general guidance
    if (recommendations.length === 0) {
      recommendations.push('Review for potential simplification opportunities');
      recommendations.push('Consider extracting reusable utility functions');
    }

    return recommendations;
  }

  /**
   * Generate detailed description with complexity scores and context.
   */
  private generateHotspotDescription(hotspot: ComplexityHotspot): string {
    const severity = this.calculateSeverity(hotspot);

    // Create complexity score descriptions
    const cyclomaticDesc = `Cyclomatic Complexity: ${hotspot.cyclomaticComplexity} (${severity.cyclomaticSeverity}${
      severity.cyclomaticSeverity === 'critical' ? ' - many execution paths' :
      severity.cyclomaticSeverity === 'high' ? ' - complex branching' : ''
    })`;

    const cognitiveDesc = `Cognitive Complexity: ${hotspot.cognitiveComplexity} (${severity.cognitiveSeverity}${
      severity.cognitiveSeverity === 'critical' ? ' - very hard to understand' :
      severity.cognitiveSeverity === 'high' ? ' - difficult to follow' : ''
    })`;

    const lineDesc = `Lines: ${hotspot.lineCount} (${severity.lineSeverity}${
      severity.lineSeverity === 'critical' ? ' - extremely large file' :
      severity.lineSeverity === 'high' ? ' - consider splitting' : ''
    })`;

    // Contextual message based on overall severity
    let contextMessage = '';
    if (severity.overallSeverity === 'critical') {
      contextMessage = '\n\nThis file requires immediate attention due to critically high complexity.';
    } else if (severity.overallSeverity === 'high') {
      contextMessage = '\n\nThis file should be prioritized for refactoring to improve maintainability.';
    } else if (severity.overallSeverity === 'medium') {
      contextMessage = '\n\nThis file would benefit from targeted refactoring efforts.';
    }

    // Special message for combined high complexity
    if (
      (severity.cyclomaticSeverity === 'high' || severity.cyclomaticSeverity === 'critical') &&
      (severity.cognitiveSeverity === 'high' || severity.cognitiveSeverity === 'critical')
    ) {
      contextMessage += ' The combination of high cyclomatic and cognitive complexity indicates a major refactoring is needed.';
    }

    return `Reduce complexity in ${hotspot.file}:\n• ${cyclomaticDesc}\n• ${cognitiveDesc}\n• ${lineDesc}${contextMessage}`;
  }

  /**
   * Map severity level to task priority.
   */
  private severityToTaskPriority(severity: 'low' | 'medium' | 'high' | 'critical'): TaskPriority {
    switch (severity) {
      case 'critical':
        return 'urgent';
      case 'high':
        return 'high';
      case 'medium':
        return 'normal';
      case 'low':
      default:
        return 'low';
    }
  }

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
