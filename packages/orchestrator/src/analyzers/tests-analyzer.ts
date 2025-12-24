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

    // Group by severity
    const bySeverity = this.groupAntiPatternsBySeverity(antiPatterns);

    // High severity anti-patterns get individual tasks
    if (bySeverity.high.length > 0) {
      for (const pattern of bySeverity.high) {
        candidates.push(this.createAntiPatternTask(pattern, 'high', 0.8));
      }
    }

    // Medium severity anti-patterns
    if (bySeverity.medium.length > 0) {
      candidates.push(this.createGroupedAntiPatternTask(bySeverity.medium, 'normal', 0.6));
    }

    // Low severity anti-patterns
    if (bySeverity.low.length > 0) {
      candidates.push(this.createGroupedAntiPatternTask(bySeverity.low, 'low', 0.4));
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

    suggestions.push({
      type: 'testing',
      description: `Create integration test for ${test.criticalPath}`,
      priority: test.priority === 'critical' ? 'urgent' : 'high',
      expectedOutcome: test.description,
    });

    if (test.relatedFiles && test.relatedFiles.length > 0) {
      suggestions.push({
        type: 'manual_review',
        description: `Review interaction between related files: ${test.relatedFiles.slice(0, 3).join(', ')}`,
        priority: 'medium',
        expectedOutcome: 'Understanding of component interactions for comprehensive test design',
      });
    }

    suggestions.push({
      type: 'testing',
      description: 'Set up test environment and data for integration testing',
      priority: 'medium',
      expectedOutcome: 'Proper test fixtures and environment setup for reliable integration tests',
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
        priority: criticalCount > 0 ? 'urgent' : 'high',
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
      case 'slow-test':
        suggestions.push({
          type: 'testing',
          description: 'Optimize test performance by reducing setup time or mocking dependencies',
          priority: 'medium',
          expectedOutcome: 'Test execution time reduced to acceptable levels',
        });
        break;
      case 'flaky-test':
        suggestions.push({
          type: 'testing',
          description: 'Identify and fix sources of test non-determinism',
          priority: 'high',
          expectedOutcome: 'Test runs consistently across multiple executions',
          warning: 'Flaky tests undermine confidence in the test suite',
        });
        break;
      case 'test-code-duplication':
        suggestions.push({
          type: 'manual_review',
          description: 'Extract common test logic into reusable helper functions',
          priority: 'medium',
          expectedOutcome: 'Reduced test code duplication and improved maintainability',
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
   * Build remediation suggestions for critical coverage
   */
  private buildCriticalCoverageRemediation(currentPercentage: number): RemediationSuggestion[] {
    return [
      {
        type: 'testing',
        description: 'Add tests for critical code paths and core functionality',
        priority: 'urgent',
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
}
