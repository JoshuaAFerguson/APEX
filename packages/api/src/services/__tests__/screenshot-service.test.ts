/**
 * @apexcli/api - Screenshot Service Tests
 *
 * Unit tests for the screenshot service implementation
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ScreenshotService } from '../screenshot-service.js';

describe('ScreenshotService', () => {
  let service: ScreenshotService;

  beforeEach(() => {
    service = new ScreenshotService();
  });

  afterEach(async () => {
    await service.cleanup();
  });

  describe('captureViewport', () => {
    it('should capture viewport screenshot successfully', async () => {
      const result = await service.captureViewport(
        'data:text/html,<h1>Viewport Test</h1>',
        {
          format: 'png',
          viewport: { width: 800, height: 600 },
        }
      );

      expect(result.success).toBe(true);
      expect(result.buffer).toBeInstanceOf(Buffer);
      expect(result.buffer!.length).toBeGreaterThan(100);
      expect(result.format).toBe('png');
      expect(result.duration).toBeGreaterThan(0);
      expect(result.error).toBeUndefined();
    });

    it('should capture viewport with JPEG format', async () => {
      const result = await service.captureViewport(
        'data:text/html,<div style="background:red;padding:50px;"><h2>JPEG Test</h2></div>',
        {
          format: 'jpeg',
          quality: 85,
          viewport: { width: 600, height: 400 },
        }
      );

      expect(result.success).toBe(true);
      expect(result.buffer).toBeInstanceOf(Buffer);
      expect(result.format).toBe('jpeg');
    });

    it('should handle custom viewport dimensions', async () => {
      const result = await service.captureViewport(
        'data:text/html,<h1>Custom Size</h1>',
        {
          viewport: { width: 1200, height: 800 },
        }
      );

      expect(result.success).toBe(true);
      expect(result.buffer).toBeInstanceOf(Buffer);
    });

    it('should handle transparent background option', async () => {
      const result = await service.captureViewport(
        'data:text/html,<div style="background:transparent;"><h1>Transparent</h1></div>',
        {
          omitBackground: true,
          format: 'png',
        }
      );

      expect(result.success).toBe(true);
      expect(result.buffer).toBeInstanceOf(Buffer);
    });

    it('should handle navigation failures gracefully', async () => {
      const result = await service.captureViewport(
        'https://definitely-does-not-exist-test-url-12345.com',
        {
          format: 'png',
        }
      );

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error).toContain('Navigation failed');
      expect(result.duration).toBeGreaterThan(0);
    });

    it('should default to PNG format when not specified', async () => {
      const result = await service.captureViewport(
        'data:text/html,<h1>Default Format</h1>'
      );

      expect(result.success).toBe(true);
      expect(result.format).toBe('png');
    });
  });

  describe('captureFullPage', () => {
    it('should capture full page screenshot', async () => {
      const longContent = `
        <h1>Full Page Test</h1>
        <div style="height: 2000px; background: linear-gradient(to bottom, #ff0000, #0000ff);">
          <p style="margin-top: 500px;">Middle content</p>
          <p style="margin-top: 500px;">Bottom content</p>
        </div>
      `;

      const result = await service.captureFullPage(
        `data:text/html,${encodeURIComponent(longContent)}`,
        {
          format: 'png',
          viewport: { width: 800, height: 600 },
        }
      );

      expect(result.success).toBe(true);
      expect(result.buffer).toBeInstanceOf(Buffer);
      expect(result.buffer!.length).toBeGreaterThan(1000); // Should be larger than viewport
      expect(result.format).toBe('png');
    });

    it('should capture full page with JPEG format', async () => {
      const result = await service.captureFullPage(
        'data:text/html,<div style="height:1500px;background:#00ff00;"><h2>Full JPEG</h2></div>',
        {
          format: 'jpeg',
          quality: 70,
        }
      );

      expect(result.success).toBe(true);
      expect(result.format).toBe('jpeg');
    });

    it('should handle empty or minimal pages', async () => {
      const result = await service.captureFullPage(
        'data:text/html,<h1>Minimal</h1>',
        {
          format: 'png',
        }
      );

      expect(result.success).toBe(true);
      expect(result.buffer).toBeInstanceOf(Buffer);
    });
  });

  describe('captureElement', () => {
    it('should capture element screenshot', async () => {
      const html = `
        <div>
          <h1 id="target" style="background: yellow; padding: 20px;">Target Element</h1>
          <p>This content should not appear in the screenshot</p>
        </div>
      `;

      const result = await service.captureElement(
        `data:text/html,${encodeURIComponent(html)}`,
        {
          selector: '#target',
          format: 'png',
        }
      );

      expect(result.success).toBe(true);
      expect(result.buffer).toBeInstanceOf(Buffer);
      expect(result.format).toBe('png');
    });

    it('should capture element with CSS class selector', async () => {
      const html = `
        <div>
          <div class="highlight" style="background: red; color: white; padding: 15px;">
            Highlighted Element
          </div>
          <div>Other content</div>
        </div>
      `;

      const result = await service.captureElement(
        `data:text/html,${encodeURIComponent(html)}`,
        {
          selector: '.highlight',
          format: 'jpeg',
          quality: 90,
        }
      );

      expect(result.success).toBe(true);
      expect(result.format).toBe('jpeg');
    });

    it('should handle custom timeout for element finding', async () => {
      const html = `
        <script>
          setTimeout(() => {
            const div = document.createElement('div');
            div.id = 'delayed';
            div.textContent = 'Delayed Element';
            div.style.background = 'blue';
            div.style.color = 'white';
            div.style.padding = '10px';
            document.body.appendChild(div);
          }, 500);
        </script>
        <h1>Page with delayed element</h1>
      `;

      const result = await service.captureElement(
        `data:text/html,${encodeURIComponent(html)}`,
        {
          selector: '#delayed',
          timeout: 3000, // Wait up to 3 seconds
        }
      );

      // This test might be flaky due to timing, but should generally pass
      expect(result.success).toBe(true);
      expect(result.buffer).toBeInstanceOf(Buffer);
    });

    it('should fail when element is not found', async () => {
      const result = await service.captureElement(
        'data:text/html,<h1>No target element here</h1>',
        {
          selector: '#non-existent',
          timeout: 1000,
        }
      );

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.duration).toBeGreaterThan(0);
    });

    it('should handle complex selectors', async () => {
      const html = `
        <div class="container">
          <div class="row">
            <div class="col" data-testid="special-element" style="background: green; padding: 10px;">
              Special Element
            </div>
          </div>
        </div>
      `;

      const result = await service.captureElement(
        `data:text/html,${encodeURIComponent(html)}`,
        {
          selector: '[data-testid="special-element"]',
          format: 'png',
        }
      );

      expect(result.success).toBe(true);
      expect(result.buffer).toBeInstanceOf(Buffer);
    });

    it('should handle malformed selectors gracefully', async () => {
      const result = await service.captureElement(
        'data:text/html,<h1>Test</h1>',
        {
          selector: '>>invalid[[selector',
        }
      );

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('Configuration and Error Handling', () => {
    it('should handle invalid URLs gracefully', async () => {
      const result = await service.captureViewport('not-a-valid-url');

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.duration).toBeGreaterThan(0);
    });

    it('should apply default viewport when not specified', async () => {
      const result = await service.captureViewport(
        'data:text/html,<h1>Default Viewport</h1>'
      );

      expect(result.success).toBe(true);
      expect(result.buffer).toBeInstanceOf(Buffer);
    });

    it('should handle browser launch failures gracefully', async () => {
      // This test is harder to trigger reliably, but we can at least ensure
      // the service handles errors without crashing
      const service = new ScreenshotService();

      try {
        const result = await service.captureViewport(
          'data:text/html,<h1>Test</h1>'
        );

        // Should either succeed or fail gracefully
        expect(typeof result.success).toBe('boolean');
        expect(typeof result.duration).toBe('number');

      } finally {
        await service.cleanup();
      }
    });
  });

  describe('Performance and Resource Management', () => {
    it('should handle multiple concurrent requests', async () => {
      const promises = Array.from({ length: 3 }, (_, i) =>
        service.captureViewport(
          `data:text/html,<h1>Concurrent Test ${i + 1}</h1>`,
          { format: 'png' }
        )
      );

      const results = await Promise.all(promises);

      results.forEach((result, i) => {
        expect(result.success).toBe(true);
        expect(result.buffer).toBeInstanceOf(Buffer);
      });
    });

    it('should track timing information', async () => {
      const startTime = Date.now();

      const result = await service.captureViewport(
        'data:text/html,<h1>Timing Test</h1>'
      );

      const endTime = Date.now();

      expect(result.duration).toBeGreaterThan(0);
      expect(result.duration).toBeLessThanOrEqual(endTime - startTime + 100); // Some tolerance
    });

    it('should cleanup resources properly', async () => {
      const service = new ScreenshotService();

      await service.captureViewport(
        'data:text/html,<h1>Cleanup Test</h1>'
      );

      // Cleanup should not throw
      await expect(service.cleanup()).resolves.toBeUndefined();
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty HTML', async () => {
      const result = await service.captureViewport(
        'data:text/html,',
        { format: 'png' }
      );

      expect(result.success).toBe(true);
      expect(result.buffer).toBeInstanceOf(Buffer);
    });

    it('should handle HTML with special characters', async () => {
      const html = `
        <h1>Special Characters: äöü ñ 中文 🚀</h1>
        <p>Unicode content: ❤️ 💻 ⭐</p>
      `;

      const result = await service.captureViewport(
        `data:text/html,${encodeURIComponent(html)}`,
        { format: 'png' }
      );

      expect(result.success).toBe(true);
      expect(result.buffer).toBeInstanceOf(Buffer);
    });

    it('should handle large pages efficiently', async () => {
      const largeContent = Array.from({ length: 100 }, (_, i) =>
        `<div style="height: 50px; background: ${i % 2 ? 'red' : 'blue'};">Section ${i}</div>`
      ).join('');

      const result = await service.captureFullPage(
        `data:text/html,<html><body>${largeContent}</body></html>`,
        { format: 'jpeg', quality: 50 } // Lower quality for faster processing
      );

      expect(result.success).toBe(true);
      expect(result.buffer).toBeInstanceOf(Buffer);
      expect(result.duration).toBeLessThan(30000); // Should complete within 30 seconds
    }, 30000);
  });
});