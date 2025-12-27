/**
 * Template Commands Integration Tests
 *
 * Integration tests that verify the template commands work end-to-end
 * with minimal mocking, testing the complete workflow from CLI commands
 * through orchestrator to database operations and console output.
 *
 * These tests validate:
 * 1. Complete template lifecycle (save -> list -> use -> info -> delete)
 * 2. Real orchestrator and database operations
 * 3. Console output formatting and user feedback
 * 4. Error handling with actual error conditions
 * 5. Edge cases with real data scenarios
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { tmpdir } from 'os';
import { join } from 'path';
import { mkdir, writeFile, rm } from 'fs/promises';
import type { CliContext } from '../index.js';
import { ApexOrchestrator } from '@apexcli/orchestrator';
import type { Task, TaskTemplate } from '@apexcli/core';

// Mock chalk to avoid color codes in tests
vi.mock('chalk', () => ({
  default: {
    blue: (str: string) => str,
    red: (str: string) => str,
    green: (str: string) => str,
    yellow: (str: string) => str,
    gray: (str: string) => str,
    cyan: (str: string) => str,
    bold: (str: string) => str,
    magenta: { bold: (str: string) => str },
    white: { bold: (str: string) => str },
    dim: (str: string) => str,
  },
}));

// Capture console output for validation
let consoleOutput: string[] = [];
const originalConsoleLog = console.log;

const mockConsoleLog = (...args: any[]) => {
  consoleOutput.push(args.map(arg => String(arg)).join(' '));
};

describe('Template Commands Integration Tests', () => {
  let tempProjectPath: string;
  let mockContext: CliContext;
  let realOrchestrator: ApexOrchestrator;
  let templateCommand: any;

  beforeEach(async () => {
    // Reset console output capture
    consoleOutput = [];
    console.log = mockConsoleLog;

    // Create temporary project directory
    tempProjectPath = join(tmpdir(), `apex-template-integration-${Date.now()}`);
    await mkdir(tempProjectPath, { recursive: true });

    // Create APEX configuration
    const apexDir = join(tempProjectPath, '.apex');
    await mkdir(apexDir, { recursive: true });

    await writeFile(
      join(apexDir, 'config.yaml'),
      `project:
  name: Template Integration Test
  description: Integration test project for template commands
agents: {}
workflows: {}
limits:
  maxTokensPerTask: 100000
  maxCostPerTask: 10.0
  dailyBudget: 100.0
  timeoutMs: 300000
autonomy:
  default: medium
  autoApprove: false`
    );

    // Create real orchestrator instance
    realOrchestrator = new ApexOrchestrator({ projectPath: tempProjectPath });
    await realOrchestrator.initialize();

    mockContext = {
      cwd: tempProjectPath,
      initialized: true,
      config: {
        project: { name: 'Template Integration Test' },
        agents: {},
        workflows: {},
        limits: { maxTokensPerTask: 100000 },
        autonomy: { default: 'medium' },
      },
      orchestrator: realOrchestrator,
      apiProcess: null,
      webUIProcess: null,
      apiPort: 3000,
      webUIPort: 3001,
    };

    // Import template command
    const { commands } = await import('../index.js');
    templateCommand = commands.find(cmd => cmd.name === 'template');
  });

  afterEach(async () => {
    console.log = originalConsoleLog;
    vi.clearAllMocks();

    // Clean up orchestrator
    if (realOrchestrator) {
      try {
        await realOrchestrator.close();
      } catch (error) {
        console.warn('Failed to close orchestrator in cleanup:', error);
      }
    }

    // Clean up temp directory
    if (tempProjectPath) {
      try {
        await rm(tempProjectPath, { recursive: true, force: true });
      } catch (error) {
        console.warn('Failed to clean up temp directory:', error);
      }
    }
  });

  describe('Complete Template Lifecycle Integration', () => {
    it('should complete full template lifecycle: create task -> save template -> list -> use -> info -> delete', async () => {
      // 1. Create a task to use as template source
      const sourceTask = await realOrchestrator.createTask({
        description: 'Integration test task for template lifecycle',
        workflow: 'feature',
        acceptanceCriteria: 'Should complete full lifecycle successfully',
        priority: 'high',
        effort: 'large',
        tags: ['integration', 'test', 'lifecycle'],
      });

      // 2. Save task as template
      consoleOutput = [];
      await templateCommand?.handler(mockContext, ['save', sourceTask.id, 'Lifecycle Integration Template']);

      let output = consoleOutput.join('\n');
      expect(output).toContain('✅ Template saved successfully');
      expect(output).toContain('Lifecycle Integration Template');

      const templateIdMatch = output.match(/Template ID: (template_[a-z0-9]+)/);
      expect(templateIdMatch).toBeTruthy();
      const templateId = templateIdMatch![1];

      // 3. List templates and verify it appears
      consoleOutput = [];
      await templateCommand?.handler(mockContext, ['list']);

      output = consoleOutput.join('\n');
      expect(output).toContain('📋 Available Templates (1)');
      expect(output).toContain('Lifecycle Integration Template');
      expect(output).toContain(templateId);

      // 4. Get detailed template info
      consoleOutput = [];
      await templateCommand?.handler(mockContext, ['info', templateId]);

      output = consoleOutput.join('\n');
      expect(output).toContain('📋 Template Information');
      expect(output).toContain('Lifecycle Integration Template');
      expect(output).toContain('Integration test task for template lifecycle');
      expect(output).toContain('feature');
      expect(output).toContain('high');
      expect(output).toContain('large');
      expect(output).toContain('integration, test, lifecycle');

      // 5. Use template to create new task
      consoleOutput = [];
      await templateCommand?.handler(mockContext, ['use', templateId]);

      output = consoleOutput.join('\n');
      expect(output).toContain('✅ Created task from template successfully');

      const newTaskIdMatch = output.match(/Task ID: (task_[a-z0-9]+)/);
      expect(newTaskIdMatch).toBeTruthy();
      const newTaskId = newTaskIdMatch![1];

      // 6. Verify new task has template properties
      const newTask = await realOrchestrator.getTask(newTaskId);
      expect(newTask).toBeDefined();
      expect(newTask?.description).toBe(sourceTask.description);
      expect(newTask?.workflow).toBe(sourceTask.workflow);
      expect(newTask?.priority).toBe(sourceTask.priority);
      expect(newTask?.effort).toBe(sourceTask.effort);
      expect(newTask?.tags).toEqual(sourceTask.tags);

      // 7. Use template by name instead of ID
      consoleOutput = [];
      await templateCommand?.handler(mockContext, ['use', 'Lifecycle Integration Template']);

      output = consoleOutput.join('\n');
      expect(output).toContain('✅ Created task from template successfully');

      // 8. Delete the template
      consoleOutput = [];
      await templateCommand?.handler(mockContext, ['delete', templateId]);

      output = consoleOutput.join('\n');
      expect(output).toContain('✅ Template deleted successfully');
      expect(output).toContain('Lifecycle Integration Template');

      // 9. Verify template is gone
      consoleOutput = [];
      await templateCommand?.handler(mockContext, ['list']);

      output = consoleOutput.join('\n');
      expect(output).toContain('No templates found');

      // 10. Verify tasks still exist after template deletion
      const existingTask1 = await realOrchestrator.getTask(newTaskId);
      expect(existingTask1).toBeDefined();
    });

    it('should handle multiple templates with complex workflows', async () => {
      // Create multiple diverse tasks
      const tasks = await Promise.all([
        realOrchestrator.createTask({
          description: 'Feature development task',
          workflow: 'feature',
          acceptanceCriteria: 'Implement user authentication',
          priority: 'high',
          effort: 'xl',
          tags: ['feature', 'auth', 'security'],
        }),
        realOrchestrator.createTask({
          description: 'Bug fix task',
          workflow: 'bugfix',
          acceptanceCriteria: 'Fix memory leak in data processor',
          priority: 'urgent',
          effort: 'medium',
          tags: ['bugfix', 'performance'],
        }),
        realOrchestrator.createTask({
          description: 'Documentation update',
          workflow: 'docs',
          priority: 'low',
          effort: 'small',
          tags: ['docs'],
        }),
      ]);

      // Save all as templates
      const templateNames = ['Auth Feature Template', 'Performance Fix Template', 'Docs Template'];
      const templateIds: string[] = [];

      for (let i = 0; i < tasks.length; i++) {
        consoleOutput = [];
        await templateCommand?.handler(mockContext, ['save', tasks[i].id, templateNames[i]]);

        const output = consoleOutput.join('\n');
        const templateIdMatch = output.match(/Template ID: (template_[a-z0-9]+)/);
        templateIds.push(templateIdMatch![1]);
      }

      // List all templates and verify sorting
      consoleOutput = [];
      await templateCommand?.handler(mockContext, ['list']);

      const output = consoleOutput.join('\n');
      expect(output).toContain('📋 Available Templates (3)');

      // Templates should be sorted alphabetically
      const authIndex = output.indexOf('Auth Feature Template');
      const docsIndex = output.indexOf('Docs Template');
      const perfIndex = output.indexOf('Performance Fix Template');

      expect(authIndex).toBeGreaterThan(0);
      expect(docsIndex).toBeGreaterThan(authIndex);
      expect(perfIndex).toBeGreaterThan(docsIndex);

      // Use each template and verify properties
      for (let i = 0; i < templateIds.length; i++) {
        consoleOutput = [];
        await templateCommand?.handler(mockContext, ['use', templateIds[i]]);

        const useOutput = consoleOutput.join('\n');
        const newTaskIdMatch = useOutput.match(/Task ID: (task_[a-z0-9]+)/);
        const newTaskId = newTaskIdMatch![1];

        const newTask = await realOrchestrator.getTask(newTaskId);
        const sourceTask = tasks[i];

        expect(newTask?.description).toBe(sourceTask.description);
        expect(newTask?.workflow).toBe(sourceTask.workflow);
        expect(newTask?.priority).toBe(sourceTask.priority);
        expect(newTask?.effort).toBe(sourceTask.effort);
        expect(newTask?.tags).toEqual(sourceTask.tags);
      }
    });
  });

  describe('Template Command Error Handling Integration', () => {
    it('should gracefully handle database errors and recovery', async () => {
      // Create a template first
      const task = await realOrchestrator.createTask({
        description: 'Error handling test task',
        workflow: 'test',
      });

      consoleOutput = [];
      await templateCommand?.handler(mockContext, ['save', task.id, 'Error Test Template']);

      let output = consoleOutput.join('\n');
      const templateIdMatch = output.match(/Template ID: (template_[a-z0-9]+)/);
      const templateId = templateIdMatch![1];

      // Try to use non-existent template
      consoleOutput = [];
      await templateCommand?.handler(mockContext, ['use', 'non-existent-id']);

      output = consoleOutput.join('\n');
      expect(output).toContain('❌ Error:');
      expect(output).toContain('Template not found');

      // Try to delete non-existent template
      consoleOutput = [];
      await templateCommand?.handler(mockContext, ['delete', 'non-existent-id']);

      output = consoleOutput.join('\n');
      expect(output).toContain('❌ Error:');
      expect(output).toContain('Template not found');

      // Try to get info for non-existent template
      consoleOutput = [];
      await templateCommand?.handler(mockContext, ['info', 'non-existent-id']);

      output = consoleOutput.join('\n');
      expect(output).toContain('❌ Error:');
      expect(output).toContain('Template not found');

      // Verify existing template still works
      consoleOutput = [];
      await templateCommand?.handler(mockContext, ['use', templateId]);

      output = consoleOutput.join('\n');
      expect(output).toContain('✅ Created task from template successfully');
    });

    it('should handle concurrent template operations correctly', async () => {
      // Create multiple tasks
      const tasks = await Promise.all(
        Array.from({ length: 5 }, (_, i) =>
          realOrchestrator.createTask({
            description: `Concurrent test task ${i + 1}`,
            workflow: 'test',
          })
        )
      );

      // Save templates concurrently
      const savePromises = tasks.map((task, i) =>
        templateCommand?.handler(mockContext, ['save', task.id, `Concurrent Template ${i + 1}`])
      );

      await Promise.all(savePromises);

      // List templates and verify all were created
      consoleOutput = [];
      await templateCommand?.handler(mockContext, ['list']);

      const output = consoleOutput.join('\n');
      expect(output).toContain('Available Templates (5)');

      for (let i = 1; i <= 5; i++) {
        expect(output).toContain(`Concurrent Template ${i}`);
      }

      // Use templates concurrently
      const templates = await realOrchestrator.listTemplates();
      const usePromises = templates.map(template =>
        templateCommand?.handler(mockContext, ['use', template.id])
      );

      await Promise.all(usePromises);

      // Verify all tasks were created
      const allTasks = await realOrchestrator.listTasks();
      expect(allTasks.filter(t => t.description.includes('Concurrent test task')).length).toBe(10); // 5 original + 5 from templates
    });
  });

  describe('Template Command User Experience Integration', () => {
    it('should provide helpful feedback and guidance throughout workflow', async () => {
      // Empty state: No templates exist
      consoleOutput = [];
      await templateCommand?.handler(mockContext, ['list']);

      let output = consoleOutput.join('\n');
      expect(output).toContain('No templates found');
      expect(output).toContain('Use /template save <taskId> <name> to create a template');

      // Help: No subcommand provided
      consoleOutput = [];
      await templateCommand?.handler(mockContext, []);

      output = consoleOutput.join('\n');
      expect(output).toContain('Template Management Commands');
      expect(output).toContain('/template save <taskId> <name>');
      expect(output).toContain('/template list');
      expect(output).toContain('/template use <templateId|name>');

      // Create task and template
      const task = await realOrchestrator.createTask({
        description: 'User experience test task',
        workflow: 'feature',
        acceptanceCriteria: 'Should provide excellent UX feedback',
        tags: ['ux', 'feedback'],
      });

      consoleOutput = [];
      await templateCommand?.handler(mockContext, ['save', task.id, 'UX Test Template']);

      output = consoleOutput.join('\n');
      expect(output).toContain('✅ Template saved successfully');
      expect(output).toContain('UX Test Template');
      expect(output).toMatch(/Template ID: template_/);

      // List with helpful information
      consoleOutput = [];
      await templateCommand?.handler(mockContext, ['list']);

      output = consoleOutput.join('\n');
      expect(output).toContain('📋 Available Templates (1)');
      expect(output).toContain('Use /template use <id> to create a task from a template');
      expect(output).toContain('Use /template info <id> for detailed information');

      // Use template with confirmation
      const templateIdMatch = output.match(/ID:\s+(template_[a-z0-9]+)/);
      const templateId = templateIdMatch![1];

      consoleOutput = [];
      await templateCommand?.handler(mockContext, ['use', templateId]);

      output = consoleOutput.join('\n');
      expect(output).toContain('✅ Created task from template successfully');
      expect(output).toContain('UX Test Template');
      expect(output).toMatch(/Task ID: task_/);

      // Info command provides comprehensive details
      consoleOutput = [];
      await templateCommand?.handler(mockContext, ['info', templateId]);

      output = consoleOutput.join('\n');
      expect(output).toContain('📋 Template Information');
      expect(output).toContain('Usage:');
      expect(output).toContain('/template use');
      expect(output).toContain('Should provide excellent UX feedback');

      // Delete with confirmation
      consoleOutput = [];
      await templateCommand?.handler(mockContext, ['delete', templateId]);

      output = consoleOutput.join('\n');
      expect(output).toContain('✅ Template deleted successfully');
      expect(output).toContain('UX Test Template');
    });

    it('should handle edge cases in user input gracefully', async () => {
      const task = await realOrchestrator.createTask({
        description: 'Edge case test task',
        workflow: 'test',
      });

      // Test various edge cases
      const edgeCases = [
        // Empty subcommand
        { args: [], expectedError: 'Template Management Commands' },
        // Invalid subcommand
        { args: ['invalid'], expectedError: 'Unknown template command: invalid' },
        // Save without enough args
        { args: ['save'], expectedError: 'Usage: /template save <taskId> <name>' },
        { args: ['save', task.id], expectedError: 'Usage: /template save <taskId> <name>' },
        // Use without args
        { args: ['use'], expectedError: 'Usage: /template use <templateId|name>' },
        // Delete without args
        { args: ['delete'], expectedError: 'Usage: /template delete <templateId>' },
        // Info without args
        { args: ['info'], expectedError: 'Usage: /template info <templateId>' },
      ];

      for (const edgeCase of edgeCases) {
        consoleOutput = [];
        await templateCommand?.handler(mockContext, edgeCase.args);

        const output = consoleOutput.join('\n');
        expect(output).toContain(edgeCase.expectedError);
      }

      // Test successful edge case: very long template name
      const longName = 'A'.repeat(100);
      consoleOutput = [];
      await templateCommand?.handler(mockContext, ['save', task.id, longName]);

      let output = consoleOutput.join('\n');
      expect(output).toContain('✅ Template saved successfully');
      expect(output).toContain(longName);
    });
  });

  describe('Template Data Integrity Integration', () => {
    it('should maintain data consistency across operations', async () => {
      // Create a comprehensive task
      const originalTask = await realOrchestrator.createTask({
        description: 'Comprehensive data integrity test task',
        workflow: 'feature',
        acceptanceCriteria: 'Should maintain all data through template operations',
        priority: 'urgent',
        effort: 'xl',
        tags: ['data', 'integrity', 'comprehensive', 'test'],
      });

      // Save as template
      consoleOutput = [];
      await templateCommand?.handler(mockContext, ['save', originalTask.id, 'Data Integrity Template']);

      const saveOutput = consoleOutput.join('\n');
      const templateIdMatch = saveOutput.match(/Template ID: (template_[a-z0-9]+)/);
      const templateId = templateIdMatch![1];

      // Verify template stored correctly
      const storedTemplate = await realOrchestrator.listTemplates();
      const template = storedTemplate.find(t => t.id === templateId)!;

      expect(template.name).toBe('Data Integrity Template');
      expect(template.description).toBe(originalTask.description);
      expect(template.workflow).toBe(originalTask.workflow);
      expect(template.acceptanceCriteria).toBe(originalTask.acceptanceCriteria);
      expect(template.priority).toBe(originalTask.priority);
      expect(template.effort).toBe(originalTask.effort);
      expect(template.tags).toEqual(originalTask.tags);

      // Create task from template
      consoleOutput = [];
      await templateCommand?.handler(mockContext, ['use', templateId]);

      const useOutput = consoleOutput.join('\n');
      const newTaskIdMatch = useOutput.match(/Task ID: (task_[a-z0-9]+)/);
      const newTaskId = newTaskIdMatch![1];

      // Verify new task has all original properties
      const newTask = await realOrchestrator.getTask(newTaskId);
      expect(newTask?.description).toBe(originalTask.description);
      expect(newTask?.workflow).toBe(originalTask.workflow);
      expect(newTask?.acceptanceCriteria).toBe(originalTask.acceptanceCriteria);
      expect(newTask?.priority).toBe(originalTask.priority);
      expect(newTask?.effort).toBe(originalTask.effort);
      expect(newTask?.tags).toEqual(originalTask.tags);

      // Verify new task has unique ID and timestamps
      expect(newTask?.id).not.toBe(originalTask.id);
      expect(newTask?.createdAt).toBeInstanceOf(Date);
      expect(newTask?.updatedAt).toBeInstanceOf(Date);
    });
  });
});