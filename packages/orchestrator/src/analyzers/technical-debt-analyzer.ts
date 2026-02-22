/**
 * Technical Debt Analyzer
 *
 * Analyzes ProjectAnalysis data to identify and categorize technical debt,
 * generating task candidates for debt remediation.
 *
 * Detects the following debt types:
 * - TODO/FIXME comments (via lint issues proxy)
 * - Deprecated packages and outdated dependencies
 * - Code complexity hotspots
 * - Missing test coverage
 * - Security vulnerabilities
 * - Code duplication patterns
 * - Code smells and anti-patterns
 */

import { BaseAnalyzer, TaskCandidate, RemediationSuggestion } from './base-analyzer';
import type { ProjectAnalysis, SecurityVulnerability, DeprecatedPackage, OutdatedDependency } from '../idle-processor';
import type { TechnicalDebtAnalysis, ComplexityHotspot, CodeSmell, DuplicatePattern } from '@apexcli/core';

export class TechnicalDebtAnalyzer extends BaseAnalyzer {
  readonly type = 'technical-debt' as const;

  analyze(analysis: ProjectAnalysis): TaskCandidate[] {
    const candidates: TaskCandidate[] = [];

    // 1. Analyze complexity hotspots
    this.analyzeComplexityHotspots(analysis, candidates);

    // 2. Analyze code smells
    this.analyzeCodeSmells(analysis, candidates);

    // 3. Analyze code duplication
    this.analyzeCodeDuplication(analysis, candidates);

    // 4. Analyze test coverage
    this.analyzeTestCoverage(analysis, candidates);

    // 5. Analyze security vulnerabilities
    this.analyzeSecurityVulnerabilities(analysis, candidates);

    // 6. Analyze deprecated packages
    this.analyzeDeprecatedPackages(analysis, candidates);

    // 7. Analyze outdated dependencies
    this.analyzeOutdatedDependencies(analysis, candidates);

    // 8. Analyze outdated documentation
    this.analyzeOutdatedDocumentation(analysis, candidates);

    // 9. Analyze lint issues (TODO/FIXME proxy)
    this.analyzeLintIssues(analysis, candidates);

    // 10. Analyze TODO/FIXME/HACK comments from documentation analysis
    this.analyzeTodoComments(analysis, candidates);

    return candidates;
  }

  createTechnicalDebtAnalysis(analysis: ProjectAnalysis): TechnicalDebtAnalysis {
    return {
      totalScore: this.calculateTotalDebtScore(analysis),
      categories: this.buildDebtCategories(analysis),
      hotspots: this.buildDebtHotspots(analysis),
      metrics: this.buildDebtMetrics(analysis),
      trends: this.buildDebtTrends(analysis),
    };
  }

  // Private analysis methods

  private analyzeComplexityHotspots(analysis: ProjectAnalysis, candidates: TaskCandidate[]): void {
    const hotspots = analysis.codeQuality?.complexityHotspots ?? [];

    // Critical complexity hotspots (cyclomatic complexity > 50)
    const criticalHotspots = hotspots.filter(h => h.cyclomaticComplexity > 50);
    if (criticalHotspots.length > 0) {
      const remediationSuggestions: RemediationSuggestion[] = [
        {
          type: 'manual_review',
          description: 'Break down complex functions into smaller, more manageable units',
          priority: 'critical',
          expectedOutcome: 'Improved code maintainability and reduced bug risk',
        },
        {
          type: 'testing',
          description: 'Add comprehensive unit tests to ensure refactoring safety',
          priority: 'high',
          expectedOutcome: 'Safe refactoring with test coverage',
        },
      ];

      candidates.push(this.createCandidate(
        'critical-complexity',
        'Refactor Critical Complexity Hotspots',
        `Found ${criticalHotspots.length} functions with critical complexity (>50). These create high maintenance burden and bug risk.`,
        {
          priority: 'critical',
          effort: 'high',
          workflow: 'refactoring',
          rationale: 'Critical complexity hotspots significantly increase bug risk and maintenance cost',
          score: 0.9 + (criticalHotspots.length * 0.02),
          remediationSuggestions,
        }
      ));
    }

    // High complexity hotspots (cyclomatic complexity 20-50)
    const highHotspots = hotspots.filter(h => h.cyclomaticComplexity >= 20 && h.cyclomaticComplexity <= 50);
    if (highHotspots.length > 0) {
      const remediationSuggestions: RemediationSuggestion[] = [
        {
          type: 'manual_review',
          description: 'Simplify complex functions through extraction and decomposition',
          priority: 'high',
          expectedOutcome: 'Better code readability and maintainability',
        },
      ];

      candidates.push(this.createCandidate(
        'high-complexity',
        'Address High Complexity Functions',
        `Found ${highHotspots.length} functions with high complexity (20-50). Consider refactoring for better maintainability.`,
        {
          priority: 'normal',
          effort: 'medium',
          workflow: 'refactoring',
          rationale: 'High complexity functions increase maintenance burden and should be simplified',
          score: 0.7 + (highHotspots.length * 0.01),
          remediationSuggestions,
        }
      ));
    }
  }

  private analyzeCodeSmells(analysis: ProjectAnalysis, candidates: TaskCandidate[]): void {
    const codeSmells = analysis.codeQuality?.codeSmells ?? [];

    // Critical code smells
    const criticalSmells = codeSmells.filter(s => s.severity === 'critical');
    if (criticalSmells.length > 0) {
      const remediationSuggestions: RemediationSuggestion[] = [
        {
          type: 'manual_review',
          description: 'Address critical code smells through refactoring',
          priority: 'critical',
          expectedOutcome: 'Improved code quality and maintainability',
        },
      ];

      candidates.push(this.createCandidate(
        'critical-code-smells',
        'Fix Critical Code Smells',
        `Found ${criticalSmells.length} critical code smells that need immediate attention.`,
        {
          priority: 'critical',
          effort: 'high',
          workflow: 'refactoring',
          rationale: 'Critical code smells indicate serious design issues',
          score: 0.85 + (criticalSmells.length * 0.02),
          remediationSuggestions,
        }
      ));
    }
  }

  private analyzeCodeDuplication(analysis: ProjectAnalysis, candidates: TaskCandidate[]): void {
    const duplicates = analysis.codeQuality?.duplicatedCode ?? [];

    if (duplicates.length > 0) {
      // High-similarity duplicates are more concerning
      const highSimilarityDuplicates = duplicates.filter(d => d.similarity > 0.9);

      const remediationSuggestions: RemediationSuggestion[] = [
        {
          type: 'manual_review',
          description: 'Extract common code into shared utilities or functions',
          priority: 'medium',
          expectedOutcome: 'Reduced code duplication and improved maintainability',
        },
      ];

      candidates.push(this.createCandidate(
        'code-duplication',
        'Eliminate Code Duplication',
        `Found ${duplicates.length} duplicate code patterns (${highSimilarityDuplicates.length} high-similarity). Extract common functionality.`,
        {
          priority: duplicates.length > 10 ? 'high' : 'normal',
          effort: 'medium',
          workflow: 'refactoring',
          rationale: 'Code duplication increases maintenance burden and bug risk',
          score: 0.6 + (duplicates.length * 0.03),
          remediationSuggestions,
        }
      ));
    }
  }

