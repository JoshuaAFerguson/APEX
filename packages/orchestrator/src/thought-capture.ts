import { promises as fs } from 'fs';
import { join } from 'path';
import { EventEmitter } from 'eventemitter3';
import { ThoughtCapture, CreateTaskRequest } from '@apexcli/core';
import { TaskStore } from './store';

export interface ThoughtCaptureManagerEvents {
  'thought:captured': (thought: ThoughtCapture) => void;
  'thought:implemented': (thought: ThoughtCapture, taskId: string) => void;
  'thought:discarded': (thought: ThoughtCapture) => void;
}

export interface ThoughtSearch {
  query: string;
  tags?: string[];
  priority?: ThoughtCapture['priority'];
  status?: ThoughtCapture['status'];
  fromDate?: Date;
  toDate?: Date;
}

export interface ThoughtStats {
  total: number;
  byStatus: Record<ThoughtCapture['status'], number>;
  byPriority: Record<ThoughtCapture['priority'], number>;
  byTag: Record<string, number>;
  implementationRate: number;
  avgTimeToImplementation: number; // milliseconds
}

/**
 * Manages quick thought capture and idea logging for development insights
 */
export class ThoughtCaptureManager extends EventEmitter<ThoughtCaptureManagerEvents> {
  private projectPath: string;
  private store: TaskStore;
  private thoughtsFile: string;
  private thoughts: Map<string, ThoughtCapture> = new Map();

  constructor(projectPath: string, store: TaskStore) {
    super();
    this.projectPath = projectPath;
    this.store = store;
    this.thoughtsFile = join(this.projectPath, '.apex', 'thoughts.json');
  }

  /**
   * Initialize the thought capture manager
   */
  async initialize(): Promise<void> {
    await this.loadThoughts();
  }

