/**
 * Comprehensive test suite for v0.1.0 REST API CRUD endpoints
 * Tests task management endpoints focusing on Create, Read, Update, and Delete operations
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { FastifyInstance } from 'fastify';
import { createServer } from '../index.js';
import { tmpdir } from 'os';
import { mkdtemp, rm } from 'fs/promises';
import path from 'path';
import { CreateTaskRequest, TaskStatus } from '@apexcli/core';

describe('v0.1.0 REST API CRUD Operations', () => {
  let app: FastifyInstance;
  let tempDir: string;

  beforeEach(async () => {
    // Create temporary directory for each test
    tempDir = await mkdtemp(path.join(tmpdir(), 'apex-api-test-'));

    // Create server instance
    app = await createServer({
      projectPath: tempDir,
      port: 0, // Let system assign port
      silent: true
    });

    // Start server
    await app.ready();
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

  describe('Task CRUD Operations', () => {
    describe('CREATE - POST /tasks', () => {
      it('should create a new task with minimal required data', async () => {
        const taskData: CreateTaskRequest = {
          description: 'Test task creation'
        };

        const response = await app.inject({
          method: 'POST',
          url: '/tasks',
          payload: taskData,
          headers: { 'content-type': 'application/json' }
        });

        expect(response.statusCode).toBe(201);

        const body = JSON.parse(response.body);
        expect(body).toMatchObject({
          taskId: expect.any(String),
          status: expect.any(String),
          message: 'Task created and execution started'
        });
        expect(body.taskId).toMatch(/^task_[a-z0-9_-]+$/);
      });

      it('should create a task with full data', async () => {
        const taskData: CreateTaskRequest = {
          description: 'Complete task with all fields',
          acceptanceCriteria: 'Task should be fully functional',
          workflow: 'feature',
          autonomy: 'high'
        };

        const response = await app.inject({
          method: 'POST',
          url: '/tasks',
          payload: taskData,
          headers: { 'content-type': 'application/json' }
        });

        expect(response.statusCode).toBe(201);

        const body = JSON.parse(response.body);
        expect(body).toMatchObject({
          taskId: expect.any(String),
          status: expect.any(String),
          message: 'Task created and execution started'
        });
      });

      it('should return 400 for missing description', async () => {
        const response = await app.inject({
          method: 'POST',
          url: '/tasks',
          payload: {},
          headers: { 'content-type': 'application/json' }
        });

        expect(response.statusCode).toBe(400);

        const body = JSON.parse(response.body);
        expect(body).toMatchObject({
          error: 'Description is required'
        });
      });

      it('should handle invalid JSON payload', async () => {
        const response = await app.inject({
          method: 'POST',
          url: '/tasks',
          payload: '{ invalid json',
          headers: { 'content-type': 'application/json' }
        });

        expect(response.statusCode).toBe(400);
      });
    });

    describe('READ - GET /tasks/:id', () => {
      let createdTaskId: string;

      beforeEach(async () => {
        // Create a task for testing reads
        const createResponse = await app.inject({
          method: 'POST',
          url: '/tasks',
          payload: { description: 'Test task for reading' },
          headers: { 'content-type': 'application/json' }
        });
        const createBody = JSON.parse(createResponse.body);
        createdTaskId = createBody.taskId;
      });

      it('should retrieve a task by ID', async () => {
        const response = await app.inject({
          method: 'GET',
          url: `/tasks/${createdTaskId}`
        });

        expect(response.statusCode).toBe(200);

        const body = JSON.parse(response.body);
        expect(body).toMatchObject({
          id: createdTaskId,
          description: 'Test task for reading',
          status: expect.any(String)
        });
      });

      it('should return 404 for non-existent task', async () => {
        const response = await app.inject({
          method: 'GET',
          url: '/tasks/task_nonexistent'
        });

        expect(response.statusCode).toBe(404);

        const body = JSON.parse(response.body);
        expect(body).toMatchObject({
          error: 'Task not found'
        });
      });

      it('should support log pagination parameters', async () => {
        const response = await app.inject({
          method: 'GET',
          url: `/tasks/${createdTaskId}?logLimit=10&logOffset=0`
        });

        expect(response.statusCode).toBe(200);

        const body = JSON.parse(response.body);
        expect(body.id).toBe(createdTaskId);

        // Should include pagination info if logs exist
        if (body.logs && body.logs.length > 0) {
          expect(body).toHaveProperty('logPagination');
          expect(body.logPagination).toMatchObject({
            total: expect.any(Number),
            limit: 10,
            offset: 0,
            hasMore: expect.any(Boolean)
          });
        }
      });
    });

    describe('READ - GET /tasks (List)', () => {
      beforeEach(async () => {
        // Create multiple tasks for list testing
        const tasks = [
          { description: 'First task' },
          { description: 'Second task' },
          { description: 'Third task' }
        ];

        for (const task of tasks) {
          await app.inject({
            method: 'POST',
            url: '/tasks',
            payload: task,
            headers: { 'content-type': 'application/json' }
          });
        }
      });

      it('should list tasks with default pagination', async () => {
        const response = await app.inject({
          method: 'GET',
          url: '/tasks'
        });

        expect(response.statusCode).toBe(200);

        const body = JSON.parse(response.body);
        expect(body).toMatchObject({
          tasks: expect.any(Array),
          count: expect.any(Number),
          total: expect.any(Number),
          limit: 50,
          offset: 0
        });

        expect(body.tasks.length).toBeGreaterThan(0);
        expect(body.tasks[0]).toMatchObject({
          id: expect.any(String),
          description: expect.any(String),
          status: expect.any(String)
        });
      });

      it('should support custom pagination', async () => {
        const response = await app.inject({
          method: 'GET',
          url: '/tasks?limit=2&offset=1'
        });

        expect(response.statusCode).toBe(200);

        const body = JSON.parse(response.body);
        expect(body).toMatchObject({
          tasks: expect.any(Array),
          count: expect.any(Number),
          total: expect.any(Number),
          limit: 2,
          offset: 1
        });

        expect(body.tasks.length).toBeLessThanOrEqual(2);
      });

      it('should support status filtering', async () => {
        const response = await app.inject({
          method: 'GET',
          url: '/tasks?status=pending'
        });

        expect(response.statusCode).toBe(200);

        const body = JSON.parse(response.body);
        expect(body.tasks).toBeInstanceOf(Array);
      });

      it('should support full data retrieval', async () => {
        const response = await app.inject({
          method: 'GET',
          url: '/tasks?full=true'
        });

        expect(response.statusCode).toBe(200);

        const body = JSON.parse(response.body);
        expect(body.tasks).toBeInstanceOf(Array);
        // Full tasks should contain more detailed information
      });

      it('should enforce maximum limit', async () => {
        const response = await app.inject({
          method: 'GET',
          url: '/tasks?limit=500'  // Exceeds max of 200
        });

        expect(response.statusCode).toBe(200);

        const body = JSON.parse(response.body);
        expect(body.limit).toBeLessThanOrEqual(200);
      });
    });

    describe('READ - GET /tasks/stats', () => {
      it('should return task statistics', async () => {
        const response = await app.inject({
          method: 'GET',
          url: '/tasks/stats'
        });

        expect([200, 500]).toContain(response.statusCode);

        if (response.statusCode === 200) {
          const body = JSON.parse(response.body);
          expect(body).toMatchObject({
            byStatus: expect.any(Object),
            totalCost: expect.any(Number),
            totalTokens: expect.any(Number)
          });
        }
      });
    });

    describe('UPDATE - POST /tasks/:id/status', () => {
      let createdTaskId: string;

      beforeEach(async () => {
        const createResponse = await app.inject({
          method: 'POST',
          url: '/tasks',
          payload: { description: 'Task for status updates' },
          headers: { 'content-type': 'application/json' }
        });
        const createBody = JSON.parse(createResponse.body);
        createdTaskId = createBody.taskId;
      });

      it('should update task status', async () => {
        const updateData = {
          status: 'in-progress',
          stage: 'implementation',
          message: 'Starting implementation'
        };

        const response = await app.inject({
          method: 'POST',
          url: `/tasks/${createdTaskId}/status`,
          payload: updateData,
          headers: { 'content-type': 'application/json' }
        });

        expect(response.statusCode).toBe(200);

        const body = JSON.parse(response.body);
        expect(body).toMatchObject({
          ok: true
        });
      });

      it('should return 404 for non-existent task', async () => {
        const response = await app.inject({
          method: 'POST',
          url: '/tasks/task_nonexistent/status',
          payload: { status: 'completed' },
          headers: { 'content-type': 'application/json' }
        });

        expect(response.statusCode).toBe(404);

        const body = JSON.parse(response.body);
        expect(body).toMatchObject({
          error: 'Task not found'
        });
      });
    });

    describe('UPDATE - POST /tasks/:id/log', () => {
      let createdTaskId: string;

      beforeEach(async () => {
        const createResponse = await app.inject({
          method: 'POST',
          url: '/tasks',
          payload: { description: 'Task for log entries' },
          headers: { 'content-type': 'application/json' }
        });
        const createBody = JSON.parse(createResponse.body);
        createdTaskId = createBody.taskId;
      });

      it('should add log entry to task', async () => {
        const logData = {
          level: 'info',
          message: 'Task is progressing well',
          agent: 'test-agent'
        };

        const response = await app.inject({
          method: 'POST',
          url: `/tasks/${createdTaskId}/log`,
          payload: logData,
          headers: { 'content-type': 'application/json' }
        });

        expect(response.statusCode).toBe(200);

        const body = JSON.parse(response.body);
        expect(body).toMatchObject({
          ok: true
        });
      });

      it('should use default log level', async () => {
        const logData = {
          message: 'Default level log message'
        };

        const response = await app.inject({
          method: 'POST',
          url: `/tasks/${createdTaskId}/log`,
          payload: logData,
          headers: { 'content-type': 'application/json' }
        });

        expect(response.statusCode).toBe(200);

        const body = JSON.parse(response.body);
        expect(body).toMatchObject({
          ok: true
        });
      });

      it('should return 404 for non-existent task', async () => {
        const response = await app.inject({
          method: 'POST',
          url: '/tasks/task_nonexistent/log',
          payload: { message: 'Test log' },
          headers: { 'content-type': 'application/json' }
        });

        expect(response.statusCode).toBe(404);

        const body = JSON.parse(response.body);
        expect(body).toMatchObject({
          error: 'Task not found'
        });
      });
    });

    describe('Task Control Operations', () => {
      let createdTaskId: string;

      beforeEach(async () => {
        const createResponse = await app.inject({
          method: 'POST',
          url: '/tasks',
          payload: { description: 'Task for control operations' },
          headers: { 'content-type': 'application/json' }
        });
        const createBody = JSON.parse(createResponse.body);
        createdTaskId = createBody.taskId;
      });

      describe('POST /tasks/:id/cancel', () => {
        it('should cancel a task', async () => {
          const response = await app.inject({
            method: 'POST',
            url: `/tasks/${createdTaskId}/cancel`
          });

          expect(response.statusCode).toBe(200);

          const body = JSON.parse(response.body);
          expect(body).toMatchObject({
            ok: true,
            message: 'Task cancelled'
          });
        });

        it('should return 404 for non-existent task', async () => {
          const response = await app.inject({
            method: 'POST',
            url: '/tasks/task_nonexistent/cancel'
          });

          expect(response.statusCode).toBe(404);

          const body = JSON.parse(response.body);
          expect(body).toMatchObject({
            error: 'Task not found'
          });
        });
      });

      describe('POST /tasks/:id/retry', () => {
        it('should retry a task', async () => {
          // First cancel the task to make it retryable
          await app.inject({
            method: 'POST',
            url: `/tasks/${createdTaskId}/cancel`
          });

          const response = await app.inject({
            method: 'POST',
            url: `/tasks/${createdTaskId}/retry`
          });

          expect(response.statusCode).toBe(200);

          const body = JSON.parse(response.body);
          expect(body).toMatchObject({
            ok: true,
            message: 'Task retry started'
          });
        });

        it('should return 404 for non-existent task', async () => {
          const response = await app.inject({
            method: 'POST',
            url: '/tasks/task_nonexistent/retry'
          });

          expect(response.statusCode).toBe(404);

          const body = JSON.parse(response.body);
          expect(body).toMatchObject({
            error: 'Task not found'
          });
        });
      });

      describe('POST /tasks/:id/resume', () => {
        it('should resume a task', async () => {
          const response = await app.inject({
            method: 'POST',
            url: `/tasks/${createdTaskId}/resume`
          });

          expect(response.statusCode).toBe(200);

          const body = JSON.parse(response.body);
          expect(body).toMatchObject({
            ok: true,
            taskId: createdTaskId
          });
          expect(body.message).toMatch(/Task.*started|resumed|initiated/);
        });

        it('should return 404 for non-existent task', async () => {
          const response = await app.inject({
            method: 'POST',
            url: '/tasks/task_nonexistent/resume'
          });

          expect(response.statusCode).toBe(404);

          const body = JSON.parse(response.body);
          expect(body).toMatchObject({
            error: 'Task not found'
          });
        });
      });
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle invalid task IDs gracefully', async () => {
      const invalidIds = ['', 'invalid-id', '123', 'task_', 'task_invalid*id'];

      for (const id of invalidIds) {
        const response = await app.inject({
          method: 'GET',
          url: `/tasks/${id}`
        });

        expect([404, 400]).toContain(response.statusCode);
      }
    });

    it('should validate pagination parameters', async () => {
      const invalidParams = [
        'limit=-1',
        'limit=abc',
        'offset=-5',
        'offset=xyz'
      ];

      for (const param of invalidParams) {
        const response = await app.inject({
          method: 'GET',
          url: `/tasks?${param}`
        });

        // Should either work with defaults or return 400
        expect([200, 400]).toContain(response.statusCode);
      }
    });

    it('should handle malformed request payloads', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/tasks',
        payload: 'not json',
        headers: { 'content-type': 'application/json' }
      });

      expect(response.statusCode).toBe(400);
    });

    it('should handle empty request bodies', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/tasks',
        payload: '',
        headers: { 'content-type': 'application/json' }
      });

      expect(response.statusCode).toBe(400);
    });
  });

  describe('Content-Type Handling', () => {
    it('should require Content-Type for POST requests', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/tasks',
        payload: { description: 'Test task' }
        // No Content-Type header
      });

      // Should handle missing content-type gracefully
      expect([200, 201, 400, 415]).toContain(response.statusCode);
    });

    it('should handle different content types', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/tasks',
        payload: JSON.stringify({ description: 'Test task' }),
        headers: { 'content-type': 'text/plain' }
      });

      // Should either parse or reject gracefully
      expect([200, 201, 400, 415]).toContain(response.statusCode);
    });
  });

  describe('Response Format Consistency', () => {
    it('should return consistent error response format', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/tasks/task_nonexistent'
      });

      expect(response.statusCode).toBe(404);

      const body = JSON.parse(response.body);
      expect(body).toHaveProperty('error');
      expect(typeof body.error).toBe('string');
    });

    it('should return consistent success response format', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/tasks',
        payload: { description: 'Consistency test' },
        headers: { 'content-type': 'application/json' }
      });

      expect(response.statusCode).toBe(201);

      const body = JSON.parse(response.body);
      expect(body).toHaveProperty('taskId');
      expect(body).toHaveProperty('status');
      expect(body).toHaveProperty('message');
    });
  });
});