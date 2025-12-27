import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { createServer } from './index';
import { FastifyInstance } from 'fastify';

// This test focuses specifically on archive API performance and stress testing
describe('Archive API Performance Tests', () => {
  let testDir: string;
  let server: FastifyInstance;

  beforeEach(async () => {
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'apex-api-archive-perf-'));
    await fs.mkdir(path.join(testDir, '.apex'), { recursive: true });

    await fs.writeFile(
      path.join(testDir, '.apex', 'config.yaml'),
      `version: "1.0"\nproject:\n  name: test-archive-perf\n`
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

  it('should handle multiple simultaneous archive requests', async () => {
    // Create multiple completed tasks
    const taskPromises = Array.from({ length: 5 }, async (_, i) => {
      const createResponse = await server.inject({
        method: 'POST',
        url: '/tasks',
        headers: { 'Content-Type': 'application/json' },
        payload: { description: `Concurrent archive test task ${i}` },
      });
      const { taskId } = JSON.parse(createResponse.body);

      // Complete the task
      await server.inject({
        method: 'POST',
        url: `/tasks/${taskId}/status`,
        headers: { 'Content-Type': 'application/json' },
        payload: { status: 'completed' },
      });

      return taskId;
    });

    const taskIds = await Promise.all(taskPromises);

    // Archive all tasks concurrently
    const archivePromises = taskIds.map(taskId =>
      server.inject({
        method: 'POST',
        url: `/tasks/${taskId}/archive`,
      })
    );

    const archiveResponses = await Promise.all(archivePromises);

    // All should succeed
    archiveResponses.forEach(response => {
      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.ok).toBe(true);
    });

    // Verify all are archived
    const archivedResponse = await server.inject({
      method: 'GET',
      url: '/tasks/archived',
    });

    expect(archivedResponse.statusCode).toBe(200);
    const body = JSON.parse(archivedResponse.body);
    expect(body.count).toBe(5);
  });

  it('should handle rapid successive archive/list requests', async () => {
    // Create and complete a task
    const createResponse = await server.inject({
      method: 'POST',
      url: '/tasks',
      headers: { 'Content-Type': 'application/json' },
      payload: { description: 'Rapid succession test' },
    });
    const { taskId } = JSON.parse(createResponse.body);

    await server.inject({
      method: 'POST',
      url: `/tasks/${taskId}/status`,
      headers: { 'Content-Type': 'application/json' },
      payload: { status: 'completed' },
    });

    // Archive the task
    const archiveResponse = await server.inject({
      method: 'POST',
      url: `/tasks/${taskId}/archive`,
    });
    expect(archiveResponse.statusCode).toBe(200);

    // Make multiple rapid list requests
    const listPromises = Array.from({ length: 10 }, () =>
      server.inject({
        method: 'GET',
        url: '/tasks/archived',
      })
    );

    const listResponses = await Promise.all(listPromises);

    // All should succeed and return consistent results
    listResponses.forEach(response => {
      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.count).toBe(1);
      expect(body.tasks.length).toBe(1);
      expect(body.tasks[0].id).toBe(taskId);
    });
  });

  it('should maintain performance with large archived task lists', async () => {
    // Create and archive many tasks
    const numTasks = 20;
    const taskIds: string[] = [];

    for (let i = 0; i < numTasks; i++) {
      const createResponse = await server.inject({
        method: 'POST',
        url: '/tasks',
        headers: { 'Content-Type': 'application/json' },
        payload: { description: `Performance test task ${i}` },
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

    // Measure response time for listing archived tasks
    const startTime = Date.now();
    const listResponse = await server.inject({
      method: 'GET',
      url: '/tasks/archived',
    });
    const responseTime = Date.now() - startTime;

    expect(listResponse.statusCode).toBe(200);
    const body = JSON.parse(listResponse.body);
    expect(body.count).toBe(numTasks);
    expect(body.tasks.length).toBe(numTasks);

    // Response should be reasonably fast (less than 1 second for 20 tasks)
    expect(responseTime).toBeLessThan(1000);
  });
});