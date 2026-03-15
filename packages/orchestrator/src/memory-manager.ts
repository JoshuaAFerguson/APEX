import { MemoryStore, Memory, MemoryType, MemorySearchCriteria, LivingMemoryFile } from './memory-store.js';
import type Database from 'better-sqlite3';

/**
 * Options for storing a memory
 */
export interface RememberOptions {
  type?: MemoryType;
  tags?: string[];
  source?: string;
  sourceTaskId?: string;
  sourceAgent?: string;
  confidence?: number;
  expiresInDays?: number;
}

/**
 * Options for recalling memories
 */
export interface RecallOptions {
  types?: MemoryType[];
  tags?: string[];
  limit?: number;
  minConfidence?: number;
}

/**
 * Higher-level memory management service wrapping MemoryStore.
 * Provides convenient methods for remembering, recalling, and managing
 * long-term knowledge across tasks.
 */
export class MemoryManager {
  private store: MemoryStore;

  constructor(db: Database.Database) {
    this.store = new MemoryStore(db);
  }

  /**
   * Initialize the memory system (creates tables)
   */
  initialize(): void {
    this.store.initialize();
  }

  /**
   * Store a new piece of knowledge
   */
  remember(content: string, options: RememberOptions = {}): Memory {
    return this.store.storeMemory({
      type: options.type || 'fact',
      content,
      tags: options.tags || [],
      source: options.source || 'user',
      sourceTaskId: options.sourceTaskId,
      sourceAgent: options.sourceAgent,
      confidence: options.confidence ?? 1.0,
      expiresAt: options.expiresInDays
        ? new Date(Date.now() + options.expiresInDays * 24 * 60 * 60 * 1000)
        : undefined,
    });
  }

  /**
   * Search for relevant memories
   */
  recall(query: string, options: RecallOptions = {}): Memory[] {
    const memories = this.store.searchMemories({
      query,
      types: options.types,
      tags: options.tags,
      limit: options.limit || 10,
      minConfidence: options.minConfidence || 0.3,
    });

    // Touch accessed memories to track usage
    for (const memory of memories) {
      this.store.touchMemory(memory.id);
    }

    return memories;
  }

  /**
   * Extract insights from a completed task and store them as memories
   */
  extractInsightsFromTask(taskId: string, _taskDescription: string, stageResults: Map<string, { summary?: string; output?: string }>): Memory[] {
    const memories: Memory[] = [];

    // Extract patterns from stage results
    for (const [stageName, result] of stageResults) {
      if (result.summary) {
        // Store key insights from each stage
        const insight = this.store.storeMemory({
          type: 'insight',
          content: `From ${stageName}: ${result.summary}`,
          tags: [stageName, 'task-insight'],
          source: 'task-completion',
          sourceTaskId: taskId,
          confidence: 0.8,
        });
        memories.push(insight);
      }
    }

    return memories;
  }

  /**
   * Build memory context string for injecting into prompts
   */
  buildMemoryContext(taskDescription: string, maxTokens: number = 2000): string {
    const memories = this.store.getRelevantMemories(taskDescription);
    if (memories.length === 0) return '';

    const sections: string[] = [];
    let currentLength = 0;
    const estimatedCharsPerToken = 4;
    const maxChars = maxTokens * estimatedCharsPerToken;

    // Group by type
    const grouped = new Map<MemoryType, Memory[]>();
    for (const memory of memories) {
      const group = grouped.get(memory.type) || [];
      group.push(memory);
      grouped.set(memory.type, group);
    }

    const typeLabels: Record<MemoryType, string> = {
      convention: 'Project Conventions',
      pattern: 'Known Patterns',
      preference: 'User Preferences',
      fact: 'Project Facts',
      insight: 'Previous Insights',
    };

    for (const [type, mems] of grouped) {
      const label = typeLabels[type] || type;
      let section = `### ${label}\n`;

      for (const mem of mems) {
        const line = `- ${mem.content}\n`;
        if (currentLength + section.length + line.length > maxChars) break;
        section += line;
        currentLength += line.length;
      }

      sections.push(section);
      if (currentLength > maxChars) break;
    }

    return sections.join('\n');
  }

  /**
   * Get living memory content for prompt injection
   */
  getLivingMemoryContent(): string {
    const files = this.store.getAllLivingMemories();
    if (files.length === 0) return '';

    return files
      .map(f => `### ${f.name}\n${f.content}`)
      .join('\n\n');
  }

  /**
   * Update a living memory file
   */
  updateLivingMemory(name: string, content: string, category: string = 'general', updatedBy?: string): LivingMemoryFile {
    return this.store.upsertLivingMemory({ name, content, category, lastUpdatedBy: updatedBy });
  }

  /**
   * Forget memories by criteria
   */
  forget(criteria: { source?: string; tags?: string[]; type?: MemoryType }): number {
    return this.store.forgetMemories(criteria);
  }

  /**
   * Delete a specific memory by ID
   */
  deleteMemory(id: string): boolean {
    return this.store.deleteMemory(id);
  }

  /**
   * Get all memories for listing
   */
  listMemories(limit: number = 50): Memory[] {
    return this.store.getAllMemories(limit);
  }

  /**
   * Get memory count
   */
  getMemoryCount(): number {
    return this.store.getMemoryCount();
  }

  /**
   * Prune expired memories
   */
  pruneExpired(): number {
    return this.store.pruneExpiredMemories();
  }
}

export type { Memory, MemoryType, MemorySearchCriteria, LivingMemoryFile };
