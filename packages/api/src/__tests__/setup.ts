/**
 * Integration test setup utilities for API package
 * Provides Fastify app initialization, mock orchestrator, test database setup/teardown, and WebSocket test helpers
 */

import { beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { FastifyInstance } from 'fastify';
import { createServer, ServerOptions } from '../index.js';
import { WebSocket } from 'ws';
import { tmpdir } from 'os';
import { mkdtemp, rm, mkdir, writeFile, readFile } from 'fs/promises';
import path from 'path';
import { ApexOrchestrator } from '@apexcli/orchestrator';
import { Task, HealthMetrics, TaskStatus } from '@apexcli/core';

/**
 * Configuration for test server setup
 */
export interface TestSetupConfig {
  projectPath?: string;
  port?: number;
  silent?: boolean;
  mockOrchestrator?: boolean;
  enableHealthMonitoring?: boolean;
}

/**
 * Test context containing server, paths, and utilities
 */
export interface TestContext {
  app: FastifyInstance;
  tempDir: string;
  serverPort: number;
  projectPath: string;
  apexDir: string;
  orchestrator: ApexOrchestrator;
  cleanup: () => Promise<void>;
}

/**
 * WebSocket test client with helper methods
 */
export class WebSocketTestClient {
  private ws: WebSocket;
  private messageQueue: any[] = [];
  private messageHandlers: Map<string, (message: any) => void> = new Map();

  constructor(url: string) {
    this.ws = new WebSocket(url);
    this.setupMessageHandling();
  }

  private setupMessageHandling(): void {
    this.ws.on('message', (data) => {
      try {
        const message = JSON.parse(data.toString());
        this.messageQueue.push(message);

        // Call specific handlers if registered
        const handler = this.messageHandlers.get(message.type);
        if (handler) {
          handler(message);
        }
      } catch (error) {
        console.error('Failed to parse WebSocket message:', error);
      }
    });
  }

  /**
   * Wait for WebSocket connection to open
   */
  async waitForConnection(timeout = 5000): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.ws.readyState === WebSocket.OPEN) {
        resolve();
        return;
      }

      const timer = setTimeout(() => {
        reject(new Error('WebSocket connection timeout'));
      }, timeout);

      this.ws.once('open', () => {
        clearTimeout(timer);
        resolve();
      });

      this.ws.once('error', (error) => {
        clearTimeout(timer);
        reject(error);
      });
    });
  }

  /**
   * Wait for a specific message type
   */
  async waitForMessage(type?: string, timeout = 5000): Promise<any> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`WebSocket message timeout${type ? ` for type: ${type}` : ''}`));
      }, timeout);

      // Check if message already in queue
      if (type) {
        const existingMessage = this.messageQueue.find(msg => msg.type === type);
        if (existingMessage) {
          clearTimeout(timer);
          resolve(existingMessage);
          return;
        }
      } else if (this.messageQueue.length > 0) {
        clearTimeout(timer);
        resolve(this.messageQueue.shift());
        return;
      }

      // Set up handler for new message
      const messageHandler = (message: any) => {
        if (!type || message.type === type) {
          clearTimeout(timer);
          this.ws.off('message', messageHandler);
          resolve(message);
        }
      };

      this.ws.on('message', (data) => {
        try {
          const message = JSON.parse(data.toString());
          messageHandler(message);
        } catch (error) {
          // Ignore parsing errors
        }
      });
    });
  }

  /**
   * Send a message to the server
   */
  send(data: any): void {
    if (this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(typeof data === 'string' ? data : JSON.stringify(data));
    } else {
      throw new Error('WebSocket connection is not open');
    }
  }

  /**
   * Register a handler for specific message types
   */
  onMessage(type: string, handler: (message: any) => void): void {
    this.messageHandlers.set(type, handler);
  }

  /**
   * Get the current ready state
   */
  get readyState(): number {
    return this.ws.readyState;
  }

  /**
   * Close the WebSocket connection
   */
  close(): void {
    this.ws.close();
  }

  /**
   * Get all received messages
   */
  getMessages(): any[] {
    return [...this.messageQueue];
  }

  /**
   * Get messages of a specific type
   */
  getMessagesByType(type: string): any[] {
    return this.messageQueue.filter(msg => msg.type === type);
  }

  /**
   * Clear message queue
   */
  clearMessages(): void {
    this.messageQueue = [];
  }
}

/**
 * Mock data generators for testing
 */
