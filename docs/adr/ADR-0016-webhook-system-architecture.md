# ADR-0016: Webhook System Architecture for Custom Integrations

## Status
Proposed

## Date
2026-03-15

## Context

APEX requires a configurable webhook system for custom notification endpoints to enable third-party integrations beyond the existing Slack and Teams integrations. This system should:

1. **Webhook Management UI** - Frontend interface for CRUD operations
2. **Configurable Event Triggers** - Subscribe to specific APEX events
3. **Task Data in Payloads** - Include comprehensive task information
4. **Retry Logic** - Handle failed deliveries with exponential backoff
5. **Webhook Logs** - Viewable delivery history and debugging information

### Existing Infrastructure Analysis

The APEX codebase has mature patterns we can leverage:

1. **Event System** (`packages/orchestrator/src/index.ts`)
   - EventEmitter3-based pub/sub with 150+ event types
   - `ApexEventType` union type covers all system events
   - `ApexEvent` interface with type, taskId, timestamp, and data

2. **Integration Patterns** (`packages/api/src/services/slack-service.ts`)
   - Service class pattern with `start()`, `stop()` lifecycle
   - Orchestrator event registration via `registerOrchestratorEvents()`
   - Configuration resolution from config and environment variables

3. **Database Storage** (`packages/orchestrator/src/store.ts`)
   - SQLite with better-sqlite3
   - Migration pattern for schema evolution
   - Audit logging infrastructure exists

4. **API Patterns** (`packages/api/src/index.ts`)
   - Fastify REST endpoints with CORS and auth
   - WebSocket broadcasting with event filtering
   - `safeSerialize()` and `truncatePayload()` utilities

5. **Configuration System** (`packages/core/src/types.ts`)
   - Zod schema validation
   - Integration configs (SlackIntegrationConfig, TeamsIntegrationConfig)
   - ApexConfig schema extensibility

6. **UI Component Patterns** (`packages/web-ui/src/components/`)
   - Dashboard components with real-time updates
   - Form components (Input, Select, MultiSelect, Checkbox)
   - Card/Panel patterns for management interfaces

## Decision

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              APEX Webhook System                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────────┐    ┌──────────────────┐    ┌────────────────────────────┐ │
│  │   Web UI     │    │    REST API      │    │      Orchestrator          │ │
│  │              │    │                  │    │                            │ │
│  │ ┌──────────┐ │    │  /webhooks/*     │    │  ┌──────────────────────┐  │ │
│  │ │ Webhook  │─┼────┼──────────────────┼────┼──│   WebhookService     │  │ │
│  │ │ Manager  │ │    │  CRUD endpoints  │    │  │                      │  │ │
│  │ └──────────┘ │    │                  │    │  │  - Event listener    │  │ │
│  │              │    │  /webhook-logs/* │    │  │  - HTTP client       │  │ │
│  │ ┌──────────┐ │    │                  │    │  │  - Retry queue       │  │ │
│  │ │ Delivery │─┼────┼──────────────────┼────┼──│  - Signature gen     │  │ │
│  │ │  Logs    │ │    │  History/search  │    │  │                      │  │ │
│  │ └──────────┘ │    │                  │    │  └──────────────────────┘  │ │
│  └──────────────┘    └──────────────────┘    │            │               │ │
│                                              │            ▼               │ │
│                                              │  ┌──────────────────────┐  │ │
│                                              │  │     TaskStore        │  │ │
│                                              │  │  (SQLite tables)     │  │ │
│                                              │  │                      │  │ │
│                                              │  │  - webhooks          │  │ │
│                                              │  │  - webhook_events    │  │ │
│                                              │  │  - webhook_logs      │  │ │
│                                              │  └──────────────────────┘  │ │
│                                              └────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Package Responsibilities

| Package | Responsibility |
|---------|---------------|
| `@apexcli/core` | Webhook types, schemas, event type extensions |
| `@apexcli/orchestrator` | WebhookService, storage tables, retry queue |
| `@apexcli/api` | REST endpoints for webhook CRUD and logs |
| `@apexcli/web-ui` | Webhook management UI components |

---

## Core Types (packages/core/src/types.ts)

### Webhook Configuration Schema

```typescript
/**
 * Webhook subscription configuration (v0.7.0)
 */
