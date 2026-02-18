/**
 * @fileoverview Enhanced Mock Server for Navigation Testing
 *
 * Provides a lightweight, programmatically controlled HTTP server for testing
 * navigation scenarios with predictable URLs and configurable responses.
 *
 * Features:
 * - Programmatic start/stop lifecycle
 * - Multiple navigation scenarios (redirects, errors, slow responses)
 * - Integration with test lifecycle (beforeAll/afterAll)
 * - Support for various error conditions and response types
 * - Configurable delays and response patterns
 */

import { createServer } from 'http';
import type { Server } from 'http';
import type { IncomingMessage, ServerResponse } from 'http';

export interface MockServerOptions {
  /** Port to bind the server to (0 = random available port) */
  port?: number;
  /** Host to bind the server to */
  host?: string;
  /** Base delay for slow responses (ms) */
  baseDelay?: number;
  /** Enable verbose logging */
  verbose?: boolean;
  /** Custom route handlers */
  customRoutes?: Record<string, RouteHandler>;
}

export interface RouteHandler {
  (req: IncomingMessage, res: ServerResponse, server: MockNavigationServer): void;
}

export interface NavigationScenario {
  /** Scenario name for identification */
  name: string;
  /** Path pattern to match */
  path: string;
  /** HTTP status code to return */
  statusCode?: number;
  /** Response content type */
  contentType?: string;
  /** Response body (can be string or function) */
  body?: string | (() => string);
  /** Delay before responding (ms) */
  delay?: number;
  /** Redirect location (for 3xx responses) */
  redirectTo?: string;
  /** Additional headers */
  headers?: Record<string, string>;
}

/**
 * Enhanced mock server for controlled navigation testing scenarios
 */
export class MockNavigationServer {
  private server: Server | null = null;
  private _port: number | null = null;
  private _isRunning = false;
  private options: Required<MockServerOptions>;
  private scenarios: Map<string, NavigationScenario> = new Map();

  constructor(options: MockServerOptions = {}) {
    this.options = {
      port: 0,
      host: 'localhost',
      baseDelay: 2000,
      verbose: false,
      customRoutes: {},
      ...options
    };

    this.setupDefaultScenarios();
  }

  /**
   * Get the server port (only available after start)
   */
  get port(): number {
    if (!this._isRunning || this._port === null) {
      throw new Error('Server is not running - call start() first');
    }
    return this._port;
  }

  /**
   * Get the server base URL (only available after start)
   */
  get baseUrl(): string {
    return `http://${this.options.host}:${this.port}`;
  }

  /**
   * Check if server is running
   */
  get isRunning(): boolean {
    return this._isRunning;
  }

  /**
   * Set up default navigation scenarios
   */
  private setupDefaultScenarios(): void {
    // Home page
    this.addScenario({
      name: 'home',
      path: '/',
      statusCode: 200,
      contentType: 'text/html',
      body: () => this.createHomePage(),
    });

    // Test pages
    this.addScenario({
      name: 'page1',
      path: '/page1',
      statusCode: 200,
      contentType: 'text/html',
      body: () => this.createTestPage('Page 1', '/page2'),
    });

    this.addScenario({
      name: 'page2',
      path: '/page2',
      statusCode: 200,
      contentType: 'text/html',
      body: () => this.createTestPage('Page 2', '/page3'),
    });

    this.addScenario({
      name: 'page3',
      path: '/page3',
      statusCode: 200,
      contentType: 'text/html',
      body: () => this.createTestPage('Page 3', '/'),
    });

    // Error scenarios
    this.addScenario({
      name: 'server-error',
      path: '/error',
      statusCode: 500,
      contentType: 'text/html',
      body: '<html><body><h1>500 Server Error</h1><p>Internal server error for testing</p></body></html>',
    });

    this.addScenario({
      name: 'not-found',
      path: '/404',
      statusCode: 404,
      contentType: 'text/html',
      body: '<html><body><h1>404 Not Found</h1><p>Page not found for testing</p></body></html>',
    });

    this.addScenario({
      name: 'forbidden',
      path: '/forbidden',
      statusCode: 403,
      contentType: 'text/html',
      body: '<html><body><h1>403 Forbidden</h1><p>Access denied for testing</p></body></html>',
    });

    // Slow response scenarios
    this.addScenario({
      name: 'slow-response',
      path: '/slow',
      statusCode: 200,
      contentType: 'text/html',
      delay: this.options.baseDelay,
      body: () => this.createTestPage('Slow Page', '/'),
    });

    this.addScenario({
      name: 'very-slow-response',
      path: '/very-slow',
      statusCode: 200,
      contentType: 'text/html',
      delay: this.options.baseDelay * 2,
      body: () => this.createTestPage('Very Slow Page', '/'),
    });

    // Redirect scenarios
    this.addScenario({
      name: 'redirect-302',
      path: '/redirect-temp',
      statusCode: 302,
      redirectTo: '/page1',
    });

    this.addScenario({
      name: 'redirect-301',
      path: '/redirect-permanent',
      statusCode: 301,
      redirectTo: '/page1',
    });

    // Special content scenarios
    this.addScenario({
      name: 'json-response',
      path: '/api/data',
      statusCode: 200,
      contentType: 'application/json',
      body: () => JSON.stringify({
        message: 'Test API response',
        timestamp: new Date().toISOString(),
        data: { test: true }
      }),
    });

    this.addScenario({
      name: 'empty-response',
      path: '/empty',
      statusCode: 200,
      contentType: 'text/html',
      body: '',
    });
  }

