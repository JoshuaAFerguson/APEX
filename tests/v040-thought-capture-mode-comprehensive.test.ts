import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ThoughtCaptureManager, ThoughtSearch, ThoughtStats } from '../packages/orchestrator/src/thought-capture';
import { ApexOrchestrator } from '../packages/orchestrator/src';
import { TaskStore } from '../packages/orchestrator/src/store';
import { ThoughtCapture, CreateTaskRequest, ApexConfig } from '@apexcli/core';
import { promises as fs } from 'fs';
import { join } from 'path';

// Mock filesystem operations
vi.mock('fs', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    default: actual,
    promises: {
      readFile: vi.fn(),
      writeFile: vi.fn(),
      mkdir: vi.fn(),
    },
  };
});

// Mock child_process for CLI integration
vi.mock('child_process', () => ({
  spawn: vi.fn(),
  exec: vi.fn(),
}));

// Mock TaskStore
vi.mock('../packages/orchestrator/src/store', () => ({
  TaskStore: vi.fn().mockImplementation(() => ({
    createTask: vi.fn(),
    getTask: vi.fn(),
    updateTask: vi.fn(),
    getActiveTasks: vi.fn(),
  })),
}));

describe('V0.4.0 Thought Capture Mode Feature', () => {
  describe('ThoughtCaptureManager Core Functionality', () => {
    let thoughtManager: ThoughtCaptureManager;
    let mockStore: TaskStore;
    let projectPath: string;

    beforeEach(() => {
      projectPath = '/test/project';
      mockStore = new TaskStore(':memory:');
      thoughtManager = new ThoughtCaptureManager(projectPath, mockStore);

      // Reset mocks
      vi.clearAllMocks();

      // Mock successful file operations
      (fs.mkdir as any).mockResolvedValue(undefined);
      (fs.writeFile as any).mockResolvedValue(undefined);
      (fs.readFile as any).mockRejectedValue({ code: 'ENOENT' }); // Start with no existing file
    });

    afterEach(() => {
      vi.resetAllMocks();
    });

    describe('Real-time Thought Capture', () => {
      it('should capture thoughts instantly with unique IDs', async () => {
        await thoughtManager.initialize();

        const thought1 = await thoughtManager.captureThought('First idea about authentication');
        const thought2 = await thoughtManager.captureThought('Second idea about UI improvements');

        expect(thought1.id).not.toBe(thought2.id);
        expect(thought1.id).toMatch(/^thought-\d+-[a-z0-9]+$/);
        expect(thought2.id).toMatch(/^thought-\d+-[a-z0-9]+$/);

        expect(thought1.content).toBe('First idea about authentication');
        expect(thought2.content).toBe('Second idea about UI improvements');

        expect(thought1.createdAt).toBeInstanceOf(Date);
        expect(thought2.createdAt).toBeInstanceOf(Date);
      });

      it('should capture thoughts with immediate persistence', async () => {
        await thoughtManager.initialize();

        await thoughtManager.captureThought('Important thought');

        // Verify file write was attempted
        expect(fs.writeFile).toHaveBeenCalledWith(
          join(projectPath, '.apex', 'thoughts.json'),
          expect.any(String),
          'utf-8'
        );

        // Verify directory creation
        expect(fs.mkdir).toHaveBeenCalledWith(
          join(projectPath, '.apex'),
          { recursive: true }
        );
      });

      it('should emit events for real-time updates', async () => {
        await thoughtManager.initialize();

        const capturedSpy = vi.fn();
        thoughtManager.on('thought:captured', capturedSpy);

        const thought = await thoughtManager.captureThought('Test idea');

        expect(capturedSpy).toHaveBeenCalledWith(thought);
        expect(capturedSpy).toHaveBeenCalledTimes(1);
      });

      it('should handle high-frequency thought capture', async () => {
        await thoughtManager.initialize();

        // Capture many thoughts rapidly
        const promises = Array.from({ length: 20 }, (_, i) =>
          thoughtManager.captureThought(`Rapid idea ${i}`)
        );

        const thoughts = await Promise.all(promises);

        expect(thoughts).toHaveLength(20);

        // All should have unique IDs
        const ids = thoughts.map(t => t.id);
        const uniqueIds = new Set(ids);
        expect(uniqueIds.size).toBe(20);

        // All should be accessible
        thoughts.forEach(thought => {
          const retrieved = thoughtManager.getThought(thought.id);
          expect(retrieved).toEqual(thought);
        });
      });
    });

    describe('Priority and Tag Management', () => {
      beforeEach(async () => {
        await thoughtManager.initialize();
      });

      it('should support priority-based organization', async () => {
        const lowThought = await thoughtManager.captureThought('Low priority idea', {
          priority: 'low'
        });

        const mediumThought = await thoughtManager.captureThought('Medium priority idea', {
          priority: 'medium'
        });

        const highThought = await thoughtManager.captureThought('High priority idea', {
          priority: 'high'
        });

        expect(lowThought.priority).toBe('low');
        expect(mediumThought.priority).toBe('medium');
        expect(highThought.priority).toBe('high');

        // Test priority-based searching
        const highPriorityThoughts = thoughtManager.searchThoughts({
          query: '',
          priority: 'high'
        });

        expect(highPriorityThoughts).toHaveLength(1);
        expect(highPriorityThoughts[0].content).toBe('High priority idea');
      });

      it('should support flexible tagging system', async () => {
        await thoughtManager.captureThought('Authentication feature idea', {
          tags: ['security', 'auth', 'feature', 'user-management']
        });

        await thoughtManager.captureThought('UI color scheme improvement', {
          tags: ['ui', 'design', 'accessibility']
        });

        await thoughtManager.captureThought('Performance optimization thought', {
          tags: ['performance', 'optimization', 'backend']
        });

        // Test tag-based filtering
        const securityThoughts = thoughtManager.searchThoughts({
          query: '',
          tags: ['security']
        });

        expect(securityThoughts).toHaveLength(1);
        expect(securityThoughts[0].tags).toContain('security');

        // Test multiple tag filtering
        const uiThoughts = thoughtManager.searchThoughts({
          query: '',
          tags: ['ui', 'design']
        });

        expect(uiThoughts).toHaveLength(1);
      });

      it('should handle tag updates dynamically', async () => {
        const thought = await thoughtManager.captureThought('Feature idea', {
          tags: ['feature']
        });

        const updated = await thoughtManager.updateThought(thought.id, {
          tags: ['feature', 'enhancement', 'user-requested']
        });

        expect(updated?.tags).toEqual(['feature', 'enhancement', 'user-requested']);

        // Verify searchability with new tags
        const enhancementThoughts = thoughtManager.searchThoughts({
          query: '',
          tags: ['enhancement']
        });

        expect(enhancementThoughts).toHaveLength(1);
        expect(enhancementThoughts[0].id).toBe(thought.id);
      });
    });

    describe('Advanced Search and Filtering', () => {
      beforeEach(async () => {
        await thoughtManager.initialize();

        // Set up test data
        await thoughtManager.captureThought('Authentication system needs overhaul', {
          tags: ['auth', 'security', 'critical'],
          priority: 'high'
        });

        await thoughtManager.captureThought('Add dark mode to the interface', {
          tags: ['ui', 'theming', 'user-experience'],
          priority: 'medium'
        });

        await thoughtManager.captureThought('Optimize database queries for performance', {
          tags: ['database', 'performance', 'optimization'],
          priority: 'high'
        });

        await thoughtManager.captureThought('Write unit tests for auth module', {
          tags: ['testing', 'auth', 'quality'],
          priority: 'low'
        });
      });

      it('should support complex text search queries', async () => {
        // Search in content
        const authResults = thoughtManager.searchThoughts({
          query: 'authentication'
        });

        expect(authResults).toHaveLength(2); // "Authentication system" and "auth module"

        // Search in tags
        const uiResults = thoughtManager.searchThoughts({
          query: 'ui'
        });

        expect(uiResults).toHaveLength(1);
        expect(uiResults[0].content).toContain('dark mode');

        // Case insensitive search
        const performanceResults = thoughtManager.searchThoughts({
          query: 'PERFORMANCE'
        });

        expect(performanceResults).toHaveLength(1);
        expect(performanceResults[0].content).toContain('Optimize database');
      });

      it('should support multi-criteria filtering', async () => {
        // High priority auth-related thoughts
        const criticalAuthThoughts = thoughtManager.searchThoughts({
          query: 'auth',
          priority: 'high'
        });

        expect(criticalAuthThoughts).toHaveLength(1);
        expect(criticalAuthThoughts[0].content).toContain('Authentication system');

        // Medium priority with specific tags
        const mediumUIThoughts = thoughtManager.searchThoughts({
          query: '',
          tags: ['ui'],
          priority: 'medium'
        });

        expect(mediumUIThoughts).toHaveLength(1);
        expect(mediumUIThoughts[0].content).toContain('dark mode');
      });

      it('should support date range filtering', async () => {
        const now = new Date();
        const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
        const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);

        // All thoughts should be within the last hour
        const recentThoughts = thoughtManager.searchThoughts({
          query: '',
          fromDate: oneHourAgo,
          toDate: tomorrow
        });

        expect(recentThoughts.length).toBeGreaterThan(0);

        // No thoughts should be from the future
        const futureThoughts = thoughtManager.searchThoughts({
          query: '',
          fromDate: tomorrow
        });

        expect(futureThoughts).toHaveLength(0);
      });

      it('should sort results by priority and date', async () => {
        const allThoughts = thoughtManager.searchThoughts({
          query: ''
        });

        // High priority thoughts should come first
        let priorityOrder = ['high', 'medium', 'low'];
        let currentPriorityIndex = 0;

        for (const thought of allThoughts) {
          const thoughtPriorityIndex = priorityOrder.indexOf(thought.priority);
          expect(thoughtPriorityIndex).toBeGreaterThanOrEqual(currentPriorityIndex);

          if (thoughtPriorityIndex > currentPriorityIndex) {
            currentPriorityIndex = thoughtPriorityIndex;
          }
        }
      });
    });

    describe('Status Lifecycle Management', () => {
      beforeEach(async () => {
        await thoughtManager.initialize();
      });

      it('should track thought status transitions', async () => {
        const thought = await thoughtManager.captureThought('Feature idea');

        // Initial status
        expect(thought.status).toBe('captured');

        // Plan the thought
        const planned = await thoughtManager.planThought(thought.id);
        expect(planned?.status).toBe('planned');

        // Verify state persistence
        const retrieved = thoughtManager.getThought(thought.id);
        expect(retrieved?.status).toBe('planned');
      });

      it('should handle implementation workflow', async () => {
        const thought = await thoughtManager.captureThought('Implement caching layer');

        // Mock task creation
        (mockStore.createTask as any).mockResolvedValue({
          id: 'task-cache-123',
          description: 'Implement caching layer'
        });

        const taskId = await thoughtManager.implementThought(thought.id, {
          workflow: 'feature',
          priority: 'high',
          acceptanceCriteria: 'Add Redis caching for API endpoints'
        });

        expect(taskId).toBe('task-cache-123');

        // Verify thought was updated
        const implemented = thoughtManager.getThought(thought.id);
        expect(implemented?.status).toBe('implemented');
        expect(implemented?.taskId).toBe('task-cache-123');
        expect(implemented?.implementedAt).toBeInstanceOf(Date);

        // Verify task creation call
        expect(mockStore.createTask).toHaveBeenCalledWith({
          description: 'Implement caching layer',
          acceptanceCriteria: 'Add Redis caching for API endpoints',
          workflow: 'feature',
          priority: 'high',
          projectPath: projectPath
        });
      });

      it('should emit implementation events', async () => {
        const thought = await thoughtManager.captureThought('Test implementation');
        (mockStore.createTask as any).mockResolvedValue({ id: 'task-123' });

        const implementedSpy = vi.fn();
        thoughtManager.on('thought:implemented', implementedSpy);

        await thoughtManager.implementThought(thought.id);

        expect(implementedSpy).toHaveBeenCalledWith(
          expect.objectContaining({ id: thought.id }),
          'task-123'
        );
      });

      it('should handle thought discarding', async () => {
        const thought = await thoughtManager.captureThought('Bad idea');

        const discardedSpy = vi.fn();
        thoughtManager.on('thought:discarded', discardedSpy);

        await thoughtManager.discardThought(thought.id);

        const discarded = thoughtManager.getThought(thought.id);
        expect(discarded?.status).toBe('discarded');

        expect(discardedSpy).toHaveBeenCalledWith(
          expect.objectContaining({ id: thought.id })
        );
      });

      it('should prevent duplicate implementation', async () => {
        const thought = await thoughtManager.captureThought('Feature idea');
        (mockStore.createTask as any).mockResolvedValue({ id: 'task-123' });

        await thoughtManager.implementThought(thought.id);

        // Second implementation attempt should fail
        await expect(
          thoughtManager.implementThought(thought.id)
        ).rejects.toThrow('has already been implemented');
      });
    });

    describe('Analytics and Statistics', () => {
      beforeEach(async () => {
        await thoughtManager.initialize();
      });

      it('should provide comprehensive thought statistics', async () => {
        // Create thoughts with various statuses
        const thought1 = await thoughtManager.captureThought('Captured idea', {
          tags: ['feature', 'ui'],
          priority: 'high'
        });

        const thought2 = await thoughtManager.captureThought('Another idea', {
          tags: ['feature', 'backend'],
          priority: 'low'
        });

        const thought3 = await thoughtManager.captureThought('Third idea', {
          tags: ['bug'],
          priority: 'medium'
        });

        // Plan one thought
        await thoughtManager.planThought(thought2.id);

        // Implement one thought (mock task creation)
        (mockStore.createTask as any).mockResolvedValue({ id: 'task-123' });
        await thoughtManager.implementThought(thought1.id);

        const stats = thoughtManager.getThoughtStats();

        expect(stats.total).toBe(3);
        expect(stats.byStatus.captured).toBe(1);
        expect(stats.byStatus.planned).toBe(1);
        expect(stats.byStatus.implemented).toBe(1);
        expect(stats.byStatus.discarded).toBe(0);

        expect(stats.byPriority.high).toBe(1);
        expect(stats.byPriority.medium).toBe(1);
        expect(stats.byPriority.low).toBe(1);

        expect(stats.byTag.feature).toBe(2);
        expect(stats.byTag.ui).toBe(1);
        expect(stats.byTag.backend).toBe(1);
        expect(stats.byTag.bug).toBe(1);

        expect(stats.implementationRate).toBeCloseTo(1/3);
      });

      it('should calculate implementation timing metrics', async () => {
        const thought = await thoughtManager.captureThought('Timed implementation');
        (mockStore.createTask as any).mockResolvedValue({ id: 'task-123' });

        // Simulate some time passing
        const implementationDelay = 5000; // 5 seconds
        setTimeout(async () => {
          await thoughtManager.implementThought(thought.id);
        }, implementationDelay);

        // Wait for implementation
        await new Promise(resolve => setTimeout(resolve, implementationDelay + 100));

        const stats = thoughtManager.getThoughtStats();
        expect(stats.avgTimeToImplementation).toBeGreaterThan(implementationDelay - 1000);
      });

      it('should provide actionable suggestions', async () => {
        // High priority thoughts
        await thoughtManager.captureThought('Critical bug fix', {
          priority: 'high'
        });

        await thoughtManager.captureThought('Urgent feature', {
          priority: 'high'
        });

        // Planned thought
        const planned = await thoughtManager.captureThought('Planned work');
        await thoughtManager.planThought(planned.id);

        // Medium priority thoughts
        await thoughtManager.captureThought('Enhancement 1', {
          priority: 'medium'
        });

        await thoughtManager.captureThought('Enhancement 2', {
          priority: 'medium'
        });

        const suggestions = thoughtManager.getActionableSuggestions();

        expect(suggestions.highPriorityThoughts).toHaveLength(2);
        expect(suggestions.readyToImplement).toHaveLength(1);
        expect(suggestions.needsPlanning).toHaveLength(4); // 2 high + 2 medium

        expect(suggestions.suggestions).toContain('2 high-priority thoughts need attention');
        expect(suggestions.suggestions).toContain('1 thoughts are ready to implement');
      });

      it('should suggest review when implementation rate is low', async () => {
        // Create many thoughts without implementing
        for (let i = 0; i < 15; i++) {
          await thoughtManager.captureThought(`Unimplemented idea ${i}`);
        }

        const suggestions = thoughtManager.getActionableSuggestions();

        expect(suggestions.suggestions).toContain(
          'Consider reviewing and implementing more captured thoughts'
        );
      });
    });
  });

  describe('CLI Integration (apex think command)', () => {
    let orchestrator: ApexOrchestrator;
    let mockConfig: ApexConfig;

    beforeEach(() => {
      mockConfig = {
        apiKey: 'test-key',
        model: 'claude-3-sonnet',
        projectPath: '/test/project'
      } as ApexConfig;

      // Mock orchestrator with thought capture
      orchestrator = {
        captureThought: vi.fn(),
        getThoughtManager: vi.fn().mockReturnValue({
          searchThoughts: vi.fn(),
          getAllThoughts: vi.fn(),
          getActionableSuggestions: vi.fn(),
          exportToMarkdown: vi.fn()
        })
      } as unknown as ApexOrchestrator;
    });

    it('should capture thoughts via CLI command', async () => {
      (orchestrator.captureThought as any).mockResolvedValue({
        id: 'thought-123',
        content: 'Add user authentication',
        priority: 'high',
        tags: ['auth', 'security'],
        status: 'captured',
        createdAt: new Date()
      });

      // Simulate CLI call: apex think "Add user authentication" --priority high --tags auth,security
      const thought = await orchestrator.captureThought(
        'Add user authentication',
        {
          priority: 'high',
          tags: ['auth', 'security']
        }
      );

      expect(orchestrator.captureThought).toHaveBeenCalledWith(
        'Add user authentication',
        {
          priority: 'high',
          tags: ['auth', 'security']
        }
      );

      expect(thought.content).toBe('Add user authentication');
      expect(thought.priority).toBe('high');
      expect(thought.tags).toEqual(['auth', 'security']);
    });

    it('should list thoughts via CLI', async () => {
      const mockThoughts = [
        {
          id: 'thought-1',
          content: 'Implement caching',
          priority: 'medium',
          tags: ['performance'],
          status: 'captured',
          createdAt: new Date()
        },
        {
          id: 'thought-2',
          content: 'Add dark mode',
          priority: 'low',
          tags: ['ui', 'theme'],
          status: 'planned',
          createdAt: new Date()
        }
      ];

      const thoughtManager = orchestrator.getThoughtManager();
      (thoughtManager.getAllThoughts as any).mockReturnValue(mockThoughts);

      const thoughts = thoughtManager.getAllThoughts();

      expect(thoughts).toHaveLength(2);
      expect(thoughts[0].content).toBe('Implement caching');
      expect(thoughts[1].content).toBe('Add dark mode');
    });

    it('should search thoughts via CLI', async () => {
      const thoughtManager = orchestrator.getThoughtManager();
      (thoughtManager.searchThoughts as any).mockReturnValue([
        {
          id: 'thought-auth',
          content: 'Implement OAuth',
          tags: ['auth'],
          priority: 'high'
        }
      ]);

      // Simulate: apex think search --query "auth" --priority high
      const results = thoughtManager.searchThoughts({
        query: 'auth',
        priority: 'high'
      });

      expect(thoughtManager.searchThoughts).toHaveBeenCalledWith({
        query: 'auth',
        priority: 'high'
      });

      expect(results).toHaveLength(1);
      expect(results[0].content).toBe('Implement OAuth');
    });

    it('should export thoughts to markdown via CLI', async () => {
      const thoughtManager = orchestrator.getThoughtManager();
      const markdownContent = `# Captured Thoughts

## Statistics
- **Total Thoughts**: 5
- **Implementation Rate**: 40.0%

## Captured (3)
### Implement authentication
- **Priority**: high
- **Tags**: \`auth\`, \`security\`
`;

      (thoughtManager.exportToMarkdown as any).mockResolvedValue(markdownContent);

      // Simulate: apex think export thoughts.md
      const markdown = await thoughtManager.exportToMarkdown('thoughts.md');

      expect(markdown).toContain('# Captured Thoughts');
      expect(markdown).toContain('Implementation Rate**: 40.0%');
      expect(markdown).toContain('### Implement authentication');
    });
  });

  describe('Error Handling and Edge Cases', () => {
    let thoughtManager: ThoughtCaptureManager;
    let mockStore: TaskStore;

    beforeEach(() => {
      mockStore = new TaskStore(':memory:');
      thoughtManager = new ThoughtCaptureManager('/test/project', mockStore);
      vi.clearAllMocks();
    });

    it('should handle filesystem errors gracefully', async () => {
      // Mock filesystem failure
      (fs.writeFile as any).mockRejectedValue(new Error('Disk full'));
      (fs.mkdir as any).mockRejectedValue(new Error('Permission denied'));

      // Should not throw, but log warning
      await expect(
        thoughtManager.captureThought('Test thought')
      ).resolves.not.toThrow();
    });

    it('should handle corrupted thoughts file', async () => {
      (fs.readFile as any).mockResolvedValue('invalid json content');

      await thoughtManager.initialize();

      // Should start with empty state
      expect(thoughtManager.getAllThoughts()).toHaveLength(0);
    });

    it('should handle missing thoughts file', async () => {
      (fs.readFile as any).mockRejectedValue({ code: 'ENOENT' });

      await thoughtManager.initialize();

      // Should start with empty state
      expect(thoughtManager.getAllThoughts()).toHaveLength(0);
    });

    it('should handle task creation failures during implementation', async () => {
      await thoughtManager.initialize();
      const thought = await thoughtManager.captureThought('Test thought');

      // Mock task store failure
      (mockStore.createTask as any).mockRejectedValue(new Error('Database error'));

      await expect(
        thoughtManager.implementThought(thought.id)
      ).rejects.toThrow('Database error');

      // Thought status should remain unchanged
      const unchanged = thoughtManager.getThought(thought.id);
      expect(unchanged?.status).toBe('captured');
    });

    it('should validate search parameters', async () => {
      await thoughtManager.initialize();

      // Empty search should return all thoughts
      const allResults = thoughtManager.searchThoughts({ query: '' });
      expect(Array.isArray(allResults)).toBe(true);

      // Invalid date ranges should be handled
      const invalidDateResults = thoughtManager.searchThoughts({
        query: '',
        fromDate: new Date('invalid'),
        toDate: new Date()
      });
      expect(Array.isArray(invalidDateResults)).toBe(true);
    });

    it('should handle operations on non-existent thoughts', async () => {
      await thoughtManager.initialize();

      // Update non-existent thought
      const updated = await thoughtManager.updateThought('non-existent', {
        priority: 'high'
      });
      expect(updated).toBeNull();

      // Get non-existent thought
      const retrieved = thoughtManager.getThought('non-existent');
      expect(retrieved).toBeNull();

      // Discard non-existent thought (should not throw)
      await expect(
        thoughtManager.discardThought('non-existent')
      ).resolves.not.toThrow();

      // Implement non-existent thought
      await expect(
        thoughtManager.implementThought('non-existent')
      ).rejects.toThrow('not found');
    });
  });

  describe('Performance and Memory Management', () => {
    let thoughtManager: ThoughtCaptureManager;
    let mockStore: TaskStore;

    beforeEach(() => {
      mockStore = new TaskStore(':memory:');
      thoughtManager = new ThoughtCaptureManager('/test/project', mockStore);
      (fs.mkdir as any).mockResolvedValue(undefined);
      (fs.writeFile as any).mockResolvedValue(undefined);
      (fs.readFile as any).mockRejectedValue({ code: 'ENOENT' });
    });

    it('should handle large numbers of thoughts efficiently', async () => {
      await thoughtManager.initialize();

      const startTime = Date.now();

      // Create 1000 thoughts
      const promises = Array.from({ length: 1000 }, (_, i) =>
        thoughtManager.captureThought(`Performance test thought ${i}`, {
          tags: [`tag${i % 10}`],
          priority: ['low', 'medium', 'high'][i % 3] as any
        })
      );

      const thoughts = await Promise.all(promises);
      const endTime = Date.now();

      expect(thoughts).toHaveLength(1000);
      expect(endTime - startTime).toBeLessThan(5000); // Should complete in < 5 seconds

      // Search performance test
      const searchStart = Date.now();
      const searchResults = thoughtManager.searchThoughts({
        query: 'performance',
        priority: 'high'
      });
      const searchEnd = Date.now();

      expect(searchEnd - searchStart).toBeLessThan(100); // Search should be fast
      expect(searchResults.length).toBeGreaterThan(0);
    });

    it('should efficiently manage memory with many thoughts', async () => {
      await thoughtManager.initialize();

      // Check initial memory usage
      const initialHeap = process.memoryUsage().heapUsed;

      // Create many thoughts
      for (let i = 0; i < 5000; i++) {
        await thoughtManager.captureThought(`Memory test ${i}`);
      }

      const finalHeap = process.memoryUsage().heapUsed;
      const heapIncrease = finalHeap - initialHeap;

      // Memory increase should be reasonable (less than 50MB for 5000 thoughts)
      expect(heapIncrease).toBeLessThan(50 * 1024 * 1024);

      // Verify all thoughts are still accessible
      const allThoughts = thoughtManager.getAllThoughts();
      expect(allThoughts).toHaveLength(5000);
    });
  });
});