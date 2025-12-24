import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { promises as fs } from 'fs';
import { join } from 'path';
import { ThoughtCaptureManager } from './thought-capture';
import { TaskStore } from './store';
import { ThoughtCapture } from '@apexcli/core';

// Mock fs module
vi.mock('fs', () => ({
  promises: {
    readFile: vi.fn(),
    writeFile: vi.fn(),
    mkdir: vi.fn(),
  },
}));

// Mock TaskStore
vi.mock('./store', () => ({
  TaskStore: vi.fn().mockImplementation(() => ({
    createTask: vi.fn(),
  })),
}));

describe('ThoughtCaptureManager', () => {
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
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('initialization', () => {
    it('should initialize with empty thoughts when file does not exist', async () => {
      (fs.readFile as any).mockRejectedValue({ code: 'ENOENT' });

      await thoughtManager.initialize();

      expect(thoughtManager.getAllThoughts()).toEqual([]);
    });

    it('should load existing thoughts from file', async () => {
      const existingThoughts: ThoughtCapture[] = [
        {
          id: 'thought-1',
          content: 'Test thought',
          tags: ['test'],
          priority: 'medium',
          status: 'captured',
          createdAt: new Date('2023-01-01'),
        },
      ];

      (fs.readFile as any).mockResolvedValue(JSON.stringify(existingThoughts));

      await thoughtManager.initialize();

      const thoughts = thoughtManager.getAllThoughts();
      expect(thoughts).toHaveLength(1);
      expect(thoughts[0].content).toBe('Test thought');
    });

    it('should handle corrupted thoughts file gracefully', async () => {
      (fs.readFile as any).mockResolvedValue('invalid json');

      await thoughtManager.initialize();

      expect(thoughtManager.getAllThoughts()).toEqual([]);
    });
  });

  describe('captureThought', () => {
    beforeEach(async () => {
      (fs.readFile as any).mockRejectedValue({ code: 'ENOENT' });
      await thoughtManager.initialize();
    });

    it('should capture a basic thought', async () => {
      const thought = await thoughtManager.captureThought('Add dark mode support');

      expect(thought.content).toBe('Add dark mode support');
      expect(thought.priority).toBe('medium');
      expect(thought.status).toBe('captured');
      expect(thought.tags).toEqual([]);
      expect(thought.id).toMatch(/^thought-/);
      expect(thought.createdAt).toBeInstanceOf(Date);
    });

    it('should capture thought with custom options', async () => {
      const thought = await thoughtManager.captureThought('Implement caching', {
        priority: 'high',
        tags: ['performance', 'optimization'],
        taskId: 'task-123',
      });

      expect(thought.content).toBe('Implement caching');
      expect(thought.priority).toBe('high');
      expect(thought.tags).toEqual(['performance', 'optimization']);
      expect(thought.taskId).toBe('task-123');
    });

    it('should trim whitespace from content', async () => {
      const thought = await thoughtManager.captureThought('  Spaced content  ');

      expect(thought.content).toBe('Spaced content');
    });

    it('should emit thought:captured event', async () => {
      const capturedEvent = vi.fn();
      thoughtManager.on('thought:captured', capturedEvent);

      const thought = await thoughtManager.captureThought('Test thought');

      expect(capturedEvent).toHaveBeenCalledWith(thought);
    });

    it('should save thoughts to file', async () => {
      await thoughtManager.captureThought('Test thought');

      expect(fs.writeFile).toHaveBeenCalledWith(
        join(projectPath, '.apex', 'thoughts.json'),
        expect.any(String),
        'utf-8'
      );
    });
  });

  describe('searchThoughts', () => {
    beforeEach(async () => {
      (fs.readFile as any).mockRejectedValue({ code: 'ENOENT' });
      await thoughtManager.initialize();

      // Add test thoughts
      await thoughtManager.captureThought('Add authentication', {
        tags: ['auth', 'security'],
        priority: 'high',
      });
      await thoughtManager.captureThought('Implement dark mode', {
        tags: ['ui', 'theming'],
        priority: 'medium',
      });
      await thoughtManager.captureThought('Optimize database queries', {
        tags: ['performance', 'database'],
        priority: 'high',
      });
    });

    it('should search by content query', async () => {
      const results = thoughtManager.searchThoughts({ query: 'authentication' });

      expect(results).toHaveLength(1);
      expect(results[0].content).toBe('Add authentication');
    });

    it('should search by tag query', async () => {
      const results = thoughtManager.searchThoughts({ query: 'ui' });

      expect(results).toHaveLength(1);
      expect(results[0].content).toBe('Implement dark mode');
    });

    it('should filter by tags', async () => {
      const results = thoughtManager.searchThoughts({ tags: ['security'] });

      expect(results).toHaveLength(1);
      expect(results[0].content).toBe('Add authentication');
    });

    it('should filter by priority', async () => {
      const results = thoughtManager.searchThoughts({ priority: 'high' });

      expect(results).toHaveLength(2);
      expect(results.map(t => t.content)).toContain('Add authentication');
      expect(results.map(t => t.content)).toContain('Optimize database queries');
    });

    it('should filter by status', async () => {
      // Update one thought to implemented status
      const allThoughts = thoughtManager.getAllThoughts();
      await thoughtManager.updateThought(allThoughts[0].id, { status: 'implemented' });

      const capturedResults = thoughtManager.searchThoughts({ status: 'captured' });
      const implementedResults = thoughtManager.searchThoughts({ status: 'implemented' });

      expect(capturedResults).toHaveLength(2);
      expect(implementedResults).toHaveLength(1);
    });

    it('should sort by priority then creation date', async () => {
      const results = thoughtManager.searchThoughts({ query: '' });

      // High priority thoughts should come first
      expect(results[0].priority).toBe('high');
      expect(results[1].priority).toBe('high');
      expect(results[2].priority).toBe('medium');
    });

    it('should filter by date range', async () => {
      const now = new Date();
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);

      const results = thoughtManager.searchThoughts({
        fromDate: yesterday,
        toDate: tomorrow,
      });

      expect(results).toHaveLength(3);
    });
  });

  describe('updateThought', () => {
    beforeEach(async () => {
      (fs.readFile as any).mockRejectedValue({ code: 'ENOENT' });
      await thoughtManager.initialize();
    });

    it('should update thought status', async () => {
      const thought = await thoughtManager.captureThought('Test thought');
      const updated = await thoughtManager.updateThought(thought.id, {
        status: 'planned',
      });

      expect(updated?.status).toBe('planned');
      expect(updated?.id).toBe(thought.id);
    });

    it('should update thought priority', async () => {
      const thought = await thoughtManager.captureThought('Test thought');
      const updated = await thoughtManager.updateThought(thought.id, {
        priority: 'high',
      });

      expect(updated?.priority).toBe('high');
    });

    it('should update thought tags', async () => {
      const thought = await thoughtManager.captureThought('Test thought');
      const updated = await thoughtManager.updateThought(thought.id, {
        tags: ['new', 'tags'],
      });

      expect(updated?.tags).toEqual(['new', 'tags']);
    });

    it('should return null for non-existent thought', async () => {
      const updated = await thoughtManager.updateThought('non-existent', {
        status: 'planned',
      });

      expect(updated).toBeNull();
    });

    it('should save changes to file', async () => {
      const thought = await thoughtManager.captureThought('Test thought');
      await thoughtManager.updateThought(thought.id, { status: 'planned' });

      // fs.writeFile should be called twice: once for capture, once for update
      expect(fs.writeFile).toHaveBeenCalledTimes(2);
    });
  });

  describe('implementThought', () => {
    beforeEach(async () => {
      (fs.readFile as any).mockRejectedValue({ code: 'ENOENT' });
      await thoughtManager.initialize();

      // Mock store.createTask
      (mockStore.createTask as any).mockResolvedValue({
        id: 'task-123',
        description: 'Test thought',
      });
    });

    it('should convert thought to task', async () => {
      const thought = await thoughtManager.captureThought('Test thought');
      const taskId = await thoughtManager.implementThought(thought.id);

      expect(taskId).toBe('task-123');
      expect(mockStore.createTask).toHaveBeenCalledWith({
        description: 'Test thought',
        acceptanceCriteria: 'Implement the idea: Test thought',
        workflow: 'feature',
        priority: 'normal',
        projectPath: projectPath,
      });
    });

    it('should update thought status and link to task', async () => {
      const thought = await thoughtManager.captureThought('Test thought');
      await thoughtManager.implementThought(thought.id);

      const updatedThought = thoughtManager.getThought(thought.id);
      expect(updatedThought?.status).toBe('implemented');
      expect(updatedThought?.taskId).toBe('task-123');
      expect(updatedThought?.implementedAt).toBeInstanceOf(Date);
    });

    it('should use custom implementation options', async () => {
      const thought = await thoughtManager.captureThought('Test thought');
      await thoughtManager.implementThought(thought.id, {
        workflow: 'bugfix',
        priority: 'high',
        acceptanceCriteria: 'Custom criteria',
      });

      expect(mockStore.createTask).toHaveBeenCalledWith({
        description: 'Test thought',
        acceptanceCriteria: 'Custom criteria',
        workflow: 'bugfix',
        priority: 'high',
        projectPath: projectPath,
      });
    });

    it('should map thought priority to task priority', async () => {
      const highThought = await thoughtManager.captureThought('High priority', {
        priority: 'high',
      });
      const lowThought = await thoughtManager.captureThought('Low priority', {
        priority: 'low',
      });

      await thoughtManager.implementThought(highThought.id);
      await thoughtManager.implementThought(lowThought.id);

      const calls = (mockStore.createTask as any).mock.calls;
      expect(calls[0][0].priority).toBe('high');
      expect(calls[1][0].priority).toBe('low');
    });

    it('should throw error for non-existent thought', async () => {
      await expect(
        thoughtManager.implementThought('non-existent')
      ).rejects.toThrow('Thought non-existent not found');
    });

    it('should throw error for already implemented thought', async () => {
      const thought = await thoughtManager.captureThought('Test thought');
      await thoughtManager.implementThought(thought.id);

      await expect(
        thoughtManager.implementThought(thought.id)
      ).rejects.toThrow('has already been implemented');
    });

    it('should emit thought:implemented event', async () => {
      const implementedEvent = vi.fn();
      thoughtManager.on('thought:implemented', implementedEvent);

      const thought = await thoughtManager.captureThought('Test thought');
      await thoughtManager.implementThought(thought.id);

      expect(implementedEvent).toHaveBeenCalledWith(
        expect.objectContaining({ id: thought.id }),
        'task-123'
      );
    });
  });

  describe('planThought', () => {
    beforeEach(async () => {
      (fs.readFile as any).mockRejectedValue({ code: 'ENOENT' });
      await thoughtManager.initialize();
    });

    it('should update thought status to planned', async () => {
      const thought = await thoughtManager.captureThought('Test thought');
      const planned = await thoughtManager.planThought(thought.id);

      expect(planned?.status).toBe('planned');
    });
  });

  describe('discardThought', () => {
    beforeEach(async () => {
      (fs.readFile as any).mockRejectedValue({ code: 'ENOENT' });
      await thoughtManager.initialize();
    });

    it('should update thought status to discarded', async () => {
      const thought = await thoughtManager.captureThought('Test thought');
      await thoughtManager.discardThought(thought.id);

      const discarded = thoughtManager.getThought(thought.id);
      expect(discarded?.status).toBe('discarded');
    });

    it('should emit thought:discarded event', async () => {
      const discardedEvent = vi.fn();
      thoughtManager.on('thought:discarded', discardedEvent);

      const thought = await thoughtManager.captureThought('Test thought');
      await thoughtManager.discardThought(thought.id);

      expect(discardedEvent).toHaveBeenCalledWith(
        expect.objectContaining({ id: thought.id })
      );
    });

    it('should handle non-existent thought gracefully', async () => {
      await expect(
        thoughtManager.discardThought('non-existent')
      ).resolves.toBeUndefined();
    });
  });

  describe('getThoughtStats', () => {
    beforeEach(async () => {
      (fs.readFile as any).mockRejectedValue({ code: 'ENOENT' });
      await thoughtManager.initialize();
    });

    it('should return correct statistics', async () => {
      // Add thoughts with different statuses and priorities
      const thought1 = await thoughtManager.captureThought('Captured thought', {
        priority: 'high',
        tags: ['tag1', 'tag2'],
      });

      const thought2 = await thoughtManager.captureThought('Another thought', {
        priority: 'low',
        tags: ['tag1'],
      });

      await thoughtManager.updateThought(thought1.id, {
        status: 'implemented',
        implementedAt: new Date(),
      });

      const stats = thoughtManager.getThoughtStats();

      expect(stats.total).toBe(2);
      expect(stats.byStatus.captured).toBe(1);
      expect(stats.byStatus.implemented).toBe(1);
      expect(stats.byPriority.high).toBe(1);
      expect(stats.byPriority.low).toBe(1);
      expect(stats.byTag.tag1).toBe(2);
      expect(stats.byTag.tag2).toBe(1);
      expect(stats.implementationRate).toBe(0.5);
    });

    it('should handle empty thoughts collection', async () => {
      const stats = thoughtManager.getThoughtStats();

      expect(stats.total).toBe(0);
      expect(stats.implementationRate).toBe(0);
      expect(stats.avgTimeToImplementation).toBe(0);
    });
  });

  describe('getActionableSuggestions', () => {
    beforeEach(async () => {
      (fs.readFile as any).mockRejectedValue({ code: 'ENOENT' });
      await thoughtManager.initialize();
    });

    it('should return actionable suggestions', async () => {
      // High priority thought
      await thoughtManager.captureThought('Critical feature', {
        priority: 'high',
      });

      // Planned thought
      const planned = await thoughtManager.captureThought('Planned feature');
      await thoughtManager.updateThought(planned.id, { status: 'planned' });

      // Medium priority thought needing planning
      await thoughtManager.captureThought('Medium feature', {
        priority: 'medium',
      });

      const suggestions = thoughtManager.getActionableSuggestions();

      expect(suggestions.highPriorityThoughts).toHaveLength(1);
      expect(suggestions.readyToImplement).toHaveLength(1);
      expect(suggestions.needsPlanning).toHaveLength(2);
      expect(suggestions.suggestions).toContain('1 high-priority thoughts need attention');
      expect(suggestions.suggestions).toContain('1 thoughts are ready to implement');
      expect(suggestions.suggestions).toContain('2 thoughts could be planned');
    });
  });

  describe('exportToMarkdown', () => {
    beforeEach(async () => {
      (fs.readFile as any).mockRejectedValue({ code: 'ENOENT' });
      await thoughtManager.initialize();
    });

    it('should export thoughts to markdown format', async () => {
      await thoughtManager.captureThought('Test thought', {
        tags: ['test'],
        priority: 'high',
      });

      const markdown = await thoughtManager.exportToMarkdown();

      expect(markdown).toContain('# Captured Thoughts');
      expect(markdown).toContain('## Statistics');
      expect(markdown).toContain('Total Thoughts**: 1');
      expect(markdown).toContain('Implementation Rate**: 0.0%');
      expect(markdown).toContain('## Captured (1)');
      expect(markdown).toContain('### Test thought');
      expect(markdown).toContain('**Priority**: high');
      expect(markdown).toContain('**Tags**: `test`');
    });

    it('should save markdown to file when outputPath provided', async () => {
      await thoughtManager.captureThought('Test thought');

      const outputPath = '/test/output.md';
      await thoughtManager.exportToMarkdown(outputPath);

      expect(fs.writeFile).toHaveBeenCalledWith(
        outputPath,
        expect.stringContaining('# Captured Thoughts'),
        'utf-8'
      );
    });
  });

  describe('getThoughtsForTask', () => {
    beforeEach(async () => {
      (fs.readFile as any).mockRejectedValue({ code: 'ENOENT' });
      await thoughtManager.initialize();
    });

    it('should return thoughts for specific task', async () => {
      await thoughtManager.captureThought('Related thought', {
        taskId: 'task-123',
      });
      await thoughtManager.captureThought('Unrelated thought');

      const taskThoughts = thoughtManager.getThoughtsForTask('task-123');

      expect(taskThoughts).toHaveLength(1);
      expect(taskThoughts[0].content).toBe('Related thought');
    });
  });
});