  private analyzeTestCoverage(analysis: ProjectAnalysis, candidates: TaskCandidate[]): void {
    // Process testAnalysis for comprehensive test coverage detection
    if (analysis.testAnalysis) {
      // Process untested exports
      this.processUntestedExports(analysis.testAnalysis.untestedExports, candidates);

      // Process branch coverage issues
      this.processBranchCoverage(analysis.testAnalysis.branchCoverage, candidates);
    }

    // Legacy test coverage analysis (for backward compatibility)
    const coverage = analysis.testCoverage;
    if (coverage && coverage.percentage < 80) {
      const remediationSuggestions: RemediationSuggestion[] = [
        {
          type: 'testing',
          description: 'Add unit tests for uncovered code paths',
          priority: coverage.percentage < 60 ? 'high' : 'medium',
          expectedOutcome: 'Improved test coverage and code reliability',
        },
        {
          type: 'testing',
          description: 'Focus on testing critical business logic and edge cases',
          priority: 'medium',
          expectedOutcome: 'Better confidence in code changes',
        },
      ];

      candidates.push(this.createCandidate(
        'test-coverage',
        'Improve Test Coverage',
        `Test coverage is ${coverage.percentage}% (target: 80%+). ${coverage.uncoveredFiles.length} files lack adequate testing.`,
        {
          priority: coverage.percentage < 60 ? 'high' : 'normal',
          effort: 'high',
          workflow: 'testing',
          rationale: 'Low test coverage increases risk of regressions and bugs',
          score: 0.8 - (coverage.percentage / 100),
          remediationSuggestions,
        }
      ));
    }
  }

  private analyzeSecurityVulnerabilities(analysis: ProjectAnalysis, candidates: TaskCandidate[]): void {
    const vulnerabilities = analysis.dependencies?.securityIssues ?? [];

    if (vulnerabilities.length > 0) {
      const criticalVulns = vulnerabilities.filter(v => v.severity === 'critical');
      const highVulns = vulnerabilities.filter(v => v.severity === 'high');

      const remediationSuggestions: RemediationSuggestion[] = [
        {
          type: 'npm_update',
          description: 'Update vulnerable packages to secure versions',
          priority: 'critical',
          expectedOutcome: 'Eliminated security vulnerabilities',
          command: 'npm audit fix',
        },
        {
          type: 'security_advisory',
          description: 'Review security advisories for manual fixes if auto-fix fails',
          priority: 'critical',
          expectedOutcome: 'Manual resolution of unfixable vulnerabilities',
        },
      ];

      candidates.push(this.createCandidate(
        'security-vulnerabilities',
        'Fix Security Vulnerabilities',
        `Found ${vulnerabilities.length} security vulnerabilities (${criticalVulns.length} critical, ${highVulns.length} high). Update vulnerable packages immediately.`,
        {
          priority: criticalVulns.length > 0 ? 'critical' : 'high',
          effort: 'medium',
          workflow: 'maintenance',
          rationale: 'Security vulnerabilities pose immediate risk to application security',
          score: 0.95 + (criticalVulns.length * 0.01),
          remediationSuggestions,
        }
      ));
    }
  }

  private analyzeDeprecatedPackages(analysis: ProjectAnalysis, candidates: TaskCandidate[]): void {
    const deprecated = analysis.dependencies?.deprecatedPackages ?? [];

    if (deprecated.length > 0) {
      const remediationSuggestions: RemediationSuggestion[] = deprecated.map(pkg => {
        const suggestion: RemediationSuggestion = {
          type: 'package_replacement',
          description: `Replace ${pkg.name} with ${pkg.replacement || 'modern alternative'}`,
          priority: 'medium',
          expectedOutcome: 'Updated to actively maintained packages',
        };
        if (pkg.replacement) {
          suggestion.link = `https://www.npmjs.com/package/${pkg.replacement}`;
        }
        return suggestion;
      });

      candidates.push(this.createCandidate(
        'deprecated-dependencies',
        'Replace Deprecated Packages',
        `Found ${deprecated.length} deprecated packages that should be replaced with modern alternatives.`,
        {
          priority: deprecated.length > 5 ? 'high' : 'normal',
          effort: 'high',
          workflow: 'maintenance',
          rationale: 'Deprecated packages lack security updates and may become incompatible',
          score: 0.7 + (deprecated.length * 0.02),
          remediationSuggestions,
        }
      ));
    }
  }

  private analyzeOutdatedDependencies(analysis: ProjectAnalysis, candidates: TaskCandidate[]): void {
    const outdated = analysis.dependencies?.outdatedPackages ?? [];

    if (outdated.length > 0) {
      const majorUpdates = outdated.filter(dep => dep.updateType === 'major');
      const minorUpdates = outdated.filter(dep => dep.updateType === 'minor' || dep.updateType === 'patch');

      // Major version updates (breaking changes)
      if (majorUpdates.length > 0) {
        const remediationSuggestions: RemediationSuggestion[] = [
          {
            type: 'migration_guide',
            description: 'Review breaking changes and migration guides before updating',
            priority: 'high',
            expectedOutcome: 'Safe major version updates',
          },
          {
            type: 'testing',
            description: 'Thoroughly test after major updates to catch breaking changes',
            priority: 'high',
            expectedOutcome: 'Verified compatibility with new versions',
          },
        ];

        candidates.push(this.createCandidate(
          'major-version-updates',
          'Plan Major Dependency Updates',
          `Found ${majorUpdates.length} dependencies with major version updates available. Review breaking changes carefully.`,
          {
            priority: 'normal',
            effort: 'high',
            workflow: 'maintenance',
            rationale: 'Major updates provide new features and security fixes but require careful migration',
            score: 0.6 + (majorUpdates.length * 0.01),
            remediationSuggestions,
          }
        ));
      }

      // Minor/patch updates (non-breaking)
      if (minorUpdates.length > 0) {
        const remediationSuggestions: RemediationSuggestion[] = [
          {
            type: 'npm_update',
            description: 'Update to latest minor/patch versions',
            priority: 'low',
            expectedOutcome: 'Latest features and bug fixes',
            command: 'npm update',
          },
        ];

        candidates.push(this.createCandidate(
          'outdated-dependencies',
          'Update Minor Dependencies',
          `Found ${minorUpdates.length} dependencies with minor/patch updates available. Low risk updates for bug fixes and features.`,
          {
            priority: 'low',
            effort: 'low',
            workflow: 'maintenance',
            rationale: 'Minor updates provide bug fixes and new features with minimal breaking change risk',
            score: 0.3 + (minorUpdates.length * 0.005),
            remediationSuggestions,
          }
        ));
      }
    }
  }

