/**
 * @apexcli/browser - Test Page Generators
 *
 * Migrated from __tests__/test-utils.ts
 */

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