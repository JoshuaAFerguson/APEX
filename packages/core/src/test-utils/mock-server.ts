/**
 * MockServer class that wraps Fastify for testing purposes
 *
 * Provides a simple, reusable mock server that can be easily started and stopped
 * for integration tests across the APEX project.
 *
 * Note: Requires Fastify as a dependency. Install with: npm install fastify
 */

import type { FastifyInstance, FastifyServerOptions } from 'fastify';

export interface MockServerOptions {
  /** Optional logger configuration (defaults to silent for tests) */
  logger?: boolean | FastifyServerOptions['logger'];
  /** Additional server configuration */
  serverOptions?: Omit<FastifyServerOptions, 'logger'>;
  /** Host to bind to (defaults to 127.0.0.1 for testing) */
  host?: string;
  /** Port to bind to (0 for dynamic port assignment) */
  port?: number;
}

/**
 * MockServer provides a Fastify-based server for testing purposes.
 *
 * Features:
 * - Programmatic start/stop on dynamic ports
 * - Basic health check route
 * - Clean API for test usage
 * - Automatic port assignment when port is 0
 *
 * @example
 * ```typescript
 * import { MockServer } from '@apexcli/core/test-utils';
 *
 * const mockServer = new MockServer();
 * await mockServer.start();
 *
 * const url = mockServer.getUrl();
 * console.log(`Server running at ${url}`);
 *
 * await mockServer.stop();
 * ```
 */
export class MockServer {
  private app: FastifyInstance | null = null;
  private host: string;
  private port: number;
  private actualPort: number | null = null;
  private options: MockServerOptions;

  constructor(options: MockServerOptions = {}) {
    this.options = options;
    this.host = options.host || '127.0.0.1';
    this.port = options.port || 0;

    // App will be initialized in start() method using dynamic import
  }

  /**
   * Initializes the Fastify app using dynamic import
   * This allows graceful handling when Fastify is not available
   */
  private async initializeFastify(): Promise<void> {
    try {
      const { default: Fastify } = await import('fastify');
      this.app = Fastify({
        logger: this.options.logger || false, // Silent by default for tests
        ...this.options.serverOptions,
      });

      // Setup basic health check route
      this.setupRoutes();
    } catch (error) {
      throw new Error('Fastify is required for MockServer. Install with: npm install fastify');
    }
  }

  /**
   * Sets up basic routes for the mock server
   */
  private setupRoutes(): void {
    if (!this.app) return;

    // Basic health check route
    this.app.get('/health', async () => {
      return {
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
      };
    });

    // Additional basic routes for testing
    this.app.get('/ping', async () => {
      return { message: 'pong' };
    });

    // Echo route for testing request/response
    this.app.post('/echo', async (request) => {
      return {
        method: request.method,
        url: request.url,
        headers: request.headers,
        body: request.body,
        timestamp: new Date().toISOString(),
      };
    });

    // Status code testing route
    this.app.get('/status/:code', async (request, reply) => {
      const code = parseInt((request.params as any).code, 10);
      if (isNaN(code) || code < 100 || code >= 600) {
        return reply.status(400).send({ error: 'Invalid status code' });
      }
      return reply.status(code).send({ status: code, message: `Status ${code}` });
    });
  }

  /**
   * Starts the mock server
   *
   * @returns Promise that resolves when server is listening
   * @throws Error if server is already running or fails to start
   */
  async start(): Promise<void> {
    if (this.actualPort !== null) {
      throw new Error('MockServer is already running');
    }

    // Initialize Fastify if not already done
    if (!this.app) {
      await this.initializeFastify();
    }

    if (!this.app) {
      throw new Error('MockServer app failed to initialize');
    }

    try {
      await this.app.listen({
        host: this.host,
        port: this.port,
      });

      // Get the actual assigned port
      const address = this.app.server.address();
      if (!address || typeof address === 'string') {
        throw new Error('Failed to get server address');
      }

      this.actualPort = address.port;
    } catch (error) {
      throw new Error(`Failed to start MockServer: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Stops the mock server
   *
   * @returns Promise that resolves when server is stopped
   * @throws Error if server is not running or fails to stop
   */
  async stop(): Promise<void> {
    if (!this.app) {
      throw new Error('MockServer app is not initialized');
    }

    if (this.actualPort === null) {
      throw new Error('MockServer is not running');
    }

    try {
      await this.app.close();
      this.actualPort = null;
    } catch (error) {
      throw new Error(`Failed to stop MockServer: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Gets the full URL of the running server
   *
   * @returns The server URL (e.g., "http://127.0.0.1:3000")
   * @throws Error if server is not running
   */
  getUrl(): string {
    if (this.actualPort === null) {
      throw new Error('MockServer is not running. Call start() first.');
    }

    const protocol = this.host === '0.0.0.0' || this.host === '127.0.0.1' ? 'http' : 'http';
    return `${protocol}://${this.host}:${this.actualPort}`;
  }

  /**
   * Gets the port the server is running on
   *
   * @returns The actual port number
   * @throws Error if server is not running
   */
  getPort(): number {
    if (this.actualPort === null) {
      throw new Error('MockServer is not running. Call start() first.');
    }

    return this.actualPort;
  }

  /**
   * Gets the host the server is bound to
   *
   * @returns The host address
   */
  getHost(): string {
    return this.host;
  }

  /**
   * Checks if the server is currently running
   *
   * @returns True if server is running, false otherwise
   */
  isRunning(): boolean {
    return this.actualPort !== null;
  }

  /**
   * Gets the underlying Fastify instance for advanced configuration
   *
   * This allows tests to register additional routes or plugins before starting
   *
   * @returns The Fastify instance
   * @throws Error if app is not initialized
   */
  async getFastifyInstance(): Promise<FastifyInstance> {
    // Initialize Fastify if not already done
    if (!this.app) {
      await this.initializeFastify();
    }

    if (!this.app) {
      throw new Error('MockServer app failed to initialize');
    }

    return this.app;
  }

  /**
   * Registers additional routes with the server
   *
   * @param register Function that registers routes with the Fastify instance
   * @throws Error if server is already running or app is not initialized
   */
  async addRoutes(register: (app: FastifyInstance) => Promise<void> | void): Promise<void> {
    if (this.actualPort !== null) {
      throw new Error('Cannot add routes while server is running. Stop server first.');
    }

    // Initialize Fastify if not already done
    if (!this.app) {
      await this.initializeFastify();
    }

    if (!this.app) {
      throw new Error('MockServer app failed to initialize');
    }

    await register(this.app);
  }

  /**
   * Convenience method to create, start, and get URL of a MockServer
   *
   * @param options Server configuration options
   * @returns Object with server instance and URL
   */
  static async create(options: MockServerOptions = {}): Promise<{ server: MockServer; url: string }> {
    const server = new MockServer(options);
    await server.start();
    return { server, url: server.getUrl() };
  }
}

export default MockServer;