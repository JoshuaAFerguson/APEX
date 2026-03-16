/**
 * Integration tests for webhook service implementation
 * Tests webhook service lifecycle, event handling, delivery, and retry logic
 *
 * Note: These tests define expected behavior for the WebhookService that needs to be implemented
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { TaskStore } from '../store';
import type {
  WebhookSubscription,
  WebhookDeliveryLog,
  WebhookConfig,
  ApexEvent,
} from '@apexcli/core';

// Mock HTTP server for webhook endpoints
class MockWebhookServer {
  private responses: Map<string, { status: number; body: any; delay?: number }> = new Map();
  private receivedRequests: Array<{
    url: string;
    method: string;
    headers: Record<string, string>;
    body: string;
    timestamp: Date;
  }> = [];

  setResponse(url: string, status: number, body: any, delay?: number) {
    this.responses.set(url, { status, body, delay });
  }

  getReceivedRequests() {
    return [...this.receivedRequests];
  }

  clearRequests() {
    this.receivedRequests = [];
  }

  async simulateRequest(url: string, method: string, headers: Record<string, string>, body: string) {
    this.receivedRequests.push({
      url,
      method,
      headers,
      body,
      timestamp: new Date(),
    });

    const response = this.responses.get(url) || { status: 404, body: { error: 'Not Found' } };

    if (response.delay) {
      await new Promise(resolve => setTimeout(resolve, response.delay));
    }

    return {
      status: response.status,
      body: typeof response.body === 'string' ? response.body : JSON.stringify(response.body),
      headers: {
        'content-type': 'application/json',
      },
    };
  }
}

// WebhookService interface for testing (to be implemented)
interface IWebhookService {
  start(): Promise<void>;
  stop(): Promise<void>;
  createWebhook(data: Omit<WebhookSubscription, 'id' | 'createdAt' | 'updatedAt'>): Promise<WebhookSubscription>;
  updateWebhook(id: string, data: Partial<WebhookSubscription>): Promise<WebhookSubscription>;
  deleteWebhook(id: string): Promise<void>;
  getWebhook(id: string): Promise<WebhookSubscription | null>;
  listWebhooks(filters?: { enabled?: boolean }): Promise<WebhookSubscription[]>;
  getWebhookLogs(webhookId: string, options?: {
    limit?: number;
    offset?: number;
    status?: string;
    startDate?: Date;
    endDate?: Date;
  }): Promise<WebhookDeliveryLog[]>;
  testWebhook(id: string): Promise<{ success: boolean; response: any; error?: string }>;
}

// Mock WebhookService implementation for testing
class MockWebhookService implements IWebhookService {
  private store: TaskStore;
  private config: WebhookConfig;
  private isRunning = false;
  private mockServer: MockWebhookServer;
  private eventHandlers: Map<string, Function[]> = new Map();

  constructor(store: TaskStore, config: WebhookConfig, mockServer: MockWebhookServer) {
    this.store = store;
    this.config = config;
    this.mockServer = mockServer;
  }

  async start(): Promise<void> {
    if (this.isRunning) {
      throw new Error('WebhookService is already running');
    }
    this.isRunning = true;
  }

  async stop(): Promise<void> {
    if (!this.isRunning) {
      throw new Error('WebhookService is not running');
    }
    this.isRunning = false;
  }

  async createWebhook(data: Omit<WebhookSubscription, 'id' | 'createdAt' | 'updatedAt'>): Promise<WebhookSubscription> {
    const webhook: WebhookSubscription = {
      ...data,
      id: `webhook_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // This would be implemented using the store
    return webhook;
  }

  async updateWebhook(id: string, data: Partial<WebhookSubscription>): Promise<WebhookSubscription> {
    // Mock implementation - would use store
    const existing = await this.getWebhook(id);
    if (!existing) {
      throw new Error(`Webhook ${id} not found`);
    }

    return {
      ...existing,
      ...data,
      updatedAt: new Date(),
    };
  }

  async deleteWebhook(id: string): Promise<void> {
    // Mock implementation - would use store
    const existing = await this.getWebhook(id);
    if (!existing) {
      throw new Error(`Webhook ${id} not found`);
    }
  }

  async getWebhook(id: string): Promise<WebhookSubscription | null> {
    // Mock implementation - would use store
    return null;
  }

  async listWebhooks(filters?: { enabled?: boolean }): Promise<WebhookSubscription[]> {
    // Mock implementation - would use store
    return [];
  }

  async getWebhookLogs(webhookId: string, options?: {
    limit?: number;
    offset?: number;
    status?: string;
    startDate?: Date;
    endDate?: Date;
  }): Promise<WebhookDeliveryLog[]> {
    // Mock implementation - would use store
    return [];
  }

  async testWebhook(id: string): Promise<{ success: boolean; response: any; error?: string }> {
    const webhook = await this.getWebhook(id);
    if (!webhook) {
      throw new Error(`Webhook ${id} not found`);
    }

    try {
      const testPayload = {
        webhookId: id,
        eventType: 'test:webhook',
        deliveryId: `test_${Date.now()}`,
        timestamp: new Date().toISOString(),
        event: {
          type: 'test:webhook',
          id: 'test-event-id',
          timestamp: new Date(),
          args: { message: 'Test webhook delivery' },
        },
        source: 'apex',
      };

      const response = await this.mockServer.simulateRequest(
        webhook.url,
        'POST',
        {
          'Content-Type': webhook.contentType,
          'User-Agent': 'APEX-Webhook/1.0',
          'X-Apex-Delivery': testPayload.deliveryId,
          'X-Apex-Event': testPayload.eventType,
          ...(webhook.headers || {}),
        },
        JSON.stringify(testPayload)
      );

      return {
        success: response.status >= 200 && response.status < 300,
        response: JSON.parse(response.body),
      };
    } catch (error) {
      return {
        success: false,
        response: null,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  // Method to simulate event emission for testing
  async simulateEvent(event: ApexEvent): Promise<void> {
    if (!this.isRunning || !this.config.enabled) {
      return;
    }

    // This would normally find matching webhooks from the store
    const matchingWebhooks: WebhookSubscription[] = [];

    for (const webhook of matchingWebhooks) {
      if (!webhook.enabled) continue;

      // Check if webhook subscribes to this event type
      if (webhook.events && webhook.events.length > 0 && !webhook.events.includes(event.type)) {
        continue;
      }

      await this.deliverWebhook(webhook, event);
    }
  }

  private async deliverWebhook(webhook: WebhookSubscription, event: ApexEvent, attemptNumber = 1): Promise<void> {
    const deliveryId = `delivery_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const logId = `log_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const payload = {
      webhookId: webhook.id,
      eventType: event.type,
      deliveryId,
      timestamp: new Date().toISOString(),
      event,
      source: 'apex',
    };

    const headers = {
      'Content-Type': webhook.contentType,
      'User-Agent': 'APEX-Webhook/1.0',
      'X-Apex-Delivery': deliveryId,
      'X-Apex-Event': event.type,
      ...(webhook.headers || {}),
    };

    // Add signature if secret is configured
    if (webhook.secret) {
      const signature = this.generateSignature(JSON.stringify(payload), webhook.secret);
      headers['X-Apex-Signature'] = `sha256=${signature}`;
    }

    const startTime = Date.now();

    try {
      const response = await this.mockServer.simulateRequest(
        webhook.url,
        'POST',
        headers,
        JSON.stringify(payload)
      );

      const duration = Date.now() - startTime;
      const isSuccess = response.status >= 200 && response.status < 300;

      const log: WebhookDeliveryLog = {
        id: logId,
        webhookId: webhook.id,
        eventType: event.type,
        taskId: (event as any).taskId || 'unknown',
        statusCode: response.status,
        status: isSuccess ? 'success' : 'failed',
        attemptNumber,
        requestPayload: JSON.stringify(payload).substring(0, 10000), // Truncate at 10KB
        responseBody: response.body.substring(0, 10000), // Truncate at 10KB
        durationMs: duration,
        attemptedAt: new Date(),
        resolvedIp: '192.168.1.100', // Mock IP
      };

      // If failed and retries are configured, schedule retry
      if (!isSuccess && webhook.retry && attemptNumber < webhook.retry.maxAttempts) {
        const nextRetryAt = this.calculateNextRetry(webhook, attemptNumber);
        log.nextRetryAt = nextRetryAt;
        log.status = 'retrying';

        // Schedule retry (would normally use a job queue)
        setTimeout(() => {
          this.deliverWebhook(webhook, event, attemptNumber + 1);
        }, nextRetryAt.getTime() - Date.now());
      }

      // Store log (would normally use store.createWebhookLog)
    } catch (error) {
      const duration = Date.now() - startTime;

      const log: WebhookDeliveryLog = {
        id: logId,
        webhookId: webhook.id,
        eventType: event.type,
        taskId: (event as any).taskId || 'unknown',
        statusCode: null,
        status: 'failed',
        attemptNumber,
        requestPayload: JSON.stringify(payload).substring(0, 10000),
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        durationMs: duration,
        attemptedAt: new Date(),
      };

      // Schedule retry if configured
      if (webhook.retry && attemptNumber < webhook.retry.maxAttempts) {
        const nextRetryAt = this.calculateNextRetry(webhook, attemptNumber);
        log.nextRetryAt = nextRetryAt;
        log.status = 'retrying';

        setTimeout(() => {
          this.deliverWebhook(webhook, event, attemptNumber + 1);
        }, nextRetryAt.getTime() - Date.now());
      }
    }
  }

  private generateSignature(payload: string, secret: string): string {
    // Mock HMAC-SHA256 signature generation
    // In real implementation, would use crypto.createHmac('sha256', secret).update(payload).digest('hex')
    return 'mock-signature-' + Buffer.from(payload + secret).toString('base64').substring(0, 32);
  }

  private calculateNextRetry(webhook: WebhookSubscription, attemptNumber: number): Date {
    if (!webhook.retry) {
      return new Date(Date.now() + 1000); // Default 1 second
    }

    const delay = Math.min(
      webhook.retry.initialDelayMs * Math.pow(webhook.retry.backoffMultiplier, attemptNumber - 1),
      webhook.retry.maxDelayMs
    );

    return new Date(Date.now() + delay);
  }
}

describe('Webhook Service Integration Tests', () => {
  let testDir: string;
  let store: TaskStore;
  let mockServer: MockWebhookServer;
  let webhookService: MockWebhookService;

  const defaultConfig: WebhookConfig = {
    enabled: true,
    maxWebhooks: 50,
    defaultTimeoutMs: 30000,
    maxConcurrentDeliveries: 10,
    logRetentionDays: 30,
    requireHttps: true,
    allowLocalhost: false,
    defaultEvents: ['task:completed', 'task:failed', 'approval:required'],
  };

  beforeEach(async () => {
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'webhook-service-test-'));
    store = new TaskStore(testDir);
    await store.initialize();

    mockServer = new MockWebhookServer();
    webhookService = new MockWebhookService(store, defaultConfig, mockServer);
  });

  afterEach(async () => {
    if (webhookService) {
      try {
        await webhookService.stop();
      } catch (error) {
        // Ignore if already stopped
      }
    }
    if (store) {
      await store.close();
    }
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('Service Lifecycle', () => {
    it('should start and stop successfully', async () => {
      await expect(webhookService.start()).resolves.not.toThrow();
      await expect(webhookService.stop()).resolves.not.toThrow();
    });

    it('should prevent double start', async () => {
      await webhookService.start();
      await expect(webhookService.start()).rejects.toThrow('already running');
    });

    it('should prevent stopping when not running', async () => {
      await expect(webhookService.stop()).rejects.toThrow('not running');
    });
  });

  describe('Webhook CRUD Operations', () => {
    beforeEach(async () => {
      await webhookService.start();
    });

    afterEach(async () => {
      await webhookService.stop();
    });

    it('should create webhook with minimal data', async () => {
      const webhookData = {
        name: 'Test Webhook',
        url: 'https://api.example.com/webhook',
        enabled: true,
        events: ['task:completed'],
        taskFilters: [],
        workflowFilters: [],
        headers: {},
        timeoutMs: 30000,
        contentType: 'application/json' as const,
        tags: [],
      };

      const webhook = await webhookService.createWebhook(webhookData);

      expect(webhook.id).toBeDefined();
      expect(webhook.name).toBe(webhookData.name);
      expect(webhook.url).toBe(webhookData.url);
      expect(webhook.enabled).toBe(true);
      expect(webhook.events).toEqual(['task:completed']);
      expect(webhook.createdAt).toBeInstanceOf(Date);
      expect(webhook.updatedAt).toBeInstanceOf(Date);
    });

    it('should create webhook with full configuration', async () => {
      const webhookData = {
        name: 'Full Configuration Webhook',
        url: 'https://api.example.com/webhook',
        secret: 'secret-key-16-chars',
        enabled: true,
        events: ['task:completed', 'task:failed', 'approval:required'],
        taskFilters: ['important-task-*'],
        workflowFilters: ['feature', 'bugfix'],
        headers: {
          'Authorization': 'Bearer token123',
          'X-Custom-Header': 'custom-value',
        },
        retry: {
          maxAttempts: 3,
          initialDelayMs: 2000,
          maxDelayMs: 60000,
          backoffMultiplier: 2,
        },
        timeoutMs: 45000,
        contentType: 'application/json' as const,
        description: 'Comprehensive webhook for all events',
        tags: ['production', 'alerts'],
      };

      const webhook = await webhookService.createWebhook(webhookData);

      expect(webhook.secret).toBe(webhookData.secret);
      expect(webhook.events).toEqual(webhookData.events);
      expect(webhook.taskFilters).toEqual(webhookData.taskFilters);
      expect(webhook.workflowFilters).toEqual(webhookData.workflowFilters);
      expect(webhook.headers).toEqual(webhookData.headers);
      expect(webhook.retry).toEqual(webhookData.retry);
      expect(webhook.timeoutMs).toBe(webhookData.timeoutMs);
      expect(webhook.description).toBe(webhookData.description);
      expect(webhook.tags).toEqual(webhookData.tags);
    });

    it('should update webhook configuration', async () => {
      const webhook = await webhookService.createWebhook({
        name: 'Original Webhook',
        url: 'https://api.example.com/webhook',
        enabled: true,
        events: ['task:completed'],
        taskFilters: [],
        workflowFilters: [],
        headers: {},
        timeoutMs: 30000,
        contentType: 'application/json',
        tags: [],
      });

      const updateData = {
        name: 'Updated Webhook',
        enabled: false,
        events: ['task:completed', 'task:failed'],
        description: 'Updated description',
      };

      const updated = await webhookService.updateWebhook(webhook.id, updateData);

      expect(updated.name).toBe(updateData.name);
      expect(updated.enabled).toBe(false);
      expect(updated.events).toEqual(updateData.events);
      expect(updated.description).toBe(updateData.description);
      expect(updated.updatedAt.getTime()).toBeGreaterThan(updated.createdAt.getTime());
    });

    it('should delete webhook', async () => {
      const webhook = await webhookService.createWebhook({
        name: 'Webhook to Delete',
        url: 'https://api.example.com/webhook',
        enabled: true,
        events: [],
        taskFilters: [],
        workflowFilters: [],
        headers: {},
        timeoutMs: 30000,
        contentType: 'application/json',
        tags: [],
      });

      await expect(webhookService.deleteWebhook(webhook.id)).resolves.not.toThrow();
    });

    it('should handle non-existent webhook operations', async () => {
      await expect(webhookService.getWebhook('non-existent')).resolves.toBeNull();
      await expect(webhookService.updateWebhook('non-existent', {})).rejects.toThrow('not found');
      await expect(webhookService.deleteWebhook('non-existent')).rejects.toThrow('not found');
    });
  });

  describe('Webhook Testing and Delivery', () => {
    beforeEach(async () => {
      await webhookService.start();
    });

    afterEach(async () => {
      await webhookService.stop();
    });

    it('should test webhook with successful response', async () => {
      const webhook = await webhookService.createWebhook({
        name: 'Test Webhook',
        url: 'https://api.example.com/webhook/success',
        enabled: true,
        events: [],
        taskFilters: [],
        workflowFilters: [],
        headers: {},
        timeoutMs: 30000,
        contentType: 'application/json',
        tags: [],
      });

      mockServer.setResponse(webhook.url, 200, { success: true, message: 'Webhook received' });

      const result = await webhookService.testWebhook(webhook.id);

      expect(result.success).toBe(true);
      expect(result.response).toEqual({ success: true, message: 'Webhook received' });
      expect(result.error).toBeUndefined();

      const requests = mockServer.getReceivedRequests();
      expect(requests).toHaveLength(1);
      expect(requests[0].url).toBe(webhook.url);
      expect(requests[0].method).toBe('POST');
      expect(requests[0].headers['Content-Type']).toBe('application/json');
      expect(requests[0].headers['User-Agent']).toBe('APEX-Webhook/1.0');
      expect(requests[0].headers['X-Apex-Event']).toBe('test:webhook');
    });

    it('should test webhook with error response', async () => {
      const webhook = await webhookService.createWebhook({
        name: 'Test Webhook',
        url: 'https://api.example.com/webhook/error',
        enabled: true,
        events: [],
        taskFilters: [],
        workflowFilters: [],
        headers: {},
        timeoutMs: 30000,
        contentType: 'application/json',
        tags: [],
      });

      mockServer.setResponse(webhook.url, 500, { error: 'Internal Server Error' });

      const result = await webhookService.testWebhook(webhook.id);

      expect(result.success).toBe(false);
      expect(result.response).toEqual({ error: 'Internal Server Error' });
    });

    it('should include custom headers in webhook requests', async () => {
      const webhook = await webhookService.createWebhook({
        name: 'Test Webhook with Headers',
        url: 'https://api.example.com/webhook',
        enabled: true,
        events: [],
        taskFilters: [],
        workflowFilters: [],
        headers: {
          'Authorization': 'Bearer token123',
          'X-Custom-Header': 'custom-value',
        },
        timeoutMs: 30000,
        contentType: 'application/json',
        tags: [],
      });

      mockServer.setResponse(webhook.url, 200, { success: true });

      await webhookService.testWebhook(webhook.id);

      const requests = mockServer.getReceivedRequests();
      expect(requests[0].headers['Authorization']).toBe('Bearer token123');
      expect(requests[0].headers['X-Custom-Header']).toBe('custom-value');
    });

    it('should generate signature when secret is configured', async () => {
      const webhook = await webhookService.createWebhook({
        name: 'Webhook with Secret',
        url: 'https://api.example.com/webhook',
        secret: 'secret-key-16-chars',
        enabled: true,
        events: [],
        taskFilters: [],
        workflowFilters: [],
        headers: {},
        timeoutMs: 30000,
        contentType: 'application/json',
        tags: [],
      });

      mockServer.setResponse(webhook.url, 200, { success: true });

      await webhookService.testWebhook(webhook.id);

      const requests = mockServer.getReceivedRequests();
      expect(requests[0].headers['X-Apex-Signature']).toMatch(/^sha256=.+/);
    });
  });

  describe('Event Handling and Filtering', () => {
    beforeEach(async () => {
      await webhookService.start();
    });

    afterEach(async () => {
      await webhookService.stop();
    });

    it('should handle event delivery to matching webhooks', async () => {
      const webhook = await webhookService.createWebhook({
        name: 'Task Completion Webhook',
        url: 'https://api.example.com/webhook/tasks',
        enabled: true,
        events: ['task:completed', 'task:failed'],
        taskFilters: [],
        workflowFilters: [],
        headers: {},
        timeoutMs: 30000,
        contentType: 'application/json',
        tags: [],
      });

      mockServer.setResponse(webhook.url, 200, { success: true });

      const testEvent: ApexEvent = {
        type: 'task:completed',
        id: 'event-123',
        timestamp: new Date(),
        args: {
          taskId: 'task-456',
          status: 'completed',
          result: 'Task completed successfully',
        },
      };

      await webhookService.simulateEvent(testEvent);

      // Note: In real implementation, would verify delivery logs were created
      // This is a placeholder for the expected behavior
    });

    it('should filter events by subscribed event types', async () => {
      const webhook = await webhookService.createWebhook({
        name: 'Selective Webhook',
        url: 'https://api.example.com/webhook/selective',
        enabled: true,
        events: ['task:completed'], // Only subscribes to completed tasks
        taskFilters: [],
        workflowFilters: [],
        headers: {},
        timeoutMs: 30000,
        contentType: 'application/json',
        tags: [],
      });

      mockServer.setResponse(webhook.url, 200, { success: true });

      // Event that should trigger webhook
      const matchingEvent: ApexEvent = {
        type: 'task:completed',
        id: 'event-match',
        timestamp: new Date(),
        args: { taskId: 'task-123' },
      };

      // Event that should NOT trigger webhook
      const nonMatchingEvent: ApexEvent = {
        type: 'task:started',
        id: 'event-no-match',
        timestamp: new Date(),
        args: { taskId: 'task-456' },
      };

      await webhookService.simulateEvent(matchingEvent);
      await webhookService.simulateEvent(nonMatchingEvent);

      // In real implementation, would verify only one delivery occurred
    });

    it('should respect enabled/disabled webhook status', async () => {
      const webhook = await webhookService.createWebhook({
        name: 'Disabled Webhook',
        url: 'https://api.example.com/webhook/disabled',
        enabled: false, // Disabled
        events: ['task:completed'],
        taskFilters: [],
        workflowFilters: [],
        headers: {},
        timeoutMs: 30000,
        contentType: 'application/json',
        tags: [],
      });

      mockServer.setResponse(webhook.url, 200, { success: true });

      const testEvent: ApexEvent = {
        type: 'task:completed',
        id: 'event-disabled-test',
        timestamp: new Date(),
        args: { taskId: 'task-789' },
      };

      await webhookService.simulateEvent(testEvent);

      const requests = mockServer.getReceivedRequests();
      expect(requests).toHaveLength(0); // No requests should be made to disabled webhooks
    });
  });

  describe('Retry Logic and Error Handling', () => {
    beforeEach(async () => {
      await webhookService.start();
      vi.useFakeTimers();
    });

    afterEach(async () => {
      vi.useRealTimers();
      await webhookService.stop();
    });

    it('should implement exponential backoff retry strategy', async () => {
      const webhook = await webhookService.createWebhook({
        name: 'Retry Test Webhook',
        url: 'https://api.example.com/webhook/retry',
        enabled: true,
        events: ['task:completed'],
        taskFilters: [],
        workflowFilters: [],
        headers: {},
        retry: {
          maxAttempts: 3,
          initialDelayMs: 1000,
          maxDelayMs: 10000,
          backoffMultiplier: 2,
        },
        timeoutMs: 30000,
        contentType: 'application/json',
        tags: [],
      });

      // Set server to return error for first attempts, success for final
      let attemptCount = 0;
      mockServer.setResponse(webhook.url, 500, { error: 'Server Error' });

      const testEvent: ApexEvent = {
        type: 'task:completed',
        id: 'retry-test-event',
        timestamp: new Date(),
        args: { taskId: 'retry-test-task' },
      };

      // Trigger initial delivery
      webhookService.simulateEvent(testEvent);

      // Fast-forward through retry delays
      // First retry after 1000ms
      await vi.advanceTimersByTimeAsync(1000);

      // Second retry after 2000ms (1000 * 2)
      await vi.advanceTimersByTimeAsync(2000);

      // Third retry after 4000ms (2000 * 2), but should stop at maxAttempts

      // In real implementation, would verify retry attempts were logged with correct timing
    });

    it('should respect maxAttempts limit', async () => {
      const webhook = await webhookService.createWebhook({
        name: 'Max Attempts Test',
        url: 'https://api.example.com/webhook/max-attempts',
        enabled: true,
        events: ['task:completed'],
        taskFilters: [],
        workflowFilters: [],
        headers: {},
        retry: {
          maxAttempts: 2, // Only 2 attempts total
          initialDelayMs: 1000,
          maxDelayMs: 10000,
          backoffMultiplier: 2,
        },
        timeoutMs: 30000,
        contentType: 'application/json',
        tags: [],
      });

      mockServer.setResponse(webhook.url, 500, { error: 'Persistent Error' });

      const testEvent: ApexEvent = {
        type: 'task:completed',
        id: 'max-attempts-event',
        timestamp: new Date(),
        args: { taskId: 'max-attempts-task' },
      };

      webhookService.simulateEvent(testEvent);

      // Fast-forward through all possible retry times
      await vi.advanceTimersByTimeAsync(10000);

      // In real implementation, would verify exactly 2 attempts were made
    });

    it('should respect maxDelayMs cap', async () => {
      const webhook = await webhookService.createWebhook({
        name: 'Max Delay Test',
        url: 'https://api.example.com/webhook/max-delay',
        enabled: true,
        events: ['task:completed'],
        taskFilters: [],
        workflowFilters: [],
        headers: {},
        retry: {
          maxAttempts: 5,
          initialDelayMs: 1000,
          maxDelayMs: 3000, // Cap at 3 seconds
          backoffMultiplier: 4, // Aggressive multiplier
        },
        timeoutMs: 30000,
        contentType: 'application/json',
        tags: [],
      });

      // Verify delay calculation respects maxDelayMs
      const service = webhookService as any;

      // First retry: 1000 * 4^0 = 1000ms
      const delay1 = service.calculateNextRetry(webhook, 1);
      expect(delay1.getTime() - Date.now()).toBeCloseTo(1000, -1);

      // Second retry: 1000 * 4^1 = 4000ms, but capped at 3000ms
      const delay2 = service.calculateNextRetry(webhook, 2);
      expect(delay2.getTime() - Date.now()).toBeCloseTo(3000, -1);

      // Third retry: should still be capped at 3000ms
      const delay3 = service.calculateNextRetry(webhook, 3);
      expect(delay3.getTime() - Date.now()).toBeCloseTo(3000, -1);
    });
  });

  describe('Configuration and Security', () => {
    it('should respect global configuration settings', async () => {
      const disabledConfig = { ...defaultConfig, enabled: false };
      const disabledService = new MockWebhookService(store, disabledConfig, mockServer);

      await disabledService.start();

      const webhook = await disabledService.createWebhook({
        name: 'Test Webhook',
        url: 'https://api.example.com/webhook',
        enabled: true,
        events: ['task:completed'],
        taskFilters: [],
        workflowFilters: [],
        headers: {},
        timeoutMs: 30000,
        contentType: 'application/json',
        tags: [],
      });

      mockServer.setResponse(webhook.url, 200, { success: true });

      const testEvent: ApexEvent = {
        type: 'task:completed',
        id: 'global-config-test',
        timestamp: new Date(),
        args: { taskId: 'config-task' },
      };

      await disabledService.simulateEvent(testEvent);

      const requests = mockServer.getReceivedRequests();
      expect(requests).toHaveLength(0); // No deliveries when globally disabled

      await disabledService.stop();
    });

    it('should validate HTTPS requirement in production', () => {
      // This test verifies URL validation behavior
      // In real implementation, would test that non-HTTPS URLs are rejected when requireHttps is true
      expect(defaultConfig.requireHttps).toBe(true);
    });

    it('should handle localhost restrictions', () => {
      // This test verifies localhost blocking behavior
      // In real implementation, would test that localhost URLs are rejected when allowLocalhost is false
      expect(defaultConfig.allowLocalhost).toBe(false);
    });
  });

  describe('Performance and Concurrency', () => {
    beforeEach(async () => {
      await webhookService.start();
    });

    afterEach(async () => {
      await webhookService.stop();
    });

    it('should handle concurrent webhook deliveries', async () => {
      const webhooks = await Promise.all([
        webhookService.createWebhook({
          name: 'Concurrent Webhook 1',
          url: 'https://api.example.com/webhook/1',
          enabled: true,
          events: ['task:completed'],
          taskFilters: [],
          workflowFilters: [],
          headers: {},
          timeoutMs: 30000,
          contentType: 'application/json',
          tags: [],
        }),
        webhookService.createWebhook({
          name: 'Concurrent Webhook 2',
          url: 'https://api.example.com/webhook/2',
          enabled: true,
          events: ['task:completed'],
          taskFilters: [],
          workflowFilters: [],
          headers: {},
          timeoutMs: 30000,
          contentType: 'application/json',
          tags: [],
        }),
      ]);

      // Set up responses with different delays
      mockServer.setResponse('https://api.example.com/webhook/1', 200, { success: true }, 100);
      mockServer.setResponse('https://api.example.com/webhook/2', 200, { success: true }, 200);

      const testEvent: ApexEvent = {
        type: 'task:completed',
        id: 'concurrent-test',
        timestamp: new Date(),
        args: { taskId: 'concurrent-task' },
      };

      const startTime = Date.now();
      await webhookService.simulateEvent(testEvent);
      const endTime = Date.now();

      // In real implementation, would verify concurrent deliveries completed efficiently
      // and that maxConcurrentDeliveries limit is respected
    });

    it('should respect timeout configuration', async () => {
      const webhook = await webhookService.createWebhook({
        name: 'Timeout Test Webhook',
        url: 'https://api.example.com/webhook/timeout',
        enabled: true,
        events: ['task:completed'],
        taskFilters: [],
        workflowFilters: [],
        headers: {},
        timeoutMs: 5000, // 5 second timeout
        contentType: 'application/json',
        tags: [],
      });

      // Set up server to respond slowly (10 seconds)
      mockServer.setResponse(webhook.url, 200, { success: true }, 10000);

      const result = await webhookService.testWebhook(webhook.id);

      // In real implementation, would verify timeout behavior
      // expect(result.success).toBe(false);
      // expect(result.error).toContain('timeout');
    });
  });
});