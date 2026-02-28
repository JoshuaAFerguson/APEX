import type { ProjectContext } from '@apexcli/core';
import type { MemoryManager } from './memory-manager.js';

/**
 * Token budget allocation for different context sections
 */
export interface ContextBudget {
  projectContext: number;
  codebaseIntelligence: number;
  memory: number;
  taskHistory: number;
  livingMemory: number;
}

/**
 * Unified context package for prompt injection
 */
export interface UnifiedContext {
  projectContext?: string;
  enrichedContext?: string;
  memoryContext?: string;
  taskHistoryContext?: string;
  livingMemory?: string;
  budget: ContextBudget;
  visualization: ContextVisualization;
}

/**
 * Visualization data showing context allocation
 */
export interface ContextVisualization {
  totalTokenBudget: number;
  sections: Array<{
    name: string;
    allocatedTokens: number;
    usedTokens: number;
    itemCount: number;
    percentUsed: number;
  }>;
  totalUsedTokens: number;
  percentTotal: number;
}

/**
 * Interface for learning extractor dependency (Batch 4).
 * Defined here to avoid hard dependency on the learning-extractor module
 * which may not exist yet.
 */
export interface LearningExtractorLike {
  buildTaskHistoryContext(taskDescription: string, maxTokens: number): string | undefined;
}

/**
 * SmartContextManager orchestrates all context sources (project analysis,
 * codebase intelligence, memory, learning) into a unified context package
 * that fits within token budgets.
 *
 * Token budget allocation (percentage of maxTokensPerTask * contextBudgetPercent):
 * - Project context: ~20%
 * - Codebase intelligence: ~40%
 * - Memory: ~20%
 * - Task history: ~12%
 * - Living memory: ~8%
 */
export class SmartContextManager {
  private maxTokens: number;

  constructor(private options: {
    maxTokensPerTask: number;
    contextBudgetPercent?: number; // Default 25%
  }) {
    const budgetPercent = options.contextBudgetPercent || 0.25;
    this.maxTokens = Math.floor(options.maxTokensPerTask * budgetPercent);
  }

  /**
   * Calculate token budget allocation
   */
  private calculateBudget(): ContextBudget {
    return {
      projectContext: Math.floor(this.maxTokens * 0.20),
      codebaseIntelligence: Math.floor(this.maxTokens * 0.40),
      memory: Math.floor(this.maxTokens * 0.20),
      taskHistory: Math.floor(this.maxTokens * 0.12),
      livingMemory: Math.floor(this.maxTokens * 0.08),
    };
  }

  /**
   * Estimate token count from text (rough: 1 token ~ 4 chars)
   */
  private estimateTokens(text: string): number {
    return Math.ceil(text.length / 4);
  }

  /**
   * Truncate text to fit within a token budget
   */
  private truncateToFit(text: string, maxTokens: number): string {
    const maxChars = maxTokens * 4;
    if (text.length <= maxChars) return text;
    return text.substring(0, maxChars - 20) + '\n...truncated';
  }

