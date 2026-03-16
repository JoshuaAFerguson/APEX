import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ApexApiClient, ApiError } from '../api-client';
import type { AgentDefinition } from '@apexcli/core';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('ApexApiClient - Agent API Comprehensive Tests', () => {
  let client: ApexApiClient;
  const baseUrl = 'http://test-api.com';

  beforeEach(() => {
    client = new ApexApiClient(baseUrl);
    mockFetch.mockClear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('createAgent edge cases', () => {
    const validAgent: AgentDefinition = {
      name: 'test-agent',
      description: 'A test agent',
      prompt: 'You are a test agent',
      model: 'sonnet',
    };

    it('should handle agent with minimal fields', async () => {
      const minimalAgent: AgentDefinition = {
        name: 'minimal',
        description: '',
        prompt: '',
        model: 'haiku',
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => minimalAgent,
      });

      const result = await client.createAgent(minimalAgent);

      expect(mockFetch).toHaveBeenCalledWith(
        `${baseUrl}/agents`,
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify(minimalAgent),
        })
      );
      expect(result).toEqual(minimalAgent);
    });

    it('should handle agent with special characters in name', async () => {
      const specialAgent: AgentDefinition = {
        name: 'test-agent_123',
        description: 'Agent with special chars: <>&"',
        prompt: 'You are an agent with émojis 🤖',
        model: 'opus',
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => specialAgent,
      });

      await client.createAgent(specialAgent);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: JSON.stringify(specialAgent),
        })
      );
    });

    it('should handle 409 conflict error for duplicate agent name', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 409,
        statusText: 'Conflict',
        json: async () => ({
          message: 'Agent with name "test-agent" already exists',
        }),
      });

      await expect(client.createAgent(validAgent)).rejects.toThrow(
        'Agent with name "test-agent" already exists'
      );
    });

    it('should handle 422 validation error for invalid agent data', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 422,
        statusText: 'Unprocessable Entity',
        json: async () => ({
          error: 'Invalid model: "invalid-model"',
        }),
      });

      const invalidAgent = { ...validAgent, model: 'invalid-model' as any };

      await expect(client.createAgent(invalidAgent)).rejects.toThrow(
        'Invalid model: "invalid-model"'
      );
    });

    it('should handle large prompt text', async () => {
      const largePrompt = 'A'.repeat(50000); // Large prompt
      const largeAgent: AgentDefinition = {
        ...validAgent,
        prompt: largePrompt,
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => largeAgent,
      });

      const result = await client.createAgent(largeAgent);
      expect(result.prompt).toBe(largePrompt);
    });
  });

  describe('updateAgent edge cases', () => {
    const validAgent: AgentDefinition = {
      name: 'existing-agent',
      description: 'Updated agent',
      prompt: 'Updated prompt',
      model: 'sonnet',
    };

    it('should handle updating agent with same data', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => validAgent,
      });

      const result = await client.updateAgent('existing-agent', validAgent);

      expect(mockFetch).toHaveBeenCalledWith(
        `${baseUrl}/agents/existing-agent`,
        expect.objectContaining({
          method: 'PUT',
          body: JSON.stringify(validAgent),
        })
      );
      expect(result).toEqual(validAgent);
    });

    it('should handle agent names with special characters in URL path', async () => {
      const agentName = 'agent-with_special-chars.123';

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => validAgent,
      });

      await client.updateAgent(agentName, validAgent);

      expect(mockFetch).toHaveBeenCalledWith(
        `${baseUrl}/agents/${agentName}`,
        expect.any(Object)
      );
    });

    it('should handle 404 error for non-existent agent', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        json: async () => ({
          message: 'Agent "non-existent" not found',
        }),
      });

      await expect(
        client.updateAgent('non-existent', validAgent)
      ).rejects.toThrow('Agent "non-existent" not found');
    });

    it('should handle 403 forbidden error for protected agent', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 403,
        statusText: 'Forbidden',
        json: async () => ({
          error: 'Cannot modify system agent',
        }),
      });

      await expect(
        client.updateAgent('system-agent', validAgent)
      ).rejects.toThrow('Cannot modify system agent');
    });

    it('should handle concurrent updates gracefully', async () => {
      const agents = [
        { ...validAgent, name: 'agent1' },
        { ...validAgent, name: 'agent2' },
        { ...validAgent, name: 'agent3' },
      ];

      // Mock responses for each update
      agents.forEach((agent) => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => agent,
        });
      });

      const promises = agents.map((agent) =>
        client.updateAgent(agent.name, agent)
      );

      const results = await Promise.all(promises);

      expect(results).toHaveLength(3);
      expect(mockFetch).toHaveBeenCalledTimes(3);
    });
  });

  describe('deleteAgent edge cases', () => {
    it('should handle successful deletion with different response format', async () => {
      const mockResponse = {
        success: true,
        message: 'Agent deleted successfully',
        deletedAgent: 'test-agent',
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await client.deleteAgent('test-agent');

      expect(mockFetch).toHaveBeenCalledWith(
        `${baseUrl}/agents/test-agent`,
        expect.objectContaining({
          method: 'DELETE',
        })
      );
      expect(result).toEqual(mockResponse);
    });

    it('should handle agent names requiring URL encoding', async () => {
      const encodedAgentName = 'agent with spaces';

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ok: true, message: 'Agent deleted' }),
      });

      await client.deleteAgent(encodedAgentName);

      expect(mockFetch).toHaveBeenCalledWith(
        `${baseUrl}/agents/${encodedAgentName}`,
        expect.any(Object)
      );
    });

    it('should handle 404 error for already deleted agent', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        json: async () => ({
          message: 'Agent "deleted-agent" not found',
        }),
      });

      await expect(client.deleteAgent('deleted-agent')).rejects.toThrow(
        'Agent "deleted-agent" not found'
      );
    });

    it('should handle 409 conflict error for agent in use', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 409,
        statusText: 'Conflict',
        json: async () => ({
          error: 'Cannot delete agent "busy-agent": agent is currently in use',
        }),
      });

      await expect(client.deleteAgent('busy-agent')).rejects.toThrow(
        'Cannot delete agent "busy-agent": agent is currently in use'
      );
    });

    it('should handle 403 forbidden error for protected system agent', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 403,
        statusText: 'Forbidden',
        json: async () => ({
          message: 'Cannot delete system agent',
        }),
      });

      await expect(client.deleteAgent('system-agent')).rejects.toThrow(
        'Cannot delete system agent'
      );
    });

    it('should handle multiple deletion attempts', async () => {
      const agentNames = ['agent1', 'agent2', 'agent3'];

      // Mock successful deletion for each agent
      agentNames.forEach((name) => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => ({ ok: true, message: `Agent ${name} deleted` }),
        });
      });

      const promises = agentNames.map((name) => client.deleteAgent(name));
      const results = await Promise.all(promises);

      expect(results).toHaveLength(3);
      expect(mockFetch).toHaveBeenCalledTimes(3);

      agentNames.forEach((name, index) => {
        expect(results[index]).toEqual({
          ok: true,
          message: `Agent ${name} deleted`,
        });
      });
    });
  });

  describe('listAgents edge cases', () => {
    it('should handle empty agent list', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => [],
      });

      const result = await client.listAgents();

      expect(result).toEqual([]);
    });

    it('should handle large number of agents', async () => {
      const manyAgents = Array.from({ length: 1000 }, (_, i) => ({
        name: `agent-${i}`,
        description: `Agent ${i}`,
        prompt: `You are agent ${i}`,
        model: 'sonnet' as const,
      }));

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => manyAgents,
      });

      const result = await client.listAgents();

      expect(result).toHaveLength(1000);
      expect(result[0].name).toBe('agent-0');
      expect(result[999].name).toBe('agent-999');
    });

    it('should handle malformed agent data in response', async () => {
      const malformedAgents = [
        { name: 'valid-agent', description: 'Valid', prompt: 'Valid', model: 'sonnet' },
        { name: 'malformed-agent' }, // Missing required fields
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => malformedAgents,
      });

      const result = await client.listAgents();

      expect(result).toEqual(malformedAgents); // Client should return as-is
    });
  });

  describe('getAgent edge cases', () => {
    it('should handle agent with all optional fields populated', async () => {
      const fullAgent = {
        name: 'full-agent',
        description: 'A complete agent definition',
        prompt: 'You are a comprehensive agent',
        model: 'opus' as const,
        version: '1.0.0',
        tags: ['test', 'development'],
        metadata: {
          createdBy: 'user123',
          createdAt: '2024-01-01T00:00:00Z',
          lastModified: '2024-01-02T00:00:00Z',
        },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => fullAgent,
      });

      const result = await client.getAgent('full-agent');

      expect(result).toEqual(fullAgent);
    });

    it('should handle very long agent names', async () => {
      const longName = 'a'.repeat(255); // Very long but valid name
      const agent = {
        name: longName,
        description: 'Agent with long name',
        prompt: 'You have a very long name',
        model: 'haiku' as const,
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => agent,
      });

      const result = await client.getAgent(longName);

      expect(mockFetch).toHaveBeenCalledWith(
        `${baseUrl}/agents/${longName}`,
        expect.any(Object)
      );
      expect(result.name).toBe(longName);
    });

    it('should handle 404 for non-existent agent', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        json: async () => ({
          message: 'Agent "missing-agent" not found',
        }),
      });

      await expect(client.getAgent('missing-agent')).rejects.toThrow(
        'Agent "missing-agent" not found'
      );
    });
  });

  describe('Network and error resilience', () => {
    it('should handle timeout errors during agent operations', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Request timeout'));

      await expect(client.listAgents()).rejects.toThrow('Request timeout');
    });

    it('should handle connection errors', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      await expect(client.getAgent('test')).rejects.toThrow('Network error');
    });

    it('should handle malformed JSON responses', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => {
          throw new Error('Invalid JSON');
        },
      });

      await expect(client.listAgents()).rejects.toThrow('Invalid JSON');
    });

    it('should handle server errors with custom messages', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        json: async () => ({
          error: 'Database connection failed',
          details: 'Could not connect to agent database',
        }),
      });

      await expect(client.getAgent('test')).rejects.toThrow(
        'Database connection failed'
      );
    });
  });

  describe('Type safety and validation', () => {
    it('should properly type check agent models', async () => {
      const validModels = ['opus', 'sonnet', 'haiku'] as const;

      for (const model of validModels) {
        const agent: AgentDefinition = {
          name: `${model}-agent`,
          description: `Agent using ${model} model`,
          prompt: `You use the ${model} model`,
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

    it('should handle agents with undefined optional fields', async () => {
      const agentWithUndefinedFields = {
        name: 'minimal-agent',
        description: 'Minimal agent',
        prompt: 'You are minimal',
        model: 'sonnet' as const,
        version: undefined,
        tags: undefined,
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => agentWithUndefinedFields,
      });

      const result = await client.createAgent(agentWithUndefinedFields);
      expect(result.version).toBeUndefined();
      expect(result.tags).toBeUndefined();
    });
  });
});