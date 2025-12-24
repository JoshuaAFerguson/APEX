/**
 * Integration tests for thought capture functionality in ApexOrchestrator
 * Tests the end-to-end integration between orchestrator and thought capture manager
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { promises as fs } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { ApexOrchestrator } from './index';
import { ThoughtCapture } from '@apexcli/core';

describe('ApexOrchestrator Thought Integration', () => {
  let orchestrator: ApexOrchestrator;
  let projectPath: string;
  let thoughtsFile: string;

  beforeEach(async () => {
    // Create a temporary directory for testing
    projectPath = join(tmpdir(), `apex-test-${Date.now()}`);
    await fs.mkdir(projectPath, { recursive: true });
    await fs.mkdir(join(projectPath, '.apex'), { recursive: true });

    thoughtsFile = join(projectPath, '.apex', 'thoughts.json');

    // Initialize orchestrator
    orchestrator = new ApexOrchestrator({ projectPath });
    await orchestrator.initialize();
  });

  afterEach(async () => {
    try {
      await orchestrator.close();
      await fs.rm(projectPath, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('Thought capture workflow', () => {
    it('should capture, persist, and retrieve thoughts', async () => {
      // Capture a thought
      const thought = await orchestrator.captureThought('Implement user authentication', {
        priority: 'high',
        tags: ['security', 'backend'],
      });

      expect(thought.id).toMatch(/^thought-/);
      expect(thought.content).toBe('Implement user authentication');
      expect(thought.priority).toBe('high');
      expect(thought.tags).toEqual(['security', 'backend']);
      expect(thought.status).toBe('captured');

      // Verify persistence
      const fileExists = await fs.access(thoughtsFile).then(() => true).catch(() => false);
      expect(fileExists).toBe(true);

      // Retrieve thoughts
      const allThoughts = await orchestrator.getAllThoughts();
      expect(allThoughts).toHaveLength(1);
      expect(allThoughts[0].id).toBe(thought.id);
    });

    it('should handle multiple thoughts with different priorities', async () => {
      // Capture multiple thoughts
      const thought1 = await orchestrator.captureThought('Fix critical bug', {
        priority: 'high',
        tags: ['bug', 'critical'],
      });

      const thought2 = await orchestrator.captureThought('Add nice-to-have feature', {
        priority: 'low',
        tags: ['enhancement'],
      });

      const thought3 = await orchestrator.captureThought('Refactor codebase', {
        priority: 'medium',
        tags: ['refactoring'],
      });

      // Verify all thoughts are captured
      const allThoughts = await orchestrator.getAllThoughts();
      expect(allThoughts).toHaveLength(3);

      // Verify sorting by creation date (newest first)
      expect(allThoughts[0].id).toBe(thought3.id);
      expect(allThoughts[1].id).toBe(thought2.id);
      expect(allThoughts[2].id).toBe(thought1.id);
    });

    it('should search thoughts by content and tags', async () => {
      // Setup test data
      await orchestrator.captureThought('Implement authentication system', {
        tags: ['auth', 'security'],
      });

      await orchestrator.captureThought('Add authorization middleware', {
        tags: ['auth', 'middleware'],
      });

      await orchestrator.captureThought('Create user interface', {
        tags: ['ui', 'frontend'],
      });

      // Search by content
      const authResults = await orchestrator.searchThoughts({
        query: 'authentication',
      });
      expect(authResults).toHaveLength(1);
      expect(authResults[0].content).toContain('authentication');

      // Search by tag
      const uiResults = await orchestrator.searchThoughts({
        query: 'ui',
      });
      expect(uiResults).toHaveLength(1);
      expect(uiResults[0].content).toContain('interface');

      // Search with no results
      const noResults = await orchestrator.searchThoughts({
        query: 'nonexistent',
      });
      expect(noResults).toHaveLength(0);
    });

    it('should promote thought to task', async () => {
      // Mock task creation
      const mockCreateTask = vi.spyOn(orchestrator['store'], 'createTask');
      mockCreateTask.mockResolvedValue({
        id: 'task-123',
        description: 'Test feature implementation',
        status: 'pending',
        workflow: 'feature',
        autonomy: 'medium',
        priority: 'normal',
        branchName: 'feature/test-branch',
        acceptanceCriteria: 'Implement the idea: Test feature implementation',
        createdAt: new Date(),
        updatedAt: new Date(),
        logs: [],
        stages: [],
        usage: {
          totalTokens: 0,
          estimatedCost: 0,
        },
        projectPath: projectPath,
      });

      // Capture a thought
      const thought = await orchestrator.captureThought('Test feature implementation', {
        priority: 'high',
      });

      // Promote to task
      const taskId = await orchestrator.promoteThought(thought.id, {
        workflow: 'feature',
        priority: 'high',
      });

      expect(taskId).toBe('task-123');
      expect(mockCreateTask).toHaveBeenCalledWith({
        description: 'Test feature implementation',
        acceptanceCriteria: 'Implement the idea: Test feature implementation',
        workflow: 'feature',
        priority: 'high',
        projectPath: projectPath,
      });

      // Verify thought status updated
      const updatedThought = orchestrator['thoughtCaptureManager'].getThought(thought.id);
      expect(updatedThought?.status).toBe('implemented');
      expect(updatedThought?.taskId).toBe('task-123');
      expect(updatedThought?.implementedAt).toBeInstanceOf(Date);

      mockCreateTask.mockRestore();
    });

    it('should generate thought statistics', async () => {
      // Create test thoughts
      await orchestrator.captureThought('High priority task', {
        priority: 'high',
        tags: ['important'],
      });

      await orchestrator.captureThought('Medium priority task', {
        priority: 'medium',
        tags: ['normal'],
      });

      await orchestrator.captureThought('Low priority task', {
        priority: 'low',
        tags: ['nice-to-have'],
      });

      await orchestrator.captureThought('Another high priority task', {
        priority: 'high',
        tags: ['important', 'urgent'],
      });

      // Get statistics
      const stats = await orchestrator.getThoughtStats();

      expect(stats.total).toBe(4);
      expect(stats.byPriority.high).toBe(2);
      expect(stats.byPriority.medium).toBe(1);
      expect(stats.byPriority.low).toBe(1);
      expect(stats.byTag.important).toBe(2);
      expect(stats.byTag.urgent).toBe(1);
      expect(stats.implementationRate).toBe(0); // No implemented thoughts yet
    });

    it('should export thoughts to markdown', async () => {
      // Create test thoughts
      await orchestrator.captureThought('Feature A', {
        priority: 'high',
        tags: ['feature'],
      });

      await orchestrator.captureThought('Bug fix B', {
        priority: 'medium',
        tags: ['bug'],
      });

      // Export without file
      const markdown = await orchestrator.exportThoughtsToMarkdown();

      expect(markdown).toContain('# Captured Thoughts');
      expect(markdown).toContain('## Statistics');
      expect(markdown).toContain('Total Thoughts**: 2');
      expect(markdown).toContain('Feature A');
      expect(markdown).toContain('Bug fix B');

      // Export to file
      const outputPath = join(projectPath, 'test-export.md');
      const fileMarkdown = await orchestrator.exportThoughtsToMarkdown(outputPath);

      expect(fileMarkdown).toBe(markdown);

      // Verify file was created
      const fileContent = await fs.readFile(outputPath, 'utf-8');
      expect(fileContent).toBe(markdown);
    });
  });

  describe('Error handling and edge cases', () => {
    it('should handle empty content gracefully', async () => {
      await expect(
        orchestrator.captureThought('', { priority: 'medium' })
      ).rejects.not.toThrow(); // Should handle empty content by trimming and processing
    });

    it('should handle whitespace-only content', async () => {
      const thought = await orchestrator.captureThought('   \n   ', {
        priority: 'low',
      });

      expect(thought.content).toBe(''); // Should be trimmed to empty
    });

    it('should handle invalid priority gracefully', async () => {
      const thought = await orchestrator.captureThought('Test thought', {
        priority: 'invalid' as any,
      });

      // Should use default priority
      expect(thought.priority).toBe('medium');
    });

    it('should handle missing tags gracefully', async () => {
      const thought = await orchestrator.captureThought('Test thought');

      expect(thought.tags).toEqual([]);
    });

    it('should handle promotion of non-existent thought', async () => {
      await expect(
        orchestrator.promoteThought('non-existent-id')
      ).rejects.toThrow('Thought non-existent-id not found');
    });

    it('should prevent promoting already implemented thought', async () => {
      // Mock task creation for first promotion
      const mockCreateTask = vi.spyOn(orchestrator['store'], 'createTask');
      mockCreateTask.mockResolvedValue({
        id: 'task-123',
        description: 'Test thought',
        status: 'pending',
        workflow: 'feature',
        autonomy: 'medium',
        priority: 'normal',
        branchName: 'feature/test',
        acceptanceCriteria: 'Test criteria',
        createdAt: new Date(),
        updatedAt: new Date(),
        logs: [],
        stages: [],
        usage: { totalTokens: 0, estimatedCost: 0 },
        projectPath: projectPath,
      });

      const thought = await orchestrator.captureThought('Test thought');
      await orchestrator.promoteThought(thought.id);

      // Try to promote again
      await expect(
        orchestrator.promoteThought(thought.id)
      ).rejects.toThrow('has already been implemented');

      mockCreateTask.mockRestore();
    });
  });

  describe('Persistence and recovery', () => {
    it('should persist thoughts across orchestrator restarts', async () => {
      // Capture thoughts
      const thought1 = await orchestrator.captureThought('Persistent thought 1', {
        priority: 'high',
        tags: ['persistence'],
      });

      const thought2 = await orchestrator.captureThought('Persistent thought 2', {
        priority: 'low',
        tags: ['test'],
      });

      // Close and recreate orchestrator
      await orchestrator.close();

      const newOrchestrator = new ApexOrchestrator({ projectPath });
      await newOrchestrator.initialize();

      // Verify thoughts are still available
      const allThoughts = await newOrchestrator.getAllThoughts();
      expect(allThoughts).toHaveLength(2);

      const foundThought1 = allThoughts.find(t => t.id === thought1.id);
      const foundThought2 = allThoughts.find(t => t.id === thought2.id);

      expect(foundThought1).toBeDefined();
      expect(foundThought1?.content).toBe('Persistent thought 1');
      expect(foundThought2).toBeDefined();
      expect(foundThought2?.content).toBe('Persistent thought 2');

      await newOrchestrator.close();
    });

    it('should handle corrupted thoughts file gracefully', async () => {
      // Write invalid JSON to thoughts file
      await fs.writeFile(thoughtsFile, 'invalid json content');

      // Create new orchestrator - should handle corrupted file
      const newOrchestrator = new ApexOrchestrator({ projectPath });
      await newOrchestrator.initialize();

      // Should start with empty thoughts
      const thoughts = await newOrchestrator.getAllThoughts();
      expect(thoughts).toEqual([]);

      // Should be able to capture new thoughts
      const newThought = await newOrchestrator.captureThought('Recovery test');
      expect(newThought.content).toBe('Recovery test');

      await newOrchestrator.close();
    });

    it('should handle missing thoughts file', async () => {
      // Ensure thoughts file doesn't exist
      try {
        await fs.unlink(thoughtsFile);
      } catch {
        // Ignore if file doesn't exist
      }

      // Create orchestrator - should handle missing file
      const newOrchestrator = new ApexOrchestrator({ projectPath });
      await newOrchestrator.initialize();

      // Should start with empty thoughts
      const thoughts = await newOrchestrator.getAllThoughts();
      expect(thoughts).toEqual([]);

      // Should be able to capture new thoughts
      const newThought = await newOrchestrator.captureThought('New thought');
      expect(newThought.content).toBe('New thought');

      await newOrchestrator.close();
    });
  });

  describe('Performance considerations', () => {
    it('should handle large numbers of thoughts efficiently', async () => {
      const startTime = Date.now();

      // Create 100 thoughts
      const thoughts = [];
      for (let i = 0; i < 100; i++) {
        const thought = await orchestrator.captureThought(`Thought ${i}`, {
          priority: i % 3 === 0 ? 'high' : i % 3 === 1 ? 'medium' : 'low',
          tags: [`tag${i % 10}`, `category${i % 5}`],
        });
        thoughts.push(thought);
      }

      const captureTime = Date.now() - startTime;
      expect(captureTime).toBeLessThan(5000); // Should complete in reasonable time

      // Test retrieval performance
      const retrievalStart = Date.now();
      const allThoughts = await orchestrator.getAllThoughts();
      const retrievalTime = Date.now() - retrievalStart;

      expect(allThoughts).toHaveLength(100);
      expect(retrievalTime).toBeLessThan(100); // Retrieval should be fast

      // Test search performance
      const searchStart = Date.now();
      const searchResults = await orchestrator.searchThoughts({
        query: 'Thought 5',
      });
      const searchTime = Date.now() - searchStart;

      expect(searchResults).toHaveLength(1); // Should find "Thought 5", "Thought 50", etc.
      expect(searchTime).toBeLessThan(100); // Search should be fast
    });

    it('should handle concurrent thought operations', async () => {
      // Create multiple concurrent operations
      const operations = Promise.all([
        orchestrator.captureThought('Concurrent thought 1'),
        orchestrator.captureThought('Concurrent thought 2'),
        orchestrator.captureThought('Concurrent thought 3'),
      ]);

      const results = await operations;

      expect(results).toHaveLength(3);
      results.forEach(thought => {
        expect(thought.id).toMatch(/^thought-/);
        expect(thought.status).toBe('captured');
      });

      // Verify all thoughts were saved
      const allThoughts = await orchestrator.getAllThoughts();
      expect(allThoughts).toHaveLength(3);
    });
  });
});