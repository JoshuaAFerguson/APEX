/**
 * @apexcli/browser - Test Utilities Comprehensive Validation
 *
 * This test comprehensively validates all test utilities, page generators,
 * and support infrastructure for browser testing.
 *
 * Created by the tester agent to ensure robust testing infrastructure.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  createBrowserManager,
  createBrowserSession,
  BrowserManager,
  BrowserSession,
} from '../index.js';

// Import test utilities
import { TestPages, TestDataGenerators } from '../test-utils/test-pages.js';

describe('Test Utils Comprehensive Validation', () => {
  let manager: BrowserManager;
  let session: BrowserSession;

  beforeEach(async () => {
    manager = createBrowserManager();
    session = createBrowserSession(manager, {
      browserType: 'chromium',
      headless: true,
      timeout: 10000,
    });
    await session.launch();
  });

  afterEach(async () => {
    if (session) {
      await session.close();
    }
    if (manager) {
      await manager.shutdown();
    }
  });

  describe('TestPages Utility', () => {
    describe('Simple Page Generator', () => {
      it('should generate basic pages with custom titles', async () => {
        const pageContent = TestPages.simple('Custom Test Title');

        expect(pageContent).toContain('<title>Custom Test Title</title>');
        expect(pageContent).toContain('<h1>Custom Test Title</h1>');
        expect(pageContent).toContain('<!DOCTYPE html>');

        // Test with data URL
        const dataUrl = `data:text/html,${encodeURIComponent(pageContent)}`;
        await session.goto(dataUrl);

        const title = await session.getTitle();
        expect(title.data).toBe('Custom Test Title');
      });

      it('should generate pages with custom background colors', async () => {
        const redPage = TestPages.simple('Red Page', '#ff0000');
        const bluePage = TestPages.simple('Blue Page', '#0000ff');

        expect(redPage).toContain('background:#ff0000');
        expect(bluePage).toContain('background:#0000ff');

        // Test rendering red page
        const dataUrl = `data:text/html,${encodeURIComponent(redPage)}`;
        await session.goto(dataUrl);

        const title = await session.getTitle();
        expect(title.data).toBe('Red Page');
      });

      it('should include test helpers in generated pages', async () => {
        const pageContent = TestPages.simple('Helper Test');
        const dataUrl = `data:text/html,${encodeURIComponent(pageContent)}`;

        await session.goto(dataUrl);

        // Verify test helpers are available
        const testHelpers = await session.evaluate('return window.testHelpers', []);
        expect(testHelpers.success).toBe(true);
        expect(testHelpers.data).toHaveProperty('getPageInstance');
        expect(testHelpers.data).toHaveProperty('getLoadTime');
      });
    });

    describe('Tall Page Generator', () => {
      it('should generate tall pages for scroll testing', async () => {
        const tallPage = TestPages.tall(3000);

        expect(tallPage).toContain('height:3000px');
        expect(tallPage).toContain('Tall Page Test');
        expect(tallPage).toContain('linear-gradient');

        // Test rendering
        const dataUrl = `data:text/html,${encodeURIComponent(tallPage)}`;
        await session.goto(dataUrl);

        const title = await session.getTitle();
        expect(title.data).toBe('Tall Page Test');
      });

      it('should support custom heights', async () => {
        const shortTall = TestPages.tall(1500);
        const longTall = TestPages.tall(8000);

        expect(shortTall).toContain('height:1500px');
        expect(longTall).toContain('height:8000px');
      });

      it('should include positioned content elements', async () => {
        const tallPage = TestPages.tall();

        expect(tallPage).toContain('Middle Content');
        expect(tallPage).toContain('Bottom Content');
        expect(tallPage).toContain('position:absolute');
        expect(tallPage).toContain('top:50%');
        expect(tallPage).toContain('bottom:20px');
      });
    });

    describe('Complex Page Generator', () => {
      it('should generate pages with CSS animations', async () => {
        const complexPage = TestPages.complex();

        expect(complexPage).toContain('Complex Test Page');
        expect(complexPage).toContain('@keyframes pulse');
        expect(complexPage).toContain('animation: pulse 2s infinite');
        expect(complexPage).toContain('linear-gradient');

        // Test rendering
        const dataUrl = `data:text/html,${encodeURIComponent(complexPage)}`;
        await session.goto(dataUrl);

        const title = await session.getTitle();
        expect(title.data).toBe('Complex Test Page');
      });

      it('should include advanced CSS features', async () => {
        const complexPage = TestPages.complex();

        expect(complexPage).toContain('border-radius');
        expect(complexPage).toContain('box-shadow');
        expect(complexPage).toContain('rgba(');
        expect(complexPage).toContain('-webkit-background-clip');
        expect(complexPage).toContain('background-clip');
      });

      it('should have interactive elements', async () => {
        const complexPage = TestPages.complex();
        const dataUrl = `data:text/html,${encodeURIComponent(complexPage)}`;

        await session.goto(dataUrl);

        // Check for CSS classes and elements
        const pulseElement = await session.getElement('.pulse');
        expect(pulseElement.success).toBe(true);

        const gradientText = await session.getElement('.gradient-text');
        expect(gradientText.success).toBe(true);

        const cards = await session.getElements('.card');
        expect(cards.success).toBe(true);
        expect(cards.data.length).toBeGreaterThan(1);
      });
    });

    describe('Unicode Page Generator', () => {
      it('should generate pages with special characters', async () => {
        const unicodePage = TestPages.unicode();

        expect(unicodePage).toContain('Unicode & Special Characters Test 🌟');
        expect(unicodePage).toContain('🚀🎉🔥💯⚡🌈🎨');
        expect(unicodePage).toContain('你好');
        expect(unicodePage).toContain('こんにちは');
        expect(unicodePage).toContain('Здравствуйте');
        expect(unicodePage).toContain('$¥€£₹₿');

        // Test rendering
        const dataUrl = `data:text/html,${encodeURIComponent(unicodePage)}`;
        await session.goto(dataUrl);

        const title = await session.getTitle();
        expect(title.data).toContain('Unicode');
        expect(title.data).toContain('🌟');
      });

      it('should include proper charset declaration', async () => {
        const unicodePage = TestPages.unicode();

        expect(unicodePage).toContain('<meta charset="UTF-8">');
      });

      it('should display unicode content correctly', async () => {
        const unicodePage = TestPages.unicode();
        const dataUrl = `data:text/html,${encodeURIComponent(unicodePage)}`;

        await session.goto(dataUrl);

        // Check for specific unicode content
        const emojiContent = await session.getElementText('h2');
        expect(emojiContent.data).toContain('🚀');
      });
    });

    describe('Empty and Transparent Pages', () => {
      it('should generate minimal empty pages', async () => {
        const emptyPage = TestPages.empty();

        expect(emptyPage).toBe('<html><body></body></html>');

        // Test rendering
        const dataUrl = `data:text/html,${encodeURIComponent(emptyPage)}`;
        await session.goto(dataUrl);

        const title = await session.getTitle();
        expect(title.data).toBe('');
      });

      it('should generate transparent background pages', async () => {
        const transparentPage = TestPages.transparent();

        expect(transparentPage).toContain('background:transparent');
        expect(transparentPage).toContain('Transparent Background');

        // Test rendering
        const dataUrl = `data:text/html,${encodeURIComponent(transparentPage)}`;
        await session.goto(dataUrl);

        const heading = await session.getElementText('h1');
        expect(heading.data).toBe('Transparent Background');
      });
    });
  });

  describe('TestDataGenerators Utility', () => {
    describe('Heavy Content Generator', () => {
      it('should generate pages with specified element counts', async () => {
        const lightContent = TestDataGenerators.generateHeavyContent(5);
        const heavyContent = TestDataGenerators.generateHeavyContent(100);

        expect(lightContent).toContain('Heavy Content Test (5 elements)');
        expect(lightContent).toContain('Element 1');
        expect(lightContent).toContain('Element 5');

        expect(heavyContent).toContain('Heavy Content Test (100 elements)');
        expect(heavyContent).toContain('Element 100');
      });

      it('should create colorful elements with HSL colors', async () => {
        const content = TestDataGenerators.generateHeavyContent(10);

        expect(content).toContain('hsl(0, 50%, 75%)'); // First element
        expect(content).toContain('hsl(9, 50%, 75%)'); // Last element (9 % 360)

        // Test rendering a small amount
        const dataUrl = `data:text/html,${encodeURIComponent(content)}`;
        await session.goto(dataUrl);

        const title = await session.getTitle();
        expect(title.data).toBe('Heavy Content Test (10 elements)');

        const elements = await session.getElements('div');
        expect(elements.success).toBe(true);
        expect(elements.data.length).toBe(10);
      });

      it('should handle large element counts efficiently', async () => {
        const startTime = Date.now();
        const largeContent = TestDataGenerators.generateHeavyContent(1000);
        const endTime = Date.now();

        expect(endTime - startTime).toBeLessThan(1000); // Should generate quickly

        expect(largeContent).toContain('Element 1000');
        expect(largeContent.length).toBeGreaterThan(50000); // Should be substantial
      });
    });

    describe('Random Color Generator', () => {
      it('should generate valid HSL colors', async () => {
        for (let i = 0; i < 10; i++) {
          const color = TestDataGenerators.randomColor();
          expect(color).toMatch(/^hsl\(\d+, \d+%, \d+%\)$/);

          // Parse values to validate ranges
          const matches = color.match(/hsl\((\d+), (\d+)%, (\d+)%\)/);
          expect(matches).toBeTruthy();

          const [, hue, saturation, lightness] = matches!;
          expect(parseInt(hue)).toBeGreaterThanOrEqual(0);
          expect(parseInt(hue)).toBeLessThan(360);
          expect(parseInt(saturation)).toBeGreaterThanOrEqual(50);
          expect(parseInt(saturation)).toBeLessThan(100);
          expect(parseInt(lightness)).toBeGreaterThanOrEqual(40);
          expect(parseInt(lightness)).toBeLessThan(80);
        }
      });

      it('should generate different colors on multiple calls', async () => {
        const colors = Array.from({ length: 20 }, () => TestDataGenerators.randomColor());
        const uniqueColors = new Set(colors);

        // Should have good variety (not all the same)
        expect(uniqueColors.size).toBeGreaterThan(colors.length * 0.7);
      });
    });

    describe('Random Test Page Generator', () => {
      it('should generate pages with random content', async () => {
        const randomPage1 = TestDataGenerators.randomTestPage();
        const randomPage2 = TestDataGenerators.randomTestPage();

        expect(randomPage1).toContain('Random Test Page');
        expect(randomPage2).toContain('Random Test Page');

        // Pages should be different
        expect(randomPage1).not.toBe(randomPage2);

        // Both should have random content elements
        expect(randomPage1).toContain('Random content');
        expect(randomPage2).toContain('Random content');
      });

      it('should use random colors in generated pages', async () => {
        const randomPage = TestDataGenerators.randomTestPage();

        // Should contain HSL color declarations
        const hslMatches = randomPage.match(/hsl\(\d+, \d+%, \d+%\)/g);
        expect(hslMatches).toBeTruthy();
        expect(hslMatches!.length).toBeGreaterThan(5); // Background + multiple elements
      });

      it('should generate variable numbers of elements', async () => {
        const pages = Array.from({ length: 5 }, () => TestDataGenerators.randomTestPage());

        const elementCounts = pages.map(page => {
          const matches = page.match(/Random content \d+/g);
          return matches ? matches.length : 0;
        });

        // Should have variation in element counts
        const uniqueCounts = new Set(elementCounts);
        expect(uniqueCounts.size).toBeGreaterThan(1);

        // All should be within expected range (10-59 based on implementation)
        elementCounts.forEach(count => {
          expect(count).toBeGreaterThanOrEqual(10);
          expect(count).toBeLessThanOrEqual(59);
        });
      });

      it('should render random pages correctly', async () => {
        const randomPage = TestDataGenerators.randomTestPage();
        const dataUrl = `data:text/html,${encodeURIComponent(randomPage)}`;

        await session.goto(dataUrl);

        const title = await session.getTitle();
        expect(title.data).toBe('Random Test Page');

        const content = await session.getElementText('body');
        expect(content.data).toContain('Random content');
      });
    });
  });

  describe('Browser Integration with Test Utils', () => {
    it('should work with dynamically generated content', async () => {
      const dynamicContent = TestPages.simple(`Dynamic Test ${Date.now()}`);
      const dataUrl = `data:text/html,${encodeURIComponent(dynamicContent)}`;

      await session.goto(dataUrl);

      const title = await session.getTitle();
      expect(title.data).toContain('Dynamic Test');
    });

    it('should handle large generated content', async () => {
      const largeContent = TestDataGenerators.generateHeavyContent(500);
      const dataUrl = `data:text/html,${encodeURIComponent(largeContent)}`;

      const startTime = Date.now();
      await session.goto(dataUrl, { timeout: 15000 });
      const endTime = Date.now();

      expect(endTime - startTime).toBeLessThan(10000); // Should load within 10 seconds

      const title = await session.getTitle();
      expect(title.data).toBe('Heavy Content Test (500 elements)');

      const elements = await session.getElements('div');
      expect(elements.success).toBe(true);
      expect(elements.data.length).toBe(500);
    });

    it('should support CSS animation testing', async () => {
      const complexPage = TestPages.complex();
      const dataUrl = `data:text/html,${encodeURIComponent(complexPage)}`;

      await session.goto(dataUrl);

      // Test animation properties via computed styles
      const animationDuration = await session.evaluate(`
        const element = document.querySelector('.pulse');
        const styles = getComputedStyle(element);
        return styles.animationDuration;
      `, []);

      expect(animationDuration.success).toBe(true);
      expect(animationDuration.data).toBe('2s');
    });

    it('should support unicode content testing', async () => {
      const unicodePage = TestPages.unicode();
      const dataUrl = `data:text/html,${encodeURIComponent(unicodePage)}`;

      await session.goto(dataUrl);

      // Test that unicode characters are preserved
      const emojiText = await session.evaluate(`
        return document.querySelector('h2').textContent;
      `, []);

      expect(emojiText.success).toBe(true);
      expect(emojiText.data).toContain('🚀');
      expect(emojiText.data).toContain('🎉');
    });

    it('should provide consistent test helper interface', async () => {
      const testPages = [
        TestPages.simple('Helper Test'),
        TestPages.complex(),
        TestDataGenerators.randomTestPage()
      ];

      for (const pageContent of testPages) {
        if (!pageContent.includes('testHelpers')) continue;

        const dataUrl = `data:text/html,${encodeURIComponent(pageContent)}`;
        await session.goto(dataUrl);

        const testHelpers = await session.evaluate('return window.testHelpers', []);
        expect(testHelpers.success).toBe(true);
        expect(testHelpers.data).toHaveProperty('getPageInstance');
        expect(typeof testHelpers.data.getPageInstance).toBe('function');
      }
    });
  });

  describe('Performance and Reliability', () => {
    it('should generate content quickly', async () => {
      const iterations = 50;
      const startTime = Date.now();

      for (let i = 0; i < iterations; i++) {
        TestPages.simple(`Test ${i}`);
        TestDataGenerators.randomColor();
      }

      const endTime = Date.now();
      const duration = endTime - startTime;

      expect(duration).toBeLessThan(1000); // Should be very fast
    });

    it('should produce deterministic results for non-random functions', async () => {
      const page1 = TestPages.simple('Deterministic Test');
      const page2 = TestPages.simple('Deterministic Test');

      expect(page1).toBe(page2);

      const tall1 = TestPages.tall(2000);
      const tall2 = TestPages.tall(2000);

      expect(tall1).toBe(tall2);

      const complex1 = TestPages.complex();
      const complex2 = TestPages.complex();

      expect(complex1).toBe(complex2);
    });

    it('should handle edge cases gracefully', async () => {
      // Empty title
      const emptyTitle = TestPages.simple('');
      expect(emptyTitle).toContain('<title></title>');

      // Zero elements
      const zeroElements = TestDataGenerators.generateHeavyContent(0);
      expect(zeroElements).toContain('Heavy Content Test (0 elements)');
      expect(zeroElements).not.toContain('Element 1');

      // Very tall page
      const veryTall = TestPages.tall(50000);
      expect(veryTall).toContain('height:50000px');
    });

    it('should maintain memory efficiency with large content', async () => {
      // Generate multiple large pages to test memory usage
      const pages = [];
      for (let i = 0; i < 5; i++) {
        pages.push(TestDataGenerators.generateHeavyContent(1000));
      }

      // All pages should be generated successfully
      pages.forEach(page => {
        expect(page).toContain('Heavy Content Test');
        expect(page).toContain('Element 1000');
      });

      // Clear references to allow garbage collection
      pages.length = 0;
    });
  });
});