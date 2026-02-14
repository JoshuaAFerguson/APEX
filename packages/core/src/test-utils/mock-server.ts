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

    // Navigation scenario routes
    this.setupNavigationScenarios();
  }

  /**
   * Sets up navigation scenario routes for testing
   */
  private setupNavigationScenarios(): void {
    if (!this.app) return;

    // Redirect scenarios with configurable status codes and targets
    this.setupRedirectRoutes();

    // Error scenarios that return specific HTTP errors
    this.setupErrorRoutes();

    // Delay scenarios with configurable response times
    this.setupDelayRoutes();
  }

  /**
   * Sets up redirect route handlers
   */
  private setupRedirectRoutes(): void {
    if (!this.app) return;

    // Permanent redirect (301)
    this.app.get('/redirect/301/:target', async (request, reply) => {
      const target = (request.params as any).target;
      const targetPath = target === 'home' ? '/' : `/${target}`;
      return reply.redirect(301, targetPath);
    });

    // Temporary redirect (302)
    this.app.get('/redirect/302/:target', async (request, reply) => {
      const target = (request.params as any).target;
      const targetPath = target === 'home' ? '/' : `/${target}`;
      return reply.redirect(302, targetPath);
    });

    // Temporary redirect with method preservation (307)
    this.app.get('/redirect/307/:target', async (request, reply) => {
      const target = (request.params as any).target;
      const targetPath = target === 'home' ? '/' : `/${target}`;
      return reply.redirect(307, targetPath);
    });

    // Generic redirect route with query parameters for status and target
    this.app.get('/redirect', async (request, reply) => {
      const query = request.query as any;
      const status = parseInt(query.status || '302', 10);
      const target = query.target || '/';

      // Validate redirect status codes
      if (![301, 302, 307, 308].includes(status)) {
        return reply.status(400).send({
          error: 'Invalid redirect status code. Must be 301, 302, 307, or 308.'
        });
      }

      return reply.redirect(status, target);
    });

    // Chain redirects for testing multiple redirects
    this.app.get('/redirect-chain-start', async (request, reply) => {
      return reply.redirect(302, '/redirect-chain-middle');
    });

    this.app.get('/redirect-chain-middle', async (request, reply) => {
      return reply.redirect(302, '/redirect-chain-end');
    });

    this.app.get('/redirect-chain-end', async () => {
      return {
        message: 'Redirect chain completed',
        timestamp: new Date().toISOString(),
      };
    });
  }

  /**
   * Sets up error route handlers
   */
  private setupErrorRoutes(): void {
    if (!this.app) return;

    // 404 Not Found
    this.app.get('/error/404', async (request, reply) => {
      return reply.status(404).send({
        error: 'Not Found',
        message: 'The requested resource was not found',
        path: request.url,
        timestamp: new Date().toISOString(),
      });
    });

    // 500 Internal Server Error
    this.app.get('/error/500', async (request, reply) => {
      return reply.status(500).send({
        error: 'Internal Server Error',
        message: 'An internal server error occurred',
        timestamp: new Date().toISOString(),
      });
    });

    // 401 Unauthorized
    this.app.get('/error/401', async (request, reply) => {
      return reply.status(401).send({
        error: 'Unauthorized',
        message: 'Authentication required',
        timestamp: new Date().toISOString(),
      });
    });

    // 403 Forbidden
    this.app.get('/error/403', async (request, reply) => {
      return reply.status(403).send({
        error: 'Forbidden',
        message: 'Access denied',
        timestamp: new Date().toISOString(),
      });
    });

    // 503 Service Unavailable
    this.app.get('/error/503', async (request, reply) => {
      return reply.status(503).send({
        error: 'Service Unavailable',
        message: 'Service temporarily unavailable',
        timestamp: new Date().toISOString(),
      });
    });

    // Generic error route with query parameter for status code
    this.app.get('/error', async (request, reply) => {
      const query = request.query as any;
      const status = parseInt(query.status || '500', 10);
      const message = query.message || `Error ${status}`;

      // Validate error status codes
      if (status < 400 || status >= 600) {
        return reply.status(400).send({
          error: 'Invalid error status code. Must be between 400-599.'
        });
      }

      return reply.status(status).send({
        error: `HTTP ${status}`,
        message: message,
        timestamp: new Date().toISOString(),
      });
    });
  }

  /**
   * Sets up delay route handlers with configurable response times
   */
  private setupDelayRoutes(): void {
    if (!this.app) return;

    // Delay route with configurable delay in milliseconds
    this.app.get('/delay/:ms', async (request, reply) => {
      const delayMs = parseInt((request.params as any).ms, 10);

      if (isNaN(delayMs) || delayMs < 0 || delayMs > 30000) {
        return reply.status(400).send({
          error: 'Invalid delay value. Must be between 0-30000 milliseconds.'
        });
      }

      // Add delay
      await new Promise(resolve => setTimeout(resolve, delayMs));

      return {
        message: `Response delayed by ${delayMs}ms`,
        delayMs: delayMs,
        timestamp: new Date().toISOString(),
      };
    });

    // Delay with query parameter
    this.app.get('/delay', async (request, reply) => {
      const query = request.query as any;
      const delayMs = parseInt(query.ms || '1000', 10);

      if (isNaN(delayMs) || delayMs < 0 || delayMs > 30000) {
        return reply.status(400).send({
          error: 'Invalid delay value. Must be between 0-30000 milliseconds.'
        });
      }

      // Add delay
      await new Promise(resolve => setTimeout(resolve, delayMs));

      return {
        message: `Response delayed by ${delayMs}ms`,
        delayMs: delayMs,
        timestamp: new Date().toISOString(),
      };
    });

    // Delay with error response
    this.app.get('/delay-error/:ms/:status', async (request, reply) => {
      const params = request.params as any;
      const delayMs = parseInt(params.ms, 10);
      const status = parseInt(params.status, 10);

      if (isNaN(delayMs) || delayMs < 0 || delayMs > 30000) {
        return reply.status(400).send({
          error: 'Invalid delay value. Must be between 0-30000 milliseconds.'
        });
      }

      if (isNaN(status) || status < 400 || status >= 600) {
        return reply.status(400).send({
          error: 'Invalid error status code. Must be between 400-599.'
        });
      }

      // Add delay
      await new Promise(resolve => setTimeout(resolve, delayMs));

      return reply.status(status).send({
        error: `HTTP ${status}`,
        message: `Delayed error response (${delayMs}ms delay)`,
        delayMs: delayMs,
        timestamp: new Date().toISOString(),
      });
    });

    // Slow redirect scenario
    this.app.get('/slow-redirect/:ms/:target', async (request, reply) => {
      const params = request.params as any;
      const delayMs = parseInt(params.ms, 10);
      const target = params.target;

      if (isNaN(delayMs) || delayMs < 0 || delayMs > 30000) {
        return reply.status(400).send({
          error: 'Invalid delay value. Must be between 0-30000 milliseconds.'
        });
      }

      // Add delay before redirect
      await new Promise(resolve => setTimeout(resolve, delayMs));

      const targetPath = target === 'home' ? '/' : `/${target}`;
      return reply.redirect(302, targetPath);
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