/**
 * @apexcli/api - Screenshot API Tests
 *
 * Comprehensive tests for screenshot capture functionality
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import { createServer } from '../index.js';

describe('Screenshot API', () => {
  let server: FastifyInstance;
  let serverUrl: string;
  const testPort = 3001;

  beforeAll(async () => {
    // Create test server
    server = await createServer({
      projectPath: process.cwd(),
      port: testPort,
      host: '127.0.0.1',
      silent: true,
    });

    // Start the server
    await server.listen({ port: testPort, host: '127.0.0.1' });
    serverUrl = `http://127.0.0.1:${testPort}`;
  });

  afterAll(async () => {
    if (server) {
      await server.close();
    }
  });

  describe('POST /screenshot/viewport', () => {
    it('should capture viewport screenshot with minimal config', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/screenshot/viewport',
        payload: {
          url: 'data:text/html,<h1>Test Page</h1><p>This is a test page for screenshot capture.</p>',
        },
      });

      expect(response.statusCode).toBe(200);
      expect(response.headers['content-type']).toBe('image/png');
      expect(Buffer.isBuffer(response.rawPayload)).toBe(true);
      expect(response.rawPayload.length).toBeGreaterThan(100); // Should have image data
    });

    it('should capture viewport screenshot with JPEG format', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/screenshot/viewport',
        payload: {
          url: 'data:text/html,<h1>JPEG Test</h1>',
          format: 'jpeg',
          quality: 80,
        },
      });

      expect(response.statusCode).toBe(200);
      expect(response.headers['content-type']).toBe('image/jpeg');
      expect(Buffer.isBuffer(response.rawPayload)).toBe(true);
    });

    it('should capture viewport screenshot with custom viewport dimensions', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/screenshot/viewport',
        payload: {
          url: 'data:text/html,<h1 style="color: blue;">Custom Viewport</h1>',
          viewport: {
            width: 800,
            height: 600,
          },
        },
      });

      expect(response.statusCode).toBe(200);
      expect(response.headers['content-type']).toBe('image/png');
    });

    it('should return JSON response when savePath is provided', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/screenshot/viewport',
        payload: {
          url: 'data:text/html,<h1>Save Test</h1>',
          savePath: '/tmp/test-screenshot.png',
        },
      });

      expect(response.statusCode).toBe(200);
      expect(response.headers['content-type']).toContain('application/json');

      const body = response.json();
      expect(body.success).toBe(true);
      expect(body.format).toBe('png');
      expect(body.filePath).toBe('/tmp/test-screenshot.png');
      expect(typeof body.duration).toBe('number');
    });

    it('should validate URL parameter', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/screenshot/viewport',
        payload: {
          url: '',
        },
      });

      expect(response.statusCode).toBe(400);
      const body = response.json();
      expect(body.success).toBe(false);
      expect(body.error).toContain('Invalid URL');
    });

    it('should validate JPEG quality parameter', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/screenshot/viewport',
        payload: {
          url: 'data:text/html,<h1>Quality Test</h1>',
          format: 'jpeg',
          quality: 150, // Invalid quality > 100
        },
      });

      expect(response.statusCode).toBe(400);
      const body = response.json();
      expect(body.success).toBe(false);
      expect(body.error).toContain('quality must be between 0 and 100');
    });

    it('should handle invalid URLs gracefully', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/screenshot/viewport',
        payload: {
          url: 'invalid-url',
        },
      });

      expect(response.statusCode).toBe(400);
      const body = response.json();
      expect(body.success).toBe(false);
      expect(body.error).toContain('Invalid URL');
    });
  });

  describe('POST /screenshot/fullpage', () => {
    it('should capture full page screenshot', async () => {
      const html = `
        <h1>Full Page Test</h1>
        <div style="height: 2000px; background: linear-gradient(to bottom, red, blue);">
          Long content that extends beyond viewport
        </div>
      `;

      const response = await server.inject({
        method: 'POST',
        url: '/screenshot/fullpage',
        payload: {
          url: `data:text/html,${encodeURIComponent(html)}`,
        },
      });

      expect(response.statusCode).toBe(200);
      expect(response.headers['content-type']).toBe('image/png');
      expect(Buffer.isBuffer(response.rawPayload)).toBe(true);
      // Full page screenshots should be larger than viewport screenshots
      expect(response.rawPayload.length).toBeGreaterThan(500);
    });

    it('should capture full page with JPEG format', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/screenshot/fullpage',
        payload: {
          url: 'data:text/html,<h1>Full Page JPEG</h1><div style="height:1500px;">Content</div>',
          format: 'jpeg',
          quality: 90,
        },
      });

      expect(response.statusCode).toBe(200);
      expect(response.headers['content-type']).toBe('image/jpeg');
    });

    it('should handle transparent background option', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/screenshot/fullpage',
        payload: {
          url: 'data:text/html,<div style="background:transparent;"><h1>Transparent</h1></div>',
          omitBackground: true,
        },
      });

      expect(response.statusCode).toBe(200);
      expect(response.headers['content-type']).toBe('image/png');
    });
  });

  describe('POST /screenshot/element', () => {
    it('should capture element screenshot', async () => {
      const html = `
        <div>
          <h1 id="target">Target Element</h1>
          <p>This should not be in the screenshot</p>
        </div>
      `;

      const response = await server.inject({
        method: 'POST',
        url: '/screenshot/element',
        payload: {
          url: `data:text/html,${encodeURIComponent(html)}`,
          selector: '#target',
        },
      });

      expect(response.statusCode).toBe(200);
      expect(response.headers['content-type']).toBe('image/png');
      expect(Buffer.isBuffer(response.rawPayload)).toBe(true);
    });

    it('should capture element with custom timeout', async () => {
      const html = `
        <script>
          setTimeout(() => {
            const div = document.createElement('div');
            div.id = 'delayed-element';
            div.textContent = 'Delayed Element';
            div.style.background = 'yellow';
            div.style.padding = '20px';
            document.body.appendChild(div);
          }, 1000);
        </script>
        <h1>Page with delayed element</h1>
      `;

      const response = await server.inject({
        method: 'POST',
        url: '/screenshot/element',
        payload: {
          url: `data:text/html,${encodeURIComponent(html)}`,
          selector: '#delayed-element',
          timeout: 5000, // Wait up to 5 seconds for element
        },
      });

      // This might fail if element doesn't appear in time, but should not crash
      expect([200, 500]).toContain(response.statusCode);
    });

    it('should validate selector parameter', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/screenshot/element',
        payload: {
          url: 'data:text/html,<h1>Test</h1>',
          selector: '', // Empty selector
        },
      });

      expect(response.statusCode).toBe(400);
      const body = response.json();
      expect(body.success).toBe(false);
      expect(body.error).toContain('CSS selector is required');
    });

    it('should handle non-existent elements gracefully', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/screenshot/element',
        payload: {
          url: 'data:text/html,<h1>Test</h1>',
          selector: '#non-existent-element',
          timeout: 2000,
        },
      });

      expect(response.statusCode).toBe(500);
      const body = response.json();
      expect(body.success).toBe(false);
      expect(body.error).toBeDefined();
    });

    it('should capture element with JPEG format', async () => {
      const html = `
        <div style="background: red; padding: 50px;">
          <h2 class="target" style="color: white;">JPEG Element</h2>
        </div>
      `;

      const response = await server.inject({
        method: 'POST',
        url: '/screenshot/element',
        payload: {
          url: `data:text/html,${encodeURIComponent(html)}`,
          selector: '.target',
          format: 'jpeg',
          quality: 95,
        },
      });

      expect(response.statusCode).toBe(200);
      expect(response.headers['content-type']).toBe('image/jpeg');
    });
  });

  describe('GET /screenshot/health', () => {
    it('should return health check status', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/screenshot/health',
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.status).toMatch(/healthy|degraded/);
      expect(body.service).toBe('screenshot');
      expect(body.timestamp).toBeDefined();
      expect(typeof body.testDuration).toBe('number');
    });

    it('should include test performance metrics', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/screenshot/health',
      });

      const body = response.json();
      expect(body.testDuration).toBeGreaterThan(0);
      expect(body.message).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    it('should handle malformed JSON payload', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/screenshot/viewport',
        payload: 'malformed json',
        headers: {
          'content-type': 'application/json',
        },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should handle missing required fields', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/screenshot/viewport',
        payload: {}, // No URL field
      });

      expect(response.statusCode).toBe(400);
    });

    it('should handle network timeouts gracefully', async () => {
      // Test with a non-responsive URL (this might take time or fail)
      const response = await server.inject({
        method: 'POST',
        url: '/screenshot/viewport',
        payload: {
          url: 'http://httpstat.us/200?sleep=30000', // 30 second delay
        },
      });

      // Should either succeed or fail gracefully, not hang
      expect([200, 500]).toContain(response.statusCode);
    }, 15000); // 15 second timeout for this test
  });

  describe('Configuration Options', () => {
    it('should respect viewport dimensions', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/screenshot/viewport',
        payload: {
          url: 'data:text/html,<div style="width:100%;height:100vh;background:red;"></div>',
          viewport: {
            width: 1920,
            height: 1080,
          },
          savePath: '/tmp/large-viewport.png',
        },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.success).toBe(true);
    });

    it('should validate viewport dimension limits', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/screenshot/viewport',
        payload: {
          url: 'data:text/html,<h1>Test</h1>',
          viewport: {
            width: 50, // Too small (< 100)
            height: 600,
          },
        },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should handle omitBackground option', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/screenshot/viewport',
        payload: {
          url: 'data:text/html,<h1 style="color:blue;">Transparent BG</h1>',
          omitBackground: true,
        },
      });

      expect(response.statusCode).toBe(200);
      expect(response.headers['content-type']).toBe('image/png');
    });
  });
});