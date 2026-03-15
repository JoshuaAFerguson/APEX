import { MemoryManager, type Memory, type MemoryType } from './memory-manager.js';

/**
 * Patterns that can be extracted from completed task results
 */
export interface ExtractedLearning {
  type: MemoryType;
  content: string;
  tags: string[];
  confidence: number;
}

/**
 * Extracts learnings from completed tasks and injects relevant
 * knowledge into future task prompts. Works with the MemoryManager
 * to persist and retrieve cross-task knowledge.
 */
export class LearningExtractor {
  constructor(private memoryManager: MemoryManager) {}

  /**
   * Extract learnings from a completed task and store them in memory.
   * Analyzes stage results to identify patterns, conventions, and insights.
   */
  extractFromTask(
    taskId: string,
    taskDescription: string,
    stageResults: Map<string, { summary?: string; output?: string; status?: string; filesModified?: string[] }>
  ): Memory[] {
    const memories: Memory[] = [];

    // Extract patterns from each stage result
    for (const [stageName, result] of stageResults) {
      if (!result.summary && !result.output) continue;

      const content = result.summary || result.output || '';

      // Extract conventions (coding patterns, naming, file structure)
      const conventions = this.extractConventions(content, stageName);
      for (const convention of conventions) {
        const mem = this.memoryManager.remember(convention.content, {
          type: 'convention',
          tags: [...convention.tags, stageName, 'auto-extracted'],
          source: 'task-learning',
          sourceTaskId: taskId,
          confidence: convention.confidence,
        });
        memories.push(mem);
      }

      // Extract patterns (recurring approaches, architectures)
      const patterns = this.extractPatterns(content, taskDescription, stageName);
      for (const pattern of patterns) {
        const mem = this.memoryManager.remember(pattern.content, {
          type: 'pattern',
          tags: [...pattern.tags, stageName, 'auto-extracted'],
          source: 'task-learning',
          sourceTaskId: taskId,
          confidence: pattern.confidence,
        });
        memories.push(mem);
      }

      // Extract insights (lessons learned, what worked)
      const insights = this.extractInsights(content, result.status || 'completed', stageName);
      for (const insight of insights) {
        const mem = this.memoryManager.remember(insight.content, {
          type: 'insight',
          tags: [...insight.tags, stageName, 'auto-extracted'],
          source: 'task-learning',
          sourceTaskId: taskId,
          confidence: insight.confidence,
        });
        memories.push(mem);
      }

      // Track files modified for project knowledge
      if (result.filesModified && result.filesModified.length > 0) {
        const filePatterns = this.analyzeFilePatterns(result.filesModified);
        if (filePatterns) {
          const mem = this.memoryManager.remember(filePatterns.content, {
            type: 'fact',
            tags: ['file-patterns', stageName, 'auto-extracted'],
            source: 'task-learning',
            sourceTaskId: taskId,
            confidence: 0.7,
          });
          memories.push(mem);
        }
      }
    }

    return memories;
  }

  /**
   * Build task history context for injection into prompts.
   * Retrieves relevant past learnings based on the current task description.
   */
  buildTaskHistoryContext(taskDescription: string, maxTokens: number = 1500): string {
    const memories = this.memoryManager.recall(taskDescription, {
      types: ['convention', 'pattern', 'insight'],
      limit: 15,
    });

    if (memories.length === 0) return '';

    const sections: string[] = [];
    let charCount = 0;
    const maxChars = maxTokens * 4;

    // Group by type
    const conventions = memories.filter(m => m.type === 'convention');
    const patterns = memories.filter(m => m.type === 'pattern');
    const insights = memories.filter(m => m.type === 'insight');

    if (conventions.length > 0) {
      let section = '### Learned Conventions\n';
      for (const mem of conventions) {
        const line = `- ${mem.content}\n`;
        if (charCount + line.length > maxChars) break;
        section += line;
        charCount += line.length;
      }
      sections.push(section);
    }

    if (patterns.length > 0) {
      let section = '### Known Patterns\n';
      for (const mem of patterns) {
        const line = `- ${mem.content}\n`;
        if (charCount + line.length > maxChars) break;
        section += line;
        charCount += line.length;
      }
      sections.push(section);
    }

    if (insights.length > 0) {
      let section = '### Previous Task Insights\n';
      for (const mem of insights) {
        const line = `- ${mem.content}\n`;
        if (charCount + line.length > maxChars) break;
        section += line;
        charCount += line.length;
      }
      sections.push(section);
    }

    return sections.join('\n');
  }

