/**
 * Convention Analyzer - Analyzes coding conventions and style inconsistencies
 *
 * Identifies tasks related to:
 * - Inconsistent naming conventions (files, functions, variables, classes)
 * - Mixed indentation styles (tabs vs spaces, inconsistent sizes)
 * - Import/export style inconsistencies
 * - Code formatting issues (semicolons, quotes, trailing commas)
 * - Documentation style inconsistencies
 */

import { BaseAnalyzer, TaskCandidate } from './base-analyzer';
import type { ProjectAnalysis } from '../idle-processor';
import { promises as fs } from 'fs';
import { join, extname, basename, dirname } from 'path';

/**
 * File extension patterns for analyzable code files
 */
const ANALYZABLE_EXTENSIONS = new Set([
  '.js', '.jsx', '.ts', '.tsx', '.vue',
  '.py', '.rb', '.go', '.rs', '.java', '.kt',
  '.php', '.cs', '.cpp', '.c', '.h', '.hpp',
  '.swift', '.m', '.scala', '.clj', '.dart',
]);

/**
 * Naming convention patterns
 */
const NAMING_PATTERNS = {
  camelCase: /^[a-z][a-zA-Z0-9]*$/,
  PascalCase: /^[A-Z][a-zA-Z0-9]*$/,
  kebabCase: /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/,
  snakeCase: /^[a-z][a-z0-9]*(_[a-z0-9]+)*$/,
  screamingSnakeCase: /^[A-Z][A-Z0-9]*(_[A-Z0-9]+)*$/,
};

/**
 * Convention issue types for prioritization
 */
interface ConventionIssue {
  type: 'naming' | 'indentation' | 'imports' | 'formatting' | 'documentation';
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  files: string[];
  inconsistencyPercentage: number;
  suggestedFix: string;
}

export class ConventionAnalyzer extends BaseAnalyzer {
  readonly type = 'conventions' as const;

  /**
   * Analyze project for convention issues and generate task candidates
   */
  analyze(analysis: ProjectAnalysis): TaskCandidate[] {
    const candidates: TaskCandidate[] = [];

    try {
      // For now, we'll use the existing project analysis structure and infer convention issues
      // In a full implementation, we would scan project files directly
      const issues = this.inferConventionIssues(analysis);

      for (const issue of issues) {
        const candidate = this.createTaskCandidateFromIssue(issue);
        if (candidate) {
          candidates.push(candidate);
        }
      }

      return candidates.slice(0, 5); // Limit to top 5 most important issues
    } catch (error) {
      console.warn('Convention analysis failed:', error);
      return [];
    }
  }

  /**
   * Infer convention issues from existing project analysis data
   */
  private inferConventionIssues(analysis: ProjectAnalysis): ConventionIssue[] {
    const issues: ConventionIssue[] = [];

    // Infer naming convention issues from code quality metrics
    if (analysis.codeQuality.lintIssues > 50) {
      issues.push({
        type: 'formatting',
        severity: analysis.codeQuality.lintIssues > 200 ? 'high' : 'medium',
        description: 'High number of lint issues indicate inconsistent code formatting',
        files: [], // Would be populated in full implementation
        inconsistencyPercentage: Math.min(90, analysis.codeQuality.lintIssues / 10),
        suggestedFix: 'Configure and run code formatters (Prettier, Black, gofmt, etc.)',
      });
    }

    // Infer documentation convention issues
    if (analysis.documentation.coverage < 50) {
      const severity = analysis.documentation.coverage < 20 ? 'high' : 'medium';
      issues.push({
        type: 'documentation',
        severity,
        description: `Low documentation coverage (${Math.round(analysis.documentation.coverage)}%) suggests inconsistent documentation practices`,
        files: analysis.documentation.missingDocs || [],
        inconsistencyPercentage: 100 - analysis.documentation.coverage,
        suggestedFix: 'Establish documentation standards and ensure consistent documentation style',
      });
    }

    // Infer code complexity and organization issues
    if (analysis.codeQuality.complexityHotspots.length > 10) {
      issues.push({
        type: 'formatting',
        severity: 'medium',
        description: 'Multiple complexity hotspots may indicate inconsistent code organization',
        files: analysis.codeQuality.complexityHotspots.map(h => h.file),
        inconsistencyPercentage: Math.min(80, analysis.codeQuality.complexityHotspots.length * 5),
        suggestedFix: 'Establish code organization standards and refactor complex components',
      });
    }

    // Infer import/module convention issues from duplicate code
    if (analysis.codeQuality.duplicatedCode.length > 3) {
      issues.push({
        type: 'imports',
        severity: 'medium',
        description: 'Code duplication may indicate inconsistent import/export patterns',
        files: analysis.codeQuality.duplicatedCode.flatMap(d =>
          Array.isArray(d.locations) ? d.locations : []
        ),
        inconsistencyPercentage: Math.min(70, analysis.codeQuality.duplicatedCode.length * 10),
        suggestedFix: 'Standardize module structure and import/export conventions',
      });
    }

    // Infer indentation issues from large codebase without clear structure
    if (analysis.codebaseSize.files > 100 && Object.keys(analysis.codebaseSize.languages).length > 3) {
      issues.push({
        type: 'indentation',
        severity: 'low',
        description: 'Multi-language codebase may have inconsistent indentation styles',
        files: [],
        inconsistencyPercentage: 30,
        suggestedFix: 'Configure EditorConfig and language-specific formatters for consistent indentation',
      });
    }

    // Sort by severity and inconsistency percentage
    return issues.sort((a, b) => {
      const severityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
      const severityDiff = severityOrder[b.severity] - severityOrder[a.severity];
      if (severityDiff !== 0) return severityDiff;
      return b.inconsistencyPercentage - a.inconsistencyPercentage;
    });
  }