  private analyzeOutdatedDocumentation(analysis: ProjectAnalysis, candidates: TaskCandidate[]): void {
    const outdatedDocs = analysis.documentation?.outdatedDocs ?? [];

    if (outdatedDocs.length > 0) {
      // Group by severity to create appropriate task candidates
      const criticalDocs = outdatedDocs.filter(doc => doc.severity === 'high');
      const mediumDocs = outdatedDocs.filter(doc => doc.severity === 'medium');
      const lowDocs = outdatedDocs.filter(doc => doc.severity === 'low');

      // Critical outdated documentation (high severity)
      if (criticalDocs.length > 0) {
        const remediationSuggestions: RemediationSuggestion[] = criticalDocs.map(doc => ({
          type: 'documentation_update',
          description: `${doc.description}${doc.suggestion ? ` - ${doc.suggestion}` : ''}`,
          priority: 'critical',
          expectedOutcome: 'Updated documentation that accurately reflects current implementation',
        }));

        candidates.push(this.createCandidate(
          'critical-outdated-docs',
          'Fix Critical Outdated Documentation',
          `Found ${criticalDocs.length} critical outdated documentation issues. These may mislead users and developers.`,
          {
            priority: 'critical',
            effort: 'medium',
            workflow: 'documentation',
            rationale: 'Critical outdated documentation can mislead users and cause integration issues',
            score: 0.85 + (criticalDocs.length * 0.02),
            remediationSuggestions,
          }
        ));
      }

      // Medium/Low outdated documentation
      const nonCriticalDocs = [...mediumDocs, ...lowDocs];
      if (nonCriticalDocs.length > 0) {
        const remediationSuggestions: RemediationSuggestion[] = [
          {
            type: 'documentation_update',
            description: 'Review and update outdated documentation sections',
            priority: 'medium',
            expectedOutcome: 'Current and accurate documentation',
          },
          {
            type: 'version_sync',
            description: 'Verify documentation matches current API versions',
            priority: 'medium',
            expectedOutcome: 'Documentation synchronized with codebase',
          },
        ];

        candidates.push(this.createCandidate(
          'outdated-documentation',
          'Update Outdated Documentation',
          `Found ${nonCriticalDocs.length} outdated documentation issues (${mediumDocs.length} medium, ${lowDocs.length} low severity). Update to reflect current implementation.`,
          {
            priority: mediumDocs.length > 5 ? 'high' : 'normal',
            effort: 'medium',
            workflow: 'documentation',
            rationale: 'Outdated documentation reduces developer productivity and user experience',
            score: 0.5 + (nonCriticalDocs.length * 0.01),
            remediationSuggestions,
          }
        ));
      }
    }
  }

  private analyzeLintIssues(analysis: ProjectAnalysis, candidates: TaskCandidate[]): void {
    const lintIssues = analysis.codeQuality?.lintIssues ?? 0;

    // Use lint issues as a proxy for TODO/FIXME comments and general code quality issues
    if (lintIssues > 20) {
      const remediationSuggestions: RemediationSuggestion[] = [
        {
          type: 'command',
          description: 'Fix automated linting issues',
          priority: 'low',
          expectedOutcome: 'Cleaner, more consistent codebase',
          command: 'npm run lint:fix',
        },
        {
          type: 'manual_review',
          description: 'Address remaining lint issues and TODO comments',
          priority: 'low',
          expectedOutcome: 'Resolved technical debt markers',
        },
      ];

      candidates.push(this.createCandidate(
        'todo-comments',
        'Address Lint Issues and TODO Comments',
        `Found ${lintIssues} lint issues. Many likely represent TODO comments and code quality concerns that should be addressed.`,
        {
          priority: 'low',
          effort: 'medium',
          workflow: 'maintenance',
          rationale: 'Lint issues and TODO comments represent accumulated technical debt',
          score: 0.4 + Math.min(0.3, lintIssues * 0.002),
          remediationSuggestions,
        }
      ));
    }
  }

  /**
   * Analyze TODO/FIXME/HACK comments from documentation analysis
   * Extracts stale-reference type comments and creates task candidates
   * with categorization by type and age-based severity.
   */
  private analyzeTodoComments(analysis: ProjectAnalysis, candidates: TaskCandidate[]): void {
    const outdatedDocs = analysis.documentation?.outdatedDocs ?? [];

    // Filter for stale-reference type (TODO/FIXME/HACK comments)
    const staleComments = outdatedDocs.filter(doc => doc.type === 'stale-reference');

    if (staleComments.length === 0) {
      return;
    }

    // Categorize by comment type (extracted from description)
    const todoComments = staleComments.filter(c => c.description.includes('TODO'));
    const fixmeComments = staleComments.filter(c => c.description.includes('FIXME'));
    const hackComments = staleComments.filter(c => c.description.includes('HACK'));

    // Determine overall severity based on highest individual severity
    const criticalCount = staleComments.filter(c => c.severity === 'high').length;
    const mediumCount = staleComments.filter(c => c.severity === 'medium').length;

    const remediationSuggestions: RemediationSuggestion[] = [];

    // Add FIXME-specific remediation (highest priority)
    if (fixmeComments.length > 0) {
      remediationSuggestions.push({
        type: 'manual_review',
        description: `Address ${fixmeComments.length} FIXME comments - these indicate known bugs or broken functionality`,
        priority: 'critical',
        expectedOutcome: 'Resolved bugs and improved code stability',
      });
    }

    // Add HACK-specific remediation
    if (hackComments.length > 0) {
      remediationSuggestions.push({
        type: 'manual_review', // Use manual_review instead of refactoring for consistency
        description: `Refactor ${hackComments.length} HACK comments - these indicate technical shortcuts that need proper implementation`,
        priority: 'high',
        expectedOutcome: 'Cleaner, more maintainable code',
      });
    }

    // Add TODO-specific remediation
    if (todoComments.length > 0) {
      remediationSuggestions.push({
        type: 'manual_review',
        description: `Review ${todoComments.length} TODO comments and create tasks for unfinished work`,
        priority: 'medium',
        expectedOutcome: 'Completed features and reduced technical debt',
      });
    }

    candidates.push(this.createCandidate(
      'stale-comments',
      'Address Stale TODO/FIXME/HACK Comments',
      `Found ${staleComments.length} stale comments (${todoComments.length} TODO, ${fixmeComments.length} FIXME, ${hackComments.length} HACK). ${criticalCount} are high severity (>90 days old).`,
      {
        priority: criticalCount > 0 ? 'high' : mediumCount > 0 ? 'normal' : 'low',
        effort: staleComments.length > 20 ? 'high' : staleComments.length > 10 ? 'medium' : 'low',
        workflow: 'maintenance',
        rationale: 'Stale TODO/FIXME/HACK comments represent accumulated technical debt and unfinished work',
        score: 0.5 + Math.min(0.4, staleComments.length * 0.02) + (criticalCount * 0.05),
        remediationSuggestions,
      }
    ));
  }

