/**
 * @apexcli/browser - Test Pages Test Suite
 *
 * Comprehensive tests for test page generator utilities
 */

import { describe, it, expect } from 'vitest';
import { TestPages, TestDataGenerators } from '../test-pages.js';

describe('Test Pages', () => {
  describe('TestPages.simple', () => {
    it('should generate a simple test page with default values', () => {
      const html = TestPages.simple();

      expect(html).toContain('<html>');
      expect(html).toContain('<title>Test Page</title>');
      expect(html).toContain('<h1>Test Page</h1>');
      expect(html).toContain('background:#ffffff');
      expect(html).toContain('This is a test page for screenshot utilities');
      expect(html).toContain('font-family:Arial,sans-serif');
    });

    it('should accept custom title', () => {
      const html = TestPages.simple('My Custom Title');

      expect(html).toContain('<title>My Custom Title</title>');
      expect(html).toContain('<h1>My Custom Title</h1>');
    });

    it('should accept custom background color', () => {
      const html = TestPages.simple('Test', '#ff0000');

      expect(html).toContain('background:#ff0000');
    });

    it('should handle both custom title and background color', () => {
      const html = TestPages.simple('Red Page', '#ff0000');

      expect(html).toContain('<title>Red Page</title>');
      expect(html).toContain('<h1>Red Page</h1>');
      expect(html).toContain('background:#ff0000');
    });

    it('should generate valid HTML structure', () => {
      const html = TestPages.simple();

      expect(html).toContain('<html>');
      expect(html).toContain('<head>');
      expect(html).toContain('<body');
      expect(html).toContain('</body>');
      expect(html).toContain('</html>');
    });

    it('should include styling', () => {
      const html = TestPages.simple();

      expect(html).toContain('margin:0');
      expect(html).toContain('padding:20px');
      expect(html).toContain('font-family:Arial,sans-serif');
    });
  });

  describe('TestPages.tall', () => {
    it('should generate a tall page with default height', () => {
      const html = TestPages.tall();

      expect(html).toContain('height:5000px');
      expect(html).toContain('Tall Page Test');
      expect(html).toContain('Middle Content');
      expect(html).toContain('Bottom Content');
    });

    it('should accept custom height', () => {
      const html = TestPages.tall(3000);

      expect(html).toContain('height:3000px');
      expect(html).toContain('Tall Page Test');
    });

    it('should include gradient background', () => {
      const html = TestPages.tall();

      expect(html).toContain('background:linear-gradient');
      expect(html).toContain('#ff6b6b');
      expect(html).toContain('#4ecdc4');
      expect(html).toContain('#45b7d1');
    });

    it('should position content correctly', () => {
      const html = TestPages.tall();

      expect(html).toContain('position:absolute;top:50%');
      expect(html).toContain('position:absolute;bottom:20px');
      expect(html).toContain('transform:translate(-50%,-50%)');
    });

    it('should use white text color', () => {
      const html = TestPages.tall();

      expect(html).toContain('color:white');
    });

    it('should handle zero height', () => {
      const html = TestPages.tall(0);

      expect(html).toContain('height:0px');
    });

    it('should handle negative height gracefully', () => {
      const html = TestPages.tall(-100);

      expect(html).toContain('height:-100px');
    });
  });

  describe('TestPages.complex', () => {
    it('should generate complex page with CSS styles', () => {
      const html = TestPages.complex();

      expect(html).toContain('<style>');
      expect(html).toContain('Complex Test Page');
      expect(html).toContain('Features Tested:');
    });

    it('should include CSS animations', () => {
      const html = TestPages.complex();

      expect(html).toContain('@keyframes pulse');
      expect(html).toContain('animation: pulse 2s infinite');
      expect(html).toContain('transform: scale(1)');
      expect(html).toContain('transform: scale(1.05)');
    });

    it('should include gradient effects', () => {
      const html = TestPages.complex();

      expect(html).toContain('linear-gradient(45deg, #667eea, #764ba2)');
      expect(html).toContain('linear-gradient(45deg, #ff6b6b, #4ecdc4)');
      expect(html).toContain('-webkit-background-clip: text');
      expect(html).toContain('-webkit-text-fill-color: transparent');
    });

    it('should include modern CSS features', () => {
      const html = TestPages.complex();

      expect(html).toContain('border-radius: 15px');
      expect(html).toContain('box-shadow: 0 8px 32px rgba(0,0,0,0.1)');
      expect(html).toContain('rgba(255,255,255,0.9)');
    });

    it('should list tested features', () => {
      const html = TestPages.complex();

      expect(html).toContain('CSS Gradients');
      expect(html).toContain('Border Radius');
      expect(html).toContain('Box Shadows');
      expect(html).toContain('Animations');
      expect(html).toContain('Transparency');
    });

    it('should include card layout', () => {
      const html = TestPages.complex();

      expect(html).toContain('class="card');
      expect(html).toContain('class="pulse"');
      expect(html).toContain('class="gradient-text"');
    });
  });

  describe('TestPages.unicode', () => {
    it('should include UTF-8 charset declaration', () => {
      const html = TestPages.unicode();

      expect(html).toContain('<meta charset="UTF-8">');
    });

    it('should include emojis', () => {
      const html = TestPages.unicode();

      expect(html).toContain('🌟');
      expect(html).toContain('🚀🎉🔥💯⚡🌈🎨');
    });

    it('should include multiple languages', () => {
      const html = TestPages.unicode();

      expect(html).toContain('Hello');
      expect(html).toContain('你好');
      expect(html).toContain('こんにちは');
      expect(html).toContain('Здравствуйте');
      expect(html).toContain('مرحبا');
    });

    it('should include various symbols', () => {
      const html = TestPages.unicode();

      expect(html).toContain('♠♣♥♦');
      expect(html).toContain('☀☁☂☃');
      expect(html).toContain('✓✗⚠');
      expect(html).toContain('∑∏∫∆√∞');
    });

    it('should include currency symbols', () => {
      const html = TestPages.unicode();

      expect(html).toContain('$¥€£₹₿');
    });

    it('should have proper title', () => {
      const html = TestPages.unicode();

      expect(html).toContain('Unicode & Special Characters Test');
    });
  });

  describe('TestPages.empty', () => {
    it('should generate minimal HTML', () => {
      const html = TestPages.empty();

      expect(html).toBe('<html><body></body></html>');
    });

    it('should not contain any content', () => {
      const html = TestPages.empty();

      expect(html).not.toContain('<head>');
      expect(html).not.toContain('<title>');
      expect(html).not.toContain('<h1>');
      expect(html).not.toContain('<p>');
    });
  });

  describe('TestPages.transparent', () => {
    it('should have transparent background', () => {
      const html = TestPages.transparent();

      expect(html).toContain('background:transparent');
    });

    it('should include content', () => {
      const html = TestPages.transparent();

      expect(html).toContain('Transparent Background');
      expect(html).toContain('<h1');
    });

    it('should have visible text color', () => {
      const html = TestPages.transparent();

      expect(html).toContain('color:#333');
    });

    it('should include padding', () => {
      const html = TestPages.transparent();

      expect(html).toContain('padding:20px');
    });
  });
});