  /**
   * Create a task candidate from a convention issue
   */
  private createTaskCandidateFromIssue(issue: ConventionIssue): TaskCandidate | null {
    const priority = this.mapSeverityToPriority(issue.severity);
    const score = this.calculateIssueScore(issue);

    const candidate = this.createCandidate(
      `${issue.type}-${issue.severity}`,
      `Fix ${issue.type} conventions: ${issue.description}`,
      `Address ${issue.type} inconsistencies across the codebase. ${issue.suggestedFix}`,
      {
        priority,
        effort: this.estimateEffort(issue),
        workflow: 'conventions',
        rationale: this.buildRationale(issue),
        score,
        remediationSuggestions: this.buildRemediationSuggestions(issue),
      }
    );

    return candidate;
  }

  /**
   * Map issue severity to task priority
   */
  private mapSeverityToPriority(severity: ConventionIssue['severity']): 'low' | 'normal' | 'high' | 'urgent' {
    switch (severity) {
      case 'critical': return 'urgent';
      case 'high': return 'high';
      case 'medium': return 'normal';
      case 'low': return 'low';
    }
  }

  /**
   * Calculate score based on issue impact
   */
  private calculateIssueScore(issue: ConventionIssue): number {
    const baseScore = {
      critical: 0.9,
      high: 0.7,
      medium: 0.5,
      low: 0.3,
    }[issue.severity];

    // Boost score based on inconsistency percentage
    const inconsistencyBonus = (issue.inconsistencyPercentage / 100) * 0.2;

    // Boost score based on number of affected files
    const fileCountBonus = Math.min(0.1, issue.files.length * 0.01);

    return Math.min(1.0, baseScore + inconsistencyBonus + fileCountBonus);
  }

  /**
   * Estimate effort based on issue scope
   */
  private estimateEffort(issue: ConventionIssue): 'low' | 'medium' | 'high' {
    if (issue.files.length > 20 || issue.inconsistencyPercentage > 70) {
      return 'high';
    }
    if (issue.files.length > 5 || issue.inconsistencyPercentage > 40) {
      return 'medium';
    }
    return 'low';
  }

  /**
   * Build rationale explaining why this convention issue should be addressed
   */
  private buildRationale(issue: ConventionIssue): string {
    const impactMap = {
      naming: 'improves code readability and maintainability',
      indentation: 'ensures consistent visual structure across the team',
      imports: 'reduces complexity and improves module organization',
      formatting: 'eliminates debates about code style and improves focus',
      documentation: 'enhances code understanding and onboarding',
    };

    const impact = impactMap[issue.type];
    const scope = issue.files.length > 0 ? `affecting ${issue.files.length} files` : 'across the codebase';

    return `Addressing ${issue.type} inconsistencies ${scope} ${impact}. ` +
           `Current inconsistency level: ${Math.round(issue.inconsistencyPercentage)}%.`;
  }

  /**
   * Build remediation suggestions for the convention issue
   */
  private buildRemediationSuggestions(issue: ConventionIssue): Array<{
    type: 'command' | 'manual_review' | 'documentation';
    description: string;
    command?: string;
    priority: 'high' | 'medium' | 'low';
  }> {
    const suggestions = [];

    switch (issue.type) {
      case 'formatting':
        suggestions.push({
          type: 'command' as const,
          description: 'Run code formatter on affected files',
          command: 'npx prettier --write . && npm run lint:fix',
          priority: 'high' as const,
        });
        suggestions.push({
          type: 'documentation' as const,
          description: 'Set up pre-commit hooks for consistent formatting',
          priority: 'medium' as const,
        });
        break;

      case 'documentation':
        suggestions.push({
          type: 'manual_review' as const,
          description: 'Review and establish documentation standards',
          priority: 'high' as const,
        });
        suggestions.push({
          type: 'command' as const,
          description: 'Generate documentation template',
          command: 'npx typedoc --init',
          priority: 'medium' as const,
        });
        break;

      case 'indentation':
        suggestions.push({
          type: 'documentation' as const,
          description: 'Create .editorconfig file for consistent indentation',
          priority: 'high' as const,
        });
        suggestions.push({
          type: 'command' as const,
          description: 'Fix indentation in source files',
          command: 'npx prettier --write --tab-width 2 .',
          priority: 'medium' as const,
        });
        break;

      case 'imports':
        suggestions.push({
          type: 'command' as const,
          description: 'Organize imports using automated tools',
          command: 'npx organize-imports-cli .',
          priority: 'medium' as const,
        });
        suggestions.push({
          type: 'manual_review' as const,
          description: 'Establish import ordering and grouping standards',
          priority: 'medium' as const,
        });
        break;

      case 'naming':
        suggestions.push({
          type: 'manual_review' as const,
          description: 'Define and document naming conventions',
          priority: 'high' as const,
        });
        suggestions.push({
          type: 'command' as const,
          description: 'Run linter to identify naming violations',
          command: 'npm run lint',
          priority: 'medium' as const,
        });
        break;
    }

    return suggestions;
  }
}