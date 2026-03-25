import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { FastifyInstance } from 'fastify';
import { createServer } from '../index.js';
import { tmpdir } from 'os';
import { mkdtemp, rm, writeFile, mkdir } from 'fs/promises';
import path from 'path';

describe('Export Endpoint Integration Tests', () => {
  let app: FastifyInstance;
  let tempDir: string;
  let projectPath: string;

  beforeEach(async () => {
    // Create temporary directory for each test
    tempDir = await mkdtemp(path.join(tmpdir(), 'apex-export-integration-test-'));
    projectPath = path.join(tempDir, 'test-project');

    // Create a basic project structure with some dummy data
    await mkdir(projectPath, { recursive: true });
    await mkdir(path.join(projectPath, '.apex'), { recursive: true });

    // Create server instance
    app = await createServer({
      projectPath,
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

  describe('Data format validation', () => {
    it('should export valid JSON format with proper structure', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/tasks/export?format=json'
      });

      expect(response.statusCode).toBe(200);
      expect(response.headers['content-type']).toBe('application/json; charset=utf-8');

      const data = JSON.parse(response.body);
      expect(Array.isArray(data)).toBe(true);

      // If there are tasks, validate structure
      if (data.length > 0) {
        const task = data[0];
        expect(task).toHaveProperty('id');
        expect(task).toHaveProperty('status');
        expect(task).toHaveProperty('createdAt');
      }
    });

    it('should export valid CSV format with proper headers', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/tasks/export?format=csv'
      });

      expect(response.statusCode).toBe(200);
      expect(response.headers['content-type']).toContain('text/csv');

      const csvData = response.body;
      expect(typeof csvData).toBe('string');

      // CSV should have at least headers even if no data
      expect(csvData.length).toBeGreaterThan(0);

      // Check for common CSV structure
      if (csvData.includes('\n')) {
        const lines = csvData.split('\n');
        expect(lines.length).toBeGreaterThan(0);
      }
    });

    it('should export valid Markdown format', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/tasks/export?format=markdown'
      });

      expect(response.statusCode).toBe(200);
      expect(response.headers['content-type']).toContain('text/markdown');

      const markdownData = response.body;
      expect(typeof markdownData).toBe('string');
      expect(markdownData.length).toBeGreaterThan(0);
    });
  });

  describe('Filter validation', () => {
    it('should handle date range filtering correctly', async () => {
      const startDate = new Date('2020-01-01T00:00:00.000Z').toISOString();
      const endDate = new Date('2030-12-31T23:59:59.999Z').toISOString();

      const response = await app.inject({
        method: 'GET',
        url: `/tasks/export?format=json&startDate=${startDate}&endDate=${endDate}`
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.body);
      expect(Array.isArray(data)).toBe(true);
    });

    it('should handle task ID filtering', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/tasks/export?format=json&taskIds=nonexistent-task-id'
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.body);
      expect(Array.isArray(data)).toBe(true);
      // Should return empty array or filtered results
    });

    it('should handle combination of all filters', async () => {
      const startDate = new Date('2020-01-01T00:00:00.000Z').toISOString();
      const endDate = new Date('2030-12-31T23:59:59.999Z').toISOString();
      const taskIds = 'test1,test2';

      const response = await app.inject({
        method: 'GET',
        url: `/tasks/export?format=json&startDate=${startDate}&endDate=${endDate}&taskIds=${taskIds}`
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.body);
      expect(Array.isArray(data)).toBe(true);
    });
  });

  describe('Content-Disposition headers', () => {
    it('should provide correct filename for JSON export', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/tasks/export?format=json'
      });

      expect(response.statusCode).toBe(200);
      const disposition = response.headers['content-disposition'];
      expect(disposition).toBeDefined();
      expect(disposition).toMatch(/attachment; filename="tasks-export-.*\.json"/);
    });

    it('should provide correct filename for CSV export', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/tasks/export?format=csv'
      });

      expect(response.statusCode).toBe(200);
      const disposition = response.headers['content-disposition'];
      expect(disposition).toBeDefined();
      expect(disposition).toMatch(/attachment; filename="tasks-export-.*\.csv"/);
    });

    it('should provide correct filename for Markdown export', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/tasks/export?format=markdown'
      });

      expect(response.statusCode).toBe(200);
      const disposition = response.headers['content-disposition'];
      expect(disposition).toBeDefined();
      expect(disposition).toMatch(/attachment; filename="tasks-export-.*\.md"/);
    });
  });

  describe('Performance and limits', () => {
    it('should handle export with reasonable response time', async () => {
      const startTime = Date.now();

      const response = await app.inject({
        method: 'GET',
        url: '/tasks/export?format=json'
      });

      const endTime = Date.now();
      const duration = endTime - startTime;

      expect(response.statusCode).toBe(200);
      // Should complete within 5 seconds for basic export
      expect(duration).toBeLessThan(5000);
    });

    it('should handle multiple concurrent export requests', async () => {
      const requests = [
        app.inject({ method: 'GET', url: '/tasks/export?format=json' }),
        app.inject({ method: 'GET', url: '/tasks/export?format=csv' }),
        app.inject({ method: 'GET', url: '/tasks/export?format=markdown' })
      ];

      const responses = await Promise.all(requests);

      responses.forEach(response => {
        expect(response.statusCode).toBe(200);
      });

      // Verify each format returned correct content type
      expect(responses[0].headers['content-type']).toBe('application/json; charset=utf-8');
      expect(responses[1].headers['content-type']).toContain('text/csv');
      expect(responses[2].headers['content-type']).toContain('text/markdown');
    });
  });

  describe('Error recovery', () => {
    it('should handle malformed query parameters gracefully', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/tasks/export?format=json&startDate=%&endDate=invalid'
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error || body.message).toBeDefined();
    });

    it('should validate parameter combinations', async () => {
      // Test with only endDate (no startDate)
      const response = await app.inject({
        method: 'GET',
        url: '/tasks/export?format=json&endDate=2024-12-31T23:59:59.999Z'
      });

      expect(response.statusCode).toBe(200);
      expect(response.headers['content-type']).toBe('application/json; charset=utf-8');
    });
  });
});