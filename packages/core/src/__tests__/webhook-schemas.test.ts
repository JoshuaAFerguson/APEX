/**
 * Comprehensive tests for webhook schemas and types
 * Tests all webhook-related schemas: WebhookSubscription, WebhookDeliveryLog, WebhookConfig
 */
import { describe, it, expect } from 'vitest';
import {
  WebhookSubscriptionSchema,
  WebhookDeliveryLogSchema,
  WebhookConfigSchema,
  ApexConfigSchema,
  type WebhookSubscription,
  type WebhookDeliveryLog,
  type WebhookConfig,
} from '../types';

describe('Webhook Schema Validation', () => {
  describe('WebhookSubscriptionSchema', () => {
    const validWebhookBase = {
      id: 'webhook-123',
      name: 'Test Webhook',
      url: 'https://api.example.com/webhooks/test',
      createdAt: new Date('2024-01-15T10:00:00Z'),
      updatedAt: new Date('2024-01-15T12:00:00Z'),
    };

    it('should validate minimal webhook subscription', () => {
      const result = WebhookSubscriptionSchema.parse(validWebhookBase);

      expect(result.id).toBe('webhook-123');
      expect(result.name).toBe('Test Webhook');
      expect(result.url).toBe('https://api.example.com/webhooks/test');
      expect(result.enabled).toBe(true); // default
      expect(result.events).toEqual([]); // default
      expect(result.taskFilters).toEqual([]); // default
      expect(result.workflowFilters).toEqual([]); // default
      expect(result.headers).toEqual({}); // default
      expect(result.timeoutMs).toBe(30000); // default
      expect(result.contentType).toBe('application/json'); // default
      expect(result.tags).toEqual([]); // default
    });

    it('should validate webhook with all optional fields', () => {
      const fullWebhook = {
        ...validWebhookBase,
        secret: 'very-secret-key-16char',
        enabled: false,
        events: ['task:completed', 'task:failed'],
        taskFilters: ['task-1', 'task-2'],
        workflowFilters: ['workflow-a', 'workflow-b'],
        headers: {
          'X-Custom-Header': 'value',
          'Authorization': 'Bearer token',
        },
        retry: {
          maxAttempts: 3,
          initialDelayMs: 2000,
          maxDelayMs: 60000,
          backoffMultiplier: 2.5,
        },
        timeoutMs: 45000,
        contentType: 'application/x-www-form-urlencoded' as const,
        description: 'A test webhook for integration',
        tags: ['test', 'integration'],
      };

      const result = WebhookSubscriptionSchema.parse(fullWebhook);

      expect(result.secret).toBe('very-secret-key-16char');
      expect(result.enabled).toBe(false);
      expect(result.events).toEqual(['task:completed', 'task:failed']);
      expect(result.taskFilters).toEqual(['task-1', 'task-2']);
      expect(result.workflowFilters).toEqual(['workflow-a', 'workflow-b']);
      expect(result.headers).toEqual({
        'X-Custom-Header': 'value',
        'Authorization': 'Bearer token',
      });
      expect(result.retry).toEqual({
        maxAttempts: 3,
        initialDelayMs: 2000,
        maxDelayMs: 60000,
        backoffMultiplier: 2.5,
      });
      expect(result.timeoutMs).toBe(45000);
      expect(result.contentType).toBe('application/x-www-form-urlencoded');
      expect(result.description).toBe('A test webhook for integration');
      expect(result.tags).toEqual(['test', 'integration']);
    });

    it('should reject invalid webhook data', () => {
      // Missing required fields
      expect(() => WebhookSubscriptionSchema.parse({})).toThrow();
      expect(() => WebhookSubscriptionSchema.parse({
        id: 'test',
        // missing name
        url: 'https://example.com',
        createdAt: new Date(),
        updatedAt: new Date(),
      })).toThrow();

      // Invalid URL
      expect(() => WebhookSubscriptionSchema.parse({
        ...validWebhookBase,
        url: 'not-a-valid-url',
      })).toThrow();

      // Invalid name length
      expect(() => WebhookSubscriptionSchema.parse({
        ...validWebhookBase,
        name: '', // too short
      })).toThrow();

      expect(() => WebhookSubscriptionSchema.parse({
        ...validWebhookBase,
        name: 'a'.repeat(101), // too long
      })).toThrow();

      // Invalid secret length
      expect(() => WebhookSubscriptionSchema.parse({
        ...validWebhookBase,
        secret: 'short', // too short (< 16 chars)
      })).toThrow();

      expect(() => WebhookSubscriptionSchema.parse({
        ...validWebhookBase,
        secret: 'a'.repeat(257), // too long (> 256 chars)
      })).toThrow();

      // Invalid timeout
      expect(() => WebhookSubscriptionSchema.parse({
        ...validWebhookBase,
        timeoutMs: 500, // too small
      })).toThrow();

      expect(() => WebhookSubscriptionSchema.parse({
        ...validWebhookBase,
        timeoutMs: 400000, // too large
      })).toThrow();

      // Invalid content type
      expect(() => WebhookSubscriptionSchema.parse({
        ...validWebhookBase,
        contentType: 'text/plain',
      })).toThrow();
    });

    it('should validate retry configuration', () => {
      const webhookWithRetry = {
        ...validWebhookBase,
        retry: {
          maxAttempts: 5,
          initialDelayMs: 1000,
          maxDelayMs: 300000,
          backoffMultiplier: 2,
        },
      };

      const result = WebhookSubscriptionSchema.parse(webhookWithRetry);
      expect(result.retry).toEqual({
        maxAttempts: 5,
        initialDelayMs: 1000,
        maxDelayMs: 300000,
        backoffMultiplier: 2,
      });

      // Test invalid retry values
      expect(() => WebhookSubscriptionSchema.parse({
        ...validWebhookBase,
        retry: { maxAttempts: 11 }, // too high
      })).toThrow();

      expect(() => WebhookSubscriptionSchema.parse({
        ...validWebhookBase,
        retry: { maxAttempts: -1 }, // negative
      })).toThrow();

      expect(() => WebhookSubscriptionSchema.parse({
        ...validWebhookBase,
        retry: { initialDelayMs: 50 }, // too small
      })).toThrow();

      expect(() => WebhookSubscriptionSchema.parse({
        ...validWebhookBase,
        retry: { maxDelayMs: 4000000 }, // too large
      })).toThrow();

      expect(() => WebhookSubscriptionSchema.parse({
        ...validWebhookBase,
        retry: { backoffMultiplier: 6 }, // too large
      })).toThrow();
    });

    it('should validate description length', () => {
      const webhookWithDescription = {
        ...validWebhookBase,
        description: 'A'.repeat(500), // max length
      };

      expect(() => WebhookSubscriptionSchema.parse(webhookWithDescription)).not.toThrow();

      // Too long description
      expect(() => WebhookSubscriptionSchema.parse({
        ...validWebhookBase,
        description: 'A'.repeat(501),
      })).toThrow();
    });
  });

  describe('WebhookDeliveryLogSchema', () => {
    const validLogBase = {
      id: 'log-123',
      webhookId: 'webhook-123',
      eventType: 'task:completed',
      taskId: 'task-456',
      status: 'success' as const,
      attemptedAt: new Date('2024-01-15T12:00:00Z'),
    };

    it('should validate minimal delivery log', () => {
      const result = WebhookDeliveryLogSchema.parse(validLogBase);

      expect(result.id).toBe('log-123');
      expect(result.webhookId).toBe('webhook-123');
      expect(result.eventType).toBe('task:completed');
      expect(result.taskId).toBe('task-456');
      expect(result.status).toBe('success');
      expect(result.attemptNumber).toBe(1); // default
      expect(result.statusCode).toBeNull();
      expect(result.attemptedAt).toBeInstanceOf(Date);
    });

    it('should validate delivery log with all fields', () => {
      const fullLog = {
        ...validLogBase,
        statusCode: 200,
        attemptNumber: 3,
        requestPayload: '{"event": "task:completed"}',
        responseBody: '{"success": true}',
        errorMessage: null,
        durationMs: 250,
        nextRetryAt: new Date('2024-01-15T12:05:00Z'),
        resolvedIp: '192.168.1.100',
      };

      const result = WebhookDeliveryLogSchema.parse(fullLog);

      expect(result.statusCode).toBe(200);
      expect(result.attemptNumber).toBe(3);
      expect(result.requestPayload).toBe('{"event": "task:completed"}');
      expect(result.responseBody).toBe('{"success": true}');
      expect(result.durationMs).toBe(250);
      expect(result.nextRetryAt).toBeInstanceOf(Date);
      expect(result.resolvedIp).toBe('192.168.1.100');
    });

    it('should validate all status values', () => {
      const validStatuses = ['pending', 'success', 'failed', 'retrying'] as const;

      validStatuses.forEach(status => {
        const log = { ...validLogBase, status };
        expect(() => WebhookDeliveryLogSchema.parse(log)).not.toThrow();
      });

      // Invalid status
      expect(() => WebhookDeliveryLogSchema.parse({
        ...validLogBase,
        status: 'invalid-status',
      })).toThrow();
    });

    it('should validate response body truncation', () => {
      const largeResponseBody = 'A'.repeat(10000); // exactly max length
      const tooLargeResponseBody = 'A'.repeat(10001); // over max length

      // Should accept 10KB response
      expect(() => WebhookDeliveryLogSchema.parse({
        ...validLogBase,
        responseBody: largeResponseBody,
      })).not.toThrow();

      // Should reject > 10KB response
      expect(() => WebhookDeliveryLogSchema.parse({
        ...validLogBase,
        responseBody: tooLargeResponseBody,
      })).toThrow();
    });

    it('should handle nullable fields correctly', () => {
      const logWithNulls = {
        ...validLogBase,
        statusCode: null,
        errorMessage: null,
        nextRetryAt: null,
      };

      const result = WebhookDeliveryLogSchema.parse(logWithNulls);
      expect(result.statusCode).toBeNull();
      expect(result.errorMessage).toBeUndefined();
      expect(result.nextRetryAt).toBeUndefined();
    });
  });

  describe('WebhookConfigSchema', () => {
    it('should validate default webhook config', () => {
      const result = WebhookConfigSchema.parse({});

      expect(result.enabled).toBe(true);
      expect(result.maxWebhooks).toBe(50);
      expect(result.defaultTimeoutMs).toBe(30000);
      expect(result.maxConcurrentDeliveries).toBe(10);
      expect(result.logRetentionDays).toBe(30);
      expect(result.requireHttps).toBe(true);
      expect(result.allowLocalhost).toBe(false);
      expect(result.defaultEvents).toEqual([
        'task:completed',
        'task:failed',
        'approval:required',
      ]);
    });

    it('should validate custom webhook config', () => {
      const customConfig = {
        enabled: false,
        maxWebhooks: 25,
        defaultTimeoutMs: 60000,
        maxConcurrentDeliveries: 5,
        logRetentionDays: 90,
        requireHttps: false,
        allowLocalhost: true,
        defaultEvents: ['task:created', 'task:completed'],
      };

      const result = WebhookConfigSchema.parse(customConfig);

      expect(result.enabled).toBe(false);
      expect(result.maxWebhooks).toBe(25);
      expect(result.defaultTimeoutMs).toBe(60000);
      expect(result.maxConcurrentDeliveries).toBe(5);
      expect(result.logRetentionDays).toBe(90);
      expect(result.requireHttps).toBe(false);
      expect(result.allowLocalhost).toBe(true);
      expect(result.defaultEvents).toEqual(['task:created', 'task:completed']);
    });

    it('should reject invalid webhook config values', () => {
      // maxWebhooks out of range
      expect(() => WebhookConfigSchema.parse({ maxWebhooks: 0 })).toThrow();
      expect(() => WebhookConfigSchema.parse({ maxWebhooks: 101 })).toThrow();

      // defaultTimeoutMs out of range
      expect(() => WebhookConfigSchema.parse({ defaultTimeoutMs: 500 })).toThrow();
      expect(() => WebhookConfigSchema.parse({ defaultTimeoutMs: 400000 })).toThrow();

      // maxConcurrentDeliveries out of range
      expect(() => WebhookConfigSchema.parse({ maxConcurrentDeliveries: 0 })).toThrow();
      expect(() => WebhookConfigSchema.parse({ maxConcurrentDeliveries: 51 })).toThrow();

      // logRetentionDays out of range
      expect(() => WebhookConfigSchema.parse({ logRetentionDays: 0 })).toThrow();
      expect(() => WebhookConfigSchema.parse({ logRetentionDays: 366 })).toThrow();
    });

    it('should validate boundary values', () => {
      const boundaryConfig = {
        maxWebhooks: 1, // minimum
        defaultTimeoutMs: 1000, // minimum
        maxConcurrentDeliveries: 1, // minimum
        logRetentionDays: 1, // minimum
      };

      expect(() => WebhookConfigSchema.parse(boundaryConfig)).not.toThrow();

      const maxBoundaryConfig = {
        maxWebhooks: 100, // maximum
        defaultTimeoutMs: 300000, // maximum
        maxConcurrentDeliveries: 50, // maximum
        logRetentionDays: 365, // maximum
      };

      expect(() => WebhookConfigSchema.parse(maxBoundaryConfig)).not.toThrow();
    });
  });

  describe('ApexConfigSchema Integration', () => {
    it('should include webhooks config in ApexConfigSchema', () => {
      const apexConfig = {
        version: '1.0',
        project: {
          name: 'test-project',
        },
        webhooks: {
          enabled: true,
          maxWebhooks: 25,
          defaultEvents: ['task:completed'],
        },
      };

      const result = ApexConfigSchema.parse(apexConfig);
      expect(result.webhooks).toBeDefined();
      expect(result.webhooks?.enabled).toBe(true);
      expect(result.webhooks?.maxWebhooks).toBe(25);
      expect(result.webhooks?.defaultEvents).toEqual(['task:completed']);
    });

    it('should work without webhooks config (optional)', () => {
      const apexConfig = {
        version: '1.0',
        project: {
          name: 'test-project',
        },
      };

      const result = ApexConfigSchema.parse(apexConfig);
      expect(result.webhooks).toBeUndefined();
    });

    it('should validate nested webhook config within ApexConfig', () => {
      const invalidApexConfig = {
        version: '1.0',
        project: {
          name: 'test-project',
        },
        webhooks: {
          enabled: true,
          maxWebhooks: 101, // invalid - too high
        },
      };

      expect(() => ApexConfigSchema.parse(invalidApexConfig)).toThrow();
    });
  });

  describe('Type Safety and TypeScript Integration', () => {
    it('should provide correct TypeScript types', () => {
      const webhook: WebhookSubscription = {
        id: 'webhook-123',
        name: 'Test Webhook',
        url: 'https://api.example.com/webhook',
        secret: 'secret-key-16-chars',
        enabled: true,
        events: ['task:completed'],
        taskFilters: [],
        workflowFilters: [],
        headers: {},
        retry: {
          maxAttempts: 5,
          initialDelayMs: 1000,
          maxDelayMs: 300000,
          backoffMultiplier: 2,
        },
        timeoutMs: 30000,
        contentType: 'application/json',
        createdAt: new Date(),
        updatedAt: new Date(),
        description: 'Test webhook',
        tags: ['test'],
      };

      // Should compile without errors
      expect(webhook.id).toBe('webhook-123');
      expect(webhook.contentType).toBe('application/json');
    });

    it('should provide correct TypeScript types for delivery log', () => {
      const log: WebhookDeliveryLog = {
        id: 'log-123',
        webhookId: 'webhook-123',
        eventType: 'task:completed',
        taskId: 'task-456',
        statusCode: 200,
        status: 'success',
        attemptNumber: 1,
        requestPayload: '{}',
        responseBody: '{}',
        errorMessage: undefined,
        durationMs: 250,
        attemptedAt: new Date(),
        nextRetryAt: undefined,
        resolvedIp: '192.168.1.1',
      };

      // Should compile without errors
      expect(log.status).toBe('success');
      expect(log.statusCode).toBe(200);
    });

    it('should provide correct TypeScript types for webhook config', () => {
      const config: WebhookConfig = {
        enabled: true,
        maxWebhooks: 50,
        defaultTimeoutMs: 30000,
        maxConcurrentDeliveries: 10,
        logRetentionDays: 30,
        requireHttps: true,
        allowLocalhost: false,
        defaultEvents: ['task:completed', 'task:failed'],
      };

      // Should compile without errors
      expect(config.enabled).toBe(true);
      expect(config.defaultEvents).toContain('task:completed');
    });
  });

  describe('Edge Cases and Error Scenarios', () => {
    it('should handle empty arrays and objects', () => {
      const webhook = {
        id: 'webhook-123',
        name: 'Test Webhook',
        url: 'https://api.example.com/webhook',
        createdAt: new Date(),
        updatedAt: new Date(),
        events: [],
        taskFilters: [],
        workflowFilters: [],
        headers: {},
        tags: [],
      };

      expect(() => WebhookSubscriptionSchema.parse(webhook)).not.toThrow();
    });

    it('should handle special characters in webhook data', () => {
      const webhook = {
        id: 'webhook-123',
        name: 'Test Webhook with "quotes" and \'apostrophes\'',
        url: 'https://api.example.com/webhook?param=value&other=test',
        description: 'Description with special chars: <>&"\'',
        createdAt: new Date(),
        updatedAt: new Date(),
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'X-Custom-Header': 'value with spaces and symbols !@#$%',
        },
        tags: ['test-tag', 'another_tag', 'tag-with-dashes'],
      };

      expect(() => WebhookSubscriptionSchema.parse(webhook)).not.toThrow();
    });

    it('should handle unicode characters', () => {
      const webhook = {
        id: 'webhook-unicode',
        name: 'Webhook with Unicode 🚀 测试',
        url: 'https://api.example.com/webhook',
        description: 'Description with emoji 🎉 and international chars αβγ',
        createdAt: new Date(),
        updatedAt: new Date(),
        tags: ['emoji-🚀', '中文', 'العربية'],
      };

      expect(() => WebhookSubscriptionSchema.parse(webhook)).not.toThrow();
    });

    it('should validate URL formats thoroughly', () => {
      const validUrls = [
        'https://api.example.com/webhook',
        'https://subdomain.example.com:8080/webhook',
        'https://example.com/webhook?param=value',
        'https://example.com/webhook#fragment',
        'https://api.example.com/webhook/path/subpath',
      ];

      validUrls.forEach(url => {
        const webhook = {
          id: 'webhook-123',
          name: 'Test Webhook',
          url,
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        expect(() => WebhookSubscriptionSchema.parse(webhook), `URL: ${url}`).not.toThrow();
      });

      const invalidUrls = [
        'http://insecure.example.com/webhook', // http not https
        'ftp://example.com/webhook',
        'not-a-url-at-all',
        'https://', // incomplete
        'https://example', // no TLD
      ];

      invalidUrls.forEach(url => {
        const webhook = {
          id: 'webhook-123',
          name: 'Test Webhook',
          url,
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        expect(() => WebhookSubscriptionSchema.parse(webhook), `URL: ${url}`).toThrow();
      });
    });
  });
});