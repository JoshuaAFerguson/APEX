/**
 * @apexcli/browser - Test Utilities
 *
 * Common utilities and helpers for testing screenshot functionality
 */

import type { Page, BrowserContext } from 'playwright';

/**
 * Test page content generators
 */
export const TestPages = {
  /**
   * Create a simple test page with basic content
   */
  simple: (title: string = 'Test Page', backgroundColor: string = '#ffffff') => `
    <html>
      <head><title>${title}</title></head>
      <body style="background:${backgroundColor};margin:0;padding:20px;font-family:Arial,sans-serif;">
        <h1>${title}</h1>
        <p>This is a test page for screenshot utilities.</p>
      </body>
    </html>
  `,

  /**
   * Create a tall page for testing full page screenshots
   */
  tall: (height: number = 5000) => `
    <html>
      <body style="margin:0;padding:0;">
        <div style="height:${height}px;background:linear-gradient(to bottom,#ff6b6b,#4ecdc4,#45b7d1);">
          <h1 style="padding:20px;color:white;">Tall Page Test</h1>
          <div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);color:white;">
            <h2>Middle Content</h2>
          </div>
          <div style="position:absolute;bottom:20px;left:20px;color:white;">
            <h3>Bottom Content</h3>
          </div>
        </div>
      </body>
    </html>
  `,

  /**
   * Create a complex page with CSS animations and effects
   */
  complex: () => `
    <html>
      <head>
        <style>
          body {
            margin: 0;
            background: linear-gradient(45deg, #667eea, #764ba2);
            font-family: Arial, sans-serif;
          }
          .container {
            padding: 20px;
          }
          .card {
            background: rgba(255,255,255,0.9);
            border-radius: 15px;
            padding: 20px;
            margin: 20px 0;
            box-shadow: 0 8px 32px rgba(0,0,0,0.1);
          }
          @keyframes pulse {
            0% { transform: scale(1); }
            50% { transform: scale(1.05); }
            100% { transform: scale(1); }
          }
          .pulse { animation: pulse 2s infinite; }
          .gradient-text {
            background: linear-gradient(45deg, #ff6b6b, #4ecdc4);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="card pulse">
            <h1 class="gradient-text">Complex Test Page</h1>
            <p>This page includes CSS gradients, animations, and effects.</p>
          </div>
          <div class="card">
            <h2>Features Tested:</h2>
            <ul>
              <li>CSS Gradients</li>
              <li>Border Radius</li>
              <li>Box Shadows</li>
              <li>Animations</li>
              <li>Transparency</li>
            </ul>
          </div>
        </div>
      </body>
    </html>
  `,

  /**
   * Create a page with special characters and unicode
   */
  unicode: () => `
    <html>
      <head><meta charset="UTF-8"></head>
      <body style="padding:20px;font-family:Arial,sans-serif;">
        <h1>Unicode & Special Characters Test 🌟</h1>
        <div>
          <h2>Emojis: 🚀🎉🔥💯⚡🌈🎨</h2>
          <h2>Languages: Hello, 你好, こんにちは, Здравствуйте, مرحبا</h2>
          <h2>Symbols: ♠♣♥♦ ☀☁☂☃ ✓✗⚠ ∑∏∫∆√∞</h2>
          <h2>Currency: $¥€£₹₿</h2>
        </div>
      </body>
    </html>
  `,

  /**
   * Create an empty page
   */
  empty: () => '<html><body></body></html>',

  /**
   * Create a transparent page
   */
  transparent: () => `
    <html>
      <body style="background:transparent;padding:20px;">
        <h1 style="color:#333;">Transparent Background</h1>
      </body>
    </html>
  `
};

/**
 * Screenshot validation utilities
 */