  /**
   * Extract coding conventions from stage output
   */
  private extractConventions(content: string, stageName: string): ExtractedLearning[] {
    const learnings: ExtractedLearning[] = [];
    const contentLower = content.toLowerCase();

    // Look for convention-indicating phrases
    const conventionPatterns = [
      { regex: /(?:use|using|follow|following)\s+(\w+(?:\s+\w+){0,3})\s+(?:convention|pattern|style|approach)/gi, confidence: 0.8 },
      { regex: /(?:project|codebase)\s+(?:uses|follows|prefers)\s+(.+?)(?:\.|,|$)/gim, confidence: 0.7 },
      { regex: /(?:naming convention|file naming|directory structure)[:\s]+(.+?)(?:\.|$)/gim, confidence: 0.75 },
    ];

    for (const { regex, confidence } of conventionPatterns) {
      const matches = content.matchAll(regex);
      for (const match of matches) {
        if (match[1] && match[1].length > 10 && match[1].length < 200) {
          learnings.push({
            type: 'convention',
            content: match[1].trim(),
            tags: ['convention', stageName],
            confidence,
          });
        }
      }
    }

    // Detect testing patterns
    if (contentLower.includes('test') && (contentLower.includes('vitest') || contentLower.includes('jest') || contentLower.includes('mocha'))) {
      const testFramework = contentLower.includes('vitest') ? 'vitest' : contentLower.includes('jest') ? 'jest' : 'mocha';
      learnings.push({
        type: 'convention',
        content: `Project uses ${testFramework} for testing`,
        tags: ['testing', testFramework],
        confidence: 0.9,
      });
    }

    return learnings;
  }

  /**
   * Extract implementation patterns from stage output
   */
  private extractPatterns(content: string, _taskDescription: string, stageName: string): ExtractedLearning[] {
    const learnings: ExtractedLearning[] = [];

    // Look for pattern-indicating phrases
    const patternIndicators = [
      { regex: /(?:implemented|created|built|added)\s+(?:a|an|the)\s+(.+?)(?:that|which|to)\s+(.+?)(?:\.|$)/gim, confidence: 0.7 },
      { regex: /(?:pattern|approach|architecture|design)[:\s]+(.+?)(?:\.|$)/gim, confidence: 0.75 },
    ];

    for (const { regex, confidence } of patternIndicators) {
      const matches = content.matchAll(regex);
      for (const match of matches) {
        const fullMatch = match[0].trim();
        if (fullMatch.length > 20 && fullMatch.length < 300) {
          learnings.push({
            type: 'pattern',
            content: fullMatch,
            tags: ['pattern', stageName],
            confidence,
          });
        }
      }
    }

    return learnings;
  }

  /**
   * Extract insights from stage completion status
   */
  private extractInsights(content: string, status: string, stageName: string): ExtractedLearning[] {
    const learnings: ExtractedLearning[] = [];

    // If a stage failed and then succeeded (after fix), that's an insight
    if (status === 'completed' && content.length > 50) {
      // Look for lesson-learned phrases
      const insightPatterns = [
        { regex: /(?:important|note|remember|key takeaway|lesson)[:\s]+(.+?)(?:\.|$)/gim, confidence: 0.8 },
        { regex: /(?:fixed|resolved|solved)\s+(?:by|with|using)\s+(.+?)(?:\.|$)/gim, confidence: 0.7 },
        { regex: /(?:issue|problem|bug)\s+(?:was|caused by)\s+(.+?)(?:\.|$)/gim, confidence: 0.7 },
      ];

      for (const { regex, confidence } of insightPatterns) {
        const matches = content.matchAll(regex);
        for (const match of matches) {
          if (match[1] && match[1].length > 10 && match[1].length < 300) {
            learnings.push({
              type: 'insight',
              content: match[1].trim(),
              tags: ['insight', stageName],
              confidence,
            });
          }
        }
      }
    }

    return learnings;
  }

  /**
   * Analyze file modification patterns
   */
  private analyzeFilePatterns(files: string[]): ExtractedLearning | null {
    if (files.length === 0) return null;

    // Detect common directories
    const dirs = new Set<string>();
    const extensions = new Set<string>();
    for (const file of files) {
      const parts = file.split('/');
      if (parts.length > 1) dirs.add(parts.slice(0, -1).join('/'));
      const ext = file.split('.').pop();
      if (ext) extensions.add(ext);
    }

    if (dirs.size > 0) {
      return {
        type: 'fact',
        content: `Modified files in: ${[...dirs].join(', ')} (extensions: ${[...extensions].join(', ')})`,
        tags: ['file-structure'],
        confidence: 0.6,
      };
    }

    return null;
  }
}
