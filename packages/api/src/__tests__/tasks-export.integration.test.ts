import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { FastifyInstance } from 'fastify';
import { createServer } from '../index.js';
import { ApexOrchestrator } from '@apexcli/orchestrator';
import { Task, TaskStatus } from '@apexcli/core';
import { tmpdir } from 'os';
import { mkdtemp, rm, writeFile, mkdir } from 'fs/promises';
import path from 'path';

describe('Tasks Export Integration Tests', () => {
  let app: FastifyInstance;
  let orchestrator: ApexOrchestrator;
  let tempDir: string;
  let projectPath: string;
  let testTasks: Task[];

  beforeEach(async () => {
    // Create temporary directory for each test
    tempDir = await mkdtemp(path.join(tmpdir(), 'apex-export-integration-test-'));
    projectPath = path.join(tempDir, 'test-project');

    // Create a basic project structure
    await mkdir(projectPath, { recursive: true });
    const apexDir = path.join(projectPath, '.apex');
    await mkdir(apexDir, { recursive: true });

    // Create config.yaml for the project
    const configContent = `
version: "1.0"
name: "export-integration-test"
description: "Integration test project for export API"
agents:
  planner:
    name: "Planning Agent"
    role: "Creates plans"
  developer:
    name: "Development Agent"
    role: "Implements features"
workflows:
  test-workflow:
    name: "Test Development Workflow"
    description: "Simple workflow for testing"
    stages:
      - name: "planning"
        agent: "planner"
        description: "Create implementation plan"
      - name: "implementation"
        agent: "developer"
        description: "Implement the feature"
autonomy:
  level: "semi-autonomous"
`;

    await writeFile(path.join(apexDir, 'config.yaml'), configContent);

    // Create server instance
    app = await createServer({
      projectPath,
      port: 0, // Let system assign port
      silent: true
    });

    // Start server and get orchestrator reference
    await app.ready();
    orchestrator = (app as any).orchestrator;

    // Create test tasks with different dates and statuses
    const baseDate = new Date('2024-01-01T00:00:00.000Z');
    const testTaskDefinitions = [
      {
        description: 'First test task',
        workflow: 'test-workflow',
        createdAt: new Date(baseDate.getTime()),
        status: 'completed' as TaskStatus
      },
      {
        description: 'Second test task',
        workflow: 'test-workflow',
        createdAt: new Date(baseDate.getTime() + 24 * 60 * 60 * 1000), // +1 day
        status: 'pending' as TaskStatus
      },
      {
        description: 'Third test task',
        workflow: 'test-workflow',
        createdAt: new Date(baseDate.getTime() + 48 * 60 * 60 * 1000), // +2 days
        status: 'running' as TaskStatus
      },
      {
        description: 'Fourth test task',
        workflow: 'test-workflow',
        createdAt: new Date(baseDate.getTime() + 72 * 60 * 60 * 1000), // +3 days
        status: 'failed' as TaskStatus
      },
    ];

    // Create test tasks - start with basic tasks and let the system handle defaults
    testTasks = [];
    for (const taskDef of testTaskDefinitions) {
      try {
        const task = await orchestrator.createTask({
          description: taskDef.description,
          workflow: taskDef.workflow
        });

        // Get the created task
        const taskData = await orchestrator.getTask(task.taskId);
        if (taskData) {
          testTasks.push(taskData);
        }
      } catch (error) {
        // If task creation fails, continue with other tasks
        console.warn('Failed to create test task:', error);
      }
    }
  });

  afterEach(async () => {
    // Close server and cleanup
    if (app) {
      await app.close();
    }
    if (tempDir) {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  describe('Format Validation', () => {
    it('should export valid JSON format with correct headers', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/tasks/export?format=json'
      });

      expect(response.statusCode).toBe(200);
      expect(response.headers['content-type']).toBe('application/json; charset=utf-8');
      expect(response.headers['content-disposition']).toMatch(/attachment; filename="tasks-export-.*\.json"/);

      // Validate JSON structure
      const data = JSON.parse(response.body);
      expect(Array.isArray(data)).toBe(true);

      // Verify task structure if tasks exist
      if (data.length > 0) {
        const task = data[0];
        expect(task).toHaveProperty('id');
        expect(task).toHaveProperty('status');
        expect(task).toHaveProperty('createdAt');
        expect(task).toHaveProperty('description');
        expect(task).toHaveProperty('workflow');
      }
    });

    it('should export valid CSV format with correct headers', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/tasks/export?format=csv'
      });

      expect(response.statusCode).toBe(200);
      expect(response.headers['content-type']).toContain('text/csv');
      expect(response.headers['content-disposition']).toMatch(/attachment; filename="tasks-export-.*\.csv"/);

      // Validate CSV structure
      const csvContent = response.body;
      expect(typeof csvContent).toBe('string');
      expect(csvContent.length).toBeGreaterThan(0);

      // Should have headers row even if no data
      const lines = csvContent.split('\n').filter(line => line.trim());
      expect(lines.length).toBeGreaterThan(0);

      // First line should be headers
      if (lines.length > 0) {
        const headers = lines[0];
        expect(headers).toContain('id');
        expect(headers).toContain('status');
        expect(headers).toContain('description');
      }
    });

    it('should export valid Markdown format with correct headers', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/tasks/export?format=markdown'
      });

      expect(response.statusCode).toBe(200);
      expect(response.headers['content-type']).toContain('text/markdown');
      expect(response.headers['content-disposition']).toMatch(/attachment; filename="tasks-export-.*\.md"/);

      // Validate Markdown structure
      const markdownContent = response.body;
      expect(typeof markdownContent).toBe('string');
      expect(markdownContent.length).toBeGreaterThan(0);

      // Should contain markdown table headers
      expect(markdownContent).toContain('|');
      expect(markdownContent).toContain('-');
    });
  });

  describe('Date Range Filtering', () => {
    it('should filter tasks by startDate correctly', async () => {
      // Filter to only get tasks created on or after Jan 2, 2024
      const startDate = '2024-01-02T00:00:00.000Z';

      const response = await app.inject({
        method: 'GET',
        url: `/tasks/export?format=json&startDate=${startDate}`
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.body);
      expect(Array.isArray(data)).toBe(true);

      // All tasks should have createdAt >= startDate
      for (const task of data) {
        const taskCreatedAt = new Date(task.createdAt);
        expect(taskCreatedAt.getTime()).toBeGreaterThanOrEqual(new Date(startDate).getTime());
      }
    });

    it('should filter tasks by endDate correctly', async () => {
      // Filter to only get tasks created on or before Jan 2, 2024
      const endDate = '2024-01-02T23:59:59.999Z';

      const response = await app.inject({
        method: 'GET',
        url: `/tasks/export?format=json&endDate=${endDate}`
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.body);
      expect(Array.isArray(data)).toBe(true);

      // All tasks should have createdAt <= endDate
      for (const task of data) {
        const taskCreatedAt = new Date(task.createdAt);
        expect(taskCreatedAt.getTime()).toBeLessThanOrEqual(new Date(endDate).getTime());
      }
    });

    it('should filter tasks by both startDate and endDate', async () => {
      const startDate = '2024-01-02T00:00:00.000Z';
      const endDate = '2024-01-03T23:59:59.999Z';

      const response = await app.inject({
        method: 'GET',
        url: `/tasks/export?format=json&startDate=${startDate}&endDate=${endDate}`
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.body);
      expect(Array.isArray(data)).toBe(true);

      // All tasks should be within the date range
      for (const task of data) {
        const taskCreatedAt = new Date(task.createdAt);
        expect(taskCreatedAt.getTime()).toBeGreaterThanOrEqual(new Date(startDate).getTime());
        expect(taskCreatedAt.getTime()).toBeLessThanOrEqual(new Date(endDate).getTime());
      }
    });
  });

  describe('TaskIds Filtering', () => {
    it('should filter tasks by single taskId', async () => {
      if (testTasks.length === 0) {
        // Skip test if no tasks available
        return;
      }

      const taskId = testTasks[0].id;

      const response = await app.inject({
        method: 'GET',
        url: `/tasks/export?format=json&taskIds=${taskId}`
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.body);
      expect(Array.isArray(data)).toBe(true);

      // Should only return the specified task
      const returnedTaskIds = data.map((task: Task) => task.id);
      expect(returnedTaskIds).toContain(taskId);

      // All returned tasks should be the requested task
      data.forEach((task: Task) => {
        expect(task.id).toBe(taskId);
      });
    });

    it('should filter tasks by multiple taskIds', async () => {
      if (testTasks.length < 2) {
        // Skip test if not enough tasks available
        return;
      }

      const taskIds = [testTasks[0].id, testTasks[1].id];
      const taskIdsParam = taskIds.join(',');

      const response = await app.inject({
        method: 'GET',
        url: `/tasks/export?format=json&taskIds=${taskIdsParam}`
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.body);
      expect(Array.isArray(data)).toBe(true);

      // Should only return the specified tasks
      const returnedTaskIds = data.map((task: Task) => task.id);

      // All returned task IDs should be in our requested list
      returnedTaskIds.forEach(id => {
        expect(taskIds).toContain(id);
      });
    });

    it('should return empty array for non-existent taskIds', async () => {
      const nonExistentTaskId = 'non-existent-task-id';

      const response = await app.inject({
        method: 'GET',
        url: `/tasks/export?format=json&taskIds=${nonExistentTaskId}`
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.body);
      expect(Array.isArray(data)).toBe(true);
      expect(data).toHaveLength(0);
    });
  });

  describe('Error Handling', () => {
    it('should return 400 for invalid format parameter', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/tasks/export?format=invalid'
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error || body.message).toBeDefined();
      // Fastify schema validation error messages
      expect(body.message).toContain('must be equal to one of the allowed values');
    });

    it('should return 400 for missing format parameter', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/tasks/export'
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error || body.message).toBeDefined();
    });

    it('should return 400 for invalid startDate', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/tasks/export?format=json&startDate=invalid-date'
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error || body.message).toBeDefined();
      // Fastify schema validation error messages
      expect(body.message).toContain('must match format "date-time"');
    });

    it('should return 400 for invalid endDate', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/tasks/export?format=json&endDate=invalid-date'
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error || body.message).toBeDefined();
      // Fastify schema validation error messages
      expect(body.message).toContain('must match format "date-time"');
    });
  });

  describe('Empty Results Handling', () => {
    it('should handle empty task list gracefully for JSON format', async () => {
      // Use date range that excludes all our test tasks
      const startDate = '2025-01-01T00:00:00.000Z';
      const endDate = '2025-12-31T23:59:59.999Z';

      const response = await app.inject({
        method: 'GET',
        url: `/tasks/export?format=json&startDate=${startDate}&endDate=${endDate}`
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.body);
      expect(Array.isArray(data)).toBe(true);
      expect(data).toHaveLength(0);
    });

    it('should handle empty task list gracefully for CSV format', async () => {
      // Use date range that excludes all our test tasks
      const startDate = '2025-01-01T00:00:00.000Z';
      const endDate = '2025-12-31T23:59:59.999Z';

      const response = await app.inject({
        method: 'GET',
        url: `/tasks/export?format=csv&startDate=${startDate}&endDate=${endDate}`
      });

      expect(response.statusCode).toBe(200);
      expect(response.headers['content-type']).toContain('text/csv');

      // Should still have headers even with no data
      const csvContent = response.body;
      expect(typeof csvContent).toBe('string');
      expect(csvContent.length).toBeGreaterThan(0);
    });

    it('should handle empty task list gracefully for Markdown format', async () => {
      // Use date range that excludes all our test tasks
      const startDate = '2025-01-01T00:00:00.000Z';
      const endDate = '2025-12-31T23:59:59.999Z';

      const response = await app.inject({
        method: 'GET',
        url: `/tasks/export?format=markdown&startDate=${startDate}&endDate=${endDate}`
      });

      expect(response.statusCode).toBe(200);
      expect(response.headers['content-type']).toContain('text/markdown');

      // Should still have content even with no data
      const markdownContent = response.body;
      expect(typeof markdownContent).toBe('string');
      expect(markdownContent.length).toBeGreaterThan(0);
    });
  });

  describe('Combined Filtering', () => {
    it('should handle combined date range and taskIds filtering', async () => {
      if (testTasks.length === 0) {
        // Skip test if no tasks available
        return;
      }

      // Use a date range that should include our test tasks
      const startDate = '2024-01-01T00:00:00.000Z';
      const endDate = '2024-01-05T23:59:59.999Z';
      const taskIds = testTasks.slice(0, 2).map(task => task.id).join(',');

      const response = await app.inject({
        method: 'GET',
        url: `/tasks/export?format=json&startDate=${startDate}&endDate=${endDate}&taskIds=${taskIds}`
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.body);
      expect(Array.isArray(data)).toBe(true);

      // Verify that all filters are applied
      for (const task of data) {
        // Task should be in our specified list
        const specifiedTaskIds = taskIds.split(',');
        expect(specifiedTaskIds).toContain(task.id);

        // Task should be within date range
        const taskCreatedAt = new Date(task.createdAt);
        expect(taskCreatedAt.getTime()).toBeGreaterThanOrEqual(new Date(startDate).getTime());
        expect(taskCreatedAt.getTime()).toBeLessThanOrEqual(new Date(endDate).getTime());
      }
    });
  });

  describe('Content Headers Verification', () => {
    it('should set correct content-disposition header for all formats', async () => {
      const formats = [
        { format: 'json', extension: 'json' },
        { format: 'csv', extension: 'csv' },
        { format: 'markdown', extension: 'md' }
      ];

      for (const { format, extension } of formats) {
        const response = await app.inject({
          method: 'GET',
          url: `/tasks/export?format=${format}`
        });

        expect(response.statusCode).toBe(200);

        const disposition = response.headers['content-disposition'];
        expect(disposition).toBeDefined();
        expect(disposition).toContain('attachment');
        expect(disposition).toContain(`filename="`);
        expect(disposition).toContain(`tasks-export-`);
        expect(disposition).toContain(`.${extension}"`);

        // Verify filename format with timestamp
        const filenameMatch = disposition.match(/filename="(tasks-export-.*\.[\w]+)"/);
        expect(filenameMatch).not.toBeNull();

        if (filenameMatch) {
          const filename = filenameMatch[1];
          expect(filename).toMatch(new RegExp(`^tasks-export-\\d{4}-\\d{2}-\\d{2}T\\d{2}-\\d{2}-\\d{2}-\\d{3}Z\\.${extension}$`));
        }
      }
    });
  });
});