export const WebhookSubscriptionSchema = z.object({
  /** Unique webhook identifier */
  id: z.string(),

  /** Human-readable name for the webhook */
  name: z.string().min(1).max(100),

  /** Webhook endpoint URL (must be HTTPS in production) */
  url: z.string().url(),

  /** Secret for HMAC-SHA256 signature generation */
  secret: z.string().min(16).max(256).optional(),

  /** Whether the webhook is currently active */
  enabled: z.boolean().default(true),

  /** Event types to subscribe to (empty = all events) */
  events: z.array(z.string()).default([]),

  /** Optional filter by task IDs (empty = all tasks) */
  taskFilters: z.array(z.string()).optional().default([]),

  /** Optional filter by workflow types */
  workflowFilters: z.array(z.string()).optional().default([]),

  /** Custom HTTP headers to include */
  headers: z.record(z.string()).optional().default({}),

  /** Retry configuration */
  retry: z.object({
    /** Maximum retry attempts (default: 5) */
    maxAttempts: z.number().min(0).max(10).default(5),
    /** Initial retry delay in ms (default: 1000) */
    initialDelayMs: z.number().min(100).max(60000).default(1000),
    /** Maximum retry delay in ms (default: 300000 = 5 min) */
    maxDelayMs: z.number().min(1000).max(3600000).default(300000),
    /** Backoff multiplier (default: 2) */
    backoffMultiplier: z.number().min(1).max(5).default(2),
  }).optional().default({}),

  /** Request timeout in ms (default: 30000) */
  timeoutMs: z.number().min(1000).max(300000).default(30000),

  /** Content type for payload (default: application/json) */
  contentType: z.enum(['application/json', 'application/x-www-form-urlencoded']).default('application/json'),

  /** Creation timestamp */
  createdAt: z.date(),

  /** Last update timestamp */
  updatedAt: z.date(),

  /** Optional description */
  description: z.string().max(500).optional(),

  /** Tags for organization */
  tags: z.array(z.string()).optional().default([]),
});

export type WebhookSubscription = z.infer<typeof WebhookSubscriptionSchema>;
```

### Webhook Delivery Log Schema

```typescript
/**
 * Webhook delivery attempt log entry
 */
export const WebhookDeliveryLogSchema = z.object({
  /** Unique log entry ID */
  id: z.string(),

  /** Associated webhook ID */
  webhookId: z.string(),

  /** Event that triggered delivery */
  eventType: z.string(),

  /** Related task ID */
  taskId: z.string(),

  /** HTTP status code returned (null if network error) */
  statusCode: z.number().nullable(),

  /** Delivery status */
  status: z.enum(['pending', 'success', 'failed', 'retrying']),

  /** Number of retry attempts made */
  attemptNumber: z.number().default(1),

  /** Request payload (truncated for storage) */
  requestPayload: z.string().optional(),

  /** Response body (truncated for storage) */
  responseBody: z.string().max(10000).optional(),

  /** Error message if failed */
  errorMessage: z.string().optional(),

  /** Request duration in ms */
  durationMs: z.number().optional(),

  /** Timestamp of delivery attempt */
  attemptedAt: z.date(),

  /** Next retry scheduled time (if retrying) */
  nextRetryAt: z.date().optional(),

  /** IP address the request was sent to */
  resolvedIp: z.string().optional(),
});

export type WebhookDeliveryLog = z.infer<typeof WebhookDeliveryLogSchema>;
```

### Webhook Event Types Extension

```typescript
// Add to ApexEventType union
export type ApexEventType =
  | /* ... existing types ... */
  // Webhook lifecycle events (v0.7.0)
  | 'webhook:created'
  | 'webhook:updated'
  | 'webhook:deleted'
  | 'webhook:enabled'
  | 'webhook:disabled'
  | 'webhook:delivery:success'
  | 'webhook:delivery:failed'
  | 'webhook:delivery:retry';
```

### Integration Configuration Extension

```typescript
/**
 * Webhook system configuration (v0.7.0)
 */
export const WebhookConfigSchema = z.object({
  /** Enable webhook system globally */
  enabled: z.boolean().optional().default(true),

  /** Maximum number of webhooks allowed */
  maxWebhooks: z.number().min(1).max(100).optional().default(50),

  /** Global timeout for webhook requests in ms */
  defaultTimeoutMs: z.number().min(1000).max(300000).optional().default(30000),

  /** Maximum concurrent webhook deliveries */
  maxConcurrentDeliveries: z.number().min(1).max(50).optional().default(10),

  /** Log retention period in days */
  logRetentionDays: z.number().min(1).max(365).optional().default(30),

  /** Require HTTPS for webhook URLs (recommended for production) */
  requireHttps: z.boolean().optional().default(true),

  /** Allow webhooks to localhost (for development) */
  allowLocalhost: z.boolean().optional().default(false),

  /** Default events for new webhooks */
  defaultEvents: z.array(z.string()).optional().default([
    'task:completed',
    'task:failed',
    'approval:required',
  ]),
});

export type WebhookConfig = z.infer<typeof WebhookConfigSchema>;

