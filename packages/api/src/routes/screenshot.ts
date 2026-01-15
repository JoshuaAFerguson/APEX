/**
 * @apexcli/api - Screenshot Routes
 *
 * REST API endpoints for screenshot capture functionality
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { screenshotService, type ScreenshotConfig, type ElementScreenshotConfig } from '../services/screenshot-service.js';

// Request body types for screenshot endpoints
interface ScreenshotViewportRequest {
  url: string;
  format?: 'png' | 'jpeg';
  quality?: number;
  omitBackground?: boolean;
  viewport?: {
    width: number;
    height: number;
  };
  savePath?: string;
}

interface ScreenshotFullPageRequest {
  url: string;
  format?: 'png' | 'jpeg';
  quality?: number;
  omitBackground?: boolean;
  viewport?: {
    width: number;
    height: number;
  };
  savePath?: string;
}

interface ScreenshotElementRequest {
  url: string;
  selector: string;
  format?: 'png' | 'jpeg';
  quality?: number;
  omitBackground?: boolean;
  timeout?: number;
  viewport?: {
    width: number;
    height: number;
  };
  savePath?: string;
}

/**
 * Register screenshot routes with Fastify instance
 */
export async function registerScreenshotRoutes(app: FastifyInstance): Promise<void> {
  // Capture viewport screenshot
  app.post<{ Body: ScreenshotViewportRequest }>(
    '/screenshot/viewport',
    {
      schema: {
        description: 'Capture a screenshot of the current viewport',
        tags: ['screenshot'],
        body: {
          type: 'object',
          required: ['url'],
          properties: {
            url: {
              type: 'string',
              format: 'uri',
              description: 'URL of the page to capture'
            },
            format: {
              type: 'string',
              enum: ['png', 'jpeg'],
              description: 'Image format (default: png)'
            },
            quality: {
              type: 'number',
              minimum: 0,
              maximum: 100,
              description: 'JPEG quality (0-100, only applies to JPEG format)'
            },
            omitBackground: {
              type: 'boolean',
              description: 'Whether to omit the background (transparent for PNG)'
            },
            viewport: {
              type: 'object',
              properties: {
                width: { type: 'number', minimum: 100, maximum: 4000 },
                height: { type: 'number', minimum: 100, maximum: 4000 }
              },
              description: 'Viewport dimensions'
            },
            savePath: {
              type: 'string',
              description: 'Optional file path to save the screenshot'
            }
          }
        },
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              format: { type: 'string' },
              duration: { type: 'number' },
              filePath: { type: 'string' },
              dimensions: {
                type: 'object',
                properties: {
                  width: { type: 'number' },
                  height: { type: 'number' }
                }
              }
            }
          }
        }
      }
    },
    async (request: FastifyRequest<{ Body: ScreenshotViewportRequest }>, reply: FastifyReply) => {
      const { url, format, quality, omitBackground, viewport, savePath } = request.body;

      // Validate URL
      if (!url || !isValidUrl(url)) {
        return reply.status(400).send({
          success: false,
          error: 'Invalid URL provided'
        });
      }

      // Validate quality for JPEG
      if (format === 'jpeg' && quality !== undefined && (quality < 0 || quality > 100)) {
        return reply.status(400).send({
          success: false,
          error: 'JPEG quality must be between 0 and 100'
        });
      }

      try {
        const config: ScreenshotConfig = {
          format,
          quality,
          omitBackground,
          viewport,
          savePath,
        };

        const result = await screenshotService.captureViewport(url, config);

        if (!result.success) {
          return reply.status(500).send({
            success: false,
            error: result.error || 'Screenshot capture failed'
          });
        }

        // If buffer is returned and no save path, return the image directly
        if (result.buffer && !savePath) {
          const contentType = format === 'jpeg' ? 'image/jpeg' : 'image/png';
          return reply
            .type(contentType)
            .header('Content-Disposition', 'inline; filename=screenshot.' + (format || 'png'))
            .send(result.buffer);
        }

        // Return success response with metadata
        return reply.send({
          success: true,
          format: result.format,
          duration: result.duration,
          filePath: result.filePath,
          dimensions: result.dimensions
        });

      } catch (error) {
        app.log.error('Viewport screenshot error:', error);
        return reply.status(500).send({
          success: false,
          error: 'Internal server error during screenshot capture'
        });
      }
    }
  );

  // Capture full page screenshot
  app.post<{ Body: ScreenshotFullPageRequest }>(
    '/screenshot/fullpage',
    {
      schema: {
        description: 'Capture a screenshot of the full scrollable page',
        tags: ['screenshot'],
        body: {
          type: 'object',
          required: ['url'],
          properties: {
            url: {
              type: 'string',
              format: 'uri',
              description: 'URL of the page to capture'
            },
            format: {
              type: 'string',
              enum: ['png', 'jpeg'],
              description: 'Image format (default: png)'
            },
            quality: {
              type: 'number',
              minimum: 0,
              maximum: 100,
              description: 'JPEG quality (0-100, only applies to JPEG format)'
            },
            omitBackground: {
              type: 'boolean',
              description: 'Whether to omit the background (transparent for PNG)'
            },
            viewport: {
              type: 'object',
              properties: {
                width: { type: 'number', minimum: 100, maximum: 4000 },
                height: { type: 'number', minimum: 100, maximum: 4000 }
              },
              description: 'Viewport dimensions'
            },
            savePath: {
              type: 'string',
              description: 'Optional file path to save the screenshot'
            }
          }
        }
      }
    },
    async (request: FastifyRequest<{ Body: ScreenshotFullPageRequest }>, reply: FastifyReply) => {
      const { url, format, quality, omitBackground, viewport, savePath } = request.body;

      // Validate URL
      if (!url || !isValidUrl(url)) {
        return reply.status(400).send({
          success: false,
          error: 'Invalid URL provided'
        });
      }

      // Validate quality for JPEG
      if (format === 'jpeg' && quality !== undefined && (quality < 0 || quality > 100)) {
        return reply.status(400).send({
          success: false,
          error: 'JPEG quality must be between 0 and 100'
        });
      }

      try {
        const config: ScreenshotConfig = {
          format,
          quality,
          omitBackground,
          viewport,
          savePath,
        };

        const result = await screenshotService.captureFullPage(url, config);

        if (!result.success) {
          return reply.status(500).send({
            success: false,
            error: result.error || 'Screenshot capture failed'
          });
        }

        // If buffer is returned and no save path, return the image directly
        if (result.buffer && !savePath) {
          const contentType = format === 'jpeg' ? 'image/jpeg' : 'image/png';
          return reply
            .type(contentType)
            .header('Content-Disposition', 'inline; filename=fullpage-screenshot.' + (format || 'png'))
            .send(result.buffer);
        }

        // Return success response with metadata
        return reply.send({
          success: true,
          format: result.format,
          duration: result.duration,
          filePath: result.filePath,
          dimensions: result.dimensions
        });

      } catch (error) {
        app.log.error('Full page screenshot error:', error);
        return reply.status(500).send({
          success: false,
          error: 'Internal server error during screenshot capture'
        });
      }
    }
  );

  // Capture element screenshot
  app.post<{ Body: ScreenshotElementRequest }>(
    '/screenshot/element',
    {
      schema: {
        description: 'Capture a screenshot of a specific element',
        tags: ['screenshot'],
        body: {
          type: 'object',
          required: ['url', 'selector'],
          properties: {
            url: {
              type: 'string',
              format: 'uri',
              description: 'URL of the page containing the element'
            },
            selector: {
              type: 'string',
              description: 'CSS selector for the target element'
            },
            format: {
              type: 'string',
              enum: ['png', 'jpeg'],
              description: 'Image format (default: png)'
            },
            quality: {
              type: 'number',
              minimum: 0,
              maximum: 100,
              description: 'JPEG quality (0-100, only applies to JPEG format)'
            },
            omitBackground: {
              type: 'boolean',
              description: 'Whether to omit the background (transparent for PNG)'
            },
            timeout: {
              type: 'number',
              minimum: 1000,
              maximum: 60000,
              description: 'Timeout in milliseconds for finding the element'
            },
            viewport: {
              type: 'object',
              properties: {
                width: { type: 'number', minimum: 100, maximum: 4000 },
                height: { type: 'number', minimum: 100, maximum: 4000 }
              },
              description: 'Viewport dimensions'
            },
            savePath: {
              type: 'string',
              description: 'Optional file path to save the screenshot'
            }
          }
        }
      }
    },
    async (request: FastifyRequest<{ Body: ScreenshotElementRequest }>, reply: FastifyReply) => {
      const { url, selector, format, quality, omitBackground, timeout, viewport, savePath } = request.body;

      // Validate URL
      if (!url || !isValidUrl(url)) {
        return reply.status(400).send({
          success: false,
          error: 'Invalid URL provided'
        });
      }

      // Validate selector
      if (!selector || !selector.trim()) {
        return reply.status(400).send({
          success: false,
          error: 'CSS selector is required'
        });
      }

      // Validate quality for JPEG
      if (format === 'jpeg' && quality !== undefined && (quality < 0 || quality > 100)) {
        return reply.status(400).send({
          success: false,
          error: 'JPEG quality must be between 0 and 100'
        });
      }

      try {
        const config: ElementScreenshotConfig = {
          selector: selector.trim(),
          format,
          quality,
          omitBackground,
          timeout,
          viewport,
          savePath,
        };

        const result = await screenshotService.captureElement(url, config);

        if (!result.success) {
          return reply.status(500).send({
            success: false,
            error: result.error || 'Element screenshot capture failed'
          });
        }

        // If buffer is returned and no save path, return the image directly
        if (result.buffer && !savePath) {
          const contentType = format === 'jpeg' ? 'image/jpeg' : 'image/png';
          const filename = `element-screenshot.${format || 'png'}`;
          return reply
            .type(contentType)
            .header('Content-Disposition', `inline; filename=${filename}`)
            .send(result.buffer);
        }

        // Return success response with metadata
        return reply.send({
          success: true,
          format: result.format,
          duration: result.duration,
          filePath: result.filePath,
          dimensions: result.dimensions
        });

      } catch (error) {
        app.log.error('Element screenshot error:', error);
        return reply.status(500).send({
          success: false,
          error: 'Internal server error during element screenshot capture'
        });
      }
    }
  );

  // Health check endpoint for screenshot service
  app.get('/screenshot/health', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      // Test basic functionality with a simple capture
      const testResult = await screenshotService.captureViewport('data:text/html,<h1>Health Check</h1>', {
        format: 'png',
        viewport: { width: 100, height: 100 }
      });

      return reply.send({
        status: testResult.success ? 'healthy' : 'degraded',
        service: 'screenshot',
        timestamp: new Date().toISOString(),
        testDuration: testResult.duration,
        message: testResult.success ? 'Screenshot service operational' : 'Screenshot service degraded'
      });
    } catch (error) {
      app.log.error('Screenshot health check error:', error);
      return reply.status(503).send({
        status: 'unhealthy',
        service: 'screenshot',
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Health check failed'
      });
    }
  });
}

/**
 * Validate if a string is a valid URL
 */
function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    // Also allow data URLs for testing
    return url.startsWith('data:');
  }
}