export const ScreenshotValidators = {
  /**
   * Check if buffer contains PNG signature
   */
  isPNG: (buffer: Buffer): boolean => {
    return buffer.length >= 4 &&
           buffer[0] === 0x89 &&
           buffer[1] === 0x50 &&
           buffer[2] === 0x4E &&
           buffer[3] === 0x47;
  },

  /**
   * Check if buffer contains JPEG signature
   */
  isJPEG: (buffer: Buffer): boolean => {
    return buffer.length >= 3 &&
           buffer[0] === 0xFF &&
           buffer[1] === 0xD8 &&
           buffer[2] === 0xFF;
  },

  /**
   * Validate screenshot result structure
   */
  isValidResult: (result: any): boolean => {
    return typeof result === 'object' &&
           typeof result.success === 'boolean' &&
           typeof result.duration === 'number' &&
           result.duration >= 0;
  },

  /**
   * Validate successful screenshot result
   */
  isSuccessfulResult: (result: any): boolean => {
    return ScreenshotValidators.isValidResult(result) &&
           result.success === true &&
           Buffer.isBuffer(result.data) &&
           result.data.length > 0 &&
           result.error === undefined;
  },

  /**
   * Validate failed screenshot result
   */
  isFailedResult: (result: any): boolean => {
    return ScreenshotValidators.isValidResult(result) &&
           result.success === false &&
           typeof result.error === 'string' &&
           result.error.length > 0;
  }
};

/**
 * Performance testing utilities
 */
export class PerformanceMonitor {
  private startTime: number = 0;
  private measurements: number[] = [];

  start(): void {
    this.startTime = Date.now();
  }

  stop(): number {
    const duration = Date.now() - this.startTime;
    this.measurements.push(duration);
    return duration;
  }

  getAverage(): number {
    if (this.measurements.length === 0) return 0;
    return this.measurements.reduce((sum, val) => sum + val, 0) / this.measurements.length;
  }

  getMedian(): number {
    if (this.measurements.length === 0) return 0;
    const sorted = [...this.measurements].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0
      ? (sorted[mid - 1] + sorted[mid]) / 2
      : sorted[mid];
  }

  getMin(): number {
    return this.measurements.length > 0 ? Math.min(...this.measurements) : 0;
  }

  getMax(): number {
    return this.measurements.length > 0 ? Math.max(...this.measurements) : 0;
  }

  reset(): void {
    this.measurements = [];
  }

  getStats(): {
    count: number;
    average: number;
    median: number;
    min: number;
    max: number;
  } {
    return {
      count: this.measurements.length,
      average: this.getAverage(),
      median: this.getMedian(),
      min: this.getMin(),
      max: this.getMax()
    };
  }
}

/**
 * Mock error scenarios for testing
 */
export const MockScenarios = {
  /**
   * Create a page that will timeout
   */
  slowLoadingPage: async (page: Page, delay: number = 5000): Promise<void> => {
    await page.route('**/*', route => {
      setTimeout(() => route.continue(), delay);
    });
  },

  /**
   * Create a page with network errors
   */
  networkError: async (page: Page): Promise<void> => {
    await page.route('**/*', route => {
      route.abort('failed');
    });
  },

  /**
   * Create a page that throws JavaScript errors
   */
  jsError: () => `
    <html>
      <body>
        <h1>JavaScript Error Test</h1>
        <script>
          // This will throw an error
          setTimeout(() => {
            throw new Error('Test JavaScript error');
          }, 100);
        </script>
      </body>
    </html>
  `
};

/**
 * Test data generators
 */
export const TestDataGenerators = {
  /**
   * Generate test content with specified number of elements
   */
  generateHeavyContent: (elementCount: number): string => {
    const elements = Array.from({ length: elementCount }, (_, i) =>
      `<div style="padding:10px;background:hsl(${i % 360}, 50%, 75%);">Element ${i + 1}</div>`
    ).join('');

    return `
      <html>
        <body>
          <h1>Heavy Content Test (${elementCount} elements)</h1>
          ${elements}
        </body>
      </html>
    `;
  },

  /**
   * Generate random color values
   */
  randomColor: (): string => {
    const hue = Math.floor(Math.random() * 360);
    const saturation = 50 + Math.floor(Math.random() * 50);
    const lightness = 40 + Math.floor(Math.random() * 40);
    return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
  },

  /**
   * Generate test page with random content
   */
  randomTestPage: (): string => {
    const backgroundColor = TestDataGenerators.randomColor();
    const textColor = TestDataGenerators.randomColor();
    const numElements = Math.floor(Math.random() * 50) + 10;

    const elements = Array.from({ length: numElements }, (_, i) =>
      `<p style="color:${TestDataGenerators.randomColor()};">Random content ${i + 1}</p>`
    ).join('');

    return `
      <html>
        <body style="background:${backgroundColor};color:${textColor};padding:20px;">
          <h1>Random Test Page</h1>
          ${elements}
        </body>
      </html>
    `;
  }
};