  /**
   * Add or update a navigation scenario
   */
  addScenario(scenario: NavigationScenario): void {
    this.scenarios.set(scenario.path, scenario);
    if (this.options.verbose) {
      console.log(`Added navigation scenario: ${scenario.name} -> ${scenario.path}`);
    }
  }

  /**
   * Remove a navigation scenario
   */
  removeScenario(path: string): void {
    this.scenarios.delete(path);
    if (this.options.verbose) {
      console.log(`Removed navigation scenario: ${path}`);
    }
  }

  /**
   * Get all configured scenarios
   */
  getScenarios(): NavigationScenario[] {
    return Array.from(this.scenarios.values());
  }

  /**
   * Start the mock server
   */
  async start(): Promise<void> {
    if (this._isRunning) {
      throw new Error('Server is already running');
    }

    return new Promise((resolve, reject) => {
      this.server = createServer((req, res) => {
        this.handleRequest(req, res);
      });

      this.server.on('error', (error) => {
        this._isRunning = false;
        this._port = null;
        reject(error);
      });

      this.server.listen(this.options.port, this.options.host, () => {
        const address = this.server!.address();
        if (address && typeof address === 'object') {
          this._port = address.port;
          this._isRunning = true;

          if (this.options.verbose) {
            console.log(`Mock navigation server started on ${this.baseUrl}`);
            console.log(`Available scenarios: ${this.scenarios.size}`);
          }

          resolve();
        } else {
          reject(new Error('Failed to determine server address'));
        }
      });
    });
  }

  /**
   * Stop the mock server
   */
  async stop(): Promise<void> {
    if (!this._isRunning || !this.server) {
      return;
    }

    return new Promise((resolve, reject) => {
      this.server!.close((error) => {
        this._isRunning = false;
        this._port = null;
        this.server = null;

        if (error) {
          reject(error);
        } else {
          if (this.options.verbose) {
            console.log('Mock navigation server stopped');
          }
          resolve();
        }
      });
    });
  }

  /**
   * Handle incoming HTTP requests
   */
  private handleRequest(req: IncomingMessage, res: ServerResponse): void {
    const url = req.url || '/';
    const urlParts = new URL(url, `http://${this.options.host}`);
    const pathname = urlParts.pathname;

    // Enable CORS
    this.setCorsHeaders(res);

    // Handle OPTIONS requests
    if (req.method === 'OPTIONS') {
      res.writeHead(200);
      res.end();
      return;
    }

    if (this.options.verbose) {
      console.log(`${req.method} ${pathname}`);
    }

    // Check for dynamic redirect
    if (pathname === '/redirect') {
      const target = urlParts.searchParams.get('to') || '/';
      res.writeHead(302, { 'Location': target });
      res.end();
      return;
    }

    // Check custom routes first
    const customHandler = this.options.customRoutes[pathname];
    if (customHandler) {
      customHandler(req, res, this);
      return;
    }

    // Check configured scenarios
    const scenario = this.scenarios.get(pathname);
    if (scenario) {
      this.handleScenario(req, res, scenario);
      return;
    }

    // Default 404 response
    this.send404(res, pathname);
  }

  /**
   * Handle a specific navigation scenario
   */
  private handleScenario(
    req: IncomingMessage,
    res: ServerResponse,
    scenario: NavigationScenario
  ): void {
    const executeResponse = () => {
      // Set status code
      const statusCode = scenario.statusCode || 200;

      // Set headers
      const headers: Record<string, string> = {
        'Content-Type': scenario.contentType || 'text/html',
        ...scenario.headers,
      };

      // Handle redirects
      if (statusCode >= 300 && statusCode < 400 && scenario.redirectTo) {
        headers['Location'] = scenario.redirectTo;
        res.writeHead(statusCode, headers);
        res.end();
        return;
      }

      // Handle body content
      let body = '';
      if (scenario.body) {
        body = typeof scenario.body === 'function' ? scenario.body() : scenario.body;
      }

      res.writeHead(statusCode, headers);
      res.end(body);
    };

    // Apply delay if configured
    if (scenario.delay && scenario.delay > 0) {
      setTimeout(executeResponse, scenario.delay);
    } else {
      executeResponse();
    }
  }