export const TestDataGenerators = {
  /**
   * Create a mock task
   */
  createMockTask(overrides: Partial<Task> = {}): Task {
    return {
      id: 'test-task-' + Math.random().toString(36).substr(2, 9),
      description: 'Test task description',
      status: 'pending' as TaskStatus,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ...overrides,
    };
  },

  /**
   * Create mock health metrics
   */
  createMockHealthMetrics(overrides: Partial<HealthMetrics> = {}): HealthMetrics {
    return {
      uptime: 3600000, // 1 hour
      memoryUsage: {
        heapUsed: 100 * 1024 * 1024, // 100MB
        heapTotal: 150 * 1024 * 1024, // 150MB
        rss: 200 * 1024 * 1024, // 200MB
      },
      taskCounts: {
        processed: 25,
        succeeded: 20,
        failed: 3,
        active: 2,
      },
      lastHealthCheck: new Date(),
      healthChecksPassed: 100,
      healthChecksFailed: 2,
      restartHistory: [],
      ...overrides,
    };
  },

  /**
   * Create healthy daemon state for testing
   */
  createHealthyDaemonState(pid = 12345, healthMetrics?: HealthMetrics) {
    const metrics = healthMetrics || this.createMockHealthMetrics();
    return {
      timestamp: new Date().toISOString(),
      pid,
      startedAt: new Date().toISOString(),
      running: true,
      health: {
        ...metrics,
        lastHealthCheck: metrics.lastHealthCheck.toISOString(),
        restartHistory: metrics.restartHistory.map(record => ({
          ...record,
          timestamp: record.timestamp.toISOString(),
        })),
      },
    };
  },
};

/**
 * Database test utilities
 */
export class DatabaseTestUtils {
  constructor(private projectPath: string) {}

  /**
   * Get path to test database
   */
  get dbPath(): string {
    return path.join(this.projectPath, '.apex', 'apex.db');
  }

