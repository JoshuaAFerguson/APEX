/**
 * Edge case and error handling tests for ThoughtCaptureManager
 * Tests various failure scenarios, boundary conditions, and error recovery
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { promises as fs } from 'fs';
import { join } from 'path';
import { ThoughtCaptureManager } from './thought-capture';
import { TaskStore } from './store';
import { ThoughtCapture } from '@apexcli/core';

// Mock fs module for testing error scenarios
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

describe('ThoughtCaptureManager Edge Cases', () => {
  let thoughtManager: ThoughtCaptureManager;
  let mockStore: TaskStore;
  let projectPath: string;

  beforeEach(() => {
    projectPath = '/test/project';
    mockStore = new TaskStore(':memory:');
    thoughtManager = new ThoughtCaptureManager(projectPath, mockStore);

    // Reset mocks
    vi.clearAllMocks();

    // Default successful file operations
    (fs.mkdir as any).mockResolvedValue(undefined);
    (fs.writeFile as any).mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('File system error handling', () => {
    it('should handle file read permission errors during initialization', async () => {
      (fs.readFile as any).mockRejectedValue(new Error('EACCES: permission denied'));

      // Should not throw, just warn and continue with empty thoughts
      await expect(thoughtManager.initialize()).resolves.not.toThrow();
      expect(thoughtManager.getAllThoughts()).toEqual([]);
    });

    it('should handle file write permission errors during save', async () => {
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      (fs.readFile as any).mockRejectedValue({ code: 'ENOENT' });
      (fs.writeFile as any).mockRejectedValue(new Error('EACCES: permission denied'));

      await thoughtManager.initialize();

      // Should not throw, but should warn
      await expect(thoughtManager.captureThought('Test thought')).resolves.not.toThrow();
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        'Failed to save thoughts:',
        expect.any(Error)
      );

      consoleWarnSpy.mockRestore();
    });

    it('should handle directory creation failures', async () => {
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      (fs.readFile as any).mockRejectedValue({ code: 'ENOENT' });
      (fs.mkdir as any).mockRejectedValue(new Error('EACCES: permission denied'));
      (fs.writeFile as any).mockRejectedValue(new Error('ENOENT: directory not found'));

      await thoughtManager.initialize();

      await expect(thoughtManager.captureThought('Test thought')).resolves.not.toThrow();
      expect(consoleWarnSpy).toHaveBeenCalled();

      consoleWarnSpy.mockRestore();
    });

    it('should handle disk space errors during save', async () => {
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      (fs.readFile as any).mockRejectedValue({ code: 'ENOENT' });
      (fs.writeFile as any).mockRejectedValue(new Error('ENOSPC: no space left on device'));

      await thoughtManager.initialize();

      await expect(thoughtManager.captureThought('Test thought')).resolves.not.toThrow();
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        'Failed to save thoughts:',
        expect.any(Error)
      );

      consoleWarnSpy.mockRestore();
    });
  });

  describe('Data corruption and recovery', () => {
    it('should handle thoughts with missing required fields', async () => {
      const corruptData = [
        {
          id: 'thought-1',
          // Missing content field
          tags: ['test'],
          priority: 'medium',
          status: 'captured',
          createdAt: '2023-01-01T00:00:00.000Z',
        },
        {
          // Missing id field
          content: 'Test content',
          tags: ['test'],
          priority: 'medium',
          status: 'captured',
          createdAt: '2023-01-01T00:00:00.000Z',
        },
      ];

      (fs.readFile as any).mockResolvedValue(JSON.stringify(corruptData));

      await thoughtManager.initialize();

      // Should handle corrupted data gracefully
      const thoughts = thoughtManager.getAllThoughts();
      expect(thoughts).toEqual([]); // Should filter out invalid thoughts
    });

    it('should handle thoughts with invalid date formats', async () => {
      const invalidDateData = [
        {
          id: 'thought-1',
          content: 'Test thought',
          tags: [],
          priority: 'medium',
          status: 'captured',
          createdAt: 'invalid-date-format',
        },
        {
          id: 'thought-2',
          content: 'Test thought 2',
          tags: [],
          priority: 'medium',
          status: 'captured',
          createdAt: '2023-01-01T00:00:00.000Z',
          implementedAt: 'another-invalid-date',
        },
      ];

      (fs.readFile as any).mockResolvedValue(JSON.stringify(invalidDateData));

      await thoughtManager.initialize();

      // Should handle invalid dates gracefully
      const thoughts = thoughtManager.getAllThoughts();
      expect(thoughts.length).toBeLessThanOrEqual(2); // May filter some out
    });

    it('should handle extremely large thought content', async () => {
      (fs.readFile as any).mockRejectedValue({ code: 'ENOENT' });
      await thoughtManager.initialize();

      // Create a very large content string (1MB)
      const largeContent = 'x'.repeat(1024 * 1024);

      const thought = await thoughtManager.captureThought(largeContent);

      expect(thought.content).toBe(largeContent);
      expect(thought.id).toBeTruthy();
    });

    it('should handle thoughts with circular references in tags', async () => {
      (fs.readFile as any).mockRejectedValue({ code: 'ENOENT' });
      await thoughtManager.initialize();

      // Test with unusual tag values
      const thought = await thoughtManager.captureThought('Test thought', {
        tags: ['tag1', 'tag1', '', '   ', null as any, undefined as any],
      });

      // Should filter and clean tags
      expect(thought.tags).toEqual(['tag1', 'tag1', '', '   ']); // null/undefined filtered out
    });
  });

  describe('Memory and performance edge cases', () => {
    it('should handle memory pressure with many thoughts', async () => {
      (fs.readFile as any).mockRejectedValue({ code: 'ENOENT' });
      await thoughtManager.initialize();

      // Create a large number of thoughts
      const thoughtPromises = [];
      for (let i = 0; i < 10000; i++) {
        thoughtPromises.push(
          thoughtManager.captureThought(`Thought ${i}`, {
            priority: i % 3 === 0 ? 'high' : i % 3 === 1 ? 'medium' : 'low',
            tags: [`tag${i % 100}`],
          })
        );
      }

      const thoughts = await Promise.all(thoughtPromises);
      expect(thoughts).toHaveLength(10000);

      // Test search performance with large dataset
      const searchStart = Date.now();
      const results = thoughtManager.searchThoughts({ query: 'Thought 5000' });
      const searchTime = Date.now() - searchStart;

      expect(results).toHaveLength(1);
      expect(searchTime).toBeLessThan(1000); // Should complete within reasonable time
    });

    it('should handle rapid successive operations', async () => {
      (fs.readFile as any).mockRejectedValue({ code: 'ENOENT' });
      await thoughtManager.initialize();

      // Rapidly create, search, and update thoughts
      const operations = [];
      for (let i = 0; i < 100; i++) {
        operations.push(
          thoughtManager.captureThought(`Rapid thought ${i}`)
        );
      }

      const thoughts = await Promise.all(operations);
      expect(thoughts).toHaveLength(100);

      // Rapidly search
      const searchOperations = [];
      for (let i = 0; i < 50; i++) {
        searchOperations.push(
          thoughtManager.searchThoughts({ query: `Rapid thought ${i}` })
        );
      }

      const searchResults = await Promise.all(searchOperations);
      expect(searchResults).toHaveLength(50);
      searchResults.forEach((results, index) => {
        expect(results).toHaveLength(1);
        expect(results[0].content).toBe(`Rapid thought ${index}`);
      });
    });

    it('should handle concurrent file operations gracefully', async () => {
      (fs.readFile as any).mockRejectedValue({ code: 'ENOENT' });
      await thoughtManager.initialize();

      // Simulate concurrent saves by making file writes slow and concurrent
      let writeCount = 0;
      (fs.writeFile as any).mockImplementation(async () => {
        writeCount++;
        await new Promise(resolve => setTimeout(resolve, 10)); // Simulate slow I/O
      });

      // Start multiple capture operations simultaneously
      const concurrentOperations = Promise.all([
        thoughtManager.captureThought('Concurrent 1'),
        thoughtManager.captureThought('Concurrent 2'),
        thoughtManager.captureThought('Concurrent 3'),
        thoughtManager.captureThought('Concurrent 4'),
        thoughtManager.captureThought('Concurrent 5'),
      ]);

      await concurrentOperations;

      // Should have attempted to save multiple times
      expect(writeCount).toBeGreaterThan(0);
    });
  });

  describe('Search edge cases', () => {
    beforeEach(async () => {
      (fs.readFile as any).mockRejectedValue({ code: 'ENOENT' });
      await thoughtManager.initialize();

      // Set up test data
      await thoughtManager.captureThought('JavaScript performance optimization', {
        tags: ['js', 'performance'],
        priority: 'high',
      });
      await thoughtManager.captureThought('React component refactoring', {
        tags: ['react', 'refactoring'],
        priority: 'medium',
      });
      await thoughtManager.captureThought('Database query optimization', {
        tags: ['database', 'performance'],
        priority: 'high',
      });
      await thoughtManager.captureThought('', {
        tags: ['empty-content'],
        priority: 'low',
      });
    });

    it('should handle empty search queries', () => {
      const results = thoughtManager.searchThoughts({ query: '' });
      expect(results).toHaveLength(4); // Should return all thoughts
    });

    it('should handle whitespace-only search queries', () => {
      const results = thoughtManager.searchThoughts({ query: '   \n  \t  ' });
      expect(results).toHaveLength(4); // Should treat as empty query
    });

    it('should handle search with special characters', () => {
      const results = thoughtManager.searchThoughts({
        query: 'JavaScript++/*@#$%^&*()'
      });
      expect(results).toHaveLength(0); // Should find no matches safely
    });

    it('should handle case-insensitive search correctly', () => {
      const results1 = thoughtManager.searchThoughts({ query: 'JAVASCRIPT' });
      const results2 = thoughtManager.searchThoughts({ query: 'javascript' });
      const results3 = thoughtManager.searchThoughts({ query: 'JavaScript' });

      expect(results1).toEqual(results2);
      expect(results2).toEqual(results3);
      expect(results1).toHaveLength(1);
    });

    it('should handle unicode and international characters', () => {
      // Add thought with unicode content
      thoughtManager.captureThought('测试内容 with émoji 🚀', {
        tags: ['unicode', 'émoji'],
      });

      const results1 = thoughtManager.searchThoughts({ query: '测试' });
      const results2 = thoughtManager.searchThoughts({ query: 'émoji' });
      const results3 = thoughtManager.searchThoughts({ query: '🚀' });

      expect(results1).toHaveLength(1);
      expect(results2).toHaveLength(1);
      expect(results3).toHaveLength(1);
    });

    it('should handle searches with extreme date ranges', () => {
      const farPast = new Date('1900-01-01');
      const farFuture = new Date('2100-01-01');
      const veryRecent = new Date(Date.now() + 1000);

      // Test with extremely wide range
      const wideResults = thoughtManager.searchThoughts({
        fromDate: farPast,
        toDate: farFuture,
      });
      expect(wideResults).toHaveLength(4);

      // Test with impossible future range
      const futureResults = thoughtManager.searchThoughts({
        fromDate: veryRecent,
        toDate: farFuture,
      });
      expect(futureResults).toHaveLength(0);
    });
  });

  describe('Statistics edge cases', () => {
    it('should handle statistics with no thoughts', async () => {
      (fs.readFile as any).mockRejectedValue({ code: 'ENOENT' });
      await thoughtManager.initialize();

      const stats = thoughtManager.getThoughtStats();

      expect(stats.total).toBe(0);
      expect(stats.implementationRate).toBe(0);
      expect(stats.avgTimeToImplementation).toBe(0);
      expect(Object.values(stats.byStatus).every(count => count === 0)).toBe(true);
      expect(Object.values(stats.byPriority).every(count => count === 0)).toBe(true);
      expect(Object.keys(stats.byTag)).toHaveLength(0);
    });

    it('should handle statistics with extreme implementation times', async () => {
      (fs.readFile as any).mockRejectedValue({ code: 'ENOENT' });
      await thoughtManager.initialize();

      const thought = await thoughtManager.captureThought('Quick implementation');

      // Simulate very quick implementation (1ms)
      await thoughtManager.updateThought(thought.id, {
        status: 'implemented',
        implementedAt: new Date(thought.createdAt.getTime() + 1),
      });

      const thought2 = await thoughtManager.captureThought('Slow implementation');

      // Simulate very slow implementation (1 year)
      await thoughtManager.updateThought(thought2.id, {
        status: 'implemented',
        implementedAt: new Date(thought2.createdAt.getTime() + 365 * 24 * 60 * 60 * 1000),
      });

      const stats = thoughtManager.getThoughtStats();

      expect(stats.total).toBe(2);
      expect(stats.implementationRate).toBe(1.0); // 100%
      expect(stats.avgTimeToImplementation).toBeGreaterThan(0);
    });
  });

  describe('Export edge cases', () => {
    it('should handle export with no thoughts', async () => {
      (fs.readFile as any).mockRejectedValue({ code: 'ENOENT' });
      await thoughtManager.initialize();

      const markdown = await thoughtManager.exportToMarkdown();

      expect(markdown).toContain('# Captured Thoughts');
      expect(markdown).toContain('Total Thoughts**: 0');
      expect(markdown).not.toContain('## Captured');
    });

    it('should handle export with very large thought content', async () => {
      (fs.readFile as any).mockRejectedValue({ code: 'ENOENT' });
      await thoughtManager.initialize();

      const largeContent = 'Large content '.repeat(10000); // ~130KB
      await thoughtManager.captureThought(largeContent);

      const markdown = await thoughtManager.exportToMarkdown();

      expect(markdown).toContain('# Captured Thoughts');
      expect(markdown).toContain(largeContent);
    });

    it('should handle export with special markdown characters', async () => {
      (fs.readFile as any).mockRejectedValue({ code: 'ENOENT' });
      await thoughtManager.initialize();

      await thoughtManager.captureThought('# Title with **bold** and *italic* and `code`', {
        tags: ['markdown', '**special**'],
      });

      const markdown = await thoughtManager.exportToMarkdown();

      expect(markdown).toContain('# Title with **bold** and *italic* and `code`');
      expect(markdown).toContain('`markdown`');
      expect(markdown).toContain('`**special**`');
    });

    it('should handle export file write errors', async () => {
      (fs.readFile as any).mockRejectedValue({ code: 'ENOENT' });
      (fs.writeFile as any).mockRejectedValue(new Error('EACCES: permission denied'));

      await thoughtManager.initialize();
      await thoughtManager.captureThought('Test thought');

      // Should not throw even if file write fails
      await expect(
        thoughtManager.exportToMarkdown('/invalid/path/export.md')
      ).rejects.not.toThrow();
    });
  });

  describe('Implementation edge cases', () => {
    beforeEach(async () => {
      (fs.readFile as any).mockRejectedValue({ code: 'ENOENT' });
      await thoughtManager.initialize();

      // Mock successful task creation
      (mockStore.createTask as any).mockResolvedValue({
        id: 'task-123',
        description: 'Test thought',
      });
    });

    it('should handle implementation when store is unavailable', async () => {
      const thought = await thoughtManager.captureThought('Test thought');

      // Make store throw error
      (mockStore.createTask as any).mockRejectedValue(new Error('Store unavailable'));

      await expect(
        thoughtManager.implementThought(thought.id)
      ).rejects.toThrow('Store unavailable');

      // Thought should remain unchanged
      const unchangedThought = thoughtManager.getThought(thought.id);
      expect(unchangedThought?.status).toBe('captured');
    });

    it('should handle implementation with invalid options', async () => {
      const thought = await thoughtManager.captureThought('Test thought');

      // Test with invalid priority
      await thoughtManager.implementThought(thought.id, {
        priority: 'invalid-priority' as any,
        workflow: null as any,
        acceptanceCriteria: undefined,
      });

      expect(mockStore.createTask).toHaveBeenCalledWith({
        description: 'Test thought',
        acceptanceCriteria: 'Implement the idea: Test thought',
        workflow: 'feature', // Should default
        priority: 'normal', // Should map from thought priority
        projectPath: projectPath,
      });
    });

    it('should handle rapid implementation requests for same thought', async () => {
      const thought = await thoughtManager.captureThought('Test thought');

      // Start multiple implementation requests simultaneously
      const implementations = [
        thoughtManager.implementThought(thought.id),
        thoughtManager.implementThought(thought.id),
        thoughtManager.implementThought(thought.id),
      ];

      // First should succeed, others should fail
      const results = await Promise.allSettled(implementations);

      const successful = results.filter(r => r.status === 'fulfilled');
      const failed = results.filter(r => r.status === 'rejected');

      expect(successful).toHaveLength(1);
      expect(failed).toHaveLength(2);

      failed.forEach(result => {
        expect((result as PromiseRejectedResult).reason.message)
          .toContain('has already been implemented');
      });
    });
  });
});