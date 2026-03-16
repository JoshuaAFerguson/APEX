import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ApexApiClient, ApiError } from '../api-client';
import type { AgentDefinition } from '@apexcli/core';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('ApexApiClient - Agent API Integration Tests', () => {
  let client: ApexApiClient;
  const baseUrl = 'http://test-api.com';

  beforeEach(() => {
    client = new ApexApiClient(baseUrl);
    mockFetch.mockClear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Complete agent lifecycle', () => {
    const testAgent: AgentDefinition = {
      name: 'test-lifecycle-agent',
      description: 'Agent for lifecycle testing',
      prompt: 'You are a test agent for lifecycle testing',
      model: 'sonnet',
    };

    it('should handle complete CRUD operations for an agent', async () => {
      // Step 1: Create agent
      const createdAgent = { ...testAgent, id: 'agent_123' };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => createdAgent,
      });

      const createResult = await client.createAgent(testAgent);
      expect(createResult).toEqual(createdAgent);
      expect(mockFetch).toHaveBeenNthCalledWith(
        1,
        `${baseUrl}/agents`,
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify(testAgent),
        })
      );

      // Step 2: Read agent
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => createdAgent,
      });

      const readResult = await client.getAgent(testAgent.name);
      expect(readResult).toEqual(createdAgent);
      expect(mockFetch).toHaveBeenNthCalledWith(
        2,
        `${baseUrl}/agents/${testAgent.name}`,
        expect.any(Object)
      );

      // Step 3: Update agent
      const updatedAgent = {
        ...testAgent,
        description: 'Updated agent description',
        prompt: 'You are an updated test agent',
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => updatedAgent,
      });

      const updateResult = await client.updateAgent(testAgent.name, updatedAgent);
      expect(updateResult).toEqual(updatedAgent);
      expect(mockFetch).toHaveBeenNthCalledWith(
        3,
        `${baseUrl}/agents/${testAgent.name}`,
        expect.objectContaining({
          method: 'PUT',
          body: JSON.stringify(updatedAgent),
        })
      );

      // Step 4: Verify agent in list
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => [updatedAgent],
      });

      const listResult = await client.listAgents();
      expect(listResult).toContain(updatedAgent);
      expect(mockFetch).toHaveBeenNthCalledWith(
        4,
        `${baseUrl}/agents`,
        expect.any(Object)
      );

      // Step 5: Delete agent
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ok: true, message: 'Agent deleted successfully' }),
      });

      const deleteResult = await client.deleteAgent(testAgent.name);
      expect(deleteResult).toEqual({ ok: true, message: 'Agent deleted successfully' });
      expect(mockFetch).toHaveBeenNthCalledWith(
        5,
        `${baseUrl}/agents/${testAgent.name}`,
        expect.objectContaining({
          method: 'DELETE',
        })
      );

      // Verify all API calls were made
      expect(mockFetch).toHaveBeenCalledTimes(5);
    });

    it('should handle partial update workflows', async () => {
      // Initial agent
      const initialAgent: AgentDefinition = {
        name: 'partial-update-agent',
        description: 'Initial description',
        prompt: 'Initial prompt',
        model: 'haiku',
      };

      // Create agent
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => initialAgent,
      });
      await client.createAgent(initialAgent);

      // Update only description
      const updatedAgent1 = { ...initialAgent, description: 'Updated description' };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => updatedAgent1,
      });

      const result1 = await client.updateAgent(initialAgent.name, updatedAgent1);
      expect(result1.description).toBe('Updated description');
      expect(result1.prompt).toBe('Initial prompt'); // Unchanged
      expect(result1.model).toBe('haiku'); // Unchanged

      // Update model and prompt
      const updatedAgent2 = {
        ...updatedAgent1,
        prompt: 'New prompt',
        model: 'opus' as const,
      };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => updatedAgent2,
      });

      const result2 = await client.updateAgent(initialAgent.name, updatedAgent2);
      expect(result2.description).toBe('Updated description'); // Previous update preserved
      expect(result2.prompt).toBe('New prompt');
      expect(result2.model).toBe('opus');
    });
  });

  describe('Error recovery scenarios', () => {
    it('should handle network failures during agent operations', async () => {
      const agent: AgentDefinition = {
        name: 'network-test-agent',
        description: 'Testing network failures',
        prompt: 'Network testing prompt',
        model: 'sonnet',
      };

      // Simulate network failure during creation
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      await expect(client.createAgent(agent)).rejects.toThrow('Network error');

      // Recovery: successful creation after retry
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => agent,
      });

      const retryResult = await client.createAgent(agent);
      expect(retryResult).toEqual(agent);
    });

    it('should handle validation errors and recovery', async () => {
      const invalidAgent = {
        name: 'invalid-agent',
        description: '',
        prompt: '',
        model: 'invalid-model' as any,
      };

      // First attempt fails validation
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 422,
        statusText: 'Unprocessable Entity',
        json: async () => ({
          error: 'Invalid model: "invalid-model"',
        }),
      });

      await expect(client.createAgent(invalidAgent)).rejects.toThrow(
        'Invalid model: "invalid-model"'
      );

      // Corrected agent succeeds
      const correctedAgent = { ...invalidAgent, model: 'sonnet' as const };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => correctedAgent,
      });

      const correctedResult = await client.createAgent(correctedAgent);
      expect(correctedResult).toEqual(correctedAgent);
    });

    it('should handle concurrent operations', async () => {
      const agents = [
        { name: 'agent-1', description: 'Agent 1', prompt: 'Prompt 1', model: 'sonnet' as const },
        { name: 'agent-2', description: 'Agent 2', prompt: 'Prompt 2', model: 'haiku' as const },
        { name: 'agent-3', description: 'Agent 3', prompt: 'Prompt 3', model: 'opus' as const },
      ];

      // Mock successful responses for all agents
      agents.forEach((agent) => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => agent,
        });
      });

      // Create all agents concurrently
      const promises = agents.map((agent) => client.createAgent(agent));
      const results = await Promise.all(promises);

      expect(results).toHaveLength(3);
      expect(results[0]).toEqual(agents[0]);
      expect(results[1]).toEqual(agents[1]);
      expect(results[2]).toEqual(agents[2]);
      expect(mockFetch).toHaveBeenCalledTimes(3);
    });

    it('should handle mixed success/failure in concurrent operations', async () => {
      const agents = [
        { name: 'success-agent', description: 'Success', prompt: 'Success', model: 'sonnet' as const },
        { name: 'failure-agent', description: 'Failure', prompt: 'Failure', model: 'haiku' as const },
        { name: 'another-success', description: 'Success 2', prompt: 'Success 2', model: 'opus' as const },
      ];

      // First succeeds
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => agents[0],
      });

      // Second fails
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 409,
        statusText: 'Conflict',
        json: async () => ({
          message: 'Agent already exists',
        }),
      });

      // Third succeeds
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => agents[2],
      });

      const promises = agents.map((agent) => client.createAgent(agent));
      const results = await Promise.allSettled(promises);

      expect(results[0].status).toBe('fulfilled');
      expect(results[1].status).toBe('rejected');
      expect(results[2].status).toBe('fulfilled');

      if (results[0].status === 'fulfilled') {
        expect(results[0].value).toEqual(agents[0]);
      }
      if (results[2].status === 'fulfilled') {
        expect(results[2].value).toEqual(agents[2]);
      }
    });
  });

  describe('Data consistency and validation', () => {
    it('should maintain data consistency across operations', async () => {
      const agent: AgentDefinition = {
        name: 'consistency-agent',
        description: 'Testing consistency',
        prompt: 'Consistency prompt',
        model: 'sonnet',
      };

      // Create
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ...agent, id: 'agent_456', createdAt: '2024-01-01T00:00:00Z' }),
      });

      const created = await client.createAgent(agent);

      // Get should return the same data
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => created,
      });

      const retrieved = await client.getAgent(agent.name);
      expect(retrieved).toEqual(created);

      // List should include the agent
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => [created],
      });

      const listed = await client.listAgents();
      expect(listed).toContain(created);
    });

    it('should handle special characters in agent data', async () => {
      const specialAgent: AgentDefinition = {
        name: 'special-chars-agent',
        description: 'Agent with special chars: <>&"\'`',
        prompt: 'You are an agent with émojis 🤖 and symbols: @#$%^&*()',
        model: 'opus',
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => specialAgent,
      });

      const result = await client.createAgent(specialAgent);

      expect(result.description).toContain('<>&"\'`');
      expect(result.prompt).toContain('émojis 🤖');
      expect(result.prompt).toContain('@#$%^&*()');

      // Verify the JSON serialization worked correctly
      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: JSON.stringify(specialAgent),
        })
      );
    });

    it('should validate agent model types', async () => {
      const validModels = ['opus', 'sonnet', 'haiku'] as const;

      for (const model of validModels) {
        const agent: AgentDefinition = {
          name: `${model}-agent`,
          description: `Agent using ${model}`,
          prompt: `You use ${model} model`,
          model,
        };

        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => agent,
        });

        const result = await client.createAgent(agent);
        expect(result.model).toBe(model);
      }
    });
  });
});