  /**
   * Check if test database exists
   */
  async exists(): Promise<boolean> {
    try {
      await readFile(this.dbPath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Clean up test database
   */
  async cleanup(): Promise<void> {
    try {
      await rm(this.dbPath, { force: true });
    } catch {
      // Ignore errors if file doesn't exist
    }
  }

  /**
   * Initialize test database with schema
   */
  async initialize(): Promise<void> {
    // Database initialization is handled by ApexOrchestrator
    // This method exists for potential custom test data setup
  }
}

/**
 * File system test utilities
 */
export class FileSystemTestUtils {
  constructor(private projectPath: string) {}

  get apexDir(): string {
    return path.join(this.projectPath, '.apex');
  }

  get pidFile(): string {
    return path.join(this.apexDir, 'daemon.pid');
  }

  get stateFile(): string {
    return path.join(this.apexDir, 'daemon-state.json');
  }

  /**
   * Setup test daemon files
   */
  async setupDaemonFiles(pid = 12345, healthMetrics?: HealthMetrics): Promise<void> {
    await mkdir(this.apexDir, { recursive: true });

    // Create PID file
    await writeFile(this.pidFile, JSON.stringify({
      pid,
      startedAt: new Date().toISOString(),
      version: '0.4.0',
      projectPath: this.projectPath,
    }));

    // Create state file
    const state = TestDataGenerators.createHealthyDaemonState(pid, healthMetrics);
    await writeFile(this.stateFile, JSON.stringify(state, null, 2));
  }

  /**
   * Update daemon health metrics
   */
  async updateHealthMetrics(healthMetrics: HealthMetrics): Promise<void> {
    const state = TestDataGenerators.createHealthyDaemonState(12345, healthMetrics);
    await writeFile(this.stateFile, JSON.stringify(state, null, 2));
  }

  /**
   * Clean up all test files
   */
  async cleanup(): Promise<void> {
    await rm(this.projectPath, { recursive: true, force: true });
  }
}

/**
 * Main test setup function
 * Creates a complete test environment with Fastify app, temporary directories, and utilities
 */
export async function setupTestServer(config: TestSetupConfig = {}): Promise<TestContext> {
  // Create temporary directory for test project
  const tempDir = config.projectPath || await mkdtemp(path.join(tmpdir(), 'apex-test-'));
  const apexDir = path.join(tempDir, '.apex');

  // Ensure .apex directory exists
  await mkdir(apexDir, { recursive: true });

  // Setup file system utilities
  const fsUtils = new FileSystemTestUtils(tempDir);
  const dbUtils = new DatabaseTestUtils(tempDir);

  // Create Fastify server with test configuration
  const serverOptions: ServerOptions = {
    projectPath: tempDir,
    port: config.port || 0, // Use dynamic port for testing
    silent: config.silent !== false, // Silent by default in tests
  };

  const app = await createServer(serverOptions);

  // Start server and get assigned port
  await app.listen({ port: 0, host: '127.0.0.1' });
  const address = app.server.address();

  if (!address || typeof address !== 'object') {
    throw new Error('Failed to start test server');
  }

  const serverPort = address.port;

  // Get orchestrator instance from the server context
  // Note: In a real implementation, we'd need access to the orchestrator instance
  // For now, we'll create a new one for testing
  const orchestrator = new ApexOrchestrator({
    projectPath: tempDir,
    apiUrl: `http://127.0.0.1:${serverPort}`
  });
  await orchestrator.initialize();

  // Setup cleanup function
  const cleanup = async (): Promise<void> => {
    if (app) {
      await app.close();
    }
    await dbUtils.cleanup();
    await fsUtils.cleanup();
  };

  return {
    app,
    tempDir,
    serverPort,
    projectPath: tempDir,
    apexDir,
    orchestrator,
    cleanup,
  };
}

/**
 * Global test setup helpers
 */
export const TestSetup = {
  /**
   * Setup test environment before each test
   */
  async beforeEach(config: TestSetupConfig = {}): Promise<TestContext> {
    return await setupTestServer(config);
  },

  /**
   * Cleanup test environment after each test
   */
  async afterEach(context: TestContext): Promise<void> {
    await context.cleanup();
  },

  /**
   * Create a WebSocket test client
   */
  createWebSocketClient(serverPort: number, taskId = 'test', events?: string[]): WebSocketTestClient {
    let url = `ws://127.0.0.1:${serverPort}/stream/${taskId}`;
    if (events && events.length > 0) {
      url += `?events=${events.join(',')}`;
    }
    return new WebSocketTestClient(url);
  },

  /**
   * Create a global WebSocket client (no task-specific filtering)
   */
  createGlobalWebSocketClient(serverPort: number): WebSocketTestClient {
    const url = `ws://127.0.0.1:${serverPort}/ws`;
    return new WebSocketTestClient(url);
  },

  /**
   * Wait for a condition to be met (useful for async operations)
   */
  async waitFor(condition: () => boolean | Promise<boolean>, timeout = 5000, interval = 100): Promise<void> {
    const start = Date.now();

    while (Date.now() - start < timeout) {
      if (await condition()) {
        return;
      }
      await new Promise(resolve => setTimeout(resolve, interval));
    }

    throw new Error(`Condition not met within ${timeout}ms`);
  },
};

/**
 * HTTP test utilities for API testing
 */
export class HttpTestUtils {
  constructor(private app: FastifyInstance) {}

  /**
   * Create a task via API
   */
  async createTask(description: string, options: any = {}) {
    return this.app.inject({
      method: 'POST',
      url: '/tasks',
      payload: {
        description,
        ...options,
      },
    });
  }

  /**
   * Get task by ID
   */
  async getTask(id: string) {
    return this.app.inject({
      method: 'GET',
      url: `/tasks/${id}`,
    });
  }

  /**
   * List tasks
   */
  async listTasks(query: any = {}) {
    const params = new URLSearchParams(query).toString();
    return this.app.inject({
      method: 'GET',
      url: `/tasks${params ? '?' + params : ''}`,
    });
  }

  /**
   * Get daemon health
   */
  async getDaemonHealth() {
    return this.app.inject({
      method: 'GET',
      url: '/daemon/health',
    });
  }

  /**
   * Get basic health check
   */
  async getHealth() {
    return this.app.inject({
      method: 'GET',
      url: '/health',
    });
  }

  /**
   * Create a template
   */
  async createTemplate(template: any) {
    return this.app.inject({
      method: 'POST',
      url: '/templates',
      payload: template,
    });
  }

  /**
   * List templates
   */
  async listTemplates() {
    return this.app.inject({
      method: 'GET',
      url: '/templates',
    });
  }
}

/**
 * All utilities are already exported above
 */

/**
 * Convenience function to setup a complete test environment
 */
export async function createTestEnvironment(config: TestSetupConfig = {}) {
  const context = await setupTestServer(config);
  const fsUtils = new FileSystemTestUtils(context.projectPath);
  const dbUtils = new DatabaseTestUtils(context.projectPath);
  const httpUtils = new HttpTestUtils(context.app);

  return {
    ...context,
    fsUtils,
    dbUtils,
    httpUtils,
    createWebSocketClient: (taskId?: string, events?: string[]) =>
      TestSetup.createWebSocketClient(context.serverPort, taskId, events),
    createGlobalWebSocketClient: () =>
      TestSetup.createGlobalWebSocketClient(context.serverPort),
  };
}