  /**
   * Process untested exports and create task candidates for testability category
   */
  private processUntestedExports(untestedExports: ProjectAnalysis['testAnalysis']['untestedExports'], candidates: TaskCandidate[]): void {
    if (!untestedExports || untestedExports.length === 0) {
      return;
    }

    // Group exports by file for hotspot analysis
    const exportsByFile = this.groupUntestedExportsByFile(untestedExports);

    // Create task candidates based on severity
    const publicApiExports = untestedExports.filter(exp => exp.isPublic && this.isApiFile(exp.file));
    const publicNonApiExports = untestedExports.filter(exp => exp.isPublic && !this.isApiFile(exp.file));
    const privateExports = untestedExports.filter(exp => !exp.isPublic);

    // Critical: Public API exports without tests
    if (publicApiExports.length > 0) {
      const remediationSuggestions: RemediationSuggestion[] = [
        {
          type: 'testing',
          description: 'Add comprehensive unit tests for public API functions and classes',
          priority: 'critical',
          expectedOutcome: 'Public APIs are thoroughly tested and reliable for consumers',
        },
        {
          type: 'testing',
          description: 'Add integration tests for API endpoints and workflows',
          priority: 'high',
          expectedOutcome: 'End-to-end API functionality is validated',
        },
      ];

      candidates.push(this.createCandidate(
        'technical-debt-untested-public-api',
        'Test Critical Public APIs',
        `Found ${publicApiExports.length} untested public API exports. Public APIs must be thoroughly tested to ensure reliability for consumers.`,
        {
          priority: 'critical',
          effort: 'high',
          workflow: 'testing',
          rationale: 'Untested public APIs pose significant risk to API consumers and application stability',
          score: 0.95,
          remediationSuggestions,
        }
      ));
    }

    // High: Public non-API exports without tests
    if (publicNonApiExports.length > 0) {
      const remediationSuggestions: RemediationSuggestion[] = [
        {
          type: 'testing',
          description: 'Add unit tests for public utility functions and classes',
          priority: 'high',
          expectedOutcome: 'Public utilities are reliable and well-tested',
        },
      ];

      candidates.push(this.createCandidate(
        'technical-debt-untested-exports',
        'Test Public Utilities',
        `Found ${publicNonApiExports.length} untested public exports. Public functions should have test coverage to ensure reliability.`,
        {
          priority: 'high',
          effort: 'medium',
          workflow: 'testing',
          rationale: 'Public exports without tests create reliability risks and maintenance burden',
          score: 0.8,
          remediationSuggestions,
        }
      ));
    }

    // Normal/Low: Private exports without tests (only if many)
    if (privateExports.length > 10) {
      const remediationSuggestions: RemediationSuggestion[] = [
        {
          type: 'testing',
          description: 'Add unit tests for complex private functions',
          priority: 'medium',
          expectedOutcome: 'Internal logic is tested and maintainable',
        },
      ];

      candidates.push(this.createCandidate(
        'technical-debt-test-coverage',
        'Improve Internal Test Coverage',
        `Found ${privateExports.length} untested internal exports. Consider adding tests for complex internal logic.`,
        {
          priority: privateExports.length > 20 ? 'normal' : 'low',
          effort: 'high',
          workflow: 'testing',
          rationale: 'Large amounts of untested internal code increases maintenance burden and bug risk',
          score: Math.min(0.6, 0.3 + (privateExports.length * 0.01)),
          remediationSuggestions,
        }
      ));
    }
  }

  /**
   * Process branch coverage and create task candidates for low coverage
   */
  private processBranchCoverage(branchCoverage: ProjectAnalysis['testAnalysis']['branchCoverage'], candidates: TaskCandidate[]): void {
    if (!branchCoverage || branchCoverage.percentage >= 80) {
      return;
    }

    const severity = this.getSeverityFromBranchCoverage(branchCoverage.percentage);
    const uncoveredCount = branchCoverage.uncoveredBranches?.length || 0;

    const remediationSuggestions: RemediationSuggestion[] = [
      {
        type: 'testing',
        description: 'Add tests for uncovered conditional branches and edge cases',
        priority: severity === 'critical' ? 'critical' : 'high',
        expectedOutcome: 'Improved branch coverage and better edge case handling',
      },
      {
        type: 'testing',
        description: 'Focus on testing error paths and exception handling',
        priority: 'medium',
        expectedOutcome: 'More robust error handling and reliability',
      },
    ];

    candidates.push(this.createCandidate(
      'technical-debt-low-branch-coverage',
      'Improve Branch Coverage',
      `Branch coverage is ${branchCoverage.percentage}% with ${uncoveredCount} uncovered branches. Target 80%+ for robust testing.`,
      {
        priority: severity === 'critical' ? 'critical' : 'high',
        effort: 'high',
        workflow: 'testing',
        rationale: 'Low branch coverage indicates many code paths are untested, increasing bug risk',
        score: Math.max(0.4, 1.0 - (branchCoverage.percentage / 100)),
        remediationSuggestions,
      }
    ));
  }

  /**
   * Group untested exports by file for hotspot analysis
   */
  private groupUntestedExportsByFile(exports: ProjectAnalysis['testAnalysis']['untestedExports']): Map<string, typeof exports> {
    const grouped = new Map<string, typeof exports>();

    for (const exp of exports) {
      if (!grouped.has(exp.file)) {
        grouped.set(exp.file, []);
      }
      grouped.get(exp.file)!.push(exp);
    }

    return grouped;
  }

  /**
   * Check if a file is an API file based on path patterns
   */
  private isApiFile(filePath: string): boolean {
    return /\/(api|controllers|routes|endpoints)\//.test(filePath) ||
           /\/api\./.test(filePath) ||
           /(controller|router|endpoint|route)\./.test(filePath);
  }

  /**
   * Get severity based on untested exports count and type
   */
  private getSeverityFromUntestedExports(publicCount: number, internalCount: number): 'low' | 'medium' | 'high' | 'critical' {
    if (publicCount > 10) return 'critical';
    if (publicCount > 5) return 'high';
    if (publicCount > 2) return 'medium';
    if (internalCount > 20) return 'high';
    if (internalCount > 10) return 'medium';
    return 'low';
  }

