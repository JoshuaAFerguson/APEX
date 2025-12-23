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
import type { ComplexityHotspot, TaskPriority, CodeSmell } from '@apexcli/core';

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

    // Priority 2: Enhanced Complexity Hotspots Analysis
    if (analysis.codeQuality.complexityHotspots.length > 0) {
      const hotspots = analysis.codeQuality.complexityHotspots;

      // Handle legacy string format or ComplexityHotspot objects
      const complexityHotspots: ComplexityHotspot[] = hotspots.map(hotspot => {
        if (typeof hotspot === 'string') {
          // Legacy format - create a basic ComplexityHotspot with default values
          return {
            file: hotspot,
            cyclomaticComplexity: 15, // Default medium complexity
            cognitiveComplexity: 20,  // Default medium complexity
            lineCount: 300,           // Default medium size
          };
        }
        return hotspot as ComplexityHotspot;
      });

      // Calculate priority scores and sort by score (highest first)
      const scoredHotspots = complexityHotspots
        .map(hotspot => ({ hotspot, score: this.calculatePriorityScore(hotspot) }))
        .sort((a, b) => b.score - a.score);

      // Generate candidates for top hotspots (up to 3)
      for (let i = 0; i < Math.min(3, scoredHotspots.length); i++) {
        const { hotspot, score } = scoredHotspots[i];
        const severity = this.calculateSeverity(hotspot);
        const fileName = hotspot.file.split('/').pop() || hotspot.file;
        const recommendations = this.getRefactoringRecommendations(hotspot);

        candidates.push(
          this.createCandidate(
            `complexity-hotspot-${i}`,
            `Refactor ${fileName}`,
            this.generateHotspotDescription(hotspot),
            {
              priority: this.severityToTaskPriority(severity.overallSeverity),
              effort: severity.overallSeverity === 'critical' ? 'high' :
                      severity.overallSeverity === 'high' ? 'high' : 'medium',
              workflow: 'refactoring',
              rationale: `Complexity Analysis:\n` +
                `- Cyclomatic: ${hotspot.cyclomaticComplexity} (${severity.cyclomaticSeverity})\n` +
                `- Cognitive: ${hotspot.cognitiveComplexity} (${severity.cognitiveSeverity})\n` +
                `- Lines: ${hotspot.lineCount}\n\n` +
                `Recommended actions:\n${recommendations.map(r => `• ${r}`).join('\n')}`,
              score: Math.min(0.95, 0.6 + score * 0.35), // Base 0.6, max 0.95
            }
          )
        );
      }

      // Aggregate task for many hotspots
      if (scoredHotspots.length > 3) {
        const criticalCount = scoredHotspots.filter(
          ({ hotspot }) => this.calculateSeverity(hotspot).overallSeverity === 'critical'
        ).length;

        candidates.push(
          this.createCandidate(
            'complexity-sweep',
            'Address Codebase Complexity',
            `Systematic refactoring of ${scoredHotspots.length} complexity hotspots` +
            (criticalCount > 0 ? ` (${criticalCount} critical)` : ''),
            {
              priority: criticalCount > 0 ? 'high' : 'normal',
              effort: 'high',
              workflow: 'refactoring',
              rationale: 'Multiple complexity hotspots indicate systemic code quality issues',
              score: 0.55,
            }
          )
        );
      }
    }

    // Priority 3: Code Smells (specific anti-patterns and design issues)
    if (analysis.codeQuality.codeSmells && analysis.codeQuality.codeSmells.length > 0) {
      const codeSmells = analysis.codeQuality.codeSmells;

      // Group code smells by type for better organization
      const smellGroups = this.groupCodeSmellsByType(codeSmells);

      // Process each smell type
      for (const [smellType, smells] of smellGroups.entries()) {
        const smellAnalysis = this.analyzeCodeSmellGroup(smellType, smells);

        if (smellAnalysis.shouldCreateTask) {
          candidates.push(
            this.createCandidate(
              `code-smell-${smellType}`,
              smellAnalysis.title,
              smellAnalysis.description,
              {
                priority: smellAnalysis.priority,
                effort: smellAnalysis.effort,
                workflow: 'refactoring',
                rationale: smellAnalysis.rationale,
                score: smellAnalysis.score,
              }
            )
          );
        }
      }
    }

    // Priority 4: Linting issues (code style and potential bugs)
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
   * Group code smells by type for organized processing.
   */
  private groupCodeSmellsByType(codeSmells: CodeSmell[]): Map<string, CodeSmell[]> {
    const groups = new Map<string, CodeSmell[]>();

    for (const smell of codeSmells) {
      const type = smell.type;
      if (!groups.has(type)) {
        groups.set(type, []);
      }
      groups.get(type)!.push(smell);
    }

    return groups;
  }

  /**
   * Analyze a group of code smells of the same type and determine task creation strategy.
   */
  private analyzeCodeSmellGroup(smellType: string, smells: CodeSmell[]): {
    shouldCreateTask: boolean;
    title: string;
    description: string;
    priority: TaskPriority;
    effort: 'low' | 'medium' | 'high';
    rationale: string;
    score: number;
  } {
    const smellCount = smells.length;

    // Calculate overall severity based on individual smell severities
    const criticalCount = smells.filter(s => s.severity === 'critical').length;
    const highCount = smells.filter(s => s.severity === 'high').length;
    const mediumCount = smells.filter(s => s.severity === 'medium').length;

    let overallSeverity: 'low' | 'medium' | 'high' | 'critical';
    let priority: TaskPriority;
    let effort: 'low' | 'medium' | 'high';
    let score: number;

    if (criticalCount > 0) {
      overallSeverity = 'critical';
      priority = 'urgent';
      effort = 'high';
      score = 0.85;
    } else if (highCount > 0) {
      overallSeverity = 'high';
      priority = 'high';
      effort = 'high';
      score = 0.75;
    } else if (mediumCount >= smellCount * 0.7) {
      overallSeverity = 'medium';
      priority = 'normal';
      effort = 'medium';
      score = 0.6;
    } else {
      overallSeverity = 'low';
      priority = 'low';
      effort = 'low';
      score = 0.4;
    }

    // Adjust score based on count
    if (smellCount > 5) {
      score += 0.1;
    }
    if (smellCount > 10) {
      score += 0.1;
    }

    // Generate type-specific content
    const smellTypeInfo = this.getCodeSmellTypeInfo(smellType, smells);

    return {
      shouldCreateTask: true,
      title: smellTypeInfo.title,
      description: smellTypeInfo.description,
      priority,
      effort,
      rationale: smellTypeInfo.rationale,
      score: Math.min(score, 0.95), // Cap at 0.95
    };
  }

  /**
   * Get type-specific information for different code smell types.
   */
  private getCodeSmellTypeInfo(smellType: string, smells: CodeSmell[]): {
    title: string;
    description: string;
    rationale: string;
  } {
    const smellCount = smells.length;
    const filesList = smells.map(s => s.file.split('/').pop() || s.file).slice(0, 3);
    const filesText = filesList.join(', ') + (smellCount > 3 ? `, and ${smellCount - 3} more` : '');

    switch (smellType) {
      case 'long-method':
        return {
          title: 'Refactor Long Methods',
          description: `Address ${smellCount} long ${smellCount === 1 ? 'method' : 'methods'} in ${filesText}`,
          rationale: this.getLongMethodRationale(smells),
        };

      case 'large-class':
        return {
          title: 'Break Down Large Classes',
          description: `Refactor ${smellCount} oversized ${smellCount === 1 ? 'class' : 'classes'} in ${filesText}`,
          rationale: this.getLargeClassRationale(smells),
        };

      case 'deep-nesting':
        return {
          title: 'Reduce Deep Nesting',
          description: `Simplify ${smellCount} deeply nested code ${smellCount === 1 ? 'block' : 'blocks'} in ${filesText}`,
          rationale: this.getDeepNestingRationale(smells),
        };

      case 'duplicate-code':
        return {
          title: 'Eliminate Code Duplication',
          description: `Consolidate ${smellCount} duplicate code ${smellCount === 1 ? 'pattern' : 'patterns'} in ${filesText}`,
          rationale: this.getDuplicateCodeRationale(smells),
        };

      case 'dead-code':
        return {
          title: 'Remove Dead Code',
          description: `Clean up ${smellCount} unused code ${smellCount === 1 ? 'segment' : 'segments'} in ${filesText}`,
          rationale: this.getDeadCodeRationale(smells),
        };

      case 'magic-numbers':
        return {
          title: 'Replace Magic Numbers',
          description: `Replace ${smellCount} magic ${smellCount === 1 ? 'number' : 'numbers'} with named constants in ${filesText}`,
          rationale: this.getMagicNumbersRationale(smells),
        };

      case 'feature-envy':
        return {
          title: 'Fix Feature Envy',
          description: `Relocate ${smellCount} misplaced ${smellCount === 1 ? 'method' : 'methods'} in ${filesText}`,
          rationale: this.getFeatureEnvyRationale(smells),
        };

      case 'data-clumps':
        return {
          title: 'Consolidate Data Clumps',
          description: `Group ${smellCount} data ${smellCount === 1 ? 'clump' : 'clumps'} into cohesive objects in ${filesText}`,
          rationale: this.getDataClumpsRationale(smells),
        };

      default:
        return {
          title: `Fix ${smellType} Code Smells`,
          description: `Address ${smellCount} ${smellType} ${smellCount === 1 ? 'issue' : 'issues'} in ${filesText}`,
          rationale: `Code smell type '${smellType}' detected. Review and refactor to improve code quality.`,
        };
    }
  }

  /**
   * Generate rationale for long method code smells.
   */
  private getLongMethodRationale(smells: CodeSmell[]): string {
    const recommendations: string[] = [
      'Break long methods into smaller, focused functions',
      'Extract common logic into utility methods',
      'Use the Single Responsibility Principle',
      'Consider using method objects for complex algorithms',
    ];

    const details = smells.map(s => `• ${s.details}`).join('\n');

    return `Long methods reduce readability and maintainability:\n\n${details}\n\nRecommended actions:\n${recommendations.map(r => `• ${r}`).join('\n')}`;
  }

  /**
   * Generate rationale for large class code smells.
   */
  private getLargeClassRationale(smells: CodeSmell[]): string {
    const recommendations: string[] = [
      'Apply Single Responsibility Principle to split classes',
      'Extract related functionality into separate modules',
      'Use composition over inheritance where appropriate',
      'Consider using facade pattern to simplify interfaces',
    ];

    const details = smells.map(s => `• ${s.details}`).join('\n');

    return `Large classes violate Single Responsibility Principle and are hard to maintain:\n\n${details}\n\nRecommended actions:\n${recommendations.map(r => `• ${r}`).join('\n')}`;
  }

  /**
   * Generate rationale for deep nesting code smells.
   */
  private getDeepNestingRationale(smells: CodeSmell[]): string {
    const recommendations: string[] = [
      'Use early returns to reduce nesting levels',
      'Extract nested logic into separate methods',
      'Replace complex conditionals with polymorphism',
      'Apply guard clauses for input validation',
    ];

    const details = smells.map(s => `• ${s.details}`).join('\n');

    return `Deep nesting makes code difficult to understand and test:\n\n${details}\n\nRecommended actions:\n${recommendations.map(r => `• ${r}`).join('\n')}`;
  }

  /**
   * Generate rationale for duplicate code smells.
   */
  private getDuplicateCodeRationale(smells: CodeSmell[]): string {
    const recommendations: string[] = [
      'Extract common code into reusable functions',
      'Create utility modules for shared logic',
      'Use inheritance or composition for similar classes',
      'Apply DRY (Don\'t Repeat Yourself) principle',
    ];

    const details = smells.map(s => `• ${s.details}`).join('\n');

    return `Duplicate code increases maintenance burden and bug risk:\n\n${details}\n\nRecommended actions:\n${recommendations.map(r => `• ${r}`).join('\n')}`;
  }

  /**
   * Generate rationale for dead code smells.
   */
  private getDeadCodeRationale(smells: CodeSmell[]): string {
    const recommendations: string[] = [
      'Remove unused functions, variables, and imports',
      'Clean up commented-out code blocks',
      'Delete unreachable code paths',
      'Use static analysis tools to identify dead code',
    ];

    const details = smells.map(s => `• ${s.details}`).join('\n');

    return `Dead code clutters the codebase and can confuse developers:\n\n${details}\n\nRecommended actions:\n${recommendations.map(r => `• ${r}`).join('\n')}`;
  }

  /**
   * Generate rationale for magic numbers code smells.
   */
  private getMagicNumbersRationale(smells: CodeSmell[]): string {
    const recommendations: string[] = [
      'Replace numbers with named constants',
      'Use enums for related constant values',
      'Group constants in configuration objects',
      'Add comments explaining the meaning of numbers',
    ];

    const details = smells.map(s => `• ${s.details}`).join('\n');

    return `Magic numbers make code less readable and harder to maintain:\n\n${details}\n\nRecommended actions:\n${recommendations.map(r => `• ${r}`).join('\n')}`;
  }

  /**
   * Generate rationale for feature envy code smells.
   */
  private getFeatureEnvyRationale(smells: CodeSmell[]): string {
    const recommendations: string[] = [
      'Move methods closer to the data they use',
      'Extract methods into the appropriate classes',
      'Use delegation pattern when moving isn\'t possible',
      'Consider creating new classes for complex interactions',
    ];

    const details = smells.map(s => `• ${s.details}`).join('\n');

    return `Feature envy indicates poor method placement and weak cohesion:\n\n${details}\n\nRecommended actions:\n${recommendations.map(r => `• ${r}`).join('\n')}`;
  }

  /**
   * Generate rationale for data clumps code smells.
   */
  private getDataClumpsRationale(smells: CodeSmell[]): string {
    const recommendations: string[] = [
      'Create parameter objects for grouped data',
      'Extract data into domain-specific classes',
      'Use value objects for related parameters',
      'Consider using builder pattern for complex objects',
    ];

    const details = smells.map(s => `• ${s.details}`).join('\n');

    return `Data clumps indicate missing abstractions and poor encapsulation:\n\n${details}\n\nRecommended actions:\n${recommendations.map(r => `• ${r}`).join('\n')}`;
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
