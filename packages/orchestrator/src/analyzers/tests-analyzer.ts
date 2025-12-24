/**
 * Tests Strategy Analyzer
 *
 * Analyzes test coverage and identifies testing opportunities such as:
 * - Branch coverage gaps with specific files and branches
 * - Uncovered edge cases grouped by severity
 * - Low overall test coverage
 * - Slow or flaky tests that need attention
 * - Testing anti-patterns that need remediation
 */

import { BaseAnalyzer, TaskCandidate, RemediationSuggestion } from './index';
import type { ProjectAnalysis } from '../idle-processor';

export class TestsAnalyzer extends BaseAnalyzer {
  readonly type = 'tests' as const;

  analyze(analysis: ProjectAnalysis): TaskCandidate[] {
    const candidates: TaskCandidate[] = [];

    const testCoverage = analysis.testCoverage;
    const testAnalysis = analysis.testAnalysis;
    const performance = analysis.performance;

    // Priority 1: Low branch coverage with specific files and branches
    if (testAnalysis && testAnalysis.branchCoverage.percentage < 70) {
      candidates.push(...this.createBranchCoverageTaskCandidates(testAnalysis.branchCoverage));
    }

    // Priority 2: Uncovered edge cases grouped by severity
    if (testAnalysis && testAnalysis.untestedExports.length > 0) {
      candidates.push(...this.createUntestedExportsTaskCandidates(testAnalysis.untestedExports));
    }

    // Priority 3: Missing integration tests for critical paths
    if (testAnalysis && testAnalysis.missingIntegrationTests.length > 0) {
      candidates.push(...this.createMissingIntegrationTestsTaskCandidates(testAnalysis.missingIntegrationTests));
    }

    // Priority 4: Testing anti-patterns that need remediation
    if (testAnalysis && testAnalysis.antiPatterns.length > 0) {
      candidates.push(...this.createAntiPatternTaskCandidates(testAnalysis.antiPatterns));
    }

    // Legacy coverage analysis for backward compatibility
    this.addLegacyCoverageAnalysis(testCoverage, performance, candidates);

    return candidates;
  }

  /**
   * Create task candidates for low branch coverage with specific files and branches
   */
  private createBranchCoverageTaskCandidates(branchCoverage: ProjectAnalysis['testAnalysis']['branchCoverage']): TaskCandidate[] {
    const candidates: TaskCandidate[] = [];

    // Group uncovered branches by file for better organization
    const branchesByFile = this.groupUncoveredBranchesByFile(branchCoverage.uncoveredBranches);
    const fileNames = Object.keys(branchesByFile);

    if (fileNames.length === 0) {
      return candidates;
    }

    // Critical files with uncovered branches
    const criticalFiles = fileNames.filter(file =>
      file.includes('service') ||
      file.includes('controller') ||
      file.includes('api') ||
      file.includes('core') ||
      file.includes('handler') ||
      file.includes('middleware')
    );

    if (criticalFiles.length > 0) {
      for (const file of criticalFiles) {
        const branches = branchesByFile[file];
        candidates.push(this.createBranchCoverageTask(file, branches, 'urgent', 0.9));
      }
    }

    // Non-critical files grouped if many
    const nonCriticalFiles = fileNames.filter(file => !criticalFiles.includes(file));
    if (nonCriticalFiles.length > 0) {
      if (nonCriticalFiles.length <= 3) {
        // Individual tasks for small numbers
        for (const file of nonCriticalFiles) {
          const branches = branchesByFile[file];
          candidates.push(this.createBranchCoverageTask(file, branches, 'normal', 0.6));
        }
      } else {
        // Grouped task for many files
        const totalBranches = nonCriticalFiles.reduce((sum, file) => sum + branchesByFile[file].length, 0);
        candidates.push(this.createGroupedBranchCoverageTask(nonCriticalFiles, branchesByFile, totalBranches, 0.6));
      }
    }

    // Overall branch coverage improvement if very low
    if (branchCoverage.percentage < 40) {
      candidates.push(this.createOverallBranchCoverageTask(branchCoverage.percentage, 0.85));
    }

    return candidates;
  }

  /**
   * Create task candidates for untested exports grouped by severity
   */
  private createUntestedExportsTaskCandidates(untestedExports: ProjectAnalysis['testAnalysis']['untestedExports']): TaskCandidate[] {
    const candidates: TaskCandidate[] = [];

    // Group by severity (public API exports are high priority)
    const bySeverity = this.groupUntestedExportsBySeverity(untestedExports);

    // Critical public API exports
    if (bySeverity.critical.length > 0) {
      for (const exportItem of bySeverity.critical) {
        candidates.push(this.createUntestedExportTask(exportItem, 'urgent', 0.95));
      }
    }

    // High priority exports (public non-API)
    if (bySeverity.high.length > 0) {
      if (bySeverity.high.length <= 2) {
        // Individual tasks for small numbers
        for (const exportItem of bySeverity.high) {
          candidates.push(this.createUntestedExportTask(exportItem, 'high', 0.8));
        }
      } else {
        // Grouped task for many
        candidates.push(this.createGroupedUntestedExportsTask(bySeverity.high, 'high', 0.8));
      }
    }

    // Medium priority exports (internal but important)
    if (bySeverity.medium.length > 0) {
      candidates.push(this.createGroupedUntestedExportsTask(bySeverity.medium, 'normal', 0.6));
    }

    // Low priority exports (internal utilities)
    if (bySeverity.low.length > 0) {
      candidates.push(this.createGroupedUntestedExportsTask(bySeverity.low, 'low', 0.4));
    }

    return candidates;
  }

  /**
   * Create task candidates for missing integration tests
   */
  private createMissingIntegrationTestsTaskCandidates(missingIntegrationTests: ProjectAnalysis['testAnalysis']['missingIntegrationTests']): TaskCandidate[] {
    const candidates: TaskCandidate[] = [];

    // Group by priority
    const byPriority = this.groupMissingIntegrationTestsByPriority(missingIntegrationTests);

    // Critical integration tests
    if (byPriority.critical.length > 0) {
      for (const test of byPriority.critical) {
        candidates.push(this.createMissingIntegrationTestTask(test, 'urgent', 0.95));
      }
    }

    // High priority integration tests
    if (byPriority.high.length > 0) {
      if (byPriority.high.length <= 2) {
        for (const test of byPriority.high) {
          candidates.push(this.createMissingIntegrationTestTask(test, 'high', 0.8));
        }
      } else {
        candidates.push(this.createGroupedIntegrationTestTask(byPriority.high, 'high', 0.8));
      }
    }

    // Medium and low priority tests
    if (byPriority.medium.length > 0) {
      candidates.push(this.createGroupedIntegrationTestTask(byPriority.medium, 'normal', 0.6));
    }

    if (byPriority.low.length > 0) {
      candidates.push(this.createGroupedIntegrationTestTask(byPriority.low, 'low', 0.4));
    }

    return candidates;
  }

  /**
   * Create task candidates for testing anti-patterns
   */
  private createAntiPatternTaskCandidates(antiPatterns: ProjectAnalysis['testAnalysis']['antiPatterns']): TaskCandidate[] {
    const candidates: TaskCandidate[] = [];

    // Group by type for more targeted task generation
    const byType = this.groupAntiPatternsByType(antiPatterns);

    // Prioritize assertion-less tests highest (critical anti-pattern)
    if (byType['no-assertion'] && byType['no-assertion'].length > 0) {
      for (const pattern of byType['no-assertion']) {
        candidates.push(this.createAntiPatternTask(pattern, 'urgent', 0.95));
      }
    }

    // Handle other high-priority anti-patterns individually
    const highPriorityTypes = ['flaky-test', 'empty-test', 'brittle-test'] as const;
    for (const type of highPriorityTypes) {
      if (byType[type] && byType[type].length > 0) {
        for (const pattern of byType[type]) {
          const priority = pattern.severity === 'high' ? 'urgent' : 'high';
          const score = pattern.severity === 'high' ? 0.9 : 0.8;
          candidates.push(this.createAntiPatternTask(pattern, priority, score));
        }
      }
    }

    // Group medium-priority anti-patterns by type
    const mediumPriorityTypes = ['slow-test', 'test-code-duplication', 'assertion-roulette', 'mystery-guest'] as const;
    for (const type of mediumPriorityTypes) {
      if (byType[type] && byType[type].length > 0) {
        if (byType[type].length === 1) {
          // Individual task for single occurrence
          candidates.push(this.createAntiPatternTask(byType[type][0], 'normal', 0.6));
        } else {
          // Grouped task for multiple occurrences
          candidates.push(this.createGroupedAntiPatternTaskByType(byType[type], type, 'normal', 0.6));
        }
      }
    }

    // Group low-priority anti-patterns
    const lowPriorityTypes = ['commented-out', 'console-only', 'hardcoded-timeout', 'test-pollution', 'eager-test'] as const;
    const lowPriorityPatterns = lowPriorityTypes.flatMap(type => byType[type] || []);
    if (lowPriorityPatterns.length > 0) {
      candidates.push(this.createGroupedAntiPatternTask(lowPriorityPatterns, 'low', 0.4));
    }

    // Also maintain backwards compatibility with severity-based grouping for any remaining patterns
    const remainingPatterns = antiPatterns.filter(pattern =>
      !['no-assertion', 'flaky-test', 'empty-test', 'brittle-test', 'slow-test', 'test-code-duplication',
        'assertion-roulette', 'mystery-guest', 'commented-out', 'console-only', 'hardcoded-timeout',
        'test-pollution', 'eager-test'].includes(pattern.type)
    );

    if (remainingPatterns.length > 0) {
      const bySeverity = this.groupAntiPatternsBySeverity(remainingPatterns);

      // High severity anti-patterns get individual tasks
      if (bySeverity.high.length > 0) {
        for (const pattern of bySeverity.high) {
          candidates.push(this.createAntiPatternTask(pattern, 'high', 0.8));
        }
      }

      // Medium and low severity anti-patterns
      if (bySeverity.medium.length > 0) {
        candidates.push(this.createGroupedAntiPatternTask(bySeverity.medium, 'normal', 0.6));
      }

      if (bySeverity.low.length > 0) {
        candidates.push(this.createGroupedAntiPatternTask(bySeverity.low, 'low', 0.4));
      }
    }

    return candidates;
  }