  /**
   * Get severity based on branch coverage percentage
   */
  private getSeverityFromBranchCoverage(percentage: number): 'low' | 'medium' | 'high' | 'critical' {
    if (percentage < 40) return 'critical';
    if (percentage < 60) return 'high';
    if (percentage < 80) return 'medium';
    return 'low';
  }

  // Private helper methods for createTechnicalDebtAnalysis

  private calculateTotalDebtScore(analysis: ProjectAnalysis): number {
    // Category weights as specified in ADR (must sum to 1.0)
    const categoryWeights = {
      'security-vulnerability': 0.25,
      'complexity': 0.15,
      'testability': 0.12,
      'code-smell': 0.12,
      'duplication': 0.10,
      'outdated-dependency': 0.08,
      'maintainability': 0.08,
      'documentation': 0.05,
      'performance': 0.03,
      'dead-code': 0.02,
    };

    // Severity multipliers as specified in ADR
    const severityMultipliers = {
      'critical': 1.0,
      'high': 0.75,
      'medium': 0.5,
      'low': 0.25,
    };

    let totalScore = 0;

    // Security vulnerabilities
    const securityIssues = analysis.dependencies?.securityIssues ?? [];
    if (securityIssues.length > 0) {
      const categoryScore = Math.min(100, securityIssues.length * 10 * Math.log2(securityIssues.length + 1));
      const avgSeverity = this.getAverageSeverityMultiplier(
        securityIssues.map(v => v.severity as 'critical' | 'high' | 'medium' | 'low'),
        severityMultipliers
      );
      totalScore += categoryWeights['security-vulnerability'] * categoryScore * avgSeverity;
    }

    // Complexity hotspots
    const complexityHotspots = analysis.codeQuality?.complexityHotspots ?? [];
    if (complexityHotspots.length > 0) {
      const categoryScore = Math.min(100, complexityHotspots.length * 8 * Math.log2(complexityHotspots.length + 1));
      const avgSeverity = this.getAverageSeverityMultiplier(
        complexityHotspots.map(h => this.getSeverityFromComplexity(h.cyclomaticComplexity)),
        severityMultipliers
      );
      totalScore += categoryWeights['complexity'] * categoryScore * avgSeverity;
    }

    // Testability (based on test coverage)
    const testCoverage = analysis.testCoverage?.percentage ?? 100;
    if (testCoverage < 80) {
      const categoryScore = Math.min(100, (80 - testCoverage) * 2.5);
      const severity = this.getSeverityFromCoverage(testCoverage);
      totalScore += categoryWeights['testability'] * categoryScore * severityMultipliers[severity];
    }

    // Code smells
    const codeSmells = analysis.codeQuality?.codeSmells ?? [];
    if (codeSmells.length > 0) {
      const categoryScore = Math.min(100, codeSmells.length * 6 * Math.log2(codeSmells.length + 1));
      const avgSeverity = this.getAverageSeverityMultiplier(
        codeSmells.map(s => s.severity as 'critical' | 'high' | 'medium' | 'low'),
        severityMultipliers
      );
      totalScore += categoryWeights['code-smell'] * categoryScore * avgSeverity;
    }

    // Duplication
    const duplicates = analysis.codeQuality?.duplicatedCode ?? [];
    if (duplicates.length > 0) {
      const categoryScore = Math.min(100, duplicates.length * 7 * Math.log2(duplicates.length + 1));
      const avgSeverity = duplicates.length > 10 ? 'high' : duplicates.length > 5 ? 'medium' : 'low';
      totalScore += categoryWeights['duplication'] * categoryScore * severityMultipliers[avgSeverity];
    }

    // Outdated dependencies
    const outdatedPackages = analysis.dependencies?.outdatedPackages ?? [];
    if (outdatedPackages.length > 0) {
      const categoryScore = Math.min(100, outdatedPackages.length * 5 * Math.log2(outdatedPackages.length + 1));
      const majorUpdates = outdatedPackages.filter(p => p.updateType === 'major').length;
      const avgSeverity = majorUpdates > 5 ? 'high' : majorUpdates > 0 ? 'medium' : 'low';
      totalScore += categoryWeights['outdated-dependency'] * categoryScore * severityMultipliers[avgSeverity];
    }

    // Maintainability (based on lint issues)
    const lintIssues = analysis.codeQuality?.lintIssues ?? 0;
    if (lintIssues > 0) {
      const categoryScore = Math.min(100, lintIssues * 2 * Math.log2(lintIssues + 1));
      const avgSeverity = lintIssues > 50 ? 'high' : lintIssues > 20 ? 'medium' : 'low';
      totalScore += categoryWeights['maintainability'] * categoryScore * severityMultipliers[avgSeverity];
    }

    // Documentation (coverage + outdated docs)
    const documentation = analysis.documentation;
    let documentationCategoryScore = 0;
    let documentationSeverity: 'low' | 'medium' | 'high' | 'critical' = 'low';

    // Score from coverage percentage
    if (documentation && documentation.coverage < 80) {
      const coverageScore = Math.min(100, (80 - documentation.coverage) * 2);
      documentationCategoryScore += coverageScore * 0.6; // Weight coverage at 60%

      if (documentation.coverage < 50) {
        documentationSeverity = 'high';
      } else if (documentation.coverage < 70) {
        documentationSeverity = 'medium';
      }
    }

    // Score from outdated documentation
    const outdatedDocs = documentation?.outdatedDocs ?? [];
    if (outdatedDocs.length > 0) {
      const outdatedScore = Math.min(100, outdatedDocs.length * 8 * Math.log2(outdatedDocs.length + 1));
      documentationCategoryScore += outdatedScore * 0.4; // Weight outdated docs at 40%

      const criticalOutdatedCount = outdatedDocs.filter(doc => doc.severity === 'high').length;
      const mediumOutdatedCount = outdatedDocs.filter(doc => doc.severity === 'medium').length;

      if (criticalOutdatedCount > 0) {
        documentationSeverity = 'critical';
      } else if (mediumOutdatedCount > 2 && documentationSeverity !== 'critical') {
        documentationSeverity = 'high';
      } else if (mediumOutdatedCount > 0 && documentationSeverity === 'low') {
        documentationSeverity = 'medium';
      }
    }

    if (documentationCategoryScore > 0) {
      totalScore += categoryWeights['documentation'] * documentationCategoryScore * severityMultipliers[documentationSeverity];
    }

    // Performance bottlenecks
    const bottlenecks = analysis.performance?.bottlenecks ?? [];
    if (bottlenecks.length > 0) {
      const categoryScore = Math.min(100, bottlenecks.length * 15 * Math.log2(bottlenecks.length + 1));
      const avgSeverity = bottlenecks.length > 5 ? 'high' : bottlenecks.length > 2 ? 'medium' : 'low';
      totalScore += categoryWeights['performance'] * categoryScore * severityMultipliers[avgSeverity];
    }

    // Dead code (inferred from code smells)
    const deadCodeSmells = codeSmells.filter(s => s.type === 'dead-code').length;
    if (deadCodeSmells > 0) {
      const categoryScore = Math.min(100, deadCodeSmells * 10 * Math.log2(deadCodeSmells + 1));
      const avgSeverity = deadCodeSmells > 10 ? 'medium' : 'low';
      totalScore += categoryWeights['dead-code'] * categoryScore * severityMultipliers[avgSeverity];
    }

    return Math.min(100, totalScore);
  }

