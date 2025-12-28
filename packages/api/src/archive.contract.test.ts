import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { createServer } from './index';
import { FastifyInstance } from 'fastify';

// Contract tests ensure API responses match expected formats and behavior
describe('Archive API Contract Tests', () => {
  let testDir: string;
  let server: FastifyInstance;

  beforeEach(async () => {
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'apex-api-archive-contract-'));
    await fs.mkdir(path.join(testDir, '.apex'), { recursive: true });

    await fs.writeFile(
      path.join(testDir, '.apex', 'config.yaml'),
      `version: "1.0"\nproject:\n  name: test-archive-contract\n`
    );

    server = await createServer({
      port: 0,
      host: '127.0.0.1',
      projectPath: testDir,
      silent: true,
    });
  });

  afterEach(async () => {
    await server.close();
    await fs.rm(testDir, { recursive: true, force: true });
  });

  describe('POST /tasks/:id/archive response contract', () => {
    it('should return proper response structure on successful archive', async () => {
      // Create and complete task
      const createResponse = await server.inject({
        method: 'POST',
        url: '/tasks',
        headers: { 'Content-Type': 'application/json' },
        payload: { description: 'Contract test task' },
      });
      const { taskId } = JSON.parse(createResponse.body);

      await server.inject({
        method: 'POST',
        url: `/tasks/${taskId}/status`,
        headers: { 'Content-Type': 'application/json' },
        payload: { status: 'completed' },
      });

      // Archive the task
      const response = await server.inject({
        method: 'POST',
        url: `/tasks/${taskId}/archive`,
      });

      expect(response.statusCode).toBe(200);
      expect(response.headers['content-type']).toMatch(/application\/json/);

      const body = JSON.parse(response.body);

      // Verify exact response structure
      expect(body).toEqual({
        ok: true,
        message: 'Task archived'
      });

      // Ensure no extra properties
      expect(Object.keys(body)).toEqual(['ok', 'message']);
    });

    it('should return proper error response structure for 404', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/tasks/nonexistent-id/archive',
      });

      expect(response.statusCode).toBe(404);
      expect(response.headers['content-type']).toMatch(/application\/json/);

      const body = JSON.parse(response.body);

      // Verify exact error response structure
      expect(body).toEqual({
        error: 'Task not found'
      });

      expect(Object.keys(body)).toEqual(['error']);
    });

    it('should return proper error response structure for 400 (already archived)', async () => {
      // Create, complete, and archive task
      const createResponse = await server.inject({
        method: 'POST',
        url: '/tasks',
        headers: { 'Content-Type': 'application/json' },
        payload: { description: 'Double archive test' },
      });
      const { taskId } = JSON.parse(createResponse.body);

      await server.inject({
        method: 'POST',
        url: `/tasks/${taskId}/status`,
        headers: { 'Content-Type': 'application/json' },
        payload: { status: 'completed' },
      });

      await server.inject({
        method: 'POST',
        url: `/tasks/${taskId}/archive`,
      });

      // Try to archive again
      const response = await server.inject({
        method: 'POST',
        url: `/tasks/${taskId}/archive`,
      });

      expect(response.statusCode).toBe(400);
      expect(response.headers['content-type']).toMatch(/application\/json/);

      const body = JSON.parse(response.body);

      // Verify exact error response structure
      expect(body).toEqual({
        error: 'Task is already archived'
      });
    });

    it('should return proper error response structure for 400 (not completed)', async () => {
      const createResponse = await server.inject({
        method: 'POST',
        url: '/tasks',
        headers: { 'Content-Type': 'application/json' },
        payload: { description: 'Not completed test' },
      });
      const { taskId } = JSON.parse(createResponse.body);

      const response = await server.inject({
        method: 'POST',
        url: `/tasks/${taskId}/archive`,
      });

      expect(response.statusCode).toBe(400);
      expect(response.headers['content-type']).toMatch(/application\/json/);

      const body = JSON.parse(response.body);

      // Verify error message format
      expect(body).toHaveProperty('error');
      expect(body.error).toContain('only completed tasks can be archived');
      expect(typeof body.error).toBe('string');
    });
  });

  describe('GET /tasks/archived response contract', () => {
    it('should return proper response structure when no archived tasks exist', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/tasks/archived',
      });

      expect(response.statusCode).toBe(200);
      expect(response.headers['content-type']).toMatch(/application\/json/);

      const body = JSON.parse(response.body);

      // Verify exact response structure
      expect(body).toEqual({
        tasks: [],
        count: 0,
        message: 'No archived tasks found'
      });

      expect(Object.keys(body)).toEqual(['tasks', 'count', 'message']);
    });

    it('should return proper response structure with archived tasks', async () => {
      // Create and archive tasks
      const taskIds: string[] = [];
      for (let i = 0; i < 2; i++) {
        const createResponse = await server.inject({
          method: 'POST',
          url: '/tasks',
          headers: { 'Content-Type': 'application/json' },
          payload: { description: `Archived task ${i + 1}` },
        });
        const { taskId } = JSON.parse(createResponse.body);

        await server.inject({
          method: 'POST',
          url: `/tasks/${taskId}/status`,
          headers: { 'Content-Type': 'application/json' },
          payload: { status: 'completed' },
        });

        await server.inject({
          method: 'POST',
          url: `/tasks/${taskId}/archive`,
        });

        taskIds.push(taskId);
      }

      const response = await server.inject({
        method: 'GET',
        url: '/tasks/archived',
      });

      expect(response.statusCode).toBe(200);
      expect(response.headers['content-type']).toMatch(/application\/json/);

      const body = JSON.parse(response.body);

      // Verify response structure
      expect(body).toHaveProperty('tasks');
      expect(body).toHaveProperty('count');
      expect(body).toHaveProperty('message');

      expect(Array.isArray(body.tasks)).toBe(true);
      expect(typeof body.count).toBe('number');
      expect(typeof body.message).toBe('string');

      expect(body.count).toBe(2);
      expect(body.tasks.length).toBe(2);
      expect(body.message).toBe('2 archived task(s) found');

      // Verify task structure in the array
      body.tasks.forEach((task: any) => {
        expect(task).toHaveProperty('id');
        expect(task).toHaveProperty('description');
        expect(task).toHaveProperty('status');
        expect(task).toHaveProperty('archivedAt');
        expect(task.status).toBe('completed');
        expect(task.archivedAt).not.toBeNull();
        expect(taskIds).toContain(task.id);
      });
    });

    it('should handle error response structure for archived tasks endpoint', async () => {
      // This test would be relevant if the archived endpoint could return 500 errors
      // For now, we test that it always returns 200 with proper structure
      const response = await server.inject({
        method: 'GET',
        url: '/tasks/archived',
      });

      expect(response.statusCode).toBe(200);

      // Even on success, structure should be consistent
      const body = JSON.parse(response.body);
      expect(Object.keys(body)).toEqual(['tasks', 'count', 'message']);
    });
  });

  describe('Archive API HTTP method validation', () => {
    it('should reject unsupported HTTP methods on archive endpoint', async () => {
      // Test various unsupported methods
      const unsupportedMethods = ['GET', 'PUT', 'DELETE', 'PATCH'] as const;

      for (const method of unsupportedMethods) {
        const response = await server.inject({
          method: method as 'GET' | 'PUT' | 'DELETE' | 'PATCH',
          url: '/tasks/some-id/archive',
        });

        // Should return 404 (route not found) or 405 (method not allowed)
        expect([404, 405]).toContain(response.statusCode);
      }
    });

    it('should reject unsupported HTTP methods on archived list endpoint', async () => {
      const unsupportedMethods = ['POST', 'PUT', 'DELETE', 'PATCH'] as const;

      for (const method of unsupportedMethods) {
        const response = await server.inject({
          method: method as 'POST' | 'PUT' | 'DELETE' | 'PATCH',
          url: '/tasks/archived',
        });

        // Should return 404 (route not found) or 405 (method not allowed)
        expect([404, 405]).toContain(response.statusCode);
      }
    });
  });

  describe('Archive API content type handling', () => {
    it('should handle various content types for POST archive', async () => {
      // Create and complete task
      const createResponse = await server.inject({
        method: 'POST',
        url: '/tasks',
        headers: { 'Content-Type': 'application/json' },
        payload: { description: 'Content type test' },
      });
      const { taskId } = JSON.parse(createResponse.body);

      await server.inject({
        method: 'POST',
        url: `/tasks/${taskId}/status`,
        headers: { 'Content-Type': 'application/json' },
        payload: { status: 'completed' },
      });

      // Should work without content-type header
      const response1 = await server.inject({
        method: 'POST',
        url: `/tasks/${taskId}/archive`,
      });
      expect(response1.statusCode).toBe(200);

      // Create another task for the next test
      const createResponse2 = await server.inject({
        method: 'POST',
        url: '/tasks',
        headers: { 'Content-Type': 'application/json' },
        payload: { description: 'Content type test 2' },
      });
      const { taskId: taskId2 } = JSON.parse(createResponse2.body);

      await server.inject({
        method: 'POST',
        url: `/tasks/${taskId2}/status`,
        headers: { 'Content-Type': 'application/json' },
        payload: { status: 'completed' },
      });

      // Should work with application/json
      const response2 = await server.inject({
        method: 'POST',
        url: `/tasks/${taskId2}/archive`,
        headers: { 'Content-Type': 'application/json' },
        payload: {},
      });
      expect(response2.statusCode).toBe(200);
    });
  });
});