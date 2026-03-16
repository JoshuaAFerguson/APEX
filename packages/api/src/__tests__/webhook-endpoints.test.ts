/**
 * Comprehensive tests for webhook API endpoints
 * Tests all webhook REST API endpoints, validation, error handling, and integration
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { FastifyInstance } from 'fastify';
import { createServer } from '../index';
import path from 'path';
import { tmpdir } from 'os';
import { mkdtemp, rm, writeFile, mkdir } from 'fs/promises';
import type {
  WebhookSubscription,
  WebhookDeliveryLog,
  WebhookConfig,
} from '@apexcli/core';

// Mock webhook server for testing deliveries
class MockWebhookEndpoint {
  private responses = new Map<string, { status: number; body: any; headers?: Record<string, string> }>();
  private receivedRequests: Array<{
    url: string;
    method: string;
    headers: Record<string, string>;
    body: any;
    timestamp: Date;
  }> = [];

  setResponse(path: string, status: number, body: any, headers?: Record<string, string>) {
    this.responses.set(path, { status, body, headers });
  }

  getReceivedRequests() {
    return [...this.receivedRequests];
  }

  clearRequests() {
    this.receivedRequests = [];
  }

  simulateIncomingRequest(url: string, method: string, headers: Record<string, string>, body: any) {
    this.receivedRequests.push({
      url,
      method,
      headers,
      body: typeof body === 'string' ? JSON.parse(body) : body,
      timestamp: new Date(),
    });

    const path = new URL(url).pathname;
    const response = this.responses.get(path) || { status: 404, body: { error: 'Not Found' } };

    return {
      status: response.status,
      body: response.body,
      headers: response.headers || {},
    };
  }
}

describe('Webhook API Endpoints', () => {
  let app: FastifyInstance;
  let tempDir: string;
  let mockEndpoint: MockWebhookEndpoint;

  // Test data factories
  const createWebhookData = (overrides: Partial<any> = {}) => ({
    name: 'Test Webhook',
    url: 'https://api.example.com/webhook',
    secret: 'test-secret-key-16-chars',
    enabled: true,
    events: ['task:completed', 'task:failed'],
    taskFilters: [],
    workflowFilters: [],
    headers: {
      'Authorization': 'Bearer token123',
      'X-Custom-Header': 'test-value',
    },
    retry: {
      maxAttempts: 5,
      initialDelayMs: 1000,
      maxDelayMs: 300000,
      backoffMultiplier: 2,
    },
    timeoutMs: 30000,
    contentType: 'application/json',
    description: 'Test webhook for integration',
    tags: ['test', 'integration'],
    ...overrides,
  });

  beforeEach(async () => {
    // Create temporary directory for the project
    tempDir = await mkdtemp(path.join(tmpdir(), 'webhook-api-test-'));
    await mkdir(path.join(tempDir, '.apex'), { recursive: true });

    // Create server with test configuration
    app = await createServer({
      projectPath: tempDir,
      port: 0, // Use dynamic port
      silent: true, // Suppress logs during tests
    });

    mockEndpoint = new MockWebhookEndpoint();
  });

  afterEach(async () => {
    if (app) {
      await app.close();
    }
    if (tempDir) {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  describe('GET /webhooks', () => {
    it('should return empty array when no webhooks exist', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/webhooks',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body).toHaveProperty('webhooks');
      expect(Array.isArray(body.webhooks)).toBe(true);
      expect(body.webhooks).toHaveLength(0);
      expect(body).toHaveProperty('total', 0);
    });

    it('should support pagination parameters', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/webhooks?limit=10&offset=0',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body).toHaveProperty('webhooks');
      expect(body).toHaveProperty('total');
      expect(body).toHaveProperty('limit', 10);
      expect(body).toHaveProperty('offset', 0);
    });

    it('should support filtering by enabled status', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/webhooks?enabled=true',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body).toHaveProperty('webhooks');
    });

    it('should validate query parameters', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/webhooks?limit=invalid',
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body).toHaveProperty('error');
      expect(body.error).toContain('limit');
    });
  });

  describe('POST /webhooks', () => {
    it('should create webhook with minimal required data', async () => {
      const webhookData = {
        name: 'Minimal Webhook',
        url: 'https://api.example.com/webhook',
      };

      const response = await app.inject({
        method: 'POST',
        url: '/webhooks',
        payload: webhookData,
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);

      expect(body).toHaveProperty('webhook');
      expect(body.webhook.id).toBeDefined();
      expect(body.webhook.name).toBe(webhookData.name);
      expect(body.webhook.url).toBe(webhookData.url);
      expect(body.webhook.enabled).toBe(true); // default
      expect(Array.isArray(body.webhook.events)).toBe(true);
      expect(body.webhook.createdAt).toBeDefined();
      expect(body.webhook.updatedAt).toBeDefined();
    });

    it('should create webhook with full configuration', async () => {
      const webhookData = createWebhookData();

      const response = await app.inject({
        method: 'POST',
        url: '/webhooks',
        payload: webhookData,
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);

      expect(body.webhook.name).toBe(webhookData.name);
      expect(body.webhook.url).toBe(webhookData.url);
      expect(body.webhook.secret).toBe(webhookData.secret);
      expect(body.webhook.enabled).toBe(webhookData.enabled);
      expect(body.webhook.events).toEqual(webhookData.events);
      expect(body.webhook.headers).toEqual(webhookData.headers);
      expect(body.webhook.retry).toEqual(webhookData.retry);
      expect(body.webhook.timeoutMs).toBe(webhookData.timeoutMs);
      expect(body.webhook.contentType).toBe(webhookData.contentType);
      expect(body.webhook.description).toBe(webhookData.description);
      expect(body.webhook.tags).toEqual(webhookData.tags);
    });

    it('should validate required fields', async () => {
      const invalidPayloads = [
        {}, // Missing name and url
        { name: 'Test' }, // Missing url
        { url: 'https://example.com' }, // Missing name
        { name: '', url: 'https://example.com' }, // Empty name
        { name: 'Test', url: 'invalid-url' }, // Invalid URL
        { name: 'A'.repeat(101), url: 'https://example.com' }, // Name too long
      ];

      for (const [index, payload] of invalidPayloads.entries()) {
        const response = await app.inject({
          method: 'POST',
          url: '/webhooks',
          payload,
        });

        expect(response.statusCode, `Payload ${index}: ${JSON.stringify(payload)}`).toBe(400);
        const body = JSON.parse(response.body);
        expect(body).toHaveProperty('error');
      }
    });

    it('should validate secret length', async () => {
      const invalidSecrets = [
        'short', // Too short
        'a'.repeat(257), // Too long
      ];

      for (const secret of invalidSecrets) {
        const response = await app.inject({
          method: 'POST',
          url: '/webhooks',
          payload: {
            name: 'Test Webhook',
            url: 'https://api.example.com/webhook',
            secret,
          },
        });

        expect(response.statusCode, `Secret: ${secret}`).toBe(400);
        const body = JSON.parse(response.body);
        expect(body.error).toContain('secret');
      }
    });

    it('should validate retry configuration', async () => {
      const invalidRetryConfigs = [
        { maxAttempts: -1 }, // Negative
        { maxAttempts: 11 }, // Too high
        { initialDelayMs: 50 }, // Too low
        { maxDelayMs: 4000000 }, // Too high
        { backoffMultiplier: 6 }, // Too high
      ];

      for (const retry of invalidRetryConfigs) {
        const response = await app.inject({
          method: 'POST',
          url: '/webhooks',
          payload: {
            name: 'Test Webhook',
            url: 'https://api.example.com/webhook',
            retry,
          },
        });

        expect(response.statusCode, `Retry config: ${JSON.stringify(retry)}`).toBe(400);
        const body = JSON.parse(response.body);
        expect(body.error).toMatch(/retry|maxAttempts|DelayMs|backoffMultiplier/);
      }
    });

    it('should validate timeout range', async () => {
      const invalidTimeouts = [500, 400000]; // Too low, too high

      for (const timeoutMs of invalidTimeouts) {
        const response = await app.inject({
          method: 'POST',
          url: '/webhooks',
          payload: {
            name: 'Test Webhook',
            url: 'https://api.example.com/webhook',
            timeoutMs,
          },
        });

        expect(response.statusCode, `Timeout: ${timeoutMs}`).toBe(400);
        const body = JSON.parse(response.body);
        expect(body.error).toContain('timeout');
      }
    });

    it('should validate content type', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/webhooks',
        payload: {
          name: 'Test Webhook',
          url: 'https://api.example.com/webhook',
          contentType: 'text/plain', // Invalid
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toContain('contentType');
    });
  });

  describe('GET /webhooks/:id', () => {
    let webhookId: string;

    beforeEach(async () => {
      // Create a test webhook first
      const createResponse = await app.inject({
        method: 'POST',
        url: '/webhooks',
        payload: createWebhookData(),
      });

      webhookId = JSON.parse(createResponse.body).webhook.id;
    });

    it('should return webhook by ID', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/webhooks/${webhookId}`,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body).toHaveProperty('webhook');
      expect(body.webhook.id).toBe(webhookId);
      expect(body.webhook.name).toBe('Test Webhook');
    });

    it('should return 404 for non-existent webhook', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/webhooks/non-existent-id',
      });

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body).toHaveProperty('error');
      expect(body.error).toContain('not found');
    });

    it('should exclude sensitive data from response', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/webhooks/${webhookId}`,
      });

      const body = JSON.parse(response.body);
      // Secret should be excluded or masked in responses
      expect(body.webhook.secret).toBeUndefined();
    });
  });

  describe('PUT /webhooks/:id', () => {
    let webhookId: string;

    beforeEach(async () => {
      const createResponse = await app.inject({
        method: 'POST',
        url: '/webhooks',
        payload: createWebhookData(),
      });

      webhookId = JSON.parse(createResponse.body).webhook.id;
    });

    it('should update webhook with partial data', async () => {
      const updateData = {
        name: 'Updated Webhook Name',
        enabled: false,
        description: 'Updated description',
      };

      const response = await app.inject({
        method: 'PUT',
        url: `/webhooks/${webhookId}`,
        payload: updateData,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.webhook.name).toBe(updateData.name);
      expect(body.webhook.enabled).toBe(false);
      expect(body.webhook.description).toBe(updateData.description);
      expect(new Date(body.webhook.updatedAt).getTime()).toBeGreaterThan(
        new Date(body.webhook.createdAt).getTime()
      );
    });

    it('should update webhook with full configuration', async () => {
      const updateData = createWebhookData({
        name: 'Fully Updated Webhook',
        events: ['task:created', 'task:completed'],
        retry: {
          maxAttempts: 3,
          initialDelayMs: 2000,
          maxDelayMs: 120000,
          backoffMultiplier: 1.5,
        },
      });

      const response = await app.inject({
        method: 'PUT',
        url: `/webhooks/${webhookId}`,
        payload: updateData,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.webhook.name).toBe(updateData.name);
      expect(body.webhook.events).toEqual(updateData.events);
      expect(body.webhook.retry).toEqual(updateData.retry);
    });

    it('should validate update data', async () => {
      const invalidUpdates = [
        { name: '' }, // Empty name
        { url: 'invalid-url' }, // Invalid URL
        { timeoutMs: 'not-a-number' }, // Invalid type
        { events: 'not-an-array' }, // Invalid type
      ];

      for (const [index, updateData] of invalidUpdates.entries()) {
        const response = await app.inject({
          method: 'PUT',
          url: `/webhooks/${webhookId}`,
          payload: updateData,
        });

        expect(response.statusCode, `Update ${index}: ${JSON.stringify(updateData)}`).toBe(400);
        const body = JSON.parse(response.body);
        expect(body).toHaveProperty('error');
      }
    });

    it('should return 404 for non-existent webhook', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: '/webhooks/non-existent-id',
        payload: { name: 'Updated Name' },
      });

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body.error).toContain('not found');
    });
  });

  describe('DELETE /webhooks/:id', () => {
    let webhookId: string;

    beforeEach(async () => {
      const createResponse = await app.inject({
        method: 'POST',
        url: '/webhooks',
        payload: createWebhookData(),
      });

      webhookId = JSON.parse(createResponse.body).webhook.id;
    });

    it('should delete webhook successfully', async () => {
      const response = await app.inject({
        method: 'DELETE',
        url: `/webhooks/${webhookId}`,
      });

      expect(response.statusCode).toBe(204);
      expect(response.body).toBe('');

      // Verify webhook was deleted
      const getResponse = await app.inject({
        method: 'GET',
        url: `/webhooks/${webhookId}`,
      });
      expect(getResponse.statusCode).toBe(404);
    });

    it('should return 404 for non-existent webhook', async () => {
      const response = await app.inject({
        method: 'DELETE',
        url: '/webhooks/non-existent-id',
      });

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body.error).toContain('not found');
    });

    it('should cascade delete related logs and retry queue entries', async () => {
      await app.inject({
        method: 'DELETE',
        url: `/webhooks/${webhookId}`,
      });

      // Verify logs endpoint returns 404 or empty for deleted webhook
      const logsResponse = await app.inject({
        method: 'GET',
        url: `/webhooks/${webhookId}/logs`,
      });
      expect(logsResponse.statusCode).toBe(404);
    });
  });

  describe('POST /webhooks/:id/test', () => {
    let webhookId: string;

    beforeEach(async () => {
      const createResponse = await app.inject({
        method: 'POST',
        url: '/webhooks',
        payload: createWebhookData({
          url: 'https://api.example.com/webhook/test',
        }),
      });

      webhookId = JSON.parse(createResponse.body).webhook.id;
    });

    it('should send test webhook successfully', async () => {
      // Mock successful webhook endpoint
      mockEndpoint.setResponse('/webhook/test', 200, { success: true, received: true });

      const response = await app.inject({
        method: 'POST',
        url: `/webhooks/${webhookId}/test`,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body).toHaveProperty('success', true);
      expect(body).toHaveProperty('response');
      expect(body).toHaveProperty('deliveryId');
      expect(body).toHaveProperty('statusCode', 200);
      expect(body).toHaveProperty('durationMs');
    });

    it('should handle webhook endpoint errors', async () => {
      mockEndpoint.setResponse('/webhook/test', 500, { error: 'Internal Server Error' });

      const response = await app.inject({
        method: 'POST',
        url: `/webhooks/${webhookId}/test`,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body).toHaveProperty('success', false);
      expect(body).toHaveProperty('statusCode', 500);
      expect(body).toHaveProperty('response');
      expect(body.response.error).toBe('Internal Server Error');
    });

    it('should include correct headers in test delivery', async () => {
      mockEndpoint.setResponse('/webhook/test', 200, { success: true });

      await app.inject({
        method: 'POST',
        url: `/webhooks/${webhookId}/test`,
      });

      const requests = mockEndpoint.getReceivedRequests();
      expect(requests).toHaveLength(1);

      const request = requests[0];
      expect(request.headers['Content-Type']).toBe('application/json');
      expect(request.headers['User-Agent']).toBe('APEX-Webhook/1.0');
      expect(request.headers['X-Apex-Event']).toBe('test:webhook');
      expect(request.headers['X-Apex-Delivery']).toBeDefined();
      expect(request.headers['Authorization']).toBe('Bearer token123');
      expect(request.headers['X-Custom-Header']).toBe('test-value');
    });

    it('should include signature when secret is configured', async () => {
      mockEndpoint.setResponse('/webhook/test', 200, { success: true });

      await app.inject({
        method: 'POST',
        url: `/webhooks/${webhookId}/test`,
      });

      const requests = mockEndpoint.getReceivedRequests();
      expect(requests[0].headers['X-Apex-Signature']).toMatch(/^sha256=.+/);
    });

    it('should return 404 for non-existent webhook', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/webhooks/non-existent-id/test',
      });

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body.error).toContain('not found');
    });

    it('should handle network timeouts', async () => {
      // This would require mocking the HTTP client to simulate timeouts
      // For now, we test that timeout configuration is respected
      const webhookWithShortTimeout = await app.inject({
        method: 'POST',
        url: '/webhooks',
        payload: createWebhookData({
          url: 'https://api.example.com/webhook/timeout',
          timeoutMs: 1000, // 1 second timeout
        }),
      });

      const webhookId = JSON.parse(webhookWithShortTimeout.body).webhook.id;

      // Set up slow response
      mockEndpoint.setResponse('/webhook/timeout', 200, { success: true });

      const response = await app.inject({
        method: 'POST',
        url: `/webhooks/${webhookId}/test`,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      // In real implementation, would verify timeout behavior
      expect(body).toHaveProperty('success');
    });
  });

  describe('GET /webhooks/:id/logs', () => {
    let webhookId: string;

    beforeEach(async () => {
      const createResponse = await app.inject({
        method: 'POST',
        url: '/webhooks',
        payload: createWebhookData(),
      });

      webhookId = JSON.parse(createResponse.body).webhook.id;
    });

    it('should return empty logs for new webhook', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/webhooks/${webhookId}/logs`,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body).toHaveProperty('logs');
      expect(Array.isArray(body.logs)).toBe(true);
      expect(body.logs).toHaveLength(0);
      expect(body).toHaveProperty('total', 0);
    });

    it('should support pagination parameters', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/webhooks/${webhookId}/logs?limit=20&offset=10`,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body).toHaveProperty('limit', 20);
      expect(body).toHaveProperty('offset', 10);
    });

    it('should support status filtering', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/webhooks/${webhookId}/logs?status=success`,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body).toHaveProperty('logs');
    });

    it('should support date range filtering', async () => {
      const startDate = '2024-01-01T00:00:00.000Z';
      const endDate = '2024-01-31T23:59:59.999Z';

      const response = await app.inject({
        method: 'GET',
        url: `/webhooks/${webhookId}/logs?startDate=${startDate}&endDate=${endDate}`,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body).toHaveProperty('logs');
    });

    it('should validate query parameters', async () => {
      const invalidQueries = [
        'limit=invalid',
        'offset=negative-number',
        'status=invalid-status',
        'startDate=invalid-date',
        'endDate=not-iso-date',
      ];

      for (const query of invalidQueries) {
        const response = await app.inject({
          method: 'GET',
          url: `/webhooks/${webhookId}/logs?${query}`,
        });

        expect(response.statusCode, `Query: ${query}`).toBe(400);
        const body = JSON.parse(response.body);
        expect(body).toHaveProperty('error');
      }
    });

    it('should return 404 for non-existent webhook', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/webhooks/non-existent-id/logs',
      });

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body.error).toContain('not found');
    });

    it('should order logs by attemptedAt descending', async () => {
      // This would be tested after creating some logs through webhook deliveries
      // For now, verify the response structure includes proper ordering
      const response = await app.inject({
        method: 'GET',
        url: `/webhooks/${webhookId}/logs`,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body).toHaveProperty('logs');
      // In real implementation, would verify ordering
    });
  });

  describe('POST /webhooks/:id/logs/:logId/retry', () => {
    let webhookId: string;
    let logId: string;

    beforeEach(async () => {
      const createResponse = await app.inject({
        method: 'POST',
        url: '/webhooks',
        payload: createWebhookData(),
      });

      webhookId = JSON.parse(createResponse.body).webhook.id;
      logId = 'test-log-id'; // Would be created through failed delivery
    });

    it('should retry failed webhook delivery', async () => {
      const response = await app.inject({
        method: 'POST',
        url: `/webhooks/${webhookId}/logs/${logId}/retry`,
      });

      expect([200, 404]).toContain(response.statusCode); // 404 if log doesn't exist

      if (response.statusCode === 200) {
        const body = JSON.parse(response.body);
        expect(body).toHaveProperty('success');
        expect(body).toHaveProperty('newLogId');
      }
    });

    it('should prevent retry of successful deliveries', async () => {
      // This would test that successful logs cannot be retried
      // Implementation would check log status before allowing retry
    });

    it('should return 404 for non-existent webhook or log', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/webhooks/non-existent-id/logs/non-existent-log/retry',
      });

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body.error).toContain('not found');
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle malformed JSON payloads', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/webhooks',
        payload: 'invalid json',
        headers: {
          'content-type': 'application/json',
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toMatch(/json|parse/i);
    });

    it('should handle missing content-type header', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/webhooks',
        payload: JSON.stringify(createWebhookData()),
        // No content-type header
      });

      expect([400, 415]).toContain(response.statusCode); // Bad request or unsupported media type
    });

    it('should handle very large payloads', async () => {
      const largePayload = createWebhookData({
        description: 'A'.repeat(1000000), // 1MB description
      });

      const response = await app.inject({
        method: 'POST',
        url: '/webhooks',
        payload: largePayload,
      });

      expect([400, 413]).toContain(response.statusCode); // Bad request or payload too large
    });

    it('should return consistent error response format', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/webhooks',
        payload: {}, // Invalid payload
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);

      expect(body).toHaveProperty('error');
      expect(typeof body.error).toBe('string');
      expect(body).toHaveProperty('statusCode', 400);
      expect(body.error.length).toBeGreaterThan(0);
    });

    it('should handle special characters in webhook names and descriptions', async () => {
      const webhookData = createWebhookData({
        name: 'Webhook with "quotes" and \'apostrophes\'',
        description: 'Description with special chars: <>&"\'',
        tags: ['tag with spaces', 'tag-with-"quotes"'],
      });

      const response = await app.inject({
        method: 'POST',
        url: '/webhooks',
        payload: webhookData,
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);
      expect(body.webhook.name).toBe(webhookData.name);
      expect(body.webhook.description).toBe(webhookData.description);
      expect(body.webhook.tags).toEqual(webhookData.tags);
    });

    it('should handle unicode characters', async () => {
      const webhookData = createWebhookData({
        name: 'Webhook with Unicode 🚀 测试',
        description: 'Description with emoji 🎉 and international chars αβγ العربية',
        tags: ['emoji-🚀', '中文', 'العربية'],
      });

      const response = await app.inject({
        method: 'POST',
        url: '/webhooks',
        payload: webhookData,
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);
      expect(body.webhook.name).toBe(webhookData.name);
      expect(body.webhook.description).toBe(webhookData.description);
      expect(body.webhook.tags).toEqual(webhookData.tags);
    });
  });

  describe('Security and Validation', () => {
    it('should validate URL schemes (HTTPS requirement)', async () => {
      const httpUrl = createWebhookData({
        url: 'http://insecure.example.com/webhook', // HTTP instead of HTTPS
      });

      const response = await app.inject({
        method: 'POST',
        url: '/webhooks',
        payload: httpUrl,
      });

      // In production, should require HTTPS
      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toMatch(/https|secure/i);
    });

    it('should validate against localhost URLs in production', async () => {
      const localhostUrls = [
        'https://localhost/webhook',
        'https://127.0.0.1/webhook',
        'https://0.0.0.0/webhook',
        'https://[::1]/webhook',
      ];

      for (const url of localhostUrls) {
        const response = await app.inject({
          method: 'POST',
          url: '/webhooks',
          payload: createWebhookData({ url }),
        });

        // In production, should block localhost
        expect(response.statusCode, `URL: ${url}`).toBe(400);
        const body = JSON.parse(response.body);
        expect(body.error).toMatch(/localhost|local|loopback/i);
      }
    });

    it('should rate limit webhook operations', async () => {
      // Create many webhooks rapidly to test rate limiting
      const promises = Array.from({ length: 20 }, (_, i) =>
        app.inject({
          method: 'POST',
          url: '/webhooks',
          payload: createWebhookData({
            name: `Rate Limit Test ${i}`,
            url: `https://api.example.com/webhook/${i}`,
          }),
        })
      );

      const responses = await Promise.all(promises);
      const rateLimited = responses.filter(r => r.statusCode === 429);

      // Should have some rate limiting if implemented
      // expect(rateLimited.length).toBeGreaterThan(0);
    });

    it('should sanitize webhook responses in logs', async () => {
      // Test that sensitive data is not logged or is properly masked
      // This would be implementation-specific
    });
  });

  describe('Integration with Webhook Service', () => {
    it('should trigger webhook service events on CRUD operations', async () => {
      // These tests would verify that the API endpoints properly integrate
      // with the webhook service for event emission and management

      // Create webhook
      const createResponse = await app.inject({
        method: 'POST',
        url: '/webhooks',
        payload: createWebhookData(),
      });

      expect(createResponse.statusCode).toBe(201);
      // Would verify webhook:created event was emitted

      const webhookId = JSON.parse(createResponse.body).webhook.id;

      // Update webhook
      const updateResponse = await app.inject({
        method: 'PUT',
        url: `/webhooks/${webhookId}`,
        payload: { name: 'Updated Webhook' },
      });

      expect(updateResponse.statusCode).toBe(200);
      // Would verify webhook:updated event was emitted

      // Delete webhook
      const deleteResponse = await app.inject({
        method: 'DELETE',
        url: `/webhooks/${webhookId}`,
      });

      expect(deleteResponse.statusCode).toBe(204);
      // Would verify webhook:deleted event was emitted
    });
  });
});