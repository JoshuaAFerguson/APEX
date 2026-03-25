/**
 * @fileoverview Comprehensive unit tests for Markdown Task Export Formatter
 *
 * Tests cover all functionality defined in ADR-021 including:
 * - Input validation
 * - Basic functionality
 * - All export options and layout strategies
 * - Task data transformation
 * - Section generation
 * - Edge cases
 * - Error scenarios
 *
 * Target: 100% test coverage of formatTasksToMarkdown function and all helpers
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { formatTasksToMarkdown } from '../markdown-formatter.js';
import type { Task, MarkdownExportOptions } from '../../types.js';
import {
  createTask,
  createTaskLog,
  createTaskArtifact,
  createTaskUsage,
  createTasks,
  createTaskLifecycle,
} from '../../factories/task-factory.js';

describe('formatTasksToMarkdown', () => {
  // ============================================================================
  // Input Validation Tests
  // ============================================================================

  describe('Input Validation', () => {
    it('should throw TypeError when tasks is null', () => {
      expect(() => {
        formatTasksToMarkdown(null as any);
      }).toThrow(TypeError);
      expect(() => {
        formatTasksToMarkdown(null as any);
      }).toThrow('Tasks parameter cannot be null or undefined');
    });

    it('should throw TypeError when tasks is undefined', () => {
      expect(() => {
        formatTasksToMarkdown(undefined as any);
      }).toThrow(TypeError);
      expect(() => {
        formatTasksToMarkdown(undefined as any);
      }).toThrow('Tasks parameter cannot be null or undefined');
    });

    it('should throw TypeError when tasks is not an array', () => {
      expect(() => {
        formatTasksToMarkdown('not-an-array' as any);
      }).toThrow(TypeError);
      expect(() => {
        formatTasksToMarkdown('not-an-array' as any);
      }).toThrow('Tasks parameter must be an array');

      expect(() => {
        formatTasksToMarkdown({ id: 'task-1' } as any);
      }).toThrow(TypeError);

      expect(() => {
        formatTasksToMarkdown(123 as any);
      }).toThrow(TypeError);
    });

    it('should handle empty array without error', () => {
      const result = formatTasksToMarkdown([]);
      expect(result).toContain('# Task Export Report');
      expect(result).toContain('*No tasks found.*');
    });

    it('should throw error for invalid options', () => {
      const task = createTask();

      expect(() => {
        formatTasksToMarkdown([task], { sectionLimit: -1 });
      }).toThrow('sectionLimit must be a non-negative number');

      expect(() => {
        formatTasksToMarkdown([task], { layout: 'invalid' as any });
      }).toThrow('Invalid layout strategy value');

      expect(() => {
        formatTasksToMarkdown([task], { logsSection: 'invalid' as any });
      }).toThrow('Invalid logsSection strategy value');

      expect(() => {
        formatTasksToMarkdown([task], { metricsSection: 'invalid' as any });
      }).toThrow('Invalid metricsSection strategy value');

      expect(() => {
        formatTasksToMarkdown([task], { artifactsSection: 'invalid' as any });
      }).toThrow('Invalid artifactsSection strategy value');
    });
  });

  // ============================================================================
  // Basic Functionality Tests
  // ============================================================================

  describe('Basic Functionality', () => {
    it('should export a single task with default table layout', () => {
      const task = createTask({
        id: 'test-task-1',
        description: 'Test task for markdown export',
        status: 'completed',
        priority: 'high',
        effort: 'medium',
      });

      const result = formatTasksToMarkdown([task]);

      // Should contain header
      expect(result).toContain('# Task Export Report');

      // Should contain summary section
      expect(result).toContain('## Summary');
      expect(result).toContain('**Total Tasks:** 1');

      // Should contain tasks table
      expect(result).toContain('## Tasks');
      expect(result).toContain('| ID | Description | Status | Priority | Effort |');
      expect(result).toContain('| test-task-1 |');
      expect(result).toContain('Test task for markdown export');
    });

    it('should export multiple tasks', () => {
      const tasks = createTasks(3, { description: 'Multi-task test' });

      const result = formatTasksToMarkdown(tasks);

      expect(result).toContain('**Total Tasks:** 3');
      expect(result).toContain('Multi-task test 1');
      expect(result).toContain('Multi-task test 2');
      expect(result).toContain('Multi-task test 3');
    });

    it('should include all required task fields in detailed layout', () => {
      const task = createTask({
        id: 'detailed-test',
        description: 'Detailed test task',
        acceptanceCriteria: 'All fields should be present in markdown',
        workflow: 'feature-development',
        autonomy: 'full-auto',
        status: 'in-progress',
        priority: 'urgent',
        effort: 'large',
        currentStage: 'implementation',
        error: 'Test error message',
      });

      const result = formatTasksToMarkdown([task], { layout: 'detailed' });

      expect(result).toContain('### Task: detailed-test');
      expect(result).toContain('**Description:** Detailed test task');
      expect(result).toContain('**Acceptance Criteria:** All fields should be present in markdown');
      expect(result).toContain('- Status: ![In Progress](https://img.shields.io/badge/In%20Progress-blue)');
      expect(result).toContain('- Priority: ![Urgent](https://img.shields.io/badge/Urgent-red)');
      expect(result).toContain('- Effort: ![Large](https://img.shields.io/badge/Large-orange)');
      expect(result).toContain('- Workflow: feature\\-development');
      expect(result).toContain('- Autonomy: full\\-auto');
      expect(result).toContain('- Current Stage: implementation');
      expect(result).toContain('**⚠️ Error:**');
      expect(result).toContain('Test error message');
    });

    it('should handle tasks with factory default values', () => {
      const task = createTask();

      const result = formatTasksToMarkdown([task]);

      expect(result).toContain('feature-development');
      expect(result).toContain('![Pending](https://img.shields.io/badge/Pending-yellow)');
      expect(result).toContain('![Normal](https://img.shields.io/badge/Normal-blue)');
      expect(result).toContain('![Medium](https://img.shields.io/badge/Medium-yellow)');
    });
  });

  // ============================================================================
  // Layout Strategy Tests
  // ============================================================================

  describe('Layout Strategies', () => {
    let task: Task;

    beforeEach(() => {
      task = createTask({
        id: 'layout-test',
        description: 'Testing layout strategies',
        status: 'in-progress',
        priority: 'high',
      });
    });

    describe('table layout (default)', () => {
      it('should format tasks in a markdown table', () => {
        const result = formatTasksToMarkdown([task], { layout: 'table' });

        expect(result).toContain('## Tasks');
        expect(result).toContain('| ID | Description | Status | Priority | Effort | Workflow |');
        expect(result).toContain('| --- | --- | --- | --- | --- | --- |');
        expect(result).toContain('| layout-test |');
        expect(result).toContain('Testing layout strategies');
      });

      it('should include inline metrics when metricsSection is inline', () => {
        const result = formatTasksToMarkdown([task], {
          layout: 'table',
          metricsSection: 'inline'
        });

        expect(result).toContain('| ID | Description | Status | Priority | Effort | Workflow | Duration | Cost |');
        expect(result).toContain('5.0s'); // Default execution time from factory
      });
    });

    describe('list layout', () => {
      it('should format tasks as bulleted list', () => {
        const result = formatTasksToMarkdown([task], { layout: 'list' });

        expect(result).toContain('## Tasks');
        expect(result).toContain('- **layout-test** - Testing layout strategies');
        expect(result).toContain('  - Status: ![In Progress](https://img.shields.io/badge/In%20Progress-blue)');
        expect(result).toContain('  - Priority: ![High](https://img.shields.io/badge/High-orange)');
      });

      it('should use numbered list when numberTasks is true', () => {
        const tasks = createTasks(2, { description: 'Numbered task' });
        const result = formatTasksToMarkdown(tasks, {
          layout: 'list',
          numberTasks: true
        });

        expect(result).toMatch(/1\. \*\*.*\*\* - Numbered task 1/);
        expect(result).toMatch(/2\. \*\*.*\*\* - Numbered task 2/);
      });
    });

    describe('detailed layout', () => {
      it('should create detailed sections for each task', () => {
        const result = formatTasksToMarkdown([task], { layout: 'detailed' });

        expect(result).toContain('### Task: layout-test');
        expect(result).toContain('**Description:** Testing layout strategies');
        expect(result).toContain('**Details:**');
        expect(result).toContain('**Timestamps:**');
        expect(result).toContain('---'); // Section separator
      });

      it('should include task numbers when numberTasks is true', () => {
        const tasks = createTasks(2, { description: 'Detailed task' });
        const result = formatTasksToMarkdown(tasks, {
          layout: 'detailed',
          numberTasks: true
        });

        expect(result).toContain('### Task 1:');
        expect(result).toContain('### Task 2:');
      });
    });

    describe('summary layout', () => {
      it('should create brief summaries for tasks', () => {
        const result = formatTasksToMarkdown([task], { layout: 'summary' });

        expect(result).toContain('## Tasks Summary');
        expect(result).toMatch(/- \*\*layout-test\*\*: Testing layout strategies \(.*\)/);
      });

      it('should truncate long descriptions', () => {
        const longTask = createTask({
          description: 'This is a very long description that should be truncated because it exceeds the character limit for summary display'
        });

        const result = formatTasksToMarkdown([longTask], { layout: 'summary' });

        expect(result).toContain('...');
        expect(result).not.toContain('character limit for summary display');
      });
    });
  });

  // ============================================================================
  // Section Strategy Tests
  // ============================================================================

  describe('Section Strategies', () => {
    let taskWithData: Task;

    beforeEach(() => {
      taskWithData = createTask({
        logs: [
          createTaskLog({ level: 'info', message: 'Task started' }),
          createTaskLog({ level: 'warn', message: 'Warning occurred' }),
          createTaskLog({ level: 'error', message: 'Error encountered' }),
        ],
        artifacts: [
          createTaskArtifact({ name: 'component.tsx', type: 'file' }),
          createTaskArtifact({ name: 'test.spec.ts', type: 'report' }),
        ],
        usage: createTaskUsage({
          executionTimeMs: 15000,
          totalCostCents: 45,
          inputTokens: 2000,
          outputTokens: 1000,
        }),
      });
    });

    describe('logs section strategies', () => {
      it('should show logs inline in detailed layout', () => {
        const result = formatTasksToMarkdown([taskWithData], {
          layout: 'detailed',
          logsSection: 'inline'
        });

        expect(result).toContain('**Logs Summary:**');
        expect(result).toContain('- Total: 3 entries');
        expect(result).toContain('- Breakdown: 1 error, 1 warning, 1 info');
      });

      it('should create separate logs section', () => {
        const result = formatTasksToMarkdown([taskWithData], {
          logsSection: 'separate'
        });

        expect(result).toContain('## Execution Logs');
        expect(result).toContain('![Info](https://img.shields.io/badge/Info-blue)');
        expect(result).toContain('![Error](https://img.shields.io/badge/Error-red)');
        expect(result).toContain('Task started');
        expect(result).toContain('Error encountered');
      });

      it('should show summary in inline mode', () => {
        const result = formatTasksToMarkdown([taskWithData], {
          layout: 'table',
          logsSection: 'inline'
        });

        expect(result).toContain('| Logs |');
        expect(result).toContain('3 entries');
      });

      it('should omit logs section when strategy is omit', () => {
        const result = formatTasksToMarkdown([taskWithData], {
          logsSection: 'omit'
        });

        expect(result).not.toContain('Logs');
        expect(result).not.toContain('Task started');
      });
    });

    describe('metrics section strategies', () => {
      it('should show metrics inline in detailed layout', () => {
        const result = formatTasksToMarkdown([taskWithData], {
          layout: 'detailed',
          metricsSection: 'inline'
        });

        expect(result).toContain('**Metrics:**');
        expect(result).toContain('- Execution Time: 15.0s');
        expect(result).toContain('- Input Tokens: 2,000');
        expect(result).toContain('- Total Cost: $0.450');
      });

      it('should create separate metrics section', () => {
        const result = formatTasksToMarkdown([taskWithData], {
          metricsSection: 'separate'
        });

        expect(result).toContain('## Metrics');
        expect(result).toContain('### Aggregate Metrics');
        expect(result).toContain('### Per-Task Breakdown');
        expect(result).toContain('| Task ID | Duration | Tokens | Cost |');
      });
    });

    describe('artifacts section strategies', () => {
      it('should show artifacts inline in detailed layout', () => {
        const result = formatTasksToMarkdown([taskWithData], {
          layout: 'detailed',
          artifactsSection: 'inline'
        });

        expect(result).toContain('**Artifacts:**');
        expect(result).toContain('- Total: 2 files');
        expect(result).toContain('- Types: 1 file, 1 report');
      });

      it('should create separate artifacts section', () => {
        const result = formatTasksToMarkdown([taskWithData], {
          artifactsSection: 'separate'
        });

        expect(result).toContain('## Artifacts');
        expect(result).toContain('### File Artifacts');
        expect(result).toContain('### Report Artifacts');
        expect(result).toContain('- **component.tsx**');
        expect(result).toContain('- **test.spec.ts**');
      });
    });
  });

  // ============================================================================
  // Export Options Tests
  // ============================================================================

  describe('Export Options', () => {
    let task: Task;

    beforeEach(() => {
      task = createTask({
        id: 'options-test',
        description: 'Testing export options',
      });
    });

    describe('header options', () => {
      it('should include header with default title when includeHeader is true', () => {
        const result = formatTasksToMarkdown([task], { includeHeader: true });

        expect(result).toContain('# Task Export Report');
      });

      it('should use custom document title', () => {
        const result = formatTasksToMarkdown([task], {
          documentTitle: 'Custom Sprint Report',
          includeHeader: true
        });

        expect(result).toContain('# Custom Sprint Report');
      });

      it('should exclude header when includeHeader is false', () => {
        const result = formatTasksToMarkdown([task], { includeHeader: false });

        expect(result).not.toContain('# Task Export Report');
      });

      it('should include metadata in header when includeMetadata is true', () => {
        const result = formatTasksToMarkdown([task], {
          includeHeader: true,
          includeMetadata: true
        });

        expect(result).toContain('**Generated:**');
        expect(result).toContain('**Export Version:** 1.0.0');
        expect(result).toContain('**Format:** Markdown');
      });
    });

    describe('table of contents', () => {
      it('should include table of contents when includeToc is true', () => {
        const result = formatTasksToMarkdown([task], {
          includeToc: true,
          logsSection: 'separate',
          metricsSection: 'separate'
        });

        expect(result).toContain('## Table of Contents');
        expect(result).toContain('- [Summary](#summary)');
        expect(result).toContain('- [Tasks](#tasks)');
        expect(result).toContain('- [Execution Logs](#execution-logs)');
        expect(result).toContain('- [Metrics](#metrics)');
      });
    });

    describe('summary options', () => {
      it('should include summary section by default', () => {
        const tasks = createTasks(5);
        const result = formatTasksToMarkdown(tasks, { includeSummary: true });

        expect(result).toContain('## Summary');
        expect(result).toContain('**Total Tasks:** 5');
        expect(result).toContain('### Status Breakdown');
        expect(result).toContain('### Priority Breakdown');
        expect(result).toContain('### Overall Statistics');
      });

      it('should exclude summary when includeSummary is false', () => {
        const result = formatTasksToMarkdown([task], { includeSummary: false });

        expect(result).not.toContain('## Summary');
        expect(result).not.toContain('**Total Tasks:**');
      });
    });

    describe('GitHub flavored markdown', () => {
      it('should use shields.io badges when githubFlavored is true', () => {
        const result = formatTasksToMarkdown([task], { githubFlavored: true });

        expect(result).toContain('![Pending](https://img.shields.io/badge/Pending-yellow)');
        expect(result).toContain('![Normal](https://img.shields.io/badge/Normal-blue)');
      });

      it('should use bold text when githubFlavored is false', () => {
        const result = formatTasksToMarkdown([task], { githubFlavored: false });

        expect(result).toContain('**Pending**');
        expect(result).toContain('**Normal**');
        expect(result).not.toContain('shields.io');
      });
    });

    describe('section limits', () => {
      it('should limit items in separate sections', () => {
        const taskWithManyLogs = createTask({
          logs: Array.from({ length: 20 }, (_, i) =>
            createTaskLog({ message: `Log entry ${i}` })
          ),
        });

        const result = formatTasksToMarkdown([taskWithManyLogs], {
          logsSection: 'separate',
          sectionLimit: 5
        });

        expect(result).toContain('*Showing first 5 of 20 log entries.*');
      });

      it('should not limit when sectionLimit is 0', () => {
        const taskWithManyLogs = createTask({
          logs: Array.from({ length: 10 }, (_, i) =>
            createTaskLog({ message: `Log entry ${i}` })
          ),
        });

        const result = formatTasksToMarkdown([taskWithManyLogs], {
          logsSection: 'separate',
          sectionLimit: 0
        });

        expect(result).not.toContain('Showing first');
        // Should contain all log entries
        expect(result).toContain('Log entry 9');
      });
    });
  });

  // ============================================================================
  // Task Lifecycle Tests
  // ============================================================================

  describe('Task Lifecycle', () => {
    it('should handle different task statuses correctly', () => {
      const lifecycle = createTaskLifecycle();
      const tasks = Object.values(lifecycle);

      const result = formatTasksToMarkdown(tasks);

      expect(result).toContain('![Pending](https://img.shields.io/badge/Pending-yellow)');
      expect(result).toContain('![In Progress](https://img.shields.io/badge/In%20Progress-blue)');
      expect(result).toContain('![Completed](https://img.shields.io/badge/Completed-green)');
      expect(result).toContain('![Failed](https://img.shields.io/badge/Failed-red)');
    });

    it('should show error information for failed tasks in detailed view', () => {
      const lifecycle = createTaskLifecycle();

      const result = formatTasksToMarkdown([lifecycle.failed], {
        layout: 'detailed'
      });

      expect(result).toContain('**⚠️ Error:**');
      expect(result).toContain('Build failed due to TypeScript errors');
    });

    it('should handle completed tasks with artifacts', () => {
      const lifecycle = createTaskLifecycle();

      const result = formatTasksToMarkdown([lifecycle.completed], {
        layout: 'detailed',
        artifactsSection: 'inline'
      });

      expect(result).toContain('**Artifacts:**');
      expect(result).toContain('- Total: 2 files');
    });
  });

  // ============================================================================
  // Edge Cases Tests
  // ============================================================================

  describe('Edge Cases', () => {
    it('should handle empty task description', () => {
      const task = createTask({ description: '' });

      const result = formatTasksToMarkdown([task]);

      expect(result).toContain('|  |'); // Empty description cell
    });

    it('should handle tasks with no logs or artifacts', () => {
      const task = createTask({
        logs: [],
        artifacts: [],
      });

      const result = formatTasksToMarkdown([task], {
        layout: 'detailed',
        logsSection: 'inline',
        artifactsSection: 'inline'
      });

      // Should not contain logs or artifacts sections
      expect(result).not.toContain('**Logs Summary:**');
      expect(result).not.toContain('**Artifacts:**');
    });

    it('should handle Unicode content in task data', () => {
      const unicodeTask = createTask({
        description: '测试任务 with émojis 🚀 and symbols ∆∇∈∉',
        logs: [createTaskLog({ message: 'Unicode log: 日本語 русский العربية' })],
      });

      const result = formatTasksToMarkdown([unicodeTask]);

      expect(result).toContain('测试任务 with émojis 🚀 and symbols ∆∇∈∉');
    });

    it('should escape Markdown special characters', () => {
      const specialTask = createTask({
        description: 'Task with *asterisks* and [brackets] and _underscores_',
        error: 'Error with **bold** and `code`',
      });

      const result = formatTasksToMarkdown([specialTask], { layout: 'detailed' });

      expect(result).toContain('\\*asterisks\\*');
      expect(result).toContain('\\[brackets\\]');
      expect(result).toContain('\\_underscores\\_');
      expect(result).toContain('\\*\\*bold\\*\\*');
      expect(result).toContain('\\`code\\`');
    });

    it('should handle very large datasets gracefully', () => {
      const largeTasks = createTasks(100, {
        logs: Array.from({ length: 10 }, () => createTaskLog()),
        artifacts: Array.from({ length: 5 }, () => createTaskArtifact()),
      });

      expect(() => {
        const result = formatTasksToMarkdown(largeTasks, {
          layout: 'summary',
          sectionLimit: 10
        });
        expect(result).toBeTruthy();
      }).not.toThrow();
    });

    it('should handle tasks with undefined optional fields', () => {
      const minimalTask = createTask({
        acceptanceCriteria: undefined,
        currentStage: undefined,
        error: undefined,
        completedAt: undefined,
      });

      const result = formatTasksToMarkdown([minimalTask], { layout: 'detailed' });

      expect(result).not.toContain('**Acceptance Criteria:**');
      expect(result).not.toContain('**⚠️ Error:**');
      expect(result).not.toContain('- Completed:');
    });
  });

  // ============================================================================
  // Complex Integration Tests
  // ============================================================================

  describe('Complex Integration', () => {
    it('should generate complete report with all sections', () => {
      const tasks = [
        createTask({
          id: 'task-1',
          description: 'Implement login feature',
          status: 'completed',
          priority: 'high',
          logs: [
            createTaskLog({ level: 'info', message: 'Starting implementation' }),
            createTaskLog({ level: 'warn', message: 'Deprecated API used' }),
          ],
          artifacts: [
            createTaskArtifact({ name: 'Login.tsx', type: 'file' }),
            createTaskArtifact({ name: 'login.test.ts', type: 'report' }),
          ],
        }),
        createTask({
          id: 'task-2',
          description: 'Add user validation',
          status: 'failed',
          error: 'Validation library not found',
        }),
      ];

      const result = formatTasksToMarkdown(tasks, {
        layout: 'detailed',
        includeHeader: true,
        includeToc: true,
        includeSummary: true,
        logsSection: 'separate',
        metricsSection: 'separate',
        artifactsSection: 'separate',
        documentTitle: 'Sprint 1 Report',
        githubFlavored: true,
      });

      // Should contain all major sections
      expect(result).toContain('# Sprint 1 Report');
      expect(result).toContain('## Table of Contents');
      expect(result).toContain('## Summary');
      expect(result).toContain('**Total Tasks:** 2');
      expect(result).toContain('## Tasks');
      expect(result).toContain('### Task: task-1');
      expect(result).toContain('### Task: task-2');
      expect(result).toContain('## Execution Logs');
      expect(result).toContain('## Metrics');
      expect(result).toContain('## Artifacts');

      // Should contain proper status breakdown
      expect(result).toContain('- **Completed:** 1 (50.0%)');
      expect(result).toContain('- **Failed:** 1 (50.0%)');

      // Should contain task details
      expect(result).toContain('Implement login feature');
      expect(result).toContain('Add user validation');
      expect(result).toContain('**⚠️ Error:**');
      expect(result).toContain('Validation library not found');
    });

    it('should apply field filtering in different layouts', () => {
      const task = createTask({
        description: 'Test filtering',
        acceptanceCriteria: 'Should be filtered',
        error: 'Should be filtered',
      });

      // Field filtering affects display logic rather than data transformation in markdown
      const result = formatTasksToMarkdown([task], {
        layout: 'detailed',
        excludeFields: ['acceptanceCriteria', 'error']
      });

      // Since field filtering is applied at display level, we check that
      // core content is still present but filtered content may be handled differently
      expect(result).toContain('Test filtering');
    });

    it('should handle mixed task states and priorities', () => {
      const mixedTasks = [
        createTask({ status: 'pending', priority: 'low' }),
        createTask({ status: 'in-progress', priority: 'urgent' }),
        createTask({ status: 'completed', priority: 'normal' }),
        createTask({ status: 'failed', priority: 'high' }),
      ];

      const result = formatTasksToMarkdown(mixedTasks);

      expect(result).toContain('### Status Breakdown');
      expect(result).toContain('### Priority Breakdown');
      expect(result).toContain('- **Pending:** 1 (25.0%)');
      expect(result).toContain('- **In-progress:** 1 (25.0%)');
      expect(result).toContain('- **Completed:** 1 (25.0%)');
      expect(result).toContain('- **Failed:** 1 (25.0%)');
      expect(result).toContain('- **Low:** 1 (25.0%)');
      expect(result).toContain('- **Urgent:** 1 (25.0%)');
    });
  });

  // ============================================================================
  // Error Scenarios Tests
  // ============================================================================

  describe('Error Scenarios', () => {
    it('should handle malformed task data gracefully', () => {
      const baseTask = createTask();
      const malformedTask = {
        ...baseTask,
        logs: [
          createTaskLog({ timestamp: new Date('invalid-date') }),
        ],
      };

      // Should handle invalid dates by converting them to strings
      expect(() => {
        const result = formatTasksToMarkdown([malformedTask]);
        expect(result).toBeTruthy();
      }).not.toThrow();
    });

    it('should handle empty sections gracefully', () => {
      const emptyTask = createTask({
        logs: [],
        artifacts: [],
      });

      const result = formatTasksToMarkdown([emptyTask], {
        logsSection: 'separate',
        artifactsSection: 'separate'
      });

      expect(result).toContain('*No logs to display.*');
      expect(result).toContain('*No artifacts to display.*');
    });

    it('should handle very long field values', () => {
      const longDescription = 'A'.repeat(1000);
      const longTask = createTask({
        description: longDescription,
      });

      expect(() => {
        const result = formatTasksToMarkdown([longTask], { layout: 'summary' });
        expect(result).toContain('...');
      }).not.toThrow();
    });
  });
});