  /**
   * Add legacy coverage analysis for backward compatibility
   */
  private addLegacyCoverageAnalysis(testCoverage: ProjectAnalysis['testCoverage'], performance: ProjectAnalysis['performance'], candidates: TaskCandidate[]): void {
    // Critically low test coverage
    if (testCoverage && testCoverage.percentage < 30) {
      candidates.push(
        this.createCandidate(
          'critical-coverage-legacy',
          'Add Critical Test Coverage',
          `Increase test coverage from ${testCoverage.percentage.toFixed(1)}% to at least 50% for core functionality`,
          {
            priority: 'high',
            effort: 'high',
            workflow: 'testing',
            rationale: 'Low test coverage increases the risk of bugs and makes refactoring dangerous',
            score: 0.9,
            remediationSuggestions: this.buildCriticalCoverageRemediation(testCoverage.percentage),
          }
        )
      );
    }

    // Slow tests optimization
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
            remediationSuggestions: this.buildSlowTestsRemediation(performance.slowTests),
          }
        )
      );
    }
  }

  /**
   * Group uncovered branches by file
   */
  private groupUncoveredBranchesByFile(uncoveredBranches: ProjectAnalysis['testAnalysis']['branchCoverage']['uncoveredBranches']): Record<string, typeof uncoveredBranches> {
    const grouped: Record<string, typeof uncoveredBranches> = {};

    for (const branch of uncoveredBranches) {
      if (!grouped[branch.file]) {
        grouped[branch.file] = [];
      }
      grouped[branch.file].push(branch);
    }

    return grouped;
  }

  /**
   * Group untested exports by severity
   */
  private groupUntestedExportsBySeverity(untestedExports: ProjectAnalysis['testAnalysis']['untestedExports']): { critical: typeof untestedExports; high: typeof untestedExports; medium: typeof untestedExports; low: typeof untestedExports } {
    const grouped = { critical: [] as typeof untestedExports, high: [] as typeof untestedExports, medium: [] as typeof untestedExports, low: [] as typeof untestedExports };

    for (const exportItem of untestedExports) {
      if (exportItem.isPublic && this.isAPIFile(exportItem.file)) {
        grouped.critical.push(exportItem);
      } else if (exportItem.isPublic) {
        grouped.high.push(exportItem);
      } else if (exportItem.exportType === 'function' || exportItem.exportType === 'class') {
        grouped.medium.push(exportItem);
      } else {
        grouped.low.push(exportItem);
      }
    }

    return grouped;
  }

  /**
   * Group missing integration tests by priority
   */
  private groupMissingIntegrationTestsByPriority(tests: ProjectAnalysis['testAnalysis']['missingIntegrationTests']): Record<'critical' | 'high' | 'medium' | 'low', typeof tests> {
    const grouped: Record<'critical' | 'high' | 'medium' | 'low', typeof tests> = {
      critical: [],
      high: [],
      medium: [],
      low: [],
    };

    for (const test of tests) {
      grouped[test.priority].push(test);
    }

    return grouped;
  }

  /**
   * Group anti-patterns by severity
   */
  private groupAntiPatternsBySeverity(antiPatterns: ProjectAnalysis['testAnalysis']['antiPatterns']): Record<'high' | 'medium' | 'low', typeof antiPatterns> {
    const grouped: Record<'high' | 'medium' | 'low', typeof antiPatterns> = {
      high: [],
      medium: [],
      low: [],
    };

    for (const pattern of antiPatterns) {
      grouped[pattern.severity].push(pattern);
    }

    return grouped;
  }

  /**
   * Group anti-patterns by type for more targeted task generation
   */
  private groupAntiPatternsByType(antiPatterns: ProjectAnalysis['testAnalysis']['antiPatterns']): Record<string, typeof antiPatterns> {
    const grouped: Record<string, typeof antiPatterns> = {};

    for (const pattern of antiPatterns) {
      if (!grouped[pattern.type]) {
        grouped[pattern.type] = [];
      }
      grouped[pattern.type].push(pattern);
    }

    return grouped;
  }

  /**
   * Create individual branch coverage task
   */
  private createBranchCoverageTask(
    file: string,
    branches: ProjectAnalysis['testAnalysis']['branchCoverage']['uncoveredBranches'],
    priority: 'urgent' | 'high' | 'normal' | 'low',
    score: number
  ): TaskCandidate {
    const shortFile = this.getShortFileName(file);
    const branchCount = branches.length;
    const branchTypes = [...new Set(branches.map(b => b.type))];

    return this.createCandidate(
      `branch-coverage-${this.makeFilenameSafe(file)}`,
      `Add Branch Coverage: ${shortFile}`,
      `Add tests for ${branchCount} uncovered ${branchCount === 1 ? 'branch' : 'branches'} in ${file} (${branchTypes.join(', ')})`,
      {
        priority,
        effort: branchCount > 5 ? 'high' : 'medium',
        workflow: 'testing',
        rationale: this.buildBranchCoverageRationale(file, branches),
        score,
        remediationSuggestions: this.buildBranchCoverageRemediation(file, branches),
      }
    );
  }

  /**
   * Create grouped branch coverage task
   */
  private createGroupedBranchCoverageTask(
    files: string[],
    branchesByFile: Record<string, ProjectAnalysis['testAnalysis']['branchCoverage']['uncoveredBranches']>,
    totalBranches: number,
    score: number
  ): TaskCandidate {
    const fileList = files.slice(0, 3).map(f => this.getShortFileName(f)).join(', ');
    const hasMore = files.length > 3;

    return this.createCandidate(
      'branch-coverage-group',
      `Add Branch Coverage for ${files.length} Files`,
      `Add tests for ${totalBranches} uncovered branches across ${files.length} files: ${fileList}${hasMore ? '...' : ''}`,
      {
        priority: 'normal',
        effort: totalBranches > 20 ? 'high' : 'medium',
        workflow: 'testing',
        rationale: `${files.length} files have uncovered branches that could lead to unexpected behavior in edge cases`,
        score,
        remediationSuggestions: this.buildGroupedBranchCoverageRemediation(files, branchesByFile),
      }
    );
  }

  /**
   * Create overall branch coverage improvement task
   */
  private createOverallBranchCoverageTask(currentPercentage: number, score: number): TaskCandidate {
    return this.createCandidate(
      'overall-branch-coverage',
      'Improve Overall Branch Coverage',
      `Increase branch coverage from ${currentPercentage.toFixed(1)}% to at least 60% for better edge case protection`,
      {
        priority: 'high',
        effort: 'high',
        workflow: 'testing',
        rationale: 'Low branch coverage means many code paths are untested, increasing risk of bugs in edge cases',
        score,
        remediationSuggestions: this.buildOverallBranchCoverageRemediation(currentPercentage),
      }
    );
  }

  /**
   * Create individual untested export task
   */
  private createUntestedExportTask(
    exportItem: ProjectAnalysis['testAnalysis']['untestedExports'][0],
    priority: 'urgent' | 'high' | 'normal' | 'low',
    score: number
  ): TaskCandidate {
    const shortFile = this.getShortFileName(exportItem.file);

    return this.createCandidate(
      `untested-export-${this.makeFilenameSafe(exportItem.file)}-${exportItem.exportName}`,
      `Test ${exportItem.isPublic ? 'Public ' : ''}${exportItem.exportType}: ${exportItem.exportName}`,
      `Add tests for ${exportItem.isPublic ? 'public ' : ''}${exportItem.exportType} ${exportItem.exportName} in ${shortFile}`,
      {
        priority,
        effort: exportItem.exportType === 'class' ? 'medium' : 'low',
        workflow: 'testing',
        rationale: this.buildUntestedExportRationale(exportItem),
        score,
        remediationSuggestions: this.buildUntestedExportRemediation(exportItem),
      }
    );
  }

  /**
   * Create grouped untested exports task
   */
  private createGroupedUntestedExportsTask(
    exports: ProjectAnalysis['testAnalysis']['untestedExports'],
    priority: 'urgent' | 'high' | 'normal' | 'low',
    score: number
  ): TaskCandidate {
    const count = exports.length;
    const publicCount = exports.filter(e => e.isPublic).length;
    const types = [...new Set(exports.map(e => e.exportType))];

    return this.createCandidate(
      `untested-exports-group-${priority}`,
      `Test ${count} Untested ${publicCount > 0 ? 'Public ' : ''}Exports`,
      `Add tests for ${count} untested exports${publicCount > 0 ? ` (${publicCount} public)` : ''} of types: ${types.join(', ')}`,
      {
        priority,
        effort: count > 10 ? 'high' : count > 5 ? 'medium' : 'low',
        workflow: 'testing',
        rationale: this.buildGroupedUntestedExportsRationale(exports),
        score,
        remediationSuggestions: this.buildGroupedUntestedExportsRemediation(exports),
      }
    );
  }

  /**
   * Create individual missing integration test task
   */
  private createMissingIntegrationTestTask(
    test: ProjectAnalysis['testAnalysis']['missingIntegrationTests'][0],
    priority: 'urgent' | 'high' | 'normal' | 'low',
    score: number
  ): TaskCandidate {
    return this.createCandidate(
      `integration-test-${this.makeFilenameSafe(test.criticalPath)}`,
      `Add Integration Test: ${test.criticalPath}`,
      test.description,
      {
        priority,
        effort: 'medium',
        workflow: 'testing',
        rationale: `Integration tests for critical paths ensure end-to-end functionality works correctly`,
        score,
        remediationSuggestions: this.buildIntegrationTestRemediation(test),
      }
    );
  }

  /**
   * Create grouped integration tests task
   */
  private createGroupedIntegrationTestTask(
    tests: ProjectAnalysis['testAnalysis']['missingIntegrationTests'],
    priority: 'urgent' | 'high' | 'normal' | 'low',
    score: number
  ): TaskCandidate {
    const count = tests.length;
    const paths = tests.slice(0, 3).map(t => t.criticalPath).join(', ');
    const hasMore = tests.length > 3;

    return this.createCandidate(
      `integration-tests-group-${priority}`,
      `Add ${count} Integration Tests`,
      `Add integration tests for ${count} critical paths: ${paths}${hasMore ? '...' : ''}`,
      {
        priority,
        effort: count > 5 ? 'high' : 'medium',
        workflow: 'testing',
        rationale: `${count} critical paths lack integration tests, increasing risk of system-level failures`,
        score,
        remediationSuggestions: this.buildGroupedIntegrationTestsRemediation(tests),
      }
    );
  }

  /**
   * Create individual anti-pattern task
   */
  private createAntiPatternTask(
    pattern: ProjectAnalysis['testAnalysis']['antiPatterns'][0],
    priority: 'urgent' | 'high' | 'normal' | 'low',
    score: number
  ): TaskCandidate {
    const shortFile = this.getShortFileName(pattern.file);

    return this.createCandidate(
      `anti-pattern-${pattern.type}-${this.makeFilenameSafe(pattern.file)}-${pattern.line}`,
      `Fix ${this.formatAntiPatternType(pattern.type)}: ${shortFile}:${pattern.line}`,
      `Fix ${pattern.type} anti-pattern in ${pattern.file}:${pattern.line}: ${pattern.description}`,
      {
        priority,
        effort: this.getAntiPatternEffort(pattern.type),
        workflow: 'testing',
        rationale: this.buildAntiPatternRationale(pattern),
        score,
        remediationSuggestions: this.buildAntiPatternRemediation(pattern),
      }
    );
  }

  /**
   * Create grouped anti-patterns task
   */
  private createGroupedAntiPatternTask(
    patterns: ProjectAnalysis['testAnalysis']['antiPatterns'],
    priority: 'urgent' | 'high' | 'normal' | 'low',
    score: number
  ): TaskCandidate {
    const count = patterns.length;
    const types = [...new Set(patterns.map(p => p.type))];

    return this.createCandidate(
      `anti-patterns-group-${priority}`,
      `Fix ${count} Testing Anti-Patterns`,
      `Fix ${count} testing anti-patterns of types: ${types.map(t => this.formatAntiPatternType(t)).join(', ')}`,
      {
        priority,
        effort: count > 10 ? 'high' : count > 5 ? 'medium' : 'low',
        workflow: 'testing',
        rationale: `${count} testing anti-patterns are making tests harder to maintain and less reliable`,
        score,
        remediationSuggestions: this.buildGroupedAntiPatternsRemediation(patterns),
      }
    );
  }

  /**
   * Create grouped anti-patterns task by specific type
   */
  private createGroupedAntiPatternTaskByType(
    patterns: ProjectAnalysis['testAnalysis']['antiPatterns'],
    type: string,
    priority: 'urgent' | 'high' | 'normal' | 'low',
    score: number
  ): TaskCandidate {
    const count = patterns.length;
    const filesList = patterns.slice(0, 3).map(p => this.getShortFileName(p.file)).join(', ');
    const hasMore = patterns.length > 3;

    return this.createCandidate(
      `anti-patterns-${this.makeFilenameSafe(type)}-group`,
      `Fix ${count} ${this.formatAntiPatternType(type)} Anti-Patterns`,
      `Fix ${count} ${this.formatAntiPatternType(type)} anti-patterns in: ${filesList}${hasMore ? '...' : ''}`,
      {
        priority,
        effort: count > 10 ? 'high' : count > 5 ? 'medium' : 'low',
        workflow: 'testing',
        rationale: `${count} ${this.formatAntiPatternType(type)} anti-patterns are affecting test quality and reliability`,
        score,
        remediationSuggestions: this.buildTypeSpecificAntiPatternRemediation(patterns, type),
      }
    );
  }

  /**
   * Build remediation suggestions for branch coverage
   */
  private buildBranchCoverageRemediation(file: string, branches: ProjectAnalysis['testAnalysis']['branchCoverage']['uncoveredBranches']): RemediationSuggestion[] {
    const suggestions: RemediationSuggestion[] = [];

    // Primary suggestion - add specific tests
    suggestions.push({
      type: 'testing',
      description: `Create tests for uncovered branches in ${this.getShortFileName(file)}`,
      priority: 'high',
      expectedOutcome: `All ${branches.length} uncovered branches will have test coverage`,
    });

    // Specific guidance for each branch type
    const branchTypes = [...new Set(branches.map(b => b.type))];
    for (const type of branchTypes) {
      const typeBranches = branches.filter(b => b.type === type);
      suggestions.push({
        type: 'manual_review',
        description: `Add ${type} branch tests for ${typeBranches.length} uncovered ${type} ${typeBranches.length === 1 ? 'branch' : 'branches'}`,
        priority: 'medium',
        expectedOutcome: `${type.charAt(0).toUpperCase() + type.slice(1)} branches at lines ${typeBranches.map(b => b.line).join(', ')} will be tested`,
      });
    }

    // Code coverage command
    suggestions.push({
      type: 'command',
      description: 'Run test coverage to verify branch coverage improvement',
      command: 'npm run test -- --coverage',
      priority: 'medium',
      expectedOutcome: 'Updated coverage report showing improved branch coverage',
    });

    return suggestions;
  }

  /**
   * Build remediation suggestions for grouped branch coverage
   */
  private buildGroupedBranchCoverageRemediation(
    files: string[],
    branchesByFile: Record<string, ProjectAnalysis['testAnalysis']['branchCoverage']['uncoveredBranches']>
  ): RemediationSuggestion[] {
    const suggestions: RemediationSuggestion[] = [];
    const totalBranches = files.reduce((sum, file) => sum + branchesByFile[file].length, 0);

    suggestions.push({
      type: 'testing',
      description: `Create branch coverage tests for ${files.length} files`,
      priority: 'high',
      expectedOutcome: `All ${totalBranches} uncovered branches across ${files.length} files will have test coverage`,
    });

    suggestions.push({
      type: 'command',
      description: 'Generate detailed branch coverage report',
      command: 'npm run test -- --coverage --coverage-reporter=html',
      priority: 'medium',
      expectedOutcome: 'Detailed HTML coverage report highlighting uncovered branches for each file',
    });

    return suggestions;
  }

  /**
   * Build remediation suggestions for overall branch coverage
   */
  private buildOverallBranchCoverageRemediation(currentPercentage: number): RemediationSuggestion[] {
    return [
      {
        type: 'testing',
        description: 'Systematically add branch coverage tests',
        priority: 'high',
        expectedOutcome: `Branch coverage improved from ${currentPercentage.toFixed(1)}% to at least 60%`,
      },
      {
        type: 'command',
        description: 'Identify files with lowest branch coverage',
        command: 'npm run test -- --coverage --coverage-reporter=text-summary',
        priority: 'high',
        expectedOutcome: 'List of files ordered by branch coverage percentage',
      },
      {
        type: 'manual_review',
        description: 'Focus on testing conditional logic and error handling paths',
        priority: 'medium',
        expectedOutcome: 'Comprehensive test coverage for edge cases and error scenarios',
      },
    ];
  }

  /**
   * Build remediation suggestions for untested exports
   */
  private buildUntestedExportRemediation(exportItem: ProjectAnalysis['testAnalysis']['untestedExports'][0]): RemediationSuggestion[] {
    const suggestions: RemediationSuggestion[] = [];
    const shortFile = this.getShortFileName(exportItem.file);
    const testFile = this.generateTestFilePath(exportItem.file);

    // Primary suggestion with specific test file location and basic template
    suggestions.push({
      type: 'testing',
      description: `Create ${exportItem.exportType} tests in ${testFile} for ${exportItem.exportName}`,
      priority: exportItem.isPublic ? 'high' : 'medium',
      expectedOutcome: `${exportItem.exportType} ${exportItem.exportName} will have comprehensive test coverage in ${testFile}`,
      command: this.generateTestTemplate(exportItem, testFile),
    });

    if (exportItem.exportType === 'class') {
      suggestions.push({
        type: 'manual_review',
        description: `Test all public methods and properties of class ${exportItem.exportName}`,
        priority: 'medium',
        expectedOutcome: 'All class methods and properties have unit test coverage',
      });

      // Class-specific test template suggestion
      suggestions.push({
        type: 'testing',
        description: `Use class testing template for comprehensive coverage`,
        priority: 'medium',
        expectedOutcome: 'Structured tests covering constructor, methods, and edge cases',
        command: this.generateClassTestTemplate(exportItem.exportName, testFile),
      });
    }

    if (exportItem.exportType === 'function') {
      suggestions.push({
        type: 'testing',
        description: `Use function testing template with input/output scenarios`,
        priority: 'medium',
        expectedOutcome: 'Comprehensive function tests covering various input scenarios',
        command: this.generateFunctionTestTemplate(exportItem.exportName, testFile),
      });
    }

    if (exportItem.isPublic) {
      suggestions.push({
        type: 'testing',
        description: `Add integration tests for public API ${exportItem.exportName}`,
        priority: 'high',
        expectedOutcome: 'Public API behavior is validated through integration tests',
        warning: 'Public APIs require both unit and integration tests for complete coverage',
      });
    }

    return suggestions;
  }

  /**
   * Build remediation suggestions for grouped untested exports
   */
  private buildGroupedUntestedExportsRemediation(exports: ProjectAnalysis['testAnalysis']['untestedExports']): RemediationSuggestion[] {
    const count = exports.length;
    const publicCount = exports.filter(e => e.isPublic).length;
    const fileGroups = this.groupExportsByFile(exports);

    const suggestions: RemediationSuggestion[] = [];

    // Group suggestions with specific file locations
    for (const [file, fileExports] of Object.entries(fileGroups)) {
      const testFile = this.generateTestFilePath(file);
      suggestions.push({
        type: 'testing',
        description: `Create tests in ${testFile} for ${fileExports.length} exports: ${fileExports.map(e => e.exportName).slice(0, 3).join(', ')}${fileExports.length > 3 ? '...' : ''}`,
        priority: fileExports.some(e => e.isPublic) ? 'high' : 'medium',
        expectedOutcome: `All ${fileExports.length} exports in ${file} will have test coverage`,
        command: this.generateGroupedTestTemplate(fileExports, testFile),
      });
    }

    // General guidance
    suggestions.push({
      type: 'manual_review',
      description: 'Prioritize testing public APIs and critical functions first',
      priority: 'high',
      expectedOutcome: 'Public APIs and critical functionality have comprehensive test coverage',
    });

    // Coverage report generation
    suggestions.push({
      type: 'command',
      description: 'Generate export coverage report to track progress',
      command: 'npm run test -- --coverage --include-untested',
      priority: 'medium',
      expectedOutcome: 'Detailed report showing which exports still lack test coverage',
    });

    return suggestions;
  }

  /**
   * Build remediation suggestions for integration tests
   */
  private buildIntegrationTestRemediation(test: ProjectAnalysis['testAnalysis']['missingIntegrationTests'][0]): RemediationSuggestion[] {
    const suggestions: RemediationSuggestion[] = [];

    // Primary test creation suggestion with specific templates based on critical path type
    const pathType = this.detectCriticalPathType(test.criticalPath);
    suggestions.push({
      type: 'testing',
      description: `Create integration test for ${test.criticalPath}`,
      priority: test.priority === 'critical' ? 'critical' : 'high',
      expectedOutcome: test.description,
      command: this.generateIntegrationTestTemplate(test, pathType),
    });

    // Type-specific setup suggestions
    if (pathType === 'authentication') {
      suggestions.push({
        type: 'testing',
        description: 'Set up authentication test environment with test users and JWT tokens',
        priority: 'high',
        expectedOutcome: 'Test environment configured with authentication providers and test credentials',
        command: this.generateAuthTestSetup(),
      });

      suggestions.push({
        type: 'manual_review',
        description: 'Review security boundaries and authentication flows for comprehensive test coverage',
        priority: 'high',
        expectedOutcome: 'All authentication scenarios (login, logout, token refresh, unauthorized access) are tested',
        warning: 'Security-critical paths must have comprehensive integration test coverage',
      });
    } else if (pathType === 'payment') {
      suggestions.push({
        type: 'testing',
        description: 'Set up payment test environment with mock payment providers (Stripe Test Mode)',
        priority: 'high',
        expectedOutcome: 'Payment integration tests using sandbox/test payment providers',
        command: this.generatePaymentTestSetup(),
      });

      suggestions.push({
        type: 'manual_review',
        description: 'Test payment scenarios: successful charges, failed payments, refunds, and webhooks',
        priority: 'critical',
        expectedOutcome: 'All payment flows thoroughly tested with proper error handling',
        warning: 'Payment integration failures can result in financial losses - test thoroughly',
      });
    } else if (pathType === 'data_processing') {
      suggestions.push({
        type: 'testing',
        description: 'Set up test data fixtures and transformation pipelines',
        priority: 'medium',
        expectedOutcome: 'Test data sets and validation for data processing workflows',
        command: this.generateDataTestSetup(),
      });
    }

    if (test.relatedFiles && test.relatedFiles.length > 0) {
      suggestions.push({
        type: 'manual_review',
        description: `Review interaction between related files: ${test.relatedFiles.slice(0, 3).join(', ')}`,
        priority: 'medium',
        expectedOutcome: 'Understanding of component interactions for comprehensive test design',
      });
    }

    // General integration test infrastructure
    suggestions.push({
      type: 'testing',
      description: 'Configure integration test infrastructure with proper database seeding and cleanup',
      priority: 'medium',
      expectedOutcome: 'Isolated test environment with reliable setup/teardown procedures',
      command: this.generateIntegrationTestInfrastructure(),
    });

    return suggestions;
  }

  /**
   * Build remediation suggestions for grouped integration tests
   */
  private buildGroupedIntegrationTestsRemediation(tests: ProjectAnalysis['testAnalysis']['missingIntegrationTests']): RemediationSuggestion[] {
    const count = tests.length;
    const criticalCount = tests.filter(t => t.priority === 'critical').length;

    return [
      {
        type: 'testing',
        description: `Create ${count} integration tests for critical paths`,
        priority: criticalCount > 0 ? 'critical' : 'high',
        expectedOutcome: `All ${count} critical paths will have integration test coverage`,
      },
      {
        type: 'manual_review',
        description: 'Design comprehensive test scenarios covering user journeys',
        priority: 'high',
        expectedOutcome: 'Complete end-to-end test coverage for critical user flows',
      },
      {
        type: 'testing',
        description: 'Set up integration test infrastructure and fixtures',
        priority: 'medium',
        expectedOutcome: 'Robust test environment supporting all integration test scenarios',
      },
    ];
  }

  /**
   * Build remediation suggestions for anti-patterns
   */
  private buildAntiPatternRemediation(pattern: ProjectAnalysis['testAnalysis']['antiPatterns'][0]): RemediationSuggestion[] {
    const suggestions: RemediationSuggestion[] = [];

    suggestions.push({
      type: 'manual_review',
      description: `Fix ${pattern.type} in ${this.getShortFileName(pattern.file)}:${pattern.line}`,
      priority: pattern.severity === 'high' ? 'high' : 'medium',
      expectedOutcome: pattern.suggestion || `${pattern.type} anti-pattern resolved`,
    });

    // Type-specific suggestions
    switch (pattern.type) {
      case 'no-assertion':
        suggestions.push({
          type: 'testing',
          description: `Add assertions to test at ${this.getShortFileName(pattern.file)}:${pattern.line}`,
          priority: 'critical',
          expectedOutcome: 'Test validates expected behavior and outcomes',
          warning: 'Tests without assertions provide no value and can hide bugs',
          command: `# Add meaningful assertions like:\nexpect(result).toBe(expectedValue);\nexpect(mockFunction).toHaveBeenCalledWith(args);`
        });
        break;

      case 'empty-test':
        suggestions.push({
          type: 'testing',
          description: `Implement test logic at ${this.getShortFileName(pattern.file)}:${pattern.line}`,
          priority: 'high',
          expectedOutcome: 'Test has meaningful implementation',
          command: `# Replace empty test with:\nit('should do something specific', () => {\n  // Arrange: set up test data\n  // Act: execute the code under test\n  // Assert: verify the results\n});`
        });
        break;

      case 'commented-out':
        suggestions.push({
          type: 'manual_review',
          description: `Review and either fix or remove commented test at ${this.getShortFileName(pattern.file)}:${pattern.line}`,
          priority: 'medium',
          expectedOutcome: 'Commented test is either properly implemented or removed',
          command: `# Either uncomment and fix:\n// it('should work', () => { /* fix implementation */ });\n# Or remove if no longer needed`
        });
        break;

      case 'console-only':
        suggestions.push({
          type: 'testing',
          description: `Replace console statements with proper assertions at ${this.getShortFileName(pattern.file)}:${pattern.line}`,
          priority: 'medium',
          expectedOutcome: 'Test uses assertions instead of console output',
          command: `# Replace:\nconsole.log(result);\n# With:\nexpect(result).toEqual(expectedValue);`
        });
        break;

      case 'hardcoded-timeout':
        suggestions.push({
          type: 'testing',
          description: `Replace hardcoded timeout with proper async handling at ${this.getShortFileName(pattern.file)}:${pattern.line}`,
          priority: 'medium',
          expectedOutcome: 'Test uses proper async patterns instead of arbitrary waits',
          command: `# Replace setTimeout with:\nawait waitFor(() => expect(element).toBeVisible());\n# Or use proper async/await patterns`
        });
        break;

      case 'slow-test':
        suggestions.push({
          type: 'testing',
          description: 'Optimize test performance by reducing setup time or mocking dependencies',
          priority: 'medium',
          expectedOutcome: 'Test execution time reduced to acceptable levels',
          command: `# Consider:\n- Mock expensive operations\n- Reduce test data size\n- Use test doubles for external dependencies`
        });
        break;

      case 'flaky-test':
        suggestions.push({
          type: 'testing',
          description: 'Identify and fix sources of test non-determinism',
          priority: 'high',
          expectedOutcome: 'Test runs consistently across multiple executions',
          warning: 'Flaky tests undermine confidence in the test suite',
          command: `# Common fixes:\n- Remove race conditions\n- Mock time-dependent code\n- Ensure proper test isolation\n- Fix async handling`
        });
        break;

      case 'brittle-test':
        suggestions.push({
          type: 'testing',
          description: 'Make test more robust and less dependent on implementation details',
          priority: 'medium',
          expectedOutcome: 'Test focuses on behavior rather than implementation',
          command: `# Improve by:\n- Testing behavior, not implementation\n- Using semantic queries\n- Reducing coupling to internal structure`
        });
        break;

      case 'test-code-duplication':
        suggestions.push({
          type: 'manual_review',
          description: 'Extract common test logic into reusable helper functions',
          priority: 'medium',
          expectedOutcome: 'Reduced test code duplication and improved maintainability',
          command: `# Extract common patterns:\nconst setupTestData = () => ({ /* common setup */ });\nconst assertResult = (result) => { /* common assertions */ };`
        });
        break;

      case 'assertion-roulette':
        suggestions.push({
          type: 'testing',
          description: 'Break down multiple assertions into focused, well-named test cases',
          priority: 'medium',
          expectedOutcome: 'Each test has a single, clear purpose with descriptive error messages',
          command: `# Split into focused tests:\nit('should validate user input', () => { /* single assertion */ });\nit('should save to database', () => { /* single assertion */ });`
        });
        break;

      case 'mystery-guest':
        suggestions.push({
          type: 'testing',
          description: 'Make test dependencies explicit and visible within the test',
          priority: 'medium',
          expectedOutcome: 'Test is self-contained and easy to understand',
          command: `# Make dependencies explicit:\n// Instead of relying on global state\nconst testData = createTestData();\n// Or mock external dependencies clearly`
        });
        break;

      case 'test-pollution':
        suggestions.push({
          type: 'testing',
          description: 'Ensure proper test isolation and cleanup',
          priority: 'high',
          expectedOutcome: 'Tests run independently without side effects',
          command: `# Add proper cleanup:\nafterEach(() => {\n  cleanup();\n  jest.clearAllMocks();\n});`
        });
        break;

      case 'eager-test':
        suggestions.push({
          type: 'testing',
          description: 'Split test into focused unit tests for individual behaviors',
          priority: 'medium',
          expectedOutcome: 'Each test validates a single, specific behavior',
          command: `# Split large test:\nit('should validate input', () => { /* test validation only */ });\nit('should process data', () => { /* test processing only */ });`
        });
        break;

      default:
        suggestions.push({
          type: 'testing',
          description: `Address ${pattern.type} anti-pattern`,
          priority: 'medium',
          expectedOutcome: 'Test quality improved according to best practices',
        });
        break;
    }

    return suggestions;
  }

  /**
   * Build remediation suggestions for grouped anti-patterns
   */
  private buildGroupedAntiPatternsRemediation(patterns: ProjectAnalysis['testAnalysis']['antiPatterns']): RemediationSuggestion[] {
    const count = patterns.length;
    const types = [...new Set(patterns.map(p => p.type))];

    return [
      {
        type: 'manual_review',
        description: `Fix ${count} testing anti-patterns`,
        priority: 'medium',
        expectedOutcome: `All ${count} anti-patterns resolved, improving test quality and maintainability`,
      },
      {
        type: 'testing',
        description: 'Implement testing best practices and refactor problematic tests',
        priority: 'medium',
        expectedOutcome: 'Test suite follows best practices and is more reliable',
      },
      {
        type: 'documentation',
        description: 'Document testing standards to prevent future anti-patterns',
        priority: 'low',
        expectedOutcome: 'Team has clear guidelines for writing quality tests',
      },
    ];
  }

  /**
   * Build type-specific remediation suggestions for grouped anti-patterns
   */
  private buildTypeSpecificAntiPatternRemediation(patterns: ProjectAnalysis['testAnalysis']['antiPatterns'], type: string): RemediationSuggestion[] {
    const count = patterns.length;
    const suggestions: RemediationSuggestion[] = [];

    // Type-specific grouped recommendations
    switch (type) {
      case 'no-assertion':
        suggestions.push({
          type: 'testing',
          description: `Add meaningful assertions to ${count} tests lacking assertions`,
          priority: 'critical',
          expectedOutcome: 'All tests validate expected behavior and catch regressions',
          warning: 'Tests without assertions provide no value and can hide bugs',
          command: `# Review each test and add assertions like:\nexpect(result).toBe(expectedValue);\nexpect(mockFunction).toHaveBeenCalledWith(args);`
        });
        break;

      case 'slow-test':
        suggestions.push({
          type: 'testing',
          description: `Optimize performance of ${count} slow tests`,
          priority: 'medium',
          expectedOutcome: 'Test suite runs faster, improving developer productivity',
          command: `# Common optimizations:\n- Mock expensive operations\n- Reduce test data size\n- Parallelize independent tests\n- Use test doubles for external dependencies`
        });
        break;

      case 'test-code-duplication':
        suggestions.push({
          type: 'manual_review',
          description: `Extract common patterns from ${count} duplicated test implementations`,
          priority: 'medium',
          expectedOutcome: 'Reduced test code duplication and improved maintainability',
          command: `# Create shared test utilities:\nconst testHelpers = {\n  setupTestData: () => ({ /* common setup */ }),\n  assertResult: (result) => { /* common assertions */ }\n};`
        });
        break;

      case 'assertion-roulette':
        suggestions.push({
          type: 'testing',
          description: `Split ${count} tests with multiple assertions into focused test cases`,
          priority: 'medium',
          expectedOutcome: 'Each test has a single, clear purpose with descriptive error messages',
          command: `# Split into focused tests:\nit('should validate user input', () => { /* single assertion */ });\nit('should save to database', () => { /* single assertion */ });`
        });
        break;

      case 'mystery-guest':
        suggestions.push({
          type: 'testing',
          description: `Make dependencies explicit in ${count} tests with hidden dependencies`,
          priority: 'medium',
          expectedOutcome: 'Tests are self-contained and easy to understand',
          command: `# Make dependencies visible:\n// Instead of relying on global state\nconst testData = createTestData();\n// Mock external dependencies clearly`
        });
        break;

      default:
        suggestions.push({
          type: 'testing',
          description: `Address ${count} ${this.formatAntiPatternType(type)} anti-patterns`,
          priority: 'medium',
          expectedOutcome: 'Test quality improved according to best practices',
        });
        break;
    }

    // Add general guidance for the specific type
    suggestions.push({
      type: 'manual_review',
      description: `Review and apply ${this.formatAntiPatternType(type)} best practices`,
      priority: 'low',
      expectedOutcome: 'Team understands and consistently applies best practices',
    });

    return suggestions;
  }

  /**
   * Build remediation suggestions for critical coverage
   */
  private buildCriticalCoverageRemediation(currentPercentage: number): RemediationSuggestion[] {
    return [
      {
        type: 'testing',
        description: 'Add tests for critical code paths and core functionality',
        priority: 'critical',
        expectedOutcome: `Test coverage increased from ${currentPercentage.toFixed(1)}% to at least 50%`,
      },
      {
        type: 'command',
        description: 'Generate coverage report to identify untested files',
        command: 'npm run test -- --coverage',
        priority: 'high',
        expectedOutcome: 'Detailed coverage report highlighting files that need tests',
      },
      {
        type: 'manual_review',
        description: 'Prioritize testing business logic, APIs, and error handling',
        priority: 'high',
        expectedOutcome: 'Most critical application functionality has test coverage',
      },
    ];
  }

  /**
   * Build remediation suggestions for slow tests
   */
  private buildSlowTestsRemediation(slowTests: string[]): RemediationSuggestion[] {
    return [
      {
        type: 'testing',
        description: 'Optimize slow test performance',
        priority: 'medium',
        expectedOutcome: `${slowTests.length} slow tests optimized for faster execution`,
      },
      {
        type: 'manual_review',
        description: 'Review test setup and dependencies for optimization opportunities',
        priority: 'medium',
        expectedOutcome: 'Identification of performance bottlenecks in test suite',
      },
      {
        type: 'command',
        description: 'Profile test execution to identify slowest tests',
        command: 'npm run test -- --verbose --reporter=json',
        priority: 'low',
        expectedOutcome: 'Detailed timing information for all tests',
      },
    ];
  }

  /**
   * Utility methods
   */
  private getShortFileName(file: string): string {
    return file.split('/').pop() || file;
  }

  private makeFilenameSafe(filename: string): string {
    return filename.replace(/[^a-zA-Z0-9-_]/g, '-').replace(/-+/g, '-');
  }

  private isAPIFile(file: string): boolean {
    return file.includes('api') || file.includes('controller') || file.includes('endpoint') || file.includes('route');
  }

  /**
   * Generate test file path from source file path
   */
  private generateTestFilePath(sourceFile: string): string {
    // Remove leading './' if present
    const cleanPath = sourceFile.replace(/^\.\//, '');

    // Handle different test file naming conventions
    if (cleanPath.includes('/src/')) {
      // Standard src structure: src/components/Button.ts -> src/components/Button.test.ts
      return cleanPath.replace(/\.([jt]sx?)$/, '.test.$1');
    } else if (cleanPath.startsWith('src/')) {
      // Root src: src/utils.ts -> src/utils.test.ts
      return cleanPath.replace(/\.([jt]sx?)$/, '.test.$1');
    } else {
      // Default: components/Button.ts -> components/Button.test.ts
      return cleanPath.replace(/\.([jt]sx?)$/, '.test.$1');
    }
  }

  /**
   * Group exports by their source file
   */
  private groupExportsByFile(exports: ProjectAnalysis['testAnalysis']['untestedExports']): Record<string, typeof exports> {
    const grouped: Record<string, typeof exports> = {};

    for (const exportItem of exports) {
      if (!grouped[exportItem.file]) {
        grouped[exportItem.file] = [];
      }
      grouped[exportItem.file].push(exportItem);
    }

    return grouped;
  }

  /**
   * Generate test template for a single export
   */
  private generateTestTemplate(exportItem: ProjectAnalysis['testAnalysis']['untestedExports'][0], testFile: string): string {
    const importPath = this.getRelativeImportPath(testFile, exportItem.file);

    return `# Create test file: ${testFile}
import { describe, it, expect } from 'vitest';
import { ${exportItem.exportName} } from '${importPath}';

describe('${exportItem.exportName}', () => {
  it('should be defined', () => {
    expect(${exportItem.exportName}).toBeDefined();
  });

  // Add more specific tests based on the ${exportItem.exportType} functionality
});`;
  }

  /**
   * Generate class-specific test template
   */
  private generateClassTestTemplate(className: string, testFile: string): string {
    return `# Class test template for ${className}:
describe('${className}', () => {
  let instance: ${className};

  beforeEach(() => {
    instance = new ${className}(/* constructor args */);
  });

  describe('constructor', () => {
    it('should create instance with valid parameters', () => {
      expect(instance).toBeInstanceOf(${className});
    });

    it('should throw error with invalid parameters', () => {
      expect(() => new ${className}(/* invalid args */)).toThrow();
    });
  });

  describe('methods', () => {
    // Test each public method
    it('should handle normal cases', () => {
      // Test normal operation
    });

    it('should handle edge cases', () => {
      // Test boundary conditions
    });

    it('should handle error cases', () => {
      // Test error scenarios
    });
  });
});`;
  }

  /**
   * Generate function-specific test template
   */
  private generateFunctionTestTemplate(functionName: string, testFile: string): string {
    return `# Function test template for ${functionName}:
describe('${functionName}', () => {
  it('should return expected result with valid input', () => {
    const result = ${functionName}(/* valid input */);
    expect(result).toEqual(/* expected output */);
  });

  it('should handle edge cases', () => {
    // Test with boundary values
    expect(${functionName}(null)).toBe(/* expected */);
    expect(${functionName}(undefined)).toBe(/* expected */);
    expect(${functionName}('')).toBe(/* expected */);
  });

  it('should throw error with invalid input', () => {
    expect(() => ${functionName}(/* invalid input */)).toThrow();
  });

  it('should handle async operations correctly', () => {
    // If function is async
    return expect(${functionName}(/* input */)).resolves.toBe(/* expected */);
  });
});`;
  }

  /**
   * Generate grouped test template for multiple exports from the same file
   */
  private generateGroupedTestTemplate(exports: ProjectAnalysis['testAnalysis']['untestedExports'], testFile: string): string {
    const sourceFile = exports[0]?.file || '';
    const importPath = this.getRelativeImportPath(testFile, sourceFile);
    const importNames = exports.map(e => e.exportName).join(', ');

    return `# Create test file: ${testFile}
import { describe, it, expect } from 'vitest';
import { ${importNames} } from '${importPath}';

${exports.map(exportItem => `
describe('${exportItem.exportName}', () => {
  it('should be defined', () => {
    expect(${exportItem.exportName}).toBeDefined();
  });

  // TODO: Add specific tests for ${exportItem.exportType} ${exportItem.exportName}
  // ${exportItem.isPublic ? 'NOTE: This is a public API - ensure comprehensive coverage' : ''}
});`).join('\n')}`;
  }

  /**
   * Generate relative import path between test file and source file
   */
  private getRelativeImportPath(testFile: string, sourceFile: string): string {
    // Simple relative path calculation - could be enhanced
    const testDir = testFile.split('/').slice(0, -1);
    const sourceDir = sourceFile.split('/').slice(0, -1);
    const sourceFileName = sourceFile.split('/').pop()?.replace(/\.[jt]sx?$/, '') || '';

    // If in same directory
    if (testDir.join('/') === sourceDir.join('/')) {
      return `./${sourceFileName}`;
    }

    // Calculate relative path (simplified)
    const commonLength = Math.min(testDir.length, sourceDir.length);
    let commonIndex = 0;
    while (commonIndex < commonLength && testDir[commonIndex] === sourceDir[commonIndex]) {
      commonIndex++;
    }

    const upLevels = testDir.length - commonIndex;
    const downPath = sourceDir.slice(commonIndex);

    let relativePath = '';
    if (upLevels > 0) {
      relativePath = '../'.repeat(upLevels);
    }
    relativePath += downPath.join('/');
    if (relativePath && !relativePath.endsWith('/')) {
      relativePath += '/';
    }
    relativePath += sourceFileName;

    return relativePath || `./${sourceFileName}`;
  }

  private formatAntiPatternType(type: string): string {
    return type.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
  }

  private getAntiPatternEffort(type: string): 'low' | 'medium' | 'high' {
    const highEffortPatterns = ['test-pollution', 'eager-test', 'flaky-test'];
    const mediumEffortPatterns = ['brittle-test', 'slow-test', 'test-code-duplication'];

    if (highEffortPatterns.includes(type)) return 'high';
    if (mediumEffortPatterns.includes(type)) return 'medium';
    return 'low';
  }

  private buildBranchCoverageRationale(file: string, branches: ProjectAnalysis['testAnalysis']['branchCoverage']['uncoveredBranches']): string {
    const branchTypes = [...new Set(branches.map(b => b.type))];
    return `File ${this.getShortFileName(file)} has ${branches.length} uncovered ${branchTypes.join('/')} branches that could lead to unexpected behavior in edge cases`;
  }

  private buildUntestedExportRationale(exportItem: ProjectAnalysis['testAnalysis']['untestedExports'][0]): string {
    if (exportItem.isPublic) {
      return `Public ${exportItem.exportType} ${exportItem.exportName} lacks test coverage, creating risk for API consumers`;
    }
    return `${exportItem.exportType} ${exportItem.exportName} needs test coverage to ensure reliability and prevent regressions`;
  }

  private buildGroupedUntestedExportsRationale(exports: ProjectAnalysis['testAnalysis']['untestedExports']): string {
    const publicCount = exports.filter(e => e.isPublic).length;
    if (publicCount > 0) {
      return `${exports.length} exports lack tests, including ${publicCount} public APIs that are critical for application reliability`;
    }
    return `${exports.length} exports lack test coverage, increasing risk of undetected bugs and regressions`;
  }

  private buildAntiPatternRationale(pattern: ProjectAnalysis['testAnalysis']['antiPatterns'][0]): string {
    const severityMessages = {
      high: 'High-severity anti-patterns significantly impact test reliability and maintainability',
      medium: 'Medium-severity anti-patterns reduce test quality and developer productivity',
      low: 'Low-severity anti-patterns should be addressed to maintain test suite quality',
    };

    return `${severityMessages[pattern.severity]}. ${pattern.description}`;
  }

  /**
   * Detect the type of critical path for specialized remediation
   */
  private detectCriticalPathType(criticalPath: string): 'authentication' | 'payment' | 'data_processing' | 'api_endpoint' | 'database' | 'external_service' | 'general' {
    const lowerPath = criticalPath.toLowerCase();

    if (lowerPath.includes('auth') || lowerPath.includes('login') || lowerPath.includes('token')) {
      return 'authentication';
    } else if (lowerPath.includes('payment') || lowerPath.includes('billing') || lowerPath.includes('stripe') || lowerPath.includes('transaction')) {
      return 'payment';
    } else if (lowerPath.includes('data processing') || lowerPath.includes('import') || lowerPath.includes('export') || lowerPath.includes('transform')) {
      return 'data_processing';
    } else if (lowerPath.includes('api endpoint') || lowerPath.includes('endpoint')) {
      return 'api_endpoint';
    } else if (lowerPath.includes('database') || lowerPath.includes('query')) {
      return 'database';
    } else if (lowerPath.includes('external service') || lowerPath.includes('service')) {
      return 'external_service';
    }

    return 'general';
  }

  /**
   * Generate integration test template based on path type
   */
  private generateIntegrationTestTemplate(test: ProjectAnalysis['testAnalysis']['missingIntegrationTests'][0], pathType: string): string {
    const testName = test.criticalPath.replace(/[^a-zA-Z0-9]/g, '');
    const testFileName = `integration/${testName.toLowerCase()}.integration.test.ts`;

    switch (pathType) {
      case 'authentication':
        return this.generateAuthIntegrationTemplate(testFileName, test);
      case 'payment':
        return this.generatePaymentIntegrationTemplate(testFileName, test);
      case 'data_processing':
        return this.generateDataProcessingIntegrationTemplate(testFileName, test);
      case 'api_endpoint':
        return this.generateAPIIntegrationTemplate(testFileName, test);
      case 'database':
        return this.generateDatabaseIntegrationTemplate(testFileName, test);
      default:
        return this.generateGeneralIntegrationTemplate(testFileName, test);
    }
  }

  /**
   * Generate authentication integration test template
   */
  private generateAuthIntegrationTemplate(testFileName: string, test: ProjectAnalysis['testAnalysis']['missingIntegrationTests'][0]): string {
    return `# Create integration test: ${testFileName}
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { app } from '../src/app'; // Adjust path as needed

describe('${test.criticalPath} - Authentication Integration', () => {
  let testUser: any;
  let authToken: string;

  beforeEach(async () => {
    // Set up test user and authentication
    testUser = await createTestUser();
    authToken = await generateTestToken(testUser.id);
  });

  afterEach(async () => {
    // Clean up test data
    await cleanupTestUser(testUser.id);
  });

  describe('Authentication Flow', () => {
    it('should authenticate valid user credentials', async () => {
      const response = await request(app)
        .post('/auth/login')
        .send({
          email: testUser.email,
          password: 'test-password'
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('token');
      expect(response.body).toHaveProperty('user');
    });

    it('should reject invalid credentials', async () => {
      const response = await request(app)
        .post('/auth/login')
        .send({
          email: testUser.email,
          password: 'wrong-password'
        });

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('error');
    });

    it('should protect authenticated routes', async () => {
      const response = await request(app)
        .get('/api/protected')
        .set('Authorization', \`Bearer \${authToken}\`);

      expect(response.status).toBe(200);
    });

    it('should reject requests without valid tokens', async () => {
      const response = await request(app)
        .get('/api/protected')
        .set('Authorization', 'Bearer invalid-token');

      expect(response.status).toBe(401);
    });

    it('should handle token refresh correctly', async () => {
      // Test token refresh flow
      const response = await request(app)
        .post('/auth/refresh')
        .set('Authorization', \`Bearer \${authToken}\`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('token');
    });
  });

  describe('Session Management', () => {
    it('should handle logout and session cleanup', async () => {
      const logoutResponse = await request(app)
        .post('/auth/logout')
        .set('Authorization', \`Bearer \${authToken}\`);

      expect(logoutResponse.status).toBe(200);

      // Verify token is no longer valid
      const protectedResponse = await request(app)
        .get('/api/protected')
        .set('Authorization', \`Bearer \${authToken}\`);

      expect(protectedResponse.status).toBe(401);
    });
  });
});

// Helper functions
async function createTestUser() {
  // Implement test user creation
  return {
    id: 'test-user-id',
    email: 'test@example.com',
    name: 'Test User'
  };
}

async function generateTestToken(userId: string) {
  // Implement test token generation
  return 'test-jwt-token';
}

async function cleanupTestUser(userId: string) {
  // Implement test data cleanup
}`;
  }

  /**
   * Generate payment integration test template
   */
  private generatePaymentIntegrationTemplate(testFileName: string, test: ProjectAnalysis['testAnalysis']['missingIntegrationTests'][0]): string {
    return `# Create integration test: ${testFileName}
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { app } from '../src/app'; // Adjust path as needed
import Stripe from 'stripe';

// Use Stripe test mode
const stripe = new Stripe(process.env.STRIPE_TEST_SECRET_KEY!, {
  apiVersion: '2023-10-16'
});

describe('${test.criticalPath} - Payment Integration', () => {
  let testCustomer: Stripe.Customer;
  let testPaymentMethod: Stripe.PaymentMethod;
  let authToken: string;

  beforeEach(async () => {
    // Set up test customer and payment method
    testCustomer = await stripe.customers.create({
      email: 'test@example.com',
      name: 'Test Customer'
    });

    testPaymentMethod = await stripe.paymentMethods.create({
      type: 'card',
      card: {
        number: '4242424242424242', // Stripe test card
        exp_month: 12,
        exp_year: 2025,
        cvc: '123'
      }
    });

    await stripe.paymentMethods.attach(testPaymentMethod.id, {
      customer: testCustomer.id
    });

    authToken = await generateTestToken();
  });

  afterEach(async () => {
    // Clean up test data
    if (testCustomer) {
      await stripe.customers.del(testCustomer.id);
    }
  });

  describe('Payment Processing', () => {
    it('should process successful payment', async () => {
      const response = await request(app)
        .post('/api/payments')
        .set('Authorization', \`Bearer \${authToken}\`)
        .send({
          amount: 1000, // $10.00 in cents
          currency: 'usd',
          paymentMethodId: testPaymentMethod.id,
          customerId: testCustomer.id
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('paymentIntentId');
      expect(response.body.status).toBe('succeeded');
    });

    it('should handle payment failures gracefully', async () => {
      // Use a card that will be declined
      const declinedCard = await stripe.paymentMethods.create({
        type: 'card',
        card: {
          number: '4000000000000002', // Stripe test card that always declines
          exp_month: 12,
          exp_year: 2025,
          cvc: '123'
        }
      });

      const response = await request(app)
        .post('/api/payments')
        .set('Authorization', \`Bearer \${authToken}\`)
        .send({
          amount: 1000,
          currency: 'usd',
          paymentMethodId: declinedCard.id,
          customerId: testCustomer.id
        });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });

    it('should process refunds correctly', async () => {
      // First, create a successful payment
      const paymentResponse = await request(app)
        .post('/api/payments')
        .set('Authorization', \`Bearer \${authToken}\`)
        .send({
          amount: 1000,
          currency: 'usd',
          paymentMethodId: testPaymentMethod.id,
          customerId: testCustomer.id
        });

      const paymentIntentId = paymentResponse.body.paymentIntentId;

      // Then refund it
      const refundResponse = await request(app)
        .post('/api/refunds')
        .set('Authorization', \`Bearer \${authToken}\`)
        .send({
          paymentIntentId,
          amount: 1000
        });

      expect(refundResponse.status).toBe(200);
      expect(refundResponse.body).toHaveProperty('refundId');
    });
  });

  describe('Webhook Processing', () => {
    it('should handle payment success webhooks', async () => {
      const webhookPayload = {
        type: 'payment_intent.succeeded',
        data: {
          object: {
            id: 'pi_test_123',
            amount: 1000,
            status: 'succeeded'
          }
        }
      };

      const response = await request(app)
        .post('/api/webhooks/stripe')
        .send(webhookPayload);

      expect(response.status).toBe(200);
    });
  });
});

async function generateTestToken() {
  // Implement test token generation for authenticated requests
  return 'test-auth-token';
}`;
  }

  /**
   * Generate data processing integration test template
   */
  private generateDataProcessingIntegrationTemplate(testFileName: string, test: ProjectAnalysis['testAnalysis']['missingIntegrationTests'][0]): string {
    return `# Create integration test: ${testFileName}
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'fs';
import path from 'path';

describe('${test.criticalPath} - Data Processing Integration', () => {
  const testDataDir = path.join(__dirname, '../test-data');
  const outputDir = path.join(__dirname, '../test-output');

  beforeEach(async () => {
    // Set up test directories and sample data
    await fs.mkdir(testDataDir, { recursive: true });
    await fs.mkdir(outputDir, { recursive: true });
    await createSampleTestData();
  });

  afterEach(async () => {
    // Clean up test files
    await cleanupTestData();
  });

  describe('Data Import', () => {
    it('should import CSV data correctly', async () => {
      const csvFilePath = path.join(testDataDir, 'sample.csv');

      const result = await importCsvData(csvFilePath);

      expect(result.success).toBe(true);
      expect(result.recordsProcessed).toBeGreaterThan(0);
      expect(result.errors).toHaveLength(0);
    });

    it('should handle malformed CSV data gracefully', async () => {
      const malformedCsvPath = path.join(testDataDir, 'malformed.csv');
      await fs.writeFile(malformedCsvPath, 'invalid,csv,data\\nwith"bad"formatting');

      const result = await importCsvData(malformedCsvPath);

      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('Data Transformation', () => {
    it('should transform data according to business rules', async () => {
      const inputData = [
        { name: 'John', age: '25', email: 'john@example.com' },
        { name: 'Jane', age: '30', email: 'jane@example.com' }
      ];

      const transformedData = await transformUserData(inputData);

      expect(transformedData).toHaveLength(2);
      expect(transformedData[0]).toHaveProperty('id');
      expect(transformedData[0].age).toBe(25); // Should be converted to number
      expect(transformedData[0].createdAt).toBeInstanceOf(Date);
    });

    it('should validate data during transformation', async () => {
      const invalidData = [
        { name: '', age: 'invalid', email: 'not-an-email' }
      ];

      await expect(transformUserData(invalidData))
        .rejects.toThrow('Validation failed');
    });
  });

  describe('Data Export', () => {
    it('should export data to PDF correctly', async () => {
      const sampleData = [
        { id: 1, name: 'John', email: 'john@example.com' },
        { id: 2, name: 'Jane', email: 'jane@example.com' }
      ];

      const pdfPath = path.join(outputDir, 'export.pdf');
      await exportToPdf(sampleData, pdfPath);

      const pdfExists = await fs.access(pdfPath).then(() => true).catch(() => false);
      expect(pdfExists).toBe(true);

      const stats = await fs.stat(pdfPath);
      expect(stats.size).toBeGreaterThan(0);
    });
  });
});

async function createSampleTestData() {
  const csvData = \`name,age,email
John Doe,25,john@example.com
Jane Smith,30,jane@example.com
Bob Johnson,35,bob@example.com\`;

  await fs.writeFile(path.join(testDataDir, 'sample.csv'), csvData);
}

async function cleanupTestData() {
  // Implementation depends on your cleanup strategy
}

// Mock implementations - replace with actual imports
async function importCsvData(filePath: string) {
  // Implement CSV import logic
  return { success: true, recordsProcessed: 3, errors: [] };
}

async function transformUserData(data: any[]) {
  // Implement data transformation logic
  return data.map(item => ({
    ...item,
    id: Math.random().toString(),
    age: parseInt(item.age),
    createdAt: new Date()
  }));
}

async function exportToPdf(data: any[], outputPath: string) {
  // Implement PDF export logic
  await fs.writeFile(outputPath, 'mock pdf content');
}`;
  }

  /**
   * Generate API integration test template
   */
  private generateAPIIntegrationTemplate(testFileName: string, test: ProjectAnalysis['testAnalysis']['missingIntegrationTests'][0]): string {
    return `# Create integration test: ${testFileName}
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { app } from '../src/app'; // Adjust path as needed

describe('${test.criticalPath} - API Integration', () => {
  let authToken: string;
  let testData: any[];

  beforeEach(async () => {
    // Set up test authentication and data
    authToken = await generateTestToken();
    testData = await seedTestData();
  });

  afterEach(async () => {
    // Clean up test data
    await cleanupTestData();
  });

  describe('API Endpoints', () => {
    it('should return list of resources', async () => {
      const response = await request(app)
        .get('/api/resources')
        .set('Authorization', \`Bearer \${authToken}\`);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThan(0);
    });

    it('should create new resource', async () => {
      const newResource = {
        name: 'Test Resource',
        description: 'This is a test resource'
      };

      const response = await request(app)
        .post('/api/resources')
        .set('Authorization', \`Bearer \${authToken}\`)
        .send(newResource);

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('id');
      expect(response.body.name).toBe(newResource.name);
    });

    it('should validate required fields', async () => {
      const invalidResource = {
        description: 'Missing name field'
      };

      const response = await request(app)
        .post('/api/resources')
        .set('Authorization', \`Bearer \${authToken}\`)
        .send(invalidResource);

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('errors');
    });

    it('should update existing resource', async () => {
      const resourceId = testData[0].id;
      const updateData = {
        name: 'Updated Resource Name'
      };

      const response = await request(app)
        .put(\`/api/resources/\${resourceId}\`)
        .set('Authorization', \`Bearer \${authToken}\`)
        .send(updateData);

      expect(response.status).toBe(200);
      expect(response.body.name).toBe(updateData.name);
    });

    it('should delete resource', async () => {
      const resourceId = testData[0].id;

      const deleteResponse = await request(app)
        .delete(\`/api/resources/\${resourceId}\`)
        .set('Authorization', \`Bearer \${authToken}\`);

      expect(deleteResponse.status).toBe(204);

      // Verify resource is deleted
      const getResponse = await request(app)
        .get(\`/api/resources/\${resourceId}\`)
        .set('Authorization', \`Bearer \${authToken}\`);

      expect(getResponse.status).toBe(404);
    });

    it('should handle pagination correctly', async () => {
      const response = await request(app)
        .get('/api/resources?page=1&limit=5')
        .set('Authorization', \`Bearer \${authToken}\`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('data');
      expect(response.body).toHaveProperty('pagination');
      expect(response.body.pagination).toHaveProperty('currentPage');
      expect(response.body.pagination).toHaveProperty('totalPages');
    });
  });

  describe('Error Handling', () => {
    it('should return 401 for unauthorized requests', async () => {
      const response = await request(app)
        .get('/api/resources');

      expect(response.status).toBe(401);
    });

    it('should return 404 for non-existent resources', async () => {
      const response = await request(app)
        .get('/api/resources/non-existent-id')
        .set('Authorization', \`Bearer \${authToken}\`);

      expect(response.status).toBe(404);
    });

    it('should handle malformed JSON gracefully', async () => {
      const response = await request(app)
        .post('/api/resources')
        .set('Authorization', \`Bearer \${authToken}\`)
        .set('Content-Type', 'application/json')
        .send('{ invalid json }');

      expect(response.status).toBe(400);
    });
  });
});

async function generateTestToken() {
  // Implement test token generation
  return 'test-jwt-token';
}

async function seedTestData() {
  // Implement test data seeding
  return [
    { id: '1', name: 'Test Resource 1', description: 'First test resource' },
    { id: '2', name: 'Test Resource 2', description: 'Second test resource' }
  ];
}

async function cleanupTestData() {
  // Implement test data cleanup
}`;
  }

  /**
   * Generate database integration test template
   */
  private generateDatabaseIntegrationTemplate(testFileName: string, test: ProjectAnalysis['testAnalysis']['missingIntegrationTests'][0]): string {
    return `# Create integration test: ${testFileName}
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getConnection, getRepository } from 'typeorm'; // Adjust based on your ORM

describe('${test.criticalPath} - Database Integration', () => {
  beforeEach(async () => {
    // Set up test database and seed data
    await seedTestDatabase();
  });

  afterEach(async () => {
    // Clean up test data
    await cleanupTestDatabase();
  });

  describe('Database Operations', () => {
    it('should perform CRUD operations correctly', async () => {
      // Create
      const newRecord = await createTestRecord({
        name: 'Test Record',
        value: 'test-value'
      });

      expect(newRecord).toHaveProperty('id');
      expect(newRecord.name).toBe('Test Record');

      // Read
      const fetchedRecord = await findTestRecord(newRecord.id);
      expect(fetchedRecord).toBeDefined();
      expect(fetchedRecord.name).toBe('Test Record');

      // Update
      const updatedRecord = await updateTestRecord(newRecord.id, {
        name: 'Updated Record'
      });
      expect(updatedRecord.name).toBe('Updated Record');

      // Delete
      await deleteTestRecord(newRecord.id);
      const deletedRecord = await findTestRecord(newRecord.id);
      expect(deletedRecord).toBeNull();
    });

    it('should handle transactions correctly', async () => {
      const connection = getConnection();
      const queryRunner = connection.createQueryRunner();

      await queryRunner.connect();
      await queryRunner.startTransaction();

      try {
        // Perform multiple database operations
        const record1 = await createTestRecordInTransaction(queryRunner, {
          name: 'Record 1'
        });
        const record2 = await createTestRecordInTransaction(queryRunner, {
          name: 'Record 2'
        });

        await queryRunner.commitTransaction();

        // Verify both records were created
        const record1Check = await findTestRecord(record1.id);
        const record2Check = await findTestRecord(record2.id);
        expect(record1Check).toBeDefined();
        expect(record2Check).toBeDefined();
      } catch (error) {
        await queryRunner.rollbackTransaction();
        throw error;
      } finally {
        await queryRunner.release();
      }
    });

    it('should roll back transactions on failure', async () => {
      const connection = getConnection();
      const queryRunner = connection.createQueryRunner();

      await queryRunner.connect();
      await queryRunner.startTransaction();

      try {
        // Create a record
        const record = await createTestRecordInTransaction(queryRunner, {
          name: 'Will be rolled back'
        });

        // Simulate an error
        throw new Error('Simulated transaction failure');
      } catch (error) {
        await queryRunner.rollbackTransaction();

        // Verify record was not created due to rollback
        const recordCheck = await findTestRecord('temp-id');
        expect(recordCheck).toBeNull();
      } finally {
        await queryRunner.release();
      }
    });

    it('should enforce database constraints', async () => {
      // Test unique constraint
      await createTestRecord({ name: 'Unique Name', email: 'unique@example.com' });

      await expect(
        createTestRecord({ name: 'Another Name', email: 'unique@example.com' })
      ).rejects.toThrow(); // Should violate unique constraint

      // Test foreign key constraint
      await expect(
        createTestRecordWithInvalidForeignKey()
      ).rejects.toThrow();
    });

    it('should handle concurrent access correctly', async () => {
      // Create a record
      const record = await createTestRecord({ name: 'Concurrent Test', version: 1 });

      // Simulate concurrent updates
      const update1Promise = updateTestRecordWithOptimisticLocking(record.id, {
        name: 'Update 1',
        version: 1
      });

      const update2Promise = updateTestRecordWithOptimisticLocking(record.id, {
        name: 'Update 2',
        version: 1
      });

      // One should succeed, one should fail due to version conflict
      const results = await Promise.allSettled([update1Promise, update2Promise]);

      const successCount = results.filter(r => r.status === 'fulfilled').length;
      const failureCount = results.filter(r => r.status === 'rejected').length;

      expect(successCount).toBe(1);
      expect(failureCount).toBe(1);
    });
  });
});

// Helper functions - implement based on your ORM and database setup
async function seedTestDatabase() {
  // Implement database seeding
}

async function cleanupTestDatabase() {
  // Implement database cleanup
}

async function createTestRecord(data: any) {
  // Implement record creation
  return { id: 'test-id', ...data };
}

async function findTestRecord(id: string) {
  // Implement record finding
  return null;
}

async function updateTestRecord(id: string, data: any) {
  // Implement record updating
  return { id, ...data };
}

async function deleteTestRecord(id: string) {
  // Implement record deletion
}

async function createTestRecordInTransaction(queryRunner: any, data: any) {
  // Implement transactional record creation
  return { id: 'transaction-id', ...data };
}

async function createTestRecordWithInvalidForeignKey() {
  // Implement invalid foreign key test
  throw new Error('Foreign key constraint violation');
}

async function updateTestRecordWithOptimisticLocking(id: string, data: any) {
  // Implement optimistic locking update
  return { id, ...data };
}`;
  }

  /**
   * Generate general integration test template
   */
  private generateGeneralIntegrationTemplate(testFileName: string, test: ProjectAnalysis['testAnalysis']['missingIntegrationTests'][0]): string {
    return `# Create integration test: ${testFileName}
import { describe, it, expect, beforeEach, afterEach } from 'vitest';

describe('${test.criticalPath} - Integration', () => {
  beforeEach(async () => {
    // Set up test environment
    await setupTestEnvironment();
  });

  afterEach(async () => {
    // Clean up test environment
    await cleanupTestEnvironment();
  });

  describe('Component Integration', () => {
    it('should integrate components correctly', async () => {
      // Implement integration test logic
      const result = await runIntegrationTest();

      expect(result.success).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should handle error scenarios', async () => {
      // Test error handling in integration
      await expect(runFailingIntegrationTest())
        .rejects.toThrow();
    });
  });
});

async function setupTestEnvironment() {
  // Implement test setup
}

async function cleanupTestEnvironment() {
  // Implement test cleanup
}

async function runIntegrationTest() {
  // Implement integration test logic
  return { success: true, errors: [] };
}

async function runFailingIntegrationTest() {
  // Implement failing test scenario
  throw new Error('Integration test failure');
}`;
  }

  /**
   * Generate authentication test setup instructions
   */
  private generateAuthTestSetup(): string {
    return `# Authentication Test Environment Setup

## 1. Install Test Dependencies
npm install --save-dev @types/supertest supertest jsonwebtoken

## 2. Configure Test Environment Variables
Create \`.env.test\` file:
\`\`\`
NODE_ENV=test
JWT_SECRET=test-jwt-secret-key
JWT_EXPIRES_IN=1h
DATABASE_URL=postgresql://test:test@localhost:5432/test_db
\`\`\`

## 3. Set up Test Database
\`\`\`bash
# Create test database
createdb test_db

# Run migrations for test database
NODE_ENV=test npm run migrate
\`\`\`

## 4. Configure Test JWT Helper
Create \`test/helpers/auth.ts\`:
\`\`\`typescript
import jwt from 'jsonwebtoken';

export function generateTestToken(userId: string, permissions: string[] = []) {
  return jwt.sign(
    { userId, permissions },
    process.env.JWT_SECRET!,
    { expiresIn: '1h' }
  );
}

export function createTestUser(overrides = {}) {
  return {
    id: 'test-user-id',
    email: 'test@example.com',
    name: 'Test User',
    permissions: ['read', 'write'],
    ...overrides
  };
}
\`\`\`

## 5. Add to vitest.config.ts
\`\`\`typescript
export default defineConfig({
  test: {
    env: {
      NODE_ENV: 'test'
    },
    setupFiles: ['./test/setup.ts']
  }
});
\`\`\``;
  }

  /**
   * Generate payment test setup instructions
   */
  private generatePaymentTestSetup(): string {
    return `# Payment Test Environment Setup

## 1. Install Stripe Test Dependencies
npm install --save-dev stripe

## 2. Configure Stripe Test Environment
Create \`.env.test\` file:
\`\`\`
NODE_ENV=test
STRIPE_TEST_SECRET_KEY=sk_test_your_test_key_here
STRIPE_TEST_PUBLISHABLE_KEY=pk_test_your_publishable_key_here
STRIPE_WEBHOOK_SECRET=whsec_test_webhook_secret
\`\`\`

## 3. Set up Stripe Test Helpers
Create \`test/helpers/stripe.ts\`:
\`\`\`typescript
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_TEST_SECRET_KEY!, {
  apiVersion: '2023-10-16'
});

export const TEST_CARDS = {
  VALID: '4242424242424242',
  DECLINED: '4000000000000002',
  INSUFFICIENT_FUNDS: '4000000000009995',
  EXPIRED: '4000000000000069',
  PROCESSING_ERROR: '4000000000000119'
};

export async function createTestCustomer(email = 'test@example.com') {
  return stripe.customers.create({
    email,
    name: 'Test Customer',
    description: 'Test customer for integration tests'
  });
}

export async function createTestPaymentMethod(cardNumber = TEST_CARDS.VALID) {
  return stripe.paymentMethods.create({
    type: 'card',
    card: {
      number: cardNumber,
      exp_month: 12,
      exp_year: 2025,
      cvc: '123'
    }
  });
}

export function createWebhookEvent(type: string, data: any) {
  return {
    id: 'evt_test_' + Math.random().toString(36),
    object: 'event',
    type,
    data: { object: data },
    created: Math.floor(Date.now() / 1000)
  };
}
\`\`\`

## 4. Add Webhook Testing
Create \`test/helpers/webhook.ts\`:
\`\`\`typescript
import { Request, Response } from 'express';

export function createMockWebhookRequest(payload: any, signature: string): Partial<Request> {
  return {
    body: payload,
    headers: {
      'stripe-signature': signature
    },
    rawBody: JSON.stringify(payload)
  };
}

export function createMockResponse(): Partial<Response> {
  const res: any = {};
  res.status = jest.fn().mockReturnValue(res);
  res.send = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}
\`\`\`

## 5. Safety Guidelines
- ALWAYS use test mode keys (sk_test_... / pk_test_...)
- Never use real payment methods in tests
- Use Stripe's test card numbers only
- Clean up test data after each test run
- Monitor Stripe test dashboard for test activity`;
  }

  /**
   * Generate data processing test setup instructions
   */
  private generateDataTestSetup(): string {
    return `# Data Processing Test Environment Setup

## 1. Install Test Data Dependencies
npm install --save-dev csv-parser csv-writer puppeteer jspdf

## 2. Create Test Data Directory Structure
\`\`\`
test/
├── fixtures/
│   ├── sample.csv
│   ├── large-dataset.csv
│   ├── malformed.csv
│   └── empty.csv
├── output/
└── helpers/
    ├── data-generators.ts
    └── file-helpers.ts
\`\`\`

## 3. Set up Test Data Generators
Create \`test/helpers/data-generators.ts\`:
\`\`\`typescript
import { writeFile } from 'fs/promises';
import { join } from 'path';

export async function generateCSV(filename: string, rows: number = 100) {
  const headers = 'id,name,email,age,department\\n';
  const data = Array.from({ length: rows }, (_, i) =>
    \`\${i + 1},User \${i + 1},user\${i + 1}@example.com,\${20 + (i % 40)},Department \${i % 5}\`
  ).join('\\n');

  const filePath = join(__dirname, '../fixtures', filename);
  await writeFile(filePath, headers + data);
  return filePath;
}

export async function generateMalformedCSV(filename: string) {
  const malformedData = \`id,name,email,age
1,"John Doe",john@example.com,25
2,Jane "Smith,jane@example.com,30
3,Bob,bob@example,invalid_age
4,,,\`;

  const filePath = join(__dirname, '../fixtures', filename);
  await writeFile(filePath, malformedData);
  return filePath;
}

export function generateLargeDataset(size: number = 10000) {
  return Array.from({ length: size }, (_, i) => ({
    id: i + 1,
    name: \`User \${i + 1}\`,
    email: \`user\${i + 1}@example.com\`,
    createdAt: new Date(Date.now() - Math.random() * 365 * 24 * 60 * 60 * 1000),
    isActive: Math.random() > 0.3
  }));
}
\`\`\`

## 4. Set up File Operation Helpers
Create \`test/helpers/file-helpers.ts\`:
\`\`\`typescript
import { unlink, access, mkdir, rmdir } from 'fs/promises';
import { join } from 'path';

export async function cleanupTestFiles(directory: string) {
  try {
    const files = await readdir(directory);
    await Promise.all(
      files.map(file => unlink(join(directory, file)))
    );
  } catch (error) {
    // Directory doesn't exist or is empty
  }
}

export async function ensureTestDirectories() {
  const dirs = ['fixtures', 'output', 'temp'];
  for (const dir of dirs) {
    const dirPath = join(__dirname, '..', dir);
    try {
      await access(dirPath);
    } catch {
      await mkdir(dirPath, { recursive: true });
    }
  }
}

export async function verifyFileExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}
\`\`\`

## 5. Performance Testing Utilities
Create \`test/helpers/performance.ts\`:
\`\`\`typescript
export class PerformanceTracker {
  private startTime: number;
  private endTime: number;

  start() {
    this.startTime = performance.now();
  }

  stop() {
    this.endTime = performance.now();
    return this.endTime - this.startTime;
  }

  getExecutionTime(): number {
    return this.endTime - this.startTime;
  }
}

export function expectExecutionTime(
  actualTime: number,
  maxExpectedTime: number,
  operation: string
) {
  if (actualTime > maxExpectedTime) {
    throw new Error(
      \`\${operation} took \${actualTime}ms, expected < \${maxExpectedTime}ms\`
    );
  }
}
\`\`\`

## 6. Test Configuration
Add to vitest.config.ts:
\`\`\`typescript
export default defineConfig({
  test: {
    globalSetup: './test/setup.ts',
    testTimeout: 30000, // Longer timeout for data processing
    hookTimeout: 10000
  }
});
\`\`\``;
  }

  /**
   * Generate integration test infrastructure setup
   */
  private generateIntegrationTestInfrastructure(): string {
    return `# Integration Test Infrastructure Setup

## 1. Test Database Configuration
Create \`test/helpers/database.ts\`:
\`\`\`typescript
import { DataSource } from 'typeorm'; // Adjust based on your ORM

let testConnection: DataSource;

export async function setupTestDatabase() {
  testConnection = new DataSource({
    type: 'postgresql', // Adjust based on your database
    host: process.env.TEST_DB_HOST || 'localhost',
    port: parseInt(process.env.TEST_DB_PORT || '5432'),
    username: process.env.TEST_DB_USER || 'test',
    password: process.env.TEST_DB_PASSWORD || 'test',
    database: process.env.TEST_DB_NAME || 'test_db',
    synchronize: true,
    dropSchema: true,
    entities: [/* your entities */],
    logging: false
  });

  await testConnection.initialize();
  return testConnection;
}

export async function teardownTestDatabase() {
  if (testConnection?.isInitialized) {
    await testConnection.destroy();
  }
}

export async function seedDatabase() {
  // Implement database seeding
}

export async function cleanDatabase() {
  // Clean all tables while preserving schema
  const entities = testConnection.entityMetadatas;

  for (const entity of entities) {
    const repository = testConnection.getRepository(entity.name);
    await repository.delete({});
  }
}
\`\`\`

## 2. Test Server Setup
Create \`test/helpers/server.ts\`:
\`\`\`typescript
import { Express } from 'express';
import { createApp } from '../../src/app'; // Adjust path

let testApp: Express;
let server: any;

export async function startTestServer(): Promise<Express> {
  testApp = await createApp();

  return new Promise((resolve) => {
    server = testApp.listen(0, () => {
      resolve(testApp);
    });
  });
}

export async function stopTestServer() {
  if (server) {
    return new Promise<void>((resolve) => {
      server.close(() => resolve());
    });
  }
}

export function getTestApp(): Express {
  return testApp;
}
\`\`\`

## 3. Global Test Setup
Create \`test/setup.ts\`:
\`\`\`typescript
import { beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { setupTestDatabase, teardownTestDatabase, cleanDatabase } from './helpers/database';
import { startTestServer, stopTestServer } from './helpers/server';

beforeAll(async () => {
  // Set up test environment
  await setupTestDatabase();
  await startTestServer();
});

afterAll(async () => {
  // Clean up test environment
  await stopTestServer();
  await teardownTestDatabase();
});

beforeEach(async () => {
  // Clean database before each test
  await cleanDatabase();
});

afterEach(async () => {
  // Any cleanup needed after each test
});
\`\`\`

## 4. Environment Configuration
Create \`.env.test\`:
\`\`\`
NODE_ENV=test
LOG_LEVEL=error
TEST_DB_HOST=localhost
TEST_DB_PORT=5432
TEST_DB_USER=test
TEST_DB_PASSWORD=test
TEST_DB_NAME=test_db
JWT_SECRET=test-jwt-secret
STRIPE_SECRET_KEY=sk_test_...
REDIS_URL=redis://localhost:6379/1
\`\`\`

## 5. Docker Test Environment (Optional)
Create \`docker-compose.test.yml\`:
\`\`\`yaml
version: '3.8'
services:
  test-db:
    image: postgres:15
    environment:
      POSTGRES_DB: test_db
      POSTGRES_USER: test
      POSTGRES_PASSWORD: test
    ports:
      - "5433:5432"
    tmpfs:
      - /var/lib/postgresql/data

  test-redis:
    image: redis:7-alpine
    ports:
      - "6380:6379"
    tmpfs:
      - /data
\`\`\`

## 6. Test Commands
Add to package.json:
\`\`\`json
{
  "scripts": {
    "test:integration": "vitest run --config vitest.integration.config.ts",
    "test:integration:watch": "vitest --config vitest.integration.config.ts",
    "test:integration:ui": "vitest --ui --config vitest.integration.config.ts",
    "test:db:setup": "docker-compose -f docker-compose.test.yml up -d",
    "test:db:teardown": "docker-compose -f docker-compose.test.yml down -v"
  }
}
\`\`\``;
  }
}