  /**
   * Capture a new thought or idea
   */
  async captureThought(
    content: string,
    options: {
      tags?: string[];
      priority?: ThoughtCapture['priority'];
      taskId?: string;
    } = {}
  ): Promise<ThoughtCapture> {
    const thought: ThoughtCapture = {
      id: `thought-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      content: content.trim(),
      tags: options.tags || [],
      priority: options.priority || 'medium',
      taskId: options.taskId,
      createdAt: new Date(),
      status: 'captured',
    };

    this.thoughts.set(thought.id, thought);
    await this.saveThoughts();

    this.emit('thought:captured', thought);
    return thought;
  }

  /**
   * Get a thought by ID
   */
  getThought(thoughtId: string): ThoughtCapture | null {
    return this.thoughts.get(thoughtId) || null;
  }

  /**
   * Search thoughts based on criteria
   */
  searchThoughts(criteria: ThoughtSearch): ThoughtCapture[] {
    const results: ThoughtCapture[] = [];

    for (const thought of this.thoughts.values()) {
      // Text search
      if (criteria.query) {
        const searchText = criteria.query.toLowerCase();
        const contentMatch = thought.content.toLowerCase().includes(searchText);
        const tagMatch = thought.tags?.some(tag => tag.toLowerCase().includes(searchText)) || false;

        if (!contentMatch && !tagMatch) {
          continue;
        }
      }

      // Tag filter
      if (criteria.tags && criteria.tags.length > 0) {
        const hasMatchingTag = criteria.tags.some(tag =>
          thought.tags?.includes(tag)
        );
        if (!hasMatchingTag) {
          continue;
        }
      }

      // Priority filter
      if (criteria.priority && thought.priority !== criteria.priority) {
        continue;
      }

      // Status filter
      if (criteria.status && thought.status !== criteria.status) {
        continue;
      }

      // Date range filter
      if (criteria.fromDate && thought.createdAt < criteria.fromDate) {
        continue;
      }

      if (criteria.toDate && thought.createdAt > criteria.toDate) {
        continue;
      }

      results.push(thought);
    }

    // Sort by priority (high -> low) then by creation date (newest first)
    return results.sort((a, b) => {
      const priorityOrder = { high: 3, medium: 2, low: 1 };
      const priorityDiff = priorityOrder[b.priority] - priorityOrder[a.priority];

      if (priorityDiff !== 0) {
        return priorityDiff;
      }

      return b.createdAt.getTime() - a.createdAt.getTime();
    });
  }

  /**
   * Get all thoughts
   */
  getAllThoughts(): ThoughtCapture[] {
    return Array.from(this.thoughts.values())
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  /**
   * Update a thought's status or other properties
   */
  async updateThought(
    thoughtId: string,
    updates: Partial<Pick<ThoughtCapture, 'status' | 'priority' | 'tags' | 'taskId'>>
  ): Promise<ThoughtCapture | null> {
    const thought = this.thoughts.get(thoughtId);
    if (!thought) {
      return null;
    }

    const updatedThought = { ...thought, ...updates };
    this.thoughts.set(thoughtId, updatedThought);
    await this.saveThoughts();

    return updatedThought;
  }

  /**
   * Convert a thought into a task for implementation
   */
  async implementThought(
    thoughtId: string,
    options: {
      workflow?: string;
      priority?: CreateTaskRequest['priority'];
      acceptanceCriteria?: string;
    } = {}
  ): Promise<string> {
    const thought = this.thoughts.get(thoughtId);
    if (!thought) {
      throw new Error(`Thought ${thoughtId} not found`);
    }

    if (thought.status === 'implemented') {
      throw new Error(`Thought ${thoughtId} has already been implemented`);
    }

    // Create task from thought
    const taskRequest: CreateTaskRequest = {
      description: thought.content,
      acceptanceCriteria: options.acceptanceCriteria || `Implement the idea: ${thought.content}`,
      workflow: options.workflow || 'feature',
      priority: options.priority || this.mapPriorityToTask(thought.priority),
      projectPath: this.projectPath,
    };

    const task = await this.store.createTask(taskRequest);

    // Update thought status
    thought.status = 'implemented';
    thought.implementedAt = new Date();
    thought.taskId = task.id;

    this.thoughts.set(thoughtId, thought);
    await this.saveThoughts();

    this.emit('thought:implemented', thought, task.id);
    return task.id;
  }

  /**
   * Mark a thought as planned (ready for implementation)
   */
  async planThought(thoughtId: string): Promise<ThoughtCapture | null> {
    return await this.updateThought(thoughtId, { status: 'planned' });
  }

  /**
   * Discard a thought
   */
  async discardThought(thoughtId: string): Promise<void> {
    const thought = this.thoughts.get(thoughtId);
    if (thought) {
      thought.status = 'discarded';
      this.thoughts.set(thoughtId, thought);
      await this.saveThoughts();

      this.emit('thought:discarded', thought);
    }
  }

  /**
   * Get thought statistics
   */
  getThoughtStats(): ThoughtStats {
    const thoughts = this.getAllThoughts();
    const total = thoughts.length;

    // Count by status
    const byStatus: Record<ThoughtCapture['status'], number> = {
      captured: 0,
      planned: 0,
      implemented: 0,
      discarded: 0,
    };

    // Count by priority
    const byPriority: Record<ThoughtCapture['priority'], number> = {
      low: 0,
      medium: 0,
      high: 0,
    };

    // Count by tag
    const byTag: Record<string, number> = {};

    // Calculate implementation metrics
    let implementedCount = 0;
    let totalImplementationTime = 0;

    for (const thought of thoughts) {
      byStatus[thought.status]++;
      byPriority[thought.priority]++;

      // Count tags
      for (const tag of thought.tags || []) {
        byTag[tag] = (byTag[tag] || 0) + 1;
      }

      // Calculate implementation time
      if (thought.status === 'implemented' && thought.implementedAt) {
        implementedCount++;
        totalImplementationTime += thought.implementedAt.getTime() - thought.createdAt.getTime();
      }
    }

    const implementationRate = total > 0 ? implementedCount / total : 0;
    const avgTimeToImplementation = implementedCount > 0 ? totalImplementationTime / implementedCount : 0;

    return {
      total,
      byStatus,
      byPriority,
      byTag,
      implementationRate,
      avgTimeToImplementation,
    };
  }

  /**
   * Get related thoughts for a task
   */
  getThoughtsForTask(taskId: string): ThoughtCapture[] {
    return this.getAllThoughts().filter(thought => thought.taskId === taskId);
  }

  /**
   * Get suggestions for quick actions based on captured thoughts
   */
  getActionableSuggestions(): {
    highPriorityThoughts: ThoughtCapture[];
    readyToImplement: ThoughtCapture[];
    needsPlanning: ThoughtCapture[];
    suggestions: string[];
  } {
    const thoughts = this.getAllThoughts();

    const highPriorityThoughts = thoughts.filter(
      t => t.priority === 'high' && t.status === 'captured'
    );

    const readyToImplement = thoughts.filter(
      t => t.status === 'planned'
    );

    const needsPlanning = thoughts.filter(
      t => t.status === 'captured' && t.priority !== 'low'
    ).slice(0, 5); // Limit to top 5

    const suggestions: string[] = [];

    if (highPriorityThoughts.length > 0) {
      suggestions.push(`${highPriorityThoughts.length} high-priority thoughts need attention`);
    }

    if (readyToImplement.length > 0) {
      suggestions.push(`${readyToImplement.length} thoughts are ready to implement`);
    }

    if (needsPlanning.length > 0) {
      suggestions.push(`${needsPlanning.length} thoughts could be planned`);
    }

    const stats = this.getThoughtStats();
    if (stats.implementationRate < 0.3 && stats.total > 10) {
      suggestions.push('Consider reviewing and implementing more captured thoughts');
    }

    return {
      highPriorityThoughts,
      readyToImplement,
      needsPlanning,
      suggestions,
    };
  }

  /**
   * Export thoughts to markdown format
   */
  async exportToMarkdown(outputPath?: string): Promise<string> {
    const stats = this.getThoughtStats();
    const thoughts = this.getAllThoughts();

    let markdown = '# Captured Thoughts\n\n';
    markdown += `## Statistics\n\n`;
    markdown += `- **Total Thoughts**: ${stats.total}\n`;
    markdown += `- **Implementation Rate**: ${(stats.implementationRate * 100).toFixed(1)}%\n`;
    markdown += `- **By Status**: `;
    markdown += Object.entries(stats.byStatus)
      .map(([status, count]) => `${status}: ${count}`)
      .join(', ') + '\n\n';

    // Group thoughts by status
    const grouped = thoughts.reduce((acc, thought) => {
      if (!acc[thought.status]) acc[thought.status] = [];
      acc[thought.status].push(thought);
      return acc;
    }, {} as Record<ThoughtCapture['status'], ThoughtCapture[]>);

    for (const [status, statusThoughts] of Object.entries(grouped)) {
      if (statusThoughts.length === 0) continue;

      markdown += `## ${status.charAt(0).toUpperCase() + status.slice(1)} (${statusThoughts.length})\n\n`;

      for (const thought of statusThoughts) {
        markdown += `### ${thought.content}\n\n`;
        markdown += `- **Priority**: ${thought.priority}\n`;
        markdown += `- **Created**: ${thought.createdAt.toISOString()}\n`;

        if (thought.tags && thought.tags.length > 0) {
          markdown += `- **Tags**: ${thought.tags.map(tag => `\`${tag}\``).join(', ')}\n`;
        }

        if (thought.implementedAt) {
          markdown += `- **Implemented**: ${thought.implementedAt.toISOString()}\n`;
        }

        if (thought.taskId) {
          markdown += `- **Task**: ${thought.taskId}\n`;
        }

        markdown += '\n---\n\n';
      }
    }

    if (outputPath) {
      await fs.writeFile(outputPath, markdown, 'utf-8');
    }

    return markdown;
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  private async loadThoughts(): Promise<void> {
    try {
      const content = await fs.readFile(this.thoughtsFile, 'utf-8');
      const thoughtsArray = JSON.parse(content) as ThoughtCapture[];

      this.thoughts.clear();
      for (const thought of thoughtsArray) {
        // Convert date strings back to Date objects
        thought.createdAt = new Date(thought.createdAt);
        if (thought.implementedAt) {
          thought.implementedAt = new Date(thought.implementedAt);
        }

        this.thoughts.set(thought.id, thought);
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        console.warn('Failed to load thoughts:', error);
      }
      // File doesn't exist or is invalid, start with empty thoughts
    }
  }

  private async saveThoughts(): Promise<void> {
    try {
      // Ensure directory exists
      const thoughtsDir = join(this.projectPath, '.apex');
      await fs.mkdir(thoughtsDir, { recursive: true });

      const thoughtsArray = Array.from(this.thoughts.values());
      await fs.writeFile(this.thoughtsFile, JSON.stringify(thoughtsArray, null, 2), 'utf-8');
    } catch (error) {
      console.warn('Failed to save thoughts:', error);
    }
  }

  private mapPriorityToTask(thoughtPriority: ThoughtCapture['priority']): CreateTaskRequest['priority'] {
    switch (thoughtPriority) {
      case 'high':
        return 'high';
      case 'medium':
        return 'normal';
      case 'low':
        return 'low';
      default:
        return 'normal';
    }
  }
}