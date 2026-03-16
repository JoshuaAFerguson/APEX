/**
 * Integration tests for the DELETE /agents/:name endpoint
 * Uses real server with temporary test environment
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { FastifyInstance } from 'fastify';
import { createServer } from '../index';
import path from 'path';
import { tmpdir } from 'os';
import { mkdtemp, rm } from 'fs/promises';
import { AgentDefinition } from '@apexcli/core';

const testAgent: AgentDefinition = {
  name: 'delete-test-agent',
  description: 'Test agent for DELETE endpoint testing',
  prompt: 'You are a test agent for delete testing',
  tools: ['file-operations', 'web-search'],
  model: 'sonnet',
  skills: ['testing', 'validation']
};

describe('DELETE /agents/:name endpoint integration', () => {
  let server: FastifyInstance;
  let testDir: string;

  beforeEach(async () => {
    // Create temporary directory for test
    testDir = await mkdtemp(path.join(tmpdir(), 'agents-delete-integration-test-'));

    // Create server with test configuration
    server = await createServer({
      projectPath: testDir,
      port: 0,
      silent: true
    });

    await server.ready();
  });

  afterEach(async () => {
    if (server) {
      await server.close();
    }
    if (testDir) {
      await rm(testDir, { recursive: true, force: true });
    }
  });

  describe('successful deletion', () => {
    it('deletes agent and returns 204', async () => {
      // First create an agent
      const createResponse = await server.inject({
        method: 'POST',
        url: '/agents',
        payload: testAgent,
        headers: { 'content-type': 'application/json' }
      });
      expect(createResponse.statusCode).toBe(201);

      // Delete the agent
      const deleteResponse = await server.inject({
        method: 'DELETE',
        url: `/agents/${testAgent.name}`,
      });

      expect(deleteResponse.statusCode).toBe(204);
      expect(deleteResponse.body).toBe('');

      // Verify agent is deleted by trying to get it
      const getResponse = await server.inject({
        method: 'GET',
        url: `/agents/${testAgent.name}`
      });
      expect(getResponse.statusCode).toBe(404);
    });

    it('handles agent names with special characters', async () => {
      const specialAgent = {
        ...testAgent,
        name: 'special-agent_123'
      };

      // Create agent with special name
      const createResponse = await server.inject({
        method: 'POST',
        url: '/agents',
        payload: specialAgent,
        headers: { 'content-type': 'application/json' }
      });
      expect(createResponse.statusCode).toBe(201);

      // Delete the agent
      const deleteResponse = await server.inject({
        method: 'DELETE',
        url: `/agents/${specialAgent.name}`,
      });

      expect(deleteResponse.statusCode).toBe(204);
      expect(deleteResponse.body).toBe('');
    });
  });

  describe('error handling', () => {
    it('returns 404 for non-existent agent', async () => {
      const response = await server.inject({
        method: 'DELETE',
        url: '/agents/non-existent-agent',
      });

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body).toHaveProperty('error');
      expect(body.error).toContain('not found');
    });

    it('returns 400 for empty agent name', async () => {
      const response = await server.inject({
        method: 'DELETE',
        url: '/agents/%20', // URL encoded space
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body).toEqual({ error: 'Agent name is required' });
    });

    it('returns 400 for agent name with only whitespace', async () => {
      const response = await server.inject({
        method: 'DELETE',
        url: '/agents/%20%20%20', // URL encoded spaces
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body).toEqual({ error: 'Agent name is required' });
    });

    it('returns 400 for agent name with invalid format', async () => {
      const response = await server.inject({
        method: 'DELETE',
        url: '/agents/InvalidAgent', // Capital letters
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toContain('lowercase letter');
    });

    it('returns 400 for agent name with double dots', async () => {
      // Note: agent..name won't match regex due to dots, but that's expected behavior
      const response = await server.inject({
        method: 'DELETE',
        url: '/agents/agent..name',
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      // Could fail on regex OR path traversal check - both are valid rejections
      expect(body.error).toMatch(/lowercase letter|path traversal/);
    });

    it('returns 400 for agent name starting with number', async () => {
      const response = await server.inject({
        method: 'DELETE',
        url: '/agents/1-invalid-agent',
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toContain('lowercase letter');
    });
  });

  describe('idempotency', () => {
    it('returns 404 when trying to delete same agent twice', async () => {
      // Create agent
      const createResponse = await server.inject({
        method: 'POST',
        url: '/agents',
        payload: testAgent,
        headers: { 'content-type': 'application/json' }
      });
      expect(createResponse.statusCode).toBe(201);

      // Delete the agent first time
      const firstDeleteResponse = await server.inject({
        method: 'DELETE',
        url: `/agents/${testAgent.name}`,
      });
      expect(firstDeleteResponse.statusCode).toBe(204);

      // Try to delete again - should return 404
      const secondDeleteResponse = await server.inject({
        method: 'DELETE',
        url: `/agents/${testAgent.name}`,
      });
      expect(secondDeleteResponse.statusCode).toBe(404);
      const body = JSON.parse(secondDeleteResponse.body);
      expect(body.error).toContain('not found');
    });
  });

  describe('consistency checks', () => {
    it('removes agent from listings after deletion', async () => {
      // Create agent
      const createResponse = await server.inject({
        method: 'POST',
        url: '/agents',
        payload: testAgent,
        headers: { 'content-type': 'application/json' }
      });
      expect(createResponse.statusCode).toBe(201);

      // Verify agent appears in listings
      const listBeforeResponse = await server.inject({
        method: 'GET',
        url: '/agents'
      });
      expect(listBeforeResponse.statusCode).toBe(200);
      const beforeList = JSON.parse(listBeforeResponse.body);
      expect(beforeList.agents).toHaveProperty(testAgent.name);

      // Delete the agent
      const deleteResponse = await server.inject({
        method: 'DELETE',
        url: `/agents/${testAgent.name}`,
      });
      expect(deleteResponse.statusCode).toBe(204);

      // Verify agent no longer appears in listings
      const listAfterResponse = await server.inject({
        method: 'GET',
        url: '/agents'
      });
      expect(listAfterResponse.statusCode).toBe(200);
      const afterList = JSON.parse(listAfterResponse.body);
      expect(afterList.agents).not.toHaveProperty(testAgent.name);
    });
  });
});