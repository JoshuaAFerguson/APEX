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
  });

  describe('updateAgent edge cases', () => {
    const validAgent: AgentDefinition = {
      name: 'existing-agent',
      description: 'Updated agent',
      prompt: 'Updated prompt',
      model: 'sonnet',
    };

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
  });

  describe('deleteAgent edge cases', () => {
    it('should handle successful deletion', async () => {
      const mockResponse = {
        ok: true,
        message: 'Agent deleted successfully',
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
  });
});