  private getSeverityFromComplexity(cyclomatic: number): 'low' | 'medium' | 'high' | 'critical' {
    if (cyclomatic > 50) return 'critical';
    if (cyclomatic > 30) return 'high';
    if (cyclomatic > 15) return 'medium';
    return 'low';
  }

  private getSeverityFromCoverage(percentage: number): 'low' | 'medium' | 'high' | 'critical' {
    if (percentage < 20) return 'critical';
    if (percentage < 40) return 'high';
    if (percentage < 60) return 'medium';
    return 'low';
  }

  private getAverageSeverityMultiplier(
    severities: ('critical' | 'high' | 'medium' | 'low')[],
    multipliers: Record<string, number>
  ): number {
    if (severities.length === 0) return 0.5; // default to medium
    const total = severities.reduce((sum, severity) => sum + multipliers[severity], 0);
    return total / severities.length;
  }

  private buildDebtCategories(analysis: ProjectAnalysis): TechnicalDebtAnalysis['categories'] {
    const categories: TechnicalDebtAnalysis['categories'] = [];

    // Code smells category
    const codeSmells = analysis.codeQuality?.codeSmells ?? [];
    if (codeSmells.length > 0) {
      const criticalCount = codeSmells.filter(s => s.severity === 'critical').length;
      categories.push({
        category: 'code-smell',
        count: codeSmells.length,
        severity: criticalCount > 0 ? 'critical' : codeSmells.some(s => s.severity === 'high') ? 'high' : 'medium',
        examples: codeSmells.slice(0, 3).map(s => `${s.type} in ${s.file}`),
        estimatedEffort: codeSmells.length > 20 ? '2-3 days' : codeSmells.length > 10 ? '1 day' : '4-6 hours',
      });
    }

    // Code duplication category
    const duplicates = analysis.codeQuality?.duplicatedCode ?? [];
    if (duplicates.length > 0) {
      categories.push({
        category: 'duplication',
        count: duplicates.length,
        severity: duplicates.length > 10 ? 'high' : duplicates.length > 5 ? 'medium' : 'low',
        examples: duplicates.slice(0, 2).map(d => `${d.pattern} (${d.locations.length} locations)`),
        estimatedEffort: duplicates.length > 15 ? '1-2 days' : duplicates.length > 8 ? '1 day' : '4-6 hours',
      });
    }

    // Complexity category
    const complexityHotspots = analysis.codeQuality?.complexityHotspots ?? [];
    if (complexityHotspots.length > 0) {
      const criticalComplexity = complexityHotspots.filter(h => h.cyclomaticComplexity > 50).length;
      categories.push({
        category: 'complexity',
        count: complexityHotspots.length,
        severity: criticalComplexity > 0 ? 'critical' : complexityHotspots.some(h => h.cyclomaticComplexity > 30) ? 'high' : 'medium',
        examples: complexityHotspots.slice(0, 3).map(h => `${h.file} (complexity: ${h.cyclomaticComplexity})`),
        estimatedEffort: criticalComplexity > 0 ? '3-5 days' : '1-2 days',
      });
    }

    // Security vulnerabilities
    const securityIssues = analysis.dependencies?.securityIssues ?? [];
    if (securityIssues.length > 0) {
      const criticalSecurity = securityIssues.filter(v => v.severity === 'critical').length;
      categories.push({
        category: 'security-vulnerability',
        count: securityIssues.length,
        severity: criticalSecurity > 0 ? 'critical' : securityIssues.some(v => v.severity === 'high') ? 'high' : 'medium',
        examples: securityIssues.slice(0, 3).map(v => `${v.name}: ${v.description}`),
        estimatedEffort: criticalSecurity > 0 ? '1 day' : '4-6 hours',
      });
    }

    // Outdated dependencies
    const outdated = analysis.dependencies?.outdatedPackages ?? [];
    if (outdated.length > 0) {
      const majorUpdates = outdated.filter(d => d.updateType === 'major').length;
      categories.push({
        category: 'outdated-dependency',
        count: outdated.length,
        severity: majorUpdates > 5 ? 'high' : majorUpdates > 0 ? 'medium' : 'low',
        examples: outdated.slice(0, 3).map(d => `${d.name}: ${d.currentVersion} → ${d.latestVersion}`),
        estimatedEffort: majorUpdates > 5 ? '2-3 days' : majorUpdates > 0 ? '1 day' : '2-4 hours',
      });
    }

    // Documentation category (outdated docs)
    const outdatedDocs = analysis.documentation?.outdatedDocs ?? [];
    if (outdatedDocs.length > 0) {
      const criticalDocs = outdatedDocs.filter(doc => doc.severity === 'high');
      const mediumDocs = outdatedDocs.filter(doc => doc.severity === 'medium');

      categories.push({
        category: 'documentation',
        count: outdatedDocs.length,
        severity: criticalDocs.length > 0 ? 'critical' : mediumDocs.length > 0 ? 'medium' : 'low',
        examples: outdatedDocs.slice(0, 3).map(doc => `${doc.type} in ${doc.file}${doc.line ? `:${doc.line}` : ''}`),
        estimatedEffort: criticalDocs.length > 0 ? '1-2 days' : mediumDocs.length > 5 ? '1 day' : '4-6 hours',
      });
    }

    // Test coverage (testability) - enhanced with testAnalysis
    const testabilityCategory = this.createTestabilityCategory(analysis);
    if (testabilityCategory) {
      categories.push(testabilityCategory);
    }

    return categories;
  }

