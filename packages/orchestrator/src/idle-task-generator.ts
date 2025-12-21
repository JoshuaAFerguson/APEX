/**
 * IdleTaskGenerator - Weighted Strategy Selection for Idle Task Generation
 *
 * This class implements weighted random selection of task types and delegates
 * task generation to specialized strategy analyzers. It is designed to work
 * with the IdleProcessor to generate improvement tasks during idle periods.
 *
 * Key features:
 * - Configurable strategy weights (maintenance, refactoring, docs, tests)
 * - Modular analyzer architecture for each strategy type
 * - Deduplication of generated tasks across generation cycles
 * - Fallback behavior when all weights are zero
 *
 * @see ADR-004: IdleTaskGenerator with Weighted Strategy Selection
 */

import { StrategyWeights, IdleTaskType, generateTaskId } from '@apex/core';
import type { IdleTask, ProjectAnalysis } from './idle-processor';
import {
  StrategyAnalyzer,
  TaskCandidate,
  MaintenanceAnalyzer,
  RefactoringAnalyzer,
  DocsAnalyzer,
  TestsAnalyzer,
} from './analyzers';

/**
 * Default strategy weights when none are provided.
 * Each strategy gets equal weight (0.25 each, totaling 1.0).
 */
const DEFAULT_WEIGHTS: StrategyWeights = {
  maintenance: 0.25,
  refactoring: 0.25,
  docs: 0.25,
  tests: 0.25,
};

/**
 * All available idle task types in selection order.
 */
const TASK_TYPES: IdleTaskType[] = ['maintenance', 'refactoring', 'docs', 'tests'];

/**
 * IdleTaskGenerator implements weighted random selection of task types
 * and delegates task generation to specialized strategy analyzers.
 */
export class IdleTaskGenerator {
  private readonly weights: StrategyWeights;
  private readonly analyzers: Map<IdleTaskType, StrategyAnalyzer>;
  private readonly usedCandidates: Set<string>;

  /**
   * Create a new IdleTaskGenerator.
   *
   * @param weights - Strategy weights configuration. If not provided, uses equal weights.
   * @param analyzers - Optional custom analyzers for testing. Uses default analyzers if not provided.
   */
  constructor(
    weights?: StrategyWeights,
    analyzers?: Map<IdleTaskType, StrategyAnalyzer>
  ) {
    this.weights = { ...DEFAULT_WEIGHTS, ...weights };
    this.usedCandidates = new Set();

    // Initialize analyzers (use provided or create defaults)
    if (analyzers) {
      this.analyzers = analyzers;
    } else {
      this.analyzers = new Map<IdleTaskType, StrategyAnalyzer>([
        ['maintenance', new MaintenanceAnalyzer()],
        ['refactoring', new RefactoringAnalyzer()],
        ['docs', new DocsAnalyzer()],
        ['tests', new TestsAnalyzer()],
      ]);
    }
  }

  /**
   * Select a task type using weighted random selection.
   *
   * The algorithm uses cumulative probability distribution:
   * 1. Calculate total weight sum
   * 2. Generate random number in [0, total)
   * 3. Find the first type where cumulative weight exceeds random
   *
   * If all weights are zero, falls back to uniform random selection.
   *
   * @returns The selected task type
   */
  selectTaskType(): IdleTaskType {
    const total = TASK_TYPES.reduce((sum, type) => sum + (this.weights[type] ?? 0), 0);

    // Fallback to uniform distribution if all weights are zero
    if (total === 0) {
      return TASK_TYPES[Math.floor(Math.random() * TASK_TYPES.length)];
    }

    const random = Math.random() * total;
    let cumulative = 0;

    for (const type of TASK_TYPES) {
      cumulative += this.weights[type] ?? 0;
      if (random < cumulative) {
        return type;
      }
    }

    // Fallback for floating point edge cases
    return TASK_TYPES[TASK_TYPES.length - 1];
  }