describe('TestDataGenerators', () => {
  describe('generateHeavyContent', () => {
    it('should generate specified number of elements', () => {
      const html = TestDataGenerators.generateHeavyContent(5);

      // Count the number of div elements
      const divMatches = html.match(/<div[^>]*>/g);
      expect(divMatches).toHaveLength(5);
    });

    it('should include title with element count', () => {
      const html = TestDataGenerators.generateHeavyContent(10);

      expect(html).toContain('Heavy Content Test (10 elements)');
    });

    it('should generate unique colors for elements', () => {
      const html = TestDataGenerators.generateHeavyContent(3);

      expect(html).toContain('hsl(0, 50%, 75%)'); // Element 1
      expect(html).toContain('hsl(1, 50%, 75%)'); // Element 2
      expect(html).toContain('hsl(2, 50%, 75%)'); // Element 3
    });

    it('should wrap hue values correctly', () => {
      const html = TestDataGenerators.generateHeavyContent(361);

      expect(html).toContain('hsl(0, 50%, 75%)'); // First element
      expect(html).toContain('hsl(0, 50%, 75%)'); // Element 361 (360 % 360 = 0)
    });

    it('should number elements sequentially', () => {
      const html = TestDataGenerators.generateHeavyContent(3);

      expect(html).toContain('Element 1');
      expect(html).toContain('Element 2');
      expect(html).toContain('Element 3');
    });

    it('should handle zero elements', () => {
      const html = TestDataGenerators.generateHeavyContent(0);

      expect(html).toContain('Heavy Content Test (0 elements)');
      const divMatches = html.match(/<div[^>]*>/g);
      expect(divMatches).toBeNull();
    });

    it('should include proper HTML structure', () => {
      const html = TestDataGenerators.generateHeavyContent(1);

      expect(html).toContain('<html>');
      expect(html).toContain('<body>');
      expect(html).toContain('</body>');
      expect(html).toContain('</html>');
    });

    it('should include padding for elements', () => {
      const html = TestDataGenerators.generateHeavyContent(1);

      expect(html).toContain('padding:10px');
    });
  });

  describe('randomColor', () => {
    it('should generate HSL color format', () => {
      const color = TestDataGenerators.randomColor();

      expect(color).toMatch(/^hsl\(\d+, \d+%, \d+%\)$/);
    });

    it('should generate hue between 0-359', () => {
      for (let i = 0; i < 10; i++) {
        const color = TestDataGenerators.randomColor();
        const hueMatch = color.match(/hsl\((\d+),/);
        expect(hueMatch).toBeTruthy();

        const hue = parseInt(hueMatch![1]);
        expect(hue).toBeGreaterThanOrEqual(0);
        expect(hue).toBeLessThan(360);
      }
    });

    it('should generate saturation between 50-99%', () => {
      for (let i = 0; i < 10; i++) {
        const color = TestDataGenerators.randomColor();
        const saturationMatch = color.match(/hsl\(\d+, (\d+)%/);
        expect(saturationMatch).toBeTruthy();

        const saturation = parseInt(saturationMatch![1]);
        expect(saturation).toBeGreaterThanOrEqual(50);
        expect(saturation).toBeLessThan(100);
      }
    });

    it('should generate lightness between 40-79%', () => {
      for (let i = 0; i < 10; i++) {
        const color = TestDataGenerators.randomColor();
        const lightnessMatch = color.match(/hsl\(\d+, \d+%, (\d+)%\)/);
        expect(lightnessMatch).toBeTruthy();

        const lightness = parseInt(lightnessMatch![1]);
        expect(lightness).toBeGreaterThanOrEqual(40);
        expect(lightness).toBeLessThan(80);
      }
    });

    it('should generate different colors on repeated calls', () => {
      const colors = new Set();
      for (let i = 0; i < 20; i++) {
        colors.add(TestDataGenerators.randomColor());
      }

      // Should generate at least some different colors
      expect(colors.size).toBeGreaterThan(1);
    });
  });

  describe('randomTestPage', () => {
    it('should generate valid HTML', () => {
      const html = TestDataGenerators.randomTestPage();

      expect(html).toContain('<html>');
      expect(html).toContain('<body');
      expect(html).toContain('</body>');
      expect(html).toContain('</html>');
    });

    it('should include Random Test Page title', () => {
      const html = TestDataGenerators.randomTestPage();

      expect(html).toContain('<h1>Random Test Page</h1>');
    });

    it('should use random background color', () => {
      const html = TestDataGenerators.randomTestPage();

      expect(html).toMatch(/background:hsl\(\d+, \d+%, \d+%\)/);
    });

    it('should use random text color', () => {
      const html = TestDataGenerators.randomTestPage();

      expect(html).toMatch(/color:hsl\(\d+, \d+%, \d+%\).*padding:20px/);
    });

    it('should generate random number of content elements', () => {
      const html = TestDataGenerators.randomTestPage();
      const paragraphs = html.match(/<p[^>]*>Random content/g);

      expect(paragraphs).toBeTruthy();
      expect(paragraphs!.length).toBeGreaterThanOrEqual(10);
      expect(paragraphs!.length).toBeLessThanOrEqual(59);
    });

    it('should give each paragraph random color', () => {
      const html = TestDataGenerators.randomTestPage();
      const coloredParagraphs = html.match(/<p style="color:hsl\(/g);

      expect(coloredParagraphs).toBeTruthy();
      expect(coloredParagraphs!.length).toBeGreaterThanOrEqual(10);
    });

    it('should number content sequentially', () => {
      const html = TestDataGenerators.randomTestPage();

      expect(html).toContain('Random content 1');
      expect(html).toContain('Random content 2');
    });

    it('should include padding on body', () => {
      const html = TestDataGenerators.randomTestPage();

      expect(html).toContain('padding:20px');
    });

    it('should generate different pages on repeated calls', () => {
      const page1 = TestDataGenerators.randomTestPage();
      const page2 = TestDataGenerators.randomTestPage();

      // Pages should be different (due to randomness)
      expect(page1).not.toBe(page2);
    });
  });

  describe('Edge cases and robustness', () => {
    it('should handle very large element counts in generateHeavyContent', () => {
      const html = TestDataGenerators.generateHeavyContent(1000);

      expect(html).toContain('Heavy Content Test (1000 elements)');
      expect(html).toContain('Element 1');
      expect(html).toContain('Element 1000');
    });

    it('should handle negative element count gracefully', () => {
      const html = TestDataGenerators.generateHeavyContent(-5);

      expect(html).toContain('Heavy Content Test (-5 elements)');
      // Should not generate any elements
      const divMatches = html.match(/<div[^>]*>/g);
      expect(divMatches).toBeNull();
    });

    it('should generate consistent random colors within expected range', () => {
      // Test many iterations to ensure randomness is working properly
      for (let i = 0; i < 100; i++) {
        const color = TestDataGenerators.randomColor();
        const match = color.match(/^hsl\((\d+), (\d+)%, (\d+)%\)$/);

        expect(match).toBeTruthy();

        const [, hue, saturation, lightness] = match!.map(Number);
        expect(hue).toBeGreaterThanOrEqual(0);
        expect(hue).toBeLessThan(360);
        expect(saturation).toBeGreaterThanOrEqual(50);
        expect(saturation).toBeLessThan(100);
        expect(lightness).toBeGreaterThanOrEqual(40);
        expect(lightness).toBeLessThan(80);
      }
    });

    it('should handle special characters in TestPages functions', () => {
      const html = TestPages.simple('Title with "quotes" & <tags>');

      expect(html).toContain('Title with "quotes" & <tags>');
    });
  });
});