  /**
   * Set CORS headers for testing
   */
  private setCorsHeaders(res: ServerResponse): void {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  }

  /**
   * Send 404 response
   */
  private send404(res: ServerResponse, pathname: string): void {
    res.writeHead(404, { 'Content-Type': 'text/html' });
    res.end(`<html><body><h1>404 Page Not Found</h1><p>Path '${pathname}' not found on mock server</p></body></html>`);
  }

  /**
   * Create the home page HTML
   */
  private createHomePage(): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Navigation Test Home</title>
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            margin: 40px;
            background: #f5f5f5;
            line-height: 1.6;
          }
          .container {
            max-width: 800px;
            margin: 0 auto;
            background: white;
            padding: 30px;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
          }
          .nav-button {
            background: #007acc;
            color: white;
            padding: 12px 24px;
            border: none;
            border-radius: 6px;
            cursor: pointer;
            margin: 8px 8px 8px 0;
            text-decoration: none;
            display: inline-block;
            font-size: 14px;
            transition: background-color 0.2s;
          }
          .nav-button:hover {
            background: #005a9e;
          }
          .error-button {
            background: #dc3545;
          }
          .error-button:hover {
            background: #c82333;
          }
          .slow-button {
            background: #ffc107;
            color: #000;
          }
          .slow-button:hover {
            background: #e0a800;
          }
          .info {
            background: #e7f3ff;
            padding: 15px;
            border-radius: 4px;
            margin: 20px 0;
            border-left: 4px solid #007acc;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>🧪 Navigation Test Home</h1>
          <p>Mock server for testing navigation scenarios in APEX browser automation.</p>

          <div class="info">
            <strong>Server Info:</strong><br>
            URL: <span id="current-url"></span><br>
            Timestamp: <span id="timestamp"></span><br>
            Test Session: <code id="session-id"></code>
          </div>

          <h2>📄 Basic Navigation</h2>
          <nav>
            <a href="/page1" class="nav-button">Page 1</a>
            <a href="/page2" class="nav-button">Page 2</a>
            <a href="/page3" class="nav-button">Page 3</a>
          </nav>

          <h2>🔄 Redirect Testing</h2>
          <nav>
            <a href="/redirect?to=/page1" class="nav-button">Dynamic Redirect</a>
            <a href="/redirect-temp" class="nav-button">302 Redirect</a>
            <a href="/redirect-permanent" class="nav-button">301 Redirect</a>
          </nav>

          <h2>⚠️ Error Testing</h2>
          <nav>
            <a href="/error" class="nav-button error-button">500 Error</a>
            <a href="/404" class="nav-button error-button">404 Error</a>
            <a href="/forbidden" class="nav-button error-button">403 Forbidden</a>
            <a href="/nonexistent" class="nav-button error-button">Unknown Path</a>
          </nav>

          <h2>🐌 Performance Testing</h2>
          <nav>
            <a href="/slow" class="nav-button slow-button">Slow Response (2s)</a>
            <a href="/very-slow" class="nav-button slow-button">Very Slow (4s)</a>
          </nav>

          <h2>🔧 Special Content</h2>
          <nav>
            <a href="/api/data" class="nav-button">JSON Response</a>
            <a href="/empty" class="nav-button">Empty Response</a>
          </nav>
        </div>

        <script>
          document.getElementById('current-url').textContent = window.location.href;
          document.getElementById('timestamp').textContent = new Date().toISOString();
          document.getElementById('session-id').textContent = 'nav-test-' + Math.random().toString(36).substr(2, 9);

          // Log navigation events for testing
          console.log('Navigation Test Home page loaded');
          console.log('Available scenarios:', ${JSON.stringify(Array.from(this.scenarios.keys()))});

          // Track navigation history
          window.navigationTestHistory = window.navigationTestHistory || [];
          window.navigationTestHistory.push({
            url: window.location.href,
            timestamp: Date.now(),
            title: document.title
          });
        </script>
      </body>
      </html>
    `;
  }

  /**
   * Create a test page HTML with navigation controls
   */
  private createTestPage(title: string, nextPage: string): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Navigation Test - ${title}</title>
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            margin: 40px;
            background: #f5f5f5;
            line-height: 1.6;
          }
          .container {
            max-width: 800px;
            margin: 0 auto;
            background: white;
            padding: 30px;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
          }
          .nav-button {
            background: #007acc;
            color: white;
            padding: 12px 24px;
            border: none;
            border-radius: 6px;
            cursor: pointer;
            margin: 8px 8px 8px 0;
            text-decoration: none;
            display: inline-block;
            font-size: 14px;
            transition: background-color 0.2s;
          }
          .nav-button:hover {
            background: #005a9e;
          }
          .browser-button {
            background: #6c757d;
          }
          .browser-button:hover {
            background: #5a6268;
          }
          .info {
            background: #e7f3ff;
            padding: 15px;
            border-radius: 4px;
            margin: 20px 0;
            border-left: 4px solid #007acc;
            font-family: monospace;
            font-size: 12px;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>📄 ${title}</h1>
          <p>This is <strong>${title}</strong> in the navigation test suite.</p>

          <div class="info" id="page-info">
            <strong>Page Information:</strong><br>
            Current URL: <span id="current-url"></span><br>
            Page Title: <span id="page-title"></span><br>
            History Length: <span id="history-length"></span><br>
            Timestamp: <span id="timestamp"></span><br>
            Performance: <span id="performance"></span>
          </div>

          <h2>🔗 Page Navigation</h2>
          <nav>
            <a href="/" class="nav-button">🏠 Home</a>
            <a href="${nextPage}" class="nav-button">➡️ Next Page</a>
          </nav>

          <h2>🌐 Browser Controls</h2>
          <nav>
            <button class="nav-button browser-button" onclick="history.back()">⬅️ Back</button>
            <button class="nav-button browser-button" onclick="history.forward()">➡️ Forward</button>
            <button class="nav-button browser-button" onclick="location.reload()">🔄 Reload</button>
          </nav>

          <div id="test-data" data-page="${title}" data-next="${nextPage}"></div>
        </div>

        <script>
          // Update page information
          document.getElementById('current-url').textContent = window.location.href;
          document.getElementById('page-title').textContent = document.title;
          document.getElementById('history-length').textContent = history.length;
          document.getElementById('timestamp').textContent = new Date().toISOString();

          // Performance metrics
          window.addEventListener('load', () => {
            if (performance.getEntriesByType) {
              const navigation = performance.getEntriesByType('navigation')[0];
              if (navigation) {
                const loadTime = Math.round(navigation.loadEventEnd - navigation.loadEventStart);
                document.getElementById('performance').textContent = loadTime + 'ms load time';
              }
            }
          });

          // Log page load for testing
          console.log('${title} loaded');
          console.log('Navigation data:', {
            title: '${title}',
            nextPage: '${nextPage}',
            url: window.location.href,
            historyLength: history.length
          });

          // Track navigation history
          window.navigationTestHistory = window.navigationTestHistory || [];
          window.navigationTestHistory.push({
            url: window.location.href,
            timestamp: Date.now(),
            title: document.title,
            page: '${title}'
          });
        </script>
      </body>
      </html>
    `;
  }
}

