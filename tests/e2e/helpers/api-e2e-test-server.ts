/**
 * API E2E Test Server Helper
 *
 * Provides a test-oriented API server wrapper for E2E testing of MCP marketplace flows.
 * Creates a real Fastify server with ApexOrchestrator integration for API endpoint testing.
 *
 * Based on ADR-076 implementation design.
 */

import { FastifyInstance } from 'fastify';
import { createServer } from '@apex/api';
import { createWebSocketTestClient, WebSocketTestClient } from '../utils/ws-test-client.js';

export interface APITestServerOptions {
  projectPath: string;
  port?: number;           // Default: 0 (random available port)
  host?: string;           // Default: '127.0.0.1'
  enableWebSocket?: boolean; // Default: true
}

export interface APITestServer {
  /** Start the Fastify server with real orchestrator */
  start(): Promise<void>;

  /** Stop server, cleanup orchestrator and resources */
  stop(): Promise<void>;

  /** Get the base HTTP URL (e.g., http://127.0.0.1:12345) */
  getBaseUrl(): string;

  /** Get the WebSocket URL (e.g., ws://127.0.0.1:12345/ws) */
  getWsUrl(): string;

  /** Create a WebSocket test client connected to this server */
  createWebSocketClient(): Promise<WebSocketTestClient>;

  /** Get the underlying Fastify instance for direct access */
  getServer(): FastifyInstance;

  /** Reset server state between tests (clear installed servers, etc.) */
  reset(): Promise<void>;
}

/**
 * Implementation of APITestServer
 *
 * Manages a real Fastify server instance with ApexOrchestrator integration
 * for comprehensive API testing scenarios.
 */
class APITestServerImpl implements APITestServer {
  private server: FastifyInstance | null = null;
  private actualPort: number = 0;
  private isStarted = false;

  constructor(private options: APITestServerOptions) {}

  async start(): Promise<void> {
    if (this.isStarted) {
      throw new Error('API test server already started');
    }

    const { projectPath, port = 0, host = '127.0.0.1', enableWebSocket = true } = this.options;

    try {
      // Create Fastify server with real orchestrator
      this.server = await createServer({
        projectPath,
        port,
        host,
        silent: true, // Suppress logging in tests
      });

      // Start server and capture actual port
      const address = await this.server.listen({
        port,
        host,
      });

      // Extract port from address string (format: http://127.0.0.1:12345)
      const portMatch = address.match(/:(\d+)$/);
      if (portMatch) {
        this.actualPort = parseInt(portMatch[1], 10);
      } else {
        throw new Error(`Could not extract port from server address: ${address}`);
      }

      this.isStarted = true;

    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to start API test server: ${message}`);
    }
  }

  async stop(): Promise<void> {
    if (!this.isStarted || !this.server) {
      return;
    }

    try {
      // Close Fastify server (this should also cleanup orchestrator and resources)
      await this.server.close();
      this.server = null;
      this.actualPort = 0;
      this.isStarted = false;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to stop API test server: ${message}`);
    }
  }

  getBaseUrl(): string {
    if (!this.isStarted) {
      throw new Error('API test server not started');
    }
    return `http://${this.options.host || '127.0.0.1'}:${this.actualPort}`;
  }

  getWsUrl(): string {
    if (!this.isStarted) {
      throw new Error('API test server not started');
    }
    return `ws://${this.options.host || '127.0.0.1'}:${this.actualPort}/ws`;
  }

  async createWebSocketClient(): Promise<WebSocketTestClient> {
    if (!this.isStarted) {
      throw new Error('API test server not started');
    }

    const wsUrl = this.getWsUrl();
    return createWebSocketTestClient(wsUrl);
  }

  getServer(): FastifyInstance {
    if (!this.server) {
      throw new Error('API test server not started');
    }
    return this.server;
  }

  async reset(): Promise<void> {
    if (!this.isStarted || !this.server) {
      throw new Error('API test server not started');
    }

    try {
      // Reset server state by re-initializing the orchestrator without restarting HTTP server
      // This is challenging since the orchestrator is embedded in the server creation.
      // For now, we'll implement this as a graceful restart since the server is test-isolated.

      const currentOptions = this.options;
      await this.stop();
      await this.start();

    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to reset API test server: ${message}`);
    }
  }
}

/**
 * Factory function to create an API test server
 *
 * @param options - Server configuration options
 * @returns APITestServer instance
 *
 * @example
 * ```typescript
 * import { createAPITestServer } from './api-e2e-test-server.js';
 *
 * const server = createAPITestServer({
 *   projectPath: '/tmp/test-project',
 *   port: 0, // Random available port
 * });
 *
 * await server.start();
 *
 * const baseUrl = server.getBaseUrl();
 * const response = await fetch(`${baseUrl}/mcp/marketplace`);
 *
 * const wsClient = await server.createWebSocketClient();
 * await wsClient.connect();
 * const installEvent = await wsClient.waitForEvent('mcp:install-complete');
 *
 * await wsClient.disconnect();
 * await server.stop();
 * ```
 */
export function createAPITestServer(options: APITestServerOptions): APITestServer {
  return new APITestServerImpl(options);
}