  /**
   * Generate an idle task based on the project analysis.
   *
   * The process:
   * 1. Select a task type using weighted random selection
   * 2. Get the analyzer for that type
   * 3. Have the analyzer generate and prioritize candidates
   * 4. Convert the best candidate to an IdleTask
   * 5. Track used candidates to avoid duplicates
   *
   * If the selected type has no valid candidates, tries other types.
   *
   * @param analysis - Project analysis data
   * @returns An IdleTask, or null if no valid tasks can be generated
   */
  generateTask(analysis: ProjectAnalysis): IdleTask | null {
    // Try each type starting with the weighted selection
    const attemptOrder = this.getAttemptOrder();

    for (const type of attemptOrder) {
      const task = this.tryGenerateForType(type, analysis);
      if (task) {
        return task;
      }
    }

    return null;
  }

  /**
   * Reset the generator state for a new generation cycle.
   * This clears the used candidates set to allow previously generated tasks
   * to be generated again in a new cycle.
   */
  reset(): void {
    this.usedCandidates.clear();
  }

  /**
   * Get the current weights configuration.
   * Useful for debugging and testing.
   */
  getWeights(): Readonly<StrategyWeights> {
    return { ...this.weights };
  }

  /**
   * Get the set of used candidate IDs.
   * Useful for debugging and testing.
   */
  getUsedCandidates(): ReadonlySet<string> {
    return this.usedCandidates;
  }

  /**
   * Get the order of types to attempt, starting with the weighted selection
   * and followed by remaining types in their natural order.
   */
  private getAttemptOrder(): IdleTaskType[] {
    const selectedType = this.selectTaskType();
    const remainingTypes = TASK_TYPES.filter((t) => t !== selectedType);
    return [selectedType, ...remainingTypes];
  }

  /**
   * Try to generate a task for a specific type.
   *
   * @param type - The task type to generate for
   * @param analysis - Project analysis data
   * @returns An IdleTask, or null if no valid candidates
   */
  private tryGenerateForType(type: IdleTaskType, analysis: ProjectAnalysis): IdleTask | null {
    const analyzer = this.analyzers.get(type);
    if (!analyzer) {
      return null;
    }

    // Get candidates from the analyzer
    const candidates = analyzer.analyze(analysis);

    // Filter out already used candidates
    const availableCandidates = candidates.filter(
      (c) => !this.usedCandidates.has(c.candidateId)
    );

    if (availableCandidates.length === 0) {
      return null;
    }

    // Let the analyzer prioritize
    const bestCandidate = analyzer.prioritize(availableCandidates);
    if (!bestCandidate) {
      return null;
    }

    // Mark as used
    this.usedCandidates.add(bestCandidate.candidateId);

    // Convert to IdleTask
    return this.candidateToIdleTask(type, bestCandidate);
  }

  /**
   * Convert a TaskCandidate to an IdleTask.
   */
  private candidateToIdleTask(type: IdleTaskType, candidate: TaskCandidate): IdleTask {
    return {
      id: `idle-${generateTaskId()}-${type}`,
      type: this.mapTypeToIdleTaskType(type),
      title: candidate.title,
      description: candidate.description,
      priority: candidate.priority,
      estimatedEffort: candidate.estimatedEffort,
      suggestedWorkflow: candidate.suggestedWorkflow,
      rationale: candidate.rationale,
      createdAt: new Date(),
      implemented: false,
    };
  }

  /**
   * Map IdleTaskType to the IdleTask.type field.
   * Note: IdleTask.type uses slightly different values than IdleTaskType.
   */
  private mapTypeToIdleTaskType(
    type: IdleTaskType
  ): 'improvement' | 'maintenance' | 'optimization' | 'documentation' {
    switch (type) {
      case 'maintenance':
        return 'maintenance';
      case 'refactoring':
        return 'optimization'; // refactoring maps to optimization
      case 'docs':
        return 'documentation';
      case 'tests':
        return 'improvement'; // tests maps to improvement
      default:
        return 'improvement';
    }
  }
}

// Re-export types for convenience
export type { TaskCandidate, StrategyAnalyzer };
export {
  MaintenanceAnalyzer,
  RefactoringAnalyzer,
  DocsAnalyzer,
  TestsAnalyzer,
} from './analyzers';