  /**
   * Create testability category from testAnalysis and legacy testCoverage data
   */
  private createTestabilityCategory(analysis: ProjectAnalysis): TechnicalDebtAnalysis['categories'][number] | null {
    let totalIssuesCount = 0;
    let severity: 'low' | 'medium' | 'high' | 'critical' = 'low';
    const examples: string[] = [];
    let estimatedEffort = '2-4 hours';

    // Process testAnalysis data (primary source)
    if (analysis.testAnalysis) {
      const { untestedExports, branchCoverage } = analysis.testAnalysis;

      // Untested exports contribute to testability issues
      if (untestedExports && untestedExports.length > 0) {
        const publicApiExports = untestedExports.filter(exp => exp.isPublic && this.isApiFile(exp.file));
        const publicExports = untestedExports.filter(exp => exp.isPublic);

        totalIssuesCount += untestedExports.length;

        if (publicApiExports.length > 0) {
          severity = 'critical';
          examples.push(`${publicApiExports.length} untested public API exports`);
          estimatedEffort = '1-2 weeks';
        } else if (publicExports.length > 5) {
          severity = 'high';
          examples.push(`${publicExports.length} untested public exports`);
          estimatedEffort = '3-5 days';
        } else if (untestedExports.length > 10) {
          severity = Math.max(severity === 'low' ? 'medium' : severity, 'medium') as 'low' | 'medium' | 'high' | 'critical';
          examples.push(`${untestedExports.length} untested exports`);
          estimatedEffort = '1-2 days';
        }
      }

      // Branch coverage contributes to testability issues
      if (branchCoverage && branchCoverage.percentage < 80) {
        const branchSeverity = this.getSeverityFromBranchCoverage(branchCoverage.percentage);
        const uncoveredCount = branchCoverage.uncoveredBranches?.length || 0;

        totalIssuesCount += uncoveredCount;

        if (branchSeverity === 'critical') {
          severity = 'critical';
          examples.push(`${branchCoverage.percentage}% branch coverage (critical)`);
          estimatedEffort = '1-2 weeks';
        } else if (branchSeverity === 'high' && severity !== 'critical') {
          severity = 'high';
          examples.push(`${branchCoverage.percentage}% branch coverage`);
          estimatedEffort = '1 week';
        } else if (uncoveredCount > 0) {
          examples.push(`${uncoveredCount} uncovered branches`);
        }
      }
    }

    // Fallback to legacy testCoverage data
    const coverage = analysis.testCoverage;
    if (coverage && coverage.percentage < 80) {
      totalIssuesCount += coverage.uncoveredFiles.length;

      if (coverage.percentage < 60 && severity === 'low') {
        severity = 'high';
        examples.push(`${coverage.percentage}% test coverage`);
        estimatedEffort = '1-2 weeks';
      } else if (coverage.percentage < 70 && severity === 'low') {
        severity = 'medium';
        examples.push(`${coverage.percentage}% test coverage`);
        estimatedEffort = '3-5 days';
      } else if (coverage.uncoveredFiles.length > 0) {
        examples.push(`${coverage.uncoveredFiles.length} uncovered files`);
      }
    }

    // Return category only if there are testability issues
    if (totalIssuesCount === 0) {
      return null;
    }

    return {
      category: 'testability',
      count: totalIssuesCount,
      severity,
      examples: examples.slice(0, 3), // Limit to 3 examples
      estimatedEffort,
    };
  }

  private buildDebtHotspots(analysis: ProjectAnalysis): TechnicalDebtAnalysis['hotspots'] {
    const hotspots: TechnicalDebtAnalysis['hotspots'] = [];

    // Add complexity hotspots
    const complexityHotspots = analysis.codeQuality?.complexityHotspots ?? [];
    complexityHotspots.forEach(hotspot => {
      const score = Math.min(100, (hotspot.cyclomaticComplexity / 100) * 100);
      hotspots.push({
        path: hotspot.file,
        score,
        issues: [
          `High cyclomatic complexity (${hotspot.cyclomaticComplexity})`,
          `High cognitive complexity (${hotspot.cognitiveComplexity})`,
          `Long function (${hotspot.lineCount} lines)`,
        ],
        loc: hotspot.lineCount,
      });
    });

    // Add files with multiple code smells
    const codeSmells = analysis.codeQuality?.codeSmells ?? [];
    const smellsByFile = codeSmells.reduce((acc, smell) => {
      if (!acc[smell.file]) acc[smell.file] = [];
      acc[smell.file].push(smell);
      return acc;
    }, {} as Record<string, CodeSmell[]>);

    Object.entries(smellsByFile).forEach(([file, smells]) => {
      if (smells.length > 1) {
        const score = Math.min(100, smells.length * 15 + (smells.filter(s => s.severity === 'critical').length * 20));
        hotspots.push({
          path: file,
          score,
          issues: smells.map(s => `${s.type}: ${s.details}`),
        });
      }
    });

    // Add files with high duplication
    const duplicates = analysis.codeQuality?.duplicatedCode ?? [];
    duplicates.forEach(duplicate => {
      duplicate.locations.forEach(location => {
        const existingHotspot = hotspots.find(h => h.path === location);
        if (existingHotspot) {
          existingHotspot.issues.push(`Code duplication: ${duplicate.pattern}`);
          existingHotspot.score = Math.min(100, existingHotspot.score + 10);
        } else {
          hotspots.push({
            path: location,
            score: Math.min(100, duplicate.similarity * 50),
            issues: [`Code duplication: ${duplicate.pattern}`],
          });
        }
      });
    });

    // Add test coverage hotspots from testAnalysis
    const testCoverageHotspots = this.createTestCoverageHotspots(analysis);
    hotspots.push(...testCoverageHotspots);

    // Add documentation hotspots
    const outdatedDocs = analysis.documentation?.outdatedDocs ?? [];
    const documentationHotspots = this.createDocumentationHotspots(outdatedDocs);
    hotspots.push(...documentationHotspots);

    // Sort by score and return top 10
    return hotspots
      .sort((a, b) => b.score - a.score)
      .slice(0, 10);
  }

  /**
   * Create test coverage hotspots from testAnalysis data
   */
  private createTestCoverageHotspots(analysis: ProjectAnalysis): TechnicalDebtAnalysis['hotspots'] {
    const hotspots: TechnicalDebtAnalysis['hotspots'] = [];

    if (!analysis.testAnalysis) {
      return hotspots;
    }

    const { untestedExports, branchCoverage } = analysis.testAnalysis;

    // Create hotspots from untested exports grouped by file
    if (untestedExports && untestedExports.length > 0) {
      const exportsByFile = this.groupUntestedExportsByFile(untestedExports);

      exportsByFile.forEach((exports, filePath) => {
        const publicCount = exports.filter(exp => exp.isPublic).length;
        const isApiFile = this.isApiFile(filePath);

        // Calculate hotspot score based on ADR formula
        const untestedExportsCount = exports.length;
        const publicApiPenalty = isApiFile && publicCount > 0 ? 20 : 0;
        const criticalPathPenalty = isApiFile ? 30 : 0;

        let score = untestedExportsCount * 5 + publicApiPenalty + criticalPathPenalty;

        // Add to uncovered branches if available
        const fileUncoveredBranches = branchCoverage?.uncoveredBranches?.filter(branch => branch.file === filePath) ?? [];
        score += fileUncoveredBranches.length * 2;

        score = Math.min(100, score);

        const issues: string[] = [];
        if (publicCount > 0) {
          issues.push(`${publicCount} untested public exports`);
        }
        if (exports.length - publicCount > 0) {
          issues.push(`${exports.length - publicCount} untested private exports`);
        }
        if (fileUncoveredBranches.length > 0) {
          issues.push(`${fileUncoveredBranches.length} uncovered branches`);
        }
        if (isApiFile) {
          issues.push('Critical API file without adequate test coverage');
        }

        if (score >= 20) { // Only include significant hotspots
          hotspots.push({
            path: filePath,
            score,
            issues,
          });
        }
      });
    }

    // Create hotspots from files with many uncovered branches (even if no untested exports)
    if (branchCoverage?.uncoveredBranches) {
      const branchesByFile = branchCoverage.uncoveredBranches.reduce((acc, branch) => {
        if (!acc[branch.file]) acc[branch.file] = [];
        acc[branch.file].push(branch);
        return acc;
      }, {} as Record<string, typeof branchCoverage.uncoveredBranches>);

      Object.entries(branchesByFile).forEach(([filePath, branches]) => {
        // Skip if we already created a hotspot for this file from untested exports
        if (hotspots.some(h => h.path === filePath)) {
          return;
        }

        if (branches.length >= 5) { // Files with many uncovered branches
          const score = Math.min(100, branches.length * 3);
          const branchTypes = Array.from(new Set(branches.map(b => b.type)));

          hotspots.push({
            path: filePath,
            score,
            issues: [
              `${branches.length} uncovered branches`,
              `Uncovered ${branchTypes.join(', ')} conditions`,
            ],
          });
        }
      });
    }

    return hotspots;
  }

