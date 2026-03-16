/**
 * Comprehensive tests for webhook store operations and database schema
 * Tests webhook database operations, schema validation, and data integrity
 */
import { describe, it, expect, beforeEach, afterEach, beforeAll } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import Database from 'better-sqlite3';
import { TaskStore } from '../store';
import type {
  WebhookSubscription,
  WebhookDeliveryLog,
} from '@apexcli/core';

describe('Webhook Store Operations', () => {
  let testDir: string;
  let store: TaskStore;
  let dbPath: string;
  let db: Database.Database;

  // Test fixtures
  const createWebhookSubscription = (overrides: Partial<WebhookSubscription> = {}): WebhookSubscription => ({
    id: `webhook_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    name: 'Test Webhook',
    url: 'https://api.example.com/webhook',
    secret: 'test-secret-key-16-chars',
    enabled: true,
    events: ['task:completed', 'task:failed'],
    taskFilters: [],
    workflowFilters: [],
    headers: {
      'Content-Type': 'application/json',
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
    createdAt: new Date('2024-01-15T10:00:00Z'),
    updatedAt: new Date('2024-01-15T10:00:00Z'),
    description: 'Test webhook for integration testing',
    tags: ['test', 'integration'],
    ...overrides,
  });

  const createWebhookDeliveryLog = (webhookId: string, overrides: Partial<WebhookDeliveryLog> = {}): WebhookDeliveryLog => ({
    id: `log_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    webhookId,
    eventType: 'task:completed',
    taskId: `task_${Date.now()}`,
    statusCode: 200,
    status: 'success',
    attemptNumber: 1,
    requestPayload: JSON.stringify({ event: 'task:completed', data: { taskId: 'test-task' } }),
    responseBody: JSON.stringify({ success: true }),
    errorMessage: undefined,
    durationMs: 250,
    attemptedAt: new Date('2024-01-15T12:00:00Z'),
    nextRetryAt: undefined,
    resolvedIp: '192.168.1.100',
    ...overrides,
  });

  beforeAll(() => {
    expect(Database).toBeDefined();
    expect(typeof Database).toBe('function');
  });

  beforeEach(async () => {
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'webhook-store-test-'));
    dbPath = path.join(testDir, '.apex', 'store.db');
    store = new TaskStore(testDir);
    await store.initialize();

    // Get direct database access for schema testing
    db = Database(dbPath);
  });

  afterEach(async () => {
    if (db) {
      db.close();
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

  describe('Database Schema Validation', () => {
    it('should create webhooks table with correct schema', () => {
      const schema = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='webhooks'").get();
      expect(schema).toBeDefined();
      expect(schema.sql).toContain('id TEXT PRIMARY KEY');
      expect(schema.sql).toContain('name TEXT NOT NULL');
      expect(schema.sql).toContain('url TEXT NOT NULL');
      expect(schema.sql).toContain('secret TEXT');
      expect(schema.sql).toContain('enabled INTEGER DEFAULT 1');
      expect(schema.sql).toContain('events TEXT NOT NULL DEFAULT \'[]\'');
      expect(schema.sql).toContain('task_filters TEXT DEFAULT \'[]\'');
      expect(schema.sql).toContain('workflow_filters TEXT DEFAULT \'[]\'');
      expect(schema.sql).toContain('headers TEXT DEFAULT \'{}\'');
      expect(schema.sql).toContain('retry_config TEXT DEFAULT \'{}\'');
      expect(schema.sql).toContain('timeout_ms INTEGER DEFAULT 30000');
      expect(schema.sql).toContain('content_type TEXT DEFAULT \'application/json\'');
      expect(schema.sql).toContain('description TEXT');
      expect(schema.sql).toContain('tags TEXT DEFAULT \'[]\'');
      expect(schema.sql).toContain('created_at TEXT NOT NULL');
      expect(schema.sql).toContain('updated_at TEXT NOT NULL');
    });

    it('should create webhook_events table with correct schema', () => {
      const schema = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='webhook_events'").get();
      expect(schema).toBeDefined();
      expect(schema.sql).toContain('webhook_id TEXT NOT NULL');
      expect(schema.sql).toContain('event_type TEXT NOT NULL');
      expect(schema.sql).toContain('PRIMARY KEY (webhook_id, event_type)');
      expect(schema.sql).toContain('FOREIGN KEY (webhook_id) REFERENCES webhooks(id) ON DELETE CASCADE');
    });

    it('should create webhook_logs table with correct schema', () => {
      const schema = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='webhook_logs'").get();
      expect(schema).toBeDefined();
      expect(schema.sql).toContain('id TEXT PRIMARY KEY');
      expect(schema.sql).toContain('webhook_id TEXT NOT NULL');
      expect(schema.sql).toContain('event_type TEXT NOT NULL');
      expect(schema.sql).toContain('task_id TEXT NOT NULL');
      expect(schema.sql).toContain('status_code INTEGER');
      expect(schema.sql).toContain('status TEXT NOT NULL CHECK (status IN (\'pending\', \'success\', \'failed\', \'retrying\'))');
      expect(schema.sql).toContain('attempt_number INTEGER DEFAULT 1');
      expect(schema.sql).toContain('FOREIGN KEY (webhook_id) REFERENCES webhooks(id) ON DELETE CASCADE');
    });

    it('should create webhook_retry_queue table with correct schema', () => {
      const schema = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='webhook_retry_queue'").get();
      expect(schema).toBeDefined();
      expect(schema.sql).toContain('id TEXT PRIMARY KEY');
      expect(schema.sql).toContain('log_id TEXT NOT NULL');
      expect(schema.sql).toContain('webhook_id TEXT NOT NULL');
      expect(schema.sql).toContain('event_data TEXT NOT NULL');
      expect(schema.sql).toContain('attempt_number INTEGER NOT NULL');
      expect(schema.sql).toContain('scheduled_at TEXT NOT NULL');
      expect(schema.sql).toContain('FOREIGN KEY (log_id) REFERENCES webhook_logs(id) ON DELETE CASCADE');
      expect(schema.sql).toContain('FOREIGN KEY (webhook_id) REFERENCES webhooks(id) ON DELETE CASCADE');
    });

    it('should create all required indexes', () => {
      const indexes = db.prepare("SELECT name FROM sqlite_master WHERE type='index' AND name LIKE 'idx_webhook%'").all();
      const indexNames = indexes.map((idx: any) => idx.name);

      expect(indexNames).toContain('idx_webhooks_enabled');
      expect(indexNames).toContain('idx_webhooks_created_at');
      expect(indexNames).toContain('idx_webhook_events_type');
      expect(indexNames).toContain('idx_webhook_logs_webhook_id');
      expect(indexNames).toContain('idx_webhook_logs_status');
      expect(indexNames).toContain('idx_webhook_logs_attempted_at');
      expect(indexNames).toContain('idx_webhook_logs_task_id');
      expect(indexNames).toContain('idx_webhook_retry_scheduled');
    });
  });

  describe('Raw Database Operations for Webhooks', () => {
    it('should insert webhook subscription with JSON serialization', () => {
      const webhook = createWebhookSubscription();

      const insertStmt = db.prepare(`
        INSERT INTO webhooks (
          id, name, url, secret, enabled, events, task_filters, workflow_filters,
          headers, retry_config, timeout_ms, content_type, description, tags,
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      const result = insertStmt.run(
        webhook.id,
        webhook.name,
        webhook.url,
        webhook.secret,
        webhook.enabled ? 1 : 0,
        JSON.stringify(webhook.events),
        JSON.stringify(webhook.taskFilters),
        JSON.stringify(webhook.workflowFilters),
        JSON.stringify(webhook.headers),
        JSON.stringify(webhook.retry),
        webhook.timeoutMs,
        webhook.contentType,
        webhook.description,
        JSON.stringify(webhook.tags),
        webhook.createdAt.toISOString(),
        webhook.updatedAt.toISOString()
      );

      expect(result.changes).toBe(1);
      expect(result.lastInsertRowid).toBeDefined();
    });

    it('should retrieve webhook subscription with JSON deserialization', () => {
      const webhook = createWebhookSubscription();

      // Insert webhook
      const insertStmt = db.prepare(`
        INSERT INTO webhooks (
          id, name, url, secret, enabled, events, task_filters, workflow_filters,
          headers, retry_config, timeout_ms, content_type, description, tags,
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      insertStmt.run(
        webhook.id,
        webhook.name,
        webhook.url,
        webhook.secret,
        webhook.enabled ? 1 : 0,
        JSON.stringify(webhook.events),
        JSON.stringify(webhook.taskFilters),
        JSON.stringify(webhook.workflowFilters),
        JSON.stringify(webhook.headers),
        JSON.stringify(webhook.retry),
        webhook.timeoutMs,
        webhook.contentType,
        webhook.description,
        JSON.stringify(webhook.tags),
        webhook.createdAt.toISOString(),
        webhook.updatedAt.toISOString()
      );

      // Retrieve webhook
      const selectStmt = db.prepare('SELECT * FROM webhooks WHERE id = ?');
      const retrieved = selectStmt.get(webhook.id);

      expect(retrieved).toBeDefined();
      expect(retrieved.id).toBe(webhook.id);
      expect(retrieved.name).toBe(webhook.name);
      expect(retrieved.url).toBe(webhook.url);
      expect(retrieved.enabled).toBe(1);
      expect(JSON.parse(retrieved.events)).toEqual(webhook.events);
      expect(JSON.parse(retrieved.headers)).toEqual(webhook.headers);
      expect(JSON.parse(retrieved.retry_config)).toEqual(webhook.retry);
      expect(JSON.parse(retrieved.tags)).toEqual(webhook.tags);
    });

    it('should handle webhook events normalization table', () => {
      const webhook = createWebhookSubscription({
        events: ['task:completed', 'task:failed', 'approval:required'],
      });

      // Insert webhook first
      const insertWebhookStmt = db.prepare(`
        INSERT INTO webhooks (
          id, name, url, enabled, events, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `);

      insertWebhookStmt.run(
        webhook.id,
        webhook.name,
        webhook.url,
        1,
        JSON.stringify(webhook.events),
        webhook.createdAt.toISOString(),
        webhook.updatedAt.toISOString()
      );

      // Insert webhook events
      const insertEventStmt = db.prepare('INSERT INTO webhook_events (webhook_id, event_type) VALUES (?, ?)');

      webhook.events?.forEach(eventType => {
        insertEventStmt.run(webhook.id, eventType);
      });

      // Verify events are stored correctly
      const selectEventsStmt = db.prepare('SELECT event_type FROM webhook_events WHERE webhook_id = ? ORDER BY event_type');
      const events = selectEventsStmt.all(webhook.id);

      expect(events).toHaveLength(3);
      expect(events.map((e: any) => e.event_type)).toEqual([
        'approval:required',
        'task:completed',
        'task:failed',
      ]);
    });

    it('should insert webhook delivery log', () => {
      const webhookId = 'test-webhook-id';
      const log = createWebhookDeliveryLog(webhookId);

      // Insert webhook first
      const insertWebhookStmt = db.prepare(`
        INSERT INTO webhooks (id, name, url, enabled, events, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);

      insertWebhookStmt.run(
        webhookId,
        'Test Webhook',
        'https://api.example.com/webhook',
        1,
        '[]',
        new Date().toISOString(),
        new Date().toISOString()
      );

      // Insert delivery log
      const insertLogStmt = db.prepare(`
        INSERT INTO webhook_logs (
          id, webhook_id, event_type, task_id, status_code, status,
          attempt_number, request_payload, response_body, error_message,
          duration_ms, attempted_at, next_retry_at, resolved_ip
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      const result = insertLogStmt.run(
        log.id,
        log.webhookId,
        log.eventType,
        log.taskId,
        log.statusCode,
        log.status,
        log.attemptNumber,
        log.requestPayload,
        log.responseBody,
        log.errorMessage,
        log.durationMs,
        log.attemptedAt.toISOString(),
        log.nextRetryAt?.toISOString(),
        log.resolvedIp
      );

      expect(result.changes).toBe(1);

      // Verify log was inserted correctly
      const selectStmt = db.prepare('SELECT * FROM webhook_logs WHERE id = ?');
      const retrieved = selectStmt.get(log.id);

      expect(retrieved).toBeDefined();
      expect(retrieved.webhook_id).toBe(webhookId);
      expect(retrieved.event_type).toBe(log.eventType);
      expect(retrieved.task_id).toBe(log.taskId);
      expect(retrieved.status_code).toBe(log.statusCode);
      expect(retrieved.status).toBe(log.status);
      expect(retrieved.attempt_number).toBe(log.attemptNumber);
    });

    it('should handle webhook retry queue', () => {
      const webhookId = 'test-webhook-id';
      const log = createWebhookDeliveryLog(webhookId);

      // Insert webhook
      const insertWebhookStmt = db.prepare(`
        INSERT INTO webhooks (id, name, url, enabled, events, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);

      insertWebhookStmt.run(
        webhookId,
        'Test Webhook',
        'https://api.example.com/webhook',
        1,
        '[]',
        new Date().toISOString(),
        new Date().toISOString()
      );

      // Insert delivery log
      const insertLogStmt = db.prepare(`
        INSERT INTO webhook_logs (
          id, webhook_id, event_type, task_id, status, attempted_at
        ) VALUES (?, ?, ?, ?, ?, ?)
      `);

      insertLogStmt.run(
        log.id,
        log.webhookId,
        log.eventType,
        log.taskId,
        'failed',
        log.attemptedAt.toISOString()
      );

      // Insert retry queue entry
      const retryId = 'retry-123';
      const eventData = JSON.stringify({ type: 'task:completed', taskId: 'test-task' });
      const scheduledAt = new Date(Date.now() + 60000); // 1 minute from now

      const insertRetryStmt = db.prepare(`
        INSERT INTO webhook_retry_queue (
          id, log_id, webhook_id, event_data, attempt_number, scheduled_at
        ) VALUES (?, ?, ?, ?, ?, ?)
      `);

      const result = insertRetryStmt.run(
        retryId,
        log.id,
        webhookId,
        eventData,
        2,
        scheduledAt.toISOString()
      );

      expect(result.changes).toBe(1);

      // Verify retry entry
      const selectRetryStmt = db.prepare('SELECT * FROM webhook_retry_queue WHERE id = ?');
      const retry = selectRetryStmt.get(retryId);

      expect(retry).toBeDefined();
      expect(retry.log_id).toBe(log.id);
      expect(retry.webhook_id).toBe(webhookId);
      expect(retry.event_data).toBe(eventData);
      expect(retry.attempt_number).toBe(2);
    });
  });

  describe('Data Integrity and Constraints', () => {
    it('should enforce foreign key constraints between webhooks and webhook_events', () => {
      const nonExistentWebhookId = 'non-existent-webhook';

      const insertEventStmt = db.prepare('INSERT INTO webhook_events (webhook_id, event_type) VALUES (?, ?)');

      expect(() => {
        insertEventStmt.run(nonExistentWebhookId, 'task:completed');
      }).toThrow(); // Should throw foreign key constraint error
    });

    it('should enforce foreign key constraints between webhooks and webhook_logs', () => {
      const nonExistentWebhookId = 'non-existent-webhook';
      const log = createWebhookDeliveryLog(nonExistentWebhookId);

      const insertLogStmt = db.prepare(`
        INSERT INTO webhook_logs (
          id, webhook_id, event_type, task_id, status, attempted_at
        ) VALUES (?, ?, ?, ?, ?, ?)
      `);

      expect(() => {
        insertLogStmt.run(
          log.id,
          nonExistentWebhookId,
          log.eventType,
          log.taskId,
          log.status,
          log.attemptedAt.toISOString()
        );
      }).toThrow(); // Should throw foreign key constraint error
    });

    it('should enforce status check constraint on webhook_logs', () => {
      const webhookId = 'test-webhook-id';

      // Insert webhook first
      const insertWebhookStmt = db.prepare(`
        INSERT INTO webhooks (id, name, url, enabled, events, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);

      insertWebhookStmt.run(
        webhookId,
        'Test Webhook',
        'https://api.example.com/webhook',
        1,
        '[]',
        new Date().toISOString(),
        new Date().toISOString()
      );

      const insertLogStmt = db.prepare(`
        INSERT INTO webhook_logs (
          id, webhook_id, event_type, task_id, status, attempted_at
        ) VALUES (?, ?, ?, ?, ?, ?)
      `);

      // Valid status should work
      expect(() => {
        insertLogStmt.run(
          'log-1',
          webhookId,
          'task:completed',
          'task-1',
          'success',
          new Date().toISOString()
        );
      }).not.toThrow();

      // Invalid status should fail
      expect(() => {
        insertLogStmt.run(
          'log-2',
          webhookId,
          'task:completed',
          'task-2',
          'invalid-status',
          new Date().toISOString()
        );
      }).toThrow(); // Should throw check constraint error
    });

    it('should handle cascade deletion from webhooks to webhook_events', () => {
      const webhookId = 'test-webhook-cascade';

      // Insert webhook
      const insertWebhookStmt = db.prepare(`
        INSERT INTO webhooks (id, name, url, enabled, events, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);

      insertWebhookStmt.run(
        webhookId,
        'Test Webhook',
        'https://api.example.com/webhook',
        1,
        '[]',
        new Date().toISOString(),
        new Date().toISOString()
      );

      // Insert webhook events
      const insertEventStmt = db.prepare('INSERT INTO webhook_events (webhook_id, event_type) VALUES (?, ?)');
      insertEventStmt.run(webhookId, 'task:completed');
      insertEventStmt.run(webhookId, 'task:failed');

      // Verify events exist
      const countEventsStmt = db.prepare('SELECT COUNT(*) as count FROM webhook_events WHERE webhook_id = ?');
      expect(countEventsStmt.get(webhookId).count).toBe(2);

      // Delete webhook
      const deleteWebhookStmt = db.prepare('DELETE FROM webhooks WHERE id = ?');
      deleteWebhookStmt.run(webhookId);

      // Verify events were cascade deleted
      expect(countEventsStmt.get(webhookId).count).toBe(0);
    });

    it('should handle cascade deletion from webhooks to webhook_logs', () => {
      const webhookId = 'test-webhook-cascade-logs';

      // Insert webhook
      const insertWebhookStmt = db.prepare(`
        INSERT INTO webhooks (id, name, url, enabled, events, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);

      insertWebhookStmt.run(
        webhookId,
        'Test Webhook',
        'https://api.example.com/webhook',
        1,
        '[]',
        new Date().toISOString(),
        new Date().toISOString()
      );

      // Insert webhook logs
      const insertLogStmt = db.prepare(`
        INSERT INTO webhook_logs (
          id, webhook_id, event_type, task_id, status, attempted_at
        ) VALUES (?, ?, ?, ?, ?, ?)
      `);

      insertLogStmt.run('log-1', webhookId, 'task:completed', 'task-1', 'success', new Date().toISOString());
      insertLogStmt.run('log-2', webhookId, 'task:failed', 'task-2', 'failed', new Date().toISOString());

      // Verify logs exist
      const countLogsStmt = db.prepare('SELECT COUNT(*) as count FROM webhook_logs WHERE webhook_id = ?');
      expect(countLogsStmt.get(webhookId).count).toBe(2);

      // Delete webhook
      const deleteWebhookStmt = db.prepare('DELETE FROM webhooks WHERE id = ?');
      deleteWebhookStmt.run(webhookId);

      // Verify logs were cascade deleted
      expect(countLogsStmt.get(webhookId).count).toBe(0);
    });
  });

  describe('Index Performance and Query Optimization', () => {
    beforeEach(async () => {
      // Insert test data for performance testing
      const webhookId = 'performance-test-webhook';

      // Insert webhook
      const insertWebhookStmt = db.prepare(`
        INSERT INTO webhooks (id, name, url, enabled, events, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);

      insertWebhookStmt.run(
        webhookId,
        'Performance Test Webhook',
        'https://api.example.com/webhook',
        1,
        '["task:completed", "task:failed"]',
        new Date().toISOString(),
        new Date().toISOString()
      );

      // Insert multiple logs for performance testing
      const insertLogStmt = db.prepare(`
        INSERT INTO webhook_logs (
          id, webhook_id, event_type, task_id, status, attempted_at
        ) VALUES (?, ?, ?, ?, ?, ?)
      `);

      for (let i = 0; i < 100; i++) {
        insertLogStmt.run(
          `log-${i}`,
          webhookId,
          i % 2 === 0 ? 'task:completed' : 'task:failed',
          `task-${i}`,
          i % 3 === 0 ? 'success' : 'failed',
          new Date(Date.now() - i * 1000).toISOString()
        );
      }
    });

    it('should use index for webhook status queries', () => {
      const explain = db.prepare('EXPLAIN QUERY PLAN SELECT * FROM webhooks WHERE enabled = 1').all();
      const planText = explain.map((step: any) => step.detail).join(' ');

      // Should use the index
      expect(planText).toContain('idx_webhooks_enabled');
    });

    it('should use index for webhook logs by webhook_id', () => {
      const explain = db.prepare('EXPLAIN QUERY PLAN SELECT * FROM webhook_logs WHERE webhook_id = ?').all();
      const planText = explain.map((step: any) => step.detail).join(' ');

      // Should use the index
      expect(planText).toContain('idx_webhook_logs_webhook_id');
    });

    it('should use index for webhook logs by status', () => {
      const explain = db.prepare('EXPLAIN QUERY PLAN SELECT * FROM webhook_logs WHERE status = ?').all();
      const planText = explain.map((step: any) => step.detail).join(' ');

      // Should use the index
      expect(planText).toContain('idx_webhook_logs_status');
    });

    it('should use index for webhook logs by attempted_at (time range queries)', () => {
      const explain = db.prepare('EXPLAIN QUERY PLAN SELECT * FROM webhook_logs WHERE attempted_at > ? ORDER BY attempted_at').all();
      const planText = explain.map((step: any) => step.detail).join(' ');

      // Should use the index
      expect(planText).toContain('idx_webhook_logs_attempted_at');
    });

    it('should efficiently query webhook events by event type', () => {
      const explain = db.prepare('EXPLAIN QUERY PLAN SELECT webhook_id FROM webhook_events WHERE event_type = ?').all();
      const planText = explain.map((step: any) => step.detail).join(' ');

      // Should use the index
      expect(planText).toContain('idx_webhook_events_type');
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle very long URLs', () => {
      const longUrl = 'https://api.example.com/' + 'a'.repeat(2000);
      const webhook = createWebhookSubscription({ url: longUrl });

      const insertStmt = db.prepare(`
        INSERT INTO webhooks (id, name, url, enabled, events, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);

      expect(() => {
        insertStmt.run(
          webhook.id,
          webhook.name,
          longUrl,
          1,
          '[]',
          webhook.createdAt.toISOString(),
          webhook.updatedAt.toISOString()
        );
      }).not.toThrow();
    });

    it('should handle large response bodies (up to 10KB limit)', () => {
      const webhookId = 'test-webhook-large-response';
      const largeResponse = 'A'.repeat(10000); // Exactly 10KB

      // Insert webhook first
      const insertWebhookStmt = db.prepare(`
        INSERT INTO webhooks (id, name, url, enabled, events, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);

      insertWebhookStmt.run(
        webhookId,
        'Test Webhook',
        'https://api.example.com/webhook',
        1,
        '[]',
        new Date().toISOString(),
        new Date().toISOString()
      );

      const insertLogStmt = db.prepare(`
        INSERT INTO webhook_logs (
          id, webhook_id, event_type, task_id, status, response_body, attempted_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `);

      expect(() => {
        insertLogStmt.run(
          'log-large-response',
          webhookId,
          'task:completed',
          'task-1',
          'success',
          largeResponse,
          new Date().toISOString()
        );
      }).not.toThrow();

      // Verify data was stored correctly
      const selectStmt = db.prepare('SELECT response_body FROM webhook_logs WHERE id = ?');
      const retrieved = selectStmt.get('log-large-response');
      expect(retrieved.response_body).toBe(largeResponse);
    });

    it('should handle null values correctly', () => {
      const webhookId = 'test-webhook-nulls';

      // Insert webhook first
      const insertWebhookStmt = db.prepare(`
        INSERT INTO webhooks (id, name, url, enabled, events, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);

      insertWebhookStmt.run(
        webhookId,
        'Test Webhook',
        'https://api.example.com/webhook',
        1,
        '[]',
        new Date().toISOString(),
        new Date().toISOString()
      );

      const insertLogStmt = db.prepare(`
        INSERT INTO webhook_logs (
          id, webhook_id, event_type, task_id, status, status_code,
          error_message, duration_ms, next_retry_at, resolved_ip, attempted_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      expect(() => {
        insertLogStmt.run(
          'log-with-nulls',
          webhookId,
          'task:completed',
          'task-1',
          'failed',
          null, // status_code can be null
          null, // error_message can be null
          null, // duration_ms can be null
          null, // next_retry_at can be null
          null, // resolved_ip can be null
          new Date().toISOString()
        );
      }).not.toThrow();
    });

    it('should handle special characters in JSON fields', () => {
      const webhook = createWebhookSubscription({
        headers: {
          'Authorization': 'Bearer token-with-"quotes"',
          'Custom-Header': 'value with \' apostrophes and \n newlines',
        },
        tags: ['tag with spaces', 'tag-with-"quotes"', 'tag\'with\'apostrophes'],
      });

      const insertStmt = db.prepare(`
        INSERT INTO webhooks (
          id, name, url, enabled, events, headers, tags, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      expect(() => {
        insertStmt.run(
          webhook.id,
          webhook.name,
          webhook.url,
          1,
          JSON.stringify(webhook.events),
          JSON.stringify(webhook.headers),
          JSON.stringify(webhook.tags),
          webhook.createdAt.toISOString(),
          webhook.updatedAt.toISOString()
        );
      }).not.toThrow();

      // Verify data round-trip
      const selectStmt = db.prepare('SELECT headers, tags FROM webhooks WHERE id = ?');
      const retrieved = selectStmt.get(webhook.id);

      expect(JSON.parse(retrieved.headers)).toEqual(webhook.headers);
      expect(JSON.parse(retrieved.tags)).toEqual(webhook.tags);
    });
  });
});