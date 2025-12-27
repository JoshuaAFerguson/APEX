/**
 * Template Commands Tests
 *
 * Comprehensive tests for all template management CLI commands:
 * - /template save <taskId> <name>
 * - /template list
 * - /template use <templateId|name>
 * - /template delete <templateId>
 * - /template info <templateId>
 *
 * Tests cover:
 * - Command parsing and validation
 * - Error handling for invalid inputs
 * - Integration with orchestrator template API
 * - Output formatting and user feedback
 * - Edge cases and boundary conditions
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { tmpdir } from 'os';
import { join } from 'path';
import { mkdir, writeFile, rm } from 'fs/promises';
import type { CliContext } from '../index.js';
import { ApexOrchestrator } from '@apexcli/orchestrator';
import { Task, TaskTemplate } from '@apexcli/core';

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

describe('Template Commands Tests', () => {
  let tempProjectPath: string;
  let mockContext: CliContext;
  let realOrchestrator: ApexOrchestrator;

  beforeEach(async () => {
    // Reset console output capture
    consoleOutput = [];
    console.log = mockConsoleLog;

    // Create temporary project directory
    tempProjectPath = join(tmpdir(), `apex-template-test-${Date.now()}`);
    await mkdir(tempProjectPath, { recursive: true });

    // Create APEX configuration
    const apexDir = join(tempProjectPath, '.apex');
    await mkdir(apexDir, { recursive: true });

    const config = {
      project: {
        name: 'Template Test Project',
        description: 'Test project for template commands',
      },
      agents: {},
      workflows: {},
      limits: {
        maxTokensPerTask: 100000,
        maxCostPerTask: 10.0,
        dailyBudget: 100.0,
        timeoutMs: 300000,
      },
      autonomy: {
        default: 'medium',
        autoApprove: false,
      },
      api: {
        url: 'http://localhost:3000',
        port: 3000,
      },
      models: {
        planning: 'opus',
        implementation: 'sonnet',
        review: 'haiku',
      },
    };

    await writeFile(
      join(apexDir, 'config.yaml'),
      `project:
  name: Template Test Project
  description: Test project for template commands
agents: {}
workflows: {}
limits:
  maxTokensPerTask: 100000
  maxCostPerTask: 10.0
  dailyBudget: 100.0
  timeoutMs: 300000
autonomy:
  default: medium
  autoApprove: false
api:
  url: http://localhost:3000
  port: 3000
models:
  planning: opus
  implementation: sonnet
  review: haiku`
    );

    // Create real orchestrator instance
    realOrchestrator = new ApexOrchestrator({ projectPath: tempProjectPath });
    await realOrchestrator.initialize();

    mockContext = {
      cwd: tempProjectPath,
      initialized: true,
      config,
      orchestrator: realOrchestrator,
      apiProcess: null,
      webUIProcess: null,
      apiPort: 3000,
      webUIPort: 3001,
    };
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

  describe('/template save command', () => {
    let testTask: Task;

    beforeEach(async () => {
      // Create a test task that can be saved as a template
      testTask = await realOrchestrator.createTask({
        description: 'Test task for template creation',
        workflow: 'feature',
        acceptanceCriteria: 'Should be saved as a template successfully',
        priority: 'high',
        effort: 'large',
        tags: ['test', 'template', 'save'],
      });
    });

    it('should save a task as a template with valid inputs', async () => {
      const { commands } = await import('../index.js');
      const templateCommand = commands.find(cmd => cmd.name === 'template');

      consoleOutput = [];
      await templateCommand?.handler(mockContext, ['save', testTask.id, 'Test Template']);

      const output = consoleOutput.join('\n');
      expect(output).toContain('✅ Template saved successfully');
      expect(output).toContain('Test Template');
      expect(output).toMatch(/Template ID: template_/);
    });

    it('should handle saving template with special characters in name', async () => {
      const { commands } = await import('../index.js');
      const templateCommand = commands.find(cmd => cmd.name === 'template');

      const specialName = 'Template with "quotes" & symbols! 🚀';
      consoleOutput = [];
      await templateCommand?.handler(mockContext, ['save', testTask.id, specialName]);

      const output = consoleOutput.join('\n');
      expect(output).toContain('✅ Template saved successfully');
      expect(output).toContain(specialName);
    });

    it('should trim whitespace from template name', async () => {
      const { commands } = await import('../index.js');
      const templateCommand = commands.find(cmd => cmd.name === 'template');

      consoleOutput = [];
      await templateCommand?.handler(mockContext, ['save', testTask.id, '  Whitespace Template  ']);

      const output = consoleOutput.join('\n');
      expect(output).toContain('✅ Template saved successfully');
      expect(output).toContain('Whitespace Template');
      expect(output).not.toContain('  Whitespace Template  ');
    });

    it('should show error with missing arguments', async () => {
      const { commands } = await import('../index.js');
      const templateCommand = commands.find(cmd => cmd.name === 'template');

      // Test missing name
      consoleOutput = [];
      await templateCommand?.handler(mockContext, ['save', testTask.id]);

      let output = consoleOutput.join('\n');
      expect(output).toContain('Usage: /template save <taskId> <name>');

      // Test missing both arguments
      consoleOutput = [];
      await templateCommand?.handler(mockContext, ['save']);

      output = consoleOutput.join('\n');
      expect(output).toContain('Usage: /template save <taskId> <name>');
    });

    it('should show error for non-existent task ID', async () => {
      const { commands } = await import('../index.js');
      const templateCommand = commands.find(cmd => cmd.name === 'template');

      consoleOutput = [];
      await templateCommand?.handler(mockContext, ['save', 'nonexistent-task-id', 'Test Template']);

      const output = consoleOutput.join('\n');
      expect(output).toContain('❌ Error:');
      expect(output).toContain('Task not found');
    });

    it('should handle template names with maximum length', async () => {
      const { commands } = await import('../index.js');
      const templateCommand = commands.find(cmd => cmd.name === 'template');

      const longName = 'A'.repeat(100); // Maximum allowed length
      consoleOutput = [];
      await templateCommand?.handler(mockContext, ['save', testTask.id, longName]);

      const output = consoleOutput.join('\n');
      expect(output).toContain('✅ Template saved successfully');
      expect(output).toContain(longName);
    });
  });

  describe('/template list command', () => {
    beforeEach(async () => {
      // Create some test templates
      const tasks = await Promise.all([
        realOrchestrator.createTask({
          description: 'First test task',
          workflow: 'feature',
          priority: 'high',
          effort: 'large',
          tags: ['test1'],
        }),
        realOrchestrator.createTask({
          description: 'Second test task',
          workflow: 'bugfix',
          priority: 'normal',
          effort: 'medium',
          tags: ['test2'],
        }),
        realOrchestrator.createTask({
          description: 'Third test task',
          workflow: 'docs',
          priority: 'low',
          effort: 'small',
          tags: ['test3'],
        }),
      ]);

      await Promise.all([
        realOrchestrator.saveTemplate(tasks[0].id, 'Alpha Template'),
        realOrchestrator.saveTemplate(tasks[1].id, 'Beta Template'),
        realOrchestrator.saveTemplate(tasks[2].id, 'Gamma Template'),
      ]);
    });

    it('should list all templates with proper formatting', async () => {
      const { commands } = await import('../index.js');
      const templateCommand = commands.find(cmd => cmd.name === 'template');

      consoleOutput = [];
      await templateCommand?.handler(mockContext, ['list']);

      const output = consoleOutput.join('\n');

      // Should show header
      expect(output).toContain('📋 Available Templates (3)');

      // Should show all templates
      expect(output).toContain('Alpha Template');
      expect(output).toContain('Beta Template');
      expect(output).toContain('Gamma Template');

      // Should show template details
      expect(output).toMatch(/ID:\s+template_/);
      expect(output).toContain('Workflow:');
      expect(output).toContain('Priority:');
      expect(output).toContain('Effort:');

      // Should show usage hint
      expect(output).toContain('Use /template use <id> to create a task from a template');
      expect(output).toContain('Use /template info <id> for detailed information');
    });

    it('should show templates sorted by name', async () => {
      const { commands } = await import('../index.js');
      const templateCommand = commands.find(cmd => cmd.name === 'template');

      consoleOutput = [];
      await templateCommand?.handler(mockContext, ['list']);

      const output = consoleOutput.join('\n');

      // Templates should appear in alphabetical order
      const alphaIndex = output.indexOf('Alpha Template');
      const betaIndex = output.indexOf('Beta Template');
      const gammaIndex = output.indexOf('Gamma Template');

      expect(alphaIndex).toBeGreaterThan(0);
      expect(betaIndex).toBeGreaterThan(alphaIndex);
      expect(gammaIndex).toBeGreaterThan(betaIndex);
    });

    it('should show empty state when no templates exist', async () => {
      // Delete all templates first
      const templates = await realOrchestrator.listTemplates();
      await Promise.all(
        templates.map(template => realOrchestrator.deleteTemplate(template.id))
      );

      const { commands } = await import('../index.js');
      const templateCommand = commands.find(cmd => cmd.name === 'template');

      consoleOutput = [];
      await templateCommand?.handler(mockContext, ['list']);

      const output = consoleOutput.join('\n');
      expect(output).toContain('No templates found');
      expect(output).toContain('Use /template save <taskId> <name> to create a template');
    });

    it('should handle template listing with long names gracefully', async () => {
      // Create a template with a very long name
      const task = await realOrchestrator.createTask({
        description: 'Long name test task',
        workflow: 'test',
      });
      await realOrchestrator.saveTemplate(task.id, 'A'.repeat(100));

      const { commands } = await import('../index.js');
      const templateCommand = commands.find(cmd => cmd.name === 'template');

      consoleOutput = [];
      await templateCommand?.handler(mockContext, ['list']);

      const output = consoleOutput.join('\n');
      expect(output).toContain('A'.repeat(100));
      expect(output).toContain('Available Templates');
    });
  });

  describe('/template use command', () => {
    let templateId: string;
    let templateName: string;

    beforeEach(async () => {
      // Create a test template
      const task = await realOrchestrator.createTask({
        description: 'Base template task',
        workflow: 'feature',
        acceptanceCriteria: 'Base acceptance criteria',
        priority: 'high',
        effort: 'large',
        tags: ['base', 'template'],
      });

      const template = await realOrchestrator.saveTemplate(task.id, 'Use Test Template');
      templateId = template.id;
      templateName = template.name;
    });

    it('should create task from template using template ID', async () => {
      const { commands } = await import('../index.js');
      const templateCommand = commands.find(cmd => cmd.name === 'template');

      consoleOutput = [];
      await templateCommand?.handler(mockContext, ['use', templateId]);

      const output = consoleOutput.join('\n');
      expect(output).toContain('✅ Created task from template successfully');
      expect(output).toMatch(/Task ID: task_/);
      expect(output).toContain('Use Test Template');
    });

    it('should create task from template using template name', async () => {
      const { commands } = await import('../index.js');
      const templateCommand = commands.find(cmd => cmd.name === 'template');

      consoleOutput = [];
      await templateCommand?.handler(mockContext, ['use', templateName]);

      const output = consoleOutput.join('\n');
      expect(output).toContain('✅ Created task from template successfully');
      expect(output).toMatch(/Task ID: task_/);
      expect(output).toContain('Use Test Template');
    });

    it('should show error with missing template identifier', async () => {
      const { commands } = await import('../index.js');
      const templateCommand = commands.find(cmd => cmd.name === 'template');

      consoleOutput = [];
      await templateCommand?.handler(mockContext, ['use']);

      const output = consoleOutput.join('\n');
      expect(output).toContain('Usage: /template use <templateId|name>');
    });

    it('should show error for non-existent template', async () => {
      const { commands } = await import('../index.js');
      const templateCommand = commands.find(cmd => cmd.name === 'template');

      consoleOutput = [];
      await templateCommand?.handler(mockContext, ['use', 'nonexistent-template']);

      const output = consoleOutput.join('\n');
      expect(output).toContain('❌ Error:');
      expect(output).toContain('Template not found');
    });

    it('should handle ambiguous template names by showing error', async () => {
      // Create another template with similar name
      const task = await realOrchestrator.createTask({
        description: 'Another task',
        workflow: 'bugfix',
      });
      await realOrchestrator.saveTemplate(task.id, 'Use Test Template 2');

      const { commands } = await import('../index.js');
      const templateCommand = commands.find(cmd => cmd.name === 'template');

      // Try to use partial name that could match multiple templates
      consoleOutput = [];
      await templateCommand?.handler(mockContext, ['use', 'Use Test']);

      const output = consoleOutput.join('\n');
      expect(output).toContain('❌ Error:');
      expect(output).toContain('Template not found');
    });

    it('should create unique task IDs for multiple uses', async () => {
      const { commands } = await import('../index.js');
      const templateCommand = commands.find(cmd => cmd.name === 'template');

      const taskIds: string[] = [];

      // Create multiple tasks from the same template
      for (let i = 0; i < 3; i++) {
        consoleOutput = [];
        await templateCommand?.handler(mockContext, ['use', templateId]);

        const output = consoleOutput.join('\n');
        const taskIdMatch = output.match(/Task ID: (task_[a-z0-9]+)/);
        expect(taskIdMatch).toBeTruthy();
        taskIds.push(taskIdMatch![1]);
      }

      // All task IDs should be unique
      const uniqueIds = new Set(taskIds);
      expect(uniqueIds.size).toBe(3);
    });
  });

  describe('/template delete command', () => {
    let templateId: string;

    beforeEach(async () => {
      // Create a test template
      const task = await realOrchestrator.createTask({
        description: 'Delete test task',
        workflow: 'feature',
      });

      const template = await realOrchestrator.saveTemplate(task.id, 'Delete Test Template');
      templateId = template.id;
    });

    it('should delete template successfully', async () => {
      const { commands } = await import('../index.js');
      const templateCommand = commands.find(cmd => cmd.name === 'template');

      consoleOutput = [];
      await templateCommand?.handler(mockContext, ['delete', templateId]);

      const output = consoleOutput.join('\n');
      expect(output).toContain('✅ Template deleted successfully');
      expect(output).toContain('Delete Test Template');

      // Verify template is actually deleted
      const templates = await realOrchestrator.listTemplates();
      expect(templates.find(t => t.id === templateId)).toBeUndefined();
    });

    it('should show error with missing template ID', async () => {
      const { commands } = await import('../index.js');
      const templateCommand = commands.find(cmd => cmd.name === 'template');

      consoleOutput = [];
      await templateCommand?.handler(mockContext, ['delete']);

      const output = consoleOutput.join('\n');
      expect(output).toContain('Usage: /template delete <templateId>');
    });

    it('should show error for non-existent template', async () => {
      const { commands } = await import('../index.js');
      const templateCommand = commands.find(cmd => cmd.name === 'template');

      consoleOutput = [];
      await templateCommand?.handler(mockContext, ['delete', 'nonexistent-template-id']);

      const output = consoleOutput.join('\n');
      expect(output).toContain('❌ Error:');
      expect(output).toContain('Template not found');
    });

    it('should handle deletion of already deleted template', async () => {
      const { commands } = await import('../index.js');
      const templateCommand = commands.find(cmd => cmd.name === 'template');

      // Delete the template first
      await templateCommand?.handler(mockContext, ['delete', templateId]);

      // Try to delete it again
      consoleOutput = [];
      await templateCommand?.handler(mockContext, ['delete', templateId]);

      const output = consoleOutput.join('\n');
      expect(output).toContain('❌ Error:');
      expect(output).toContain('Template not found');
    });
  });

  describe('/template info command', () => {
    let templateId: string;

    beforeEach(async () => {
      // Create a comprehensive test template
      const task = await realOrchestrator.createTask({
        description: 'Comprehensive test task for template info',
        workflow: 'feature',
        acceptanceCriteria: 'Should display all template information correctly',
        priority: 'urgent',
        effort: 'xl',
        tags: ['info', 'test', 'comprehensive', 'template'],
      });

      const template = await realOrchestrator.saveTemplate(task.id, 'Info Test Template');
      templateId = template.id;
    });

    it('should display comprehensive template information', async () => {
      const { commands } = await import('../index.js');
      const templateCommand = commands.find(cmd => cmd.name === 'template');

      consoleOutput = [];
      await templateCommand?.handler(mockContext, ['info', templateId]);

      const output = consoleOutput.join('\n');

      // Should show template header
      expect(output).toContain('📋 Template Information');
      expect(output).toContain('Info Test Template');

      // Should show all template details
      expect(output).toContain('ID:');
      expect(output).toContain(templateId);
      expect(output).toContain('Description:');
      expect(output).toContain('Comprehensive test task for template info');
      expect(output).toContain('Workflow:');
      expect(output).toContain('feature');
      expect(output).toContain('Priority:');
      expect(output).toContain('urgent');
      expect(output).toContain('Effort:');
      expect(output).toContain('xl');
      expect(output).toContain('Tags:');
      expect(output).toContain('info, test, comprehensive, template');
      expect(output).toContain('Acceptance Criteria:');
      expect(output).toContain('Should display all template information correctly');
      expect(output).toContain('Created:');
      expect(output).toContain('Updated:');

      // Should show usage instructions
      expect(output).toContain('Usage:');
      expect(output).toContain('/template use');
    });

    it('should handle minimal template information', async () => {
      // Create a minimal template
      const task = await realOrchestrator.createTask({
        description: 'Minimal template task',
        workflow: 'bugfix',
      });
      const template = await realOrchestrator.saveTemplate(task.id, 'Minimal Template');

      const { commands } = await import('../index.js');
      const templateCommand = commands.find(cmd => cmd.name === 'template');

      consoleOutput = [];
      await templateCommand?.handler(mockContext, ['info', template.id]);

      const output = consoleOutput.join('\n');
      expect(output).toContain('Minimal Template');
      expect(output).toContain('Description: Minimal template task');
      expect(output).toContain('Workflow: bugfix');
      expect(output).toContain('Priority: normal'); // Default
      expect(output).toContain('Effort: medium'); // Default
      expect(output).toContain('Tags: None'); // Empty
      expect(output).toContain('Acceptance Criteria: None'); // Undefined
    });

    it('should show error with missing template ID', async () => {
      const { commands } = await import('../index.js');
      const templateCommand = commands.find(cmd => cmd.name === 'template');

      consoleOutput = [];
      await templateCommand?.handler(mockContext, ['info']);

      const output = consoleOutput.join('\n');
      expect(output).toContain('Usage: /template info <templateId>');
    });

    it('should show error for non-existent template', async () => {
      const { commands } = await import('../index.js');
      const templateCommand = commands.find(cmd => cmd.name === 'template');

      consoleOutput = [];
      await templateCommand?.handler(mockContext, ['info', 'nonexistent-template-id']);

      const output = consoleOutput.join('\n');
      expect(output).toContain('❌ Error:');
      expect(output).toContain('Template not found');
    });

    it('should format timestamps correctly', async () => {
      const { commands } = await import('../index.js');
      const templateCommand = commands.find(cmd => cmd.name === 'template');

      consoleOutput = [];
      await templateCommand?.handler(mockContext, ['info', templateId]);

      const output = consoleOutput.join('\n');

      // Should contain formatted date/time information
      expect(output).toMatch(/Created:\s+\d{4}-\d{2}-\d{2}/); // ISO date format
      expect(output).toMatch(/Updated:\s+\d{4}-\d{2}-\d{2}/); // ISO date format
    });
  });

  describe('/template command with no subcommand', () => {
    it('should display help information', async () => {
      const { commands } = await import('../index.js');
      const templateCommand = commands.find(cmd => cmd.name === 'template');

      consoleOutput = [];
      await templateCommand?.handler(mockContext, []);

      const output = consoleOutput.join('\n');
      expect(output).toContain('Template Management Commands');
      expect(output).toContain('/template save <taskId> <name>');
      expect(output).toContain('/template list');
      expect(output).toContain('/template use <templateId|name>');
      expect(output).toContain('/template delete <templateId>');
      expect(output).toContain('/template info <templateId>');
    });

    it('should show error for unknown subcommand', async () => {
      const { commands } = await import('../index.js');
      const templateCommand = commands.find(cmd => cmd.name === 'template');

      consoleOutput = [];
      await templateCommand?.handler(mockContext, ['unknown']);

      const output = consoleOutput.join('\n');
      expect(output).toContain('Unknown template command: unknown');
      expect(output).toContain('Run /template for usage information');
    });
  });

  describe('Template command error handling', () => {
    it('should handle orchestrator errors gracefully', async () => {
      // Create a context with no orchestrator
      const invalidContext: CliContext = {
        ...mockContext,
        orchestrator: undefined,
      };

      const { commands } = await import('../index.js');
      const templateCommand = commands.find(cmd => cmd.name === 'template');

      consoleOutput = [];
      await templateCommand?.handler(invalidContext, ['list']);

      const output = consoleOutput.join('\n');
      expect(output).toContain('❌ Error:');
      expect(output).toContain('Cannot read properties');
    });

    it('should handle concurrent template operations', async () => {
      // Create multiple templates simultaneously
      const tasks = await Promise.all([
        realOrchestrator.createTask({ description: 'Concurrent task 1', workflow: 'test' }),
        realOrchestrator.createTask({ description: 'Concurrent task 2', workflow: 'test' }),
        realOrchestrator.createTask({ description: 'Concurrent task 3', workflow: 'test' }),
      ]);

      const { commands } = await import('../index.js');
      const templateCommand = commands.find(cmd => cmd.name === 'template');

      // Save templates concurrently
      const savePromises = tasks.map((task, i) =>
        templateCommand?.handler(mockContext, ['save', task.id, `Concurrent Template ${i + 1}`])
      );

      await Promise.all(savePromises);

      // Verify all templates were created
      consoleOutput = [];
      await templateCommand?.handler(mockContext, ['list']);

      const output = consoleOutput.join('\n');
      expect(output).toContain('Available Templates (3)');
      expect(output).toContain('Concurrent Template 1');
      expect(output).toContain('Concurrent Template 2');
      expect(output).toContain('Concurrent Template 3');
    });
  });

  describe('Template command integration with /tpl alias', () => {
    it('should work with tpl alias for all subcommands', async () => {
      // Create a test task and template
      const task = await realOrchestrator.createTask({
        description: 'Alias test task',
        workflow: 'feature',
      });

      const { commands } = await import('../index.js');
      const templateCommand = commands.find(cmd => cmd.name === 'template');

      // Test save with tpl alias (simulating alias behavior)
      consoleOutput = [];
      await templateCommand?.handler(mockContext, ['save', task.id, 'Alias Test Template']);

      let output = consoleOutput.join('\n');
      expect(output).toContain('✅ Template saved successfully');

      // Test list with tpl alias
      consoleOutput = [];
      await templateCommand?.handler(mockContext, ['list']);

      output = consoleOutput.join('\n');
      expect(output).toContain('Alias Test Template');

      // Should work the same as the main command
      expect(output).toContain('Available Templates');
    });
  });
});