/**
 * Create and start a mock navigation server with default configuration
 */
export async function createMockNavigationServer(options: MockServerOptions = {}): Promise<MockNavigationServer> {
  const server = new MockNavigationServer(options);
  await server.start();
  return server;
}

/**
 * Test lifecycle utilities for integration with testing frameworks
 */
export class MockServerLifecycle {
  private static instances: Map<string, MockNavigationServer> = new Map();

  /**
   * Start a named mock server instance for test suite
   */
  static async startForTest(name: string, options: MockServerOptions = {}): Promise<MockNavigationServer> {
    if (this.instances.has(name)) {
      throw new Error(`Mock server '${name}' is already running`);
    }

    const server = await createMockNavigationServer(options);
    this.instances.set(name, server);
    return server;
  }

  /**
   * Stop a named mock server instance
   */
  static async stopForTest(name: string): Promise<void> {
    const server = this.instances.get(name);
    if (server) {
      await server.stop();
      this.instances.delete(name);
    }
  }

  /**
   * Get a running mock server instance by name
   */
  static getInstance(name: string): MockNavigationServer | undefined {
    return this.instances.get(name);
  }

  /**
   * Stop all running mock server instances
   */
  static async stopAll(): Promise<void> {
    const promises = Array.from(this.instances.values()).map(server => server.stop());
    await Promise.all(promises);
    this.instances.clear();
  }

  /**
   * Get all running instance names
   */
  static getInstanceNames(): string[] {
    return Array.from(this.instances.keys());
  }
}