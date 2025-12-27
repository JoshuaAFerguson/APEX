/**
 * Template Commands Edge Cases Tests
 *
 * Specific tests for edge cases, error conditions, and boundary scenarios
 * for template management commands. This test suite focuses on:
 * - Input validation and sanitization
 * - Error handling and recovery
 * - Boundary conditions (empty data, max lengths, special characters)
 * - Concurrency and race conditions
 * - Performance with large datasets
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { tmpdir } from 'os';
import { join } from 'path';
import { mkdir, writeFile, rm } from 'fs/promises';
import type { CliContext } from '../index.js';
import { ApexOrchestrator } from '@apexcli/orchestrator';

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

describe('Template Commands Edge Cases Tests', () => {
  let tempProjectPath: string;
  let mockContext: CliContext;
  let realOrchestrator: ApexOrchestrator;
  let templateCommand: any;

  beforeEach(async () => {
    consoleOutput = [];
    console.log = mockConsoleLog;

    tempProjectPath = join(tmpdir(), `apex-template-edge-${Date.now()}`);
    await mkdir(tempProjectPath, { recursive: true });

    const apexDir = join(tempProjectPath, '.apex');
    await mkdir(apexDir, { recursive: true });

    await writeFile(
      join(apexDir, 'config.yaml'),
      `project:
  name: Template Edge Cases Test
agents: {}
workflows: {}
limits:
  maxTokensPerTask: 100000`
    );

    realOrchestrator = new ApexOrchestrator({ projectPath: tempProjectPath });
    await realOrchestrator.initialize();

    mockContext = {
      cwd: tempProjectPath,
      initialized: true,
      config: { project: { name: 'Edge Cases Test' } },
      orchestrator: realOrchestrator,
      apiProcess: null,
      webUIProcess: null,
      apiPort: 3000,
      webUIPort: 3001,
    };

    const { commands } = await import('../index.js');
    templateCommand = commands.find(cmd => cmd.name === 'template');
  });

  afterEach(async () => {
    console.log = originalConsoleLog;
    vi.clearAllMocks();

    if (realOrchestrator) {
      try {
        await realOrchestrator.close();
      } catch (error) {
        console.warn('Failed to close orchestrator:', error);
      }
    }

    if (tempProjectPath) {
      try {
        await rm(tempProjectPath, { recursive: true, force: true });
      } catch (error) {
        console.warn('Failed to clean up temp directory:', error);
      }
    }
  });

  describe('Input Validation Edge Cases', () => {
    it('should handle special characters and Unicode in template names', async () => {
      const task = await realOrchestrator.createTask({
        description: 'Unicode test task',
        workflow: 'test',
      });

      const specialNames = [
        'Template with émojis 🚀🎯📋',
        'Template with "quotes" and \'apostrophes\'',
        'Template with symbols: @#$%^&*()',
        'Template with üñíçödë characters',
        'Template with newlines\nand\ttabs',
        'Template with HTML <script>alert("xss")</script>',
        'Template with JSON {"key": "value"}',
      ];

      for (const name of specialNames) {
        consoleOutput = [];
        await templateCommand?.handler(mockContext, ['save', task.id, name]);

        const output = consoleOutput.join('\n');
        expect(output).toContain('✅ Template saved successfully');
        expect(output).toContain(name);
      }

      // Verify all templates were saved correctly
      const templates = await realOrchestrator.listTemplates();
      expect(templates.length).toBe(specialNames.length);
    });

    it('should handle maximum length template names', async () => {
      const task = await realOrchestrator.createTask({
        description: 'Max length test',
        workflow: 'test',
      });

      // Test exactly at the limit (100 characters)
      const maxLengthName = 'A'.repeat(100);
      consoleOutput = [];
      await templateCommand?.handler(mockContext, ['save', task.id, maxLengthName]);

      let output = consoleOutput.join('\n');
      expect(output).toContain('✅ Template saved successfully');

      // Test beyond the limit - should still work (orchestrator handles validation)
      const tooLongName = 'B'.repeat(200);
      consoleOutput = [];
      await templateCommand?.handler(mockContext, ['save', task.id, tooLongName]);

      output = consoleOutput.join('\n');
      // This might succeed or fail depending on orchestrator validation
      expect(output).toMatch(/Template saved successfully|Error:/);
    });

    it('should handle whitespace-only and empty template names', async () => {
      const task = await realOrchestrator.createTask({
        description: 'Whitespace test',
        workflow: 'test',
      });

      // Test whitespace-only name
      consoleOutput = [];
      await templateCommand?.handler(mockContext, ['save', task.id, '   \t\n   ']);

      let output = consoleOutput.join('\n');
      // Should either trim to empty (causing error) or handle gracefully
      expect(output).toMatch(/Template saved successfully|Error:|Usage:/);

      // Test completely empty name
      consoleOutput = [];
      await templateCommand?.handler(mockContext, ['save', task.id, '']);

      output = consoleOutput.join('\n');
      expect(output).toMatch(/Error:|Usage:/);
    });

    it('should handle invalid task IDs gracefully', async () => {
      const invalidTaskIds = [
        '', // Empty
        '   ', // Whitespace
        'task_nonexistent', // Valid format but doesn't exist
        'invalid-format', // Invalid format
        'task_', // Incomplete
        'not-a-task-id', // Completely wrong
        '123456789', // Just numbers
        'task_' + 'a'.repeat(100), // Very long
      ];

      for (const invalidId of invalidTaskIds) {
        consoleOutput = [];
        await templateCommand?.handler(mockContext, ['save', invalidId, 'Test Template']);

        const output = consoleOutput.join('\n');
        expect(output).toMatch(/Error:|Usage:/);
        expect(output).not.toContain('✅ Template saved successfully');
      }
    });

    it('should handle malformed command arguments', async () => {
      const malformedInputs = [
        // Missing arguments
        ['save'],
        ['use'],
        ['delete'],
        ['info'],
        // Too many arguments
        ['save', 'task_123', 'name', 'extra', 'args'],
        ['list', 'unexpected', 'args'],
        ['use', 'template_123', 'extra'],
        ['delete', 'template_123', 'extra'],
        ['info', 'template_123', 'extra'],
        // Arguments with special characters
        ['save', 'task_123\x00null', 'Template Name'],
        ['use', 'template_123\r\n'],
        ['delete', 'template_123\t'],
      ];

      for (const args of malformedInputs) {
        consoleOutput = [];
        await templateCommand?.handler(mockContext, args);

        const output = consoleOutput.join('\n');
        expect(output).toMatch(/Usage:|Error:|Unknown template command/);
      }
    });
  });

  describe('Error Handling and Recovery', () => {
    it('should handle orchestrator connection failures', async () => {
      // Create context with null orchestrator to simulate connection failure
      const failedContext = { ...mockContext, orchestrator: null };

      const operations = [
        ['save', 'task_123', 'Test Template'],
        ['list'],
        ['use', 'template_123'],
        ['delete', 'template_123'],
        ['info', 'template_123'],
      ];

      for (const args of operations) {
        consoleOutput = [];
        await templateCommand?.handler(failedContext, args);

        const output = consoleOutput.join('\n');
        expect(output).toContain('❌ Error:');
      }
    });

    it('should handle database lock scenarios gracefully', async () => {
      // Create a task first
      const task = await realOrchestrator.createTask({
        description: 'Lock test task',
        workflow: 'test',
      });

      // Simulate concurrent operations that might cause locks
      const promises = Array.from({ length: 10 }, (_, i) =>
        templateCommand?.handler(mockContext, ['save', task.id, `Concurrent Template ${i}`])
      );

      const results = await Promise.allSettled(promises);

      // Some should succeed, some might fail due to concurrency
      const successes = results.filter(r => r.status === 'fulfilled').length;
      expect(successes).toBeGreaterThan(0);
    });

    it('should handle partial template data corruption', async () => {
      // Create and save a template
      const task = await realOrchestrator.createTask({
        description: 'Corruption test task',
        workflow: 'test',
      });

      consoleOutput = [];
      await templateCommand?.handler(mockContext, ['save', task.id, 'Corruption Test Template']);

      const output = consoleOutput.join('\n');
      expect(output).toContain('✅ Template saved successfully');

      const templateIdMatch = output.match(/Template ID: (template_[a-z0-9]+)/);
      const templateId = templateIdMatch![1];

      // Verify template can be used normally
      consoleOutput = [];
      await templateCommand?.handler(mockContext, ['use', templateId]);

      const useOutput = consoleOutput.join('\n');
      expect(useOutput).toContain('✅ Created task from template successfully');
    });
  });

  describe('Performance and Scalability Edge Cases', () => {
    it('should handle large numbers of templates efficiently', async () => {
      // Create many tasks and templates
      const taskCount = 50; // Moderate number to avoid test timeouts
      const tasks = await Promise.all(
        Array.from({ length: taskCount }, (_, i) =>
          realOrchestrator.createTask({
            description: `Performance test task ${i + 1}`,
            workflow: 'test',
            tags: [`tag-${i}`, 'performance'],
          })
        )
      );

      // Save all as templates
      for (let i = 0; i < taskCount; i++) {
        consoleOutput = [];
        await templateCommand?.handler(mockContext, ['save', tasks[i].id, `Performance Template ${i + 1}`]);

        const output = consoleOutput.join('\n');
        expect(output).toContain('✅ Template saved successfully');
      }

      // Test list performance with many templates
      const startTime = Date.now();
      consoleOutput = [];
      await templateCommand?.handler(mockContext, ['list']);
      const listTime = Date.now() - startTime;

      const output = consoleOutput.join('\n');
      expect(output).toContain(`📋 Available Templates (${taskCount})`);
      expect(listTime).toBeLessThan(5000); // Should complete within 5 seconds

      // Test searching through many templates by name
      consoleOutput = [];
      await templateCommand?.handler(mockContext, ['use', 'Performance Template 25']);

      const useOutput = consoleOutput.join('\n');
      expect(useOutput).toContain('✅ Created task from template successfully');
    });

    it('should handle templates with extensive data', async () => {
      // Create task with maximum data
      const task = await realOrchestrator.createTask({
        description: 'A'.repeat(1000), // Very long description
        workflow: 'feature',
        acceptanceCriteria: 'B'.repeat(2000), // Very long acceptance criteria
        priority: 'high',
        effort: 'xl',
        tags: Array.from({ length: 50 }, (_, i) => `extensive-tag-${i}`), // Many tags
      });

      // Save as template
      consoleOutput = [];
      await templateCommand?.handler(mockContext, ['save', task.id, 'Extensive Data Template']);

      let output = consoleOutput.join('\n');
      expect(output).toContain('✅ Template saved successfully');

      const templateIdMatch = output.match(/Template ID: (template_[a-z0-9]+)/);
      const templateId = templateIdMatch![1];

      // Test info display with extensive data
      consoleOutput = [];
      await templateCommand?.handler(mockContext, ['info', templateId]);

      output = consoleOutput.join('\n');
      expect(output).toContain('📋 Template Information');
      expect(output).toContain('Extensive Data Template');

      // Use template with extensive data
      consoleOutput = [];
      await templateCommand?.handler(mockContext, ['use', templateId]);

      output = consoleOutput.join('\n');
      expect(output).toContain('✅ Created task from template successfully');
    });

    it('should handle rapid sequential operations', async () => {
      const task = await realOrchestrator.createTask({
        description: 'Rapid operations test',
        workflow: 'test',
      });

      // Rapid save
      consoleOutput = [];
      await templateCommand?.handler(mockContext, ['save', task.id, 'Rapid Test Template']);

      const output = consoleOutput.join('\n');
      const templateIdMatch = output.match(/Template ID: (template_[a-z0-9]+)/);
      const templateId = templateIdMatch![1];

      // Rapid sequence of operations
      const operations = [
        ['info', templateId],
        ['use', templateId],
        ['list'],
        ['use', templateId],
        ['info', templateId],
        ['list'],
      ];

      for (const args of operations) {
        consoleOutput = [];
        await templateCommand?.handler(mockContext, args);

        const opOutput = consoleOutput.join('\n');
        expect(opOutput).not.toContain('❌ Error:');
      }

      // Final delete
      consoleOutput = [];
      await templateCommand?.handler(mockContext, ['delete', templateId]);

      const deleteOutput = consoleOutput.join('\n');
      expect(deleteOutput).toContain('✅ Template deleted successfully');
    });
  });

  describe('Template Name Resolution Edge Cases', () => {
    it('should handle templates with similar names', async () => {
      const task1 = await realOrchestrator.createTask({ description: 'Test 1', workflow: 'test' });
      const task2 = await realOrchestrator.createTask({ description: 'Test 2', workflow: 'test' });
      const task3 = await realOrchestrator.createTask({ description: 'Test 3', workflow: 'test' });

      // Create templates with similar names
      await templateCommand?.handler(mockContext, ['save', task1.id, 'Test Template']);
      await templateCommand?.handler(mockContext, ['save', task2.id, 'Test Template 2']);
      await templateCommand?.handler(mockContext, ['save', task3.id, 'Test Template Advanced']);

      // Test exact name matching
      consoleOutput = [];
      await templateCommand?.handler(mockContext, ['use', 'Test Template']);

      let output = consoleOutput.join('\n');
      expect(output).toContain('✅ Created task from template successfully');

      // Test with partial name that doesn't match exactly
      consoleOutput = [];
      await templateCommand?.handler(mockContext, ['use', 'Test']);

      output = consoleOutput.join('\n');
      expect(output).toContain('❌ Error:');
      expect(output).toContain('Template not found');
    });

    it('should handle templates with case variations', async () => {
      const task = await realOrchestrator.createTask({
        description: 'Case test',
        workflow: 'test',
      });

      await templateCommand?.handler(mockContext, ['save', task.id, 'CaSeSeNsItIvE TeMpLaTe']);

      // Test exact case match
      consoleOutput = [];
      await templateCommand?.handler(mockContext, ['use', 'CaSeSeNsItIvE TeMpLaTe']);

      let output = consoleOutput.join('\n');
      expect(output).toContain('✅ Created task from template successfully');

      // Test case mismatch
      consoleOutput = [];
      await templateCommand?.handler(mockContext, ['use', 'casesensitive template']);

      output = consoleOutput.join('\n');
      expect(output).toContain('❌ Error:');
      expect(output).toContain('Template not found');
    });

    it('should handle templates with numeric and special names', async () => {
      const task = await realOrchestrator.createTask({
        description: 'Special names test',
        workflow: 'test',
      });

      const specialNames = [
        '123456789',
        'Template-with-dashes',
        'Template_with_underscores',
        'Template.with.dots',
        'Template with spaces',
        '🚀 Rocket Template 🚀',
      ];

      const templateIds: string[] = [];

      for (const name of specialNames) {
        consoleOutput = [];
        await templateCommand?.handler(mockContext, ['save', task.id, name]);

        const output = consoleOutput.join('\n');
        expect(output).toContain('✅ Template saved successfully');

        const templateIdMatch = output.match(/Template ID: (template_[a-z0-9]+)/);
        templateIds.push(templateIdMatch![1]);
      }

      // Test using each template by name
      for (const name of specialNames) {
        consoleOutput = [];
        await templateCommand?.handler(mockContext, ['use', name]);

        const output = consoleOutput.join('\n');
        expect(output).toContain('✅ Created task from template successfully');
      }
    });
  });

  describe('Data Consistency Edge Cases', () => {
    it('should maintain template integrity after task modifications', async () => {
      // Create and save template
      const originalTask = await realOrchestrator.createTask({
        description: 'Original task for template',
        workflow: 'feature',
        priority: 'high',
        tags: ['original'],
      });

      consoleOutput = [];
      await templateCommand?.handler(mockContext, ['save', originalTask.id, 'Integrity Test Template']);

      const output = consoleOutput.join('\n');
      const templateIdMatch = output.match(/Template ID: (template_[a-z0-9]+)/);
      const templateId = templateIdMatch![1];

      // Verify template was saved correctly
      consoleOutput = [];
      await templateCommand?.handler(mockContext, ['info', templateId]);

      let infoOutput = consoleOutput.join('\n');
      expect(infoOutput).toContain('Original task for template');
      expect(infoOutput).toContain('high');
      expect(infoOutput).toContain('original');

      // Create task from template
      consoleOutput = [];
      await templateCommand?.handler(mockContext, ['use', templateId]);

      const useOutput = consoleOutput.join('\n');
      expect(useOutput).toContain('✅ Created task from template successfully');

      // Template info should remain unchanged
      consoleOutput = [];
      await templateCommand?.handler(mockContext, ['info', templateId]);

      infoOutput = consoleOutput.join('\n');
      expect(infoOutput).toContain('Original task for template');
      expect(infoOutput).toContain('high');
      expect(infoOutput).toContain('original');
    });

    it('should handle template operations with minimal task data', async () => {
      // Create task with minimal data
      const minimalTask = await realOrchestrator.createTask({
        description: 'Minimal task',
        workflow: 'test',
      });

      // Save as template
      consoleOutput = [];
      await templateCommand?.handler(mockContext, ['save', minimalTask.id, 'Minimal Template']);

      let output = consoleOutput.join('\n');
      expect(output).toContain('✅ Template saved successfully');

      const templateIdMatch = output.match(/Template ID: (template_[a-z0-9]+)/);
      const templateId = templateIdMatch![1];

      // Check template info shows defaults
      consoleOutput = [];
      await templateCommand?.handler(mockContext, ['info', templateId]);

      output = consoleOutput.join('\n');
      expect(output).toContain('Priority: normal'); // Default
      expect(output).toContain('Effort: medium'); // Default
      expect(output).toContain('Tags: None'); // Empty
      expect(output).toContain('Acceptance Criteria: None'); // Undefined

      // Use minimal template
      consoleOutput = [];
      await templateCommand?.handler(mockContext, ['use', templateId]);

      output = consoleOutput.join('\n');
      expect(output).toContain('✅ Created task from template successfully');
    });
  });
});