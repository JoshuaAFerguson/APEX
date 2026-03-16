/**
 * Comprehensive integration tests for Agent CRUD REST API endpoints
 * Tests full CRUD lifecycle, edge cases, and error conditions
 *
 * Based on ADR: Agent CRUD Integration Tests Architecture
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { FastifyInstance } from 'fastify';
import { createServer } from '../index.js';
import { tmpdir } from 'os';
import { mkdtemp, rm } from 'fs/promises';
import path from 'path';
import { AgentDefinition } from '@apexcli/core';
import {
  validAgentFixtures,
  invalidAgentFixtures,
  updateFixtures,
  fixtureUtils
} from './fixtures/agent-fixtures.js';

describe('Agent CRUD Integration Tests', () => {
  let app: FastifyInstance;
  let tempDir: string;

  beforeEach(async () => {
    // Create temporary directory for each test
    tempDir = await mkdtemp(path.join(tmpdir(), 'apex-agent-test-'));

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

  describe('Full CRUD Flow', () => {
    it('should complete full CRUD lifecycle', async () => {
      const agentDef = fixtureUtils.withUniqueName(validAgentFixtures.full);

      // CREATE - POST /agents
      const createResponse = await app.inject({
        method: 'POST',
        url: '/agents',
        payload: agentDef,
        headers: { 'content-type': 'application/json' }
      });
      expect(createResponse.statusCode).toBe(201);

      const createdAgent = JSON.parse(createResponse.body);
      expect(createdAgent).toMatchObject({
        name: agentDef.name,
        description: agentDef.description,
        prompt: agentDef.prompt,
        tools: agentDef.tools,
        model: agentDef.model,
        skills: agentDef.skills
      });

      // READ - GET /agents/:name
      const getResponse = await app.inject({
        method: 'GET',
        url: `/agents/${agentDef.name}`
      });
      expect(getResponse.statusCode).toBe(200);

      const retrievedAgent = JSON.parse(getResponse.body);
      expect(retrievedAgent).toEqual(createdAgent);

      // READ - GET /agents (verify appears in list)
      const listResponse = await app.inject({
        method: 'GET',
        url: '/agents'
      });
      expect(listResponse.statusCode).toBe(200);

      const { agents } = JSON.parse(listResponse.body);
      expect(agents).toHaveProperty(agentDef.name);
      expect(agents[agentDef.name]).toEqual(createdAgent);

      // UPDATE - PUT /agents/:name
      const updateResponse = await app.inject({
        method: 'PUT',
        url: `/agents/${agentDef.name}`,
        payload: updateFixtures.complete,
        headers: { 'content-type': 'application/json' }
      });
      expect(updateResponse.statusCode).toBe(200);

      const updatedAgent = JSON.parse(updateResponse.body);
      expect(updatedAgent).toMatchObject({
        name: agentDef.name, // Name should remain unchanged
        description: updateFixtures.complete.description,
        prompt: updateFixtures.complete.prompt,
        tools: updateFixtures.complete.tools,
        model: updateFixtures.complete.model,
        skills: updateFixtures.complete.skills
      });

      // Verify update persisted - GET /agents/:name
      const getUpdatedResponse = await app.inject({
        method: 'GET',
        url: `/agents/${agentDef.name}`
      });
      expect(getUpdatedResponse.statusCode).toBe(200);
      expect(JSON.parse(getUpdatedResponse.body)).toEqual(updatedAgent);

      // DELETE - DELETE /agents/:name
      const deleteResponse = await app.inject({
        method: 'DELETE',
        url: `/agents/${agentDef.name}`
      });
      expect(deleteResponse.statusCode).toBe(204);
      expect(deleteResponse.body).toBe('');

      // Verify deletion - GET /agents/:name should return 404
      const getAfterDeleteResponse = await app.inject({
        method: 'GET',
        url: `/agents/${agentDef.name}`
      });
      expect(getAfterDeleteResponse.statusCode).toBe(404);

      // Verify not in list
      const listAfterDeleteResponse = await app.inject({
        method: 'GET',
        url: '/agents'
      });
      expect(listAfterDeleteResponse.statusCode).toBe(200);

      const { agents: agentsAfterDelete } = JSON.parse(listAfterDeleteResponse.body);
      expect(agentsAfterDelete).not.toHaveProperty(agentDef.name);
    });

    it('should handle minimal agent creation and full update', async () => {
      const agentDef = fixtureUtils.withUniqueName(validAgentFixtures.minimal);

      // Create minimal agent
      const createResponse = await app.inject({
        method: 'POST',
        url: '/agents',
        payload: agentDef,
        headers: { 'content-type': 'application/json' }
      });
      expect(createResponse.statusCode).toBe(201);

      // Update with full configuration
      const updateResponse = await app.inject({
        method: 'PUT',
        url: `/agents/${agentDef.name}`,
        payload: {
          description: 'Updated description',
          prompt: 'Updated prompt: You are an enhanced assistant.',
          tools: ['Read', 'Write', 'Edit'],
          model: 'haiku',
          skills: ['testing', 'validation']
        },
        headers: { 'content-type': 'application/json' }
      });
      expect(updateResponse.statusCode).toBe(200);

      const updatedAgent = JSON.parse(updateResponse.body);
      expect(updatedAgent.tools).toEqual(['Read', 'Write', 'Edit']);
      expect(updatedAgent.model).toBe('haiku');
      expect(updatedAgent.skills).toEqual(['testing', 'validation']);
    });
  });

  describe('CREATE - POST /agents', () => {
    it('should create agent with minimal required fields', async () => {
      const agentDef = fixtureUtils.withUniqueName(validAgentFixtures.minimal);

      const response = await app.inject({
        method: 'POST',
        url: '/agents',
        payload: agentDef,
        headers: { 'content-type': 'application/json' }
      });

      expect(response.statusCode).toBe(201);
      const createdAgent = JSON.parse(response.body);
      expect(createdAgent).toMatchObject(agentDef);
    });

    it('should create agent with all optional fields', async () => {
      const agentDef = fixtureUtils.withUniqueName(validAgentFixtures.withManyToolsSkills);

      const response = await app.inject({
        method: 'POST',
        url: '/agents',
        payload: agentDef,
        headers: { 'content-type': 'application/json' }
      });

      expect(response.statusCode).toBe(201);
      const createdAgent = JSON.parse(response.body);
      expect(createdAgent.tools).toEqual(agentDef.tools);
      expect(createdAgent.skills).toEqual(agentDef.skills);
    });

    it('should handle special characters in agent name', async () => {
      const agentDef = fixtureUtils.withUniqueName(validAgentFixtures.withSpecialChars, 'test-agent_v2-0');

      const response = await app.inject({
        method: 'POST',
        url: '/agents',
        payload: agentDef,
        headers: { 'content-type': 'application/json' }
      });

      expect(response.statusCode).toBe(201);
    });

    it('should handle unicode characters in description and prompt', async () => {
      const agentDef = fixtureUtils.withUniqueName(validAgentFixtures.withUnicode);

      const response = await app.inject({
        method: 'POST',
        url: '/agents',
        payload: agentDef,
        headers: { 'content-type': 'application/json' }
      });

      expect(response.statusCode).toBe(201);
      const createdAgent = JSON.parse(response.body);
      expect(createdAgent.description).toBe(agentDef.description);
      expect(createdAgent.prompt).toBe(agentDef.prompt);
    });

    it('should handle empty arrays for optional fields', async () => {
      const agentDef = fixtureUtils.withUniqueName(validAgentFixtures.withEmptyArrays);

      const response = await app.inject({
        method: 'POST',
        url: '/agents',
        payload: agentDef,
        headers: { 'content-type': 'application/json' }
      });

      expect(response.statusCode).toBe(201);
    });

    describe('Error Cases - CREATE', () => {
      it('should return 409 for duplicate agent names', async () => {
        const agentDef = fixtureUtils.withUniqueName(validAgentFixtures.minimal);

        // Create first agent
        await app.inject({
          method: 'POST',
          url: '/agents',
          payload: agentDef,
          headers: { 'content-type': 'application/json' }
        });

        // Attempt to create duplicate
        const duplicateResponse = await app.inject({
          method: 'POST',
          url: '/agents',
          payload: agentDef,
          headers: { 'content-type': 'application/json' }
        });

        expect(duplicateResponse.statusCode).toBe(409);
        const error = JSON.parse(duplicateResponse.body);
        expect(error.error).toContain('already exists');
      });

      it('should return 400 for missing name', async () => {
        const response = await app.inject({
          method: 'POST',
          url: '/agents',
          payload: invalidAgentFixtures.missingName,
          headers: { 'content-type': 'application/json' }
        });

        expect(response.statusCode).toBe(400);
        const error = JSON.parse(response.body);
        expect(error.error).toContain('name is required');
      });

      it('should return 400 for empty name', async () => {
        const response = await app.inject({
          method: 'POST',
          url: '/agents',
          payload: invalidAgentFixtures.emptyName,
          headers: { 'content-type': 'application/json' }
        });

        expect(response.statusCode).toBe(400);
        const error = JSON.parse(response.body);
        expect(error.error).toContain('name is required');
      });

      it('should return 400 for missing description', async () => {
        const response = await app.inject({
          method: 'POST',
          url: '/agents',
          payload: invalidAgentFixtures.missingDescription,
          headers: { 'content-type': 'application/json' }
        });

        expect(response.statusCode).toBe(400);
        const error = JSON.parse(response.body);
        expect(error.error).toContain('description is required');
      });

      it('should return 400 for empty description', async () => {
        const response = await app.inject({
          method: 'POST',
          url: '/agents',
          payload: invalidAgentFixtures.emptyDescription,
          headers: { 'content-type': 'application/json' }
        });

        expect(response.statusCode).toBe(400);
        const error = JSON.parse(response.body);
        expect(error.error).toContain('description is required');
      });

      it('should return 400 for missing prompt', async () => {
        const response = await app.inject({
          method: 'POST',
          url: '/agents',
          payload: invalidAgentFixtures.missingPrompt,
          headers: { 'content-type': 'application/json' }
        });

        expect(response.statusCode).toBe(400);
        const error = JSON.parse(response.body);
        expect(error.error).toContain('prompt is required');
      });

      it('should return 400 for empty prompt', async () => {
        const response = await app.inject({
          method: 'POST',
          url: '/agents',
          payload: invalidAgentFixtures.emptyPrompt,
          headers: { 'content-type': 'application/json' }
        });

        expect(response.statusCode).toBe(400);
        const error = JSON.parse(response.body);
        expect(error.error).toContain('prompt is required');
      });

      it('should return 400 for invalid model', async () => {
        const response = await app.inject({
          method: 'POST',
          url: '/agents',
          payload: invalidAgentFixtures.invalidModel,
          headers: { 'content-type': 'application/json' }
        });

        expect(response.statusCode).toBe(400);
      });

      it('should reject path traversal attempts in name', async () => {
        const response = await app.inject({
          method: 'POST',
          url: '/agents',
          payload: invalidAgentFixtures.pathTraversalName,
          headers: { 'content-type': 'application/json' }
        });

        expect(response.statusCode).toBe(400);
      });

      it('should reject URL encoded path traversal attempts', async () => {
        const response = await app.inject({
          method: 'POST',
          url: '/agents',
          payload: invalidAgentFixtures.urlEncodedPathTraversal,
          headers: { 'content-type': 'application/json' }
        });

        expect(response.statusCode).toBe(400);
      });

      it('should reject names with spaces', async () => {
        const response = await app.inject({
          method: 'POST',
          url: '/agents',
          payload: invalidAgentFixtures.nameWithSpaces,
          headers: { 'content-type': 'application/json' }
        });

        expect(response.statusCode).toBe(400);
      });

      it('should reject names with uppercase', async () => {
        const response = await app.inject({
          method: 'POST',
          url: '/agents',
          payload: invalidAgentFixtures.nameWithUppercase,
          headers: { 'content-type': 'application/json' }
        });

        expect(response.statusCode).toBe(400);
      });
    });
  });

  describe('READ - GET /agents/:name', () => {
    it('should retrieve existing agent', async () => {
      const agentDef = fixtureUtils.withUniqueName(validAgentFixtures.full);

      // Create agent first
      await app.inject({
        method: 'POST',
        url: '/agents',
        payload: agentDef,
        headers: { 'content-type': 'application/json' }
      });

      // Get agent
      const response = await app.inject({
        method: 'GET',
        url: `/agents/${agentDef.name}`
      });

      expect(response.statusCode).toBe(200);
      const retrievedAgent = JSON.parse(response.body);
      expect(retrievedAgent).toMatchObject(agentDef);
    });

    it('should return 404 for non-existent agent', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/agents/non-existent-agent'
      });

      expect(response.statusCode).toBe(404);
      const error = JSON.parse(response.body);
      expect(error.error).toContain('not found');
    });

    it('should return 400 for empty agent name', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/agents/'
      });

      // This should match a different route or return 404
      expect([400, 404]).toContain(response.statusCode);
    });
  });

  describe('UPDATE - PUT /agents/:name', () => {
    let existingAgent: AgentDefinition;

    beforeEach(async () => {
      // Create an agent for update tests
      existingAgent = fixtureUtils.withUniqueName(validAgentFixtures.full);
      await app.inject({
        method: 'POST',
        url: '/agents',
        payload: existingAgent,
        headers: { 'content-type': 'application/json' }
      });
    });

    it('should update agent description only', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: `/agents/${existingAgent.name}`,
        payload: updateFixtures.descriptionOnly,
        headers: { 'content-type': 'application/json' }
      });

      expect(response.statusCode).toBe(200);
      const updatedAgent = JSON.parse(response.body);
      expect(updatedAgent.description).toBe(updateFixtures.descriptionOnly.description);
      expect(updatedAgent.name).toBe(existingAgent.name); // Name unchanged
      expect(updatedAgent.prompt).toBe(existingAgent.prompt); // Other fields unchanged
    });

    it('should update agent prompt only', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: `/agents/${existingAgent.name}`,
        payload: updateFixtures.promptOnly,
        headers: { 'content-type': 'application/json' }
      });

      expect(response.statusCode).toBe(200);
      const updatedAgent = JSON.parse(response.body);
      expect(updatedAgent.prompt).toBe(updateFixtures.promptOnly.prompt);
    });

    it('should update agent tools', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: `/agents/${existingAgent.name}`,
        payload: updateFixtures.addTools,
        headers: { 'content-type': 'application/json' }
      });

      expect(response.statusCode).toBe(200);
      const updatedAgent = JSON.parse(response.body);
      expect(updatedAgent.tools).toEqual(updateFixtures.addTools.tools);
    });

    it('should update agent skills', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: `/agents/${existingAgent.name}`,
        payload: updateFixtures.addSkills,
        headers: { 'content-type': 'application/json' }
      });

      expect(response.statusCode).toBe(200);
      const updatedAgent = JSON.parse(response.body);
      expect(updatedAgent.skills).toEqual(updateFixtures.addSkills.skills);
    });

    it('should update agent model', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: `/agents/${existingAgent.name}`,
        payload: updateFixtures.changeModel,
        headers: { 'content-type': 'application/json' }
      });

      expect(response.statusCode).toBe(200);
      const updatedAgent = JSON.parse(response.body);
      expect(updatedAgent.model).toBe(updateFixtures.changeModel.model);
    });

    it('should prevent name changes', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: `/agents/${existingAgent.name}`,
        payload: updateFixtures.attemptNameChange,
        headers: { 'content-type': 'application/json' }
      });

      expect(response.statusCode).toBe(200);
      const updatedAgent = JSON.parse(response.body);
      expect(updatedAgent.name).toBe(existingAgent.name); // Name should remain unchanged
    });

    describe('Error Cases - UPDATE', () => {
      it('should return 404 for non-existent agent', async () => {
        const response = await app.inject({
          method: 'PUT',
          url: '/agents/non-existent-agent',
          payload: updateFixtures.descriptionOnly,
          headers: { 'content-type': 'application/json' }
        });

        expect(response.statusCode).toBe(404);
        const error = JSON.parse(response.body);
        expect(error.error).toContain('not found');
      });

      it('should return 400 for invalid update data', async () => {
        const response = await app.inject({
          method: 'PUT',
          url: `/agents/${existingAgent.name}`,
          payload: updateFixtures.invalidModel,
          headers: { 'content-type': 'application/json' }
        });

        expect(response.statusCode).toBe(400);
      });

      it('should return 400 for empty description', async () => {
        const response = await app.inject({
          method: 'PUT',
          url: `/agents/${existingAgent.name}`,
          payload: updateFixtures.emptyDescription,
          headers: { 'content-type': 'application/json' }
        });

        expect(response.statusCode).toBe(400);
      });
    });
  });

  describe('DELETE - DELETE /agents/:name', () => {
    let existingAgent: AgentDefinition;

    beforeEach(async () => {
      // Create an agent for delete tests
      existingAgent = fixtureUtils.withUniqueName(validAgentFixtures.minimal);
      await app.inject({
        method: 'POST',
        url: '/agents',
        payload: existingAgent,
        headers: { 'content-type': 'application/json' }
      });
    });

    it('should delete existing agent', async () => {
      const response = await app.inject({
        method: 'DELETE',
        url: `/agents/${existingAgent.name}`
      });

      expect(response.statusCode).toBe(204);
      expect(response.body).toBe('');

      // Verify agent is deleted
      const getResponse = await app.inject({
        method: 'GET',
        url: `/agents/${existingAgent.name}`
      });
      expect(getResponse.statusCode).toBe(404);
    });

    it('should return 404 for non-existent agent', async () => {
      const response = await app.inject({
        method: 'DELETE',
        url: '/agents/non-existent-agent'
      });

      expect(response.statusCode).toBe(404);
      const error = JSON.parse(response.body);
      expect(error.error).toContain('not found');
    });

    it('should return 400 for empty agent name', async () => {
      const response = await app.inject({
        method: 'DELETE',
        url: '/agents/'
      });

      // This should match a different route or return 404/400
      expect([400, 404]).toContain(response.statusCode);
    });
  });

  describe('LIST - GET /agents', () => {
    it('should return empty list when no agents exist', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/agents'
      });

      expect(response.statusCode).toBe(200);
      const { agents } = JSON.parse(response.body);
      expect(agents).toEqual({});
    });

    it('should list all created agents', async () => {
      // Create multiple agents
      const agent1 = fixtureUtils.withUniqueName(validAgentFixtures.minimal, 'agent1');
      const agent2 = fixtureUtils.withUniqueName(validAgentFixtures.full, 'agent2');

      await app.inject({
        method: 'POST',
        url: '/agents',
        payload: agent1,
        headers: { 'content-type': 'application/json' }
      });

      await app.inject({
        method: 'POST',
        url: '/agents',
        payload: agent2,
        headers: { 'content-type': 'application/json' }
      });

      // List agents
      const response = await app.inject({
        method: 'GET',
        url: '/agents'
      });

      expect(response.statusCode).toBe(200);
      const { agents } = JSON.parse(response.body);
      expect(Object.keys(agents)).toHaveLength(2);
      expect(agents).toHaveProperty(agent1.name);
      expect(agents).toHaveProperty(agent2.name);
      expect(agents[agent1.name]).toMatchObject(agent1);
      expect(agents[agent2.name]).toMatchObject(agent2);
    });
  });

  describe('Edge Cases and Boundary Tests', () => {
    it('should handle concurrent agent creation', async () => {
      const agents = Array.from({ length: 5 }, (_, i) =>
        fixtureUtils.withUniqueName(validAgentFixtures.minimal, `concurrent-${i}`)
      );

      // Create all agents concurrently
      const promises = agents.map(agent =>
        app.inject({
          method: 'POST',
          url: '/agents',
          payload: agent,
          headers: { 'content-type': 'application/json' }
        })
      );

      const responses = await Promise.all(promises);

      // All should succeed
      responses.forEach(response => {
        expect(response.statusCode).toBe(201);
      });

      // Verify all agents exist
      const listResponse = await app.inject({
        method: 'GET',
        url: '/agents'
      });

      const { agents: allAgents } = JSON.parse(listResponse.body);
      agents.forEach(agent => {
        expect(allAgents).toHaveProperty(agent.name);
      });
    });

    it('should handle very long text within limits', async () => {
      const agent = fixtureUtils.withUniqueName(validAgentFixtures.withLongText);

      const response = await app.inject({
        method: 'POST',
        url: '/agents',
        payload: agent,
        headers: { 'content-type': 'application/json' }
      });

      expect(response.statusCode).toBe(201);
    });

    it('should handle agent with many tools and skills', async () => {
      const agent = fixtureUtils.withUniqueName(validAgentFixtures.withManyToolsSkills);

      const response = await app.inject({
        method: 'POST',
        url: '/agents',
        payload: agent,
        headers: { 'content-type': 'application/json' }
      });

      expect(response.statusCode).toBe(201);

      const createdAgent = JSON.parse(response.body);
      expect(createdAgent.tools).toHaveLength(agent.tools!.length);
      expect(createdAgent.skills).toHaveLength(agent.skills!.length);
    });

    it('should maintain data integrity after multiple operations', async () => {
      const agent = fixtureUtils.withUniqueName(validAgentFixtures.minimal);

      // Create
      await app.inject({
        method: 'POST',
        url: '/agents',
        payload: agent,
        headers: { 'content-type': 'application/json' }
      });

      // Multiple updates
      await app.inject({
        method: 'PUT',
        url: `/agents/${agent.name}`,
        payload: { description: 'First update' },
        headers: { 'content-type': 'application/json' }
      });

      await app.inject({
        method: 'PUT',
        url: `/agents/${agent.name}`,
        payload: { prompt: 'Updated prompt' },
        headers: { 'content-type': 'application/json' }
      });

      // Final read
      const finalResponse = await app.inject({
        method: 'GET',
        url: `/agents/${agent.name}`
      });

      expect(finalResponse.statusCode).toBe(200);
      const finalAgent = JSON.parse(finalResponse.body);
      expect(finalAgent.name).toBe(agent.name);
      expect(finalAgent.description).toBe('First update');
      expect(finalAgent.prompt).toBe('Updated prompt');
    });
  });
});