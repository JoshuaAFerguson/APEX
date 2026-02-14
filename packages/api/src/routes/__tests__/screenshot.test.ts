/**
 * @apexcli/api - Screenshot Routes Tests
 *
 * Comprehensive unit tests for the screenshot REST API endpoints
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import { registerScreenshotRoutes } from '../screenshot.js';

// Mock the screenshot service
vi.mock('../../services/screenshot-service.js', () => ({
  screenshotService: {
    captureViewport: vi.fn(),
    captureFullPage: vi.fn(),
    captureElement: vi.fn(),
  },
}));

describe('Screenshot Routes', () => {
  let app: FastifyInstance;
  let mockScreenshotService: any;

  beforeEach(async () => {
    // Import the mocked service
    const { screenshotService } = await import('../../services/screenshot-service.js');
    mockScreenshotService = screenshotService;

    // Create Fastify instance
    app = Fastify();
    await registerScreenshotRoutes(app);
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
    vi.clearAllMocks();
  });

  describe('POST /screenshot/viewport', () => {
    it('should capture viewport screenshot successfully', async () => {
      const mockBuffer = Buffer.from('fake-image-data');
      mockScreenshotService.captureViewport.mockResolvedValue({
        success: true,
        buffer: mockBuffer,
        format: 'png',
        duration: 1500,
        dimensions: { width: 800, height: 600 },
      });

      const response = await app.inject({
        method: 'POST',
        url: '/screenshot/viewport',
        headers: { 'Content-Type': 'application/json' },
        payload: {
          url: 'https://example.com',
          format: 'png',
          viewport: { width: 800, height: 600 },
        },
      });

      expect(response.statusCode).toBe(200);
      expect(response.headers['content-type']).toBe('image/png');
      expect(response.headers['content-disposition']).toContain('screenshot.png');
      expect(mockScreenshotService.captureViewport).toHaveBeenCalledWith('https://example.com', {
        format: 'png',
        quality: undefined,
        omitBackground: undefined,
        viewport: { width: 800, height: 600 },
        savePath: undefined,
      });
    });

    it('should capture JPEG screenshot with quality', async () => {
      const mockBuffer = Buffer.from('fake-jpeg-data');
      mockScreenshotService.captureViewport.mockResolvedValue({
        success: true,
        buffer: mockBuffer,
        format: 'jpeg',
        duration: 1200,
      });

      const response = await app.inject({
        method: 'POST',
        url: '/screenshot/viewport',
        headers: { 'Content-Type': 'application/json' },
        payload: {
          url: 'https://example.com',
          format: 'jpeg',
          quality: 85,
        },
      });

      expect(response.statusCode).toBe(200);
      expect(response.headers['content-type']).toBe('image/jpeg');
      expect(mockScreenshotService.captureViewport).toHaveBeenCalledWith('https://example.com', {
        format: 'jpeg',
        quality: 85,
        omitBackground: undefined,
        viewport: undefined,
        savePath: undefined,
      });
    });

    it('should return metadata when savePath is provided', async () => {
      mockScreenshotService.captureViewport.mockResolvedValue({
        success: true,
        format: 'png',
        duration: 1800,
        filePath: '/tmp/screenshot.png',
        dimensions: { width: 1200, height: 800 },
      });

      const response = await app.inject({
        method: 'POST',
        url: '/screenshot/viewport',
        headers: { 'Content-Type': 'application/json' },
        payload: {
          url: 'https://example.com',
          savePath: '/tmp/screenshot.png',
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body).toEqual({
        success: true,
        format: 'png',
        duration: 1800,
        filePath: '/tmp/screenshot.png',
        dimensions: { width: 1200, height: 800 },
      });
    });

    it('should return 400 for invalid URL', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/screenshot/viewport',
        headers: { 'Content-Type': 'application/json' },
        payload: {
          url: 'not-a-valid-url',
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(false);
      expect(body.error).toBe('Invalid URL provided');
    });

    it('should return 400 for missing URL', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/screenshot/viewport',
        headers: { 'Content-Type': 'application/json' },
        payload: {},
      });

      expect(response.statusCode).toBe(400);
    });

    it('should return 400 for invalid JPEG quality', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/screenshot/viewport',
        headers: { 'Content-Type': 'application/json' },
        payload: {
          url: 'https://example.com',
          format: 'jpeg',
          quality: 150, // Invalid: > 100
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('JPEG quality must be between 0 and 100');
    });

    it('should return 500 when screenshot service fails', async () => {
      mockScreenshotService.captureViewport.mockResolvedValue({
        success: false,
        error: 'Navigation failed',
      });

      const response = await app.inject({
        method: 'POST',
        url: '/screenshot/viewport',
        headers: { 'Content-Type': 'application/json' },
        payload: {
          url: 'https://example.com',
        },
      });

      expect(response.statusCode).toBe(500);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(false);
      expect(body.error).toBe('Navigation failed');
    });

    it('should handle service exceptions gracefully', async () => {
      mockScreenshotService.captureViewport.mockRejectedValue(new Error('Service crashed'));

      const response = await app.inject({
        method: 'POST',
        url: '/screenshot/viewport',
        headers: { 'Content-Type': 'application/json' },
        payload: {
          url: 'https://example.com',
        },
      });

      expect(response.statusCode).toBe(500);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(false);
      expect(body.error).toBe('Internal server error during screenshot capture');
    });

    it('should accept data URLs for testing', async () => {
      const mockBuffer = Buffer.from('fake-data-url-screenshot');
      mockScreenshotService.captureViewport.mockResolvedValue({
        success: true,
        buffer: mockBuffer,
        format: 'png',
        duration: 500,
      });

      const response = await app.inject({
        method: 'POST',
        url: '/screenshot/viewport',
        headers: { 'Content-Type': 'application/json' },
        payload: {
          url: 'data:text/html,<h1>Test</h1>',
        },
      });

      expect(response.statusCode).toBe(200);
      expect(mockScreenshotService.captureViewport).toHaveBeenCalledWith('data:text/html,<h1>Test</h1>', expect.any(Object));
    });
  });

  describe('POST /screenshot/fullpage', () => {
    it('should capture full page screenshot successfully', async () => {
      const mockBuffer = Buffer.from('fake-fullpage-data');
      mockScreenshotService.captureFullPage.mockResolvedValue({
        success: true,
        buffer: mockBuffer,
        format: 'png',
        duration: 2500,
        dimensions: { width: 800, height: 2000 },
      });

      const response = await app.inject({
        method: 'POST',
        url: '/screenshot/fullpage',
        headers: { 'Content-Type': 'application/json' },
        payload: {
          url: 'https://example.com',
          format: 'png',
        },
      });

      expect(response.statusCode).toBe(200);
      expect(response.headers['content-type']).toBe('image/png');
      expect(response.headers['content-disposition']).toContain('fullpage-screenshot.png');
      expect(mockScreenshotService.captureFullPage).toHaveBeenCalledWith('https://example.com', {
        format: 'png',
        quality: undefined,
        omitBackground: undefined,
        viewport: undefined,
        savePath: undefined,
      });
    });

    it('should handle transparent background option', async () => {
      const mockBuffer = Buffer.from('fake-transparent-data');
      mockScreenshotService.captureFullPage.mockResolvedValue({
        success: true,
        buffer: mockBuffer,
        format: 'png',
        duration: 1800,
      });

      const response = await app.inject({
        method: 'POST',
        url: '/screenshot/fullpage',
        headers: { 'Content-Type': 'application/json' },
        payload: {
          url: 'https://example.com',
          format: 'png',
          omitBackground: true,
        },
      });

      expect(response.statusCode).toBe(200);
      expect(mockScreenshotService.captureFullPage).toHaveBeenCalledWith('https://example.com', {
        format: 'png',
        quality: undefined,
        omitBackground: true,
        viewport: undefined,
        savePath: undefined,
      });
    });

    it('should return 400 for invalid URL', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/screenshot/fullpage',
        headers: { 'Content-Type': 'application/json' },
        payload: {
          url: 'invalid-url',
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('Invalid URL provided');
    });

    it('should return 500 when service fails', async () => {
      mockScreenshotService.captureFullPage.mockResolvedValue({
        success: false,
        error: 'Page too large',
      });

      const response = await app.inject({
        method: 'POST',
        url: '/screenshot/fullpage',
        headers: { 'Content-Type': 'application/json' },
        payload: {
          url: 'https://example.com',
        },
      });

      expect(response.statusCode).toBe(500);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('Page too large');
    });
  });

  describe('POST /screenshot/element', () => {
    it('should capture element screenshot successfully', async () => {
      const mockBuffer = Buffer.from('fake-element-data');
      mockScreenshotService.captureElement.mockResolvedValue({
        success: true,
        buffer: mockBuffer,
        format: 'png',
        duration: 1000,
        dimensions: { width: 200, height: 100 },
      });

      const response = await app.inject({
        method: 'POST',
        url: '/screenshot/element',
        headers: { 'Content-Type': 'application/json' },
        payload: {
          url: 'https://example.com',
          selector: '#main-content',
        },
      });

      expect(response.statusCode).toBe(200);
      expect(response.headers['content-type']).toBe('image/png');
      expect(response.headers['content-disposition']).toContain('element-screenshot.png');
      expect(mockScreenshotService.captureElement).toHaveBeenCalledWith('https://example.com', {
        selector: '#main-content',
        format: undefined,
        quality: undefined,
        omitBackground: undefined,
        timeout: undefined,
        viewport: undefined,
        savePath: undefined,
      });
    });

    it('should handle complex CSS selectors', async () => {
      const mockBuffer = Buffer.from('fake-complex-selector-data');
      mockScreenshotService.captureElement.mockResolvedValue({
        success: true,
        buffer: mockBuffer,
        format: 'jpeg',
        duration: 1500,
      });

      const response = await app.inject({
        method: 'POST',
        url: '/screenshot/element',
        headers: { 'Content-Type': 'application/json' },
        payload: {
          url: 'https://example.com',
          selector: '[data-testid="complex-element"]',
          format: 'jpeg',
          quality: 90,
          timeout: 5000,
        },
      });

      expect(response.statusCode).toBe(200);
      expect(response.headers['content-type']).toBe('image/jpeg');
      expect(mockScreenshotService.captureElement).toHaveBeenCalledWith('https://example.com', {
        selector: '[data-testid="complex-element"]',
        format: 'jpeg',
        quality: 90,
        omitBackground: undefined,
        timeout: 5000,
        viewport: undefined,
        savePath: undefined,
      });
    });

    it('should return 400 for missing URL', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/screenshot/element',
        headers: { 'Content-Type': 'application/json' },
        payload: {
          selector: '#test',
        },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should return 400 for missing selector', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/screenshot/element',
        headers: { 'Content-Type': 'application/json' },
        payload: {
          url: 'https://example.com',
        },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should return 400 for empty selector', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/screenshot/element',
        headers: { 'Content-Type': 'application/json' },
        payload: {
          url: 'https://example.com',
          selector: '   ',
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('CSS selector is required');
    });

    it('should return 500 when element not found', async () => {
      mockScreenshotService.captureElement.mockResolvedValue({
        success: false,
        error: 'Element not found: #non-existent',
        duration: 5000,
      });

      const response = await app.inject({
        method: 'POST',
        url: '/screenshot/element',
        headers: { 'Content-Type': 'application/json' },
        payload: {
          url: 'https://example.com',
          selector: '#non-existent',
        },
      });

      expect(response.statusCode).toBe(500);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('Element not found: #non-existent');
    });

    it('should trim selector whitespace', async () => {
      const mockBuffer = Buffer.from('fake-trimmed-data');
      mockScreenshotService.captureElement.mockResolvedValue({
        success: true,
        buffer: mockBuffer,
        format: 'png',
        duration: 800,
      });

      const response = await app.inject({
        method: 'POST',
        url: '/screenshot/element',
        headers: { 'Content-Type': 'application/json' },
        payload: {
          url: 'https://example.com',
          selector: '  #trimmed-selector  ',
        },
      });

      expect(response.statusCode).toBe(200);
      expect(mockScreenshotService.captureElement).toHaveBeenCalledWith('https://example.com', {
        selector: '#trimmed-selector',
        format: undefined,
        quality: undefined,
        omitBackground: undefined,
        timeout: undefined,
        viewport: undefined,
        savePath: undefined,
      });
    });
  });

  describe('GET /screenshot/health', () => {
    it('should return healthy status when service works', async () => {
      mockScreenshotService.captureViewport.mockResolvedValue({
        success: true,
        duration: 300,
      });

      const response = await app.inject({
        method: 'GET',
        url: '/screenshot/health',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.status).toBe('healthy');
      expect(body.service).toBe('screenshot');
      expect(body.testDuration).toBe(300);
      expect(body.message).toBe('Screenshot service operational');
      expect(body.timestamp).toBeDefined();
    });

    it('should return degraded status when service fails', async () => {
      mockScreenshotService.captureViewport.mockResolvedValue({
        success: false,
        error: 'Browser failed to start',
        duration: 1000,
      });

      const response = await app.inject({
        method: 'GET',
        url: '/screenshot/health',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.status).toBe('degraded');
      expect(body.service).toBe('screenshot');
      expect(body.testDuration).toBe(1000);
      expect(body.message).toBe('Screenshot service degraded');
    });

    it('should return unhealthy status when service throws exception', async () => {
      mockScreenshotService.captureViewport.mockRejectedValue(new Error('Service unavailable'));

      const response = await app.inject({
        method: 'GET',
        url: '/screenshot/health',
      });

      expect(response.statusCode).toBe(503);
      const body = JSON.parse(response.body);
      expect(body.status).toBe('unhealthy');
      expect(body.service).toBe('screenshot');
      expect(body.error).toBe('Service unavailable');
      expect(body.timestamp).toBeDefined();
    });
  });

  describe('Schema validation', () => {
    it('should validate viewport dimensions', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/screenshot/viewport',
        headers: { 'Content-Type': 'application/json' },
        payload: {
          url: 'https://example.com',
          viewport: {
            width: 50, // Too small
            height: 600,
          },
        },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should validate quality range', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/screenshot/viewport',
        headers: { 'Content-Type': 'application/json' },
        payload: {
          url: 'https://example.com',
          format: 'jpeg',
          quality: -1, // Invalid
        },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should validate format enum', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/screenshot/viewport',
        headers: { 'Content-Type': 'application/json' },
        payload: {
          url: 'https://example.com',
          format: 'gif', // Not supported
        },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should validate timeout range for element endpoint', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/screenshot/element',
        headers: { 'Content-Type': 'application/json' },
        payload: {
          url: 'https://example.com',
          selector: '#test',
          timeout: 500, // Too low
        },
      });

      expect(response.statusCode).toBe(400);
    });
  });
});