  /**
   * Create documentation hotspots from outdated documentation analysis
   */
  private createDocumentationHotspots(outdatedDocs: ProjectAnalysis['documentation']['outdatedDocs']): TechnicalDebtAnalysis['hotspots'] {
    const hotspots: TechnicalDebtAnalysis['hotspots'] = [];

    if (!outdatedDocs || outdatedDocs.length === 0) {
      return hotspots;
    }

    // Group outdated docs by file to create hotspots
    const docsByFile = outdatedDocs.reduce((acc, doc) => {
      if (!acc[doc.file]) acc[doc.file] = [];
      acc[doc.file].push(doc);
      return acc;
    }, {} as Record<string, typeof outdatedDocs>);

    Object.entries(docsByFile).forEach(([filePath, docs]) => {
      const criticalDocs = docs.filter(doc => doc.severity === 'high');
      const mediumDocs = docs.filter(doc => doc.severity === 'medium');
      const lowDocs = docs.filter(doc => doc.severity === 'low');

      // Calculate hotspot score based on severity and count
      let score = docs.length * 5; // Base score per issue
      score += criticalDocs.length * 15; // High penalty for critical issues
      score += mediumDocs.length * 8; // Medium penalty for medium issues
      score += lowDocs.length * 3; // Low penalty for low issues

      score = Math.min(100, score);

      const issues: string[] = [];
      if (criticalDocs.length > 0) {
        issues.push(`${criticalDocs.length} critical outdated documentation issues`);
      }
      if (mediumDocs.length > 0) {
        issues.push(`${mediumDocs.length} medium outdated documentation issues`);
      }
      if (lowDocs.length > 0) {
        issues.push(`${lowDocs.length} low outdated documentation issues`);
      }

      // Add specific issue types
      const issueTypes = Array.from(new Set(docs.map(doc => doc.type)));
      if (issueTypes.length > 0) {
        issues.push(`Issues: ${issueTypes.join(', ')}`);
      }

      // Only include significant hotspots
      if (score >= 15) {
        hotspots.push({
          path: filePath,
          score,
          issues,
        });
      }
    });

    return hotspots;
  }

  private buildDebtMetrics(analysis: ProjectAnalysis): TechnicalDebtAnalysis['metrics'] {
    // codeComplexity: Aggregate average cyclomatic complexity from complexityHotspots
    const complexityHotspots = analysis.codeQuality?.complexityHotspots ?? [];
    const codeComplexity = complexityHotspots.length > 0
      ? complexityHotspots.reduce((sum, h) => sum + h.cyclomaticComplexity, 0) / complexityHotspots.length
      : 0;

    // testCoverage: Primary source from testAnalysis.branchCoverage, fallback to legacy testCoverage, default undefined
    const testCoverage =
      analysis.testAnalysis?.branchCoverage?.percentage ??
      analysis.testCoverage?.percentage ??
      undefined;

    // duplicatedLinesPercent: Calculate from duplicatedCode patterns
    // Formula: Σ (pattern.locations.length × pattern.similarity × estimatedLinesPerPattern) / totalLines × 100
    const duplicates = analysis.codeQuality?.duplicatedCode ?? [];
    const totalLines = analysis.codebaseSize?.lines ?? 1; // Avoid division by zero
    const estimatedLinesPerPattern = 50; // As per ADR

    let duplicatedLinesPercent = 0;
    if (duplicates.length > 0 && totalLines > 0) {
      const totalDuplicatedLines = duplicates.reduce((sum, pattern) => {
        return sum + (pattern.locations.length * pattern.similarity * estimatedLinesPerPattern);
      }, 0);
      duplicatedLinesPercent = Math.min(100, (totalDuplicatedLines / totalLines) * 100);
    }

    // maintainabilityIndex: Composite metric based on inverse of debt indicators
    // Formula: 100 - (complexityPenalty + coveragePenalty + duplicationPenalty + smellPenalty) / 4
    const securityIssues = analysis.dependencies?.securityIssues ?? [];
    const codeSmells = analysis.codeQuality?.codeSmells ?? [];

    // Each penalty is 0-100 based on thresholds
    const complexityPenalty = Math.min(100, codeComplexity * 2); // Higher complexity = higher penalty
    const coveragePenalty = testCoverage !== undefined ? Math.max(0, 100 - testCoverage) : 0; // Lower coverage = higher penalty, default to 0 if undefined
    const duplicationPenalty = duplicatedLinesPercent; // Direct mapping
    const smellPenalty = Math.min(100, codeSmells.length * 5 + securityIssues.length * 10); // Combined code quality penalty

    const maintainabilityIndex = Math.max(0, 100 - (complexityPenalty + coveragePenalty + duplicationPenalty + smellPenalty) / 4);

    return {
      codeComplexity,
      testCoverage,
      duplicatedLinesPercent,
      maintainabilityIndex,
    };
  }

  private buildDebtTrends(analysis: ProjectAnalysis): TechnicalDebtAnalysis['trends'] {
    // Since we don't have historical data, we'll make conservative estimates
    const totalScore = this.calculateTotalDebtScore(analysis);

    // Assume improving if score is low, stable if medium, degrading if high
    const improving = totalScore < 30;
    const changeRate = totalScore > 70 ? 2.5 : totalScore > 40 ? 0.5 : -1.2;

    return {
      improving,
      changeRate,
      timeframe: 'last 30 days',
    };
  }
}