  /**
   * Build unified context from all available sources.
   *
   * Assembles context from project analysis, codebase intelligence, memory,
   * task history, and living memory into a single package with token budget
   * management and visualization data.
   *
   * @param options - Context sources and task description
   * @returns Unified context package with budget tracking and visualization
   */
  buildContext(options: {
    taskDescription: string;
    projectContext?: ProjectContext;
    enrichedContext?: string;
    memoryManager?: MemoryManager;
    learningExtractor?: LearningExtractorLike;
  }): UnifiedContext {
    const budget = this.calculateBudget();
    const visualization: ContextVisualization = {
      totalTokenBudget: this.maxTokens,
      sections: [],
      totalUsedTokens: 0,
      percentTotal: 0,
    };

    // 1. Project Context
    let projectContextStr: string | undefined;
    if (options.projectContext) {
      projectContextStr = this.buildProjectContextString(options.projectContext);
      projectContextStr = this.truncateToFit(projectContextStr, budget.projectContext);
      const tokens = this.estimateTokens(projectContextStr);
      visualization.sections.push({
        name: 'Project Context',
        allocatedTokens: budget.projectContext,
        usedTokens: tokens,
        itemCount: 1,
        percentUsed: budget.projectContext > 0
          ? Math.round((tokens / budget.projectContext) * 100)
          : 0,
      });
      visualization.totalUsedTokens += tokens;
    }

    // 2. Codebase Intelligence
    let enrichedContextStr: string | undefined;
    if (options.enrichedContext) {
      enrichedContextStr = this.truncateToFit(options.enrichedContext, budget.codebaseIntelligence);
      const tokens = this.estimateTokens(enrichedContextStr);
      visualization.sections.push({
        name: 'Codebase Intelligence',
        allocatedTokens: budget.codebaseIntelligence,
        usedTokens: tokens,
        itemCount: 1,
        percentUsed: budget.codebaseIntelligence > 0
          ? Math.round((tokens / budget.codebaseIntelligence) * 100)
          : 0,
      });
      visualization.totalUsedTokens += tokens;
    }

    // 3. Memory
    let memoryContextStr: string | undefined;
    if (options.memoryManager) {
      const rawMemory = options.memoryManager.buildMemoryContext(
        options.taskDescription,
        budget.memory
      );
      if (rawMemory) {
        memoryContextStr = this.truncateToFit(rawMemory, budget.memory);
        const tokens = this.estimateTokens(memoryContextStr);
        visualization.sections.push({
          name: 'Memory',
          allocatedTokens: budget.memory,
          usedTokens: tokens,
          itemCount: Math.max(memoryContextStr.split('\n- ').length - 1, 0),
          percentUsed: budget.memory > 0
            ? Math.round((tokens / budget.memory) * 100)
            : 0,
        });
        visualization.totalUsedTokens += tokens;
      }
    }

    // 4. Task History (from LearningExtractor, Batch 4)
    let taskHistoryContextStr: string | undefined;
    if (options.learningExtractor) {
      const rawHistory = options.learningExtractor.buildTaskHistoryContext(
        options.taskDescription,
        budget.taskHistory
      );
      if (rawHistory) {
        taskHistoryContextStr = this.truncateToFit(rawHistory, budget.taskHistory);
        const tokens = this.estimateTokens(taskHistoryContextStr);
        visualization.sections.push({
          name: 'Task History',
          allocatedTokens: budget.taskHistory,
          usedTokens: tokens,
          itemCount: Math.max(taskHistoryContextStr.split('\n- ').length - 1, 0),
          percentUsed: budget.taskHistory > 0
            ? Math.round((tokens / budget.taskHistory) * 100)
            : 0,
        });
        visualization.totalUsedTokens += tokens;
      }
    }

    // 5. Living Memory
    let livingMemoryStr: string | undefined;
    if (options.memoryManager) {
      const rawLiving = options.memoryManager.getLivingMemoryContent();
      if (rawLiving) {
        livingMemoryStr = this.truncateToFit(rawLiving, budget.livingMemory);
        const tokens = this.estimateTokens(livingMemoryStr);
        visualization.sections.push({
          name: 'Living Memory',
          allocatedTokens: budget.livingMemory,
          usedTokens: tokens,
          itemCount: 1,
          percentUsed: budget.livingMemory > 0
            ? Math.round((tokens / budget.livingMemory) * 100)
            : 0,
        });
        visualization.totalUsedTokens += tokens;
      }
    }

    visualization.percentTotal = this.maxTokens > 0
      ? Math.round((visualization.totalUsedTokens / this.maxTokens) * 100)
      : 0;

    return {
      projectContext: projectContextStr,
      enrichedContext: enrichedContextStr,
      memoryContext: memoryContextStr,
      taskHistoryContext: taskHistoryContextStr,
      livingMemory: livingMemoryStr,
      budget,
      visualization,
    };
  }

  /**
   * Get a human-readable context visualization string.
   *
   * Renders a text-based visualization of token budget usage across
   * all context sections with progress bars and statistics.
   *
   * @param viz - Visualization data from buildContext result
   * @returns Formatted multi-line string showing context allocation
   */
  getContextVisualization(viz: ContextVisualization): string {
    const lines: string[] = [
      `Context Budget: ${viz.totalUsedTokens}/${viz.totalTokenBudget} tokens (${viz.percentTotal}% used)`,
      '',
    ];

    for (const section of viz.sections) {
      const bar = this.renderProgressBar(section.percentUsed, 20);
      lines.push(`  ${section.name.padEnd(22)} ${bar} ${section.usedTokens}/${section.allocatedTokens} tokens (${section.itemCount} items)`);
    }

    return lines.join('\n');
  }

  /**
   * Render a simple text progress bar
   */
  private renderProgressBar(percent: number, width: number): string {
    const clamped = Math.min(Math.max(percent, 0), 100);
    const filled = Math.round((clamped / 100) * width);
    const empty = width - filled;
    return `[${'#'.repeat(filled)}${'.'.repeat(empty)}]`;
  }

  /**
   * Build a compact project context string from ProjectContext data
   */
  private buildProjectContextString(ctx: ProjectContext): string {
    const parts: string[] = [];

    if (ctx.gitStatus) {
      const git = ctx.gitStatus;
      if (git.branch) parts.push(`Branch: ${git.branch}`);
      if (git.isDirty) parts.push(`Uncommitted changes: ${(git.staged?.length || 0) + (git.unstaged?.length || 0)} files`);
    }

    if (ctx.frameworks && ctx.frameworks.length > 0) {
      parts.push(`Frameworks: ${ctx.frameworks.map(f => f.name || 'unknown').join(', ')}`);
    }

    if (ctx.testFrameworks && ctx.testFrameworks.length > 0) {
      parts.push(`Testing: ${ctx.testFrameworks.map(t => t.name || 'unknown').join(', ')}`);
    }

    if (ctx.structure?.isMonorepo) {
      parts.push(`Monorepo: ${ctx.structure.workspaces?.length || 0} workspaces`);
    }

    return parts.join('\n');
  }
}
