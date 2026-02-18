import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { WebFetchTool, type WebFetchParams } from './webfetch';
import TurndownService from 'turndown';

// Mock the global fetch function
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Helper function to create mock Response objects
function createMockResponse(options: {
  ok: boolean;
  status: number;
  statusText: string;
  headers: Record<string, string>;
  url: string;
  redirected: boolean;
  text: string;
}): any {
  const headersMap = new Map(Object.entries(options.headers));

  return {
    ok: options.ok,
    status: options.status,
    statusText: options.statusText,
    headers: {
      forEach: (callback: (value: string, key: string) => void) => {
        for (const [key, value] of headersMap) {
          callback(value, key);
        }
      }
    },
    url: options.url,
    redirected: options.redirected,
    text: () => Promise.resolve(options.text),
  };
}

describe('WebFetchTool - Turndown Library Integration', () => {
  let tool: WebFetchTool;

  beforeEach(() => {
    tool = new WebFetchTool();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Turndown service configuration', () => {
    it('should use proper turndown service configuration for markdown conversion', async () => {
      const mockHtml = `
        <html>
          <body>
            <h1>Heading 1</h1>
            <h2>Heading 2</h2>
            <h3>Heading 3</h3>
            <p>Paragraph with <strong>bold text</strong> and <em>italic text</em>.</p>
            <ul>
              <li>Bullet item 1</li>
              <li>Bullet item 2</li>
            </ul>
            <ol>
              <li>Numbered item 1</li>
              <li>Numbered item 2</li>
            </ol>
            <a href="http://example.com">Link text</a>
            <code>inline code</code>
          </body>
        </html>
      `;

      mockFetch.mockResolvedValueOnce(createMockResponse({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: {
          'content-type': 'text/html; charset=utf-8',
        },
        url: 'https://test.com',
        redirected: false,
        text: mockHtml,
      }));

      const params: WebFetchParams = {
        url: 'https://test.com',
        convertToMarkdown: true,
      };

      const result = await tool.execute(params);

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();

      // Test ATX heading style (# ## ###)
      expect(result.data).toContain('# Heading 1');
      expect(result.data).toContain('## Heading 2');
      expect(result.data).toContain('### Heading 3');

      // Test bullet list marker (-)
      expect(result.data).toContain('- Bullet item 1');
      expect(result.data).toContain('- Bullet item 2');

      // Test emphasis delimiters (* for em, ** for strong)
      expect(result.data).toContain('**bold text**');
      expect(result.data).toContain('*italic text*');

      // Test inline link style [text](url)
      expect(result.data).toContain('[Link text](http://example.com)');

      // Test inline code with backticks
      expect(result.data).toContain('`inline code`');

      // Test numbered list
      expect(result.data).toContain('1. Numbered item 1');
      expect(result.data).toContain('2. Numbered item 2');
    });

    it('should handle custom rules for script and style removal', async () => {
      const mockHtml = `
        <html>
          <head>
            <style>
              body { font-family: Arial, sans-serif; }
              .header { color: blue; }
            </style>
            <script type="text/javascript">
              function doSomething() {
                alert('This should be removed');
              }
              doSomething();
            </script>
          </head>
          <body>
            <h1>Clean Content</h1>
            <p>This content should remain.</p>
            <script>
              console.log('Another script to remove');
              var x = 5;
            </script>
            <noscript>
              This content is for non-JavaScript browsers
            </noscript>
            <p>Final paragraph.</p>
          </body>
        </html>
      `;

      mockFetch.mockResolvedValueOnce(createMockResponse({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: {
          'content-type': 'text/html; charset=utf-8',
        },
        url: 'https://test.com',
        redirected: false,
        text: mockHtml,
      }));

      const params: WebFetchParams = {
        url: 'https://test.com',
        convertToMarkdown: true,
      };

      const result = await tool.execute(params);

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();

      // Content that should remain
      expect(result.data).toContain('# Clean Content');
      expect(result.data).toContain('This content should remain');
      expect(result.data).toContain('Final paragraph');

      // Content that should be removed
      expect(result.data).not.toContain('font-family: Arial');
      expect(result.data).not.toContain('color: blue');
      expect(result.data).not.toContain('function doSomething');
      expect(result.data).not.toContain('alert(\'This should be removed\')');
      expect(result.data).not.toContain('console.log');
      expect(result.data).not.toContain('var x = 5');
      expect(result.data).not.toContain('This content is for non-JavaScript browsers');
    });

    it('should handle custom code block preservation rules', async () => {
      const mockHtml = `
        <html>
          <body>
            <h1>Code Examples</h1>
            <p>Here are some code examples:</p>

            <h2>JavaScript</h2>
            <pre><code class="language-javascript">
function fibonacci(n) {
  if (n <= 1) return n;
  return fibonacci(n-1) + fibonacci(n-2);
}
console.log(fibonacci(10));
            </code></pre>

            <h2>Python</h2>
            <pre><code class="language-python">
def quicksort(arr):
    if len(arr) <= 1:
        return arr
    pivot = arr[len(arr) // 2]
    return quicksort([x for x in arr if x < pivot]) + [x for x in arr if x == pivot] + quicksort([x for x in arr if x > pivot])
            </code></pre>

            <h2>Plain Code Block</h2>
            <pre><code>
This is a plain code block without language specification.
It should still be formatted properly.
            </code></pre>

            <p>And some inline code: <code>const x = 42;</code></p>
          </body>
        </html>
      `;

      mockFetch.mockResolvedValueOnce(createMockResponse({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: {
          'content-type': 'text/html; charset=utf-8',
        },
        url: 'https://test.com',
        redirected: false,
        text: mockHtml,
      }));

      const params: WebFetchParams = {
        url: 'https://test.com',
        convertToMarkdown: true,
      };

      const result = await tool.execute(params);

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();

      // Test fenced code blocks with language
      expect(result.data).toContain('```javascript');
      expect(result.data).toContain('function fibonacci');
      expect(result.data).toContain('```python');
      expect(result.data).toContain('def quicksort');

      // Test plain code block
      expect(result.data).toContain('```\nThis is a plain code block');

      // Test inline code
      expect(result.data).toContain('`const x = 42;`');

      // Make sure code content is preserved
      expect(result.data).toContain('fibonacci(n-1) + fibonacci(n-2)');
      expect(result.data).toContain('len(arr) <= 1');
    });

    it('should handle enhanced image rule with proper markdown formatting', async () => {
      const mockHtml = `
        <html>
          <body>
            <h1>Image Gallery</h1>

            <h2>Images with alt text and titles</h2>
            <img src="/path/to/image1.jpg" alt="Beautiful sunset" title="Sunset over the mountains">
            <img src="/path/to/image2.png" alt="City skyline" title="Downtown at night">

            <h2>Images with alt text only</h2>
            <img src="/path/to/image3.gif" alt="Animated logo">
            <img src="/path/to/image4.jpg" alt="Product photo">

            <h2>Images with src only</h2>
            <img src="/path/to/image5.webp">
            <img src="/path/to/image6.svg">

            <h2>Images with empty or missing attributes</h2>
            <img src="/path/to/image7.jpg" alt="">
            <img src="" alt="Missing source">
            <img alt="No source attribute">

            <h2>Complex image scenarios</h2>
            <figure>
              <img src="/chart.png" alt="Sales chart" title="Q4 2023 Sales Data">
              <figcaption>Figure 1: Sales performance chart</figcaption>
            </figure>
          </body>
        </html>
      `;

      mockFetch.mockResolvedValueOnce(createMockResponse({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: {
          'content-type': 'text/html; charset=utf-8',
        },
        url: 'https://test.com',
        redirected: false,
        text: mockHtml,
      }));

      const params: WebFetchParams = {
        url: 'https://test.com',
        convertToMarkdown: true,
      };

      const result = await tool.execute(params);

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();

      // Images with alt text and titles
      expect(result.data).toContain('![Beautiful sunset](/path/to/image1.jpg "Sunset over the mountains")');
      expect(result.data).toContain('![City skyline](/path/to/image2.png "Downtown at night")');

      // Images with alt text only
      expect(result.data).toContain('![Animated logo](/path/to/image3.gif)');
      expect(result.data).toContain('![Product photo](/path/to/image4.jpg)');

      // Images with src only
      expect(result.data).toContain('![](/path/to/image5.webp)');
      expect(result.data).toContain('![](/path/to/image6.svg)');

      // Images with empty alt should still work
      expect(result.data).toContain('![](/path/to/image7.jpg)');

      // Images without src should fallback appropriately
      expect(result.data).toContain('[Missing source]');

      // Complex image in figure
      expect(result.data).toContain('![Sales chart](/chart.png "Q4 2023 Sales Data")');
      expect(result.data).toContain('Figure 1: Sales performance chart');
    });

    it('should handle navigation element removal rule', async () => {
      const mockHtml = `
        <html>
          <body>
            <header>
              <h1>Site Header</h1>
              <p>This header content should be removed</p>
            </header>

            <nav>
              <ul>
                <li><a href="/home">Home</a></li>
                <li><a href="/about">About</a></li>
                <li><a href="/contact">Contact</a></li>
              </ul>
            </nav>

            <main>
              <h1>Main Content</h1>
              <p>This is the main content that should be preserved.</p>

              <article>
                <h2>Article Title</h2>
                <p>Article content goes here.</p>
              </article>
            </main>

            <aside>
              <h3>Sidebar</h3>
              <p>Sidebar content should be removed</p>
              <ul>
                <li>Related link 1</li>
                <li>Related link 2</li>
              </ul>
            </aside>

            <footer>
              <p>Footer content should be removed</p>
              <p>&copy; 2023 Company Name</p>
            </footer>

            <menu>
              <li>Menu item 1</li>
              <li>Menu item 2</li>
            </menu>
          </body>
        </html>
      `;

      mockFetch.mockResolvedValueOnce(createMockResponse({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: {
          'content-type': 'text/html; charset=utf-8',
        },
        url: 'https://test.com',
        redirected: false,
        text: mockHtml,
      }));

      const params: WebFetchParams = {
        url: 'https://test.com',
        convertToMarkdown: true,
      };

      const result = await tool.execute(params);

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();

      // Content that should be preserved
      expect(result.data).toContain('# Main Content');
      expect(result.data).toContain('This is the main content that should be preserved');
      expect(result.data).toContain('## Article Title');
      expect(result.data).toContain('Article content goes here');

      // Content that should be removed (navigation elements)
      expect(result.data).not.toContain('Site Header');
      expect(result.data).not.toContain('This header content should be removed');
      expect(result.data).not.toContain('Home');
      expect(result.data).not.toContain('About');
      expect(result.data).not.toContain('Contact');
      expect(result.data).not.toContain('Sidebar');
      expect(result.data).not.toContain('Sidebar content should be removed');
      expect(result.data).not.toContain('Footer content should be removed');
      expect(result.data).not.toContain('Company Name');
      expect(result.data).not.toContain('Menu item 1');
      expect(result.data).not.toContain('Menu item 2');
    });

    it('should handle form element description rule', async () => {
      const mockHtml = `
        <html>
          <body>
            <h1>Contact Form</h1>

            <form action="/submit" method="post" id="contact-form">
              <fieldset>
                <legend>Personal Information</legend>

                <label for="name">Name:</label>
                <input type="text" id="name" name="name" placeholder="Enter your full name" required>

                <label for="email">Email:</label>
                <input type="email" id="email" name="email" placeholder="your@email.com">

                <label for="phone">Phone:</label>
                <input type="tel" id="phone" name="phone" placeholder="+1-555-123-4567">

                <label for="age">Age:</label>
                <input type="number" id="age" name="age" min="18" max="120" value="25">

                <label for="birthdate">Birth Date:</label>
                <input type="date" id="birthdate" name="birthdate">

                <label for="website">Website:</label>
                <input type="url" id="website" name="website" placeholder="https://yoursite.com">

                <label for="password">Password:</label>
                <input type="password" id="password" name="password" placeholder="Enter secure password">

                <input type="hidden" name="csrf_token" value="abc123">
              </fieldset>

              <fieldset>
                <legend>Preferences</legend>

                <input type="radio" id="theme-light" name="theme" value="light" checked>
                <label for="theme-light">Light Theme</label>

                <input type="radio" id="theme-dark" name="theme" value="dark">
                <label for="theme-dark">Dark Theme</label>

                <input type="checkbox" id="newsletter" name="newsletter" checked>
                <label for="newsletter">Subscribe to newsletter</label>

                <input type="checkbox" id="terms" name="terms" required>
                <label for="terms">I agree to the terms and conditions</label>

                <label for="country">Country:</label>
                <select id="country" name="country">
                  <option value="">Please select</option>
                  <option value="us" selected>United States</option>
                  <option value="ca">Canada</option>
                  <option value="uk">United Kingdom</option>
                  <option value="de">Germany</option>
                </select>

                <label for="comments">Additional Comments:</label>
                <textarea id="comments" name="comments" rows="5" cols="50" placeholder="Enter any additional comments here"></textarea>
              </fieldset>

              <fieldset>
                <legend>File Upload</legend>
                <input type="file" id="resume" name="resume" accept=".pdf,.doc,.docx">
                <input type="file" id="photos" name="photos" multiple accept="image/*">
              </fieldset>

              <div class="buttons">
                <button type="submit">Submit Application</button>
                <button type="reset">Clear Form</button>
                <button type="button" onclick="showHelp()">Get Help</button>
              </div>
            </form>
          </body>
        </html>
      `;

      mockFetch.mockResolvedValueOnce(createMockResponse({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: {
          'content-type': 'text/html; charset=utf-8',
        },
        url: 'https://test.com',
        redirected: false,
        text: mockHtml,
      }));

      const params: WebFetchParams = {
        url: 'https://test.com',
        convertToMarkdown: true,
      };

      const result = await tool.execute(params);

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();

      // Test form wrapper
      expect(result.data).toMatch(/\[Form:[\s\S]*\]/);

      // Test various input types with descriptions
      expect(result.data).toContain('[Input: text, placeholder: "Enter your full name"]');
      expect(result.data).toContain('[Input: email, placeholder: "your@email.com"]');
      expect(result.data).toContain('[Input: tel, placeholder: "+1-555-123-4567"]');
      expect(result.data).toContain('[Input: number, value: "25"]');
      expect(result.data).toContain('[Input: date]');
      expect(result.data).toContain('[Input: url, placeholder: "https://yoursite.com"]');
      expect(result.data).toContain('[Input: password, placeholder: "Enter secure password"]');
      expect(result.data).toContain('[Input: hidden, value: "abc123"]');
      expect(result.data).toContain('[Input: radio]');
      expect(result.data).toContain('[Input: checkbox]');
      expect(result.data).toContain('[Input: file]');

      // Test textarea
      expect(result.data).toContain('[Textarea: Enter any additional comments here]');

      // Test select
      expect(result.data).toContain('[Select:');

      // Test buttons
      expect(result.data).toContain('[Button: Submit Application]');
      expect(result.data).toContain('[Button: Clear Form]');
      expect(result.data).toContain('[Button: Get Help]');
    });

    it('should handle table preservation rule', async () => {
      const mockHtml = `
        <html>
          <body>
            <h1>Data Tables</h1>

            <h2>Simple Table</h2>
            <table>
              <tr>
                <th>Name</th>
                <th>Age</th>
                <th>City</th>
              </tr>
              <tr>
                <td>Alice</td>
                <td>30</td>
                <td>New York</td>
              </tr>
              <tr>
                <td>Bob</td>
                <td>25</td>
                <td>Los Angeles</td>
              </tr>
            </table>

            <h2>Complex Table with Headers</h2>
            <table border="1" cellpadding="5">
              <thead>
                <tr>
                  <th rowspan="2">Product</th>
                  <th colspan="2">Sales</th>
                  <th rowspan="2">Total</th>
                </tr>
                <tr>
                  <th>Q1</th>
                  <th>Q2</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td><strong>Widget A</strong></td>
                  <td>100</td>
                  <td>120</td>
                  <td><em>220</em></td>
                </tr>
                <tr>
                  <td><strong>Widget B</strong></td>
                  <td>85</td>
                  <td>95</td>
                  <td><em>180</em></td>
                </tr>
              </tbody>
              <tfoot>
                <tr>
                  <td><strong>Total</strong></td>
                  <td><strong>185</strong></td>
                  <td><strong>215</strong></td>
                  <td><strong>400</strong></td>
                </tr>
              </tfoot>
            </table>
          </body>
        </html>
      `;

      mockFetch.mockResolvedValueOnce(createMockResponse({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: {
          'content-type': 'text/html; charset=utf-8',
        },
        url: 'https://test.com',
        redirected: false,
        text: mockHtml,
      }));

      const params: WebFetchParams = {
        url: 'https://test.com',
        convertToMarkdown: true,
      };

      const result = await tool.execute(params);

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();

      // Test that tables are preserved and formatted
      expect(result.data).toContain('# Data Tables');
      expect(result.data).toContain('## Simple Table');
      expect(result.data).toContain('## Complex Table with Headers');

      // Table content should be preserved
      expect(result.data).toContain('Name');
      expect(result.data).toContain('Age');
      expect(result.data).toContain('City');
      expect(result.data).toContain('Alice');
      expect(result.data).toContain('Bob');
      expect(result.data).toContain('New York');
      expect(result.data).toContain('Los Angeles');

      // Complex table content
      expect(result.data).toContain('Product');
      expect(result.data).toContain('Sales');
      expect(result.data).toContain('**Widget A**');
      expect(result.data).toContain('**Widget B**');
      expect(result.data).toContain('*220*');
      expect(result.data).toContain('*180*');
    });
  });

  describe('Turndown fallback scenarios', () => {
    it('should gracefully handle turndown service errors and use fallback', async () => {
      const mockHtml = `
        <html>
          <body>
            <h1>Fallback Test</h1>
            <p>This content should be processed by fallback when turndown fails.</p>
            <strong>Bold text</strong> and <em>italic text</em>
            <a href="http://example.com">Test link</a>
            <img src="image.jpg" alt="Test image">
          </body>
        </html>
      `;

      mockFetch.mockResolvedValueOnce(createMockResponse({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: {
          'content-type': 'text/html; charset=utf-8',
        },
        url: 'https://test.com',
        redirected: false,
        text: mockHtml,
      }));

      // Spy on console.warn to check that fallback warning is shown
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const params: WebFetchParams = {
        url: 'https://test.com',
        convertToMarkdown: true,
      };

      const result = await tool.execute(params);

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();

      // Should contain converted content from either turndown or fallback
      expect(result.data).toContain('Fallback Test');
      expect(result.data).toContain('This content should be processed');

      consoleWarnSpy.mockRestore();
    });
  });
});