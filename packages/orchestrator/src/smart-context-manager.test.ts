import { describe, it, expect, beforeEach } from 'vitest';
import { SmartContextManager } from './smart-context-manager';
import type { ProjectContext } from '@apexcli/core';
import type { MemoryManager, LearningExtractorLike } from './smart-context-manager';

describe('SmartContextManager', () => {
  let manager: SmartContextManager;

  beforeEach(() => {
    manager = new SmartContextManager({
      maxTokensPerTask: 100000,
      contextBudgetPercent: 0.25, // 25% of 100k = 25k tokens for context
    });
  });

  describe('constructor and token allocation', () => {
    it('should calculate correct token budget', () => {
      const context = manager.buildContext({
        taskDescription: 'Test task',
      });

      expect(context.budget.projectContext).toBe(5000); // 20% of 25k
      expect(context.budget.codebaseIntelligence).toBe(10000); // 40% of 25k
      expect(context.budget.memory).toBe(5000); // 20% of 25k
      expect(context.budget.taskHistory).toBe(3000); // 12% of 25k
      expect(context.budget.livingMemory).toBe(2000); // 8% of 25k
    });

    it('should use default context budget percent', () => {
      const defaultManager = new SmartContextManager({
        maxTokensPerTask: 100000,
      });

      const context = defaultManager.buildContext({
        taskDescription: 'Test task',
      });

      // Default 25% budget should still apply
      expect(context.budget.projectContext).toBe(5000);
      expect(context.budget.codebaseIntelligence).toBe(10000);
      expect(context.budget.memory).toBe(5000);
      expect(context.budget.taskHistory).toBe(3000);
      expect(context.budget.livingMemory).toBe(2000);
    });
  });

  describe('token estimation and truncation', () => {
    it('should estimate tokens correctly', () => {
      const context = manager.buildContext({
        taskDescription: 'Test task',
        enrichedContext: 'a'.repeat(8000), // Should be 2000 tokens
      });

      expect(context.visualization.sections[0].name).toBe('Codebase Intelligence');
      expect(context.visualization.sections[0].usedTokens).toBe(2000);
    });

    it('should truncate content when exceeding budget', () => {
      const largeContent = 'a'.repeat(50000); // 12500 tokens, exceeds 10k budget

      const context = manager.buildContext({
        taskDescription: 'Test task',
        enrichedContext: largeContent,
      });

      const section = context.visualization.sections.find(s => s.name === 'Codebase Intelligence');
      expect(section!.usedTokens).toBeLessThanOrEqual(10000);
      expect(context.enrichedContext).toContain('...truncated');
    });

    it('should not truncate content within budget', () => {
      const smallContent = 'a'.repeat(4000); // 1000 tokens, within budget

      const context = manager.buildContext({
        taskDescription: 'Test task',
        enrichedContext: smallContent,
      });

      expect(context.enrichedContext).toBe(smallContent);
      expect(context.enrichedContext).not.toContain('...truncated');
    });
  });

  describe('project context formatting', () => {
    it('should format project context with git status', () => {
      const projectContext: ProjectContext = {
        gitStatus: {
          branch: 'feature/test',
          isDirty: true,
          staged: ['file1.ts', 'file2.ts'],
          unstaged: ['file3.ts'],
        },
        frameworks: [{ name: 'React' }, { name: 'TypeScript' }],
        testFrameworks: [{ name: 'Vitest' }, { name: 'Playwright' }],
        structure: {
          isMonorepo: true,
          workspaces: ['packages/core', 'packages/ui'],
        },
      };

      const context = manager.buildContext({
        taskDescription: 'Test task',
        projectContext,
      });

      expect(context.projectContext).toContain('Branch: feature/test');
      expect(context.projectContext).toContain('Uncommitted changes: 3 files');
      expect(context.projectContext).toContain('Frameworks: React, TypeScript');
      expect(context.projectContext).toContain('Testing: Vitest, Playwright');
      expect(context.projectContext).toContain('Monorepo: 2 workspaces');
    });

    it('should handle minimal project context', () => {
      const projectContext: ProjectContext = {
        gitStatus: { branch: 'main', isDirty: false },
      };

      const context = manager.buildContext({
        taskDescription: 'Test task',
        projectContext,
      });

      expect(context.projectContext).toContain('Branch: main');
      expect(context.projectContext).not.toContain('Uncommitted changes');
    });

    it('should handle undefined optional fields', () => {
      const projectContext: ProjectContext = {
        gitStatus: {
          branch: 'main',
          isDirty: true,
          // staged and unstaged arrays undefined
        },
        frameworks: [{ name: undefined }], // name could be undefined
      };

      const context = manager.buildContext({
        taskDescription: 'Test task',
        projectContext,
      });

      expect(context.projectContext).toContain('Branch: main');
      expect(context.projectContext).toContain('Frameworks: unknown');
    });
  });

  describe('memory context integration', () => {
    const mockMemoryManager: MemoryManager = {
      buildMemoryContext: (description: string, maxTokens: number) => {
        return `Memory for "${description}" (max ${maxTokens} tokens)\n- Previous insight 1\n- Previous insight 2`;
      },
      getLivingMemoryContent: () => {
        return 'Living memory content\n- Current session data';
      },
      // Add other required methods as needed
    } as any;

    it('should include memory context within budget', () => {
      const context = manager.buildContext({
        taskDescription: 'Test task with memory',
        memoryManager: mockMemoryManager,
      });

      expect(context.memoryContext).toContain('Memory for "Test task with memory"');
      expect(context.memoryContext).toContain('Previous insight 1');

      const memorySection = context.visualization.sections.find(s => s.name === 'Memory');
      expect(memorySection).toBeDefined();
      expect(memorySection!.usedTokens).toBeGreaterThan(0);
      expect(memorySection!.itemCount).toBe(2); // Two "- " items
    });

    it('should include living memory context', () => {
      const context = manager.buildContext({
        taskDescription: 'Test task',
        memoryManager: mockMemoryManager,
      });

      expect(context.livingMemory).toContain('Living memory content');
      expect(context.livingMemory).toContain('Current session data');

      const livingSection = context.visualization.sections.find(s => s.name === 'Living Memory');
      expect(livingSection).toBeDefined();
      expect(livingSection!.usedTokens).toBeGreaterThan(0);
    });

    it('should handle empty memory responses', () => {
      const emptyMemoryManager: MemoryManager = {
        buildMemoryContext: () => undefined,
        getLivingMemoryContent: () => undefined,
      } as any;

      const context = manager.buildContext({
        taskDescription: 'Test task',
        memoryManager: emptyMemoryManager,
      });

      expect(context.memoryContext).toBeUndefined();
      expect(context.livingMemory).toBeUndefined();

      const memorySections = context.visualization.sections.filter(s =>
        s.name === 'Memory' || s.name === 'Living Memory'
      );
      expect(memorySections).toHaveLength(0);
    });
  });

  describe('task history integration', () => {
    const mockLearningExtractor: LearningExtractorLike = {
      buildTaskHistoryContext: (description: string, maxTokens: number) => {
        return `Task history for "${description}"\n- Previous task 1\n- Previous task 2\n- Previous task 3`;
      },
    };

    it('should include task history context within budget', () => {
      const context = manager.buildContext({
        taskDescription: 'Implementation task',
        learningExtractor: mockLearningExtractor,
      });

      expect(context.taskHistoryContext).toContain('Task history for "Implementation task"');
      expect(context.taskHistoryContext).toContain('Previous task 1');

      const historySection = context.visualization.sections.find(s => s.name === 'Task History');
      expect(historySection).toBeDefined();
      expect(historySection!.usedTokens).toBeGreaterThan(0);
      expect(historySection!.itemCount).toBe(3); // Three "- " items
    });

    it('should handle empty task history', () => {
      const emptyLearningExtractor: LearningExtractorLike = {
        buildTaskHistoryContext: () => undefined,
      };

      const context = manager.buildContext({
        taskDescription: 'Test task',
        learningExtractor: emptyLearningExtractor,
      });

      expect(context.taskHistoryContext).toBeUndefined();

      const historySections = context.visualization.sections.filter(s => s.name === 'Task History');
      expect(historySections).toHaveLength(0);
    });
  });

  describe('visualization and reporting', () => {
    it('should provide accurate visualization data', () => {
      const context = manager.buildContext({
        taskDescription: 'Test task',
        enrichedContext: 'a'.repeat(4000), // 1000 tokens
        projectContext: {
          gitStatus: { branch: 'main', isDirty: false },
          frameworks: [{ name: 'React' }],
        },
      });

      const viz = context.visualization;

      expect(viz.totalTokenBudget).toBe(25000);
      expect(viz.totalUsedTokens).toBeGreaterThan(0);
      expect(viz.percentTotal).toBeGreaterThan(0);
      expect(viz.sections).toHaveLength(2); // Project Context + Codebase Intelligence

      const projectSection = viz.sections.find(s => s.name === 'Project Context');
      const codebaseSection = viz.sections.find(s => s.name === 'Codebase Intelligence');

      expect(projectSection).toBeDefined();
      expect(codebaseSection).toBeDefined();
      expect(codebaseSection!.usedTokens).toBe(1000);
    });

    it('should format visualization as text', () => {
      const context = manager.buildContext({
        taskDescription: 'Test task',
        enrichedContext: 'Short content',
      });

      const vizText = manager.getContextVisualization(context.visualization);

      expect(vizText).toContain('Context Budget:');
      expect(vizText).toContain('tokens');
      expect(vizText).toContain('Codebase Intelligence');
      expect(vizText).toContain('[.'); // Since content is small, progress bar will be mostly dots
      expect(vizText).toContain('items)');
    });

    it('should render progress bars correctly', () => {
      const context = manager.buildContext({
        taskDescription: 'Test task',
        enrichedContext: 'a'.repeat(20000), // 5000 tokens, exactly 50% of 10k budget
      });

      const vizText = manager.getContextVisualization(context.visualization);

      // Should show about 50% usage in progress bar
      expect(vizText).toContain('[##########..........] 5000/10000');
    });
  });

  describe('integration scenarios', () => {
    it('should handle all context sources together', () => {
      const mockMemoryManager: MemoryManager = {
        buildMemoryContext: () => 'Memory content',
        getLivingMemoryContent: () => 'Living memory',
      } as any;

      const mockLearningExtractor: LearningExtractorLike = {
        buildTaskHistoryContext: () => 'Task history content',
      };

      const projectContext: ProjectContext = {
        gitStatus: { branch: 'main', isDirty: true, staged: ['file.ts'] },
        frameworks: [{ name: 'React' }],
      };

      const context = manager.buildContext({
        taskDescription: 'Complex implementation task',
        projectContext,
        enrichedContext: 'Codebase analysis...',
        memoryManager: mockMemoryManager,
        learningExtractor: mockLearningExtractor,
      });

      expect(context.projectContext).toContain('Branch: main');
      expect(context.enrichedContext).toBe('Codebase analysis...');
      expect(context.memoryContext).toBe('Memory content');
      expect(context.taskHistoryContext).toBe('Task history content');
      expect(context.livingMemory).toBe('Living memory');

      expect(context.visualization.sections).toHaveLength(5);
      expect(context.visualization.totalUsedTokens).toBeGreaterThan(0);
    });

    it('should handle empty task description gracefully', () => {
      const context = manager.buildContext({
        taskDescription: '',
      });

      expect(context.visualization.sections).toHaveLength(0);
      expect(context.visualization.totalUsedTokens).toBe(0);
    });

    it('should respect token budgets under high load', () => {
      const largeProjectContext: ProjectContext = {
        gitStatus: {
          branch: 'very-long-branch-name-that-exceeds-normal-limits',
          isDirty: true,
          staged: Array.from({ length: 100 }, (_, i) => `file${i}.ts`),
        },
        frameworks: Array.from({ length: 20 }, (_, i) => ({ name: `Framework${i}` })),
      };

      const mockMemoryManager: MemoryManager = {
        buildMemoryContext: () => 'x'.repeat(30000), // Exceeds budget
        getLivingMemoryContent: () => 'y'.repeat(15000), // Exceeds budget
      } as any;

      const mockLearningExtractor: LearningExtractorLike = {
        buildTaskHistoryContext: () => 'z'.repeat(20000), // Exceeds budget
      };

      const context = manager.buildContext({
        taskDescription: 'High load task',
        projectContext: largeProjectContext,
        enrichedContext: 'a'.repeat(60000), // Exceeds budget
        memoryManager: mockMemoryManager,
        learningExtractor: mockLearningExtractor,
      });

      // All sections should be within their budgets
      for (const section of context.visualization.sections) {
        expect(section.usedTokens).toBeLessThanOrEqual(section.allocatedTokens);
      }

      // Total should not exceed overall budget
      expect(context.visualization.totalUsedTokens).toBeLessThanOrEqual(25000);
      expect(context.visualization.percentTotal).toBeLessThanOrEqual(100);
    });
  });

  describe('error handling', () => {
    it('should handle null/undefined gracefully', () => {
      const context = manager.buildContext({
        taskDescription: 'Test',
        projectContext: null as any,
        enrichedContext: undefined,
        memoryManager: undefined,
        learningExtractor: undefined,
      });

      expect(context.projectContext).toBeUndefined();
      expect(context.enrichedContext).toBeUndefined();
      expect(context.memoryContext).toBeUndefined();
      expect(context.taskHistoryContext).toBeUndefined();
      expect(context.livingMemory).toBeUndefined();
    });

    it('should handle memory manager that throws errors', () => {
      const faultyMemoryManager: MemoryManager = {
        buildMemoryContext: () => {
          throw new Error('Memory error');
        },
        getLivingMemoryContent: () => {
          throw new Error('Living memory error');
        },
      } as any;

      expect(() => {
        manager.buildContext({
          taskDescription: 'Test',
          memoryManager: faultyMemoryManager,
        });
      }).toThrow('Memory error');
    });

    it('should handle learning extractor that throws errors', () => {
      const faultyLearningExtractor: LearningExtractorLike = {
        buildTaskHistoryContext: () => {
          throw new Error('Learning error');
        },
      };

      expect(() => {
        manager.buildContext({
          taskDescription: 'Test',
          learningExtractor: faultyLearningExtractor,
        });
      }).toThrow('Learning error');
    });
  });

  describe('edge cases', () => {
    it('should handle extremely small token budgets', () => {
      const tinyManager = new SmartContextManager({
        maxTokensPerTask: 100, // Very small budget
        contextBudgetPercent: 0.25,
      });

      const context = tinyManager.buildContext({
        taskDescription: 'Test',
        enrichedContext: 'Some content that might be too long',
      });

      // Should still work with tiny budgets
      expect(context.budget.codebaseIntelligence).toBe(10); // 40% of 25
      expect(context.visualization.totalTokenBudget).toBe(25);
    });

    it('should handle zero token budget gracefully', () => {
      const zeroManager = new SmartContextManager({
        maxTokensPerTask: 0,
        contextBudgetPercent: 0.25,
      });

      const context = zeroManager.buildContext({
        taskDescription: 'Test',
        enrichedContext: 'Content',
      });

      expect(context.budget.codebaseIntelligence).toBe(0);
      expect(context.visualization.totalTokenBudget).toBe(0);
    });

    it('should handle very long task descriptions', () => {
      const longDescription = 'x'.repeat(100000);

      const context = manager.buildContext({
        taskDescription: longDescription,
      });

      // Should not crash with very long descriptions
      expect(context.visualization.sections).toHaveLength(0);
    });
  });
});