// Add to ApexConfigSchema
export const ApexConfigSchema = z.object({
  // ... existing fields ...
  /** Webhook system configuration (v0.7.0) */
  webhooks: WebhookConfigSchema.optional(),
});
```

---

## Database Schema (packages/orchestrator/src/store.ts)

### New Tables

```sql
-- Webhook subscriptions table
CREATE TABLE IF NOT EXISTS webhooks (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  secret TEXT,
  enabled INTEGER DEFAULT 1,
  events TEXT NOT NULL DEFAULT '[]',
  task_filters TEXT DEFAULT '[]',
  workflow_filters TEXT DEFAULT '[]',
  headers TEXT DEFAULT '{}',
  retry_config TEXT DEFAULT '{}',
  timeout_ms INTEGER DEFAULT 30000,
  content_type TEXT DEFAULT 'application/json',
  description TEXT,
  tags TEXT DEFAULT '[]',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_webhooks_enabled ON webhooks(enabled);
CREATE INDEX IF NOT EXISTS idx_webhooks_created_at ON webhooks(created_at);

-- Webhook event mappings (for efficient filtering)
CREATE TABLE IF NOT EXISTS webhook_events (
  webhook_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  PRIMARY KEY (webhook_id, event_type),
  FOREIGN KEY (webhook_id) REFERENCES webhooks(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_webhook_events_type ON webhook_events(event_type);

-- Webhook delivery logs
CREATE TABLE IF NOT EXISTS webhook_logs (
  id TEXT PRIMARY KEY,
  webhook_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  task_id TEXT NOT NULL,
  status_code INTEGER,
  status TEXT NOT NULL CHECK (status IN ('pending', 'success', 'failed', 'retrying')),
  attempt_number INTEGER DEFAULT 1,
  request_payload TEXT,
  response_body TEXT,
  error_message TEXT,
  duration_ms INTEGER,
  attempted_at TEXT NOT NULL,
  next_retry_at TEXT,
  resolved_ip TEXT,
  FOREIGN KEY (webhook_id) REFERENCES webhooks(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_webhook_logs_webhook_id ON webhook_logs(webhook_id);
CREATE INDEX IF NOT EXISTS idx_webhook_logs_status ON webhook_logs(status);
CREATE INDEX IF NOT EXISTS idx_webhook_logs_attempted_at ON webhook_logs(attempted_at);
CREATE INDEX IF NOT EXISTS idx_webhook_logs_task_id ON webhook_logs(task_id);

-- Webhook retry queue
CREATE TABLE IF NOT EXISTS webhook_retry_queue (
  id TEXT PRIMARY KEY,
  log_id TEXT NOT NULL,
  webhook_id TEXT NOT NULL,
  event_data TEXT NOT NULL,
  attempt_number INTEGER NOT NULL,
  scheduled_at TEXT NOT NULL,
  FOREIGN KEY (log_id) REFERENCES webhook_logs(id) ON DELETE CASCADE,
  FOREIGN KEY (webhook_id) REFERENCES webhooks(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_webhook_retry_scheduled ON webhook_retry_queue(scheduled_at);
```

---

## WebhookService (packages/orchestrator/src/webhook-service.ts)

### Service Architecture

```typescript
import { EventEmitter } from 'eventemitter3';
import {
  WebhookSubscription,
  WebhookDeliveryLog,
  ApexEvent,
  ApexEventType,
  safeSerialize,
  truncatePayload,
} from '@apexcli/core';
import { TaskStore } from './store';
import { ApexOrchestrator } from './index';

/**
 * Configuration for WebhookService initialization
 */
export interface WebhookServiceOptions {
  /** APEX orchestrator instance */
  orchestrator: ApexOrchestrator;
  /** Task store for persistence */
  store: TaskStore;
  /** Logger interface */
  logger?: {
    info: (message: string) => void;
    warn: (message: string) => void;
    error: (message: string) => void;
    debug?: (message: string) => void;
  };
  /** Maximum concurrent HTTP requests */
  maxConcurrent?: number;
  /** Interval for processing retry queue (ms) */
  retryProcessIntervalMs?: number;
}

/**
 * Webhook payload structure sent to endpoints
 */
export interface WebhookPayload {
  /** Webhook subscription ID */
  webhookId: string;
  /** Event type that triggered the delivery */
  eventType: ApexEventType;
  /** Unique delivery ID for idempotency */
  deliveryId: string;
  /** ISO timestamp of the event */
  timestamp: string;
  /** The APEX event data */
  event: ApexEvent;
  /** APEX instance identifier */
  source: string;
}

/**
 * Events emitted by WebhookService
 */
export interface WebhookServiceEvents {
  'webhook:delivery:start': (webhookId: string, eventType: string) => void;
  'webhook:delivery:success': (log: WebhookDeliveryLog) => void;
  'webhook:delivery:failed': (log: WebhookDeliveryLog) => void;
  'webhook:delivery:retry': (log: WebhookDeliveryLog, nextAttempt: Date) => void;
}

/**
 * Service for managing webhook subscriptions and deliveries.
 *
 * Handles:
 * - Event subscription and filtering
 * - HTTP delivery with signature generation
 * - Exponential backoff retry logic
 * - Delivery logging and metrics
 */
export class WebhookService extends EventEmitter<WebhookServiceEvents> {
  private orchestrator: ApexOrchestrator;
  private store: TaskStore;
  private logger: NonNullable<WebhookServiceOptions['logger']>;
  private maxConcurrent: number;
  private activeDeliveries = 0;
  private deliveryQueue: Array<{
    webhook: WebhookSubscription;
    event: ApexEvent;
    logId: string;
  }> = [];
  private retryProcessorInterval?: NodeJS.Timeout;
  private isRunning = false;

  constructor(options: WebhookServiceOptions) {
    super();
    this.orchestrator = options.orchestrator;
    this.store = options.store;
    this.logger = options.logger ?? console;
    this.maxConcurrent = options.maxConcurrent ?? 10;
  }

  /**
   * Start the webhook service and register event listeners
   */
  async start(): Promise<void> {
    if (this.isRunning) return;
    this.isRunning = true;

    this.logger.info('Starting WebhookService...');
    this.registerOrchestratorEvents();
    this.startRetryProcessor();
    this.logger.info('WebhookService started');
  }

  /**
   * Stop the webhook service and cleanup
   */
  async stop(): Promise<void> {
    if (!this.isRunning) return;
    this.isRunning = false;

    if (this.retryProcessorInterval) {
      clearInterval(this.retryProcessorInterval);
    }
    this.logger.info('WebhookService stopped');
  }

  /**
   * Register all orchestrator event handlers
   */
  private registerOrchestratorEvents(): void {
    // Subscribe to all webhook-relevant event types
    const subscribableEvents: ApexEventType[] = [
      'task:created',
      'task:started',
      'task:completed',
      'task:failed',
      'task:paused',
      'task:stage-changed',
      'approval:required',
      'approval:granted',
      'approval:denied',
      'gate:required',
      'gate:approved',
      'gate:rejected',
      // Add more as needed
    ];

    for (const eventType of subscribableEvents) {
      this.orchestrator.on(eventType, (...args: unknown[]) => {
        void this.handleEvent(eventType, args);
      });
    }
  }

  /**
   * Handle an incoming orchestrator event
   */
  private async handleEvent(eventType: ApexEventType, args: unknown[]): Promise<void> {
    try {
      const event = this.constructApexEvent(eventType, args);
      const webhooks = await this.getMatchingWebhooks(eventType, event.taskId);

      for (const webhook of webhooks) {
        await this.queueDelivery(webhook, event);
      }
    } catch (error) {
      this.logger.error(`Error handling event ${eventType}: ${error}`);
    }
  }

  /**
   * Get webhooks that match the event and task
   */
  private async getMatchingWebhooks(
    eventType: ApexEventType,
    taskId: string
  ): Promise<WebhookSubscription[]> {
    // Query webhooks that:
    // 1. Are enabled
    // 2. Subscribe to this event type (or have empty events = all)
    // 3. Match task filters (or have empty filters = all)
    return this.store.getWebhooksForEvent(eventType, taskId);
  }

  /**
   * Queue a delivery for processing
   */
  private async queueDelivery(
    webhook: WebhookSubscription,
    event: ApexEvent
  ): Promise<void> {
    const logId = generateWebhookLogId();

    // Create pending log entry
    await this.store.createWebhookLog({
      id: logId,
      webhookId: webhook.id,
      eventType: event.type,
      taskId: event.taskId,
      status: 'pending',
      attemptNumber: 1,
      requestPayload: safeSerialize(event),
      attemptedAt: new Date(),
    });

    this.deliveryQueue.push({ webhook, event, logId });
    this.processQueue();
  }

  /**
   * Process the delivery queue with concurrency control
   */
  private async processQueue(): Promise<void> {
    while (this.deliveryQueue.length > 0 && this.activeDeliveries < this.maxConcurrent) {
      const item = this.deliveryQueue.shift();
      if (item) {
        this.activeDeliveries++;
        this.deliverWebhook(item.webhook, item.event, item.logId)
          .finally(() => {
            this.activeDeliveries--;
            this.processQueue();
          });
      }
    }
  }

  /**
   * Deliver a webhook to the endpoint
   */
  private async deliverWebhook(
    webhook: WebhookSubscription,
    event: ApexEvent,
    logId: string,
    attemptNumber = 1
  ): Promise<void> {
    const startTime = Date.now();
    const deliveryId = `${logId}-${attemptNumber}`;

    const payload: WebhookPayload = {
      webhookId: webhook.id,
      eventType: event.type,
      deliveryId,
      timestamp: new Date().toISOString(),
      event,
      source: 'apex',
    };

    const signature = webhook.secret
      ? this.generateSignature(payload, webhook.secret)
      : undefined;

    try {
      const response = await this.sendHttpRequest(webhook, payload, signature);
      const durationMs = Date.now() - startTime;

      // Update log with success
      await this.store.updateWebhookLog(logId, {
        status: 'success',
        statusCode: response.status,
        responseBody: truncateString(response.body, 10000),
        durationMs,
        attemptNumber,
      });

      this.emit('webhook:delivery:success', await this.store.getWebhookLog(logId));
    } catch (error) {
      const durationMs = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);

      const shouldRetry = attemptNumber < (webhook.retry?.maxAttempts ?? 5);

      if (shouldRetry) {
        const nextRetryAt = this.calculateNextRetry(webhook, attemptNumber);

        await this.store.updateWebhookLog(logId, {
          status: 'retrying',
          errorMessage,
          durationMs,
          attemptNumber,
          nextRetryAt,
        });

        await this.store.queueWebhookRetry({
          logId,
          webhookId: webhook.id,
          eventData: safeSerialize(event),
          attemptNumber: attemptNumber + 1,
          scheduledAt: nextRetryAt,
        });

        this.emit('webhook:delivery:retry',
          await this.store.getWebhookLog(logId),
          nextRetryAt
        );
      } else {
        await this.store.updateWebhookLog(logId, {
          status: 'failed',
          errorMessage,
          durationMs,
          attemptNumber,
        });

        this.emit('webhook:delivery:failed', await this.store.getWebhookLog(logId));
      }
    }
  }

  /**
   * Generate HMAC-SHA256 signature for webhook payload
   */
  private generateSignature(payload: WebhookPayload, secret: string): string {
    const crypto = require('crypto');
    const body = JSON.stringify(payload);
    const hmac = crypto.createHmac('sha256', secret);
    hmac.update(body);
    return `sha256=${hmac.digest('hex')}`;
  }

  /**
   * Send HTTP request to webhook endpoint
   */
  private async sendHttpRequest(
    webhook: WebhookSubscription,
    payload: WebhookPayload,
    signature?: string
  ): Promise<{ status: number; body: string }> {
    const headers: Record<string, string> = {
      'Content-Type': webhook.contentType,
      'User-Agent': 'APEX-Webhook/1.0',
      'X-Apex-Delivery': payload.deliveryId,
      'X-Apex-Event': payload.eventType,
      ...(webhook.headers ?? {}),
    };

    if (signature) {
      headers['X-Apex-Signature'] = signature;
    }

    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      webhook.timeoutMs ?? 30000
    );

    try {
      const response = await fetch(webhook.url, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      const body = await response.text();

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${body.slice(0, 500)}`);
      }

      return { status: response.status, body };
    } finally {
      clearTimeout(timeout);
    }
  }

  /**
   * Calculate next retry time with exponential backoff
   */
  private calculateNextRetry(webhook: WebhookSubscription, attemptNumber: number): Date {
    const config = webhook.retry ?? {};
    const initialDelay = config.initialDelayMs ?? 1000;
    const maxDelay = config.maxDelayMs ?? 300000;
    const multiplier = config.backoffMultiplier ?? 2;

    const delay = Math.min(
      initialDelay * Math.pow(multiplier, attemptNumber - 1),
      maxDelay
    );

    // Add jitter (10-20% random variation)
    const jitter = delay * (0.1 + Math.random() * 0.1);

    return new Date(Date.now() + delay + jitter);
  }

  /**
   * Start the retry queue processor
   */
  private startRetryProcessor(): void {
    this.retryProcessorInterval = setInterval(
      () => this.processRetryQueue(),
      5000 // Check every 5 seconds
    );
  }

  /**
   * Process pending retries
   */
  private async processRetryQueue(): Promise<void> {
    const pendingRetries = await this.store.getDueWebhookRetries();

    for (const retry of pendingRetries) {
      const webhook = await this.store.getWebhook(retry.webhookId);
      if (!webhook || !webhook.enabled) {
        await this.store.removeWebhookRetry(retry.id);
        continue;
      }

      const event = JSON.parse(retry.eventData) as ApexEvent;
      await this.deliverWebhook(webhook, event, retry.logId, retry.attemptNumber);
      await this.store.removeWebhookRetry(retry.id);
    }
  }

  // CRUD operations (delegate to store)
  async createWebhook(data: Omit<WebhookSubscription, 'id' | 'createdAt' | 'updatedAt'>): Promise<WebhookSubscription> {
    return this.store.createWebhook(data);
  }

  async updateWebhook(id: string, data: Partial<WebhookSubscription>): Promise<WebhookSubscription> {
    return this.store.updateWebhook(id, data);
  }

  async deleteWebhook(id: string): Promise<void> {
    return this.store.deleteWebhook(id);
  }

  async getWebhook(id: string): Promise<WebhookSubscription | null> {
    return this.store.getWebhook(id);
  }

  async listWebhooks(): Promise<WebhookSubscription[]> {
    return this.store.listWebhooks();
  }

  async getWebhookLogs(webhookId: string, options?: {
    limit?: number;
    offset?: number;
    status?: string;
  }): Promise<WebhookDeliveryLog[]> {
    return this.store.getWebhookLogs(webhookId, options);
  }
}
```

---

## REST API Endpoints (packages/api/src/index.ts)

### Webhook Management Endpoints

```typescript
// GET /webhooks - List all webhooks
app.get('/webhooks', async (request, reply) => {
  const webhooks = await webhookService.listWebhooks();
  return reply.send({ webhooks });
});

// GET /webhooks/:id - Get webhook details
app.get<{ Params: { id: string } }>('/webhooks/:id', async (request, reply) => {
  const webhook = await webhookService.getWebhook(request.params.id);
  if (!webhook) {
    return reply.status(404).send({ error: 'Webhook not found' });
  }
  return reply.send({ webhook });
});

// POST /webhooks - Create webhook
app.post<{ Body: CreateWebhookRequest }>('/webhooks', async (request, reply) => {
  const webhook = await webhookService.createWebhook(request.body);
  return reply.status(201).send({ webhook });
});

// PUT /webhooks/:id - Update webhook
app.put<{ Params: { id: string }; Body: UpdateWebhookRequest }>(
  '/webhooks/:id',
  async (request, reply) => {
    const webhook = await webhookService.updateWebhook(
      request.params.id,
      request.body
    );
    return reply.send({ webhook });
  }
);

// DELETE /webhooks/:id - Delete webhook
app.delete<{ Params: { id: string } }>('/webhooks/:id', async (request, reply) => {
  await webhookService.deleteWebhook(request.params.id);
  return reply.status(204).send();
});

// POST /webhooks/:id/test - Send test delivery
app.post<{ Params: { id: string } }>('/webhooks/:id/test', async (request, reply) => {
  const result = await webhookService.sendTestDelivery(request.params.id);
  return reply.send({ result });
});

// GET /webhooks/:id/logs - Get delivery logs
app.get<{
  Params: { id: string };
  Querystring: { limit?: number; offset?: number; status?: string };
}>('/webhooks/:id/logs', async (request, reply) => {
  const logs = await webhookService.getWebhookLogs(request.params.id, {
    limit: request.query.limit ?? 50,
    offset: request.query.offset ?? 0,
    status: request.query.status,
  });
  return reply.send({ logs });
});

// POST /webhooks/:id/logs/:logId/retry - Manual retry
app.post<{ Params: { id: string; logId: string } }>(
  '/webhooks/:id/logs/:logId/retry',
  async (request, reply) => {
    await webhookService.manualRetry(request.params.logId);
    return reply.status(202).send({ message: 'Retry queued' });
  }
);
```

---

## Web UI Components (packages/web-ui/src/components/webhooks/)

### Component Structure

```
packages/web-ui/src/
├── components/
│   └── webhooks/
│       ├── WebhookManager.tsx          # Main management page
│       ├── WebhookList.tsx             # List of webhooks
│       ├── WebhookCard.tsx             # Individual webhook card
│       ├── WebhookForm.tsx             # Create/Edit form
│       ├── WebhookEventSelector.tsx    # Multi-select for events
│       ├── WebhookLogViewer.tsx        # Delivery logs table
│       ├── WebhookLogDetail.tsx        # Expanded log detail
│       ├── WebhookTestButton.tsx       # Test delivery trigger
│       ├── index.ts
│       └── __tests__/
│           ├── WebhookManager.test.tsx
│           ├── WebhookForm.test.tsx
│           ├── WebhookLogViewer.test.tsx
│           └── WebhookManager.integration.test.tsx
├── hooks/
│   └── useWebhooks.ts                   # Data fetching hook
└── types/
    └── webhooks.ts                      # Frontend type definitions
```

### WebhookManager Component

```tsx
/**
 * Main webhook management component
 * Provides CRUD interface for webhook subscriptions
 */
export function WebhookManager() {
  const { webhooks, isLoading, createWebhook, updateWebhook, deleteWebhook, error } = useWebhooks();
  const [selectedWebhook, setSelectedWebhook] = useState<string | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold">Webhooks</h2>
        <Button onClick={() => setIsFormOpen(true)}>
          <PlusIcon className="w-4 h-4 mr-2" />
          Add Webhook
        </Button>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error.message}</AlertDescription>
        </Alert>
      )}

      <WebhookList
        webhooks={webhooks}
        isLoading={isLoading}
        onSelect={setSelectedWebhook}
        onDelete={deleteWebhook}
        onToggle={(id, enabled) => updateWebhook(id, { enabled })}
      />

      {selectedWebhook && (
        <WebhookLogViewer webhookId={selectedWebhook} />
      )}

      <WebhookForm
        open={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        onSubmit={createWebhook}
      />
    </div>
  );
}
```

### WebhookForm Component

```tsx
/**
 * Form for creating/editing webhook subscriptions
 */
export function WebhookForm({
  webhook,
  open,
  onClose,
  onSubmit,
}: WebhookFormProps) {
  const [formData, setFormData] = useState<WebhookFormData>(
    webhook ?? defaultFormData
  );

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {webhook ? 'Edit Webhook' : 'Create Webhook'}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <FormField label="Name" required>
            <Input
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="My Integration"
            />
          </FormField>

          <FormField label="URL" required>
            <Input
              type="url"
              value={formData.url}
              onChange={(e) => setFormData({ ...formData, url: e.target.value })}
              placeholder="https://example.com/webhook"
            />
          </FormField>

          <FormField label="Secret" description="Used for HMAC-SHA256 signature">
            <Input
              type="password"
              value={formData.secret}
              onChange={(e) => setFormData({ ...formData, secret: e.target.value })}
              placeholder="Enter secret or leave empty"
            />
          </FormField>

          <FormField label="Events">
            <WebhookEventSelector
              selected={formData.events}
              onChange={(events) => setFormData({ ...formData, events })}
            />
          </FormField>

          <Accordion type="single" collapsible>
            <AccordionItem value="advanced">
              <AccordionTrigger>Advanced Settings</AccordionTrigger>
              <AccordionContent className="space-y-4">
                <FormField label="Custom Headers">
                  <KeyValueEditor
                    value={formData.headers}
                    onChange={(headers) => setFormData({ ...formData, headers })}
                  />
                </FormField>

                <FormField label="Retry Settings">
                  <div className="grid grid-cols-2 gap-4">
                    <Input
                      type="number"
                      label="Max Attempts"
                      value={formData.retry.maxAttempts}
                      onChange={...}
                    />
                    <Input
                      type="number"
                      label="Initial Delay (ms)"
                      value={formData.retry.initialDelayMs}
                      onChange={...}
                    />
                  </div>
                </FormField>

                <FormField label="Timeout (ms)">
                  <Input
                    type="number"
                    value={formData.timeoutMs}
                    onChange={(e) => setFormData({ ...formData, timeoutMs: parseInt(e.target.value) })}
                  />
                </FormField>
              </AccordionContent>
            </AccordionItem>
          </Accordion>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit">
              {webhook ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
```

### WebhookLogViewer Component

```tsx
/**
 * Table displaying webhook delivery logs with filtering
 */
export function WebhookLogViewer({ webhookId }: { webhookId: string }) {
  const { logs, isLoading, pagination, retry } = useWebhookLogs(webhookId);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [expandedLog, setExpandedLog] = useState<string | null>(null);

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
          <CardTitle>Delivery Logs</CardTitle>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-32">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="success">Success</SelectItem>
              <SelectItem value="failed">Failed</SelectItem>
              <SelectItem value="retrying">Retrying</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>

      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Event</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Duration</TableHead>
              <TableHead>Attempts</TableHead>
              <TableHead>Time</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {logs.map((log) => (
              <React.Fragment key={log.id}>
                <TableRow
                  className="cursor-pointer"
                  onClick={() => setExpandedLog(expandedLog === log.id ? null : log.id)}
                >
                  <TableCell>
                    <Badge variant="outline">{log.eventType}</Badge>
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={log.status} />
                  </TableCell>
                  <TableCell>{log.durationMs}ms</TableCell>
                  <TableCell>{log.attemptNumber}</TableCell>
                  <TableCell>
                    <time>{formatRelative(log.attemptedAt)}</time>
                  </TableCell>
                  <TableCell>
                    {log.status === 'failed' && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={(e) => {
                          e.stopPropagation();
                          retry(log.id);
                        }}
                      >
                        Retry
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
                {expandedLog === log.id && (
                  <TableRow>
                    <TableCell colSpan={6}>
                      <WebhookLogDetail log={log} />
                    </TableCell>
                  </TableRow>
                )}
              </React.Fragment>
            ))}
          </TableBody>
        </Table>

        <Pagination {...pagination} />
      </CardContent>
    </Card>
  );
}
```

---

## Implementation Plan

### Phase 1: Core Types & Database (Week 1)
1. Add webhook schemas to `packages/core/src/types.ts`
2. Create database migration in `packages/orchestrator/src/store.ts`
3. Add store methods for webhook CRUD operations
4. Add unit tests for type validation and store operations

### Phase 2: WebhookService (Week 1-2)
1. Create `packages/orchestrator/src/webhook-service.ts`
2. Implement event subscription system
3. Implement HTTP delivery with signature generation
4. Implement exponential backoff retry logic
5. Integrate with orchestrator startup/shutdown
6. Add unit and integration tests

### Phase 3: REST API (Week 2)
1. Add webhook endpoints to `packages/api/src/index.ts`
2. Add request validation schemas
3. Add test delivery endpoint
4. Add integration tests

### Phase 4: Web UI (Week 2-3)
1. Create component structure in `packages/web-ui/src/components/webhooks/`
2. Implement `useWebhooks` hook
3. Implement WebhookManager, WebhookList, WebhookCard
4. Implement WebhookForm with event selector
5. Implement WebhookLogViewer with expandable details
6. Add unit and integration tests
7. Add to navigation/routing

### Phase 5: Testing & Documentation (Week 3)
1. End-to-end testing with real webhook endpoints
2. Performance testing for high-volume events
3. Security review (URL validation, SSRF prevention)
4. Documentation updates

---

## Security Considerations

### SSRF Prevention
```typescript
function validateWebhookUrl(url: string, config: WebhookConfig): boolean {
  const parsed = new URL(url);

  // Require HTTPS in production
  if (config.requireHttps && parsed.protocol !== 'https:') {
    throw new Error('Webhook URL must use HTTPS');
  }

  // Block localhost unless explicitly allowed
  if (!config.allowLocalhost) {
    const hostname = parsed.hostname.toLowerCase();
    const blockedHosts = ['localhost', '127.0.0.1', '::1', '0.0.0.0'];
    if (blockedHosts.includes(hostname) || hostname.endsWith('.local')) {
      throw new Error('Localhost URLs are not allowed');
    }
  }

  // Block internal IP ranges
  const ip = dns.lookupSync(parsed.hostname);
  if (isPrivateIp(ip)) {
    throw new Error('Internal IP addresses are not allowed');
  }

  return true;
}
```

### Secret Management
- Secrets are stored hashed in the database (bcrypt)
- Raw secrets are only used for signature generation at delivery time
- Secrets are never included in API responses
- Minimum secret length enforced (16 characters)

### Rate Limiting
- Maximum concurrent deliveries per instance
- Per-webhook rate limiting to prevent abuse
- Global rate limiting for outbound requests

---

## Consequences

### Positive
- Enables unlimited custom integrations beyond Slack/Teams
- Event-driven architecture aligns with existing patterns
- Comprehensive retry logic ensures delivery reliability
- Full audit trail with searchable logs
- Standard webhook patterns (HMAC signatures, idempotency keys)

### Negative
- Adds storage overhead for logs (mitigated by retention policy)
- Increases complexity in orchestrator service
- Requires careful SSRF protection

### Risks
- Webhook endpoints may be slow/unreliable (mitigated by timeouts and retries)
- High event volume could overwhelm the queue (mitigated by concurrency limits)
- Secret rotation requires webhook update (accepted trade-off)

---

## Alternatives Considered

### 1. Use External Webhook Service (e.g., Svix, Hookdeck)
**Rejected**: Adds external dependency, increases latency, additional cost. APEX is self-contained.

### 2. Push-only without Retries
**Rejected**: Delivery reliability is critical for integrations. Retries are table stakes.

### 3. Database-backed Queue Only (No In-Memory)
**Rejected**: Adds latency for high-frequency events. Hybrid approach provides better performance.

### 4. GraphQL Subscriptions Instead
**Rejected**: Webhooks are more widely supported, don't require persistent client connections.

---

## References

- Existing integration: `packages/api/src/services/slack-service.ts`
- Event system: `packages/orchestrator/src/index.ts` (EventEmitter3)
- Store patterns: `packages/orchestrator/src/store.ts`
- UI patterns: `packages/web-ui/src/components/dashboard/`
- Similar ADRs: `docs/adr/ADR-0002-websocket-connection-indicator-architecture.md`
